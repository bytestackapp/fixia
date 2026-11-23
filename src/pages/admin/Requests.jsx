import { useState } from 'react';
import { Eye } from 'lucide-react';
import { useAdm, useDo, Load, Head, Table, Btn, IconBtn, Prompt, Detail } from './kit.jsx';
import Dialog from '../../components/ui/Dialog.jsx';
import { Status } from '../../components/ui/Kit.jsx';
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
  try { const l = JSON.parse(r.requested_value); return place(l); } catch { return r.requested_value; }
}
export default function Requests() {
  const q = useAdm('changes.list'); const [v, setV] = useState(null), [no, setNo] = useState(false);
  const ok = useDo('change.approve', 'Request approved'), rej = useDo('change.reject', 'Request rejected'), send = useDo('change.sendCode', 'Code sent to the new email');
  const cur = v && ((q.data?.items || []).find((x) => x.id === v.id) || v);
  const needsMail = !!cur?.newEmail;
  const mailState = !cur?.codeSent ? <Status kind="warn">Code not sent</Status> : cur.email_verified ? <Status kind="ok">Verified</Status> : <Status kind="neutral">Code sent, waiting ({cur.verify_attempts || 0}/3 wrong tries)</Status>;
  return (
    <>
      <Head title="Change requests" sub="Business name, email and location changes from providers." />
      <Load q={q}>{(d) => <Table empty="No pending requests." rows={d.items} cols={[['Provider', (r) => <b>{r.provider_name}</b>], ['Change', (r) => r.subject], ['Sent', (r) => fdate(r.created_at)], ['', (r) => <div className="actions-cell"><IconBtn icon={Eye} label="Review" onClick={() => setV(r)} /></div>]]} />}</Load>
      <Dialog open={!!v && !no} onClose={() => { if (!no) setV(null); }} title={cur?.subject} wide>
        {cur && <><Detail rows={[['Provider', cur.provider_name], ['Requested', value(cur)], needsMail && ['New email check', mailState], ['Reason', cur.explanation]]} />
          {needsMail && !cur.email_verified && <p className="small muted">Send a code to the new email. The provider must enter it in the app. You can approve only after it shows Verified.</p>}
          {cur.subject === 'Multiple Changes' && <p className="small muted">Multiple changes are not applied automatically. Update them in Admin &gt; Providers first, then press Approve to notify the provider.</p>}
          {cur.file_url ? <a href={cur.file_url} target="_blank" rel="noreferrer">View attached document</a> : <p className="small muted">No document attached.</p>}
          <div className="dlg__actions">
            {needsMail && !cur.email_verified && <Btn variant="secondary" loading={send.isPending} onClick={() => send.mutate({ id: cur.id })}>{cur.codeSent ? 'Resend code' : 'Send code to new email'}</Btn>}
            <Btn loading={ok.isPending} disabled={needsMail && !cur.email_verified} onClick={() => ok.mutate({ id: cur.id }, { onSuccess: () => setV(null) })}>Approve</Btn>
            <Btn variant="danger" onClick={() => setNo(true)}>Reject</Btn>
            <Btn variant="quiet" onClick={() => setV(null)}>Close</Btn>
          </div></>}
      </Dialog>
      <Prompt open={no} title="Reject request" label="Reason (sent to the provider)" required danger confirmLabel="Reject" busy={rej.isPending} onClose={() => setNo(false)} onSubmit={(r) => rej.mutate({ id: cur.id, reason: r }, { onSuccess: () => { setNo(false); setV(null); } })} />
    </>
  );
}