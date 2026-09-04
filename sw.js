/* Lajme Shqip — service worker: makes the site installable and readable offline.
   App shell: cache first. News data: network first, cached copy as fallback. */
var VERSION = 'lajme-v1';
var SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'i18n.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(VERSION).then(function (cache) { return cache.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return; // fonts, images from outlets: let the browser handle them

  if (/\/data\/news\.json/.test(url.pathname) || /\/feed\.xml$/.test(url.pathname)) {
    event.respondWith(fetch(req).then(function (res) {
      var copy = res.clone();
      caches.open(VERSION).then(function (cache) { cache.put(url.pathname, copy); });
      return res;
    }).catch(function () { return caches.match(url.pathname); }));
    return;
  }

  event.respondWith(caches.match(req, { ignoreSearch: true }).then(function (cached) {
    var network = fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (cache) { cache.put(req, copy); }); }
      return res;
    }).catch(function () { return cached; });
    return cached || network;
  }));
});
