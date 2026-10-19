<<<<<<< HEAD
const CACHE_VERSION = 'v2.0.0';                 // bump on every deployment
const CACHE_NAME = `fixia-${CACHE_VERSION}`;
const SHELL = ['/css/fixia.css','/css/icons.css','/js/fx-boot.js','/fixia-data.js','/env-config.js','/homepage.html','/login.html','/manifest.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>Promise.allSettled(SHELL.map(u=>c.add(u)))));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE_NAME).map(x=>caches.delete(x)))));e.waitUntil(clients.claim());});
self.addEventListener('push',e=>{const d=e.data?.json()||{};e.waitUntil(self.registration.showNotification(d.title||'Fixia',{body:d.body||'You have a new notification.',icon:d.icon||'/images/fixia-icon-192.png',badge:d.badge||'/images/fixia-icon-192.png',data:{url:d.url||'/homepage.html'}}));});
self.addEventListener('notificationclick',e=>{e.notification.close();const u=e.notification.data.url;e.waitUntil(clients.matchAll({type:'window'}).then(w=>{for(const c of w)if(c.url.includes(u)&&'focus' in c)return c.focus();return clients.openWindow&&clients.openWindow(u);}));});
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api/'))return;   // Supabase + API: never cached here
  if(r.mode==='navigate'){e.respondWith(fetch(r).then(x=>{const c=x.clone();caches.open(CACHE_NAME).then(k=>k.put(r,c));return x;}).catch(()=>caches.match(r)));return;}  // HTML: network-first, offline fallback
  e.respondWith(caches.match(r).then(hit=>{const net=fetch(r).then(x=>{if(x.ok){const c=x.clone();caches.open(CACHE_NAME).then(k=>k.put(r,c));}return x;}).catch(()=>hit);return hit||net;}));  // css/js/img: instant, refreshed behind
});
=======
const CACHE_VERSION = 'v1.0.10';                 // bump this on every deployment
const CACHE_NAME = `fixia-${CACHE_VERSION}`;

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
>>>>>>> 2019ab449e74c390791216dce6670ff4c1a77070
