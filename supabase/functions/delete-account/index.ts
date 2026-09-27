import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PRIMARY_ADMIN_UID = 'a854c1f9-292f-49ac-89c0-37dd509e683d'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders })
  }

  const authorization = request.headers.get('Authorization') || ''
  const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!accessToken) {
    return Response.json({ error: 'Sign in before deleting your account.' }, { status: 401, headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return Response.json({ error: 'Account deletion is not configured.' }, { status: 500, headers: corsHeaders })
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data: { user }, error: authError } = await authClient.auth.getUser(accessToken)
  if (authError || !user) {
    return Response.json({ error: 'Your session is invalid or expired. Sign in again.' }, { status: 401, headers: corsHeaders })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (user.id === PRIMARY_ADMIN_UID || profileError || profile?.role?.toLowerCase() === 'admin') {
    return Response.json({ error: 'Administrator accounts cannot be deleted from this control.' }, { status: 403, headers: corsHeaders })
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)
  if (deleteError) {
    console.error('Auth user deletion failed:', deleteError.message)
    return Response.json({ error: 'Supabase could not delete this account.' }, { status: 500, headers: corsHeaders })
  }

  return Response.json({ success: true }, { headers: corsHeaders })
})
