import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { call } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { toast } from '../../lib/toast.jsx';
import { shrink } from '../../lib/image.js';
import { fdate, daysLeft } from '../../lib/format.js';
import Avatar from '../../components/Avatar.jsx';

export default function Overview({ data }) {
  const { refresh } = useAuth(); const qc = useQueryClient();
  const { account: a, plan, provider: p } = data;
  const file = useRef(); const [busy, setBusy] = useState(false);
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
          <div className="meta"><span>@{a.username} · {p ? 'Provider' : 'Customer'}</span><span><label className="btn btn--quiet btn--sm" style={{ padding: 0 }}>{busy ? 'Uploading…' : 'Change photo'}<input ref={file} type="file" accept="image/*" className="sr-only" disabled={busy} onChange={avatar} /></label></span></div></div>
      </div>
      <dl className="defs">
        {p && <><dt>Name</dt><dd>{a.firstName} {a.lastName}</dd><dt>Location</dt><dd>{[p.street, p.barangay, p.city, p.province].filter(Boolean).join(', ') || '—'}</dd></>}
        <dt>Email</dt><dd>{a.email}</dd><dt>Phone</dt><dd>{a.phone || '—'}</dd><dt>Member since</dt><dd>{fdate(a.createdAt)}</dd>
        <dt>Plan</dt><dd>{plan?.name || 'Free'}{a.subscriptionEnd ? ` · ${left} day${left === 1 ? '' : 's'} left` : plan?.period === 'lifetime' ? ' · lifetime' : ''}</dd>
      </dl>
      <div className="cluster">
        <Link className="btn btn--secondary" to="/profile?tab=plan">{plan?.price ? 'Manage plan' : 'See plans'}</Link>
      </div>
    </div>
  );
}
