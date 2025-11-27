import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { ClientForm } from "@/components/ClientForm";
import { ClientsList } from "@/components/ClientsList";
import { AdminPanel } from "@/components/AdminPanel";
import { PaymentsCalendar } from "@/components/PaymentsCalendar";
import { EmployeeBonus } from "@/components/EmployeeBonus";
import { AgentsManagement } from "@/components/AgentsManagement";
import { PaymentsClientsDialog } from "@/components/PaymentsClientsDialog";
import { TerminatedClientsHistory } from "@/components/TerminatedClientsHistory";
import { SuspendedClientsHistory } from "@/components/SuspendedClientsHistory";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Users, UserPlus, TrendingUp, Calendar, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

const Index = () => {
  const [refreshClients, setRefreshClients] = useState(false);
  const [paymentsDialogOpen, setPaymentsDialogOpen] = useState(false);
  const { user } = useAuth();
  const { isAdmin, isEmployee, loading: roleLoading } = useUserRole();
  const [metrics, setMetrics] = useState({
    totalClients: 0,
    totalContractAmount: 0,
    activeCases: 0,
    totalPaymentsCount: 0,
    completedPaymentsCount: 0,
    totalPaymentsSum: 0,
    completedPaymentsSum: 0,
    loading: true
  });

  useEffect(() => {
    if (user && !roleLoading) {
      fetchMetrics();
    }
  }, [user, refreshClients, roleLoading]);

  const fetchMetrics = async () => {
    if (!user) return;
    
    try {
      let query = supabase
        .from('clients')
        .select('contract_amount, total_paid, id, monthly_payment, contract_date')
        .eq('is_terminated', false)
        .eq('is_suspended', false);
      
      // Если не админ, показываем только своих клиентов
      if (!isAdmin) {
        query = query.eq('user_id', user.id);
      }
      
      const { data: clients, error } = await query;

      if (error) {
        console.error('Ошибка загрузки метрик:', error);
        return;
      }

      if (clients) {
        const totalClients = clients.length;
        const totalContractAmount = clients.reduce((sum, client) => sum + (client.contract_amount || 0), 0);
        const activeCases = clients.filter(client => {
          const totalPaid = client.total_paid || 0;
          const contractAmount = client.contract_amount || 0;
          return totalPaid < contractAmount; // Активные дела - где еще есть задолженность
        }).length;

        // Получаем платежи за текущий месяц для клиентов сотрудника
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDay = new Date(year, month, 0).getDate();
        const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

        // Всегда фильтруем платежи по активным клиентам (исключая terminated и suspended)
        const clientIds = clients.map(c => c.id);
        
        const paymentsQuery = supabase
          .from('payments')
          .select('is_completed, client_id, original_amount, custom_amount')
          .gte('due_date', startDateStr)
          .lte('due_date', endDateStr)
          .neq('payment_number', 0)
          .in('client_id', clientIds);

        const { data: payments, error: paymentsError } = await paymentsQuery;

        if (paymentsError) throw paymentsError;

        // Создаем Map клиентов для быстрого доступа к monthly_payment и contract_date
        const clientsMap = new Map(clients.map(c => [c.id, { monthly_payment: c.monthly_payment, contract_date: c.contract_date }]));

        // Подсчитываем уникальных клиентов с платежами
        const uniqueClientsWithPayments = new Set<string>();
        const clientsWithCompletedPayments = new Set<string>();

        payments?.forEach(payment => {
          uniqueClientsWithPayments.add(payment.client_id);
          if (payment.is_completed) {
            clientsWithCompletedPayments.add(payment.client_id);
          }
        });

        // Плановая сумма = сумма monthly_payment клиентов с платежами в этом месяце, 
        // исключая новых клиентов (созданных в текущем месяце)
        let totalPaymentsSum = 0;
        uniqueClientsWithPayments.forEach(clientId => {
          const clientData = clientsMap.get(clientId);
          if (clientData) {
            // Проверяем, что клиент не новый (дата договора не в текущем месяце)
            const contractDate = new Date(clientData.contract_date);
            const isNewClient = contractDate >= currentDate && 
                               contractDate.getMonth() === currentDate.getMonth() &&
                               contractDate.getFullYear() === currentDate.getFullYear();
            
            if (!isNewClient) {
              totalPaymentsSum += clientData.monthly_payment || 0;
            }
          }
        });

        // Суммируем фактические платежи (custom_amount или original_amount) для оплаченных
        let completedPaymentsSum = 0;
        payments?.forEach(payment => {
          if (payment.is_completed) {
            const amount = payment.custom_amount ?? payment.original_amount;
            completedPaymentsSum += amount;
          }
        });

        const totalPaymentsCount = uniqueClientsWithPayments.size;
        const completedPaymentsCount = clientsWithCompletedPayments.size;

        setMetrics({
          totalClients,
          totalContractAmount,
          activeCases,
          totalPaymentsCount,
          completedPaymentsCount,
          totalPaymentsSum,
          completedPaymentsSum,
          loading: false
        });
      }
    } catch (error) {
      console.error('Ошибка при загрузке метрик:', error);
      setMetrics(prev => ({ ...prev, loading: false }));
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

  const handleClientAdded = () => {
    setRefreshClients(prev => !prev);
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Загрузка...</div>
      </div>
    );
  }

  // Если пользователь админ, показываем админ панель
  if (isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <AdminPanel />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <Users className="h-6 w-6 text-primary" />
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

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-500/10 rounded-full">
                    <Calendar className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      Количество платежей
                    </p>
                    <p className="text-2xl font-bold text-blue-600">
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
                  <div className="p-3 bg-purple-500/10 rounded-full">
                    <DollarSign className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      Сумма платежей
                    </p>
                    <p className="text-2xl font-bold text-purple-600">
                      {metrics.loading ? '-' : `${Math.round(metrics.totalPaymentsSum)}/${Math.round(metrics.completedPaymentsSum)} ₽`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="clients" className="w-full">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="clients">Список клиентов</TabsTrigger>
              <TabsTrigger value="calendar">Календарь платежей</TabsTrigger>
              <TabsTrigger value="bonus">Премия</TabsTrigger>
              <TabsTrigger value="agents">Агенты</TabsTrigger>
              <TabsTrigger value="terminated">Расторжения</TabsTrigger>
              <TabsTrigger value="suspended">Приостановки</TabsTrigger>
              <TabsTrigger value="add-client">Добавить клиента</TabsTrigger>
            </TabsList>
            
            <TabsContent value="clients" className="space-y-6">
              <ClientsList refresh={refreshClients} />
            </TabsContent>
            
            <TabsContent value="calendar" className="space-y-6">
              <PaymentsCalendar employeeId={user?.id} />
            </TabsContent>

            <TabsContent value="bonus" className="space-y-6">
              <EmployeeBonus />
            </TabsContent>

            <TabsContent value="agents" className="space-y-6">
              <AgentsManagement />
            </TabsContent>

            <TabsContent value="terminated" className="space-y-6">
              <TerminatedClientsHistory />
            </TabsContent>

            <TabsContent value="suspended" className="space-y-6">
              <SuspendedClientsHistory />
            </TabsContent>
            
            <TabsContent value="add-client" className="space-y-6">
              <ClientForm onClientAdded={handleClientAdded} />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <PaymentsClientsDialog 
        open={paymentsDialogOpen}
        onOpenChange={setPaymentsDialogOpen}
        userId={user?.id}
        isAdmin={isAdmin}
      />
    </div>
  );
};

export default Index;
