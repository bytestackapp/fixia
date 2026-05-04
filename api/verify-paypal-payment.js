/*
 * ═══════════════════════════════════════════════════════════════
 *  FIXIA — Service Marketplace
 *  /api/verify-paypal-payment.js  —  Vercel Serverless Function
 *  © ByteStack Labs 2025. All Rights Reserved.
 *
 *  Called by: payment-success.html after PayPal redirects back
 *
 *  Flow:
 *    1. PayPal redirects to payment-success.html?token=ORDER_ID
 *    2. payment-success.html calls this endpoint with { orderId, token }
 *    3. This function captures the PayPal order (charges the buyer)
 *    4. Returns { verified: true, transactionId, amount }
 *    5. payment-success.html then calls FX.registerRegular/Provider
 * ═══════════════════════════════════════════════════════════════
 */

const PAYPAL_CLIENT_ID     = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

const PAYPAL_BASE = process.env.PAYPAL_ENV === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

/* ── Get PayPal access token ─────────────────────────────────── */
async function getAccessToken() {
  const credentials = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get PayPal access token');
  return data.access_token;
}

/* ── Handler ─────────────────────────────────────────────────── */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { orderId, token } = req.body || {};
  const idToCapture = orderId || token;

  if (!idToCapture) {
    return res.status(400).json({ error: 'No order ID provided', verified: false });
  }

  try {
    const accessToken = await getAccessToken();

    // Capture the order — this is what actually charges the buyer
    const captureRes = await fetch(
      `${PAYPAL_BASE}/v2/checkout/orders/${idToCapture}/capture`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type':  'application/json',
        },
      }
    );

    const capture = await captureRes.json();

    // Verify capture completed
    if (capture.status !== 'COMPLETED') {
      console.warn('[Fixia PayPal] Capture status:', capture.status, JSON.stringify(capture));
      return res.status(200).json({
        verified: false,
        error:    `Payment status: ${capture.status}. Please try again.`,
      });
    }

    // Extract transaction details
    const unit          = capture.purchase_units?.[0];
    const captureDetail = unit?.payments?.captures?.[0];
    const transactionId = captureDetail?.id || idToCapture;
    const amount        = captureDetail?.amount?.value || '0.00';
    const currency      = captureDetail?.amount?.currency_code || 'USD';

    console.log(`[Fixia PayPal] Captured: ${transactionId} — ${currency} ${amount}`);

    return res.status(200).json({
      verified:      true,
      transactionId,
      amount,
      currency,
      status:        capture.status,
    });

  } catch(err) {
    console.error('[Fixia PayPal] verify-payment error:', err.message);
    return res.status(500).json({ error: err.message, verified: false });
  }
};
