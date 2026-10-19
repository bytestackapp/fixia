/*
 * ═══════════════════════════════════════════════════════════════
 *  FIXIA — Service Marketplace
 *  /api/send-otp.js  —  Vercel Serverless Function
 *  © ByteStack Labs 2025. All Rights Reserved.
 *
 *  Generates a cryptographically secure OTP server-side,
 *  stores it in Supabase (otp_codes table), and emails it.
 *  The OTP value never touches the client.
 * ═══════════════════════════════════════════════════════════════
 */

const SUPA_URL = process.env.SUPA_URL;
const SUPA_KEY = process.env.SUPA_KEY;
const APP_URL  = process.env.APP_URL || 'https://fixia.ph';

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

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Missing email.' });

  try {
    // Check if OTP feature is enabled
    const settings = await sbFetch('app_settings?key=in.(otp_enabled,otp_test_code)&select=key,value');
    const settingMap = Object.fromEntries((settings || []).map(s => [s.key, s.value]));
    const otpEnabled = settingMap['otp_enabled'] === 'true';
    const testCode   = settingMap['otp_test_code'];

    // Generate OTP — test code takes priority if set and valid
    const otp = (testCode && testCode.length === 6)
      ? testCode
      : (() => {
          const arr = new Uint32Array(1);
          // Node.js crypto
          require('crypto').randomFillSync(arr);
          return String(100000 + (arr[0] % 900000));
        })();

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    // Rate limit — prevent OTP email spam (max 1 per 60 seconds)
    const recent = await sbFetch(
      `otp_codes?email=eq.${encodeURIComponent(email.trim().toLowerCase())}&created_at=gt.${new Date(Date.now() - 60000).toISOString()}&limit=1`
    );
    if (recent && recent.length) {
      return res.status(429).json({ error: 'Please wait at least 60 seconds before requesting another code.' });
    }

    // Delete any existing unused OTPs for this email first
    await sbFetch(`otp_codes?email=eq.${encodeURIComponent(email.trim().toLowerCase())}&used=eq.false`, {
      method:  'DELETE',
      headers: { 'Prefer': 'return=minimal' },
    });

    // Store OTP server-side — never sent to client
    await sbFetch('otp_codes', {
      method: 'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        email:      email.trim().toLowerCase(),
        otp_hash:   require('crypto').createHash('sha256').update(otp).digest('hex'),
        expires_at: expiresAt,
        used:       false,
      }),
    });

    // Send email only if OTP is enabled and no test code override
    if (otpEnabled && (!testCode || testCode.length !== 6)) {
      await fetch(`${APP_URL}/api/send-email`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type: 'email_otp', data: { email, otp } }),
      });
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('[Fixia OTP] send-otp error:', err.message);
    return res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
  }
};