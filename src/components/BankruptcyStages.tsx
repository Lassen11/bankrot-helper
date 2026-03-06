import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Edit2, Save, X, Upload, FileIcon, Trash2, Download } from "lucide-react";

interface StageFile {
  id: string;
  stage_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

interface Stage {
  id: string;
  stage_number: number;
  title: string;
  description: string;
  is_completed: boolean;
  completed_at: string | null;
}

interface BankruptcyStagesProps {
  clientId: string;
}

export function BankruptcyStages({ clientId }: BankruptcyStagesProps) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [stageFiles, setStageFiles] = useState<Record<string, StageFile[]>>({});
  const [uploadingStageId, setUploadingStageId] = useState<string | null>(null);

  useEffect(() => {
    fetchStages();
  }, [clientId]);

  const fetchStages = async () => {
    const { data, error } = await supabase
      .from("bankruptcy_stages")
      .select("*")
      .eq("client_id", clientId)
      .order("stage_number", { ascending: true });

    if (!error && data) {
      setStages(data);
      fetchAllFiles(data.map((s) => s.id));
    }
    setLoading(false);
  };

  const fetchAllFiles = async (stageIds: string[]) => {
    if (stageIds.length === 0) return;
    const { data } = await supabase
      .from("bankruptcy_stage_files")
      .select("*")
      .in("stage_id", stageIds)
      .order("created_at", { ascending: true });

    if (data) {
      const grouped: Record<string, StageFile[]> = {};
      for (const f of data) {
        if (!grouped[f.stage_id]) grouped[f.stage_id] = [];
        grouped[f.stage_id].push(f);
      }
      setStageFiles(grouped);
    }
  };

  const toggleCompletion = async (stage: Stage) => {
    const newCompleted = !stage.is_completed;
    const { error } = await supabase
      .from("bankruptcy_stages")
      .update({
        is_completed: newCompleted,
        completed_at: newCompleted ? new Date().toISOString() : null,
      })
      .eq("id", stage.id);

    if (error) {
      toast.error("Ошибка при обновлении");
      return;
    }

    setStages((prev) =>
      prev.map((s) =>
        s.id === stage.id
          ? { ...s, is_completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null }
          : s
      )
    );
  };

  const startEdit = (stage: Stage) => {
    setEditingId(stage.id);
    setEditTitle(stage.title);
    setEditDescription(stage.description || "");
  };

  const saveEdit = async (stageId: string) => {
    const { error } = await supabase
      .from("bankruptcy_stages")
      .update({ title: editTitle, description: editDescription })
      .eq("id", stageId);

    if (error) {
      toast.error("Ошибка при сохранении");
      return;
    }

    setStages((prev) =>
      prev.map((s) =>
        s.id === stageId ? { ...s, title: editTitle, description: editDescription } : s
      )
    );
    setEditingId(null);
    toast.success("Этап обновлён");
  };

  const handleFileUpload = async (stageId: string, file: File) => {
    setUploadingStageId(stageId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Необходима авторизация");
        return;
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `stage-files/${clientId}/${stageId}/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("cabinet-files")
        .upload(filePath, file);

      if (uploadError) {
        toast.error("Ошибка загрузки файла");
        return;
      }

      const { error: dbError } = await supabase
        .from("bankruptcy_stage_files")
        .insert({
          stage_id: stageId,
          client_id: clientId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type || "application/octet-stream",
          uploaded_by: user.id,
        });

      if (dbError) {
        toast.error("Ошибка сохранения записи");
        return;
      }

      toast.success("Файл загружен");
      fetchAllFiles(stages.map((s) => s.id));
    } finally {
      setUploadingStageId(null);
    }
  };

  const handleDownloadFile = async (file: StageFile) => {
    const { data } = supabase.storage.from("cabinet-files").getPublicUrl(file.file_path);
    if (data?.publicUrl) {
      window.open(data.publicUrl, "_blank");
    }
  };

  const handleDeleteFile = async (file: StageFile) => {
    const { error: storageError } = await supabase.storage
      .from("cabinet-files")
      .remove([file.file_path]);

    if (storageError) {
      toast.error("Ошибка удаления файла из хранилища");
      return;
    }

    const { error: dbError } = await supabase
      .from("bankruptcy_stage_files")
      .delete()
      .eq("id", file.id);

    if (dbError) {
      toast.error("Ошибка удаления записи");
      return;
    }

    toast.success("Файл удалён");
    setStageFiles((prev) => ({
      ...prev,
      [file.stage_id]: (prev[file.stage_id] || []).filter((f) => f.id !== file.id),
    }));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  };

  if (loading) return null;
  if (stages.length === 0) return null;

  const completedCount = stages.filter((s) => s.is_completed).length;

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Этапы банкротства</span>
          <span className="text-sm font-normal text-muted-foreground">
            {completedCount} / {stages.length} выполнено
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {stages.map((stage) => {
            const files = stageFiles[stage.id] || [];
            return (
              <div
                key={stage.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  stage.is_completed
                    ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900"
                    : "bg-background border-border"
                }`}
              >
                <Checkbox
                  checked={stage.is_completed}
                  onCheckedChange={() => toggleCompletion(stage)}
                  className="mt-1"
                />

                <div className="flex-1 min-w-0">
                  {editingId === stage.id ? (
                    <div className="space-y-2">
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Название этапа"
                      />
                      <Textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Описание"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit(stage.id)}>
                          <Save className="h-3 w-3 mr-1" /> Сохранить
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-3 w-3 mr-1" /> Отмена
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          #{stage.stage_number}
                        </span>
                        <span
                          className={`font-medium text-sm ${
                            stage.is_completed ? "line-through text-muted-foreground" : ""
                          }`}
                        >
                          {stage.title}
                        </span>
                      </div>
                      {stage.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {stage.description}
                        </p>
                      )}
                      {stage.is_completed && stage.completed_at && (
                        <p className="text-xs text-green-600 mt-1">
                          Выполнено:{" "}
                          {new Date(stage.completed_at).toLocaleDateString("ru-RU")}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Files section */}
                  {files.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1"
                        >
                          <FileIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="truncate flex-1">{file.file_name}</span>
                          <span className="text-muted-foreground shrink-0">
                            {formatFileSize(file.file_size)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 shrink-0"
                            onClick={() => handleDownloadFile(file)}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 shrink-0 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteFile(file)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload button */}
                  <div className="mt-2">
                    <label className="cursor-pointer inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80">
                      <Upload className="h-3 w-3" />
                      {uploadingStageId === stage.id ? "Загрузка..." : "Прикрепить файл"}
                      <input
                        type="file"
                        className="hidden"
                        disabled={uploadingStageId === stage.id}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleFileUpload(stage.id, f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>

                {editingId !== stage.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => startEdit(stage)}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
