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
    remainingAmount: "",
    paymentDay: "1",
    contractDate: new Date().toISOString().split('T')[0] // Today's date as default
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
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Ошибка",
          description: "Необходимо войти в систему",
          variant: "destructive"
        });
        return;
      }

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
            deposit_target: 50000,
            payment_day: parseInt(formData.paymentDay),
            contract_date: formData.contractDate,
            user_id: user.id
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
        remainingAmount: "",
        paymentDay: "1",
        contractDate: new Date().toISOString().split('T')[0]
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

          <div>
            <Label htmlFor="contractDate">Дата заключения договора</Label>
            <Input
              id="contractDate"
              type="date"
              value={formData.contractDate}
              onChange={(e) => handleInputChange("contractDate", e.target.value)}
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
              <Label htmlFor="paymentDay">День ежемесячного платежа</Label>
              <Input
                id="paymentDay"
                type="number"
                min="1"
                max="31"
                value={formData.paymentDay}
                onChange={(e) => handleInputChange("paymentDay", e.target.value)}
                placeholder="1"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                День месяца для ежемесячного платежа (1-31)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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