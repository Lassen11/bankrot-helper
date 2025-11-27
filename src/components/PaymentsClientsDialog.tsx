import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface PaymentsClientsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  isAdmin: boolean;
  selectedEmployeeId?: string;
}

interface Payment {
  id: string;
  client_name: string;
  amount: number;
  due_date: string;
  is_completed: boolean;
  account: string | null;
  payment_type: string;
}

export const PaymentsClientsDialog = ({ 
  open, 
  onOpenChange, 
  userId, 
  isAdmin,
  selectedEmployeeId
}: PaymentsClientsDialogProps) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAllPayments, setShowAllPayments] = useState(false);

  useEffect(() => {
    if (open) {
      fetchPayments();
    }
  }, [open, userId, isAdmin, showAllPayments, selectedEmployeeId]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const currentDate = new Date();
      const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      // Получаем клиентов (исключая расторгнутых и приостановленных)
      let clientsQuery = supabase
        .from('clients')
        .select('id, full_name, employee_id')
        .eq('is_terminated', false)
        .eq('is_suspended', false);

      // Фильтруем по сотруднику
      const employeeIdToFilter = selectedEmployeeId || (!isAdmin ? userId : undefined);
      
      if (employeeIdToFilter) {
        clientsQuery = clientsQuery.eq('employee_id', employeeIdToFilter);
      }

      const { data: clientsData, error: clientsError } = await clientsQuery;
      if (clientsError) throw clientsError;

      // Получаем платежи
      const clientIds = clientsData?.map(c => c.id) || [];
      
      let paymentsQuery = supabase
        .from('payments')
        .select('id, client_id, original_amount, custom_amount, is_completed, due_date, account, payment_type')
        .neq('payment_number', 0)
        .order('due_date', { ascending: false });

      // Фильтруем по текущему месяцу, если не показываем все платежи
      if (!showAllPayments) {
        paymentsQuery = paymentsQuery
          .gte('due_date', startDate.toISOString().split('T')[0])
          .lte('due_date', endDate.toISOString().split('T')[0]);
      }

      if (clientIds.length > 0) {
        paymentsQuery = paymentsQuery.in('client_id', clientIds);
      }

      const { data: paymentsData, error: paymentsError } = await paymentsQuery;
      if (paymentsError) throw paymentsError;

      // Создаем Map клиентов для быстрого доступа
      const clientsMap = new Map(clientsData?.map(c => [c.id, c.full_name]) || []);

      // Формируем список платежей
      const formattedPayments: Payment[] = paymentsData?.map(payment => ({
        id: payment.id,
        client_name: clientsMap.get(payment.client_id) || 'Неизвестный клиент',
        amount: payment.custom_amount ?? payment.original_amount,
        due_date: payment.due_date,
        is_completed: payment.is_completed,
        account: payment.account,
        payment_type: payment.payment_type,
      })) || [];

      setPayments(formattedPayments);
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>
              {showAllPayments ? 'История всех платежей' : 'История последних платежей'}
            </DialogTitle>
            <Button 
              variant="outline" 
              onClick={() => setShowAllPayments(!showAllPayments)}
            >
              {showAllPayments ? 'Текущий месяц' : 'Все платежи'}
            </Button>
          </div>
        </DialogHeader>
        
        {loading ? (
          <div className="text-center py-8">Загрузка...</div>
        ) : payments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {showAllPayments ? 'Нет платежей' : 'Нет платежей за текущий месяц'}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Клиент</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Счет</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead className="text-center">Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium">{payment.client_name}</TableCell>
                  <TableCell>{format(new Date(payment.due_date), 'dd.MM.yyyy')}</TableCell>
                  <TableCell>{payment.account || '-'}</TableCell>
                  <TableCell className="text-right">{formatAmount(payment.amount)}</TableCell>
                  <TableCell className="text-center">
                    {payment.is_completed ? (
                      <span className="text-green-600 font-medium">Оплачен</span>
                    ) : (
                      <span className="text-orange-600 font-medium">Ожидает</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
};