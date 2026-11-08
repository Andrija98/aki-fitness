// Service worker: aplikacija radi i bez interneta (osim videa).
// Strategija: network-first. Kad ima mreže uzima najnovije i čuva kopiju; kad nema, vraća iz keša.
// Vite fajlovima daje heš u imenu (index-a1b2c3.js), pa ih ne moramo ručno nabrajati.
// Podigni VERSION kad hoćeš da obrišeš stari keš na svim telefonima.
const VERSION = 'aki-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return; // YouTube, fontovi itd. idu direktno
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
  );
});
