// sw.js — Stale-While-Revalidate
const CACHE_VERSION = 'uno-pwa-v2';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];
const IMAGE_CACHE = 'uno-images-v1';

self.addEventListener('install', (evt) => {
  self.skipWaiting();
  evt.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(PRECACHE_ASSETS)));
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then(keys => Promise.all(keys
      .filter(k => k !== CACHE_VERSION && k !== IMAGE_CACHE)
      .map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  const networkFetch = fetch(request).then(resp => {
    if (resp && resp.status === 200 && request.method === 'GET') {
      cache.put(request, resp.clone()).catch(()=>{});
    }
    return resp.clone();
  }).catch(()=>null);
  return cached || (await networkFetch) || new Response('', { status: 503 });
}

self.addEventListener('fetch', (evt) => {
  const req = evt.request;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    evt.respondWith(
      fetch(req).catch(() => caches.open(CACHE_VERSION).then(cache => cache.match('index.html')))
    );
    return;
  }

  if (req.destination === 'image' || /\.(png|jpg|jpeg|svg|webp)$/.test(url.pathname)) {
    evt.respondWith(
      caches.open(IMAGE_CACHE).then(async cache => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const netResp = await fetch(req);
          if (netResp && netResp.status === 200) cache.put(req, netResp.clone());
          return netResp;
        } catch (e) {
          return cached || new Response('', { status: 503 });
        }
      })
    );
    return;
  }

  evt.respondWith(staleWhileRevalidate(req));
});
