/* FIXIA — /api/booking.js
   All booking actions + the message threads. Every action writes a booking_events row.
   Flow: pending → (provider) accepted=active | declined → done → (client) completed | disputed ; cancelled by either. */
const SUPA_URL = process.env.SUPA_URL;
const KEY      = process.env.SUPA_SERVICE_KEY;
const APP_URL  = process.env.APP_URL || 'https://fixia.ph';
const err = (status, message) => ({ status, message });

async function sb(path, opts = {}) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, { ...opts, headers: {
    apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json',
    Prefer: 'return=representation', ...(opts.headers || {}) } });
  const t = await r.text();
  if (!r.ok) { console.error('[Fixia booking]', r.status, t.slice(0, 200)); throw err(500, 'Database error'); }
  return t ? JSON.parse(t) : null;
}
const min = { headers: { Prefer: 'return=minimal' } };
const patch = (table, id, body) => sb(`${table}?id=eq.${id}`, { method: 'PATCH', ...min, body: JSON.stringify({ ...body, updated_at: new Date().toISOString() }) });
const q = encodeURIComponent;

async function authUser(req) {
  const token = req.headers['x-session-token'], uid = req.headers['x-user-id'];
  if (!token || !uid) throw err(401, 'Unauthorized');
  const u = (await sb(`users?id=eq.${q(uid)}&session_token=eq.${q(token)}&select=id,role,status,first_name,last_name,phone&limit=1`))?.[0];
  if (!u) throw err(401, 'Unauthorized');
  if (u.status === 'suspended') throw err(403, 'Account suspended.');
  return u;
}

async function push(userId) {
  try {
    const subs = await sb(`push_subscriptions?user_id=eq.${userId}&select=subscription`) || [];
    if (!subs.length) return;
    await fetch(`${APP_URL}/api/send-push`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptions: subs.map(s => s.subscription), title: 'Fixia', body: 'You have a new message update.', url: '/messages.html' }) });
  } catch (e) { /* push is best-effort */ }
}

const event = (booking_id, actor, type, text, meta) => sb('booking_events', { method: 'POST', ...min,
  body: JSON.stringify({ booking_id, actor_user_id: actor, type, text: text || null, meta: meta || null }) });

/* Loads a booking and works out which side the caller is on */
async function load(id, user) {
  if (!id) throw err(400, 'Missing booking id.');
  const b = (await sb(`inquiries?id=eq.${q(id)}&limit=1`))?.[0];
  if (!b) throw err(404, 'Booking not found.');
  const prov = (await sb(`providers?id=eq.${b.provider_id}&select=id,user_id,biz_name,package_id,avatar_url&limit=1`))?.[0];
  const isClient = b.regular_user_id === user.id, isProvider = prov?.user_id === user.id;
  if (!isClient && !isProvider) throw err(403, 'This is not your booking.');
  return { b, prov, isClient, isProvider };
}
const need = (b, ...ok) => { if (!ok.includes(b.status)) throw err(409, `Not allowed while the booking is "${b.status}".`); };
const flags = (toClient) => toClient ? { user_has_unread: true, provider_has_unread: false } : { user_has_unread: false, provider_has_unread: true };

