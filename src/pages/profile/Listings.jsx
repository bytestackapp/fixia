import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { call } from '../../lib/api.js';
import { useAct } from '../../lib/queries.js';
import { CATEGORIES, catLabel } from '../../lib/categories.js';
import Field from '../../components/ui/Field.jsx';
import Button from '../../components/ui/Button.jsx';
import Dialog, { Confirm } from '../../components/ui/Dialog.jsx';
import { Switch } from '../../components/ui/Kit.jsx';
import { RowsSkeleton, ErrorState, Empty } from '../../components/States.jsx';

const blank = { title: '', category: '', sub: '', priceLabel: '', description: '', otherDesc: '' };

export default function Listings() {
  const { data, error, isLoading, refetch } = useQuery({ queryKey: ['listings'], queryFn: () => call('listings.mine') });
  const [form, setForm] = useState(null), [del, setDel] = useState(null);
  const inv = { invalidate: ['listings', 'profile'] };
  const save = useAct('listings.save', { ...inv, ok: 'Service saved.', onSuccess: () => setForm(null) });
  const toggle = useAct('listings.toggle', inv), remove = useAct('listings.delete', { ...inv, ok: 'Service deleted.', onSuccess: () => setDel(null) });
  if (isLoading) return <RowsSkeleton rows={2} />;
  if (error) return <ErrorState error={error} retry={refetch} />;
  const used = data.items.length, full = data.limit < 999 && used >= data.limit;
  const subs = CATEGORIES.find((c) => c.key === form?.category)?.subs || [];
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value, ...(k === 'category' ? { sub: '' } : {}) });
  return (
    <div className="stack">
      {!data.approved && <div className="banner banner--warn"><h3>Listings unlock after approval</h3><p>You can add services once our team approves your account.</p></div>}
      <div className="cluster" style={{ justifyContent: 'space-between' }}>
        <span className="muted small">{used} of {data.limit >= 999 ? 'unlimited' : data.limit} listings used</span>
        <Button disabled={!data.approved || full} onClick={() => setForm(blank)}>Add a service</Button>
      </div>
      {!data.items.length ? <Empty title="No services yet">Customers find you through your listings. Add your first one.</Empty> : (
        <ul className="rows">{data.items.map((l) => (
          <li key={l.id} className="row">
            <div className="listing__top"><h3 className="listing__title" style={{ fontSize: 'var(--t-md)' }}>{l.title}</h3><Switch checked={l.active} label={`${l.title} is ${l.active ? 'visible' : 'hidden'}`} onChange={(v) => toggle.mutate({ id: l.id, active: v })} /></div>
            <span className="prow__where">{catLabel(l.category)}{l.sub && ` · ${l.sub}`}{l.priceLabel && ` · ${l.priceLabel}`}</span>
            <p className="small muted">{l.description}</p>
            <div className="cluster"><Button size="sm" variant="secondary" onClick={() => setForm(l)}>Edit</Button><Button size="sm" variant="quiet" onClick={() => setDel(l)}>Delete</Button></div>
          </li>))}</ul>
      )}
      <Dialog open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit service' : 'New service'}>
        {form && <form className="stack" noValidate onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}>
          <Field label="Title" placeholder="e.g. Aircon cleaning" maxLength={100} value={form.title} onChange={set('title')} />
          <div className="two">
            <Field as="select" label="Category" value={form.category} onChange={set('category')}><option value="">Select…</option>{CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}<option value="other">Others</option></Field>
            {form.category === 'other' ? <Field label="Describe your service" maxLength={120} value={form.otherDesc} onChange={set('otherDesc')} hint="We will assign the right category." /> : <Field as="select" label="Service" value={form.sub} disabled={!subs.length} onChange={set('sub')}><option value="">Select…</option>{subs.map((s) => <option key={s}>{s}</option>)}</Field>}
          </div>
          <Field label="Price label (optional)" placeholder="e.g. ₱500 per visit" maxLength={60} value={form.priceLabel} onChange={set('priceLabel')} />
          <Field as="textarea" label="Description" maxLength={400} value={form.description} onChange={set('description')} hint="What is included, how you work, what sets you apart." />
          <div className="dlg__actions"><Button type="submit" loading={save.isPending}>Save</Button><Button type="button" variant="quiet" onClick={() => setForm(null)}>Cancel</Button></div>
        </form>}
      </Dialog>
      <Confirm open={!!del} title="Delete this service?" confirmLabel="Delete" danger busy={remove.isPending} onClose={() => setDel(null)} onConfirm={() => remove.mutate({ id: del.id })}>“{del?.title}” will be removed. This cannot be undone.</Confirm>
    </div>
  );
}
