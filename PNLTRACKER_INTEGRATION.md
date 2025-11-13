# Интеграция карточек клиентов для PnL Tracker

## Обзор
Этот документ содержит код компонентов для создания страницы с клиентами в приложении PnL Tracker, идентичной отображению в текущем приложении.

## Структура данных клиента

```typescript
interface Client {
  id: string;
  full_name: string;
  contract_amount: number;
  installment_period: number;
  first_payment: number;
  monthly_payment: number;
  remaining_amount: number;
  total_paid: number;
  deposit_paid: number;
  deposit_target: number;
  payment_day: number;
  employee_id: string;
  contract_date: string;
  created_at: string;
  updated_at: string;
  city?: string;
  source?: string;
  manager?: string;
  nextPayment?: {
    due_date: string;
    amount: number;
  };
}
```

## Необходимые зависимости

Убедитесь, что в PnL Tracker установлены следующие пакаджи:

```bash
npm install lucide-react
npm install @radix-ui/react-dialog
npm install @radix-ui/react-badge
npm install date-fns
```

## 1. Компонент списка клиентов (ClientsList.tsx)

```tsx
import { useState, useEffect } from "react";
import { Search, UserPlus, Eye, CalendarDays } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface Client {
  id: string;
  full_name: string;
  contract_amount: number;
  installment_period: number;
  first_payment: number;
  monthly_payment: number;
  remaining_amount: number;
  total_paid: number;
  deposit_paid: number;
  deposit_target: number;
  payment_day: number;
  employee_id: string;
  created_at: string;
  updated_at: string;
  nextPayment?: {
    due_date: string;
    amount: number;
  };
}

interface ClientsListProps {
  clients: Client[];
  employeesMap: Record<string, string>;
  onClientSelect?: (clientId: string) => void;
}

export const ClientsList = ({ clients, employeesMap, onClientSelect }: ClientsListProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredClients = clients.filter(client =>
    client.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(amount);
  };

  const getPaymentStatus = (client: Client) => {
    const totalPaid = client.total_paid || 0;
    const total = client.contract_amount;
    const percentage = (totalPaid / total) * 100;
    
    const today = new Date();
    const clientCreatedDate = new Date(client.created_at);
    
    const monthsPassed = (today.getFullYear() - clientCreatedDate.getFullYear()) * 12 + 
                        (today.getMonth() - clientCreatedDate.getMonth());
    
    let isOverdue = false;
    if (monthsPassed > 0) {
      const currentDay = today.getDate();
      const hasCurrentMonthPaymentPassed = currentDay > client.payment_day;
      
      if ((hasCurrentMonthPaymentPassed || monthsPassed > 1) && percentage < 100) {
        const expectedPaid = client.first_payment + (Math.min(monthsPassed, client.installment_period) * client.monthly_payment);
        isOverdue = totalPaid < expectedPaid;
      }
    }
    
    if (isOverdue) {
      return { text: "Просрочен", variant: "destructive" as const, color: "bg-red-500" };
    }
    
    if (percentage >= 100) return { text: "Оплачено", variant: "default" as const, color: "bg-green-500" };
    if (percentage >= 50) return { text: "Почти готово", variant: "secondary" as const, color: "bg-yellow-500" };
    if (percentage > 0) return { text: "В процессе", variant: "outline" as const, color: "bg-blue-500" };
    return { text: "Не начато", variant: "destructive" as const, color: "bg-red-500" };
  };

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
              {searchTerm ? "По вашему запросу ничего не найдено" : "Нет данных для отображения"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredClients.map((client) => {
            const status = getPaymentStatus(client);
            const isOverdue = status.text === "Просрочен";
            return (
              <Card key={client.id} className={`hover:shadow-md transition-shadow ${isOverdue ? 'border-red-500 bg-red-50/50' : ''}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className={`text-lg ${isOverdue ? 'text-red-600' : 'text-primary'}`}>
                        {client.full_name}
                      </CardTitle>
                      {employeesMap[client.employee_id] && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Сотрудник: {employeesMap[client.employee_id]}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={status.variant}>
                        <div className={`w-2 h-2 rounded-full ${status.color} mr-2`}></div>
                        {status.text}
                      </Badge>
                      {onClientSelect && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => onClientSelect(client.id)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Просмотр
                        </Button>
                      )}
                    </div>
                  </div>
                  {isOverdue && (
                    <p className="text-sm text-red-600 font-medium">
                      Платеж должен был быть внесен до {client.payment_day} числа
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-muted-foreground">Сумма договора</p>
                      <p className="text-lg font-semibold text-primary">
                        {formatAmount(client.contract_amount)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">Внесено</p>
                      <p className="text-lg font-semibold text-green-600">
                        {formatAmount(client.total_paid || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">Остаток</p>
                      <p className="text-lg font-semibold text-accent">
                        {formatAmount(client.remaining_amount)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">Рассрочка</p>
                      <p className="text-lg font-semibold">
                        {client.installment_period} мес.
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">Ежемесячно</p>
                      <p className="text-lg font-semibold">
                        {formatAmount(client.monthly_payment)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">День платежа</p>
                      <p className="text-lg font-semibold">
                        {client.payment_day} число
                      </p>
                    </div>
                    {client.nextPayment && (
                      <>
                        <div>
                          <p className="font-medium text-muted-foreground">Дата след. платежа</p>
                          <p className={`text-lg font-semibold ${
                            new Date(client.nextPayment.due_date) < new Date(new Date().toISOString().split('T')[0])
                              ? 'text-red-600'
                              : 'text-orange-600'
                          }`}>
                            {new Date(client.nextPayment.due_date).toLocaleDateString('ru-RU')}
                            {new Date(client.nextPayment.due_date) < new Date(new Date().toISOString().split('T')[0]) && (
                              <span className="ml-1 text-xs">(просрочен)</span>
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium text-muted-foreground">Сумма след. платежа</p>
                          <p className={`text-lg font-semibold ${
                            new Date(client.nextPayment.due_date) < new Date(new Date().toISOString().split('T')[0])
                              ? 'text-red-600'
                              : 'text-orange-600'
                          }`}>
                            {formatAmount(client.nextPayment.amount)}
                          </p>
                        </div>
                      </>
                    )}
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
```

## 2. Компонент детального просмотра (ClientDetailView.tsx)

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface Client {
  id: string;
  full_name: string;
  contract_amount: number;
  installment_period: number;
  first_payment: number;
  monthly_payment: number;
  remaining_amount: number;
  total_paid: number;
  deposit_paid: number;
  deposit_target: number;
  payment_day: number;
  contract_date: string;
  created_at: string;
}

interface ClientDetailViewProps {
  client: Client;
  onBack: () => void;
}

export const ClientDetailView = ({ client, onBack }: ClientDetailViewProps) => {
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getPaymentStatus = (remaining: number, total: number) => {
    if (remaining <= 0) {
      return { text: "Оплачено", variant: "default" as const, color: "bg-green-500" };
    } else if (remaining < total * 0.5) {
      return { text: "Почти готово", variant: "secondary" as const, color: "bg-yellow-500" };
    } else {
      return { text: "В процессе", variant: "outline" as const, color: "bg-blue-500" };
    }
  };

  const paymentStatus = getPaymentStatus(client.remaining_amount, client.contract_amount);
  const totalPaidAmount = (client.total_paid || 0) + (client.deposit_paid || 0);
  const monthsRemaining = client.monthly_payment > 0 
    ? Math.ceil(Math.max(0, client.contract_amount - totalPaidAmount) / client.monthly_payment) 
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
      <div className="container mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{client.full_name}</h1>
            </div>
          </div>
          <Badge variant={paymentStatus.variant}>
            <div className={`w-2 h-2 rounded-full ${paymentStatus.color} mr-2`}></div>
            {paymentStatus.text}
          </Badge>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Payment Progress */}
          <Card>
            <CardHeader>
              <CardTitle>Прогресс платежей</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Оплачено</span>
                    <span className="font-semibold">
                      {Math.round((client.total_paid / client.contract_amount) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all"
                      style={{ width: `${Math.min((client.total_paid / client.contract_amount) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Всего оплачено:</span>
                    <p className="font-semibold text-green-600">{formatAmount(client.total_paid)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Остаток:</span>
                    <p className="font-semibold text-accent">{formatAmount(client.remaining_amount)}</p>
                  </div>
                </div>
                {client.deposit_paid > 0 && (
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Депозит</span>
                      <span className="font-semibold">
                        {Math.round((client.deposit_paid / client.deposit_target) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-yellow-500 transition-all"
                        style={{ width: `${Math.min((client.deposit_paid / client.deposit_target) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatAmount(client.deposit_paid)} из {formatAmount(client.deposit_target)}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contract Details */}
          <Card>
            <CardHeader>
              <CardTitle>Детали договора</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Сумма договора:</span>
                  <p className="font-semibold">{formatAmount(client.contract_amount)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Первый платеж:</span>
                  <p className="font-semibold">{formatAmount(client.first_payment)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Период рассрочки:</span>
                  <p className="font-semibold">{client.installment_period} мес.</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Ежемесячный платеж:</span>
                  <p className="font-semibold">{formatAmount(client.monthly_payment)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Осталось платежей:</span>
                  <p className="font-semibold">{monthsRemaining}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">День платежа:</span>
                  <p className="font-semibold">{client.payment_day} число</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Дата договора:</span>
                  <p className="font-semibold">
                    {new Date(client.contract_date).toLocaleDateString('ru-RU')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
```

## 3. Основная страница клиентов (ClientsPage.tsx)

```tsx
import { useState, useEffect } from "react";
import { ClientsList } from "./ClientsList";
import { ClientDetailView } from "./ClientDetailView";

interface Client {
  id: string;
  full_name: string;
  contract_amount: number;
  installment_period: number;
  first_payment: number;
  monthly_payment: number;
  remaining_amount: number;
  total_paid: number;
  deposit_paid: number;
  deposit_target: number;
  payment_day: number;
  employee_id: string;
  contract_date: string;
  created_at: string;
  updated_at: string;
}

export const ClientsPage = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [employeesMap, setEmployeesMap] = useState<Record<string, string>>({});
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      // ВАЖНО: Замените этот блок на ваш метод получения данных из базы pnltracker
      // Например, через API или прямое подключение к базе данных
      
      // const response = await fetch('/api/clients');
      // const data = await response.json();
      // setClients(data.clients);
      // setEmployeesMap(data.employeesMap);
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching clients:', error);
      setLoading(false);
    }
  };

  const selectedClient = selectedClientId 
    ? clients.find(c => c.id === selectedClientId) 
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Загрузка...</p>
      </div>
    );
  }

  if (selectedClient) {
    return (
      <ClientDetailView 
        client={selectedClient} 
        onBack={() => setSelectedClientId(null)} 
      />
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Клиенты</h1>
      <ClientsList 
        clients={clients}
        employeesMap={employeesMap}
        onClientSelect={setSelectedClientId}
      />
    </div>
  );
};
```

## 4. API для получения данных клиентов

### Пример API endpoint для получения клиентов из базы pnltracker

```typescript
// api/clients.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.PNLTRACKER_SUPABASE_URL!,
  process.env.PNLTRACKER_SUPABASE_KEY!
);

export async function GET(request: Request) {
  try {
    // Получаем клиентов из таблицы pnltracker
    const { data: clients, error } = await supabase
      .from('bankrot_clients') // имя таблицы в pnltracker
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Получаем информацию о сотрудниках
    const employeeIds = [...new Set(clients.map(c => c.employee_id).filter(Boolean))];
    const { data: employees } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', employeeIds);

    const employeesMap = (employees || []).reduce((acc, emp) => {
      acc[emp.user_id] = emp.full_name || 'Без имени';
      return acc;
    }, {} as Record<string, string>);

    return Response.json({
      clients,
      employeesMap
    });
  } catch (error) {
    return Response.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}
```

## 5. Структура базы данных

Убедитесь, что в базе данных pnltracker есть таблица с клиентами. Пример SQL для создания таблицы:

```sql
CREATE TABLE IF NOT EXISTS bankrot_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  contract_amount NUMERIC NOT NULL,
  installment_period INTEGER NOT NULL,
  first_payment NUMERIC NOT NULL,
  monthly_payment NUMERIC NOT NULL,
  remaining_amount NUMERIC DEFAULT 0,
  total_paid NUMERIC DEFAULT 0,
  deposit_paid NUMERIC DEFAULT 0,
  deposit_target NUMERIC DEFAULT 70000,
  payment_day INTEGER DEFAULT 1,
  employee_id UUID,
  contract_date DATE DEFAULT CURRENT_DATE,
  city TEXT,
  source TEXT,
  manager TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для оптимизации
CREATE INDEX idx_bankrot_clients_employee_id ON bankrot_clients(employee_id);
CREATE INDEX idx_bankrot_clients_created_at ON bankrot_clients(created_at DESC);
```

## 6. Интеграция с существующим webhook

Данные клиентов из Bankrot уже поступают в pnltracker через webhook `send-to-pnltracker`. 
Убедитесь, что в обработчике webhook есть логика сохранения в таблицу `bankrot_clients`:

```typescript
// В edge function webhook-from-bankrot
if (payload.event_type === 'new_client') {
  await supabase
    .from('bankrot_clients')
    .insert({
      full_name: payload.client_name,
      contract_amount: payload.contract_amount,
      total_paid: payload.total_paid,
      installment_period: payload.installment_period,
      first_payment: payload.first_payment,
      monthly_payment: payload.monthly_payment,
      payment_day: payload.payment_day,
      contract_date: payload.contract_date,
      employee_id: payload.user_id,
      city: payload.city,
      source: payload.source,
      manager: payload.manager,
      remaining_amount: payload.contract_amount - payload.total_paid
    });
}
```

## Использование

1. Скопируйте компоненты в папку `components` вашего проекта pnltracker
2. Создайте страницу `/clients` и используйте компонент `ClientsPage`
3. Настройте получение данных из базы данных через API
4. Убедитесь, что webhook корректно сохраняет данные в таблицу

## Необходимые UI компоненты

Если в pnltracker еще нет shadcn/ui компонентов, установите их:

```bash
npx shadcn-ui@latest add card
npx shadcn-ui@latest add badge  
npx shadcn-ui@latest add button
npx shadcn-ui@latest add input
```

## Стилизация

Убедитесь, что в вашем `tailwind.config.ts` есть необходимые цвета:

```typescript
theme: {
  extend: {
    colors: {
      primary: "hsl(var(--primary))",
      accent: "hsl(var(--accent))",
      muted: "hsl(var(--muted))",
      // ... остальные цвета
    }
  }
}
```
