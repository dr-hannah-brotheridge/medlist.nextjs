/**
 * Writes the service worker file to public/sw.js.
 * Kept as a script so the SW source isn't mangled by XML/tool formatting.
 */
const fs = require("fs");
const path = require("path");

const SW = `/* ScriptPal NZ service worker — lightweight app-shell cache for offline launch.
 * Bump CACHE_VERSION when shipping new static assets.
 */
const CACHE_VERSION = "medlist-v1";
const APP_SHELL = [
  "/",
  "/home",
  "/login",
  "/manifest.webmanifest",
  "/icon.svg",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_VERSION)
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests over http/https.
  if (request.method !== "GET" || !request.url.startsWith("http")) return;

  const url = new URL(request.url);

  // Network-first for navigations (HTML) so users get fresh content when online,
  // falling back to the cached app shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/"))),
    );
    return;
  }

  // Cache-first for same-origin static assets (JS, CSS, fonts, images).
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
      }),
    );
  }
});
`;

const OUT = path.join(__dirname, "..", "public", "sw.js");
fs.writeFileSync(OUT, SW, "utf8");
console.log("Wrote", OUT);