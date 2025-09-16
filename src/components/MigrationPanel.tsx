import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Loader2, Database, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface MigrationResult {
  success: boolean;
  message?: string;
  migrated?: {
    profiles: number;
    userRoles: number;
    clients: number;
    payments: number;
    receipts: number;
  };
  error?: string;
}

export const MigrationPanel = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);

  const handleMigration = async () => {
    setIsLoading(true);
    setMigrationResult(null);

    try {
      console.log('Starting migration to MySQL...');

      const { data, error } = await supabase.functions.invoke('migrate-to-mysql', {
        body: {}
      });

      if (error) {
        throw error;
      }

      setMigrationResult(data);
      
      if (data.success) {
        toast({
          title: "Миграция завершена",
          description: "Все данные успешно перенесены в MySQL базу данных",
        });
      } else {
        toast({
          title: "Ошибка миграции",
          description: data.error || "Произошла ошибка во время миграции",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Migration error:', error);
      const errorResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      setMigrationResult(errorResult);
      
      toast({
        title: "Ошибка миграции",
        description: "Не удалось выполнить миграцию данных",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Миграция в MySQL
          </CardTitle>
          <CardDescription>
            Перенос всех данных из Supabase в MySQL базу данных
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-medium mb-2">Параметры подключения:</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Хост: 5.129.252.214</p>
              <p>Порт: 3306</p>
              <p>База данных: ozlova</p>
              <p>Тип: MySQL 8.4</p>
            </div>
          </div>

          <Button 
            onClick={handleMigration} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Выполняется миграция...
              </>
            ) : (
              <>
                <Database className="mr-2 h-4 w-4" />
                Начать миграцию
              </>
            )}
          </Button>

          {migrationResult && (
            <Card className={migrationResult.success ? "border-green-500" : "border-red-500"}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  {migrationResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  ) : (
                    <div className="h-5 w-5 rounded-full bg-red-500 mt-0.5" />
                  )}
                  <div className="space-y-2 flex-1">
                    <p className={`font-medium ${migrationResult.success ? 'text-green-700' : 'text-red-700'}`}>
                      {migrationResult.success ? 'Миграция завершена успешно!' : 'Ошибка миграции'}
                    </p>
                    
                    {migrationResult.success && migrationResult.migrated && (
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Перенесено записей:</p>
                        <ul className="list-disc list-inside ml-4 space-y-1">
                          <li>Профили: {migrationResult.migrated.profiles}</li>
                          <li>Роли пользователей: {migrationResult.migrated.userRoles}</li>
                          <li>Клиенты: {migrationResult.migrated.clients}</li>
                          <li>Платежи: {migrationResult.migrated.payments}</li>
                          <li>Чеки: {migrationResult.migrated.receipts}</li>
                        </ul>
                      </div>
                    )}
                    
                    {migrationResult.error && (
                      <p className="text-sm text-red-600">{migrationResult.error}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};