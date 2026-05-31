/*
 * ═══════════════════════════════════════════════════════════════
 *  FIXIA — Service Marketplace
 *  /api/db.js  —  Vercel Serverless Function
 *  © ByteStack Labs 2025. All Rights Reserved.
 *
 *  Secure server-side database router.
 *  All sensitive write operations execute here — never client-side.
 *  Every request is authenticated via session_token before execution.
 * ═══════════════════════════════════════════════════════════════
 */

const SUPA_URL          = process.env.SUPA_URL;
const SUPA_SERVICE_KEY  = process.env.SUPA_SERVICE_KEY;
const APP_URL           = process.env.APP_URL || 'https://fixia.ph';

/* ── Supabase helper (uses service key — server only) ────────── */
async function sb(path, opts = {}) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      'apikey':        SUPA_SERVICE_KEY,
      'Authorization': `Bearer ${SUPA_SERVICE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        opts.prefer || 'return=representation',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/* ── Supabase storage delete helper ─────────────────────────── */
async function sbDeleteFile(publicUrl) {
  if (!publicUrl) return;
  const match = publicUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
  if (!match) return;
  const [, bucket, path] = match;
  await fetch(`${SUPA_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'DELETE',
    headers: {
      apikey:        SUPA_SERVICE_KEY,
      Authorization: `Bearer ${SUPA_SERVICE_KEY}`,
    },
  });
}

/* ── Auth: validate session token, return user ───────────────── */
async function requireAuth(req, requiredRole = null) {
  const sessionToken = req.headers['x-session-token'];
  const userId       = req.headers['x-user-id'];

  if (!sessionToken || !userId) {
    throw { status: 401, message: 'Unauthorized' };
  }

  const rows = await sb(
    `users?id=eq.${encodeURIComponent(userId)}&session_token=eq.${encodeURIComponent(sessionToken)}&select=id,role,status&limit=1`
  );
  const user = rows?.[0];

  if (!user) throw { status: 401, message: 'Unauthorized' };
  if (user.status === 'suspended') throw { status: 403, message: 'Account suspended.' };
  if (requiredRole && user.role !== requiredRole) throw { status: 403, message: 'Forbidden' };

  return user;
}

/* ── Shared helper: calc expiry date ─────────────────────────── */
function calcExpiry(periodDays) {
  const now = new Date();
  const localMidnight = new Date(
    now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0
  );
  const expiry = new Date(localMidnight);
  expiry.setDate(expiry.getDate() + periodDays);
  return expiry.toISOString();
}

/* ── Send email helper ───────────────────────────────────────── */
async function sendEmail(type, data) {
  await fetch(`${APP_URL}/api/send-email`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ type, data }),
  }).catch(() => {});
}

