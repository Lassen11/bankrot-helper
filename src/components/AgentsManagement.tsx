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
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2, Filter, Eye } from 'lucide-react';
import { addMonths, setDate, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { AgentDetailsDialog } from './AgentDetailsDialog';
import { PayoutAccountDialog } from './PayoutAccountDialog';

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
  payment_month_1_completed: boolean;
  payment_month_2_completed: boolean;
  payment_month_3_completed: boolean;
  payment_month_1_date: string | null;
  payment_month_2_date: string | null;
  payment_month_3_date: string | null;
  payout_1: number;
  payout_2: number;
  payout_3: number;
  payout_1_completed: boolean;
  payout_2_completed: boolean;
  payout_3_completed: boolean;
  payout_1_date: string | null;
  payout_2_date: string | null;
  payout_3_date: string | null;
}

interface Employee {
  user_id: string;
  full_name: string;
}

interface AgentsManagementProps {
  isAdmin?: boolean;
}

interface PayoutDialogData {
  agentId: string;
  agentName: string;
  recommendationName: string;
  payoutNumber: 1 | 2 | 3;
  amount: number;
  date: Date | null;
  title: string;
  type: 'payout' | 'payment';
}

type PayoutFilter = 'all' | 'pending_1' | 'pending_2' | 'pending_3' | 'all_pending' | 'all_completed' | 'payment_pending_1' | 'payment_pending_2' | 'payment_pending_3';

