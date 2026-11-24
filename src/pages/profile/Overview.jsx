import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gift, House, Search, LayoutGrid, Crown, ChevronRight } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { call } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { toast } from '../../lib/toast.jsx';
import { shrink } from '../../lib/image.js';
import { fdate, daysLeft } from '../../lib/format.js';
import Avatar from '../../components/Avatar.jsx';
import { Confirm } from '../../components/ui/Dialog.jsx';

export default function Overview({ data }) {
  const { refresh } = useAuth(); const qc = useQueryClient();
  const { account: a, plan, provider: p } = data;
  const file = useRef(); const [busy, setBusy] = useState(false); const [ask, setAsk] = useState(false);
  async function removePhoto() {
    setBusy(true);
    try { await call('avatar.remove'); await Promise.all([qc.invalidateQueries({ queryKey: ['profile'] }), refresh()]); toast('Photo removed.'); setAsk(false); }
    catch (err) { toast(err.message, 'error'); }
    setBusy(false);
  }
  async function avatar(e) {
    setBusy(true);
    try { await call('avatar.set', { dataUrl: await shrink(e.target.files[0], { square: 320 }) }); await Promise.all([qc.invalidateQueries({ queryKey: ['profile'] }), refresh()]); toast('Photo updated.'); }
    catch (err) { toast(err.message, 'error'); }
    setBusy(false); e.target.value = '';
  }
  const left = daysLeft(a.subscriptionEnd);
  return (
    <div className="stack stack--lg">
      {p?.status === 'pending' && <div className="banner banner--warn"><h3>Application under review</h3><p>Our team is reviewing your details. This usually takes 24–48 hours. You will get an email when it is done.</p></div>}
      {p?.status === 'needs_compliance' && <div className="banner banner--warn"><h3>Action needed</h3><p>Your application is on hold. Check your messages for what is required, then contact support.</p></div>}
      {a.paymentStatus === 'awaiting' && plan && <div className="banner banner--warn"><h3>Plan payment not finished</h3><p>Finish paying for <b>{plan.name}</b> so we can review your application.</p><div><Link className="btn btn--primary btn--sm" to={`/checkout/${plan.id}`}>Complete payment</Link></div></div>}
      <div className="profile-head">
        <Avatar name={p?.bizName || a.firstName} url={a.avatarUrl} size={88} />
        <div><h2>{p ? p.bizName : `${a.firstName} ${a.lastName}`}{p?.isElite && <span className="tag">Elite</span>}</h2>
          <div className="meta"><span>@{a.username} · {p ? 'Provider' : 'Customer'}</span><span className="cluster" style={{ gap: 'var(--s4)' }}>
            <label className="btn btn--quiet btn--sm" style={{ padding: 0 }}>{busy ? 'Please wait…' : a.avatarUrl ? 'Change photo' : 'Add photo'}<input ref={file} type="file" accept="image/*" className="sr-only" disabled={busy} onChange={avatar} /></label>
            {a.avatarUrl && <button type="button" className="btn btn--quiet btn--sm" style={{ padding: 0 }} disabled={busy} onClick={() => setAsk(true)}>Remove photo</button>}
            <Confirm open={ask} title="Remove your photo?" confirmLabel="Remove" danger busy={busy} onClose={() => setAsk(false)} onConfirm={removePhoto}>Your photo will be deleted and the app will show a badge with your first letter instead.</Confirm>
          </span></div></div>
      </div>
      <section className="sec" style={{ marginBottom: 0 }}><h2 className="sec__title">Basic Info</h2>
      <dl className="defs" style={{ margin: 0 }}>
        {p && <><dt>Name</dt><dd>{a.firstName} {a.lastName}</dd><dt>Location</dt><dd>{[p.street, p.barangay, p.city, p.province].filter(Boolean).join(', ') || '—'}</dd></>}
        <dt>Email</dt><dd>{a.email}</dd><dt>Phone</dt><dd>{a.phone || '—'}</dd><dt>Member since</dt><dd>{fdate(a.createdAt)}</dd>
        <dt>Plan</dt><dd>{plan?.name || 'Free'}{a.subscriptionEnd ? ` · ${left} day${left === 1 ? '' : 's'} left` : plan?.period === 'lifetime' ? ' · lifetime' : ''}</dd>
      </dl></section>
      <section className="sec" style={{ marginBottom: 0 }}>
        <h2 className="sec__title">Quick Actions</h2>
        {data.referral && <Link className="menu-item" to="/profile?tab=referral">
          <span className="menu-icon" style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}><Gift size={18} aria-hidden="true" /></span>
          <span className="menu-label">Referral Program</span>
          {data.referral?.points > 0 && <span className="menu-badge">{data.referral.points} pts</span>}
          <ChevronRight size={16} className="menu-arrow" aria-hidden="true" />
        </Link>}
        <Link className="menu-item" to="/">
          <span className="menu-icon" style={{ background: '#EFF6FF', color: '#3B82F6' }}><House size={18} aria-hidden="true" /></span>
          <span className="menu-label">Browse Services</span>
          <ChevronRight size={16} className="menu-arrow" aria-hidden="true" />
        </Link>
        <Link className="menu-item" to="/search">
          <span className="menu-icon" style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}><Search size={18} aria-hidden="true" /></span>
          <span className="menu-label">Search Providers</span>
          <ChevronRight size={16} className="menu-arrow" aria-hidden="true" />
        </Link>
        <Link className="menu-item" to="/browse">
          <span className="menu-icon" style={{ background: '#ECFDF5', color: 'var(--green)' }}><LayoutGrid size={18} aria-hidden="true" /></span>
          <span className="menu-label">Browse Categories</span>
          <ChevronRight size={16} className="menu-arrow" aria-hidden="true" />
        </Link>
        <Link className="menu-item" to="/profile?tab=plan">
          <span className="menu-icon" style={{ background: '#FFF6DD', color: 'var(--gold)' }}><Crown size={18} aria-hidden="true" /></span>
          <span className="menu-label">My Plan</span>
          <span className="menu-badge">{plan?.name || 'Free'}</span>
          <ChevronRight size={16} className="menu-arrow" aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
