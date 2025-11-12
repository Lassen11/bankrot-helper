import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface TerminatedClient {
  id: string;
  full_name: string;
  contract_amount: number;
  total_paid: number;
  remaining_amount: number;
  terminated_at: string;
  termination_reason: string | null;
  employee_id: string;
}

export const TerminatedClientsHistory = () => {
  const [terminatedClients, setTerminatedClients] = useState<TerminatedClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeesMap, setEmployeesMap] = useState<Record<string, string>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchTerminatedClients();
  }, []);

  const fetchTerminatedClients = async () => {
    try {
      const { data: clients, error } = await supabase
        .from('clients')
        .select('*')
        .eq('is_terminated', true)
        .order('terminated_at', { ascending: false });

      if (error) throw error;

      setTerminatedClients(clients || []);

      // Получаем профили сотрудников
      if (clients && clients.length > 0) {
        const employeeIds = [...new Set(clients.map(c => c.employee_id).filter(Boolean))];
        if (employeeIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', employeeIds);

          const employeesMapping = (profiles || []).reduce((acc, profile) => {
            acc[profile.user_id] = profile.full_name || 'Без имени';
            return acc;
          }, {} as Record<string, string>);

          setEmployeesMap(employeesMapping);
        }
      }
    } catch (error) {
      console.error('Ошибка при загрузке расторгнутых клиентов:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить историю расторжений",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <p className="text-muted-foreground">Загрузка данных...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-destructive" />
          История расторжений ({terminatedClients.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {terminatedClients.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Нет расторгнутых договоров</p>
          </div>
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
                  <TableHead>Дата расторжения</TableHead>
                  <TableHead>Причина</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {terminatedClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.full_name}</TableCell>
                    <TableCell>{employeesMap[client.employee_id] || 'Не указан'}</TableCell>
                    <TableCell>{formatAmount(client.contract_amount)}</TableCell>
                    <TableCell className="text-green-600">{formatAmount(client.total_paid || 0)}</TableCell>
                    <TableCell className="text-orange-600">{formatAmount(client.remaining_amount || 0)}</TableCell>
                    <TableCell>
                      {client.terminated_at 
                        ? format(new Date(client.terminated_at), 'dd MMM yyyy, HH:mm', { locale: ru })
                        : 'Не указана'}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        {client.termination_reason ? (
                          <p className="text-sm text-muted-foreground truncate" title={client.termination_reason}>
                            {client.termination_reason}
                          </p>
                        ) : (
                          <Badge variant="outline">Не указана</Badge>
                        )}
                      </div>
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