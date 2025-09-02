import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, TrendingUp, Building } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { UserManagement } from "./UserManagement";
import { EmployeeClientsDialog } from "./EmployeeClientsDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AdminMetrics {
  totalUsers: number;
  totalClients: number;
  totalContractAmount: number;
  activeCases: number;
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

export const AdminPanel = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<AdminMetrics>({
    totalUsers: 0,
    totalClients: 0,
    totalContractAmount: 0,
    activeCases: 0,
    loading: true
  });
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats[]>([]);

  useEffect(() => {
    if (user) {
      fetchAdminMetrics();
      fetchEmployeeStats();
    }
  }, [user]);

  const fetchAdminMetrics = async () => {
    if (!user) return;

    try {
      // Получаем общее количество пользователей
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('user_id');

      if (usersError) throw usersError;

      // Получаем всех клиентов
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('contract_amount, total_paid');

      if (clientsError) throw clientsError;

      const totalUsers = usersData?.length || 0;
      const totalClients = clients?.length || 0;
      const totalContractAmount = clients?.reduce((sum, client) => sum + (client.contract_amount || 0), 0) || 0;
      const activeCases = clients?.filter(client => {
        const totalPaid = client.total_paid || 0;
        const contractAmount = client.contract_amount || 0;
        return totalPaid < contractAmount;
      }).length || 0;

      setMetrics({
        totalUsers,
        totalClients,
        totalContractAmount,
        activeCases,
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
      // Получаем всех пользователей с их профилями
      const { data: employeesData, error } = await supabase
        .from('profiles')
        .select('user_id, full_name');

      if (error) throw error;

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

      // Получаем клиентов для каждого сотрудника
      const stats: EmployeeStats[] = [];
      
      if (employeesData) {
        for (const employee of employeesData) {
          const { data: clients, error: clientsError } = await supabase
            .from('clients')
            .select('contract_amount, total_paid')
            .eq('user_id', employee.user_id);

          if (clientsError) {
            console.error(`Ошибка загрузки клиентов для пользователя ${employee.user_id}:`, clientsError);
            continue;
          }

          const authUser = authUsers?.find((u: any) => u.id === employee.user_id);
          const clientsData = clients || [];
          const totalContractAmount = clientsData.reduce((sum: number, client: any) => sum + (client.contract_amount || 0), 0);
          const activeCases = clientsData.filter((client: any) => {
            const totalPaid = client.total_paid || 0;
            const contractAmount = client.contract_amount || 0;
            return totalPaid < contractAmount;
          }).length;

          stats.push({
            user_id: employee.user_id,
            full_name: employee.full_name || 'Не указано',
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="employees">Сотрудники</TabsTrigger>
          <TabsTrigger value="management">Управление</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Общая статистика */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
                      <EmployeeClientsDialog 
                        employeeId={employee.user_id}
                        employeeName={employee.full_name}
                        clientsCount={employee.clients_count}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="management" className="space-y-6">
          <UserManagement onUserUpdate={() => {
            fetchAdminMetrics();
            fetchEmployeeStats();
          }} />
        </TabsContent>
      </Tabs>
    </div>
  );
};