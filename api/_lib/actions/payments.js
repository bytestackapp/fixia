/* Card / wallet payments. The browser only asks for a checkout link and later says "I came back";
   the server then asks PayPal / PayMongo whether the money arrived, and for THIS user and THIS plan. */
import { sb, q } from '../db.js';
import { httpError } from '../auth.js';
import { getPackage, calcUpgrade, applyPackage, PERIOD_DAYS } from '../packages.js';
import { credit } from '../referral.js';
import { mail } from '../mail.js';

const APP = () => process.env.APP_URL || 'https://gofixia.vercel.app';
const PAYPAL = () => (process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com');
const PM = 'https://api.paymongo.com/v1';
const FEES = { paypal: [0.044, 15], paymongo: [0.029, 0] };      // percent, fixed pesos
const fee = (m, price) => Math.ceil(price * FEES[m][0] + FEES[m][1]);
const basic = (user, pass = '') => `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const typeOf = (user) => (user.role === 'provider' ? 'provider' : 'regular');

async function paypalToken() {
  const r = await (await fetch(`${PAYPAL()}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: basic(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' })).json();
  if (!r.access_token) throw httpError(502, 'PayPal is unavailable right now.');
  return r.access_token;
}

export async function checkout(user, { packageId, method }) {
  if (!FEES[method]) throw httpError(400, 'Unknown payment method.');
  const pkg = await getPackage(packageId);
  if (!pkg || !pkg.is_active || pkg.price <= 0 || pkg.type !== typeOf(user)) throw httpError(400, 'Choose a paid plan for your account type.');
  const u = (await sb(`users?id=eq.${q(user.id)}&select=package_id,payment_status&limit=1`))?.[0];
  const cur = await getPackage(u.package_id);
  const finishing = user.role === 'provider' && u.payment_status === 'awaiting' && u.package_id === pkg.id;
  if (!finishing && pkg.price <= (cur?.price || 0)) throw httpError(400, 'Choose a plan higher than your current one.');

  const total = pkg.price + fee(method, pkg.price);
  const back = `${APP()}/payment/return?method=${method}&pkg=${encodeURIComponent(pkg.id)}`;
  const cancel = `${APP()}/checkout/${encodeURIComponent(pkg.id)}?cancelled=1`;

  if (method === 'paypal') {
    const order = await (await fetch(`${PAYPAL()}/v2/checkout/orders`, {
      method: 'POST', headers: { Authorization: `Bearer ${await paypalToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ custom_id: `${user.id}|${pkg.id}`, description: `Fixia ${pkg.name}`, amount: { currency_code: 'PHP', value: total.toFixed(2) } }], application_context: { brand_name: 'Fixia', user_action: 'PAY_NOW', return_url: back, cancel_url: cancel } }),
    })).json();
    const url = order.links?.find((l) => l.rel === 'approve')?.href;
    if (!url) { console.error('[paypal]', JSON.stringify(order)); throw httpError(502, 'Could not start PayPal checkout.'); }
    return { url };
  }
  const s = await (await fetch(`${PM}/checkout_sessions`, {
    method: 'POST', headers: { Authorization: basic(process.env.PAYMONGO_SECRET_KEY), 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { attributes: { send_email_receipt: true, show_line_items: true, payment_method_types: ['card', 'gcash', 'maya', 'grab_pay'], line_items: [{ currency: 'PHP', amount: Math.round(total * 100), name: `Fixia ${pkg.name}`, quantity: 1 }], success_url: back, cancel_url: cancel, description: `Fixia ${pkg.name}`, metadata: { userId: user.id, packageId: pkg.id } } } }),
  })).json();
  const url = s.data?.attributes?.checkout_url;
  if (!url) { console.error('[paymongo]', JSON.stringify(s.errors || s)); throw httpError(502, 'Could not start PayMongo checkout.'); }
  return { url, ref: s.data.id };
}

// Asks the processor what really happened. Returns { txn, amount } or throws.
async function confirmed(method, ref, user, pkg) {
  if (method === 'paypal') {
    const h = { Authorization: `Bearer ${await paypalToken()}`, 'Content-Type': 'application/json' };
    const id = encodeURIComponent(ref);
    let order = await (await fetch(`${PAYPAL()}/v2/checkout/orders/${id}/capture`, { method: 'POST', headers: h })).json();
    if (order.status !== 'COMPLETED') order = await (await fetch(`${PAYPAL()}/v2/checkout/orders/${id}`, { headers: h })).json();   // refresh: already captured
    if (order.status !== 'COMPLETED') throw httpError(400, 'PayPal has not completed this payment.');
    const unit = order.purchase_units?.[0], cap = unit?.payments?.captures?.[0];
    if (unit?.custom_id !== `${user.id}|${pkg.id}`) throw httpError(403, 'This payment belongs to a different account or plan.');
    return { txn: cap?.id || ref, amount: Number(cap?.amount?.value || 0) };
  }
  const s = await (await fetch(`${PM}/checkout_sessions/${encodeURIComponent(ref)}`, { headers: { Authorization: basic(process.env.PAYMONGO_SECRET_KEY) } })).json();
  const pi = s.data?.attributes?.payment_intent?.attributes, pay = pi?.payments?.[0];
  if (pi?.status !== 'succeeded') throw httpError(400, 'PayMongo has not completed this payment.');
  const meta = s.data.attributes.metadata || {};
  if (meta.userId !== user.id || meta.packageId !== pkg.id) throw httpError(403, 'This payment belongs to a different account or plan.');
  return { txn: pay?.id || ref, amount: (pay?.attributes?.amount || 0) / 100 };
}

export async function verify(user, { method, ref, packageId }) {
  if (!FEES[method] || !ref) throw httpError(400, 'Missing payment details.');
  const pkg = await getPackage(packageId);
  if (!pkg || pkg.type !== typeOf(user)) throw httpError(400, 'Plan not found.');
  const { txn, amount } = await confirmed(method, ref, user, pkg);
  if (amount < pkg.price) throw httpError(400, 'The amount paid does not cover this plan.');

  const used = await sb(`users?payment_reference=eq.${q(txn)}&select=id&limit=1`);
  if (used?.length) { if (used[0].id === user.id) return { plan: pkg.name, already: true }; throw httpError(409, 'This payment was already used.'); }

  const u = (await sb(`users?id=eq.${q(user.id)}&select=*&limit=1`))?.[0];
  const cur = await getPackage(u.package_id);
  const finishing = user.role === 'provider' && u.payment_status === 'awaiting' && u.package_id === pkg.id;
  if (!finishing && pkg.price <= (cur?.price || 0)) throw httpError(400, 'This plan is not an upgrade.');
  const days = finishing ? PERIOD_DAYS[pkg.period] ?? null : calcUpgrade(u, cur, pkg).totalDays;
  await applyPackage(u, pkg, days, { payment_method: method, payment_reference: txn, payment_amount: String(amount), payment_status: 'verified' });
  if (user.role === 'regular') await credit(user.id, 3).catch(() => {});
  mail('payment_notify', { fullName: `${u.first_name} ${u.last_name}`, email: u.email, package: pkg.name, method, reference: txn, amount: `₱${amount}`, verified: true });
  return { plan: pkg.name, txn, amount };
}
