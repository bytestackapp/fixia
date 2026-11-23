import { useState } from 'react';
import { Eye, Tag, Trash2 } from 'lucide-react';
import { useAdm, useDo, Load, Head, Table, Menu, Detail } from './kit.jsx';
import Dialog, { Confirm } from '../../components/ui/Dialog.jsx';
import Field from '../../components/ui/Field.jsx';
import Button from '../../components/ui/Button.jsx';
import { CATEGORIES } from '../../lib/categories.js';
import { fdate } from '../../lib/format.js';

export default function Uncategorized() {
  const q = useAdm('uncat.list');
  const [ask, setAsk] = useState(null);            // { k: 'view' | 'assign' | 'delete', l }
  const [cat, setCat] = useState(''), [sub, setSub] = useState(''), [custom, setCustom] = useState('');
  const go = useDo('uncat.reassign', 'Listing categorised'), rm = useDo('uncat.delete', 'Listing deleted');
  const subs = CATEGORIES.find((c) => c.key === cat)?.subs || [];
  const close = () => { setAsk(null); setCat(''); setSub(''); setCustom(''); };
  const l = ask?.l;
  return (
    <>
      <Head title="Uncategorized" sub="Listings where the provider picked “Others”. Give each one a proper category." />
      <Load q={q}>{(d) => <Table stack empty="All listings are categorised." rows={d.items} cols={[
        ['Listing', (x) => <b>{x.title}</b>],
        ['Provider', (x) => x.provider],
        ['Added', (x) => fdate(x.created_at)],
        ['', (x) => <Menu items={[
          { icon: Eye, label: 'View', onClick: () => setAsk({ k: 'view', l: x }) },
          { icon: Tag, label: 'Assign category', onClick: () => setAsk({ k: 'assign', l: x }) },
          { icon: Trash2, label: 'Delete', danger: true, onClick: () => setAsk({ k: 'delete', l: x }) },
        ]} />],
      ]} />}</Load>

      <Dialog open={ask?.k === 'view'} onClose={() => { if (ask?.k === 'view') close(); }} title={l?.title} wide>
        {l && <><Detail rows={[['Provider', l.provider], ['Service they described', l.other_service_desc], ['Price', l.price_label], ['Description', l.description], ['Added', fdate(l.created_at)]]} />
          <div className="dlg__actions"><Button onClick={() => setAsk({ k: 'assign', l })}>Assign category</Button><Button variant="quiet" onClick={close}>Close</Button></div></>}
      </Dialog>

      <Dialog open={ask?.k === 'assign'} onClose={() => { if (ask?.k === 'assign') close(); }} title="Assign category">
        {l && <>
          <p className="muted small"><b>{l.title}</b> — “{l.other_service_desc}”</p>
          <Field as="select" label="Category" value={cat} onChange={(e) => { setCat(e.target.value); setSub(''); }}><option value="">Select…</option>{CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</Field>
          <Field as="select" label="Service" value={sub} disabled={!subs.length} onChange={(e) => setSub(e.target.value)}><option value="">Select…</option>{subs.map((s) => <option key={s}>{s}</option>)}</Field>
          <Field label="Create new service" value={custom} onChange={(e) => setCustom(e.target.value)} />
          <div className="dlg__actions"><Button loading={go.isPending} onClick={() => go.mutate({ id: l.id, category: cat, sub: custom || sub }, { onSuccess: close })}>Assign</Button><Button variant="quiet" onClick={close}>Cancel</Button></div>
        </>}
      </Dialog>

      <Confirm open={ask?.k === 'delete'} title={`Delete “${l?.title}”?`} confirmLabel="Delete" danger busy={rm.isPending} onClose={close} onConfirm={() => rm.mutate({ id: l.id }, { onSuccess: close })}>This listing is permanently removed from the provider's profile.</Confirm>
    </>
  );
}