/* Receives "payment done" messages from PayPal and PayMongo, so a sign-up is finished even if the person closed the browser.
   Nothing here is trusted: finishing a sign-up re-asks the processor whether the money really arrived. */
import { signupFinishByRef } from './_lib/actions/payments.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const ev = req.body || {};
  let ref = null;
  if (ev.event_type) {                                   // PayPal
    const r = ev.resource || {};
    if (ev.event_type === 'CHECKOUT.ORDER.APPROVED') ref = r.id;
    else if (ev.event_type === 'PAYMENT.CAPTURE.COMPLETED') ref = r.supplementary_data?.related_ids?.order_id;
  } else {                                               // PayMongo
    const a = ev.data?.attributes;
    if (a?.type === 'checkout_session.payment.paid') ref = a.data?.id;
  }
  try {
    if (ref) await signupFinishByRef(ref);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[webhook]', ref, e.message);
    const retry = !e.status || e.status === 400 || e.status >= 500;   // 500 makes the processor try again later
    return res.status(retry ? 500 : 200).json({ ok: false });
  }
}