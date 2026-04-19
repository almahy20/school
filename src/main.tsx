import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { logger } from "./utils/logger";

// Service Worker registration logic
const isSWDisabled = new URLSearchParams(window.location.search).has('disable-sw');

if ("serviceWorker" in navigator) {
  // تسجيل Service Worker على localhost و production
  // هذا ضروري عشان PWA install prompt يشتغل
  if (!isSWDisabled) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").then(
        (registration) => {
          logger.log("✅ PWA Ready (SW scope: ", registration.scope, ")");
          
          // Check if SW is active
          if (registration.active) {
            console.log('✅ Service Worker is active');
          }
          
          // Debug: Check if beforeinstallprompt fires
          window.addEventListener('beforeinstallprompt', (e: any) => {
            e.preventDefault();
            (window as any).deferredPrompt = e;
            console.log('🎉 beforeinstallprompt FIRED at', new Date().toISOString());
            console.log('Event object:', e);
          });
          
          // Force check for beforeinstallprompt
          setTimeout(() => {
            if (!(window as any).deferredPrompt) {
              console.log('⚠️ beforeinstallprompt not fired yet');
              console.log('User activation needed - browser requires user interaction first');
            } else {
              console.log('✅ beforeinstallprompt is available!');
            }
          }, 3000);
        },
        (err) => {
          logger.error("❌ PWA Startup failure: ", err);
        }
      );
    });
  }
}

// 🚀 Capture beforeinstallprompt event early (before React loads)
// This ensures we don't miss the event even if it fires before the component mounts
window.addEventListener('beforeinstallprompt', (e: any) => {
  e.preventDefault();
  (window as any).deferredPrompt = e;
  console.log("✅ PWA Install Prompt captured early");
});

// 🚀 Fresh start rendered directly (Live-Only Mode)
createRoot(document.getElementById("root")!).render(<App />);
