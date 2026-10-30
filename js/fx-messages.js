/* Loaded on every page by fx-boot.js.
   1) Points all booking actions at /api/booking (old pages keep working)
   2) Adds the 💬 icon (with red dot) next to the bell
   3) Bell = new booking requests only (providers); hidden for clients */
(function () {
  'use strict';
  if (!window.FX) return;

  const hdr = () => { const s = FX.getSession() || {};
    return { 'Content-Type': 'application/json', 'x-session-token': s.sessionToken || '', 'x-user-id': s.userId || '' }; };
  FX.bk = async (action, payload = {}) => {
    const r = await fetch('/api/booking', { method: 'POST', headers: hdr(), body: JSON.stringify({ action, payload }) });
    const t = await r.text(); let d;
    try { d = JSON.parse(t); } catch { throw new Error('Server error (' + r.status + ')'); }
    if (!r.ok) throw new Error(d.error || 'Request failed');
    return d;
  };

  let sumCache = null;
  const summary = async () => {
    if (sumCache && Date.now() - sumCache.t < 8000) return sumCache.v;
    const v = await FX.bk('summary'); sumCache = { t: Date.now(), v }; return v;
  };

  Object.assign(FX, {
    createBooking:         (uid, pid, desc, role, listingId) => FX.bk('createBooking', { providerId: pid, listingId, jobDescription: desc }),
    acceptBooking:         id => FX.bk('acceptBooking', { id }),
    declineBooking:        (id, reason) => FX.bk('declineBooking', { id, reason }),
    activateBooking:       id => FX.bk('acceptBooking', { id }),          // legacy name
    cancelInquiry:         id => FX.bk('cancelBooking', { id }),
    cancelBooking:         id => FX.bk('cancelBooking', { id }),
    providerCancelBooking: id => FX.bk('cancelBooking', { id }),
    disputeInquiry:        id => FX.bk('disputeBooking', { id }),
    markDone:              id => FX.bk('markDone', { id }),
    acceptCompletion:      (id, stars, comment, anonymous) => FX.bk('confirmBooking', { id, stars, comment, anonymous }),
    getInbox:              () => FX.bk('getInbox'),
    getThread:             id => FX.bk('getThread', { id }),
    /* bell: providers see pending requests, clients see nothing */
    getUnreadCount:        async role => role === 'provider' ? (await summary()).pending : 0,
  });

  function mount() {
    const s = FX.getSession();
    if (!s || s.role === 'admin' || /messages\.html/.test(location.pathname)) return;
    const nav = document.querySelector('.topnav');
    if (!nav || document.getElementById('msgBtn')) return;
    const bell = nav.querySelector('button[onclick*="otifications"]');
    const out  = nav.querySelector('button[onclick*="ignOut"],button[onclick*="logout"]');
    const b = document.createElement('button');
    b.className = 'nav-icon-btn'; b.id = 'msgBtn'; b.title = 'Messages'; b.style.position = 'relative';
    b.innerHTML = '<i class="fa-regular fa-comment"></i><span id="msgDot" style="display:none;position:absolute;top:4px;right:4px;width:9px;height:9px;border-radius:50%;background:#DC3545;border:1.5px solid #fff;"></span>';
    b.onclick = () => { location.href = 'messages.html'; };
    nav.insertBefore(b, bell || out || null);
    if (s.role === 'regular' && bell) bell.style.display = 'none';
    const dot = async () => { try { const d = await summary(); document.getElementById('msgDot').style.display = d.unread ? 'block' : 'none'; } catch (e) {} };
    dot(); FX.every(dot, 30000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
