import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '../../lib/toast.jsx';
import { call } from '../../lib/api.js';
import { useAct } from '../../lib/queries.js';
import { ChevronDown, ChevronRight, Check } from 'lucide-react';
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
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: (p) => call('listings.toggle', p),
    onMutate: async ({ id, active }) => {
      await qc.cancelQueries({ queryKey: ['listings'] });
      const prev = qc.getQueryData(['listings']);
      qc.setQueryData(['listings'], (d) => d && { ...d, items: d.items.map((x) => (x.id === id ? { ...x, active } : x)) });
      return { prev };
    },
    onError: (e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(['listings'], ctx.prev); toast(e.message, 'error'); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['listings'] }); qc.invalidateQueries({ queryKey: ['profile'] }); },
  });
  const remove = useAct('listings.delete', { ...inv, ok: 'Service deleted.', onSuccess: () => setDel(null) });
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
            <div className="listing__top"><h3 className="listing__title" style={{ fontSize: 'var(--t-md)' }}>{l.title}</h3><Switch checked={l.active} loading={toggle.isPending && toggle.variables?.id === l.id} label={`${l.title} is ${l.active ? 'visible' : 'hidden'}`} onChange={(v) => toggle.mutate({ id: l.id, active: v })} /></div>
            <span className="prow__where">{catLabel(l.category)}{l.sub && ` · ${l.sub}`}{l.priceLabel && ` · ${l.priceLabel}`}</span>
            <p className="small muted">{l.description}</p>
            <div className="cluster"><Button size="sm" variant="secondary" onClick={() => setForm(l)}>Edit</Button><Button size="sm" variant="quiet" onClick={() => setDel(l)}>Delete</Button></div>
          </li>))}</ul>
      )}
      <Dialog open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit service' : 'New service'}>
        {form && <form className="stack" noValidate onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}>
          <Field label="Title" placeholder="e.g. Aircon cleaning" maxLength={100} value={form.title} onChange={set('title')} />
          <CatPicker category={form.category} sub={form.sub} onChange={(v) => setForm({ ...form, ...v })} />
          {form.category === 'other' && <Field label="Describe your service" maxLength={120} value={form.otherDesc} onChange={set('otherDesc')} hint="We will assign the right category." />}
          <Field label="Price label (optional)" placeholder="e.g. Price starts at ₱500 per unit" maxLength={60} value={form.priceLabel} onChange={set('priceLabel')} />
          <Field as="textarea" label="Description" maxLength={400} value={form.description} onChange={set('description')} hint="What is included, how you work, what sets you apart." />
          <div className="dlg__actions"><Button type="submit" loading={save.isPending}>Save</Button><Button type="button" variant="quiet" onClick={() => setForm(null)}>Cancel</Button></div>
        </form>}
      </Dialog>
      <Confirm open={!!del} title="Delete this service?" confirmLabel="Delete" danger busy={remove.isPending} onClose={() => setDel(null)} onConfirm={() => remove.mutate({ id: del.id })}>“{del?.title}” will be removed. This cannot be undone.</Confirm>
    </div>
  );
}

/* Category → service picker. Picking a category opens its services right away. The search box finds categories and services. */
function CatPicker({ category, sub, onChange }) {
  const [step, setStep] = useState(null), [text, setText] = useState(''), [browse, setBrowse] = useState('');
  const t = text.trim().toLowerCase();
  const close = () => { setStep(null); setText(''); };
  const openCat = () => { setText(''); setStep('cat'); };
  const openSub = (k) => { setBrowse(k); setText(''); setStep('sub'); };
  const choose = (c, s) => { onChange({ category: c, sub: s }); close(); };

  const cats = CATEGORIES.filter((c) => !t || c.label.toLowerCase().includes(t));
  const hits = t ? CATEGORIES.flatMap((c) => c.subs.filter((s) => s.toLowerCase().includes(t)).map((s) => ({ c, s }))) : [];
  const showOther = !t || 'others'.includes(t);
  const cur = CATEGORIES.find((c) => c.key === browse);
  const subs = (cur?.subs || []).filter((s) => !t || s.toLowerCase().includes(t));

  const row = (key, on, onClick, children) => (
    <li key={key}><button type="button" className={`sub-card${on ? ' is-on' : ''}`} onClick={onClick}><span>{children}</span>{on ? <Check size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}</button></li>
  );

  return (
    <>
      <div className="two">
        <div className="field">
          <span className="field__label">Category</span>
          <button type="button" className="input select-btn" onClick={openCat}><span className={category ? undefined : 'select-btn__ph'}>{category ? (category === 'other' ? 'Others' : catLabel(category)) : 'Select…'}</span><ChevronDown size={16} aria-hidden="true" /></button>
        </div>
        {category !== 'other' && (
          <div className="field">
            <span className="field__label">Service</span>
            <button type="button" className="input select-btn" disabled={!category} onClick={() => openSub(category)}><span className={sub ? undefined : 'select-btn__ph'}>{sub || 'Select…'}</span><ChevronDown size={16} aria-hidden="true" /></button>
          </div>
        )}
      </div>

      <Dialog open={!!step} onClose={close} title={step === 'sub' ? cur?.label : 'Choose a category'}>
        {step && (
          <>
            <input className="input" type="search" autoFocus placeholder={step === 'cat' ? 'Search category or service…' : 'Search service…'} value={text} onChange={(e) => setText(e.target.value)} />
            <ul className="sub-list">
              {step === 'cat' && <>
                {cats.map((c) => row(c.key, category === c.key, () => openSub(c.key), c.label))}
                {showOther && row('other', category === 'other', () => choose('other', ''), 'Others')}
                {hits.map(({ c, s }) => row(`${c.key}-${s}`, category === c.key && sub === s, () => choose(c.key, s), <>{s} <small className="muted">· {c.label}</small></>))}
                {!cats.length && !showOther && !hits.length && <li className="muted small">Nothing found.</li>}
              </>}
              {step === 'sub' && <>
                {subs.map((s) => row(s, category === browse && sub === s, () => choose(browse, s), s))}
                {!subs.length && <li className="muted small">Nothing found.</li>}
              </>}
            </ul>
            <div className="dlg__actions">
              {step === 'sub' && <Button variant="secondary" onClick={openCat}>← Back</Button>}
              <Button variant="quiet" onClick={close}>Close</Button>
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}

