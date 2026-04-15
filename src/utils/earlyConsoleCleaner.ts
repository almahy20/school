/**
 * Early Console Cleaner
 * This file should be imported FIRST in main.tsx to suppress all console noise
 */

(function() {
  // Store original console methods
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;
  const originalInfo = console.info;

  // Patterns to suppress — فقط الضجيج المطوّل بدون قيمة تشخيصية
  // تحذير: لا تُضف هنا: auth, session, token, failed, connection, sync, error
  // تلك الأنماط تُخفي أخطاء حقيقية تحتاج للمراجعة
  const SUPPRESS_PATTERNS = [
    // Supabase SDK داخلي — مطوّل جداً وبلا قيمة في DEV
    'silentresurrector',
    'supabasereset',
    'realtimeengine',
    'backgroundsync',
    'clientresurrector',
    
    // React warnings تقنية بحتة — لا تؤثر على المنطق
    'warn - the class',
    'ambiguous',
    
    // PWA/ServiceWorker — مطوّل في DEV بدون فائدة
    'service worker',
    'pwa',
    'vite hmr',
  ];

  // Helper to check if message should be suppressed
  function shouldSuppress(args: any[]) {
    try {
      const message = args.map(arg => {
        if (arg === null || arg === undefined) return '';
        const str = typeof arg === 'string' ? arg : JSON.stringify(arg);
        return (str || '').toLowerCase();
      }).join(' ');

      return SUPPRESS_PATTERNS.some(pattern => message.includes(pattern));
    } catch (e) {
      return false; // Safely don't suppress if we can't parse
    }
  }

  // Override console.error
  console.error = function(...args) {
    if (!shouldSuppress(args)) {
      originalError.apply(console, args);
    }
  };

  // Override console.warn
  console.warn = function(...args) {
    if (!shouldSuppress(args)) {
      originalWarn.apply(console, args);
    }
  };

  // Override console.log (THIS IS THE KEY!)
  console.log = function(...args) {
    if (!shouldSuppress(args)) {
      originalLog.apply(console, args);
    }
  };

  // Override console.info
  console.info = function(...args) {
    if (!shouldSuppress(args)) {
      originalInfo.apply(console, args);
    }
  };

  // Log activation (this will show)
  originalLog('%c🧹 Console Cleaner Active', 'color: #10b981; font-weight: bold; font-size: 12px;');
  originalLog('%cSuppressing only: resurrector, ambiguous, service-worker, vite-hmr noise', 'color: #6b7280; font-size: 10px;');
})();

export {};
