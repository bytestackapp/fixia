/* Public actions: sign-up, email codes, password reset. No login needed, so every input is checked here. */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { sb, q } from '../db.js';
import { httpError, issueToken, publicUser, sealProof, checkProof } from '../auth.js';
import { settings } from '../settings.js';
import { mail } from '../mail.js';
import { upload } from '../storage.js';
import { genCode, credit } from '../referral.js';
import { getPackage, applyPackage, FREE, PERIOD_DAYS } from '../packages.js';
import { upgradeManual } from './account.js';

const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const EMAIL = /^\S+@\S+\.\S+$/, PHONE = /^(09\d{9}|\+639\d{9})$/, USER = /^[a-z0-9._]{3,30}$/;
const MANUAL = ['gcash', 'maya', 'bank'];

function checkAccount(d) {
  const v = (c, m) => { if (!c) throw httpError(400, m); };
  v(d.firstName?.trim() && d.lastName?.trim(), 'First and last name are required.');
  v(EMAIL.test(d.email || ''), 'Enter a valid email address.');
  v(PHONE.test(d.phone || ''), 'Enter a valid PH mobile number (09XXXXXXXXX).');
  v(USER.test((d.username || '').toLowerCase()), 'Username: 3–30 letters, numbers, dot or underscore.');
  v(typeof d.password === 'string' && d.password.length >= 8 && d.password.length <= 128, 'Password must be 8–128 characters.');
}
async function checkUnique(d) {
  const e = encodeURIComponent;
  const [em, un, ph] = await Promise.all([
    sb(`users?email=eq.${e(d.email.trim().toLowerCase())}&select=id&limit=1`),
    sb(`users?username=eq.${e(d.username.trim().toLowerCase())}&select=id&limit=1`),
    sb(`users?phone=eq.${e(d.phone.trim())}&select=id&limit=1`),
  ]);
  if (em?.length) throw httpError(409, 'This email is already registered. Please sign in.');
  if (un?.length) throw httpError(409, 'That username is taken.');
  if (ph?.length) throw httpError(409, 'This phone number is already registered.');
}
async function requireProof(d) {
  const s = await settings();
  if (s.otp_enabled === 'false' || (s.otp_enabled !== 'true' && !s.otp_test_code)) return;   // verification switched off
  if (!checkProof(d.proof, d.email)) throw httpError(400, 'Please verify your email first.');
}
const baseUser = async (d, role) => ({
  email: d.email.trim().toLowerCase(), username: d.username.trim().toLowerCase(),
  password_hash: d.passwordHash || await bcrypt.hash(d.password, 12), first_name: d.firstName.trim(), last_name: d.lastName.trim(),
  phone: d.phone.trim(), role, is_inactive: false, referral_code: genCode(), referred_by: d.referredBy || null,
});
async function linkReferral(newUser, code) {
  if (!code) return;
  const ref = (await sb(`users?referral_code=eq.${q(code)}&select=id&limit=1`))?.[0];
  if (ref) await sb('referrals', { method: 'POST', prefer: 'return=minimal', body: { referrer_id: ref.id, referred_id: newUser.id, points: 0, status: 'pending' } });
}
const session = async (user) => {
  const sid = crypto.randomUUID();
  await sb(`users?id=eq.${q(user.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { session_token: sid, last_login_at: new Date().toISOString() } });
  return { token: issueToken(user, sid), user: publicUser(user) };
};

/* ── checks shared with the online-payment sign-up ── */
async function planFor(d, type) {
  const pkg = await getPackage(d.packageId);
  if (!pkg || pkg.type !== type || !pkg.is_active) throw httpError(400, 'Please choose a plan.');
  return pkg;
}
async function checkProvider(d) {
  if (!d.bizName?.trim() || !d.cityName || !d.regionName) throw httpError(400, 'Business name and location are required.');
  if (!d.avatar || !d.idFile || !d.idType) throw httpError(400, 'Avatar and a government ID are required.');
  return planFor(d, 'provider');
}
function checkManual(d, pkg) {
  if (pkg.price <= 0) throw httpError(400, 'Choose a paid plan.');
  if (!MANUAL.includes(d.payment?.method) || !String(d.payment?.reference || '').trim()) throw httpError(400, 'Enter your payment reference number.');
}
// Validates a whole sign-up (used before taking an online payment). Returns the chosen plan.
export async function checkSignup(d, role) {
  checkAccount(d); await checkUnique(d); await requireProof(d);
  return role === 'provider' ? checkProvider(d) : planFor(d, 'regular');
}

/* ── creating accounts ── */
async function insertRegular(d) {
  const free = await getPackage(FREE.regular);
  const row = { ...(await baseUser(d, 'regular')), status: 'active', package_id: FREE.regular, package_name: free?.name || 'Free', ads_free: false, payment_status: 'free' };
  const user = (await sb('users', { method: 'POST', body: row }))?.[0];
  await linkReferral(user, d.referredBy);
  mail('regular_welcome', { email: user.email, fullName: `${user.first_name} ${user.last_name}`, username: user.username, package: 'Free' });
  return user;
}
async function insertProvider(d, pkg, pay = null) {
  const stamp = `${d.username.trim().toLowerCase()}_${Date.now()}`;
  const [av, id] = await Promise.all([upload('fixia-avatars', `${stamp}_avatar`, d.avatar), upload('fixia-ids', `${stamp}_id`, d.idFile)]);
  const free = pkg.price === 0;
  const userRow = { ...(await baseUser(d, 'provider')), status: 'pending', package_id: pkg.id, package_name: pkg.name, ads_free: pkg.ads_free ?? false, avatar_url: av.url, payment_status: free ? 'free' : 'awaiting' };
  const provRow = {
    biz_name: d.bizName.trim(), cat_main: null, cat_sub: null, biz_desc: null, region: d.region || null, region_name: d.regionName,
    province: d.province || null, province_name: d.provName || null, city: d.city || null, city_name: d.cityName,
    barangay: d.barangay || null, barangay_name: d.brgyName || null, street_addr: d.streetAddr?.trim() || null,
    id_type: d.idType, id_file_url: id.url, avatar_url: av.url, portfolio_urls: [], package_id: pkg.id,
    status: 'pending', is_featured: false, is_elite: false, avg_rating: 0, total_ratings: 0,
  };
  const out = await sb('rpc/register_provider', { method: 'POST', body: { user_data: userRow, prov_data: provRow } });
  const user = out?.user;
  if (pay) await sb(`users?id=eq.${q(user.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { payment_method: pay.method, payment_reference: pay.reference, payment_amount: String(pay.amount), payment_status: pay.status } });
  await linkReferral(user, d.referredBy);
  const fullName = `${user.first_name} ${user.last_name}`;
  mail('provider_signup_confirm', { email: user.email, fullName, bizName: d.bizName });
  mail('provider_signup_notify', { fullName, email: user.email, bizName: d.bizName, location: [d.cityName, d.provName].filter(Boolean).join(', '), package: pkg.name });
  return user;
}

export const registerRegular = async (_u, d) => {
  checkAccount(d); await checkUnique(d); await requireProof(d);
  let pkg = null;
  if (d.payment) { pkg = await planFor(d, 'regular'); checkManual(d, pkg); }
  const user = await insertRegular(d);
  // manual payment: the account starts on Free and an upgrade request waits for admin approval
  if (pkg) await upgradeManual(user, { packageId: pkg.id, method: d.payment.method, reference: d.payment.reference, amount: d.payment.amount });
  return session(user);
};

export const registerProvider = async (_u, d) => {
  checkAccount(d); await checkUnique(d); await requireProof(d);
  const pkg = await checkProvider(d);
  if (d.payment) checkManual(d, pkg);
  const pay = d.payment ? { method: d.payment.method, reference: String(d.payment.reference).trim().slice(0, 60), amount: Number(d.payment.amount) || pkg.price, status: 'pending' } : null;
  const user = await insertProvider(d, pkg, pay);
  if (pay) mail('payment_notify', { fullName: `${user.first_name} ${user.last_name}`, email: user.email, package: pkg.name, method: pay.method, reference: pay.reference, amount: `₱${pay.amount}`, verified: false });
  return { ...(await session(user)), packageId: pkg.id, free: pkg.price === 0 };
};

// Called after an online payment is confirmed. Creates the account with the paid plan already active.
export async function createPaidAccount(d, role, pkg, pay) {
  const days = PERIOD_DAYS[pkg.period] ?? null;
  const extra = { payment_method: pay.method, payment_reference: pay.txn, payment_amount: String(pay.amount), payment_status: 'verified' };
  if (role === 'provider') {
    const user = await insertProvider(d, pkg, { method: pay.method, reference: pay.txn, amount: pay.amount, status: 'verified' });
    await applyPackage(user, pkg, days, extra);
    return user;
  }
  const user = await insertRegular(d);
  await applyPackage(user, pkg, days, extra);
  await credit(user.id, 3).catch(() => {});
  return user;
}

/* ── email codes ── */
export async function otpSend(_u, { email }) {
  if (!EMAIL.test(email || '')) throw httpError(400, 'Enter a valid email address.');
  const s = await settings(), mailAddr = email.trim().toLowerCase();
  const test = s.otp_test_code && s.otp_test_code.length === 6 ? s.otp_test_code : null;
  if (s.otp_enabled === 'false' || (!test && s.otp_enabled !== 'true')) return { required: false };
  const recent = await sb(`otp_codes?email=eq.${encodeURIComponent(mailAddr)}&created_at=gt.${new Date(Date.now() - 60000).toISOString()}&select=id&limit=1`);
  if (recent?.length) throw httpError(429, 'Please wait a minute before asking for another code.');
  const otp = test || String(100000 + (crypto.randomBytes(4).readUInt32BE() % 900000));
  await sb(`otp_codes?email=eq.${encodeURIComponent(mailAddr)}&used=eq.false`, { method: 'DELETE', prefer: 'return=minimal' });
  await sb('otp_codes', { method: 'POST', prefer: 'return=minimal', body: { email: mailAddr, otp_hash: sha(otp), expires_at: new Date(Date.now() + 600000).toISOString(), used: false } });
  if (!test && !(await mail('email_otp', { email: mailAddr, otp }))) throw httpError(502, 'We could not send the email. Please try again in a moment.');
  return { required: true };
}
export async function otpVerify(_u, { email, code }) {
  const mailAddr = String(email || '').trim().toLowerCase();
  const rows = await sb(`otp_codes?email=eq.${encodeURIComponent(mailAddr)}&otp_hash=eq.${sha(String(code || '').trim())}&used=eq.false&expires_at=gt.${new Date().toISOString()}&limit=1`);
  if (!rows?.length) throw httpError(400, 'That code is incorrect or has expired.');
  await sb(`otp_codes?id=eq.${q(rows[0].id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { used: true } });
  return { proof: sealProof(mailAddr) };
}

/* ── password reset ── */
export async function resetRequest(_u, { email }) {
  const u = (await sb(`users?email=eq.${encodeURIComponent(String(email || '').trim().toLowerCase())}&select=id,first_name,last_name,email&limit=1`))?.[0];
  if (u) {
    const fresh = await sb(`password_resets?user_id=eq.${q(u.id)}&used=eq.false&expires_at=gt.${new Date(Date.now() + 59 * 60000).toISOString()}&select=id&limit=1`);
    if (!fresh?.length) {
      const raw = crypto.randomBytes(32).toString('hex');
      await sb('password_resets', { method: 'POST', prefer: 'return=minimal', body: { user_id: u.id, token: sha(raw), expires_at: new Date(Date.now() + 3600000).toISOString(), used: false } });
      mail('reset_password', { fullName: `${u.first_name} ${u.last_name}`, email: u.email, token: raw });
    }
  }
  return { ok: true };       // same answer whether or not the email exists
}
const findToken = async (t) => (await sb(`password_resets?token=eq.${sha(String(t || ''))}&used=eq.false&expires_at=gt.${new Date().toISOString()}&limit=1`))?.[0];
export const resetValidate = async (_u, { token }) => ({ valid: !!(await findToken(token)) });
export async function resetConfirm(_u, { token, password }) {
  const rec = await findToken(token);
  if (!rec) throw httpError(400, 'This reset link is invalid or has expired.');
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw httpError(400, 'Password must be 8–128 characters.');
  await sb(`users?id=eq.${q(rec.user_id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { password_hash: await bcrypt.hash(password, 12), session_token: null } });
  await sb(`password_resets?id=eq.${q(rec.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { used: true } });
  return { ok: true };
}

export async function publicPackages(_u, { type }) {
  const t = type === 'provider' ? 'provider' : 'regular';
  return { items: (await sb(`packages?type=eq.${t}&is_active=eq.true&order=sort_order.asc&select=id,name,price,period,icon,popular,badge_label,features,listing_limit,booking_limit,ads_free`)) || [] };
}