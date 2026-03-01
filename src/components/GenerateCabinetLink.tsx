import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, ExternalLink, Link2, RefreshCw } from "lucide-react";

const DEFAULT_STAGES = [
  { number: 1, title: "Сбор документов", description: "Сбор и подготовка необходимых документов для процедуры банкротства" },
  { number: 2, title: "Анализ финансового состояния", description: "Анализ доходов, расходов и долговой нагрузки" },
  { number: 3, title: "Подготовка заявления в суд", description: "Составление заявления о признании банкротом" },
  { number: 4, title: "Подача заявления в Арбитражный суд", description: "Подача документов в суд и регистрация дела" },
  { number: 5, title: "Назначение финансового управляющего", description: "Суд назначает финансового управляющего для ведения процедуры" },
  { number: 6, title: "Первое судебное заседание", description: "Рассмотрение дела о банкротстве в суде" },
  { number: 7, title: "Реструктуризация долгов", description: "Разработка плана реструктуризации задолженности" },
  { number: 8, title: "Реализация имущества", description: "Оценка и реализация имущества должника (при наличии)" },
  { number: 9, title: "Работа с кредиторами", description: "Взаимодействие с кредиторами и рассмотрение их требований" },
  { number: 10, title: "Формирование реестра кредиторов", description: "Формирование и утверждение реестра требований кредиторов" },
  { number: 11, title: "Завершение процедуры реализации", description: "Подготовка отчёта и завершение процедуры реализации" },
  { number: 12, title: "Списание долгов и закрытие дела", description: "Суд выносит определение о списании долгов" },
];

interface GenerateCabinetLinkProps {
  clientId: string;
}

export function GenerateCabinetLink({ clientId }: GenerateCabinetLinkProps) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkExistingToken();
  }, [clientId]);

  const checkExistingToken = async () => {
    try {
      const { data } = await supabase
        .from("client_cabinet_tokens")
        .select("token")
        .eq("client_id", clientId)
        .eq("is_active", true)
        .maybeSingle();

      if (data) setToken(data.token);
    } finally {
      setChecking(false);
    }
  };

  const generateLink = async () => {
    setLoading(true);
    try {
      // Create token
      const { data: tokenData, error: tokenError } = await supabase
        .from("client_cabinet_tokens")
        .insert({ client_id: clientId })
        .select("token")
        .single();

      if (tokenError) throw tokenError;

      // Create 12 default stages
      const stages = DEFAULT_STAGES.map((s) => ({
        client_id: clientId,
        stage_number: s.number,
        title: s.title,
        description: s.description,
      }));

      const { error: stagesError } = await supabase
        .from("bankruptcy_stages")
        .insert(stages);

      if (stagesError) throw stagesError;

      setToken(tokenData.token);
      toast.success("Кабинет клиента создан");
    } catch (error: any) {
      toast.error("Ошибка: " + (error.message || "Не удалось создать кабинет"));
    } finally {
      setLoading(false);
    }
  };

  const getCabinetUrl = () => {
    return `${window.location.origin}/cabinet/${token}`;
  };

  const copyLink = () => {
    navigator.clipboard.writeText(getCabinetUrl());
    toast.success("Ссылка скопирована");
  };

  if (checking) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Кабинет клиента
        </CardTitle>
      </CardHeader>
      <CardContent>
        {token ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Кабинет создан. Отправьте ссылку клиенту:
            </p>
            <div className="flex gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded text-xs break-all">
                {getCabinetUrl()}
              </code>
              <Button variant="outline" size="icon" onClick={copyLink}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => window.open(getCabinetUrl(), "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Создайте персональный кабинет для клиента с отслеживанием этапов
              процедуры банкротства.
            </p>
            <Button onClick={generateLink} disabled={loading}>
              {loading && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
              Создать кабинет клиента
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
