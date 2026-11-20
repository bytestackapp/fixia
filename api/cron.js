/* Runs daily at 17:00 UTC (1am Manila): reminders, expiry, grace-period suspension, old rejected accounts. */
import { sb, q } from './_lib/db.js';
import { mail } from './_lib/mail.js';

const DAY = 86400000;
export default async function handler(req, res) {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'Unauthorized' });
  const out = { warned7: 0, warned3: 0, expired: 0, followup: 0, suspended: 0, deleted: 0, errors: [] };
  const who = (u) => ({ fullName: `${u.first_name} ${u.last_name}`, email: u.email, provider: u.role === 'provider' });
  const mark = (u, body) => sb(`users?id=eq.${q(u.id)}`, { method: 'PATCH', prefer: 'return=minimal', body });
  try {
    const users = (await sb('users?subscription_end=not.is.null&status=in.(active,pending,hidden)&select=*')) || [];
    for (const u of users) {
      try {
        const left = Math.ceil((new Date(u.subscription_end) - Date.now()) / DAY);
        if (left === 7 && !u.reminder_7_sent) { await mail('expiry', { ...who(u), daysLeft: 7 }); await mark(u, { reminder_7_sent: true }); out.warned7++; }
        if (left === 3 && !u.reminder_3_sent) { await mail('expiry', { ...who(u), daysLeft: 3 }); await mark(u, { reminder_3_sent: true }); out.warned3++; }
        if (left <= 0 && !u.expiry_sent) {
          const provider = u.role === 'provider';
          await mark(u, { status: provider ? 'hidden' : 'active', package_id: provider ? u.package_id : 'regular-free', ads_free: false, expiry_sent: true });
          await mail('expired', who(u)); out.expired++;
        }
        if (left === -1 && !u.followup_sent) { await mail('reactivate', who(u)); await mark(u, { followup_sent: true }); out.followup++; }
      } catch (e) { out.errors.push(`${u.id}: ${e.message}`); }
    }
    const hidden = (await sb('users?status=eq.hidden&role=eq.provider&subscription_end=not.is.null&select=*')) || [];
    for (const p of hidden) if ((Date.now() - new Date(p.subscription_end)) / DAY >= 7) { await mark(p, { status: 'suspended' }); await mail('suspended', who(p)); out.suspended++; }
    const old = (await sb(`users?status=eq.rejected&created_at=lt.${new Date(Date.now() - 30 * DAY).toISOString()}&select=id`)) || [];
    for (const u of old) { await sb(`providers?user_id=eq.${q(u.id)}`, { method: 'DELETE', prefer: 'return=minimal' }); await sb(`users?id=eq.${q(u.id)}`, { method: 'DELETE', prefer: 'return=minimal' }); out.deleted++; }
    await sb(`pending_signups?created_at=lt.${new Date(Date.now() - 3 * DAY).toISOString()}`, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});   // unfinished online sign-ups
    return res.status(200).json({ ok: true, ...out });
  } catch (e) { console.error('[cron]', e); return res.status(500).json({ error: e.message }); }
}
