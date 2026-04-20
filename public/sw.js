const CACHE_NAME = 'school-cache-v1';
const MAX_CACHE_ITEMS = 100; // ✅ Optimization: Limit cache size to prevent 95MB bloat

// Assets to cache immediately
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico'
];

// ✅ Optimization: Helper to limit cache size
async function limitCacheSize(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
    limitCacheSize(cacheName, maxItems);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
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

  // ✅ Optimization: DO NOT cache Vite development files or HMR updates
  // This is the main reason for the 95MB cache bloat during development
  if (
    url.pathname.includes('@vite') || 
    url.pathname.includes('@react-refresh') || 
    url.search.includes('t=') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.tsx')
  ) {
    return;
  }

  // API calls - Network First
  if (url.origin.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Static Assets - Stale While Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
            limitCacheSize(CACHE_NAME, MAX_CACHE_ITEMS); // Keep it clean
          });
        }
        return networkResponse;
      });
      return cachedResponse || fetchPromise;
    })
  );
});


// ===== الكود الجديد لاستقبال الإشعارات في الخلفية (والتطبيق مغلق) =====
self.addEventListener('push', function(event) {
  if (event.data) {
    let data = {};
    try {
      // محاولة تحليل البيانات القادمة من السيرفر بصيغة JSON
      data = event.data.json();
    } catch(e) {
      // إذا لم تكن JSON نأخذها كنص عادي
      data = { title: 'إشعار جديد', body: event.data.text() };
    }
    
    const options = {
      body: data.body || data.message || 'يوجد تحديث جديد في النظام',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      dir: 'rtl',
      data: data.url || '/' // مسار الفتح عند النقر
    };
    
    // إظهار الإشعار حتى لو كان التطبيق مغلقاً تماماً
    event.waitUntil(
      self.registration.showNotification(data.title || 'إشعار من النظام الذكي', options)
    );
  }
});

// ===== التعامل مع نقر المستخدم على الإشعار المزعج =====
self.addEventListener('notificationclick', function(event) {
  event.notification.close(); // إغلاق الإشعار المادي من الشاشة
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      // إذا كان التطبيق مفتوحاً بالفعل في تبويبة، قم بجلبها للواجهة (focus)
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // إذا كان التطبيق مغلقاً تماماً، إفتح نافذة جديدة للتطبيق
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data || '/');
      }
    })
  );
});
