/* Admin-only actions. Guarded in api/admin.js: nobody without role "admin" reaches any of this. */
import crypto from 'node:crypto';
import { sb, q } from '../db.js';
import { emailOfRequest } from './account.js';
import { httpError } from '../auth.js';
import { remove, signedUrl } from '../storage.js';
import { mail } from '../mail.js';
import { pushTo } from '../push.js';
import { credit } from '../referral.js';
import { settings, setSetting } from '../settings.js';
import { resetFees } from '../fees.js';
import { getPackage, applyPackage, notify, PERIOD_DAYS } from '../packages.js';

const patch = (path, body) => sb(path, { method: 'PATCH', prefer: 'return=minimal', body });
const del = (path) => sb(path, { method: 'DELETE', prefer: 'return=minimal' });
const need = (v, m) => { if (!v) throw httpError(400, m); return v; };
const A = {};

/* ── overview ── */
A.dash = async () => {
  const [users, provs, pend, reqs, reps, ups] = await Promise.all([
    sb('users?select=role'), sb('providers?select=status,is_elite'),
    sb('providers?status=in.(pending,needs_compliance)&select=id'), sb('change_requests?status=eq.pending&select=id'),
    sb('provider_reports?status=eq.pending&select=id'), sb('upgrade_requests?status=eq.pending&select=id'),
  ]);
  return { customers: users.filter((u) => u.role === 'regular').length, providers: provs.filter((p) => p.status === 'approved').length, elite: provs.filter((p) => p.is_elite).length,
    pending: pend.length, requests: reqs.length, reports: reps.length, upgrades: ups.length, uncategorized: (await sb('listings?cat_main=eq.other&select=id')).length };
};

/* ── provider applications ── */
A['pending.list'] = async () => {
  const rows = (await sb('providers?status=in.(pending,needs_compliance)&order=created_at.asc')) || [];
  const us = rows.length ? (await sb(`users?id=in.(${rows.map((r) => q(r.user_id)).join(',')})&select=id,first_name,last_name,email,phone,payment_method,payment_reference,payment_amount,payment_status,package_name`)) || [] : [];
  const items = await Promise.all(rows.map(async (p) => ({ ...p, id_file_url: p.id_file_url ? await signedUrl(p.id_file_url) : null, user: us.find((u) => u.id === p.user_id) })));
  return { items };
};
A['provider.approve'] = async (_a, { providerId }) => {
  const prov = need((await sb(`providers?id=eq.${q(providerId)}&limit=1`))?.[0], 'Provider not found.');
  const pkg = await getPackage(prov.package_id);
  const u = (await sb(`users?id=eq.${q(prov.user_id)}&select=*&limit=1`))?.[0];
  const body = { status: 'approved', is_featured: !!pkg?.is_featured };
  if (prov.id_file_url) { await remove(prov.id_file_url); body.id_file_url = null; }     // ID is deleted once verified
  if (pkg?.is_featured) { body.featured_quota = parseInt((await settings()).featured_impression_quota) || 500; body.featured_impressions = 0; }
  await patch(`providers?id=eq.${q(providerId)}`, body);
  await patch(`users?id=eq.${q(prov.user_id)}`, { status: 'active' });
  await notify(prov.user_id, 'Application approved', 'Your provider account is active. Add your services and start receiving bookings. Welcome to Fixia!', 'welcome');
  if (['verified', 'paid'].includes(u.payment_status)) await credit(prov.user_id, 5).catch(() => {});
  mail('provider_approved', { email: u.email, fullName: `${u.first_name} ${u.last_name}`, bizName: prov.biz_name });
};
A['provider.reject'] = async (_a, { providerId, reason }) => {
  const prov = need((await sb(`providers?id=eq.${q(providerId)}&limit=1`))?.[0], 'Provider not found.');
  const u = (await sb(`users?id=eq.${q(prov.user_id)}&select=*&limit=1`))?.[0];
  await notify(prov.user_id, 'Application rejected', `Your application was not approved.\n\nReason: ${reason || 'No reason provided.'}\n\nContact support if you think this is a mistake.`, 'warning');
  await patch(`users?id=eq.${q(prov.user_id)}`, { status: 'rejected', force_logout: true, session_token: null });
  await remove(prov.id_file_url); await remove(prov.avatar_url);
  await del(`providers?id=eq.${q(providerId)}`);
  mail('provider_rejected', { email: u.email, fullName: `${u.first_name} ${u.last_name}`, bizName: prov.biz_name, reason });
};
A['provider.compliance'] = async (_a, { providerId, reason }) => {
  const prov = need((await sb(`providers?id=eq.${q(providerId)}&select=user_id&limit=1`))?.[0], 'Provider not found.');
  need(reason?.trim(), 'Explain what the provider must do.');
  await patch(`providers?id=eq.${q(providerId)}`, { status: 'needs_compliance' });
  await notify(prov.user_id, 'Approval on hold', `Your application is on hold:\n\n${reason}\n\nResolve this and contact support so approval can continue.`, 'warning');
};

