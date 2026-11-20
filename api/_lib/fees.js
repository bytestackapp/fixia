import { sb } from './db.js';
import { httpError } from './auth.js';

let cache = { t: 0, v: [] };

// PayPal is always "paypal". PayMongo methods are "paymongo_gcash", "paymongo_maya", ...
export const methodKey = (r) => (r.medium === 'paypal' ? 'paypal' : `${r.medium}_${r.provider}`);
export const PM_TYPE = { gcash: 'gcash', maya: 'paymaya', qrph: 'qrph', card: 'card', grab: 'grab_pay' };

export async function feeRows() {
  if (Date.now() - cache.t < 30_000) return cache.v;
  const rows = (await sb('processing_fees?select=*&order=medium.asc,provider.asc')) || [];
  cache = { t: Date.now(), v: rows };
  return rows;
}
export const resetFees = () => { cache.t = 0; };

export async function feeFor(method) {
  const row = (await feeRows()).find((r) => r.is_active && methodKey(r) === method);
  if (!row) throw httpError(400, 'This payment method is not available right now.');
  return row;
}

const r2 = (n) => Math.round(n * 100) / 100;

// The customer pays enough that you receive exactly the plan price after the fee and the VAT on the fee.
export function calcFee(price, row) {
  const p = Number(price) || 0;
  if (!row || p <= 0) return { fee: 0, vat: 0, total: p };
  const r = Number(row.rate) / 100, f = Number(row.fixed) || 0, v = (Number(row.vat) || 0) / 100;
  const total = Math.ceil(((p + f * (1 + v)) / (1 - r * (1 + v))) * 100 - 1e-9) / 100;
  const fee = r2(r * total + f);
  return { fee, vat: r2(total - p - fee), total };
}