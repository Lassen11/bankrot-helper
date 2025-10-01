import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';

interface Agent {
  id: string;
  employee_id: string;
  agent_full_name: string;
  agent_phone: string;
  recommendation_name: string | null;
  lead_link: string | null;
  mop_name: string | null;
  client_category: string | null;
  first_payment_date: string | null;
  reward_amount: number;
  remaining_payment: number;
  first_payment_amount: number;
  payment_month_1: number;
  payment_month_2: number;
  payment_month_3: number;
  payout_1: number;
  payout_2: number;
  payout_3: number;
}

interface Employee {
  user_id: string;
  full_name: string;
}

interface AgentsManagementProps {
  isAdmin?: boolean;
}

export const AgentsManagement = ({ isAdmin = false }: AgentsManagementProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [formData, setFormData] = useState({
    agent_full_name: '',
    agent_phone: '',
    recommendation_name: '',
    lead_link: '',
    mop_name: '',
    client_category: '',
    first_payment_date: '',
    reward_amount: 0,
    remaining_payment: 0,
    first_payment_amount: 0,
    payment_month_1: 0,
    payment_month_2: 0,
    payment_month_3: 0,
    payout_1: 0,
    payout_2: 0,
    payout_3: 0,
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, selectedEmployee]);

  const fetchData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Получаем список сотрудников для фильтра (только для админов)
      if (isAdmin) {
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'employee');

        if (rolesData) {
          const employeeIds = rolesData.map(r => r.user_id);
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', employeeIds);

          if (profilesData) {
            setEmployees(profilesData);
          }
        }
      }

      // Получаем агентов
      let query = supabase.from('agents').select('*');

      if (isAdmin && selectedEmployee !== 'all') {
        query = query.eq('employee_id', selectedEmployee);
      } else if (!isAdmin) {
        query = query.eq('employee_id', user.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setAgents(data || []);
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast.error('Ошибка при загрузке данных');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const dataToSave = {
        ...formData,
        employee_id: user.id,
      };

      if (editingAgent) {
        const { error } = await supabase
          .from('agents')
          .update(dataToSave)
          .eq('id', editingAgent.id);

        if (error) throw error;
        toast.success('Агент обновлен');
      } else {
        const { error } = await supabase
          .from('agents')
          .insert(dataToSave);

        if (error) throw error;
        toast.success('Агент добавлен');
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving agent:', error);
      toast.error('Ошибка при сохранении агента');
    }
  };

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setFormData({
      agent_full_name: agent.agent_full_name,
      agent_phone: agent.agent_phone,
      recommendation_name: agent.recommendation_name || '',
      lead_link: agent.lead_link || '',
      mop_name: agent.mop_name || '',
      client_category: agent.client_category || '',
      first_payment_date: agent.first_payment_date || '',
      reward_amount: agent.reward_amount,
      remaining_payment: agent.remaining_payment,
      first_payment_amount: agent.first_payment_amount,
      payment_month_1: agent.payment_month_1,
      payment_month_2: agent.payment_month_2,
      payment_month_3: agent.payment_month_3,
      payout_1: agent.payout_1,
      payout_2: agent.payout_2,
      payout_3: agent.payout_3,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить этого агента?')) return;

    try {
      const { error } = await supabase
        .from('agents')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Агент удален');
      fetchData();
    } catch (error) {
      console.error('Error deleting agent:', error);
      toast.error('Ошибка при удалении агента');
    }
  };

  const resetForm = () => {
    setEditingAgent(null);
    setFormData({
      agent_full_name: '',
      agent_phone: '',
      recommendation_name: '',
      lead_link: '',
      mop_name: '',
      client_category: '',
      first_payment_date: '',
      reward_amount: 0,
      remaining_payment: 0,
      first_payment_amount: 0,
      payment_month_1: 0,
      payment_month_2: 0,
      payment_month_3: 0,
      payout_1: 0,
      payout_2: 0,
      payout_3: 0,
    });
  };

  const calculateStats = () => {
    const totalReward = agents.reduce((sum, a) => sum + Number(a.reward_amount || 0), 0);
    const totalRemaining = agents.reduce((sum, a) => sum + Number(a.remaining_payment || 0), 0);
    const totalPaid = agents.reduce((sum, a) => 
      sum + Number(a.payout_1 || 0) + Number(a.payout_2 || 0) + Number(a.payout_3 || 0), 0
    );

    return { totalReward, totalRemaining, totalPaid };
  };

  const stats = calculateStats();

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Агенты</CardTitle>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Добавить агента
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingAgent ? 'Редактировать агента' : 'Добавить агента'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="agent_full_name">ФИО агента *</Label>
                    <Input
                      id="agent_full_name"
                      value={formData.agent_full_name}
                      onChange={(e) => setFormData({ ...formData, agent_full_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agent_phone">Номер телефона *</Label>
                    <Input
                      id="agent_phone"
                      value={formData.agent_phone}
                      onChange={(e) => setFormData({ ...formData, agent_phone: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recommendation_name">ФИО рекомендации</Label>
                    <Input
                      id="recommendation_name"
                      value={formData.recommendation_name}
                      onChange={(e) => setFormData({ ...formData, recommendation_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lead_link">Ссылка на лид</Label>
                    <Input
                      id="lead_link"
                      value={formData.lead_link}
                      onChange={(e) => setFormData({ ...formData, lead_link: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mop_name">ФИО МОП</Label>
                    <Input
                      id="mop_name"
                      value={formData.mop_name}
                      onChange={(e) => setFormData({ ...formData, mop_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client_category">Категория клиента</Label>
                    <Input
                      id="client_category"
                      value={formData.client_category}
                      onChange={(e) => setFormData({ ...formData, client_category: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="first_payment_date">Дата первого платежа</Label>
                    <Input
                      id="first_payment_date"
                      type="date"
                      value={formData.first_payment_date}
                      onChange={(e) => setFormData({ ...formData, first_payment_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reward_amount">Сумма вознаграждения</Label>
                    <Input
                      id="reward_amount"
                      type="number"
                      value={formData.reward_amount}
                      onChange={(e) => setFormData({ ...formData, reward_amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="remaining_payment">Остаток выплаты</Label>
                    <Input
                      id="remaining_payment"
                      type="number"
                      value={formData.remaining_payment}
                      onChange={(e) => setFormData({ ...formData, remaining_payment: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="first_payment_amount">Сумма первого платежа</Label>
                    <Input
                      id="first_payment_amount"
                      type="number"
                      value={formData.first_payment_amount}
                      onChange={(e) => setFormData({ ...formData, first_payment_amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment_month_1">Платеж 1 месяц</Label>
                    <Input
                      id="payment_month_1"
                      type="number"
                      value={formData.payment_month_1}
                      onChange={(e) => setFormData({ ...formData, payment_month_1: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment_month_2">Платеж 2 месяц</Label>
                    <Input
                      id="payment_month_2"
                      type="number"
                      value={formData.payment_month_2}
                      onChange={(e) => setFormData({ ...formData, payment_month_2: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment_month_3">Платеж 3 месяц</Label>
                    <Input
                      id="payment_month_3"
                      type="number"
                      value={formData.payment_month_3}
                      onChange={(e) => setFormData({ ...formData, payment_month_3: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payout_1">Выплата 1</Label>
                    <Input
                      id="payout_1"
                      type="number"
                      value={formData.payout_1}
                      onChange={(e) => setFormData({ ...formData, payout_1: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payout_2">Выплата 2</Label>
                    <Input
                      id="payout_2"
                      type="number"
                      value={formData.payout_2}
                      onChange={(e) => setFormData({ ...formData, payout_2: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payout_3">Выплата 3</Label>
                    <Input
                      id="payout_3"
                      type="number"
                      value={formData.payout_3}
                      onChange={(e) => setFormData({ ...formData, payout_3: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Отмена
                  </Button>
                  <Button type="submit">
                    {editingAgent ? 'Сохранить' : 'Добавить'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Дашборд */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Всего агентов</div>
              <div className="text-2xl font-bold">{agents.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Общее вознаграждение</div>
              <div className="text-2xl font-bold">{stats.totalReward.toLocaleString()} ₽</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Выплачено</div>
              <div className="text-2xl font-bold text-green-600">{stats.totalPaid.toLocaleString()} ₽</div>
            </CardContent>
          </Card>
        </div>

        {/* Фильтр по сотрудникам для админа */}
        {isAdmin && (
          <div className="flex gap-2 items-center">
            <Label>Сотрудник:</Label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="w-[250px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все сотрудники</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.user_id} value={emp.user_id}>
                    {emp.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Таблица агентов */}
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ФИО агента</TableHead>
                <TableHead>Телефон</TableHead>
                <TableHead>Категория</TableHead>
                <TableHead>Дата 1-го платежа</TableHead>
                <TableHead>Вознаграждение</TableHead>
                <TableHead>Остаток</TableHead>
                <TableHead>Выплачено</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Агенты не найдены
                  </TableCell>
                </TableRow>
              ) : (
                agents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">{agent.agent_full_name}</TableCell>
                    <TableCell>{agent.agent_phone}</TableCell>
                    <TableCell>{agent.client_category || '-'}</TableCell>
                    <TableCell>
                      {agent.first_payment_date
                        ? new Date(agent.first_payment_date).toLocaleDateString('ru-RU')
                        : '-'}
                    </TableCell>
                    <TableCell>{Number(agent.reward_amount || 0).toLocaleString()} ₽</TableCell>
                    <TableCell>{Number(agent.remaining_payment || 0).toLocaleString()} ₽</TableCell>
                    <TableCell className="text-green-600">
                      {(Number(agent.payout_1 || 0) + Number(agent.payout_2 || 0) + Number(agent.payout_3 || 0)).toLocaleString()} ₽
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(agent)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(agent.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};