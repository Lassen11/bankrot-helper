import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ClientFormProps {
  onClientAdded: () => void;
}

export const ClientForm = ({ onClientAdded }: ClientFormProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    contractAmount: "",
    installmentPeriod: "",
    firstPayment: "",
    remainingAmount: ""
  });

  // Автоматический расчет ежемесячного платежа
  const calculateMonthlyPayment = () => {
    const contractAmount = parseFloat(formData.contractAmount) || 0;
    const firstPayment = parseFloat(formData.firstPayment) || 0;
    const installmentPeriod = parseInt(formData.installmentPeriod) || 1;
    
    return (contractAmount - firstPayment) / installmentPeriod;
  };

  // Автоматический расчет остатка к оплате
  const calculateRemainingAmount = () => {
    const contractAmount = parseFloat(formData.contractAmount) || 0;
    const firstPayment = parseFloat(formData.firstPayment) || 0;
    
    return contractAmount - firstPayment;
  };

  const monthlyPayment = calculateMonthlyPayment();
  const remainingAmount = calculateRemainingAmount();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('clients')
        .insert([
          {
            full_name: formData.fullName,
            contract_amount: parseFloat(formData.contractAmount),
            installment_period: parseInt(formData.installmentPeriod),
            first_payment: parseFloat(formData.firstPayment),
            monthly_payment: monthlyPayment,
            remaining_amount: remainingAmount,
            total_paid: 0,
            deposit_paid: 0,
            deposit_target: 50000
          }
        ]);

      if (error) throw error;

      toast({
        title: "Успешно",
        description: "Клиент успешно добавлен",
      });

      setFormData({
        fullName: "",
        contractAmount: "",
        installmentPeriod: "",
        firstPayment: "",
        remainingAmount: ""
      });

      onClientAdded();
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-primary">Добавить нового клиента</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="fullName">ФИО</Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={(e) => handleInputChange("fullName", e.target.value)}
              placeholder="Введите полное имя"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contractAmount">Сумма договора (₽)</Label>
              <Input
                id="contractAmount"
                type="number"
                step="0.01"
                min="0"
                value={formData.contractAmount}
                onChange={(e) => handleInputChange("contractAmount", e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <Label htmlFor="installmentPeriod">Срок рассрочки (мес.)</Label>
              <Input
                id="installmentPeriod"
                type="number"
                min="1"
                value={formData.installmentPeriod}
                onChange={(e) => handleInputChange("installmentPeriod", e.target.value)}
                placeholder="12"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstPayment">Первый платеж (₽)</Label>
              <Input
                id="firstPayment"
                type="number"
                step="0.01"
                min="0"
                value={formData.firstPayment}
                onChange={(e) => handleInputChange("firstPayment", e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <Label htmlFor="monthlyPayment">Ежемесячный платеж (₽)</Label>
              <div className="relative">
                <Input
                  id="monthlyPayment"
                  type="text"
                  value={monthlyPayment > 0 ? monthlyPayment.toFixed(2) : "0.00"}
                  readOnly
                  className="bg-muted cursor-default"
                  placeholder="Рассчитывается автоматически"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground">
                  авто
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                (Сумма договора - Первый платеж) ÷ Месяцы рассрочки
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="remainingAmount">Остаток к оплате (₽)</Label>
            <div className="relative">
              <Input
                id="remainingAmount"
                type="text"
                value={remainingAmount > 0 ? remainingAmount.toFixed(2) : "0.00"}
                readOnly
                className="bg-muted cursor-default"
                placeholder="Рассчитывается автоматически"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground">
                авто
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Сумма договора - Первый платеж
            </p>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? "Добавляем..." : "Добавить клиента"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};