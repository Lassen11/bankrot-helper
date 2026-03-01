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

    // Get team employees from client_employees table
    const { data: teamRows } = await supabase
      .from('client_employees')
      .select('employee_id, role_label')
      .eq('client_id', client.id)

    // Collect all employee IDs (main + team)
    const employeeIds = new Set<string>()
    if (client.employee_id) employeeIds.add(client.employee_id)
    if (teamRows) {
      for (const row of teamRows) {
        employeeIds.add(row.employee_id)
      }
    }

    // Fetch profiles for all employees
    const employees: Array<{ full_name: string | null; avatar_url: string | null; bio: string | null; role_label: string | null }> = []

    if (employeeIds.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, bio')
        .in('user_id', Array.from(employeeIds))

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || [])
      const teamMap = new Map(teamRows?.map((r) => [r.employee_id, r.role_label]) || [])

      // Add main employee first
      if (client.employee_id && profileMap.has(client.employee_id)) {
        const p = profileMap.get(client.employee_id)!
        employees.push({
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          bio: p.bio,
          role_label: teamMap.get(client.employee_id) || null,
        })
      }

      // Add team members (skip main employee to avoid duplicates)
      if (teamRows) {
        for (const row of teamRows) {
          if (row.employee_id === client.employee_id) continue
          const p = profileMap.get(row.employee_id)
          if (p) {
            employees.push({
              full_name: p.full_name,
              avatar_url: p.avatar_url,
              bio: p.bio,
              role_label: row.role_label,
            })
          }
        }
      }
    }

    // backward compat: also return single employee
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
