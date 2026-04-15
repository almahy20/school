import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global Error Interceptor & Console Cleaner - MUST be first
if (import.meta.env.DEV) {
  import("./utils/errorInterceptor");
  import("./utils/earlyConsoleCleaner");
}

// Service Worker registration logic
const isSWDisabled = new URLSearchParams(window.location.search).has('disable-sw');

if ("serviceWorker" in navigator) {
  // Only register PWA service worker in production to avoid HMR interference in dev
  if (import.meta.env.PROD && window.location.hostname !== 'localhost') {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").then(
        (registration) => {
          console.log("✅ PWA Ready (SW scope: ", registration.scope, ")");
        },
        (err) => {
          console.error("❌ PWA Startup failure: ", err);
        }
      );
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);
