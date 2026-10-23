// Caches the whole app so it opens with no signal. Serves the cache first and refreshes it in the background,
// so a new version shows up the next time the app is opened.
const CACHE = "pca-v4";
const FILES = [
  "./", "index.html", "app.js", "db.js", "export.js", "sections.js",
  "vendor/docx.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "logo.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const hit = await cache.match(req, { ignoreSearch: true });
      const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
      return hit || (await net) || Response.error();
    })
  );
});
