import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PaymentScheduleProps {
  contractAmount: number;
  firstPayment: number;
  monthlyPayment: number;
  installmentPeriod: number;
  createdAt: string;
}

export const PaymentSchedule = ({
  contractAmount,
  firstPayment,
  monthlyPayment,
  installmentPeriod,
  createdAt
}: PaymentScheduleProps) => {
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const generateSchedule = () => {
    const schedule = [];
    const startDate = new Date(createdAt);
    
    // Первый платеж
    schedule.push({
      date: startDate,
      amount: firstPayment,
      type: 'Первый платеж'
    });

    // Ежемесячные платежи
    for (let i = 1; i <= installmentPeriod; i++) {
      const paymentDate = new Date(startDate);
      paymentDate.setMonth(startDate.getMonth() + i);
      
      schedule.push({
        date: paymentDate,
        amount: monthlyPayment,
        type: `Платеж ${i}`
      });
    }

    return schedule;
  };

  const schedule = generateSchedule();

  return (
    <Card>
      <CardHeader>
        <CardTitle>График платежей</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {schedule.map((payment, index) => (
            <div key={index} className="flex justify-between items-center py-2 border-b border-border/50 last:border-b-0">
              <div>
                <span className="text-sm font-medium">{payment.type}</span>
                <p className="text-xs text-muted-foreground">
                  {payment.date.toLocaleDateString('ru-RU')}
                </p>
              </div>
              <span className="font-semibold">{formatAmount(payment.amount)}</span>
            </div>
          ))}
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