import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Save, Trash2, GripVertical, Edit2, X, Users, ListChecks, Upload } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface TemplateStage {
  id: string;
  stage_number: number;
  title: string;
  description: string;
}

interface TemplateTeamMember {
  id: string;
  full_name: string;
  role_label: string | null;
  bio: string | null;
  avatar_url: string | null;
  sort_order: number;
}

export function CabinetTemplateEditor() {
  const [stages, setStages] = useState<TemplateStage[]>([]);
  const [team, setTeam] = useState<TemplateTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingStages, setSavingStages] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [uploadingMemberId, setUploadingMemberId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [stagesRes, teamRes] = await Promise.all([
      supabase.from("cabinet_template_stages").select("*").order("stage_number"),
      supabase.from("cabinet_template_team").select("*").order("sort_order"),
    ]);

    if (stagesRes.data) setStages(stagesRes.data);
    if (teamRes.data) setTeam(teamRes.data);
    setLoading(false);
  };

  // ---- STAGES ----

  const addStage = () => {
    const maxNumber = stages.length > 0 ? Math.max(...stages.map((s) => s.stage_number)) : 0;
    setStages([
      ...stages,
      {
        id: `new-${Date.now()}`,
        stage_number: maxNumber + 1,
        title: "",
        description: "",
      },
    ]);
    setEditingStageId(`new-${Date.now()}`);
  };

  const updateStageLocal = (id: string, field: keyof TemplateStage, value: string | number) => {
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const removeStage = async (stage: TemplateStage) => {
    if (!stage.id.startsWith("new-")) {
      await supabase.from("cabinet_template_stages").delete().eq("id", stage.id);
    }
    setStages((prev) => prev.filter((s) => s.id !== stage.id));
    toast.success("Этап удалён");
  };

  const saveStages = async () => {
    setSavingStages(true);
    try {
      // Delete all existing and re-insert for simplicity
      await supabase.from("cabinet_template_stages").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      const toInsert = stages.map((s, i) => ({
        stage_number: i + 1,
        title: s.title,
        description: s.description,
      }));

      const { error } = await supabase.from("cabinet_template_stages").insert(toInsert);
      if (error) throw error;

      toast.success("Шаблон этапов сохранён");
      setEditingStageId(null);
      fetchData();
    } catch (e: any) {
      toast.error("Ошибка: " + (e.message || "Не удалось сохранить"));
    } finally {
      setSavingStages(false);
    }
  };

  // ---- TEAM ----

  const addTeamMember = () => {
    const newId = `new-${Date.now()}`;
    setTeam([
      ...team,
      {
        id: newId,
        full_name: "",
        role_label: "",
        bio: "",
        avatar_url: null,
        sort_order: team.length + 1,
      },
    ]);
    setEditingMemberId(newId);
  };

  const updateMemberLocal = (id: string, field: keyof TemplateTeamMember, value: string | null | number) => {
    setTeam((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const removeMember = async (member: TemplateTeamMember) => {
    if (!member.id.startsWith("new-")) {
      await supabase.from("cabinet_template_team").delete().eq("id", member.id);
    }
    setTeam((prev) => prev.filter((m) => m.id !== member.id));
    toast.success("Специалист удалён из шаблона");
  };

  const handleAvatarUpload = async (memberId: string, file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Файл слишком большой (максимум 10 МБ)");
      return;
    }
    setUploadingMemberId(memberId);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `template-team/${Date.now()}_${safeName}`;
      const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, file);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      updateMemberLocal(memberId, "avatar_url", urlData.publicUrl);
      toast.success("Фото загружено");
    } catch (e: any) {
      toast.error("Ошибка загрузки: " + e.message);
    } finally {
      setUploadingMemberId(null);
    }
  };

  const saveTeam = async () => {
    setSavingTeam(true);
    try {
      await supabase.from("cabinet_template_team").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      const toInsert = team.map((m, i) => ({
        full_name: m.full_name,
        role_label: m.role_label || null,
        bio: m.bio || null,
        avatar_url: m.avatar_url || null,
        sort_order: i + 1,
      }));

      const { error } = await supabase.from("cabinet_template_team").insert(toInsert);
      if (error) throw error;

      toast.success("Шаблон команды сохранён");
      setEditingMemberId(null);
      fetchData();
    } catch (e: any) {
      toast.error("Ошибка: " + (e.message || "Не удалось сохранить"));
    } finally {
      setSavingTeam(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "??";
  };

  if (loading) return <div className="animate-pulse h-40 bg-muted rounded" />;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="stages">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="stages" className="gap-2">
            <ListChecks className="h-4 w-4" /> Этапы ({stages.length})
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2">
            <Users className="h-4 w-4" /> Команда ({team.length})
          </TabsTrigger>
        </TabsList>

        {/* Stages Tab */}
        <TabsContent value="stages">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Шаблон этапов банкротства</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={addStage}>
                    <Plus className="h-4 w-4 mr-1" /> Добавить этап
                  </Button>
                  <Button size="sm" onClick={saveStages} disabled={savingStages}>
                    <Save className="h-4 w-4 mr-1" /> {savingStages ? "Сохранение..." : "Сохранить"}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Эти этапы будут автоматически создаваться при генерации нового кабинета клиента
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {stages.map((stage, idx) => (
                <div
                  key={stage.id}
                  className="border rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-mono text-muted-foreground mt-2 w-6 text-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="flex-1 space-y-2">
                      <Input
                        value={stage.title}
                        onChange={(e) => updateStageLocal(stage.id, "title", e.target.value)}
                        placeholder="Название этапа"
                        className="text-sm"
                      />
                      <Textarea
                        value={stage.description}
                        onChange={(e) => updateStageLocal(stage.id, "description", e.target.value)}
                        placeholder="Описание (можно вставлять ссылки)"
                        rows={2}
                        className="text-sm"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive hover:text-destructive"
                      onClick={() => removeStage(stage)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {stages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Нет этапов. Нажмите «Добавить этап» чтобы создать шаблон.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Шаблон команды специалистов</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={addTeamMember}>
                    <Plus className="h-4 w-4 mr-1" /> Добавить специалиста
                  </Button>
                  <Button size="sm" onClick={saveTeam} disabled={savingTeam}>
                    <Save className="h-4 w-4 mr-1" /> {savingTeam ? "Сохранение..." : "Сохранить"}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Эти специалисты будут автоматически добавляться при создании нового кабинета клиента
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {team.map((member) => (
                <div
                  key={member.id}
                  className="border rounded-lg p-4"
                >
                  <div className="flex gap-4">
                    {/* Avatar */}
                    <div className="shrink-0">
                      <label className="cursor-pointer block">
                        <Avatar className="h-16 w-16">
                          {member.avatar_url ? (
                            <AvatarImage src={member.avatar_url} alt={member.full_name} />
                          ) : null}
                          <AvatarFallback className="text-xs">
                            {uploadingMemberId === member.id ? "..." : getInitials(member.full_name || "??")}
                          </AvatarFallback>
                        </Avatar>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleAvatarUpload(member.id, f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <p className="text-[10px] text-muted-foreground text-center mt-1">
                        <Upload className="h-3 w-3 inline" /> Фото
                      </p>
                    </div>

                    {/* Fields */}
                    <div className="flex-1 space-y-2">
                      <Input
                        value={member.full_name}
                        onChange={(e) => updateMemberLocal(member.id, "full_name", e.target.value)}
                        placeholder="ФИО специалиста"
                        className="text-sm"
                      />
                      <Input
                        value={member.role_label || ""}
                        onChange={(e) => updateMemberLocal(member.id, "role_label", e.target.value)}
                        placeholder="Должность / роль"
                        className="text-sm"
                      />
                      <Textarea
                        value={member.bio || ""}
                        onChange={(e) => updateMemberLocal(member.id, "bio", e.target.value)}
                        placeholder="Описание"
                        rows={2}
                        className="text-sm"
                      />
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive hover:text-destructive"
                      onClick={() => removeMember(member)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {team.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Нет специалистов. Нажмите «Добавить специалиста» чтобы создать шаблон.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
