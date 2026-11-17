import { sb, q } from '../db.js';
import { httpError } from '../auth.js';

const FIELDS = 'id,user_id,biz_name,biz_desc,avatar_url,is_elite,is_featured,avg_rating,total_ratings,city_name,province_name,barangay_name,street_addr,created_at,package_id';
const clean = (s) => String(s || '').replace(/[,()*%\\]/g, ' ').trim().slice(0, 60);

/* ── booking capacity: providers at their active-booking limit are hidden from lists ── */
let pkgCache = { t: 0, v: {} };
async function bookingLimits() {
  if (Date.now() - pkgCache.t < 300_000) return pkgCache.v;
  const rows = (await sb('packages?type=eq.provider&select=id,booking_limit')) || [];
  pkgCache = { t: Date.now(), v: Object.fromEntries(rows.map((p) => [p.id, p.booking_limit])) };
  return pkgCache.v;
}
async function fullProviders(items) {
  const [counts, limits] = await Promise.all([sb('provider_active_booking_counts').then((r) => r || []), bookingLimits()]);
  const used = Object.fromEntries(counts.map((c) => [c.provider_id, c.active_count]));
  return new Set(items.filter((p) => { const l = limits[p.package_id]; return l && l < 999 && (used[p.id] || 0) >= l; }).map((p) => p.id));
}

export const shape = (p, listings = p.listings || []) => ({
  id: p.id, name: p.biz_name, avatarUrl: p.avatar_url || null, isElite: !!p.is_elite,
  rating: Number(p.avg_rating) || 0, reviews: p.total_ratings || 0,
  city: p.city_name || '', province: p.province_name || '', barangay: p.barangay_name || '',
  services: [...new Set(listings.map((l) => l.cat_sub).filter(Boolean))],
});

/* ── find approved providers that have at least one active listing ── */
async function find({ cat, sub, province, city, barangay, filter, sort }) {
  let path = `providers?status=eq.approved&select=${FIELDS},listings!inner(cat_main,cat_sub,title)&listings.is_active=eq.true&limit=400`;
  if (cat) path += `&listings.cat_main=eq.${q(clean(cat))}`;
  if (sub) path += `&listings.cat_sub=eq.${q(clean(sub))}`;
  if (barangay) path += `&barangay_name=eq.${q(clean(barangay))}`;
  else if (city) path += `&city_name=eq.${q(clean(city))}`;
  else if (province) path += `&province_name=eq.${q(clean(province))}`;
  if (filter === 'elite') path += '&is_elite=eq.true';
  if (filter === 'top') path += '&avg_rating=gte.4';
  const order = sort === 'reviews' ? 'total_ratings.desc,avg_rating.desc'
              : sort === 'newest' ? 'created_at.desc'
              : 'is_elite.desc,avg_rating.desc,total_ratings.desc';
  const items = (await sb(`${path}&order=${order}`)) || [];
  const full = await fullProviders(items);
  return items.filter((p) => !full.has(p.id));
}

export async function list(_user, p = {}) {
  let items = await find(p);
  const text = clean(p.q).toLowerCase();
  if (text) {
    items = items.filter((x) =>
      [x.biz_name, x.biz_desc, x.city_name, x.province_name, ...x.listings.flatMap((l) => [l.title, l.cat_sub])]
        .some((s) => s && s.toLowerCase().includes(text)));
  }
  const limit = Math.min(Number(p.limit) || 20, 60), offset = Number(p.offset) || 0;
  return { total: items.length, items: items.slice(offset, offset + limit).map((x) => shape(x)) };
}

/* ── services line for providers fetched without listings ── */
export async function withServices(rows) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id).join(',');
  const ls = (await sb(`listings?provider_id=in.(${ids})&is_active=eq.true&select=provider_id,cat_sub`)) || [];
  return rows.map((r) => shape(r, ls.filter((l) => l.provider_id === r.id)));
}

/* ── featured strip: elite first, then least-shown; stops when a provider reaches its quota ── */
async function featured() {
  const all = (await sb(`providers?status=eq.approved&is_featured=eq.true&select=${FIELDS},featured_impressions,featured_quota&order=is_elite.desc,featured_impressions.asc&limit=30`)) || [];
  const eligible = all.filter((p) => p.is_elite || (p.featured_quota > 0 && (p.featured_impressions || 0) < p.featured_quota));
  const chosen = eligible.slice(0, 3);
  chosen.forEach((p) => {
    sb('rpc/increment_featured_impression', { method: 'POST', prefer: 'return=minimal', body: { provider_id: p.id } }).catch(() => {});
    if (!p.is_elite && p.featured_quota > 0 && (p.featured_impressions || 0) + 1 >= p.featured_quota) {
      sb(`providers?id=eq.${q(p.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { featured_status: 'completed', is_featured: false } }).catch(() => {});
    }
  });
  return withServices(chosen);
}

export async function home(_user, loc = {}) {
  const [feat, near] = await Promise.all([featured(), find(loc)]);
  return { featured: feat, nearby: near.slice(0, 8).map((x) => shape(x)) };
}

export async function get(user, { id }) {
  if (!id) throw httpError(400, 'Missing provider.');
  const prov = (await sb(`providers?id=eq.${q(id)}&status=eq.approved&select=${FIELDS}&limit=1`))?.[0];
  if (!prov) throw httpError(404, 'This provider is not available.');
  const [listings, reviews, saved, reported] = await Promise.all([
    sb(`listings?provider_id=eq.${q(id)}&is_active=eq.true&order=created_at.asc&select=id,title,description,price_label,cat_main,cat_sub`),
    sb(`ratings?provider_id=eq.${q(id)}&order=created_at.desc&limit=50&select=stars,comment,created_at,display_name`),
    sb(`saved_providers?user_id=eq.${q(user.id)}&provider_id=eq.${q(id)}&select=provider_id&limit=1`),
    sb(`provider_reports?user_id=eq.${q(user.id)}&provider_id=eq.${q(id)}&select=id&limit=1`),
  ]);
  return {
    provider: { ...shape(prov, listings || []), bio: prov.biz_desc || '', street: prov.street_addr || '', memberSince: prov.created_at },
    listings: (listings || []).map((l) => ({ id: l.id, title: l.title, description: l.description || '', priceLabel: l.price_label || '', category: l.cat_main, sub: l.cat_sub })),
    reviews: (reviews || []).map((r) => ({ stars: r.stars, comment: r.comment || '', createdAt: r.created_at, name: r.display_name || 'Customer' })),
    saved: !!saved?.length,
    reported: !!reported?.length,
    isOwn: prov.user_id === user.id,
  };
}

// Phone numbers are only sent when the person taps Contact, not with the page.
export async function contact(user, { id }) {
  if (user.role === 'provider') throw httpError(403, 'Providers cannot contact other providers. Use a customer account.');
  const prov = (await sb(`providers?id=eq.${q(id)}&status=eq.approved&select=user_id&limit=1`))?.[0];
  if (!prov) throw httpError(404, 'This provider is not available.');
  const phone = (await sb(`users?id=eq.${q(prov.user_id)}&select=phone&limit=1`))?.[0]?.phone;
  if (!phone) throw httpError(404, 'This provider has not shared a phone number.');
  return { phone };
}
