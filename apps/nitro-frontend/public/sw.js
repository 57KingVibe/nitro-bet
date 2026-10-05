// NitroBet service worker. It lets the app install on a phone and open faster.
// It never touches API calls (they go to another origin) and never caches the page itself,
// so a new deploy shows up on the next visit instead of an old copy.
const CACHE = 'nitrobet-static-v1';
const PRECACHE = ['/icons/icon-192.png', '/icons/icon-512.png', '/logo.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // Built files have a hash in their name and never change, so they are safe to serve from the cache.
  if (/^\/(assets|icons|brand)\//.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
  }
});
