
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import webpush from "https://esm.sh/web-push@3.6.6"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { user_id, title, body, url } = await req.json()

    // 1. Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', user_id)

    if (subError) throw subError

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: 'No subscriptions found for user' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // 2. Fetch School Branding
    const { data: userData } = await supabase
      .from('profiles')
      .select('school_id, schools(name, logo_url, icon_url)')
      .eq('id', user_id)
      .single()

    const schoolName = userData?.schools?.name || 'إدارة عربية';
    // Use the site's default icon as fallback instead of a potentially broken/old storage link
    const defaultIcon = 'https://mecutwhreywjwstirpka.supabase.co/storage/v1/object/public/branding/logo.png'; 
    const schoolLogo = userData?.schools?.icon_url || userData?.schools?.logo_url || defaultIcon;
    
    // Fallback to absolute path of public icon if everything else fails
    const finalIconUrl = schoolLogo || 'https://edara-arabiya.vercel.app/icons/icon-512.png';

    // Add cache buster to logo to ensure it's not a cached generic one
    const timestamp = Date.now();
    const finalLogo = finalIconUrl.includes('?') ? `${finalIconUrl}&v=${timestamp}` : `${finalIconUrl}?v=${timestamp}`;

    // 3. Configure Web Push
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
      tag: `school-notif-${user_id}`, // Unique tag to prevent collision but allow update
      data: {
        url: url || '/',
      },
    })

    // 4. Send to all subscriptions
    const results = await Promise.all(
      subscriptions.map((sub: any) =>
        webpush.sendNotification(sub.subscription, notificationPayload).catch((err: any) => {
          console.error('Error sending notification:', err)
          if (err.statusCode === 410 || err.statusCode === 404) {
            // Delete expired subscription
            return supabase
              .from('push_subscriptions')
              .delete()
              .eq('subscription->endpoint', sub.subscription.endpoint)
          }
        })
      )
    )

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
