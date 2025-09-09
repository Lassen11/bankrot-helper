import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Trash2, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ClientDetailsDialog } from "./ClientDetailsDialog";
import { useToast } from "@/hooks/use-toast";

interface Client {
  id: string;
  full_name: string;
  contract_amount: number;
  total_paid: number;
  remaining_amount: number;
  created_at: string;
}

interface Employee {
  user_id: string;
  full_name: string;
  email: string;
}

interface EmployeeClientsDialogProps {
  employeeId: string;
  employeeName: string;
  clientsCount: number;
  onClientDeleted?: () => void;
  onClientTransferred?: () => void;
}

export const EmployeeClientsDialog = ({ 
  employeeId, 
  employeeName, 
  clientsCount, 
  onClientDeleted, 
  onClientTransferred 
}: EmployeeClientsDialogProps) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientDetailsOpen, setClientDetailsOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [transferToEmployeeId, setTransferToEmployeeId] = useState<string>("");
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [clientToTransfer, setClientToTransfer] = useState<Client | null>(null);
  const { toast } = useToast();

  const fetchEmployees = async () => {
    try {
      // Получаем всех пользователей с ролями кроме текущего сотрудника
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .neq('user_id', employeeId);

      if (rolesError) throw rolesError;

      if (!rolesData || rolesData.length === 0) {
        setEmployees([]);
        return;
      }

      const userIds = rolesData.map(role => role.user_id);

      // Получаем профили этих пользователей
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Получаем также email пользователей через Edge Function
      try {
        const response = await fetch(`https://htvbbyoghtoionbvzekw.supabase.co/functions/v1/admin-users`, {
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const { users } = await response.json();
          
          const employeesWithEmails = (profilesData || []).map(profile => {
            const userWithEmail = users.find((u: any) => u.id === profile.user_id);
            return {
              user_id: profile.user_id,
              full_name: profile.full_name || 'Без имени',
              email: userWithEmail?.email || 'Нет email'
            };
          });
          
          setEmployees(employeesWithEmails);
        } else {
          // Используем только данные из профилей без email
          const employeesWithoutEmails = (profilesData || []).map(profile => ({
            user_id: profile.user_id,
            full_name: profile.full_name || 'Без имени',
            email: 'Нет email'
          }));
          
          setEmployees(employeesWithoutEmails);
        }
      } catch (fetchError) {
        console.error('Ошибка получения email сотрудников:', fetchError);
        // Используем только данные из профилей без email
        const employeesWithoutEmails = (profilesData || []).map(profile => ({
          user_id: profile.user_id,
          full_name: profile.full_name || 'Без имени',
          email: 'Нет email'
        }));
        
        setEmployees(employeesWithoutEmails);
      }
    } catch (error) {
      console.error('Ошибка при загрузке сотрудников:', error);
      setEmployees([]);
    }
  };

  const handleDeleteClient = async (client: Client) => {
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id);

      if (error) throw error;

      toast({
        title: "Успешно",
        description: `Клиент ${client.full_name} был удален`,
      });

      // Обновляем список клиентов
      setClients(clients.filter(c => c.id !== client.id));
      onClientDeleted?.();
    } catch (error) {
      console.error('Ошибка при удалении клиента:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить клиента",
        variant: "destructive",
      });
    }
  };

  const handleTransferClient = async () => {
    if (!clientToTransfer || !transferToEmployeeId) return;

    try {
      const { error } = await supabase
        .from('clients')
        .update({ user_id: transferToEmployeeId })
        .eq('id', clientToTransfer.id);

      if (error) throw error;

      const targetEmployee = employees.find(emp => emp.user_id === transferToEmployeeId);
      
      toast({
        title: "Успешно",
        description: `Клиент ${clientToTransfer.full_name} переведен к сотруднику ${targetEmployee?.full_name}`,
      });

      // Сбрасываем состояние диалога переноса
      setTransferDialogOpen(false);
      setClientToTransfer(null);
      setTransferToEmployeeId("");

      // Обновляем список клиентов
      setClients(clients.filter(c => c.id !== clientToTransfer.id));
      onClientTransferred?.();
    } catch (error) {
      console.error('Ошибка при переносе клиента:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось перенести клиента",
        variant: "destructive",
      });
    }
  };

  const openTransferDialog = (client: Client) => {
    setClientToTransfer(client);
    setTransferDialogOpen(true);
  };

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
      fetchEmployees();
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
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => {
                  const status = getPaymentStatus(client.total_paid || 0, client.contract_amount);
                  return (
                    <TableRow key={client.id}>
                      <TableCell 
                        className="font-medium cursor-pointer hover:text-primary"
                        onClick={() => handleClientClick(client.id)}
                      >
                        {client.full_name}
                      </TableCell>
                      <TableCell>{formatAmount(client.contract_amount)}</TableCell>
                      <TableCell>{formatAmount(client.total_paid || 0)}</TableCell>
                      <TableCell>{formatAmount(client.remaining_amount || 0)}</TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell>{formatDate(client.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openTransferDialog(client)}
                          >
                            <UserX className="h-4 w-4 mr-1" />
                            Перенести
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Удалить
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Удалить клиента?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Вы уверены, что хотите удалить клиента "{client.full_name}"? 
                                  Это действие нельзя отменить, все данные клиента будут удалены.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Отмена</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteClient(client)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Удалить
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
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

        {/* Диалог переноса клиента */}
        <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Перенести клиента</DialogTitle>
            </DialogHeader>
            
            {clientToTransfer && (
              <div className="space-y-4">
                <p>
                  Клиент: <span className="font-medium">{clientToTransfer.full_name}</span>
                </p>
                <p>
                  Текущий сотрудник: <span className="font-medium">{employeeName}</span>
                </p>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Новый сотрудник:</label>
                  <Select value={transferToEmployeeId} onValueChange={setTransferToEmployeeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите сотрудника..." />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((employee) => (
                        <SelectItem key={employee.user_id} value={employee.user_id}>
                          {employee.full_name} ({employee.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setTransferDialogOpen(false)}
                  >
                    Отмена
                  </Button>
                  <Button 
                    onClick={handleTransferClient}
                    disabled={!transferToEmployeeId}
                  >
                    Перенести
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};