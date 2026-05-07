import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Download, Upload, FileSpreadsheet, RefreshCw } from "lucide-react";
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
  city?: string;
  source?: string;
  manager?: string;
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingClients, setIsSyncingClients] = useState(false);
  const [isExportingUnpaid, setIsExportingUnpaid] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [syncMonth, setSyncMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [unpaidMonth, setUnpaidMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const handleExportUnpaid = async () => {
    setIsExportingUnpaid(true);
    try {
      const [year, monthNum] = unpaidMonth.split('-').map(Number);
      const startDate = `${unpaidMonth}-01`;
      const endDay = new Date(year, monthNum, 0).getDate();
      const endDate = `${unpaidMonth}-${String(endDay).padStart(2, '0')}`;

      // Получаем все платежи за выбранный месяц (исключая авансовые с payment_number=0)
      let allPayments: any[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data: page, error } = await supabase
          .from('payments')
          .select('*')
          .gte('due_date', startDate)
          .lte('due_date', endDate)
          .neq('payment_number', 0)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!page || page.length === 0) break;
        allPayments = allPayments.concat(page);
        if (page.length < pageSize) break;
      }

      // Группируем по клиенту: считаем неоплаченные платежи
      const clientPayments: Record<string, any[]> = {};
      for (const p of allPayments) {
        (clientPayments[p.client_id] ||= []).push(p);
      }

      // Клиенты, у которых есть хотя бы один НЕоплаченный платёж в этом месяце
      const unpaidClientIds = Object.entries(clientPayments)
        .filter(([, list]) => list.some(p => !p.is_completed))
        .map(([id]) => id);

      if (unpaidClientIds.length === 0) {
        toast({
          title: "Нет данных",
          description: "Все клиенты внесли оплату за выбранный месяц",
        });
        return;
      }

      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .in('id', unpaidClientIds);
      if (clientsError) throw clientsError;

      const employeeIds = [...new Set((clients || []).map(c => c.employee_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', employeeIds);
      const profilesMap = (profiles || []).reduce((acc, p) => {
        acc[p.user_id] = p.full_name || 'Без имени';
        return acc;
      }, {} as Record<string, string>);

      const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString('ru-RU') : '';

      const rows = (clients || []).map(client => {
        const list = clientPayments[client.id] || [];
        const unpaid = list.filter(p => !p.is_completed);
        const paid = list.filter(p => p.is_completed);
        const unpaidSum = unpaid.reduce((s, p) => s + Number(p.custom_amount ?? p.original_amount ?? 0), 0);
        const paidSum = paid.reduce((s, p) => s + Number(p.custom_amount ?? p.original_amount ?? 0), 0);
        const dueDates = unpaid.map(p => fmtDate(p.due_date)).join(', ');
        return {
          'ФИО': client.full_name,
          'Сотрудник': profilesMap[client.employee_id] || 'Не указан',
          'Телефон/Менеджер': client.manager || '',
          'Город': client.city || '',
          'Сумма договора': client.contract_amount,
          'Ежемесячный платёж': client.monthly_payment,
          'Всего выплачено': client.total_paid,
          'Остаток': client.remaining_amount,
          'Неоплаченных платежей': unpaid.length,
          'Сумма неоплаченных': unpaidSum,
          'Оплачено в этом месяце': paidSum,
          'Даты неоплаченных платежей': dueDates,
          'Статус': client.is_terminated ? 'Расторгнут' : (client.is_suspended ? 'Приостановлен' : 'Активен'),
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = Object.keys(rows[0] || {}).map(() => ({ wch: 20 }));
      XLSX.utils.book_append_sheet(wb, ws, `Неоплатившие ${unpaidMonth}`);

      const fileName = `unpaid_clients_${unpaidMonth}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: "Экспорт завершён",
        description: `Клиентов без оплаты: ${rows.length}. Файл: ${fileName}`,
      });
    } catch (error) {
      console.error('Unpaid export error:', error);
      toast({
        title: "Ошибка экспорта",
        description: "Не удалось сформировать отчёт",
        variant: "destructive",
      });
    } finally {
      setIsExportingUnpaid(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Получаем клиентов (все, включая завершённых/приостановленных)
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

      // Получаем все платежи по этим клиентам (постранично, чтобы обойти лимит 1000)
      const clientIds = clients.map(c => c.id);
      let allPayments: any[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data: page, error: payErr } = await supabase
          .from('payments')
          .select('*')
          .in('client_id', clientIds)
          .order('client_id', { ascending: true })
          .order('payment_number', { ascending: true })
          .range(from, from + pageSize - 1);
        if (payErr) throw payErr;
        if (!page || page.length === 0) break;
        allPayments = allPayments.concat(page);
        if (page.length < pageSize) break;
      }

      // Группируем платежи по клиенту
      const paymentsByClient: Record<string, any[]> = {};
      for (const p of allPayments) {
        (paymentsByClient[p.client_id] ||= []).push(p);
      }

      const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString('ru-RU') : '';
      const fmtDateTime = (d: any) => d ? new Date(d).toLocaleString('ru-RU') : '';

      // === Лист 1: Клиенты (все поля) ===
      const exportData = clients.map(client => ({
        'ID': client.id,
        'ФИО': client.full_name,
        'Сотрудник': profilesMap[client.employee_id] || 'Не указан',
        'ID Сотрудника': client.employee_id,
        'Менеджер': client.manager || '',
        'Город': client.city || '',
        'Источник': client.source || '',
        'Дата договора': fmtDate(client.contract_date),
        'Сумма договора': client.contract_amount,
        'Период рассрочки (месяцы)': client.installment_period,
        'Первый взнос': client.first_payment,
        'Ежемесячный платеж': client.monthly_payment,
        'День платежа': client.payment_day,
        'Остаток к доплате': client.remaining_amount,
        'Всего выплачено': client.total_paid,
        'Депозит выплачен': client.deposit_paid,
        'Цель депозита': client.deposit_target,
        'Завершен': client.is_terminated ? 'Да' : 'Нет',
        'Причина завершения': client.termination_reason || '',
        'Дата завершения': fmtDateTime(client.terminated_at),
        'Приостановлен': client.is_suspended ? 'Да' : 'Нет',
        'Причина приостановки': client.suspension_reason || '',
        'Дата приостановки': fmtDateTime(client.suspended_at),
        'Дата выполнения': fmtDateTime(client.completed_at),
        'Кол-во платежей': (paymentsByClient[client.id] || []).length,
        'Выполнено платежей': (paymentsByClient[client.id] || []).filter(p => p.is_completed).length,
        'Дата создания': fmtDateTime(client.created_at),
        'Дата обновления': fmtDateTime(client.updated_at),
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = Object.keys(exportData[0] || {}).map(() => ({ wch: 18 }));
      XLSX.utils.book_append_sheet(wb, ws, 'Клиенты');

      // === Лист 2: Все платежи (длинный формат) ===
      const paymentsRows = allPayments.map(p => {
        const c = clients.find(cl => cl.id === p.client_id);
        return {
          'ID платежа': p.id,
          'ID клиента': p.client_id,
          'Клиент': c?.full_name || '',
          'Сотрудник': c ? (profilesMap[c.employee_id] || 'Не указан') : '',
          '№ платежа': p.payment_number,
          'Тип': p.payment_type === 'advance' ? 'Авансовый' : (p.payment_type === 'first' ? 'Первый' : 'Ежемесячный'),
          'Дата платежа': fmtDate(p.due_date),
          'Сумма (план)': p.original_amount,
          'Сумма (факт)': p.custom_amount ?? p.original_amount,
          'Счёт': p.account || '',
          'Выполнен': p.is_completed ? 'Да' : 'Нет',
          'Дата выполнения': fmtDateTime(p.completed_at),
          'Создан': fmtDateTime(p.created_at),
          'Обновлён': fmtDateTime(p.updated_at),
        };
      });
      const wsPayments = XLSX.utils.json_to_sheet(paymentsRows);
      wsPayments['!cols'] = Object.keys(paymentsRows[0] || {}).map(() => ({ wch: 18 }));
      XLSX.utils.book_append_sheet(wb, wsPayments, 'Платежи');

      // === Лист 3: Клиенты с разбивкой по платежам (широкий формат) ===
      const maxPayments = Math.max(0, ...Object.values(paymentsByClient).map(arr => arr.length));
      const wideRows = clients.map(client => {
        const row: Record<string, any> = {
          'ФИО': client.full_name,
          'Сотрудник': profilesMap[client.employee_id] || 'Не указан',
          'Дата договора': fmtDate(client.contract_date),
          'Сумма договора': client.contract_amount,
          'Период (мес)': client.installment_period,
          'Ежемесячный платеж': client.monthly_payment,
          'Всего выплачено': client.total_paid,
          'Остаток': client.remaining_amount,
        };
        const list = (paymentsByClient[client.id] || []).slice().sort((a, b) => (a.payment_number || 0) - (b.payment_number || 0));
        for (let i = 0; i < maxPayments; i++) {
          const p = list[i];
          row[`Платёж ${i + 1} — дата`] = p ? fmtDate(p.due_date) : '';
          row[`Платёж ${i + 1} — сумма`] = p ? (p.custom_amount ?? p.original_amount) : '';
          row[`Платёж ${i + 1} — статус`] = p ? (p.is_completed ? 'Оплачен' : 'Ожидает') : '';
        }
        return row;
      });
      const wsWide = XLSX.utils.json_to_sheet(wideRows);
      wsWide['!cols'] = Object.keys(wideRows[0] || {}).map(() => ({ wch: 18 }));
      XLSX.utils.book_append_sheet(wb, wsWide, 'Клиенты + платежи');

      const fileName = `clients_export_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: "Экспорт завершен",
        description: `Клиентов: ${clients.length}, платежей: ${allPayments.length}. Файл: ${fileName}`,
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

  const handleSyncToPnltracker = async () => {
    setIsSyncing(true);
    setSyncProgress({ current: 0, total: 0 });
    
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

      // Получаем всех клиентов (включая завершенных и приостановленных)
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (clientsError) throw clientsError;

      if (!clients || clients.length === 0) {
        toast({
          title: "Нет данных",
          description: "Нет клиентов для синхронизации",
          variant: "destructive",
        });
        return;
      }

      setSyncProgress({ current: 0, total: clients.length });

       let successCount = 0;
       let errorCount = 0;
       let firstError: string | null = null;

      for (let i = 0; i < clients.length; i++) {
        const client = clients[i];
        
        try {
          // Отправляем данные клиента в pnltracker
          const clientData: any = client;
          const { data: fnData, error: functionError } = await supabase.functions.invoke('send-to-pnltracker', {
            body: {
              event_type: 'new_client',
              client_name: client.full_name,
              contract_amount: client.contract_amount,
              total_paid: client.total_paid,
              installment_period: client.installment_period,
              first_payment: client.first_payment,
              monthly_payment: client.monthly_payment,
              manager: clientData.manager || '',
              city: clientData.city || '',
              source: clientData.source || '',
              contract_date: client.contract_date,
              payment_day: client.payment_day,
              date: client.contract_date,
              income_account: 'Расчетный счет',
              company: 'Спасение',
              user_id: client.employee_id || user.id,
              description: `Синхронизация существующего клиента. Остаток: ${client.remaining_amount}`
            }
          });

           if (functionError || !(fnData as any)?.success) {
             console.error('Sync error for client:', client.full_name, functionError || (fnData as any));
             if (!firstError) {
               firstError = ((fnData as any)?.error as string) || (functionError as any)?.message || 'Неизвестная ошибка';
             }
             errorCount++;
           } else {
             successCount++;
           }
        } catch (error) {
          console.error('Error syncing client:', client.full_name, error);
          errorCount++;
        }

        setSyncProgress({ current: i + 1, total: clients.length });
      }

      toast({
        title: "Синхронизация завершена",
         description: `Успешно: ${successCount}, Ошибок: ${errorCount}${firstError ? ' — ' + firstError : ''}`,
      });
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: "Ошибка синхронизации",
        description: "Не удалось синхронизировать данные",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
      setSyncProgress({ current: 0, total: 0 });
    }
  };

  const handleSyncClientsFull = async () => {
    setIsSyncingClients(true);
    
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

      // Получаем клиентов за выбранный месяц
      const monthStart = `${syncMonth}-01`;
      const [year, monthNum] = syncMonth.split('-').map(Number);
      const nextMonth = monthNum === 12 ? 1 : monthNum + 1;
      const nextYear = monthNum === 12 ? year + 1 : year;
      const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .gte('contract_date', monthStart)
        .lt('contract_date', monthEnd)
        .eq('is_terminated', false)
        .eq('is_suspended', false)
        .order('contract_date', { ascending: true });

      if (clientsError) throw clientsError;

      if (!clients || clients.length === 0) {
        toast({
          title: "Нет данных",
          description: `Нет клиентов за ${syncMonth} для синхронизации`,
          variant: "destructive",
        });
        return;
      }

      // Получаем имена сотрудников для created_by
      const employeeIds = [...new Set(clients.map(c => c.employee_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', employeeIds);

      const profilesMap = (profiles || []).reduce((acc, profile) => {
        acc[profile.user_id] = profile.full_name || 'Без имени';
        return acc;
      }, {} as Record<string, string>);

      // Формируем payload
      const clientsData = clients.map(client => ({
        full_name: client.full_name,
        contract_amount: client.contract_amount,
        first_payment: client.first_payment,
        installment_period: client.installment_period,
        monthly_payment: client.monthly_payment,
        contract_date: client.contract_date,
        source: client.source || '',
        city: client.city || '',
        manager: client.manager || '',
        created_by: client.employee_id ? profilesMap[client.employee_id] || '' : '',
        total_paid: client.total_paid || 0
      }));

      const { data: fnData, error: functionError } = await supabase.functions.invoke('send-to-pnltracker', {
        body: {
          event_type: 'sync_clients_full',
          month: syncMonth,
          company: 'Спасение',
          user_id: user.id,
          clients: clientsData
        }
      });

      if (functionError || !(fnData as any)?.success) {
        console.error('Sync error:', functionError || fnData);
        toast({
          title: "Ошибка синхронизации",
          description: (fnData as any)?.error || functionError?.message || 'Неизвестная ошибка',
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Синхронизация завершена",
        description: `Успешно синхронизировано ${clients.length} клиентов за ${syncMonth}`,
      });
    } catch (error) {
      console.error('Sync clients error:', error);
      toast({
        title: "Ошибка синхронизации",
        description: "Не удалось синхронизировать клиентов",
        variant: "destructive",
      });
    } finally {
      setIsSyncingClients(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

        {/* Синхронизация с pnltracker */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Синхронизация PnL
            </CardTitle>
            <CardDescription>
              Отправить данные существующих клиентов в PnL Tracker
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={handleSyncToPnltracker}
              disabled={isSyncing}
              className="w-full"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Синхр... ({syncProgress.current}/{syncProgress.total})
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Синхронизировать
                </>
              )}
            </Button>
            {isSyncing && (
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 0}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Синхронизация клиентов за месяц */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Клиенты за месяц
            </CardTitle>
            <CardDescription>
              Синхронизировать всех клиентов за выбранный месяц
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="sync-month">Месяц</Label>
              <Input
                id="sync-month"
                type="month"
                value={syncMonth}
                onChange={(e) => setSyncMonth(e.target.value)}
                className="mt-2"
              />
            </div>
            <Button 
              onClick={handleSyncClientsFull}
              disabled={isSyncingClients}
              className="w-full"
            >
              {isSyncingClients ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Синхронизация...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Синхронизировать
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Экспорт клиентов без оплаты за месяц */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Не внесли оплату за месяц
            </CardTitle>
            <CardDescription>
              Выгрузить в Excel клиентов без оплаты за выбранный месяц
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="unpaid-month">Месяц</Label>
              <Input
                id="unpaid-month"
                type="month"
                value={unpaidMonth}
                onChange={(e) => setUnpaidMonth(e.target.value)}
                className="mt-2"
              />
            </div>
            <Button
              onClick={handleExportUnpaid}
              disabled={isExportingUnpaid}
              className="w-full"
            >
              {isExportingUnpaid ? (
                <>Формируем...</>
              ) : (
                <>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Скачать Excel
                </>
              )}
            </Button>
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