// Olivas · service worker: hace que la app abra sin cobertura y recibe las notificaciones.
// Va junto a index.html en GitHub (misma carpeta). Si se cambia este archivo, sube el número de V.
const V = 'olivas-3.36';
const BASE = ['./', './index.html', './manifest.webmanifest', './icono-192.png', './icono-512.png', './icono-badge.png'];
const LIBS = /^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com)\//;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => Promise.all(BASE.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('olivas-') && k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  // La página: primero la red (así siempre es la última versión); sin cobertura, la que había guardada
  if (r.mode === 'navigate' || (u.origin === location.origin && /\/(index\.html)?$/.test(u.pathname))) {
    e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put('./index.html', cp)); } return res; })
      .catch(() => caches.match('./index.html').then(m => m || caches.match('./'))));
    return;
  }
  // Librerías (Supabase, Excel, mapa) e iconos: de lo guardado, y se refrescan por detrás
  if (LIBS.test(r.url) || (u.origin === location.origin && /\.(png|webmanifest|js|css)$/.test(u.pathname))) {
    e.respondWith(caches.open(V).then(async c => {
      const m = await c.match(r);
      const f = fetch(r).then(res => { if (res.ok || res.type === 'opaque') c.put(r, res.clone()); return res; }).catch(() => m);
      return m || f;
    }));
  }
  // Lo demás (datos, tiempo, mapas…) va siempre a la red: la app ya guarda sus datos para cuando no hay cobertura
});

// Notificaciones que manda el servidor (heladas, AEMET, plagas, lo de cada mañana)
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { texto: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'Olivas', {
    body: d.texto || '', icon: 'icono-192.png', badge: 'icono-badge.png', lang: 'es',
    tag: d.tag || undefined, renotify: !!d.tag, data: { url: d.url || './' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    const w = ws.find(x => x.url.startsWith(self.registration.scope));
    if (w) { w.postMessage({ tipo: 'aviso', url }); return w.focus(); }
    return clients.openWindow(url);
  }));
});
