/* ═══════════════════════════════════════════════
   Service Worker — Cardamom Intelligence PWA
   Network-first for local assets, cache-first for CDN
   ═══════════════════════════════════════════════ */

const CACHE_NAME = 'cardamom-v8';
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './assets/css/style.css',
    './assets/css/dark-theme.css',
    './assets/css/animations.css',
    './assets/js/data-loader.js',
    './assets/js/forecasting.js',
    './assets/js/charts.js',
    './assets/js/pdf-export.js',
    './assets/js/main.js',
    './assets/data/forecasts.json',
    './assets/data/forecasts/forecast-feb-mar-2026.json',
    './assets/data/forecasts/forecast-mar-apr-2026.json',
    './assets/data/forecasts/forecast-apr-may-2026.json',
    './assets/data/forecasts/forecast-may-jun-2026.json',
    './assets/data/forecasts/forecast-jun-jul-2026.json',
    './assets/data/forecasts/forecast-jul-aug-2026.json',
    './assets/data/sample-data.json',
    './assets/images/favicon.svg',
];

const CDN_ASSETS = [
    'https://cdn.plot.ly/plotly-2.27.0.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.1/jspdf.plugin.autotable.min.js',
];

// Install — cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch — stale-while-revalidate for CDN, cache-first for local
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // CDN assets — cache first, update in background
    if (CDN_ASSETS.some(cdn => event.request.url.startsWith(cdn.split('/').slice(0, 3).join('/')))) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                const fetched = fetch(event.request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
                    }
                    return response;
                }).catch(() => cached);

                return cached || fetched;
            })
        );
        return;
    }

    // Local assets — NETWORK FIRST (always get latest code)
    if (url.origin === location.origin) {
        event.respondWith(
            fetch(event.request).then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
                }
                return response;
            }).catch(() => caches.match(event.request))
        );
        return;
    }

    // All other requests — network first
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});
