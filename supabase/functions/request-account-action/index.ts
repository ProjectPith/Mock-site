import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders })
  }

  const accessToken = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!accessToken || !supabaseUrl || !anonKey || !serviceRoleKey) {
    return Response.json({ error: 'Sign in is required to request this account action.' }, { status: 401, headers: corsHeaders })
  }
  if (!resendApiKey) {
    return Response.json({ error: 'Confirmation email is not configured. Contact site support.' }, { status: 503, headers: corsHeaders })
  }

  try {
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    const { data: { user }, error: authError } = await authClient.auth.getUser(accessToken)
    if (authError || !user?.email) {
      return Response.json({ error: 'Your session has expired. Sign in again.' }, { status: 401, headers: corsHeaders })
    }

    const body = await request.json()
    const actionType = body?.action
    if (!['update', 'delete'].includes(actionType)) {
      return Response.json({ error: 'Invalid account action.' }, { status: 400, headers: corsHeaders })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (profileError) throw profileError
    if (actionType === 'delete' && (user.id === PRIMARY_ADMIN_UID || profile?.role?.toLowerCase() === 'admin')) {
      return Response.json({ error: 'Administrator accounts cannot be deleted from this control.' }, { status: 403, headers: corsHeaders })
    }

    let changes: Record<string, string> = {}
    if (actionType === 'update') {
      const input = body?.changes || {}
      changes = {
        full_name: String(input.full_name || '').trim(),
        phone: String(input.phone || '').trim(),
        email: String(input.email || user.email).trim().toLowerCase(),
      }
      if (!changes.full_name || changes.full_name.length > 120) {
        return Response.json({ error: 'Enter a name no longer than 120 characters.' }, { status: 400, headers: corsHeaders })
      }
      if (changes.phone.length > 40 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(changes.email)) {
        return Response.json({ error: 'Enter a valid email address and phone number.' }, { status: 400, headers: corsHeaders })
      }
    }

    await adminClient.from('account_action_requests')
      .delete()
      .eq('user_id', user.id)
      .is('used_at', null)

    const tokenBytes = crypto.getRandomValues(new Uint8Array(32))
    const token = Array.from(tokenBytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
    const tokenHash = toHex(await hashToken(token))
    const passwordChange = actionType === 'update' && body?.password_change === true
    const { error: insertError } = await adminClient
      .from('account_action_requests')
      .insert({
        user_id: user.id,
        action_type: actionType,
        change_payload: changes,
        password_change: passwordChange,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      })
    if (insertError) throw insertError

    const confirmationUrl = `${supabaseUrl}/functions/v1/confirm-account-action?token=${encodeURIComponent(token)}`
    const isDelete = actionType === 'delete'
    const recipient = actionType === 'update' ? changes.email : user.email
    const subject = isDelete ? 'Confirm account deletion' : 'Confirm account changes'
    const actionText = isDelete
      ? 'A request was made to permanently delete your LunarCraft account and associated profile.'
      : 'A request was made to change your LunarCraft account details.'
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'LunarCraft <applications@lunarcraft.dev>',
        to: [recipient],
        subject,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#17212b"><h2>${subject}</h2><p>${actionText}</p><p>This request expires in 30 minutes. No changes have been made yet.</p><p><a href="${confirmationUrl}" style="display:inline-block;padding:12px 18px;background:#87ceeb;color:#10202a;text-decoration:none;border-radius:4px">Review and confirm</a></p><p>If you did not request this, ignore this email. Your account will remain unchanged.</p></div>`,
      }),
    })

    if (!emailResponse.ok) {
      await adminClient.from('account_action_requests').delete().eq('token_hash', tokenHash)
      console.error('Account confirmation email rejected:', emailResponse.status)
      return Response.json({ error: 'The confirmation email could not be sent. No account changes were made.' }, { status: 502, headers: corsHeaders })
    }

    return Response.json({ success: true }, { headers: corsHeaders })
  } catch (error) {
    console.error('Account action request failed:', error instanceof Error ? error.message : 'Unknown error')
    return Response.json({ error: 'Could not request this account action.' }, { status: 500, headers: corsHeaders })
  }
})
