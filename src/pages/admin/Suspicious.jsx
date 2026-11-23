import { useState } from 'react';
import { Trash2, Check } from 'lucide-react';
import { useAdm, useDo, Load, Head, Table, Menu, Btn } from './kit.jsx';
import Dialog, { Confirm } from '../../components/ui/Dialog.jsx';
import Field from '../../components/ui/Field.jsx';
import Button from '../../components/ui/Button.jsx';
import { Status } from '../../components/ui/Kit.jsx';
import { fdate } from '../../lib/format.js';

export default function Suspicious() {
  const q = useAdm('suspicious.list'), fr = useAdm('fraud.list');
  const [v, setV] = useState(null), [fault, setFault] = useState('customer'), [sus, setSus] = useState(null);
  const rm = useDo('rating.delete', 'Rating removed and warning sent'), keep = useDo('rating.clear', 'Rating kept. It will not be flagged again');
  const suspend = useDo('fraud.suspend', 'Account suspended'), reset = useDo('fraud.reset', 'Points cleared');
  const openRemove = (r) => { setFault(r.stars >= 4 ? 'both' : 'customer'); setV(r); };
  return (
    <>
      <Head title="Suspicious ratings" sub="Ratings that match fraud patterns, highest risk first. Keep the real ones. Remove the fake ones and the guilty side is warned automatically." />
      <Load q={q}>{(d) => <Table stack empty="Nothing suspicious found." rows={d.items} cols={[
        ['Rating', (r) => <><b>{r.provider}</b><br /><span className="muted">{r.stars} star{r.stars === 1 ? '' : 's'} from {r.user}</span></>],
        ['Risk', (r) => <Status kind={r.level === 'high' ? 'danger' : 'warn'}>{r.level}</Status>],
        ['Why flagged', (r) => r.reasons.map((x) => <span key={x} style={{ display: 'block' }}>• {x}</span>)],
        ['Date', (r) => fdate(r.date)],
        ['', (r) => <Menu items={[
          { icon: Check, label: 'Keep (looks real)', onClick: () => keep.mutate({ id: r.id }) },
          { icon: Trash2, label: 'Remove and warn', danger: true, onClick: () => openRemove(r) },
        ]} />],
      ]} />}</Load>

      <section className="section"><div className="section-head"><h2>Warning points</h2></div>
        <Load q={fr}>{(d) => <Table empty="No accounts have warning points." rows={d.items} cols={[
          ['Account', (u) => <><b>{u.first_name} {u.last_name}</b><br /><span className="muted">{u.role === 'regular' ? 'customer' : u.role} · {u.email}</span></>],
          ['Points', (u) => <b className="num">{u.fraud_points} / {d.limit}</b>],
          ['Status', (u) => <Status kind={u.status === 'suspended' ? 'danger' : 'ok'}>{u.status}</Status>],
          ['', (u) => <div className="actions-cell">
            <Btn variant="danger" disabled={u.fraud_points < d.limit || u.status === 'suspended'} onClick={() => setSus(u)}>Suspend</Btn>
            <Btn variant="secondary" loading={reset.isPending && reset.variables?.id === u.id} onClick={() => reset.mutate({ id: u.id })}>Clear points</Btn>
          </div>],
        ]} />}</Load>
      </section>

      <Dialog open={!!v} onClose={() => setV(null)} title="Remove this rating?">
        {v && <div className="stack">
          <p className="muted small">The provider's average is recalculated. This cannot be undone. Whoever you choose below gets an automatic warning and 1 point.</p>
          <Field as="select" label="Who is at fault?" value={fault} onChange={(e) => setFault(e.target.value)}>
            <option value="customer">Customer only (fake or abusive rating)</option>
            <option value="provider">Provider only (provider rated themselves)</option>
            <option value="both">Both (they worked together)</option>
          </Field>
          <div className="dlg__actions"><Button variant="danger" loading={rm.isPending} onClick={() => rm.mutate({ id: v.id, fault }, { onSuccess: () => setV(null) })}>Remove and warn</Button><Button variant="quiet" onClick={() => setV(null)}>Cancel</Button></div>
        </div>}
      </Dialog>

      <Confirm open={!!sus} title={`Suspend ${sus?.first_name} ${sus?.last_name}?`} confirmLabel="Suspend" danger busy={suspend.isPending} onClose={() => setSus(null)} onConfirm={() => suspend.mutate({ id: sus.id }, { onSuccess: () => setSus(null) })}>They are signed out immediately and an email is sent. You can lift the suspension later from Providers or Customers.</Confirm>
    </>
  );
}