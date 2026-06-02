const CACHE_NAME = 'fixia-v16';  // increment this every time you update fixia-data.js

const STATIC_ASSETS = [];
/* production — uncomment when ready to deploy:
const STATIC_ASSETS = [
  '/homepage.html',
  '/login.html',
  '/presignup.html',
  '/fixia-data.js',
  '/manifest.json',
];
*/

// Install: pre-cache key static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  e.waitUntil(clients.claim());
});

self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'Fixia', {
      body:  data.body  || 'You have a new notification.',
      icon:  data.icon  || '/public/images/fixia-icon-192.png',
      badge: data.badge || '/public/images/fixia-icon-192.png',
      data:  { url: data.url || '/homepage.html' },
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      // If app is already open, focus it
      for (const client of windowClients) {
        if (client.url.includes(e.notification.data.url) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(e.notification.data.url);
      }
    })
  );
});

// Fetch: network-first for API calls and ALL JS files, cache-first for everything else
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always go to network for API calls, Supabase, and JS files
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase.co') ||
    url.pathname.endsWith('.js')
  ) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Cache-first for everything else (HTML, CSS, images)
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});