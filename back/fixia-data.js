/*
 * ═══════════════════════════════════════════════════════════════
 *  FIXIA — Service Marketplace
 *  fixia-data.js  —  Loaded by all pages
 *  © ByteStack Labs 2025. All Rights Reserved.
 *
 *  Storage : Supabase (PostgreSQL)
 *  Auth    : Custom password hash (front-end, same as StormFlow)
 *  Session : localStorage (persists across tabs)
 *  Files   : Supabase Storage (ID photos, portfolio images)
 * ═══════════════════════════════════════════════════════════════
 *
 *  SUPABASE TABLES REQUIRED:
 *  ┌─────────────────────┬──────────────────────────────────────────────┐
 *  │ Table               │ Key Columns                                  │
 *  ├─────────────────────┼──────────────────────────────────────────────┤
 *  │ users               │ id, email, username, password_hash,          │
 *  │                     │ first_name, last_name, phone, role,          │
 *  │                     │ status, package_id, ads_free,                │
 *  │                     │ payment_method, payment_reference,           │
 *  │                     │ payment_amount, payment_status,              │
 *  │                     │ created_at                                   │
 *  ├─────────────────────┼──────────────────────────────────────────────┤
 *  │ providers           │ id, user_id, biz_name, prov_type,            │
 *  │                     │ cat_main, cat_sub, biz_desc, experience,     │
 *  │                     │ region, region_name, province, province_name,│
 *  │                     │ city, city_name, barangay, barangay_name,    │
 *  │                     │ street_addr, id_type, id_file_url,           │
 *  │                     │ portfolio_urls[], package_id, status,        │
 *  │                     │ elite_granted_at, elite_expires_at,          │
 *  │                     │ is_elite, avg_rating, total_ratings,         │
 *  │                     │ is_featured, created_at                      │
 *  ├─────────────────────┼──────────────────────────────────────────────┤
 *  │ listings            │ id, provider_id, title, description,         │
 *  │                     │ cat_main, cat_sub, price_label, is_active,   │
 *  │                     │ created_at                                   │
 *  ├─────────────────────┼──────────────────────────────────────────────┤
 *  │ ratings             │ id, provider_id, regular_user_id,            │
 *  │                     │ stars (1-5), comment, created_at             │
 *  ├─────────────────────┼──────────────────────────────────────────────┤
 *  │ packages            │ id, type (regular|provider), name, price,    │
 *  │                     │ period, listing_limit, ads_free, is_featured,│
 *  │                     │ features[], popular, icon, is_active,        │
 *  │                     │ sort_order                                   │
 *  ├─────────────────────┼──────────────────────────────────────────────┤
 *  │ password_resets     │ id, user_id, token, expires_at, used         │
 *  ├─────────────────────┼──────────────────────────────────────────────┤
 *  │ ad_batches          │ id, type, status, slot_count, duration_days, │
 *  │                     │ started_at, expires_at, created_at           │
 *  ├─────────────────────┼──────────────────────────────────────────────┤
 *  │ featured_batches    │ id, status, slot_count, duration_days,       │
 *  │                     │ started_at, expires_at, created_at           │
 *  └─────────────────────┴──────────────────────────────────────────────┘
 *
 *  SUPABASE STORAGE BUCKETS:
 *  • fixia-ids        (private — for government ID uploads)
 *  • fixia-portfolio  (public  — for provider portfolio photos)
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';

/* ── Config — replace with your Supabase project values ─────── */
const SUPA_URL = 'https://jqycouhbatdmssfqcyio.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxeWNvdWhiYXRkbXNzZnFjeWlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNjMwOTYsImV4cCI6MjA5MjgzOTA5Nn0.SaPsXj_b1LlxLQPv1YrWm2A2KaU8fDx4PbbQV-etUKk';
const APP_URL  = window.location.origin;
const EMAIL_API  = '/api/send-email';



/* ── HTML escape helper — use on ALL user-supplied content in innerHTML ── */
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#x27;');
}

/* ══════════════════════════════════════════════════════════════
   CORE SUPABASE REST HELPER
══════════════════════════════════════════════════════════════ */
async function sbFetch(path, options = {}) {
  // Safety check — catch unconfigured placeholder URLs early
  if (SUPA_URL.includes('YOUR_PROJECT_REF') || SUPA_KEY.includes('YOUR_ANON')) {
    throw new Error('Supabase is not configured. Please update SUPA_URL and SUPA_KEY in fixia-data.js');
  }

  const url = `${SUPA_URL}/rest/v1/${path}`;
  const headers = {
    'apikey':        SUPA_KEY,
    'Authorization': `Bearer ${SUPA_KEY}`,
    'Content-Type':  'application/json',
    'Prefer':        options.prefer || 'return=representation',
    ...(options.headers || {})
  };

  // 10-second timeout — prevents pages hanging forever on bad connections
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, { ...options, headers, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
	  console.error('Supabase error:', res.status);
      throw new Error(err.message || err.details || err.hint || `Supabase error ${res.status}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch(e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      throw new Error('Connection timed out. Please check your internet connection.');
    }
    throw e;
  }
}

async function sbDelete(publicUrl) {
  try {
    if (!publicUrl) return;
    await fetch('/api/delete-storage-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicUrl }),
    });
  } catch(e) { console.warn('Storage delete failed:', e); }
}

/* ── Supabase Storage upload helper ──────────────────────────── */
async function sbUpload(bucket, path, base64DataUrl, mimeType) {
  const base64 = base64DataUrl.split(',')[1];
  const byteChars = atob(base64);
  const byteArr = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
  const blob = new Blob([byteArr], { type: mimeType });

  const url = `${SUPA_URL}/storage/v1/object/${bucket}/${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey':        SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
      'Content-Type':  mimeType,
      'x-upsert':      'false'
    },
    body: blob
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return `${SUPA_URL}/storage/v1/object/public/${bucket}/${path}`;
}

function calcExpiry(periodDays, existingExpiry = null) {
  const now = new Date();
  const base = existingExpiry && new Date(existingExpiry) > now
    ? new Date(existingExpiry)
    : now;

  // Anchor to local calendar date (midnight local time) so the
  // subscription start/end reflects the user's date, not UTC.
  const localMidnight = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    0, 0, 0, 0
  );

  const expiry = new Date(localMidnight);
  expiry.setDate(expiry.getDate() + periodDays);
  return expiry.toISOString();
}

async function hashPassword(password) {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'hash', password }),
  });
  const data = await res.json();
  if (!data.hash) throw new Error('Password hashing failed.');
  return data.hash;
}

async function verifyPassword(password, hash) {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'verify', password, hash }),
  });
  const data = await res.json();
  return data.match === true;
}

/* ── UUID generator ──────────────────────────────────────────── */
function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for very old environments
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  arr[6] = (arr[6] & 0x0f) | 0x40;
  arr[8] = (arr[8] & 0x3f) | 0x80;
  return [...arr].map((b, i) =>
    ([4,6,8,10].includes(i) ? '-' : '') + b.toString(16).padStart(2,'0')
  ).join('');
}

/* ══════════════════════════════════════════════════════════════
   FX — MAIN FIXIA DATA OBJECT
══════════════════════════════════════════════════════════════ */
const FX = {

  /* ════════════════════════════════════════════════════════════
     SESSION  (localStorage — persists across tabs)
  ════════════════════════════════════════════════════════════ */
  getSession() {
    try { return JSON.parse(localStorage.getItem('fx_session') || 'null'); }
    catch { return null; }
  },
  setSession(s) { localStorage.setItem('fx_session', JSON.stringify(s)); },
  clearSession() { localStorage.removeItem('fx_session'); },

  requireAuth(allowedRoles = []) {
    const s = this.getSession();
    if (!s) { window.location.href = 'login.html'; return null; }
    if (allowedRoles.length && !allowedRoles.includes(s.role)) {
      window.location.href = 'login.html'; return null;
    }
    return s;
  },

  /* ════════════════════════════════════════════════════════════
     AUTH — LOGIN / LOGOUT
  ════════════════════════════════════════════════════════════ */
  async login(identifier, password) {
    // Try email first, then username
    let user = null;
    const isEmail = identifier.includes('@');
    if (isEmail) {
      user = await this.getUserByEmail(identifier);
    } else {
      user = await this.getUserByUsername(identifier);
    }
	if (!user) return { success: false, error: 'No account found with those details.' };
	// Try bcrypt first (new accounts), then fall back to legacy FNV-1a (old accounts)
    let passwordMatch = await verifyPassword(password, user.password_hash);
    
    if (!passwordMatch) return { success: false, error: 'Incorrect password.' };
    if (user.status === 'suspended') return { success: false, error: 'Your account has been suspended. Contact support if you believe this is a mistake.' };
    if (user.status === 'rejected') return { success: false, error: 'Your account application was not approved.' };
    
    if (user.role === 'provider') {
      const provRows = await sbFetch(`providers?user_id=eq.${user.id}&limit=1`);
      const prov = provRows?.[0];
      if (prov?.status === 'suspended') return { success: false, error: 'Your account has been suspended. Contact support if you believe this is a mistake.' };
      // pending and needs_compliance providers are allowed in as free tier
    }

    // Build session token — invalidates any other active session for this user
    const sessionToken = genId();

    // Build session
    const session = {
      userId:       user.id,
      role:         user.role,
      email:        user.email,
      username:     user.username,
      firstName:    user.first_name,
      lastName:     user.last_name,
      packageId:    user.package_id,
      adsFree:      user.ads_free,
      status:       user.status,
      providerId:   user.provider_id || null,
      avatarUrl:    user.avatar_url  || null,
      sessionToken, // ← stored locally
    };
    this.setSession(session);
    sbFetch(`users?id=eq.${user.id}`, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: JSON.stringify({
        last_login_at:  new Date().toISOString(),
        is_inactive:    false,
        force_logout:   false,
        session_token:  sessionToken, // ← written to DB, overwrites any old session
      }),
    }).catch(() => {});
    
    return { success: true, user };
  },

  logout() {
    const sess = this.getSession();
    if (sess?.userId) {
      sbFetch(`users?id=eq.${sess.userId}`, {
        method: 'PATCH',
        prefer: 'return=minimal',
        body: JSON.stringify({ session_token: null }),
      }).catch(() => {});
    }
    this.clearSession();
    window.location.href = 'login.html';
  },
