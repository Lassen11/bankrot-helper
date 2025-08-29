import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { useState } from "react";

interface PaymentScheduleProps {
  contractAmount: number;
  firstPayment: number;
  monthlyPayment: number;
  installmentPeriod: number;
  createdAt: string;
  onRemainingPaymentsChange?: (remaining: number, completionDate: Date) => void;
}

export const PaymentSchedule = ({
  contractAmount,
  firstPayment,
  monthlyPayment,
  installmentPeriod,
  createdAt,
  onRemainingPaymentsChange
}: PaymentScheduleProps) => {
  const [completedPayments, setCompletedPayments] = useState<Set<number>>(new Set());
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
      id: 0,
      date: startDate,
      amount: firstPayment,
      type: 'Первый платеж'
    });

    // Ежемесячные платежи
    for (let i = 1; i <= installmentPeriod; i++) {
      const paymentDate = new Date(startDate);
      paymentDate.setMonth(startDate.getMonth() + i);
      
      schedule.push({
        id: i,
        date: paymentDate,
        amount: monthlyPayment,
        type: `Платеж ${i}`
      });
    }

    return schedule;
  };

  const schedule = generateSchedule();
  const remainingPayments = schedule.length - completedPayments.size;
  
  const getCompletionDate = () => {
    if (remainingPayments === 0) return new Date();
    
    const lastUncompletedPayment = schedule
      .filter(payment => !completedPayments.has(payment.id))
      .sort((a, b) => b.date.getTime() - a.date.getTime())[0];
    
    return lastUncompletedPayment ? lastUncompletedPayment.date : new Date();
  };

  const togglePayment = (paymentId: number) => {
    const newCompleted = new Set(completedPayments);
    if (newCompleted.has(paymentId)) {
      newCompleted.delete(paymentId);
    } else {
      newCompleted.add(paymentId);
    }
    setCompletedPayments(newCompleted);
    
    const newRemaining = schedule.length - newCompleted.size;
    const completionDate = newRemaining === 0 ? new Date() : 
      schedule
        .filter(payment => !newCompleted.has(payment.id))
        .sort((a, b) => b.date.getTime() - a.date.getTime())[0]?.date || new Date();
    
    onRemainingPaymentsChange?.(newRemaining, completionDate);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>График платежей</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {schedule.map((payment) => {
            const isCompleted = completedPayments.has(payment.id);
            return (
              <div 
                key={payment.id} 
                className={`flex justify-between items-center py-2 border-b border-border/50 last:border-b-0 cursor-pointer hover:bg-muted/50 rounded px-2 transition-colors ${
                  isCompleted ? 'opacity-60' : ''
                }`}
                onClick={() => togglePayment(payment.id)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    isCompleted 
                      ? 'bg-primary border-primary text-primary-foreground' 
                      : 'border-muted-foreground'
                  }`}>
                    {isCompleted && <Check className="w-3 h-3" />}
                  </div>
                  <div>
                    <span className={`text-sm font-medium ${isCompleted ? 'line-through' : ''}`}>
                      {payment.type}
                    </span>
                    <p className={`text-xs text-muted-foreground ${isCompleted ? 'line-through' : ''}`}>
                      {payment.date.toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                </div>
                <span className={`font-semibold ${isCompleted ? 'line-through' : ''}`}>
                  {formatAmount(payment.amount)}
                </span>
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