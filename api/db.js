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
        body:    `Your upgrade request could not be approved.\n\nReason: ${reason || 'No reason provided. Please contact support if you believe this is a mistake.'}`,
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

  /* ════════════════════════════════════════════════════════════
     PHASE 2 — ADMIN MANAGEMENT
  ════════════════════════════════════════════════════════════ */

  /* ── createPackage ──────────────────────────────────────────
     Requires: admin
     Payload:  { data }
  ─────────────────────────────────────────────────────────── */
  async createPackage(payload) {
    const { data } = payload;
    if (!data?.name) throw { status: 400, message: 'Missing package name.' };

    const slugId = data.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const row = {
      id:                       slugId,
      type:                     data.type,
      name:                     data.name,
      price:                    data.price,
      period:                   data.period        || 'month',
      booking_limit:            data.bookingLimit  ?? 5,
      referral_points_required: data.referralPointsRequired ?? 0,
      ads_free:                 data.adsFree       ?? false,
      is_featured:              data.isFeatured    ?? false,
      features:                 data.features      || [],
      popular:                  data.popular       ?? false,
      badge_label:              data.badgeLabel    || 'Popular',
      icon:                     data.icon          || '📦',
      is_active:                data.isActive      ?? true,
      sort_order:               data.sortOrder     ?? 99,
    };

    const rows = await sb('packages', { method: 'POST', body: JSON.stringify(row) });
    return rows?.length ? rows[0] : null;
  },

  /* ── updatePackage ──────────────────────────────────────────
     Requires: admin
     Payload:  { id, changes }
  ─────────────────────────────────────────────────────────── */
  async updatePackage(payload) {
    const { id, changes } = payload;
    if (!id) throw { status: 400, message: 'Missing package id.' };

    const map = {
      name:'name', price:'price', period:'period',
      listingLimit:'listing_limit', bookingLimit:'booking_limit',
      referralPointsRequired:'referral_points_required',
      adsFree:'ads_free', isFeatured:'is_featured', features:'features',
      popular:'popular', badgeLabel:'badge_label', icon:'icon',
      isActive:'is_active', sortOrder:'sort_order', type:'type',
    };
    const p = {};
    Object.entries(map).forEach(([k, dbCol]) => {
      if (changes[k] != null) p[dbCol] = changes[k];
    });

    await sb(`packages?id=eq.${id}`, {
      method:  'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body:    JSON.stringify(p),
    });

    return { ok: true };
  },

  /* ── deletePackage ──────────────────────────────────────────
     Requires: admin
     Payload:  { id }
  ─────────────────────────────────────────────────────────── */
  async deletePackage(payload) {
    const { id } = payload;
    if (!id) throw { status: 400, message: 'Missing package id.' };

    const PERMANENT = [
      'regular-free','regular-plus','regular-pro','regular-starter',
      'provider-free','provider-basic','provider-pro','provider-premium',
    ];
    if (PERMANENT.includes(id)) {
      throw { status: 400, message: 'This is a permanent package and cannot be deleted.' };
    }

    await sb(`packages?id=eq.${id}`, {
      method:  'DELETE',
      headers: { 'Prefer': 'return=minimal' },
    });

    return { ok: true };
  },

  /* ── createAd ───────────────────────────────────────────────
     Requires: admin
     Payload:  { data }
  ─────────────────────────────────────────────────────────── */
  async createAd(payload) {
    const { data } = payload;
    if (!data?.title) throw { status: 400, message: 'Missing ad title.' };

    const row = {
      type:             data.type,
      advertiser:       data.advertiser,
      title:            data.title,
      description:      data.description      || '',
      icon:             data.icon             || '📢',
      image_url:        data.imageUrl         || null,
      link_url:         data.linkUrl          || '#',
      cta_label:        data.ctaLabel         || 'Learn More',
      bg_color:         data.bgColor          || '#0f2027',
      text_color:       data.textColor        || '#ffffff',
      is_active:        data.isActive         ?? true,
      starts_at:        data.startsAt         || new Date().toISOString(),
      ends_at:          data.endsAt           || null,
      notes:            data.notes            || '',
      sort_order:       data.sortOrder        ?? 99,
      impression_quota: data.impressionQuota  ?? 5000,
    };

    const rows = await sb('ads', { method: 'POST', body: JSON.stringify(row) });
    return rows?.[0] || null;
  },

  /* ── updateAd ───────────────────────────────────────────────
     Requires: admin
     Payload:  { id, changes }
  ─────────────────────────────────────────────────────────── */
  async updateAd(payload) {
    const { id, changes } = payload;
    if (!id) throw { status: 400, message: 'Missing ad id.' };

    const map = {
      type:'type', advertiser:'advertiser', title:'title',
      description:'description', icon:'icon', imageUrl:'image_url',
      linkUrl:'link_url', ctaLabel:'cta_label', bgColor:'bg_color',
      textColor:'text_color', isActive:'is_active', startsAt:'starts_at',
      endsAt:'ends_at', notes:'notes', sortOrder:'sort_order',
	  impressionQuota:'impression_quota', impressionCount:'impression_count', clickCount:'click_count',
    };
    const p = {};
    Object.entries(map).forEach(([k, col]) => {
      if (changes[k] !== undefined) p[col] = changes[k];
    });

    const rows = await sb(`ads?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(p) });
    return rows?.[0] || null;
  },

  /* ── deleteAd ───────────────────────────────────────────────
     Requires: admin
     Payload:  { id }
  ─────────────────────────────────────────────────────────── */
  async deleteAd(payload) {
    const { id } = payload;
    if (!id) throw { status: 400, message: 'Missing ad id.' };

    await sb(`ads?id=eq.${id}`, {
      method:  'DELETE',
      headers: { 'Prefer': 'return=minimal' },
    });

    return { ok: true };
  },

  /* ── createAdBatch ──────────────────────────────────────────
     Requires: admin
     Payload:  { adId, quota, batchNumber }
  ─────────────────────────────────────────────────────────── */
  async createAdBatch(payload) {
    const { adId, quota, batchNumber } = payload;
    if (!adId) throw { status: 400, message: 'Missing adId.' };

    await sb('ads_batches', {
      method:  'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        ad_id:            adId,
        batch_number:     batchNumber,
        impression_quota: quota,
        impression_count: 0,
        status:           'active',
        started_at:       new Date().toISOString(),
        completed_at:     null,
      }),
    });

    return { ok: true };
  },

  /* ── createTemplate ─────────────────────────────────────────
     Requires: admin
     Payload:  { data }
  ─────────────────────────────────────────────────────────── */
  async createTemplate(payload) {
    const { data } = payload;
    if (!data?.title) throw { status: 400, message: 'Missing template title.' };

    const row = {
      title: data.title,
      body:  data.body,
      type:  data.type || 'announcement',
      icon:  data.icon || '📢',
    };

    const rows = await sb('message_templates', { method: 'POST', body: JSON.stringify(row) });
    return rows?.[0] || null;
  },

  /* ── updateTemplate ─────────────────────────────────────────
     Requires: admin
     Payload:  { id, data }
  ─────────────────────────────────────────────────────────── */
  async updateTemplate(payload) {
    const { id, data } = payload;
    if (!id) throw { status: 400, message: 'Missing template id.' };

    const row = {
      title:      data.title,
      body:       data.body,
      type:       data.type || 'announcement',
      icon:       data.icon || '📢',
      updated_at: new Date().toISOString(),
    };

    await sb(`message_templates?id=eq.${id}`, {
      method:  'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body:    JSON.stringify(row),
    });

    return { ok: true };
  },

  /* ── deleteTemplate ─────────────────────────────────────────
     Requires: admin
     Payload:  { id }
  ─────────────────────────────────────────────────────────── */
  async deleteTemplate(payload) {
    const { id } = payload;
    if (!id) throw { status: 400, message: 'Missing template id.' };

    await sb(`message_templates?id=eq.${id}`, {
      method:  'DELETE',
      headers: { 'Prefer': 'return=minimal' },
    });

    return { ok: true };
  },

  /* ── sendMessage ────────────────────────────────────────────
     Requires: admin
     Payload:  { templateId, recipients }
     recipients: 'all' | 'regulars' | 'providers' | { userId }
  ─────────────────────────────────────────────────────────── */
  async sendMessage(payload) {
    const { templateId, recipients } = payload;
    if (!templateId) throw { status: 400, message: 'Missing templateId.' };

    // 1. Load template
    const tplRows = await sb(`message_templates?id=eq.${templateId}&limit=1`);
    const tpl = tplRows?.[0];
    if (!tpl) throw { status: 404, message: 'Template not found.' };

    // 2. Resolve recipient user IDs
    let users = [];
    if (recipients === 'all') {
      users = await sb('users?select=id&status=eq.active&is_inactive=eq.false') || [];
    } else if (recipients === 'regulars') {
      users = await sb('users?select=id&role=eq.regular&status=eq.active&is_inactive=eq.false') || [];
    } else if (recipients === 'providers') {
      users = await sb('users?select=id&role=eq.provider&status=eq.active&is_inactive=eq.false') || [];
    } else if (recipients?.userId) {
      users = [{ id: recipients.userId }];
    }

    if (!users.length) throw { status: 400, message: 'No recipients found.' };

    // 3. Batch insert into user_messages (chunks of 100)
    const msgRows = users.map(u => ({
      user_id: u.id,
      title:   tpl.title,
      body:    tpl.body,
      type:    tpl.type,
      icon:    tpl.icon,
      is_read: false,
    }));

    const chunkSize = 100;
    for (let i = 0; i < msgRows.length; i += chunkSize) {
      await sb('user_messages', {
        method:  'POST',
        headers: { 'Prefer': 'return=minimal' },
        body:    JSON.stringify(msgRows.slice(i, i + chunkSize)),
      });
    }

    // 4. Increment template send_count
    await sb(`message_templates?id=eq.${templateId}`, {
      method:  'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body:    JSON.stringify({ send_count: (tpl.send_count || 0) + 1 }),
    });

    return { ok: true, sent: users.length };
  },

  /* ════════════════════════════════════════════════════════════
     PHASE 3 — USER & BOOKING WRITES
  ════════════════════════════════════════════════════════════ */

  /* ── registerRegular ────────────────────────────────────────
     Requires: none (public — signup)
     Payload:  { data }
  ─────────────────────────────────────────────────────────── */
  async registerRegular(payload) {
    const { data } = payload;
    if (!data?.email || !data?.username || !data?.passwordHash) {
      throw { status: 400, message: 'Missing required registration fields.' };
    }
    const byEmail = await sb(`users?email=eq.${encodeURIComponent(data.email.trim().toLowerCase())}&limit=1`);
    if (byEmail?.length) throw { status: 409, message: 'An account with this email already exists.' };
    const byUser = await sb(`users?username=eq.${encodeURIComponent(data.username.trim().toLowerCase())}&limit=1`);
    if (byUser?.length) throw { status: 409, message: 'That username is already taken.' };

    const periodDays = data.periodDays ?? null;
    const now = new Date();
    const subStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
    const subEnd = data.paymentStatus === 'free' ? null : periodDays === null ? null : calcExpiry(periodDays);
    const isPendingManual = data.status === 'pending' && data.paymentStatus === 'pending';

    const user = {
      email:              data.email.trim().toLowerCase(),
      username:           data.username.trim().toLowerCase(),
      password_hash:      data.passwordHash,
      first_name:         data.firstName,
      last_name:          data.lastName,
      phone:              data.phone,
      role:               'regular',
      status:             data.status || 'active',
      package_id:         isPendingManual ? 'regular-free' : (data.package || 'free'),
      package_name:       isPendingManual ? 'Free'         : (data.packageName || null),
      ads_free:           isPendingManual ? false           : (data.ads_free || false),
      payment_method:     data.paymentMethod    || null,
      payment_reference:  data.paymentReference || null,
      payment_amount:     data.paymentAmount    || null,
      payment_status:     data.paymentStatus    || null,
      subscription_start: isPendingManual ? null : (data.paymentStatus === 'free' ? null : subStart),
      subscription_end:   isPendingManual ? null : subEnd,
      is_inactive:        false,
      is_presignup:       data.is_presignup || false,
      referral_code:      data.referralCode || null,
      referred_by:        data.referredBy   || null,
      pending_package_id: isPendingManual ? (data.package || null) : null,
    };

    const rows = await sb('users', { method: 'POST', body: JSON.stringify(user) });
    const savedUser = rows?.length ? rows[0] : null;

    if (savedUser && data.referredBy) {
      const referrerRows = await sb(`users?referral_code=eq.${data.referredBy}&limit=1`);
      const referrer = referrerRows?.[0];
      if (referrer) {
        await sb('referrals', {
          method: 'POST', headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({ referrer_id: referrer.id, referred_id: savedUser.id, points: 0, status: 'pending' }),
        });
        const isInstantPaid = data.paymentStatus === 'paid' || data.paymentStatus === 'verified';
        if (isInstantPaid) {
          await sb(`users?id=eq.${referrer.id}`, {
            method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify({ referral_points: (referrer.referral_points || 0) + 3 }),
          });
        }
      }
    }
    return savedUser;
  },

  /* ── registerProvider ───────────────────────────────────────
     Requires: none (public — signup)
     Payload:  { data }  file URLs already uploaded client-side
  ─────────────────────────────────────────────────────────── */
  async registerProvider(payload) {
    const { data } = payload;
    if (!data?.email || !data?.username || !data?.passwordHash) {
      throw { status: 400, message: 'Missing required registration fields.' };
    }
    const byEmail = await sb(`users?email=eq.${encodeURIComponent(data.email.trim().toLowerCase())}&limit=1`);
    if (byEmail?.length) throw { status: 409, message: 'An account with this email already exists.' };
    const byUser = await sb(`users?username=eq.${encodeURIComponent(data.username.trim().toLowerCase())}&limit=1`);
    if (byUser?.length) throw { status: 409, message: 'That username is already taken.' };

    const periodDays = data.periodDays ?? null;
    const now = new Date();
    const subStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
    const subEnd = data.paymentStatus === 'free' ? null : periodDays === null ? null : calcExpiry(periodDays);

    let adsFree = false;
    if (data.package) {
      const pkgRows = await sb(`packages?id=eq.${encodeURIComponent(data.package)}&limit=1`);
      adsFree = pkgRows?.[0]?.ads_free ?? false;
    }

    const userRow = {
      email:             data.email.trim().toLowerCase(),
      username:          data.username.trim().toLowerCase(),
      password_hash:     data.passwordHash,
      first_name:        data.firstName,
      last_name:         data.lastName,
      phone:             data.phone      || null,
      role:              'provider',
      status:            'pending',
      package_id:        data.package    || null,
      package_name:      data.packageName || null,
      ads_free:          adsFree,
      is_inactive:       false,
      is_presignup:      data.is_presignup || false,
      referral_code:     data.referralCode || null,
      referred_by:       data.referredBy  || null,
      avatar_url:        data.avatarUrl   || null,
      payment_method:    data.paymentMethod    || null,
      payment_reference: data.paymentReference || null,
      payment_amount:    data.paymentAmount    || null,
      payment_status:    data.paymentStatus    || null,
      subscription_start: data.paymentStatus === 'free' ? null : subStart,
      subscription_end:   subEnd,
    };

    const provRow = {
      biz_name:       data.bizName,
      cat_main:       null, cat_sub: null, biz_desc: null,
      experience:     data.experience || null,
      region:         data.region     || null, region_name:   data.regionName || null,
      province:       data.province   || null, province_name: data.provName   || null,
      city:           data.city       || null, city_name:     data.cityName   || null,
      barangay:       data.barangay   || null, barangay_name: data.brgyName   || null,
      street_addr:    data.streetAddr || null,
      id_type:        data.idType     || null,
      id_file_url:    data.idFileUrl  || null,
      avatar_url:     data.avatarUrl  || null,
      portfolio_urls: data.portfolioUrls || [],
      package_id:     data.package    || null,
      status: 'pending', is_featured: false, is_elite: false, avg_rating: 0.0, total_ratings: 0,
    };

    const result = await sb('rpc/register_provider', {
      method: 'POST',
      body: JSON.stringify({ user_data: userRow, prov_data: provRow }),
    });

    const savedUser = result?.user;
    if (savedUser && data.referredBy) {
      const referrerRows = await sb(`users?referral_code=eq.${data.referredBy}&limit=1`);
      const referrer = referrerRows?.[0];
      if (referrer) {
        await sb('referrals', {
          method: 'POST', headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({ referrer_id: referrer.id, referred_id: savedUser.id, points: 0, status: 'pending' }),
        });
      }
    }
    return { user: result?.user, provider: result?.provider };
  },

  /* ── updateUser ─────────────────────────────────────────────
     Requires: own record or admin
     Payload:  { id, changes }
  ─────────────────────────────────────────────────────────── */
  async updateUser(payload, callerUser) {
    const { id, changes } = payload;
    if (!id) throw { status: 400, message: 'Missing user id.' };
    if (callerUser.role !== 'admin' && callerUser.id !== id) {
      throw { status: 403, message: 'You can only update your own profile.' };
    }
    const p = {};
    if (changes.status        != null) p.status            = changes.status;
    if (changes.packageId     != null) p.package_id        = changes.packageId;
    if (changes.packageName   != null) p.package_name      = changes.packageName;
    if (changes.adsFree       != null) p.ads_free          = changes.adsFree;
    if ('subscriptionStart' in changes) p.subscription_start = changes.subscriptionStart;
    if ('subscriptionEnd'   in changes) p.subscription_end   = changes.subscriptionEnd;
    if (changes.email)                  p.email             = changes.email.toLowerCase();
    if (changes.firstName)              p.first_name        = changes.firstName;
    if (changes.lastName)               p.last_name         = changes.lastName;
    if (changes.phone)                  p.phone             = changes.phone;
    if (changes.passwordHash)           p.password_hash     = changes.passwordHash;
    if (callerUser.role === 'admin') {
      if (changes.role        != null) p.role              = changes.role;
      if (changes.forceLogout != null) p.force_logout      = changes.forceLogout;
      if (changes.paymentStatus != null) p.payment_status  = changes.paymentStatus;
    }
    const rows = await sb(`users?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(p) });
    return rows?.length ? rows[0] : null;
  },

  /* ── updateProvider ─────────────────────────────────────────
     Requires: own record or admin
     Payload:  { id, changes }
  ─────────────────────────────────────────────────────────── */
  async updateProvider(payload, callerUser) {
    const { id, changes } = payload;
    if (!id) throw { status: 400, message: 'Missing provider id.' };
    if (callerUser.role !== 'admin') {
      const rows = await sb(`providers?id=eq.${id}&select=user_id&limit=1`);
      const prov = rows?.[0];
      if (!prov || prov.user_id !== callerUser.id) {
        throw { status: 403, message: 'You can only update your own provider record.' };
      }
    }
    const p = {};
    if (changes.bizName)              p.biz_name          = changes.bizName;
    if (changes.bizDesc)              p.biz_desc          = changes.bizDesc;
    if (changes.cityName)             p.city_name         = changes.cityName;
    if (changes.provinceName)         p.province_name     = changes.provinceName;
    if (changes.regionName)           p.region_name       = changes.regionName;
    if (changes.barangayName)         p.barangay_name     = changes.barangayName;
    if (changes.streetAddr != null)   p.street_addr       = changes.streetAddr;
    if (callerUser.role === 'admin') {
      if (changes.status       != null) p.status           = changes.status;
      if ('idFileUrl' in changes)       p.id_file_url      = changes.idFileUrl;
      if (changes.isFeatured   != null) p.is_featured      = changes.isFeatured;
      if (changes.isElite      != null) p.is_elite         = changes.isElite;
      if (changes.eliteGrantedAt)       p.elite_granted_at = changes.eliteGrantedAt;
      if (changes.eliteExpiresAt != null) p.elite_expires_at = changes.eliteExpiresAt;
      if (changes.packageId    != null) p.package_id       = changes.packageId;
    }
    const rows = await sb(`providers?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(p) });
    return rows?.length ? rows[0] : null;
  },

  /* ── createBooking ──────────────────────────────────────────
     Requires: regular user
     Payload:  { regularUserId, providerId, jobDescription }
  ─────────────────────────────────────────────────────────── */
  async createBooking(payload, callerUser) {
    const { regularUserId, providerId, jobDescription } = payload;
    if (!regularUserId || !providerId) throw { status: 400, message: 'Missing booking fields.' };
    if (callerUser.role !== 'admin' && callerUser.id !== regularUserId) {
      throw { status: 403, message: 'You can only create bookings for yourself.' };
    }
    const existing = await sb(
      `inquiries?regular_user_id=eq.${regularUserId}&provider_id=eq.${providerId}&status=in.(pending,active,done)&limit=1`
    );
    if (existing?.length) throw { status: 409, message: 'You already have an active booking with this provider.' };
    const row = {
      regular_user_id: regularUserId, provider_id: providerId,
      user_message: jobDescription, status: 'pending',
      user_has_unread: false, provider_has_unread: true,
    };
    const rows = await sb('inquiries', { method: 'POST', body: JSON.stringify(row) });
    return rows?.[0] || null;
  },

  /* ── activateBooking ────────────────────────────────────────
     Requires: regular user (own booking)
     Payload:  { inquiryId }
  ─────────────────────────────────────────────────────────── */
  async activateBooking(payload, callerUser) {
    const { inquiryId } = payload;
    if (!inquiryId) throw { status: 400, message: 'Missing inquiryId.' };
    const inq = (await sb(`inquiries?id=eq.${inquiryId}&limit=1`))?.[0];
    if (!inq) throw { status: 404, message: 'Booking not found.' };
    if (callerUser.role !== 'admin' && callerUser.id !== inq.regular_user_id) {
      throw { status: 403, message: 'You can only confirm your own bookings.' };
    }
    const prov = (await sb(`providers?id=eq.${inq.provider_id}&select=package_id&limit=1`))?.[0];
    const pkg  = prov?.package_id
      ? (await sb(`packages?id=eq.${encodeURIComponent(prov.package_id)}&select=booking_limit,name&limit=1`))?.[0]
      : null;
    const limit = pkg?.booking_limit ?? 5;
    if (limit < 999) {
      const active = await sb(`inquiries?provider_id=eq.${inq.provider_id}&status=eq.active`) || [];
      if (active.length >= limit) {
        throw { status: 409, message: 'This provider has reached their active booking limit. Please try again later.' };
      }
    }
    const rows = await sb(`inquiries?id=eq.${inquiryId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'active', provider_has_unread: true, user_has_unread: false }),
    });
    return rows?.[0] || null;
  },

  /* ── cancelInquiry ──────────────────────────────────────────
     Requires: regular user (own booking)
     Payload:  { inquiryId }
  ─────────────────────────────────────────────────────────── */
  async cancelInquiry(payload, callerUser) {
    const { inquiryId } = payload;
    if (!inquiryId) throw { status: 400, message: 'Missing inquiryId.' };
    const inq = (await sb(`inquiries?id=eq.${inquiryId}&limit=1`))?.[0];
    if (!inq) throw { status: 404, message: 'Booking not found.' };
    if (callerUser.role !== 'admin' && callerUser.id !== inq.regular_user_id) {
      throw { status: 403, message: 'You can only cancel your own bookings.' };
    }
    const user = (await sb(`users?id=eq.${inq.regular_user_id}&select=first_name,last_name&limit=1`))?.[0];
    const userName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'The user';
    const provider = (await sb(`providers?id=eq.${inq.provider_id}&select=user_id&limit=1`))?.[0];
    if (provider?.user_id) {
      await sb('user_messages', {
        method: 'POST', headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          user_id: provider.user_id, title: 'Booking Cancelled by User',
          body: `${userName} has cancelled their booking with you.\n\nJob Description:\n"${inq.user_message || 'No description provided.'}"`,
          type: 'warning', icon: '🚫', is_read: false,
        }),
      });
    }
    await sb(`inquiries?id=eq.${inquiryId}`, {
      method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({ status: 'cancelled', user_has_unread: false, provider_has_unread: true }),
    });
    return { ok: true };
  },

  /* ── providerCancelBooking ──────────────────────────────────
     Requires: provider (own booking)
     Payload:  { inquiryId }
  ─────────────────────────────────────────────────────────── */
  async providerCancelBooking(payload, callerUser) {
    const { inquiryId } = payload;
    if (!inquiryId) throw { status: 400, message: 'Missing inquiryId.' };
    const inq = (await sb(`inquiries?id=eq.${inquiryId}&limit=1`))?.[0];
    if (!inq) throw { status: 404, message: 'Booking not found.' };
    if (callerUser.role !== 'admin') {
      const prov = (await sb(`providers?id=eq.${inq.provider_id}&select=user_id&limit=1`))?.[0];
      if (!prov || prov.user_id !== callerUser.id) {
        throw { status: 403, message: 'You can only cancel your own bookings.' };
      }
    }
    const provider = (await sb(`providers?id=eq.${inq.provider_id}&select=biz_name&limit=1`))?.[0];
    const providerName = provider?.biz_name || 'Your provider';
    await sb('user_messages', {
      method: 'POST', headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        user_id: inq.regular_user_id, title: 'Booking Cancelled by Provider',
        body: `${providerName} has cancelled your booking.\n\nJob Description:\n"${inq.user_message || 'No description provided.'}"`,
        type: 'warning', icon: '🚫', is_read: false,
      }),
    });
    await sb(`inquiries?id=eq.${inquiryId}`, {
      method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({ status: 'cancelled', user_has_unread: true, provider_has_unread: false }),
    });
    return { ok: true };
  },

  /* ── disputeInquiry ─────────────────────────────────────────
     Requires: regular user (own booking)
     Payload:  { inquiryId }
  ─────────────────────────────────────────────────────────── */
  async disputeInquiry(payload, callerUser) {
    const { inquiryId } = payload;
    if (!inquiryId) throw { status: 400, message: 'Missing inquiryId.' };
    const inq = (await sb(`inquiries?id=eq.${inquiryId}&limit=1`))?.[0];
    if (!inq) throw { status: 404, message: 'Booking not found.' };
    if (callerUser.role !== 'admin' && callerUser.id !== inq.regular_user_id) {
      throw { status: 403, message: 'You can only dispute your own bookings.' };
    }
    const user = (await sb(`users?id=eq.${inq.regular_user_id}&select=first_name,last_name&limit=1`))?.[0];
    const userName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'The user';
    const provider = (await sb(`providers?id=eq.${inq.provider_id}&select=user_id&limit=1`))?.[0];
    if (provider?.user_id) {
      await sb('user_messages', {
        method: 'POST', headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          user_id: provider.user_id, title: 'Booking Disputed by User',
          body: `${userName} has disputed the completion of their booking with you.\n\nJob Description:\n"${inq.user_message || 'No description provided.'}"`,
          type: 'warning', icon: '⚠️', is_read: false,
        }),
      });
    }
    await sb(`inquiries?id=eq.${inquiryId}`, {
      method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({ status: 'disputed', user_has_unread: false, provider_has_unread: true }),
    });
    return { ok: true };
  },

  /* ── markDone ───────────────────────────────────────────────
     Requires: provider (own booking)
     Payload:  { inquiryId }
  ─────────────────────────────────────────────────────────── */
  async markDone(payload, callerUser) {
    const { inquiryId } = payload;
    if (!inquiryId) throw { status: 400, message: 'Missing inquiryId.' };
    const inq = (await sb(`inquiries?id=eq.${inquiryId}&limit=1`))?.[0];
    if (!inq) throw { status: 404, message: 'Booking not found.' };
    if (callerUser.role !== 'admin') {
      const prov = (await sb(`providers?id=eq.${inq.provider_id}&select=user_id&limit=1`))?.[0];
      if (!prov || prov.user_id !== callerUser.id) {
        throw { status: 403, message: 'You can only mark done your own bookings.' };
      }
    }
    const rows = await sb(`inquiries?id=eq.${inquiryId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'done', user_has_unread: true, provider_has_unread: false }),
    });
    return rows?.[0] || null;
  },

  /* ── acceptCompletion ───────────────────────────────────────
     Requires: regular user (own booking)
     Payload:  { inquiryId, stars, comment, anonymous }
  ─────────────────────────────────────────────────────────── */
  async acceptCompletion(payload, callerUser) {
    const { inquiryId, stars, comment, anonymous = false } = payload;
    if (!inquiryId) throw { status: 400, message: 'Missing inquiryId.' };
    const inq = (await sb(`inquiries?id=eq.${inquiryId}&limit=1`))?.[0];
    if (!inq) throw { status: 404, message: 'Booking not found.' };
    if (callerUser.role !== 'admin' && callerUser.id !== inq.regular_user_id) {
      throw { status: 403, message: 'You can only complete your own bookings.' };
    }
    const update = { status: 'completed', provider_has_unread: true, user_has_unread: false };
    if (stars) { update.rating_stars = stars; update.rating_comment = comment || ''; update.rated_at = new Date().toISOString(); }
    await sb(`inquiries?id=eq.${inquiryId}`, { method: 'PATCH', headers: { 'Prefer': 'return=minimal' }, body: JSON.stringify(update) });

    if (stars && inq.provider_id && inq.regular_user_id) {
      const ratingUser = (await sb(`users?id=eq.${inq.regular_user_id}&select=first_name,last_name&limit=1`))?.[0];
      const fullName = ratingUser ? `${ratingUser.first_name} ${ratingUser.last_name}`.trim() : '';
      const displayName = anonymous && fullName ? fullName.split(' ').map(p => p.slice(0, 3) + '***').join(' ') : fullName;
      await sb('ratings', {
        method: 'POST', headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ provider_id: inq.provider_id, regular_user_id: inq.regular_user_id, inquiry_id: inquiryId, stars, comment: comment || '', is_anonymous: anonymous || false, display_name: displayName }),
      });
      const allRatings = await sb(`ratings?provider_id=eq.${inq.provider_id}&select=stars`) || [];
      const avg = allRatings.length ? allRatings.reduce((s, r) => s + r.stars, 0) / allRatings.length : 0;
      await sb(`providers?id=eq.${inq.provider_id}`, {
        method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ avg_rating: Math.round(avg * 10) / 10, total_ratings: allRatings.length }),
      });
      const provider = (await sb(`providers?id=eq.${inq.provider_id}&select=biz_name,user_id&limit=1`))?.[0];
      if (provider?.user_id) {
        const provUser = (await sb(`users?id=eq.${provider.user_id}&select=email&limit=1`))?.[0];
        if (provUser?.email) {
          await sendEmail('rating_notify_provider', { email: provUser.email, bizName: provider.biz_name, stars, comment: comment || '(no comment)', newAvg: Math.round(avg * 10) / 10 });
        }
      }
    }
    try {
      const booker = (await sb(`users?id=eq.${inq.regular_user_id}&select=payment_status,referral_points&limit=1`))?.[0];
      if (booker && (!booker.payment_status || booker.payment_status === 'free')) {
        const prev = await sb(`inquiries?regular_user_id=eq.${inq.regular_user_id}&status=eq.completed&select=id`) || [];
        if (prev.length === 1) {
          await sb(`users?id=eq.${inq.regular_user_id}`, { method: 'PATCH', headers: { 'Prefer': 'return=minimal' }, body: JSON.stringify({ referral_points: (booker.referral_points || 0) + 1 }) });
        }
      }
    } catch(e) {}
    return { ok: true };
  },

  /* ── updateListing ──────────────────────────────────────────
     Requires: provider (own) or admin
     Payload:  { id, changes }
  ─────────────────────────────────────────────────────────── */
  async updateListing(payload, callerUser) {
    const { id, changes } = payload;
    if (!id) throw { status: 400, message: 'Missing listing id.' };
    if (callerUser.role !== 'admin') {
      const listing = (await sb(`listings?id=eq.${id}&select=provider_id&limit=1`))?.[0];
      if (!listing) throw { status: 404, message: 'Listing not found.' };
      const prov = (await sb(`providers?id=eq.${listing.provider_id}&select=user_id,package_id&limit=1`))?.[0];
      if (!prov || prov.user_id !== callerUser.id) throw { status: 403, message: 'You can only update your own listings.' };
      if (changes.isActive === true) {
        const pkg = prov.package_id ? (await sb(`packages?id=eq.${encodeURIComponent(prov.package_id)}&select=listing_limit,name&limit=1`))?.[0] : null;
        const limit = pkg?.listing_limit ?? 0;
        if (limit < 999) {
          const active = await sb(`listings?provider_id=eq.${listing.provider_id}&is_active=eq.true`) || [];
          if (active.length >= limit) {
            throw { status: 400, message: `Your ${pkg?.name || 'current'} plan allows up to ${limit} active listing${limit !== 1 ? 's' : ''}. Deactivate another listing first, or upgrade your plan.` };
          }
        }
      }
    }
    const p = {};
    if (changes.title            != null) p.title              = changes.title;
    if (changes.description      != null) p.description        = changes.description;
    if (changes.priceLabel       != null) p.price_label        = changes.priceLabel;
    if (changes.isActive         != null) p.is_active          = changes.isActive;
    if (changes.catMain          != null) p.cat_main           = changes.catMain;
    if (changes.catSub           != null) p.cat_sub            = changes.catSub;
    if ('otherServiceDesc' in changes)    p.other_service_desc = changes.otherServiceDesc;
    const rows = await sb(`listings?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(p) });
    return rows?.length ? rows[0] : null;
  },

  /* ── deleteListing ──────────────────────────────────────────
     Requires: provider (own) or admin
     Payload:  { id }
  ─────────────────────────────────────────────────────────── */
  async deleteListing(payload, callerUser) {
    const { id } = payload;
    if (!id) throw { status: 400, message: 'Missing listing id.' };
    if (callerUser.role !== 'admin') {
      const listing = (await sb(`listings?id=eq.${id}&select=provider_id&limit=1`))?.[0];
      if (!listing) throw { status: 404, message: 'Listing not found.' };
      const prov = (await sb(`providers?id=eq.${listing.provider_id}&select=user_id&limit=1`))?.[0];
      if (!prov || prov.user_id !== callerUser.id) throw { status: 403, message: 'You can only delete your own listings.' };
    }
    await sb(`listings?id=eq.${id}`, { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } });
    return { ok: true };
  },

  /* ── submitReport ───────────────────────────────────────────
     Requires: any authenticated user
     Payload:  { data }
  ─────────────────────────────────────────────────────────── */
  async submitReport(payload) {
    const { data } = payload;
    if (!data?.providerId || !data?.reason) throw { status: 400, message: 'Missing report fields.' };
    await sb('provider_reports', {
      method: 'POST', headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({ provider_id: data.providerId, provider_name: data.providerName, user_id: data.userId, user_name: data.userName, reason: data.reason, details: data.details || null, status: 'pending' }),
    });
    return { ok: true };
  },

  /* ── submitChangeRequest ────────────────────────────────────
     Requires: own record or admin
     Payload:  { data }  file URL already uploaded client-side
  ─────────────────────────────────────────────────────────── */
  async submitChangeRequest(payload, callerUser) {
    const { data } = payload;
    if (!data?.subject) throw { status: 400, message: 'Missing change request subject.' };
    if (callerUser.role !== 'admin' && callerUser.id !== data.userId) {
      throw { status: 403, message: 'You can only submit change requests for yourself.' };
    }
    await sb('change_requests', {
      method: 'POST', headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({ user_id: data.userId, provider_id: data.providerId, provider_name: data.providerName, subject: data.subject, requested_value: data.requestedValue, explanation: data.explanation, file_url: data.fileUrl || null, file_path: data.filePath || null, status: 'pending' }),
    });
    return { ok: true };
  },

  /* ── requestUpgrade ─────────────────────────────────────────
     Requires: own record or admin
     Payload:  { data }
  ─────────────────────────────────────────────────────────── */
  async requestUpgrade(payload, callerUser) {
    const { data } = payload;
    if (!data?.userId || !data?.newPackageId) throw { status: 400, message: 'Missing upgrade request fields.' };
    if (callerUser.role !== 'admin' && callerUser.id !== data.userId) {
      throw { status: 403, message: 'You can only request upgrades for yourself.' };
    }
    const row = {
      user_id: data.userId, provider_id: data.providerId || null,
      current_package_id: data.currentPackageId, new_package_id: data.newPackageId,
      current_sub_end: data.currentSubEnd || null, remaining_days: data.remainingDays || 0,
      remaining_value: data.remainingValue || 0, new_plan_price: data.newPlanPrice || 0,
      carryover_days: data.carryoverDays || 0, payment_method: data.paymentMethod || null,
      payment_reference: data.paymentReference || null, payment_amount: data.paymentAmount || null,
      status: 'pending',
    };
    const rows = await sb('upgrade_requests', { method: 'POST', body: JSON.stringify(row) });
    return rows?.[0] || null;
  },

};

