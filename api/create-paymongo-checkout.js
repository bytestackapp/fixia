/*
 * ═══════════════════════════════════════════════════════════════
 *  FIXIA — Service Marketplace
 *  /api/create-paymongo-checkout.js  —  Vercel Serverless Function
 *  © ByteStack Labs 2025. All Rights Reserved.
 *
 *  Called by:
 *    signup-regular.html   → when user selects PayMongo
 *    signup-provider.html  → when provider selects PayMongo
 *
 *  Flow:
 *    1. Client sends { package: 'plus', type: 'regular' }
 *    2. This function fetches package price from Supabase
 *    3. Creates a PayMongo checkout session and returns checkoutUrl
 *    4. Client redirects user to PayMongo hosted page
 *    5. PayMongo redirects back to /public/payment-success.html
 * ═══════════════════════════════════════════════════════════════
 */

const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;
const APP_URL             = process.env.APP_URL || 'https://fixia.ph';
const SUPA_URL            = process.env.SUPA_URL;
const SUPA_KEY            = process.env.SUPA_KEY;

const PAYMONGO_BASE = 'https://api.paymongo.com/v1';

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

  if (!PAYMONGO_SECRET_KEY) {
    return res.status(500).json({ error: 'PayMongo secret key not configured' });
  }

  try {
    // Fetch live package data from Supabase
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

    // PayMongo amounts are in centavos (PHP x 100)
    const fee              = Math.max(0, parseFloat(processingFee) || 0);
    const totalPrice       = pkg.price + fee;
    const amountInCentavos = Math.round(totalPrice * 100);
    const userTypeLabel    = type === 'provider' ? 'Provider' : 'Regular User';
    const description      = `Fixia ${pkg.name} — ${userTypeLabel} (${pkg.period})`;

    const credentials = Buffer.from(`${PAYMONGO_SECRET_KEY}:`).toString('base64');

    // Create PayMongo checkout session
    const sessionRes = await fetch(`${PAYMONGO_BASE}/checkout_sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        data: {
          attributes: {
            billing: {
              name:  'Fixia Customer',
              email: '',
            },
            send_email_receipt: true,
            show_description:   true,
            show_line_items:    true,
            line_items: [
              {
                currency:    'PHP',
                amount:      amountInCentavos,
                description: description,
                name:        `Fixia ${pkg.name}`,
                quantity:    1,
              },
            ],
            payment_method_types: [
              'card',
              'gcash',
              'maya',
              'grab_pay',
            ],
            success_url: `${APP_URL}/payment-success.html?method=paymongo&type=${type || 'regular'}`,
            cancel_url:  type === 'provider'
              ? `${APP_URL}/signup-provider.html?cancelled=1&step=6`
              : `${APP_URL}/signup-regular.html?cancelled=1&step=4`,
            description,
            metadata: {
              packageId,
              packageName: pkg.name,
              userType:    type || 'regular',
            },
          },
        },
      }),
    });

    const session = await sessionRes.json();

    if (session.errors) {
      console.error('[Fixia PayMongo] Session error:', JSON.stringify(session.errors));
      return res.status(500).json({ error: session.errors[0]?.detail || 'PayMongo error' });
    }

    const checkoutUrl = session.data?.attributes?.checkout_url;
    const sessionId   = session.data?.id;

    if (!checkoutUrl) {
      return res.status(500).json({ error: 'No checkout URL returned from PayMongo' });
    }

    console.log(`[Fixia PayMongo] Session created: ${sessionId} | Package: ${packageId} | Type: ${type}`);

    return res.status(200).json({
      sessionId,
      checkoutUrl,
      packageName: pkg.name,
      amount:      totalPrice.toFixed(2),
    });

  } catch(err) {
    console.error('[Fixia PayMongo] create-checkout error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};