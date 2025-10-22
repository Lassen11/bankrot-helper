import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, UserPlus, Settings, Trash2, AlertCircle, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  const { userRole, isAdmin, loading: roleLoading } = useUserRole();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'employee'>('employee');
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setError('Пожалуйста, войдите в систему');
      setLoading(false);
      return;
    }

    if (roleLoading) {
      return; // Ждем загрузки роли
    }

    if (!isAdmin) {
      setError('У вас нет прав администратора для просмотра этого раздела');
      setLoading(false);
      return;
    }

    // Только если пользователь авторизован и является админом
    fetchUsers();
  }, [user, isAdmin, roleLoading]);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Проверяем авторизацию
      const { data: session, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error(`Ошибка сессии: ${sessionError.message}`);
      }
      
      if (!session?.session?.access_token) {
        throw new Error('Нет активной сессии. Пожалуйста, войдите в систему заново.');
      }

      // Получаем профили пользователей
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')  
        .select('user_id, full_name, created_at');

      if (profilesError) {
        console.error('Ошибка получения профилей:', profilesError);
        throw new Error(`Не удалось получить профили пользователей: ${profilesError.message}`);
      }

      // Получаем роли пользователей
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role, created_at');

      if (rolesError) {
        console.error('Ошибка получения ролей:', rolesError);
        throw new Error(`Не удалось получить роли пользователей: ${rolesError.message}`);
      }

      // Получаем email адреса из Edge Function
      let authUsers = [];
      try {
        const response = await fetch(`https://gidvpxxfgvivjbzfpxcg.supabase.co/functions/v1/admin-users`, {
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Ошибка Edge Function:', response.status, errorText);
          
          if (response.status === 401) {
            throw new Error('Нет прав доступа. Убедитесь, что вы вошли как администратор.');
          } else if (response.status === 403) {
            throw new Error('Недостаточно прав. Только администраторы могут просматривать пользователей.');
          } else {
            throw new Error(`Ошибка сервера: ${response.status} - ${errorText}`);
          }
        }

        const result = await response.json();
        authUsers = result.users || [];
      } catch (fetchError) {
        if (fetchError instanceof TypeError && fetchError.message.includes('Failed to fetch')) {
          throw new Error('Ошибка сети. Проверьте интернет-соединение и попробуйте снова.');
        }
        throw fetchError;
      }

      const usersWithRoles: UserWithRole[] = profiles?.map(profile => {
        const authUser = authUsers?.find((u: any) => u.id === profile.user_id);
        const roleData = userRoles?.find(r => r.user_id === profile.user_id);
        
        // Показываем только пользователей с ролями
        if (!roleData) return null;
        
        return {
          user_id: profile.user_id,
          full_name: profile.full_name || 'Не указано',
          email: authUser?.email || 'Не указан',
          role: roleData.role || 'employee',
          created_at: roleData.created_at || ''
        };
      }).filter(Boolean) || [];

      setUsers(usersWithRoles);
      setError(null);
    } catch (error: any) {
      console.error('Ошибка при загрузке пользователей:', error);
      setError(error.message || 'Не удалось загрузить список пользователей');
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось загрузить список пользователей",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async () => {
    if (!newUserEmail || !newUserName || !newUserPassword) {
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
      const response = await fetch(`https://gidvpxxfgvivjbzfpxcg.supabase.co/functions/v1/admin-users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
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
      setNewUserPassword('');
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

  const handleEditUser = (userData: UserWithRole) => {
    setEditingUser(userData);
    setEditEmail(userData.email);
    setEditName(userData.full_name);
    setEditPassword('');
    setIsEditDialogOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    if (!editEmail || !editName) {
      toast({
        title: "Ошибка",
        description: "Заполните обязательные поля (email и имя)",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(`https://gidvpxxfgvivjbzfpxcg.supabase.co/functions/v1/admin-users`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: editingUser.user_id,
          email: editEmail,
          full_name: editName,
          ...(editPassword && { password: editPassword })
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка обновления пользователя');
      }

      toast({
        title: "Успешно",
        description: "Данные пользователя обновлены",
      });

      setIsEditDialogOpen(false);
      setEditingUser(null);
      setEditEmail('');
      setEditName('');
      setEditPassword('');
      fetchUsers();
      onUserUpdate();

    } catch (error: any) {
      console.error('Ошибка при обновлении пользователя:', error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить данные пользователя",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) {
      return;
    }

    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(`https://gidvpxxfgvivjbzfpxcg.supabase.co/functions/v1/admin-users`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId })
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

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Для доступа к управлению пользователями необходимо войти в систему.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (roleLoading || loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p>Загрузка...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          {isAdmin && (
            <Button 
              onClick={() => {
                setError(null);
                fetchUsers();
              }} 
              className="mt-4"
              variant="outline"
            >
              Попробовать снова
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              У вас нет прав администратора для доступа к этому разделу.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
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
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Введите пароль"
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
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditUser(userData)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
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
      
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать пользователя</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <div>
              <Label htmlFor="edit-name">Полное имя</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Иван Иванов"
              />
            </div>
            <div>
              <Label htmlFor="edit-password">Новый пароль (оставьте пустым, если не хотите менять)</Label>
              <Input
                id="edit-password"
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Введите новый пароль"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setIsEditDialogOpen(false);
                setEditingUser(null);
                setEditEmail('');
                setEditName('');
                setEditPassword('');
              }}>
                Отмена
              </Button>
              <Button onClick={handleUpdateUser}>
                Сохранить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};