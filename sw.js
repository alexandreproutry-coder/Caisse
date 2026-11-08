// Caisse Comptoir 360 – fonctionnement hors connexion
const CACHE = "caisse-c360-v15";
const FILES = ["./", "./index.html"];
const EXTRAS = ["./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(FILES).then(() => Promise.all(EXTRAS.map(f => c.add(f).catch(() => {})))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// La copie gardée sur l'appareil d'abord (démarrage instantané, même sans réseau),
// puis mise à jour discrète en arrière-plan quand Internet est là.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  // Ne garder hors ligne que la caisse elle-même, la bibliothèque Firebase et les polices.
  // Les échanges en direct avec la base Firebase passent toujours par le réseau.
  const u = new URL(e.request.url);
  const garder = u.origin === self.location.origin || u.hostname === "www.gstatic.com" || u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com";
  if (!garder) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(cached => {
      const net = fetch(e.request)
        .then(res => {
          if (res && (res.ok || res.type === "opaque")) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached || (e.request.mode === "navigate" ? caches.match("./index.html") : undefined));
      return cached || net;
    })
  );
});
