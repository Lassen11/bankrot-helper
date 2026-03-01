import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BankruptcyTimeline } from "@/components/BankruptcyTimeline";
import { CabinetChatClient } from "@/components/CabinetChatClient";
import { supabase } from "@/integrations/supabase/client";

interface Stage {
  id: string;
  stage_number: number;
  title: string;
  description: string;
  is_completed: boolean;
  completed_at: string | null;
}

interface CabinetData {
  client: { id: string; full_name: string; contract_date: string };
  stages: Stage[];
}

export default function ClientCabinet() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<CabinetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  const progressPercent = Math.round((completedCount / data.stages.length) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
      <div className="container mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <Card>
          <CardHeader className="text-center pb-2">
            <p className="text-sm text-muted-foreground uppercase tracking-wider">
              Кабинет клиента
            </p>
            <CardTitle className="text-2xl">{data.client.full_name}</CardTitle>
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

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Этапы процедуры банкротства</CardTitle>
          </CardHeader>
          <CardContent>
            <BankruptcyTimeline stages={data.stages} />
          </CardContent>
        </Card>

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
    </div>
  );
}
