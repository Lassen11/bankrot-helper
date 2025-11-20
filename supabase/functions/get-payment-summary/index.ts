import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

interface PaymentSummaryResponse {
  success: boolean;
  data?: {
    total_payments_sum: number;
    completed_payments_sum: number;
    total_payments_count: number;
    completed_payments_count: number;
    month: string;
    employee_id?: string;
  };
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify API key
    const apiKey = req.headers.get('x-api-key');
    const expectedApiKey = Deno.env.get('PNLTRACKER_API_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    console.log('API Key validation - Has expectedApiKey:', !!expectedApiKey);
    console.log('API Key validation - Has supabaseAnonKey:', !!supabaseAnonKey);
    console.log('API Key validation - Has incoming apiKey:', !!apiKey);
    console.log('API Key validation - apiKey length:', apiKey?.length);
    console.log('API Key validation - expectedApiKey length:', expectedApiKey?.length);
    console.log('API Key validation - supabaseAnonKey length:', supabaseAnonKey?.length);

    if (!expectedApiKey && !supabaseAnonKey) {
      console.error('PNLTRACKER_API_KEY and SUPABASE_ANON_KEY are not set in Supabase secrets');
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error: missing API keys' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (!apiKey) {
      console.error('Missing x-api-key header on request to get-payment-summary');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: missing API key' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const matchesExpectedKey = expectedApiKey && apiKey === expectedApiKey;
    const matchesSupabaseKey = supabaseAnonKey && apiKey === supabaseAnonKey;
    
    console.log('API Key validation - Matches expectedApiKey:', matchesExpectedKey);
    console.log('API Key validation - Matches supabaseAnonKey:', matchesSupabaseKey);

    const isValidApiKey = matchesExpectedKey || matchesSupabaseKey;

    if (!isValidApiKey) {
      console.error('Invalid API key provided to get-payment-summary');
      console.error('First 10 chars of incoming key:', apiKey?.substring(0, 10));
      console.error('First 10 chars of expected key:', expectedApiKey?.substring(0, 10));
      console.error('First 10 chars of supabase key:', supabaseAnonKey?.substring(0, 10));
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: invalid API key' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Initialize Supabase client with service role key for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get optional employee_id from query params
    const url = new URL(req.url);
    const employeeId = url.searchParams.get('employee_id');

    console.log('Fetching payment summary', employeeId ? `for employee: ${employeeId}` : 'for all employees');

    // Get current month date range
    const currentDate = new Date();
    const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    // Get active clients
    let clientsQuery = supabase
      .from('clients')
      .select('id, user_id')
      .eq('is_terminated', false)
      .eq('is_suspended', false);

    if (employeeId) {
      clientsQuery = clientsQuery.eq('user_id', employeeId);
    }

    const { data: clients, error: clientsError } = await clientsQuery;

    if (clientsError) {
      console.error('Error fetching clients:', clientsError);
      throw clientsError;
    }

    if (!clients || clients.length === 0) {
      console.log('No active clients found');
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            total_payments_sum: 0,
            completed_payments_sum: 0,
            total_payments_count: 0,
            completed_payments_count: 0,
            month: currentDate.toISOString().slice(0, 7),
            ...(employeeId && { employee_id: employeeId }),
          },
        } as PaymentSummaryResponse),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get payments for current month
    const clientIds = clients.map(c => c.id);
    
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('is_completed, original_amount, custom_amount')
      .gte('due_date', startDate.toISOString().split('T')[0])
      .lte('due_date', endDate.toISOString().split('T')[0])
      .neq('payment_number', 0) // Exclude advance payments
      .in('client_id', clientIds);

    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError);
      throw paymentsError;
    }

    // Calculate totals
    let totalPaymentsSum = 0;
    let completedPaymentsSum = 0;
    let totalPaymentsCount = 0;
    let completedPaymentsCount = 0;

    if (payments) {
      payments.forEach(payment => {
        const amount = payment.custom_amount || payment.original_amount;
        totalPaymentsSum += amount;
        totalPaymentsCount++;

        if (payment.is_completed) {
          completedPaymentsSum += amount;
          completedPaymentsCount++;
        }
      });
    }

    const response: PaymentSummaryResponse = {
      success: true,
      data: {
        total_payments_sum: Math.round(totalPaymentsSum * 100) / 100,
        completed_payments_sum: Math.round(completedPaymentsSum * 100) / 100,
        total_payments_count: totalPaymentsCount,
        completed_payments_count: completedPaymentsCount,
        month: currentDate.toISOString().slice(0, 7),
        ...(employeeId && { employee_id: employeeId }),
      },
    };

    console.log('Payment summary calculated:', response.data);

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in get-payment-summary:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
