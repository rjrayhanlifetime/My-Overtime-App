'use strict';
const CACHE_PREFIX = 'my-overtime-app-';
const CACHE_VERSION = 'v17';
const STATIC_CACHE = CACHE_PREFIX + CACHE_VERSION;
const RUNTIME_CACHE = CACHE_PREFIX + 'runtime-v2';
const APP_SHELL = ['./', './index.html', './manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(APP_SHELL).catch(() => {});
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== STATIC_CACHE && key !== RUNTIME_CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'MY_OVERTIME_ACTIVATE_CACHE') {
    event.waitUntil(self.clients.claim());
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin) return; // Do not intercept Firebase/API/CDN traffic.

  // OFFLINE-FIRST navigation: show the cached app immediately, then refresh it
  // in the background so a slow connection cannot delay opening the website.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = (await cache.match(request)) || (await cache.match('./index.html')) || (await cache.match('./'));
      const refresh = fetch(request).then(response => {
        if (response && response.ok) {
          cache.put('./index.html', response.clone()).catch(() => {});
        }
        return response;
      }).catch(() => null);
      if (cached) {
        event.waitUntil(refresh);
        return cached;
      }
      const fresh = await refresh;
      return fresh || Response.error();
    })());
    return;
  }

  // Cache-first for small same-origin static files; refresh cache in the background.
  event.respondWith((async () => {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
      return response;
    } catch (error) {
      const runtime = await caches.open(RUNTIME_CACHE);
      const fallback = await runtime.match(request);
      if (fallback) return fallback;
      throw error;
    }
  })());
});
