/* FIXIA — /api/payments.js
   merged: create-paypal-checkout, create-paymongo-checkout,
           verify-paypal-payment, verify-paymongo-payment */
const PAYPAL_CLIENT_ID     = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYMONGO_SECRET_KEY  = process.env.PAYMONGO_SECRET_KEY;
const APP_URL  = process.env.APP_URL || 'https://fixia.ph';
const SUPA_URL = process.env.SUPA_URL;
const SUPA_KEY = process.env.SUPA_KEY;
const PAYPAL_BASE   = process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
const PAYMONGO_BASE = 'https://api.paymongo.com/v1';

/* ── shared helpers ─────────────────────────────────────────── */
async function paypalToken() {
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

/* ── create PayPal checkout ─────────────────────────────────── */
async function createPaypal(req, res) {
  const { package: packageId, type, processingFee = 0, userId } = req.body || {};
  if (!packageId) return res.status(400).json({ error: 'No package ID provided' });
  try {
    const pkg = await getPackage(packageId);
    if (!pkg)           return res.status(404).json({ error: `Package "${packageId}" not found` });
    if (!pkg.is_active) return res.status(400).json({ error: 'This package is no longer available' });
    if (!pkg.price || pkg.price <= 0) return res.status(400).json({ error: 'This package is free — no payment needed' });

    const accessToken = await paypalToken();
    const description = `Fixia ${pkg.name} — ${type === 'provider' ? 'Provider' : 'Regular User'} (${pkg.period})`;
    const fee         = Math.max(0, parseFloat(processingFee) || 0);
    const totalPrice  = (pkg.price + fee).toFixed(2);
    const isUpgrade   = !!userId;

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
    if (!order.id) {
      console.error('[Fixia PayPal] Order creation failed:', JSON.stringify(order));
      return res.status(500).json({ error: 'Failed to create PayPal order' });
    }
    const approvalUrl = order.links?.find(l => l.rel === 'approve')?.href;
    if (!approvalUrl) return res.status(500).json({ error: 'No approval URL in PayPal response' });
    return res.status(200).json({ orderId: order.id, approvalUrl, url: approvalUrl, packageName: pkg.name, amount: totalPrice });
  } catch (err) {
    console.error('[Fixia PayPal] create error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

/* ── create PayMongo checkout ───────────────────────────────── */
async function createPaymongo(req, res) {
  const { package: packageId, type, processingFee = 0 } = req.body || {};
  if (!packageId)           return res.status(400).json({ error: 'No package ID provided' });
  if (!PAYMONGO_SECRET_KEY) return res.status(500).json({ error: 'PayMongo secret key not configured' });
  try {
    const pkg = await getPackage(packageId);
    if (!pkg)           return res.status(404).json({ error: `Package "${packageId}" not found` });
    if (!pkg.is_active) return res.status(400).json({ error: 'This package is no longer available' });
    if (!pkg.price || pkg.price <= 0) return res.status(400).json({ error: 'This package is free — no payment needed' });

    const fee              = Math.max(0, parseFloat(processingFee) || 0);
    const totalPrice       = pkg.price + fee;
    const amountInCentavos = Math.round(totalPrice * 100);
    const description      = `Fixia ${pkg.name} — ${type === 'provider' ? 'Provider' : 'Regular User'} (${pkg.period})`;
    const credentials      = Buffer.from(`${PAYMONGO_SECRET_KEY}:`).toString('base64');

    const sessionRes = await fetch(`${PAYMONGO_BASE}/checkout_sessions`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { attributes: {
        billing: { name: 'Fixia Customer', email: '' },
        send_email_receipt: true, show_description: true, show_line_items: true,
        line_items: [{ currency: 'PHP', amount: amountInCentavos, description, name: `Fixia ${pkg.name}`, quantity: 1 }],
        payment_method_types: ['card', 'gcash', 'maya', 'grab_pay'],
        success_url: `${APP_URL}/payment-success.html?method=paymongo&type=${type || 'regular'}`,
        cancel_url:  type === 'provider'
          ? `${APP_URL}/signup-provider.html?cancelled=1&step=6`
          : `${APP_URL}/signup-regular.html?cancelled=1&step=4`,
        description,
        metadata: { packageId, packageName: pkg.name, userType: type || 'regular' },
      } } }),
    });
    const session = await sessionRes.json();
    if (session.errors) {
      console.error('[Fixia PayMongo] Session error:', JSON.stringify(session.errors));
      return res.status(500).json({ error: session.errors[0]?.detail || 'PayMongo error' });
    }
    const checkoutUrl = session.data?.attributes?.checkout_url;
    if (!checkoutUrl) return res.status(500).json({ error: 'No checkout URL returned from PayMongo' });
    return res.status(200).json({ sessionId: session.data?.id, checkoutUrl, packageName: pkg.name, amount: totalPrice.toFixed(2) });
  } catch (err) {
    console.error('[Fixia PayMongo] create error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

/* ── verify (capture) PayPal order ──────────────────────────── */
async function verifyPaypal(req, res) {
  const { orderId, token } = req.body || {};
  const idToCapture = orderId || token;
  if (!idToCapture) return res.status(400).json({ error: 'No order ID provided', verified: false });
  try {
    const accessToken = await paypalToken();
    const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${idToCapture}/capture`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });
    const capture = await captureRes.json();
    if (capture.status !== 'COMPLETED') {
      console.warn('[Fixia PayPal] Capture status:', capture.status, JSON.stringify(capture));
      return res.status(200).json({ verified: false, error: `Payment status: ${capture.status}. Please try again.` });
    }
    const cap = capture.purchase_units?.[0]?.payments?.captures?.[0];
    return res.status(200).json({
      verified: true,
      transactionId: cap?.id || idToCapture,
      amount:   cap?.amount?.value || '0.00',
      currency: cap?.amount?.currency_code || 'USD',
      status:   capture.status,
    });
  } catch (err) {
    console.error('[Fixia PayPal] verify error:', err.message);
    return res.status(500).json({ error: err.message, verified: false });
  }
}

/* ── verify PayMongo session ────────────────────────────────── */
async function verifyPaymongo(req, res) {
  const { sessionId } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'No session ID provided', verified: false });
  try {
    const credentials = Buffer.from(`${PAYMONGO_SECRET_KEY}:`).toString('base64');
    const sessionRes  = await fetch(`${PAYMONGO_BASE}/checkout_sessions/${sessionId}`, {
      headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/json' },
    });
    const session = await sessionRes.json();
    if (session.errors) {
      return res.status(400).json({ verified: false, error: session.errors[0]?.detail || 'Session fetch failed' });
    }
    const pi      = session.data?.attributes?.payment_intent?.attributes;
    const payment = (pi?.payments || [])[0];
    if (pi?.status !== 'succeeded') {
      return res.status(200).json({ verified: false, error: `Payment status: ${pi?.status || 'unknown'}. Please try again.` });
    }
    return res.status(200).json({
      verified: true,
      transactionId: payment?.id || sessionId,
      amount: payment?.attributes?.amount ? (payment.attributes.amount / 100).toFixed(2) : '0.00',
      currency: 'PHP',
      status: pi.status,
    });
  } catch (err) {
    console.error('[Fixia PayMongo] verify error:', err.message);
    return res.status(500).json({ error: err.message, verified: false });
  }
}

/* ── dispatcher ─────────────────────────────────────────────── */
const handlers = {
  'create-paypal':   createPaypal,
  'create-paymongo': createPaymongo,
  'verify-paypal':   verifyPaypal,
  'verify-paymongo': verifyPaymongo,
};

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });
  const handler = handlers[req.query.action];
  if (!handler) return res.status(400).json({ error: 'Unknown action.' });
  return handler(req, res);
};