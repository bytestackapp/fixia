import { sb, q } from './db.js';
import { settings } from './settings.js';

export const PERIOD_DAYS = { month: 30, '3month': 90, '6month': 180, year: 365, lifetime: null };
export const FREE = { regular: 'regular-free', provider: 'provider-free' };
const DAY = 86400000, PH = 8 * 3600000;
// Midnight in Manila (+ n days), as an ISO timestamp.
export const phMidnight = (n = 0) => new Date(Math.floor((Date.now() + PH) / DAY) * DAY - PH + n * DAY).toISOString();
export const getPackage = async (id) => (id ? (await sb(`packages?id=eq.${q(id)}&limit=1`))?.[0] || null : null);

// Credit for unused days when moving to a different plan.
export function calcUpgrade(user, cur, next) {
  const end = user.subscription_end ? new Date(user.subscription_end).getTime() : Date.now();
  const remainingDays = Math.max(0, Math.floor((end - Date.now()) / DAY));
  const curDays = PERIOD_DAYS[cur?.period] || 30;
  const paidPlan = cur && cur.price > 0 && user.payment_method !== 'referral';   // no credit for plans redeemed with points
  const remainingValue = paidPlan ? +((remainingDays / curDays) * cur.price).toFixed(2) : 0;
  const newDays = PERIOD_DAYS[next.period] ?? null;
  const carryoverDays = newDays === null || !next.price ? 0 : Math.round(remainingValue / (next.price / newDays));
  return { remainingDays, remainingValue, newPlanPrice: next.price, newPeriodDays: newDays, carryoverDays, totalDays: newDays === null ? null : newDays + carryoverDays };
}

export async function applyPackage(user, pkg, totalDays, extra = {}) {
  await sb(`users?id=eq.${q(user.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: {
    package_id: pkg.id, package_name: pkg.name, ads_free: pkg.ads_free ?? false,
    subscription_start: phMidnight(), subscription_end: totalDays == null ? null : phMidnight(totalDays),
    expiry_sent: false, reminder_3_sent: false, reminder_7_sent: false, followup_sent: false, ...extra } });
  if (user.role === 'provider') {
    const prov = (await sb(`providers?user_id=eq.${q(user.id)}&select=id&limit=1`))?.[0];
    if (prov) {
      const quota = parseInt((await settings()).featured_impression_quota) || 500;
      await sb(`providers?id=eq.${q(prov.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { package_id: pkg.id, is_featured: !!pkg.is_featured, featured_impressions: 0, featured_quota: pkg.is_featured ? quota : 0 } });
      await sb(`listings?provider_id=eq.${q(prov.id)}&is_active=eq.false&deactivated_reason=eq.subscription_expired`, { method: 'PATCH', prefer: 'return=minimal', body: { is_active: true, deactivated_reason: null } });
    }
  }
}

export async function notify(userId, title, body, type = 'info') {
  await sb('user_messages', { method: 'POST', prefer: 'return=minimal', body: { user_id: userId, title, body, type, icon: '', is_read: false } });
}

// Called when a signed-in user's plan has run out.
export async function downgradeIfExpired(user) {
  const free = FREE[user.role === 'provider' ? 'provider' : 'regular'];
  if (!user.subscription_end || user.package_id === free || new Date(user.subscription_end) > new Date()) return user;
  await sb(`users?id=eq.${q(user.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { package_id: free, package_name: 'Free', ads_free: false, subscription_start: null, subscription_end: null, payment_status: 'expired' } });
  let hidden = 0;
  if (user.role === 'provider') {
    const prov = (await sb(`providers?user_id=eq.${q(user.id)}&select=id&limit=1`))?.[0];
    if (prov) {
      await sb(`providers?id=eq.${q(prov.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { package_id: free, is_featured: false, featured_quota: 0 } });
      const ls = (await sb(`listings?provider_id=eq.${q(prov.id)}&is_active=eq.true&select=id`)) || [];
      hidden = ls.length;
      if (hidden) await sb(`listings?provider_id=eq.${q(prov.id)}&is_active=eq.true`, { method: 'PATCH', prefer: 'return=minimal', body: { is_active: false, deactivated_reason: 'subscription_expired' } });
    }
  }
  await notify(user.id, 'Plan ended', user.role === 'provider' ? `Your plan has ended and moved to Free.${hidden ? ` ${hidden} listing(s) were hidden.` : ''} Renew to restore them.` : 'Your plan has ended and moved to Free. Ads are back. Renew any time from Profile.', 'warning');
  return { ...user, package_id: free, package_name: 'Free', ads_free: false, subscription_end: null, payment_status: 'expired' };
}
