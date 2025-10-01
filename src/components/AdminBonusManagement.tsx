import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';

interface EmployeeBonusData {
  employee_id: string;
  employee_name: string;
  reviews_count: number;
  agents_count: number;
  completedClients: number;
  totalPayments: number;
  clientsTotal: number;
}

export const AdminBonusManagement = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [employeeBonuses, setEmployeeBonuses] = useState<EmployeeBonusData[]>([]);
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>((currentDate.getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState<string>(currentDate.getFullYear().toString());

  const baseSalary = 30000;

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Получаем всех сотрудников
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('role', 'employee');

      if (!userRoles) return;

      // Получаем имена сотрудников
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name');

      const employeeMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

      // Период для расчета
      const startDate = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1);
      const endDate = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0);

      const bonusData: EmployeeBonusData[] = [];

      for (const role of userRoles) {
        // Получаем бонусные данные
        const { data: bonusRecord } = await supabase
          .from('employee_bonuses')
          .select('*')
          .eq('employee_id', role.user_id)
          .eq('month', parseInt(selectedMonth))
          .eq('year', parseInt(selectedYear))
          .maybeSingle();

        // Получаем статистику платежей
        const { data: paymentsData } = await supabase
          .from('payments')
          .select('client_id, custom_amount, original_amount, is_completed')
          .eq('user_id', role.user_id)
          .gte('due_date', startDate.toISOString().split('T')[0])
          .lte('due_date', endDate.toISOString().split('T')[0])
          .neq('payment_number', 0);

        const completedPayments = paymentsData?.filter(p => p.is_completed) || [];
        const uniqueClients = new Set(completedPayments.map(p => p.client_id));
        const totalPayments = completedPayments.reduce((sum, p) => 
          sum + Number(p.custom_amount || p.original_amount || 0), 0
        );

        // Получаем общее количество клиентов
        const { data: clientsData } = await supabase
          .from('clients')
          .select('id')
          .eq('employee_id', role.user_id);

        bonusData.push({
          employee_id: role.user_id,
          employee_name: employeeMap.get(role.user_id) || 'Не указано',
          reviews_count: bonusRecord?.reviews_count || 0,
          agents_count: bonusRecord?.agents_count || 0,
          completedClients: uniqueClients.size,
          totalPayments,
          clientsTotal: clientsData?.length || 0,
        });
      }

      setEmployeeBonuses(bonusData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Ошибка при загрузке данных');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (employeeId: string, reviews: number, agents: number) => {
    try {
      setSaving(employeeId);

      const { error } = await supabase
        .from('employee_bonuses')
        .upsert({
          employee_id: employeeId,
          month: parseInt(selectedMonth),
          year: parseInt(selectedYear),
          reviews_count: reviews,
          agents_count: agents,
        }, {
          onConflict: 'employee_id,month,year'
        });

      if (error) throw error;

      toast.success('Данные сохранены');
      await fetchData();
    } catch (error) {
      console.error('Error saving bonus data:', error);
      toast.error('Ошибка при сохранении данных');
    } finally {
      setSaving(null);
    }
  };

  const calculatePerformanceBonus = (data: EmployeeBonusData) => {
    if (data.clientsTotal === 0) return 0;

    const clientsPercent = (data.completedClients / data.clientsTotal) * 100;
    const paymentsPercent = Math.min((data.totalPayments / (data.clientsTotal * 50000)) * 100, 100);
    const averagePercent = (clientsPercent + paymentsPercent) / 2;

    if (data.employee_name === 'Алина Васильева' && averagePercent >= 90) {
      return 10000;
    } else if (data.employee_name === 'Гури Шейхова') {
      if (averagePercent >= 90) return 25000;
      if (averagePercent >= 80) return 15000;
    }

    return 0;
  };

  const calculateReviewsBonus = (reviewsCount: number) => {
    return reviewsCount >= 5 ? 5000 : 0;
  };

  const calculateAgentsBonus = (agentsCount: number) => {
    return agentsCount * 3000;
  };

  const updateEmployeeBonus = (employeeId: string, field: 'reviews_count' | 'agents_count', value: number) => {
    setEmployeeBonuses(prev => prev.map(emp => 
      emp.employee_id === employeeId 
        ? { ...emp, [field]: value }
        : emp
    ));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Фильтр по периоду */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm font-medium">Период:</span>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Выберите месяц" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Январь</SelectItem>
                <SelectItem value="2">Февраль</SelectItem>
                <SelectItem value="3">Март</SelectItem>
                <SelectItem value="4">Апрель</SelectItem>
                <SelectItem value="5">Май</SelectItem>
                <SelectItem value="6">Июнь</SelectItem>
                <SelectItem value="7">Июль</SelectItem>
                <SelectItem value="8">Август</SelectItem>
                <SelectItem value="9">Сентябрь</SelectItem>
                <SelectItem value="10">Октябрь</SelectItem>
                <SelectItem value="11">Ноябрь</SelectItem>
                <SelectItem value="12">Декабрь</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Год" />
              </SelectTrigger>
              <SelectContent>
                {[2023, 2024, 2025, 2026, 2027].map(year => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Список сотрудников с премиями */}
      {employeeBonuses.map((employee) => {
        const clientsPercent = employee.clientsTotal > 0 
          ? ((employee.completedClients / employee.clientsTotal) * 100).toFixed(1)
          : '0.0';
        const paymentsPercent = employee.clientsTotal > 0 
          ? Math.min((employee.totalPayments / (employee.clientsTotal * 50000)) * 100, 100).toFixed(1)
          : '0.0';
        const averagePercent = ((Number(clientsPercent) + Number(paymentsPercent)) / 2).toFixed(1);

        const performanceBonus = calculatePerformanceBonus(employee);
        const reviewsBonus = calculateReviewsBonus(employee.reviews_count);
        const agentsBonus = calculateAgentsBonus(employee.agents_count);
        const totalBonus = performanceBonus + reviewsBonus + agentsBonus;
        const totalSalary = baseSalary + totalBonus;

        return (
          <Card key={employee.employee_id}>
            <CardHeader>
              <CardTitle>{employee.employee_name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Оклад */}
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Оклад:</span>
                  <span className="text-lg font-bold">{baseSalary.toLocaleString()} ₽</span>
                </div>
              </div>

              {/* Показатели эффективности */}
              <div className="space-y-3">
                <h3 className="font-semibold">Показатели эффективности</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground">Оплаченные клиенты</div>
                    <div className="text-xl font-bold">{employee.completedClients} / {employee.clientsTotal}</div>
                    <div className="text-sm text-muted-foreground">{clientsPercent}%</div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground">Сумма платежей</div>
                    <div className="text-xl font-bold">{employee.totalPayments.toLocaleString()} ₽</div>
                    <div className="text-sm text-muted-foreground">{paymentsPercent}%</div>
                  </div>
                </div>
                <div className="p-3 bg-primary/10 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Средний процент:</span>
                    <span className="text-lg font-bold">{averagePercent}%</span>
                  </div>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex justify-between items-center">
                    <span>Бонус за эффективность:</span>
                    <span className="text-lg font-bold text-green-600">+{performanceBonus.toLocaleString()} ₽</span>
                  </div>
                </div>
              </div>

              {/* Отзывы клиентов */}
              <div className="space-y-3">
                <h3 className="font-semibold">Отзывы клиентов</h3>
                <div className="space-y-2">
                  <Label htmlFor={`reviews-${employee.employee_id}`}>Количество отзывов</Label>
                  <Input
                    id={`reviews-${employee.employee_id}`}
                    type="number"
                    min="0"
                    value={employee.reviews_count}
                    onChange={(e) => updateEmployeeBonus(employee.employee_id, 'reviews_count', parseInt(e.target.value) || 0)}
                  />
                  <div className="text-sm text-muted-foreground">
                    Бонус: +5000 ₽ за 5+ отзывов
                  </div>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex justify-between items-center">
                    <span>Бонус за отзывы:</span>
                    <span className="text-lg font-bold text-green-600">+{reviewsBonus.toLocaleString()} ₽</span>
                  </div>
                </div>
              </div>

              {/* Агенты */}
              <div className="space-y-3">
                <h3 className="font-semibold">Агенты</h3>
                <div className="space-y-2">
                  <Label htmlFor={`agents-${employee.employee_id}`}>Количество агентов</Label>
                  <Input
                    id={`agents-${employee.employee_id}`}
                    type="number"
                    min="0"
                    value={employee.agents_count}
                    onChange={(e) => updateEmployeeBonus(employee.employee_id, 'agents_count', parseInt(e.target.value) || 0)}
                  />
                  <div className="text-sm text-muted-foreground">
                    Бонус: +3000 ₽ за каждого агента
                  </div>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex justify-between items-center">
                    <span>Бонус за агентов:</span>
                    <span className="text-lg font-bold text-green-600">+{agentsBonus.toLocaleString()} ₽</span>
                  </div>
                </div>
              </div>

              {/* Итоговая зарплата */}
              <div className="pt-4 border-t space-y-3">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Общая премия:</span>
                    <span className="text-lg font-bold text-green-600">+{totalBonus.toLocaleString()} ₽</span>
                  </div>
                </div>
                <div className="p-4 bg-primary/20 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Итоговая зарплата:</span>
                    <span className="text-2xl font-bold">{totalSalary.toLocaleString()} ₽</span>
                  </div>
                </div>
              </div>

              <Button 
                onClick={() => handleSave(employee.employee_id, employee.reviews_count, employee.agents_count)} 
                disabled={saving === employee.employee_id}
                className="w-full"
              >
                {saving === employee.employee_id ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Сохранить данные
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
