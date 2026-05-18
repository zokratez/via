/*
 * PACO Peptide service worker.
 *
 * Strategy:
 *   - Static assets (Next.js _next/static/, public files): cache-first.
 *   - API routes (/api/*): network-first, no caching.
 *   - Public HTML navigations: network-first with offline fallback to last
 *     cached version of the requested URL.
 *   - Private HTML navigations: network-only. Never cache user data.
 *
 * Bump CACHE_VERSION whenever the static-asset cache shape changes.
 */

const CACHE_VERSION = "pp-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGES_CACHE = `${CACHE_VERSION}-pages`;

const PRECACHE_URLS = [
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon-") ||
    url.pathname === "/manifest.json" ||
    url.pathname === "/apple-touch-icon.png" ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".woff2")
  );
}

function isApi(url) {
  return url.pathname.startsWith("/api/");
}

function isPrivatePage(url) {
  return /^\/(es|en)\/(admin|calendar|coach|dashboard|log)(\/|$)/.test(
    url.pathname,
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isApi(url)) {
    // Network-only for API. Don't cache user-specific JSON.
    return;
  }

  if (isPrivatePage(url)) {
    // Network-only for authenticated pages. Don't cache health, coach, or admin data.
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        const fresh = await fetch(req);
        if (fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      }),
    );
    return;
  }

  // HTML navigation: network-first, fall back to cache.
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(PAGES_CACHE);
          if (fresh.ok) cache.put(req, fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(PAGES_CACHE);
          const cached = await cache.match(req);
          if (cached) return cached;
          return new Response(
            "<h1>Offline</h1><p>Reconnect to keep going.</p>",
            { status: 503, headers: { "Content-Type": "text/html" } },
          );
        }
      })(),
    );
  }
});
