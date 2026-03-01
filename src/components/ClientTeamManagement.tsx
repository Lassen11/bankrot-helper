import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface TeamMember {
  id: string;
  employee_id: string;
  role_label: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

interface AvailableEmployee {
  user_id: string;
  full_name: string | null;
}

export function ClientTeamManagement({ clientId }: { clientId: string }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [employees, setEmployees] = useState<AvailableEmployee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [roleLabel, setRoleLabel] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [clientId]);

  const fetchData = async () => {
    setLoading(true);
    const [teamRes, empRes] = await Promise.all([
      supabase.from("client_employees").select("id, employee_id, role_label").eq("client_id", clientId),
      supabase.from("profiles").select("user_id, full_name"),
    ]);

    const teamRows = teamRes.data || [];
    const allProfiles = empRes.data || [];

    const profileMap = new Map(allProfiles.map((p) => [p.user_id, p]));

    const enriched: TeamMember[] = teamRows.map((t) => {
      const profile = profileMap.get(t.employee_id);
      return {
        id: t.id,
        employee_id: t.employee_id,
        role_label: t.role_label,
        full_name: profile?.full_name || null,
        avatar_url: null,
      };
    });

    // Fetch avatars separately since profiles may have avatar_url
    if (teamRows.length > 0) {
      const { data: avatarData } = await supabase
        .from("profiles")
        .select("user_id, avatar_url")
        .in("user_id", teamRows.map((t) => t.employee_id));
      
      if (avatarData) {
        const avatarMap = new Map(avatarData.map((a) => [a.user_id, a.avatar_url]));
        enriched.forEach((m) => {
          m.avatar_url = avatarMap.get(m.employee_id) || null;
        });
      }
    }

    setMembers(enriched);
    setEmployees(allProfiles);
    setLoading(false);
  };

  const addMember = async () => {
    if (!selectedEmployee) return;

    const { error } = await supabase.from("client_employees").insert({
      client_id: clientId,
      employee_id: selectedEmployee,
      role_label: roleLabel || null,
    });

    if (error) {
      if (error.code === "23505") {
        toast.error("Этот сотрудник уже добавлен");
      } else {
        toast.error("Ошибка добавления");
      }
      return;
    }

    toast.success("Сотрудник добавлен в команду");
    setSelectedEmployee("");
    setRoleLabel("");
    fetchData();
  };

  const removeMember = async (id: string) => {
    const { error } = await supabase.from("client_employees").delete().eq("id", id);
    if (error) {
      toast.error("Ошибка удаления");
      return;
    }
    toast.success("Сотрудник убран из команды");
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const getInitials = (name: string | null) => {
    if (!name) return "??";
    return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  };

  // Filter out already-added employees
  const assignedIds = new Set(members.map((m) => m.employee_id));
  const available = employees.filter((e) => !assignedIds.has(e.user_id));

  if (loading) {
    return <div className="p-4 animate-pulse"><div className="h-16 bg-muted rounded" /></div>;
  }

  return (
    <div className="p-4 space-y-4">
      {/* Current team */}
      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Нет прикрепленных сотрудников</p>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg border">
              <Avatar className="h-9 w-9">
                {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                <AvatarFallback className="text-xs">{getInitials(m.full_name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{m.full_name || "Без имени"}</p>
                {m.role_label && (
                  <Badge variant="secondary" className="text-xs">{m.role_label}</Badge>
                )}
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeMember(m.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add new member */}
      <div className="border-t pt-4 space-y-2">
        <p className="text-sm font-medium">Добавить сотрудника</p>
        <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
          <SelectTrigger>
            <SelectValue placeholder="Выберите сотрудника" />
          </SelectTrigger>
          <SelectContent>
            {available.map((e) => (
              <SelectItem key={e.user_id} value={e.user_id}>
                {e.full_name || e.user_id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Роль (напр. Юрист)"
          value={roleLabel}
          onChange={(e) => setRoleLabel(e.target.value)}
        />
        <Button size="sm" onClick={addMember} disabled={!selectedEmployee} className="w-full">
          <UserPlus className="h-4 w-4 mr-1" />
          Добавить
        </Button>
      </div>
    </div>
  );
}