async checkSession() {
    const sess = this.getSession();
    if (!sess || !sess.sessionToken) return true; // guest or old session — let through
    try {
      const rows = await sbFetch(`users?id=eq.${sess.userId}&select=session_token,status&limit=1`);
      const user = rows?.[0];
      if (!user) return false; // user deleted
      if (user.status === 'suspended') return false;
      // Token mismatch means another device logged in
      return user.session_token === sess.sessionToken;
    } catch(e) {
      return true; // network error — don't log out, fail open
    }
  },

  async kickUser(userId) {
    // Clears the session token in DB — next heartbeat on that device will log them out
    await sbFetch(`users?id=eq.${userId}`, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: JSON.stringify({ session_token: null }),
    });
  },
  
  /* ════════════════════════════════════════════════════════════
     USERS
  ════════════════════════════════════════════════════════════ */
  async getUserByEmail(email) {
    const rows = await sbFetch(`users?email=eq.${encodeURIComponent(email.trim().toLowerCase())}&limit=1`);
    return rows?.length ? rows[0] : null;
  },

  async getUserByUsername(username) {
    const rows = await sbFetch(`users?username=eq.${encodeURIComponent(username.trim().toLowerCase())}&limit=1`);
    return rows?.length ? rows[0] : null;
  },

 async getUserIP() {
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      return data.ip || null;
    } catch(e) { return null; }
  },
  
  async checkEmailExists(email) {
    const row = await this.getUserByEmail(email);
    return row !== null;
  },

  async checkUsernameExists(username) {
    const row = await this.getUserByUsername(username);
    return row !== null;
  },

  async checkPhoneExists(phone) {
    const rows = await sbFetch(`users?phone=eq.${encodeURIComponent(phone.trim())}&limit=1`);
    return rows?.length ? true : false;
  },
  
  async getUserById(id) {
    const rows = await sbFetch(`users?id=eq.${id}&limit=1`);
    return rows?.length ? rows[0] : null;
  },

  async getAllUsers(filters = {}) {
    let q = 'users?order=created_at.desc';
    if (filters.role)   q += `&role=eq.${filters.role}`;
    if (filters.status) q += `&status=eq.${filters.status}`;
    return await sbFetch(q) || [];
  },

  async updateUser(id, changes) {
    const p = {};
    if (changes.status        != null) p.status           = changes.status;
    if (changes.packageId          != null) p.package_id        = changes.packageId;
    if (changes.packageName        != null) p.package_name      = changes.packageName;
    if (changes.adsFree            != null) p.ads_free          = changes.adsFree;
    if ('subscriptionStart' in changes)     p.subscription_start = changes.subscriptionStart;
    if ('subscriptionEnd'   in changes)     p.subscription_end   = changes.subscriptionEnd;
	if (changes.password) 			   p.password_hash     = await hashPassword(changes.password);
    if (changes.email)                 p.email             = changes.email.toLowerCase();
    if (changes.firstName)             p.first_name        = changes.firstName;
    if (changes.lastName)              p.last_name         = changes.lastName;
    if (changes.phone)                 p.phone             = changes.phone;
    if (changes.role)                  p.role              = changes.role;
    if (changes.paymentStatus != null) p.payment_status    = changes.paymentStatus;
    if (changes.forceLogout   != null) p.force_logout      = changes.forceLogout;   // ← ADD
    const rows = await sbFetch(`users?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(p) });
    const updated = rows?.length ? rows[0] : null;

    // ── Refresh session if this is the currently logged-in user ──
    const currentSession = this.getSession();
    if (currentSession && currentSession.userId === id) {
      this.setSession({
        ...currentSession,
        adsFree:   updated?.ads_free   ?? currentSession.adsFree,
        packageId: updated?.package_id ?? currentSession.packageId,
      });
    }

    return updated;
  },

async deleteUser(id) {
  // Delete avatar from storage
  const user = await this.getUserById(id);
  if (user?.avatar_url) await this.deleteAvatar(user.avatar_url);
  // Cascade: delete provider record if exists
  await sbFetch(`providers?user_id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
  await sbFetch(`users?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
},

async deleteAvatar(avatarUrl) {
  if (!avatarUrl) return;
  await sbDelete(avatarUrl);
},

async updateAvatar(userId, file) {
  const user   = await this.getUserById(userId);
  const oldUrl = user?.avatar_url || null;

  const ext    = file.name.split('.').pop();
  const path   = `${userId}_avatar_${Date.now()}.${ext}`;
  const newUrl = await sbUpload('fixia-avatars', path, await this._fileToBase64(file), file.type);

  // Update users table
  await sbFetch(`users?id=eq.${userId}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body:   JSON.stringify({ avatar_url: newUrl }),
  });

  // Also update providers table if this user is a provider
  await sbFetch(`providers?user_id=eq.${userId}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body:   JSON.stringify({ avatar_url: newUrl }),
  }).catch(() => {});

  // Delete old avatar after successful upload
  if (oldUrl) await this.deleteAvatar(oldUrl);

  return newUrl;
},

async _fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
},

async deleteProvider(id) {
  const rows = await sbFetch(`providers?id=eq.${id}&limit=1`);
  const p = rows?.[0];
  if (p?.user_id) await sbFetch(`users?id=eq.${p.user_id}`, { method:'DELETE', prefer:'return=minimal' });
  await sbFetch(`providers?id=eq.${id}`, { method:'DELETE', prefer:'return=minimal' });
},

  async getSetting(key) {
    const rows = await sbFetch(`app_settings?key=eq.${key}&limit=1`);
    return rows?.[0]?.value ?? null;
  },

async setSetting(key, value) {
  await sbFetch(`app_settings`, {
    method: 'POST',
    body: JSON.stringify({ key, value }),
    prefer: 'resolution=merge-duplicates,return=minimal',
  });
},
 
async getPreSignupSettings() {
  const [mode, regularPkg, providerPkg] = await Promise.all([
    this.getSetting('presignup_mode'),
    this.getSetting('presignup_regular_package'),
    this.getSetting('presignup_provider_package'),
  ]);
  return {
    active:         mode === 'true',
    regularPackage: regularPkg || null,
    providerPackage: providerPkg || null,
  };
},

async getPreSignupCount() {
  const [regular, provider] = await Promise.all([
    sbFetch('users?is_presignup=is.true&role=eq.regular&select=id'),
    sbFetch('users?is_presignup=is.true&role=eq.provider&select=id'),
  ]);
  return {
    regular:  (regular  || []).length,
    provider: (provider || []).length,
  };
},

/* ════════════════════════════════════════════════════════════
   REFERRAL SYSTEM
════════════════════════════════════════════════════════════ */
// Generate a short unique referral code
genReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => chars[b % chars.length]).join('');
},

async getReferralStats(userId) {
  const user = await this.getUserById(userId);
  if (!user) return { points: 0, code: null, referrals: [] };
  const referrals = await sbFetch(`referrals?referrer_id=eq.${userId}&order=created_at.desc&limit=5`) || [];
  // Enrich each referral with referred user info
  const enriched = await Promise.all(referrals.map(async r => {
    const ref = await this.getUserById(r.referred_id);
    return {
      ...r,
      referred_name: ref ? `${ref.first_name} ${ref.last_name}` : '—',
      referred_role: ref?.role || '—',
    };
  }));
  return {
    points:    user.referral_points || 0,
    code:      user.referral_code,
    referrals: enriched,
  };
},

async getReferralPackages(role) {
  let q = 'packages?referral_points_required=gt.0&is_active=eq.true&order=referral_points_required.asc';
  if (role) q += `&type=in.(${role},referral)`;
  return await sbFetch(q) || [];
},

async redeemReferralPackage(userId, packageId) {
  const user = await this.getUserById(userId);
  if (!user) throw new Error('User not found.');

  const pkg = await this.getPackageById(packageId);
  if (!pkg) throw new Error('Package not found.');
  if (!pkg.referral_points_required) throw new Error('This package cannot be redeemed with points.');

  // Block if user has any active paid plan (including lifetime with no expiry)
  const hasActiveExpiry = user.subscription_end && new Date(user.subscription_end) > new Date();
  const isLifetime = user.package_id && user.package_id !== 'regular-free' && user.package_id !== 'provider-free' && !user.subscription_end;

  if (hasActiveExpiry || isLifetime) {
    throw new Error('You have an active plan. Please wait for it to expire before redeeming.');
  }

  if ((user.referral_points || 0) < pkg.referral_points_required) {
    throw new Error(`You need ${pkg.referral_points_required} points. You have ${user.referral_points || 0}.`);
  }

  // Calculate expiry
  const periodDays = pkg.period === 'lifetime' ? null
    : pkg.period === 'year'   ? 365
    : pkg.period === '6month' ? 180
    : pkg.period === '3month' ? 90
    : pkg.period === 'month'  ? 30 : 30;

  const now = new Date();
  const subStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
  const subEnd = periodDays ? calcExpiry(periodDays) : null;

  await sbFetch(`users?id=eq.${userId}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: JSON.stringify({
      package_id:         pkg.id,
      package_name:       pkg.name,
      ads_free:           pkg.ads_free || false,
      subscription_start: subStart,
      subscription_end:   subEnd,
      referral_points:    (user.referral_points || 0) - pkg.referral_points_required,
      payment_method:     'referral',
      payment_status:     'referral',
    }),
  });
  return { pkg, newPoints: (user.referral_points || 0) - pkg.referral_points_required };
},

async creditReferralPoints(referredUserId, points) {
  // Find who referred this user
  const referral = await sbFetch(`referrals?referred_id=eq.${referredUserId}&status=eq.pending&limit=1`);
  const ref = referral?.[0];
  if (!ref) return; // No pending referral to credit

  // Credit points to referrer
  const referrer = await this.getUserById(ref.referrer_id);
  if (!referrer) return;

  await sbFetch(`users?id=eq.${ref.referrer_id}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: JSON.stringify({ referral_points: (referrer.referral_points || 0) + points }),
  });

  // Mark referral as credited
  await sbFetch(`referrals?id=eq.${ref.id}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: JSON.stringify({
      status:         'credited',
      points_awarded: points,
      credited_at:    new Date().toISOString(),
    }),
  });
},

async createReferralRecord(referrerId, referredId) {
  // Check not already exists
  const existing = await sbFetch(`referrals?referred_id=eq.${referredId}&limit=1`);
  if (existing?.length) return;
  await sbFetch('referrals', {
    method: 'POST',
    body: JSON.stringify({ referrer_id: referrerId, referred_id: referredId, status: 'pending' }),
  });
},

  /* ════════════════════════════════════════════════════════════
     REGISTRATION — REGULAR USER
  ════════════════════════════════════════════════════════════ */
  async registerRegular(data) {
    // Check for existing email / username
    const byEmail = await this.getUserByEmail(data.email);
    if (byEmail) throw new Error('An account with this email already exists.');
    const byUser  = await this.getUserByUsername(data.username);
    if (byUser)  throw new Error('That username is already taken.');

	const periodDays = data.periodDays ?? null; // null = lifetime
	const _now = new Date();
	const subStart = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate(), 0, 0, 0, 0).toISOString();
    const subEnd     = data.paymentStatus === 'free'
      ? null  // free users have no expiry
      : periodDays === null ? null  // lifetime — no expiry
      : calcExpiry(periodDays);
    
    const isPendingManual = data.status === 'pending' && data.paymentStatus === 'pending';
    
    const user = {
      email:              data.email.trim().toLowerCase(),
      username:           data.username.trim().toLowerCase(),
	  password_hash:      await hashPassword(data.password),
      first_name:         data.firstName,
      last_name:          data.lastName,
      phone:              data.phone,
      role:               'regular',
      status:             data.status || 'active',
      // Keep purchased plan info for admin reference but lock to free tier until approved
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
	  referral_code:      this.genReferralCode(),
	  referred_by:        data.referredBy || null,
	  pending_package_id:   isPendingManual ? (data.package || null) : null,
    };
    const rows = await sbFetch('users', { method: 'POST', body: JSON.stringify(user) });
	
	// Handle referral — credit immediately for paid plans
    const savedUser = rows?.length ? rows[0] : null;
    if (savedUser && data.referredBy) {
      const referrerRows = await sbFetch(`users?referral_code=eq.${data.referredBy}&limit=1`);
      const referrer = referrerRows?.[0];
      if (referrer) {
        const isInstantPaid = data.paymentStatus === 'paid' || data.paymentStatus === 'verified';
        const points = isInstantPaid ? 3 : 0;
        await this.createReferralRecord(referrer.id, savedUser.id);
        if (points > 0) await this.creditReferralPoints(savedUser.id, points);
      }
    }
    return rows?.length ? rows[0] : null;
  },
  
  /* ════════════════════════════════════════════════════════════
     REGISTRATION — PROVIDER
  ════════════════════════════════════════════════════════════ */
  async registerProvider(data) {
    const byEmail = await this.getUserByEmail(data.email);
    if (byEmail) throw new Error('An account with this email already exists.');
    const byUser  = await this.getUserByUsername(data.username);
    if (byUser)  throw new Error('That username is already taken.');

    const periodDays = data.periodDays ?? null; // null = lifetime
    const _now = new Date();
	const subStart = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate(), 0, 0, 0, 0).toISOString();
    const subEnd     = data.paymentStatus === 'free'
      ? null  // free users have no expiry
      : periodDays === null ? null  // lifetime — no expiry
      : calcExpiry(periodDays);
	
	// 1. Upload avatar to Supabase Storage (public bucket)
    let avatarUrl = null;
    if (data.avatarFile?.data) {
      const path = `${data.username}_avatar_${Date.now()}.jpg`;
      avatarUrl = await sbUpload('fixia-avatars', path, data.avatarFile.data, 'image/jpeg');
    }

    // 2. Upload ID photo to Supabase Storage (private bucket)
    let idFileUrl = null;
    if (data.idFile?.data) {
      const path = `${data.username}_id_${Date.now()}.jpg`;
      idFileUrl = await sbUpload('fixia-ids', path, data.idFile.data, 'image/jpeg');
    }

    // 3. Upload portfolio photos (public bucket)
    const portfolioUrls = [];
    for (let i = 0; i < (data.portfolio || []).length; i++) {
      const f = data.portfolio[i];
      const path = `${data.username}_port_${i}_${Date.now()}.jpg`;
      const url = await sbUpload('fixia-portfolio', path, f.data, f.type);
      portfolioUrls.push(url);
    }

    // 3. Fetch package to get accurate ads_free flag
    const provPkg = data.package ? await this.getPackageById(data.package) : null;

    // 4. Create user row
    const userRow = {
      email:             data.email.trim().toLowerCase(),
      username:          data.username.trim().toLowerCase(),
      password_hash:     await hashPassword(data.password),
      first_name:        data.firstName,
      last_name:         data.lastName,
      phone:             data.phone || null,
      role:              'provider',
      status:            'pending',
      package_id:        data.package     || null,
      package_name:      data.packageName || null,
      ads_free:          provPkg?.ads_free ?? false,
      is_inactive:       false,
      is_presignup:      data.is_presignup || false,
      referral_code:     this.genReferralCode(),
      referred_by:       data.referredBy || null,
      avatar_url:        avatarUrl,
      payment_method:    data.paymentMethod    || null,
      payment_reference: data.paymentReference || null,
      payment_amount:    data.paymentAmount    || null,
      payment_status:    data.paymentStatus    || null,
      subscription_start: data.paymentStatus === 'free' ? null : subStart,
      subscription_end:   subEnd,
    };
	
	const provRow = {
      biz_name:       data.bizName,
      cat_main:       null,
      cat_sub:        null,
      biz_desc:       null,
      experience:     data.experience || null,
      region:         data.region     || null,
      region_name:    data.regionName || null,
      province:       data.province   || null,
      province_name:  data.provName   || null,
      city:           data.city       || null,
      city_name:      data.cityName   || null,
      barangay:       data.barangay   || null,
      barangay_name:  data.brgyName   || null,
      street_addr:    data.streetAddr || null,
      id_type:        data.idType     || null,
      id_file_url:    idFileUrl,
      avatar_url:     avatarUrl,
      portfolio_urls: portfolioUrls.length ? portfolioUrls : [],
      package_id:     data.package    || null,
      status:         'pending',
      is_featured:    false,
      is_elite:       false,
      avg_rating:     0.0,
      total_ratings:  0,
    };

    const result = await sbFetch('rpc/register_provider', {
      method: 'POST',
      body: JSON.stringify({ user_data: userRow, prov_data: provRow })
    });
    
    // Handle referral — credit immediately for paid provider plans
    const savedUser = result?.user;
    if (savedUser && data.referredBy) {
      const referrerRows = await sbFetch(`users?referral_code=eq.${data.referredBy}&limit=1`);
      const referrer = referrerRows?.[0];
    if (referrer) {
      // Always create the record — points credited when admin approves provider
      await this.createReferralRecord(referrer.id, savedUser.id);
    }
    }

    return { user: result?.user, provider: result?.provider };
  },

  /* ════════════════════════════════════════════════════════════
     PROVIDERS — QUERIES
  ════════════════════════════════════════════════════════════ */
async getProviders(filters = {}) {
    // Fetch active booking counts and all packages in one go
    const [bookingCounts, allPkgs] = await Promise.all([
      sbFetch('provider_active_booking_counts').then(r => r || []),
      sbFetch('packages?type=eq.provider&select=id,booking_limit').then(r => r || []),
    ]);
    const countMap = Object.fromEntries(bookingCounts.map(b => [b.provider_id, b.active_count]));
    const pkgMap   = Object.fromEntries(allPkgs.map(p => [p.id, p]));

    // Helper: returns true if provider is NOT at their booking limit
    const notFullyBooked = (prov) => {
      const pkg   = pkgMap[prov.package_id];
	  const limit = pkg?.booking_limit;
	  if (!limit || limit >= 999) return true; // 0, null, undefined = unlimited
	  return (countMap[prov.id] || 0) < limit;
    };

    // If filtering by category, find provider IDs via their listings first
    if (filters.catMain || filters.catSub) {
      let lq = 'listings?is_active=eq.true&select=provider_id';
      if (filters.catMain) lq += `&cat_main=eq.${filters.catMain}`;
      if (filters.catSub)  lq += `&cat_sub=eq.${encodeURIComponent(filters.catSub)}`;
      const matchingListings = await sbFetch(lq).then(r => r || []);
      const providerIds = [...new Set(matchingListings.map(l => l.provider_id))];
      if (!providerIds.length) return [];
      let q = `providers?status=eq.approved&id=in.(${providerIds.join(',')})`;
	  if (filters.barangay)      q += `&barangay_name=eq.${encodeURIComponent(filters.barangay)}`;
	  else if (filters.city)     q += `&city_name=eq.${encodeURIComponent(filters.city)}`;
	  else if (filters.province) q += `&province_name=eq.${encodeURIComponent(filters.province)}`;
	  if (filters.elite)    q += `&is_elite=eq.true`;
	  if (filters.featured) q += `&is_featured=eq.true`;
	  if (filters.limit)    q += `&limit=${filters.limit}`;
      const providers = await sbFetch(q).then(r => r || []);
      return this._enrichWithListingCategories(providers.filter(notFullyBooked));
    }

    // No category filter — only return approved providers who have active listings
    const activeProviderIds = await sbFetch('listings?is_active=eq.true&select=provider_id')
      .then(r => [...new Set((r || []).map(l => l.provider_id))]);
    if (!activeProviderIds.length) return [];
    let q = `providers?status=eq.approved&id=in.(${activeProviderIds.join(',')})`;
	if (filters.barangay)      q += `&barangay_name=eq.${encodeURIComponent(filters.barangay)}`;
	else if (filters.city)     q += `&city_name=eq.${encodeURIComponent(filters.city)}`;
	else if (filters.province) q += `&province_name=eq.${encodeURIComponent(filters.province)}`;
	if (filters.elite)    q += `&is_elite=eq.true`;
	if (filters.featured) q += `&is_featured=eq.true`;
	if (filters.limit)    q += `&limit=${filters.limit}`;
    const providers = await sbFetch(q).then(r => r || []);
    return this._enrichWithListingCategories(providers.filter(notFullyBooked));
  },

