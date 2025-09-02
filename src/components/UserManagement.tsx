import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, UserPlus, Settings, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface UserWithRole {
  user_id: string;
  full_name: string;
  email: string;
  role: 'admin' | 'employee';
  created_at: string;
}

interface UserManagementProps {
  onUserUpdate: () => void;
}

export const UserManagement = ({ onUserUpdate }: UserManagementProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'employee'>('employee');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Получаем профили пользователей
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')  
        .select('user_id, full_name, created_at');

      if (profilesError) throw profilesError;

      // Получаем роли пользователей
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role, created_at');

      if (rolesError) throw rolesError;

      // Получаем email адреса из Edge Function
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(`https://htvbbyoghtoionbvzekw.supabase.co/functions/v1/admin-users`, {
        headers: {
          'Authorization': `Bearer ${session?.session?.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      let authUsers = [];
      if (response.ok) {
        const result = await response.json();
        authUsers = result.users || [];
      } else {
        console.error('Ошибка получения данных пользователей:', response.statusText);
      }

      const usersWithRoles: UserWithRole[] = profiles?.map(profile => {
        const authUser = authUsers?.find((u: any) => u.id === profile.user_id);
        const roleData = userRoles?.find(r => r.user_id === profile.user_id);
        return {
          user_id: profile.user_id,
          full_name: profile.full_name || 'Не указано',
          email: authUser?.email || 'Не указан',
          role: roleData?.role || 'employee',
          created_at: roleData?.created_at || ''
        };
      }).filter(user => userRoles?.some(r => r.user_id === user.user_id)) || [];

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Ошибка при загрузке пользователей:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить список пользователей",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async () => {
    if (!newUserEmail || !newUserName) {
      toast({
        title: "Ошибка",
        description: "Заполните все поля",
        variant: "destructive",
      });
      return;
    }

    try {
      // Создаем пользователя через Edge Function
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(`https://htvbbyoghtoionbvzekw.supabase.co/functions/v1/admin-users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newUserEmail,
          password: 'temp123456',
          full_name: newUserName,
          role: newUserRole
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка создания пользователя');
      }

      toast({
        title: "Успешно",
        description: `Пользователь ${newUserName} добавлен с ролью ${newUserRole === 'admin' ? 'Администратор' : 'Сотрудник'}`,
      });

      // Сброс формы и обновление списка
      setNewUserEmail('');
      setNewUserName('');
      setNewUserRole('employee');
      setIsDialogOpen(false);
      fetchUsers();
      onUserUpdate();

    } catch (error: any) {
      console.error('Ошибка при создании пользователя:', error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось создать пользователя",
        variant: "destructive",
      });
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'employee') => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Успешно",
        description: `Роль пользователя изменена на ${newRole === 'admin' ? 'Администратор' : 'Сотрудник'}`,
      });

      fetchUsers();
      onUserUpdate();

    } catch (error: any) {
      console.error('Ошибка при изменении роли:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось изменить роль пользователя",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) {
      return;
    }

    try {
      // Удаляем пользователя через Edge Function
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(`https://htvbbyoghtoionbvzekw.supabase.co/functions/v1/admin-users?userId=${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.session?.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка удаления пользователя');
      }

      toast({
        title: "Успешно",
        description: "Пользователь удален",
      });

      fetchUsers();
      onUserUpdate();
    } catch (error: any) {
      console.error('Ошибка при удалении пользователя:', error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить пользователя",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div>Загрузка...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Управление пользователями
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Добавить пользователя
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Добавить нового пользователя</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <Label htmlFor="name">Полное имя</Label>
                <Input
                  id="name"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Иван Иванов"
                />
              </div>
              <div>
                <Label htmlFor="role">Роль</Label>
                <Select value={newUserRole} onValueChange={(value: 'admin' | 'employee') => setNewUserRole(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите роль" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Сотрудник</SelectItem>
                    <SelectItem value="admin">Администратор</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Отмена
                </Button>
                <Button onClick={handleInviteUser}>
                  Добавить
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Имя</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead>Дата создания</TableHead>
              <TableHead>Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((userData) => (
              <TableRow key={userData.user_id}>
                <TableCell>{userData.full_name}</TableCell>
                <TableCell>{userData.email}</TableCell>
                <TableCell>
                  <Badge variant={userData.role === 'admin' ? 'default' : 'secondary'}>
                    {userData.role === 'admin' ? 'Администратор' : 'Сотрудник'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {userData.created_at ? new Date(userData.created_at).toLocaleDateString('ru-RU') : '-'}
                </TableCell>
                <TableCell>
                  {userData.user_id !== user?.id && (
                    <div className="flex gap-2">
                      <Select
                        value={userData.role}
                        onValueChange={(value: 'admin' | 'employee') => handleRoleChange(userData.user_id, value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employee">Сотрудник</SelectItem>
                          <SelectItem value="admin">Администратор</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteUser(userData.user_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};