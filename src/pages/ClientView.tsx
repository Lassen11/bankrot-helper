import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaymentProgress } from "@/components/PaymentProgress";
import { PaymentSchedule } from "@/components/PaymentSchedule";
import { ReceiptManager } from "@/components/ReceiptManager";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Edit, Save, X } from "lucide-react";
import { Link } from "react-router-dom";

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
  created_at: string;
  updated_at: string;
}

export default function ClientView() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    deposit_paid: 0,
  });
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
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        toast.error('Ошибка при загрузке данных клиента');
        return;
      }

      setClient(data);
      setEditData({
        deposit_paid: data.deposit_paid || 0,
      });
      
      // Рассчитываем количество оставшихся месяцев на основе остатка к оплате
      const totalPaidAmount = (data.total_paid || 0) + (data.deposit_paid || 0);
      const remainingAmount = Math.max(0, data.contract_amount - totalPaidAmount);
      const monthsRemaining = data.monthly_payment > 0 ? Math.ceil(remainingAmount / data.monthly_payment) : 0;
      setRemainingPayments(monthsRemaining);
      
      // Рассчитываем дату завершения на основе остатка к оплате
      const completion = calculateCompletionDate(
        data.contract_amount,
        data.total_paid || 0,
        data.deposit_paid || 0,
        data.monthly_payment
      );
      setCompletionDate(completion);
    } catch (error) {
      toast.error('Произошла ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!client) return;

    try {
      // Рассчитываем новый остаток с учетом депозита
      const totalPaidAmount = (client.total_paid || 0) + editData.deposit_paid;
      const newRemainingAmount = Math.max(0, client.contract_amount - totalPaidAmount);
      
      const { error } = await supabase
        .from('clients')
        .update({
          deposit_paid: editData.deposit_paid,
          remaining_amount: newRemainingAmount,
        })
        .eq('id', client.id);

      if (error) {
        toast.error('Ошибка при сохранении');
        return;
      }

      // Пересчитываем дату завершения и оставшиеся месяцы
      const monthsRemaining = client.monthly_payment > 0 ? Math.ceil(newRemainingAmount / client.monthly_payment) : 0;
      setRemainingPayments(monthsRemaining);
      
      const newCompletionDate = calculateCompletionDate(
        client.contract_amount,
        client.total_paid || 0,
        editData.deposit_paid,
        client.monthly_payment
      );
      setCompletionDate(newCompletionDate);

      toast.success('Данные сохранены');
      setIsEditing(false);
      await fetchClient();
    } catch (error) {
      toast.error('Произошла ошибка при сохранении');
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

  const getPaymentStatus = (remaining: number, total: number) => {
    if (remaining <= 0) {
      return { text: "Оплачено", variant: "default" as const, color: "bg-green-500" };
    } else if (remaining < total * 0.5) {
      return { text: "Почти готово", variant: "secondary" as const, color: "bg-yellow-500" };
    } else {
      return { text: "В процессе", variant: "outline" as const, color: "bg-blue-500" };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
        <div className="container mx-auto max-w-4xl">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
        <div className="container mx-auto max-w-4xl">
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-muted-foreground">Клиент не найден</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const paymentStatus = getPaymentStatus(client.remaining_amount, client.contract_amount);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
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
              <p className="text-muted-foreground">
                Договор от {new Date(client.created_at).toLocaleDateString('ru-RU')}
              </p>
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
                depositTarget={client.deposit_target || 50000}
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
                <div>
                  <span className="text-muted-foreground">Завершение процедуры:</span>
                  <p className="font-semibold">{completionDate.toLocaleDateString('ru-RU')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Schedule */}
          <PaymentSchedule
            clientId={client.id}
            contractAmount={client.contract_amount}
            firstPayment={client.first_payment}
            monthlyPayment={client.monthly_payment}
            installmentPeriod={client.installment_period}
            paymentDay={client.payment_day}
            createdAt={client.created_at}
            onRemainingPaymentsChange={(remaining, completion) => {
              setRemainingPayments(remaining);
              setCompletionDate(completion);
            }}
            onPaymentUpdate={() => {
              // Перезагружаем данные клиента после обновления платежа
              fetchClient();
            }}
          />

          {/* Receipt Manager */}
          <ReceiptManager 
            clientId={client.id} 
            onReceiptsChange={() => {
              // Обновляем график платежей при изменении количества чеков
              fetchClient();
            }} 
          />

          {/* Payment Management */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Управление платежами</CardTitle>
                {!isEditing ? (
                  <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
                    <Edit className="h-4 w-4 mr-2" />
                    Редактировать
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button onClick={handleSave} size="sm">
                      <Save className="h-4 w-4 mr-2" />
                      Сохранить
                    </Button>
                     <Button 
                      onClick={() => {
                        setIsEditing(false);
                        setEditData({
                          deposit_paid: client.deposit_paid || 0,
                        });
                      }} 
                      variant="outline" 
                      size="sm"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Отмена
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="deposit_paid">Внесенная сумма депозита (₽)</Label>
                  <Input
                    id="deposit_paid"
                    type="number"
                    step="0.01"
                    min="0"
                    value={isEditing ? editData.deposit_paid : client.deposit_paid || 0}
                    onChange={(e) => setEditData(prev => ({ 
                      ...prev, 
                      deposit_paid: parseFloat(e.target.value) || 0 
                    }))}
                    readOnly={!isEditing}
                    className={!isEditing ? "bg-muted cursor-default" : ""}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}