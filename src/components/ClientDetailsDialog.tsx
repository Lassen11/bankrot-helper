import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Calendar, CreditCard, User, CalendarIcon, Check, X, Pencil, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Client {
  id: string;
  full_name: string;
  contract_amount: number;
  total_paid: number;
  remaining_amount: number;
  deposit_paid: number;
  deposit_target: number;
  first_payment: number;
  monthly_payment: number;
  installment_period: number;
  payment_day: number;
  contract_date: string;
  employee_id: string;
  created_at: string;
  updated_at: string;
}

interface Payment {
  id: string;
  payment_number: number;
  original_amount: number;
  custom_amount: number;
  due_date: string;
  is_completed: boolean;
  completed_at: string;
  payment_type: string;
}

interface ClientDetailsDialogProps {
  clientId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ClientDetailsDialog = ({ clientId, open, onOpenChange }: ClientDetailsDialogProps) => {
  const [client, setClient] = useState<Client | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [employeeName, setEmployeeName] = useState<string>("");
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<Date | undefined>(undefined);
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [editedClient, setEditedClient] = useState<Partial<Client>>({});
  const [editedContractDate, setEditedContractDate] = useState<Date | undefined>(undefined);
  const [editMode, setEditMode] = useState<'contract' | 'monthly'>('contract');
  const { toast } = useToast();

  useEffect(() => {
    if (open && clientId) {
      fetchClientDetails();
    }
  }, [open, clientId]);

  const fetchClientDetails = async () => {
    if (!clientId) return;

    setLoading(true);
    try {
      // Получаем данные клиента
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (clientError) throw clientError;

      // Получаем информацию о сотруднике
      if (clientData.employee_id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', clientData.employee_id)
          .single();
        
        setEmployeeName(profileData?.full_name || 'Не указан');
      } else {
        setEmployeeName('Не указан');
      }

      // Получаем платежи клиента
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .eq('client_id', clientId)
        .order('payment_number', { ascending: true });

      if (paymentsError) throw paymentsError;

      setClient(clientData);
      setPayments(paymentsData || []);
    } catch (error) {
      console.error('Ошибка при загрузке данных клиента:', error);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU');
  };

  const getPaymentProgress = () => {
    if (!client) return 0;
    return Math.round((client.total_paid / client.contract_amount) * 100);
  };

  const getPaymentStatus = (totalPaid: number, contractAmount: number) => {
    const percentage = (totalPaid / contractAmount) * 100;
    if (percentage >= 100) return { label: "Полностью оплачено", variant: "default" as const };
    if (percentage >= 50) return { label: "Частично оплачено", variant: "secondary" as const };
    return { label: "Начальный этап", variant: "outline" as const };
  };

  const startEditingDate = (paymentId: string, currentDate: string) => {
    setEditingDateId(paymentId);
    setEditDate(new Date(currentDate));
  };

  const saveCustomDate = async (paymentId: string) => {
    if (!editDate) return;

    try {
      const { error } = await supabase
        .from('payments')
        .update({ due_date: format(editDate, 'yyyy-MM-dd') })
        .eq('id', paymentId);

      if (error) throw error;

      setPayments(payments.map(p => 
        p.id === paymentId ? { ...p, due_date: format(editDate, 'yyyy-MM-dd') } : p
      ));

      toast({
        title: "Успешно",
        description: "Дата платежа обновлена",
      });

      setEditingDateId(null);
      setEditDate(undefined);
    } catch (error) {
      console.error('Error updating payment date:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось обновить дату платежа",
        variant: "destructive"
      });
    }
  };

  const cancelEditingDate = () => {
    setEditingDateId(null);
    setEditDate(undefined);
  };

  const startEditingClient = () => {
    if (!client) return;
    setEditedClient({
      full_name: client.full_name,
      contract_amount: client.contract_amount,
      first_payment: client.first_payment,
      monthly_payment: client.monthly_payment,
      installment_period: client.installment_period,
      payment_day: client.payment_day,
      deposit_target: client.deposit_target,
      contract_date: client.contract_date
    });
    setEditedContractDate(new Date(client.contract_date));
    setEditMode('contract');
    setIsEditingClient(true);
  };

  const calculateFromMonthlyPayment = () => {
    if (!editedClient.monthly_payment || !editedClient.first_payment || !editedClient.installment_period) {
      return editedClient.contract_amount || 0;
    }
    return editedClient.first_payment + (editedClient.monthly_payment * editedClient.installment_period);
  };

  const calculateFromContractAmount = () => {
    if (!editedClient.contract_amount || !editedClient.first_payment || !editedClient.installment_period) {
      return editedClient.monthly_payment || 0;
    }
    return (editedClient.contract_amount - editedClient.first_payment) / editedClient.installment_period;
  };

  const handleContractAmountChange = (value: number) => {
    setEditMode('contract');
    setEditedClient({ 
      ...editedClient, 
      contract_amount: value,
      monthly_payment: undefined
    });
  };

  const handleMonthlyPaymentChange = (value: number) => {
    setEditMode('monthly');
    setEditedClient({ 
      ...editedClient, 
      monthly_payment: value,
      contract_amount: undefined
    });
  };

  const saveClientEdits = async () => {
    if (!client || !clientId) return;

    try {
      const contractDateChanged = editedContractDate && 
        format(editedContractDate, 'yyyy-MM-dd') !== client.contract_date;

      // Рассчитываем финальные значения в зависимости от режима редактирования
      const finalContractAmount = editMode === 'monthly' 
        ? calculateFromMonthlyPayment() 
        : editedClient.contract_amount;
      const finalMonthlyPayment = editMode === 'contract' 
        ? calculateFromContractAmount() 
        : editedClient.monthly_payment;

      const updateData = {
        ...editedClient,
        contract_amount: finalContractAmount,
        monthly_payment: finalMonthlyPayment,
        contract_date: editedContractDate ? format(editedContractDate, 'yyyy-MM-dd') : client.contract_date
      };

      const { error } = await supabase
        .from('clients')
        .update(updateData)
        .eq('id', clientId);

      if (error) throw error;

      // Если дата создания изменилась, пересоздаем график платежей
      if (contractDateChanged) {
        await regeneratePaymentSchedule();
      }

      setClient({ ...client, ...updateData });
      setIsEditingClient(false);
      
      toast({
        title: "Успешно",
        description: contractDateChanged 
          ? "Данные клиента обновлены, график платежей пересоздан" 
          : "Данные клиента обновлены",
      });

      // Обновляем данные клиента
      await fetchClientDetails();
    } catch (error) {
      console.error('Error updating client:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось обновить данные клиента",
        variant: "destructive"
      });
    }
  };

