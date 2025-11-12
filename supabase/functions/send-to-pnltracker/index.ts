import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const PNLTRACKER_WEBHOOK_URL = "https://rdpxbbddqxwbufzqozqz.supabase.co/functions/v1/webhook-from-bankrot";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NewClientPayload {
  event_type: 'new_client';
  client_name: string;
  organization_name?: string;
  contract_amount: number;
  total_paid?: number;
  installment_period?: number;
  first_payment: number;
  monthly_payment?: number;
  manager?: string;
  city?: string;
  source?: string;
  date: string;
  payment_day?: number;
  income_account: string;
  company: string;
  user_id: string;
  description?: string;
}

interface NewPaymentPayload {
  event_type: 'new_payment';
  client_name: string;
  organization_name?: string;
  amount: number;
  date: string;
  income_account?: string;
  company: string;
  user_id: string;
  description?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: NewClientPayload | NewPaymentPayload = await req.json();
    
    console.log('Sending data to pnltracker:', payload);

    // Отправляем данные на webhook в pnltracker
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
    console.log('Success response from pnltracker:', result);

    return new Response(
      JSON.stringify({ success: true, result }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in send-to-pnltracker function:', error);
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
