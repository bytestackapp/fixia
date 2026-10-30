const CACHE_VERSION = 'v0.0.4';                 // bump on every deployment
const CACHE_NAME = `fixia-${CACHE_VERSION}`;
const SHELL = ['/css/fixia.css','/css/icons.css','/js/fx-boot.js','/js/fixia-data.js','/js/env-config.js','/homepage.html','/login.html','/manifest.json'];
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
