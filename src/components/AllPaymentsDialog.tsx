import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface AllPaymentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Payment {
  id: string;
  client_name: string;
  employee_name: string;
  amount: number;
  due_date: string;
  is_completed: boolean;
  completed_at: string | null;
}

export const AllPaymentsDialog = ({ open, onOpenChange }: AllPaymentsDialogProps) => {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>((currentDate.getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState<string>(currentDate.getFullYear().toString());
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; full_name: string }>>([]);
  const [loading, setLoading] = useState(false);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  useEffect(() => {
    if (open) {
      fetchEmployees();
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      fetchPayments();
    }
  }, [open, selectedMonth, selectedYear, selectedEmployee, selectedStatus]);

  const fetchEmployees = async () => {
    // Получаем сотрудников через user_roles и profiles вместо admin API
    const { data: rolesData, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id');
    
    if (rolesError) {
      console.error('Error fetching user roles:', rolesError);
      return;
    }

    const userIds = rolesData?.map(r => r.user_id) || [];

    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', userIds);
    
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return;
    }

    const employeesList = profilesData?.map(profile => ({
      id: profile.user_id,
      full_name: profile.full_name || 'Без имени'
    })) || [];

    setEmployees(employeesList);
  };

  const fetchPayments = async () => {
    setLoading(true);
    
    const month = parseInt(selectedMonth);
    const year = parseInt(selectedYear);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    let query = supabase
      .from('payments')
      .select(`
        id,
        due_date,
        is_completed,
        completed_at,
        original_amount,
        custom_amount,
        user_id,
        client_id
      `)
      .gte('due_date', format(startDate, 'yyyy-MM-dd'))
      .lte('due_date', format(endDate, 'yyyy-MM-dd'))
      .order('due_date', { ascending: false });

    if (selectedEmployee !== 'all') {
      query = query.eq('user_id', selectedEmployee);
    }

    // Фильтр по статусу
    if (selectedStatus === 'completed') {
      query = query.eq('is_completed', true);
    } else if (selectedStatus === 'pending') {
      query = query.eq('is_completed', false);
    }

    const { data: paymentsData, error: paymentsError } = await query;

    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError);
      setLoading(false);
      return;
    }

    const clientIds = [...new Set(paymentsData?.map(p => p.client_id))];
    
    // Получаем ВСЕХ клиентов без фильтрации по статусу
    const { data: clientsData } = await supabase
      .from('clients')
      .select('id, full_name')
      .in('id', clientIds);

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('user_id, full_name');

    const paymentsWithDetails = paymentsData?.map(payment => {
      const client = clientsData?.find(c => c.id === payment.client_id);
      const profile = profilesData?.find(p => p.user_id === payment.user_id);
      return {
        id: payment.id,
        client_name: client?.full_name || 'Неизвестный клиент',
        employee_name: profile?.full_name || 'Неизвестный сотрудник',
        amount: payment.custom_amount || payment.original_amount,
        due_date: payment.due_date,
        is_completed: payment.is_completed,
        completed_at: payment.completed_at,
      };
    }) || [];

    setPayments(paymentsWithDetails);
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Все платежи за выбранный период</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
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
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => {
                  const year = new Date().getFullYear() - i;
                  return (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Выберите сотрудника" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все сотрудники</SelectItem>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                <SelectItem value="completed">Выполнен</SelectItem>
                <SelectItem value="pending">Ожидается</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Нет платежей за выбранный период
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((payment) => (
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
        </div>
      </DialogContent>
    </Dialog>
  );
};
