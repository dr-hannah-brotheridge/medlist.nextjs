"use client";

import { useEffect } from "react";

/**
 * Registers the service worker in production only, so dev assets are never
 * cached and you always see fresh changes during local work.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch(() => {
          /* SW registration failures are non-fatal; the app still works online. */
        });
    }
  }, []);

  return null;
}