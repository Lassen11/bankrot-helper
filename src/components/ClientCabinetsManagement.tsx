import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ExternalLink, Copy, Link2, ChevronDown, ChevronUp, RefreshCw, Ban } from "lucide-react";
import { toast } from "sonner";
import { BankruptcyStages } from "./BankruptcyStages";
import { CabinetChatEmployee } from "./CabinetChatEmployee";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { EmployeeProfileEditor } from "./EmployeeProfileEditor";

interface CabinetInfo {
  client_id: string;
  client_name: string;
  token: string;
  stages_completed: number;
  stages_total: number;
  unread_messages: number;
}

export function ClientCabinetsManagement() {
  const { user } = useAuth();
  const [cabinets, setCabinets] = useState<CabinetInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchCabinets();
  }, [user]);

  const fetchCabinets = async () => {
    try {
      const { data: tokens, error: tokensError } = await supabase
        .from("client_cabinet_tokens")
        .select("client_id, token")
        .eq("is_active", true);

      if (tokensError || !tokens || tokens.length === 0) {
        setLoading(false);
        return;
      }

      const clientIds = tokens.map((t) => t.client_id);

      const [clientsRes, stagesRes, messagesRes] = await Promise.all([
        supabase.from("clients").select("id, full_name").in("id", clientIds),
        supabase.from("bankruptcy_stages").select("client_id, is_completed").in("client_id", clientIds),
        supabase.from("cabinet_messages").select("client_id").in("client_id", clientIds).eq("sender_type", "client").eq("is_read_by_employee", false),
      ]);

      const clientMap = new Map(clientsRes.data?.map((c) => [c.id, c.full_name]) || []);

      const cabinetList: CabinetInfo[] = tokens.map((t) => {
        const clientStages = stagesRes.data?.filter((s) => s.client_id === t.client_id) || [];
        const clientMsgs = messagesRes.data?.filter((m) => m.client_id === t.client_id) || [];

        return {
          client_id: t.client_id,
          client_name: clientMap.get(t.client_id) || "Неизвестный",
          token: t.token,
          stages_completed: clientStages.filter((s) => s.is_completed).length,
          stages_total: clientStages.length,
          unread_messages: clientMsgs.length,
        };
      });

      setCabinets(cabinetList);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/cabinet/${token}`);
    toast.success("Ссылка скопирована");
  };

  const deactivateLink = async (cab: CabinetInfo) => {
    const { error } = await supabase
      .from("client_cabinet_tokens")
      .update({ is_active: false })
      .eq("client_id", cab.client_id)
      .eq("token", cab.token);

    if (error) {
      toast.error("Ошибка деактивации");
      return;
    }

    setCabinets((prev) => prev.filter((c) => c.client_id !== cab.client_id));
    toast.success("Ссылка деактивирована");
  };

  const regenerateLink = async (cab: CabinetInfo) => {
    try {
      // Deactivate old
      await supabase
        .from("client_cabinet_tokens")
        .update({ is_active: false })
        .eq("client_id", cab.client_id)
        .eq("token", cab.token);

      // Create new
      const { data: newToken, error } = await supabase
        .from("client_cabinet_tokens")
        .insert({ client_id: cab.client_id })
        .select("token")
        .single();

      if (error) throw error;

      setCabinets((prev) =>
        prev.map((c) =>
          c.client_id === cab.client_id ? { ...c, token: newToken.token } : c
        )
      );
      toast.success("Новая ссылка создана");
    } catch {
      toast.error("Ошибка создания новой ссылки");
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-20 bg-muted rounded" />
        <div className="h-20 bg-muted rounded" />
      </div>
    );
  }

  if (cabinets.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Link2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Нет активных кабинетов</h3>
          <p className="text-muted-foreground text-sm">
            Создайте кабинет клиента на странице конкретного клиента
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <EmployeeProfileEditor />
      {cabinets.map((cab) => {
        const isExpanded = expandedId === cab.client_id;
        return (
          <Card key={cab.client_id}>
            <CardContent className="p-0">
              {/* Header row */}
              <div
                className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : cab.client_id)}
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{cab.client_name}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">
                      Этапы: {cab.stages_completed}/{cab.stages_total}
                    </span>
                    {cab.unread_messages > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {cab.unread_messages} новых
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); copyLink(cab.token); }}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Ссылка
                  </Button>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t">
                  {/* Link management */}
                  <div className="p-4 bg-muted/30 flex flex-wrap items-center gap-3">
                    <code className="flex-1 min-w-0 bg-muted px-3 py-2 rounded text-xs break-all">
                      {window.location.origin}/cabinet/{cab.token}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`/cabinet/${cab.token}`, "_blank")}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Открыть
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => regenerateLink(cab)}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Новая ссылка
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Ban className="h-3 w-3 mr-1" />
                          Деактивировать
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Деактивировать кабинет?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Клиент потеряет доступ к кабинету. Этапы и сообщения сохранятся.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Отмена</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deactivateLink(cab)}>
                            Деактивировать
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  {/* Tabs: Stages + Chat */}
                  <Tabs defaultValue="stages" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="stages">Этапы</TabsTrigger>
                      <TabsTrigger value="chat" className="relative">
                        Чат
                        {cab.unread_messages > 0 && (
                          <Badge variant="destructive" className="ml-1 h-4 min-w-[16px] px-1 text-[10px]">
                            {cab.unread_messages}
                          </Badge>
                        )}
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="stages" className="p-0">
                      <BankruptcyStages clientId={cab.client_id} />
                    </TabsContent>
                    <TabsContent value="chat" className="p-0">
                      <Card className="border-0 shadow-none">
                        <CardContent className="p-0">
                          <CabinetChatEmployee clientId={cab.client_id} />
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
