"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("[pwa] service worker registration failed:", error);
      });
    }
  }, []);

  return null;
}
