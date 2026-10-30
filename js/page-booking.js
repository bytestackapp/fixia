/* Included at the very end of provider.html and notifications.html (see scripts/apply-booking-patch.js).
   Overrides existing page functions so those pages need no hand-editing. */
(function () {
  'use strict';
  const page = location.pathname;

  /* ═══ provider.html — service dropdown, per-service ratings, no free-floating rating box ═══ */
  if (/provider\.html/.test(page)) {

    openBooking = function () {
      const sess = FX.getSession();
      if (!sess) { window.location.href = 'login.html'; return; }
      const active = listings.filter(l => l.is_active);
      if (!active.length) { showToast('This provider has no active services yet.', '#92400e'); return; }
      let sel = document.getElementById('bookService');
      if (!sel) {
        document.getElementById('bookMsg').previousElementSibling.insertAdjacentHTML('beforebegin',
          '<div style="display:block;margin-bottom:4px;font-size:0.72rem;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:0.05em;">Service <span style="color:var(--red);">*</span></div>' +
          '<select id="bookService" style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:0.87rem;font-family:inherit;color:var(--text);background:#fff;margin-bottom:12px;"></select>');
        sel = document.getElementById('bookService');
      }
      sel.innerHTML = '<option value="">— Select a service —</option>' +
        active.map(l => `<option value="${l.id}">${esc(l.title)}${l.price_label ? ' · ' + esc(l.price_label) : ''}</option>`).join('');
      document.getElementById('bookProvName').textContent = provider.biz_name;
      document.getElementById('bookMsg').value = '';
      document.getElementById('bookAlert').style.display = 'none';
      document.getElementById('bookModal').classList.add('active');
    };

    submitBooking = async function () {
      const alertEl = document.getElementById('bookAlert');
      const msg = document.getElementById('bookMsg').value.trim();
      const listingId = document.getElementById('bookService')?.value;
      alertEl.style.display = 'none';
      const fail = t => { alertEl.textContent = t; alertEl.style.display = 'block'; };
      if (!listingId) return fail('Please choose the service you are booking.');
      if (msg.length < 10) return fail('Please describe the job in at least 10 characters.');
      const btn = document.getElementById('bookSubmitBtn');
      btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Booking…';
      try {
        const sess = FX.getSession();
        await FX.createBooking(sess.userId, provider.id, msg, sess.role, listingId);
        closeBooking();
        setTimeout(() => showToast('✅ Booking sent! Track it in Messages.'), 300);
        setTimeout(() => FX.adTrigger('booking_sent'), 4000);
      } catch (e) {
        const m = e.message || 'Failed to send booking.';
        if (/already have/i.test(m)) { closeBooking(); setTimeout(() => showToast('⚠️ ' + m, '#92400e'), 300); }
        else fail(m);
      } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-calendar-check"></i> Confirm Booking';
      }
    };

    const stat = id => {
      const r = reviews.filter(x => x.listing_id === id);
      return r.length ? { avg: Math.round(r.reduce((s, x) => s + x.stars, 0) / r.length * 10) / 10, n: r.length } : null;
    };
    const decorate = () => {
      const act = listings.filter(l => l.is_active);
      if (!act.length) return;
      document.getElementById('listingsBody').innerHTML = act.map(l => {
        const s = stat(l.id);
        return `<div class="listing-item">
          <div class="li-head"><div class="li-title">${esc(l.title)}</div>${l.price_label ? `<div class="li-price">${esc(l.price_label)}</div>` : ''}</div>
          <div class="li-sub">${CAT_LABELS[l.cat_main] || l.cat_main || ''} &nbsp; • &nbsp; ${esc(l.cat_sub || '')}</div>
          <div style="font-size:0.72rem;font-weight:700;margin:2px 0 4px;color:${s ? 'var(--gold)' : 'var(--text-3)'};">${s ? `⭐ ${s.avg} (${s.n})` : 'No ratings yet'}</div>
          <div class="li-desc">${esc(l.description)}</div></div>`;
      }).join('');
    };

    renderReviews = function () {
      const body = document.getElementById('reviewsBody');
      if (!reviews.length) { body.innerHTML = '<div class="empty">No reviews yet.</div>'; return; }
      const avg = provider.avg_rating || 0;
      body.innerHTML = `
        <div class="rating-summary"><div class="rating-big">${avg}</div><div class="rating-star-icon"><i class="fa-solid fa-star"></i></div>
          <div><div class="rating-label">Shop Rating</div><div class="rating-count">${reviews.length} review${reviews.length !== 1 ? 's' : ''}</div></div></div>
        ${reviews.map(r => {
          const stars = Array.from({ length: 5 }, (_, i) => `<i class="fa-solid fa-star" style="color:${i < r.stars ? 'var(--gold)' : 'var(--border)'};font-size:12px;"></i>`).join('');
          return `<div class="review-item">
            <div class="ri-head"><div class="ri-stars">${stars}</div><div class="ri-date">${fmtDate(r.created_at)}</div></div>
            ${r.listing_title ? `<div style="font-size:0.68rem;font-weight:700;color:var(--brand);margin-bottom:3px;">${esc(r.listing_title)}</div>` : ''}
            ${r.comment ? `<div class="ri-comment">${esc(r.comment)}</div>` : '<div class="ri-comment" style="color:var(--text-3);font-style:italic;font-size:0.75rem;">No comment left.</div>'}
          </div>`;
        }).join('')}`;
    };

    const _rp = renderPage;
    renderPage = async function () {
      await _rp();
      try { document.getElementById('rateSection').style.display = 'none'; decorate(); } catch (e) {}
    };
  }

  /* ═══ notifications.html — bell = new booking requests only, tap → thread ═══ */
  if (/notifications\.html/.test(page)) {
    Object.keys(STATUS_CONFIG).forEach(k => delete STATUS_CONFIG[k]);
    Object.keys(PROV_CONFIG).forEach(k => { if (k !== 'pending') delete PROV_CONFIG[k]; });
    PROV_CONFIG.pending.sub = 'A client sent you a booking request. Open it to accept or decline.';
    tapNotif = function (inquiryId) { window.location.href = 'messages.html?id=' + encodeURIComponent(inquiryId); };
  }
})();
