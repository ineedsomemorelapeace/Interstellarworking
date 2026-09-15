// iOS/iPadOS Ultraviolet service worker.
// Keep the iOS worker separate from the combined Scramjet/UV worker.

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
  if (!event.request.url.startsWith(`${location.origin}/a/`)) return;

  event.respondWith((async () => {
    const response = await uv.fetch(event);

    // Safari can treat a proxied document as a download when the upstream
    // response carries Content-Disposition: attachment or an octet-stream
    // content type. A document request must stay a document inside the tab.
    if (event.request.destination === "document") {
      const headers = new Headers(response.headers);
      const disposition = headers.get("content-disposition");
      const type = headers.get("content-type") || "";

      if (disposition && /attachment/i.test(disposition)) {
        headers.delete("content-disposition");
      }

      if (/^application\/octet-stream\b/i.test(type)) {
        headers.set("content-type", "text/html; charset=UTF-8");
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return response;
  })());
});