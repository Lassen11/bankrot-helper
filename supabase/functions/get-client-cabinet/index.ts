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
      .select('id, full_name, contract_date, employee_id, contract_amount, total_paid, deposit_paid, deposit_target, monthly_payment, installment_period, first_payment, remaining_amount')
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

    // Get stage files
    const { data: stageFiles } = await supabase
      .from('bankruptcy_stage_files')
      .select('id, stage_id, file_name, file_path, file_size')
      .eq('client_id', tokenData.client_id)
      .order('created_at', { ascending: true })

    // Build public URLs and attach files to stages
    const filesByStage: Record<string, Array<{ id: string; file_name: string; file_url: string; file_size: number }>> = {}
    if (stageFiles) {
      for (const f of stageFiles) {
        const { data: urlData } = supabase.storage.from('cabinet-files').getPublicUrl(f.file_path)
        if (!filesByStage[f.stage_id]) filesByStage[f.stage_id] = []
        filesByStage[f.stage_id].push({
          id: f.id,
          file_name: f.file_name,
          file_url: urlData.publicUrl,
          file_size: f.file_size,
        })
      }
    }

    const stagesWithFiles = (stages || []).map((s: any) => ({
      ...s,
      files: filesByStage[s.id] || [],
    }))

    // Get payments
    const { data: payments } = await supabase
      .from('payments')
      .select('payment_number, original_amount, custom_amount, due_date, is_completed, payment_type, completed_at')
      .eq('client_id', tokenData.client_id)
      .order('payment_number', { ascending: true })

    return new Response(
      JSON.stringify({
        client: {
          id: client.id,
          full_name: client.full_name,
          contract_date: client.contract_date,
          contract_amount: client.contract_amount,
          total_paid: client.total_paid,
          deposit_paid: client.deposit_paid,
          deposit_target: client.deposit_target,
          monthly_payment: client.monthly_payment,
          installment_period: client.installment_period,
          first_payment: client.first_payment,
          remaining_amount: client.remaining_amount,
        },
        stages: stagesWithFiles,
        employee,
        employees,
        payments: payments || [],
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
