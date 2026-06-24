"use client";

import { useEffect } from "react";

/**
 * Registers the service worker on all pages so the app is installable
 * as a PWA. The SW provides the offline app-shell cache.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* SW registration failures are non-fatal; the app still works online. */
      });
    }
  }, []);

  return null;
}