// Enrich providers with their listing categories for display
async _enrichWithListingCategories(providers) {
  if (!providers.length) return providers;
  try {
  const ids     = providers.map(p => p.id);
  const userIds = providers.map(p => p.user_id);

const [listings, users] = await Promise.all([
  sbFetch(`listings?is_active=eq.true&provider_id=in.(${ids.join(',')})&select=provider_id,cat_main,cat_sub`).then(r => r || []).catch(() => []),
  sbFetch(`users?id=in.(${userIds.join(',')})&select=id,payment_status`).then(r => r || []).catch(() => []),
]);

  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

return providers.map(p => {
  const pListings = listings.filter(l => l.provider_id === p.id);
  const cats      = [...new Set(pListings.map(l => l.cat_sub).filter(Boolean))];
  const catMains  = [...new Set(pListings.map(l => l.cat_main).filter(Boolean))];
  const enriched  = { ...p, _listing_cats: cats, _listing_cats_main: catMains, payment_status: userMap[p.user_id]?.payment_status || null };
  return enriched;
});
  } catch(e) {
    console.error('[Fixia] _enrichWithListingCategories failed:', e.message);
    return providers; // return unenriched rather than nothing
  }
},
  
async getProviderById(id) {
  const rows = await sbFetch(`providers?id=eq.${id}&limit=1`);
  if (!rows?.length) return null;
  const provider = rows[0];
  const users = await sbFetch(`users?id=eq.${provider.user_id}&select=id,payment_status&limit=1`);
  provider.payment_status = users?.[0]?.payment_status || null;
  return provider;
},

  /* Format provider location — skips empty parts, no trailing commas */
  formatLocation(p) {
    return [p.barangay_name, p.city_name, p.province_name, p.region_name]
      .filter(v => v && v.trim())
      .join(', ');
  },

  async getProviderByUserId(userId) {
    const rows = await sbFetch(`providers?user_id=eq.${userId}&limit=1`);
    return rows?.length ? rows[0] : null;
  },

async getAllProviders(filters = {}) {
  let q = 'providers?order=created_at.desc';
  if (filters.status)  q += `&status=eq.${filters.status}`;
  if (filters.catMain) q += `&cat_main=eq.${filters.catMain}`;
  if (filters.limit)   q += `&limit=${filters.limit}`;
  const rows = await sbFetch(q) || [];

  if (rows.length) {
    const providerIds = rows.map(p => p.id);
    const userIds     = rows.map(p => p.user_id);

    // Fetch is_inactive from users table
    const users = await sbFetch(
      `users?id=in.(${userIds.join(',')})&select=id,is_inactive`
    ) || [];
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    // Fetch cat_main from first listing per provider
    const listings = await sbFetch(
      `listings?provider_id=in.(${providerIds.join(',')})&select=provider_id,cat_main,cat_sub&order=created_at.asc`
    ) || [];
    const listingMap = {};
    listings.forEach(l => {
      if (!listingMap[l.provider_id]) listingMap[l.provider_id] = { cat_main: l.cat_main, cat_sub: l.cat_sub };
    });

    return rows.map(p => ({
      ...p,
      is_inactive: userMap[p.user_id]?.is_inactive || false,
      cat_main:    listingMap[p.id]?.cat_main || null,
      cat_sub:     listingMap[p.id]?.cat_sub  || null,
    }));
  }
  return rows;
},

  async updateProvider(id, changes) {
    const p = {};
    if (changes.status       != null) p.status           = changes.status;
	if ('idFileUrl' in changes)       p.id_file_url      = changes.idFileUrl;
    if (changes.isFeatured   != null) p.is_featured       = changes.isFeatured;
    if (changes.isElite      != null) p.is_elite          = changes.isElite;
    if (changes.eliteGrantedAt)       p.elite_granted_at  = changes.eliteGrantedAt;
    if (changes.eliteExpiresAt!=null) p.elite_expires_at  = changes.eliteExpiresAt;
    if (changes.packageId    != null) p.package_id        = changes.packageId;
    if (changes.bizName)              p.biz_name          = changes.bizName;
    if (changes.bizDesc)              p.biz_desc          = changes.bizDesc;
	if (changes.cityName)             p.city_name         = changes.cityName;
    if (changes.provinceName)         p.province_name     = changes.provinceName;
	if (changes.regionName)           p.region_name       = changes.regionName;
    if (changes.barangayName)         p.barangay_name     = changes.barangayName;
    if (changes.streetAddr != null)   p.street_addr       = changes.streetAddr;
    const rows = await sbFetch(`providers?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(p) });
    return rows?.length ? rows[0] : null;
  },

async approveProvider(providerId, userId) {
  const prov = await this.getProviderById(providerId);

  // Look up the package to check if it includes featured
  const pkgId = prov?.package_id;
  const pkgs  = pkgId ? await sbFetch(`packages?id=eq.${pkgId}&limit=1`) : [];
  const pkg   = pkgs?.[0];
  const isFeatured = pkg?.is_featured ?? false;

  const updates = { status: 'approved', isFeatured };
  if (prov?.id_file_url) {
    await sbDelete(prov.id_file_url);
    updates.idFileUrl = null;
  }
  
  await this.updateProvider(providerId, updates);
  await this.updateUser(userId, { status: 'active' });

  // Notify provider of approval
  await this.sendUserMessage(userId, {
    title: '🎉 Application Approved!',
    body:  `Congratulations! Your provider application has been approved. Your account is now fully active — you can now set up your listings, receive inquiries, and start connecting with customers. Welcome to Fixia!`,
    type:  'welcome',
    icon:  '✅',
  });
  
  // Grant featured impression quota if provider has featured package
  if (isFeatured) {
    const quotaSetting = await this.getSetting('featured_impression_quota');
    const quota = parseInt(quotaSetting) || 500;
    await sbFetch(`providers?id=eq.${providerId}`, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: JSON.stringify({ 
        featured_quota:       quota,
        featured_impressions: 0,
      }),
    });
  }

  // Credit 5 referral points to referrer now that provider is approved
  try {
    const user = await this.getUserById(userId);
    const isPaid = user?.payment_status === 'verified' || user?.payment_status === 'paid'
                || user?.payment_method === 'paypal' || user?.payment_method === 'paymongo'
                || user?.payment_method === 'gcash' || user?.payment_method === 'maya'
                || user?.payment_method === 'bank';
    if (isPaid) await this.creditReferralPoints(userId, 5);
  } catch(e) {}
},

async rejectProvider(providerId, userId, reason) {
  // Send message first
  await sbFetch('user_messages', {
    method: 'POST',
    prefer: 'return=minimal',
    body: JSON.stringify({
      user_id: userId,
      title:   'Application Rejected',
      body:    `We regret to inform you that your application has been rejected.\n\nReason:\n"${reason || 'No reason provided.'}"\n\nYour account will be permanently removed. Please contact support if you believe this is a mistake.`,
      type:    'warning',
      icon:    '🚫',
      is_read: false,
    }),
  });
  // Mark user for deletion via force_logout flag — actual delete happens after they read the message
  await sbFetch(`users?id=eq.${userId}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: JSON.stringify({ force_logout: true, status: 'rejected' }),
  });
  // Delete provider files and record immediately
  const prov = await this.getProviderById(providerId);
  if (prov?.id_file_url) await sbDelete(prov.id_file_url);
  if (prov?.avatar_url)  await sbDelete(prov.avatar_url);
  await sbFetch(`providers?id=eq.${providerId}`, { method: 'DELETE', prefer: 'return=minimal' });
},

async approveRegularUser(userId) {
  const user = await this.getUserById(userId);
  if (!user) throw new Error('User not found.');

  // Look up the purchased package using stored pending_package_id
  const pkgId = user.pending_package_id;
  const pkgs  = pkgId ? await sbFetch(`packages?id=eq.${pkgId}&limit=1`) : [];
  const pkg   = pkgs?.[0];
  const periodDays = pkg?.period === 'lifetime' ? null
    : pkg?.period === 'year'  ? 365
    : pkg?.period === 'month' ? 30
	: pkg?.period === '3month' ? 90
	: pkg?.period === '6month' ? 180
    : parseInt(pkg?.period)   || 30;
  const subEnd = periodDays ? calcExpiry(periodDays) : null;

  await sbFetch(`users?id=eq.${userId}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: JSON.stringify({
      status:             'active',
      payment_status:     'verified',
      package_id:         pkg?.id          || 'regular-free',
      package_name:       pkg?.name        || 'Free',
      ads_free:           pkg?.ads_free    || false,
      subscription_start: new Date().toISOString(),
      subscription_end:   subEnd,
      pending_package_id: null,
    }),
  });
  // Send built-in message
  await this.sendUserMessage(userId, {
    title: '🎉 Payment Verified!',
    body:  'Great news! Your payment has been verified and your account is now fully activated. You can now enjoy all the benefits of your plan. Thank you for choosing Fixia!',
    type:  'success',
    icon:  '✅',
  });
    try {
    await this.creditReferralPoints(userId, 3);
  } catch(e) {}
},

async rejectRegularUser(userId, reason) {
  // Send message first before deleting
  await this.sendUserMessage(userId, {
    title: 'Payment Not Verified',
    body:  `We regret to inform you that your application has been rejected.\n\nReason:\n"${reason || 'No reason provided.'}"\n\nYour account will be permanently removed. Please contact support if you believe this is a mistake.`,
    type:  'warning',
    icon:  '🚫',
  });
  // Mark for deletion — actual delete happens after they read the message
  await sbFetch(`users?id=eq.${userId}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: JSON.stringify({ force_logout: true, status: 'rejected' }),
  });
},

async setProviderNeedsCompliance(providerId, userId, reason) {
  await this.updateProvider(providerId, { status: 'needs_compliance' });
  // Send built-in message to provider
  await sbFetch('user_messages', {
    method: 'POST',
    prefer: 'return=minimal',
    body: JSON.stringify({
      user_id: userId,
      title:   'Account Approval Pending',
      body:    `Your application is currently on hold for the following reason:\n\n<strong>${reason}</strong>\n\nPlease resolve this issue and connect to our support team. The approval process will continue once the requirement has been completed.`,
      type:    'warning',
      icon:    '⚠️',
      is_read: false,
    }),
  });
},

  /* Grant / revoke Fixia Elite ─────────────────────────────── */
  async grantElite(providerId, expiresAt) {
    return await this.updateProvider(providerId, {
      isElite:        true,
      eliteGrantedAt: new Date().toISOString(),
      eliteExpiresAt: expiresAt || null,
    });
  },

  async revokeElite(providerId) {
    return await this.updateProvider(providerId, {
      isElite:        false,
      eliteExpiresAt: null,
    });
  },

  /* Auto-expire Elite (call on homepage load) ──────────────── */
  async checkEliteExpiry() {
    const now = new Date().toISOString();
    const expired = await sbFetch(
      `providers?is_elite=eq.true&elite_expires_at=lt.${now}`
    ) || [];
    for (const p of expired) {
      await this.updateProvider(p.id, { isElite: false, eliteExpiresAt: null });
    }
  },


/* ════════════════════════════════════════════════════════════
   SAVED PROVIDERS — Hybrid: localStorage (fast) + Supabase (sync)
════════════════════════════════════════════════════════════ */
_savedKey() {
  const s = this.getSession();
  return s ? `fixia_saved_${s.userId}` : 'fixia_saved_guest';
},

getSaved() {
  try { return JSON.parse(localStorage.getItem(this._savedKey()) || '[]'); }
  catch { return []; }
},

isSaved(id) {
  return this.getSaved().some(s => s.id === id);
},

saveProvider(p) {
  if (!this.getSession()) return;
  const saved = this.getSaved();
  if (saved.find(s => s.id === p.id)) return;
  saved.push({
    id: p.id, bizName: p.biz_name, catSub: p.cat_sub,
    catMain: p.cat_main, avgRating: p.avg_rating,
    totalRatings: p.total_ratings, cityName: p.city_name,
    isElite: p.is_elite, avatarUrl: p.avatar_url || null,
    savedAt: new Date().toISOString()
  });
  localStorage.setItem(this._savedKey(), JSON.stringify(saved));
  // Sync to DB (non-blocking — won't slow down the UI)
  const s = this.getSession();
  if (s) sbFetch('saved_providers', {
    method: 'POST', prefer: 'return=minimal',
    body: JSON.stringify({ user_id: s.userId, provider_id: p.id })
  }).catch((e) => { console.error('[Fixia] saveProvider DB write failed:', e.message, JSON.stringify({ user_id: s.userId, provider_id: p.id })); });
},

unsaveProvider(id) {
  localStorage.setItem(this._savedKey(),
    JSON.stringify(this.getSaved().filter(s => s.id !== id))
  );
  // Sync to DB (non-blocking)
  const s = this.getSession();
  if (s) sbFetch(
    `saved_providers?user_id=eq.${s.userId}&provider_id=eq.${id}`,
    { method: 'DELETE', prefer: 'return=minimal' }
  ).catch(() => {});
},

clearSaved() {
  localStorage.removeItem(this._savedKey());
  // Sync to DB (non-blocking)
  const s = this.getSession();
  if (s) sbFetch(
    `saved_providers?user_id=eq.${s.userId}`,
    { method: 'DELETE', prefer: 'return=minimal' }
  ).catch(() => {});
},

