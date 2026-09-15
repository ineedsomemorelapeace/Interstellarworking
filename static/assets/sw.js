// iOS/iPadOS Ultraviolet service worker.
// This is intentionally separate from the combined Scramjet/UV worker because
// Safari can fail when Scramjet's response path is initialized for proxy loads.

importScripts("/assets/mathematics/bundle.js?v=9-30-2024");
importScripts("/assets/mathematics/config.js?v=9-30-2024");
importScripts("/assets/mathematics/sw.js?v=9-30-2024");

const uv = new UVServiceWorker();

self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
  if (event.request.url.startsWith(`${location.origin}/a/`)) {
    event.respondWith(uv.fetch(event));
  }
});
