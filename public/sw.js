self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

// Mandatory fetch handler for PWA installability
self.addEventListener("fetch", (event) => {
  // Respond with original request - mandatory for PWA detection
  event.respondWith(fetch(event.request).catch(() => {
    // Optional: Return a fallback offline page here
  }));
});

self.addEventListener("push", function (event) {
  let data = {};
  try {
     data = event.data.json();
  } catch(e) {
     data = { title: "إشعار جديد", body: event.data.text() };
  }

  const options = {
    body: data.body || 'لديك إشعار جديد من المدرسة',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.icon || '/icons/icon-192.png',
    vibrate: [300, 100, 400],
    data: { 
      url: data.data?.url || data.url || '/',
      schoolName: data.title || 'إدارة عربية'
    },
    actions: [
      { action: 'open', title: 'عرض التفاصيل' }
    ],
    tag: data.tag || 'school-notification',
    renotify: true,
    requireInteraction: true, // Keep notification until user interacts
    dir: 'rtl',
    lang: 'ar'
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'إدارة عربية', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const urlToOpen = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1. Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // 2. If no window is open with the URL, check if any window is open at all
      if (windowClients.length > 0) {
        return windowClients[0].navigate(urlToOpen).then(client => client?.focus());
      }
      
      // 3. If no window is open, open a new window/tab
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
