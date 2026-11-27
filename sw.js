// Gherwin Fitness service worker — saves the app on the phone so it opens with no internet.
// Hosts like Cloudflare redirect /index.html -> /. A saved *redirect* can't be shown offline (Chrome: ERR_FAILED),
// so every response is stored as a clean copy, and the page itself is always saved under "./".
const VERSION = 'gf-v20';
const FILES = [
 "./",
 "styles.css",
 "app.js",
 "data.js",
 "exercises.js",
 "demos.js",
 "exdb.js",
 "foods-db.js",
 "firebase-config.js",
 "manifest.webmanifest",
 "lib/pdf-lib.min.js",
 "icons/icon-192.png",
 "icons/icon-512.png",
 "icons/maskable-192.png",
 "icons/maskable-512.png",
 "icons/apple-touch-icon.png",
 "icons/favicon-64.png"
];
const RUNTIME_HOSTS = ['raw.githubusercontent.com', 'cdn.jsdelivr.net', 'unpkg.com'];
const clean = res => (res && res.redirected ? res.blob().then(b => new Response(b, { status: res.status, statusText: res.statusText, headers: res.headers })) : Promise.resolve(res));
const put = (cacheName, key, res) => clean(res).then(r => caches.open(cacheName).then(c => c.put(key, r)));
const isPage = (req, url) => req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
const pageKey = () => new URL('./', self.registration.scope).href;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(FILES.map(f =>
    fetch(f, { cache: 'no-cache' }).then(res => { if (!res.ok) throw new Error(f + ' ' + res.status); return put(VERSION, f === './' ? pageKey() : new URL(f, self.registration.scope).href, res); })
  ))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== 'gf-runtime').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const fromCache = key => caches.open(VERSION).then(c => c.match(key, { ignoreSearch: true })).then(hit => hit || caches.match(key, { ignoreSearch: true }));
const offlinePage = () => fromCache(pageKey()).then(hit => hit || new Response('<!doctype html><meta name="viewport" content="width=device-width"><body style="font-family:sans-serif;padding:24px"><h2>Gherwin Fitness</h2><p>Open the app once with internet so it can save itself for offline use.</p><button onclick="location.reload()">Try again</button>', { headers: { 'Content-Type': 'text/html' } }));

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url), same = url.origin === location.origin;
  if (!same && !RUNTIME_HOSTS.includes(url.hostname)) return; // Firebase, food search: always live
  if (same && isPage(req, url)) {
    // The app page: newest when online (max 4 s wait), saved copy otherwise. Always answered from "./".
    e.respondWith(Promise.race([
      fetch(pageKey(), { cache: 'no-cache' }).then(res => { if (!res.ok) throw new Error('bad'); put(VERSION, pageKey(), res.clone()); return clean(res); }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 4000))
    ]).catch(offlinePage));
    return;
  }
  if (same && /\.(js|css|webmanifest)$/.test(url.pathname)) {
    // App code: newest when online, saved copy when offline.
    e.respondWith(Promise.race([
      fetch(req, { cache: 'no-cache' }).then(res => { if (!res.ok) throw new Error('bad'); put(VERSION, url.href, res.clone()); return clean(res); }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 4000))
    ]).catch(() => fromCache(url.href).then(hit => hit || Response.error())));
    return;
  }
  // Pictures etc.: saved copy first, otherwise download and save.
  e.respondWith(fromCache(same ? url.href : req.url).then(hit => hit || fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') put(same ? VERSION : 'gf-runtime', same ? url.href : req, res.clone());
    return clean(res);
  })).catch(() => Response.error()));
});

// Notification taps: buttons (Pause / Resume / Stop / Skip / Done) are passed to the open app without opening it;
// tapping the notification itself brings the app to the front.
self.addEventListener('notificationclick', e => {
  const act = e.action; e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    if (act) {
      if (list.length) { list.forEach(c => c.postMessage({ type: 'gf-action', action: act })); return; }
      return self.clients.openWindow('./?action=' + encodeURIComponent(act));
    }
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  }));
});
