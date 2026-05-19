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
const SUPA_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxeWNvdWhiYXRkbXNzZnFjeWlvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzI2MzA5NiwiZXhwIjoyMDkyODM5MDk2fQ.ASa4nxpyfYApoNAeqzlAjZmipgj5CcfDnALJAi7Ncq0';
const APP_URL  = window.location.origin;

/* ── API endpoints ───────────────────────────────────────────── */
const EMAIL_API  = '/api/send-email';
const PAYPAL_API = '/api/create-paypal-checkout';

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
      console.error('Supabase 400 detail:', JSON.stringify(err));
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
    const match = publicUrl?.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
    if (!match) return;
    const [, bucket, path] = match;
    await fetch(`${SUPA_URL}/storage/v1/object/${bucket}/${path}`, {
      method: 'DELETE',
      headers: { apikey: SUPA_SERVICE_KEY, Authorization: `Bearer ${SUPA_SERVICE_KEY}` }
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
      'x-upsert':      'true'
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

/* ── Simple password hash (non-cryptographic, front-end only) ── */
function fxHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/* ── UUID generator ──────────────────────────────────────────── */
function genId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
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
	if (user.password_hash !== fxHash(password)) return { success: false, error: 'Incorrect password.' };
    if (user.status === 'suspended') return { success: false, error: 'Your account has been suspended. Contact support if you believe this is a mistake.' };
    if (user.status === 'rejected') return { success: false, error: 'Your account application was not approved.' };
    
    if (user.role === 'provider') {
      const provRows = await sbFetch(`providers?user_id=eq.${user.id}&limit=1`);
      const prov = provRows?.[0];
      if (prov?.status === 'suspended') return { success: false, error: 'Your account has been suspended. Contact support if you believe this is a mistake.' };
      // pending and needs_compliance providers are allowed in as free tier
    }

    // Build session
	const session = {
      userId:     user.id,
      role:       user.role,
      email:      user.email,
      username:   user.username,
      firstName:  user.first_name,
      lastName:   user.last_name,
      packageId:  user.package_id,
      adsFree:    user.ads_free,
      status:     user.status,
      providerId: user.provider_id || null,
      avatarUrl:  user.avatar_url  || null,
    };
    this.setSession(session);
    sbFetch(`users?id=eq.${user.id}`, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: JSON.stringify({
        last_login_at: new Date().toISOString(),
        is_inactive: false,
        force_logout: false,   // ← ADD: reset the flag on every successful login
      }),
    }).catch(() => {});
    
    return { success: true, user };
  },

  logout() {
    this.clearSession();
    window.location.href = 'login.html';
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
    if (changes.password)              p.password_hash     = fxHash(changes.password);
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
    await sbFetch(`app_settings?key=eq.${key}`, {
      method: 'PATCH',
      body: JSON.stringify({ value }),
      prefer: 'return=minimal',
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
      password_hash:      fxHash(data.password),
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
	  pending_package_id:   isPendingManual ? (data.package || null) : null,
    };
    const rows = await sbFetch('users', { method: 'POST', body: JSON.stringify(user) });
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

    // 2. Upload portfolio photos (public bucket)
    const portfolioUrls = [];
    for (let i = 0; i < (data.portfolio || []).length; i++) {
      const f = data.portfolio[i];
      const path = `${data.username}_port_${i}_${Date.now()}.jpg`;
      const url = await sbUpload('fixia-portfolio', path, f.data, f.type);
      portfolioUrls.push(url);
    }

    // 3. Create user row
	const userRow = {
      email:             data.email.trim().toLowerCase(),
      username:          data.username.trim().toLowerCase(),
      password_hash:     fxHash(data.password),
      first_name:        data.firstName,
      last_name:         data.lastName,
      phone:             data.phone || null,
      role:              'provider',
      status:            'pending',
      package_id:        data.package     || null,
      package_name:      data.packageName || null,
      ads_free:          data.package === 'free' ? false : true,
      is_inactive:       false,
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

    // Single atomic transaction — if either insert fails, both roll back
    const result = await sbFetch('rpc/register_provider', {
      method: 'POST',
      body: JSON.stringify({ user_data: userRow, prov_data: provRow })
    });

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
  // Permanently delete the user account
  await sbFetch(`users?id=eq.${userId}`, { method: 'DELETE', prefer: 'return=minimal' });
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
},

async rejectRegularUser(userId, reason) {
  // Send message first before deleting
  await this.sendUserMessage(userId, {
    title: 'Payment Not Verified',
    body:  `We regret to inform you that your application has been rejected.\n\nReason:\n"${reason || 'No reason provided.'}"\n\nYour account will be permanently removed. Please contact support if you believe this is a mistake.`,
    type:  'warning',
    icon:  '🚫',
  });
  // Permanently delete the user account
  await sbFetch(`users?id=eq.${userId}`, { method: 'DELETE', prefer: 'return=minimal' });
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
    const provider = await this.getProviderById(data.providerId);
    const pkg = await this.getPackageById(provider?.package_id);
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
	const fields = ['name','price','period','listing_limit','ads_free','is_featured',
                    'features','popular','badge_label','icon','is_active','sort_order','type'];
    const map = {
      name:'name', price:'price', period:'period', listingLimit:'listing_limit',
      bookingLimit:'booking_limit',
      adsFree:'ads_free', isFeatured:'is_featured', features:'features',
      popular:'popular', badgeLabel:'badge_label', icon:'icon', isActive:'is_active', sortOrder:'sort_order', type:'type'
    };
    Object.entries(map).forEach(([k, dbCol]) => {
      if (changes[k] != null) p[dbCol] = changes[k];
    });
    const rows = await sbFetch(`packages?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(p) });
    return rows?.length ? rows[0] : null;
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
  actionsPerAd:   3,
  minTimeBetween: 2 * 60 * 1000,
  duration:       5,
},

async loadAdConfig() {
  try {
    const actions  = await this.getSetting('ad_actions_per_popup');
    const minutes  = await this.getSetting('ad_min_minutes');
    const duration = await this.getSetting('ad_skip_seconds');
    if (actions  && !isNaN(actions))   this.AD_CONFIG.actionsPerAd   = parseInt(actions);
    if (minutes  && !isNaN(minutes))   this.AD_CONFIG.minTimeBetween = parseFloat(minutes) * 60 * 1000;
    if (duration && !isNaN(duration))  this.AD_CONFIG.duration       = parseInt(duration);
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
  if (session.adsFree) return; // will be overridden by _adsAllowed if stale

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

  _showPopupAd() {
    if (document.getElementById('fx-popup-ad')) return; // already showing
    sessionStorage.setItem('fx_last_ad', Date.now());

    const ad = this._popupAds[0];
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
        <div class="ad-icon-big">${ad.icon}</div>
        <div class="ad-card-title">${ad.title}</div>
        <div class="ad-card-sub">${ad.sub}</div>
        <button class="ad-cta" id="fxAdCta">${ad.cta}</button>
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
    const otpEnabled  = await this.getSetting('otp_enabled');
    const testCode    = await this.getSetting('otp_test_code');

    // If OTP is disabled or a test code is set, skip real email
    const otp = (testCode && testCode.length === 6)
      ? testCode
      : String(Math.floor(100000 + Math.random() * 900000));

    const expiry = Date.now() + 10 * 60 * 1000;
    sessionStorage.setItem('fx_otp', JSON.stringify({ otp, email, expiry }));

    if (otpEnabled === 'true' && (!testCode || testCode.length !== 6)) {
      await this.sendEmail('email_otp', { email, otp });
    }
    return true;
  },

  // Verify OTP — returns true if valid, throws if invalid/expired
  verifyOTP(email, inputOtp) {
    const raw = sessionStorage.getItem('fx_otp');
    if (!raw) throw new Error('No OTP found. Please request a new code.');
    const { otp, email: storedEmail, expiry } = JSON.parse(raw);
    if (Date.now() > expiry) {
      sessionStorage.removeItem('fx_otp');
      throw new Error('This code has expired. Please request a new one.');
    }
    if (storedEmail !== email) throw new Error('Email mismatch. Please request a new code.');
    if (inputOtp.trim() !== otp) throw new Error('Incorrect code. Please try again.');
    sessionStorage.removeItem('fx_otp');
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

      // Get all active listings ordered by created_at ascending
      // (oldest stay, newest get deactivated)
      const listings = await sbFetch(
        `listings?provider_id=eq.${prov.id}&order=created_at.desc`
      ) || [];

      const freeLimit  = 0; // provider-free has no listings
      const toDelete   = listings.slice(freeLimit); // all of them — newest first

      for (const l of toDelete) {
        await sbFetch(`listings?id=eq.${l.id}`, {
          method: 'DELETE',
          prefer: 'return=minimal',
        });
      }

      if (toDelete.length > 0) {
        await sbFetch('user_messages', {
          method: 'POST',
          prefer: 'return=minimal',
          body: JSON.stringify({
            user_id: userId,
            title:   'Subscription Expired — Listings Deactivated',
			body:    `Your subscription has expired and your account has been downgraded to Free. ${toDelete.length} listing(s) were permanently removed. Upgrade your plan to add listings again.`,
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
  const periodDays = { month: 30, '6month': 180, year: 365, lifetime: null };
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
  let q = 'upgrade_requests?order=created_at.desc';
  if (status) q += `&status=eq.${status}`;
  return await sbFetch(q) || [];
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
  const periodDays  = { month: 30, '6month': 180, year: 365, lifetime: null };
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

  // Delete the request record — no audit trail needed
  await sbFetch(`upgrade_requests?id=eq.${requestId}`, {
    method: 'DELETE',
    prefer: 'return=minimal',
    headers: { 'Authorization': `Bearer ${SUPA_SERVICE_KEY}`, 'apikey': SUPA_SERVICE_KEY },
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
      status:      'rejected',
      notes:       reason || null,
      reviewed_at: new Date().toISOString(),
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
  
  await sbFetch(`upgrade_requests?id=eq.${requestId}`, {
    method: 'DELETE',
    prefer: 'return=minimal',
    headers: { 'Authorization': `Bearer ${SUPA_SERVICE_KEY}`, 'apikey': SUPA_SERVICE_KEY },
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

  await sbFetch(`inquiries?id=eq.${inquiryId}`, { method: 'DELETE', prefer: 'return=minimal' });
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

  await sbFetch(`inquiries?id=eq.${inquiryId}`, { method: 'DELETE', prefer: 'return=minimal' });
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

  await sbFetch(`inquiries?id=eq.${inquiryId}`, { method: 'DELETE', prefer: 'return=minimal' });
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
      const ratingUser = await FX.getUserById(inq.regular_user_id);
      const fullName   = ratingUser
        ? `${ratingUser.first_name} ${ratingUser.last_name}`.trim()
        : '';
      const displayName = anonymous && fullName
        ? fullName.split(' ').map(p => p.slice(0,3) + '***').join(' ')
        : fullName;
      await FX.addRating({
        providerId:  inq.provider_id,
        userId:      inq.regular_user_id,
        stars,
        comment:     comment || '',
        anonymous,
        displayName,
      });
    }
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
  
  async markOneReadProvider(inquiryId) {
    await sbFetch(`inquiries?id=eq.${inquiryId}`, {
      method: 'PATCH',
      body: JSON.stringify({ provider_has_unread: false }),
      prefer: 'return=minimal'
    });
  }, 
  
async deleteReadForUser(userId) {
    await sbFetch(
      `inquiries?regular_user_id=eq.${userId}&user_has_unread=eq.false&status=in.(completed,cancelled,disputed)`,
    { method: 'DELETE', prefer: 'return=minimal' }
  );
},

async deleteReadForProvider(providerId) {
    await sbFetch(
      `inquiries?provider_id=eq.${providerId}&provider_has_unread=eq.false&status=in.(completed,cancelled,disputed)`,
    { method: 'DELETE', prefer: 'return=minimal' }
  );
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

  /* ── Get active ads by type ──────────────────────────────────── */
async getAds(type) {
    try {
    const now = new Date().toISOString();
    const rows = await sbFetch(
      `ads?type=eq.${type}&is_active=eq.true&batch_status=eq.active` +
      `&order=impression_count.asc`
    ) || [];
    // Filter out ads that have reached their impression quota
    return rows.filter(a => (a.impression_count || 0) < (a.impression_quota || 5000));
    // Filter out expired ads (ends_at null = runs forever)
	  return rows.filter(ad => !ad.ends_at || ad.ends_at > now);
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
      batch_status:     'queued',
    };
    const rows = await sbFetch('ads', { method:'POST', body:JSON.stringify(row) });
    return rows?.[0] || null;
  },

  async updateAd(id, changes) {
    const map = {
      type:'type', advertiser:'advertiser', title:'title',
      description:'description', icon:'icon', imageUrl:'image_url',
      linkUrl:'link_url', ctaLabel:'cta_label', bgColor:'bg_color',
      textColor:'text_color', isActive:'is_active', startsAt:'starts_at',
      endsAt:'ends_at', notes:'notes', sortOrder:'sort_order',
      impressionQuota:'impression_quota', batchStatus:'batch_status',
      shownFrom:'shown_from', shownUntil:'shown_until',
    };
    const p = {};
    Object.entries(map).forEach(([k, col]) => {
      if (changes[k] != null) p[col] = changes[k];
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
         style="background:linear-gradient(90deg,${ad.bg_color || '#0f2027'},${ad.bg_color || '#203a43'});">
      <div class="ai-icon">${ad.icon || '📢'}</div>
      <div class="ai-body">
        <div class="ai-label">Sponsored</div>
        <div class="ai-title">${ad.title}</div>
        ${ad.description ? `<div class="ai-sub">${ad.description}</div>` : ''}
      </div>
      <button class="ai-btn">${ad.cta_label || 'Learn More'}</button>
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
  async injectInlineAds(containerId, afterEveryN = 4) {
    const session = FX.getSession();
    if (!session || session.adsFree) return;
	if (session.role === 'admin') return;
    try {
      const ads = await this.getAds('inline');
      if (!ads.length) return;
      const container = document.getElementById(containerId);
      if (!container) return;
      const cards = container.querySelectorAll('.provider-card');
      let adIdx = 0;
      cards.forEach((card, i) => {
        if ((i + 1) % afterEveryN === 0 && adIdx < ads.length) {
          const adEl = document.createElement('div');
          adEl.innerHTML = this.renderInlineAd(ads[adIdx % ads.length]);
		  card.after(adEl.firstElementChild);
          // Attach click listeners properly so sbFetch is in scope
          const injectedAd = card.nextElementSibling;
          const clickHandler = () => {
            const adId   = injectedAd.dataset.adId;
            const adLink = injectedAd.dataset.adLink;
			if (adId) sbFetch('rpc/increment_ad_click', { method:'POST', prefer:'return=minimal', body: JSON.stringify({ ad_id: adId }) }).catch(()=>{});
            window.open(adLink || '#', '_blank');
          };
          injectedAd.addEventListener('click', clickHandler);
          injectedAd.querySelector('.ai-btn').addEventListener('click', e => { e.stopPropagation(); clickHandler(); });
		  sbFetch('rpc/increment_ad_impression', { method:'POST', prefer:'return=minimal', body: JSON.stringify({ ad_id: ads[adIdx % ads.length].id }) }).catch(()=>{});
          adIdx++;
        }
      });
	} catch(e) {
      console.warn('[Fixia Ads] Inline ad injection failed:', e.message);
    }
  },

  async checkAndCompleteAd(adId, impressionCount, impressionQuota) {
  if (impressionCount >= (impressionQuota || 5000)) {
    await sbFetch(`ads?id=eq.${adId}`, {
      method:  'PATCH',
      body:    JSON.stringify({ batch_status: 'completed', is_active: false }),
      prefer:  'return=minimal',
    });
    // Promote next queued ad of same type
    const adRows = await sbFetch(`ads?id=eq.${adId}&select=type&limit=1`) || [];
    const type   = adRows[0]?.type;
    if (type) {
      const next = await sbFetch(
        `ads?batch_status=eq.queued&type=eq.${type}&is_active=eq.true&order=queue_position.asc&limit=1`
      ) || [];
      if (next[0]) {
        await sbFetch(`ads?id=eq.${next[0].id}`, {
          method:  'PATCH',
          body:    JSON.stringify({ batch_status: 'active', shown_from: new Date().toISOString(), impression_count: 0 }),
          prefer:  'return=minimal',
        });
      }
    }
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
      body: JSON.stringify({ send_count: tpl.send_count + 1 }),
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
            line-height:0.8;white-space:pre-wrap;
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
              ${currentIndex < messages.length - 1 ? 'Got it, thanks!' : 'Got it, thanks!'}
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
        console.warn('Location parse failed — skipping auto-update:', e);
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

  /* ── Get featured providers for homepage ─────────────────────── */
async getFeaturedProviders() {
  // 1. Get all approved featured/elite providers + their rotation stats
  const [allRaw, rotationRaw] = await Promise.all([
    sbFetch(`providers?status=eq.approved&order=is_elite.desc,avg_rating.desc`),
    sbFetch(`featured_rotation?order=show_count.asc`),
  ]);
  const all          = allRaw || [];
  const rotationStats = rotationRaw || [];

  const eligible = all.filter(p =>
    p.is_elite || (p.is_featured && p.featured_status === 'active')
  );
  if (!eligible.length) return [];

  // Build a show_count lookup — providers never shown yet get 0
  const showMap = Object.fromEntries(
    rotationStats.map(r => [r.provider_id, r.show_count || 0])
  );

  // 2. Separate elite from regular featured
  const elite    = eligible.filter(p => p.is_elite);
  const featured = eligible.filter(p => !p.is_elite && p.is_featured);

  // 3. Elite providers always fill first slots (sorted least-shown first)
  elite.sort((a, b) => (showMap[a.id] || 0) - (showMap[b.id] || 0));
  const result = [...elite];
  const remaining = this.FEATURED_LIMIT - elite.length;
  if (remaining <= 0) return result.slice(0, this.FEATURED_LIMIT);

  // 4. Sort featured providers by show_count ascending (least-shown first)
  // Premium package gets a tie-break advantage — treated as if shown one fewer time
  featured.sort((a, b) => {
    const aCount = (showMap[a.id] || 0) - (a.package_id?.includes('premium') ? 1 : 0);
    const bCount = (showMap[b.id] || 0) - (b.package_id?.includes('premium') ? 1 : 0);
    return aCount - bCount;
  });

  // Pick top providers to fill remaining slots
  const seen = new Set(result.map(p => p.id));
  for (const p of featured) {
    if (seen.has(p.id)) continue;
    result.push(p);
    seen.add(p.id);
    if (result.length >= this.FEATURED_LIMIT) break;
  }

  // 5. Record appearances (async, non-blocking)
  this._recordAppearances(result.map(p => p.id)).catch(() => {});

  return result;
},

  /* ── Record that these providers were shown ──────────────────── */
  async _recordAppearances(providerIds) {
    for (const id of providerIds) {
      // Upsert into featured_rotation
      const existing = await sbFetch(
        `featured_rotation?provider_id=eq.${id}&limit=1`
      );
      if (existing?.length) {
        await sbFetch(`featured_rotation?provider_id=eq.${id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            show_count: (existing[0].show_count || 0) + 1,
            last_shown: new Date().toISOString(),
          }),
          prefer: 'return=minimal',
        });
      } else {
        await sbFetch('featured_rotation', {
          method: 'POST',
          body: JSON.stringify({ provider_id: id, show_count: 1 }),
        });
      }
    }
  },

  /* ── Get rotation stats for admin ───────────────────────────── */
  async getRotationStats() {
  const [stats, providers] = await Promise.all([
    sbFetch('featured_rotation?order=show_count.desc&limit=50') || [],
    sbFetch('providers?select=id,biz_name,is_elite,avg_rating,package_id') || [],
  ]);
  const provMap = Object.fromEntries((providers || []).map(p => [p.id, p]));
  return (stats || []).map(s => ({
    ...s,
    biz_name:   provMap[s.provider_id]?.biz_name   || '—',
    is_elite:   provMap[s.provider_id]?.is_elite    || false,
    avg_rating: provMap[s.provider_id]?.avg_rating  || 0,
    package_id: provMap[s.provider_id]?.package_id  || '—',
  }));
},

  async getBatchStatus() {
  const results = await Promise.all([
    sbFetch(`ad_batches?status=eq.active&order=created_at.desc`),
    sbFetch(`featured_batches?status=eq.active&order=created_at.desc`),
    sbFetch(`ads?batch_status=eq.queued&select=id,type&order=queue_position.asc`),
    sbFetch(`providers?featured_status=eq.queued&is_featured=eq.true&status=eq.approved&select=id`),
  ]);
  return {
    adBatches:   results[0] || [],
    featBatches: results[1] || [],
    queuedAds:   results[2] || [],
    queuedFeat:  results[3] || [],
  };
},

