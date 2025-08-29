import { useState } from "react";
import { Header } from "@/components/Header";
import { ClientForm } from "@/components/ClientForm";
import { ClientsList } from "@/components/ClientsList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Users, UserPlus, TrendingUp } from "lucide-react";

const Index = () => {
  const [refreshClients, setRefreshClients] = useState(false);

  const handleClientAdded = () => {
    setRefreshClients(prev => !prev);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-primary-light rounded-full">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      Всего клиентов
                    </p>
                    <p className="text-2xl font-bold text-primary">
                      -
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-success-light rounded-full">
                    <TrendingUp className="h-6 w-6 text-success" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      Общая сумма договоров
                    </p>
                    <p className="text-2xl font-bold text-success">
                      -
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-accent-light rounded-full">
                    <UserPlus className="h-6 w-6 text-accent" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      Активных дел
                    </p>
                    <p className="text-2xl font-bold text-accent">
                      -
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="clients" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="clients">Список клиентов</TabsTrigger>
              <TabsTrigger value="add-client">Добавить клиента</TabsTrigger>
            </TabsList>
            
            <TabsContent value="clients" className="space-y-6">
              <ClientsList refresh={refreshClients} />
            </TabsContent>
            
            <TabsContent value="add-client" className="space-y-6">
              <ClientForm onClientAdded={handleClientAdded} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Index;
