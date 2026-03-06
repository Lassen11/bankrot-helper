import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, ExternalLink, Link2, RefreshCw, Ban } from "lucide-react";

const DEFAULT_STAGES = [
  { number: 1, title: "Сбор документов и изучение материала", description: "Сбор и подготовка первичных документов для процедуры списания долгов\nВам необходимо детально изучить памятку что можно, а что нельзя делать при прохождении процедуры списания долгов для этого нажмите на ссылку\nhttps://pamyatka-bfl.delobusiness-it.ru/" },
  { number: 2, title: "Анализ финансового состояния", description: "Анализ доходов, расходов и долговой нагрузки и всей кредитной истории.\nСоздаем документ для отзыва ваших персональных данных от кредиторов" },
  { number: 3, title: "Сбор второго пакета документов", description: "Формируем ЛКН\nЗапросы в ФНС, ГиБДД, Росреестр.\nЮридический отдел анализирует всю документацию, при наличии дополнительного имущества защищаем его" },
  { number: 4, title: "Первичная работа с кредиторами", description: "Официально уведомляем ваших кредиторов о прохождении процедуры списания всех долгов\nСобираем необходимый пакет документов по вашему супругу/супруге для защиты имущества" },
  { number: 5, title: "Подготовка заявления в суд", description: "Составление заявления о признании банкротом" },
  { number: 6, title: "Подача заявления в Арбитражный суд", description: "Рассмотрение дела о банкротстве в суде" },
  { number: 7, title: "Первое судебное заседание", description: "Рассмотрение дела о банкротстве в суде\nНазначение финансового управляющего" },
  { number: 8, title: "Работа с государственными органами", description: "Отправка запросов, Получение ответов и работа с ними" },
  { number: 9, title: "Работа с кредиторами", description: "Взаимодействие с кредиторами и рассмотрение их требований\nФормирование и утверждение реестра требований кредиторов" },
  { number: 10, title: "Промежуточный отчет Арбитражного управляющего", description: "Направляем отчет от нашего Арбитражного управляющего, о успешном прохождении процедуры списания долгов" },
  { number: 11, title: "Завершение процедуры реализации", description: "Подготовка отчёта и завершение процедуры реализации" },
  { number: 12, title: "Списание долгов и закрытие дела", description: "Суд выносит определение о списании долгов" },
];

const DEFAULT_TEAM = [
  {
    full_name: "Гоннова Анастасия Сергеевна",
    role_label: "Квалифицированный юрист в банкротстве физических лиц",
    bio: "Защищает интересы клиента в ходе всей процедуры",
    avatar_url: "https://gidvpxxfgvivjbzfpxcg.supabase.co/storage/v1/object/public/avatars/team/622ec1a7-e3ba-4088-9c47-fae168d86421/ff73edb2-37bf-4d7b-8d80-2943cd15c686.jpg",
  },
  {
    full_name: "Эркенова Марианна Казимовна",
    role_label: "Арбитражный Управляющий",
    bio: "Ведет ваше дело в арбитражном суде",
    avatar_url: "https://gidvpxxfgvivjbzfpxcg.supabase.co/storage/v1/object/public/avatars/team/622ec1a7-e3ba-4088-9c47-fae168d86421/2ec5d944-0776-4b28-a17a-9a528af703e5.jpg",
  },
];

interface GenerateCabinetLinkProps {
  clientId: string;
}

export function GenerateCabinetLink({ clientId }: GenerateCabinetLinkProps) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasStages, setHasStages] = useState(false);
  const [hasTeam, setHasTeam] = useState(false);

  useEffect(() => {
    checkExistingToken();
  }, [clientId]);

  const checkExistingToken = async () => {
    try {
      const [tokenRes, stagesRes, teamRes] = await Promise.all([
        supabase
          .from("client_cabinet_tokens")
          .select("token")
          .eq("client_id", clientId)
          .eq("is_active", true)
          .maybeSingle(),
        supabase
          .from("bankruptcy_stages")
          .select("id")
          .eq("client_id", clientId)
          .limit(1),
        supabase
          .from("client_employees")
          .select("id")
          .eq("client_id", clientId)
          .limit(1),
      ]);

      if (tokenRes.data) setToken(tokenRes.data.token);
      if (stagesRes.data && stagesRes.data.length > 0) setHasStages(true);
      if (teamRes.data && teamRes.data.length > 0) setHasTeam(true);
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

      // Create default stages only if none exist
      if (!hasStages) {
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
        setHasStages(true);
      }

      // Create default team only if none exist
      if (!hasTeam) {
        const team = DEFAULT_TEAM.map((t) => ({
          client_id: clientId,
          full_name: t.full_name,
          role_label: t.role_label,
          bio: t.bio,
          avatar_url: t.avatar_url,
        }));

        const { error: teamError } = await supabase
          .from("client_employees")
          .insert(team);

        if (teamError) throw teamError;
        setHasTeam(true);
      }

      setToken(tokenData.token);
      toast.success("Ссылка на кабинет создана");
    } catch (error: any) {
      toast.error("Ошибка: " + (error.message || "Не удалось создать кабинет"));
    } finally {
      setLoading(false);
    }
  };

  const deactivateLink = async () => {
    setDeactivating(true);
    try {
      const { error } = await supabase
        .from("client_cabinet_tokens")
        .update({ is_active: false })
        .eq("client_id", clientId)
        .eq("token", token);

      if (error) throw error;

      setToken(null);
      toast.success("Ссылка деактивирована");
    } catch (error: any) {
      toast.error("Ошибка: " + (error.message || "Не удалось деактивировать"));
    } finally {
      setDeactivating(false);
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
              ✅ Кабинет создан. Управление кабинетом доступно на вкладке «Кабинеты».
            </p>
            <div className="flex gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded text-xs break-all">
                {getCabinetUrl()}
              </code>
              <Button variant="outline" size="icon" onClick={copyLink}>
                <Copy className="h-4 w-4" />
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
