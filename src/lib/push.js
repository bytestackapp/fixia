import { call } from './api.js';

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined' && !import.meta.env.VITE_NATIVE;
export const pushState = () => (!supported() ? 'unsupported' : Notification.permission);

const key = (b64) => { const p = '='.repeat((4 - (b64.length % 4)) % 4); const r = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map((c) => c.charCodeAt(0))); };

export async function enablePush({ ask = false } = {}) {
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'default' && ask) await Notification.requestPermission();
  if (Notification.permission !== 'granted') return Notification.permission;
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const { key: vapid } = await call('push.key');
  if (!vapid) return 'unsupported';
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(vapid) });
  await call('push.subscribe', { subscription: sub.toJSON() });
  return 'granted';
}