/* ── providers / elite ── */
A['providers.list'] = async (_a, { status, elite }) => {
  let path = 'providers?order=created_at.desc&limit=500';
  if (status) path += `&status=eq.${q(status)}`; if (elite) path += '&is_elite=eq.true';
  const rows = (await sb(path)) || [];
  const us = rows.length ? (await sb(`users?id=in.(${rows.map((r) => q(r.user_id)).join(',')})&select=id,first_name,last_name,email,phone,payment_status,package_name`)) || [] : [];
  return { items: rows.map((p) => ({ ...p, user: us.find((u) => u.id === p.user_id) })) };
};
A['provider.update'] = async (_a, d) => {
  const prov = need((await sb(`providers?id=eq.${q(d.id)}&limit=1`))?.[0], 'Provider not found.');
  const pkg = d.packageId ? await getPackage(d.packageId) : null;
  const p = { status: d.status, biz_name: d.bizName, region_name: d.regionName, province_name: d.provinceName, city_name: d.cityName, barangay_name: d.barangayName, street_addr: d.streetAddr };
  if (pkg) { p.package_id = pkg.id; p.is_featured = !!pkg.is_featured; }
  Object.keys(p).forEach((k) => p[k] === undefined && delete p[k]);
  await patch(`providers?id=eq.${q(d.id)}`, p);
  const u = { first_name: d.firstName, last_name: d.lastName, email: d.email?.toLowerCase(), phone: d.phone, payment_status: d.paymentStatus };
  if (d.status) u.status = d.status === 'approved' ? 'active' : d.status;
  if (pkg) Object.assign(u, { package_id: pkg.id, package_name: pkg.name, ads_free: pkg.ads_free ?? false });
  if (['suspended'].includes(d.status)) u.session_token = null;
  Object.keys(u).forEach((k) => u[k] === undefined && delete u[k]);
  if (Object.keys(u).length) await patch(`users?id=eq.${q(prov.user_id)}`, u);
  if (pkg && pkg.listing_limit < 999) {      // downgrade: remove listings above the new limit
    const ls = (await sb(`listings?provider_id=eq.${q(d.id)}&order=created_at.asc&select=id`)) || [];
    for (const l of ls.slice(pkg.listing_limit)) await del(`listings?id=eq.${q(l.id)}`);
  }
};
A['provider.delete'] = async (_a, { id }) => {
  const prov = (await sb(`providers?id=eq.${q(id)}&select=user_id,avatar_url,id_file_url&limit=1`))?.[0];
  if (!prov) return;
  await remove(prov.avatar_url); await remove(prov.id_file_url);
  await del(`providers?id=eq.${q(id)}`); await del(`users?id=eq.${q(prov.user_id)}`);
};
A['elite.grant'] = async (_a, { id, expiresAt }) => {
  const prov = need((await sb(`providers?id=eq.${q(id)}&select=user_id,biz_name&limit=1`))?.[0], 'Provider not found.');
  await patch(`providers?id=eq.${q(id)}`, { is_elite: true, elite_granted_at: new Date().toISOString(), elite_expires_at: expiresAt || null });
  const u = (await sb(`users?id=eq.${q(prov.user_id)}&select=email,first_name,last_name&limit=1`))?.[0];
  if (u) mail('elite_granted', { email: u.email, bizName: prov.biz_name, expiresAt: expiresAt ? new Date(expiresAt).toLocaleDateString('en-PH') : '' });
};
A['elite.revoke'] = async (_a, { id }) => {
  const prov = (await sb(`providers?id=eq.${q(id)}&select=user_id,biz_name&limit=1`))?.[0];
  await patch(`providers?id=eq.${q(id)}`, { is_elite: false, elite_expires_at: null });
  const u = prov && (await sb(`users?id=eq.${q(prov.user_id)}&select=email&limit=1`))?.[0];
  if (u) mail('elite_revoked', { email: u.email, bizName: prov.biz_name });
};

