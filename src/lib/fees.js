import { useQuery } from '@tanstack/react-query';
import { api } from './api.js';

export const MEDIA = { paypal: 'PayPal', paymongo: 'PayMongo' };
export const PROVIDERS = { paypal: 'PayPal', gcash: 'GCash', maya: 'Maya', qrph: 'QR Ph', card: 'Cards', grab: 'GrabPay' };
export const PROVIDERS_OF = { paypal: ['paypal'], paymongo: ['gcash', 'maya', 'qrph', 'card', 'grab'] };
export const MANUAL = [['gcash', 'GCash'], ['maya', 'Maya'], ['bank', 'Bank']];

export const useFees = () => useQuery({ queryKey: ['fees'], queryFn: () => api('auth', { action: 'fees.public' }), staleTime: 60_000 });

export const money = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const r2 = (n) => Math.round(n * 100) / 100;
// Same formula as the server: the customer pays enough that you receive exactly the plan price.
export function calcFee(price, row) {
  const p = Number(price) || 0;
  if (!row || p <= 0) return { fee: 0, vat: 0, total: p };
  const r = Number(row.rate) / 100, f = Number(row.fixed) || 0, v = (Number(row.vat) || 0) / 100;
  const total = Math.ceil(((p + f * (1 + v)) / (1 - r * (1 + v))) * 100 - 1e-9) / 100;
  const fee = r2(r * total + f);
  return { fee, vat: r2(total - p - fee), total };
}