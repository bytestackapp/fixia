import { useState } from 'react';
import { Eye } from 'lucide-react';
import { useAdm, useDo, Load, Head, Table, Btn, IconBtn, Prompt, Detail } from './kit.jsx';
import Dialog from '../../components/ui/Dialog.jsx';
import { fdate } from '../../lib/format.js';

const place = (l) => [l.street_addr, l.barangay_name, l.city_name, l.province_name, l.region_name].filter(Boolean).join(', ');
function value(r) {
  if (r.subject === 'Multiple Changes') {
    try {
      const m = JSON.parse(r.requested_value);
      const lines = [m.business_name && `Business name: ${m.business_name}`, m.email && `Email: ${m.email}`, m.location && `Location: ${place(m.location)}`].filter(Boolean);
      return <span style={{ whiteSpace: 'pre-line' }}>{lines.join('\n')}</span>;
    } catch { return r.requested_value; }
  }
  if (r.subject !== 'Location Change') return r.requested_value;
  try { const l = JSON.parse(r.requested_value); return [l.street_addr, l.barangay_name, l.city_name, l.province_name, l.region_name].filter(Boolean).join(', '); } catch { return r.requested_value; }
}
export default function Requests() {
  const q = useAdm('changes.list'); const [v, setV] = useState(null), [no, setNo] = useState(false);
  const ok = useDo('change.approve', 'Request approved'), rej = useDo('change.reject', 'Request rejected');
  return (
    <>
      <Head title="Change requests" sub="Business name, email and location changes from providers." />
      <Load q={q}>{(d) => <Table empty="No pending requests." rows={d.items} cols={[['Provider', (r) => <b>{r.provider_name}</b>], ['Change', (r) => r.subject], ['Sent', (r) => fdate(r.created_at)], ['', (r) => <div className="actions-cell"><IconBtn icon={Eye} label="Review" onClick={() => setV(r)} /></div>]]} />}</Load>
      <Dialog open={!!v && !no} onClose={() => setV(null)} title={v?.subject} wide>
        {v && <><Detail rows={[['Provider', v.provider_name], ['Requested', value(v)], ['Reason', v.explanation]]} />
          {v.subject === 'Multiple Changes' && <p className="small muted">Multiple changes are not applied automatically. Update them in Admin &gt; Providers first, then press Approve to notify the provider.</p>}
          {v.file_url && <a href={v.file_url} target="_blank" rel="noreferrer">View attached document</a>}
          <div className="dlg__actions"><Btn loading={ok.isPending} onClick={() => ok.mutate({ id: v.id }, { onSuccess: () => setV(null) })}>Approve</Btn><Btn variant="danger" onClick={() => setNo(true)}>Reject</Btn><Btn variant="quiet" onClick={() => setV(null)}>Close</Btn></div></>}
      </Dialog>
      <Prompt open={no} title="Reject request" label="Reason (sent to the provider)" required danger confirmLabel="Reject" busy={rej.isPending} onClose={() => setNo(false)} onSubmit={(r) => rej.mutate({ id: v.id, reason: r }, { onSuccess: () => { setNo(false); setV(null); } })} />
    </>
  );
}