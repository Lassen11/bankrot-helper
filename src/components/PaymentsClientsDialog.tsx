import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PaymentsClientsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  isAdmin: boolean;
}

interface ClientPayment {
  client_id: string;
  client_name: string;
  total_amount: number;
  completed_amount: number;
  payments_count: number;
  completed_count: number;
}

export const PaymentsClientsDialog = ({ open, onOpenChange, userId, isAdmin }: PaymentsClientsDialogProps) => {
  const [clients, setClients] = useState<ClientPayment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchClientsPayments();
    }
  }, [open, userId, isAdmin]);

  const fetchClientsPayments = async () => {
    setLoading(true);
    try {
      const currentDate = new Date();
      const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      // Получаем клиентов
      let clientsQuery = supabase
        .from('clients')
        .select('id, full_name, user_id, created_at');

      if (!isAdmin && userId) {
        clientsQuery = clientsQuery.eq('user_id', userId);
      }

      const { data: clientsData, error: clientsError } = await clientsQuery;
      if (clientsError) throw clientsError;

      // Фильтруем клиентов - исключаем тех, кто создан в текущем месяце
      const filteredClients = clientsData?.filter(client => {
        const clientCreatedAt = new Date(client.created_at);
        return clientCreatedAt < startDate;
      }) || [];

      // Получаем платежи за текущий месяц
      const clientIds = filteredClients.map(c => c.id) || [];
      
      let paymentsQuery = supabase
        .from('payments')
        .select('client_id, original_amount, custom_amount, is_completed')
        .gte('due_date', startDate.toISOString().split('T')[0])
        .lte('due_date', endDate.toISOString().split('T')[0])
        .neq('payment_number', 0);

      if (clientIds.length > 0) {
        paymentsQuery = paymentsQuery.in('client_id', clientIds);
      }

      const { data: paymentsData, error: paymentsError } = await paymentsQuery;
      if (paymentsError) throw paymentsError;

      // Группируем платежи по клиентам
      const clientsMap = new Map<string, ClientPayment>();

      filteredClients.forEach(client => {
        const clientPayments = paymentsData?.filter(p => p.client_id === client.id) || [];
        
        if (clientPayments.length > 0) {
          const totalAmount = clientPayments.reduce((sum, p) => sum + (p.custom_amount ?? p.original_amount), 0);
          const completedAmount = clientPayments
            .filter(p => p.is_completed)
            .reduce((sum, p) => sum + (p.custom_amount ?? p.original_amount), 0);

          clientsMap.set(client.id, {
            client_id: client.id,
            client_name: client.full_name,
            total_amount: totalAmount,
            completed_amount: completedAmount,
            payments_count: clientPayments.length,
            completed_count: clientPayments.filter(p => p.is_completed).length,
          });
        }
      });

      setClients(Array.from(clientsMap.values()));
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
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Платежи клиентов за текущий месяц</DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="text-center py-8">Загрузка...</div>
        ) : clients.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Нет платежей за текущий месяц</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Клиент</TableHead>
                <TableHead className="text-right">Платежей</TableHead>
                <TableHead className="text-right">Общая сумма</TableHead>
                <TableHead className="text-right">Оплачено</TableHead>
                <TableHead className="text-right">Прогресс</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => {
                const progress = client.total_amount > 0 
                  ? Math.round((client.completed_amount / client.total_amount) * 100) 
                  : 0;
                
                return (
                  <TableRow key={client.client_id}>
                    <TableCell className="font-medium">{client.client_name}</TableCell>
                    <TableCell className="text-right">
                      {client.completed_count}/{client.payments_count}
                    </TableCell>
                    <TableCell className="text-right">{formatAmount(client.total_amount)}</TableCell>
                    <TableCell className="text-right">{formatAmount(client.completed_amount)}</TableCell>
                    <TableCell className="text-right">{progress}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
};