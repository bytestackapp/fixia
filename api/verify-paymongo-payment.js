/*
 * ═══════════════════════════════════════════════════════════════
 *  FIXIA — Service Marketplace
 *  /api/verify-paymongo-payment.js  —  Vercel Serverless Function
 *  © ByteStack Labs 2025. All Rights Reserved.
 *
 *  Called by: payment-success.html after PayMongo redirects back
 *
 *  Flow:
 *    1. PayMongo redirects to payment-success.html?method=paymongo
 *    2. payment-success.html calls this with { sessionId }
 *    3. This function checks the session payment status
 *    4. Returns { verified: true, transactionId, amount }
 * ═══════════════════════════════════════════════════════════════
 */

const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;
const PAYMONGO_BASE       = 'https://api.paymongo.com/v1';

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { sessionId } = req.body || {};

  if (!sessionId) {
    return res.status(400).json({ error: 'No session ID provided', verified: false });
  }

  try {
    const credentials = Buffer.from(`${PAYMONGO_SECRET_KEY}:`).toString('base64');

    const sessionRes = await fetch(`${PAYMONGO_BASE}/checkout_sessions/${sessionId}`, {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type':  'application/json',
      },
    });

    const session = await sessionRes.json();

    if (session.errors) {
      return res.status(400).json({ verified: false, error: session.errors[0]?.detail || 'Session fetch failed' });
    }

    const attrs         = session.data?.attributes;
    const paymentStatus = attrs?.payment_intent?.attributes?.status;
    const payments      = attrs?.payment_intent?.attributes?.payments || [];
    const payment       = payments[0];
    const transactionId = payment?.id || sessionId;
    const amount        = payment?.attributes?.amount
      ? (payment.attributes.amount / 100).toFixed(2)
      : '0.00';

    if (paymentStatus !== 'succeeded') {
      console.warn('[Fixia PayMongo] Payment status:', paymentStatus);
      return res.status(200).json({
        verified: false,
        error:    `Payment status: ${paymentStatus || 'unknown'}. Please try again.`,
      });
    }

    console.log(`[Fixia PayMongo] Verified: ${transactionId} — PHP ${amount}`);

    return res.status(200).json({
      verified:      true,
      transactionId,
      amount,
      currency:      'PHP',
      status:        paymentStatus,
    });

  } catch(err) {
    console.error('[Fixia PayMongo] verify-payment error:', err.message);
    return res.status(500).json({ error: err.message, verified: false });
  }
};