const V = "nur-v6", SHELL = ["/", "/static/style.css", "/static/app.js", "/static/manifest.webmanifest", "/static/icon.svg", "/data/quran.json", "/data/invocations.json", "/data/audio.json", "/data/don.json"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api")) return;
  // réseau d'abord (contenus à jour), cache en secours hors connexion
  e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); return res; })
    .catch(() => caches.match(r).then(m => m || caches.match("/"))));
});
self.addEventListener("push", e => {
  let d = {}; try { d = e.data.json(); } catch {}
  e.waitUntil(self.registration.showNotification(d.title || "NUR", {body: d.body || "", tag: d.tag, icon: "/static/icon-192.png", badge: "/static/icon-192.png"}));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({type: "window"}).then(l => l.length ? l[0].focus() : clients.openWindow("/#prayers")));
});
