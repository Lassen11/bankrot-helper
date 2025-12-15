import { useState, useEffect } from "react";
import { Search, UserPlus, Eye, CalendarDays, Filter, X } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { ClientDetailsDialog } from "./ClientDetailsDialog";

interface Client {
  id: string;
  full_name: string;
  contract_amount: number;
  installment_period: number;
  first_payment: number;
  monthly_payment: number;
  remaining_amount: number;
  total_paid: number;
  deposit_paid: number;
  deposit_target: number;
  payment_day: number;
  employee_id: string;
  created_at: string;
  updated_at: string;
  contract_date: string;
  is_terminated: boolean;
  is_suspended: boolean;
  nextPayment?: {
    due_date: string;
    amount: number;
  };
}

interface Employee {
  user_id: string;
  full_name: string;
}

export const AdminClientsList = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [employeesMap, setEmployeesMap] = useState<Record<string, string>>({});
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Фильтры
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  
  const { toast } = useToast();

  const fetchEmployees = async () => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('user_id, full_name');

      if (error) throw error;

      setEmployees(profiles || []);
      
      const employeesMapping = (profiles || []).reduce((acc, profile) => {
        acc[profile.user_id] = profile.full_name || 'Без имени';
        return acc;
      }, {} as Record<string, string>);
      
      setEmployeesMap(employeesMapping);
    } catch (error: any) {
      console.error('Ошибка загрузки сотрудников:', error);
    }
  };

  const fetchClients = async () => {
    try {
      let query = supabase
        .from('clients')
        .select('*')
        .eq('is_terminated', false)
        .eq('is_suspended', false)
        .order('created_at', { ascending: false });

      // Фильтр по дате создания (от)
      if (dateFrom) {
        query = query.gte('contract_date', dateFrom);
      }

      // Фильтр по дате создания (до)
      if (dateTo) {
        query = query.lte('contract_date', dateTo);
      }

      // Фильтр по сотруднику
      if (selectedEmployee && selectedEmployee !== "all") {
        query = query.eq('employee_id', selectedEmployee);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Получаем ближайшие/просроченные платежи для каждого клиента
      const clientsWithPayments = await Promise.all((data || []).map(async (client) => {
        const { data: payments } = await supabase
          .from('payments')
          .select('due_date, custom_amount, original_amount')
          .eq('client_id', client.id)
          .eq('is_completed', false)
          .order('due_date', { ascending: true })
          .limit(1);

        return {
          ...client,
          nextPayment: payments && payments.length > 0 ? {
            due_date: payments[0].due_date,
            amount: payments[0].custom_amount || payments[0].original_amount
          } : undefined
        };
      }));

      setClients(clientsWithPayments);
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить список клиентов",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchClients();
  }, [dateFrom, dateTo, selectedEmployee]);

  const filteredClients = clients.filter(client =>
    client.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(amount);
  };

  const getPaymentStatus = (client: Client) => {
    const totalPaid = client.total_paid || 0;
    const total = client.contract_amount;
    const percentage = (totalPaid / total) * 100;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let isOverdue = false;
    if (client.nextPayment) {
      const dueDate = new Date(client.nextPayment.due_date);
      dueDate.setHours(0, 0, 0, 0);
      isOverdue = dueDate < today;
    }
    
    if (isOverdue) {
      return { text: "Просрочен", variant: "destructive" as const, color: "bg-red-500" };
    }
    
    if (percentage >= 100) return { text: "Оплачено", variant: "default" as const, color: "bg-green-500" };
    if (percentage >= 50) return { text: "Почти готово", variant: "secondary" as const, color: "bg-yellow-500" };
    if (percentage > 0) return { text: "В процессе", variant: "outline" as const, color: "bg-blue-500" };
    return { text: "Не начато", variant: "destructive" as const, color: "bg-red-500" };
  };

  const handleOpenPayments = (clientId: string) => {
    setSelectedClientId(clientId);
    setIsDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      fetchClients();
    }
  };

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setSelectedEmployee("all");
  };

  const hasActiveFilters = dateFrom || dateTo || (selectedEmployee && selectedEmployee !== "all");

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <p className="text-muted-foreground">Загружаем клиентов...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <ClientDetailsDialog 
        clientId={selectedClientId}
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
      />
      <div className="space-y-6">
        {/* Поиск и кнопка фильтров */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Поиск по ФИО клиента..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button 
            variant={showFilters ? "default" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Фильтры
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2">
                {[dateFrom, dateTo, selectedEmployee !== "all" && selectedEmployee].filter(Boolean).length}
              </Badge>
            )}
          </Button>
        </div>

        {/* Панель фильтров */}
        {showFilters && (
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-2">
                  <Label>Дата создания от</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Дата создания до</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Сотрудник</Label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger>
                      <SelectValue placeholder="Все сотрудники" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все сотрудники</SelectItem>
                      {employees.map((employee) => (
                        <SelectItem key={employee.user_id} value={employee.user_id}>
                          {employee.full_name || 'Без имени'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {hasActiveFilters && (
                  <Button variant="ghost" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-2" />
                    Сбросить
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Статистика */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Найдено клиентов: <strong className="text-foreground">{filteredClients.length}</strong></span>
        </div>

        {filteredClients.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <UserPlus className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Нет клиентов</h3>
              <p className="text-muted-foreground">
                {searchTerm || hasActiveFilters ? "По вашему запросу ничего не найдено" : "Клиенты отсутствуют"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredClients.map((client) => {
              const status = getPaymentStatus(client);
              const isOverdue = status.text === "Просрочен";
              return (
                <Card key={client.id} className={`hover:shadow-md transition-shadow ${isOverdue ? 'border-red-500 bg-red-50/50' : ''}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className={`text-lg ${isOverdue ? 'text-red-600' : 'text-primary'}`}>
                          {client.full_name}
                        </CardTitle>
                        {employeesMap[client.employee_id] && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Сотрудник: {employeesMap[client.employee_id]}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Дата договора: {new Date(client.contract_date).toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={status.variant}>
                          <div className={`w-2 h-2 rounded-full ${status.color} mr-2`}></div>
                          {status.text}
                        </Badge>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleOpenPayments(client.id)}
                        >
                          <CalendarDays className="h-4 w-4 mr-2" />
                          Платежи
                        </Button>
                        <Link to={`/client/${client.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-2" />
                            Просмотр
                          </Button>
                        </Link>
                      </div>
                    </div>
                    {isOverdue && (
                      <p className="text-sm text-red-600 font-medium">
                        Платеж должен был быть внесен до {client.payment_day} числа
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="font-medium text-muted-foreground">Сумма договора</p>
                        <p className="text-lg font-semibold text-primary">
                          {formatAmount(client.contract_amount)}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground">Внесено</p>
                        <p className="text-lg font-semibold text-green-600">
                          {formatAmount(client.total_paid || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground">Остаток</p>
                        <p className="text-lg font-semibold text-accent">
                          {formatAmount(client.remaining_amount)}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground">Рассрочка</p>
                        <p className="text-lg font-semibold">
                          {client.installment_period} мес.
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground">Ежемесячно</p>
                        <p className="text-lg font-semibold">
                          {formatAmount(client.monthly_payment)}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground">День платежа</p>
                        <p className="text-lg font-semibold">
                          {client.payment_day} число
                        </p>
                      </div>
                      {client.nextPayment && (
                        <>
                          <div>
                            <p className="font-medium text-muted-foreground">Дата след. платежа</p>
                            <p className={`text-lg font-semibold ${
                              new Date(client.nextPayment.due_date) < new Date(new Date().toISOString().split('T')[0])
                                ? 'text-red-600'
                                : 'text-orange-600'
                            }`}>
                              {new Date(client.nextPayment.due_date).toLocaleDateString('ru-RU')}
                              {new Date(client.nextPayment.due_date) < new Date(new Date().toISOString().split('T')[0]) && (
                                <span className="ml-1 text-xs">(просрочен)</span>
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="font-medium text-muted-foreground">Сумма след. платежа</p>
                            <p className={`text-lg font-semibold ${
                              new Date(client.nextPayment.due_date) < new Date(new Date().toISOString().split('T')[0])
                                ? 'text-red-600'
                                : 'text-orange-600'
                            }`}>
                              {formatAmount(client.nextPayment.amount)}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};
