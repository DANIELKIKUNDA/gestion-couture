const CACHE_NAME = "atelierpro-v1";
const UI_CACHE_DESTINATIONS = new Set(["document", "script", "style", "image", "font", "worker"]);

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event?.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!request || request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/") || url.pathname === "/health") return;

  const isSameOrigin = url.origin === self.location.origin;
  const shouldHandle =
    request.mode === "navigate" || (isSameOrigin && UI_CACHE_DESTINATIONS.has(request.destination));

  if (!shouldHandle) return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok && isSameOrigin) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) return cachedResponse;
        if (request.mode === "navigate") {
          const cachedShell = await caches.match("/");
          if (cachedShell) return cachedShell;
        }
        throw new Error("offline_unavailable");
      }
    })()
  );
});