// Compares DB vs localStorage, merges any differences
async syncSaved() {
  const s = this.getSession();
  if (!s) return;
  try {
    // 1. Get DB rows (just IDs + saved_at, very lightweight)
    const rows = await sbFetch(
      `saved_providers?user_id=eq.${s.userId}&order=saved_at.desc`
    ) || [];

    const local = this.getSaved();
    const localIds = new Set(local.map(p => p.id));
    const dbIds    = new Set(rows.map(r => r.provider_id));

    // 2. Find what's in DB but missing from localStorage
    const missingIds = rows
      .map(r => r.provider_id)
      .filter(id => !localIds.has(id));

    // 3. Find what's in localStorage but removed from DB (unsaved on another device)
    const removedIds = local
      .map(p => p.id)
      .filter(id => !dbIds.has(id));

    // 4. Nothing to do — already in sync
    if (!missingIds.length && !removedIds.length) return;

    // 5. Fetch full details for missing providers in one query
    let merged = [...local];
    if (missingIds.length) {
      const providers = await sbFetch(
        `providers?id=in.(${missingIds.join(',')})&status=eq.approved`
      ) || [];
      const newEntries = providers.map(p => ({
        id: p.id, bizName: p.biz_name, catSub: p.cat_sub,
        catMain: p.cat_main, avgRating: p.avg_rating,
        totalRatings: p.total_ratings, cityName: p.city_name,
        isElite: p.is_elite, avatarUrl: p.avatar_url || null,
        savedAt: new Date().toISOString()
      }));
      merged = [...merged, ...newEntries];
    }

    // 6. Remove anything deleted on another device
    if (removedIds.length) {
      const removedSet = new Set(removedIds);
      merged = merged.filter(p => !removedSet.has(p.id));
    }

    // 7. Write merged result back to localStorage
    localStorage.setItem(this._savedKey(), JSON.stringify(merged));
  } catch(e) { /* silent — localStorage still works */ }
},
 

  /* ════════════════════════════════════════════════════════════
     LISTINGS
  ════════════════════════════════════════════════════════════ */
  async getListingsByProvider(providerId) {
    return await sbFetch(`listings?provider_id=eq.${providerId}&order=created_at.asc`) || [];
  },

  async addListing(data) {
    // Block if provider not yet approved
    const prov = await this.getProviderById(data.providerId);
    if (prov?.status !== 'approved') {
      throw new Error('Listing access is temporarily locked while your account is under review.');
    }
    // Enforce listing limit based on package
    const pkg = await this.getPackageById(prov?.package_id);
    const limit = pkg?.listing_limit ?? 5;
    if (limit < 999) {
      const existing = await this.getListingsByProvider(data.providerId);
      if (existing.length >= limit) {
        throw new Error(`Your ${pkg?.name || 'current'} plan allows up to ${limit} listings. Upgrade to add more.`);
      }
    }
    const row = {
      provider_id:  data.providerId,
      title:        data.title,
      description:  data.description || '',
      cat_main:     data.catMain,
      cat_sub:      data.catSub,
      price_label:  data.priceLabel || '',
      is_active:    true,
	  other_service_desc: data.otherServiceDesc || null,
    };
    const rows = await sbFetch('listings', { method: 'POST', body: JSON.stringify(row) });
    return rows?.length ? rows[0] : null;
  },

  async updateListing(id, changes) {
  // ── Limit check when re-activating ───────────────────────
  if (changes.isActive === true) {
    const listing    = await sbFetch(`listings?id=eq.${id}&limit=1`).then(r => r?.[0]);
    if (listing) {
      const provider = await this.getProviderById(listing.provider_id);
      const pkg      = await this.getPackageById(provider?.package_id);
      const limit    = pkg?.listing_limit ?? 0;
      if (limit < 999) {
        const active = await sbFetch(
          `listings?provider_id=eq.${listing.provider_id}&is_active=eq.true`
        ) || [];
        if (active.length >= limit) {
          throw new Error(
            `Your ${pkg?.name || 'current'} plan allows up to ${limit} active listing${limit !== 1 ? 's' : ''}. ` +
            `Deactivate another listing first, or upgrade your plan.`
          );
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
  const rows = await sbFetch(`listings?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(p) });
  return rows?.length ? rows[0] : null;
},

  async deleteListing(id) {
    await sbFetch(`listings?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
  },

  async getUncategorizedListings() {
    return await sbFetch(
      `listings?cat_main=eq.other&order=created_at.asc`
    ) || [];
  },

  async reassignListing(id, catMain, catSub) {
    await this.updateListing(id, {
      catMain,
      catSub,
      otherServiceDesc: null,   // clear once resolved
    });
  },
  
  /* ════════════════════════════════════════════════════════════
     RATINGS & REVIEWS
  ════════════════════════════════════════════════════════════ */
  async getRatingsByProvider(providerId) {
    return await sbFetch(`ratings?provider_id=eq.${providerId}&order=created_at.desc`) || [];
  },

  async addRating(data) {
    const userIp = await this.getUserIP();
    const row = {
      provider_id:     data.providerId,
      regular_user_id: data.userId,
      inquiry_id:      data.inquiryId,
      stars:           data.stars,
      comment:         data.comment || '',
      user_ip:         userIp,
	  is_anonymous:    data.anonymous || false,
      display_name:    data.displayName || '',
    };
    const rows = await sbFetch('ratings', { method: 'POST', body: JSON.stringify(row) });

    // Recalculate provider avg_rating
    const all = await this.getRatingsByProvider(data.providerId);
    const avg = all.length ? (all.reduce((s, r) => s + r.stars, 0) / all.length) : 0;
    await sbFetch(`providers?id=eq.${data.providerId}`, {
      method: 'PATCH',
      body: JSON.stringify({ avg_rating: Math.round(avg * 10) / 10, total_ratings: all.length }),
      prefer: 'return=minimal'
    });

    // Notify provider
    const provider = await this.getProviderById(data.providerId);
    if (provider) {
      const user = await this.getUserById(provider.user_id);
      if (user) {
        await this.sendEmail('rating_notify_provider', {
          email:     user.email,
          bizName:   provider.biz_name,
          stars:     data.stars,
          comment:   data.comment || '(no comment)',
          newAvg:    Math.round(avg * 10) / 10,
        });
      }
    }
    return rows?.length ? rows[0] : null;
  },

  /* ════════════════════════════════════════════════════════════
     PACKAGES  (admin-configurable, never hardcoded in UI)
  ════════════════════════════════════════════════════════════ */
  async getRegularPackages() {
    return await sbFetch('packages?type=eq.regular&is_active=eq.true&order=sort_order.asc') || [];
  },

  async getProviderPackages() {
    return await sbFetch('packages?type=eq.provider&is_active=eq.true&order=sort_order.asc') || [];
  },

  async getAllPackages() {
    return await sbFetch('packages?order=type.asc,sort_order.asc') || [];
  },

  async getPackageById(id) {
    if (!id) return null;
    const rows = await sbFetch(`packages?id=eq.${id}&limit=1`);
    return rows?.length ? rows[0] : null;
  },

  async createPackage(data) {
    const slugId = data.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const row = {
      id:            slugId,
      type:          data.type,
      name:          data.name,
      price:         data.price,
      period:        data.period || 'month',
      booking_limit: data.bookingLimit ?? 5,
	  referral_points_required: data.referralPointsRequired ?? 0,
      ads_free:      data.adsFree ?? false,
      is_featured:   data.isFeatured ?? false,
      features:      data.features || [],
	  popular:       data.popular ?? false,
      badge_label:   data.badgeLabel || 'Popular',
      icon:          data.icon || '📦',
      is_active:     data.isActive ?? true,
      sort_order:    data.sortOrder ?? 99,
    };
    const rows = await sbFetch('packages', { method: 'POST', body: JSON.stringify(row) });
    return rows?.length ? rows[0] : null;
  },

  async updatePackage(id, changes) {
    const p = {};
    const map = {
      name:'name', price:'price', period:'period', listingLimit:'listing_limit',
      bookingLimit:'booking_limit',
	  referralPointsRequired:'referral_points_required',
      adsFree:'ads_free', isFeatured:'is_featured', features:'features',
      popular:'popular', badgeLabel:'badge_label', icon:'icon', isActive:'is_active', sortOrder:'sort_order', type:'type'
    };
    Object.entries(map).forEach(([k, dbCol]) => {
      if (changes[k] != null) p[dbCol] = changes[k];
    });
    await sbFetch(`packages?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(p), prefer: 'return=minimal' });
  },

  async deletePackage(id) {
    const PERMANENT = ['regular-free','regular-plus','regular-pro','regular-starter','provider-free','provider-basic','provider-pro','provider-premium'];
    if (PERMANENT.includes(id)) throw new Error('This is a permanent package and cannot be deleted.');
    await sbFetch(`packages?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
  },

  /* ════════════════════════════════════════════════════════════
     PASSWORD RESET
  ════════════════════════════════════════════════════════════ */
  async sendPasswordReset(email) {
    const user = await this.getUserByEmail(email);
    if (!user) return; // Silent — don't reveal if email exists

    const token   = genId().replace(/-/g, '');
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    // Store token
    await sbFetch('password_resets', {
      method: 'POST',
      body: JSON.stringify({ user_id: user.id, token, expires_at: expires, used: false })
    });

    // Send email
    await this.sendEmail('reset_password', {
      fullName: `${user.first_name} ${user.last_name}`,
      email:    user.email,
      token,
    });
  },

  async validateResetToken(token) {
    const rows = await sbFetch(
      `password_resets?token=eq.${token}&used=eq.false&expires_at=gt.${new Date().toISOString()}&limit=1`
    );
    return rows?.length ? rows[0] : null;
  },

  async consumeResetToken(token, newPassword) {
    const record = await this.validateResetToken(token);
    if (!record) throw new Error('Invalid or expired reset link.');
    await this.updateUser(record.user_id, { password: newPassword });
    await sbFetch(`password_resets?id=eq.${record.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ used: true }),
      prefer: 'return=minimal'
    });
  },

  /* ════════════════════════════════════════════════════════════
     ADMIN — STATS
  ════════════════════════════════════════════════════════════ */
async getStats() {
    const [users, providers, packages] = await Promise.all([
      sbFetch('users?select=id,role,status,created_at').then(r => r || []),
      sbFetch('providers?select=id,status,is_elite,is_featured,avg_rating').then(r => r || []),
      sbFetch('packages?select=id,type,name,price,is_active').then(r => r || []),
    ]);

    const regulars        = users.filter(u => u.role === 'regular');
    const providerUsers   = users.filter(u => u.role === 'provider');
    const pendingProviders= providers.filter(p => p.status === 'pending');
    const approvedProv    = providers.filter(p => p.status === 'approved');
    const eliteCount      = providers.filter(p => p.is_elite).length;

    return {
      totalUsers:        users.length,
      totalRegulars:     regulars.length,
      totalProviders:    providerUsers.length,
      pendingProviders:  pendingProviders.length,
      approvedProviders: approvedProv.length,
      eliteProviders:    eliteCount,
      totalPackages:     packages.length,
    };
  },

  /* ════════════════════════════════════════════════════════════
     POP-UP AD SYSTEM
     Random trigger: mix of time-based + navigation-based.
     Free regular users only. Stored in sessionStorage.
  ════════════════════════════════════════════════════════════ */
AD_CONFIG: {
  actionsPerAd:          3,
  minTimeBetween:        2 * 60 * 1000,
  duration:              5,
  inlineInterval:        4,
  inlineIntervalSearch:  4,
},

async loadAdConfig() {
  try {
    const actions  = await this.getSetting('ad_actions_per_popup');
    const minutes  = await this.getSetting('ad_min_minutes');
    const duration = await this.getSetting('ad_skip_seconds');
    const interval       = await this.getSetting('inline_ad_interval');
    const intervalSearch = await this.getSetting('inline_ad_interval_search');
    if (actions        && !isNaN(actions))        this.AD_CONFIG.actionsPerAd         = parseInt(actions);
    if (minutes        && !isNaN(minutes))        this.AD_CONFIG.minTimeBetween       = parseFloat(minutes) * 60 * 1000;
    if (duration       && !isNaN(duration))       this.AD_CONFIG.duration             = parseInt(duration);
    if (interval       && !isNaN(interval))       this.AD_CONFIG.inlineInterval       = parseInt(interval);
    if (intervalSearch && !isNaN(intervalSearch)) this.AD_CONFIG.inlineIntervalSearch = parseInt(intervalSearch);
  } catch(e) {
    console.warn('[Fixia Ads] Using default AD_CONFIG — DB settings unavailable');
  }
},

  /*
   * Call FX.adTrigger('action_name') at natural pause points:
   *   search_done, inquiry_sent, booking_confirmed,
   *   provider_loaded, job_accepted, category_browsed
   *
   * Ad only fires if:
   *   1. User is a free regular user (not Plus, not provider, not admin)
   *   2. At least AD_CONFIG.actionsPerAd major actions since last ad
   *   3. At least AD_CONFIG.minTimeBetween ms since last ad
   */
  adTrigger(actionName) {
  const session = this.getSession();
  if (!session) return;
  if (session.role === 'admin') return;
  if (session.adsFree) return;

    // Increment action count
    const countKey = 'fx_ad_action_count';
    let count = parseInt(sessionStorage.getItem(countKey) || '0') + 1;
    sessionStorage.setItem(countKey, count);

    // Check if we hit the threshold
    if (count < this.AD_CONFIG.actionsPerAd) return;

    // Check minimum time between ads
    const lastShown = parseInt(sessionStorage.getItem('fx_last_ad') || '0');
    if (Date.now() - lastShown < this.AD_CONFIG.minTimeBetween) return;

    // Reset count and show ad after short natural delay
    sessionStorage.setItem(countKey, '0');
    const delay = 600 + Math.random() * 800; // 0.6 - 1.4s after action completes
    setTimeout(() => this._showPopupAd(), delay);
  },

async initAds() {
  await this.loadAdConfig();
  await this.loadPopupAds();
  // ── Refresh adsFree from DB to catch admin-applied changes ──
  await this._refreshAdsState();
},

async _refreshAdsState() {
  try {
    const session = this.getSession();
    if (!session) return;
    const user = await this.getUserById(session.userId);
    if (!user) return;
    // If DB says ads_free changed, update session immediately
    if (user.ads_free !== session.adsFree) {
      this.setSession({ ...session, adsFree: user.ads_free });
    }
  } catch(e) { /* silent — don't block page load */ }
},

  _popupAds: [
    { icon:'🏗️', title:'BuildRight Construction', sub:'Free estimates for any renovation project', cta:'Get Free Quote', color:'#1E3048' },
    { icon:'🔐', title:'SafeHome Security', sub:'CCTV & alarm systems — professional install', cta:'Learn More', color:'#065F46' },
    { icon:'🚗', title:'AutoCare Plus', sub:"Book your car's PMS today — free pickup", cta:'Book Now', color:'#7B2D00' },
    { icon:'💡', title:'PowerSave Solar', sub:'Cut your Meralco bill by up to 70%', cta:'Get Quote', color:'#1E3A8A' },
    { icon:'🧹', title:'CleanPro Services', sub:'Deep cleaning starting at ₱599', cta:'Book Now', color:'#4A1D96' },
  ],

  async _showPopupAd() {
    if (document.getElementById('fx-popup-ad')) return; // already showing
    sessionStorage.setItem('fx_last_ad', Date.now());

    // Always fetch fresh from Supabase so completed/paused ads are excluded
    try {
      const fresh = await this.getAds('popup');
      if (fresh.length) {
        FX._popupAds = fresh.map(ad => ({
          id:    ad.id,
          icon:  ad.icon  || '📢',
          title: ad.title,
          sub:   ad.description || '',
          cta:   ad.cta_label   || 'Learn More',
          color: ad.bg_color    || '#0f2027',
          link:  ad.link_url    || '#',
        }));
      }
    } catch(e) { /* fallback to existing _popupAds if fetch fails */ }

    const ad = this._nextRoundRobin('popup', this._popupAds);
    if (!ad) return;
    if (ad.id) sbFetch('rpc/increment_ad_impression', { method:'POST', prefer:'return=minimal', body: JSON.stringify({ ad_id: ad.id }) }).catch(()=>{});
	
    let countdown = this.AD_CONFIG.duration;

    const overlay = document.createElement('div');
    overlay.id = 'fx-popup-ad';
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:99999;
      background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);
      display:flex;align-items:center;justify-content:center;padding:1rem;
      animation:fxAdIn 0.3s ease;
    `;
    overlay.innerHTML = `
      <style>
        @keyframes fxAdIn{from{opacity:0;transform:scale(0.92);}to{opacity:1;transform:none;}}
        #fx-popup-ad .ad-card{
          background:#fff;border-radius:20px;padding:2rem 1.5rem;
          max-width:340px;width:100%;text-align:center;position:relative;
          box-shadow:0 20px 60px rgba(0,0,0,0.3);
        }
        #fx-popup-ad .ad-skip-btn{
          position:absolute;top:12px;right:14px;
          background:#f0f0f0;border:none;border-radius:20px;
          font-size:0.72rem;font-weight:700;cursor:pointer;
          padding:4px 12px;color:#666;font-family:inherit;
        }
        #fx-popup-ad .ad-skip-btn.ready{background:#FF5A1F;color:#fff;}
        #fx-popup-ad .ad-badge{
          display:inline-block;font-size:0.6rem;font-weight:700;
          letter-spacing:0.1em;text-transform:uppercase;
          color:#aaa;margin-bottom:0.75rem;
        }
        #fx-popup-ad .ad-icon-big{font-size:3.5rem;margin-bottom:0.75rem;}
        #fx-popup-ad .ad-card-title{font-size:1.1rem;font-weight:800;color:#0F1B2D;margin-bottom:4px;}
        #fx-popup-ad .ad-card-sub{font-size:0.83rem;color:#8896A5;line-height:1.5;margin-bottom:1.25rem;}
        #fx-popup-ad .ad-cta{
          display:inline-block;padding:0.7rem 1.75rem;
          background:${ad.color};color:#fff;
          border:none;border-radius:10px;font-size:0.88rem;font-weight:700;
          cursor:pointer;font-family:inherit;
        }
        #fx-popup-ad .ad-upgrade{
          margin-top:0.75rem;font-size:0.72rem;color:#aaa;
        }
        #fx-popup-ad .ad-upgrade a{color:#FF5A1F;font-weight:700;text-decoration:none;}
      </style>
      <div class="ad-card">
        <button class="ad-skip-btn" id="fxAdSkip" disabled>Skip ${countdown}s</button>
        <div class="ad-badge">Advertisement</div>
        <div class="ad-icon-big">${esc(ad.icon)}</div>
        <div class="ad-card-title">${esc(ad.title)}</div>
        <div class="ad-card-sub">${esc(ad.sub)}</div>
        <button class="ad-cta" id="fxAdCta">${esc(ad.cta)}</button>
        <div class="ad-upgrade">
          Remove ads? <a href="profile.html?tab=plan">Upgrade to Fixia Plus</a>
        </div>
      </div>`;

    document.body.appendChild(overlay);

	const ctaBtn = overlay.querySelector('#fxAdCta');
    ctaBtn.addEventListener('click', () => {
	  if (ad.id) sbFetch('rpc/increment_ad_click', { method:'POST', prefer:'return=minimal', body: JSON.stringify({ ad_id: ad.id }) }).catch(()=>{});
      window.open(ad.link || '#', '_blank');
      overlay.remove();
    });
	
    // Countdown timer
    const skipBtn = overlay.querySelector('#fxAdSkip');
    const timer = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(timer);
        skipBtn.textContent = 'Skip ✕';
        skipBtn.classList.add('ready');
        skipBtn.disabled = false;
        skipBtn.onclick = () => overlay.remove();
      } else {
        skipBtn.textContent = `Skip ${countdown}s`;
      }
    }, 1000);
  },

  /* ════════════════════════════════════════════════════════════
     EMAIL
  ════════════════════════════════════════════════════════════ */
  async sendEmail(type, data) {
    try {
      const res = await fetch(EMAIL_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data })
      });
      return res.ok;
    } catch(e) {
      console.error('[Fixia] Email send failed:', e);
      return false;
    }
  },

  // Generate and send OTP — stores in sessionStorage for verification
  async sendOTP(email) {
    const res = await fetch('/api/send-otp', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to send OTP.');
    return true;
  },

  // Verify OTP — returns true if valid, throws if invalid/expired
async verifyOTP(email, inputOtp) {
  const res = await fetch('/api/verify-otp', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, otp: inputOtp.trim() }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Verification failed.');
  if (!data.valid) throw new Error(data.error || 'Incorrect code. Please try again.');
  return true;
},
  
  async updateSubscription(userId, periodDays) {
    const u = await this.getUserById(userId);
    if (!u) throw new Error('User not found');

    const newExpiry = calcExpiry(periodDays, u.subscription_end);

    await sbFetch(`users?id=eq.${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        subscription_end:   newExpiry,
        subscription_start: u.subscription_end && new Date(u.subscription_end) > new Date()
          ? u.subscription_start
          : new Date().toISOString(),
        status:          'active',
        reminder_7_sent: false,
        reminder_3_sent: false,
        expiry_sent:     false,
        followup_sent:   false,
      })
    });

    await sbFetch('subscription_history', {
      method: 'POST',
      body: JSON.stringify({
        user_id:     userId,
        package_id:  u.package_id,
        period_days: periodDays,
        started_at:  new Date().toISOString(),
        expires_at:  newExpiry,
      })
    });

    return newExpiry;
  },

/* ════════════════════════════════════════════════════════════
   SUBSCRIPTION EXPIRY CHECK + AUTO-DOWNGRADE
════════════════════════════════════════════════════════════ */
async checkAndDowngrade(userId) {
  const user = await this.getUserById(userId);
  if (!user || !user.subscription_end) return; // free or lifetime — skip
  if (user.package_id === 'regular-free' || user.package_id === 'provider-free') return;

  const now    = new Date();
  const expiry = new Date(user.subscription_end);
  if (expiry > now) return; // not expired yet — skip

  // ── Expired — downgrade to free ──────────────────────────
  const freePackageId = user.role === 'provider' ? 'provider-free' : 'regular-free';
  await sbFetch(`users?id=eq.${userId}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: JSON.stringify({
      package_id:         freePackageId,
      package_name:       'Free',
      ads_free:           false,
      subscription_end:   null,
      subscription_start: null,
      payment_status:     'expired',
    }),
  });

  // ── Update session immediately so ads and perks reflect right away ──
  const currentSession = this.getSession();
  if (currentSession) {
    this.setSession({
      ...currentSession,
      adsFree:   false,
      packageId: freePackageId,
    });
  }

  // ── Provider: deactivate excess listings ─────────────────
  if (user.role === 'provider') {
    const prov = await this.getProviderByUserId(userId);
    if (prov) {
      // Update provider package
      await sbFetch(`providers?user_id=eq.${userId}`, {
        method: 'PATCH',
        prefer: 'return=minimal',
        body: JSON.stringify({ package_id: 'provider-free' }),
      });

	  // Get all listings for this provider — deactivate them all (soft delete)
      const listings = await sbFetch(
        `listings?provider_id=eq.${prov.id}&is_active=eq.true&order=created_at.desc`
      ) || [];

      const toDeactivate = listings; // all active listings get hidden on expiry

      if (toDeactivate.length > 0) {
        const ids = toDeactivate.map(l => l.id).join(',');
        await sbFetch(`listings?id=in.(${ids})`, {
          method: 'PATCH',
          prefer: 'return=minimal',
          body: JSON.stringify({ is_active: false, deactivated_reason: 'subscription_expired' }),
        });
      }

      if (toDeactivate.length > 0) {
        await sbFetch('user_messages', {
          method: 'POST',
          prefer: 'return=minimal',
          body: JSON.stringify({
            user_id: userId,
            title:   'Subscription Expired — Listings Hidden',
            body:    `Your subscription has expired and your account has been downgraded to Free. ${toDeactivate.length} listing(s) have been hidden. Renew or upgrade your plan to restore them.`,
            type:    'warning',
            icon:    '⚠️',
            is_read: false,
          }),
        });
      } else {
        await sbFetch('user_messages', {
          method: 'POST',
          prefer: 'return=minimal',
          body: JSON.stringify({
            user_id: userId,
            title:   'Subscription Expired',
            body:    'Your subscription has expired and your account has been moved to the Free plan. Renew or upgrade your plan to continue enjoying Fixia benefits.',
            type:    'warning',
            icon:    '⚠️',
            is_read: false,
          }),
        });
      }
    }
  } else {
    // Regular user notification
    await sbFetch('user_messages', {
      method: 'POST',
      prefer: 'return=minimal',
      body: JSON.stringify({
        user_id: userId,
        title:   'Subscription Expired',
        body:    'Your subscription has expired and your account has been moved to the Free plan. Pop-up ads have been re-enabled. Renew your plan anytime from your Profile.',
        type:    'warning',
        icon:    '⚠️',
        is_read: false,
      }),
    });
  }
},

/* ════════════════════════════════════════════════════════════
   UPGRADE — CALCULATE CARRYOVER
════════════════════════════════════════════════════════════ */
async calculateUpgrade(userId, newPackageId) {
  const user       = await this.getUserById(userId);
  const newPkg     = await this.getPackageById(newPackageId);
  const currentPkg = await this.getPackageById(user.package_id);
  if (!user || !newPkg || !currentPkg) throw new Error('Package not found.');

  const now          = new Date();
  const subEnd       = user.subscription_end ? new Date(user.subscription_end) : now;
  const remainingMs  = Math.max(0, subEnd - now);
  const remainingDays = Math.floor(remainingMs / 86400000);

  // Remaining value = (remaining days / total days of current plan) × current plan price
  const periodDays = { month: 30, '3month': 90, '6month': 180, year: 365, lifetime: null };
  const currentTotalDays = periodDays[currentPkg.period] || 30;
  const remainingValue = parseFloat(
    ((remainingDays / currentTotalDays) * currentPkg.price).toFixed(2)
  );

  // Carryover days = remaining value / new plan daily rate
    const newPeriodDays = periodDays[newPkg.period] ?? null; // null = lifetime
    const carryoverDays = newPeriodDays === null ? 0 : Math.round(remainingValue / (newPkg.price / newPeriodDays));
    
    return {
      remainingDays,
      remainingValue,
      newPlanPrice:  newPkg.price,
      newPeriodDays,
      carryoverDays,
      totalDays:     newPeriodDays === null ? null : newPeriodDays + carryoverDays,
    };
},

/* ════════════════════════════════════════════════════════════
   UPGRADE — SUBMIT REQUEST
════════════════════════════════════════════════════════════ */
async requestUpgrade(data) {
  // data: { userId, providerId, currentPackageId, newPackageId,
  //         currentSubEnd, remainingDays, remainingValue,
  //         newPlanPrice, carryoverDays,
  //         paymentMethod, paymentReference, paymentAmount }
  const row = {
    user_id:            data.userId,
    provider_id:        data.providerId || null,
    current_package_id: data.currentPackageId,
    new_package_id:     data.newPackageId,
    current_sub_end:    data.currentSubEnd || null,
    remaining_days:     data.remainingDays || 0,
    remaining_value:    data.remainingValue || 0,
    new_plan_price:     data.newPlanPrice || 0,
    carryover_days:     data.carryoverDays || 0,
    payment_method:     data.paymentMethod || null,
    payment_reference:  data.paymentReference || null,
    payment_amount:     data.paymentAmount || null,
    status:             'pending',
  };
  const rows = await sbFetch('upgrade_requests', { method: 'POST', body: JSON.stringify(row) });
  return rows?.[0] || null;
},

/* ════════════════════════════════════════════════════════════
   UPGRADE — GET REQUESTS (admin)
════════════════════════════════════════════════════════════ */
async getUpgradeRequests(status = null) {
  let q = 'upgrade_requests?archived_at=is.null&order=created_at.desc';
  if (status) q += `&status=eq.${status}`;
  return await sbFetch(q) || [];
},

async getUpgradeHistory(limit = 50) {
  return await sbFetch(
    `upgrade_requests?archived_at=not.is.null&order=archived_at.desc&limit=${limit}`
  ) || [];
},

async getUserUpgradeRequest(userId) {
  const rows = await sbFetch(
    `upgrade_requests?user_id=eq.${userId}&status=eq.pending&limit=1`
  ) || [];
  return rows[0] || null;
},

/* ════════════════════════════════════════════════════════════
   UPGRADE — APPROVE (admin)
════════════════════════════════════════════════════════════ */
async approveUpgrade(requestId) {
  const rows = await sbFetch(`upgrade_requests?id=eq.${requestId}&limit=1`);
  const req  = rows?.[0];
  if (!req) throw new Error('Upgrade request not found.');

  const newPkg      = await this.getPackageById(req.new_package_id);
  const periodDays  = { month: 30, '3month': 90, '6month': 180, year: 365, lifetime: null };
  const newPeriodDays = periodDays[newPkg.period] ?? null;

  // New subscription end = new plan days + carryover days
  const totalDays  = newPeriodDays === null ? null
    : (newPeriodDays + (req.carryover_days || 0));

  const _now = new Date();
  const subStart = new Date(
    _now.getFullYear(), _now.getMonth(), _now.getDate(), 0, 0, 0, 0
  ).toISOString();
  const subEnd = totalDays === null ? null : calcExpiry(totalDays);

  // Update user
  await sbFetch(`users?id=eq.${req.user_id}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
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
    }),
  });

  // Update provider package if applicable
  if (req.provider_id) {
    await sbFetch(`providers?id=eq.${req.provider_id}`, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: JSON.stringify({ package_id: req.new_package_id }),
    });
  }

  // Re-activate provider listings that were hidden on expiry
  if (req.provider_id) {
    await sbFetch(`listings?provider_id=eq.${req.provider_id}&is_active=eq.false&deactivated_reason=eq.subscription_expired`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: true, deactivated_reason: null }),
    }
  );
  }
  
  // Notify user
  await sbFetch('user_messages', {
    method: 'POST',
    prefer: 'return=minimal',
    body: JSON.stringify({
      user_id: req.user_id,
      title:   'Upgrade Approved! 🎉',
      body:    `Your upgrade to ${newPkg.name} has been approved. Your unused balance from your current plan has been automatically credited toward your new subscription.${subEnd ? ' Your new subscription is valid until ' + new Date(subEnd).toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' }) + '.' : ''}`,
      type:    'success',
      icon:    '🎉',
      is_read: false,
    }),
  });

  // Soft-delete: archive the request instead of deleting it
    await sbFetch(`upgrade_requests?id=eq.${requestId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status:         'approved',
        archived_at:    new Date().toISOString(),
        archive_reason: 'approved_by_admin',
      }),
    });

  return { subStart, subEnd, totalDays };
},

/* ════════════════════════════════════════════════════════════
   UPGRADE — REJECT (admin)
════════════════════════════════════════════════════════════ */
async rejectUpgrade(requestId, reason) {
  const rows = await sbFetch(`upgrade_requests?id=eq.${requestId}&limit=1`);
  const req  = rows?.[0];
  if (!req) throw new Error('Upgrade request not found.');

  await sbFetch(`upgrade_requests?id=eq.${requestId}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: JSON.stringify({
      status:         'rejected',
      notes:          reason || null,
      reviewed_at:    new Date().toISOString(),
      archived_at:    new Date().toISOString(),
      archive_reason: 'rejected_by_admin',
    }),
  });

  // Notify user
  await sbFetch('user_messages', {
    method: 'POST',
    prefer: 'return=minimal',
    body: JSON.stringify({
      user_id: req.user_id,
      title:   'Upgrade Request Not Approved',
      body:    `Your upgrade request could not be approved.${reason ? ' Reason: ' + reason : ' Please contact support if you believe this is a mistake.'}`,
      type:    'warning',
      icon:    '❌',
      is_read: false,
    }),
  });
}, 

};

