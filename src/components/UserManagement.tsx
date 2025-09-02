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
    try {
      setLoading(true);

      // Получаем всех пользователей с их профилями
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name');

      if (profilesError) throw profilesError;

      // Получаем роли пользователей
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role, created_at');

      if (rolesError) throw rolesError;

      // Получаем email адреса из auth
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) {
        console.error('Ошибка получения данных пользователей:', authError);
      }

      const usersWithRoles: UserWithRole[] = profiles?.map(profile => {
        const authUser = authUsers?.users?.find((u: any) => u.id === profile.user_id);
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
      // Создаем пользователя через Admin API
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: newUserEmail,
        password: 'temp123456', // Временный пароль
        email_confirm: true,
        user_metadata: {
          full_name: newUserName
        }
      });

      if (createError) throw createError;

      // Создаем роль для пользователя
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert([
          {
            user_id: newUser.user.id,
            role: newUserRole,
            created_by: user?.id
          }
        ]);

      if (roleError) throw roleError;

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
      // Удаляем пользователя через Admin API
      const { error } = await supabase.auth.admin.deleteUser(userId);

      if (error) throw error;

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
        description: "Не удалось удалить пользователя",
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