import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SuspendedClient {
  id: string;
  full_name: string;
  contract_amount: number;
  total_paid: number;
  remaining_amount: number;
  suspended_at: string;
  suspension_reason: string | null;
  employee_id: string;
}

export const SuspendedClientsHistory = () => {
  const [suspendedClients, setSuspendedClients] = useState<SuspendedClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeesMap, setEmployeesMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchSuspendedClients();
  }, []);

  const fetchSuspendedClients = async () => {
    try {
      const { data: clients, error } = await supabase
        .from("clients")
        .select("*")
        .eq("is_suspended", true)
        .order("suspended_at", { ascending: false });

      if (error) throw error;

      if (clients && clients.length > 0) {
        const employeeIds = [...new Set(clients.map(c => c.employee_id).filter(Boolean))];
        const { data: employees } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", employeeIds);

        if (employees) {
          const empMap = employees.reduce((acc, emp) => {
            acc[emp.user_id] = emp.full_name || "Не указано";
            return acc;
          }, {} as Record<string, string>);
          setEmployeesMap(empMap);
        }
      }

      setSuspendedClients(clients || []);
    } catch (error: any) {
      console.error("Error fetching suspended clients:", error);
      toast.error("Ошибка при загрузке приостановленных договоров");
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleRestore = async (clientId: string, clientName: string) => {
    try {
      const { error } = await supabase
        .from("clients")
        .update({
          is_suspended: false,
          suspended_at: null,
          suspension_reason: null,
        })
        .eq("id", clientId);

      if (error) throw error;

      toast.success(`Клиент ${clientName} восстановлен`);
      fetchSuspendedClients();
    } catch (error: any) {
      console.error("Error restoring client:", error);
      toast.error("Ошибка при восстановлении клиента");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>История приостановок ({suspendedClients.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {suspendedClients.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            Нет приостановленных договоров
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Клиент</TableHead>
                  <TableHead>Сотрудник</TableHead>
                  <TableHead>Сумма договора</TableHead>
                  <TableHead>Оплачено</TableHead>
                  <TableHead>Остаток</TableHead>
                  <TableHead>Дата приостановки</TableHead>
                  <TableHead>Причина</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suspendedClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.full_name}</TableCell>
                    <TableCell>{employeesMap[client.employee_id] || "Не указано"}</TableCell>
                    <TableCell>{formatAmount(client.contract_amount)}</TableCell>
                    <TableCell>{formatAmount(client.total_paid || 0)}</TableCell>
                    <TableCell>{formatAmount(client.remaining_amount)}</TableCell>
                    <TableCell>
                      {new Date(client.suspended_at).toLocaleDateString("ru-RU")}
                    </TableCell>
                    <TableCell>
                      {client.suspension_reason ? (
                        client.suspension_reason.length > 50 ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger className="text-left">
                                {client.suspension_reason.substring(0, 50)}...
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">{client.suspension_reason}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          client.suspension_reason
                        )
                      ) : (
                        "Не указана"
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRestore(client.id, client.full_name)}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Восстановить
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