/* ══════════════════════════════════════════════════════════════
   AUTO-INIT: Pop-up ads on every page load
   (only fires for free regular users)
══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => FX.initAds());

/* ══════════════════════════════════════════════════════════════
   INQUIRIES & BOOKINGS
   Full lifecycle: inquiring → replied/declined → active → done → completed
══════════════════════════════════════════════════════════════ */
const FX_BOOKING = {

  /* ── Create inquiry (user → provider) ───────────────────────── */
  async createBooking(regularUserId, providerId, jobDescription) {
    // Prevent duplicate active bookings with same provider
    const existing = await sbFetch(
      `inquiries?regular_user_id=eq.${regularUserId}&provider_id=eq.${providerId}` +
      `&status=in.(pending,active,done)&limit=1`
    );
    if (existing?.length) {
      throw new Error('You already have an active booking with this provider.');
    }
    const userIp = await this.getUserIP();
    const row = {
      regular_user_id:     regularUserId,
      provider_id:         providerId,
      user_message:        jobDescription,
      status:              'pending',
      user_has_unread:     false,
      provider_has_unread: true,
      user_ip:             userIp,
    };
    const rows = await sbFetch('inquiries', { method:'POST', body:JSON.stringify(row) });
    return rows?.[0] || null;
  },

/* ── User books (confirms after reply) ──────────────────────── */
  async activateBooking(inquiryId) {
    // ── Check provider booking limit first ────────────────────
    const inquiry = await sbFetch(`inquiries?id=eq.${inquiryId}&limit=1`).then(r => r?.[0]);
    if (inquiry) {
      const provider = await this.getProviderById(inquiry.provider_id);
      const pkg      = await this.getPackageById(provider?.package_id);
      const limit    = pkg?.booking_limit ?? 5;
      if (limit < 999) {
        const active = await sbFetch(
          `inquiries?provider_id=eq.${inquiry.provider_id}&status=eq.active`
        ) || [];
        if (active.length >= limit) {
          throw new Error(
            `This provider has reached their active booking limit. Please try again later or choose another provider.`
          );
        }
      }
    }
    // ── Proceed with booking ──────────────────────────────────
    const rows = await sbFetch(`inquiries?id=eq.${inquiryId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status:              'active',
        provider_has_unread: true,
        user_has_unread:     false,
      })
    });
    return rows?.[0] || null;
  },

  /* ── User-initiated cancel/dispute — notifies provider ──────── */
/* ── User cancels a pending booking (before provider accepts) ── */
async cancelInquiry(inquiryId) {
  const inquiries = await sbFetch(`inquiries?id=eq.${inquiryId}&limit=1`);
  const inq = inquiries?.[0];
  if (!inq) throw new Error('Booking not found.');

  const users = await sbFetch(`users?id=eq.${inq.regular_user_id}&limit=1`);
  const user = users?.[0];
  const userName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'The user';

  const providers = await sbFetch(`providers?id=eq.${inq.provider_id}&limit=1`);
  const provider = providers?.[0];

  // Message to provider's user account ID (not provider table ID)
  await sbFetch('user_messages', {
    method: 'POST',
    prefer: 'return=minimal',
    body: JSON.stringify({
      user_id: provider?.user_id,
      title:   'Booking Cancelled by User',
      body:    `${userName} has cancelled their booking with you.\n\nJob Description:\n"${inq.user_message || 'No description provided.'}"`,
      type:    'warning',
      icon:    '🚫',
      is_read: false,
    }),
  });

  await sbFetch(`inquiries?id=eq.${inquiryId}`, {
  method: 'PATCH', prefer: 'return=minimal',
  body: JSON.stringify({ status: 'cancelled', user_has_unread: false, provider_has_unread: true })
});
},

/* ── User disputes after provider marks job done ─────────────── */
async disputeInquiry(inquiryId) {
  const inquiries = await sbFetch(`inquiries?id=eq.${inquiryId}&limit=1`);
  const inq = inquiries?.[0];
  if (!inq) throw new Error('Booking not found.');

  const users = await sbFetch(`users?id=eq.${inq.regular_user_id}&limit=1`);
  const user = users?.[0];
  const userName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'The user';

  const providers = await sbFetch(`providers?id=eq.${inq.provider_id}&limit=1`);
  const provider = providers?.[0];

  await sbFetch('user_messages', {
    method: 'POST',
    prefer: 'return=minimal',
    body: JSON.stringify({
      user_id: provider?.user_id,
      title:   'Booking Disputed by User',
      body:    `${userName} has disputed the completion of their booking with you.\n\nJob Description:\n"${inq.user_message || 'No description provided.'}"`,
      type:    'warning',
      icon:    '⚠️',
      is_read: false,
    }),
  });

  await sbFetch(`inquiries?id=eq.${inquiryId}`, {
  method: 'PATCH', prefer: 'return=minimal',
  body: JSON.stringify({ status: 'disputed', user_has_unread: false, provider_has_unread: true })
});
},

  // Provider cancels — notifies user
async providerCancelBooking(inquiryId) {
  const inquiries = await sbFetch(`inquiries?id=eq.${inquiryId}&limit=1`);
  const inq = inquiries?.[0];
  if (!inq) throw new Error('Booking not found.');

  const providers = await sbFetch(`providers?id=eq.${inq.provider_id}&limit=1`);
  const provider = providers?.[0];
  const providerName = provider?.biz_name || 'Your provider';

  // Message goes to the regular user's account ID
  await sbFetch('user_messages', {
    method: 'POST',
    prefer: 'return=minimal',
    body: JSON.stringify({
      user_id: inq.regular_user_id,
      title:   'Booking Cancelled by Provider',
      body:    `${providerName} has cancelled your booking.\n\nJob Description:\n"${inq.user_message || 'No description provided.'}"`,
      type:    'warning',
      icon:    '🚫',
      is_read: false,
    }),
  });

  await sbFetch(`inquiries?id=eq.${inquiryId}`, {
  method: 'PATCH', prefer: 'return=minimal',
  body: JSON.stringify({ status: 'cancelled', user_has_unread: true, provider_has_unread: false })
});
},
  
  /* ── Provider marks job done ─────────────────────────────────── */
  async markDone(inquiryId) {
    const rows = await sbFetch(`inquiries?id=eq.${inquiryId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status:          'done',
        user_has_unread: true,
        provider_has_unread: false,
      })
    });
    return rows?.[0] || null;
  },

  /* ── User accepts completion + optional rating ───────────────── */
  async acceptCompletion(inquiryId, stars, comment, anonymous = false) {
    // Fetch the inquiry FIRST so we have provider_id and regular_user_id
    const inquiries = await sbFetch(`inquiries?id=eq.${inquiryId}&limit=1`);
    const inq = inquiries?.[0];
    if (!inq) throw new Error('Booking not found.');

    const update = {
      status:              'completed',
      provider_has_unread: true,
      user_has_unread:     false,
    };
    if (stars) {
      update.rating_stars   = stars;
      update.rating_comment = comment || '';
      update.rated_at       = new Date().toISOString();
    }
    await sbFetch(`inquiries?id=eq.${inquiryId}`, {
      method: 'PATCH',
      body: JSON.stringify(update),
      prefer: 'return=minimal',
    });

    // Insert into ratings table
	if (stars && inq.provider_id && inq.regular_user_id) {
      const ratingUser = await this.getUserById(inq.regular_user_id);
      const fullName   = ratingUser
        ? `${ratingUser.first_name} ${ratingUser.last_name}`.trim()
        : '';
      const displayName = anonymous && fullName
        ? fullName.split(' ').map(p => p.slice(0,3) + '***').join(' ')
        : fullName;
      await this.addRating({
        providerId:  inq.provider_id,
        userId:      inq.regular_user_id,
        stars,
        comment:     comment || '',
        anonymous,
        displayName,
      });
    }
    // Credit 1 referral point on first completed booking (free plan users only)
    try {
      const booker = await this.getUserById(inq.regular_user_id);
      if (booker && (!booker.payment_status || booker.payment_status === 'free')) {
        const prevCompleted = await sbFetch(
          `inquiries?regular_user_id=eq.${inq.regular_user_id}&status=eq.completed&select=id`
        ) || [];
        if (prevCompleted.length === 1) {
          await this.creditReferralPoints(inq.regular_user_id, 1);
        }
      }
    } catch(e) {}
    return inq;
  },

  /* ── Get inquiries for regular user ─────────────────────────── */
  async getUserInquiries(userId) {
    return await sbFetch(
      `inquiries?regular_user_id=eq.${userId}&order=updated_at.desc`
    ) || [];
  },

  /* ── Get inquiries for provider ─────────────────────────────── */
  async getProviderInquiries(providerId, statusFilter) {
    let q = `inquiries?provider_id=eq.${providerId}&order=updated_at.desc`;
    if (statusFilter) q += `&status=eq.${statusFilter}`;
    return await sbFetch(q) || [];
  },

  /* ── Get single inquiry ──────────────────────────────────────── */
  async getInquiry(id) {
    const rows = await sbFetch(`inquiries?id=eq.${id}&limit=1`);
    return rows?.[0] || null;
  },

  /* ── Mark read (clear unread badge) ─────────────────────────── */
  async markReadUser(userId) {
    await sbFetch(
      `inquiries?regular_user_id=eq.${userId}&user_has_unread=eq.true`,
      { method:'PATCH', body:JSON.stringify({ user_has_unread:false }), prefer:'return=minimal' }
    );
  },
  
  async markOneReadUser(inquiryId) {
    await sbFetch(`inquiries?id=eq.${inquiryId}`, {
      method: 'PATCH',
      body: JSON.stringify({ user_has_unread: false }),
      prefer: 'return=minimal'
    });
  },

