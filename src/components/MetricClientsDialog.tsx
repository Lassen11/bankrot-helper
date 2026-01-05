import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ExternalLink } from "lucide-react";

export type MetricType = 
  | 'totalClients'
  | 'totalContractAmount'
  | 'totalRemainingAmount'
  | 'activeCases'
  | 'newClientsThisMonth'
  | 'completedClientsThisMonth'
  | 'totalPaymentsCount'
  | 'terminatedClients'
  | 'suspendedClients';

interface ClientData {
  id: string;
  full_name: string;
  contract_amount: number;
  monthly_payment: number;
  remaining_amount: number;
  total_paid: number;
  contract_date: string;
  employee_name: string;
  is_terminated: boolean;
  is_suspended: boolean;
  terminated_at: string | null;
  suspended_at: string | null;
  termination_reason: string | null;
  suspension_reason: string | null;
}

interface MetricClientsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metricType: MetricType;
  selectedMonth: string;
  selectedYear: string;
  selectedEmployee: string;
}

const metricTitles: Record<MetricType, string> = {
  totalClients: 'Все клиенты',
  totalContractAmount: 'Общая сумма договоров',
  totalRemainingAmount: 'Остаток платежей',
  activeCases: 'Активные дела',
  newClientsThisMonth: 'Новые клиенты за месяц',
  completedClientsThisMonth: 'Завершённые дела за месяц',
  totalPaymentsCount: 'Клиенты с платежами за месяц',
  terminatedClients: 'Расторгнутые договоры',
  suspendedClients: 'Приостановленные договоры',
};

