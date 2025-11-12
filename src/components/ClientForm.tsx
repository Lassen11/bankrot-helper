import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import React from "react";

interface ClientFormProps {
  onClientAdded: () => void;
}

interface Employee {
  id: string;
  full_name: string;
}

export const ClientForm = ({ onClientAdded }: ClientFormProps) => {
  const { toast } = useToast();
  const { isAdmin } = useUserRole();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [formData, setFormData] = useState({
    fullName: "",
    city: "",
    source: "",
    manager: "",
    contractAmount: "",
    installmentPeriod: "",
    firstPayment: "",
    monthlyPayment: "",
    remainingAmount: "",
    paymentDay: "1",
    contractDate: new Date().toISOString().split('T')[0], // Today's date as default
    employeeId: ""
  });

  // Загружаем список сотрудников для админов
  React.useEffect(() => {
    if (isAdmin) {
      const fetchEmployees = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .order('full_name');
        
        if (!error && data) {
          setEmployees(data.map(profile => ({ 
            id: profile.user_id, 
            full_name: profile.full_name || 'Без имени' 
          })));
        }
      };
      
      fetchEmployees();
    }
  }, [isAdmin]);

  // Автоматический расчет суммы договора из ежемесячного платежа
  const calculateContractAmount = () => {
    const monthlyPayment = parseFloat(formData.monthlyPayment) || 0;
    const firstPayment = parseFloat(formData.firstPayment) || 0;
    const installmentPeriod = parseInt(formData.installmentPeriod) || 1;
    
    if (monthlyPayment > 0) {
      return firstPayment + (monthlyPayment * installmentPeriod);
    }
    return parseFloat(formData.contractAmount) || 0;
  };

  // Автоматический расчет ежемесячного платежа из суммы договора
  const calculateMonthlyPayment = () => {
    const contractAmount = parseFloat(formData.contractAmount) || 0;
    const firstPayment = parseFloat(formData.firstPayment) || 0;
    const installmentPeriod = parseInt(formData.installmentPeriod) || 1;
    
    if (contractAmount > 0 && !formData.monthlyPayment) {
      return (contractAmount - firstPayment) / installmentPeriod;
    }
    return parseFloat(formData.monthlyPayment) || 0;
  };

  // Автоматический расчет остатка к оплате
  const calculateRemainingAmount = () => {
    const contractAmount = calculateContractAmount();
    const firstPayment = parseFloat(formData.firstPayment) || 0;
    
    return contractAmount - firstPayment;
  };

  const contractAmount = calculateContractAmount();
  const monthlyPayment = calculateMonthlyPayment();
  const remainingAmount = calculateRemainingAmount();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Если меняется сумма договора, очищаем ежемесячный платеж
      if (field === 'contractAmount') {
        updated.monthlyPayment = '';
      }
      // Если меняется ежемесячный платеж, очищаем сумму договора
      if (field === 'monthlyPayment') {
        updated.contractAmount = '';
      }
      
      return updated;
    });
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

      // Определяем сотрудника для клиента
      let employeeId = user.id; // По умолчанию текущий пользователь
      if (isAdmin && formData.employeeId) {
        employeeId = formData.employeeId;
      }

      const { error } = await supabase
        .from('clients')
        .insert([
          {
            full_name: formData.fullName,
            city: formData.city,
            source: formData.source,
            manager: formData.manager,
            contract_amount: contractAmount,
            installment_period: parseInt(formData.installmentPeriod),
            first_payment: parseFloat(formData.firstPayment),
            monthly_payment: monthlyPayment,
            remaining_amount: remainingAmount,
            total_paid: 0,
            deposit_paid: 0,
            deposit_target: 50000,
            payment_day: parseInt(formData.paymentDay),
            contract_date: formData.contractDate,
            user_id: user.id,
            employee_id: employeeId
          }
        ]);

      if (error) throw error;

      // Отправляем данные в pnltracker
      try {
        await supabase.functions.invoke('send-to-pnltracker', {
          body: {
            event_type: 'new_client',
            client_name: formData.fullName,
            contract_amount: contractAmount,
            first_payment: parseFloat(formData.firstPayment),
            date: formData.contractDate,
            income_account: 'Расчетный счет',
            company: 'Спасение',
            user_id: user.id,
            description: `Договор на сумму ${contractAmount.toFixed(2)} ₽`
          }
        });
        console.log('Client data sent to pnltracker');
      } catch (webhookError) {
        console.error('Error sending to pnltracker:', webhookError);
        // Не показываем ошибку пользователю, так как клиент уже создан
      }

      toast({
        title: "Успешно",
        description: "Клиент успешно добавлен",
      });

      setFormData({
        fullName: "",
        city: "",
        source: "",
        manager: "",
        contractAmount: "",
        installmentPeriod: "",
        firstPayment: "",
        monthlyPayment: "",
        remainingAmount: "",
        paymentDay: "1",
        contractDate: new Date().toISOString().split('T')[0],
        employeeId: ""
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
              <Label htmlFor="city">Город</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => handleInputChange("city", e.target.value)}
                placeholder="Введите город"
              />
            </div>

            <div>
              <Label htmlFor="source">Источник</Label>
              <Select 
                value={formData.source} 
                onValueChange={(value) => handleInputChange("source", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите источник" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Авито">Авито</SelectItem>
                  <SelectItem value="Сайт">Сайт</SelectItem>
                  <SelectItem value="Квиз">Квиз</SelectItem>
                  <SelectItem value="Рекомендация Руководителя">Рекомендация Руководителя</SelectItem>
                  <SelectItem value="Рекомендация ОЗ">Рекомендация ОЗ</SelectItem>
                  <SelectItem value="Рекомендация менеджера">Рекомендация менеджера</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="manager">Менеджер</Label>
            <Select 
              value={formData.manager} 
              onValueChange={(value) => handleInputChange("manager", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите менеджера" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Рамазан Самурханов">Рамазан Самурханов</SelectItem>
              </SelectContent>
            </Select>
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
                placeholder="Рассчитается автоматически"
                disabled={!!formData.monthlyPayment}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {formData.monthlyPayment ? "Рассчитано из ежемесячного платежа" : "Или введите ежемесячный платеж"}
            </p>
          </div>

          {isAdmin && employees.length > 0 && (
            <div>
              <Label htmlFor="employeeId">Назначить сотрудника</Label>
              <Select 
                value={formData.employeeId} 
                onValueChange={(value) => handleInputChange("employeeId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите сотрудника" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Если не выбран, клиент будет привязан к вам
              </p>
            </div>
          )}

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
              <Input
                id="monthlyPayment"
                type="number"
                step="0.01"
                min="0"
                value={formData.monthlyPayment}
                onChange={(e) => handleInputChange("monthlyPayment", e.target.value)}
                placeholder="Рассчитается автоматически"
                disabled={!!formData.contractAmount}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formData.contractAmount ? "Рассчитано из суммы договора" : "Или введите сумму договора"}
              </p>
            </div>

            <div>
              <Label htmlFor="calculatedAmount">Рассчитанные значения</Label>
              <div className="space-y-2 p-3 bg-muted rounded-md">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Сумма договора:</span>
                  <span className="font-medium">{contractAmount > 0 ? contractAmount.toFixed(2) : "0.00"} ₽</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ежемесячный платеж:</span>
                  <span className="font-medium">{monthlyPayment > 0 ? monthlyPayment.toFixed(2) : "0.00"} ₽</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Остаток к оплате:</span>
                  <span className="font-medium">{remainingAmount > 0 ? remainingAmount.toFixed(2) : "0.00"} ₽</span>
                </div>
              </div>
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