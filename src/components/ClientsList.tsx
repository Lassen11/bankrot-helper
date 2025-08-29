import { useState, useEffect } from "react";
import { Search, UserPlus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Client {
  id: string;
  full_name: string;
  contract_amount: number;
  installment_period: number;
  first_payment: number;
  monthly_payment: number;
  remaining_amount: number;
  created_at: string;
}

interface ClientsListProps {
  refresh: boolean;
}

export const ClientsList = ({ refresh }: ClientsListProps) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить список клиентов",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [refresh]);

  const filteredClients = clients.filter(client =>
    client.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(amount);
  };

  const getPaymentStatus = (remaining: number, total: number) => {
    const percentage = ((total - remaining) / total) * 100;
    if (percentage >= 100) return { text: "Оплачено", variant: "default" as const, color: "success" };
    if (percentage >= 50) return { text: "Больше половины", variant: "secondary" as const, color: "accent" };
    if (percentage > 0) return { text: "В процессе", variant: "outline" as const, color: "warning" };
    return { text: "Не начато", variant: "destructive" as const, color: "destructive" };
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <p className="text-muted-foreground">Загружаем клиентов...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Поиск по ФИО клиента..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredClients.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <UserPlus className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Нет клиентов</h3>
            <p className="text-muted-foreground">
              {searchTerm ? "По вашему запросу ничего не найдено" : "Добавьте первого клиента"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredClients.map((client) => {
            const status = getPaymentStatus(client.remaining_amount, client.contract_amount);
            return (
              <Card key={client.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg text-primary">
                      {client.full_name}
                    </CardTitle>
                    <Badge variant={status.variant} className={`bg-${status.color} text-${status.color}-foreground`}>
                      {status.text}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-muted-foreground">Сумма договора</p>
                      <p className="text-lg font-semibold text-primary">
                        {formatAmount(client.contract_amount)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">Рассрочка</p>
                      <p className="text-lg font-semibold">
                        {client.installment_period} мес.
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">Первый платеж</p>
                      <p className="text-lg font-semibold">
                        {formatAmount(client.first_payment)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">Ежемесячно</p>
                      <p className="text-lg font-semibold">
                        {formatAmount(client.monthly_payment)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">Остаток</p>
                      <p className="text-lg font-semibold text-accent">
                        {formatAmount(client.remaining_amount)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">Создан</p>
                      <p className="text-sm">
                        {new Date(client.created_at).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};