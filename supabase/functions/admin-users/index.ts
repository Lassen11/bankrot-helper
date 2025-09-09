import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get the session from the request
    const authorization = req.headers.get('Authorization')
    if (!authorization) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Verify the user is authenticated and is an admin
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authorization.replace('Bearer ', '')
    )

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleError || roleData?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Access denied. Admin role required.' }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const { method } = req
    const url = new URL(req.url)

    switch (method) {
      case 'GET':
        // List all users
        const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers()
        
        if (listError) {
          throw listError
        }

        return new Response(
          JSON.stringify({ users: users.users }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )

      case 'POST':
        // Create new user
        const { email, password, full_name, role } = await req.json()

        // Check if user already exists
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
        const existingUser = existingUsers.users?.find(u => u.email === email)

        let userId: string

        if (existingUser) {
          // User exists, check current role
          const { data: existingRole } = await supabaseAdmin
            .from('user_roles')
            .select('*')
            .eq('user_id', existingUser.id)
            .single()

          // Update user metadata if needed
          await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
            user_metadata: {
              full_name
            }
          })

          userId = existingUser.id

          if (existingRole) {
            // If user already has the requested role, return success
            if (existingRole.role === (role || 'employee')) {
              return new Response(
                JSON.stringify({ user: { id: userId, email: existingUser.email }, message: 'Пользователь уже существует с этой ролью' }),
                { 
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
              )
            }
            
            // Update existing role to new role
            const { error: roleUpdateError } = await supabaseAdmin
              .from('user_roles')
              .update({
                role: role || 'employee',
                updated_at: new Date().toISOString()
              })
              .eq('user_id', userId)

            if (roleUpdateError) {
              throw roleUpdateError
            }
          } else {
            // Create new role if none exists
            const { error: roleInsertError } = await supabaseAdmin
              .from('user_roles')
              .insert([
                {
                  user_id: userId,
                  role: role || 'employee',
                  created_by: user.id
                }
              ])

            if (roleInsertError) {
              throw roleInsertError
            }
          }
        } else {
          // Create new user
          const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: password || 'temp123456',
            email_confirm: true,
            user_metadata: {
              full_name
            }
          })

          if (createError) {
            throw createError
          }

          userId = newUser.user.id
          
          // Создаем профиль пользователя вручную
          const { error: profileInsertError } = await supabaseAdmin
            .from('profiles')
            .insert([
              {
                user_id: userId,
                full_name: full_name
              }
            ])
          
          if (profileInsertError) {
            console.error('Ошибка создания профиля:', profileInsertError);
            // Не прерываем выполнение, так как профиль может быть создан триггером
          }
          
          // Создаем роль для нового пользователя
          const { error: roleInsertError } = await supabaseAdmin
            .from('user_roles')
            .insert([
              {
                user_id: userId,
                role: role || 'employee',
                created_by: user.id
              }
            ])

          if (roleInsertError) {
            throw roleInsertError
          }
        }

        return new Response(
          JSON.stringify({ user: { id: userId, email } }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )

      case 'DELETE':
        // Delete user
        console.log('DELETE request received');
        const { userId: userIdToDelete } = await req.json()
        console.log('User ID to delete:', userIdToDelete);
        
        if (!userIdToDelete) {
          console.error('User ID is required but not provided');
          return new Response(
            JSON.stringify({ error: 'User ID is required' }),
            { 
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }

        console.log('Attempting to delete user:', userIdToDelete);
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userIdToDelete)
        
        if (deleteError) {
          console.error('Delete error:', deleteError);
          throw deleteError
        }

        console.log('User deleted successfully');
        return new Response(
          JSON.stringify({ success: true }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )

      default:
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          { 
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
    }

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})