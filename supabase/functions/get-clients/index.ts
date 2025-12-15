import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const employeeId = url.searchParams.get('employee_id');
    const month = url.searchParams.get('month'); // Format: YYYY-MM
    const includeTerminated = url.searchParams.get('include_terminated') === 'true';
    const includeSuspended = url.searchParams.get('include_suspended') === 'true';

    console.log('get-clients called', { employeeId, month, includeTerminated, includeSuspended });

    let query = supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    // Filter by employee if specified
    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    }

    // Filter by creation month if specified (based on contract_date)
    if (month) {
      const monthStart = `${month}-01`;
      const [year, monthNum] = month.split('-').map(Number);
      const nextMonth = monthNum === 12 ? 1 : monthNum + 1;
      const nextYear = monthNum === 12 ? year + 1 : year;
      const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
      
      query = query.gte('contract_date', monthStart).lt('contract_date', monthEnd);
      console.log(`Filtering by month: ${monthStart} to ${monthEnd}`);
    }

    // Filter terminated clients unless explicitly included
    if (!includeTerminated) {
      query = query.eq('is_terminated', false);
    }

    // Filter suspended clients unless explicitly included
    if (!includeSuspended) {
      query = query.eq('is_suspended', false);
    }

    const { data: clients, error } = await query;

    if (error) {
      console.error('Error fetching clients:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Fetched ${clients?.length || 0} clients`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: clients,
        count: clients?.length || 0
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error in get-clients function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
