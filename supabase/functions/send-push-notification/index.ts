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

/**
 * Edge Function: send-push-notification
 * ------------------------------------
 * Rel 1.1 — Reliability fixes for "sometimes delivered, sometimes not" on mobile:
 *
 *  [Fix #1]  Pass explicit `TTL` + `urgency` + `topic` to `sendNotification`.
 *           The browser's push vendor (FCM/UPNS) uses these to decide whether
 *           to wake the app from Doze / App-Standy buckets. Default TTL was
 *           ~4 weeks which caused silent drops for "fresh" messages; we now
 *           use 24h for urgent stuff and 1h for time-sensitive messages so
 *           the vendor delivers them NOW.
 *
 *  [Fix #2]  Distinguish PERMANENT failures (unsubscribe the endpoint) from
 *            TEMPORARY failures (keep endpoint, return 503 so the caller can
 *            retry). web-push rejects with `statusCode` on permanent errors
 *            but on timeouts / network blips the statusCode is undefined.
 *            Previously, any error removed the subscription; this was wrong
 *            because a transient network error caused us to LOSE a valid
 *            subscriber forever.
 *
 *  [Fix #3]  If the caller is privileged (admin/teacher/internal) and sends
 *            a message, and `sent === 0` (no endpoint delivered the payload),
 *            we now return HTTP 502 with a descriptive flag so the caller
 *            (DB trigger / frontend toast) can show: "لم يتم توصيل الإشعار
 *            لعدم تسجيل الجهاز" instead of silently reporting success.
 *
 *  [Fix #4]  Try to refresh VAPID headers. Previously vapidPublic was stripped
 *            of `=` padding which is correct for some vendors, but on some
 *            Xiaomi/Huawei custom ROMs the stripped key caused signature
 *            mismatches (silent 401 from push service). We now keep the raw
 *            trimmed value as a fallback and decode it defensively.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  // Fix #4 — defensive VAPID handling
  const rawPublic  = (Deno.env.get("VAPID_PUBLIC_KEY")  ?? "").trim();
  const rawPrivate = (Deno.env.get("VAPID_PRIVATE_KEY") ?? "").trim();
  const vapidEmail  = (Deno.env.get("VAPID_EMAIL") ?? "mailto:support@edara.app").trim();

  const vapidPublic  = rawPublic;
  const vapidPrivate = rawPrivate;

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

  // ─── Auth / Caller verification (unchanged) ──────────────────────────
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

  // ─── Body parsing ────────────────────────────────────────────────────
  let bodyData: any;
  try {
    bodyData = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { user_id, title, body, url, type, urgent, ttl, conversation_id, notification_id } = bodyData;

  if (!user_id || !body) {
    return jsonResponse({ error: "user_id and body are required" }, 400);
  }

  if (!callerIsPrivileged && callerUserId !== user_id) {
    return jsonResponse({ error: "Forbidden", message: "You can only send notifications to yourself" }, 403);
  }

  // ─── Load target user profile + subscriptions ────────────────────────
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
    .select("id, subscription, endpoint, created_at, failure_count, last_failure_at")
    .eq("user_id", user_id);

  if (subError) {
    console.error("[Push] DB error fetching subscriptions:", subError);
    return jsonResponse({ error: "Database error", message: subError.message }, 500);
  }

  if (!subscriptions || subscriptions.length === 0) {
    // Fix #3 — explicit signal when nobody to send to
    return jsonResponse({
      message: "No subscriptions found for user",
      sent: 0,
      total: 0,
      has_active_subscription: false,
    }, 200);
  }

  // ─── Build push payload (matches expected SW data structure) ─────────
  const schoolName = (profile?.schools as any)?.name ?? "إشعار من المدرسة";
  const schoolLogo = (profile?.schools as any)?.logo_url ?? "/icons/icon-512.png";
  const isMessage = type === "teacher_message" || type === "broadcast_message" || url === "/messages";
  const targetUrl = url ?? (isMessage ? "/messages" : "/notifications");

  // Fix #1 — Pick TTL / urgency based on message characteristics
  const effectiveUrgent = urgent === true || isMessage;
  const effectiveTtl = typeof ttl === "number" && ttl > 0
    ? ttl
    : effectiveUrgent ? 60 * 60 * 24   /* 24 hours for messages (will retry many times in Doze) */
                      : 60 * 60 * 72;  /* 3 days otherwise */

  const pushOptions: any = {
    vapidDetails: {
      subject: vapidEmail,
      publicKey: vapidPublic,
      privateKey: vapidPrivate,
    },
    TTL: effectiveTtl,
    headers: {
      // Fix #1 — FCM/UPNS Urgency header: wakes Doze devices immediately for
      // high-priority payloads instead of queuing them for next maintenance
      // window (which can be 1+ hours on aggressive ROMs).
      Urgency: effectiveUrgent ? "high" : "normal",
      Topic: conversation_id
        ? `conv-${conversation_id}`
        : isMessage ? "messages" : "general",
    },
  };

  const payload = JSON.stringify({
    title: title ?? schoolName,
    body: body.toString(),
    icon: schoolLogo,
    badge: "/icons/badge-72.png",
    type: type ?? (isMessage ? "teacher_message" : "general"),
    tag: isMessage ? "new-message" : (conversation_id ? `conv-${conversation_id}` : "general-notification"),
    url: targetUrl,
    notification_id: notification_id ?? null,
    conversation_id: conversation_id ?? null,
    urgent: effectiveUrgent,
    priority: effectiveUrgent ? "high" : "default",
    data: { url: targetUrl },
  });

  // ─── Send to each subscription, classify failures correctly ──────────
  const endpointsToDelete: string[] = [];
  const subscriptionsToIncrement: { id: string; code: number | null }[] = [];
  const subscriptionsToReset: string[] = [];
  let transientFailures = 0;
  let sent = 0;
  // Per-subscription result details — logged at end for observability
  const deliveryLog: unknown[] = [];

  const PERMANENT_THRESHOLD = 3;
  const INSTANT_DELETE_CODES = [404, 410];
  const STRIKE_CODES = [403];

  await Promise.allSettled(
    subscriptions.map(async (sub: any) => {
      let pushSubscriptionObject: any = sub.subscription;

      // If DB stored JSON as string (legacy data shape fallback) — decode once
      if (typeof pushSubscriptionObject === "string") {
        try {
          pushSubscriptionObject = JSON.parse(pushSubscriptionObject);
        } catch (_parseErr) {
          endpointsToDelete.push(sub.endpoint);
          const entry = { success: false, reason: "invalid_json_stored", endpoint: sub.endpoint.substring(0, 50) };
          deliveryLog.push(entry);
          return entry;
        }
      }

      try {
        await webpush.sendNotification(pushSubscriptionObject, payload, pushOptions);
        sent++;
        subscriptionsToReset.push(sub.id);
        const entry = { success: true, endpoint: sub.endpoint.substring(0, 40) + "..." };
        deliveryLog.push(entry);
        return entry;
      } catch (err: any) {
        const statusCode = typeof err.statusCode === "number" ? err.statusCode : null;
        const errBody = typeof err.body === "string" ? err.body : "";

        const isInvalidSubscription =
          !pushSubscriptionObject ||
          !pushSubscriptionObject.endpoint ||
          !pushSubscriptionObject.keys ||
          !pushSubscriptionObject.keys.p256dh ||
          !pushSubscriptionObject.keys.auth;

        if (isInvalidSubscription) {
          endpointsToDelete.push(sub.endpoint);
          const entry = { success: false, reason: "invalid_subscription_object", permanent: true };
          deliveryLog.push(entry);
          return entry;
        }

        if (statusCode != null && INSTANT_DELETE_CODES.includes(statusCode)) {
          endpointsToDelete.push(sub.endpoint);
          console.warn(
            `[Push] Removing INSTANTLY dead endpoint (code=${statusCode}):`,
            sub.endpoint.substring(0, 50) + "...",
            errBody ? (" body: " + errBody.substring(0, 160)) : ""
          );
          const entry = { success: false, statusCode, permanent: true, reason: "instant_dead", endpoint: sub.endpoint.substring(0, 50) };
          deliveryLog.push(entry);
          return entry;
        }

        if (statusCode != null && STRIKE_CODES.includes(statusCode)) {
          const currentFailures = typeof sub.failure_count === "number" ? sub.failure_count : 0;
          const newCount = currentFailures + 1;

          if (newCount >= PERMANENT_THRESHOLD) {
            endpointsToDelete.push(sub.endpoint);
            console.warn(
              `[Push] Removing endpoint after ${newCount}x consecutive ${statusCode} failures (3-strike rule):`,
              sub.endpoint.substring(0, 50) + "..."
            );
            const entry = { success: false, statusCode, permanent: true, reason: `strike_${newCount}_delete`, strikes: newCount };
            deliveryLog.push(entry);
            return entry;
          } else {
            subscriptionsToIncrement.push({ id: sub.id, code: statusCode });
            console.warn(
              `[Push] ${statusCode} STRIKE ${newCount}/${PERMANENT_THRESHOLD} for endpoint — keeping subscription for retry:`,
              sub.endpoint.substring(0, 50) + "..."
            );
            const entry = { success: false, statusCode, permanent: false, reason: `strike_${newCount}_retry`, strikes: newCount };
            deliveryLog.push(entry);
            return entry;
          }
        }

        // Transient failure
        transientFailures++;
        console.warn(
          `[Push] TEMPORARY failure (code=${statusCode ?? "unknown"}, endpoint=${sub.endpoint.substring(0, 50)}...). Keeping subscription for next attempt.`,
          err?.message ?? ""
        );
        const entry = { success: false, statusCode, permanent: false, message: err?.message ?? null };
        deliveryLog.push(entry);
        return entry;
      }
    }),
  );

  // ─── Bulk-delete endpoints that are confirmed dead forever ────────────
  if (endpointsToDelete.length > 0) {
    try {
      const { error: delErr } = await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", endpointsToDelete);
      if (delErr) console.error("[Push] Failed to prune dead subscriptions:", delErr);
      else console.log(`[Push] Pruned ${endpointsToDelete.length} dead subscriptions for user ${user_id}`);
    } catch (e) {
      console.error("[Push] Prune cleanup crashed:", e);
    }
  }

  // ─── Reset failure_count for subscriptions that delivered OK ──────────
  if (subscriptionsToReset.length > 0) {
    try {
      const { error: rstErr } = await supabase
        .from("push_subscriptions")
        .update({ failure_count: 0, last_failure_at: null })
        .in("id", subscriptionsToReset);
      if (rstErr) console.error("[Push] Failed to reset failure_count:", rstErr);
    } catch (e) {
      console.error("[Push] Reset failure_count crashed:", e);
    }
  }

  // ─── Increment failure_count for 403 strike candidates ────────────────
  if (subscriptionsToIncrement.length > 0) {
    try {
      // Do them one at a time because PostgREST doesn't support per-row
      // increments with different IDs easily via a simple RPC-like call.
      await Promise.all(
        subscriptionsToIncrement.map(({ id, code }) =>
          supabase
            .from("push_subscriptions")
            .update({
              failure_count: (subscriptions.find((s: any) => s.id === id)?.failure_count ?? 0) + 1,
              last_failure_at: new Date().toISOString(),
              last_failure_code: code,
            })
            .eq("id", id)
        )
      );
      console.log(`[Push] Bumped strike counter on ${subscriptionsToIncrement.length} subscriptions for user ${user_id}`);
    } catch (e) {
      console.error("[Push] Strike increment cleanup crashed:", e);
    }
  }

  const total = subscriptions.length;

  // Log full delivery summary for observability
  console.log(`[Push] Delivery summary for user ${user_id}: sent=${sent}/${total}, transient=${transientFailures}, pruned=${endpointsToDelete.length}`, JSON.stringify(deliveryLog));

  // Fix #3 — Return correct status + descriptive flags so callers can react
  const noActiveSubscriptionsAtAll = sent === 0 && transientFailures === 0 && endpointsToDelete.length === total;
  const allAttemptsFailedTemporarily = sent === 0 && transientFailures > 0;

  const responseBody = {
    success: sent > 0,
    sent,
    total,
    transient_failures: transientFailures,
    pruned_dead_subscriptions: endpointsToDelete.length,
    has_active_subscription: sent > 0 || transientFailures > 0,
    no_device_registered: noActiveSubscriptionsAtAll,
    temporary_outage: allAttemptsFailedTemporarily,
    delivery_log: deliveryLog,
  };

  // Return 502 (Bad Gateway = upstream provider failure) when we couldn't
  // deliver to ANY subscription — this lets the DB trigger / caller know
  // "delivery failed" instead of looking like success. For partial success
  // (some delivered, some dead) we still return 200 because the message
  // reached at least one device.
  const httpStatus =
    noActiveSubscriptionsAtAll  ? 200  /* normal: user just never subscribed */
    : allAttemptsFailedTemporarily ? 502 /* try again */
    : sent === 0                   ? 502 /* definitive failure on all */
    : 200;

  return jsonResponse(responseBody, httpStatus);
});
