import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
  const vapidEmail = Deno.env.get("VAPID_EMAIL") ?? "mailto:support@edara.app";

  if (!supabaseUrl || !supabaseServiceKey) {
    return jsonResponse({ error: "Supabase server secrets are not configured" }, 500);
  }

  if (!vapidPublic || !vapidPrivate) {
    console.error("[Push] VAPID keys not configured in Supabase secrets");
    return jsonResponse({ error: "Push notifications not configured on server" }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const authHeader = req.headers.get("Authorization") ?? "";
  const apiKey = req.headers.get("apikey") ?? "";
  let callerUserId: string | null = null;
  let callerSchoolId: string | null = null;
  let callerIsSuperAdmin = false;
  let callerIsPrivileged = false;
  let callerIsInternal = false;

  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);

    if (token === supabaseServiceKey) {
      callerIsInternal = true;
      callerIsPrivileged = true;
    } else {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        console.error("[Push] Invalid JWT:", error?.message);
        return jsonResponse({ error: "Unauthorized", message: "Invalid or expired token" }, 401);
      }

      callerUserId = user.id;

      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role, school_id, is_super_admin")
        .eq("user_id", callerUserId)
        .single();

      if (roleError || !roleData) {
        return jsonResponse({ error: "Forbidden", message: "User role not found" }, 403);
      }

      callerSchoolId = roleData.school_id ?? null;
      callerIsSuperAdmin = roleData.is_super_admin === true;
      callerIsPrivileged = callerIsSuperAdmin || roleData.role === "admin" || roleData.role === "teacher";

      if (callerIsPrivileged && !callerIsSuperAdmin && !callerSchoolId) {
        return jsonResponse({ error: "Forbidden", message: "Caller has no school scope" }, 403);
      }
    }
  } else if (apiKey === supabaseServiceKey) {
    callerIsInternal = true;
    callerIsPrivileged = true;
  } else {
    return jsonResponse({ error: "Unauthorized", message: "Missing or invalid Authorization header" }, 401);
  }

  let bodyData: any;
  try {
    bodyData = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { user_id, title, body, url, type } = bodyData;

  if (!user_id || !body) {
    return jsonResponse({ error: "user_id and body are required" }, 400);
  }

  if (!callerIsPrivileged && callerUserId !== user_id) {
    return jsonResponse({ error: "Forbidden", message: "You can only send notifications to yourself" }, 403);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id, schools(name, logo_url)")
    .eq("id", user_id)
    .maybeSingle();

  if (!profile) {
    return jsonResponse({ error: "Target user not found" }, 404);
  }

  if (callerIsPrivileged && !callerIsInternal && !callerIsSuperAdmin && profile.school_id !== callerSchoolId) {
    return jsonResponse({ error: "Forbidden", message: "Cross-tenant notification denied" }, 403);
  }

  const { data: subscriptions, error: subError } = await supabase
    .from("push_subscriptions")
    .select("subscription, endpoint")
    .eq("user_id", user_id);

  if (subError) {
    console.error("[Push] DB error fetching subscriptions:", subError);
    return jsonResponse({ error: "Database error", message: subError.message }, 500);
  }

  if (!subscriptions || subscriptions.length === 0) {
    return jsonResponse({ message: "No subscriptions found", sent: 0 });
  }

  const schoolName = (profile?.schools as any)?.name ?? "New notification";
  const schoolLogo = (profile?.schools as any)?.logo_url ?? "/icons/icon-192.png";
  const isMessage = type === "teacher_message" || type === "broadcast_message" || url === "/messages";
  const targetUrl = url ?? (isMessage ? "/messages" : "/notifications");

  webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate);

  const payload = JSON.stringify({
    title: title ?? schoolName,
    body,
    icon: schoolLogo,
    badge: "/icons/badge-72.png",
    type,
    tag: isMessage ? "new-message" : "general-notification",
    url: targetUrl,
    data: { url: targetUrl },
  });

  const results = await Promise.allSettled(
    subscriptions.map(async (sub: any) => {
      try {
        await webpush.sendNotification(sub.subscription, payload);
        return { success: true };
      } catch (err: any) {
        console.error("[Push] Send error:", err.statusCode, err.message);

        if ([404, 410, 403].includes(err.statusCode)) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", sub.endpoint);
          return { success: false, reason: "expired_removed" };
        }

        return { success: false, error: err.message };
      }
    }),
  );

  const sent = results.filter((result) => result.status === "fulfilled" && (result.value as any)?.success).length;
  return jsonResponse({ success: true, sent, total: subscriptions.length });
});
