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
        },
        (err) => {
          logger.error("❌ PWA Startup failure: ", err);
        }
      );
    });
  }
}

// 🚀 Fresh start rendered directly (Live-Only Mode)
createRoot(document.getElementById("root")!).render(<App />);
