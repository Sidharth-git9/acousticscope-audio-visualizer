// AcousticScope — Created by Sidharth Subrahmanya H · Idea by Mr. Shanmukharaja M
const CACHE_NAME = "acousticscope-pwa-v8";
const APP_FILES = ["./", "./index.html", "./style.css", "./script.js", "./manifest.json", "./icons/icon-192.png", "./icons/icon-512.png"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => (key.startsWith("acousticscope-pwa-") || (key.startsWith("audioscope-pwa-") || key.startsWith("ondulyra-pwa-"))) && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // Prefer the deployed version for the app shell and code; retain cached copies for offline use.
  if (event.request.mode === "navigate" || /\.(html|css|js|json)$/.test(url.pathname)) {
    event.respondWith(fetch(event.request).then(response => {
      if (response && response.ok) caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
      return response;
    }).catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html"))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response && response.ok) caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
    return response;
  })));
});
