import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, UserPlus, Upload, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

interface TeamMember {
  id: string;
  full_name: string;
  role_label: string | null;
  avatar_url: string | null;
  bio: string | null;
}

export function ClientTeamManagement({ clientId }: { clientId: string }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [bio, setBio] = useState("");
  const [uploading, setUploading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const editFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMembers();
  }, [clientId]);

  const fetchMembers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("client_employees")
      .select("id, full_name, role_label, avatar_url, bio")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });
    setMembers((data as TeamMember[]) || []);
    setLoading(false);
  };

  const uploadAvatar = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `team/${clientId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file);
    if (error) return null;
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Максимальный размер 10 МБ");
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleEditFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Максимальный размер 10 МБ");
      return;
    }
    setEditAvatarFile(file);
    setEditAvatarPreview(URL.createObjectURL(file));
  };

  const addMember = async () => {
    if (!name.trim()) {
      toast.error("Введите имя сотрудника");
      return;
    }

    setUploading(true);
    let avatarUrl: string | null = null;
    if (avatarFile) {
      avatarUrl = await uploadAvatar(avatarFile);
      if (!avatarUrl) {
        toast.error("Ошибка загрузки фото");
        setUploading(false);
        return;
      }
    }

    const { error } = await supabase.from("client_employees").insert({
      client_id: clientId,
      full_name: name.trim(),
      role_label: role.trim() || null,
      avatar_url: avatarUrl,
      bio: bio.trim() || null,
    });

    setUploading(false);
    if (error) { toast.error("Ошибка добавления"); return; }

    toast.success("Сотрудник добавлен");
    setName(""); setRole(""); setBio("");
    setAvatarFile(null); setAvatarPreview(null);
    fetchMembers();
  };

  const startEdit = (m: TeamMember) => {
    setEditId(m.id);
    setEditName(m.full_name);
    setEditRole(m.role_label || "");
    setEditBio(m.bio || "");
    setEditAvatarFile(null);
    setEditAvatarPreview(m.avatar_url);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditAvatarFile(null);
    setEditAvatarPreview(null);
  };

  const saveEdit = async () => {
    if (!editName.trim() || !editId) return;
    setEditSaving(true);

    const updates: Record<string, unknown> = {
      full_name: editName.trim(),
      role_label: editRole.trim() || null,
      bio: editBio.trim() || null,
    };

    if (editAvatarFile) {
      const url = await uploadAvatar(editAvatarFile);
      if (!url) { toast.error("Ошибка загрузки фото"); setEditSaving(false); return; }
      updates.avatar_url = url;
    }

    const { error } = await supabase.from("client_employees").update(updates).eq("id", editId);
    setEditSaving(false);
    if (error) { toast.error("Ошибка сохранения"); return; }

    toast.success("Данные обновлены");
    cancelEdit();
    fetchMembers();
  };

  const removeMember = async (member: TeamMember) => {
    const { error } = await supabase.from("client_employees").delete().eq("id", member.id);
    if (error) { toast.error("Ошибка удаления"); return; }
    toast.success("Сотрудник убран");
    setMembers((prev) => prev.filter((m) => m.id !== member.id));
    if (editId === member.id) cancelEdit();
  };

  const getInitials = (n: string) =>
    n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  if (loading) {
    return <div className="p-4 animate-pulse"><div className="h-16 bg-muted rounded" /></div>;
  }

  return (
    <div className="p-4 space-y-4">
      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Нет прикрепленных сотрудников</p>
      ) : (
        <div className="space-y-2">
          {members.map((m) =>
            editId === m.id ? (
              <div key={m.id} className="p-3 rounded-lg border border-primary/30 bg-muted/30 space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar
                    className="h-12 w-12 cursor-pointer hover:opacity-80"
                    onClick={() => editFileRef.current?.click()}
                  >
                    {editAvatarPreview && <AvatarImage src={editAvatarPreview} />}
                    <AvatarFallback><Upload className="h-4 w-4" /></AvatarFallback>
                  </Avatar>
                  <input ref={editFileRef} type="file" accept="image/*" className="hidden" onChange={handleEditFileSelect} />
                  <p className="text-xs text-muted-foreground">Нажмите на аватар для смены фото</p>
                </div>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="ФИО" />
                <Input value={editRole} onChange={(e) => setEditRole(e.target.value)} placeholder="Должность" />
                <Textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} placeholder="Описание" rows={2} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveEdit} disabled={!editName.trim() || editSaving} className="flex-1">
                    <Check className="h-4 w-4 mr-1" />
                    {editSaving ? "Сохранение..." : "Сохранить"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={cancelEdit}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg border">
                <Avatar className="h-10 w-10">
                  {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                  <AvatarFallback className="text-xs">{getInitials(m.full_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.full_name}</p>
                  {m.role_label && <p className="text-xs text-muted-foreground">{m.role_label}</p>}
                  {m.bio && <p className="text-xs text-muted-foreground truncate">{m.bio}</p>}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(m)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeMember(m)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )
          )}
        </div>
      )}

      {/* Add form */}
      <div className="border-t pt-4 space-y-3">
        <p className="text-sm font-medium">Добавить сотрудника</p>
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 cursor-pointer hover:opacity-80" onClick={() => fileRef.current?.click()}>
            {avatarPreview && <AvatarImage src={avatarPreview} />}
            <AvatarFallback><Upload className="h-4 w-4" /></AvatarFallback>
          </Avatar>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          <p className="text-xs text-muted-foreground">Нажмите для загрузки фото</p>
        </div>
        <Input placeholder="ФИО сотрудника" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Должность (напр. Юрист)" value={role} onChange={(e) => setRole(e.target.value)} />
        <Textarea placeholder="Описание (необязательно)" value={bio} onChange={(e) => setBio(e.target.value)} rows={2} />
        <Button size="sm" onClick={addMember} disabled={!name.trim() || uploading} className="w-full">
          <UserPlus className="h-4 w-4 mr-1" />
          {uploading ? "Загрузка..." : "Добавить"}
        </Button>
      </div>
    </div>
  );
}
