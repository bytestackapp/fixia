/*
 * ═══════════════════════════════════════════════════════════════
 *  FIXIA — Service Marketplace
 *  /api/create-paypal-checkout.js  —  Vercel Serverless Function
 *  © ByteStack Labs 2025. All Rights Reserved.
 *
 *  Called by:
 *    signup-regular.html   → when user selects PayPal for Plus plan
 *    signup-provider.html  → when provider selects PayPal for any plan
 *
 *  Flow:
 *    1. Client sends { package: 'pro', type: 'provider' }
 *    2. This function fetches package price from Supabase
 *    3. Creates a PayPal order and returns approvalUrl
 *    4. Client redirects user to PayPal
 *    5. PayPal redirects back to /public/payment-success.html
 * ═══════════════════════════════════════════════════════════════
 */

const PAYPAL_CLIENT_ID     = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const APP_URL              = process.env.APP_URL || 'https://fixia.ph';
const SUPA_URL             = process.env.SUPA_URL;
const SUPA_KEY             = process.env.SUPA_KEY;

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

/* ── Fetch package details from Supabase ─────────────────────── */
async function getPackage(packageId) {
  const res = await fetch(
    `${SUPA_URL}/rest/v1/packages?id=eq.${encodeURIComponent(packageId)}&limit=1`,
    {
      headers: {
        'apikey':        SUPA_KEY,
        'Authorization': `Bearer ${SUPA_KEY}`,
        'Content-Type':  'application/json',
      },
    }
  );
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
  const data = await res.json();
  return data && data.length ? data[0] : null;
}

/* ── Handler ─────────────────────────────────────────────────── */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { package: packageId, type, processingFee = 0 } = req.body || {};

  if (!packageId) {
    return res.status(400).json({ error: 'No package ID provided' });
  }

  try {
    // Fetch live package data from Supabase (price is never hardcoded)
    const pkg = await getPackage(packageId);
    if (!pkg) {
      return res.status(404).json({ error: `Package "${packageId}" not found` });
    }
    if (!pkg.is_active) {
      return res.status(400).json({ error: 'This package is no longer available' });
    }
    if (!pkg.price || pkg.price <= 0) {
      return res.status(400).json({ error: 'This package is free — no payment needed' });
    }

    const accessToken = await getAccessToken();

    // Build description
    const userTypeLabel = type === 'provider' ? 'Provider' : 'Regular User';
    const description   = `Fixia ${pkg.name} — ${userTypeLabel} (${pkg.period})`;

    // Apply processing fee
    const fee        = Math.max(0, parseFloat(processingFee) || 0);
    const totalPrice = (pkg.price + fee).toFixed(2);

    // Create PayPal order
    const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'PHP',
            value: totalPrice,
            breakdown: {
              item_total:     { currency_code: 'PHP', value: pkg.price.toFixed(2) },
              handling:       { currency_code: 'PHP', value: fee.toFixed(2) },
            },
          },
          items: [{
            name:        `Fixia ${pkg.name}`,
            description: description,
            unit_amount: { currency_code: 'PHP', value: pkg.price.toFixed(2) },
            quantity:    '1',
            category:    'DIGITAL_GOODS',
          }],
          description,
        }],
        application_context: {
          brand_name:  'Fixia',
          landing_page:'BILLING',
          user_action: 'PAY_NOW',
          return_url:  `${APP_URL}/payment-success.html?method=paypal&type=${type || 'regular'}`,
          cancel_url:  type === 'provider'
            ? `${APP_URL}/signup-provider.html?cancelled=1&step=6`
            : `${APP_URL}/signup-regular.html?cancelled=1&step=4`,
        },
      }),
    });

    const order = await orderRes.json();

    if (!order.id) {
      console.error('[Fixia PayPal] Order creation failed:', JSON.stringify(order));
      return res.status(500).json({ error: 'Failed to create PayPal order' });
    }

    const approvalUrl = order.links?.find(l => l.rel === 'approve')?.href;
    if (!approvalUrl) {
      return res.status(500).json({ error: 'No approval URL in PayPal response' });
    }

    console.log(`[Fixia PayPal] Order created: ${order.id} | Package: ${packageId} | Type: ${type} | Total: ${totalPrice}`);

    return res.status(200).json({
      orderId:     order.id,
      approvalUrl,
      packageName: pkg.name,
      amount:      totalPrice,
    });

  } catch(err) {
    console.error('[Fixia PayPal] create-checkout error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
