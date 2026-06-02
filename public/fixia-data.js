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

/* ── Secure API helper — routes sensitive writes through /api/db ── */
async function apiFetch(action, payload = {}) {
  const session = (() => {
    try { return JSON.parse(localStorage.getItem('fx_session') || 'null'); } catch { return null; }
  })();
  const res = await fetch('/api/db', {
    method:  'POST',
    headers: {
      'Content-Type':     'application/json',
      'x-session-token':  session?.sessionToken || '',
      'x-user-id':        session?.userId       || '',
    },
    body: JSON.stringify({ action, payload }),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error(`API error (${res.status}): ${text.substring(0, 80)}`); }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
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


async function registerPushSubscription() {
  if (!('PushManager' in window) || !('serviceWorker' in navigator)) return;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.ready;

    function urlBase64ToUint8Array(base64String) {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = atob(base64);
      return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array('BKlXcfZMS9QcyRGrakQs1GPeOkenA56ZzeB68uYPlqFEPIuaMlyQdtL2wFTktnsMrr_TcjuSLjzaP8f_aAFYSrY')
    });

    const sess = FX.getSession?.();
    if (!sess?.userId) return;

    const response = await fetch(`${SUPA_URL}/rest/v1/push_subscriptions`, {
      method:  'POST',
      headers: {
        'apikey':        SUPA_KEY,
        'Authorization': `Bearer ${SUPA_KEY}`,
        'Content-Type':  'application/json',
        'Prefer':        'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        user_id:      sess.userId,
        subscription: sub.toJSON(),
      }),
    });
    console.log('[Fixia Push] Saved:', response.status);
  } catch(e) {
    console.warn('[Fixia Push] Error:', e.message);
  }
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
    return await apiFetch('kickUser', { userId });
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
    // Hash password client-side if changing
    const payload = { id, changes: { ...changes } };
    if (changes.password) {
      payload.changes.passwordHash = await hashPassword(changes.password);
      delete payload.changes.password;
    }
    const result = await apiFetch('updateUser', payload);
    // Refresh session if this is the currently logged-in user
    const currentSession = this.getSession();
    if (currentSession && currentSession.userId === id && result) {
      this.setSession({
        ...currentSession,
        adsFree:   result.ads_free   ?? currentSession.adsFree,
        packageId: result.package_id ?? currentSession.packageId,
      });
    }
    return result;
  },

async deleteUser(id) {
  return await apiFetch('deleteUser', { id });
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
  return await apiFetch('deleteProvider', { id });
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
    // Hash password client-side before sending to API
    const passwordHash = await hashPassword(data.password);
    const referralCode = this.genReferralCode();
    return await apiFetch('registerRegular', {
      data: { ...data, passwordHash, referralCode, password: undefined },
    });
  },
  
  /* ════════════════════════════════════════════════════════════
     REGISTRATION — PROVIDER
  ════════════════════════════════════════════════════════════ */
  async registerProvider(data) {
    // Upload files client-side first, then send URLs to API
    let avatarUrl = null;
    if (data.avatarFile?.data) {
      const path = `${data.username}_avatar_${Date.now()}.jpg`;
      avatarUrl = await sbUpload('fixia-avatars', path, data.avatarFile.data, 'image/jpeg');
    }
    let idFileUrl = null;
    if (data.idFile?.data) {
      const path = `${data.username}_id_${Date.now()}.jpg`;
      idFileUrl = await sbUpload('fixia-ids', path, data.idFile.data, 'image/jpeg');
    }
    const portfolioUrls = [];
    for (let i = 0; i < (data.portfolio || []).length; i++) {
      const f = data.portfolio[i];
      const path = `${data.username}_port_${i}_${Date.now()}.jpg`;
      portfolioUrls.push(await sbUpload('fixia-portfolio', path, f.data, f.type));
    }
    const passwordHash = await hashPassword(data.password);
    const referralCode = this.genReferralCode();
    return await apiFetch('registerProvider', {
      data: { ...data, passwordHash, referralCode, avatarUrl, idFileUrl, portfolioUrls, password: undefined, avatarFile: undefined, idFile: undefined, portfolio: undefined },
    });
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
    return await apiFetch('updateProvider', { id, changes });
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
    return await apiFetch('updateListing', { id, changes });
  },

  async deleteListing(id) {
    return await apiFetch('deleteListing', { id });
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
    return await apiFetch('createPackage', { data });
  },

  async updatePackage(id, changes) {
    return await apiFetch('updatePackage', { id, changes });
  },

  async deletePackage(id) {
    return await apiFetch('deletePackage', { id });
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
  return await apiFetch('requestUpgrade', { data });
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
  return await apiFetch('approveUpgrade', { requestId });
},

/* ════════════════════════════════════════════════════════════
   UPGRADE — REJECT (admin)
════════════════════════════════════════════════════════════ */
async rejectUpgrade(requestId, reason) {
  return await apiFetch('rejectUpgrade', { requestId, reason });
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
    return await apiFetch('createBooking', { regularUserId, providerId, jobDescription });
  },

