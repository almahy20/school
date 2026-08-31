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

// Service Worker registration & auto-update logic
const isSWDisabled = new URLSearchParams(window.location.search).has('disable-sw');

if ("serviceWorker" in navigator && !isSWDisabled) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then(
      (registration) => {
        logger.log("✅ PWA Ready");

        // 🔄 Periodically check for updates and on window focus/tab visibility
        const checkForUpdate = () => {
          registration.update().catch(() => {});
        };

        window.addEventListener("focus", checkForUpdate);
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") checkForUpdate();
        });

        // Check every 10 minutes in background
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
      },
      (err) => logger.error("❌ PWA Startup failure: ", err)
    );
  });

  // Smoothly reload when new service worker takes control (seamless update)
  let isRefreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!isRefreshing) {
      isRefreshing = true;
      logger.log("⚡ New Service Worker activated — refreshing page with latest assets");
      window.location.reload();
    }
  });
}

// 🚀 Capture beforeinstallprompt event early — قبل React حتى
// usePWAInstall hook بيلتقطه من window.deferredPrompt عند الـ mount
window.addEventListener('beforeinstallprompt', (e: any) => {
  e.preventDefault();
  (window as any).deferredPrompt = e;
  logger.log('✅ [main] beforeinstallprompt captured early');
});

// 🚀 Fresh start rendered directly (Live-Only Mode)
createRoot(document.getElementById("root")!).render(
  <GlobalErrorBoundary>
    <App />
  </GlobalErrorBoundary>
);
