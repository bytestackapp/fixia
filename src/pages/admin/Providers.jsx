import { useState } from 'react';
import { useAdm, useDo, Load, Head, Table, Btn, Prompt } from './kit.jsx';
import Dialog, { Confirm } from '../../components/ui/Dialog.jsx';
import Field from '../../components/ui/Field.jsx';
import Button from '../../components/ui/Button.jsx';
import PlaceFields from '../../components/PlaceFields.jsx';
import { Tabs, Status } from '../../components/ui/Kit.jsx';

const KIND = { approved: 'ok', pending: 'warn', needs_compliance: 'warn', suspended: 'danger', suspension_pending: 'danger', hidden: 'neutral' };

export default function Providers() {
  const [filter, setFilter] = useState('all'), [text, setText] = useState('');
  const q = useAdm('providers.list', filter === 'elite' ? { elite: true } : filter === 'all' ? {} : { status: filter });
  const pk = useAdm('packages.list');
  const [edit, setEdit] = useState(null), [del, setDel] = useState(null), [elite, setElite] = useState(null), [place, setPlace] = useState({}), [move, setMove] = useState(false);
  const upd = useDo('provider.update', 'Provider updated'), rm = useDo('provider.delete', 'Provider deleted'), grant = useDo('elite.grant', 'Elite granted'), revoke = useDo('elite.revoke', 'Elite revoked');
  const done = () => { setEdit(null); setMove(false); setPlace({}); };
  const set = (k) => (e) => setEdit({ ...edit, [k]: e.target.value });
  const save = () => upd.mutate({ id: edit.id, firstName: edit.fn, lastName: edit.ln, email: edit.email, phone: edit.phone, status: edit.status, packageId: edit.pkg, paymentStatus: edit.pay, bizName: edit.biz, ...(move && place.regionName ? { regionName: place.regionName, provinceName: place.provName, cityName: place.cityName, barangayName: place.brgyName } : {}) }, { onSuccess: done });
  return (
    <>
      <Head title="Providers" />
      <Tabs items={[['all', 'All'], ['approved', 'Approved'], ['pending', 'Pending'], ['suspended', 'Suspended'], ['elite', 'Elite']]} value={filter} onChange={setFilter} />
      <div style={{ maxWidth: 360, marginBottom: 'var(--s4)' }}><Field label="Search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Business, name or city" /></div>
      <Load q={q}>{(d) => (
        <Table rows={d.items.filter((p) => !text || [p.biz_name, p.city_name, p.user?.first_name, p.user?.last_name].join(' ').toLowerCase().includes(text.toLowerCase()))} cols={[
          ['Business', (p) => <><b>{p.biz_name}</b>{p.is_elite && <span className="tag">Elite</span>}<br /><span className="muted">{p.user?.first_name} {p.user?.last_name} · {p.user?.email}</span></>],
          ['Location', (p) => [p.city_name, p.province_name].filter(Boolean).join(', ')],
          ['Plan', (p) => p.user?.package_name || p.package_id],
          ['Status', (p) => <Status kind={KIND[p.status] || 'neutral'}>{p.status.replace('_', ' ')}</Status>],
          ['', (p) => <div className="actions-cell">
            <Btn variant="secondary" onClick={() => setEdit({ id: p.id, fn: p.user?.first_name, ln: p.user?.last_name, email: p.user?.email, phone: p.user?.phone, status: p.status, pkg: p.package_id, pay: p.user?.payment_status || '', biz: p.biz_name, loc: [p.barangay_name, p.city_name, p.province_name].filter(Boolean).join(', ') })}>Edit</Btn>
            {p.status === 'approved' && (p.is_elite ? <Btn variant="quiet" onClick={() => revoke.mutate({ id: p.id })}>Revoke Elite</Btn> : <Btn variant="quiet" onClick={() => setElite(p)}>Make Elite</Btn>)}
            <Btn variant="quiet" onClick={() => setDel(p)}>Delete</Btn></div>],
        ]} />
      )}</Load>
      <Dialog open={!!edit} onClose={done} title={edit?.biz} wide>
        {edit && <div className="stack">
          <div className="two"><Field label="First name" value={edit.fn || ''} onChange={set('fn')} /><Field label="Last name" value={edit.ln || ''} onChange={set('ln')} /></div>
          <div className="two"><Field label="Email" value={edit.email || ''} onChange={set('email')} /><Field label="Phone" value={edit.phone || ''} onChange={set('phone')} /></div>
          <Field label="Business name" value={edit.biz || ''} onChange={set('biz')} />
          <div className="two">
            <Field as="select" label="Status" value={edit.status} onChange={set('status')}>{['pending', 'approved', 'needs_compliance', 'suspended', 'rejected'].map((s) => <option key={s}>{s}</option>)}</Field>
            <Field as="select" label="Plan" value={edit.pkg || ''} onChange={set('pkg')}>{(pk.data?.items || []).filter((x) => x.type === 'provider').map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Field>
          </div>
          <Field as="select" label="Payment status" value={edit.pay} onChange={set('pay')}>{['', 'free', 'awaiting', 'pending', 'verified', 'rejected', 'expired'].map((s) => <option key={s} value={s}>{s || '—'}</option>)}</Field>
          <p className="small muted">Location: {edit.loc || '—'} · <button className="btn btn--quiet btn--sm" style={{ padding: 0 }} onClick={() => setMove(!move)}>{move ? 'Keep current' : 'Change location'}</button></p>
          {move && <PlaceFields onChange={setPlace} />}
          <p className="small muted">Moving to a plan with fewer listings deletes the extra ones.</p>
          <div className="dlg__actions"><Button loading={upd.isPending} onClick={save}>Save</Button><Button variant="quiet" onClick={done}>Cancel</Button></div>
        </div>}
      </Dialog>
      <Prompt open={!!elite} title={`Make ${elite?.biz_name} Elite`} confirmLabel="Grant Elite" busy={grant.isPending} onClose={() => setElite(null)} onSubmit={() => grant.mutate({ id: elite.id, expiresAt: document.getElementById('elite-exp').value || null }, { onSuccess: () => setElite(null) })}>
        <Field id="elite-exp" label="Expires on (leave empty for permanent)" type="date" />
      </Prompt>
      <Confirm open={!!del} title={`Delete ${del?.biz_name}?`} confirmLabel="Delete forever" danger busy={rm.isPending} onClose={() => setDel(null)} onConfirm={() => rm.mutate({ id: del.id }, { onSuccess: () => setDel(null) })}>The provider account, listings and photos are permanently removed.</Confirm>
    </>
  );
}
