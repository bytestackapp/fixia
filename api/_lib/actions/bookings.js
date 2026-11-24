import { sb, q } from '../db.js';
import { httpError } from '../auth.js';
import { pushTo } from '../push.js';
import { mail } from '../mail.js';
import { credit } from '../referral.js';
import { clientIp } from '../http.js';

const providerOf = async (user) => (await sb(`providers?user_id=eq.${q(user.id)}&select=id,biz_name,user_id&limit=1`))?.[0];
const inquiry = async (id) => { const r = (await sb(`inquiries?id=eq.${q(id)}&limit=1`))?.[0]; if (!r) throw httpError(404, 'Booking not found.'); return r; };
const mine = (user, inq) => { if (user.role !== 'admin' && user.id !== inq.regular_user_id) throw httpError(403, 'This is not your booking.'); };
const patch = (id, body) => sb(`inquiries?id=eq.${q(id)}`, { method: 'PATCH', prefer: 'return=minimal', body });

export async function list(user) {
  const shape = (r, who) => ({ id: r.id, status: r.status, message: r.user_message || '', service: r.listing_title || '', updatedAt: r.updated_at, unread: user.role === 'provider' ? !!r.provider_has_unread : !!r.user_has_unread, rating: r.rating_stars ? { stars: r.rating_stars, comment: r.rating_comment || '' } : null, with: who });
  if (user.role === 'provider') {
    const prov = await providerOf(user);
    if (!prov) return { items: [] };
    const rows = (await sb(`inquiries?provider_id=eq.${q(prov.id)}&order=updated_at.desc&limit=200`)) || [];
    const ids = [...new Set(rows.map((r) => r.regular_user_id))];
    const us = ids.length ? (await sb(`users?id=in.(${ids.map(q).join(',')})&select=id,first_name,last_name,phone`)) || [] : [];
    return { items: rows.map((r) => { const c = us.find((u) => u.id === r.regular_user_id); return shape(r, { name: c ? `${c.first_name} ${c.last_name}` : 'Customer', phone: ['pending', 'active'].includes(r.status) ? c?.phone : null }); }) };
  }
  const rows = (await sb(`inquiries?regular_user_id=eq.${q(user.id)}&order=updated_at.desc&limit=200`)) || [];
  const pids = [...new Set(rows.map((r) => r.provider_id))];
  const provs = pids.length ? (await sb(`providers?id=in.(${pids.map(q).join(',')})&select=id,biz_name,city_name,province_name,user_id,avatar_url`)) || [] : [];
  const us = provs.length ? (await sb(`users?id=in.(${provs.map((p) => q(p.user_id)).join(',')})&select=id,phone`)) || [] : [];
  return { items: rows.map((r) => { const p = provs.find((x) => x.id === r.provider_id) || {}; return shape(r, { id: p.id, name: p.biz_name || 'Provider', avatarUrl: p.avatar_url, location: [p.city_name, p.province_name].filter(Boolean).join(', '), phone: ['active', 'done'].includes(r.status) ? us.find((u) => u.id === p.user_id)?.phone : null }); }) };
}

export async function create(user, { providerId, listingId, message }, req) {
  if (user.role !== 'regular') throw httpError(403, 'Only customer accounts can book.');
  const text = String(message || '').trim();
  if (text.length < 10 || text.length > 500) throw httpError(400, 'Describe the job in 10–500 characters.');
  const prov = (await sb(`providers?id=eq.${q(providerId)}&status=eq.approved&select=id,user_id&limit=1`))?.[0];
  if (!prov) throw httpError(404, 'This provider is not available.');
  const listing = (await sb(`listings?id=eq.${q(listingId)}&provider_id=eq.${q(providerId)}&is_active=eq.true&select=id,title&limit=1`))?.[0];
  if (!listing) throw httpError(400, 'Please choose one of the provider\'s services.');
  const dupe = await sb(`inquiries?regular_user_id=eq.${q(user.id)}&provider_id=eq.${q(providerId)}&status=in.(pending,active,done)&select=id&limit=1`);
  if (dupe?.length) throw httpError(409, 'You already have an open booking with this provider.');
  await sb('inquiries', { method: 'POST', prefer: 'return=minimal', body: { regular_user_id: user.id, provider_id: providerId, user_message: text, status: 'pending', listing_id: listing.id, listing_title: listing.title, user_has_unread: false, provider_has_unread: true, user_ip: clientIp(req) } });
  pushTo(prov.user_id, { title: 'New booking request', body: listing.title, url: '/bookings' });
}

async function toProvider(inq, title) { const p = (await sb(`providers?id=eq.${q(inq.provider_id)}&select=user_id&limit=1`))?.[0]; pushTo(p?.user_id, { title, url: '/bookings' }); }

