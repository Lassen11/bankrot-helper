import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Camera, Save, Loader2 } from "lucide-react";

export function EmployeeProfileEditor() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  const loadProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, avatar_url, bio")
      .eq("user_id", user!.id)
      .single();

    if (data) {
      setFullName(data.full_name || "");
      setAvatarUrl((data as any).avatar_url || null);
      setBio((data as any).bio || "");
    }
  };

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Выберите изображение");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Максимальный размер 10 МБ");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user!.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);

      const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(newUrl);

      await supabase
        .from("profiles")
        .update({ avatar_url: newUrl } as any)
        .eq("user_id", user!.id);

      toast.success("Фото обновлено");
    } catch {
      toast.error("Ошибка загрузки фото");
    } finally {
      setUploading(false);
    }
  };

  const saveBio = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ bio } as any)
        .eq("user_id", user!.id);

      if (error) throw error;
      toast.success("Описание сохранено");
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const initials = fullName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg">Мой профиль для клиентов</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-6">
          <div className="relative group">
            <Avatar className="h-20 w-20">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName} />}
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <button
              type="button"
              className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 text-white animate-spin" />
              ) : (
                <Camera className="h-5 w-5 text-white" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={uploadAvatar}
            />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <p className="font-medium">{fullName}</p>
              <p className="text-xs text-muted-foreground">
                Это фото и описание будут видны вашим клиентам в личном кабинете
              </p>
            </div>
            <Textarea
              placeholder="Ваша должность или описание (например: Юрист по банкротству физических лиц)"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={2}
            />
            <Button size="sm" onClick={saveBio} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
              Сохранить описание
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