/* ── customers ── */
A['users.list'] = async (_a, { status }) => ({ items: (await sb(`users?role=eq.regular&order=created_at.desc&limit=500${status ? `&status=eq.${q(status)}` : ''}&select=id,first_name,last_name,username,email,phone,status,package_id,package_name,ads_free,created_at,referral_points`)) || [] });
A['user.update'] = async (_a, d) => {
  const pkg = d.packageId ? await getPackage(d.packageId) : null;
  const free = !d.packageId || d.packageId.includes('free');
  const body = { first_name: d.firstName, last_name: d.lastName, email: d.email?.toLowerCase(), phone: d.phone, status: d.status };
  if (d.packageId !== undefined) Object.assign(body, { package_id: d.packageId || 'regular-free', package_name: pkg?.name || 'Free', ads_free: pkg?.ads_free ?? false, ...(free ? { subscription_start: null, subscription_end: null, payment_status: 'free' } : {}) });
  if (d.status === 'suspended') body.session_token = null;
  Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);
  await patch(`users?id=eq.${q(d.id)}`, body);
};
A['user.delete'] = async (_a, { id }) => { const u = (await sb(`users?id=eq.${q(id)}&select=avatar_url&limit=1`))?.[0]; await remove(u?.avatar_url); await del(`users?id=eq.${q(id)}`); };
A['user.kick'] = async (_a, { id }) => patch(`users?id=eq.${q(id)}`, { session_token: null });

/* ── packages ── */
const PK = { name: 'name', type: 'type', price: 'price', period: 'period', listingLimit: 'listing_limit', bookingLimit: 'booking_limit', referralPointsRequired: 'referral_points_required', adsFree: 'ads_free', isFeatured: 'is_featured', features: 'features', popular: 'popular', badgeLabel: 'badge_label', icon: 'icon', isActive: 'is_active', sortOrder: 'sort_order' };
const KEEP = ['regular-free', 'regular-plus', 'regular-pro', 'regular-starter', 'provider-free', 'provider-basic', 'provider-pro', 'provider-premium'];
A['packages.list'] = async () => ({ items: (await sb('packages?order=type.asc,sort_order.asc')) || [], permanent: KEEP });
A['package.save'] = async (_a, d) => {
  need(d.name?.trim(), 'Package name is required.');
  const row = {}; Object.entries(PK).forEach(([k, c]) => d[k] !== undefined && (row[c] = d[k]));
  if (d.id) return void (await patch(`packages?id=eq.${q(d.id)}`, row));
  row.id = d.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  await sb('packages', { method: 'POST', prefer: 'return=minimal', body: row });
};
A['package.delete'] = async (_a, { id }) => { if (KEEP.includes(id)) throw httpError(400, 'This is a permanent package.'); await del(`packages?id=eq.${q(id)}`); };

