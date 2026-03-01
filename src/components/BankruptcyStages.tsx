import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Edit2, Save, X } from "lucide-react";

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

  useEffect(() => {
    fetchStages();
  }, [clientId]);

  const fetchStages = async () => {
    const { data, error } = await supabase
      .from("bankruptcy_stages")
      .select("*")
      .eq("client_id", clientId)
      .order("stage_number", { ascending: true });

    if (!error && data) setStages(data);
    setLoading(false);
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
          {stages.map((stage) => (
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
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
