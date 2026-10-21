/* FIXIA — /api/password-reset.js  (NEW). Tokens are generated + stored hashed on the server; the browser never reads the table.
   Actions: request {email} | validate {token} | confirm {token,password}. After deploying run: delete from password_resets; */
const crypto = require('crypto'), bcrypt = require('bcryptjs');
const SUPA_URL = process.env.SUPA_URL, KEY = process.env.SUPA_SERVICE_KEY, APP_URL = process.env.APP_URL;
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
async function sb(path, opts = {}) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, { ...opts, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(opts.headers || {}) } });
  const t = await r.text(); if (!r.ok) throw new Error(t); return t ? JSON.parse(t) : null;
}
const findToken = async raw => (await sb(`password_resets?token=eq.${sha(raw)}&used=eq.false&expires_at=gt.${new Date().toISOString()}&limit=1`))?.[0];

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).end();
  const { action, email, token, password } = req.body || {};
  try {
    if (action === 'request') {
      if (!email) return res.status(400).json({ error: 'Missing email.' });
      const u = (await sb(`users?email=eq.${encodeURIComponent(email.trim().toLowerCase())}&select=id,first_name,last_name,email&limit=1`))?.[0];
      if (u) {
        const fresh = await sb(`password_resets?user_id=eq.${u.id}&used=eq.false&expires_at=gt.${new Date(Date.now() + 59 * 60000).toISOString()}&limit=1`); // issued <60s ago
        if (!fresh?.length) {
          const raw = crypto.randomBytes(32).toString('hex');
          await sb('password_resets', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ user_id: u.id, token: sha(raw), expires_at: new Date(Date.now() + 3600000).toISOString(), used: false }) });
          await fetch(`${APP_URL}/api/send-email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'reset_password', data: { fullName: `${u.first_name} ${u.last_name}`, email: u.email, token: raw } }) });
        }
      }
      return res.status(200).json({ ok: true });                    // same answer whether or not the email exists
    }
    if (!token || typeof token !== 'string') return res.status(400).json({ error: 'Missing token.' });
    const rec = await findToken(token);
    if (action === 'validate') return res.status(200).json({ valid: !!rec });
    if (action === 'confirm') {
      if (!rec) return res.status(400).json({ error: 'Invalid or expired reset link.' });
      if (typeof password !== 'string' || password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password must be 8–128 characters.' });
      const hash = await bcrypt.hash(password, 12);
      await sb(`users?id=eq.${rec.user_id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ password_hash: hash, session_token: null }) }); // also signs out other devices
      await sb(`password_resets?id=eq.${rec.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ used: true }) });
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) { console.error('[Fixia reset]', e.message); return res.status(500).json({ error: 'Something went wrong.' }); }
};
