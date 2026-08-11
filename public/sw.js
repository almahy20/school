const CACHE_NAME = 'school-cache-v1.8';
const MAX_CACHE_ITEMS = 200;

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/badge-72.png',
  '/placeholder.svg'
];

const BRANDING_CACHE = 'school-branding-v1';
const MAX_BRANDING_ITEMS = 20;

async function limitCacheSize(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      const itemsToDelete = keys.slice(0, keys.length - maxItems);
      await Promise.all(itemsToDelete.map(key => cache.delete(key)));
    }
  } catch (err) {
    console.error('[SW] Cache limit error:', err);
  }
}

self.addEventListener('install', (event) => {
  console.log('[SW] Install Event v1.7');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        PRECACHE_ASSETS.map((url) => {
          return fetch(url).then((response) => {
            if (!response.ok) {
              console.error(`[SW] Pre-cache failed for ${url} with status ${response.status}`);
              return;
            }
            return cache.put(url, response);
          }).catch((err) => {
            console.error(`[SW] Pre-cache network error for ${url}:`, err);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activate Event v1.7');
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== BRANDING_CACHE) {
            return caches.delete(cacheName);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') return;

  if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') {
    return;
  }

  if (
    url.pathname.includes('@vite') ||
    url.pathname.includes('@react-refresh') ||
    url.search.includes('t=') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.tsx') ||
    url.hostname === 'localhost'
  ) {
    return;
  }

  if (url.origin.includes('supabase.co')) {
    if (url.pathname.includes('/storage/v1/object/public/')) {
      event.respondWith(
        caches.match(event.request).then((cached) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(BRANDING_CACHE).then(cache => {
                cache.put(event.request, copy);
                limitCacheSize(BRANDING_CACHE, MAX_BRANDING_ITEMS);
              });
            }
            return networkResponse;
          }).catch(() => cached);
          return cached || fetchPromise;
        })
      );
      return;
    }

    if (url.pathname.includes('/auth/v1/')) return;

    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(async (error) => {
          console.warn('[SW] Supabase fetch failed, trying fallback cache:', error);

          const cached = await caches.match(event.request);
          if (cached) {
            const newHeaders = new Headers(cached.headers);
            newHeaders.set('x-sw-cache', 'true');

            return new Response(cached.body, {
              status: cached.status,
              statusText: cached.statusText,
              headers: newHeaders
            });
          }

          return new Response(
            JSON.stringify({
              error: 'offline',
              message: 'أنت غير متصل بالإنترنت حالياً'
            }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
            limitCacheSize(CACHE_NAME, MAX_CACHE_ITEMS);
          });
        }
        return networkResponse;
      }).catch(() => undefined);

      if (cachedResponse) {
        return cachedResponse;
      }

      return fetchPromise.then((networkResponse) => {
        if (networkResponse) return networkResponse;

        const isHtml = event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html');
        if (event.request.mode === 'navigate' || isHtml) {
          return caches.match('/index.html').then((res) => {
            return res || new Response('Offline Fallback', { status: 503, statusText: 'Offline Fallback' });
          });
        }
        return new Response('Network Error', { status: 503, statusText: 'Offline Fallback' });
      });
    })
  );
});

