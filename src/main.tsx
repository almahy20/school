import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global variable to hold the PWA install prompt
window.addEventListener("beforeinstallprompt", (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later.
  (window as any).deferredPrompt = e;
  console.log("✅ Global PWA Install Prompt Captured");
});

if ("serviceWorker" in navigator) {
  // 1. Aggressively unregister in development or on localhost (VERSION-999)
  if (!import.meta.env.PROD || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      if (registrations.length > 0) {
        Promise.all(registrations.map(r => r.unregister())).then(() => {
          console.log("✅ ALL SERVICEWORKERS UNREGISTERED (VERSION-999)");
          window.location.reload();
        });
      }
    });
  } 
  
  // 2. Only register in production AND NOT on localhost
  if (import.meta.env.PROD && window.location.hostname !== 'localhost') {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").then(
        (registration) => {
          console.log("ServiceWorker registration successful with scope: ", registration.scope);
        },
        (err) => {
          console.log("ServiceWorker registration failed: ", err);
        }
      );
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);
