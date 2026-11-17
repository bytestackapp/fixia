import crypto from 'node:crypto';
import { sb, q } from './db.js';

const SECRET = process.env.JWT_SECRET;
const DAYS = 30;

const b64 = (b) => Buffer.from(b).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

export function issueToken(user, sid) {
  if (!SECRET) throw new Error('JWT_SECRET is not set');
  const head = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64(JSON.stringify({ sub: user.id, sid, exp: Math.floor(Date.now() / 1000) + DAYS * 86400 }));
  return `${head}.${body}.${sign(`${head}.${body}`)}`;
}

function readToken(token) {
  const [h, p, s] = String(token || '').split('.');
  if (!h || !p || !s || !SECRET) return null;
  const good = sign(`${h}.${p}`);
  const a = Buffer.from(s), b = Buffer.from(good);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const data = JSON.parse(Buffer.from(p, 'base64url').toString());
  return data.exp > Date.now() / 1000 ? data : null;
}

export const httpError = (status, message) => Object.assign(new Error(message), { status });

// Returns the logged-in user or throws 401/403. Use at the top of every protected endpoint.
export async function requireUser(req, roles) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const data = readToken(token);
  if (!data) throw httpError(401, 'Please sign in again.');
  const rows = await sb(`users?id=eq.${q(data.sub)}&select=id,role,status,session_token,first_name,last_name,username,email,phone,avatar_url,package_id,package_name,ads_free,subscription_start,subscription_end,payment_status,payment_method,created_at,force_logout&limit=1`);
  const user = rows?.[0];
  if (!user) throw httpError(401, 'Please sign in again.');
  if (user.session_token !== data.sid) throw httpError(401, 'You were signed out because this account was opened on another device.');
  if (user.status === 'suspended') throw httpError(403, 'This account is suspended.');
  if (roles && !roles.includes(user.role)) throw httpError(403, 'You do not have access to this.');
  return user;
}

export const publicUser = (u) => ({
  id: u.id, role: u.role, status: u.status, firstName: u.first_name, lastName: u.last_name,
  username: u.username, email: u.email, avatarUrl: u.avatar_url || null,
  packageId: u.package_id || null, packageName: u.package_name || 'Free', adsFree: !!u.ads_free,
  subscriptionEnd: u.subscription_end || null, paymentStatus: u.payment_status || null,
});

// Short-lived signed proof that an email address was verified (used by sign-up).
export function sealProof(email) {
  const body = b64(JSON.stringify({ e: String(email).toLowerCase(), x: Math.floor(Date.now() / 1000) + 1800 }));
  return `${body}.${sign(body)}`;
}
export function checkProof(proof, email) {
  const [body, s] = String(proof || '').split('.');
  if (!body || !s || s !== sign(body)) return false;
  const d = JSON.parse(Buffer.from(body, 'base64url').toString());
  return d.e === String(email).toLowerCase() && d.x > Date.now() / 1000;
}