export async function cancel(user, { id }) {
  const inq = await inquiry(id); mine(user, inq);
  if (!['pending', 'active'].includes(inq.status)) throw httpError(409, 'This booking can no longer be cancelled.');
  await patch(id, { status: 'cancelled', user_has_unread: false, provider_has_unread: true });
  toProvider(inq, 'Booking cancelled by customer');
}
export async function dispute(user, { id }) {
  const inq = await inquiry(id); mine(user, inq);
  if (inq.status !== 'done') throw httpError(409, 'Only a finished job can be disputed.');
  await patch(id, { status: 'disputed', user_has_unread: false, provider_has_unread: true });
  toProvider(inq, 'A customer disputed a job');
}
async function ownProvider(user, inq) {
  if (user.role === 'admin') return;
  const p = await providerOf(user);
  if (!p || p.id !== inq.provider_id) throw httpError(403, 'This is not your booking.');
}
export async function providerCancel(user, { id }) {
  const inq = await inquiry(id); await ownProvider(user, inq);
  if (!['pending', 'active'].includes(inq.status)) throw httpError(409, 'This booking can no longer be cancelled.');
  await patch(id, { status: 'cancelled', user_has_unread: true, provider_has_unread: false });
  pushTo(inq.regular_user_id, { title: 'Booking cancelled by provider', url: '/bookings' });
}
export async function markDone(user, { id }) {
  const inq = await inquiry(id); await ownProvider(user, inq);
  if (!['pending', 'active'].includes(inq.status)) throw httpError(409, 'This booking is not open.');
  await patch(id, { status: 'done', user_has_unread: true, provider_has_unread: false });
  pushTo(inq.regular_user_id, { title: 'Job marked as done', body: 'Confirm and leave a rating.', url: '/bookings' });
}

export async function complete(user, { id, stars, comment, anonymous }, req) {
  const inq = await inquiry(id); mine(user, inq);
  const rated = !!inq.rating_stars;
  if (!(inq.status === 'done' || (inq.status === 'completed' && !rated))) throw httpError(409, 'This booking cannot be completed.');
  const n = Number(stars) || 0;
  if (n && (n < 1 || n > 5)) throw httpError(400, 'Rating must be 1–5.');
  const text = String(comment || '').slice(0, 500);
  const update = { status: 'completed', provider_has_unread: true, user_has_unread: false };
  if (n) Object.assign(update, { rating_stars: n, rating_comment: text, rated_at: new Date().toISOString() });
  const prov = (await sb(`providers?id=eq.${q(inq.provider_id)}&select=id,user_id,biz_name&limit=1`))?.[0];
  if (n) {
    const u = (await sb(`users?id=eq.${q(inq.regular_user_id)}&select=first_name,last_name&limit=1`))?.[0];
    const full = u ? `${u.first_name} ${u.last_name}`.trim() : '';
    const name = anonymous && full ? full.split(' ').map((p) => p.slice(0, 3) + '***').join(' ') : full;
    await sb('ratings', { method: 'POST', prefer: 'return=minimal', body: { provider_id: inq.provider_id, regular_user_id: inq.regular_user_id, inquiry_id: id, stars: n, comment: text, is_anonymous: !!anonymous, display_name: name, user_ip: clientIp(req) } });
    await patch(id, update);
    const all = (await sb(`ratings?provider_id=eq.${q(inq.provider_id)}&select=stars`)) || [];
    const avg = all.length ? Math.round((all.reduce((s, r) => s + r.stars, 0) / all.length) * 10) / 10 : 0;
    await sb(`providers?id=eq.${q(inq.provider_id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { avg_rating: avg, total_ratings: all.length } });
    const pu = (await sb(`users?id=eq.${q(prov.user_id)}&select=email&limit=1`))?.[0];
    if (pu) mail('rating_notify', { email: pu.email, bizName: prov.biz_name, stars: n, comment: text, newAvg: avg });
  } else {
    await patch(id, update);
  }
  pushTo(prov?.user_id, { title: n ? `New ${n}-star rating` : 'Job confirmed complete', url: '/bookings' });
  // first finished job by a free member pays the referrer 1 point
  const booker = (await sb(`users?id=eq.${q(inq.regular_user_id)}&select=payment_status&limit=1`))?.[0];
  if (!booker?.payment_status || booker.payment_status === 'free') {
    const done = (await sb(`inquiries?regular_user_id=eq.${q(inq.regular_user_id)}&status=eq.completed&select=id`)) || [];
    if (done.length === 1) await credit(inq.regular_user_id, 1).catch(() => {});
  }
}

/* ── notifications are derived from bookings ── */
const flag = (u) => (u.role === 'provider' ? 'provider_has_unread' : 'user_has_unread');
const scope = async (user) => {
  if (user.role === 'provider') { const p = await providerOf(user); return p ? `provider_id=eq.${q(p.id)}` : null; }
  return `regular_user_id=eq.${q(user.id)}`;
};
export async function counts(user) {
  const s = await scope(user);
  if (!s) return { unread: 0 };
  return { unread: ((await sb(`inquiries?${s}&${flag(user)}=eq.true&select=id`)) || []).length };
}
export async function notifications(user) {
  const s = await scope(user); if (!s) return { items: [] };
  const dis = user.role === 'provider' ? 'provider_notif_dismissed' : 'user_notif_dismissed';
  const rows = (await sb(`inquiries?${s}&${dis}=not.is.true&order=updated_at.desc&limit=100&select=id,status,updated_at,${flag(user)}`)) || [];
  return { items: rows.map((r) => ({ id: r.id, status: r.status, updatedAt: r.updated_at, unread: !!r[flag(user)] })) };
}
export async function markRead(user, { id }) {
  const s = await scope(user); if (!s) return;
  await sb(`inquiries?${s}${id ? `&id=eq.${q(id)}` : `&${flag(user)}=eq.true`}`, { method: 'PATCH', prefer: 'return=minimal', body: { [flag(user)]: false } });
}
export async function clearRead(user) {
  const s = await scope(user); if (!s) return;
  const dis = user.role === 'provider' ? 'provider_notif_dismissed' : 'user_notif_dismissed';
  await sb(`inquiries?${s}&${flag(user)}=eq.false&status=in.(completed,cancelled,disputed)`, { method: 'PATCH', prefer: 'return=minimal', body: { [dis]: true } });
}
