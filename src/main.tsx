import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { logger } from "./utils/logger";
import { GlobalErrorBoundary } from "./components/GlobalErrorBoundary";

// Lets the HTML boot screen know that the React bundle loaded successfully.
window.__schoolAppMounted = true;

// Disable browser scroll restoration — we handle it ourselves via ScrollToTop
if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

// ============================================================
// 🔴 CRITICAL FIX #1 — Capture beforeinstallprompt ABSOLUTELY FIRST
//   حدث قبل التثبيت يتطلّ قبل تسجيل الـ SW أحياناً على Vercel
//   لذلك نسجّله مباشرة بدون أي تأخير
// ============================================================
(window as any).__pwaBoot = {
  swRegistered: false,
  swReady: false,
  installReady: false,
  prompt: null,
};

window.addEventListener('beforeinstallprompt', (e: any) => {
  e.preventDefault();
  (window as any).deferredPrompt = e;
  (window as any).__pwaBoot.prompt = e;
  logger.log('✅ [main] beforeinstallprompt captured');
  // أطلق حدث مخصص عشان الـ React hook يسمعه حتى لو صار قبل الـ mount
  window.dispatchEvent(new CustomEvent('pwa:prompt-ready'));
});

window.addEventListener('appinstalled', () => {
  (window as any).deferredPrompt = null;
  (window as any).__pwaBoot.prompt = null;
  logger.log('✅ [main] App installed via browser dialog');
  window.dispatchEvent(new CustomEvent('pwa:installed'));
});

// ============================================================
// 🔴 CRITICAL FIX #2 — Register Service Worker EARLY — DON'T wait for `load`
//   على Vercel: انتظار window.load يعني بعد تحميل كل شيء = تأخير كبير
//   المتصفح بيتحقق من أهلية PWA قبل كده أحياناً
// ============================================================
const isSWDisabled = new URLSearchParams(window.location.search).has('disable-sw');

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (isSWDisabled) return;

  const doRegister = () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" })
      .then((registration) => {
        (window as any).__pwaBoot.swRegistered = true;
        logger.log("✅ PWA Service Worker registered, scope:", registration.scope);

        // إطلاق حدث لإعلام React hook أن الـ SW مسجل
        window.dispatchEvent(new CustomEvent('pwa:sw-registered'));

        // انتظر حتى الـ SW يصبح active
        if (registration.active || registration.waiting) {
          (window as any).__pwaBoot.swReady = true;
          window.dispatchEvent(new CustomEvent('pwa:sw-ready'));
        }

        // عند توفر Service Worker كامل (controller موجود)
        if (navigator.serviceWorker.controller) {
          (window as any).__pwaBoot.installReady = true;
          window.dispatchEvent(new CustomEvent('pwa:install-ready'));
        }

        // 🔄 Periodically check for updates and on window focus/tab visibility
        const checkForUpdate = () => {
          registration.update().catch(() => {});
        };

        window.addEventListener("focus", checkForUpdate);
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") checkForUpdate();
        });
        setInterval(checkForUpdate, 10 * 60 * 1000);

        // Handle incoming new versions
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                logger.log("🔄 New version installed, activating immediately...");
                installingWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            };
          }
        };

        // مراقبة تغيير حالة الـ registration لتحديد متى يُصبح التطبيق جاهزاً للتثبيت
        const notifyReady = () => {
          if (navigator.serviceWorker.controller) {
            (window as any).__pwaBoot.swReady = true;
            (window as any).__pwaBoot.installReady = true;
            window.dispatchEvent(new CustomEvent('pwa:install-ready'));
            logger.log('✅ [main] SW controller active — PWA installable now');
          }
        };

        if (registration.installing) {
          registration.installing.addEventListener('statechange', () => {
            if (registration.installing?.state === 'activated') notifyReady();
          });
        }
        if (registration.waiting) notifyReady();
      })
      .catch((err) => logger.error("❌ Service Worker registration failed:", err));
  };

  // DOMContentLoaded أسرع بكثير من window.load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', doRegister, { once: true });
  } else {
    doRegister();
  }

  // Smoothly reload when new service worker takes control (seamless update in prod)
  let isRefreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!isRefreshing && import.meta.env.PROD) {
      isRefreshing = true;
      logger.log("⚡ New Service Worker activated — refreshing page with latest assets");
      window.location.reload();
    }
  });

  // Fallback مهم: إعادة إطلاق حدث استعداد التثبيت عند توفر الـ controller
  navigator.serviceWorker.ready.then(() => {
    (window as any).__pwaBoot.swReady = true;
    (window as any).__pwaBoot.installReady = true;
    window.dispatchEvent(new CustomEvent('pwa:sw-ready'));
    window.dispatchEvent(new CustomEvent('pwa:install-ready'));
    logger.log('✅ [main] navigator.serviceWorker.ready resolved');
    // في بعض الأحيان الـ prompt متأخر يأتي بعد الـ SW ready
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('pwa:install-ready'));
    }, 500);
  }).catch(e => logger.warn('[main] SW ready timed out:', e));
}

registerServiceWorker();

// 🚀 Fresh start rendered directly (Live-Only Mode)
createRoot(document.getElementById("root")!).render(
  <GlobalErrorBoundary>
    <App />
  </GlobalErrorBoundary>
);
