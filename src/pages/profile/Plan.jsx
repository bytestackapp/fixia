import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { call } from '../../lib/api.js';
import { fdate, daysLeft, peso, PERIOD } from '../../lib/format.js';
import PlanPicker from '../../components/PlanPicker.jsx';
import Button from '../../components/ui/Button.jsx';

export default function Plan({ data }) {
  const nav = useNavigate(); const { plan, account: a, pendingUpgrade } = data;
  const { data: all } = useQuery({ queryKey: ['plans'], queryFn: () => call('plans.list'), staleTime: 300_000 });
  const [pick, setPick] = useState('');
  const ups = (all?.items || []).filter((p) => p.price > (plan?.price || 0));
  const left = daysLeft(a.subscriptionEnd);
  return (
    <div className="stack stack--lg">
      <section className="stack">
        <h2>Current plan</h2>
        <dl className="defs">
          <dt>Plan</dt><dd>{plan?.name || 'Free'}</dd>
          {plan?.price > 0 && <><dt>Price</dt><dd className="num">{peso(plan.price)} / {PERIOD[plan.period] || plan.period}</dd></>}
          {a.subscriptionStart && <><dt>Started</dt><dd>{fdate(a.subscriptionStart)}</dd></>}
          {a.subscriptionEnd ? <><dt>Ends</dt><dd>{fdate(a.subscriptionEnd)} ({left} day{left === 1 ? '' : 's'} left)</dd></> : plan?.price > 0 && <><dt>Ends</dt><dd>Never</dd></>}
          {plan?.listingLimit != null && data.provider && <><dt>Listings</dt><dd>{plan.listingLimit >= 999 ? 'Unlimited' : plan.listingLimit}</dd></>}
        </dl>
      </section>
      {pendingUpgrade ? (
        <div className="banner banner--warn"><h3>Upgrade under review</h3><p>We are checking your payment (reference <b>{pendingUpgrade.reference || '—'}</b>). You will get a message when it is approved.</p></div>
      ) : ups.length ? (
        <section className="stack">
          <h2>Upgrade</h2><p className="muted">Unused days on your current plan are credited to the new one.</p>
          <PlanPicker plans={ups} value={pick} onChange={setPick} />
          <div><Button disabled={!pick} onClick={() => nav(`/checkout/${pick}`)}>Continue to payment</Button></div>
        </section>
      ) : plan?.price > 0 ? <p className="muted">You are on the highest available plan.</p> : null}
    </div>
  );
}
