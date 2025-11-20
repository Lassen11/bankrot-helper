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
    console.log('get-payment-summary called', { 
      hasEmployeeId: !!new URL(req.url).searchParams.get('employee_id')
    });

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

    // Get active clients with monthly_payment
    let clientsQuery = supabase
      .from('clients')
      .select('id, user_id, monthly_payment')
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
      .select('is_completed, original_amount, custom_amount, client_id')
      .gte('due_date', startDate.toISOString().split('T')[0])
      .lte('due_date', endDate.toISOString().split('T')[0])
      .neq('payment_number', 0) // Exclude advance payments
      .in('client_id', clientIds);

    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError);
      throw paymentsError;
    }

    // Create Map for fast access to monthly_payment
    const clientsMap = new Map(clients.map(c => [c.id, c.monthly_payment]));

    // Calculate unique clients with payments
    const uniqueClientsWithPayments = new Set<string>();
    const clientsWithCompletedPayments = new Set<string>();

    if (payments) {
      payments.forEach(payment => {
        uniqueClientsWithPayments.add(payment.client_id);
        if (payment.is_completed) {
          clientsWithCompletedPayments.add(payment.client_id);
        }
      });
    }

    // Sum monthly_payment for planned sum (for unique clients)
    let totalPaymentsSum = 0;
    uniqueClientsWithPayments.forEach(clientId => {
      const monthlyPayment = clientsMap.get(clientId) || 0;
      totalPaymentsSum += monthlyPayment;
    });

    // Sum actual payments (custom_amount or original_amount) for completed
    let completedPaymentsSum = 0;
    if (payments) {
      payments.forEach(payment => {
        if (payment.is_completed) {
          const amount = payment.custom_amount ?? payment.original_amount;
          completedPaymentsSum += amount;
        }
      });
    }

    const totalPaymentsCount = uniqueClientsWithPayments.size;
    const completedPaymentsCount = clientsWithCompletedPayments.size;

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
