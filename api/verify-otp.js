/*
 * ═══════════════════════════════════════════════════════════════
 *  FIXIA — Service Marketplace
 *  /api/verify-otp.js  —  Vercel Serverless Function
 *  © ByteStack Labs 2025. All Rights Reserved.
 *
 *  Verifies OTP by comparing hash server-side.
 *  Marks OTP as used on success so it cannot be replayed.
 * ═══════════════════════════════════════════════════════════════
 */

const SUPA_URL = process.env.SUPA_URL;
const SUPA_KEY = process.env.SUPA_KEY;

async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      'apikey':        SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, otp } = req.body || {};
  if (!email || !otp) return res.status(400).json({ error: 'Missing fields.' });

  try {
    const hash = require('crypto').createHash('sha256').update(otp.trim()).digest('hex');
    const now  = new Date().toISOString();

    const rows = await sbFetch(
      `otp_codes?email=eq.${encodeURIComponent(email.trim().toLowerCase())}` +
      `&otp_hash=eq.${hash}&used=eq.false&expires_at=gt.${now}&limit=1`
    );

    if (!rows || !rows.length) {
      return res.status(200).json({ valid: false, error: 'Incorrect or expired code. Please try again.' });
    }

    // Mark as used — prevents replay attacks
    await sbFetch(`otp_codes?id=eq.${rows[0].id}`, {
      method:  'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body:    JSON.stringify({ used: true }),
    });

    return res.status(200).json({ valid: true });

  } catch (err) {
    console.error('[Fixia OTP] verify-otp error:', err.message);
    return res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
};