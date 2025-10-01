import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface BonusData {
  reviews_count: number;
  agents_count: number;
}

export const EmployeeBonus = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bonusData, setBonusData] = useState<BonusData>({ reviews_count: 0, agents_count: 0 });
  const [employeeName, setEmployeeName] = useState('');
  const [stats, setStats] = useState({ 
    completedClients: 0, 
    totalPayments: 0,
    clientsTotal: 0,
    totalExpectedAmount: 0
  });

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const baseSalary = 30000;

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Получаем имя сотрудника
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();

      if (profileData) {
        setEmployeeName(profileData.full_name || '');
      }

      // Получаем данные бонусов
      const { data: bonusRecord, error: bonusError } = await supabase
        .from('employee_bonuses')
        .select('*')
        .eq('employee_id', user.id)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .maybeSingle();

      if (bonusError && bonusError.code !== 'PGRST116') {
        console.error('Error fetching bonus data:', bonusError);
      }

      if (bonusRecord) {
        setBonusData({
          reviews_count: bonusRecord.reviews_count || 0,
          agents_count: bonusRecord.agents_count || 0,
        });
      }

      // Получаем статистику платежей
      const startDate = new Date(currentYear, currentMonth - 1, 1);
      const endDate = new Date(currentYear, currentMonth, 0);

      // Получаем ВСЕ платежи за месяц (не только завершенные)
      const { data: allPaymentsData } = await supabase
        .from('payments')
        .select('custom_amount, original_amount, is_completed')
        .eq('user_id', user.id)
        .gte('due_date', startDate.toISOString().split('T')[0])
        .lte('due_date', endDate.toISOString().split('T')[0])
        .neq('payment_number', 0);

      if (allPaymentsData) {
        const completedPayments = allPaymentsData.filter(p => p.is_completed);
        const totalExpectedPayments = allPaymentsData.length;
        const completedPaymentsCount = completedPayments.length;
        const totalCompletedAmount = completedPayments.reduce((sum, p) => 
          sum + Number(p.custom_amount || p.original_amount || 0), 0
        );
        const totalExpectedAmount = allPaymentsData.reduce((sum, p) => 
          sum + Number(p.custom_amount || p.original_amount || 0), 0
        );

        setStats({
          completedClients: completedPaymentsCount,
          totalPayments: totalCompletedAmount,
          clientsTotal: totalExpectedPayments,
          totalExpectedAmount: totalExpectedAmount,
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Ошибка при загрузке данных');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from('employee_bonuses')
        .upsert({
          employee_id: user.id,
          month: currentMonth,
          year: currentYear,
          reviews_count: bonusData.reviews_count,
          agents_count: bonusData.agents_count,
        }, {
          onConflict: 'employee_id,month,year'
        });

      if (error) throw error;

      toast.success('Данные сохранены');
    } catch (error) {
      console.error('Error saving bonus data:', error);
      toast.error('Ошибка при сохранении данных');
    } finally {
      setSaving(false);
    }
  };

  const calculatePerformanceBonus = () => {
    if (stats.clientsTotal === 0) return 0;

    const paymentsCountPercent = (stats.completedClients / stats.clientsTotal) * 100;
    const expectedAmount = stats.clientsTotal * 50000;
    const paymentsAmountPercent = expectedAmount > 0
      ? Math.min((stats.totalPayments / expectedAmount) * 100, 100)
      : 0;
    const averagePercent = (paymentsCountPercent + paymentsAmountPercent) / 2;

    // Специальные бонусы для конкретных сотрудников
    if (employeeName === 'Алина Васильева' && averagePercent >= 90) {
      return 10000;
    } else if (employeeName === 'Гури Шейхова') {
      if (averagePercent >= 90) return 25000;
      if (averagePercent >= 80) return 15000;
    }

    return 0;
  };

  const calculateReviewsBonus = () => {
    return bonusData.reviews_count >= 5 ? 5000 : 0;
  };

  const calculateAgentsBonus = () => {
    return bonusData.agents_count * 3000;
  };

  const totalBonus = calculatePerformanceBonus() + calculateReviewsBonus() + calculateAgentsBonus();
  const totalSalary = baseSalary + totalBonus;

  const paymentsCountPercent = stats.clientsTotal > 0 
    ? ((stats.completedClients / stats.clientsTotal) * 100).toFixed(1)
    : '0.0';
  const paymentsAmountPercent = stats.totalExpectedAmount > 0 
    ? Math.min((stats.totalPayments / stats.totalExpectedAmount) * 100, 100).toFixed(1)
    : '0.0';
  const averagePercent = ((Number(paymentsCountPercent) + Number(paymentsAmountPercent)) / 2).toFixed(1);

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
    <Card>
      <CardHeader>
        <CardTitle>Премия</CardTitle>
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
              <div className="text-sm text-muted-foreground">Количество платежей</div>
              <div className="text-xl font-bold">{stats.completedClients} / {stats.clientsTotal}</div>
              <div className="text-sm text-muted-foreground">{paymentsCountPercent}%</div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Сумма платежей</div>
              <div className="text-xl font-bold">{stats.totalPayments.toLocaleString()} ₽</div>
              <div className="text-sm text-muted-foreground">{paymentsAmountPercent}%</div>
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
              <span className="text-lg font-bold text-green-600">+{calculatePerformanceBonus().toLocaleString()} ₽</span>
            </div>
          </div>
        </div>

        {/* Отзывы клиентов */}
        <div className="space-y-3">
          <h3 className="font-semibold">Отзывы клиентов</h3>
          <div className="space-y-2">
            <Label htmlFor="reviews">Количество отзывов</Label>
            <Input
              id="reviews"
              type="number"
              min="0"
              value={bonusData.reviews_count}
              onChange={(e) => setBonusData({ ...bonusData, reviews_count: parseInt(e.target.value) || 0 })}
            />
            <div className="text-sm text-muted-foreground">
              Бонус: +5000 ₽ за 5+ отзывов
            </div>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex justify-between items-center">
              <span>Бонус за отзывы:</span>
              <span className="text-lg font-bold text-green-600">+{calculateReviewsBonus().toLocaleString()} ₽</span>
            </div>
          </div>
        </div>

        {/* Агенты */}
        <div className="space-y-3">
          <h3 className="font-semibold">Агенты</h3>
          <div className="space-y-2">
            <Label htmlFor="agents">Количество агентов</Label>
            <Input
              id="agents"
              type="number"
              min="0"
              value={bonusData.agents_count}
              onChange={(e) => setBonusData({ ...bonusData, agents_count: parseInt(e.target.value) || 0 })}
            />
            <div className="text-sm text-muted-foreground">
              Бонус: +3000 ₽ за каждого агента
            </div>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex justify-between items-center">
              <span>Бонус за агентов:</span>
              <span className="text-lg font-bold text-green-600">+{calculateAgentsBonus().toLocaleString()} ₽</span>
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

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Сохранить данные
        </Button>
      </CardContent>
    </Card>
  );
};