import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday, isBefore, isAfter, addDays } from "date-fns";
import { ru } from "date-fns/locale";

interface Payment {
  id: string;
  client_id: string;
  due_date: string;
  custom_amount: number | null;
  original_amount: number;
  is_completed: boolean;
  payment_type: string;
  client_name?: string;
}

export const PaymentsCalendar = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPayments();
  }, [currentMonth]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          id,
          client_id,
          due_date,
          custom_amount,
          original_amount,
          is_completed,
          payment_type,
          clients!inner(full_name)
        `)
        .gte('due_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('due_date', format(monthEnd, 'yyyy-MM-dd'))
        .order('due_date', { ascending: true });

      if (paymentsError) throw paymentsError;

      const formattedPayments = paymentsData?.map((p: any) => ({
        ...p,
        client_name: p.clients?.full_name || 'Неизвестно'
      })) || [];

      setPayments(formattedPayments);
    } catch (error) {
      console.error('Ошибка при загрузке платежей:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPaymentsForDate = (date: Date) => {
    return payments.filter(p => isSameDay(new Date(p.due_date), date));
  };

  const getDateStatus = (date: Date) => {
    const datePayments = getPaymentsForDate(date);
    if (datePayments.length === 0) return null;

    const today = new Date();
    const hasOverdue = datePayments.some(p => !p.is_completed && isBefore(new Date(p.due_date), today));
    const hasUpcoming = datePayments.some(p => !p.is_completed && isAfter(new Date(p.due_date), today) && isBefore(new Date(p.due_date), addDays(today, 7)));
    const hasDueToday = datePayments.some(p => !p.is_completed && isSameDay(new Date(p.due_date), today));

    if (hasOverdue) return 'overdue';
    if (hasDueToday) return 'due-today';
    if (hasUpcoming) return 'upcoming';
    return 'scheduled';
  };

  const previousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  
  // Определяем день недели первого дня месяца (0 = воскресенье, нужно преобразовать к 1 = понедельник)
  const firstDayOfWeek = (monthStart.getDay() + 6) % 7;
  const emptyDays = Array(firstDayOfWeek).fill(null);

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'overdue':
        return 'bg-red-500/20 border-red-500';
      case 'due-today':
        return 'bg-orange-500/20 border-orange-500';
      case 'upcoming':
        return 'bg-yellow-500/20 border-yellow-500';
      case 'scheduled':
        return 'bg-green-500/20 border-green-500';
      default:
        return 'bg-muted';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Календарь платежей</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={previousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium min-w-[200px] text-center">
              {format(currentMonth, 'LLLL yyyy', { locale: ru })}
            </span>
            <Button variant="outline" size="sm" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex gap-4 mt-4 flex-wrap">
          <Badge variant="outline" className="bg-red-500/20 border-red-500">
            Просроченные
          </Badge>
          <Badge variant="outline" className="bg-orange-500/20 border-orange-500">
            Сегодня
          </Badge>
          <Badge variant="outline" className="bg-yellow-500/20 border-yellow-500">
            Приближающиеся (7 дней)
          </Badge>
          <Badge variant="outline" className="bg-green-500/20 border-green-500">
            Запланированные
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Загрузка...
          </div>
        ) : (
          <div className="space-y-2">
            {/* Дни недели */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {weekDays.map(day => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Дни месяца */}
            <div className="grid grid-cols-7 gap-2">
              {emptyDays.map((_, idx) => (
                <div key={`empty-${idx}`} className="aspect-square" />
              ))}
              {daysInMonth.map(day => {
                const status = getDateStatus(day);
                const dayPayments = getPaymentsForDate(day);
                const statusColor = getStatusColor(status);

                return (
                  <div
                    key={day.toISOString()}
                    className={`aspect-square border rounded-lg p-2 relative ${statusColor} ${
                      isToday(day) ? 'ring-2 ring-primary' : ''
                    }`}
                  >
                    <div className="text-sm font-medium">
                      {format(day, 'd')}
                    </div>
                    {dayPayments.length > 0 && (
                      <div className="absolute bottom-1 left-1 right-1">
                        <div className="text-xs font-bold text-center">
                          {dayPayments.length}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
