import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BankruptcyTimeline } from "@/components/BankruptcyTimeline";
import { CabinetChatClient } from "@/components/CabinetChatClient";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaymentProgress } from "@/components/PaymentProgress";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

interface Stage {
  id: string;
  stage_number: number;
  title: string;
  description: string;
  is_completed: boolean;
  completed_at: string | null;
}

interface EmployeeInfo {
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role_label?: string | null;
}

interface Payment {
  payment_number: number;
  original_amount: number;
  custom_amount: number | null;
  due_date: string;
  is_completed: boolean;
  payment_type: string;
  completed_at: string | null;
}

interface CabinetData {
  client: {
    id: string;
    full_name: string;
    contract_date: string;
    contract_amount: number;
    total_paid: number;
    deposit_paid: number;
    deposit_target: number;
    monthly_payment: number;
    installment_period: number;
    first_payment: number;
    remaining_amount: number;
  };
  stages: Stage[];
  employee: EmployeeInfo | null;
  employees?: EmployeeInfo[];
  payments: Payment[];
}

export default function ClientCabinet() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<CabinetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  useEffect(() => {
    if (token) fetchCabinet();
  }, [token]);

  const fetchCabinet = async () => {
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke(
        "get-client-cabinet",
        { body: { token } }
      );

      if (fnError || result?.error) {
        setError(result?.error || "Не удалось загрузить кабинет");
        return;
      }

      setData(result);
    } catch {
      setError("Произошла ошибка при загрузке");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center">
        <div className="animate-pulse space-y-4 w-full max-w-2xl px-4">
          <div className="h-8 bg-muted rounded w-1/3 mx-auto" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="text-4xl mb-4">🔒</div>
            <h2 className="text-xl font-semibold mb-2">Доступ ограничен</h2>
            <p className="text-muted-foreground">
              {error || "Кабинет не найден. Проверьте правильность ссылки."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const completedCount = data.stages.filter((s) => s.is_completed).length;
  const progressPercent = data.stages.length > 0 ? Math.round((completedCount / data.stages.length) * 100) : 0;

  // Use employees array if available, fallback to single employee
  const specialists: EmployeeInfo[] = data.employees && data.employees.length > 0
    ? data.employees
    : data.employee ? [data.employee] : [];

  const getInitials = (name: string | null) => {
    if (!name) return "??";
    return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-2 sm:p-4">
      <div className="container mx-auto max-w-3xl space-y-4 sm:space-y-6">
        {/* Header */}
        <Card>
          <CardHeader className="text-center pb-2">
            <p className="text-sm text-muted-foreground uppercase tracking-wider">
              Кабинет клиента
            </p>
            <CardTitle className="text-xl sm:text-2xl">{data.client.full_name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Прогресс процедуры</span>
              <span className="font-semibold">
                {completedCount} из {data.stages.length} этапов ({progressPercent}%)
              </span>
            </div>
            <Progress value={progressPercent} className="h-3" />
          </CardContent>
        </Card>

        {/* Specialists cards */}
        {specialists.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">
                {specialists.length === 1 ? "Ваш специалист" : "Ваши специалисты"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {specialists.map((emp, idx) => (
                <div key={idx} className="flex items-center gap-3 sm:gap-4 p-3 rounded-lg bg-muted/40">
                  <Avatar className="h-10 w-10 sm:h-14 sm:w-14">
                    {emp.avatar_url && <AvatarImage src={emp.avatar_url} alt={emp.full_name || ""} />}
                    <AvatarFallback>{getInitials(emp.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{emp.full_name || "Специалист"}</p>
                    {emp.role_label && (
                      <Badge variant="secondary" className="text-xs mb-1">{emp.role_label}</Badge>
                    )}
                    {emp.bio && (
                      <p className="text-sm text-muted-foreground">{emp.bio}</p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Этапы процедуры банкротства</CardTitle>
          </CardHeader>
          <CardContent>
            <BankruptcyTimeline stages={data.stages} />
          </CardContent>
        </Card>

        {/* Payment Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Прогресс платежей</CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentProgress
              totalPaid={data.client.total_paid || 0}
              contractAmount={data.client.contract_amount || 0}
              depositPaid={data.client.deposit_paid || 0}
              depositTarget={data.client.deposit_target || 0}
            />
          </CardContent>
        </Card>

        {/* Contract Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Детали договора</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Сумма договора</p>
                <p className="font-semibold">{formatAmount(data.client.contract_amount)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Дата договора</p>
                <p className="font-semibold">{new Date(data.client.contract_date).toLocaleDateString("ru-RU")}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Период рассрочки</p>
                <p className="font-semibold">{data.client.installment_period} мес.</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ежемесячный платеж</p>
                <p className="font-semibold">{formatAmount(data.client.monthly_payment)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Авансовый платеж</p>
                <p className="font-semibold">{formatAmount(data.client.first_payment)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Остаток к оплате</p>
                <p className="font-semibold text-primary">{formatAmount(data.client.remaining_amount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Schedule */}
        {data.payments && data.payments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">График платежей</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">№</TableHead>
                      <TableHead className="text-xs sm:text-sm">Тип</TableHead>
                      <TableHead className="text-xs sm:text-sm">Дата</TableHead>
                      <TableHead className="text-xs sm:text-sm">Сумма</TableHead>
                      <TableHead className="text-xs sm:text-sm">Статус</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.payments.map((p) => (
                      <TableRow key={p.payment_number}>
                        <TableCell className="text-xs sm:text-sm">{p.payment_number}</TableCell>
                        <TableCell className="text-xs sm:text-sm">{p.payment_type === 'advance' ? 'Аванс' : 'Ежемес.'}</TableCell>
                        <TableCell className="text-xs sm:text-sm">{new Date(p.due_date).toLocaleDateString("ru-RU")}</TableCell>
                        <TableCell className="text-xs sm:text-sm">{formatAmount(p.custom_amount ?? p.original_amount)}</TableCell>
                        <TableCell>
                          <Badge variant={p.is_completed ? "default" : "secondary"} className="text-xs">
                            {p.is_completed ? "Оплачен" : "Ожидает"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Chat */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Чат со специалистом</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <CabinetChatClient token={token!} />
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground pb-4">
          Дата договора:{" "}
          {new Date(data.client.contract_date).toLocaleDateString("ru-RU")}
        </p>
      </div>

      {showScrollTop && (
        <Button
          onClick={scrollToTop}
          size="icon"
          className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg h-10 w-10 sm:hidden"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
