/* FIXIA — /api/verify-otp.js (adds CORS preflight, service key, max 5 attempts). Needs: alter table otp_codes add column attempts int default 0; */
const crypto = require('crypto');
const SUPA_URL = process.env.SUPA_URL;
const KEY = process.env.SUPA_SERVICE_KEY || process.env.SUPA_KEY;
async function sb(path, opts = {}) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, { ...opts, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(opts.headers || {}) } });
  const t = await r.text(); if (!r.ok) throw new Error(t); return t ? JSON.parse(t) : null;
}
module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).end();
  const { email, otp } = req.body || {};
  if (!email || !/^\d{6}$/.test(String(otp || '').trim())) return res.status(400).json({ error: 'Missing or invalid fields.' });
  try {
    const e = encodeURIComponent(email.trim().toLowerCase());
    const rows = await sb(`otp_codes?email=eq.${e}&used=eq.false&expires_at=gt.${new Date().toISOString()}&order=expires_at.desc&limit=1`);
    const row = rows?.[0];
    if (!row) return res.status(200).json({ valid: false, error: 'Incorrect or expired code. Please try again.' });
    if ((row.attempts || 0) >= 5) {
      await sb(`otp_codes?id=eq.${row.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ used: true }) });
      return res.status(200).json({ valid: false, error: 'Too many attempts. Please request a new code.' });
    }
    const given = crypto.createHash('sha256').update(String(otp).trim()).digest();
    const ok = crypto.timingSafeEqual(given, Buffer.from(row.otp_hash, 'hex'));
    await sb(`otp_codes?id=eq.${row.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(ok ? { used: true } : { attempts: (row.attempts || 0) + 1 }) });
    return res.status(200).json(ok ? { valid: true } : { valid: false, error: 'Incorrect or expired code. Please try again.' });
  } catch (err) {
    console.error('[Fixia OTP] verify-otp error:', err.message);
    return res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
};