/* ── ads ── */
A['ads.list'] = async () => ({ items: (await sb('ads?order=type.asc,created_at.asc')) || [] });
A['ad.save'] = async (_a, d) => {
  need(d.advertiser?.trim() && d.title?.trim(), 'Advertiser and title are required.');
  const row = { type: d.type, advertiser: d.advertiser, title: d.title, description: d.description || '', icon: '', link_url: d.linkUrl || '#', cta_label: d.ctaLabel || 'Learn more', bg_color: d.bgColor || '#0F1A27', notes: d.notes || '', impression_quota: Math.max(5, parseInt(d.quota) || 5000) };
  if (d.id) await patch(`ads?id=eq.${q(d.id)}`, row); else await sb('ads', { method: 'POST', prefer: 'return=minimal', body: { ...row, is_active: true, starts_at: new Date().toISOString() } });
};
A['ad.toggle'] = async (_a, { id, active }) => {
  const ad = need((await sb(`ads?id=eq.${q(id)}&limit=1`))?.[0], 'Ad not found.');
  if (active && ad.impression_count >= ad.impression_quota) throw httpError(400, 'Quota used up. Use Re-run.');
  await patch(`ads?id=eq.${q(id)}`, { is_active: !!active });
};
A['ad.delete'] = async (_a, { id }) => del(`ads?id=eq.${q(id)}`);
A['ad.rerun'] = async (_a, { id, quota }) => {
  const ad = need((await sb(`ads?id=eq.${q(id)}&limit=1`))?.[0], 'Ad not found.');
  const batches = (await sb(`ads_batches?ad_id=eq.${q(id)}&order=batch_number.asc`)) || [];
  if (batches.some((b) => b.status === 'active')) await patch(`ads_batches?ad_id=eq.${q(id)}&status=eq.active`, { status: 'completed', completed_at: new Date().toISOString(), impression_count: ad.impression_count, click_count: ad.click_count || 0 });
  else if (!batches.length) await sb('ads_batches', { method: 'POST', prefer: 'return=minimal', body: { ad_id: id, batch_number: 1, impression_quota: ad.impression_quota, impression_count: ad.impression_count, click_count: ad.click_count || 0, status: 'completed', started_at: ad.created_at, completed_at: new Date().toISOString() } });
  const n = batches.length + (batches.length ? 1 : 2);
  const qta = Math.max(5, parseInt(quota) || ad.impression_quota);
  await sb('ads_batches', { method: 'POST', prefer: 'return=minimal', body: { ad_id: id, batch_number: n, impression_quota: qta, impression_count: 0, status: 'active', started_at: new Date().toISOString() } });
  await patch(`ads?id=eq.${q(id)}`, { impression_count: 0, click_count: 0, impression_quota: qta, is_active: true });
};
A['ad.batches'] = async (_a, { type }) => ({ items: (await sb(`ads_batches?order=started_at.desc&limit=200`)) || [], ads: (await sb(`ads?${type ? `type=eq.${q(type)}&` : ''}select=id,title,advertiser,type`)) || [] });
A['rotation.stats'] = async () => ({ items: (await sb('providers?or=(is_featured.eq.true,featured_quota.gt.0)&select=id,biz_name,is_elite,is_featured,avg_rating,package_id,featured_impressions,featured_quota&order=featured_impressions.desc')) || [] });
A['rotation.reactivate'] = async (_a, { id } = {}) => {
  const quota = parseInt((await settings()).featured_impression_quota) || 200;
  const done = id ? [{ id }] : (await sb('providers?is_featured=eq.false&featured_quota=gt.0&select=id')) || [];
  for (const p of done) await patch(`providers?id=eq.${q(p.id)}`, { is_featured: true, featured_impressions: 0, featured_quota: quota });
  return { count: done.length };
};

/* ── settings ── */
const KEYS = ['otp_enabled', 'otp_test_code', 'ad_actions_per_popup', 'ad_min_minutes', 'ad_skip_seconds', 'inline_ad_interval', 'suspension_days', 'featured_impression_quota'];
A['settings.get'] = async () => { const s = await settings(); return Object.fromEntries(KEYS.map((k) => [k, s[k] ?? ''])); };
A['settings.set'] = async (_a, { key, value }) => {
  if (!KEYS.includes(key)) throw httpError(400, 'Unknown setting.');
  await setSetting(key, value);
  if (key === 'featured_impression_quota' && parseInt(value)) { await patch('providers?is_featured=eq.true', { featured_quota: parseInt(value) }); await patch('providers?is_featured=eq.false&featured_quota=gt.0', { featured_quota: parseInt(value) }); }
};