const actions = {

  async createBooking({ providerId, listingId, jobDescription }, user) {
    if (user.role === 'provider') throw err(403, 'Providers cannot book other providers. Use a regular account.');
    const desc = (jobDescription || '').trim();
    if (!providerId || !listingId) throw err(400, 'Please choose a service.');
    if (desc.length < 10) throw err(400, 'Please describe the job in at least 10 characters.');
    const prov = (await sb(`providers?id=eq.${q(providerId)}&status=eq.approved&select=id,user_id&limit=1`))?.[0];
    if (!prov) throw err(404, 'Provider not found.');
    if (prov.user_id === user.id) throw err(403, 'You cannot book your own service.');
    const listing = (await sb(`listings?id=eq.${q(listingId)}&provider_id=eq.${prov.id}&is_active=eq.true&select=id,title&limit=1`))?.[0];
    if (!listing) throw err(400, 'That service is no longer available.');
    const dup = await sb(`inquiries?regular_user_id=eq.${user.id}&provider_id=eq.${prov.id}&status=in.(pending,active,done)&select=id&limit=1`);
    if (dup?.length) throw err(409, 'You already have an active booking with this provider.');
    const row = (await sb('inquiries', { method: 'POST', body: JSON.stringify({
      regular_user_id: user.id, provider_id: prov.id, listing_id: listing.id, listing_title: listing.title,
      user_message: desc, status: 'pending', ...flags(false) }) }))?.[0];
    await event(row.id, user.id, 'sent', desc, { listing_title: listing.title });
    await push(prov.user_id);
    return { ok: true, id: row.id };
  },

  async acceptBooking({ id }, user) {
    const { b, prov, isProvider } = await load(id, user);
    if (!isProvider) throw err(403, 'Only the provider can accept.');
    need(b, 'pending');
    const pkg = prov.package_id ? (await sb(`packages?id=eq.${q(prov.package_id)}&select=booking_limit&limit=1`))?.[0] : null;
    const limit = pkg?.booking_limit ?? 5;
    if (limit && limit < 999) {
      const active = await sb(`inquiries?provider_id=eq.${prov.id}&status=eq.active&select=id`) || [];
      if (active.length >= limit) throw err(409, 'You reached your active booking limit. Finish a job or upgrade your plan.');
    }
    await patch('inquiries', id, { status: 'active', ...flags(true) });
    await event(id, user.id, 'accepted');
    await push(b.regular_user_id);
    return { ok: true };
  },

  async declineBooking({ id, reason }, user) {
    const { b, isProvider } = await load(id, user);
    if (!isProvider) throw err(403, 'Only the provider can decline.');
    need(b, 'pending');
    await patch('inquiries', id, { status: 'declined', ...flags(true) });
    await event(id, user.id, 'declined', (reason || '').trim().slice(0, 300));
    await push(b.regular_user_id);
    return { ok: true };
  },

  async cancelBooking({ id }, user) {
    const { b, prov, isClient } = await load(id, user);
    if (!isClient && b.status === 'pending') return actions.declineBooking({ id }, user);   // provider "cancelling" a new request = decline
    need(b, 'pending', 'active');
    await patch('inquiries', id, { status: 'cancelled', ...flags(!isClient) });
    await event(id, user.id, 'cancelled');
    await push(isClient ? prov.user_id : b.regular_user_id);
    return { ok: true };
  },

  async markDone({ id }, user) {
    const { b, isProvider } = await load(id, user);
    if (!isProvider) throw err(403, 'Only the provider can mark a job done.');
    need(b, 'active');
    await patch('inquiries', id, { status: 'done', ...flags(true) });
    await event(id, user.id, 'done');
    await push(b.regular_user_id);
    return { ok: true };
  },

  async disputeBooking({ id }, user) {
    const { b, prov, isClient } = await load(id, user);
    if (!isClient) throw err(403, 'Only the client can dispute.');
    need(b, 'done');
    await patch('inquiries', id, { status: 'disputed', ...flags(false) });
    await event(id, user.id, 'disputed');
    await push(prov.user_id);
    return { ok: true };
  },

  /* Client confirms the job; rating belongs to the booked service */
  async confirmBooking({ id, stars, comment, anonymous = false }, user) {
    const { b, prov, isClient } = await load(id, user);
    if (!isClient) throw err(403, 'Only the client can confirm.');
    const lateRating = b.status === 'completed' && !b.rating_stars && stars;   // "Leave a rating" after the fact
    if (!lateRating) need(b, 'done');
    const n = stars ? Math.round(Number(stars)) : 0;
    if (stars && (n < 1 || n > 5)) throw err(400, 'Rating must be 1–5.');
    const text = (comment || '').trim().slice(0, 500);

    const upd = { status: 'completed', ...flags(false), provider_has_unread: true };
    if (n) Object.assign(upd, { rating_stars: n, rating_comment: text, rated_at: new Date().toISOString() });
    await patch('inquiries', id, upd);

    if (n) {
      const u = (await sb(`users?id=eq.${user.id}&select=first_name,last_name&limit=1`))?.[0];
      const full = u ? `${u.first_name} ${u.last_name}`.trim() : '';
      const display = anonymous && full ? full.split(' ').map(p => p.slice(0, 3) + '***').join(' ') : full;
      await sb('ratings', { method: 'POST', ...min, body: JSON.stringify({
        provider_id: b.provider_id, regular_user_id: user.id, inquiry_id: id,
        listing_id: b.listing_id || null, listing_title: b.listing_title || null,
        stars: n, comment: text, is_anonymous: !!anonymous, display_name: display }) });
      // shop rating = average of every individual review
      const all = await sb(`ratings?provider_id=eq.${b.provider_id}&select=stars`) || [];
      const avg = all.length ? all.reduce((s, r) => s + r.stars, 0) / all.length : 0;
      await sb(`providers?id=eq.${b.provider_id}`, { method: 'PATCH', ...min,
        body: JSON.stringify({ avg_rating: Math.round(avg * 10) / 10, total_ratings: all.length }) });
    }
    await event(id, user.id, lateRating ? 'rated' : 'confirmed', text, n ? { stars: n, listing_title: b.listing_title } : null);

    try {   // +1 referral point on a free user's first completed booking (unchanged rule)
      const me = (await sb(`users?id=eq.${user.id}&select=payment_status,referral_points&limit=1`))?.[0];
      if (me && (!me.payment_status || me.payment_status === 'free')) {
        const done = await sb(`inquiries?regular_user_id=eq.${user.id}&status=eq.completed&select=id`) || [];
        if (done.length === 1) await sb(`users?id=eq.${user.id}`, { method: 'PATCH', ...min, body: JSON.stringify({ referral_points: (me.referral_points || 0) + 1 }) });
      }
    } catch (e) {}
    await push(prov.user_id);
    return { ok: true };
  },

  /* tiny poll used by the 💬 dot and the 🔔 count */
  async summary(_, user) {
    const prov = (await sb(`providers?user_id=eq.${user.id}&select=id&limit=1`))?.[0];
    const col = prov ? `provider_id=eq.${prov.id}&provider_has_unread=eq.true` : `regular_user_id=eq.${user.id}&user_has_unread=eq.true`;
    const unread = await sb(`inquiries?${col}&select=id&limit=1`) || [];
    const pending = prov ? (await sb(`inquiries?provider_id=eq.${prov.id}&status=eq.pending&select=id`) || []).length : 0;
    return { unread: unread.length > 0, pending };
  },

  async getInbox(_, user) {
    const prov = (await sb(`providers?user_id=eq.${user.id}&select=id&limit=1`))?.[0];
    const rows = await sb(prov
      ? `inquiries?provider_id=eq.${prov.id}&order=updated_at.desc&limit=100`
      : `inquiries?regular_user_id=eq.${user.id}&order=updated_at.desc&limit=100`) || [];
    if (!rows.length) return { role: prov ? 'provider' : 'client', items: [] };
    const ids = rows.map(r => r.id).join(',');
    const evs = await sb(`booking_events?booking_id=in.(${ids})&order=created_at.desc&limit=600`) || [];
    const last = {}; evs.forEach(e => { if (!last[e.booking_id]) last[e.booking_id] = e; });
    let names = {};
    if (prov) {
      const us = await sb(`users?id=in.(${[...new Set(rows.map(r => r.regular_user_id))].join(',')})&select=id,first_name,last_name`) || [];
      us.forEach(u => names[u.id] = { name: `${u.first_name} ${u.last_name}`.trim() });
    } else {
      const ps = await sb(`providers?id=in.(${[...new Set(rows.map(r => r.provider_id))].join(',')})&select=id,biz_name,avatar_url`) || [];
      ps.forEach(p => names[p.id] = { name: p.biz_name, avatar: p.avatar_url });
    }
    return { role: prov ? 'provider' : 'client', items: rows.map(r => {
      const c = names[prov ? r.regular_user_id : r.provider_id] || {};
      const e = last[r.id];
      return { id: r.id, status: r.status, listing_title: r.listing_title, name: c.name || '—', avatar: c.avatar || null,
        unread: prov ? !!r.provider_has_unread : !!r.user_has_unread, updated_at: r.updated_at,
        last: e ? { type: e.type, text: e.text, at: e.created_at, mine: e.actor_user_id === user.id } : null };
    }) };
  },

  /* opening a thread also clears its red dot */
  async getThread({ id }, user) {
    const { b, prov, isClient } = await load(id, user);
    await patch('inquiries', id, isClient ? { user_has_unread: false } : { provider_has_unread: false });
    const evs = await sb(`booking_events?booking_id=eq.${q(id)}&order=created_at.asc`) || [];
    let counterpart;
    if (isClient) {
      const pu = (await sb(`users?id=eq.${prov.user_id}&select=phone&limit=1`))?.[0];
      counterpart = { name: prov.biz_name, phone: pu?.phone || null, provider_id: prov.id };
    } else {
      const cu = (await sb(`users?id=eq.${b.regular_user_id}&select=first_name,last_name,phone&limit=1`))?.[0];
      counterpart = { name: cu ? `${cu.first_name} ${cu.last_name}`.trim() : 'Client', phone: cu?.phone || null };
    }
    return {
      booking: { id: b.id, status: b.status, listing_title: b.listing_title, user_message: b.user_message, role: isClient ? 'client' : 'provider', rated: !!b.rating_stars },
      counterpart,
      events: evs.map(e => ({ id: e.id, type: e.type, text: e.text, meta: e.meta, at: e.created_at, mine: e.actor_user_id === user.id })),
    };
  },
};

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });
  if (!SUPA_URL || !KEY)       return res.status(500).json({ error: 'Server not configured.' });
  const { action, payload } = req.body || {};
  if (!actions[action]) return res.status(400).json({ error: 'Unknown action.' });
  try {
    const user = await authUser(req);
    return res.status(200).json(await actions[action](payload || {}, user));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error('[Fixia booking]', action, e.message);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
};