async promoteNextBatch(type) {
  // type: 'inline' | 'popup' | 'featured'
  const batchSize  = parseInt(await this.getSetting(type === 'featured' ? 'featured_batch_size' : 'ad_batch_size')) || (type === 'featured' ? 3 : 6);
  const batchDays  = parseInt(await this.getSetting(type === 'featured' ? 'featured_batch_days' : 'ad_batch_days')) || 30;
  const expires    = new Date(Date.now() + batchDays * 86400000).toISOString();

  if (type === 'featured') {
    const queued = await sbFetch(
      `providers?featured_status=eq.queued&is_featured=eq.true&status=eq.approved` +
      `&order=featured_queue_pos.asc&limit=${batchSize}`
    ) || [];
    if (!queued.length) throw new Error('No featured providers in queue.');

    const batch = await sbFetch(`featured_batches`, {
      method: 'POST',
      body: JSON.stringify({ slot_count: batchSize, duration_days: batchDays, expires_at: expires }),
      prefer: 'return=representation',
    });
    const batchId = batch?.[0]?.id;
    if (!batchId) throw new Error('Failed to create batch.');

    // Expire current active batch first
    await sbFetch(`featured_batches?status=eq.active`, {
      method: 'PATCH', body: JSON.stringify({ status: 'expired' }), prefer: 'return=minimal',
    });
    await sbFetch(`providers?featured_batch_id=not.is.null&featured_status=eq.active`, {
      method: 'PATCH', body: JSON.stringify({ featured_status: 'completed' }), prefer: 'return=minimal',
    });

    for (const p of queued) {
      await sbFetch(`providers?id=eq.${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ featured_batch_id: batchId, featured_status: 'active', featured_from: new Date().toISOString(), featured_until: expires }),
        prefer: 'return=minimal',
      });
    }
  } else {
    const queued = await sbFetch(
      `ads?batch_status=eq.queued&type=eq.${type}&order=queue_position.asc&limit=${batchSize}`
    ) || [];
    if (!queued.length) throw new Error(`No ${type} ads in queue.`);

    const batch = await sbFetch(`ad_batches`, {
      method: 'POST',
      body: JSON.stringify({ type, slot_count: batchSize, duration_days: batchDays, expires_at: expires }),
      prefer: 'return=representation',
    });
    const batchId = batch?.[0]?.id;
    if (!batchId) throw new Error('Failed to create batch.');

    // Expire current active batch first
    await sbFetch(`ad_batches?status=eq.active&type=eq.${type}`, {
      method: 'PATCH', body: JSON.stringify({ status: 'expired' }), prefer: 'return=minimal',
    });
    await sbFetch(`ads?batch_id=not.is.null&batch_status=eq.active&type=eq.${type}`, {
      method: 'PATCH', body: JSON.stringify({ batch_status: 'completed' }), prefer: 'return=minimal',
    });

    for (const a of queued) {
      await sbFetch(`ads?id=eq.${a.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ batch_id: batchId, batch_status: 'active', shown_from: new Date().toISOString(), shown_until: expires, impression_count: 0 }),
        prefer: 'return=minimal',
      });
    }
  }
},

};

Object.assign(FX, FX_FEATURED);
