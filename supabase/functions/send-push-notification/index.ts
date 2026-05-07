
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import webpush from "https://esm.sh/web-push@3.6.6"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to get Supabase client with appropriate role
function getSupabaseClient(req: Request): { client: SupabaseClient; authError: Error | null } {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  
  // Create service role client (bypasses RLS)
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  // Try to extract JWT from Authorization header
  const authHeader = req.headers.get('Authorization')
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1]
    
    // Create client with user's token (respects RLS)
    const userClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    })
    
    return { client: userClient, authError: null }
  }

  // Fallback: Check for anon key (for webhooks)
  const anonKey = req.headers.get('apikey') || req.headers.get('x-client-info')
  if (anonKey) {
    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    return { client: anonClient, authError: null }
  }

  // Last resort: Use service role (only for internal calls)
  console.log('[Push] WARNING: No auth header provided, using service role')
  return { client: serviceClient, authError: null }
}

// Helper to verify JWT and extract user
async function verifyAuth(req: Request, supabase: SupabaseClient) {
  const authHeader = req.headers.get('Authorization')
  
  if (!authHeader) {
    return { 
      authenticated: false, 
      error: 'Missing Authorization header',
      userId: null,
      isAdmin: false
    }
  }

  // Check if it's using service role key (internal/webhook call)
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (authHeader === `Bearer ${serviceKey}`) {
    console.log('[Push] Authenticated via service role key (internal call)')
    return { 
      authenticated: true, 
      error: null,
      userId: null, // Service role can access any user
      isAdmin: true
    }
  }

  // Verify user JWT
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1]
    
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token)
      
      if (error || !user) {
        console.error('[Push] JWT verification failed:', error?.message)
        return { 
          authenticated: false, 
          error: 'Invalid or expired token',
          userId: null,
          isAdmin: false
        }
      }

      console.log(`[Push] Authenticated user: ${user.id}`)
      return { 
        authenticated: true, 
        error: null,
        userId: user.id,
        isAdmin: user.user_metadata?.role === 'admin' || user.user_metadata?.role === 'teacher'
      }
    } catch (err) {
      console.error('[Push] JWT verification error:', err)
      return { 
        authenticated: false, 
        error: 'Token verification failed',
        userId: null,
        isAdmin: false
      }
    }
  }

  return { 
    authenticated: false, 
    error: 'Invalid Authorization format. Use: Bearer <token>',
    userId: null,
    isAdmin: false
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('[Push] ===== Request Start =====')
    console.log('[Push] Method:', req.method)
    console.log('[Push] Headers:', Object.fromEntries(req.headers.entries()))

    // Get Supabase client
    const { client: supabase } = getSupabaseClient(req)

    // Verify authentication
    const auth = await verifyAuth(req, supabase)
    
    if (!auth.authenticated) {
      console.error('[Push] Authentication failed:', auth.error)
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized',
          message: auth.error,
          hint: 'Provide valid JWT token in Authorization header: Bearer <token>'
        }), 
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      )
    }

    // Parse request body
    let bodyData
    try {
      bodyData = await req.json()
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }), 
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    const { user_id, title, body, url } = bodyData

    // Validate required fields
    if (!user_id || !body) {
      return new Response(
        JSON.stringify({ 
          error: 'Bad Request',
          message: 'user_id and body are required',
          example: { user_id: 'uuid', body: 'Notification text', title: 'Optional', url: '/optional' }
        }), 
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    console.log(`[Push] Sending notification to user: ${user_id}`)
    console.log(`[Push] Requested by: ${auth.userId || 'system (service role)'}`)

    // Authorization check: Users can only send to themselves, admins/teachers can send to anyone
    if (!auth.isAdmin && auth.userId !== user_id) {
      console.error(`[Push] User ${auth.userId} tried to send notification to ${user_id}`)
      return new Response(
        JSON.stringify({ 
          error: 'Forbidden',
          message: 'You can only send notifications to yourself'
        }), 
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      )
    }

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', user_id)

    if (subError) {
      console.error('[Push] Error fetching subscriptions:', subError);
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`[Push] No subscriptions found for user ${user_id}`);
      return new Response(
        JSON.stringify({ 
          message: 'No subscriptions found for user',
          hint: 'User needs to enable push notifications in the app'
        }), 
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    console.log(`[Push] Found ${subscriptions.length} subscription(s) for user ${user_id}`);

    // Fetch School Branding
    const { data: userData } = await supabase
      .from('profiles')
      .select('school_id, schools(name, logo_url, icon_url)')
      .eq('id', user_id)
      .single()

    const schoolName = userData?.schools?.name || 'إدارة عربية';
    const defaultIcon = 'https://mecutwhreywjwstirpka.supabase.co/storage/v1/object/public/branding/logo.png'; 
    const schoolLogo = userData?.schools?.icon_url || userData?.schools?.logo_url || defaultIcon;
    const finalIconUrl = schoolLogo || 'https://edara-arabiya.vercel.app/icons/icon-512.png';

    // Add cache buster
    const timestamp = Date.now();
    const finalLogo = finalIconUrl.includes('?') ? `${finalIconUrl}&v=${timestamp}` : `${finalIconUrl}?v=${timestamp}`;

    // Configure Web Push
    webpush.setVapidDetails(
      'mailto:support@edara-arabiya.com',
      Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
      Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
    )

    const notificationPayload = JSON.stringify({
      title: title || schoolName,
      body: body,
      icon: finalLogo,
      badge: finalLogo,
      tag: `school-notif-${user_id}`,
      data: {
        url: url || '/',
      },
    })

    // Send to all subscriptions
    const results = await Promise.allSettled(
      subscriptions.map(async (sub: any) => {
        try {
          await webpush.sendNotification(sub.subscription, notificationPayload);
          console.log('[Push] Notification sent successfully');
          return { success: true };
        } catch (err: any) {
          console.error('[Push] Error sending notification:', err);
          
          // Delete expired/invalid subscriptions
          if (err.statusCode === 410 || err.statusCode === 404 || err.statusCode === 403) {
            console.log('[Push] Removing expired subscription');
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('subscription->endpoint', sub.subscription.endpoint);
            return { success: false, reason: 'expired' };
          }
          
          return { success: false, error: err.message };
        }
      })
    );

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
    console.log(`[Push] Sent ${successCount}/${subscriptions.length} notifications successfully`);
    console.log('[Push] ===== Request End =====');

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        sent: successCount,
        total: subscriptions.length
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('[Push] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal Server Error',
        message: error.message 
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