  const regeneratePaymentSchedule = async () => {
    if (!client || !clientId || !editedContractDate) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      // Удаляем все существующие платежи
      const { error: deleteError } = await supabase
        .from('payments')
        .delete()
        .eq('client_id', clientId);

      if (deleteError) throw deleteError;

      // Создаем новый график платежей
      const paymentsToCreate = [];
      const startDate = new Date(editedContractDate);
      
      // Первый платеж
      paymentsToCreate.push({
        client_id: clientId,
        user_id: user.id,
        payment_number: 0,
        original_amount: editedClient.first_payment || client.first_payment,
        due_date: startDate.toISOString().split('T')[0],
        payment_type: 'first'
      });

      // Ежемесячные платежи
      const period = editedClient.installment_period || client.installment_period;
      const monthlyAmount = editedClient.monthly_payment || client.monthly_payment;
      const payDay = editedClient.payment_day || client.payment_day;

      for (let i = 1; i <= period; i++) {
        const paymentDate = new Date(startDate);
        paymentDate.setMonth(startDate.getMonth() + i);
        paymentDate.setDate(payDay);
        
        if (paymentDate.getDate() !== payDay) {
          paymentDate.setDate(0);
        }
        
        paymentsToCreate.push({
          client_id: clientId,
          user_id: user.id,
          payment_number: i,
          original_amount: monthlyAmount,
          due_date: paymentDate.toISOString().split('T')[0],
          payment_type: 'monthly'
        });
      }

      const { error: insertError } = await supabase
        .from('payments')
        .insert(paymentsToCreate);

      if (insertError) throw insertError;

      // Сбрасываем total_paid и deposit_paid
      const { error: resetError } = await supabase
        .from('clients')
        .update({ 
          total_paid: 0, 
          deposit_paid: 0,
          remaining_amount: editedClient.contract_amount || client.contract_amount
        })
        .eq('id', clientId);

      if (resetError) throw resetError;

    } catch (error) {
      console.error('Error regenerating payment schedule:', error);
      throw error;
    }
  };

  const cancelEditingClient = () => {
    setIsEditingClient(false);
    setEditedClient({});
    setEditedContractDate(undefined);
  };

  if (!client && !loading) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Информация о клиенте
            </div>
            {!isEditingClient ? (
              <Button variant="outline" size="sm" onClick={startEditingClient}>
                <Pencil className="h-4 w-4 mr-2" />
                Редактировать
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="default" size="sm" onClick={saveClientEdits}>
                  <Save className="h-4 w-4 mr-2" />
                  Сохранить
                </Button>
                <Button variant="outline" size="sm" onClick={cancelEditingClient}>
                  <X className="h-4 w-4 mr-2" />
                  Отмена
                </Button>
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="text-muted-foreground">Загрузка данных клиента...</div>
          </div>
        ) : client ? (
          <div className="space-y-6">
            {/* Основная информация */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div>
                    {isEditingClient ? (
                      <Input
                        value={editedClient.full_name || ''}
                        onChange={(e) => setEditedClient({ ...editedClient, full_name: e.target.value })}
                        className="text-xl font-bold"
                      />
                    ) : (
                      <div>{client.full_name}</div>
                    )}
                    <div className="text-sm font-normal text-muted-foreground mt-1">
                      Ответственный сотрудник: {employeeName}
                    </div>
                  </div>
                  <Badge variant={getPaymentStatus(client.total_paid || 0, client.contract_amount).variant}>
                    {getPaymentStatus(client.total_paid || 0, client.contract_amount).label}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Сумма договора</p>
                    {isEditingClient ? (
                      <div>
                        <Input
                          type="number"
                          value={editMode === 'contract' ? (editedClient.contract_amount || '') : calculateFromMonthlyPayment().toFixed(2)}
                          onChange={(e) => handleContractAmountChange(parseFloat(e.target.value))}
                          disabled={editMode === 'monthly'}
                        />
                        {editMode === 'monthly' && (
                          <p className="text-xs text-muted-foreground mt-1">Рассчитано из ежемесячного платежа</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-lg font-semibold text-green-600">
                        {formatAmount(client.contract_amount)}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Оплачено</p>
                    <p className="text-lg font-semibold text-blue-600">
                      {formatAmount(client.total_paid || 0)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Остаток</p>
                    <p className="text-lg font-semibold text-orange-600">
                      {formatAmount(client.remaining_amount || 0)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Прогресс</p>
                    <p className="text-lg font-semibold">
                      {getPaymentProgress()}%
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Первый взнос</p>
                    {isEditingClient ? (
                      <Input
                        type="number"
                        value={editedClient.first_payment || ''}
                        onChange={(e) => setEditedClient({ ...editedClient, first_payment: parseFloat(e.target.value) })}
                      />
                    ) : (
                      <p className="font-medium">{formatAmount(client.first_payment)}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Ежемесячный платеж</p>
                    {isEditingClient ? (
                      <div>
                        <Input
                          type="number"
                          value={editMode === 'monthly' ? (editedClient.monthly_payment || '') : calculateFromContractAmount().toFixed(2)}
                          onChange={(e) => handleMonthlyPaymentChange(parseFloat(e.target.value))}
                          disabled={editMode === 'contract'}
                        />
                        {editMode === 'contract' && (
                          <p className="text-xs text-muted-foreground mt-1">Рассчитано из суммы договора</p>
                        )}
                      </div>
                    ) : (
                      <p className="font-medium">{formatAmount(client.monthly_payment)}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Период рассрочки</p>
                    {isEditingClient ? (
                      <Input
                        type="number"
                        value={editedClient.installment_period || ''}
                        onChange={(e) => setEditedClient({ ...editedClient, installment_period: parseInt(e.target.value) })}
                      />
                    ) : (
                      <p className="font-medium">{client.installment_period} мес.</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">День платежа</p>
                    {isEditingClient ? (
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        value={editedClient.payment_day || ''}
                        onChange={(e) => setEditedClient({ ...editedClient, payment_day: parseInt(e.target.value) })}
                      />
                    ) : (
                      <p className="font-medium">{client.payment_day} число</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Депозит оплачен</p>
                    <p className="font-medium">{formatAmount(client.deposit_paid || 0)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Цель депозита</p>
                    {isEditingClient ? (
                      <Input
                        type="number"
                        value={editedClient.deposit_target || ''}
                        onChange={(e) => setEditedClient({ ...editedClient, deposit_target: parseFloat(e.target.value) })}
                      />
                    ) : (
                      <p className="font-medium">{formatAmount(client.deposit_target || 0)}</p>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Дата договора
                    </p>
                    {isEditingClient ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "justify-start text-left font-normal",
                              !editedContractDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {editedContractDate ? format(editedContractDate, 'dd.MM.yyyy') : "Выберите дату"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={editedContractDate}
                            onSelect={setEditedContractDate}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <p className="font-medium">{formatDate(client.contract_date)}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Последнее обновление
                    </p>
                    <p className="font-medium">{formatDateTime(client.updated_at)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* История платежей */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  История платежей ({payments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    Платежи не найдены
                  </div>
                ) : (
                  <div className="space-y-2">
                    {payments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="space-y-1 flex-1">
                          <p className="font-medium">
                            Платеж #{payment.payment_number} 
                            <span className="text-sm text-muted-foreground ml-2">
                              ({payment.payment_type === 'first' ? 'Первый взнос' : 
                                payment.payment_type === 'deposit' ? 'Депозит' : 'Ежемесячный'})
                            </span>
                          </p>
                          <div className="flex items-center gap-2">
                            {editingDateId === payment.id ? (
                              <div className="flex items-center gap-2">
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className={cn(
                                        "justify-start text-left font-normal",
                                        !editDate && "text-muted-foreground"
                                      )}
                                    >
                                      <CalendarIcon className="mr-2 h-4 w-4" />
                                      {editDate ? format(editDate, "dd.MM.yyyy") : "Выберите дату"}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <CalendarComponent
                                      mode="single"
                                      selected={editDate}
                                      onSelect={setEditDate}
                                      initialFocus
                                      className={cn("p-3 pointer-events-auto")}
                                    />
                                  </PopoverContent>
                                </Popover>
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => saveCustomDate(payment.id)}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={cancelEditingDate}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <p className="text-sm text-muted-foreground">
                                  Срок: {formatDate(payment.due_date)}
                                </p>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => startEditingDate(payment.id, payment.due_date)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-medium">
                              {formatAmount(payment.custom_amount || payment.original_amount)}
                            </p>
                            {payment.custom_amount && payment.custom_amount !== payment.original_amount && (
                              <p className="text-xs text-muted-foreground line-through">
                                {formatAmount(payment.original_amount)}
                              </p>
                            )}
                          </div>
                          <Badge variant={payment.is_completed ? "default" : "outline"}>
                            {payment.is_completed ? "Оплачено" : "Ожидает"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};