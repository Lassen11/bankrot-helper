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

  // Общий прогресс учитывает все внесенные платежи (включая депозит)
  // Депозит суммируется с общими платежами
  const totalWithDeposit = (totalPaid || 0) + (depositPaid || 0);
  const mainProgress = contractAmount > 0 ? (totalWithDeposit / contractAmount) * 100 : 0;
  const depositProgress = depositTarget > 0 ? (depositPaid / depositTarget) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Депозит */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-medium text-muted-foreground">Депозит</h3>
          <span className="text-sm text-muted-foreground">
            {Math.round(depositProgress)}%
          </span>
        </div>
        <Progress 
          value={depositProgress} 
          className="h-3"
        />
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Внесено: {formatAmount(depositPaid)}
          </span>
          <span className="text-muted-foreground">
            Цель: {formatAmount(depositTarget)}
          </span>
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
            Внесено: {formatAmount(totalWithDeposit)}
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
            {formatAmount(Math.max(0, contractAmount - totalWithDeposit))}
          </span>
        </div>
      </div>
    </div>
  );
};