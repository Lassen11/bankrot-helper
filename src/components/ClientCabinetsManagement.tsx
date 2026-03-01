import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ExternalLink, Copy, Link2 } from "lucide-react";
import { toast } from "sonner";

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

  useEffect(() => {
    if (user) fetchCabinets();
  }, [user]);

  const fetchCabinets = async () => {
    try {
      // Get all active tokens for employee's clients
      const { data: tokens, error: tokensError } = await supabase
        .from("client_cabinet_tokens")
        .select("client_id, token")
        .eq("is_active", true);

      if (tokensError || !tokens || tokens.length === 0) {
        setLoading(false);
        return;
      }

      const clientIds = tokens.map((t) => t.client_id);

      // Get client names
      const { data: clients } = await supabase
        .from("clients")
        .select("id, full_name")
        .in("id", clientIds);

      // Get stages completion
      const { data: stages } = await supabase
        .from("bankruptcy_stages")
        .select("client_id, is_completed")
        .in("client_id", clientIds);

      // Get unread client messages count
      const { data: messages } = await supabase
        .from("cabinet_messages")
        .select("client_id")
        .in("client_id", clientIds)
        .eq("sender_type", "client")
        .eq("is_read_by_employee", false);

      const clientMap = new Map(clients?.map((c) => [c.id, c.full_name]) || []);

      const cabinetList: CabinetInfo[] = tokens.map((t) => {
        const clientStages = stages?.filter((s) => s.client_id === t.client_id) || [];
        const clientMsgs = messages?.filter(
          (m) => m.client_id === t.client_id
        ) || [];

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
      {cabinets.map((cab) => (
        <Card key={cab.client_id}>
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{cab.client_name}</h3>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-muted-foreground">
                  Этапы: {cab.stages_completed}/{cab.stages_total}
                </span>
                {cab.unread_messages > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {cab.unread_messages} сообщ.
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyLink(cab.token)}
              >
                <Copy className="h-3 w-3 mr-1" />
                Скопировать
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(`/client/${cab.client_id}`, "_blank")
                }
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Открыть
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
