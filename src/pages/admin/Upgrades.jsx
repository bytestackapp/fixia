import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { useAdm, useDo, Load, Head, Table, Menu, Prompt } from './kit.jsx';
import { Confirm } from '../../components/ui/Dialog.jsx';
import { Tabs, Status } from '../../components/ui/Kit.jsx';
import { fdate, peso } from '../../lib/format.js';

export default function Upgrades() {
  const [tab, setTab] = useState('pending'); const q = useAdm('upgrades.list', { history: tab === 'history' });
  const [ok, setOk] = useState(null), [no, setNo] = useState(null);
  const approve = useDo('upgrade.approve', 'Upgrade approved'), reject = useDo('upgrade.reject', 'Upgrade rejected');
  return (
    <>
      <Head title="Upgrades" sub="Check the payment reference in GCash, Maya or your bank before approving." />
      <Tabs items={[['pending', 'Pending'], ['history', 'History']]} value={tab} onChange={setTab} />
      <Load q={q}>{(d) => (
        <Table empty="Nothing here." rows={d.items} cols={[
          ['Who', (r) => <><b>{r.user?.first_name} {r.user?.last_name}</b><br /><span className="muted">Credit days (+{r.carryover_days || 0} days)</span><br /><span className="muted">{r.user?.role === 'regular' ? 'customer' : r.user?.role} · {r.user?.email}</span></>],
          ['Change', (r) => <>{r.oldPlan?.name || r.current_package_id} → <b>{r.newPlan?.name || r.new_package_id}</b></>],
          ['Payment', (r) => <><span style={{ textTransform: 'capitalize' }}>{r.payment_method || '—'}</span> · <b className="num">{peso(r.payment_amount)}</b></>],
          ['Reference', (r) => <span style={{ wordBreak: 'break-all' }}>{r.payment_reference || '—'}</span>],
          [tab === 'history' ? 'Result' : 'Submitted', (r) => tab === 'history' ? <><Status kind={r.status === 'approved' ? 'ok' : 'danger'}>{r.status}</Status><br /><span className="muted">{fdate(r.archived_at)}</span></> : fdate(r.created_at)],
          ...(tab === 'pending' ? [['', (r) => <Menu items={[
            { icon: Check, label: 'Approve', onClick: () => setOk(r) },
            { icon: X, label: 'Reject', danger: true, onClick: () => setNo(r) },
          ]} />]] : []),
        ]} />
      )}</Load>
      <Confirm open={!!ok} title="Approve this upgrade?" confirmLabel="Approve" busy={approve.isPending} onClose={() => setOk(null)} onConfirm={() => approve.mutate({ id: ok.id }, { onSuccess: () => setOk(null) })}>The new plan starts now, with {ok?.carryover_days} bonus days, and the customer is notified.</Confirm>
      <Prompt open={!!no} title="Reject this upgrade" label="Reason (optional, sent to the user)" danger confirmLabel="Reject" busy={reject.isPending} onClose={() => setNo(null)} onSubmit={(v) => reject.mutate({ id: no.id, reason: v }, { onSuccess: () => setNo(null) })} />
    </>
  );
}