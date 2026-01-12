import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Users } from "lucide-react";

interface EmployeeData {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  clients_count: number;
  contract_sum: number;
}

interface EmployeesListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EmployeesListDialog = ({
  open,
  onOpenChange,
}: EmployeesListDialogProps) => {
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchEmployees();
    }
  }, [open]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      // Получаем роли сотрудников (только employee)
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('role', 'employee');

      if (rolesError) throw rolesError;

      if (!userRoles || userRoles.length === 0) {
        setEmployees([]);
        return;
      }

      const employeeIds = userRoles.map(ur => ur.user_id);

      // Получаем профили сотрудников
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', employeeIds);

      if (profilesError) throw profilesError;

      // Получаем emails через edge function
      const { data: usersData, error: usersError } = await supabase.functions.invoke('admin-users', {
        body: { action: 'list' }
      });

      if (usersError) throw usersError;

      // Получаем клиентов для подсчёта
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('employee_id, contract_amount')
        .eq('is_terminated', false)
        .eq('is_suspended', false);

      if (clientsError) throw clientsError;

      // Собираем данные
      const employeesMap = new Map<string, EmployeeData>();

      employeeIds.forEach(userId => {
        const profile = profiles?.find(p => p.user_id === userId);
        const userInfo = usersData?.users?.find((u: any) => u.id === userId);
        
        // Подсчитываем клиентов и сумму договоров
        const employeeClients = clients?.filter(c => c.employee_id === userId) || [];
        const clientsCount = employeeClients.length;
        const contractSum = employeeClients.reduce((sum, c) => sum + (c.contract_amount || 0), 0);

        employeesMap.set(userId, {
          user_id: userId,
          email: userInfo?.email || 'Нет email',
          full_name: profile?.full_name || 'Не указано',
          role: 'Сотрудник',
          clients_count: clientsCount,
          contract_sum: contractSum,
        });
      });

      setEmployees(Array.from(employeesMap.values()));
    } catch (error) {
      console.error('Error fetching employees:', error);
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

  const totalClients = employees.reduce((sum, e) => sum + e.clients_count, 0);
  const totalContractSum = employees.reduce((sum, e) => sum + e.contract_sum, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Список сотрудников ({employees.length})
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Сотрудников</p>
                <p className="text-xl font-bold">{employees.length}</p>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Всего клиентов</p>
                <p className="text-xl font-bold">{totalClients}</p>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Сумма договоров</p>
                <p className="text-xl font-bold">{formatAmount(totalContractSum)}</p>
              </div>
            </div>

            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ФИО</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Роль</TableHead>
                    <TableHead className="text-right">Клиентов</TableHead>
                    <TableHead className="text-right">Сумма договоров</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Нет сотрудников
                      </TableCell>
                    </TableRow>
                  ) : (
                    employees.map((employee) => (
                      <TableRow key={employee.user_id}>
                        <TableCell className="font-medium">{employee.full_name}</TableCell>
                        <TableCell>{employee.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{employee.role}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{employee.clients_count}</TableCell>
                        <TableCell className="text-right">{formatAmount(employee.contract_sum)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
