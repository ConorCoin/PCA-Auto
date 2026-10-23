const CACHE = "pca-v2";
const FILES = ["./", "./index.html", "./manifest.webmanifest"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))));
// Network first so API calls and updates are never stale; cache is the offline fallback for the shell only.
self.addEventListener("fetch", e => { if (e.request.method !== "GET" || new URL(e.request.url).pathname.startsWith("/api/")) return; e.respondWith(fetch(e.request).catch(() => caches.match(e.request))); });
