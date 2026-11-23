/* Profile, password, avatar, plans, listings, change requests, reports, push, admin messages. */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { sb, q } from '../db.js';
import { httpError } from '../auth.js';
import { upload, remove } from '../storage.js';
import { getPackage, calcUpgrade, notify } from '../packages.js';
import { stats as refStats } from '../referral.js';
import { settings } from '../settings.js';
import { mail } from '../mail.js';

const providerRow = async (user) => (await sb(`providers?user_id=eq.${q(user.id)}&limit=1`))?.[0] || null;
const parsed = (s) => { try { return JSON.parse(s) || {}; } catch { return {}; } };
// The new email inside a change request (single email change, or one ticked inside "Multiple Changes"), or null.
export const emailOfRequest = (subject, value) => (subject === 'Email Change' ? String(value || '').trim().toLowerCase() : subject === 'Multiple Changes' ? String(parsed(value).email || '').trim().toLowerCase() || null : null);

export async function profile(user) {
  const u = (await sb(`users?id=eq.${q(user.id)}&select=*&limit=1`))?.[0];
  const prov = user.role === 'provider' ? await providerRow(user) : null;
  const [pkg, pending, ref] = await Promise.all([
    getPackage(u.package_id),
    sb(`upgrade_requests?user_id=eq.${q(user.id)}&status=eq.pending&limit=1`).then((r) => r?.[0] || null),
    user.role === 'admin' ? null : refStats(user.id),
  ]);
  return {
    account: { firstName: u.first_name, lastName: u.last_name, username: u.username, email: u.email, phone: u.phone || '', createdAt: u.created_at, subscriptionStart: u.subscription_start, subscriptionEnd: u.subscription_end, paymentStatus: u.payment_status, avatarUrl: u.avatar_url },
    plan: pkg && { id: pkg.id, name: pkg.name, price: pkg.price, period: pkg.period, listingLimit: pkg.listing_limit, bookingLimit: pkg.booking_limit, adsFree: pkg.ads_free },
    pendingUpgrade: pending && { packageId: pending.new_package_id, reference: pending.payment_reference },
    provider: prov && { id: prov.id, bizName: prov.biz_name, bizDesc: prov.biz_desc || '', status: prov.status, isElite: !!prov.is_elite, avgRating: prov.avg_rating, totalRatings: prov.total_ratings, region: prov.region_name, province: prov.province_name, city: prov.city_name, barangay: prov.barangay_name, street: prov.street_addr },
    referral: ref,
  };
}

