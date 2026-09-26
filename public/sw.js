// ============================================
// SERVICE WORKER KASIRKU AI — 100% OFFLINE
// Strategi:
//  - App shell (HTML/RSC payload)  : network-first, fallback ke cache saat offline
//  - Aset statis (/_next/static/*) : cache-first (immutable, hash URL)
//  - Navigasi offline              : fallback ke "/offline"
//  - Tidak ada request ke luar scope (filosofi local-only dijaga)
// ============================================
const VERSION = "kasirku-v1";
const STATIC_CACHE = `${VERSION}-static`;
const PAGES_CACHE = `${VERSION}-pages`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGES_CACHE);
      await cache.addAll([OFFLINE_URL, "/"]).catch(() => {});
      // Aktifkan segera tanpa menunggu tab lama tertutup
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Hanya tangani GET same-origin — semua request lain dibiarkan lewat
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // Aset statis ber-hash: cache-first (perubahan versi URL otomatis oleh build)
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            return res;
          })
      )
    );
    return;
  }

  // Navigasi halaman: network-first, fallback cache, fallback halaman offline
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          const copy = res.clone();
          caches.open(PAGES_CACHE).then((c) => c.put(req, copy));
          return res;
        } catch {
          const cache = await caches.open(PAGES_CACHE);
          return (
            (await cache.match(req)) ||
            (await cache.match(url.pathname)) ||
            (await cache.match(OFFLINE_URL)) ||
            (await cache.match("/")) ||
            new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
          );
        }
      })()
    );
  }
});
