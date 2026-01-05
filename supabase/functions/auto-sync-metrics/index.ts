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

    const now = new Date();

    console.log(`Auto-sync metrics for all time`);

    // Получаем всех клиентов
    const { data: allClients, error: clientsError } = await supabase
      .from('clients')
      .select('*');

    if (clientsError) {
      throw new Error(`Error fetching clients: ${clientsError.message}`);
    }

    const clients = allClients || [];

    // Все новые клиенты (за всё время)
    const newClientsCount = clients.length;
    const newClientsMonthlyPaymentSum = clients.reduce((sum, c) => sum + (c.monthly_payment || 0), 0);

    // Все завершённые клиенты (за всё время)
    const completedClients = clients.filter(c => c.completed_at);
    const completedClientsCount = completedClients.length;
    const completedClientsMonthlyPaymentSum = completedClients.reduce((sum, c) => sum + (c.monthly_payment || 0), 0);

    // Остаток платежей (только активные клиенты)
    const activeClients = clients.filter(c => !c.is_terminated && !c.is_suspended && !c.completed_at);
    const totalRemainingAmount = activeClients.reduce((sum, c) => sum + (c.remaining_amount || 0), 0);

    // Все расторгнутые клиенты (за всё время)
    const terminatedClients = clients.filter(c => c.is_terminated);
    const terminatedClientsCount = terminatedClients.length;
    const terminatedContractAmount = terminatedClients.reduce((sum, c) => sum + (c.contract_amount || 0), 0);

    // Все приостановленные клиенты (за всё время)
    const suspendedClients = clients.filter(c => c.is_suspended);
    const suspendedClientsCount = suspendedClients.length;
    const suspendedContractAmount = suspendedClients.reduce((sum, c) => sum + (c.contract_amount || 0), 0);

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
      period: 'all_time'
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
