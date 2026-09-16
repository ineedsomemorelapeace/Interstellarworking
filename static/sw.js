importScripts("/assets/history/config.js?v=2026-09-16");
importScripts("/assets/history/worker.js?v=2026-09-16");
importScripts("/assets/mathematics/bundle.js?v=2026-09-16");
importScripts("/assets/mathematics/config.js?v=2026-09-16");
importScripts(__uv$config.sw || "/assets/mathematics/sw.js?v=2026-09-16");
importScripts("/assets/languagearts/sj.all.js?v=2026-09-16");
const { ScramjetServiceWorker } = $scramjetLoadWorker();

const uv = new UVServiceWorker();
const dynamic = new Dynamic();
const sj = new ScramjetServiceWorker();

self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
  event.respondWith(
    (async () => {
      await sj.loadConfig();

      if (await sj.route(event)) {
        return await sj.fetch(event);
      }

      if (await dynamic.route(event)) {
        return await dynamic.fetch(event);
      }

      if (event.request.url.startsWith(`${location.origin}/a/`)) {
        return await uv.fetch(event);
      }

      return await fetch(event.request);
    })(),
  );
});