/* ── processing fees ── */
const FEE_PROVIDERS = { paypal: ['paypal'], paymongo: ['gcash', 'maya', 'qrph', 'card', 'grab'] };
A['fees.list'] = async () => ({ items: (await sb('processing_fees?order=medium.asc,provider.asc')) || [] });
A['fee.save'] = async (_a, d) => {
  need(FEE_PROVIDERS[d.medium]?.includes(d.provider), 'Choose a payment medium and a provider.');
  const rate = Number(d.rate), fixed = Number(d.fixed) || 0, vat = Number(d.vat) || 0;
  if (!(rate >= 0 && rate < 50)) throw httpError(400, 'Rate must be between 0 and 50 percent.');
  if (fixed < 0 || vat < 0 || vat > 50) throw httpError(400, 'Fixed fee and VAT must be valid numbers.');
  const row = { medium: d.medium, provider: d.provider, rate, fixed, vat, is_active: !!d.isActive };
  if (d.id) await patch(`processing_fees?id=eq.${q(d.id)}`, row);
  else {
    const dupe = await sb(`processing_fees?medium=eq.${q(d.medium)}&provider=eq.${q(d.provider)}&select=id&limit=1`);
    if (dupe?.length) throw httpError(409, 'This medium and provider already has a fee. Edit it instead.');
    await sb('processing_fees', { method: 'POST', prefer: 'return=minimal', body: row });
  }
  resetFees();
};
A['fee.delete'] = async (_a, { id }) => { await del(`processing_fees?id=eq.${q(id)}`); resetFees(); };

/* ── messages ── */
A['templates.list'] = async () => ({ items: (await sb('message_templates?order=created_at.desc')) || [] });
A['template.save'] = async (_a, d) => {
  need(d.title?.trim() && d.body?.trim(), 'Title and message are required.');
  const row = { title: d.title.trim(), body: d.body.trim(), type: d.type || 'announcement', icon: '' };
  if (d.id) await patch(`message_templates?id=eq.${q(d.id)}`, { ...row, updated_at: new Date().toISOString() }); else await sb('message_templates', { method: 'POST', prefer: 'return=minimal', body: row });
};
A['template.delete'] = async (_a, { id }) => del(`message_templates?id=eq.${q(id)}`);
A['users.search'] = async (_a, { text }) => {
  const t = String(text || '').replace(/[,()*%]/g, ' ').trim(); if (t.length < 2) return { items: [] };
  return { items: (await sb(`users?or=(email.ilike.*${encodeURIComponent(t)}*,first_name.ilike.*${encodeURIComponent(t)}*,last_name.ilike.*${encodeURIComponent(t)}*)&status=eq.active&limit=10&select=id,first_name,last_name,email,role`)) || [] };
};
A['message.send'] = async (_a, { templateId, to }) => {
  const tpl = need((await sb(`message_templates?id=eq.${q(templateId)}&limit=1`))?.[0], 'Template not found.');
  const sel = 'users?select=id&status=eq.active&is_inactive=eq.false';
  const users = to?.userId ? [{ id: to.userId }] : (await sb(`${sel}${to === 'regulars' ? '&role=eq.regular' : to === 'providers' ? '&role=eq.provider' : ''}`)) || [];
  need(users.length, 'No recipients found.');
  const rows = users.map((u) => ({ user_id: u.id, title: tpl.title, body: tpl.body, type: tpl.type, icon: '', is_read: false }));
  for (let i = 0; i < rows.length; i += 100) await sb('user_messages', { method: 'POST', prefer: 'return=minimal', body: rows.slice(i, i + 100) });
  pushTo(users.map((u) => u.id), { title: tpl.title, body: tpl.body, url: '/' });
  await patch(`message_templates?id=eq.${q(templateId)}`, { send_count: (tpl.send_count || 0) + 1 });
  return { sent: users.length };
};

