// Root-scoped Ultraviolet service worker.
// The /d tabs page uses this single worker for every /a/ proxy request.

importScripts("/assets/mathematics/bundle.js?v=2026-09-17-uv-1");
importScripts("/assets/mathematics/config.js?v=2026-09-17-uv-1");
importScripts("/assets/mathematics/sw.js?v=2026-09-17-uv-1");

const uv = new UVServiceWorker();
const userKey = new URL(location).searchParams.get("userkey") || crypto.randomUUID();

function safeStatus(status, fallback = 502) {
  const value = Number(status);
  return Number.isInteger(value) && value >= 200 && value <= 599 ? value : fallback;
}

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
      const status = safeStatus(response?.status);

      if (event.request.destination === "document") {
        const headers = new Headers(response?.headers || {});
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
          statusText: response.statusText || "",
          headers,
        });
      }

      // Re-wrap every proxied response so an invalid status can never escape
      // the worker and trigger the native Response RangeError.
      return new Response(response.body, {
        status,
        statusText: response.statusText || "",
        headers: response.headers,
      });
    } catch (error) {
      console.error("Ultraviolet fetch failed:", error);
      return new Response(`Proxy error: ${String(error)}`, {
        status: 502,
        headers: { "content-type": "text/plain; charset=UTF-8" },
      });
    }
  })());
});
