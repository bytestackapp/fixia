/* /api/auth — everything that works without being signed in, plus sign-in / sign-out. */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { sb, q } from './_lib/db.js';
import { issueToken, requireUser, publicUser, httpError } from './_lib/auth.js';
import { route, clientIp } from './_lib/http.js';
import { downgradeIfExpired } from './_lib/packages.js';
import * as reg from './_lib/actions/registration.js';
import * as Pay from './_lib/actions/payments.js';
import { feeRows, methodKey } from './_lib/fees.js';

const publicFees = async () => ({
  items: (await feeRows()).filter((r) => r.is_active).map((r) => ({ key: methodKey(r), medium: r.medium, provider: r.provider, rate: Number(r.rate), fixed: Number(r.fixed), vat: Number(r.vat) })),
});

const BAD = 'Email, username or password is not correct.';
const DUMMY = '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi';

async function login(_u, { identifier, password }, req) {
  if (!identifier || !password || String(password).length > 128) throw httpError(400, BAD);
  const id = String(identifier).trim().toLowerCase();
  const user = (await sb(`users?${id.includes('@') ? 'email' : 'username'}=eq.${q(id)}&limit=1`))?.[0];
  const ok = await bcrypt.compare(String(password), user?.password_hash || DUMMY);   // constant work either way
  if (!user || !ok) throw httpError(401, BAD);
  if (user.status === 'suspended') throw httpError(403, 'This account is suspended. Contact support if you think this is a mistake.');
  if (user.status === 'rejected') throw httpError(403, 'This application was not approved.');
  if (user.role === 'provider') {
    const prov = (await sb(`providers?user_id=eq.${q(user.id)}&select=status&limit=1`))?.[0];
    if (prov?.status === 'suspended') throw httpError(403, 'This account is suspended. Contact support if you think this is a mistake.');
  }
  const sid = crypto.randomUUID();       // a new value signs out any other device
  await sb(`users?id=eq.${q(user.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { session_token: sid, last_login_at: new Date().toISOString(), is_inactive: false, force_logout: false, last_ip: clientIp(req) } });
  return { token: issueToken(user, sid), user: publicUser(await downgradeIfExpired(user)) };
}

async function me(_u, _p, req) {
  const user = await requireUser(req);
  return { user: publicUser(await downgradeIfExpired(user)) };
}
async function logout(_u, _p, req) {
  const user = await requireUser(req);
  await sb(`users?id=eq.${q(user.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { session_token: null } });
  await sb(`push_subscriptions?user_id=eq.${q(user.id)}`, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
}

export default route({
  login, me, logout,
  'register.regular': reg.registerRegular, 'register.provider': reg.registerProvider,
  'otp.send': reg.otpSend, 'otp.verify': reg.otpVerify,
  'reset.request': reg.resetRequest, 'reset.validate': reg.resetValidate, 'reset.confirm': reg.resetConfirm,
  'packages.public': reg.publicPackages, 'fees.public': publicFees,
  'signup.pay': Pay.signupCheckout, 'signup.finish': Pay.signupFinish,
});
