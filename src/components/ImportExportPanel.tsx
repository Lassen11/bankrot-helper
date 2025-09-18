import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Download, Upload, FileSpreadsheet } from "lucide-react";
import * as XLSX from 'xlsx';

interface Client {
  id: string;
  full_name: string;
  contract_date: string;
  contract_amount: number;
  installment_period: number;
  first_payment: number;
  monthly_payment: number;
  remaining_amount: number;
  total_paid: number;
  deposit_paid: number;
  deposit_target: number;
  payment_day: number;
  user_id: string;
  employee_id: string;
  created_at: string;
  updated_at: string;
}

interface Employee {
  id: string;
  full_name: string;
}

export const ImportExportPanel = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Получаем клиентов
      const { data: clients, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!clients || clients.length === 0) {
        toast({
          title: "Нет данных",
          description: "Нет клиентов для экспорта",
          variant: "destructive",
        });
        return;
      }

      // Получаем профили сотрудников
      const employeeIds = [...new Set(clients.map(c => c.employee_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', employeeIds);

      const profilesMap = (profiles || []).reduce((acc, profile) => {
        acc[profile.user_id] = profile.full_name || 'Без имени';
        return acc;
      }, {} as Record<string, string>);

      // Подготавливаем данные для Excel
      const exportData = clients.map(client => ({
        'ID': client.id,
        'ФИО': client.full_name,
        'Сотрудник': profilesMap[client.employee_id] || 'Не указан',
        'ID Сотрудника': client.employee_id,
        'Дата договора': new Date(client.contract_date).toLocaleDateString('ru-RU'),
        'Сумма договора': client.contract_amount,
        'Период рассрочки (месяцы)': client.installment_period,
        'Первый взнос': client.first_payment,
        'Ежемесячный платеж': client.monthly_payment,
        'Остаток к доплате': client.remaining_amount,
        'Всего выплачено': client.total_paid,
        'Депозит выплачен': client.deposit_paid,
        'Цель депозита': client.deposit_target,
        'День платежа': client.payment_day,
        'Дата создания': new Date(client.created_at).toLocaleDateString('ru-RU'),
        'Дата обновления': new Date(client.updated_at).toLocaleDateString('ru-RU')
      }));

      // Создаем книгу Excel
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Автоматически настраиваем ширину колонок
      const colWidths = [
        { wch: 20 }, // ID
        { wch: 25 }, // ФИО
        { wch: 20 }, // Сотрудник
        { wch: 20 }, // ID Сотрудника
        { wch: 15 }, // Дата договора
        { wch: 15 }, // Сумма договора
        { wch: 15 }, // Период рассрочки
        { wch: 15 }, // Первый взнос
        { wch: 18 }, // Ежемесячный платеж
        { wch: 18 }, // Остаток к доплате
        { wch: 15 }, // Всего выплачено
        { wch: 15 }, // Депозит выплачен
        { wch: 15 }, // Цель депозита
        { wch: 12 }, // День платежа
        { wch: 15 }, // Дата создания
        { wch: 15 }  // Дата обновления
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Клиенты');

      // Скачиваем файл
      const fileName = `clients_export_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: "Экспорт завершен",
        description: `Данные ${clients.length} клиентов экспортированы в файл ${fileName}`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Ошибка экспорта",
        description: "Не удалось экспортировать данные",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Загружаем список сотрудников при монтировании компонента
  React.useEffect(() => {
    const fetchEmployees = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .order('full_name');
      
      if (!error && data) {
        setEmployees(data.map(profile => ({ 
          id: profile.user_id, 
          full_name: profile.full_name || 'Без имени' 
        })));
      }
    };
    
    fetchEmployees();
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Ошибка авторизации",
          description: "Пользователь не авторизован",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          if (jsonData.length === 0) {
            toast({
              title: "Файл пустой",
              description: "В файле нет данных для импорта",
              variant: "destructive",
            });
            return;
          }

          let importedCount = 0;
          let errorCount = 0;

          for (const row of jsonData) {
            try {
              // Определяем сотрудника для клиента
              let employeeId = user.id; // По умолчанию текущий пользователь
              
              const employeeIdFromFile = (row as any)['ID Сотрудника'];
              const employeeNameFromFile = (row as any)['Сотрудник'];
              
              if (employeeIdFromFile) {
                // Если указан ID сотрудника, проверяем, что он существует
                const employeeExists = employees.find(emp => emp.id === employeeIdFromFile);
                if (employeeExists) {
                  employeeId = employeeIdFromFile;
                }
              } else if (employeeNameFromFile && employeeNameFromFile !== 'Не указан') {
                // Если указано имя сотрудника, ищем по имени
                const employee = employees.find(emp => emp.full_name === employeeNameFromFile);
                if (employee) {
                  employeeId = employee.id;
                }
              }

              const clientData = {
                full_name: (row as any)['ФИО'] || '',
                contract_date: parseDate((row as any)['Дата договора']),
                contract_amount: parseFloat((row as any)['Сумма договора']) || 0,
                installment_period: parseInt((row as any)['Период рассрочки (месяцы)']) || 0,
                first_payment: parseFloat((row as any)['Первый взнос']) || 0,
                monthly_payment: parseFloat((row as any)['Ежемесячный платеж']) || 0,
                remaining_amount: parseFloat((row as any)['Остаток к доплате']) || 0,
                total_paid: parseFloat((row as any)['Всего выплачено']) || 0,
                deposit_paid: parseFloat((row as any)['Депозит выплачен']) || 0,
                deposit_target: parseFloat((row as any)['Цель депозита']) || 50000,
                payment_day: parseInt((row as any)['День платежа']) || 1,
                user_id: user.id,
                employee_id: employeeId
              };

              if (!clientData.full_name || !clientData.contract_amount) {
                errorCount++;
                continue;
              }

              const { error } = await supabase
                .from('clients')
                .insert([clientData]);

              if (error) {
                console.error('Insert error:', error);
                errorCount++;
              } else {
                importedCount++;
              }
            } catch (error) {
              console.error('Row processing error:', error);
              errorCount++;
            }
          }

          toast({
            title: "Импорт завершен",
            description: `Успешно импортировано: ${importedCount} клиентов. Ошибок: ${errorCount}`,
          });

          // Очищаем input
          event.target.value = '';
        } catch (error) {
          console.error('File processing error:', error);
          toast({
            title: "Ошибка обработки файла",
            description: "Не удалось обработать файл Excel",
            variant: "destructive",
          });
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Ошибка импорта",
        description: "Не удалось импортировать данные",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const parseDate = (dateStr: string): string => {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    
    // Попробуем парсить разные форматы даты
    const formats = [
      /(\d{1,2})\.(\d{1,2})\.(\d{4})/,  // DD.MM.YYYY
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,  // DD/MM/YYYY
      /(\d{4})-(\d{1,2})-(\d{1,2})/     // YYYY-MM-DD
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        if (format === formats[2]) {
          // YYYY-MM-DD format
          return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        } else {
          // DD.MM.YYYY or DD/MM/YYYY format
          return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
        }
      }
    }

    // Если не удалось распарсить, возвращаем сегодняшнюю дату
    return new Date().toISOString().split('T')[0];
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Экспорт данных */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Экспорт в Excel
            </CardTitle>
            <CardDescription>
              Экспортировать данные всех клиентов в файл Excel (.xlsx)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleExport}
              disabled={isExporting}
              className="w-full"
            >
              {isExporting ? (
                <>Экспортируем...</>
              ) : (
                <>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Скачать Excel файл
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Импорт данных */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Импорт из Excel
            </CardTitle>
            <CardDescription>
              Загрузить данные клиентов из файла Excel (.xlsx)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="import-file">Выберите файл Excel</Label>
              <Input
                id="import-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                disabled={isImporting}
                className="mt-2"
              />
            </div>
            {isImporting && (
              <p className="text-sm text-muted-foreground">
                Импортируем данные...
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Инструкции */}
      <Card>
        <CardHeader>
          <CardTitle>Инструкции по импорту</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Формат файла для импорта:</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Файл Excel должен содержать следующие колонки:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li><strong>ФИО</strong> - полное имя клиента (обязательно)</li>
              <li><strong>Сотрудник</strong> - имя сотрудника (необязательно)</li>
              <li><strong>ID Сотрудника</strong> - ID сотрудника в системе (необязательно)</li>
              <li><strong>Дата договора</strong> - дата в формате ДД.ММ.ГГГГ</li>
              <li><strong>Сумма договора</strong> - сумма договора в рублях (обязательно)</li>
              <li><strong>Период рассрочки (месяцы)</strong> - количество месяцев</li>
              <li><strong>Первый взнос</strong> - размер первого взноса</li>
              <li><strong>Ежемесячный платеж</strong> - размер ежемесячного платежа</li>
              <li><strong>Остаток к доплате</strong> - остаток к доплате</li>
              <li><strong>День платежа</strong> - день месяца для платежа (1-31)</li>
            </ul>
          </div>
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm">
              <strong>Примечание:</strong> Поля "ФИО" и "Сумма договора" являются обязательными. 
              Если сотрудник не указан, клиент будет привязан к текущему пользователю.
              Строки без обязательных данных будут пропущены при импорте.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};