/* ── change requests ── */
A['changes.list'] = async () => {
  const rows = (await sb('change_requests?status=eq.pending&order=created_at.asc')) || [];
  return { items: await Promise.all(rows.map(async (r) => ({ ...r, verify_hash: undefined, codeSent: !!r.verify_hash, newEmail: emailOfRequest(r.subject, r.requested_value), file_url: r.file_url ? await signedUrl(r.file_url) : null }))) };
};
A['change.sendCode'] = async (_a, { id }) => {
  const r = need((await sb(`change_requests?id=eq.${q(id)}&status=eq.pending&limit=1`))?.[0], 'Request not found.');
  const email = need(emailOfRequest(r.subject, r.requested_value), 'This request has no email change.');
  const code = String(crypto.randomInt(10000000, 100000000));
  if (!(await mail('email_change_code', { email, code, bizName: r.provider_name }))) throw httpError(502, 'Could not send the email. Check the address and try again.');
  await patch(`change_requests?id=eq.${q(id)}`, { verify_hash: crypto.createHash('sha256').update(code).digest('hex'), verify_attempts: 0, verify_sent_at: new Date().toISOString(), email_verified: false });
  await notify(r.user_id, 'Verify your new email', `We sent an 8-digit code to ${email}.\n\nOpen Profile > Edit and enter the code. You have 3 tries. After 3 wrong tries your request is cancelled and you must wait 30 days.`, 'announcement');
  pushTo(r.user_id, { title: 'Verify your new email', body: 'Enter the code we sent to your new email.', url: '/profile?tab=edit' });
};
async function closeChange(r) { await remove(r.file_url); await del(`change_requests?id=eq.${q(r.id)}`); }
A['change.approve'] = async (_a, { id }) => {
  const r = need((await sb(`change_requests?id=eq.${q(id)}&limit=1`))?.[0], 'Request not found.');
  if (emailOfRequest(r.subject, r.requested_value) && !r.email_verified) throw httpError(409, 'The provider has not verified the new email yet.');
  let msg = 'Your request was approved. Our team will apply the change shortly.';
  if (r.subject === 'Business Name Change') { await patch(`providers?id=eq.${q(r.provider_id)}`, { biz_name: r.requested_value }); msg = `Your business name is now "${r.requested_value}".`; }
  else if (r.subject === 'Email Change') { await patch(`users?id=eq.${q(r.user_id)}`, { email: r.requested_value.toLowerCase() }); msg = `Your account email is now ${r.requested_value}.`; }
  else if (r.subject === 'Location Change') { try { const l = JSON.parse(r.requested_value); await patch(`providers?id=eq.${q(r.provider_id)}`, { region_name: l.region_name || '', province_name: l.province_name || '', city_name: l.city_name || '', barangay_name: l.barangay_name || '', street_addr: l.street_addr || '' }); msg = 'Your location was updated.'; } catch { /* free-text request: apply by hand */ } }
  await notify(r.user_id, 'Request approved', `${msg}\n\nYou can send another change request 30 days after your last request was submitted.`, 'announcement'); await closeChange(r);
  pushTo(r.user_id, { title: 'Change request approved', body: msg, url: '/profile?tab=edit' });
};
A['change.reject'] = async (_a, { id, reason }) => {
  const r = need((await sb(`change_requests?id=eq.${q(id)}&limit=1`))?.[0], 'Request not found.');
  need(reason?.trim(), 'Give the provider a reason.');
  await notify(r.user_id, 'Request not approved', `Your ${r.subject} request was not approved.\n\nReason: ${reason}\n\nYou can submit a new change request immediately. The 30-day waiting period does not apply to rejected requests.`, 'warning'); await closeChange(r);
  await patch(`providers?id=eq.${q(r.provider_id)}`, { last_change_at: null });
  pushTo(r.user_id, { title: 'Change request not approved', body: 'You can send a new request immediately. Open Fixia to read why.', url: '/profile?tab=edit' });
};