async deleteReadForUser(userId) {
  await sbFetch(
    `inquiries?regular_user_id=eq.${userId}&user_has_unread=eq.false&status=in.(completed,cancelled,disputed)`,
    { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ user_notif_dismissed: true }) }
  );
},

async deleteReadForProvider(providerId) {
  await sbFetch(
    `inquiries?provider_id=eq.${providerId}&provider_has_unread=eq.false&status=in.(completed,cancelled,disputed)`,
    { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ provider_notif_dismissed: true }) }
  );
},
  
  async markOneReadProvider(inquiryId) {
    await sbFetch(`inquiries?id=eq.${inquiryId}`, {
      method: 'PATCH',
      body: JSON.stringify({ provider_has_unread: false }),
      prefer: 'return=minimal'
    });
  }, 
  
  async markReadProvider(providerId) {
    await sbFetch(
      `inquiries?provider_id=eq.${providerId}&provider_has_unread=eq.true`,
      { method:'PATCH', body:JSON.stringify({ provider_has_unread:false }), prefer:'return=minimal' }
    );
  },

  /* ── Get unread count (for badge) ───────────────────────────── */
  async getUnreadCount(role, id) {
    const col = role === 'provider' ? 'provider_id' : 'regular_user_id';
    const flag = role === 'provider' ? 'provider_has_unread' : 'user_has_unread';
    const rows = await sbFetch(
      `inquiries?${col}=eq.${id}&${flag}=eq.true&select=id`
    ) || [];
    return rows.length;
  },

};

// Attach to FX global
Object.assign(FX, FX_BOOKING);

