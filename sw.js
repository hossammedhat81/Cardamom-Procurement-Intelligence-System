/* ═══════════════════════════════════════════════
   Service Worker — SELF-DESTRUCT
   This SW kills itself, clears all caches, and
   forces the browser to load everything fresh.
   ═══════════════════════════════════════════════ */

// Immediately take over from old SW
self.addEventListener('install', () => self.skipWaiting());

// On activate: nuke ALL caches, unregister, and reload all open tabs
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.map(k => caches.delete(k))))
            .then(() => self.clients.matchAll({ type: 'window' }))
            .then(clients => {
                // Tell each open tab to reload
                clients.forEach(client => client.navigate(client.url));
            })
            .then(() => self.registration.unregister())
    );
});

// Pass all requests straight to network — no caching at all
self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
});
