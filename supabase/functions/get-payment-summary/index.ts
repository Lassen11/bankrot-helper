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
    const url = new URL(req.url);
    const employeeId = url.searchParams.get('employee_id');
    const monthParam = url.searchParams.get('month'); // Format: YYYY-MM

    console.log('get-payment-summary called', { 
      hasEmployeeId: !!employeeId,
      monthParam: monthParam
    });

    // Initialize Supabase client with service role key for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse month parameter or use current month
    let year: number;
    let month: number;
    
    if (monthParam) {
      const [yearStr, monthStr] = monthParam.split('-');
      year = parseInt(yearStr, 10);
      month = parseInt(monthStr, 10);
      
      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        console.error('Invalid month parameter:', monthParam);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Invalid month parameter. Use format YYYY-MM' 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    } else {
      const currentDate = new Date();
      year = currentDate.getFullYear();
      month = currentDate.getMonth() + 1;
    }

    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    console.log('Fetching payment summary', employeeId ? `for employee: ${employeeId}` : 'for all employees', `for month: ${monthStr}`);

    // Get month date range (use date strings to avoid timezone issues)
    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

    // Get all clients (we'll filter suspended/terminated based on date)
    let clientsQuery = supabase
      .from('clients')
      .select('id, user_id, monthly_payment, contract_date, is_terminated, is_suspended, terminated_at, suspended_at');

    if (employeeId) {
      clientsQuery = clientsQuery.eq('user_id', employeeId);
    }

    const { data: allClients, error: clientsError } = await clientsQuery;

    if (clientsError) {
      console.error('Error fetching clients:', clientsError);
      throw clientsError;
    }

    // Filter clients: include if active OR if terminated/suspended after the target month
    const targetMonthStart = new Date(year, month - 1, 1);
    const clients = (allClients || []).filter(client => {
      // If client is not terminated and not suspended, include them
      if (!client.is_terminated && !client.is_suspended) {
        return true;
      }
      
      // If terminated, check if termination was after the target month
      if (client.is_terminated && client.terminated_at) {
        const terminatedDate = new Date(client.terminated_at);
        const terminatedMonth = new Date(terminatedDate.getFullYear(), terminatedDate.getMonth(), 1);
        // Include if termination month is after target month
        if (terminatedMonth > targetMonthStart) {
          return true;
        }
      }
      
      // If suspended, check if suspension was after the target month
      if (client.is_suspended && client.suspended_at) {
        const suspendedDate = new Date(client.suspended_at);
        const suspendedMonth = new Date(suspendedDate.getFullYear(), suspendedDate.getMonth(), 1);
        // Include if suspension month is after target month
        if (suspendedMonth > targetMonthStart) {
          return true;
        }
      }
      
      return false;
    });

    if (!clients || clients.length === 0) {
      console.log('No active clients found for month:', monthStr);
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            total_payments_sum: 0,
            completed_payments_sum: 0,
            total_payments_count: 0,
            completed_payments_count: 0,
            month: monthStr,
            ...(employeeId && { employee_id: employeeId }),
          },
        } as PaymentSummaryResponse),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get payments for target month
    const clientIds = clients.map(c => c.id);
    
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('is_completed, original_amount, custom_amount, client_id')
      .gte('due_date', startDateStr)
      .lte('due_date', endDateStr)
      .neq('payment_number', 0) // Exclude advance payments
      .in('client_id', clientIds);

    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError);
      throw paymentsError;
    }

    // Create Map for fast access to monthly_payment and contract_date
    const clientsMap = new Map(clients.map(c => [c.id, { monthly_payment: c.monthly_payment, contract_date: c.contract_date }]));

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

    // Planned sum = sum of monthly_payment for clients with payments this month,
    // excluding new clients (created in target month)
    let totalPaymentsSum = 0;
    uniqueClientsWithPayments.forEach(clientId => {
      const clientData = clientsMap.get(clientId);
      if (clientData) {
        // Check that client is not new (contract date not in target month)
        const contractDate = new Date(clientData.contract_date);
        const targetMonth = new Date(year, month - 1, 1);
        const isNewClient = contractDate >= targetMonth && 
                           contractDate.getMonth() === month - 1 &&
                           contractDate.getFullYear() === year;
        
        if (!isNewClient) {
          totalPaymentsSum += clientData.monthly_payment || 0;
        }
      }
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
        month: monthStr,
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
