import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { token } = await req.json()

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verify token
    const { data: tokenData, error: tokenError } = await supabase
      .from('client_cabinet_tokens')
      .select('client_id, is_active')
      .eq('token', token)
      .single()

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!tokenData.is_active) {
      return new Response(
        JSON.stringify({ error: 'Token is deactivated' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get client info
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, full_name, contract_date, employee_id')
      .eq('id', tokenData.client_id)
      .single()

    if (clientError || !client) {
      return new Response(
        JSON.stringify({ error: 'Client not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get team members directly from client_employees
    const { data: teamMembers } = await supabase
      .from('client_employees')
      .select('full_name, avatar_url, bio, role_label')
      .eq('client_id', client.id)
      .order('created_at', { ascending: true })

    // Also get main employee from profiles for backward compat
    let mainEmployee = null
    if (client.employee_id) {
      const { data: empData } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, bio')
        .eq('user_id', client.employee_id)
        .single()

      if (empData) {
        mainEmployee = {
          full_name: empData.full_name,
          avatar_url: empData.avatar_url,
          bio: empData.bio,
          role_label: null,
        }
      }
    }

    // Build employees array: main employee first, then team
    const employees: Array<{ full_name: string | null; avatar_url: string | null; bio: string | null; role_label: string | null }> = []
    if (mainEmployee) employees.push(mainEmployee)
    if (teamMembers) {
      for (const m of teamMembers) {
        employees.push({
          full_name: m.full_name,
          avatar_url: m.avatar_url,
          bio: m.bio,
          role_label: m.role_label,
        })
      }
    }

    const employee = employees.length > 0 ? employees[0] : null

    // Get stages
    const { data: stages, error: stagesError } = await supabase
      .from('bankruptcy_stages')
      .select('*')
      .eq('client_id', tokenData.client_id)
      .order('stage_number', { ascending: true })

    if (stagesError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch stages' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        client: { id: client.id, full_name: client.full_name, contract_date: client.contract_date },
        stages,
        employee,
        employees,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
