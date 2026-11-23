import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy, Check } from 'lucide-react';
import { call } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useAct } from '../../lib/queries.js';
import { toast } from '../../lib/toast.jsx';
import { PERIOD } from '../../lib/format.js';
import Button from '../../components/ui/Button.jsx';
import { Empty } from '../../components/States.jsx';

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
      <section className="stack"><h2>Your link</h2>
        <p className="muted small">Share this link with friends so they sign up under you.</p>
        <div className="linkbox">
          <code title={link}>{link}</code>
          <button type="button" className="iconbtn iconbtn--sm" data-tip={copied ? 'Copied' : 'Copy link'} aria-label="Copy link" onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />}</button>
        </div>
      </section>
      <section className="stack"><h2>How to earn points</h2>
        <p className="muted small">Share your link. You earn points when the people you invite do one of these:</p>
        <dl className="defs"><dt>Customer - Free Plan:</dt><dd>+1 after their first completed booking</dd><dt>Customer - Paid Plan:</dt><dd>+3 after successful payment</dd><dt>Provider - Paid Plan:</dt><dd>+5 after account approval</dd></dl>
      </section>
      <section className="stack"><h2>Redeem points ({r.points} point{r.points === 1 ? '' : 's'})</h2>
        <p className="muted small">Swap your points for a free plan.</p>
        {!free && <p className="muted small">You have an active plan. Points can be redeemed once it ends.</p>}
        {prizes.length ? <ul className="rows">{prizes.map((p) => (
          <li key={p.id} className="row" style={{ gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
            <span><b className="prow__name">{p.name}</b><br /><span className="small muted">{PERIOD[p.period]} · {p.referral_points_required} points</span></span>
            <Button size="sm" variant="secondary" disabled={!free || r.points < p.referral_points_required} loading={redeem.isPending && redeem.variables?.packageId === p.id} onClick={() => redeem.mutate({ packageId: p.id })}>Redeem</Button>
          </li>))}</ul> : <p className="muted">No plans can be redeemed with points right now.</p>}
      </section>
      <section className="stack"><h2>Recent referrals</h2>
        <p className="muted small">People who signed up with your link and what you earned from them.</p>
        {r.history.length ? <ul className="rows">{r.history.map((h, i) => <li key={i} className="row" style={{ gridTemplateColumns: '1fr auto' }}><span><b>{h.name}</b><br /><span className="small muted">{h.role}</span></span><span className="num small">{h.status === 'credited' ? `+${h.points} pts` : 'Pending'}</span></li>)}</ul> : <Empty title="No referrals yet">Share your link to get started.</Empty>}
      </section>
    </div>
  );
}
