import crypto from 'node:crypto';
import { sb, q } from './db.js';
import { httpError } from './auth.js';
import { getPackage, PERIOD_DAYS, applyPackage } from './packages.js';

export const genCode = () => Array.from(crypto.randomBytes(8), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');

// Pays the referrer once, when the referred person reaches the milestone.
export async function credit(referredId, points) {
  const ref = (await sb(`referrals?referred_id=eq.${q(referredId)}&status=eq.pending&limit=1`))?.[0];
  if (!ref) return;
  const referrer = (await sb(`users?id=eq.${q(ref.referrer_id)}&select=id,referral_points&limit=1`))?.[0];
  if (!referrer) return;
  await sb(`users?id=eq.${q(referrer.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { referral_points: (referrer.referral_points || 0) + points } });
  await sb(`referrals?id=eq.${q(ref.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { status: 'credited', points_awarded: points, credited_at: new Date().toISOString() } });
}

export async function stats(userId) {
  const u = (await sb(`users?id=eq.${q(userId)}&select=referral_points,referral_code&limit=1`))?.[0] || {};
  const refs = (await sb(`referrals?referrer_id=eq.${q(userId)}&order=created_at.desc&limit=5`)) || [];
  const people = refs.length ? (await sb(`users?id=in.(${refs.map((r) => q(r.referred_id)).join(',')})&select=id,first_name,last_name,role`)) || [] : [];
  return {
    points: u.referral_points || 0, code: u.referral_code || null,
    history: refs.map((r) => { const p = people.find((x) => x.id === r.referred_id); return { name: p ? `${p.first_name} ${p.last_name}` : '—', role: p?.role || '', status: r.status, points: r.points_awarded || 0 }; }),
  };
}

export async function redeem(user, { packageId }) {
  const pkg = await getPackage(packageId);
  if (!pkg || !pkg.is_active || !pkg.referral_points_required) throw httpError(400, 'This plan cannot be redeemed with points.');
  if (pkg.type !== user.role) throw httpError(400, 'This plan is not for your account type.');
  const u = (await sb(`users?id=eq.${q(user.id)}&select=*&limit=1`))?.[0];
  const free = u.package_id === 'regular-free' || u.package_id === 'provider-free';
  if (!free) throw httpError(409, 'You have an active plan. Redeem after it expires.');
  if ((u.referral_points || 0) < pkg.referral_points_required) throw httpError(400, `You need ${pkg.referral_points_required} points. You have ${u.referral_points || 0}.`);
  const days = PERIOD_DAYS[pkg.period] ?? 30;
  await applyPackage(u, pkg, days, { referral_points: u.referral_points - pkg.referral_points_required, payment_method: 'referral', payment_status: 'referral' });
  return { points: u.referral_points - pkg.referral_points_required, plan: pkg.name };
}