/* ── reports ── */
A['reports.list'] = async (_a, { status }) => ({ items: (await sb(`provider_reports?status=eq.${q(status || 'pending')}&order=created_at.desc`)) || [] });
A['report.dismiss'] = async (_a, { id }) => patch(`provider_reports?id=eq.${q(id)}`, { status: 'dismissed' });
A['report.warn'] = async (_a, { id }) => {
  const r = need((await sb(`provider_reports?id=eq.${q(id)}&limit=1`))?.[0], 'Report not found.');
  const p = (await sb(`providers?id=eq.${q(r.provider_id)}&select=user_id&limit=1`))?.[0];
  if (p) await notify(p.user_id, 'Account warning', 'You were reported for activity that goes against our community rules. Please treat this as a formal warning. Further violations may lead to suspension.', 'warning');
  await patch(`provider_reports?id=eq.${q(id)}`, { status: 'warned' });
};
A['report.suspend'] = async (_a, { id }) => {
  const r = need((await sb(`provider_reports?id=eq.${q(id)}&limit=1`))?.[0], 'Report not found.');
  const p = need((await sb(`providers?id=eq.${q(r.provider_id)}&select=id,user_id&limit=1`))?.[0], 'Provider not found.');
  const days = parseInt((await settings()).suspension_days) || 7;
  await patch(`providers?id=eq.${q(p.id)}`, { status: 'suspension_pending' });
  await sb('user_messages', { method: 'POST', prefer: 'return=minimal', body: { user_id: p.user_id, title: 'Account suspension notice', body: `You were reported for activity that goes against our community rules.\n\nWhen you close this message your account will be suspended for ${days} day${days === 1 ? '' : 's'}.\n\nIf you think this is a mistake, contact support.`, type: 'warning', icon: '', is_read: false, metadata: JSON.stringify({ action: 'suspend_on_read', provider_id: p.id, user_id: p.user_id, suspension_days: days }) } });
  await patch(`provider_reports?id=eq.${q(id)}`, { status: 'suspended' });
};

/* ── uncategorised listings ── */
A['uncat.list'] = async () => {
  const rows = (await sb('listings?cat_main=eq.other&order=created_at.asc')) || [];
  const ps = rows.length ? (await sb(`providers?id=in.(${[...new Set(rows.map((r) => q(r.provider_id)))].join(',')})&select=id,biz_name`)) || [] : [];
  return { items: rows.map((l) => ({ ...l, provider: ps.find((p) => p.id === l.provider_id)?.biz_name })) };
};
A['uncat.reassign'] = async (_a, { id, category, sub }) => { need(category && sub?.trim(), 'Choose a category and a service.'); await patch(`listings?id=eq.${q(id)}`, { cat_main: category, cat_sub: sub.trim(), other_service_desc: null }); };

/* ── upgrades ── */
A['upgrades.list'] = async (_a, { history }) => {
  const rows = (await sb(history ? 'upgrade_requests?archived_at=not.is.null&order=archived_at.desc&limit=100' : 'upgrade_requests?archived_at=is.null&status=eq.pending&order=created_at.asc')) || [];
  const us = rows.length ? (await sb(`users?id=in.(${[...new Set(rows.map((r) => q(r.user_id)))].join(',')})&select=id,first_name,last_name,email,role`)) || [] : [];
  const ps = (await sb('packages?select=id,name,price')) || [];
  return { items: rows.map((r) => ({ ...r, user: us.find((u) => u.id === r.user_id), newPlan: ps.find((p) => p.id === r.new_package_id), oldPlan: ps.find((p) => p.id === r.current_package_id) })) };
};
A['upgrade.approve'] = async (_a, { id }) => {
  const r = need((await sb(`upgrade_requests?id=eq.${q(id)}&limit=1`))?.[0], 'Request not found.');
  if (r.status !== 'pending') throw httpError(409, 'Already handled.');
  const pkg = need(await getPackage(r.new_package_id), 'Plan not found.');
  const u = (await sb(`users?id=eq.${q(r.user_id)}&select=*&limit=1`))?.[0];
  const base = PERIOD_DAYS[pkg.period] ?? null;
  await applyPackage(u, pkg, base === null ? null : base + (r.carryover_days || 0), { payment_method: r.payment_method, payment_reference: r.payment_reference, payment_amount: r.payment_amount, payment_status: 'verified' });
  await notify(r.user_id, 'Upgrade approved', `Your upgrade to ${pkg.name} is active. Unused time from your old plan was added.`, 'success');
  await patch(`upgrade_requests?id=eq.${q(id)}`, { status: 'approved', archived_at: new Date().toISOString(), archive_reason: 'approved_by_admin' });
  if (u.role === 'regular') await credit(u.id, 3).catch(() => {});
};
A['upgrade.reject'] = async (_a, { id, reason }) => {
  const r = need((await sb(`upgrade_requests?id=eq.${q(id)}&limit=1`))?.[0], 'Request not found.');
  await patch(`upgrade_requests?id=eq.${q(id)}`, { status: 'rejected', notes: reason || null, reviewed_at: new Date().toISOString(), archived_at: new Date().toISOString(), archive_reason: 'rejected_by_admin' });
  await notify(r.user_id, 'Upgrade not approved', `Your upgrade request could not be approved.\n\nReason: ${reason || 'No reason given. Contact support if this is a mistake.'}`, 'warning');
};