export async function updateProfile(user, d) {
  const patch = {};
  if (d.phone !== undefined) {
    if (!/^(09\d{9}|\+639\d{9})$/.test(d.phone)) throw httpError(400, 'Enter a valid PH mobile number.');
    const dupe = await sb(`users?phone=eq.${encodeURIComponent(d.phone)}&id=neq.${q(user.id)}&select=id&limit=1`);
    if (dupe?.length) throw httpError(409, 'That phone number is already registered.');
    patch.phone = d.phone;
  }
  if (d.email !== undefined && user.role === 'regular') {
    if (!/^\S+@\S+\.\S+$/.test(d.email)) throw httpError(400, 'Enter a valid email address.');
    const dupe = await sb(`users?email=eq.${encodeURIComponent(d.email.toLowerCase())}&id=neq.${q(user.id)}&select=id&limit=1`);
    if (dupe?.length) throw httpError(409, 'That email is already registered.');
    patch.email = d.email.toLowerCase();
  }
  if (Object.keys(patch).length) await sb(`users?id=eq.${q(user.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: patch });
  if (d.bizDesc !== undefined && user.role === 'provider') await sb(`providers?user_id=eq.${q(user.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { biz_desc: String(d.bizDesc).slice(0, 300) } });
}

export async function changePassword(user, { current, next }) {
  if (typeof next !== 'string' || next.length < 8 || next.length > 128) throw httpError(400, 'New password must be 8–128 characters.');
  const u = (await sb(`users?id=eq.${q(user.id)}&select=password_hash&limit=1`))?.[0];
  if (!(await bcrypt.compare(String(current || ''), u.password_hash))) throw httpError(400, 'Your current password is not correct.');
  await sb(`users?id=eq.${q(user.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { password_hash: await bcrypt.hash(next, 12) } });
}

export async function setAvatar(user, { dataUrl }) {
  const old = (await sb(`users?id=eq.${q(user.id)}&select=avatar_url&limit=1`))?.[0]?.avatar_url;
  const { url } = await upload('fixia-avatars', `${user.id}_avatar_${Date.now()}`, dataUrl);
  await sb(`users?id=eq.${q(user.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { avatar_url: url } });
  await sb(`providers?user_id=eq.${q(user.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { avatar_url: url } }).catch(() => {});
  await remove(old);
  return { url };
}

/* ── plans ── */
export async function plans(user) {
  const type = user.role === 'provider' ? 'provider' : 'regular';
  return { items: (await sb(`packages?type=eq.${type}&is_active=eq.true&order=sort_order.asc&select=id,name,price,period,icon,popular,badge_label,features,listing_limit,booking_limit,ads_free,referral_points_required`)) || [] };
}
export async function upgradeCalc(user, { packageId }) {
  const [next, cur, u] = await Promise.all([getPackage(packageId), getPackage(user.package_id), sb(`users?id=eq.${q(user.id)}&select=subscription_end&limit=1`).then((r) => r[0])]);
  if (!next || next.type !== (user.role === 'provider' ? 'provider' : 'regular')) throw httpError(404, 'Plan not found.');
  return { plan: { id: next.id, name: next.name, price: next.price, period: next.period }, ...calcUpgrade({ subscription_end: u.subscription_end }, cur, next) };
}

/* ── listings (providers) ── */
const LISTING = 'id,title,description,price_label,cat_main,cat_sub,is_active,other_service_desc';
const shapeL = (l) => ({ id: l.id, title: l.title, description: l.description || '', priceLabel: l.price_label || '', category: l.cat_main, sub: l.cat_sub, active: !!l.is_active, otherDesc: l.other_service_desc || '' });
async function listingCtx(user) {
  const prov = await providerRow(user);
  if (!prov) throw httpError(403, 'Provider account required.');
  const pkg = await getPackage(prov.package_id);
  return { prov, limit: pkg?.listing_limit ?? 5, pkgName: pkg?.name || 'current' };
}
export async function listingsMine(user) {
  const { prov, limit } = await listingCtx(user);
  const rows = (await sb(`listings?provider_id=eq.${q(prov.id)}&order=created_at.asc&select=${LISTING}`)) || [];
  return { items: rows.map(shapeL), limit, approved: prov.status === 'approved' };
}
export async function listingSave(user, d) {
  const { prov, limit, pkgName } = await listingCtx(user);
  if (prov.status !== 'approved') throw httpError(403, 'Listings unlock once your account is approved.');
  if (!d.title?.trim() || !d.description?.trim()) throw httpError(400, 'Title and description are required.');
  if (d.category === 'other' && !d.otherDesc?.trim()) throw httpError(400, 'Describe your service so we can assign a category.');
  const body = { title: d.title.trim().slice(0, 100), description: d.description.trim().slice(0, 400), price_label: (d.priceLabel || '').slice(0, 60), cat_main: d.category, cat_sub: d.category === 'other' ? 'Other' : d.sub, other_service_desc: d.category === 'other' ? d.otherDesc.trim().slice(0, 120) : null };
  if (d.id) {
    const mineRow = await sb(`listings?id=eq.${q(d.id)}&provider_id=eq.${q(prov.id)}&select=id&limit=1`);
    if (!mineRow?.length) throw httpError(404, 'Listing not found.');
    await sb(`listings?id=eq.${q(d.id)}`, { method: 'PATCH', prefer: 'return=minimal', body });
  } else {
    const n = ((await sb(`listings?provider_id=eq.${q(prov.id)}&select=id`)) || []).length;
    if (limit < 999 && n >= limit) throw httpError(400, `Your ${pkgName} plan allows ${limit} listing${limit === 1 ? '' : 's'}. Upgrade to add more.`);
    await sb('listings', { method: 'POST', prefer: 'return=minimal', body: { ...body, provider_id: prov.id, is_active: true } });
  }
}
export async function listingToggle(user, { id, active }) {
  const { prov, limit, pkgName } = await listingCtx(user);
  if (active && limit < 999) {
    const n = ((await sb(`listings?provider_id=eq.${q(prov.id)}&is_active=eq.true&select=id`)) || []).length;
    if (n >= limit) throw httpError(400, `Your ${pkgName} plan allows ${limit} active listing${limit === 1 ? '' : 's'}. Deactivate another first, or upgrade.`);
  }
  await sb(`listings?id=eq.${q(id)}&provider_id=eq.${q(prov.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { is_active: !!active } });
}
export async function listingDelete(user, { id }) {
  const { prov } = await listingCtx(user);
  await sb(`listings?id=eq.${q(id)}&provider_id=eq.${q(prov.id)}`, { method: 'DELETE', prefer: 'return=minimal' });
}
export async function reviewsMine(user) {
  const prov = await providerRow(user);
  const rows = prov ? (await sb(`ratings?provider_id=eq.${q(prov.id)}&order=created_at.desc&limit=100&select=stars,comment,created_at,display_name`)) || [] : [];
  return { items: rows.map((r) => ({ stars: r.stars, comment: r.comment || '', createdAt: r.created_at, name: r.display_name || 'Customer' })) };
}

/* ── change requests (business name / email / location) ── */
export async function changeCooldown(user) {
  const prov = await providerRow(user);
  const last = prov?.last_change_at;
  const left = last ? Math.ceil(30 - (Date.now() - new Date(last)) / 86400000) : 0;
  return { daysLeft: Math.max(0, left) };
}
export async function changeSubmit(user, d) {
  const prov = await providerRow(user);
  if (!prov) throw httpError(403, 'Provider account required.');
  if ((await changeCooldown(user)).daysLeft > 0) throw httpError(429, 'You can send one request every 30 days.');
  if (!['Business Name Change', 'Email Change', 'Location Change', 'Multiple Changes', 'Other'].includes(d.subject)) throw httpError(400, 'Choose what to change.');
  if (!d.explanation?.trim()) throw httpError(400, 'Please explain the change.');
  if (d.subject !== 'Other' && !d.requestedValue?.trim()) throw httpError(400, 'Enter the new value.');
  const newMail = emailOfRequest(d.subject, d.requestedValue);
  if (newMail) {
    if (!/^\S+@\S+\.\S+$/.test(newMail)) throw httpError(400, 'Enter a valid email address.');
    if ((await sb(`users?email=eq.${encodeURIComponent(newMail)}&select=id&limit=1`))?.length) throw httpError(409, 'That email is already registered.');
  }
  const multi = d.subject === 'Multiple Changes' ? parsed(d.requestedValue) : {};
  const needsProof = ['Business Name Change', 'Location Change'].includes(d.subject) || !!multi.business_name || !!multi.location;
  if (needsProof && !d.file) throw httpError(400, 'Attach a proof document for this change.');
  let file = {};
  if (d.file) { const up = await upload('fixia-requests', `${prov.id}_${Date.now()}`, d.file, { pdf: true }); file = { file_url: up.url, file_path: up.path }; }
  await sb('change_requests', { method: 'POST', prefer: 'return=minimal', body: { user_id: user.id, provider_id: prov.id, provider_name: prov.biz_name, subject: d.subject, requested_value: (d.requestedValue || '—').slice(0, 1200), explanation: d.explanation.trim().slice(0, 600), status: 'pending', ...file } });
  await sb(`providers?id=eq.${q(prov.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { last_change_at: new Date().toISOString() } });
}

/* ── new email check: the provider enters the code the admin sent to the new address ── */
export async function changePending(user) {
  const prov = await providerRow(user);
  if (!prov) return { request: null };
  const rows = (await sb(`change_requests?provider_id=eq.${q(prov.id)}&status=eq.pending&select=subject,requested_value,verify_hash,verify_attempts,email_verified`)) || [];
  for (const r of rows) {
    const email = emailOfRequest(r.subject, r.requested_value);
    if (email) return { request: { email, codeSent: !!r.verify_hash, verified: !!r.email_verified, left: 3 - (r.verify_attempts || 0) } };
  }
  return { request: null };
}
export async function changeVerify(user, { code }) {
  const prov = await providerRow(user);
  if (!prov) throw httpError(403, 'Provider account required.');
  const r = (await sb(`change_requests?provider_id=eq.${q(prov.id)}&status=eq.pending&verify_hash=not.is.null&email_verified=is.false&limit=1`))?.[0];
  if (!r) throw httpError(404, 'There is no code to enter right now.');
  const hash = crypto.createHash('sha256').update(String(code || '').trim()).digest('hex');
  if (hash === r.verify_hash) {
    await sb(`change_requests?id=eq.${q(r.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { email_verified: true } });
    return { ok: true };
  }
  const tries = (r.verify_attempts || 0) + 1;
  if (tries >= 3) {
    await remove(r.file_url);
    await sb(`change_requests?id=eq.${q(r.id)}`, { method: 'DELETE', prefer: 'return=minimal' });
    await sb(`providers?id=eq.${q(prov.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { last_change_at: new Date().toISOString() } });
    await notify(user.id, 'Change request cancelled', 'You entered the wrong email code 3 times, so your change request was cancelled. You can send a new request after 30 days.', 'warning');
    return { ok: false, failed: true };
  }
  await sb(`change_requests?id=eq.${q(r.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { verify_attempts: tries } });
  return { ok: false, left: 3 - tries };
}

/* ── reports ── */
export async function reportSubmit(user, { providerId, reason, details }) {
  if (!reason) throw httpError(400, 'Choose a reason.');
  const prov = (await sb(`providers?id=eq.${q(providerId)}&select=id,biz_name,user_id&limit=1`))?.[0];
  if (!prov || prov.user_id === user.id) throw httpError(400, 'You cannot report this provider.');
  const dupe = await sb(`provider_reports?provider_id=eq.${q(providerId)}&user_id=eq.${q(user.id)}&select=id&limit=1`);
  if (dupe?.length) throw httpError(409, 'You already reported this provider.');
  await sb('provider_reports', { method: 'POST', prefer: 'return=minimal', body: { provider_id: providerId, provider_name: prov.biz_name, user_id: user.id, user_name: `${user.first_name} ${user.last_name}`, reason: String(reason).slice(0, 120), details: String(details || '').slice(0, 600) || null, status: 'pending' } });
}

/* ── manual payment / upgrade requests ── */
export async function upgradeManual(user, { packageId, method, reference, amount }) {
  const pkg = await getPackage(packageId);
  if (!pkg || !pkg.is_active || pkg.type !== (user.role === 'provider' ? 'provider' : 'regular') || pkg.price <= 0) throw httpError(400, 'Choose a paid plan.');
  if (!['gcash', 'maya', 'bank'].includes(method) || !String(reference || '').trim()) throw httpError(400, 'Enter your payment reference number.');
  const u = (await sb(`users?id=eq.${q(user.id)}&select=*&limit=1`))?.[0];
  const body = { payment_method: method, payment_reference: String(reference).trim().slice(0, 60), payment_amount: String(amount || pkg.price) };
  // a provider still finishing sign-up attaches the payment to the application
  if (user.role === 'provider' && u.payment_status === 'awaiting' && u.package_id === pkg.id) {
    await sb(`users?id=eq.${q(user.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { ...body, payment_status: 'pending' } });
  } else {
    if ((await sb(`upgrade_requests?user_id=eq.${q(user.id)}&status=eq.pending&select=id&limit=1`))?.length) throw httpError(409, 'You already have an upgrade waiting for review.');
    const cur = await getPackage(u.package_id), calc = calcUpgrade(u, cur, pkg);
    const prov = user.role === 'provider' ? await providerRow(user) : null;
    await sb('upgrade_requests', { method: 'POST', prefer: 'return=minimal', body: { user_id: user.id, provider_id: prov?.id || null, current_package_id: u.package_id, new_package_id: pkg.id, current_sub_end: u.subscription_end, remaining_days: calc.remainingDays, remaining_value: calc.remainingValue, new_plan_price: pkg.price, carryover_days: calc.carryoverDays, payment_method: method, payment_reference: body.payment_reference, payment_amount: body.payment_amount, status: 'pending' } });
  }
  mail('payment_notify', { fullName: `${u.first_name} ${u.last_name}`, email: u.email, package: pkg.name, method, reference: body.payment_reference, amount: `₱${body.payment_amount}`, verified: false });
}

/* ── push + admin messages ── */
export const pushKey = async () => ({ key: process.env.VAPID_PUBLIC_KEY || '' });
export async function pushSubscribe(user, { subscription }) {
  if (!subscription?.endpoint) throw httpError(400, 'Invalid subscription.');
  await sb(`push_subscriptions?user_id=eq.${q(user.id)}`, { method: 'DELETE', prefer: 'return=minimal' });
  await sb('push_subscriptions', { method: 'POST', prefer: 'return=minimal', body: { user_id: user.id, subscription } });
}
export async function messagesPending(user) {
  const rows = (await sb(`user_messages?user_id=eq.${q(user.id)}&is_read=eq.false&order=sent_at.asc&limit=20`)) || [];
  return { items: rows.map((m) => ({ id: m.id, title: m.title, body: m.body, type: m.type })) };
}
export async function messageAck(user, { id }) {
  const m = (await sb(`user_messages?id=eq.${q(id)}&user_id=eq.${q(user.id)}&limit=1`))?.[0];
  if (!m) return {};
  let signOut = false;
  try {
    const meta = m.metadata && JSON.parse(m.metadata);
    if (meta?.action === 'suspend_on_read' && meta.user_id === user.id) {
      const days = parseInt(meta.suspension_days) || 7;
      await sb(`providers?id=eq.${q(meta.provider_id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { status: 'suspended', suspended_until: new Date(Date.now() + days * 86400000).toISOString() } });
      await sb(`users?id=eq.${q(user.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { status: 'suspended', session_token: null } });
      signOut = true;
    }
  } catch { /* plain message */ }
  await sb(`user_messages?id=eq.${q(id)}`, { method: 'DELETE', prefer: 'return=minimal' });
  return { signOut };
}

/* ── ads ── */
export async function adsList(user) {
  if (user.role !== 'regular' || user.ads_free) return { popup: [], inline: [], config: {} };
  const [rows, s] = await Promise.all([sb('ads?is_active=eq.true&order=created_at.asc&select=id,type,title,description,icon,cta_label,bg_color,link_url,impression_count,impression_quota'), settings()]);
  const live = (rows || []).filter((a) => (a.impression_count || 0) < (a.impression_quota || 5000));
  const pick = (t) => live.filter((a) => a.type === t).map((a) => ({ id: a.id, title: a.title, text: a.description || '', cta: a.cta_label || 'Learn more', color: a.bg_color || '#0F1A27', link: a.link_url || '#' }));
  return { popup: pick('popup'), inline: pick('inline'), config: { actions: +s.ad_actions_per_popup || 3, minutes: +s.ad_min_minutes || 2, skip: +s.ad_skip_seconds || 5, inline: +s.inline_ad_interval || 4 } };
}
export async function adsTrack(user, { id, kind }) {
  if (kind === 'click') return void sb('rpc/increment_ad_click', { method: 'POST', prefer: 'return=minimal', body: { ad_id: id } }).catch(() => {});
  await sb('rpc/increment_ad_impression', { method: 'POST', prefer: 'return=minimal', body: { ad_id: id } }).catch(() => {});
  const ad = (await sb(`ads?id=eq.${q(id)}&select=impression_count,impression_quota,click_count&limit=1`))?.[0];
  if (ad && ad.impression_count >= (ad.impression_quota || 5000)) {
    await sb(`ads_batches?ad_id=eq.${q(id)}&status=eq.active`, { method: 'PATCH', prefer: 'return=minimal', body: { status: 'completed', completed_at: new Date().toISOString(), impression_count: ad.impression_count, click_count: ad.click_count || 0 } });
    await sb(`ads?id=eq.${q(id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { is_active: false } });
  }
}
