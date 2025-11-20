import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Edit, CalendarIcon, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface PaymentScheduleProps {
  clientId: string;
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
  "Касса офис Диана",
  "Мариана Карта - депозит",
  "Карта Visa/Т-Банк (КИ)",
  "Наличные",
  "Сейф (КИ)",
  "Расчетный счет"
];

export const PaymentSchedule = ({
  clientId,
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

  const generateInitialSchedule = async () => {
    if (!user) return;
    
    const paymentsToCreate = [];
    const startDate = new Date(contractDate);
    
    // Первый платеж уже создан при создании клиента, начинаем с ежемесячных платежей
    // Ежемесячные платежи - используем указанный день месяца из поля payment_day
    for (let i = 1; i <= installmentPeriod; i++) {
      const paymentDate = new Date(startDate);
      paymentDate.setMonth(startDate.getMonth() + i);
      
      // Получаем последний день месяца для проверки
      const lastDayOfMonth = new Date(paymentDate.getFullYear(), paymentDate.getMonth() + 1, 0).getDate();
      
      // Устанавливаем день платежа, но не больше последнего дня месяца
      const actualPaymentDay = Math.min(paymentDay, lastDayOfMonth);
      paymentDate.setDate(actualPaymentDay);
      
      paymentsToCreate.push({
        client_id: clientId,
        user_id: user.id,
        payment_number: i,
        original_amount: monthlyPayment,
        due_date: paymentDate.toISOString().split('T')[0],
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
    const paymentAmount = payment.custom_amount ?? payment.original_amount;

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
              description: payment.payment_type === 'first' 
                ? 'Первый платеж' 
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

    // Обновляем статус платежа
    const { error: paymentError } = await supabase
      .from('payments')
      .update({
        is_completed: newCompletedStatus,
        completed_at: newCompletedStatus ? new Date().toISOString() : null
      })
      .eq('id', paymentId);

    if (paymentError) {
      toast.error('Ошибка обновления статуса платежа');
      return;
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

  const saveCustomAmount = async (paymentId: string, amount: number) => {
    const { error } = await supabase
      .from('payments')
      .update({ custom_amount: amount })
      .eq('id', paymentId);

    if (error) {
      toast.error('Ошибка сохранения суммы');
      return;
    }

    const updatedPayments = payments.map(p => 
      p.id === paymentId 
        ? { ...p, custom_amount: amount }
        : p
    );
    setPayments(updatedPayments);
    setEditingPayment(null);
    toast.success('Сумма платежа обновлена');
  };

  const startEditingDate = (paymentId: string, currentDate: string) => {
    setEditingDate(paymentId);
    setEditDate(new Date(currentDate));
  };

  const saveCustomDate = async (paymentId: string, date: Date) => {
    const { error } = await supabase
      .from('payments')
      .update({ due_date: format(date, 'yyyy-MM-dd') })
      .eq('id', paymentId);

    if (error) {
      toast.error('Ошибка сохранения даты');
      return;
    }

    const updatedPayments = payments.map(p => 
      p.id === paymentId 
        ? { ...p, due_date: format(date, 'yyyy-MM-dd') }
        : p
    );
    setPayments(updatedPayments);
    updatePaymentStats(updatedPayments);
    setEditingDate(null);
    toast.success('Дата платежа обновлена');
  };

  const startEditingAccount = (paymentId: string, currentAccount: string | null) => {
    setEditingAccount(paymentId);
    setEditAccount(currentAccount || "");
  };

  const saveCustomAccount = async (paymentId: string, account: string) => {
    const { error } = await supabase
      .from('payments')
      .update({ account: account || null })
      .eq('id', paymentId);

    if (error) {
      toast.error('Ошибка сохранения счета');
      return;
    }

    const updatedPayments = payments.map(p => 
      p.id === paymentId 
        ? { ...p, account: account || null }
        : p
    );
    setPayments(updatedPayments);
    setEditingAccount(null);
    toast.success('Счет обновлен');
  };

  const canCompletePayment = (payment: Payment) => {
    return true; // Разрешаем отмечать платежи без обязательной загрузки чеков
  };

  const regeneratePaymentSchedule = async () => {
    if (!user || !clientId) return;
    
    // Подтверждение действия
    if (!confirm('Вы уверены, что хотите пересоздать график платежей? Даты всех невыполненных платежей будут обновлены согласно полю "День платежа".')) {
      return;
    }

    setLoading(true);
    try {
      // Удаляем только невыполненные платежи
      const { error: deleteError } = await supabase
        .from('payments')
        .delete()
        .eq('client_id', clientId)
        .eq('is_completed', false);

      if (deleteError) {
        console.error('Ошибка удаления платежей:', deleteError);
        toast.error('Ошибка удаления старых платежей');
        return;
      }

      // Получаем выполненные платежи для определения следующего порядкового номера
      const { data: completedPayments } = await supabase
        .from('payments')
        .select('payment_number')
        .eq('client_id', clientId)
        .eq('is_completed', true)
        .order('payment_number', { ascending: false })
        .limit(1);

      const lastCompletedNumber = completedPayments?.[0]?.payment_number ?? -1;
      
      // Создаем новые платежи начиная со следующего номера после последнего выполненного
      const paymentsToCreate = [];
      const startDate = new Date(contractDate);
      const remainingPayments = installmentPeriod - (lastCompletedNumber >= 0 ? lastCompletedNumber : 0);

      // Если первый платеж еще не выполнен, создаем его
      if (lastCompletedNumber < 0) {
        paymentsToCreate.push({
          client_id: clientId,
          user_id: user.id,
          payment_number: 0,
          original_amount: firstPayment,
          due_date: startDate.toISOString().split('T')[0],
          payment_type: 'first'
        });
      }

      // Создаем ежемесячные платежи
      for (let i = Math.max(1, lastCompletedNumber + 1); i <= installmentPeriod; i++) {
        const paymentDate = new Date(startDate);
        paymentDate.setMonth(startDate.getMonth() + i);
        
        // Получаем последний день месяца для проверки
        const lastDayOfMonth = new Date(paymentDate.getFullYear(), paymentDate.getMonth() + 1, 0).getDate();
        
        // Устанавливаем день платежа, но не больше последнего дня месяца
        const actualPaymentDay = Math.min(paymentDay, lastDayOfMonth);
        paymentDate.setDate(actualPaymentDay);
        
        paymentsToCreate.push({
          client_id: clientId,
          user_id: user.id,
          payment_number: i,
          original_amount: monthlyPayment,
          due_date: paymentDate.toISOString().split('T')[0],
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
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {payments.map((payment) => {
            const currentAmount = payment.custom_amount ?? payment.original_amount;
            const paymentType = payment.payment_type === 'first' ? 'Первый платеж' : `Платеж ${payment.payment_number}`;
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