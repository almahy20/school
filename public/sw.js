const CACHE_NAME = 'school-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

// تثبيت عامل الخدمة والكاش الأولي
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// تنظيف الكاش القديم
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
  return self.clients.claim();
});

// استراتيجية Stale-While-Revalidate لفتح التطبيق فجأة وبرق
self.addEventListener('fetch', (event) => {
  // لا تقم بعمل كاش لطلبات Supabase أو الـ API
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // تحديث الكاش بالنسخة الجديدة في الخلفية
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      });

      // ارجع النسخة المخبأة فوراً لو وجدت، وإلا انتظر الشبكة
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
