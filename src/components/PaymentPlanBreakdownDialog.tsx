import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

interface ClientBreakdown {
  id: string;
  full_name: string;
  monthly_payment: number;
  contract_date: string;
  is_new_client: boolean;
  included_in_plan: boolean;
  has_payments: boolean;
  employee_name: string;
}

interface PaymentPlanBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedMonth: string;
  selectedYear: string;
  selectedEmployee: string;
}

export const PaymentPlanBreakdownDialog = ({
  open,
  onOpenChange,
  selectedMonth,
  selectedYear,
  selectedEmployee,
}: PaymentPlanBreakdownDialogProps) => {
  const [clients, setClients] = useState<ClientBreakdown[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalPlanSum, setTotalPlanSum] = useState(0);
  const [totalActiveClients, setTotalActiveClients] = useState(0);

  useEffect(() => {
    if (open) {
      fetchClientBreakdown();
    }
  }, [open, selectedMonth, selectedYear, selectedEmployee]);

  const fetchClientBreakdown = async () => {
    setLoading(true);
    try {
      const year = parseInt(selectedYear);
      const month = parseInt(selectedMonth);
      const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDay = new Date(year, month, 0).getDate();
      const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

      // Получаем всех клиентов
      let allClientsQuery = supabase
        .from('clients')
        .select('id, full_name, monthly_payment, contract_date, is_terminated, is_suspended, terminated_at, suspended_at, employee_id');

      if (selectedEmployee !== 'all') {
        allClientsQuery = allClientsQuery.eq('employee_id', selectedEmployee);
      }

      const { data: allClients, error: clientsError } = await allClientsQuery;

      if (clientsError) throw clientsError;

      // Фильтруем активных клиентов для выбранного месяца
      const activeClients = allClients?.filter(client => {
        if (!client.is_terminated && !client.is_suspended) {
          return true;
        }
        
        if (client.is_terminated && client.terminated_at) {
          const terminatedDate = new Date(client.terminated_at);
          const terminatedMonth = terminatedDate.getMonth() + 1;
          const terminatedYear = terminatedDate.getFullYear();
          if (terminatedYear > year || (terminatedYear === year && terminatedMonth > month)) {
            return true;
          }
          return false;
        }
        
        if (client.is_suspended && client.suspended_at) {
          const suspendedDate = new Date(client.suspended_at);
          const suspendedMonth = suspendedDate.getMonth() + 1;
          const suspendedYear = suspendedDate.getFullYear();
          if (suspendedYear > year || (suspendedYear === year && suspendedMonth > month)) {
            return true;
          }
          return false;
        }
        
        return false;
      }) || [];

      // Получаем платежи за выбранный месяц
      const clientIds = activeClients.map(c => c.id);
      
      const { data: payments } = await supabase
        .from('payments')
        .select('client_id')
        .gte('due_date', startDateStr)
        .lte('due_date', endDateStr)
        .neq('payment_number', 0)
        .in('client_id', clientIds);

      const clientsWithPayments = new Set(payments?.map(p => p.client_id) || []);

      // Получаем профили сотрудников
      const employeeIds = [...new Set(activeClients.map(c => c.employee_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', employeeIds);

      const profilesMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

      // Формируем разбивку по клиентам
      let planSum = 0;
      
      // Клиенты С платежами за месяц
      const clientsWithPaymentsBreakdown: ClientBreakdown[] = activeClients
        .filter(client => clientsWithPayments.has(client.id))
        .map(client => {
          const contractDate = new Date(client.contract_date);
          const isNewClient = contractDate.getMonth() + 1 === month && 
                             contractDate.getFullYear() === year;
          const includedInPlan = !isNewClient;
          
          if (includedInPlan) {
            planSum += client.monthly_payment || 0;
          }

          return {
            id: client.id,
            full_name: client.full_name,
            monthly_payment: client.monthly_payment || 0,
            contract_date: client.contract_date,
            is_new_client: isNewClient,
            included_in_plan: includedInPlan,
            has_payments: true,
            employee_name: profilesMap.get(client.employee_id) || 'Не назначен',
          };
        });

      // Клиенты БЕЗ платежей за месяц
      const clientsWithoutPaymentsBreakdown: ClientBreakdown[] = activeClients
        .filter(client => !clientsWithPayments.has(client.id))
        .map(client => ({
          id: client.id,
          full_name: client.full_name,
          monthly_payment: client.monthly_payment || 0,
          contract_date: client.contract_date,
          is_new_client: false,
          included_in_plan: false,
          has_payments: false,
          employee_name: profilesMap.get(client.employee_id) || 'Не назначен',
        }));

      const allBreakdown = [...clientsWithPaymentsBreakdown, ...clientsWithoutPaymentsBreakdown]
        .sort((a, b) => {
          // Сначала включенные в план, потом новые клиенты, потом без платежей
          if (a.included_in_plan !== b.included_in_plan) {
            return a.included_in_plan ? -1 : 1;
          }
          if (a.has_payments !== b.has_payments) {
            return a.has_payments ? -1 : 1;
          }
          return a.full_name.localeCompare(b.full_name, 'ru');
        });

      setClients(allBreakdown);
      setTotalPlanSum(planSum);
      setTotalActiveClients(activeClients.length);
    } catch (error) {
      console.error('Ошибка при загрузке разбивки:', error);
    } finally {
      setLoading(false);
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

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  const includedClients = clients.filter(c => c.included_in_plan);
  const newClients = clients.filter(c => !c.included_in_plan && c.has_payments && c.is_new_client);
  const noPaymentsClients = clients.filter(c => !c.has_payments);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            Разбивка плана платежей за {monthNames[parseInt(selectedMonth) - 1]} {selectedYear}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="max-h-[calc(90vh-120px)]">
            <div className="space-y-6">
              {/* Итоговая сумма */}
              <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Плановая сумма</p>
                    <p className="text-2xl font-bold text-emerald-600">{formatAmount(totalPlanSum)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Клиентов в плане</p>
                    <p className="text-2xl font-bold text-emerald-600">{includedClients.length}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Всего активных</p>
                    <p className="text-2xl font-bold text-muted-foreground">{totalActiveClients}</p>
                  </div>
                </div>
              </div>

              {/* Клиенты, включенные в план */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="default">Включены в план</Badge>
                  <span className="text-muted-foreground text-sm">({includedClients.length} клиентов)</span>
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Клиент</TableHead>
                      <TableHead>Сотрудник</TableHead>
                      <TableHead>Дата договора</TableHead>
                      <TableHead className="text-right">Ежем. платёж</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {includedClients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          Нет клиентов
                        </TableCell>
                      </TableRow>
                    ) : (
                      includedClients.map(client => (
                        <TableRow key={client.id}>
                          <TableCell className="font-medium">{client.full_name}</TableCell>
                          <TableCell>{client.employee_name}</TableCell>
                          <TableCell>{new Date(client.contract_date).toLocaleDateString('ru-RU')}</TableCell>
                          <TableCell className="text-right font-medium text-emerald-600">
                            {formatAmount(client.monthly_payment)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Новые клиенты (исключены из плана) */}
              {newClients.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Badge variant="secondary">Новые клиенты (не в плане)</Badge>
                    <span className="text-muted-foreground text-sm">({newClients.length} клиентов)</span>
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Клиенты, заключившие договор в выбранном месяце, не включаются в расчёт плана
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Клиент</TableHead>
                        <TableHead>Сотрудник</TableHead>
                        <TableHead>Дата договора</TableHead>
                        <TableHead className="text-right">Ежем. платёж</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {newClients.map(client => (
                        <TableRow key={client.id} className="opacity-60">
                          <TableCell className="font-medium">{client.full_name}</TableCell>
                          <TableCell>{client.employee_name}</TableCell>
                          <TableCell>{new Date(client.contract_date).toLocaleDateString('ru-RU')}</TableCell>
                          <TableCell className="text-right">
                            {formatAmount(client.monthly_payment)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Клиенты без платежей за месяц */}
              {noPaymentsClients.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Badge variant="outline" className="border-orange-500 text-orange-600">Нет платежей за месяц</Badge>
                    <span className="text-muted-foreground text-sm">({noPaymentsClients.length} клиентов)</span>
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Активные клиенты, у которых нет записей о платежах в таблице payments за выбранный месяц
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Клиент</TableHead>
                        <TableHead>Сотрудник</TableHead>
                        <TableHead>Дата договора</TableHead>
                        <TableHead className="text-right">Ежем. платёж</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {noPaymentsClients.map(client => (
                        <TableRow key={client.id} className="opacity-50 bg-orange-500/5">
                          <TableCell className="font-medium">{client.full_name}</TableCell>
                          <TableCell>{client.employee_name}</TableCell>
                          <TableCell>{new Date(client.contract_date).toLocaleDateString('ru-RU')}</TableCell>
                          <TableCell className="text-right text-orange-600">
                            {formatAmount(client.monthly_payment)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Пояснение логики */}
              <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground space-y-2">
                <p><strong>Логика расчёта плана:</strong></p>
                <ul className="list-disc list-inside space-y-1">
                  <li>В план включаются все активные клиенты, у которых есть платежи в выбранном месяце</li>
                  <li>Клиенты, заключившие договор в этом месяце (новые), исключаются из плана</li>
                  <li>Клиенты без записей о платежах за выбранный месяц не включаются в план</li>
                  <li>Расторгнутые/приостановленные клиенты включаются, если статус изменился после выбранного месяца</li>
                  <li>Сумма плана = сумма ежемесячных платежей (monthly_payment) включённых клиентов</li>
                </ul>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
