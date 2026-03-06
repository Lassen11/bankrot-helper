import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Link2, RefreshCw } from "lucide-react";

interface GenerateCabinetLinkProps {
  clientId: string;
}

export function GenerateCabinetLink({ clientId }: GenerateCabinetLinkProps) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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

      // Fetch templates from DB
      const [templateStagesRes, templateTeamRes] = await Promise.all([
        supabase.from("cabinet_template_stages").select("stage_number, title, description").order("stage_number"),
        supabase.from("cabinet_template_team").select("full_name, role_label, bio, avatar_url").order("sort_order"),
      ]);

      // Create stages from template if none exist
      if (!hasStages && templateStagesRes.data && templateStagesRes.data.length > 0) {
        const stages = templateStagesRes.data.map((s) => ({
          client_id: clientId,
          stage_number: s.stage_number,
          title: s.title,
          description: s.description,
        }));

        const { error: stagesError } = await supabase
          .from("bankruptcy_stages")
          .insert(stages);

        if (stagesError) throw stagesError;
        setHasStages(true);
      }

      // Create team from template if none exist
      if (!hasTeam && templateTeamRes.data && templateTeamRes.data.length > 0) {
        const team = templateTeamRes.data.map((t) => ({
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
