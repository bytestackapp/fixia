/* FIXIA — /api/create-paypal-checkout.js (fixed: isUpgrade was declared inside the request object = syntax error) */
const PAYPAL_CLIENT_ID     = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const APP_URL  = process.env.APP_URL || 'https://fixia.ph';
const SUPA_URL = process.env.SUPA_URL;
const SUPA_KEY = process.env.SUPA_KEY;
const PAYPAL_BASE = process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

async function getAccessToken() {
  const credentials = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get PayPal access token');
  return data.access_token;
}

async function getPackage(packageId) {
  const res = await fetch(`${SUPA_URL}/rest/v1/packages?id=eq.${encodeURIComponent(packageId)}&limit=1`, {
    headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
  const data = await res.json();
  return data && data.length ? data[0] : null;
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { package: packageId, type, processingFee = 0, userId } = req.body || {};
  if (!packageId) return res.status(400).json({ error: 'No package ID provided' });

  try {
    const pkg = await getPackage(packageId);
    if (!pkg)            return res.status(404).json({ error: `Package "${packageId}" not found` });
    if (!pkg.is_active)  return res.status(400).json({ error: 'This package is no longer available' });
    if (!pkg.price || pkg.price <= 0) return res.status(400).json({ error: 'This package is free — no payment needed' });

    const accessToken = await getAccessToken();
    const description = `Fixia ${pkg.name} — ${type === 'provider' ? 'Provider' : 'Regular User'} (${pkg.period})`;
    const fee         = Math.max(0, parseFloat(processingFee) || 0);
    const totalPrice  = (pkg.price + fee).toFixed(2);
    const isUpgrade   = !!userId;                       // ← moved out of the object literal

    const returnUrl = isUpgrade
      ? `${APP_URL}/payment-success.html?method=paypal&source=upgrade&userId=${encodeURIComponent(userId)}&packageId=${encodeURIComponent(packageId)}`
      : `${APP_URL}/payment-success.html?method=paypal&type=${type || 'regular'}`;
    const cancelUrl = isUpgrade
      ? `${APP_URL}/profile.html?tab=plan&cancelled=1`
      : type === 'provider' ? `${APP_URL}/signup-provider.html?cancelled=1&step=6`
                            : `${APP_URL}/signup-regular.html?cancelled=1&step=4`;

    const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: { currency_code: 'PHP', value: totalPrice, breakdown: {
            item_total: { currency_code: 'PHP', value: pkg.price.toFixed(2) },
            handling:   { currency_code: 'PHP', value: fee.toFixed(2) } } },
          items: [{ name: `Fixia ${pkg.name}`, description, unit_amount: { currency_code: 'PHP', value: pkg.price.toFixed(2) }, quantity: '1', category: 'DIGITAL_GOODS' }],
          description,
        }],
        application_context: { brand_name: 'Fixia', landing_page: 'BILLING', user_action: 'PAY_NOW', return_url: returnUrl, cancel_url: cancelUrl },
      }),
    });
    const order = await orderRes.json();
    if (!order.id) { console.error('[Fixia PayPal] Order creation failed:', JSON.stringify(order)); return res.status(500).json({ error: 'Failed to create PayPal order' }); }
    const approvalUrl = order.links?.find(l => l.rel === 'approve')?.href;
    if (!approvalUrl) return res.status(500).json({ error: 'No approval URL in PayPal response' });

    return res.status(200).json({ orderId: order.id, approvalUrl, url: approvalUrl, packageName: pkg.name, amount: totalPrice });
  } catch (err) {
    console.error('[Fixia PayPal] create-checkout error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
