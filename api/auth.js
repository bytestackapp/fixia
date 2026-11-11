/* /api/auth — sign in, current user, sign out. One function keeps you under Vercel's function limit. */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { sb, q } from './_lib/db.js';
import { issueToken, requireUser, publicUser, httpError } from './_lib/auth.js';

const BAD = 'Email, username or password is not correct.';

async function login({ identifier, password }) {
  if (!identifier || !password || String(password).length > 128) throw httpError(400, BAD);
  const id = String(identifier).trim().toLowerCase();
  const col = id.includes('@') ? 'email' : 'username';
  const user = (await sb(`users?${col}=eq.${q(id)}&limit=1`))?.[0];
  // Always run a hash comparison so response time does not reveal whether the account exists.
  const ok = await bcrypt.compare(String(password), user?.password_hash || '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi');
  if (!user || !ok) throw httpError(401, BAD);
  if (user.status === 'suspended') throw httpError(403, 'This account is suspended. Contact support if you think this is a mistake.');
  if (user.status === 'rejected') throw httpError(403, 'This application was not approved.');
  if (user.role === 'provider') {
    const prov = (await sb(`providers?user_id=eq.${q(user.id)}&select=status&limit=1`))?.[0];
    if (prov?.status === 'suspended') throw httpError(403, 'This account is suspended. Contact support if you think this is a mistake.');
  }
  const sid = crypto.randomUUID(); // new value signs out any other device
  await sb(`users?id=eq.${q(user.id)}`, {
    method: 'PATCH', prefer: 'return=minimal',
    body: { session_token: sid, last_login_at: new Date().toISOString(), is_inactive: false, force_logout: false },
  });
  return { token: issueToken(user, sid), user: publicUser(user) };
}

async function logout(req) {
  const user = await requireUser(req);
  await sb(`users?id=eq.${q(user.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { session_token: null } });
  await sb(`push_subscriptions?user_id=eq.${q(user.id)}`, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
  return { ok: true };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { action, ...rest } = req.body || {};
  try {
    if (action === 'login') return res.status(200).json(await login(rest));
    if (action === 'me') return res.status(200).json({ user: publicUser(await requireUser(req)) });
    if (action === 'logout') return res.status(200).json(await logout(req));
    return res.status(400).json({ error: 'Unknown action.' });
  } catch (e) {
    if (!e.status) console.error('[auth]', e);
    return res.status(e.status || 500).json({ error: e.status ? e.message : 'Something went wrong. Please try again.' });
  }
}
