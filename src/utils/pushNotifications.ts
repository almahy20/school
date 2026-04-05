import { supabase } from '@/integrations/supabase/client';

/**
 * Sends a push notification to a specific user via the Edge Function.
 * Requires the `send-push-notification` Edge Function to be deployed.
 */
export async function sendPushToUser({
  userId,
  title,
  body,
  url = '/'
}: {
  userId: string;
  title?: string;
  body: string;
  url?: string;
}) {
  // We'll wrap this in a check to ensure we have a session
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // Don't even try if not logged in

    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        user_id: userId,
        title,
        body,
        url
      }
    });

    if (error) {
      // Log as info instead of error to keep console clean during dev/missing secrets
      console.info('Push notification service notice:', error.message);
    }
  } catch (err) {
    // Silent fail for push notifications - they are secondary to data saving
  }
}

/**
 * Sends push notifications to multiple users at once.
 */
export async function sendPushToUsers({
  userIds,
  title,
  body,
  url = '/'
}: {
  userIds: string[];
  title?: string;
  body: string;
  url?: string;
}) {
  // Fire & forget - don't block the UI
  await Promise.allSettled(
    userIds.map(userId => sendPushToUser({ userId, title, body, url }))
  );
}
