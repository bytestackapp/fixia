import { useState } from 'react';
import { Eye, Check, Pause, X } from 'lucide-react';
import { useAdm, useDo, Load, Head, Table, IconBtn, Prompt, Detail } from './kit.jsx';
import Dialog, { Confirm } from '../../components/ui/Dialog.jsx';
import { Tabs, Status } from '../../components/ui/Kit.jsx';
import { fdate } from '../../lib/format.js';

export default function Pending() {
  const q = useAdm('pending.list'); const [tab, setTab] = useState('pending'), [view, setView] = useState(null), [ask, setAsk] = useState(null);
  const approve = useDo('provider.approve', 'Provider approved'), reject = useDo('provider.reject', 'Provider rejected'), hold = useDo('provider.compliance', 'Provider put on hold');
  const close = () => setAsk(null);
  return (
    <>
      <Head title="Applications" sub="Check the ID and payment, then approve, hold or reject." />
      <Tabs items={[['pending', 'Awaiting review'], ['needs_compliance', 'On hold']]} value={tab} onChange={setTab} />
      <Load q={q}>{(d) => (
        <Table empty="No applications here." rows={d.items.filter((p) => p.status === tab)} cols={[
          ['Business', (p) => <><b>{p.biz_name}</b><br /><span className="muted">{p.user?.first_name} {p.user?.last_name}</span></>],
          ['Location', (p) => [p.city_name, p.province_name].filter(Boolean).join(', ')],
          ['Plan / payment', (p) => <>{p.user?.package_name}<br /><Status kind={p.user?.payment_status === 'verified' ? 'ok' : p.user?.payment_status === 'free' ? 'neutral' : 'warn'}>{p.user?.payment_status || 'none'}</Status></>],
          ['Applied', (p) => fdate(p.created_at)],
          ['', (p) => <div className="actions-cell"><IconBtn icon={Eye} label="Review" onClick={() => setView(p)} /><IconBtn icon={Check} label="Approve" variant="primary" onClick={() => setAsk({ k: 'approve', p })} /><IconBtn icon={Pause} label="Hold" onClick={() => setAsk({ k: 'hold', p })} /><IconBtn icon={X} label="Reject" variant="danger" onClick={() => setAsk({ k: 'reject', p })} /></div>],
        ]} />
      )}</Load>
      <Dialog open={!!view} onClose={() => setView(null)} title={view?.biz_name} wide>
        {view && <><Detail rows={[['Owner', `${view.user?.first_name} ${view.user?.last_name}`], ['Email', view.user?.email], ['Phone', view.user?.phone], ['Address', [view.street_addr, view.barangay_name, view.city_name, view.province_name].filter(Boolean).join(', ')], ['ID type', view.id_type], ['Plan', view.user?.package_name], ['Payment', `${view.user?.payment_method || '—'} · ref ${view.user?.payment_reference || '—'} · ₱${view.user?.payment_amount || '—'} · ${view.user?.payment_status || '—'}`]]} />
          {view.id_file_url ? <a href={view.id_file_url} target="_blank" rel="noreferrer"><img className="idphoto" src={view.id_file_url} alt="Government ID" /></a> : <p className="muted">No ID on file.</p>}
          <div className="dlg__actions"><button className="btn btn--secondary" onClick={() => setView(null)}>Close</button></div></>}
      </Dialog>
      <Confirm open={ask?.k === 'approve'} title={`Approve ${ask?.p.biz_name}?`} confirmLabel="Approve" busy={approve.isPending} onClose={close} onConfirm={() => approve.mutate({ providerId: ask.p.id }, { onSuccess: close })}>The account goes live and the ID photo is deleted.</Confirm>
      <Prompt open={ask?.k === 'hold'} title={`Hold ${ask?.p.biz_name}`} label="What must the provider do?" required confirmLabel="Hold application" busy={hold.isPending} onClose={close} onSubmit={(v) => hold.mutate({ providerId: ask.p.id, reason: v }, { onSuccess: close })} />
      <Prompt open={ask?.k === 'reject'} title={`Reject ${ask?.p.biz_name}?`} label="Reason (sent to the provider)" danger confirmLabel="Reject" busy={reject.isPending} onClose={close} onSubmit={(v) => reject.mutate({ providerId: ask.p.id, reason: v }, { onSuccess: close })}><p className="muted small">The ID and photo are deleted. The account is removed after 30 days.</p></Prompt>
    </>
  );
}