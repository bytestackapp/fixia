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
 *  └─────────────────────┴──────────────────────────────────────────────┘
 *
 *  SUPABASE STORAGE BUCKETS:
 *  • fixia-ids        (private — for government ID uploads)
 *  • fixia-portfolio  (public  — for provider portfolio photos)
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';

/* ── Config — replace with your Supabase project values ─────── */
const SUPA_URL = 'https://YOUR_PROJECT_REF.supabase.co';
const SUPA_KEY = 'YOUR_ANON_PUBLIC_KEY';
const APP_URL  = window.location.origin;

/* ── API endpoints ───────────────────────────────────────────── */
const EMAIL_API  = '/api/send-email';
const PAYPAL_API = '/api/create-paypal-checkout';

/* ══════════════════════════════════════════════════════════════
   CORE SUPABASE REST HELPER
══════════════════════════════════════════════════════════════ */
async function sbFetch(path, options = {}) {
  const url = `${SUPA_URL}/rest/v1/${path}`;
  const headers = {
    'apikey':        SUPA_KEY,
    'Authorization': `Bearer ${SUPA_KEY}`,
    'Content-Type':  'application/json',
    'Prefer':        options.prefer || 'return=representation',
    ...(options.headers || {})
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Supabase error ${res.status}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
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

    // Build session
    const session = {
      userId:     user.id,
      role:       user.role,
      email:      user.email,
      username:   user.username,
      firstName:  user.first_name,
      lastName:   user.last_name,
      packageId:  user.package_id,
      adsF ree:   user.ads_free,
      status:     user.status,
      providerId: user.provider_id || null,
    };
    this.setSession(session);
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
    if (changes.status     != null) p.status          = changes.status;
    if (changes.packageId  != null) p.package_id       = changes.packageId;
    if (changes.adsFree    != null) p.ads_free         = changes.adsFree;
    if (changes.password)           p.password_hash    = fxHash(changes.password);
    if (changes.email)              p.email            = changes.email.toLowerCase();
    if (changes.firstName)          p.first_name       = changes.firstName;
    if (changes.lastName)           p.last_name        = changes.lastName;
    if (changes.phone)              p.phone            = changes.phone;
    if (changes.role)               p.role             = changes.role;
    const rows = await sbFetch(`users?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(p) });
    return rows?.length ? rows[0] : null;
  },

  async deleteUser(id) {
    // Cascade: delete provider record if exists
    await sbFetch(`providers?user_id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
    await sbFetch(`users?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
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

    const user = {
      email:              data.email.trim().toLowerCase(),
      username:           data.username.trim().toLowerCase(),
      password_hash:      fxHash(data.password),
      first_name:         data.firstName,
      last_name:          data.lastName,
      phone:              data.phone,
      role:               'regular',
      status:             data.status || 'active',
      package_id:         data.package || 'free',
      ads_free:           data.ads_free || false,
      payment_method:     data.paymentMethod    || null,
      payment_reference:  data.paymentReference || null,
      payment_amount:     data.paymentAmount    || null,
      payment_status:     data.paymentStatus    || null,
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

    // 1. Upload ID photo to Supabase Storage (private bucket)
    let idFileUrl = null;
    if (data.idFile?.data) {
      const ext = data.idFile.type.includes('pdf') ? 'pdf' : 'jpg';
      const path = `${data.username}_id_${Date.now()}.${ext}`;
      idFileUrl = await sbUpload('fixia-ids', path, data.idFile.data, data.idFile.type);
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
      phone:             data.phone,
      role:              'provider',
      status:            'pending',
      package_id:        data.package || null,
      ads_free:          true, // providers don't see ads
      payment_method:    data.paymentMethod    || null,
      payment_reference: data.paymentReference || null,
      payment_amount:    data.paymentAmount    || null,
      payment_status:    data.paymentStatus    || null,
    };
    const userRows = await sbFetch('users', { method: 'POST', body: JSON.stringify(userRow) });
    const newUser = userRows?.[0];
    if (!newUser) throw new Error('Failed to create user account.');

    // 4. Create provider profile row
    const provRow = {
      user_id:        newUser.id,
      biz_name:       data.bizName,
      prov_type:      data.provType,
      cat_main:       data.catMain,
      cat_sub:        data.catSub,
      biz_desc:       data.bizDesc,
      experience:     data.experience || null,
      region:         data.region,
      region_name:    data.regionName,
      province:       data.province || null,
      province_name:  data.provName || null,
      city:           data.city,
      city_name:      data.cityName,
      barangay:       data.barangay  || null,
      barangay_name:  data.brgyName  || null,
      street_addr:    data.streetAddr || null,
      id_type:        data.idType,
      id_file_url:    idFileUrl,
      portfolio_urls: portfolioUrls,
      package_id:     data.package || null,
      status:         'pending',
      is_featured:    false,
      is_elite:       false,
      avg_rating:     0,
      total_ratings:  0,
    };
    const provRows = await sbFetch('providers', { method: 'POST', body: JSON.stringify(provRow) });
    return { user: newUser, provider: provRows?.[0] };
  },

  /* ════════════════════════════════════════════════════════════
     PROVIDERS — QUERIES
  ════════════════════════════════════════════════════════════ */
  async getProviders(filters = {}) {
    let q = 'providers?status=eq.approved&order=is_elite.desc,is_featured.desc,avg_rating.desc';
    if (filters.city)    q += `&city=eq.${filters.city}`;
    if (filters.catMain) q += `&cat_main=eq.${filters.catMain}`;
    if (filters.catSub)  q += `&cat_sub=eq.${encodeURIComponent(filters.catSub)}`;
    if (filters.elite)   q += `&is_elite=eq.true`;
    if (filters.featured)q += `&is_featured=eq.true`;
    if (filters.limit)   q += `&limit=${filters.limit}`;
    return await sbFetch(q) || [];
  },

  async getProviderById(id) {
    const rows = await sbFetch(`providers?id=eq.${id}&limit=1`);
    return rows?.length ? rows[0] : null;
  },

  async getProviderByUserId(userId) {
    const rows = await sbFetch(`providers?user_id=eq.${userId}&limit=1`);
    return rows?.length ? rows[0] : null;
  },

  async getAllProviders(filters = {}) {
    let q = 'providers?order=created_at.desc';
    if (filters.status)  q += `&status=eq.${filters.status}`;
    if (filters.catMain) q += `&cat_main=eq.${filters.catMain}`;
    return await sbFetch(q) || [];
  },

  async updateProvider(id, changes) {
    const p = {};
    if (changes.status       != null) p.status           = changes.status;
    if (changes.isFeatured   != null) p.is_featured       = changes.isFeatured;
    if (changes.isElite      != null) p.is_elite          = changes.isElite;
    if (changes.eliteGrantedAt)       p.elite_granted_at  = changes.eliteGrantedAt;
    if (changes.eliteExpiresAt!=null) p.elite_expires_at  = changes.eliteExpiresAt;
    if (changes.packageId    != null) p.package_id        = changes.packageId;
    if (changes.bizName)              p.biz_name          = changes.bizName;
    if (changes.bizDesc)              p.biz_desc          = changes.bizDesc;
    const rows = await sbFetch(`providers?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(p) });
    return rows?.length ? rows[0] : null;
  },

  async approveProvider(providerId, userId) {
    await this.updateProvider(providerId, { status: 'approved' });
    await this.updateUser(userId, { status: 'active' });
  },

  async rejectProvider(providerId, userId) {
    await this.updateProvider(providerId, { status: 'rejected' });
    await this.updateUser(userId, { status: 'rejected' });
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
    return await sbFetch(`listings?provider_id=eq.${providerId}&order=created_at.desc`) || [];
  },

  async addListing(data) {
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
    };
    const rows = await sbFetch('listings', { method: 'POST', body: JSON.stringify(row) });
    return rows?.length ? rows[0] : null;
  },

  async updateListing(id, changes) {
    const p = {};
    if (changes.title       != null) p.title       = changes.title;
    if (changes.description != null) p.description = changes.description;
    if (changes.priceLabel  != null) p.price_label = changes.priceLabel;
    if (changes.isActive    != null) p.is_active   = changes.isActive;
    const rows = await sbFetch(`listings?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(p) });
    return rows?.length ? rows[0] : null;
  },

  async deleteListing(id) {
    await sbFetch(`listings?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
  },

  /* ════════════════════════════════════════════════════════════
     RATINGS & REVIEWS
  ════════════════════════════════════════════════════════════ */
  async getRatingsByProvider(providerId) {
    return await sbFetch(`ratings?provider_id=eq.${providerId}&order=created_at.desc`) || [];
  },

  async addRating(data) {
    const row = {
      provider_id:     data.providerId,
      regular_user_id: data.userId,
      stars:           data.stars,
      comment:         data.comment || '',
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
    const row = {
      type:          data.type,        // 'regular' | 'provider'
      name:          data.name,
      price:         data.price,
      period:        data.period || 'month',
      listing_limit: data.listingLimit ?? 5,
      ads_free:      data.adsFree ?? false,
      is_featured:   data.isFeatured ?? false,
      features:      data.features || [],
      popular:       data.popular ?? false,
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
                    'features','popular','icon','is_active','sort_order','type'];
    const map = {
      name:'name', price:'price', period:'period', listingLimit:'listing_limit',
      adsFree:'ads_free', isFeatured:'is_featured', features:'features',
      popular:'popular', icon:'icon', isActive:'is_active', sortOrder:'sort_order', type:'type'
    };
    Object.entries(map).forEach(([k, dbCol]) => {
      if (changes[k] != null) p[dbCol] = changes[k];
    });
    const rows = await sbFetch(`packages?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(p) });
    return rows?.length ? rows[0] : null;
  },

  async deletePackage(id) {
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
      sbFetch('users?select=id,role,status,created_at') || [],
      sbFetch('providers?select=id,status,is_elite,is_featured,avg_rating') || [],
      sbFetch('packages?select=id,type,name,price,is_active') || [],
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
    minTimeBetween: 4 * 60 * 1000,  // minimum 4 minutes between ads
    maxTimeBetween: 8 * 60 * 1000,  // maximum 8 minutes
    navCountTrigger: [3, 5, 7],     // also show after these navigation counts
    duration: 5,                    // seconds countdown before skip
  },

  initAds() {
    const session = this.getSession();
    if (!session || session.role !== 'regular' || session.adsFree) return;

    // Track nav count
    const key = 'fx_nav_count';
    let navCount = parseInt(sessionStorage.getItem(key) || '0') + 1;
    sessionStorage.setItem(key, navCount);

    // Check nav-based trigger
    if (this.AD_CONFIG.navCountTrigger.includes(navCount)) {
      setTimeout(() => this._showPopupAd(), 800);
      return;
    }

    // Check time-based trigger
    const lastShown = parseInt(sessionStorage.getItem('fx_last_ad') || '0');
    const now = Date.now();
    const randomInterval = this.AD_CONFIG.minTimeBetween +
      Math.random() * (this.AD_CONFIG.maxTimeBetween - this.AD_CONFIG.minTimeBetween);

    if (!lastShown || now - lastShown > randomInterval) {
      const delay = 1000 + Math.random() * 3000; // random delay 1-4s after page load
      setTimeout(() => this._showPopupAd(), delay);
    }
  },

  _popupAds: [
    { icon:'🏗️', title:'BuildRight Construction', sub:'Free estimates for any renovation project', cta:'Get Free Quote', color:'#1E3048' },
    { icon:'🔐', title:'SafeHome Security', sub:'CCTV & alarm systems — professional install', cta:'Learn More', color:'#065F46' },
    { icon:'🚗', title:'AutoCare Plus', sub:'Book your car's PMS today — free pickup', cta:'Book Now', color:'#7B2D00' },
    { icon:'💡', title:'PowerSave Solar', sub:'Cut your Meralco bill by up to 70%', cta:'Get Quote', color:'#1E3A8A' },
    { icon:'🧹', title:'CleanPro Services', sub:'Deep cleaning starting at ₱599', cta:'Book Now', color:'#4A1D96' },
  ],

  _showPopupAd() {
    if (document.getElementById('fx-popup-ad')) return; // already showing
    sessionStorage.setItem('fx_last_ad', Date.now());

    const ad = this._popupAds[Math.floor(Math.random() * this._popupAds.length)];
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
        <button class="ad-cta" onclick="this.closest('#fx-popup-ad').remove()">${ad.cta}</button>
        <div class="ad-upgrade">
          Remove ads? <a href="upgrade.html">Upgrade to Fixia Plus</a>
        </div>
      </div>`;

    document.body.appendChild(overlay);

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

};

/* ══════════════════════════════════════════════════════════════
   AUTO-INIT: Pop-up ads on every page load
   (only fires for free regular users)
══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => FX.initAds());
