import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { History, Search } from "lucide-react";

interface PaymentHistoryRecord {
  id: string;
  payment_id: string;
  client_id: string;
  changed_by: string;
  changed_at: string;
  field_name: string;
  old_value: string;
  new_value: string;
  client_name?: string;
  changed_by_name?: string;
}

export default function PaymentHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [history, setHistory] = useState<PaymentHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [fieldFilter, setFieldFilter] = useState<string>("all");

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      toast.error("Доступ запрещен");
      navigate("/");
    }
  }, [isAdmin, roleLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchHistory();
    }
  }, [user, isAdmin]);

  const fetchHistory = async () => {
    try {
      setLoading(true);

      // Получаем историю изменений
      const { data: historyData, error: historyError } = await supabase
        .from("payment_history")
        .select("*")
        .order("changed_at", { ascending: false })
        .limit(500);

      if (historyError) throw historyError;

      // Получаем уникальные ID клиентов и пользователей
      const clientIds = [...new Set(historyData?.map(h => h.client_id) || [])];
      const userIds = [...new Set(historyData?.map(h => h.changed_by) || [])];

      // Загружаем имена клиентов
      const { data: clientsData } = await supabase
        .from("clients")
        .select("id, full_name")
        .in("id", clientIds);

      // Загружаем имена пользователей
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      // Создаем маппинги
      const clientsMap = new Map(clientsData?.map(c => [c.id, c.full_name]) || []);
      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p.full_name]) || []);

      // Обогащаем данные истории
      const enrichedHistory = historyData?.map(record => ({
        ...record,
        client_name: clientsMap.get(record.client_id) || "Неизвестный клиент",
        changed_by_name: profilesMap.get(record.changed_by) || "Неизвестный пользователь"
      })) || [];

      setHistory(enrichedHistory);
    } catch (error) {
      console.error("Error fetching history:", error);
      toast.error("Ошибка загрузки истории изменений");
    } finally {
      setLoading(false);
    }
  };

  const getFieldLabel = (fieldName: string) => {
    const labels: Record<string, string> = {
      custom_amount: "Сумма платежа",
      due_date: "Дата платежа",
      account: "Счет"
    };
    return labels[fieldName] || fieldName;
  };

  const formatValue = (fieldName: string, value: string) => {
    if (value === "NULL") return "Не указано";
    
    if (fieldName === "custom_amount") {
      return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(parseFloat(value));
    }
    
    if (fieldName === "due_date") {
      return format(new Date(value), "dd MMMM yyyy", { locale: ru });
    }
    
    return value;
  };

  const filteredHistory = history.filter(record => {
    const matchesSearch = 
      record.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.changed_by_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesField = fieldFilter === "all" || record.field_name === fieldFilter;
    
    return matchesSearch && matchesField;
  });

  if (roleLoading || loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <History className="w-6 h-6 text-primary" />
            <CardTitle>История изменений платежей</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Поиск по клиенту или пользователю..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={fieldFilter} onValueChange={setFieldFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Фильтр по полю" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все поля</SelectItem>
                <SelectItem value="custom_amount">Сумма</SelectItem>
                <SelectItem value="due_date">Дата</SelectItem>
                <SelectItem value="account">Счет</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата изменения</TableHead>
                  <TableHead>Клиент</TableHead>
                  <TableHead>Поле</TableHead>
                  <TableHead>Старое значение</TableHead>
                  <TableHead>Новое значение</TableHead>
                  <TableHead>Изменил</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      История изменений пуста
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredHistory.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(record.changed_at), "dd.MM.yyyy HH:mm", { locale: ru })}
                      </TableCell>
                      <TableCell className="font-medium">{record.client_name}</TableCell>
                      <TableCell>{getFieldLabel(record.field_name)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatValue(record.field_name, record.old_value)}
                      </TableCell>
                      <TableCell className="text-primary font-medium">
                        {formatValue(record.field_name, record.new_value)}
                      </TableCell>
                      <TableCell>{record.changed_by_name}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {filteredHistory.length > 0 && (
            <div className="mt-4 text-sm text-muted-foreground">
              Показано {filteredHistory.length} из {history.length} записей
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
