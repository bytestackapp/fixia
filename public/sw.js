/* Push notifications only. Pages and files are cached by the browser using hashed filenames, so nothing is cached here. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));
self.addEventListener('push', (e) => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(d.title || 'Fixia', { body: d.body || 'You have a new notification.', icon: '/images/fixia-icon-192.png', badge: '/images/fixia-icon-192.png', data: { url: d.url || '/' } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data.url;
  e.waitUntil(clients.matchAll({ type: 'window' }).then((w) => { for (const c of w) if ('focus' in c) { c.navigate(url); return c.focus(); } return clients.openWindow(url); }));
});
