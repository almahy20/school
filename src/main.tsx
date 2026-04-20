import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { logger } from "./utils/logger";

// Service Worker registration logic
const isSWDisabled = new URLSearchParams(window.location.search).has('disable-sw');
const isDev = import.meta.env.DEV;

// ✅ Optimization: Only register Service Worker in production
// This prevents the cache from bloating with thousands of Vite dev files (95MB issue)
if ("serviceWorker" in navigator && !isSWDisabled && !isDev) {
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

// 🚀 Capture beforeinstallprompt event early
window.addEventListener('beforeinstallprompt', (e: any) => {
  e.preventDefault();
  (window as any).deferredPrompt = e;
});

// 🚀 Fresh start rendered directly (Live-Only Mode)
createRoot(document.getElementById("root")!).render(<App />);
