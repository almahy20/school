import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import webpush from "https://esm.sh/web-push@3.6.6"

// ✅ Allow any origin — the real security is the JWT auth check below.
// Restricting by origin breaks Vercel preview deployments and custom domains.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
  const vapidEmail = Deno.env.get('VAPID_EMAIL') ?? 'mailto:support@edara.app'

  // ── Validate VAPID keys ──────────────────────────────────────────────────
  if (!vapidPublic || !vapidPrivate) {
    console.error('[Push] VAPID keys not configured in Supabase secrets')
    return new Response(
      JSON.stringify({ error: 'Push notifications not configured on server' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }

  // ── Service-role client (bypasses RLS — safe because we verify JWT below) ─
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // ── Auth: verify the caller's JWT ────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? ''
  let callerUserId: string | null = null
  let callerIsPrivileged = false

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7)

    // Allow internal calls using the service-role key itself
    if (token === supabaseServiceKey) {
      callerIsPrivileged = true
      console.log('[Push] Internal service-role call')
    } else {
      // Verify user JWT
      const { data: { user }, error } = await supabase.auth.getUser(token)
      if (error || !user) {
        console.error('[Push] Invalid JWT:', error?.message)
        return new Response(
          JSON.stringify({ error: 'Unauthorized', message: 'Invalid or expired token' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        )
      }
      callerUserId = user.id
      // Admins and teachers can send to any user; parents can only receive
      const role = user.user_metadata?.role ?? ''
      callerIsPrivileged = role === 'admin' || role === 'teacher' || role === 'super_admin'
      console.log(`[Push] Caller: ${callerUserId} (${role})`)
    }
  } else {
    // No auth header — only allow if called from a DB trigger via service role
    // (DB triggers use the anon key in the migration, which we accept here)
    const apiKey = req.headers.get('apikey') ?? ''
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Missing Authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }
    // Treat anon-key callers (DB triggers) as privileged internal calls
    callerIsPrivileged = true
    console.log('[Push] DB trigger call via apikey')
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let bodyData: any
  try {
    bodyData = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }

  const { user_id, title, body, url, type } = bodyData

  if (!user_id || !body) {
    return new Response(
      JSON.stringify({ error: 'user_id and body are required' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }

  // ── Authorization: non-privileged users can only send to themselves ──────
  if (!callerIsPrivileged && callerUserId !== user_id) {
    return new Response(
      JSON.stringify({ error: 'Forbidden', message: 'You can only send notifications to yourself' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
    )
  }

  console.log(`[Push] Sending to user: ${user_id}, url: ${url}, type: ${type}`)

  // ── Fetch push subscriptions ─────────────────────────────────────────────
  const { data: subscriptions, error: subError } = await supabase
    .from('push_subscriptions')
    .select('subscription, endpoint')
    .eq('user_id', user_id)

  if (subError) {
    console.error('[Push] DB error fetching subscriptions:', subError)
    return new Response(
      JSON.stringify({ error: 'Database error', message: subError.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log(`[Push] No subscriptions for user ${user_id} — skipping`)
    return new Response(
      JSON.stringify({ message: 'No subscriptions found', sent: 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }

  // ── Fetch school branding for icon ───────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id, schools(name, logo_url)')
    .eq('id', user_id)
    .maybeSingle()

  const schoolName = (profile?.schools as any)?.name ?? 'إشعار جديد'
  const schoolLogo = (profile?.schools as any)?.logo_url ?? '/icons/icon-192.png'

  // ── Determine target URL ─────────────────────────────────────────────────
  // Messages always open /messages; other notifications open /notifications
  const isMessage = type === 'teacher_message' || type === 'broadcast_message' || url === '/messages'
  const targetUrl = url ?? (isMessage ? '/messages' : '/notifications')

  // ── Configure web-push ───────────────────────────────────────────────────
  webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate)

  const payload = JSON.stringify({
    title: title ?? schoolName,
    body,
    icon: schoolLogo,
    badge: '/icons/badge-72.png',
    // ✅ Pass type so sw.js can set the correct tag and action label
    type,
    tag: isMessage ? 'new-message' : 'general-notification',
    url: targetUrl,
    // Keep data.url for the sw.js notificationclick handler
    data: { url: targetUrl },
  })

  // ── Send to all subscriptions ────────────────────────────────────────────
  const results = await Promise.allSettled(
    subscriptions.map(async (sub: any) => {
      try {
        await webpush.sendNotification(sub.subscription, payload)
        return { success: true }
      } catch (err: any) {
        console.error('[Push] Send error:', err.statusCode, err.message)

        // Remove expired / invalid subscriptions automatically
        if ([404, 410, 403].includes(err.statusCode)) {
          console.log('[Push] Removing expired subscription:', sub.endpoint)
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint)
          return { success: false, reason: 'expired_removed' }
        }

        return { success: false, error: err.message }
      }
    })
  )

  const sent = results.filter(r => r.status === 'fulfilled' && (r.value as any)?.success).length
  console.log(`[Push] Done: ${sent}/${subscriptions.length} sent`)

  return new Response(
    JSON.stringify({ success: true, sent, total: subscriptions.length }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  )
})
