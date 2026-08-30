import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { logger } from "./utils/logger";

// Disable browser scroll restoration — we handle it ourselves via ScrollToTop
if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

// Service Worker registration logic
const isNative = typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform?.();
const isSWDisabled = isNative || new URLSearchParams(window.location.search).has('disable-sw');

// ✅ Registration: Enabled on Web/PWA, bypassed in native app to prevent WebView intercept stalls
if ("serviceWorker" in navigator && !isSWDisabled) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then(
      (registration) => {
        logger.log("✅ PWA Ready");
        
        // Handle updates
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New content is available; please refresh.
                logger.log("🔄 New PWA content available, will update on next load");
              }
            };
          }
        };
      },
      (err) => logger.error("❌ PWA Startup failure: ", err)
    );
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
createRoot(document.getElementById("root")!).render(<App />);