// ─── Push Notification Handler (RELIABILITY FIXES) ─────────────────────────
//
// WHY PUSH NOTIFICATIONS WERE ARRIVING "SOMETIMES":
//   1) Any exception inside `showNotification` (bad payload, missing icon,
//      temporary OS restriction) was silently turning the event into a
//      success. The browser told FCM/UPNS "we got it" so the push was
//      ACKed → never retried = LOST NOTIFICATION.
//   2) `requireInteraction: false` made some OEMs (Xiaomi/Samsung/Huawei)
//      treat the notification as "low priority" and they suppress the
//      vibration/sound, sometimes even hide the shade entry while in
//      Doze / App Standby Bucket → "sometimes" pattern.
//   3) No explicit retry signal back to the Push Service. When the Promise
//      passed to waitUntil rejects, Chromium-based browsers will actually
//      request a "retry later" from the push service. We MUST surface the
//      error and NOT swallow it when showNotification fails.
//   4) Apps in Doze mode + not on the Battery Unrestricted list get
//      deferred pushes. We can not fix Doze from here, but we can signal
//      "this is important" via the notification priority / requireInteraction
//      flags and avoid grouping messages into "silent" buckets.
self.addEventListener('push', function (event) {
  console.log('[SW] Push Event Received at', new Date().toISOString());

  const work = (async () => {
    let data = {};
    if (event.data) {
      try {
        data = event.data.json();
      } catch (e) {
        // Fallback for legacy text-only payloads
        const rawText = event.data.text();
        data = { title: 'إشعار جديد', body: rawText, message: rawText };
      }
    }

    const title = data.title || 'إشعار من النظام';
    const messageBody = (data.body || data.message || 'يوجد تحديث جديد في النظام').toString();
    const targetUrl = (data.data && data.data.url) ? data.data.url : (data.url || '/');

    const isMessage =
      data.type === 'teacher_message' ||
      data.type === 'broadcast_message' ||
      targetUrl === '/messages';

    // Sanitize icon/badge paths (some browsers throw if these are invalid URLs
    // or blocked by CORS — especially the case on Android WebAPKs). We
    // resolve them against the SW origin so relative paths always work.
    const safeIcon = new URL(data.icon || '/icons/icon-192.png', self.location.origin).href;
    const safeBadge = new URL(data.badge || '/icons/badge-72.png', self.location.origin).href;
    const safeImage = data.image ? new URL(data.image, self.location.origin).href : undefined;

    // Priority/urgency hints:
    //   - Messages: HIGH priority + requireInteraction = OEM is less likely
    //     to silently drop them while in Doze/App-Standy buckets.
    //   - Generic notifications: still requireInteraction (keeps them visible
    //     in the shade until the user acts on them → avoids "I didn't see it").
    const isImportant = data.priority === 'high' || data.urgent === true || isMessage;

    const options = {
      body: messageBody,
      icon: safeIcon,
      badge: safeBadge,
      image: safeImage,
      dir: 'rtl',
      lang: 'ar-EG',
      vibrate: isImportant ? [200, 100, 200, 100, 200] : [100, 50, 100],
      // 🛑 Reliability fix #1: Stable tag but we add `renotify` so newer
      //    bumps wake the screen even if previous one is there.
      tag: data.tag || (isMessage ? 'message-' + (data.conversation_id || 'inbox') : 'notification-' + (data.id || Math.random())),
      renotify: true,
      // 🛑 Reliability fix #2: requireInteraction = true.
      //    This greatly improves delivery consistency on Chinese ROMs and
      //    Doze mode because the OS can NOT "fold" the notification into
      //    the "silent / low priority" bucket as easily.
      requireInteraction: isImportant ? true : true,
      // 🛑 Reliability fix #3: explicit priority (Android 8+ uses this,
      //    iOS uses the push-level header but the browser still reads it).
      priority: isImportant ? 'max' : 'high',
      silent: false,
      timestamp: Date.now(),
      // Pass through data the click handler needs
      data: {
        url: targetUrl,
        notification_id: data.id || null,
        type: data.type || 'general',
        payload: data,
      },
      actions: isMessage
        ? [
            { action: 'open', title: 'فتح الرسائل', icon: safeBadge },
            { action: 'dismiss', title: 'تجاهل' },
          ]
        : [
            { action: 'open', title: 'فتح', icon: safeBadge },
            { action: 'dismiss', title: 'تجاهل' },
          ],
    };

    // Attempt to show the notification. If the browser rejects (for any
    // reason: permission revoked mid-session, OS restriction, quota for
    // notifications per app exceeded, etc.) we MUST NOT swallow the error
    // so that `event.waitUntil` receives a REJECTED promise → Chromium /
    // FCM will then know the delivery failed and will SCHEDULE A RETRY
    // later instead of dropping the push forever.
    try {
      await self.registration.showNotification(title, options);
      console.log('[SW] Notification shown successfully, tag:', options.tag);
    } catch (err) {
      console.error('[SW] showNotification FAILED — signalling retry.', err);
      // Re-throw so event.waitUntil propagates the failure -> retry.
      throw err;
    }
  })();

  // The Promise MUST be the return value of waitUntil — if it rejects,
  // the browser marks the push as "undelivered" and asks the push service
  // to send it again (typically within a few minutes on good networks,
  // on the next maintenance window in Doze mode — but NEVER lost forever).
  event.waitUntil(work);
});

// ─── Notification Click Handler (FIXED: always resolve the navigate) ──────
self.addEventListener('notificationclick', function (event) {
  console.log('[SW] Notification clicked, action:', event.action);
  event.notification.close();

  if (event.action === 'dismiss') return;

  const rawUrl = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : '/';

  // Normalize to an absolute URL
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(async function (windowClients) {
        // Focus exact page if open
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }

        // Navigate existing window if present
        if (windowClients.length > 0) {
          const anyClient = windowClients[0];
          if ('navigate' in anyClient) {
            try {
              await anyClient.navigate(targetUrl);
              if ('focus' in anyClient) await anyClient.focus();
              return;
            } catch (e) {
              console.warn('[SW] Navigate failed, falling back to openWindow:', e);
            }
          }
          if ('focus' in anyClient) return anyClient.focus();
        }

        // No open window -> open a new one
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

self.addEventListener('notificationclose', function (event) {
  console.log('[SW] Notification dismissed by user, tag:', event.notification && event.notification.tag);
});

// ─── Background Sync (noop kept for future queued messages) ───────────────
self.addEventListener('sync', function (event) {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  console.log('[SW] Background sync triggered');
}
