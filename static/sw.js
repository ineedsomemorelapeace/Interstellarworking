// Root-scoped Ultraviolet service worker.
// The /d tabs page must be controlled by this worker so requests it makes
// to /a/ can be intercepted before they reach Express's 404 handler.

importScripts("/assets/mathematics/bundle.js?v=2025-04-15");
importScripts("/assets/mathematics/config.js?v=2025-04-15");
importScripts("/assets/mathematics/sw.js?v=2025-04-15");

const uv = new UVServiceWorker();
const userKey = new URL(location).searchParams.get("userkey") || crypto.randomUUID();

self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
  if (!event.request.url.startsWith(`${location.origin}/a/`)) return;

  event.respondWith((async () => {
    try {
      const response = await uv.fetch(event);

      if (event.request.destination === "document") {
        const status = Number.isInteger(response.status) && response.status >= 200 && response.status <= 599
          ? response.status
          : 500;
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
          status,
          statusText: response.statusText,
          headers,
        });
      }

      return response;
    } catch (error) {
      console.error("Ultraviolet fetch failed:", error);
      return new Response("Proxy error: " + String(error), {
        status: 502,
        headers: { "content-type": "text/plain; charset=UTF-8" },
      });
    }
  })());
});
