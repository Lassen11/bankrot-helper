import { useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Plus, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface AddPaymentDialogProps {
  clientId: string;
  onPaymentAdded: () => void;
  existingPaymentsCount: number;
}

export function AddPaymentDialog({ 
  clientId, 
  onPaymentAdded,
  existingPaymentsCount 
}: AddPaymentDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState<Date>();
  const [description, setDescription] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || !dueDate || !user) {
      toast.error("Заполните все обязательные поля");
      return;
    }

    const amountNumber = parseFloat(amount);
    if (isNaN(amountNumber) || amountNumber <= 0) {
      toast.error("Введите корректную сумму");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("payments")
        .insert({
          client_id: clientId,
          user_id: user.id,
          payment_number: existingPaymentsCount + 1,
          original_amount: amountNumber,
          due_date: format(dueDate, "yyyy-MM-dd"),
          payment_type: "additional",
          is_completed: false,
          account: description || null,
        });

      if (error) throw error;

      toast.success("Дополнительный платёж добавлен");
      setOpen(false);
      setAmount("");
      setDueDate(undefined);
      setDescription("");
      onPaymentAdded();
    } catch (error: any) {
      console.error("Error adding payment:", error);
      toast.error("Ошибка при добавлении платежа");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Добавить платёж
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Добавить дополнительный платёж</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Сумма *</Label>
            <Input
              id="amount"
              type="number"
              placeholder="Введите сумму"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="0.01"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label>Дата платежа *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "dd MMMM yyyy", { locale: ru }) : "Выберите дату"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                  locale={ru}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Описание / Счёт</Label>
            <Input
              id="description"
              placeholder="Например: Дополнительные услуги"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Добавление..." : "Добавить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
