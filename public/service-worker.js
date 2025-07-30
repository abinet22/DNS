self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('selamcdms-cache').then(cache => {
      return cache.addAll([
        '/',
        '/selamcdms',
        '/selamcdms/filemanagement',
        '/selamcdms/cdmsusers',
        '/assets/css/style.css',
        '/assets/js/script.js',
      ]);
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});