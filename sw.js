const CACHE_NAME = 'fuel-data-v1';
const DATA_HOST = 'mkboxself.github.io';
const DATA_PATH_PREFIX = '/fuel-data/';

self.addEventListener('install', (event) => { self.skipWaiting(); });

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (url.hostname === DATA_HOST && url.pathname.startsWith(DATA_PATH_PREFIX)) {
        event.respondWith(staleWhileRevalidate(event.request));
        return;
    }
    if (url.hostname.endsWith('tile.openstreetmap.org')) {
        event.respondWith(cacheFirstWithTimeout(event.request, 3000));
        return;
    }
});

async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    const fetchPromise = fetch(request).then(response => {
        if (response && response.ok) cache.put(request, response.clone());
        return response;
    }).catch(err => { console.warn('[SW] Fetch fallito, uso cache:', err.message); return cached; });
    return cached || fetchPromise;
}

async function cacheFirstWithTimeout(request, timeoutMs) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    return Promise.race([
        fetch(request).then(response => { if (response && response.ok) cache.put(request, response.clone()); return response; }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout tile')), timeoutMs))
    ]).catch(() => cached || fetch(request));
}

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
    if (event.data && event.data.type === 'CLEAR_DATA_CACHE') {
        caches.delete(CACHE_NAME).then(() => { event.source && event.source.postMessage({ type: 'CACHE_CLEARED' }); });
    }
});