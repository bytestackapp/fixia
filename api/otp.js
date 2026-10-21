/* FIXIA — /api/otp.js  (merged send-otp + verify-otp) */
const crypto   = require('crypto');
const SUPA_URL = process.env.SUPA_URL;
const SUPA_KEY = process.env.SUPA_KEY;
const APP_URL  = process.env.APP_URL || 'https://fixia.ph';

async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json', 'Prefer': 'return=representation',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function sendOtp(req, res) {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Missing email.' });
  try {
    const settings   = await sbFetch('app_settings?key=in.(otp_enabled,otp_test_code)&select=key,value');
    const settingMap = Object.fromEntries((settings || []).map(s => [s.key, s.value]));
    const otpEnabled = settingMap['otp_enabled'] === 'true';
    const testCode   = settingMap['otp_test_code'];

    const otp = (testCode && testCode.length === 6)
      ? testCode
      : String(100000 + (crypto.randomBytes(4).readUInt32BE() % 900000));

    const mail = email.trim().toLowerCase();
    const recent = await sbFetch(
      `otp_codes?email=eq.${encodeURIComponent(mail)}&created_at=gt.${new Date(Date.now() - 60000).toISOString()}&limit=1`
    );
    if (recent && recent.length) {
      return res.status(429).json({ error: 'Please wait at least 60 seconds before requesting another code.' });
    }

    await sbFetch(`otp_codes?email=eq.${encodeURIComponent(mail)}&used=eq.false`, {
      method: 'DELETE', headers: { 'Prefer': 'return=minimal' },
    });
    await sbFetch('otp_codes', {
      method: 'POST', headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        email: mail,
        otp_hash: crypto.createHash('sha256').update(otp).digest('hex'),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        used: false,
      }),
    });

    if (otpEnabled && (!testCode || testCode.length !== 6)) {
      await fetch(`${APP_URL}/api/send-email`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'email_otp', data: { email, otp } }),
      });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[Fixia OTP] send error:', err.message);
    return res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
  }
}

async function verifyOtp(req, res) {
  const { email, otp } = req.body || {};
  if (!email || !otp) return res.status(400).json({ error: 'Missing fields.' });
  try {
    const hash = crypto.createHash('sha256').update(otp.trim()).digest('hex');
    const rows = await sbFetch(
      `otp_codes?email=eq.${encodeURIComponent(email.trim().toLowerCase())}` +
      `&otp_hash=eq.${hash}&used=eq.false&expires_at=gt.${new Date().toISOString()}&limit=1`
    );
    if (!rows || !rows.length) {
      return res.status(200).json({ valid: false, error: 'Incorrect or expired code. Please try again.' });
    }
    await sbFetch(`otp_codes?id=eq.${rows[0].id}`, {
      method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({ used: true }),
    });
    return res.status(200).json({ valid: true });
  } catch (err) {
    console.error('[Fixia OTP] verify error:', err.message);
    return res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const action = req.query.action;
  if (action === 'send')   return sendOtp(req, res);
  if (action === 'verify') return verifyOtp(req, res);
  return res.status(400).json({ error: 'Unknown action.' });
};