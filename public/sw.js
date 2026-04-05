const CACHE_NAME = 'school-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/placeholder.svg'
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
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
  e.waitUntil(self.clients.claim());
});

// Stale-while-revalidate strategy for better offline performance
self.addEventListener("fetch", (event) => {
  if (event.request.method !== 'GET') return;
  
  // Skip browser extensions or non-http requests
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          // If network response is valid, update the cache
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // If network fails, return cached response if it exists
          if (cachedResponse) return cachedResponse;
          
          // Return an offline-friendly response for some types of requests
          if (event.request.headers.get('accept').includes('text/html')) {
            return caches.match('/'); // Return landing page as offline fallback
          }
        });
        
        // Return cached response immediately, or wait for network
        return cachedResponse || fetchPromise;
      });
    })
  );
});

self.addEventListener("push", function (event) {
  console.log('📩 Push message received:', event);
  let data = {};
  try {
     data = event.data.json();
     console.log('📦 Push data payload:', data);
  } catch(e) {
     data = { title: "إشعار جديد", body: event.data.text() };
     console.log('📄 Push text payload:', data.body);
  }

  // Deduplication logic using tag
  const notificationTag = data.tag || 'school-notification';
  
  const options = {
    body: data.body || 'لديك إشعار جديد من المدرسة',
    icon: data.icon || '/icons/icon-512.png', // Use high quality icon as fallback
    badge: data.icon || '/icons/badge-72.png',
    vibrate: [300, 100, 400],
    timestamp: Date.now(),
    data: {
      url: data.data?.url || data.url || '/',
      schoolName: data.title || 'إدارة عربية'
    },
    actions: [
      { action: 'open', title: 'عرض التفاصيل' }
    ],
    tag: notificationTag,
    renotify: true,
    requireInteraction: true,
    dir: 'rtl',
    lang: 'ar',
    silent: false,
    image: data.icon // This ensures the logo appears clearly if sent as icon
  };

  console.log('🔔 Showing notification with options:', options);
  event.waitUntil(
    self.registration.showNotification(data.title || 'إدارة عربية', options)
  );
});

// Periodic Background Sync to keep the service worker alive as much as possible
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'keep-alive') {
    console.log('🔄 Periodic keep-alive sync triggered');
    // Here we could fetch new notifications manually if push fails,
    // but usually push is enough. This just keeps the SW from being totally killed by some OS.
    event.waitUntil(Promise.resolve());
  }
});

self.addEventListener('notificationclick', function(event) {
  console.log('🖱️ Notification clicked:', event.notification.tag);
  event.notification.close();
  
  const urlToOpen = new URL(event.notification.data?.url || '/', self.location.origin).href;
  console.log('🌐 Opening URL:', urlToOpen);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1. Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          console.log('🎯 Found existing window, focusing...');
          return client.focus();
        }
      }
      
      // 2. If no window is open with the URL, check if any window is open at all
      if (windowClients.length > 0) {
        console.log('📑 Found open window, navigating...');
        return windowClients[0].navigate(urlToOpen).then(client => client?.focus());
      }
      
      // 3. If no window is open, open a new window/tab
      if (self.clients.openWindow) {
        console.log('🆕 Opening new window...');
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
