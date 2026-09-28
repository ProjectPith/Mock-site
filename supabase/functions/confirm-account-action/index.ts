import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const PRIMARY_ADMIN_UID = 'a854c1f9-292f-49ac-89c0-37dd509e683d'

function hashToken(token: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: 'Account confirmation is not configured.' }, { status: 500, headers: corsHeaders })
  }

  const url = new URL(request.url)
  const token = url.searchParams.get('token') || ''
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return Response.json({ error: 'This confirmation link is invalid or incomplete.' }, { status: 400, headers: corsHeaders })
  }

  if (request.method === 'GET' && url.searchParams.get('inspect') !== '1') {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `https://lunarcraft.dev/account-confirmation.html?token=${encodeURIComponent(token)}`,
        'Cache-Control': 'no-store',
      },
    })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const tokenHash = toHex(await hashToken(token))

  if (request.method === 'GET') {
    const { data: pending, error } = await adminClient
      .from('account_action_requests')
      .select('action_type, password_change')
      .eq('token_hash', tokenHash)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()
    if (error || !pending) {
      return Response.json({ error: 'This confirmation link is expired or has already been used. Request a new one from Account Details.' }, { status: 410, headers: corsHeaders })
    }

    return Response.json({
      action_type: pending.action_type,
      password_change: pending.password_change,
    }, { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders })
  }

  try {
    const body = await request.json()
    if (body?.token !== token) {
      return Response.json({ error: 'Invalid confirmation token.' }, { status: 400, headers: corsHeaders })
    }

    const { data: pending } = await adminClient
      .from('account_action_requests')
      .select('*')
      .eq('token_hash', tokenHash)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()
    if (!pending) {
      return Response.json({ error: 'This confirmation link is expired or already used.' }, { status: 410, headers: corsHeaders })
    }

    const password = typeof body.password === 'string' ? body.password : ''
    if (pending.password_change && password.length < 8) {
      return Response.json({ error: 'Choose a password with at least 8 characters.' }, { status: 400, headers: corsHeaders })
    }

    if (pending.action_type === 'delete') {
      const { data: profile, error: profileError } = await adminClient
        .from('profiles')
        .select('role')
        .eq('id', pending.user_id)
        .maybeSingle()
      if (profileError || pending.user_id === PRIMARY_ADMIN_UID || profile?.role?.toLowerCase() === 'admin') {
        return Response.json({ error: 'Administrator accounts cannot be deleted from this link.' }, { status: 403, headers: corsHeaders })
      }
    }

    const { data: claimedRows, error: claimError } = await adminClient.rpc(
      'claim_account_action_request',
      { p_token_hash: tokenHash }
    )
    if (claimError || !claimedRows?.length) {
      return Response.json({ error: 'This confirmation link is expired or already used.' }, { status: 410, headers: corsHeaders })
    }

    if (pending.action_type === 'delete') {
      const { error } = await adminClient.auth.admin.deleteUser(pending.user_id)
      if (error) throw error
      return Response.json({ success: true, message: 'Your account has been permanently deleted.' }, { headers: corsHeaders })
    }

    const { data: authUserData, error: getUserError } = await adminClient.auth.admin.getUserById(pending.user_id)
    if (getUserError || !authUserData.user) throw getUserError || new Error('Account not found.')

    const changes = pending.change_payload || {}
    const currentMetadata = authUserData.user.user_metadata || {}
    const updateAttributes: Record<string, unknown> = {
      user_metadata: {
        ...currentMetadata,
        full_name: changes.full_name,
        phone: changes.phone,
      },
    }
    if (changes.email && changes.email.toLowerCase() !== authUserData.user.email?.toLowerCase()) {
      updateAttributes.email = changes.email
      updateAttributes.email_confirm = true
    }
    if (pending.password_change) updateAttributes.password = password

    const { data: updatedUserData, error: updateError } = await adminClient.auth.admin.updateUserById(
      pending.user_id,
      updateAttributes
    )
    if (updateError || !updatedUserData.user) throw updateError || new Error('Account update failed.')

    const { data: currentProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', pending.user_id)
      .maybeSingle()
    const { error: profileError } = await adminClient.from('profiles').upsert({
      id: pending.user_id,
      email: updatedUserData.user.email,
      full_name: changes.full_name,
      role: currentProfile?.role || 'client',
    }, { onConflict: 'id' })
    if (profileError) throw profileError

    return Response.json({
      success: true,
      message: 'Your account changes are confirmed and have been applied.',
    }, { headers: corsHeaders })
  } catch (error) {
    console.error('Account confirmation failed:', error instanceof Error ? error.message : 'Unknown error')
    return Response.json({ error: 'Could not apply this confirmation. Request a new link and try again.' }, { status: 500, headers: corsHeaders })
  }
})
