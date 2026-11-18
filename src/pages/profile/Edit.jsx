import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth.jsx';
import { useAct } from '../../lib/queries.js';
import { call } from '../../lib/api.js';
import { toast } from '../../lib/toast.jsx';
import { fileToDataUrl } from '../../lib/image.js';
import Field from '../../components/ui/Field.jsx';
import Button from '../../components/ui/Button.jsx';
import Dialog from '../../components/ui/Dialog.jsx';
import PlaceFields from '../../components/PlaceFields.jsx';

export default function Edit({ data }) {
  const { user, refresh } = useAuth(); const isPro = user.role === 'provider';
  const { account: a, provider: p } = data;
  const [f, setF] = useState({ email: a.email, phone: a.phone, bizDesc: p?.bizDesc || '' }), [req, setReq] = useState(false);
  const save = useAct('profile.update', { invalidate: ['profile'], ok: 'Changes saved.', onSuccess: () => refresh() });
  const submit = (e) => { e.preventDefault(); save.mutate(isPro ? { phone: f.phone, bizDesc: f.bizDesc } : { email: f.email, phone: f.phone }); };
  return (
    <div className="stack stack--lg">
      <form className="form" onSubmit={submit} noValidate>
        <div className="two"><Field label="First name" value={a.firstName} disabled /><Field label="Last name" value={a.lastName} disabled /></div>
        <Field label="Username" value={a.username} disabled />
        {isPro ? <Field label="Business name" value={p.bizName} disabled hint="To change this, send a change request below." /> : <Field label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}
        <Field label="Mobile number" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} hint={isPro ? 'Shown to customers who tap Contact.' : undefined} />
        {isPro && <Field as="textarea" label="About your business" maxLength={300} value={f.bizDesc} onChange={(e) => setF({ ...f, bizDesc: e.target.value })} />}
        <div><Button type="submit" loading={save.isPending}>Save changes</Button></div>
      </form>
      {isPro && <div className="stack"><h3>Business details</h3><p className="muted small">Business name, email and location changes are reviewed by our team. One request every 30 days.</p><div><Button variant="secondary" onClick={() => setReq(true)}>Request a change</Button></div></div>}
      {isPro && <ChangeDialog open={req} onClose={() => setReq(false)} />}
    </div>
  );
}

function ChangeDialog({ open, onClose }) {
  const { data } = useQuery({ queryKey: ['cooldown'], queryFn: () => call('change.cooldown'), enabled: open });
  const [s, setS] = useState({ subject: '', value: '', why: '', file: '' }), [place, setPlace] = useState({}), [street, setStreet] = useState(''), [busy, setBusy] = useState(false);
  const locked = data?.daysLeft > 0;
  async function send() {
    setBusy(true);
    try {
      const value = s.subject === 'Location Change' ? JSON.stringify({ region_name: place.regionName, province_name: place.provName, city_name: place.cityName, barangay_name: place.brgyName, street_addr: street }) : s.value;
      await call('change.submit', { subject: s.subject, requestedValue: value, explanation: s.why, file: s.file || undefined });
      toast('Request sent. We will message you with the result.');
      setS({ subject: '', value: '', why: '', file: '' }); onClose();
    } catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  }
  return (
    <Dialog open={open} onClose={onClose} title="Request a change" wide>
      <div className="stack">
        {locked && <p className="muted small">You sent a request recently. You can send another in {data.daysLeft} day{data.daysLeft === 1 ? '' : 's'}.</p>}
        <Field as="select" label="What would you like to change?" value={s.subject} disabled={locked} onChange={(e) => setS({ ...s, subject: e.target.value })}><option value="">Select…</option><option>Business Name Change</option><option>Email Change</option><option>Location Change</option><option>Other</option></Field>
        {['Business Name Change', 'Email Change'].includes(s.subject) && <Field label={s.subject === 'Email Change' ? 'New email' : 'New business name'} value={s.value} onChange={(e) => setS({ ...s, value: e.target.value })} />}
        {s.subject === 'Location Change' && <><PlaceFields onChange={setPlace} /><Field label="Street address (optional)" value={street} onChange={(e) => setStreet(e.target.value)} /></>}
        <Field as="textarea" label="Why do you need this change?" value={s.why} onChange={(e) => setS({ ...s, why: e.target.value })} />
        <label className="field"><span className="field__label">Supporting document (optional, image or PDF)</span><input type="file" accept="image/jpeg,image/png,application/pdf" onChange={async (e) => { const f = e.target.files[0]; if (f && f.size > 2_000_000) { toast('File must be under 2 MB.', 'error'); e.target.value = ''; return; } setS({ ...s, file: f ? await fileToDataUrl(f) : '' }); }} /></label>
        <div className="dlg__actions"><Button loading={busy} disabled={locked || !s.subject} onClick={send}>Send request</Button><Button variant="quiet" onClick={onClose}>Cancel</Button></div>
      </div>
    </Dialog>
  );
}
