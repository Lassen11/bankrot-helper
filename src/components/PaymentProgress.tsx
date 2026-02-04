import { Progress } from "@/components/ui/progress";

interface PaymentProgressProps {
  totalPaid: number;
  contractAmount: number;
  depositPaid: number;
  depositTarget: number;
}

export const PaymentProgress = ({ 
  totalPaid, 
  contractAmount, 
  depositPaid, 
  depositTarget
}: PaymentProgressProps) => {
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Используем totalPaid для обоих прогрессов (депозит и общий прогресс показывают одну сумму)
  const mainProgress = contractAmount > 0 ? (totalPaid / contractAmount) * 100 : 0;
  const depositProgress = depositTarget > 0 ? (totalPaid / depositTarget) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Депозит */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-medium text-muted-foreground">Депозит</h3>
          <span className="text-sm text-muted-foreground">
            {Math.min(100, Math.round(depositProgress))}%
          </span>
        </div>
        <Progress 
          value={Math.min(100, depositProgress)} 
          className="h-3"
        />
        <div className="flex justify-between text-sm gap-2">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Внесено:</span>
            <span className="text-muted-foreground">{formatAmount(totalPaid)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Цель:</span>
            <span className="text-muted-foreground">{formatAmount(depositTarget)}</span>
          </div>
        </div>
      </div>

      {/* Общие платежи */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-medium text-muted-foreground">Общий прогресс</h3>
          <span className="text-sm text-muted-foreground">
            {Math.round(mainProgress)}%
          </span>
        </div>
        <Progress 
          value={mainProgress} 
          className="h-4"
        />
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Внесено: {formatAmount(totalPaid)}
          </span>
          <span className="text-muted-foreground">
            Всего: {formatAmount(contractAmount)}
          </span>
        </div>
      </div>

      {/* Остаток к оплате */}
      <div className="bg-muted/50 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Остаток к оплате:</span>
          <span className="text-lg font-semibold text-primary">
            {formatAmount(Math.max(0, contractAmount - totalPaid))}
          </span>
        </div>
      </div>
    </div>
  );
};