/* ── suspicious ratings ── */
A['suspicious.list'] = async () => {
  const [ratings, inqs, users, provs] = await Promise.all([sb('ratings?select=*&order=created_at.desc&limit=2000'), sb('inquiries?select=provider_id,user_ip&user_ip=not.is.null&limit=5000'), sb('users?select=id,first_name,last_name'), sb('providers?select=id,biz_name')]);
  const un = Object.fromEntries(users.map((u) => [u.id, `${u.first_name} ${u.last_name}`])), pn = Object.fromEntries(provs.map((p) => [p.id, p.biz_name]));
  const flags = new Map(); const add = (r, type, detail) => { if (!flags.has(r.id)) flags.set(r.id, { id: r.id, providerId: r.provider_id, provider: pn[r.provider_id], user: un[r.regular_user_id], stars: r.stars, date: r.created_at, type, detail }); };
  const ips = {}; inqs.forEach((i) => (ips[i.provider_id] ||= new Set()).add(i.user_ip));
  ratings.forEach((r) => r.user_ip && ips[r.provider_id]?.has(r.user_ip) && add(r, 'Same IP as provider', r.user_ip));
  const byPair = {}, byUser = {}, byProv = {};
  [...ratings].reverse().forEach((r) => { (byPair[`${r.regular_user_id}_${r.provider_id}`] ||= []).push(r); (byUser[r.regular_user_id] ||= []).push(r); (byProv[r.provider_id] ||= []).push(r); });
  const H = 3600000, t = (r) => +new Date(r.created_at);
  Object.values(byPair).forEach((a) => a.forEach((r, i) => i && t(r) - t(a[i - 1]) < 3 * 24 * H && add(r, 'Rated again within 3 days', `${((t(r) - t(a[i - 1])) / (24 * H)).toFixed(1)} days apart`)));
  Object.values(byUser).forEach((a) => a.forEach((r, i) => i >= 2 && t(r) - t(a[i - 2]) <= 24 * H && [a[i - 2], a[i - 1], r].forEach((x) => add(x, 'Rated 3+ providers in a day', `${((t(r) - t(a[i - 2])) / H).toFixed(1)} hours`))));
  Object.values(byProv).forEach((a) => a.forEach((r, i) => { if (i < 4) return; const w = a.slice(i - 4, i + 1); if (w.every((x) => x.stars === 5) && t(r) - t(w[0]) <= 48 * H) w.forEach((x) => add(x, 'Five 5-star ratings in 48h', '')); }));
  return { items: [...flags.values()] };
};
A['rating.delete'] = async (_a, { id }) => {
  const r = need((await sb(`ratings?id=eq.${q(id)}&select=provider_id&limit=1`))?.[0], 'Rating not found.');
  await del(`ratings?id=eq.${q(id)}`);
  const all = (await sb(`ratings?provider_id=eq.${q(r.provider_id)}&select=stars`)) || [];
  await patch(`providers?id=eq.${q(r.provider_id)}`, { avg_rating: all.length ? Math.round((all.reduce((s, x) => s + x.stars, 0) / all.length) * 10) / 10 : 0, total_ratings: all.length });
};

export default A;
