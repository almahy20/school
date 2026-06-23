const CACHE_NAME = 'school-cache-v1.4';
const MAX_CACHE_ITEMS = 200;

// Assets to cache immediately - Critical App Shell
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
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
  console.log('[SW] Install Event');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .catch(err => console.error('[SW] Pre-cache failure:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activate Event');
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

    if (url.pathname.includes('/auth/v1/token')) return;

    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          return new Response(
            JSON.stringify({ error: 'offline', message: 'أنت غير متصل بالإنترنت حالياً' }),
            { headers: { 'Content-Type': 'application/json' } }
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
            return res || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
          });
        }
        return new Response('Network Error', { status: 503, statusText: 'Service Unavailable' });
      });
    })
  );
});

// ─── Push Notification Handler ────────────────────────────────────────────────
// Receives push events from the server (Edge Function) and shows a notification.
// The `data.url` field controls which page opens when the user taps the notification.
self.addEventListener('push', function (event) {
  console.log('[SW] Push Event Received');

  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'إشعار جديد', body: event.data.text() };
    }
  }

  const title = data.title || 'إشعار من النظام';
  const targetUrl = (data.data && data.data.url) ? data.data.url : (data.url || '/');

  // Determine notification tag so messages group together
  const isMessage =
    data.type === 'teacher_message' ||
    data.type === 'broadcast_message' ||
    targetUrl === '/messages';

  const options = {
    body: data.body || data.message || 'يوجد تحديث جديد في النظام',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/badge-72.png',
    dir: 'rtl',
    vibrate: [100, 50, 100],
    // ✅ Messages get their own tag so they stack together
    tag: isMessage ? 'new-message' : (data.tag || 'general-notification'),
    renotify: true,
    data: { url: targetUrl },
    requireInteraction: false,
    silent: false,
    timestamp: Date.now(),
    actions: isMessage
      ? [
          { action: 'open', title: 'فتح الرسائل' },
          { action: 'dismiss', title: 'تجاهل' },
        ]
      : [
          { action: 'open', title: 'فتح' },
          { action: 'dismiss', title: 'تجاهل' },
        ],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ─── Notification Click Handler ───────────────────────────────────────────────
// When the user taps a notification, navigate to the correct page.
// Works whether the app is open, in background, or fully closed.
self.addEventListener('notificationclick', function (event) {
  console.log('[SW] Notification clicked, action:', event.action);
  event.notification.close();

  if (event.action === 'dismiss') return;

  // ✅ Use the URL stored in notification.data — set by the push handler above
  const rawUrl = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : '/';

  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (windowClients) {
        // 1. If the exact page is already open, focus it
        for (var i = 0; i < windowClients.length; i++) {
          var client = windowClients[i];
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }

        // 2. If any window of the app is open, navigate it to the target URL
        if (windowClients.length > 0) {
          var anyClient = windowClients[0];
          if ('navigate' in anyClient) {
            anyClient.navigate(targetUrl);
            return anyClient.focus();
          }
        }

        // 3. No window open — open a new one
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

self.addEventListener('notificationclose', function (event) {
  console.log('[SW] Notification dismissed by user');
});

// ─── Background Sync ──────────────────────────────────────────────────────────
self.addEventListener('sync', function (event) {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  console.log('[SW] Background sync triggered');
}
