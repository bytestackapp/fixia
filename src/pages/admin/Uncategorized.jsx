import { useState } from 'react';
import { useAdm, useDo, Load, Head, Table, Btn } from './kit.jsx';
import Dialog from '../../components/ui/Dialog.jsx';
import Field from '../../components/ui/Field.jsx';
import Button from '../../components/ui/Button.jsx';
import { CATEGORIES } from '../../lib/categories.js';
import { fdate } from '../../lib/format.js';

export default function Uncategorized() {
  const q = useAdm('uncat.list'); const [v, setV] = useState(null), [cat, setCat] = useState(''), [sub, setSub] = useState(''), [custom, setCustom] = useState('');
  const go = useDo('uncat.reassign', 'Listing categorised');
  const subs = CATEGORIES.find((c) => c.key === cat)?.subs || [];
  const close = () => { setV(null); setCat(''); setSub(''); setCustom(''); };
  return (
    <>
      <Head title="Uncategorized" sub="Listings where the provider picked “Others”. Give each one a proper category." />
      <Load q={q}>{(d) => <Table empty="All listings are categorised." rows={d.items} cols={[['Listing', (l) => <b>{l.title}</b>], ['Provider', (l) => l.provider], ['Their description', (l) => <i>{l.other_service_desc || '—'}</i>], ['Added', (l) => fdate(l.created_at)], ['', (l) => <Btn variant="secondary" onClick={() => setV(l)}>Assign</Btn>]]} />}</Load>
      <Dialog open={!!v} onClose={close} title="Assign category">
        <p className="muted small"><b>{v?.title}</b> — “{v?.other_service_desc}”</p>
        <Field as="select" label="Category" value={cat} onChange={(e) => { setCat(e.target.value); setSub(''); }}><option value="">Select…</option>{CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</Field>
        <Field as="select" label="Service" value={sub} disabled={!subs.length} onChange={(e) => setSub(e.target.value)}><option value="">Select…</option>{subs.map((s) => <option key={s}>{s}</option>)}</Field>
        <Field label="…or type a new service" value={custom} onChange={(e) => setCustom(e.target.value)} />
        <div className="dlg__actions"><Button loading={go.isPending} onClick={() => go.mutate({ id: v.id, category: cat, sub: custom || sub }, { onSuccess: close })}>Assign</Button><Button variant="quiet" onClick={close}>Cancel</Button></div>
      </Dialog>
    </>
  );
}