/* ══════════════════════════════════════════════════════════════
   ACTION HANDLERS
══════════════════════════════════════════════════════════════ */
const actions = {

  /* ── deleteUser ─────────────────────────────────────────────
     Requires: admin
     Payload:  { id }
  ─────────────────────────────────────────────────────────── */
  async deleteUser(payload) {
    const { id } = payload;
    if (!id) throw { status: 400, message: 'Missing user id.' };

    // Fetch user to get avatar
    const rows = await sb(`users?id=eq.${id}&select=avatar_url&limit=1`);
    const user = rows?.[0];

    // Delete avatar from storage
    if (user?.avatar_url) await sbDeleteFile(user.avatar_url);

    // Delete provider record first (cascade)
    await sb(`providers?user_id=eq.${id}`, {
      method:  'DELETE',
      prefer:  'return=minimal',
      headers: { 'Prefer': 'return=minimal' },
    });

    // Delete user
    await sb(`users?id=eq.${id}`, {
      method:  'DELETE',
      headers: { 'Prefer': 'return=minimal' },
    });

    return { ok: true };
  },

  /* ── deleteProvider ─────────────────────────────────────────
     Requires: admin
     Payload:  { id }  ← provider.id (not user.id)
  ─────────────────────────────────────────────────────────── */
  async deleteProvider(payload) {
    const { id } = payload;
    if (!id) throw { status: 400, message: 'Missing provider id.' };

    const rows = await sb(`providers?id=eq.${id}&select=user_id,avatar_url&limit=1`);
    const prov = rows?.[0];

    if (prov?.avatar_url) await sbDeleteFile(prov.avatar_url);

    if (prov?.user_id) {
      await sb(`users?id=eq.${prov.user_id}`, {
        method:  'DELETE',
        headers: { 'Prefer': 'return=minimal' },
      });
    }

    await sb(`providers?id=eq.${id}`, {
      method:  'DELETE',
      headers: { 'Prefer': 'return=minimal' },
    });

    return { ok: true };
  },

  /* ── kickUser ───────────────────────────────────────────────
     Requires: admin
     Payload:  { userId }
  ─────────────────────────────────────────────────────────── */
  async kickUser(payload) {
    const { userId } = payload;
    if (!userId) throw { status: 400, message: 'Missing userId.' };

    await sb(`users?id=eq.${userId}`, {
      method:  'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body:    JSON.stringify({ session_token: null }),
    });

    return { ok: true };
  },

  /* ── approveUpgrade ─────────────────────────────────────────
     Requires: admin
     Payload:  { requestId }
  ─────────────────────────────────────────────────────────── */
  async approveUpgrade(payload) {
    const { requestId } = payload;
    if (!requestId) throw { status: 400, message: 'Missing requestId.' };

    // Fetch request
    const reqRows = await sb(`upgrade_requests?id=eq.${requestId}&limit=1`);
    const req = reqRows?.[0];
    if (!req) throw { status: 404, message: 'Upgrade request not found.' };

    // Fetch new package
    const pkgRows = await sb(`packages?id=eq.${encodeURIComponent(req.new_package_id)}&limit=1`);
    const newPkg = pkgRows?.[0];
    if (!newPkg) throw { status: 404, message: 'Package not found.' };

    // Calculate subscription dates
    const periodDays = { month: 30, '3month': 90, '6month': 180, year: 365, lifetime: null };
    const newPeriodDays = periodDays[newPkg.period] ?? null;
    const totalDays = newPeriodDays === null ? null : (newPeriodDays + (req.carryover_days || 0));

    const now = new Date();
    const subStart = new Date(
      now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0
    ).toISOString();
    const subEnd = totalDays === null ? null : calcExpiry(totalDays);

    // Update user
    await sb(`users?id=eq.${req.user_id}`, {
      method:  'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        package_id:         req.new_package_id,
        package_name:       newPkg.name,
        ads_free:           newPkg.ads_free ?? true,
        payment_method:     req.payment_method,
        payment_reference:  req.payment_reference,
        payment_amount:     req.payment_amount,
        payment_status:     'verified',
        subscription_start: subStart,
        subscription_end:   subEnd,
        expiry_sent:        false,
        reminder_3_sent:    false,
        reminder_7_sent:    false,
        followup_sent:      false,
      }),
    });

    // Update provider package if applicable
    if (req.provider_id) {
      await sb(`providers?id=eq.${req.provider_id}`, {
        method:  'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body:    JSON.stringify({ package_id: req.new_package_id }),
      });

      // Re-activate listings deactivated by expiry only
      await sb(
        `listings?provider_id=eq.${req.provider_id}&is_active=eq.false&deactivated_reason=eq.subscription_expired`,
        {
          method:  'PATCH',
          headers: { 'Prefer': 'return=minimal' },
          body:    JSON.stringify({ is_active: true, deactivated_reason: null }),
        }
      );
    }

    // Notify user
    const validUntilText = subEnd
      ? ' Your new subscription is valid until ' +
        new Date(subEnd).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) + '.'
      : '';
    await sb('user_messages', {
      method:  'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        user_id: req.user_id,
        title:   'Upgrade Approved! 🎉',
        body:    `Your upgrade to ${newPkg.name} has been approved. Your unused balance from your current plan has been automatically credited toward your new subscription.${validUntilText}`,
        type:    'success',
        icon:    '🎉',
        is_read: false,
      }),
    });

    // Archive request
    await sb(`upgrade_requests?id=eq.${requestId}`, {
      method:  'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        status:         'approved',
        archived_at:    new Date().toISOString(),
        archive_reason: 'approved_by_admin',
      }),
    });

    return { ok: true, subStart, subEnd, totalDays };
  },

  /* ── rejectUpgrade ──────────────────────────────────────────
     Requires: admin
     Payload:  { requestId, reason }
  ─────────────────────────────────────────────────────────── */
  async rejectUpgrade(payload) {
    const { requestId, reason } = payload;
    if (!requestId) throw { status: 400, message: 'Missing requestId.' };

    const reqRows = await sb(`upgrade_requests?id=eq.${requestId}&limit=1`);
    const req = reqRows?.[0];
    if (!req) throw { status: 404, message: 'Upgrade request not found.' };

    // Archive with rejected status
    await sb(`upgrade_requests?id=eq.${requestId}`, {
      method:  'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        status:         'rejected',
        notes:          reason || null,
        reviewed_at:    new Date().toISOString(),
        archived_at:    new Date().toISOString(),
        archive_reason: 'rejected_by_admin',
      }),
    });

    // Notify user
    await sb('user_messages', {
      method:  'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        user_id: req.user_id,
        title:   'Upgrade Request Not Approved',
        body:    `Your upgrade request could not be approved.${reason ? ' Reason: ' + reason : ' Please contact support if you believe this is a mistake.'}`,
        type:    'warning',
        icon:    '❌',
        is_read: false,
      }),
    });

    return { ok: true };
  },

  /* ── warnProvider ───────────────────────────────────────────
     Requires: admin
     Payload:  { report }  ← full report object
  ─────────────────────────────────────────────────────────── */
  async warnProvider(payload) {
    const { report } = payload;
    if (!report?.id) throw { status: 400, message: 'Missing report.' };

    await sb('user_messages', {
      method:  'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        user_id: report.provider_user_id,
        title:   'Account Warning',
        body:    `You have been reported for activity that violates our Fair and Good Environment Policy. Please consider this as a formal warning.\n\nPlease review our community guidelines and ensure your conduct meets our standards. Further violations may result in account suspension.`,
        type:    'warning',
        icon:    '⚠️',
        is_read: false,
      }),
    });

    await sb(`provider_reports?id=eq.${report.id}`, {
      method:  'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body:    JSON.stringify({ status: 'warned' }),
    });

    return { ok: true };
  },

  /* ── suspendProvider ────────────────────────────────────────
     Requires: admin
     Payload:  { report }  ← full report object
  ─────────────────────────────────────────────────────────── */
  async suspendProvider(payload) {
    const { report } = payload;
    if (!report?.id) throw { status: 400, message: 'Missing report.' };

    // Fetch suspension_days setting
    const settingRows = await sb(`app_settings?key=eq.suspension_days&limit=1`);
    const days = parseInt(settingRows?.[0]?.value) || 7;
    const liftDate = new Date(Date.now() + (days * 86400000));
    const liftStr  = liftDate.toLocaleDateString('en-PH', {
      year: 'numeric', month: 'long', day: 'numeric'
    });

    // Set provider to suspension_pending
    await sb(`providers?id=eq.${report.provider_id}`, {
      method:  'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body:    JSON.stringify({ status: 'suspension_pending', suspended_until: null }),
    });

    // Notify provider — suspension is applied when they acknowledge the message
    await sb('user_messages', {
      method:  'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        user_id:  report.provider_user_id,
        title:    'Account Suspension Notice',
        body:     `You have been reported for activity that violates our fair and good environment policy.\n\nUpon acknowledging this message, your account will be suspended for ${days} day${days !== 1 ? 's' : ''} and will automatically be lifted on ${liftStr}.\n\nIf you believe this is a false report, please contact our support team immediately.`,
        type:     'warning',
        icon:     '🚫',
        is_read:  false,
        metadata: JSON.stringify({
          action:          'suspend_on_read',
          provider_id:     report.provider_id,
          user_id:         report.provider_user_id,
          suspension_days: days,
        }),
      }),
    });

    // Update report status
    await sb(`provider_reports?id=eq.${report.id}`, {
      method:  'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body:    JSON.stringify({ status: 'suspended' }),
    });

    return { ok: true };
  },

  /* ── dismissReport ──────────────────────────────────────────
     Requires: admin
     Payload:  { id }  ← report id
  ─────────────────────────────────────────────────────────── */
  async dismissReport(payload) {
    const { id } = payload;
    if (!id) throw { status: 400, message: 'Missing report id.' };

    await sb(`provider_reports?id=eq.${id}`, {
      method:  'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body:    JSON.stringify({ status: 'dismissed' }),
    });

    return { ok: true };
  },

};

/* ══════════════════════════════════════════════════════════════
   ROUTE MAP — which actions require which role
══════════════════════════════════════════════════════════════ */
const ROLE_MAP = {
  deleteUser:      'admin',
  deleteProvider:  'admin',
  kickUser:        'admin',
  approveUpgrade:  'admin',
  rejectUpgrade:   'admin',
  warnProvider:    'admin',
  suspendProvider: 'admin',
  dismissReport:   'admin',
};

/* ── Main handler ────────────────────────────────────────────── */
module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { action, payload } = req.body || {};

  if (!action) {
    return res.status(400).json({ error: 'Missing action.' });
  }

  if (!actions[action]) {
    return res.status(400).json({ error: `Unknown action: ${action}` });
  }

  try {
    // Authenticate and check role
    const requiredRole = ROLE_MAP[action] || null;
    await requireAuth(req, requiredRole);

    // Execute action
    const result = await actions[action](payload || {});
    return res.status(200).json(result);

  } catch (err) {
    // Structured error (thrown by requireAuth or action handlers)
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    // Unexpected error
    console.error(`[Fixia DB] action=${action} error:`, err.message);
    return res.status(500).json({ error: err.message });
  }
};