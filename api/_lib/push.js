import webpush from 'web-push';
import { sb, q } from './db.js';
let ready = false;
function init() {
  if (ready || !process.env.VAPID_PUBLIC_KEY) return ready;
  webpush.setVapidDetails(`mailto:${process.env.GMAIL_USER}`, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  return (ready = true);
}
// Never throws: a failed notification must not break the action that caused it.
export async function pushTo(userIds, { title = 'Fixia', body = 'You have a new notification.', url = '/' } = {}) {
  try {
    if (!init()) return;
    const ids = [].concat(userIds).filter(Boolean);
    if (!ids.length) return;
    const subs = (await sb(`push_subscriptions?user_id=in.(${ids.map(q).join(',')})&select=id,subscription`)) || [];
    const payload = JSON.stringify({ title, body, url });
    await Promise.all(subs.map((s) => webpush.sendNotification(s.subscription, payload).catch((e) => {
      if (e.statusCode === 404 || e.statusCode === 410) return sb(`push_subscriptions?id=eq.${q(s.id)}`, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
    })));
  } catch (e) { console.warn('[push]', e.message); }
}