export const AgentsManagement = ({ isAdmin = false }: AgentsManagementProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [payoutFilter, setPayoutFilter] = useState<PayoutFilter>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [detailsAgent, setDetailsAgent] = useState<Agent | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [payoutDialogData, setPayoutDialogData] = useState<PayoutDialogData | null>(null);
  const [isPayoutLoading, setIsPayoutLoading] = useState(false);
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

  // Вычисляем дату платежа клиента: first_payment_date + offset месяцев
  const calculatePaymentDate = (firstPaymentDate: string | null, monthOffset: number): Date | null => {
    if (!firstPaymentDate) return null;
    const date = new Date(firstPaymentDate);
    return addMonths(date, monthOffset);
  };

  // Вычисляем дату выплаты: 3-е число следующего месяца после first_payment_date + offset
  const calculatePayoutDate = (firstPaymentDate: string | null, monthOffset: number): Date | null => {
    if (!firstPaymentDate) return null;
    const date = new Date(firstPaymentDate);
    const nextMonth = addMonths(date, 1 + monthOffset);
    return setDate(nextMonth, 3);
  };

  const formatPaymentDate = (date: Date | null): string => {
    if (!date) return '-';
    return format(date, 'dd.MM.yyyy', { locale: ru });
  };

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

  // Фильтрация агентов по статусу выплат и платежей
  const filteredAgents = agents.filter(agent => {
    switch (payoutFilter) {
      case 'payment_pending_1':
        return !agent.payment_month_1_completed && agent.payment_month_1 > 0;
      case 'payment_pending_2':
        return !agent.payment_month_2_completed && agent.payment_month_2 > 0;
      case 'payment_pending_3':
        return !agent.payment_month_3_completed && agent.payment_month_3 > 0;
      case 'pending_1':
        return !agent.payout_1_completed && agent.payout_1 > 0;
      case 'pending_2':
        return !agent.payout_2_completed && agent.payout_2 > 0;
      case 'pending_3':
        return !agent.payout_3_completed && agent.payout_3 > 0;
      case 'all_pending':
        return (!agent.payout_1_completed && agent.payout_1 > 0) ||
               (!agent.payout_2_completed && agent.payout_2 > 0) ||
               (!agent.payout_3_completed && agent.payout_3 > 0);
      case 'all_completed':
        return (agent.payout_1_completed || agent.payout_1 === 0) &&
               (agent.payout_2_completed || agent.payout_2 === 0) &&
               (agent.payout_3_completed || agent.payout_3 === 0);
      default:
        return true;
    }
  });

  // Открытие диалога для платежа клиента
  const openPaymentDialog = (agent: Agent, paymentNumber: 1 | 2 | 3) => {
    const dateKey = `payment_month_${paymentNumber}_date` as keyof Agent;
    const savedDate = agent[dateKey] as string | null;
    const paymentDate = savedDate 
      ? new Date(savedDate) 
      : calculatePaymentDate(agent.first_payment_date, paymentNumber - 1);
    const paymentKey = `payment_month_${paymentNumber}` as keyof Agent;
    const amount = Number(agent[paymentKey] || 0);
    
    setPayoutDialogData({
      agentId: agent.id,
      agentName: agent.agent_full_name,
      recommendationName: agent.recommendation_name || '',
      payoutNumber: paymentNumber,
      amount,
      date: paymentDate,
      title: `Платеж ${paymentNumber} месяц`,
      type: 'payment'
    });
    setPayoutDialogOpen(true);
  };

  // Снятие отметки платежа (без диалога)
  const handlePaymentUnmark = async (agentId: string, paymentNumber: 1 | 2 | 3) => {
    try {
      const fieldName = `payment_month_${paymentNumber}_completed` as const;
      const { error } = await supabase
        .from('agents')
        .update({ [fieldName]: false })
        .eq('id', agentId);

      if (error) throw error;

      setAgents(prev => prev.map(agent => 
        agent.id === agentId 
          ? { ...agent, [fieldName]: false }
          : agent
      ));

      toast.success(`Отметка платежа ${paymentNumber} снята`);
    } catch (error) {
      console.error('Error updating payment status:', error);
      toast.error('Ошибка при обновлении статуса платежа');
    }
  };

  // Открытие диалога выбора счёта для выплаты
  const openPayoutDialog = (agent: Agent, payoutNumber: 1 | 2 | 3) => {
    const dateKey = `payout_${payoutNumber}_date` as keyof Agent;
    const savedDate = agent[dateKey] as string | null;
    const payoutDate = savedDate 
      ? new Date(savedDate) 
      : calculatePayoutDate(agent.first_payment_date, payoutNumber - 1);
    const payoutKey = `payout_${payoutNumber}` as keyof Agent;
    const amount = Number(agent[payoutKey] || 0);
    
    setPayoutDialogData({
      agentId: agent.id,
      agentName: agent.agent_full_name,
      recommendationName: agent.recommendation_name || '',
      payoutNumber,
      amount,
      date: payoutDate,
      title: `Выплата ${payoutNumber}`,
      type: 'payout'
    });
    setPayoutDialogOpen(true);
  };

  // Снятие отметки выплаты (без диалога)
  const handlePayoutUnmark = async (agentId: string, payoutNumber: 1 | 2 | 3) => {
    try {
      const fieldName = `payout_${payoutNumber}_completed` as const;
      const { error } = await supabase
        .from('agents')
        .update({ [fieldName]: false })
        .eq('id', agentId);

      if (error) throw error;

      setAgents(prev => prev.map(agent => 
        agent.id === agentId 
          ? { ...agent, [fieldName]: false }
          : agent
      ));

      toast.success(`Отметка выплаты ${payoutNumber} снята`);
    } catch (error) {
      console.error('Error updating payout status:', error);
      toast.error('Ошибка при обновлении статуса выплаты');
    }
  };

  // Подтверждение платежа/выплаты с выбранным счётом
  const handleDialogConfirm = async (account: string, amount: number, date: Date) => {
    if (!payoutDialogData || !user) return;

    setIsPayoutLoading(true);
    try {
      const { agentId, agentName, recommendationName, payoutNumber, type } = payoutDialogData;
      
      if (type === 'payment') {
        // Обработка платежа клиента
        const completedFieldName = `payment_month_${payoutNumber}_completed` as const;
        const amountFieldName = `payment_month_${payoutNumber}` as const;
        const dateFieldName = `payment_month_${payoutNumber}_date` as const;
        const dateValue = format(date, 'yyyy-MM-dd');
        
        const { error } = await supabase
          .from('agents')
          .update({ 
            [completedFieldName]: true,
            [amountFieldName]: amount,
            [dateFieldName]: dateValue
          })
          .eq('id', agentId);

        if (error) throw error;

        // Обновляем локальное состояние
        setAgents(prev => prev.map(agent => 
          agent.id === agentId 
            ? { ...agent, [completedFieldName]: true, [amountFieldName]: amount, [dateFieldName]: dateValue }
            : agent
        ));

        toast.success(`Платеж ${payoutNumber} отмечен`);
      } else {
        // Обработка выплаты агенту
        const completedFieldName = `payout_${payoutNumber}_completed` as const;
        const amountFieldName = `payout_${payoutNumber}` as const;
        const dateFieldName = `payout_${payoutNumber}_date` as const;
        const payoutDate = format(date, 'yyyy-MM-dd');
        
        // Обновляем статус, сумму и дату в БД
        const { error } = await supabase
          .from('agents')
          .update({ 
            [completedFieldName]: true,
            [amountFieldName]: amount,
            [dateFieldName]: payoutDate
          })
          .eq('id', agentId);

        if (error) throw error;

        // Отправляем данные в PnL Tracker
        const description = `Выплата ${payoutNumber} агенту ${agentName}${recommendationName ? ` (рекомендация: ${recommendationName})` : ''}`;

        try {
          const { error: webhookError } = await supabase.functions.invoke('send-to-pnltracker', {
            body: {
              event_type: 'agent_payout',
              agent_name: agentName,
              recommendation_name: recommendationName,
              payout_number: payoutNumber,
              amount: amount,
              date: payoutDate,
              expense_account: account,
              company: 'Спасение',
              user_id: user.id,
              description: description
            }
          });

          if (webhookError) {
            console.error('Error sending to pnltracker:', webhookError);
            toast.warning('Выплата отмечена, но ошибка при отправке в PnL Tracker');
          } else {
            console.log('Successfully sent agent payout to pnltracker');
          }
        } catch (webhookError) {
          console.error('Error calling send-to-pnltracker:', webhookError);
          toast.warning('Выплата отмечена, но ошибка при отправке в PnL Tracker');
        }

        // Обновляем локальное состояние
        setAgents(prev => prev.map(agent => 
          agent.id === agentId 
            ? { ...agent, [completedFieldName]: true, [amountFieldName]: amount, [dateFieldName]: payoutDate }
            : agent
        ));

        toast.success(`Выплата ${payoutNumber} отмечена и отправлена в PnL Tracker`);
      }

      setPayoutDialogOpen(false);
      setPayoutDialogData(null);
    } catch (error) {
      console.error('Error confirming:', error);
      toast.error('Ошибка при подтверждении');
    } finally {
      setIsPayoutLoading(false);
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

  const handleEdit = (agent: Agent, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleRowClick = (agent: Agent) => {
    setDetailsAgent(agent);
    setDetailsOpen(true);
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
    const totalReward = filteredAgents.reduce((sum, a) => sum + Number(a.reward_amount || 0), 0);
    const totalRemaining = filteredAgents.reduce((sum, a) => sum + Number(a.remaining_payment || 0), 0);
    const totalPaid = filteredAgents.reduce((sum, a) => 
      sum + (a.payout_1_completed ? Number(a.payout_1 || 0) : 0) 
          + (a.payout_2_completed ? Number(a.payout_2 || 0) : 0) 
          + (a.payout_3_completed ? Number(a.payout_3 || 0) : 0), 0
    );
    const totalPending = filteredAgents.reduce((sum, a) => 
      sum + (!a.payout_1_completed ? Number(a.payout_1 || 0) : 0) 
          + (!a.payout_2_completed ? Number(a.payout_2 || 0) : 0) 
          + (!a.payout_3_completed ? Number(a.payout_3 || 0) : 0), 0
    );

    return { totalReward, totalRemaining, totalPaid, totalPending };
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
                    <Label htmlFor="first_payment_date">Дата первого платежа клиента</Label>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Всего агентов</div>
              <div className="text-2xl font-bold">{filteredAgents.length}</div>
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
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">К выплате</div>
              <div className="text-2xl font-bold text-amber-600">{stats.totalPending.toLocaleString()} ₽</div>
            </CardContent>
          </Card>
        </div>

        {/* Фильтры */}
        <div className="flex flex-wrap gap-4 items-center">
          {isAdmin && (
            <div className="flex gap-2 items-center">
              <Label>Сотрудник:</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="w-[200px]">
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
          
          <div className="flex gap-2 items-center">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Label>Фильтр:</Label>
            <Select value={payoutFilter} onValueChange={(v) => setPayoutFilter(v as PayoutFilter)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все агенты</SelectItem>
                <SelectItem value="payment_pending_1">Ожидает платеж 1</SelectItem>
                <SelectItem value="payment_pending_2">Ожидает платеж 2</SelectItem>
                <SelectItem value="payment_pending_3">Ожидает платеж 3</SelectItem>
                <SelectItem value="pending_1">Ожидает выплату 1</SelectItem>
                <SelectItem value="pending_2">Ожидает выплату 2</SelectItem>
                <SelectItem value="pending_3">Ожидает выплату 3</SelectItem>
                <SelectItem value="all_pending">Все ожидающие выплаты</SelectItem>
                <SelectItem value="all_completed">Все выплачено</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Таблица агентов */}
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ФИО агента</TableHead>
                <TableHead>Телефон</TableHead>
                <TableHead>Дата 1-го платежа</TableHead>
                <TableHead className="text-center">
                  <div className="flex flex-col items-center">
                    <span>Платеж 1</span>
                    <span className="text-xs text-muted-foreground">(дата / сумма)</span>
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex flex-col items-center">
                    <span>Платеж 2</span>
                    <span className="text-xs text-muted-foreground">(дата / сумма)</span>
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex flex-col items-center">
                    <span>Платеж 3</span>
                    <span className="text-xs text-muted-foreground">(дата / сумма)</span>
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex flex-col items-center">
                    <span>Выплата 1</span>
                    <span className="text-xs text-muted-foreground">(дата / сумма)</span>
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex flex-col items-center">
                    <span>Выплата 2</span>
                    <span className="text-xs text-muted-foreground">(дата / сумма)</span>
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex flex-col items-center">
                    <span>Выплата 3</span>
                    <span className="text-xs text-muted-foreground">(дата / сумма)</span>
                  </div>
                </TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAgents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    Агенты не найдены
                  </TableCell>
                </TableRow>
              ) : (
                filteredAgents.map((agent) => {
                  // Используем сохранённую дату если есть, иначе вычисляем
                  const paymentDate1 = agent.payment_month_1_date 
                    ? new Date(agent.payment_month_1_date) 
                    : calculatePaymentDate(agent.first_payment_date, 1);
                  const paymentDate2 = agent.payment_month_2_date 
                    ? new Date(agent.payment_month_2_date) 
                    : calculatePaymentDate(agent.first_payment_date, 2);
                  const paymentDate3 = agent.payment_month_3_date 
                    ? new Date(agent.payment_month_3_date) 
                    : calculatePaymentDate(agent.first_payment_date, 3);
                  const payoutDate1 = agent.payout_1_date 
                    ? new Date(agent.payout_1_date) 
                    : calculatePayoutDate(agent.first_payment_date, 0);
                  const payoutDate2 = agent.payout_2_date 
                    ? new Date(agent.payout_2_date) 
                    : calculatePayoutDate(agent.first_payment_date, 1);
                  const payoutDate3 = agent.payout_3_date 
                    ? new Date(agent.payout_3_date) 
                    : calculatePayoutDate(agent.first_payment_date, 2);
                  return (
                    <TableRow 
                      key={agent.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(agent)}
                    >
                      <TableCell className="font-medium">{agent.agent_full_name}</TableCell>
                      <TableCell>{agent.agent_phone}</TableCell>
                      <TableCell>
                        {agent.first_payment_date
                          ? new Date(agent.first_payment_date).toLocaleDateString('ru-RU')
                          : '-'}
                      </TableCell>
                      
                      {/* Платеж 1 */}
                      <TableCell>
                        <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={agent.payment_month_1_completed}
                            onCheckedChange={() => {
                              if (agent.payment_month_1_completed) {
                                handlePaymentUnmark(agent.id, 1);
                              } else {
                                openPaymentDialog(agent, 1);
                              }
                            }}
                            disabled={agent.payment_month_1 === 0}
                          />
                          <div className={`text-center ${agent.payment_month_1_completed ? 'text-green-600 line-through' : ''}`}>
                            <div className="text-xs text-muted-foreground">
                              {formatPaymentDate(paymentDate1)}
                            </div>
                            <div className="font-medium">
                              {Number(agent.payment_month_1 || 0).toLocaleString()} ₽
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      
                      {/* Платеж 2 */}
                      <TableCell>
                        <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={agent.payment_month_2_completed}
                            onCheckedChange={() => {
                              if (agent.payment_month_2_completed) {
                                handlePaymentUnmark(agent.id, 2);
                              } else {
                                openPaymentDialog(agent, 2);
                              }
                            }}
                            disabled={agent.payment_month_2 === 0}
                          />
                          <div className={`text-center ${agent.payment_month_2_completed ? 'text-green-600 line-through' : ''}`}>
                            <div className="text-xs text-muted-foreground">
                              {formatPaymentDate(paymentDate2)}
                            </div>
                            <div className="font-medium">
                              {Number(agent.payment_month_2 || 0).toLocaleString()} ₽
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      
                      {/* Платеж 3 */}
                      <TableCell>
                        <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={agent.payment_month_3_completed}
                            onCheckedChange={() => {
                              if (agent.payment_month_3_completed) {
                                handlePaymentUnmark(agent.id, 3);
                              } else {
                                openPaymentDialog(agent, 3);
                              }
                            }}
                            disabled={agent.payment_month_3 === 0}
                          />
                          <div className={`text-center ${agent.payment_month_3_completed ? 'text-green-600 line-through' : ''}`}>
                            <div className="text-xs text-muted-foreground">
                              {formatPaymentDate(paymentDate3)}
                            </div>
                            <div className="font-medium">
                              {Number(agent.payment_month_3 || 0).toLocaleString()} ₽
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      
                      {/* Выплата 1 */}
                      <TableCell>
                        <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={agent.payout_1_completed}
                            onCheckedChange={() => {
                              if (agent.payout_1_completed) {
                                handlePayoutUnmark(agent.id, 1);
                              } else {
                                openPayoutDialog(agent, 1);
                              }
                            }}
                            disabled={agent.payout_1 === 0 || !agent.payment_month_1_completed}
                          />
                          <div className={`text-center ${agent.payout_1_completed ? 'text-green-600 line-through' : !agent.payment_month_1_completed ? 'text-muted-foreground' : ''}`}>
                            <div className="text-xs text-muted-foreground">
                              {formatPaymentDate(payoutDate1)}
                            </div>
                            <div className="font-medium">
                              {Number(agent.payout_1 || 0).toLocaleString()} ₽
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      
                      {/* Выплата 2 */}
                      <TableCell>
                        <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={agent.payout_2_completed}
                            onCheckedChange={() => {
                              if (agent.payout_2_completed) {
                                handlePayoutUnmark(agent.id, 2);
                              } else {
                                openPayoutDialog(agent, 2);
                              }
                            }}
                            disabled={agent.payout_2 === 0 || !agent.payment_month_2_completed}
                          />
                          <div className={`text-center ${agent.payout_2_completed ? 'text-green-600 line-through' : !agent.payment_month_2_completed ? 'text-muted-foreground' : ''}`}>
                            <div className="text-xs text-muted-foreground">
                              {formatPaymentDate(payoutDate2)}
                            </div>
                            <div className="font-medium">
                              {Number(agent.payout_2 || 0).toLocaleString()} ₽
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      
                      {/* Выплата 3 */}
                      <TableCell>
                        <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={agent.payout_3_completed}
                            onCheckedChange={() => {
                              if (agent.payout_3_completed) {
                                handlePayoutUnmark(agent.id, 3);
                              } else {
                                openPayoutDialog(agent, 3);
                              }
                            }}
                            disabled={agent.payout_3 === 0 || !agent.payment_month_3_completed}
                          />
                          <div className={`text-center ${agent.payout_3_completed ? 'text-green-600 line-through' : !agent.payment_month_3_completed ? 'text-muted-foreground' : ''}`}>
                            <div className="text-xs text-muted-foreground">
                              {formatPaymentDate(payoutDate3)}
                            </div>
                            <div className="font-medium">
                              {Number(agent.payout_3 || 0).toLocaleString()} ₽
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRowClick(agent);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleEdit(agent, e)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleDelete(agent.id, e)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Диалог с детальной информацией */}
      <AgentDetailsDialog
        agent={detailsAgent}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />

      {/* Диалог выбора счёта для платежа/выплаты */}
      <PayoutAccountDialog
        open={payoutDialogOpen}
        onOpenChange={setPayoutDialogOpen}
        onConfirm={handleDialogConfirm}
        agentName={payoutDialogData?.agentName || ''}
        title={payoutDialogData?.title || ''}
        amount={payoutDialogData?.amount || 0}
        date={payoutDialogData?.date || null}
        isLoading={isPayoutLoading}
        showAccountSelect={payoutDialogData?.type === 'payout'}
      />
    </Card>
  );
};
