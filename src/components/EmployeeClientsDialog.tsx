import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ClientDetailsDialog } from "./ClientDetailsDialog";

interface Client {
  id: string;
  full_name: string;
  contract_amount: number;
  total_paid: number;
  remaining_amount: number;
  created_at: string;
}

interface EmployeeClientsDialogProps {
  employeeId: string;
  employeeName: string;
  clientsCount: number;
}

export const EmployeeClientsDialog = ({ employeeId, employeeName, clientsCount }: EmployeeClientsDialogProps) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientDetailsOpen, setClientDetailsOpen] = useState(false);

  const fetchEmployeeClients = async () => {
    if (!employeeId || loading) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', employeeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Ошибка при загрузке клиентов сотрудника:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchEmployeeClients();
    }
  }, [open, employeeId]);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const getPaymentStatus = (totalPaid: number, contractAmount: number) => {
    const percentage = (totalPaid / contractAmount) * 100;
    if (percentage >= 100) return { label: "Завершено", variant: "default" as const };
    if (percentage >= 50) return { label: "В процессе", variant: "secondary" as const };
    return { label: "Начато", variant: "outline" as const };
  };

  const handleClientClick = (clientId: string) => {
    setSelectedClientId(clientId);
    setClientDetailsOpen(true);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="h-4 w-4 mr-2" />
          Клиенты ({clientsCount})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Клиенты сотрудника: {employeeName}</DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="text-muted-foreground">Загрузка клиентов...</div>
          </div>
        ) : clients.length === 0 ? (
          <div className="flex justify-center py-8">
            <div className="text-muted-foreground">У сотрудника пока нет клиентов</div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Найдено клиентов: {clients.length}
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ФИО клиента</TableHead>
                  <TableHead>Сумма договора</TableHead>
                  <TableHead>Оплачено</TableHead>
                  <TableHead>Остаток</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Дата создания</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => {
                  const status = getPaymentStatus(client.total_paid || 0, client.contract_amount);
                  return (
                    <TableRow 
                      key={client.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleClientClick(client.id)}
                    >
                      <TableCell className="font-medium">{client.full_name}</TableCell>
                      <TableCell>{formatAmount(client.contract_amount)}</TableCell>
                      <TableCell>{formatAmount(client.total_paid || 0)}</TableCell>
                      <TableCell>{formatAmount(client.remaining_amount || 0)}</TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell>{formatDate(client.created_at)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        
        <ClientDetailsDialog 
          clientId={selectedClientId}
          open={clientDetailsOpen}
          onOpenChange={setClientDetailsOpen}
        />
      </DialogContent>
    </Dialog>
  );
};