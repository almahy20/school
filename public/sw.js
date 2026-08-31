// Network-first navigation prevents stale HTML from requesting deleted Vite bundles.
const CACHE_NAME = 'school-cache-v3.2';
const MAX_CACHE_ITEMS = 200;

const PRECACHE_ASSETS = [
  '/manifest.json',
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
  console.log('[SW] Install Event v3.2');
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
  console.log('[SW] Activate Event v3.2');
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
  if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') return;

  // A shared/deep link must receive the latest index.html. It will then refer
  // to JavaScript bundles produced by that same deployment. The cache is used
  // only when the device is genuinely offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            try {
              const clone = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => cache.put('/offline-shell', clone))
                .catch((e) => console.warn('[SW] Cache put failed:', e));
            } catch (e) {
              console.warn('[SW] Clone failed:', e);
            }
          }
          return response;
        })
        .catch(async () => {
          try {
            const cache = await caches.open(CACHE_NAME);
            const cached = await cache.match('/offline-shell');
            if (cached) return cached;
          } catch (_e) {}
          return new Response('Offline', { status: 503 });
        })
    );
    return;
  }

  if (
    url.pathname.includes('@vite') ||
    url.pathname.includes('@react-refresh') ||
    url.search.includes('t=') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.tsx') ||
    url.hostname === 'localhost'
  ) return;

  if (url.origin.includes('supabase.co')) {
    if (
      url.pathname.includes('/storage/v1/object/public/') ||
      url.pathname.includes('/storage/v1/render/image/public/')
    ) {
      event.respondWith(
        caches.open(BRANDING_CACHE).then((cache) => {
          const cacheKey = new Request(url.origin + url.pathname);
          return cache.match(cacheKey).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                try {
                  const clone = networkResponse.clone();
                  cache.put(cacheKey, clone).catch((e) => console.warn('[SW] Branding put failed:', e));
                  limitCacheSize(BRANDING_CACHE, MAX_BRANDING_ITEMS);
                } catch (e) {
                  console.warn('[SW] Branding clone failed:', e);
                }
              }
              return networkResponse;
            }).catch(() => cached);
          });
        })
      );
      return;
    }

    // API and authentication requests must not be cached.
    event.respondWith(fetch(event.request));
    return;
  }

  // Content-hashed Vite assets are safe to cache. Do not cache HTML responses
  // returned by the host's catch-all rewrite under a missing asset URL.
  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        const contentType = response.headers.get('content-type') || '';
        if (response && response.ok && !contentType.includes('text/html')) {
          try {
            const clone = response.clone();
            cache.put(event.request, clone).catch((e) => console.warn('[SW] Asset cache put failed:', e));
            limitCacheSize(CACHE_NAME, MAX_CACHE_ITEMS);
          } catch (e) {
            console.warn('[SW] Asset clone failed:', e);
          }
        }
        return response;
      }).catch(() => new Response('Network Error', { status: 503 }))
    );
    return;
  }

  event.respondWith(fetch(event.request));
});
// ─── Push Notification Handler ─────────────────────────────────────────────
self.addEventListener('push', function (event) {
  console.log('[SW] Push Event Received at', new Date().toISOString());

  const work = (async () => {
    let data = {};
    if (event.data) {
      try {
        data = event.data.json();
      } catch (e) {
        const rawText = event.data.text();
        data = { title: 'إشعار جديد', body: rawText, message: rawText };
      }
    }

    const title = data.title || 'إشعار من النظام';
    const messageBody = (data.body || data.message || 'يوجد تحديث جديد في النظام').toString();

    // ✅ FIX #1: استخرج الـ URL من كل الأماكن الممكنة
    //   Edge function بيبعت: { data: { url: "..." }, url: "..." }
    //   بنتحقق من كل الأماكن بالترتيب
    const targetUrl = (data.data && data.data.url)
      ? data.data.url
      : (data.url || '/');

    const type = data.type || 'general';
    const isMessage =
      type === 'teacher_message' ||
      type === 'broadcast_message' ||
      type === 'class_chat_message' ||
      type === 'conversation_new_message' ||
      type === 'conversation_admin_reply' ||
      targetUrl === '/messages' ||
      targetUrl.startsWith('/conversations');

    const safeIcon = new URL(data.icon || '/icons/badge-72.png', self.location.origin).href;
    const safeBadge = new URL('/icons/badge-72.png', self.location.origin).href;
    const safeImage = data.image ? new URL(data.image, self.location.origin).href : undefined;

    const isImportant = data.priority === 'high' || data.urgent === true || isMessage;

    // ✅ FIX #2: tag فريد لكل إشعار عشان ما يتلغاش إشعار قديم
    //   استخدم notification_id لو متاح، وإلا timestamp
    const tag = data.notification_id
      ? `notif-${data.notification_id}`
      : data.conversation_id
        ? `conv-${data.conversation_id}`
        : isMessage
          ? `msg-${Date.now()}`
          : `notif-${Date.now()}`;

    const options = {
      body: messageBody,
      icon: safeIcon,
      badge: safeBadge,
      image: safeImage,
      dir: 'rtl',
      lang: 'ar-EG',
      vibrate: isImportant ? [300, 100, 300, 100, 300] : [200, 100, 200],
      tag,
      renotify: true,
      requireInteraction: true, // ✅ FIX #3: دايماً true = يستيقظ الجهاز
      silent: false,
      timestamp: Date.now(),
      data: {
        url: targetUrl,
        notification_id: data.notification_id || data.id || null,
        type,
        payload: data,
      },
      actions: isMessage
        ? [
            { action: 'open', title: 'فتح', icon: safeBadge },
            { action: 'dismiss', title: 'تجاهل' },
          ]
        : [
            { action: 'open', title: 'فتح', icon: safeBadge },
            { action: 'dismiss', title: 'تجاهل' },
          ],
    };

    try {
      await self.registration.showNotification(title, options);
      console.log('[SW] ✅ Notification shown, tag:', tag, 'url:', targetUrl);
    } catch (err) {
      console.error('[SW] ❌ showNotification FAILED — signalling retry.', err);
      throw err; // Re-throw → browser يطلب retry من push service
    }
  })();

  event.waitUntil(work);
});

// ─── Notification Click Handler ──────────────────────────────────────────────
self.addEventListener('notificationclick', function (event) {
  console.log('[SW] Notification clicked, action:', event.action);
  event.notification.close();

  if (event.action === 'dismiss') return;

  const rawUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/';

  // تأكد إن الـ URL absolute
  const targetUrl = rawUrl.startsWith('http')
    ? rawUrl
    : new URL(rawUrl, self.location.origin).href;

  console.log('[SW] Opening URL:', targetUrl);

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(async function (windowClients) {
        // 1. لو في tab مفتوح على نفس الـ URL — focus عليه
        for (const client of windowClients) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }

        // 2. لو في tab مفتوح على أي صفحة من التطبيق — navigate فيه
        for (const client of windowClients) {
          const clientOrigin = new URL(client.url).origin;
          if (clientOrigin === self.location.origin && 'navigate' in client) {
            try {
              await client.navigate(targetUrl);
              if ('focus' in client) await client.focus();
              return;
            } catch (e) {
              console.warn('[SW] navigate() failed:', e);
              // fallthrough to openWindow
            }
          }
        }

        // 3. التطبيق مقفول تماماً — افتح نافذة جديدة
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
