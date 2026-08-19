const CACHE = "esm-v9";
const ASSETS = ["./manifest.json",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const { request } = e;
  if (request.method !== "GET") return;

  // Let video go straight to the network. Browsers fetch MP4s with Range requests and
  // get 206 Partial Content back, which Cache Storage can't store — intercepting here
  // breaks seeking, and on some browsers playback entirely.
  if (request.url.includes("/media/video/") || request.headers.has("range")) return;

  // Network-first for Supabase/API calls, falling back to cache only if offline.
  if (request.url.includes("supabase.co") || request.url.includes("esm.sh")) {
    e.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // Network-first for HTML/navigation requests (index.html, players/*.html, admin/)
  // so a new deploy is visible immediately to returning visitors. Cache is only a
  // fallback for genuinely offline use, not the primary source of truth.
  const isNavigation = request.mode === "navigate" ||
    (request.headers.get("accept") || "").includes("text/html");
  if (isNavigation) {
    e.respondWith(
      fetch(request).then(res => {
        // Only cache a genuinely OK response — never a 404/500 error page, or the
        // offline fallback would later serve that instead of the real index.html.
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(request, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(request).then(hit => hit || caches.match("./index.html")))
    );
    return;
  }

  // Cache-first for static assets (icons, manifest, photos) — these rarely change and
  // benefit from instant offline-capable loading.
  e.respondWith(
    caches.match(request).then(hit => hit || fetch(request).then(res => {
      // Only cache successful, non-opaque responses. Caching an opaque cross-origin
      // response (e.g. a failed Google Fonts fetch, status 0) or an error response
      // would pin a broken asset in the cache until the CACHE version is bumped.
      if (res && res.ok && res.type !== "opaque") {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(request, copy)).catch(() => {});
      }
      return res;
    }))
  );
});
