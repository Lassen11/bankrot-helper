import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { ClientForm } from "@/components/ClientForm";
import { ClientsList } from "@/components/ClientsList";
import { AdminPanel } from "@/components/AdminPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Users, UserPlus, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

const Index = () => {
  const [refreshClients, setRefreshClients] = useState(false);
  const { user } = useAuth();
  const { isAdmin, isEmployee, loading: roleLoading } = useUserRole();
  const [metrics, setMetrics] = useState({
    totalClients: 0,
    totalContractAmount: 0,
    activeCases: 0,
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
        .select('contract_amount, total_paid');
      
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

        setMetrics({
          totalClients,
          totalContractAmount,
          activeCases,
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
          </div>

          <Tabs defaultValue="clients" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="clients">Список клиентов</TabsTrigger>
              <TabsTrigger value="add-client">Добавить клиента</TabsTrigger>
            </TabsList>
            
            <TabsContent value="clients" className="space-y-6">
              <ClientsList refresh={refreshClients} />
            </TabsContent>
            
            <TabsContent value="add-client" className="space-y-6">
              <ClientForm onClientAdded={handleClientAdded} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Index;
