const CACHE_PREFIX = 'my-overtime-app-';
const RUNTIME_CACHE = CACHE_PREFIX + 'runtime';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'MY_OVERTIME_ACTIVATE_CACHE') {
    event.waitUntil((async () => {
      const keep = event.data.cacheName;
      const keys = await caches.keys();
      await Promise.all(keys
        .filter(k => k.startsWith(CACHE_PREFIX) && k !== keep)
        .map(k => caches.delete(k)));
      await self.clients.claim();
    })());
  }
});

function appIndexURL() {
  return new URL('./index.html', self.registration.scope).pathname;
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const isNavigation = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        if (fresh.ok) {
          const cache = await caches.open(RUNTIME_CACHE);
          await cache.put(req, fresh.clone()).catch(() => {});
          const indexReq = new Request(appIndexURL());
          await cache.put(indexReq, fresh.clone()).catch(() => {});
        }
        return fresh;
      } catch (err) {
        const keys = await caches.keys();
        for (const key of keys.filter(k => k.startsWith(CACHE_PREFIX))) {
          const cache = await caches.open(key);
          const hit = await cache.match(req) || await cache.match(appIndexURL());
          if (hit) return hit;
        }
        throw err;
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const keys = await caches.keys();
    for (const key of keys.filter(k => k.startsWith(CACHE_PREFIX))) {
      const cache = await caches.open(key);
      const hit = await cache.match(req);
      if (hit) return hit;
    }
    try {
      const fresh = await fetch(req);
      if (fresh.ok) {
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(req, fresh.clone()).catch(() => {});
      }
      return fresh;
    } catch (err) {
      throw err;
    }
  })());
});
