import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Calendar, CreditCard, User, FileText, Phone, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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

  if (!client && !loading) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Информация о клиенте
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
                    <div>{client.full_name}</div>
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
                    <p className="text-lg font-semibold text-green-600">
                      {formatAmount(client.contract_amount)}
                    </p>
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
                    <p className="font-medium">{formatAmount(client.first_payment)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Ежемесячный платеж</p>
                    <p className="font-medium">{formatAmount(client.monthly_payment)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Период рассрочки</p>
                    <p className="font-medium">{client.installment_period} мес.</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">День платежа</p>
                    <p className="font-medium">{client.payment_day} число</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Депозит оплачен</p>
                    <p className="font-medium">{formatAmount(client.deposit_paid || 0)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Цель депозита</p>
                    <p className="font-medium">{formatAmount(client.deposit_target || 0)}</p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Дата создания
                    </p>
                    <p className="font-medium">{formatDateTime(client.created_at)}</p>
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
                        <div className="space-y-1">
                          <p className="font-medium">
                            Платеж #{payment.payment_number} 
                            <span className="text-sm text-muted-foreground ml-2">
                              ({payment.payment_type === 'first' ? 'Первый взнос' : 
                                payment.payment_type === 'deposit' ? 'Депозит' : 'Ежемесячный'})
                            </span>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Срок: {formatDate(payment.due_date)}
                          </p>
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