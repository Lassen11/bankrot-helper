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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const { action, token, message, file_url, file_name } = body

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify token and get client_id
    const { data: tokenData, error: tokenError } = await supabase
      .from('client_cabinet_tokens')
      .select('client_id, is_active')
      .eq('token', token)
      .single()

    if (tokenError || !tokenData || !tokenData.is_active) {
      return new Response(
        JSON.stringify({ error: 'Invalid or inactive token' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const clientId = tokenData.client_id

    if (action === 'get_messages') {
      const { data: messages, error } = await supabase
        .from('cabinet_messages')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true })

      if (error) throw error

      return new Response(
        JSON.stringify({ messages }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'send_message') {
      if (!message && !file_url) {
        return new Response(
          JSON.stringify({ error: 'Message or file is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: newMessage, error } = await supabase
        .from('cabinet_messages')
        .insert({
          client_id: clientId,
          sender_type: 'client',
          message: message || '',
          file_url: file_url || null,
          file_name: file_name || null,
        })
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ message: newMessage }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Upload file for client (via base64)
    if (action === 'upload_file') {
      const { file_data, file_name: fname, content_type } = body
      if (!file_data || !fname) {
        return new Response(
          JSON.stringify({ error: 'file_data and file_name required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const bytes = Uint8Array.from(atob(file_data), c => c.charCodeAt(0))
      const filePath = `${clientId}/${Date.now()}_${fname}`

      const { error: uploadError } = await supabase.storage
        .from('cabinet-files')
        .upload(filePath, bytes, { contentType: content_type || 'application/octet-stream' })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('cabinet-files')
        .getPublicUrl(filePath)

      return new Response(
        JSON.stringify({ file_url: urlData.publicUrl, file_name: fname }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Cabinet chat error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
