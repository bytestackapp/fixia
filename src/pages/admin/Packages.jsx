import { useState } from 'react';
import { useAdm, useDo, Load, Head, Table, Btn } from './kit.jsx';
import Dialog, { Confirm } from '../../components/ui/Dialog.jsx';
import Field from '../../components/ui/Field.jsx';
import Button from '../../components/ui/Button.jsx';
import { Status } from '../../components/ui/Kit.jsx';
import { peso, PERIOD } from '../../lib/format.js';

const blank = { type: 'regular', name: '', price: 0, period: 'month', listingLimit: 5, bookingLimit: 5, referralPointsRequired: 0, sortOrder: 99, features: '', adsFree: false, isFeatured: false, popular: false, badgeLabel: 'Popular', isActive: true };

export default function Packages() {
  const q = useAdm('packages.list'); const [f, setF] = useState(null), [del, setDel] = useState(null);
  const save = useDo('package.save', 'Plan saved'), rm = useDo('package.delete', 'Plan deleted');
  const set = (k, num) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : num ? e.target.value : e.target.value });
  const open = (p) => setF(p ? { id: p.id, type: p.type, name: p.name, price: p.price, period: p.period, listingLimit: p.listing_limit, bookingLimit: p.booking_limit, referralPointsRequired: p.referral_points_required || 0, sortOrder: p.sort_order, features: (p.features || []).map((x) => (typeof x === 'string' ? x : x.label)).join('\n'), adsFree: !!p.ads_free, isFeatured: !!p.is_featured, popular: !!p.popular, badgeLabel: p.badge_label || 'Popular', isActive: !!p.is_active } : blank);
  const submit = () => save.mutate({ ...f, price: +f.price || 0, listingLimit: +f.listingLimit, bookingLimit: +f.bookingLimit, referralPointsRequired: +f.referralPointsRequired || 0, sortOrder: +f.sortOrder || 99, features: f.features.split('\n').map((s) => s.trim()).filter(Boolean) }, { onSuccess: () => setF(null) });
  const lim = (n) => (n >= 999 ? 'unlimited' : n);
  return (
    <>
      <Head title="Plans" sub="Changes apply immediately. Hidden plans cannot be chosen by new users."><Button onClick={() => open()}>Add a plan</Button></Head>
      <Load q={q}>{(d) => ['regular', 'provider'].map((t) => (
        <section key={t} className="section" style={{ marginTop: 'var(--s6)' }}><div className="section-head"><h2>{t === 'regular' ? 'Customer plans' : 'Provider plans'}</h2></div>
          <Table rows={d.items.filter((p) => p.type === t)} cols={[['Plan', (p) => <b>{p.name}</b>], ['Price', (p) => <span className="num">{p.price ? `${peso(p.price)} / ${PERIOD[p.period]}` : 'Free'}</span>], ['Limits', (p) => t === 'provider' ? `${lim(p.listing_limit)} listings · ${lim(p.booking_limit)} bookings` : '—'], ['Perks', (p) => [p.ads_free && 'No ads', p.is_featured && 'Featured', p.referral_points_required > 0 && `${p.referral_points_required} pts`].filter(Boolean).join(' · ') || '—'], ['Status', (p) => <Status kind={p.is_active ? 'ok' : 'neutral'}>{p.is_active ? 'Visible' : 'Hidden'}</Status>],
            ['', (p) => <div className="actions-cell"><Btn variant="secondary" onClick={() => open(p)}>Edit</Btn>{!d.permanent.includes(p.id) && <Btn variant="quiet" onClick={() => setDel(p)}>Delete</Btn>}</div>]]} /></section>
      ))}</Load>
      <Dialog open={!!f} onClose={() => setF(null)} title={f?.id ? 'Edit plan' : 'New plan'} wide>
        {f && <div className="stack">
          <div className="two"><Field as="select" label="For" value={f.type} disabled={!!f.id} onChange={set('type')}><option value="regular">Customers</option><option value="provider">Providers</option></Field><Field label="Name" value={f.name} onChange={set('name')} /></div>
          <div className="two"><Field label="Price (₱)" type="number" value={f.price} onChange={set('price')} /><Field as="select" label="Billing" value={f.period} onChange={set('period')}>{Object.entries(PERIOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Field></div>
          <div className="two"><Field label="Listing limit (999 = unlimited)" type="number" value={f.listingLimit} onChange={set('listingLimit')} /><Field label="Active booking limit (999 = unlimited)" type="number" value={f.bookingLimit} onChange={set('bookingLimit')} /></div>
          <div className="two"><Field label="Points to redeem (0 = not redeemable)" type="number" value={f.referralPointsRequired} onChange={set('referralPointsRequired')} /><Field label="Sort order (low = first)" type="number" value={f.sortOrder} onChange={set('sortOrder')} /></div>
          <Field as="textarea" label="Features (one per line)" value={f.features} onChange={set('features')} />
          <div className="cluster"><label className="check"><input type="checkbox" checked={f.adsFree} onChange={set('adsFree')} />No ads</label><label className="check"><input type="checkbox" checked={f.isFeatured} onChange={set('isFeatured')} />Featured placement</label><label className="check"><input type="checkbox" checked={f.isActive} onChange={set('isActive')} />Visible</label><label className="check"><input type="checkbox" checked={f.popular} onChange={set('popular')} />Badge</label></div>
          {f.popular && <Field label="Badge text" value={f.badgeLabel} onChange={set('badgeLabel')} />}
          <div className="dlg__actions"><Button loading={save.isPending} onClick={submit}>Save plan</Button><Button variant="quiet" onClick={() => setF(null)}>Cancel</Button></div>
        </div>}
      </Dialog>
      <Confirm open={!!del} title={`Delete ${del?.name}?`} confirmLabel="Delete" danger busy={rm.isPending} onClose={() => setDel(null)} onConfirm={() => rm.mutate({ id: del.id }, { onSuccess: () => setDel(null) })}>Users already on this plan keep their access until it ends.</Confirm>
    </>
  );
}
