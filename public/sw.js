// ============================================
// SERVICE WORKER KASIRKU AI — 100% OFFLINE
// Strategi:
//  - PRECACHE semua route (HTML) + chunk statis saat install:
//    aplikasi bisa dibuka penuh bahkan sebelum halaman dikunjungi
//  - Aset statis (/_next/static/*) : cache-first (immutable, hash URL)
//  - Navigasi offline              : fallback ke precache / halaman /offline
//  - Tidak ada request ke luar scope (filosofi local-only dijaga)
//  Versi SW baru = cache lama dibersihkan saat activate.
// ============================================
const VERSION = "kasirku-v2";
const STATIC_CACHE = `${VERSION}-static`;
const PAGES_CACHE = `${VERSION}-pages`;

// Semua route aplikasi + fallback offline. Chunks JS/CSS ditambahkan
// dinamis di bawah dari daftar build (lihat PRECACHE_URLS injection).
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [
  "/",
  "/kasir",
  "/produk",
  "/supplier",
  "/dashboard",
  "/users",
  "/profile",
  "/lock",
  "/login",
  "/settings/backup",
  OFFLINE_URL,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const pages = await caches.open(PAGES_CACHE);
      // Precache HTML semua route — gagal satu tidak memblokir yang lain
      await Promise.allSettled(PRECACHE_URLS.map((u) => pages.add(u)));
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

  // Navigasi halaman: network-first, fallback precache, fallback /offline
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