/* ══════════════════════════════════════════════════════════════
   ROUTE MAP — which actions require which role
══════════════════════════════════════════════════════════════ */
const ROLE_MAP = {
  // Phase 1 — Admin destructive
  deleteUser:            'admin',
  deleteProvider:        'admin',
  kickUser:              'admin',
  approveUpgrade:        'admin',
  rejectUpgrade:         'admin',
  warnProvider:          'admin',
  suspendProvider:       'admin',
  dismissReport:         'admin',
  // Phase 2 — Admin management
  createPackage:         'admin',
  updatePackage:         'admin',
  deletePackage:         'admin',
  createAd:              'admin',
  updateAd:              'admin',
  deleteAd:              'admin',
  createAdBatch:         'admin',
  createTemplate:        'admin',
  updateTemplate:        'admin',
  deleteTemplate:        'admin',
  sendMessage:           'admin',
  // Phase 3 — User & booking writes (null = any authenticated user)
  registerRegular:       null,
  registerProvider:      null,
  updateUser:            null,
  updateProvider:        null,
  createBooking:         null,
  activateBooking:       null,
  cancelInquiry:         null,
  providerCancelBooking: null,
  disputeInquiry:        null,
  markDone:              null,
  acceptCompletion:      null,
  updateListing:         null,
  deleteListing:         null,
  submitReport:          null,
  submitChangeRequest:   null,
  requestUpgrade:        null,
};

/* ── Main handler ────────────────────────────────────────────── */
module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { action, payload } = req.body || {};

  if (!action) {
    return res.status(400).json({ error: 'Missing action.' });
  }

  if (!(action in actions)) {
    return res.status(400).json({ error: `Unknown action: ${action}` });
  }

  try {
    // Authenticate and check role
    const requiredRole = ROLE_MAP[action] !== undefined ? ROLE_MAP[action] : null;

    // registerRegular and registerProvider are public — no auth required
    const publicActions = new Set(['registerRegular', 'registerProvider']);
    const callerUser = publicActions.has(action)
      ? null
      : await requireAuth(req, requiredRole);

    // Execute action — pass callerUser for ownership checks in Phase 3
    const result = await actions[action](payload || {}, callerUser);
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