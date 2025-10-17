import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { ClientForm } from "@/components/ClientForm";
import { ClientsList } from "@/components/ClientsList";
import { AdminPanel } from "@/components/AdminPanel";
import { PaymentsCalendar } from "@/components/PaymentsCalendar";
import { EmployeeBonus } from "@/components/EmployeeBonus";
import { AgentsManagement } from "@/components/AgentsManagement";
import { PaymentsClientsDialog } from "@/components/PaymentsClientsDialog";
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
        .select('contract_amount, total_paid, id');
      
      // Если не админ, показываем только своих клиентов (по employee_id)
      if (!isAdmin) {
        query = query.eq('employee_id', user.id);
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

        // Получаем данные о платежах для расчета метрик
        const currentDate = new Date();
        const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

        // Плановые платежи = все НЕЗАВЕРШЕННЫЕ платежи со сроком <= конец текущего месяца
        // (включая просроченные с прошлых месяцев)
        let plannedPaymentsQuery = supabase
          .from('payments')
          .select('original_amount, custom_amount, client_id, clients!inner(employee_id)')
          .eq('is_completed', false)
          .lte('due_date', endDate.toISOString().split('T')[0])
          .neq('payment_number', 0);

        if (!isAdmin) {
          plannedPaymentsQuery = plannedPaymentsQuery.eq('clients.employee_id', user.id);
        }

        const { data: plannedPayments, error: plannedError } = await plannedPaymentsQuery;

        if (plannedError) throw plannedError;

        let totalPaymentsCount = plannedPayments?.length || 0;
        let totalPaymentsSum = 0;

        plannedPayments?.forEach(payment => {
          const amount = payment.custom_amount ?? payment.original_amount;
          totalPaymentsSum += amount;
        });

        // Завершенные платежи за текущий месяц для подсчета фактической суммы
        let completedPaymentsQuery = supabase
          .from('payments')
          .select('original_amount, custom_amount, client_id, clients!inner(employee_id)')
          .eq('is_completed', true)
          .gte('due_date', startDate.toISOString().split('T')[0])
          .lte('due_date', endDate.toISOString().split('T')[0])
          .neq('payment_number', 0);

        if (!isAdmin) {
          completedPaymentsQuery = completedPaymentsQuery.eq('clients.employee_id', user.id);
        }

        const { data: completedPayments, error: completedError } = await completedPaymentsQuery;

        if (completedError) throw completedError;

        let completedPaymentsCount = completedPayments?.length || 0;
        let completedPaymentsSum = 0;

        completedPayments?.forEach(payment => {
          const amount = payment.custom_amount ?? payment.original_amount;
          completedPaymentsSum += amount;
        });

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
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="clients">Список клиентов</TabsTrigger>
              <TabsTrigger value="calendar">Календарь платежей</TabsTrigger>
              <TabsTrigger value="bonus">Премия</TabsTrigger>
              <TabsTrigger value="agents">Агенты</TabsTrigger>
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
