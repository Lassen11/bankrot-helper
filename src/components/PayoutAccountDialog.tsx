import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Loader2, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const ACCOUNT_OPTIONS = [
  "Зайнаб карта",
  "Касса офис Диана",
  "Мариана Карта - депозит",
  "Карта Visa/Т-Банк (КИ)",
  "Наличные",
  "Сейф (КИ)",
  "Расчетный счет"
];

interface PayoutAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (account: string, amount: number, date: Date) => void;
  agentName: string;
  title: string;
  amount: number;
  date: Date | null;
  isLoading?: boolean;
  showAccountSelect?: boolean;
}

export const PayoutAccountDialog = ({
  open,
  onOpenChange,
  onConfirm,
  agentName,
  title,
  amount: initialAmount,
  date: initialDate,
  isLoading = false,
  showAccountSelect = true
}: PayoutAccountDialogProps) => {
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [amount, setAmount] = useState<number>(initialAmount);
  const [date, setDate] = useState<Date | undefined>(initialDate || undefined);

  // Reset state when dialog opens with new values
  useEffect(() => {
    if (open) {
      setAmount(initialAmount);
      setDate(initialDate || undefined);
      setSelectedAccount('');
    }
  }, [open, initialAmount, initialDate]);

  const handleConfirm = () => {
    if (date && (showAccountSelect ? selectedAccount : true)) {
      onConfirm(selectedAccount, amount, date);
    }
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      setSelectedAccount('');
      setAmount(initialAmount);
      setDate(initialDate || undefined);
    }
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Агент:</span>
              <span className="font-medium">{agentName}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Сумма *</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="Введите сумму"
            />
          </div>

          <div className="space-y-2">
            <Label>Дата *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'dd.MM.yyyy', { locale: ru }) : 'Выберите дату'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  locale={ru}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {showAccountSelect && (
            <div className="space-y-2">
              <Label htmlFor="account">Счёт *</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите счёт" />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_OPTIONS.map((account) => (
                    <SelectItem key={account} value={account}>
                      {account}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Отмена
          </Button>
          <Button onClick={handleConfirm} disabled={(showAccountSelect && !selectedAccount) || !date || amount <= 0 || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Сохранение...
              </>
            ) : (
              'Подтвердить'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
