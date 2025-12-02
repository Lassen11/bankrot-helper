import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format, addMonths, setDate } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Phone, User, Link, Calendar, Banknote, CheckCircle2, Clock } from 'lucide-react';

interface Agent {
  id: string;
  employee_id: string;
  agent_full_name: string;
  agent_phone: string;
  recommendation_name: string | null;
  lead_link: string | null;
  mop_name: string | null;
  client_category: string | null;
  first_payment_date: string | null;
  reward_amount: number;
  remaining_payment: number;
  first_payment_amount: number;
  payment_month_1: number;
  payment_month_2: number;
  payment_month_3: number;
  payment_month_1_completed: boolean;
  payment_month_2_completed: boolean;
  payment_month_3_completed: boolean;
  payout_1: number;
  payout_2: number;
  payout_3: number;
  payout_1_completed: boolean;
  payout_2_completed: boolean;
  payout_3_completed: boolean;
}

interface AgentDetailsDialogProps {
  agent: Agent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AgentDetailsDialog = ({ agent, open, onOpenChange }: AgentDetailsDialogProps) => {
  if (!agent) return null;

  const calculatePaymentDate = (firstPaymentDate: string | null, monthOffset: number): Date | null => {
    if (!firstPaymentDate) return null;
    const date = new Date(firstPaymentDate);
    return addMonths(date, monthOffset);
  };

  const calculatePayoutDate = (firstPaymentDate: string | null, monthOffset: number): Date | null => {
    if (!firstPaymentDate) return null;
    const date = new Date(firstPaymentDate);
    const nextMonth = addMonths(date, 1 + monthOffset);
    return setDate(nextMonth, 3);
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return '-';
    return format(date, 'dd.MM.yyyy', { locale: ru });
  };

  const paymentDate1 = calculatePaymentDate(agent.first_payment_date, 1);
  const paymentDate2 = calculatePaymentDate(agent.first_payment_date, 2);
  const paymentDate3 = calculatePaymentDate(agent.first_payment_date, 3);
  
  const payoutDate1 = calculatePayoutDate(agent.first_payment_date, 0);
  const payoutDate2 = calculatePayoutDate(agent.first_payment_date, 1);
  const payoutDate3 = calculatePayoutDate(agent.first_payment_date, 2);

  const totalPayments = Number(agent.payment_month_1 || 0) + Number(agent.payment_month_2 || 0) + Number(agent.payment_month_3 || 0);
  const completedPayments = (agent.payment_month_1_completed ? Number(agent.payment_month_1 || 0) : 0) +
    (agent.payment_month_2_completed ? Number(agent.payment_month_2 || 0) : 0) +
    (agent.payment_month_3_completed ? Number(agent.payment_month_3 || 0) : 0);

  const totalPayouts = Number(agent.payout_1 || 0) + Number(agent.payout_2 || 0) + Number(agent.payout_3 || 0);
  const completedPayouts = (agent.payout_1_completed ? Number(agent.payout_1 || 0) : 0) +
    (agent.payout_2_completed ? Number(agent.payout_2 || 0) : 0) +
    (agent.payout_3_completed ? Number(agent.payout_3 || 0) : 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {agent.agent_full_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Основная информация */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" /> Телефон
              </p>
              <p className="font-medium">{agent.agent_phone}</p>
            </div>
            {agent.recommendation_name && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">ФИО рекомендации</p>
                <p className="font-medium">{agent.recommendation_name}</p>
              </div>
            )}
            {agent.mop_name && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">ФИО МОП</p>
                <p className="font-medium">{agent.mop_name}</p>
              </div>
            )}
            {agent.client_category && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Категория клиента</p>
                <Badge variant="secondary">{agent.client_category}</Badge>
              </div>
            )}
            {agent.lead_link && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Link className="h-3 w-3" /> Ссылка на лид
                </p>
                <a href={agent.lead_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate block">
                  {agent.lead_link}
                </a>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Дата первого платежа
              </p>
              <p className="font-medium">
                {agent.first_payment_date
                  ? new Date(agent.first_payment_date).toLocaleDateString('ru-RU')
                  : '-'}
              </p>
            </div>
          </div>

          <Separator />

          {/* Финансовая информация */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <p className="text-sm text-muted-foreground">Вознаграждение</p>
              <p className="text-xl font-bold">{Number(agent.reward_amount || 0).toLocaleString()} ₽</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <p className="text-sm text-muted-foreground">Первый платеж</p>
              <p className="text-xl font-bold">{Number(agent.first_payment_amount || 0).toLocaleString()} ₽</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <p className="text-sm text-muted-foreground">Остаток</p>
              <p className="text-xl font-bold">{Number(agent.remaining_payment || 0).toLocaleString()} ₽</p>
            </div>
          </div>

          <Separator />

          {/* Платежи клиента */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                Платежи клиента
              </h3>
              <span className="text-sm text-muted-foreground">
                {completedPayments.toLocaleString()} / {totalPayments.toLocaleString()} ₽
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className={`p-3 rounded-lg border ${agent.payment_month_1_completed ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' : 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Платеж 1</span>
                  {agent.payment_month_1_completed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Clock className="h-4 w-4 text-amber-600" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{formatDate(paymentDate1)}</p>
                <p className="font-bold">{Number(agent.payment_month_1 || 0).toLocaleString()} ₽</p>
              </div>
              <div className={`p-3 rounded-lg border ${agent.payment_month_2_completed ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' : 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Платеж 2</span>
                  {agent.payment_month_2_completed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Clock className="h-4 w-4 text-amber-600" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{formatDate(paymentDate2)}</p>
                <p className="font-bold">{Number(agent.payment_month_2 || 0).toLocaleString()} ₽</p>
              </div>
              <div className={`p-3 rounded-lg border ${agent.payment_month_3_completed ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' : 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Платеж 3</span>
                  {agent.payment_month_3_completed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Clock className="h-4 w-4 text-amber-600" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{formatDate(paymentDate3)}</p>
                <p className="font-bold">{Number(agent.payment_month_3 || 0).toLocaleString()} ₽</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Выплаты агенту */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                Выплаты агенту
              </h3>
              <span className="text-sm text-muted-foreground">
                {completedPayouts.toLocaleString()} / {totalPayouts.toLocaleString()} ₽
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className={`p-3 rounded-lg border ${agent.payout_1_completed ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' : 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Выплата 1</span>
                  {agent.payout_1_completed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Clock className="h-4 w-4 text-amber-600" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{formatDate(payoutDate1)}</p>
                <p className="font-bold">{Number(agent.payout_1 || 0).toLocaleString()} ₽</p>
              </div>
              <div className={`p-3 rounded-lg border ${agent.payout_2_completed ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' : 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Выплата 2</span>
                  {agent.payout_2_completed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Clock className="h-4 w-4 text-amber-600" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{formatDate(payoutDate2)}</p>
                <p className="font-bold">{Number(agent.payout_2 || 0).toLocaleString()} ₽</p>
              </div>
              <div className={`p-3 rounded-lg border ${agent.payout_3_completed ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' : 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Выплата 3</span>
                  {agent.payout_3_completed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Clock className="h-4 w-4 text-amber-600" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{formatDate(payoutDate3)}</p>
                <p className="font-bold">{Number(agent.payout_3 || 0).toLocaleString()} ₽</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
