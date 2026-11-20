import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAdm, useDo, Load, Head, Table, IconBtn } from './kit.jsx';
import Dialog, { Confirm } from '../../components/ui/Dialog.jsx';
import Field from '../../components/ui/Field.jsx';
import Button from '../../components/ui/Button.jsx';
import { Status } from '../../components/ui/Kit.jsx';
import { MEDIA, PROVIDERS, PROVIDERS_OF, calcFee, money } from '../../lib/fees.js';

const blank = { medium: '', provider: '', rate: '', fixed: 0, vat: 12, isActive: true };

export default function Fees() {
  const q = useAdm('fees.list'); const [f, setF] = useState(null), [del, setDel] = useState(null);
  const save = useDo('fee.save', 'Fee saved'), rm = useDo('fee.delete', 'Fee deleted');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const open = (p) => setF(p ? { id: p.id, medium: p.medium, provider: p.provider, rate: p.rate, fixed: p.fixed, vat: p.vat, isActive: !!p.is_active } : blank);
  const pickMedium = (e) => setF({ ...f, medium: e.target.value, provider: PROVIDERS_OF[e.target.value]?.length === 1 ? PROVIDERS_OF[e.target.value][0] : '' });
  const submit = () => save.mutate({ ...f, rate: +f.rate, fixed: +f.fixed || 0, vat: +f.vat || 0 }, { onSuccess: () => setF(null) });
  const sample = f && f.rate !== '' ? calcFee(1000, f) : null;
  return (
    <>
      <Head title="Processing fees" sub="Fees charged by the payment provider. Customers pay these on online payments only. Changes apply immediately."><IconBtn icon={Plus} label="Add a fee" variant="primary" size="md" onClick={() => open()} /></Head>
      <Load q={q}>{(d) => (
        <Table empty="No fees yet." rows={d.items} cols={[
          ['Payment', (p) => <><b>{PROVIDERS[p.provider]}</b><br /><span className="muted">via {MEDIA[p.medium]}</span></>],
          ['Rate', (p) => <span className="num">{Number(p.rate)}%</span>],
          ['Fixed fee', (p) => <span className="num">{money(p.fixed)}</span>],
          ['VAT on fee', (p) => <span className="num">{Number(p.vat)}%</span>],
          ['Status', (p) => <Status kind={p.is_active ? 'ok' : 'neutral'}>{p.is_active ? 'Visible' : 'Hidden'}</Status>],
          ['', (p) => <div className="actions-cell"><IconBtn icon={Pencil} label="Edit" onClick={() => open(p)} /><IconBtn icon={Trash2} label="Delete" variant="danger" onClick={() => setDel(p)} /></div>],
        ]} />
      )}</Load>
      <Dialog open={!!f} onClose={() => setF(null)} title={f?.id ? 'Edit fee' : 'New fee'}>
        {f && <div className="stack">
          <Field as="select" label="Payment medium" value={f.medium} disabled={!!f.id} onChange={pickMedium}>
            <option value="">Select…</option>{Object.entries(MEDIA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Field>
          <Field as="select" label="Payment provider" value={f.provider} disabled={!!f.id || !f.medium} onChange={set('provider')}>
            <option value="">Select…</option>{(PROVIDERS_OF[f.medium] || []).map((k) => <option key={k} value={k}>{PROVIDERS[k]}</option>)}
          </Field>
          <div className="two"><Field label="Rate (%)" type="number" step="0.01" min="0" value={f.rate} onChange={set('rate')} /><Field label="Fixed fee (₱)" type="number" step="0.01" min="0" value={f.fixed} onChange={set('fixed')} /></div>
          <Field label="VAT on fee (%)" type="number" step="0.01" min="0" value={f.vat} onChange={set('vat')} hint="Use 12 for PayMongo. Rates are the ones before VAT." />
          <label className="check"><input type="checkbox" checked={f.isActive} onChange={set('isActive')} />Visible to customers</label>
          {sample && <p className="small muted">Example: on a ₱1,000 plan the customer pays <b>{money(sample.total)}</b> (fee {money(sample.fee)} + VAT {money(sample.vat)}).</p>}
          <div className="dlg__actions"><Button loading={save.isPending} onClick={submit}>Save fee</Button><Button variant="quiet" onClick={() => setF(null)}>Cancel</Button></div>
        </div>}
      </Dialog>
      <Confirm open={!!del} title={`Delete ${del ? PROVIDERS[del.provider] : ''} fee?`} confirmLabel="Delete" danger busy={rm.isPending} onClose={() => setDel(null)} onConfirm={() => rm.mutate({ id: del.id }, { onSuccess: () => setDel(null) })}>This payment method will no longer be offered to customers.</Confirm>
    </>
  );
}