export const MetricClientsDialog = ({
  open,
  onOpenChange,
  metricType,
  selectedMonth,
  selectedYear,
  selectedEmployee,
}: MetricClientsDialogProps) => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(false);
  const [totals, setTotals] = useState({ contractSum: 0, remainingSum: 0, monthlySum: 0, count: 0 });

  useEffect(() => {
    if (open) {
      fetchClients();
    }
  }, [open, metricType, selectedMonth, selectedYear, selectedEmployee]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const year = parseInt(selectedYear);
      const month = parseInt(selectedMonth);
      const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDay = new Date(year, month, 0).getDate();
      const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

      let query = supabase
        .from('clients')
        .select('id, full_name, contract_amount, monthly_payment, remaining_amount, total_paid, contract_date, employee_id, is_terminated, is_suspended, terminated_at, suspended_at, termination_reason, suspension_reason, created_at');

      if (selectedEmployee !== 'all') {
        query = query.eq('employee_id', selectedEmployee);
      }

      const { data: allClients, error } = await query;
      if (error) throw error;

      // Get employee profiles
      const employeeIds = [...new Set(allClients?.map(c => c.employee_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', employeeIds);

      const profilesMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

      let filteredClients: ClientData[] = [];

      // Filter based on metric type
      const activeClients = allClients?.filter(client => {
        if (!client.is_terminated && !client.is_suspended) return true;
        
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

      switch (metricType) {
        case 'totalClients':
        case 'totalContractAmount':
          filteredClients = activeClients.map(c => ({
            ...c,
            employee_name: profilesMap.get(c.employee_id) || 'Не назначен',
          }));
          break;

        case 'totalRemainingAmount':
          filteredClients = activeClients
            .filter(c => (c.remaining_amount || 0) > 0)
            .map(c => ({
              ...c,
              employee_name: profilesMap.get(c.employee_id) || 'Не назначен',
            }));
          break;

        case 'activeCases':
          filteredClients = activeClients
            .filter(c => (c.total_paid || 0) < (c.contract_amount || 0))
            .map(c => ({
              ...c,
              employee_name: profilesMap.get(c.employee_id) || 'Не назначен',
            }));
          break;

        case 'newClientsThisMonth':
          filteredClients = (allClients || [])
            .filter(c => {
              const createdAt = new Date(c.created_at);
              return createdAt >= new Date(startDateStr) && 
                     createdAt <= new Date(endDateStr + 'T23:59:59.999Z');
            })
            .map(c => ({
              ...c,
              employee_name: profilesMap.get(c.employee_id) || 'Не назначен',
            }));
          break;

        case 'completedClientsThisMonth': {
          const potentiallyCompleted = activeClients.filter(c => 
            (c.total_paid || 0) >= (c.contract_amount || 0)
          );
          
          if (potentiallyCompleted.length > 0) {
            const clientIds = potentiallyCompleted.map(c => c.id);
            
            // Получаем ВСЕ завершенные платежи для каждого клиента
            const { data: allPayments } = await supabase
              .from('payments')
              .select('client_id, completed_at')
              .in('client_id', clientIds)
              .eq('is_completed', true)
              .order('completed_at', { ascending: false });

            // Находим ПОСЛЕДНИЙ платеж для каждого клиента
            const lastPaymentByClient = new Map<string, string>();
            allPayments?.forEach(p => {
              if (p.completed_at && !lastPaymentByClient.has(p.client_id)) {
                lastPaymentByClient.set(p.client_id, p.completed_at);
              }
            });

            // Проверяем, попадает ли ПОСЛЕДНИЙ платеж в выбранный месяц
            const startDate = new Date(startDateStr);
            const endDate = new Date(endDateStr + 'T23:59:59.999Z');
            
            const completedInMonth = new Set<string>();
            lastPaymentByClient.forEach((completedAt, clientId) => {
              const paymentDate = new Date(completedAt);
              if (paymentDate >= startDate && paymentDate <= endDate) {
                completedInMonth.add(clientId);
              }
            });

            filteredClients = potentiallyCompleted
              .filter(c => completedInMonth.has(c.id))
              .map(c => ({
                ...c,
                employee_name: profilesMap.get(c.employee_id) || 'Не назначен',
              }));
          }
          break;
        }

        case 'totalPaymentsCount': {
          const clientIds = activeClients.map(c => c.id);
          const { data: payments } = await supabase
            .from('payments')
            .select('client_id')
            .gte('due_date', startDateStr)
            .lte('due_date', endDateStr)
            .neq('payment_number', 0)
            .in('client_id', clientIds);

          const clientsWithPayments = new Set(payments?.map(p => p.client_id) || []);
          filteredClients = activeClients
            .filter(c => clientsWithPayments.has(c.id))
            .map(c => ({
              ...c,
              employee_name: profilesMap.get(c.employee_id) || 'Не назначен',
            }));
          break;
        }

        case 'terminatedClients': {
          const { data: terminated } = await supabase
            .from('clients')
            .select('id, full_name, contract_amount, monthly_payment, remaining_amount, total_paid, contract_date, employee_id, is_terminated, is_suspended, terminated_at, suspended_at, termination_reason, suspension_reason')
            .eq('is_terminated', true)
            .gte('terminated_at', startDateStr)
            .lte('terminated_at', endDateStr + 'T23:59:59.999Z')
            .eq(selectedEmployee !== 'all' ? 'employee_id' : 'is_terminated', selectedEmployee !== 'all' ? selectedEmployee : true);

          filteredClients = (terminated || []).map(c => ({
            ...c,
            employee_name: profilesMap.get(c.employee_id) || 'Не назначен',
          }));
          break;
        }

        case 'suspendedClients': {
          const { data: suspended } = await supabase
            .from('clients')
            .select('id, full_name, contract_amount, monthly_payment, remaining_amount, total_paid, contract_date, employee_id, is_terminated, is_suspended, terminated_at, suspended_at, termination_reason, suspension_reason')
            .eq('is_suspended', true)
            .gte('suspended_at', startDateStr)
            .lte('suspended_at', endDateStr + 'T23:59:59.999Z')
            .eq(selectedEmployee !== 'all' ? 'employee_id' : 'is_suspended', selectedEmployee !== 'all' ? selectedEmployee : true);

          filteredClients = (suspended || []).map(c => ({
            ...c,
            employee_name: profilesMap.get(c.employee_id) || 'Не назначен',
          }));
          break;
        }
      }

      // Sort clients
      filteredClients.sort((a, b) => a.full_name.localeCompare(b.full_name, 'ru'));

      setClients(filteredClients);
      setTotals({
        contractSum: filteredClients.reduce((sum, c) => sum + (c.contract_amount || 0), 0),
        remainingSum: filteredClients.reduce((sum, c) => sum + (c.remaining_amount || 0), 0),
        monthlySum: filteredClients.reduce((sum, c) => sum + (c.monthly_payment || 0), 0),
        count: filteredClients.length,
      });
    } catch (error) {
      console.error('Ошибка загрузки клиентов:', error);
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

  const handleClientClick = (clientId: string) => {
    onOpenChange(false);
    navigate(`/client/${clientId}`);
  };

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  const getExtraColumns = () => {
    if (metricType === 'terminatedClients') {
      return { show: true, header: 'Дата расторжения', field: 'terminated_at' as const, reason: 'termination_reason' as const };
    }
    if (metricType === 'suspendedClients') {
      return { show: true, header: 'Дата приостановки', field: 'suspended_at' as const, reason: 'suspension_reason' as const };
    }
    return null;
  };

  const extraColumn = getExtraColumns();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {metricTitles[metricType]} — {monthNames[parseInt(selectedMonth) - 1]} {selectedYear}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="max-h-[calc(90vh-120px)]">
            <div className="space-y-4">
              {/* Summary */}
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Клиентов</p>
                    <p className="text-xl font-bold text-primary">{totals.count}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Сумма договоров</p>
                    <p className="text-xl font-bold text-green-600">{formatAmount(totals.contractSum)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Остаток</p>
                    <p className="text-xl font-bold text-indigo-600">{formatAmount(totals.remainingSum)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ежемес. платежи</p>
                    <p className="text-xl font-bold text-orange-600">{formatAmount(totals.monthlySum)}</p>
                  </div>
                </div>
              </div>

              {/* Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Клиент</TableHead>
                    <TableHead>Сотрудник</TableHead>
                    <TableHead className="text-right">Договор</TableHead>
                    <TableHead className="text-right">Остаток</TableHead>
                    <TableHead className="text-right">Ежемес.</TableHead>
                    {extraColumn && <TableHead>{extraColumn.header}</TableHead>}
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={extraColumn ? 7 : 6} className="text-center text-muted-foreground py-8">
                        Нет клиентов для отображения
                      </TableCell>
                    </TableRow>
                  ) : (
                    clients.map((client) => (
                      <TableRow key={client.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleClientClick(client.id)}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {client.full_name}
                            {client.is_terminated && <Badge variant="destructive" className="text-xs">Расторгнут</Badge>}
                            {client.is_suspended && <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">Приостановлен</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>{client.employee_name}</TableCell>
                        <TableCell className="text-right">{formatAmount(client.contract_amount)}</TableCell>
                        <TableCell className="text-right">{formatAmount(client.remaining_amount)}</TableCell>
                        <TableCell className="text-right">{formatAmount(client.monthly_payment)}</TableCell>
                        {extraColumn && (
                          <TableCell>
                            <div className="text-sm">
                              {client[extraColumn.field] 
                                ? new Date(client[extraColumn.field]!).toLocaleDateString('ru-RU')
                                : '-'}
                              {client[extraColumn.reason] && (
                                <p className="text-xs text-muted-foreground truncate max-w-[150px]" title={client[extraColumn.reason] || ''}>
                                  {client[extraColumn.reason]}
                                </p>
                              )}
                            </div>
                          </TableCell>
                        )}
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
