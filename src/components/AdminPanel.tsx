import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, TrendingUp, Building, Trash2, DollarSign, Receipt, History } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { UserManagement } from "./UserManagement";
import { EmployeeClientsDialog } from "./EmployeeClientsDialog";
import { PaymentsClientsDialog } from "./PaymentsClientsDialog";
import { ClientForm } from "./ClientForm";
import { ImportExportPanel } from "./ImportExportPanel";
import { PaymentsCalendar } from "./PaymentsCalendar";
import { AgentsManagement } from "./AgentsManagement";
import { AdminBonusManagement } from "./AdminBonusManagement";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface AdminMetrics {
  totalUsers: number;
  totalClients: number;
  totalContractAmount: number;
  activeCases: number;
  totalPaymentsCount: number;
  completedPaymentsCount: number;
  totalPaymentsSum: number;
  completedPaymentsSum: number;
  loading: boolean;
}

interface EmployeeStats {
  user_id: string;
  full_name: string;
  email: string;
  clients_count: number;
  total_contract_amount: number;
  active_cases: number;
}

interface RecentPayment {
  id: string;
  client_name: string;
  employee_name: string;
  amount: number;
  due_date: string;
  is_completed: boolean;
  completed_at: string | null;
}

export const AdminPanel = () => {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>((currentDate.getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState<string>(currentDate.getFullYear().toString());
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [paymentsDialogOpen, setPaymentsDialogOpen] = useState(false);
  const [metrics, setMetrics] = useState<AdminMetrics>({
    totalUsers: 0,
    totalClients: 0,
    totalContractAmount: 0,
    activeCases: 0,
    totalPaymentsCount: 0,
    completedPaymentsCount: 0,
    totalPaymentsSum: 0,
    completedPaymentsSum: 0,
    loading: true
  });
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats[]>([]);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);

  useEffect(() => {
    if (!user) return;
    
    if (roleLoading) return;
    
    if (!isAdmin) return;
    
    // Только если пользователь авторизован и является админом
    fetchAdminMetrics();
    fetchEmployeeStats();
    fetchRecentPayments();
  }, [user, isAdmin, roleLoading, selectedMonth, selectedYear, selectedEmployee]);

  const fetchAdminMetrics = async () => {
    if (!user) return;

    try {
      // Получаем роли пользователей для исключения администраторов
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Подсчитываем только сотрудников (исключаем администраторов)
      const employeeCount = userRoles?.filter(ur => ur.role === 'employee').length || 0;

      // Получаем всех клиентов
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('contract_amount, total_paid');

      if (clientsError) throw clientsError;

      const totalClients = clients?.length || 0;
      const totalContractAmount = clients?.reduce((sum, client) => sum + (client.contract_amount || 0), 0) || 0;
      const activeCases = clients?.filter(client => {
        const totalPaid = client.total_paid || 0;
        const contractAmount = client.contract_amount || 0;
        return totalPaid < contractAmount;
      }).length || 0;

      // Получаем платежи за выбранный месяц
      const startDate = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1);
      const endDate = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0);
      
      // Плановые платежи = все незавершенные платежи со сроком <= конец месяца,
      // исключая клиентов созданных в выбранном месяце
      let plannedPaymentsQuery = supabase
        .from('payments')
        .select('original_amount, custom_amount, clients!inner(employee_id, created_at)')
        .eq('is_completed', false)
        .lte('due_date', endDate.toISOString().split('T')[0])
        .lt('clients.created_at', startDate.toISOString())
        .neq('payment_number', 0);

      // Фильтруем по сотруднику если выбран
      if (selectedEmployee !== 'all') {
        plannedPaymentsQuery = plannedPaymentsQuery.eq('clients.employee_id', selectedEmployee);
      }

      const { data: plannedPayments, error: plannedError } = await plannedPaymentsQuery;

      if (plannedError) throw plannedError;

      const totalPaymentsCount = plannedPayments?.length || 0;
      const totalPaymentsSum = plannedPayments?.reduce((sum, payment) => {
        const amount = payment.custom_amount || payment.original_amount || 0;
        return sum + amount;
      }, 0) || 0;

      // Завершенные платежи = все завершенные платежи со сроком <= конец месяца,
      // исключая клиентов созданных в выбранном месяце
      let completedPaymentsQuery = supabase
        .from('payments')
        .select('original_amount, custom_amount, clients!inner(employee_id, created_at)')
        .eq('is_completed', true)
        .lte('due_date', endDate.toISOString().split('T')[0])
        .lt('clients.created_at', startDate.toISOString())
        .neq('payment_number', 0);

      // Фильтруем по сотруднику если выбран
      if (selectedEmployee !== 'all') {
        completedPaymentsQuery = completedPaymentsQuery.eq('clients.employee_id', selectedEmployee);
      }

      const { data: completedPayments, error: completedError } = await completedPaymentsQuery;

      if (completedError) throw completedError;

      const completedPaymentsCount = completedPayments?.length || 0;
      const completedPaymentsSum = completedPayments?.reduce((sum, payment) => {
        const amount = payment.custom_amount || payment.original_amount || 0;
        return sum + amount;
      }, 0) || 0;

      setMetrics({
        totalUsers: employeeCount,
        totalClients,
        totalContractAmount,
        activeCases,
        totalPaymentsCount,
        completedPaymentsCount,
        totalPaymentsSum,
        completedPaymentsSum,
        loading: false
      });
    } catch (error) {
      console.error('Ошибка при загрузке метрик админа:', error);
      setMetrics(prev => ({ ...prev, loading: false }));
    }
  };

  const fetchEmployeeStats = async () => {
    if (!user) return;

    try {
      // Получаем email адреса из Edge Function только если есть авторизация
      const { data: session } = await supabase.auth.getSession();
      
      if (!session?.session?.access_token) {
        console.error('Нет токена авторизации');
        return;
      }

      let authUsers = [];
      try {
        const response = await fetch(`https://gidvpxxfgvivjbzfpxcg.supabase.co/functions/v1/admin-users`, {
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const result = await response.json();
          authUsers = result.users || [];
        } else {
          console.error('Ошибка получения данных пользователей:', response.statusText);
          return;
        }
      } catch (fetchError) {
        console.error('Ошибка сети при получении пользователей:', fetchError);
        return;
      }

      // Получаем всех пользователей с ролями
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Получаем профили пользователей
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name');

      if (profilesError) throw profilesError;

      // Получаем клиентов для каждого сотрудника
      const stats: EmployeeStats[] = [];
      
      if (userRoles) {
        for (const userRole of userRoles) {
          const { data: clients, error: clientsError } = await supabase
            .from('clients')
            .select('contract_amount, total_paid')
            .eq('user_id', userRole.user_id);

          if (clientsError) {
            console.error(`Ошибка загрузки клиентов для пользователя ${userRole.user_id}:`, clientsError);
            continue;
          }

          const authUser = authUsers?.find((u: any) => u.id === userRole.user_id);
          const profile = profiles?.find(p => p.user_id === userRole.user_id);
          const clientsData = clients || [];
          const totalContractAmount = clientsData.reduce((sum: number, client: any) => sum + (client.contract_amount || 0), 0);
          const activeCases = clientsData.filter((client: any) => {
            const totalPaid = client.total_paid || 0;
            const contractAmount = client.contract_amount || 0;
            return totalPaid < contractAmount;
          }).length;

          stats.push({
            user_id: userRole.user_id,
            full_name: profile?.full_name || 'Не указано',
            email: authUser?.email || 'Не указан',
            clients_count: clientsData.length,
            total_contract_amount: totalContractAmount,
            active_cases: activeCases
          });
        }
      }

      setEmployeeStats(stats);
    } catch (error) {
      console.error('Ошибка при загрузке статистики сотрудников:', error);
    }
  };

  const handleDeleteEmployee = async (userId: string, fullName: string) => {
    if (!user) return;

    console.log('Attempting to delete employee:', { userId, fullName });

    try {
      const { data: session } = await supabase.auth.getSession();
      
      if (!session?.session?.access_token) {
        console.error('No session token available');
        toast({
          title: "Ошибка",
          description: "Нет авторизации для выполнения операции",
          variant: "destructive",
        });
        return;
      }

      console.log('Making DELETE request to admin-users function...');
      
      const response = await fetch(`https://gidvpxxfgvivjbzfpxcg.supabase.co/functions/v1/admin-users`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      console.log('DELETE response status:', response.status);
      
      if (response.ok) {
        console.log('Employee deleted successfully');
        toast({
          title: "Успешно",
          description: `Сотрудник ${fullName} был удален`,
        });
        
        // Обновляем данные
        fetchAdminMetrics();
        fetchEmployeeStats();
      } else {
        const errorText = await response.text();
        console.error('DELETE request failed:', errorText);
        toast({
          title: "Ошибка",
          description: `Не удалось удалить сотрудника: ${errorText}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Ошибка при удалении сотрудника:', error);
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при удалении сотрудника",
        variant: "destructive",
      });
    }
  };

  const fetchRecentPayments = async () => {
    if (!user) return;

    try {
      // Получаем последние 10 платежей за выбранный период
      const startDate = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1);
      const endDate = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0);
      
      let paymentsQuery = supabase
        .from('payments')
        .select(`
          id,
          original_amount,
          custom_amount,
          due_date,
          is_completed,
          completed_at,
          clients!inner(
            full_name,
            employee_id
          )
        `)
        .eq('is_completed', true)
        .gte('due_date', startDate.toISOString().split('T')[0])
        .lte('due_date', endDate.toISOString().split('T')[0])
        .neq('payment_number', 0)
        .order('completed_at', { ascending: false, nullsFirst: false })
        .order('due_date', { ascending: false })
        .limit(10);

      // Фильтруем по сотруднику если выбран
      if (selectedEmployee !== 'all') {
        paymentsQuery = paymentsQuery.eq('clients.employee_id', selectedEmployee);
      }

      const { data: payments, error: paymentsError } = await paymentsQuery;

      if (paymentsError) throw paymentsError;

      // Получаем имена сотрудников
      const employeeIds = [...new Set(payments?.map((p: any) => p.clients?.employee_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', employeeIds);

      const employeeMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

      const formattedPayments: RecentPayment[] = payments?.map((payment: any) => ({
        id: payment.id,
        client_name: payment.clients?.full_name || 'Не указан',
        employee_name: employeeMap.get(payment.clients?.employee_id) || 'Не указан',
        amount: payment.custom_amount || payment.original_amount || 0,
        due_date: payment.due_date,
        is_completed: payment.is_completed,
        completed_at: payment.completed_at,
      })) || [];

      setRecentPayments(formattedPayments);
    } catch (error) {
      console.error('Ошибка при загрузке последних платежей:', error);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Панель администратора</h1>
        <Badge variant="secondary" className="px-3 py-1">
          Администратор
        </Badge>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="employees">Сотрудники</TabsTrigger>
          <TabsTrigger value="bonuses">Премии</TabsTrigger>
          <TabsTrigger value="agents">Агенты</TabsTrigger>
          <TabsTrigger value="clients">Добавить клиента</TabsTrigger>
          <TabsTrigger value="import-export">Импорт/Экспорт</TabsTrigger>
          <TabsTrigger value="management">Управление</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Фильтр по дате */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-sm font-medium">Период платежей:</span>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Выберите месяц" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Январь</SelectItem>
                    <SelectItem value="2">Февраль</SelectItem>
                    <SelectItem value="3">Март</SelectItem>
                    <SelectItem value="4">Апрель</SelectItem>
                    <SelectItem value="5">Май</SelectItem>
                    <SelectItem value="6">Июнь</SelectItem>
                    <SelectItem value="7">Июль</SelectItem>
                    <SelectItem value="8">Август</SelectItem>
                    <SelectItem value="9">Сентябрь</SelectItem>
                    <SelectItem value="10">Октябрь</SelectItem>
                    <SelectItem value="11">Ноябрь</SelectItem>
                    <SelectItem value="12">Декабрь</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Год" />
                  </SelectTrigger>
                  <SelectContent>
                    {[2023, 2024, 2025, 2026, 2027].map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <span className="text-sm font-medium">Сотрудник:</span>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Все сотрудники" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все сотрудники</SelectItem>
                    {employeeStats.map(employee => (
                      <SelectItem key={employee.user_id} value={employee.user_id}>
                        {employee.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Общая статистика */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-500/10 rounded-full">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      Всего сотрудников
                    </p>
                    <p className="text-2xl font-bold text-blue-600">
                      {metrics.loading ? '-' : metrics.totalUsers}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <Building className="h-6 w-6 text-primary" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      Всего клиентов
                    </p>
                    <p className="text-2xl font-bold text-primary">
                      {metrics.loading ? '-' : metrics.totalClients}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-green-500/10 rounded-full">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      Общая сумма договоров
                    </p>
                    <p className="text-2xl font-bold text-green-600">
                      {metrics.loading ? '-' : formatAmount(metrics.totalContractAmount)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-orange-500/10 rounded-full">
                    <UserPlus className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      Активных дел
                    </p>
                    <p className="text-2xl font-bold text-orange-600">
                      {metrics.loading ? '-' : metrics.activeCases}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Метрики платежей за выбранный период */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-purple-500/10 rounded-full">
                    <Receipt className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      Количество платежей
                    </p>
                    <p className="text-2xl font-bold text-purple-600">
                      {metrics.loading ? '-' : `${metrics.totalPaymentsCount}/${metrics.completedPaymentsCount}`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow" 
              onClick={() => setPaymentsDialogOpen(true)}
            >
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-emerald-500/10 rounded-full">
                    <DollarSign className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      Сумма платежей
                    </p>
                    <p className="text-2xl font-bold text-emerald-600">
                      {metrics.loading ? '-' : `${Math.round(metrics.totalPaymentsSum)}/${Math.round(metrics.completedPaymentsSum)} ₽`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* История последних платежей */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                История последних платежей
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Клиент</TableHead>
                    <TableHead>Сотрудник</TableHead>
                    <TableHead>Сумма</TableHead>
                    <TableHead>Дата платежа</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Дата выполнения</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Нет платежей за выбранный период
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">{payment.client_name}</TableCell>
                        <TableCell>{payment.employee_name}</TableCell>
                        <TableCell>{formatAmount(payment.amount)}</TableCell>
                        <TableCell>
                          {format(new Date(payment.due_date), 'd MMMM yyyy', { locale: ru })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={payment.is_completed ? 'default' : 'secondary'}>
                            {payment.is_completed ? 'Выполнен' : 'Ожидается'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {payment.completed_at 
                            ? format(new Date(payment.completed_at), 'd MMMM yyyy', { locale: ru })
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Календарь платежей */}
          <PaymentsCalendar />
        </TabsContent>

        <TabsContent value="employees" className="space-y-6">
          {/* Статистика по сотрудникам */}
          <Card>
            <CardHeader>
              <CardTitle>Статистика по сотрудникам</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {employeeStats.map((employee) => (
                  <div key={employee.user_id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <p className="font-medium">{employee.full_name}</p>
                      <p className="text-sm text-muted-foreground">{employee.email}</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold text-primary">{employee.clients_count}</p>
                          <p className="text-xs text-muted-foreground">Клиентов</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-green-600">
                            {formatAmount(employee.total_contract_amount)}
                          </p>
                          <p className="text-xs text-muted-foreground">Сумма договоров</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-orange-600">{employee.active_cases}</p>
                          <p className="text-xs text-muted-foreground">Активных дел</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <EmployeeClientsDialog 
                          employeeId={employee.user_id}
                          employeeName={employee.full_name}
                          clientsCount={employee.clients_count}
                          onClientDeleted={() => {
                            fetchAdminMetrics();
                            fetchEmployeeStats();
                          }}
                          onClientTransferred={() => {
                            fetchAdminMetrics();
                            fetchEmployeeStats();
                          }}
                        />
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Удалить сотрудника?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Вы действительно хотите удалить сотрудника "{employee.full_name}"? 
                                Это действие нельзя отменить. Все данные связанные с этим пользователем будут удалены.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Отмена</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDeleteEmployee(employee.user_id, employee.full_name)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Удалить
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bonuses" className="space-y-6">
          <AdminBonusManagement />
        </TabsContent>

        <TabsContent value="clients" className="space-y-6">
          <ClientForm onClientAdded={() => {
            fetchAdminMetrics();
            fetchEmployeeStats();
          }} />
        </TabsContent>

        <TabsContent value="agents" className="space-y-6">
          <AgentsManagement isAdmin={true} />
        </TabsContent>

        <TabsContent value="import-export" className="space-y-6">
          <ImportExportPanel />
        </TabsContent>

        <TabsContent value="management" className="space-y-6">
          <UserManagement onUserUpdate={() => {
            fetchAdminMetrics();
            fetchEmployeeStats();
          }} />
        </TabsContent>
      </Tabs>

      <PaymentsClientsDialog 
        open={paymentsDialogOpen}
        onOpenChange={setPaymentsDialogOpen}
        userId={selectedEmployee !== 'all' ? selectedEmployee : undefined}
        isAdmin={true}
      />
    </div>
  );
};