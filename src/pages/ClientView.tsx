import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaymentProgress } from "@/components/PaymentProgress";
import { PaymentSchedule } from "@/components/PaymentSchedule";
import { ReceiptManager } from "@/components/ReceiptManager";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
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
  contract_date: string;
  employee_id: string;
  created_at: string;
  updated_at: string;
}
export default function ClientView() {
  const {
    id
  } = useParams<{
    id: string;
  }>();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [remainingPayments, setRemainingPayments] = useState(0);
  const [completionDate, setCompletionDate] = useState<Date>(new Date());
  useEffect(() => {
    if (id) {
      fetchClient();
    }
  }, [id]);

  // Функция для расчета даты завершения на основе остатка к оплате
  const calculateCompletionDate = (contractAmount: number, totalPaid: number, depositPaid: number, monthlyPayment: number) => {
    const totalPaidAmount = (totalPaid || 0) + (depositPaid || 0);
    const remainingAmount = Math.max(0, contractAmount - totalPaidAmount);
    if (remainingAmount <= 0 || monthlyPayment <= 0) {
      return new Date(); // Уже оплачено
    }
    const monthsRemaining = Math.ceil(remainingAmount / monthlyPayment);
    const completionDate = new Date();
    completionDate.setMonth(completionDate.getMonth() + monthsRemaining);
    return completionDate;
  };
  const fetchClient = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('clients').select('*').eq('id', id).single();
      if (error) {
        toast.error('Ошибка при загрузке данных клиента');
        return;
      }
      setClient(data);

      // Рассчитываем количество оставшихся месяцев на основе остатка к оплате
      const totalPaidAmount = (data.total_paid || 0) + (data.deposit_paid || 0);
      const remainingAmount = Math.max(0, data.contract_amount - totalPaidAmount);
      const monthsRemaining = data.monthly_payment > 0 ? Math.ceil(remainingAmount / data.monthly_payment) : 0;
      setRemainingPayments(monthsRemaining);

      // Рассчитываем дату завершения на основе остатка к оплате
      const completion = calculateCompletionDate(data.contract_amount, data.total_paid || 0, data.deposit_paid || 0, data.monthly_payment);
      setCompletionDate(completion);
    } catch (error) {
      toast.error('Произошла ошибка');
    } finally {
      setLoading(false);
    }
  };
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  const getPaymentStatus = (remaining: number, total: number) => {
    if (remaining <= 0) {
      return {
        text: "Оплачено",
        variant: "default" as const,
        color: "bg-green-500"
      };
    } else if (remaining < total * 0.5) {
      return {
        text: "Почти готово",
        variant: "secondary" as const,
        color: "bg-yellow-500"
      };
    } else {
      return {
        text: "В процессе",
        variant: "outline" as const,
        color: "bg-blue-500"
      };
    }
  };
  if (loading) {
    return <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
        <div className="container mx-auto max-w-4xl">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </div>;
  }
  if (!client) {
    return <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
        <div className="container mx-auto max-w-4xl">
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-muted-foreground">Клиент не найден</p>
            </CardContent>
          </Card>
        </div>
      </div>;
  }
  const paymentStatus = getPaymentStatus(client.remaining_amount, client.contract_amount);
  return <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
      <div className="container mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">{client.full_name}</h1>
            </div>
          </div>
          <Badge variant={paymentStatus.variant}>
            <div className={`w-2 h-2 rounded-full ${paymentStatus.color} mr-2`}></div>
            {paymentStatus.text}
          </Badge>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Payment Progress */}
          <Card>
            <CardHeader>
              <CardTitle>Прогресс платежей</CardTitle>
            </CardHeader>
            <CardContent>
              <PaymentProgress 
                totalPaid={client.total_paid || 0} 
                contractAmount={client.contract_amount} 
                depositPaid={client.deposit_paid || 0} 
                depositTarget={client.deposit_target || 70000} 
              />
            </CardContent>
          </Card>

          {/* Contract Details */}
          <Card>
            <CardHeader>
              <CardTitle>Детали договора</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Сумма договора:</span>
                  <p className="font-semibold">{formatAmount(client.contract_amount)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Первый платеж:</span>
                  <p className="font-semibold">{formatAmount(client.first_payment)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Период рассрочки:</span>
                  <p className="font-semibold">{client.installment_period} мес.</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Ежемесячный платеж:</span>
                  <p className="font-semibold">{formatAmount(client.monthly_payment)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Осталось платежей:</span>
                  <p className="font-semibold">{remainingPayments}</p>
                </div>
                
              </div>
            </CardContent>
          </Card>

          {/* Payment Schedule */}
          <PaymentSchedule clientId={client.id} employeeId={client.employee_id} contractAmount={client.contract_amount} firstPayment={client.first_payment} monthlyPayment={client.monthly_payment} installmentPeriod={client.installment_period} paymentDay={client.payment_day} contractDate={client.contract_date} onRemainingPaymentsChange={(remaining, completion) => {
          setRemainingPayments(remaining);
          setCompletionDate(completion);
        }} onPaymentUpdate={() => {
          // Перезагружаем данные клиента после обновления платежа
          fetchClient();
        }} />

          {/* Receipt Manager */}
          <ReceiptManager clientId={client.id} onReceiptsChange={() => {
          // Обновляем график платежей при изменении количества чеков
          fetchClient();
        }} />

          {/* Payment Info */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Информация о платежах</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Сумма депозита (авансовые платежи):</span>
                  <p className="font-semibold">{formatAmount(client.deposit_paid || 0)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Всего оплачено:</span>
                  <p className="font-semibold">{formatAmount(client.total_paid || 0)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Остаток к оплате:</span>
                  <p className="font-semibold">{formatAmount(client.remaining_amount)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Дата договора:</span>
                  <p className="font-semibold">{new Date(client.contract_date).toLocaleDateString('ru-RU')}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                * Сумма депозита рассчитывается автоматически на основе выполненных авансовых платежей
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>;
}