import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';

const ACCOUNTS = [
  "Сбербанк",
  "Альфа",
  "Тинькофф",
  "Сейф (КИ)",
  "Расчетный счет"
];

interface PayoutAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (account: string) => void;
  agentName: string;
  payoutNumber: 1 | 2 | 3;
  amount: number;
  date: Date | null;
  isLoading?: boolean;
}

export const PayoutAccountDialog = ({
  open,
  onOpenChange,
  onConfirm,
  agentName,
  payoutNumber,
  amount,
  date,
  isLoading = false
}: PayoutAccountDialogProps) => {
  const [selectedAccount, setSelectedAccount] = useState<string>('');

  const handleConfirm = () => {
    if (selectedAccount) {
      onConfirm(selectedAccount);
      setSelectedAccount('');
    }
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      setSelectedAccount('');
    }
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Выплата агенту</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Агент:</span>
              <span className="font-medium">{agentName}</span>
              
              <span className="text-muted-foreground">Выплата:</span>
              <span className="font-medium">№{payoutNumber}</span>
              
              <span className="text-muted-foreground">Сумма:</span>
              <span className="font-medium text-green-600">{amount.toLocaleString()} ₽</span>
              
              <span className="text-muted-foreground">Дата:</span>
              <span className="font-medium">
                {date ? format(date, 'dd.MM.yyyy', { locale: ru }) : '-'}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account">Счёт для выплаты *</Label>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите счёт" />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNTS.map((account) => (
                  <SelectItem key={account} value={account}>
                    {account}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Отмена
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedAccount || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Сохранение...
              </>
            ) : (
              'Подтвердить выплату'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
