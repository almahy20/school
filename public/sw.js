// تثبيت عامل الخدمة بسرعة
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// التفويض فور التنشيط
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// التعامل مع طلبات الشبكة العادية (يمكن التوسع فيه لطلبات الكاش لاحقاً)
self.addEventListener('fetch', () => {});


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