/* ══════════════════════════════════════════════════════════════
   ADS — Dynamic ad management
   Loaded from Supabase ads table — admin-configurable
══════════════════════════════════════════════════════════════ */
const FX_ADS = {

  _nextRoundRobin(type, ads) {
    if (!ads.length) return null;
    const key = `fx_rr_${type}`;
    const idx = (parseInt(localStorage.getItem(key) || '0')) % ads.length;
    localStorage.setItem(key, idx + 1);
    return ads[idx];
  },

  /* ── Get active ads by type ──────────────────────────────────── */
async getAds(type) {
    try {
      const rows = await sbFetch(
        `ads?type=eq.${type}&is_active=eq.true&order=created_at.asc`
      ) || [];
      // Only serve ads that haven't reached their impression quota
      return rows.filter(a => (a.impression_count || 0) < (a.impression_quota || 5000));
    } catch(e) {
      console.warn('[Fixia Ads] getAds failed:', e.message);
      return [];
    }
  },
  
  async getAllAds() {
    return await sbFetch('ads?order=type.asc,sort_order.asc') || [];
  },

  async createAd(data) {
    const row = {
      type:        data.type,
      advertiser:  data.advertiser,
      title:       data.title,
      description: data.description || '',
      icon:        data.icon || '📢',
      image_url:   data.imageUrl   || null,
      link_url:    data.linkUrl    || '#',
      cta_label:   data.ctaLabel   || 'Learn More',
      bg_color:    data.bgColor    || '#0f2027',
      text_color:  data.textColor  || '#ffffff',
      is_active:   data.isActive   ?? true,
      starts_at:   data.startsAt   || new Date().toISOString(),
      ends_at:     data.endsAt     || null,
      notes:       data.notes      || '',
      sort_order:       data.sortOrder       ?? 99,
      impression_quota: data.impressionQuota ?? 5000,
    };
    const rows = await sbFetch('ads', { method:'POST', body:JSON.stringify(row) });
    return rows?.[0] || null;
  },

  async updateAd(id, changes) {
    const map = {
      type:'type',advertiser:'advertiser', title:'title',
      description:'description', icon:'icon', imageUrl:'image_url',
      linkUrl:'link_url', ctaLabel:'cta_label', bgColor:'bg_color',
      textColor:'text_color', isActive:'is_active', startsAt:'starts_at',
      endsAt:'ends_at', notes:'notes', sortOrder:'sort_order',
      impressionQuota:'impression_quota', impressionCount:'impression_count',
    };
    const p = {};
    Object.entries(map).forEach(([k, col]) => {
      if (changes[k] !== undefined) p[col] = changes[k];
    });
    const rows = await sbFetch(`ads?id=eq.${id}`, { method:'PATCH', body:JSON.stringify(p) });
    return rows?.[0] || null;
  },

  async deleteAd(id) {
    await sbFetch(`ads?id=eq.${id}`, { method:'DELETE', prefer:'return=minimal' });
  },

  /* ── Build inline ad HTML from a DB ad object ────────────────── */
renderInlineAd(ad) {
  return `
    <div class="ad-inline" data-ad-id="${ad.id}" data-ad-link="${ad.link_url || '#'}"
         style="background:linear-gradient(135deg,${ad.bg_color || '#0f2027'},${ad.bg_color || '#1E3048'});border-radius:12px;border:1px solid rgba(255,255,255,0.08);padding:14px;display:flex;gap:12px;margin-bottom:10px;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
      <div class="ai-icon" style="width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0;">${esc(ad.icon || '📢')}</div>
      <div class="ai-body" style="flex:1;min-width:0;">
        <div class="ai-label" style="font-size:0.55rem;font-weight:700;letter-spacing:0.1em;color:rgba(255,255,255,0.35);text-transform:uppercase;margin-bottom:1px;">Sponsored</div>
        <div class="ai-title" style="font-size:0.88rem;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(ad.title)}</div>
        ${ad.description ? `<div class="ai-sub" style="font-size:0.72rem;color:rgba(255,255,255,0.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${ad.description}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;justify-content:center;flex-shrink:0;">
        <button class="ai-btn" style="background:rgba(255,255,255,0.15);border:none;color:#fff;font-size:0.65rem;font-weight:700;padding:5px 10px;border-radius:20px;cursor:pointer;font-family:inherit;">${esc(ad.cta_label || 'Learn More')}</button>
      </div>
    </div>`;
},

  /* ── Override _showPopupAd to use DB ads ─────────────────────── */
  async loadPopupAds() {
    try {
      const ads = await this.getAds('popup');
      if (ads.length) FX._popupAds = ads.map(ad => ({
		id:    ad.id, 
        icon:  ad.icon  || '📢',
        title: ad.title,
        sub:   ad.description || '',
        cta:   ad.cta_label   || 'Learn More',
        color: ad.bg_color    || '#0f2027',
        link:  ad.link_url    || '#',
      }));
    } catch(e) {
      // Fallback to hardcoded ads if DB unavailable
      console.warn('[Fixia Ads] Using fallback popup ads');
    }
  },

  /* ── Load inline ads into a container element ────────────────── */
  async injectInlineAds(containerId, afterEveryN = null) {
    afterEveryN = afterEveryN ?? this.AD_CONFIG?.inlineInterval ?? 4;
    const session = FX.getSession();
    if (session?.role === 'admin') return;
    try {
      const ads = await this.getAds('inline');
      if (!ads.length) return;
      const container = document.getElementById(containerId);
      if (!container) return;
      const cards = container.querySelectorAll('.provider-card');

      const key     = 'fx_rr_inline_id';
      const lastId  = localStorage.getItem(key);
      const ordered = ads; // stable order from Supabase (created_at asc)
      const lastIdx = ordered.findIndex(a => a.id === lastId);
      let   nextIdx = (lastIdx + 1) % ordered.length;

      cards.forEach((card, i) => {
        if ((i + 1) % afterEveryN === 0) {
          const ad = ordered[nextIdx % ordered.length];
          nextIdx++;
          if (!ad) return;
          const adEl = document.createElement('div');
          adEl.innerHTML = this.renderInlineAd(ad);
          card.after(adEl.firstElementChild);
          const injectedAd = card.nextElementSibling;
          const clickHandler = () => {
            const adId   = injectedAd.dataset.adId;
            const adLink = injectedAd.dataset.adLink;
            if (adId) sbFetch('rpc/increment_ad_click', { method:'POST', prefer:'return=minimal', body: JSON.stringify({ ad_id: adId }) }).catch(()=>{});
            window.open(adLink || '#', '_blank');
          };
          injectedAd.addEventListener('click', clickHandler);
          injectedAd.querySelector('.ai-btn')?.addEventListener('click', e => { e.stopPropagation(); clickHandler(); });
          if (ad.id) sbFetch('rpc/increment_ad_impression', { method:'POST', prefer:'return=minimal', body: JSON.stringify({ ad_id: ad.id }) }).catch(()=>{});
        }
      });

      // Save the last served ad ID for next page load
      const lastServed = ordered[(nextIdx - 1) % ordered.length];
      if (lastServed) localStorage.setItem(key, lastServed.id);

    } catch(e) {
      console.warn('[Fixia Ads] Inline ad injection failed:', e.message);
    }
  },

async getAdBatches(adId) {
  const rows = await sbFetch(`ads_batches?ad_id=eq.${adId}&order=batch_number.asc`);
  return rows || [];
},

async createAdBatch(adId, quota, batchNumber) {
  await sbFetch('ads_batches', {
    method: 'POST',
    prefer: 'return=minimal',
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
},

async closeAdBatch(adId, impressionCount) {
  await sbFetch(`ads_batches?ad_id=eq.${adId}&status=eq.active`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body:   JSON.stringify({
      status:           'completed',
      completed_at:     new Date().toISOString(),
      impression_count: impressionCount,
    }),
  });
},

async checkAndCompleteAd(adId, impressionCount, impressionQuota) {
  if (impressionCount >= (impressionQuota || 5000)) {
    await this.closeAdBatch(adId, impressionCount);
    await sbFetch(`ads?id=eq.${adId}`, {
      method: 'PATCH',
      body:   JSON.stringify({ is_active: false, impression_count: impressionCount }),
      prefer: 'return=minimal',
    });
  }
},

};

Object.assign(FX, FX_ADS);

/* ══════════════════════════════════════════════════════════════
   MESSAGES — Admin broadcast & user notification system
══════════════════════════════════════════════════════════════ */
const FX_MESSAGES = {

  /* ── Template CRUD ───────────────────────────────────────────── */
  async getTemplates() {
    return await sbFetch('message_templates?order=created_at.desc') || [];
  },

  async createTemplate(data) {
    const row = {
      title: data.title,
      body:  data.body,
      type:  data.type  || 'announcement',
      icon:  data.icon  || '📢',
    };
    const rows = await sbFetch('message_templates', { method:'POST', body:JSON.stringify(row) });
    return rows?.[0] || null;
  },

  async updateTemplate(id, data) {
    const row = {
      title:      data.title,
      body:       data.body,
      type:       data.type || 'announcement',
      icon:       data.icon || '📢',
      updated_at: new Date().toISOString(),
    };
    await sbFetch(`message_templates?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(row),
      prefer: 'return=minimal',
    });
  },

  async deleteTemplate(id) {
    await sbFetch(`message_templates?id=eq.${id}`, {
      method: 'DELETE',
      prefer: 'return=minimal',
    });
  },

  /* ── Send messages ───────────────────────────────────────────── */
  /*
   * recipients: 'all' | 'regulars' | 'providers' | { userId: '...' }
   * Snapshots template content into each user_messages row.
   */
  async sendMessage(templateId, recipients) {
    // 1. Load template
    const rows = await sbFetch(`message_templates?id=eq.${templateId}&limit=1`);
    const tpl  = rows?.[0];
    if (!tpl) throw new Error('Template not found.');

    // 2. Resolve recipient user IDs
    let users = [];
    if (recipients === 'all') {
      users = await sbFetch('users?select=id&status=eq.active&is_inactive=eq.false') || [];
    } else if (recipients === 'regulars') {
      users = await sbFetch('users?select=id&role=eq.regular&status=eq.active&is_inactive=eq.false') || [];
    } else if (recipients === 'providers') {
      users = await sbFetch('users?select=id&role=eq.provider&status=eq.active&is_inactive=eq.false') || [];
    } else if (recipients?.userId) {
      users = [{ id: recipients.userId }];
    }

    if (!users.length) throw new Error('No recipients found.');

    // 3. Snapshot content into user_messages rows (batch insert)
    const msgRows = users.map(u => ({
      user_id: u.id,
      title:   tpl.title,
      body:    tpl.body,
      type:    tpl.type,
      icon:    tpl.icon,
      is_read: false,
    }));

    // Insert in chunks of 100 to avoid request size limits
    const chunkSize = 100;
    for (let i = 0; i < msgRows.length; i += chunkSize) {
      await sbFetch('user_messages', {
        method: 'POST',
        body: JSON.stringify(msgRows.slice(i, i + chunkSize)),
        prefer: 'return=minimal',
      });
    }

    // 4. Increment template send_count
    await sbFetch(`message_templates?id=eq.${templateId}`, {
      method: 'PATCH',
      body: JSON.stringify({ send_count: (tpl.send_count || 0) + 1 }),
      prefer: 'return=minimal',
    });

    return users.length;
  },

  /* ── User-side message fetching ──────────────────────────────── */
  async getMyMessages(userId) {
    return await sbFetch(
      `user_messages?user_id=eq.${userId}&is_read=eq.false&order=sent_at.asc`
    ) || [];
  },

async deleteMessage(id) {
  await sbFetch(`user_messages?id=eq.${id}`, {
    method: 'DELETE',
    prefer: 'return=minimal',
  });
},

async sendUserMessage(userId, { title, body, type = 'info', icon = '📢' }) {
  await sbFetch('user_messages', {
    method: 'POST',
    prefer: 'return=minimal',
    body: JSON.stringify({
      user_id: userId,
      title,
      body,
      type,
      icon,
      is_read: false,
    }),
  });
},

  /* ── Modal renderer — call from any page ─────────────────────── */
  async checkAndShowMessages() {
  const session = this.getSession();
  if (!session) return;

  // Check force_logout first — show message before deleting account
  let liveUser;
  try {
    liveUser = await this.getUserById(session.userId);
  } catch(e) { return; }

  let messages;
  try {
    messages = await this.getMyMessages(session.userId);
  } catch(e) { return; }

  if (!messages.length) return;

    // Style map per message type
    const styleMap = {
      announcement: { bg:'#EFF6FF', border:'#3B82F6', titleColor:'#1E40AF', btnBg:'#3B82F6', label:'Announcement' },
      warning:      { bg:'#FFF5F5', border:'#DC3545', titleColor:'#991B1B', btnBg:'#DC3545', label:'Warning' },
      maintenance:  { bg:'#FFFBEB', border:'#F59E0B', titleColor:'#92400E', btnBg:'#F59E0B', label:'Maintenance' },
      welcome:      { bg:'#ECFDF5', border:'#10B981', titleColor:'#065F46', btnBg:'#10B981', label:'Welcome' },
    };

    let currentIndex = 0;

    const showMessage = (msg) => {
      // Remove existing modal if any
      document.getElementById('fx-msg-modal')?.remove();

      const s = styleMap[msg.type] || styleMap.announcement;

      const overlay = document.createElement('div');
      overlay.id = 'fx-msg-modal';
      overlay.style.cssText = `
        position:fixed;inset:0;z-index:999999;
        background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);
        display:flex;align-items:center;justify-content:center;padding:1.25rem;
        animation:fxMsgIn 0.3s ease;
      `;

      overlay.innerHTML = `
        <style>
          @keyframes fxMsgIn {
            from { opacity:0; transform:scale(0.93); }
            to   { opacity:1; transform:none; }
          }
          #fx-msg-modal .msg-card {
            background:#fff;
            border-radius:20px;
            max-width:380px;
            width:100%;
            overflow:hidden;
            box-shadow:0 24px 64px rgba(0,0,0,0.3);
            font-family:'Plus Jakarta Sans',sans-serif;
          }
          #fx-msg-modal .msg-header {
            background:${s.bg};
            border-bottom:2px solid ${s.border};
            padding:0.7rem 1.25rem;
            text-align:center;
          }
          #fx-msg-modal .msg-icon {
            font-size:1.6rem;
            margin-bottom:0.1rem;
          }
          #fx-msg-modal .msg-label {
            font-size:0.58rem;font-weight:800;
            letter-spacing:0.12em;text-transform:uppercase;
            color:${s.titleColor};margin-bottom:0.2rem;
          }
          #fx-msg-modal .msg-title {
            font-size:0.95rem;font-weight:800;
            color:#0F1B2D;line-height:1.3;
          }
          #fx-msg-modal .msg-body {
            padding:0.1rem 1.25rem 0.1rem;
            font-size:0.85rem;color:#4A5568;
            line-height:1.6;white-space:pre-wrap;
          }
          #fx-msg-modal .msg-footer {
            padding:0 1.25rem 1rem;
            display:flex;flex-direction:column;gap:8px;
          }
          #fx-msg-modal .msg-btn {
            width:100%;padding:0.75rem;
            background:${s.btnBg};color:#fff;
            border:none;border-radius:10px;
            font-size:0.88rem;font-weight:700;
            cursor:pointer;font-family:inherit;
          }
          #fx-msg-modal .msg-counter {
            text-align:center;font-size:0.68rem;
            color:#8896A5;font-weight:600;
          }
        </style>
		<div class="msg-card">
          <div class="msg-header">
            <span style="font-size:0.8rem;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:${s.titleColor};">${msg.icon} ${s.label}</span>
          </div>
          <div class="msg-body">
			<div style="font-size:0.95rem;font-weight:800;color:#0F1B2D;margin-bottom:1px;line-height:1;">${msg.title}</div>
            <div style="font-size:0.83rem;color:#4A5568;line-height:1.3;white-space:pre-wrap;">${msg.body.trim()}</div>
          </div>
          <div class="msg-footer">
            <button class="msg-btn" id="fxMsgOkBtn">
              Got it, thanks!
            </button>
            ${messages.length > 1
              ? `<div class="msg-counter">Message ${currentIndex + 1} of ${messages.length}</div>`
              : ''}
          </div>
        </div>`;

      document.body.appendChild(overlay);

      // Delete this message from DB and show next
overlay.querySelector('#fxMsgOkBtn').addEventListener('click', async () => {
  // Check for special actions before deleting
  if (msg.metadata) {
    try {
      const meta = JSON.parse(msg.metadata);
      if (meta.action === 'suspend_on_read') {
        // Activate suspension now that provider has read the message
        await sbFetch(`providers?id=eq.${meta.provider_id}`, {
          method: 'PATCH',
          prefer: 'return=minimal',
          body:   JSON.stringify({
            status: 'suspended',
            suspended_until: new Date(Date.now() + ((parseInt(meta.suspension_days) || 7) * 86400000)).toISOString(),
          }),
        }).catch(() => {});
        await sbFetch(`users?id=eq.${meta.user_id}`, {
          method: 'PATCH',
          prefer: 'return=minimal',
          body:   JSON.stringify({ status: 'suspended' }),
        }).catch(() => {});
        // Clear session and redirect to login
        try { await this.deleteMessage(msg.id); } catch(e) {}
        overlay.remove();
        this.clearSession();
        window.location.href = 'login.html';
        return;
      }
    } catch(e) {}
  }

  try { await this.deleteMessage(msg.id); } catch(e) {}
  overlay.remove();

  // Check if this was a rejection message — delete account and logout
  const sess = this.getSession();
  if (sess) {
    try {
      const freshUser = await this.getUserById(sess.userId);
      if (freshUser?.force_logout) {
        await sbFetch(`users?id=eq.${sess.userId}`, { method: 'DELETE', prefer: 'return=minimal' });
        this.clearSession();
        window.location.href = 'login.html';
        return;
      }
    } catch(e) {}
  }

  currentIndex++;
  if (currentIndex < messages.length) {
    showMessage(messages[currentIndex]);
  }
});
    };

    showMessage(messages[0]);
  },
};

