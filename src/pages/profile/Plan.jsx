import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { call } from '../../lib/api.js';
import { peso, PERIOD, fdate, daysLeft } from '../../lib/format.js';
import PlanPicker from '../../components/PlanPicker.jsx';
import { Confirm } from '../../components/ui/Dialog.jsx';

export default function Plan({ data }) {
  const nav = useNavigate(); const { plan, pendingUpgrade } = data;
  const { data: all } = useQuery({ queryKey: ['plans'], queryFn: () => call('plans.list'), staleTime: 300_000 });
  const [pick, setPick] = useState('');
  const end = data.account.subscriptionEnd, left = daysLeft(end);
  const cur = (all?.items || []).find((p) => p.id === plan?.id) || (plan && { ...plan, features: [] });
  const ups = (all?.items || []).filter((p) => p.price > (plan?.price || 0));
  const chosen = ups.find((p) => p.id === pick);
  return (
    <div className="stack stack--lg">
      <section className="stack">
      <h2>Current plan</h2>
      <div className="small">
        <p className="muted">You are currently on the {plan?.name || 'Free'} plan.</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>Expires:</span>
          <span style={{
            fontWeight: 700,
            ...(end && left <= 7 ? { color: 'var(--danger)' } : {})
          }}>
            {end ? `${left} day${left === 1 ? '' : 's'}` : plan?.price > 0 && plan.period !== 'lifetime' ? 'Starts once approved' : 'Never'}
          </span>
        </div>
      </div>
      {cur && <PlanPicker plans={[cur]} value={cur.id} onChange={() => {}} name="current" />}
    </section>
      {pendingUpgrade ? (
        <div className="banner banner--warn"><h3>Upgrade under review</h3><p>We are checking your payment (reference <b>{pendingUpgrade.reference || '—'}</b>). You will get a message when it is approved.</p></div>
      ) : ups.length ? (
        <section className="stack">
          <h2>Upgrade</h2><p className="muted" style={{ maxWidth: 'none' }}>Unused days on your current plan are credited to the new one. Tap a plan to choose it.</p>
          <PlanPicker plans={ups} value={pick} onChange={setPick} />
        </section>
      ) : plan?.price > 0 ? <p className="muted">You are on the highest available plan.</p> : null}

      <Confirm open={!!chosen} title={`Avail ${chosen?.name || ''}?`} confirmLabel="Yes, avail it" onClose={() => setPick('')} onConfirm={() => nav(`/checkout/${chosen.id}`)}>
        {chosen && `You are about to avail ${chosen.name} for ${peso(chosen.price)} / ${PERIOD[chosen.period] || chosen.period}. You will choose how to pay on the next screen.`}
      </Confirm>
    </div>
  );
}