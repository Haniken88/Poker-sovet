// Офлайн-режим: сначала пробуем интернет (всегда свежая версия),
// без связи — берём сохранённую копию из телефона.
const CACHE = 'poker-v19';
const FILES = [
  './', 'index.html', 'app.css', 'app.js', 'manifest.webmanifest',
  'src/cards.js', 'src/evaluator.js', 'src/equity.js', 'src/hands.js', 'src/handRanks.js',
  'src/positions.js', 'src/preflop.js', 'src/postflop.js', 'src/table.js', 'src/ranges.js', 'src/preflopData.js', 'src/openTables.js', 'src/nicknames.js',
  'fonts/fonts.css', 'fonts/prata-latin.woff2', 'fonts/prata-cyrillic.woff2',
  'fonts/manrope-latin.woff2', 'fonts/manrope-cyrillic.woff2',
  'icons/icon-192.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return;
  event.respondWith(
    // cache: 'no-cache' — всегда сверяемся с сайтом, а не берём старую копию из памяти телефона.
    fetch(event.request, { cache: 'no-cache' })
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true })),
  );
});
