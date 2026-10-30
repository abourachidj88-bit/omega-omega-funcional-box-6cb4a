'use strict';
// Service worker de OMEGA: la app abre rápido y muestra la última versión conocida si se corta internet.
// Los datos (API) y los videos siempre se piden al servidor.
const CACHE = 'omega-ver4-0';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/media/')) return;
  e.respondWith(
    fetch(req).then(r => { if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(req, copia)); } return r; })
      .catch(() => caches.match(req).then(r => r || caches.match('/index.html') || caches.match('/')))
  );
});
