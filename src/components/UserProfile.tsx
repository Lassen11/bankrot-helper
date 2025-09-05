import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { User, Lock, Mail, UserCircle } from "lucide-react";

export const UserProfile = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
  });
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      setProfile({
        full_name: data?.full_name || '',
        email: user.email || '',
      });
    } catch (error) {
      console.error('Ошибка загрузки профиля:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить данные профиля",
        variant: "destructive",
      });
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      // Обновляем имя в профиле
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: profile.full_name })
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      // Обновляем email если он изменился
      if (profile.email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: profile.email,
        });

        if (emailError) throw emailError;

        toast({
          title: "Внимание",
          description: "Для изменения email проверьте вашу почту и подтвердите изменения",
        });
      }

      toast({
        title: "Успешно",
        description: "Личные данные обновлены",
      });
    } catch (error: any) {
      console.error('Ошибка обновления профиля:', error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить данные",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast({
        title: "Ошибка",
        description: "Пароли не совпадают",
        variant: "destructive",
      });
      return;
    }

    if (passwords.newPassword.length < 6) {
      toast({
        title: "Ошибка",
        description: "Пароль должен содержать не менее 6 символов",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwords.newPassword,
      });

      if (error) throw error;

      setPasswords({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

      toast({
        title: "Успешно",
        description: "Пароль изменен",
      });
    } catch (error: any) {
      console.error('Ошибка изменения пароля:', error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось изменить пароль",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Пожалуйста, войдите в систему</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <UserCircle className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Личный кабинет</h1>
      </div>

      {/* Личные данные */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Личные данные
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Полное имя</Label>
              <Input
                id="full_name"
                type="text"
                value={profile.full_name}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                placeholder="Введите ваше полное имя"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  placeholder="Введите ваш email"
                  required
                />
              </div>
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? "Сохранение..." : "Сохранить изменения"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* Изменение пароля */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Изменение пароля
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new_password">Новый пароль</Label>
              <Input
                id="new_password"
                type="password"
                value={passwords.newPassword}
                onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                placeholder="Введите новый пароль"
                minLength={6}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_password">Подтвердите пароль</Label>
              <Input
                id="confirm_password"
                type="password"
                value={passwords.confirmPassword}
                onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                placeholder="Повторите новый пароль"
                minLength={6}
                required
              />
            </div>

            <Button type="submit" disabled={loading} variant="secondary">
              {loading ? "Изменение..." : "Изменить пароль"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};