Object.assign(FX, FX_MESSAGES);

/* ══════════════════════════════════════════════════════════════
   CHANGE REQUESTS — Provider profile change request system
══════════════════════════════════════════════════════════════ */
const FX_CHANGE_REQUESTS = {

  COOLDOWN_DAYS: 30,

  async getMyLastRequest(providerId) {
    const rows = await sbFetch(
      `change_requests?provider_id=eq.${providerId}&order=created_at.desc&limit=1`
    ) || [];
    return rows[0] || null;
  },

  async getCooldownDaysLeft(providerId) {
    const last = await this.getMyLastRequest(providerId);
    if (!last) return 0;
    const daysSince = (Date.now() - new Date(last.created_at).getTime()) / (1000 * 60 * 60 * 24);
    const daysLeft  = Math.ceil(this.COOLDOWN_DAYS - daysSince);
    return daysLeft > 0 ? daysLeft : 0;
  },

  async submitChangeRequest(data) {
    // data: { userId, providerId, providerName, subject, requestedValue, explanation, file (optional) }
    let fileUrl  = null;
    let filePath = null;

    // Upload file if provided
    if (data.file) {
      const ext      = data.file.name.split('.').pop();
      filePath       = `requests/${data.providerId}_${Date.now()}.${ext}`;
      const formData = new FormData();
      formData.append('', data.file);
      const uploadRes = await fetch(
        `${SUPA_URL}/storage/v1/object/fixia-requests/${filePath}`,
        {
          method: 'POST',
          headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` },
          body: formData,
        }
      );
      if (!uploadRes.ok) throw new Error('File upload failed.');
      fileUrl = `${SUPA_URL}/storage/v1/object/public/fixia-requests/${filePath}`;
    }

    const row = {
      user_id:         data.userId,
      provider_id:     data.providerId,
      provider_name:   data.providerName,
      subject:         data.subject,
      requested_value: data.requestedValue,
      explanation:     data.explanation,
      file_url:        fileUrl,
      file_path:       filePath,
      status:          'pending',
    };

    await sbFetch('change_requests', {
      method: 'POST',
      body:   JSON.stringify(row),
      prefer: 'return=minimal',
    });
  },

  async getChangeRequests(filters = {}) {
    let q = 'change_requests?order=created_at.desc';
    if (filters.status) q += `&status=eq.${filters.status}`;
    return await sbFetch(q) || [];
  },

  async approveChangeRequest(req) {
    // Auto-update provider/user data based on subject
    if (req.subject === 'Business Name Change') {
      await sbFetch(`providers?id=eq.${req.provider_id}`, {
        method: 'PATCH',
        prefer: 'return=minimal',
        body:   JSON.stringify({ biz_name: req.requested_value }),
      });
    } else if (req.subject === 'Email Change') {
      await sbFetch(`users?id=eq.${req.user_id}`, {
        method: 'PATCH',
        prefer: 'return=minimal',
        body:   JSON.stringify({ email: req.requested_value.toLowerCase() }),
      });
    } else if (req.subject === 'Location Change') {
      try {
        const loc = JSON.parse(req.requested_value);
        await sbFetch(`providers?id=eq.${req.provider_id}`, {
          method: 'PATCH',
          prefer: 'return=minimal',
          body: JSON.stringify({
            region_name:   loc.region_name   || '',
            province_name: loc.province_name || '',
            city_name:     loc.city_name     || '',
            barangay_name: loc.barangay_name || '',
            street_addr:   loc.street_addr   || '',
          }),
        });
      } catch(e) {
        console.warn('[Fixia] Location parse failed in approveChangeRequest — skipping auto-update. Error:', e.message);
      }
    }
    // Send approval message to provider
    const msgBody = req.subject === 'Business Name Change'
      ? `Your request to change your business name to "${req.requested_value}" has been approved. Your profile has been updated.`
      : req.subject === 'Email Change'
      ? `Your request to change your email to "${req.requested_value}" has been approved. Your account email has been updated.`
      : req.subject === 'Location Change'
      ? `Your location change request has been approved and your profile has been updated with the new location.`
      : `Your request has been approved. Our team will apply the changes to your profile shortly.`;

    await sbFetch('user_messages', {
      method: 'POST',
      prefer: 'return=minimal',
      body: JSON.stringify({
        user_id: req.user_id,
        title:   'Request Approved',
        body:    msgBody,
        type:    'announcement',
        icon:    '✅',
        is_read: false,
      }),
    });

    // Cleanup
    await this._cleanupRequest(req);
  },

  async rejectChangeRequest(req, reason) {
    // Send rejection message to provider
    await sbFetch('user_messages', {
      method: 'POST',
      prefer: 'return=minimal',
      body: JSON.stringify({
        user_id: req.user_id,
        title:   'Request Not Approved',
        body:    `Your ${req.subject} request was not approved.\n\nReason: ${reason}`,
        type:    'warning',
        icon:    '⚠️',
        is_read: false,
      }),
    });

    // Cleanup
    await this._cleanupRequest(req);
  },

  async _cleanupRequest(req) {
    // Delete file from storage if exists
    if (req.file_path) {
      await fetch(
        `${SUPA_URL}/storage/v1/object/fixia-requests/${req.file_path}`,
        {
          method:  'DELETE',
          headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` },
        }
      ).catch(() => {});
    }
    // Delete the request record
    await sbFetch(`change_requests?id=eq.${req.id}`, {
      method: 'DELETE',
      prefer: 'return=minimal',
    });
  },
};

Object.assign(FX, FX_CHANGE_REQUESTS);

/* ══════════════════════════════════════════════════════════════
   PROVIDER REPORTS
══════════════════════════════════════════════════════════════ */
const FX_REPORTS = {

  async submitReport(data) {
    // data: { providerId, providerName, userId, userName, reason, details }
    const row = {
      provider_id:   data.providerId,
      provider_name: data.providerName,
      user_id:       data.userId,
      user_name:     data.userName,
      reason:        data.reason,
      details:       data.details || null,
      status:        'pending',
    };
    await sbFetch('provider_reports', {
      method: 'POST',
      prefer: 'return=minimal',
      body:   JSON.stringify(row),
    });
  },

  async hasReported(providerId, userId) {
    const rows = await sbFetch(
      `provider_reports?provider_id=eq.${providerId}&user_id=eq.${userId}&limit=1`
    ) || [];
    return rows.length > 0;
  },

  async getReports(filters = {}) {
    let q = 'provider_reports?order=created_at.desc';
    if (filters.status) q += `&status=eq.${filters.status}`;
    return await sbFetch(q) || [];
  },

  async updateReport(id, changes) {
    await sbFetch(`provider_reports?id=eq.${id}`, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body:   JSON.stringify(changes),
    });
  },

  async dismissReport(id) {
    await this.updateReport(id, { status: 'dismissed' });
  },

  async warnProvider(report) {
    // Send warning message to provider
    await sbFetch('user_messages', {
      method: 'POST',
      prefer: 'return=minimal',
      body: JSON.stringify({
        user_id: report.provider_user_id,
        title:   'Account Warning',
        body:    `You have been reported for activity that violates our Fair and Good Environment Policy. Please consider this as a formal warning.\n\nPlease review our community guidelines and ensure your conduct meets our standards. Further violations may result in account suspension.`,
        type:    'warning',
        icon:    '⚠️',
        is_read: false,
      }),
    });
    await this.updateReport(report.id, { status: 'warned' });
  },

async suspendProvider(report) {
  const days     = parseInt(await this.getSetting('suspension_days')) || 7;
  const liftDate = new Date(Date.now() + (days * 86400000));
  const liftStr  = liftDate.toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' });

  await sbFetch(`providers?id=eq.${report.provider_id}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body:   JSON.stringify({ status: 'suspension_pending', suspended_until: null }),
  });

  await sbFetch('user_messages', {
    method: 'POST',
    prefer: 'return=minimal',
    body: JSON.stringify({
      user_id:  report.provider_user_id,
      title:    'Account Suspension Notice',
      body:     `You have been reported for activity that violates our fair and good environment policy.\n\nUpon acknowledging this message, your account will be suspended for ${days} day${days !== 1 ? 's' : ''} and will automatically be lifted on ${liftStr}.\n\nIf you believe this is a false report, please contact our support team immediately.`,
      type:     'warning',
      icon:     '🚫',
      is_read:  false,
      metadata: JSON.stringify({ action: 'suspend_on_read', provider_id: report.provider_id, user_id: report.provider_user_id, suspension_days: days }),
    }),
  });

  await this.updateReport(report.id, { status: 'suspended' });
},
};

Object.assign(FX, FX_REPORTS);

/* ══════════════════════════════════════════════════════════════
   FEATURED ROTATION — Weighted fair rotation
   Elite: always shown first (pinned)
   Premium: 2x weight vs Pro
   Max 6 slots on homepage
══════════════════════════════════════════════════════════════ */
const FX_FEATURED = {

  FEATURED_LIMIT: 3,

  async getFeaturedProviders() {
    const all = await sbFetch(
    `providers?status=eq.approved&is_featured=eq.true` +
    `&select=id,user_id,biz_name,cat_main,cat_sub,province_name,city_name,avatar_url,is_elite,avg_rating,package_id,featured_impressions,featured_quota` +
    `&order=is_elite.desc,featured_impressions.asc`,
    { headers: { 'Cache-Control': 'no-cache' } }
  ) || [];

    const eligible = all.filter(p =>
      p.is_elite || ((p.featured_quota > 0) && (p.featured_impressions || 0) < p.featured_quota)
    );

    if (!eligible.length) return [];

    const result = [
      ...eligible.filter(p => p.is_elite),
      ...eligible.filter(p => !p.is_elite),
    ].slice(0, FX_FEATURED.FEATURED_LIMIT);

    // Atomic increment via RPC — prevents race condition on concurrent page loads
    result.forEach(prov => {
      sbFetch(`rpc/increment_featured_impression`, {
        method: 'POST',
        prefer: 'return=minimal',
        body: JSON.stringify({ provider_id: prov.id }),
      }).catch(e => console.error(`[Featured] RPC increment failed ${prov.id}:`, e.message));
    });
	
	// Mark providers that just hit their quota as completed
    result.forEach(prov => {
      const newCount = (prov.featured_impressions || 0) + 1;
      if (prov.featured_quota > 0 && newCount >= prov.featured_quota && !prov.is_elite) {
        sbFetch(`providers?id=eq.${prov.id}`, {
          method: 'PATCH',
          prefer: 'return=minimal',
          body: JSON.stringify({
            featured_status: 'completed',
            is_featured: false,
          }),
        }).catch(e => console.error(`[Featured] Status update failed ${prov.id}:`, e.message));
      }
    });
    
    return FX._enrichWithListingCategories(result);
  },

  async getRotationStats() {
  const qs = `select=id,biz_name,is_elite,avg_rating,package_id,featured_impressions,featured_quota&order=featured_impressions.desc`;
  const active = await sbFetch(`providers?is_featured=eq.true&${qs}`);
  return (active || [])
    .map(p => ({
        provider_id:    p.id,
        biz_name:       p.biz_name             || '—',
        is_elite:       p.is_elite             || false,
        avg_rating:     p.avg_rating           || 0,
        package_id:     p.package_id           || '—',
        show_count:     p.featured_impressions || 0,
        featured_quota: p.featured_quota       || 0,
      }));
  },

};

Object.assign(FX, FX_FEATURED);

/* ══════════════════════════════════════════════════════════════
   SESSION HEARTBEAT — Runs on every page that loads fixia-data.js
══════════════════════════════════════════════════════════════ */
(function startSessionHeartbeat() {
  const sess = FX.getSession();
  if (!sess) return;

  async function beat() {
    const valid = await FX.checkSession();
    if (!valid) {
      FX.clearSession();
      const modal = document.getElementById('sessionConflictModal');
      if (modal) {
        modal.style.display = 'flex';
      } else {
        window.location.href = 'login.html?reason=session_conflict';
      }
    }
  }

  async function checkMessages() {
    try { await FX.checkAndShowMessages(); } catch(e) {}
  }

  setTimeout(() => {
    beat();
    checkMessages();
    setInterval(beat, 120000);
    setInterval(checkMessages, 120000);
  }, 10000);
})();
