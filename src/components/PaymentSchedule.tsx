import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Edit, CalendarIcon, RefreshCw, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { AddPaymentDialog } from "./AddPaymentDialog";
interface PaymentScheduleProps {
  clientId: string;
  employeeId: string; // ID сотрудника-владельца клиента
  contractAmount: number;
  firstPayment: number;
  monthlyPayment: number;
  installmentPeriod: number;
  paymentDay: number;
  contractDate: string;
  onRemainingPaymentsChange?: (remaining: number, completionDate: Date) => void;
  onPaymentUpdate?: () => void; // Callback для обновления данных клиента
}

interface Payment {
  id: string;
  payment_number: number;
  original_amount: number;
  custom_amount: number | null;
  due_date: string;
  is_completed: boolean;
  payment_type: string;
  account: string | null;
}

const ACCOUNT_OPTIONS = [
  "Зайнаб карта",
  "Касса офис",
  "Мариана Карта - депозит",
  "Карта Visa/Т-Банк (КИ)",
  "Сейф (КИ)",
  "Расчетный счет"
];

export const PaymentSchedule = ({
  clientId,
  employeeId,
  contractAmount,
  firstPayment,
  monthlyPayment,
  installmentPeriod,
  paymentDay,
  contractDate,
  onRemainingPaymentsChange,
  onPaymentUpdate
}: PaymentScheduleProps) => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [editingPayment, setEditingPayment] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<Date | undefined>(undefined);
  const [editingAccount, setEditingAccount] = useState<string | null>(null);
  const [editAccount, setEditAccount] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializePayments();
  }, [clientId, user]);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const initializePayments = async () => {
    if (!user || !clientId) return;
    
    setLoading(true);
    try {
      // Сначала проверяем, есть ли уже платежи в БД
      const { data: existingPayments, error: fetchError } = await supabase
        .from('payments')
        .select('*')
        .eq('client_id', clientId)
        .order('payment_number');

      if (fetchError) {
        console.error('Ошибка загрузки платежей:', fetchError);
        return;
      }

      if (existingPayments && existingPayments.length > 0) {
        setPayments(existingPayments);
        // Пересчитываем статистику при загрузке
        updatePaymentStats(existingPayments);
      } else {
        // Создаем начальный график платежей
        await generateInitialSchedule();
      }
    } catch (error) {
      console.error('Ошибка инициализации платежей:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildMonthlyDueDate = (base: Date, monthOffset: number) => {
    // Важно: НЕ используем setMonth на дате с «концом месяца» (30/31), иначе JS может перескочить месяц.
    // Вместо этого строим дату через (год/месяц/1) и потом выставляем paymentDay.
    const firstOfTargetMonth = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
    const lastDayOfMonth = new Date(
      firstOfTargetMonth.getFullYear(),
      firstOfTargetMonth.getMonth() + 1,
      0
    ).getDate();

    const actualPaymentDay = Math.min(paymentDay, lastDayOfMonth);
    return new Date(
      firstOfTargetMonth.getFullYear(),
      firstOfTargetMonth.getMonth(),
      actualPaymentDay
    );
  };

  const generateInitialSchedule = async () => {
    if (!user) return;

    const paymentsToCreate = [];
    // Парсим дату контракта корректно, чтобы избежать сдвига из-за часового пояса
    const [year, month, day] = contractDate.split('-').map(Number);
    const startDate = new Date(year, month - 1, day);

    // Авансовый платеж уже создан при создании клиента, начинаем с ежемесячных платежей
    // Ежемесячные платежи - используем указанный день месяца из поля payment_day
    for (let i = 1; i <= installmentPeriod; i++) {
      const paymentDate = buildMonthlyDueDate(startDate, i);

        paymentsToCreate.push({
          client_id: clientId,
          user_id: employeeId, // Используем ID сотрудника-владельца клиента
          payment_number: i,
          original_amount: monthlyPayment,
          due_date: format(paymentDate, 'yyyy-MM-dd'),
          payment_type: 'monthly'
        });
    }

    const { data, error } = await supabase
      .from('payments')
      .insert(paymentsToCreate)
      .select();

    if (error) {
      console.error('Ошибка создания платежей:', error);
      toast.error('Ошибка создания графика платежей');
      return;
    }

    if (data) {
      setPayments(data);
      // Пересчитываем статистику для нового графика
      updatePaymentStats(data);
    }
  };

  const togglePayment = async (paymentId: string) => {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) return;

    const newCompletedStatus = !payment.is_completed;
    
    // Сотрудники не могут отменять платежи, только отмечать как выполненные
    if (!newCompletedStatus && !isAdmin) {
      toast.error('Только администратор может отменить платеж');
      return;
    }
    
    const paymentAmount = payment.custom_amount ?? payment.original_amount;

    // Сначала сохраняем все изменения платежа (сумма, дата, счет)
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        custom_amount: payment.custom_amount,
        due_date: payment.due_date,
        account: payment.account,
        is_completed: newCompletedStatus,
        completed_at: newCompletedStatus ? new Date().toISOString() : null
      })
      .eq('id', paymentId);

    if (updateError) {
      toast.error('Ошибка сохранения платежа');
      return;
    }

    // Если платеж отмечается как выполненный, отправляем данные в pnltracker
    if (newCompletedStatus) {
      try {
        // Получаем информацию о клиенте
        const { data: clientData } = await supabase
          .from('clients')
          .select('full_name')
          .eq('id', clientId)
          .single();

        if (clientData) {
          await supabase.functions.invoke('send-to-pnltracker', {
            body: {
              event_type: 'new_payment',
              client_name: clientData.full_name,
              amount: paymentAmount,
              date: new Date().toISOString().split('T')[0],
              income_account: payment.account || 'Расчетный счет',
              company: 'Спасение',
              user_id: user!.id,
              description: payment.payment_type === 'advance' 
                ? 'Авансовый платеж' 
                : `Ежемесячный платеж ${payment.payment_number}`
            }
          });
          console.log('Payment data sent to pnltracker');
        }
      } catch (webhookError) {
        console.error('Error sending to pnltracker:', webhookError);
        // Не показываем ошибку пользователю
      }
    }

    // Получаем текущие данные клиента для расчета новой суммы
    const { data: clientData, error: clientFetchError } = await supabase
      .from('clients')
      .select('total_paid, deposit_paid, deposit_target')
      .eq('id', clientId)
      .single();

    if (clientFetchError || !clientData) {
      toast.error('Ошибка получения данных клиента');
      return;
    }

    // Рассчитываем новую общую сумму оплаты и депозит
    let newTotalPaid = clientData.total_paid || 0;
    let newDepositPaid = clientData.deposit_paid || 0;
    const depositTarget = clientData.deposit_target || 50000;
    
    if (newCompletedStatus) {
      // При выполнении платежа - засчитываем полную сумму в оба показателя
      newTotalPaid += paymentAmount;
      
      // Засчитываем в депозит полную сумму платежа, пока не достигнута цель
      if (newDepositPaid < depositTarget) {
        newDepositPaid = Math.min(newDepositPaid + paymentAmount, depositTarget);
      }
    } else {
      // При отмене платежа - вычитаем из обоих показателей
      newTotalPaid = Math.max(0, newTotalPaid - paymentAmount);
      newDepositPaid = Math.max(0, newDepositPaid - paymentAmount);
    }

    // Рассчитываем новый остаток: сумма договора минус оплачено
    const newRemainingAmount = Math.max(0, contractAmount - newTotalPaid);

    const { error: clientUpdateError } = await supabase
      .from('clients')
      .update({ 
        total_paid: newTotalPaid,
        deposit_paid: newDepositPaid,
        remaining_amount: newRemainingAmount
      })
      .eq('id', clientId);

    if (clientUpdateError) {
      toast.error('Ошибка обновления суммы оплаты');
      return;
    }

    // Проверяем, полностью ли оплачен договор
    if (newCompletedStatus && newTotalPaid >= contractAmount) {
      // Завершаем клиента
      const { error: completeError } = await supabase
        .from('clients')
        .update({ 
          completed_at: new Date().toISOString()
        })
        .eq('id', clientId);

      if (completeError) {
        console.error('Ошибка завершения клиента:', completeError);
      }

      // Удаляем все неоплаченные платежи
      const { error: deleteError } = await supabase
        .from('payments')
        .delete()
        .eq('client_id', clientId)
        .eq('is_completed', false);

      if (deleteError) {
        console.error('Ошибка удаления неоплаченных платежей:', deleteError);
      } else {
        toast.success('Договор полностью оплачен! Клиент завершен.');
      }

      // Обновляем локальное состояние - оставляем только выполненные платежи
      const completedPayments = payments
        .map(p => p.id === paymentId ? { ...p, is_completed: true } : p)
        .filter(p => p.is_completed);
      setPayments(completedPayments);
      
      // Пересчитываем статистику
      updatePaymentStats(completedPayments);
      
      // Уведомляем родительский компонент об обновлении
      onPaymentUpdate?.();
      return;
    }

    // Обновляем локальное состояние платежей
    const updatedPayments = payments.map(p => 
      p.id === paymentId 
        ? { ...p, is_completed: newCompletedStatus }
        : p
    );
    setPayments(updatedPayments);
    
    // Пересчитываем статистику
    updatePaymentStats(updatedPayments);
    
    // Уведомляем родительский компонент об обновлении
    onPaymentUpdate?.();
    
    toast.success(newCompletedStatus ? 'Платеж отмечен как выполненный' : 'Платеж отмечен как невыполненный');
  };

  const updatePaymentStats = (updatedPayments: Payment[]) => {
    const completedCount = updatedPayments.filter(p => p.is_completed).length;
    const remainingCount = updatedPayments.length - completedCount;
    
    let completionDate = new Date();
    if (remainingCount > 0) {
      const lastIncompletePayment = updatedPayments
        .filter(p => !p.is_completed)
        .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime())[0];
      
      if (lastIncompletePayment) {
        completionDate = new Date(lastIncompletePayment.due_date);
      }
    }
    
    onRemainingPaymentsChange?.(remainingCount, completionDate);
  };

  const startEditing = (paymentId: string, currentAmount: number) => {
    setEditingPayment(paymentId);
    setEditAmount(currentAmount);
  };

  const saveCustomAmount = (paymentId: string, amount: number) => {
    // Обновляем только локальное состояние, сохранение в БД произойдет при клике на чекбокс
    const updatedPayments = payments.map(p => 
      p.id === paymentId 
        ? { ...p, custom_amount: amount }
        : p
    );
    setPayments(updatedPayments);
    setEditingPayment(null);
  };

  const startEditingDate = (paymentId: string, currentDate: string) => {
    setEditingDate(paymentId);
    setEditDate(new Date(currentDate));
  };

  const saveCustomDate = (paymentId: string, date: Date) => {
    // Обновляем только локальное состояние, сохранение в БД произойдет при клике на чекбокс
    const updatedPayments = payments.map(p => 
      p.id === paymentId 
        ? { ...p, due_date: format(date, 'yyyy-MM-dd') }
        : p
    );
    setPayments(updatedPayments);
    updatePaymentStats(updatedPayments);
    setEditingDate(null);
  };

  const startEditingAccount = (paymentId: string, currentAccount: string | null) => {
    setEditingAccount(paymentId);
    setEditAccount(currentAccount || "");
  };

  const saveCustomAccount = (paymentId: string, account: string) => {
    // Обновляем только локальное состояние, сохранение в БД произойдет при клике на чекбокс
    const updatedPayments = payments.map(p => 
      p.id === paymentId 
        ? { ...p, account: account || null }
        : p
    );
    setPayments(updatedPayments);
    setEditingAccount(null);
  };

  const canCompletePayment = (payment: Payment) => {
    return true; // Разрешаем отмечать платежи без обязательной загрузки чеков
  };

  const deletePayment = async (paymentId: string) => {
    if (!isAdmin) {
      toast.error('Только администратор может удалять платежи');
      return;
    }

    const payment = payments.find(p => p.id === paymentId);
    if (!payment) return;

    if (!confirm(`Вы уверены, что хотите удалить платеж "${payment.payment_type === 'advance' ? 'Авансовый платеж' : payment.payment_type === 'additional' ? 'Доп. счёт' : `Платеж ${payment.payment_number}`}"?`)) {
      return;
    }

    // Если платеж был выполнен, нужно откатить сумму
    if (payment.is_completed) {
      const paymentAmount = payment.custom_amount ?? payment.original_amount;
      
      const { data: clientData, error: clientFetchError } = await supabase
        .from('clients')
        .select('total_paid, deposit_paid, contract_amount')
        .eq('id', clientId)
        .single();

      if (clientFetchError || !clientData) {
        toast.error('Ошибка получения данных клиента');
        return;
      }

      const newTotalPaid = Math.max(0, (clientData.total_paid || 0) - paymentAmount);
      const newDepositPaid = Math.max(0, (clientData.deposit_paid || 0) - paymentAmount);
      const newRemainingAmount = Math.max(0, clientData.contract_amount - newTotalPaid);

      const { error: clientUpdateError } = await supabase
        .from('clients')
        .update({ 
          total_paid: newTotalPaid,
          deposit_paid: newDepositPaid,
          remaining_amount: newRemainingAmount
        })
        .eq('id', clientId);

      if (clientUpdateError) {
        toast.error('Ошибка обновления суммы клиента');
        return;
      }
    }

    const { error: deleteError } = await supabase
      .from('payments')
      .delete()
      .eq('id', paymentId);

    if (deleteError) {
      console.error('Ошибка удаления платежа:', deleteError);
      toast.error('Ошибка удаления платежа');
      return;
    }

    // Обновляем локальное состояние
    const updatedPayments = payments.filter(p => p.id !== paymentId);
    setPayments(updatedPayments);
    
    // Пересчитываем статистику
    updatePaymentStats(updatedPayments);
    
    // Уведомляем родительский компонент
    onPaymentUpdate?.();
    
    toast.success('Платеж удален');
  };

  const regeneratePaymentSchedule = async () => {
    if (!user || !clientId) return;
    
    // Подтверждение действия
    if (!confirm('Вы уверены, что хотите пересоздать график платежей? Даты всех невыполненных платежей будут обновлены согласно полю "День платежа". Выполненные платежи сохранятся.')) {
      return;
    }

    setLoading(true);
    try {
      // Получаем актуальные данные клиента (remaining_amount)
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('remaining_amount')
        .eq('id', clientId)
        .single();

      if (clientError || !clientData) {
        console.error('Ошибка получения данных клиента:', clientError);
        toast.error('Ошибка получения данных клиента');
        return;
      }

      const remainingAmount = clientData.remaining_amount || 0;

      // Удаляем ВСЕ невыполненные платежи напрямую (более надёжно)
      const { error: deleteError } = await supabase
        .from('payments')
        .delete()
        .eq('client_id', clientId)
        .eq('is_completed', false);

      if (deleteError) {
        console.error('Ошибка удаления платежей:', deleteError);
        toast.error('Ошибка удаления старых платежей: ' + deleteError.message);
        return;
      }

      // Получаем ВСЕ выполненные платежи для определения максимального номера
      const { data: completedPayments, error: completedError } = await supabase
        .from('payments')
        .select('payment_number, due_date, payment_type')
        .eq('client_id', clientId)
        .eq('is_completed', true)
        .order('payment_number', { ascending: false });

      if (completedError) {
        console.error('Ошибка получения выполненных платежей:', completedError);
        toast.error('Ошибка получения данных');
        return;
      }

      // Находим максимальный номер платежа среди всех выполненных (включая advance/first)
      let maxPaymentNumber = 0;
      
      if (completedPayments && completedPayments.length > 0) {
        // Берём максимальный payment_number (может быть 0 для авансового)
        maxPaymentNumber = Math.max(...completedPayments.map(p => p.payment_number));
      }

      // Если остаток = 0, платежи не нужны
      if (remainingAmount <= 0) {
        console.log('Остаток = 0, платежи не нужны');
        await initializePayments();
        toast.success('График платежей обновлен');
        return;
      }

      // Рассчитываем количество платежей на основе ОСТАТКА К ОПЛАТЕ
      const remainingPaymentsCount = Math.ceil(remainingAmount / monthlyPayment);
      
      // Для даты начинаем от ТЕКУЩЕЙ даты, а не от последнего выполненного платежа
      // Это важно, чтобы следующий платеж был в текущем или следующем месяце
      const today = new Date();
      
      console.log('Regenerating schedule:', {
        maxPaymentNumber,
        remainingAmount,
        monthlyPayment,
        remainingPaymentsCount,
        startDate: today.toISOString(),
        paymentDay
      });

      const paymentsToCreate = [];

      // Создаем ежемесячные платежи начиная с текущего/следующего месяца
      for (let i = 0; i < remainingPaymentsCount; i++) {
        // Рассчитываем дату: если день платежа уже прошёл в этом месяце, начинаем со следующего
        let monthOffset = i;
        if (i === 0 && today.getDate() > paymentDay) {
          monthOffset = 1; // Следующий месяц для первого платежа
        } else if (i > 0) {
          monthOffset = today.getDate() > paymentDay ? i + 1 : i;
        }
        
        const paymentDate = buildMonthlyDueDate(today, monthOffset);

        paymentsToCreate.push({
          client_id: clientId,
          user_id: employeeId,
          payment_number: maxPaymentNumber + i + 1,
          original_amount: monthlyPayment,
          due_date: format(paymentDate, 'yyyy-MM-dd'),
          payment_type: 'monthly'
        });
      }

      console.log('Payments to create:', paymentsToCreate);

      const { data, error } = await supabase
        .from('payments')
        .insert(paymentsToCreate)
        .select();

      if (error) {
        console.error('Ошибка создания платежей:', error);
        toast.error('Ошибка создания графика платежей: ' + error.message);
        return;
      }

      // Загружаем все платежи заново (включая выполненные)
      await initializePayments();
      
      toast.success('График платежей успешно обновлен');
    } catch (error) {
      console.error('Ошибка пересоздания графика:', error);
      toast.error('Ошибка пересоздания графика платежей');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>График платежей</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-muted rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>График платежей</CardTitle>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <AddPaymentDialog 
                clientId={clientId}
                employeeId={employeeId}
                onPaymentAdded={initializePayments}
                existingPaymentsCount={payments.length}
              />
            )}
            <Button 
              onClick={regeneratePaymentSchedule}
              variant="outline"
              size="sm"
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Пересоздать график
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {payments.map((payment) => {
            const currentAmount = payment.custom_amount ?? payment.original_amount;
            const getPaymentTypeLabel = () => {
              if (payment.payment_type === 'advance') return 'Авансовый платеж';
              if (payment.payment_type === 'additional') return `Доп. счёт${payment.account ? `: ${payment.account}` : ''}`;
              return `Платеж ${payment.payment_number}`;
            };
            const paymentType = getPaymentTypeLabel();
            const isEditing = editingPayment === payment.id;
            
            return (
              <div 
                key={payment.id} 
                className={`group flex justify-between items-center py-2 border-b border-border/50 last:border-b-0 rounded px-2 transition-colors ${
                  payment.is_completed ? 'opacity-60' : ''
                }`}
              >
                 <div className="flex items-center gap-3">
                     <div 
                     className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                       payment.is_completed 
                         ? 'bg-primary border-primary text-primary-foreground cursor-pointer' 
                         : 'border-muted-foreground hover:border-primary cursor-pointer'
                     }`}
                     onClick={() => togglePayment(payment.id)}
                   >
                     {payment.is_completed && <Check className="w-3 h-3" />}
                   </div>
                   <div>
                     <span className={`text-sm font-medium ${payment.is_completed ? 'line-through' : ''}`}>
                       {paymentType}
                     </span>
                      {editingDate === payment.id ? (
                        <div className="flex items-center gap-2 mt-1">
                          <Popover open={editingDate === payment.id} onOpenChange={(open) => !open && setEditingDate(null)}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "h-6 px-2 text-xs font-normal",
                                  !editDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="h-3 w-3" />
                                {editDate ? format(editDate, "dd.MM.yyyy") : "Выберите дату"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={editDate}
                                onSelect={(date) => {
                                  if (date) {
                                    setEditDate(date);
                                    saveCustomDate(payment.id, date);
                                  }
                                }}
                                initialFocus
                                className={cn("p-3 pointer-events-auto")}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      ) : (
                       <div className="flex items-center gap-1 group/date">
                         <p className={`text-xs text-muted-foreground ${payment.is_completed ? 'line-through' : ''}`}>
                           {new Date(payment.due_date).toLocaleDateString('ru-RU')}
                         </p>
                         <Button 
                           onClick={() => startEditingDate(payment.id, payment.due_date)}
                           size="sm" 
                           variant="ghost" 
                           className="h-4 w-4 p-0 opacity-0 group-hover/date:opacity-100 hover:opacity-100 transition-opacity"
                         >
                           <CalendarIcon className="w-3 h-3" />
                         </Button>
                       </div>
                     )}
                   </div>
                </div>
                
                 <div className="flex items-center gap-2">
                   {editingAccount === payment.id ? (
                      <div className="flex items-center gap-2">
                        <Select 
                          value={editAccount} 
                          onValueChange={(value) => {
                            setEditAccount(value);
                            saveCustomAccount(payment.id, value);
                          }}
                          open={editingAccount === payment.id}
                          onOpenChange={(open) => !open && setEditingAccount(null)}
                        >
                          <SelectTrigger className="w-40 h-8 text-xs">
                            <SelectValue placeholder="Выберите счет" />
                          </SelectTrigger>
                          <SelectContent>
                            {ACCOUNT_OPTIONS.map((account) => (
                              <SelectItem key={account} value={account} className="text-xs">
                                {account}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                     <div className="flex items-center gap-2 group/account">
                       <span className={`text-xs text-muted-foreground min-w-[100px] ${payment.is_completed ? 'line-through' : ''}`}>
                         {payment.account || 'Не указан'}
                       </span>
                       <Button 
                         onClick={() => startEditingAccount(payment.id, payment.account)}
                         size="sm" 
                         variant="ghost" 
                         className="h-6 w-6 p-0 opacity-0 group-hover/account:opacity-100 hover:opacity-100 transition-opacity"
                       >
                         <Edit className="w-3 h-3" />
                       </Button>
                     </div>
                   )}
                   
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={editAmount}
                          onChange={(e) => setEditAmount(parseFloat(e.target.value) || 0)}
                          onBlur={() => {
                            if (editAmount !== (payment.custom_amount ?? payment.original_amount)) {
                              saveCustomAmount(payment.id, editAmount);
                            } else {
                              setEditingPayment(null);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              saveCustomAmount(payment.id, editAmount);
                            } else if (e.key === 'Escape') {
                              setEditingPayment(null);
                            }
                          }}
                          className="w-24 h-8 text-sm"
                          step="0.01"
                          min="0"
                          autoFocus
                        />
                      </div>
                    ) : (
                     <div className="flex items-center gap-2">
                       <span className={`font-semibold ${payment.is_completed ? 'line-through' : ''}`}>
                         {formatAmount(currentAmount)}
                       </span>
                       <Button 
                         onClick={() => startEditing(payment.id, currentAmount)}
                         size="sm" 
                         variant="ghost" 
                         className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                       >
                         <Edit className="w-3 h-3" />
                       </Button>
                       {isAdmin && (
                         <Button 
                           onClick={() => deletePayment(payment.id)}
                           size="sm" 
                           variant="ghost" 
                           className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                         >
                           <Trash2 className="w-3 h-3" />
                         </Button>
                       )}
                     </div>
                   )}
                 </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Общая сумма:</span>
            <span className="text-lg font-semibold text-primary">
              {formatAmount(contractAmount)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};