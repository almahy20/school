const CACHE_NAME = 'school-cache-v1.3'; // ✅ Updated version - Push notification improvements
const MAX_CACHE_ITEMS = 200; // ✅ Increased for better offline coverage

// Assets to cache immediately - Critical App Shell
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  // Note: Vite assets are usually hashed and handled in the fetch event
];

// ✅ Optimization: Helper to limit cache size using a loop instead of recursion
async function limitCacheSize(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      // Delete the oldest items until we're under the limit
      const itemsToDelete = keys.slice(0, keys.length - maxItems);
      await Promise.all(itemsToDelete.map(key => cache.delete(key)));
      console.log(`[SW] Purged ${itemsToDelete.length} old cache items`);
    }
  } catch (err) {
    console.error('[SW] Cache limit error:', err);
  }
}

self.addEventListener('install', (event) => {
  console.log('[SW] Install Event');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Pre-caching critical assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .catch(err => console.error('[SW] Pre-cache failure:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activate Event');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Skip non-GET requests (cannot be cached)
  if (event.request.method !== 'GET') {
    return;
  }

  // 2. Skip Vite development files or HMR updates
  if (
    url.pathname.includes('@vite') || 
    url.pathname.includes('@react-refresh') || 
    url.search.includes('t=') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.tsx') ||
    url.hostname === 'localhost' // Extra safety for dev
  ) {
    return;
  }

  // 3. API calls (Supabase) - Network First with Cache Fallback
  if (url.origin.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clone and store successful GET responses
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 4. Static Assets & Pages - Stale While Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Only cache valid responses
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
            limitCacheSize(CACHE_NAME, MAX_CACHE_ITEMS);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Silent catch for network errors during background fetch
      });

      return cachedResponse || fetchPromise;
    })
  );
});


// ===== الكود الجديد لاستقبال الإشعارات في الخلفية (والتطبيق مغلق) =====
self.addEventListener('push', function(event) {
  console.log('[SW] Push Event Received');
  
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch(e) {
      console.error('[SW] Failed to parse push data:', e);
      data = { title: 'إشعار جديد', body: event.data.text() };
    }
  }

  // ✅ التحقق من وجود عنوان وجسم للإشعار قبل الإظهار
  const title = data.title || 'إشعار من النظام الذكي';
  const options = {
    body: data.body || data.message || 'يوجد تحديث جديد في النظام',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/badge-72.png',
    dir: 'rtl',
    vibrate: [100, 50, 100],
    tag: data.tag || 'general-notification', // يمنع تكرار نفس الإشعار
    renotify: true, // يهز الموبايل حتى لو نفس الـ tag
    data: {
      url: (data.data && data.data.url) ? data.data.url : (data.url || '/')
    },
    requireInteraction: false, // ✅ Changed to false for better mobile UX
    silent: false, // ✅ Ensure sound plays
    actions: [
      { action: 'open', title: 'فتح التطبيق' },
      { action: 'dismiss', title: 'إغلاق' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => console.log('[SW] Notification shown successfully'))
      .catch(err => console.error('[SW] Failed to show notification:', err))
  );
});

// ===== التعامل مع نقر المستخدم على الإشعار =====
self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification clicked:', event.action);
  event.notification.close();
  
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // 1. If a window is already open, focus it and navigate
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // 2. If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ===== التعامل مع إغلاق الإشعار =====
self.addEventListener('notificationclose', function(event) {
  console.log('[SW] Notification closed by user');
  // Optional: Track dismissed notifications for analytics
});

// ===== Background Sync for offline support =====
self.addEventListener('sync', function(event) {
  console.log('[SW] Background sync triggered:', event.tag);
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  // This will sync data when connectivity is restored
  console.log('[SW] Syncing data in background');
  // Implementation depends on your app's sync requirements
}
