/*
 * /api/subscription-cron.js
 * Vercel Cron — runs daily at 1:00 AM PH time (17:00 UTC)
 * Checks all subscriptions and sends emails / updates statuses
 */

const SUPA_URL  = process.env.SUPA_URL;
const SUPA_KEY  = process.env.SUPA_KEY;
const CRON_SECRET = process.env.CRON_SECRET; // set this in Vercel env vars

async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      'apikey':        SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function sendEmail(type, data) {
  await fetch(`${process.env.APP_URL}/api/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, data }),
  });
}

module.exports = async (req, res) => {
  // Protect the cron endpoint
  if (req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const now     = new Date();
  const results = { expired: 0, warned7: 0, warned3: 0, followup: 0, errors: [] };

  try {
    // Fetch all active/pending paid users with a subscription_end date
    const users = await sbFetch(
      `users?subscription_end=not.is.null&status=in.(active,pending,hidden)&select=*`
    );

    for (const user of users) {
      const expiry    = new Date(user.subscription_end);
      const daysLeft  = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
      const isProvider = user.role === 'provider';

      try {
        // T-7 — Early email reminder (independent — always checked)
        if (daysLeft === 7 && !user.reminder_7_sent) {
          await sendEmail(isProvider ? 'provider_expiry_7' : 'regular_expiry_7', {
            fullName: `${user.first_name} ${user.last_name}`,
            email:    user.email,
            daysLeft: 7,
          });
          await sbFetch(`users?id=eq.${user.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ reminder_7_sent: true }),
          });
          results.warned7++;
        }

        // T-3 — Email + in-app flag (independent — always checked)
        if (daysLeft === 3 && !user.reminder_3_sent) {
          await sendEmail(isProvider ? 'provider_expiry_3' : 'regular_expiry_3', {
            fullName: `${user.first_name} ${user.last_name}`,
            email:    user.email,
            daysLeft: 3,
          });
          await sbFetch(`users?id=eq.${user.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ reminder_3_sent: true }),
          });
          results.warned3++;
        }

        // T-0 — Expiry (independent — always checked)
        if (daysLeft <= 0 && !user.expiry_sent) {
          const newStatus = isProvider ? 'hidden' : 'active';
          await sbFetch(`users?id=eq.${user.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              status:      newStatus,
              package_id:  isProvider ? user.package_id : 'free',
              ads_free:    false,
              expiry_sent: true,
            }),
          });
          await sendEmail(isProvider ? 'provider_expired' : 'regular_expired', {
            fullName: `${user.first_name} ${user.last_name}`,
            email:    user.email,
          });
          results.expired++;
        }

        // T+1 — Follow-up email (independent — only fires the day after expiry)
        if (daysLeft === -1 && !user.followup_sent) {
          await sendEmail(isProvider ? 'provider_reactivate' : 'regular_reactivate', {
            fullName: `${user.first_name} ${user.last_name}`,
            email:    user.email,
          });
          await sbFetch(`users?id=eq.${user.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ followup_sent: true }),
          });
          results.followup++;
        }

      } catch(userErr) {
        results.errors.push(`User ${user.id}: ${userErr.message}`);
      }
    }

    // Handle provider grace period (T+7 → suspend)
    const hiddenProviders = await sbFetch(
      `users?status=eq.hidden&role=eq.provider&subscription_end=not.is.null&select=*`
    );
    for (const p of hiddenProviders) {
      const daysSinceExpiry = Math.floor(
        (now - new Date(p.subscription_end)) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceExpiry >= 7) {
        await sbFetch(`users?id=eq.${p.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'suspended' }),
        });
        await sendEmail('provider_suspended', {
          fullName: `${p.first_name} ${p.last_name}`,
          email:    p.email,
        });
      }
    }

    // ── Auto-delete rejected accounts older than 30 days ──────────
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const staleRejected = await sbFetch(
      `users?force_logout=eq.true&status=in.(rejected)&created_at=lt.${thirtyDaysAgo}&select=id`
    ) || [];
    for (const u of staleRejected) {
      try {
        await sbFetch(`providers?user_id=eq.${u.id}`, { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } });
        await sbFetch(`users?id=eq.${u.id}`, { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } });
      } catch(e) {
        results.errors.push(`Stale account delete ${u.id}: ${e.message}`);
      }
    }

    console.log('[Fixia Cron] Subscription check complete:', results);
    return res.status(200).json({ ok: true, ...results });

  } catch(err) {
    console.error('[Fixia Cron] Fatal error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};