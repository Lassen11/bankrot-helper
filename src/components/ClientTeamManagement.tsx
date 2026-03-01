import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, UserPlus, Upload } from "lucide-react";
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const addMember = async () => {
    if (!name.trim()) {
      toast.error("Введите имя сотрудника");
      return;
    }

    setUploading(true);
    let avatarUrl: string | null = null;

    if (avatarFile) {
      const ext = avatarFile.name.split(".").pop();
      const path = `team/${clientId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, avatarFile);

      if (uploadError) {
        toast.error("Ошибка загрузки фото");
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      avatarUrl = urlData.publicUrl;
    }

    const { error } = await supabase.from("client_employees").insert({
      client_id: clientId,
      full_name: name.trim(),
      role_label: role.trim() || null,
      avatar_url: avatarUrl,
      bio: bio.trim() || null,
    });

    setUploading(false);

    if (error) {
      toast.error("Ошибка добавления");
      return;
    }

    toast.success("Сотрудник добавлен");
    setName("");
    setRole("");
    setBio("");
    setAvatarFile(null);
    setAvatarPreview(null);
    fetchMembers();
  };

  const removeMember = async (member: TeamMember) => {
    const { error } = await supabase.from("client_employees").delete().eq("id", member.id);
    if (error) {
      toast.error("Ошибка удаления");
      return;
    }
    toast.success("Сотрудник убран");
    setMembers((prev) => prev.filter((m) => m.id !== member.id));
  };

  const getInitials = (name: string) =>
    name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  if (loading) {
    return <div className="p-4 animate-pulse"><div className="h-16 bg-muted rounded" /></div>;
  }

  return (
    <div className="p-4 space-y-4">
      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Нет прикрепленных сотрудников</p>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
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
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeMember(m)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      <div className="border-t pt-4 space-y-3">
        <p className="text-sm font-medium">Добавить сотрудника</p>

        <div className="flex items-center gap-3">
          <Avatar
            className="h-12 w-12 cursor-pointer hover:opacity-80"
            onClick={() => fileRef.current?.click()}
          >
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
