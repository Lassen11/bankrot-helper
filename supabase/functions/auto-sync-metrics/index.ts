import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PNLTRACKER_WEBHOOK_URL = "https://rdpxbbddqxwbufzqozqz.supabase.co/functions/v1/webhook-from-bankrot";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Получаем текущий месяц
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const startDateStr = startOfMonth.toISOString().split('T')[0];
    const endDateStr = endOfMonth.toISOString().split('T')[0];
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    console.log(`Auto-sync metrics for month: ${monthStr}`);

    // Получаем всех клиентов
    const { data: allClients, error: clientsError } = await supabase
      .from('clients')
      .select('*');

    if (clientsError) {
      throw new Error(`Error fetching clients: ${clientsError.message}`);
    }

    const clients = allClients || [];

    // Новые клиенты за месяц
    const newClientsThisMonth = clients.filter(c => {
      if (!c.contract_date) return false;
      const contractDate = c.contract_date.split('T')[0];
      return contractDate >= startDateStr && contractDate <= endDateStr;
    });
    const newClientsCount = newClientsThisMonth.length;
    const newClientsMonthlyPaymentSum = newClientsThisMonth.reduce((sum, c) => sum + (c.monthly_payment || 0), 0);

    // Завершённые клиенты за месяц (по полю completed_at)
    const completedThisMonth = clients.filter(c => {
      if (!c.completed_at) return false;
      const completedDate = c.completed_at.split('T')[0];
      return completedDate >= startDateStr && completedDate <= endDateStr;
    });
    const completedClientsCount = completedThisMonth.length;
    const completedClientsMonthlyPaymentSum = completedThisMonth.reduce((sum, c) => sum + (c.monthly_payment || 0), 0);

    // Остаток платежей (только активные клиенты)
    const activeClients = clients.filter(c => !c.is_terminated && !c.is_suspended && !c.completed_at);
    const totalRemainingAmount = activeClients.reduce((sum, c) => sum + (c.remaining_amount || 0), 0);

    // Расторгнутые клиенты за месяц
    const terminatedThisMonth = clients.filter(c => {
      if (!c.terminated_at) return false;
      const terminatedDate = c.terminated_at.split('T')[0];
      return terminatedDate >= startDateStr && terminatedDate <= endDateStr;
    });
    const terminatedClientsCount = terminatedThisMonth.length;
    const terminatedContractAmount = terminatedThisMonth.reduce((sum, c) => sum + (c.contract_amount || 0), 0);

    // Приостановленные клиенты за месяц
    const suspendedThisMonth = clients.filter(c => {
      if (!c.suspended_at) return false;
      const suspendedDate = c.suspended_at.split('T')[0];
      return suspendedDate >= startDateStr && suspendedDate <= endDateStr;
    });
    const suspendedClientsCount = suspendedThisMonth.length;
    const suspendedContractAmount = suspendedThisMonth.reduce((sum, c) => sum + (c.contract_amount || 0), 0);

    const payload = {
      event_type: 'dashboard_metrics',
      new_clients_count: newClientsCount,
      new_clients_monthly_payment_sum: newClientsMonthlyPaymentSum,
      completed_clients_count: completedClientsCount,
      completed_clients_monthly_payment_sum: completedClientsMonthlyPaymentSum,
      remaining_payments_sum: totalRemainingAmount,
      terminated_clients_count: terminatedClientsCount,
      terminated_contract_amount: terminatedContractAmount,
      suspended_clients_count: suspendedClientsCount,
      suspended_contract_amount: suspendedContractAmount,
      company: 'Спасение',
      user_id: 'auto-sync',
      date: now.toISOString(),
      month: monthStr
    };

    console.log('Sending auto-sync metrics to pnltracker:', JSON.stringify(payload));

    const response = await fetch(PNLTRACKER_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response from pnltracker:', errorText);
      throw new Error(`Webhook failed with status ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('Auto-sync success:', result);

    return new Response(
      JSON.stringify({ success: true, payload, result }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in auto-sync-metrics function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
