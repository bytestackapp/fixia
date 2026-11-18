import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy, Check } from 'lucide-react';
import { call } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useAct } from '../../lib/queries.js';
import { toast } from '../../lib/toast.jsx';
import { PERIOD } from '../../lib/format.js';
import Button from '../../components/ui/Button.jsx';

export default function Referral({ data }) {
  const { refresh } = useAuth(); const r = data.referral, free = !data.plan?.price;
  const { data: all } = useQuery({ queryKey: ['plans'], queryFn: () => call('plans.list'), staleTime: 300_000 });
  const [copied, setCopied] = useState(false);
  const redeem = useAct('referral.redeem', { invalidate: ['profile'], ok: (d) => `${d.plan} activated. ${d.points} points left.`, onSuccess: () => refresh() });
  const link = `${window.location.origin}/signup?ref=${r.code}`;
  const prizes = (all?.items || []).filter((p) => p.referral_points_required > 0);
  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); toast('Link copied.'); setTimeout(() => setCopied(false), 2000); }
    catch { toast('Could not copy. Press and hold the link to copy it.', 'error'); }
  }
  return (
    <div className="stack stack--lg">
      <div className="score"><b className="num">{r.points}</b><span>referral points</span></div>
      <section className="stack"><h2>Your link</h2>
        <div className="linkbox">
          <code title={link}>{link}</code>
          <button type="button" className="iconbtn iconbtn--sm" data-tip={copied ? 'Copied' : 'Copy link'} aria-label="Copy link" onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />}</button>
        </div>
      </section>
      <section className="stack"><h2>How to earn points</h2>
        <p className="muted small">Share your link. You earn points when the people you invite do one of these:</p>
        <dl className="defs"><dt>Customer, free plan</dt><dd>+1 after their first finished job</dd><dt>Customer, paid plan</dt><dd>+3 when they pay</dd><dt>Provider, paid plan</dt><dd>+5 when approved</dd></dl>
      </section>
      <section className="stack"><h2>Redeem points</h2>
        {!free && <p className="muted small">You have an active plan. Points can be redeemed once it ends.</p>}
        {prizes.length ? <ul className="rows">{prizes.map((p) => (
          <li key={p.id} className="row" style={{ gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
            <span><b className="prow__name">{p.name}</b><br /><span className="small muted">{PERIOD[p.period]} · {p.referral_points_required} points</span></span>
            <Button size="sm" variant="secondary" disabled={!free || r.points < p.referral_points_required} loading={redeem.isPending && redeem.variables?.packageId === p.id} onClick={() => redeem.mutate({ packageId: p.id })}>Redeem</Button>
          </li>))}</ul> : <p className="muted">No plans can be redeemed with points right now.</p>}
      </section>
      <section className="stack"><h2>Recent referrals</h2>
        {r.history.length ? <ul className="rows">{r.history.map((h, i) => <li key={i} className="row" style={{ gridTemplateColumns: '1fr auto' }}><span><b>{h.name}</b><br /><span className="small muted">{h.role}</span></span><span className="num small">{h.status === 'credited' ? `+${h.points} pts` : 'Pending'}</span></li>)}</ul> : <p className="muted">No referrals yet. Share your link to get started.</p>}
      </section>
    </div>
  );
}
