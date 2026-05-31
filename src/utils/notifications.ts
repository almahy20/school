import { logger } from './logger';

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    logger.error('This browser does not support notifications.');
    return false;
  }
  const permission = await Notification.requestPermission();
  return permission === 'granted';
};

// Sound is disabled by request — keep the function as a no-op so call sites don't break
export const playNotificationSound = () => {
  // Disabled
};

/**
 * Show a local notification.
 * Prefers the Service Worker registration so the notification:
 *  - Works when the app tab is in the background
 *  - Supports the notificationclick handler in sw.js (click-to-navigate)
 *  - Falls back to the basic Notification API if SW is unavailable
 */
export const sendLocalNotification = async (
  title: string,
  body: string,
  options?: { icon?: string; url?: string; tag?: string }
) => {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const icon = options?.icon || '/icons/icon-192.png';
  const url = options?.url || '/notifications';
  const tag = options?.tag || 'general-notification';

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        body,
        icon,
        badge: '/icons/badge-72.png',
        dir: 'rtl',
        tag,
        renotify: true,
        data: { url },
        actions: [
          { action: 'open', title: 'فتح' },
          { action: 'dismiss', title: 'تجاهل' },
        ],
      } as NotificationOptions);
    } else {
      // Fallback: basic Notification API (no click-to-navigate support)
      new Notification(title, { body, icon, dir: 'rtl' });
    }
  } catch (err) {
    logger.warn('[Notifications] Failed to show notification:', err);
    // Last resort fallback
    try {
      new Notification(title, { body, icon, dir: 'rtl' });
    } catch (_) {
      // Silently ignore
    }
  }
};