/* ── User books (confirms after reply) ──────────────────────── */
  async activateBooking(inquiryId) {
    return await apiFetch('activateBooking', { inquiryId });
  },

  /* ── User-initiated cancel/dispute — notifies provider ──────── */
/* ── User cancels a pending booking (before provider accepts) ── */
async cancelInquiry(inquiryId) {
  return await apiFetch('cancelInquiry', { inquiryId });
},

/* ── User disputes after provider marks job done ─────────────── */
async disputeInquiry(inquiryId) {
  return await apiFetch('disputeInquiry', { inquiryId });
},

async providerCancelBooking(inquiryId) {
  return await apiFetch('providerCancelBooking', { inquiryId });
},
  
  async markDone(inquiryId) {
    return await apiFetch('markDone', { inquiryId });
  },

  async acceptCompletion(inquiryId, stars, comment, anonymous = false) {
    return await apiFetch('acceptCompletion', { inquiryId, stars, comment, anonymous });
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
    return await apiFetch('createAd', { data });
  },

  async updateAd(id, changes) {
    return await apiFetch('updateAd', { id, changes });
  },

  async deleteAd(id) {
    return await apiFetch('deleteAd', { id });
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
  return await apiFetch('createAdBatch', { adId, quota, batchNumber });
},

async closeAdBatch(adId, impressionCount, clickCount) {
  await sbFetch(`ads_batches?ad_id=eq.${adId}&status=eq.active`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body:   JSON.stringify({
      status:           'completed',
      completed_at:     new Date().toISOString(),
      impression_count: impressionCount,
      click_count:      clickCount || 0,
    }),
  });
},

async checkAndCompleteAd(adId, impressionCount, impressionQuota, clickCount) {
  if (impressionCount >= (impressionQuota || 5000)) {
    await this.closeAdBatch(adId, impressionCount, clickCount);
    await sbFetch(`ads?id=eq.${adId}`, {
      method: 'PATCH',
      body:   JSON.stringify({ is_active: false, impression_count: impressionCount, click_count: 0 }),
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
    return await apiFetch('createTemplate', { data });
  },

  async updateTemplate(id, data) {
    return await apiFetch('updateTemplate', { id, data });
  },

  async deleteTemplate(id) {
    return await apiFetch('deleteTemplate', { id });
  },

  /* ── Send messages ───────────────────────────────────────────── */
  /*
   * recipients: 'all' | 'regulars' | 'providers' | { userId: '...' }
   * Snapshots template content into each user_messages row.
   */
  async sendMessage(templateId, recipients) {
    return await apiFetch('sendMessage', { templateId, recipients });
  },
  
  async sendMessage(templateId, recipients) {
    return await apiFetch('sendMessage', { templateId, recipients });
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
            padding:0.6rem 1.25rem;
            text-align:center;
          }
          #fx-msg-modal .msg-header-label {
            font-size:0.8rem;font-weight:800;
            letter-spacing:0.12em;text-transform:uppercase;
            color:${s.titleColor};
          }
          #fx-msg-modal .msg-title {
            font-size:0.95rem;font-weight:800;
            color:#0F1B2D;line-height:1.2;
            padding:1rem 1.25rem 0.25rem;
          }
          #fx-msg-modal .msg-body {
            padding:0.5rem 1.25rem 1.75rem;
            font-size:0.83rem;color:#4A5568;
            line-height:1.5;
          }
          #fx-msg-modal .msg-footer {
            padding:0 1.25rem 1.25rem;
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
            <span class="msg-header-label">${msg.icon} ${s.label}</span>
          </div>
          <div class="msg-title">${msg.title}</div>
          <div class="msg-body">
            <div style="white-space:pre-wrap;">${msg.body.trim()}</div>
          </div>
          <div class="msg-footer">
            <button class="msg-btn" id="fxMsgOkBtn">Got it, thanks!</button>
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
    // File upload still happens client-side — only the resulting URL is sent to API
    let fileUrl  = null;
    let filePath = null;
    if (data.file) {
      const ext  = data.file.name.split('.').pop();
      filePath   = `requests/${data.providerId}_${Date.now()}.${ext}`;
      const formData = new FormData();
      formData.append('', data.file);
      const uploadRes = await fetch(
        `${SUPA_URL}/storage/v1/object/fixia-requests/${filePath}`,
        { method: 'POST', headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` }, body: formData }
      );
      if (!uploadRes.ok) throw new Error('File upload failed.');
      fileUrl = `${SUPA_URL}/storage/v1/object/public/fixia-requests/${filePath}`;
    }
    return await apiFetch('submitChangeRequest', {
      data: { ...data, fileUrl, filePath, file: undefined },
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
    return await apiFetch('submitReport', { data });
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
    return await apiFetch('dismissReport', { id });
  },

  async warnProvider(report) {
    return await apiFetch('warnProvider', { report });
  },

async suspendProvider(report) {
  return await apiFetch('suspendProvider', { report });
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
