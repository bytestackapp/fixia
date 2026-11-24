import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth.jsx';
import { useAct } from '../../lib/queries.js';
import { call } from '../../lib/api.js';
import { toast } from '../../lib/toast.jsx';
import { shrink } from '../../lib/image.js';
import Field from '../../components/ui/Field.jsx';
import Button from '../../components/ui/Button.jsx';
import Dialog from '../../components/ui/Dialog.jsx';
import PlaceFields from '../../components/PlaceFields.jsx';
import OtpInput from '../../components/ui/OtpInput.jsx';

export default function Edit({ data }) {
  const { user, refresh } = useAuth(); const isPro = user.role === 'provider';
  const { account: a, provider: p } = data;
  const [f, setF] = useState({ email: a.email, phone: a.phone, bizDesc: p?.bizDesc || '' }), [req, setReq] = useState(false);
  const { data: cd } = useQuery({ queryKey: ['cooldown'], queryFn: () => call('change.cooldown'), enabled: isPro });
  const left = cd?.daysLeft || 0;
  const save = useAct('profile.update', { invalidate: ['profile'], ok: 'Changes saved.', onSuccess: () => refresh() });
  const submit = (e) => { e.preventDefault(); save.mutate(isPro ? { phone: f.phone, bizDesc: f.bizDesc } : { email: f.email, phone: f.phone }); };
  const where = p ? [p.street, p.barangay, p.city, p.province].filter(Boolean).join(', ') : '';
  return (
    <div className="stack stack--lg">
      <form className="form" onSubmit={submit} noValidate>
        <h2>Information</h2>
        <p className="muted small">Keep your contact details up to date.</p>
        <div className="two"><Field label="First name" value={a.firstName} disabled /><Field label="Last name" value={a.lastName} disabled /></div>
        <Field label="Username" value={a.username} disabled />
        {isPro ? <Field label="Business name" value={p.bizName} disabled hint="To change this, send a change request below." /> : <Field label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}
        {isPro && <Field label="Email" value={a.email} disabled hint="To change this, send a change request below." />}
        {isPro && <Field label="Location" value={where || '—'} disabled hint="To change this, send a change request below." />}
        <Field label="Mobile number" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} hint={isPro ? 'Shown to customers who tap Contact.' : undefined} />
        {isPro && <Field as="textarea" label="About your business" maxLength={300} value={f.bizDesc} onChange={(e) => setF({ ...f, bizDesc: e.target.value })} />}
        <div><Button type="submit" loading={save.isPending}>Save changes</Button></div>
      </form>
      {isPro && <VerifyEmail />}
      {isPro && <div className="stack"><h3>Business details</h3><p className="muted small">Business name, email and location changes are reviewed by our team. One request every 30 days. Need to change more than one thing? Choose “Multiple changes” so everything goes in one request.</p><div><Button variant="secondary" disabled={left > 0} onClick={() => setReq(true)}>{left > 0 ? `Available in ${left} day${left === 1 ? '' : 's'}` : 'Request a change'}</Button></div></div>}
      {isPro && <ChangeDialog open={req} onClose={() => setReq(false)} current={{ biz: p.bizName, email: a.email, loc: where }} />}
    </div>
  );
}

const SUBJECTS = ['Business Name Change', 'Email Change', 'Location Change', 'Multiple Changes', 'Other'];

function ChangeDialog({ open, onClose, current }) {
  const qc = useQueryClient();
  const [s, setS] = useState({ subject: '', value: '', why: '', file: '' });
  const [pick, setPick] = useState({ biz: false, email: false, loc: false }), [vals, setVals] = useState({ biz: '', email: '' });
  const [place, setPlace] = useState({}), [street, setStreet] = useState(''), [busy, setBusy] = useState(false);
  const [conf, setConf] = useState(null);       // { value, rows } while the confirmation pop-up is open
  const multi = s.subject === 'Multiple Changes';
  const needsProof = ['Business Name Change', 'Location Change'].includes(s.subject) || (multi && (pick.biz || pick.loc));
  const [fileKey, setFileKey] = useState(0), [formKey, setFormKey] = useState(0);
  const noDoc = s.subject === 'Email Change' || (multi && !needsProof);
  const loc = () => ({ region_name: place.regionName, province_name: place.provName, city_name: place.cityName, barangay_name: place.brgyName, street_addr: street });
  const locText = () => [street.trim(), place.brgyName, place.cityName, place.provName].filter(Boolean).join(', ');
  const reset = () => { setS({ subject: '', value: '', why: '', file: '' }); setPick({ biz: false, email: false, loc: false }); setVals({ biz: '', email: '' }); setPlace({}); setStreet(''); setConf(null); setFileKey((k) => k + 1); setFormKey((k) => k + 1); };

  // checks the form, then opens the confirmation pop-up (nothing is sent yet)
  function review() {
    let value = s.value; const rows = [];
    if (s.subject === 'Business Name Change') {
      if (!s.value.trim()) return toast('Enter the new business name.', 'error');
      rows.push(['Business name', current.biz, s.value.trim()]);
    }
    if (s.subject === 'Email Change') {
      if (!/^\S+@\S+\.\S+$/.test(s.value)) return toast('Enter a valid email address.', 'error');
      rows.push(['Email', current.email, s.value.trim()]);
    }
    if (s.subject === 'Location Change') {
      if (!place.regionName || !place.cityName) return toast('Choose your new region and city.', 'error');
      value = JSON.stringify(loc());
      rows.push(['Location', current.loc, locText()]);
    }
    if (multi) {
      const chosen = [pick.biz, pick.email, pick.loc].filter(Boolean).length;
      if (chosen < 2) return toast('Tick at least two things to change, or pick a single change instead.', 'error');
      if (pick.biz && !vals.biz.trim()) return toast('Enter the new business name.', 'error');
      if (pick.email && !/^\S+@\S+\.\S+$/.test(vals.email)) return toast('Enter a valid email address.', 'error');
      if (pick.loc && (!place.regionName || !place.cityName)) return toast('Choose your new region and city.', 'error');
      value = JSON.stringify({ ...(pick.biz ? { business_name: vals.biz.trim() } : {}), ...(pick.email ? { email: vals.email.trim() } : {}), ...(pick.loc ? { location: loc() } : {}) });
      if (pick.biz) rows.push(['Business name', current.biz, vals.biz.trim()]);
      if (pick.email) rows.push(['Email', current.email, vals.email.trim()]);
      if (pick.loc) rows.push(['Location', current.loc, locText()]);
    }
    if (needsProof && !s.file) return toast('Attach a proof document for this change.', 'error');
    if (!s.why.trim()) return toast('Please explain why you need this change.', 'error');
    setConf({ value, rows });
  }

  async function send() {
    setBusy(true);
    try {
      await call('change.submit', { subject: s.subject, requestedValue: conf.value, explanation: s.why, file: s.file || undefined });
      toast('Request sent. We will message you with the result.');
      await qc.invalidateQueries({ queryKey: ['cooldown'] });
      await qc.invalidateQueries({ queryKey: ['emailcheck'] });
      reset(); onClose();
    } catch (e) { toast(e.message, 'error'); setConf(null); }
    setBusy(false);
  }
  return (
    <>
      <Dialog open={open} onClose={onClose} title="Request a change" wide>
        <div className="stack" key={formKey}>
          <Field as="select" label="What would you like to change?" value={s.subject} onChange={(e) => { const sub = e.target.value; setS({ ...s, subject: sub, ...(sub === 'Email Change' ? { file: '' } : {}) }); if (sub === 'Email Change') setFileKey((k) => k + 1); }}><option value="">Select…</option>{SUBJECTS.map((x) => <option key={x}>{x}</option>)}</Field>
          {['Business Name Change', 'Email Change'].includes(s.subject) && <Field label={s.subject === 'Email Change' ? 'New email' : 'New business name'} value={s.value} onChange={(e) => setS({ ...s, value: e.target.value })} />}
          {s.subject === 'Location Change' && <><PlaceFields onChange={setPlace} /><Field label="Street address (optional)" value={street} onChange={(e) => setStreet(e.target.value)} /></>}
          {multi && (
            <>
              <p className="muted small">Tick everything you want to change. Our team reviews multiple changes by hand, so it can take a little longer.</p>
              <label className="check"><input type="checkbox" checked={pick.biz} onChange={(e) => setPick({ ...pick, biz: e.target.checked })} />Business name</label>
              {pick.biz && <Field label="New business name" value={vals.biz} onChange={(e) => setVals({ ...vals, biz: e.target.value })} />}
              <label className="check"><input type="checkbox" checked={pick.email} onChange={(e) => setPick({ ...pick, email: e.target.checked })} />Email</label>
              {pick.email && <Field label="New email" type="email" value={vals.email} onChange={(e) => setVals({ ...vals, email: e.target.value })} />}
              <label className="check"><input type="checkbox" checked={pick.loc} onChange={(e) => setPick({ ...pick, loc: e.target.checked })} />Location</label>
              {pick.loc && <><PlaceFields onChange={setPlace} /><Field label="Street address (optional)" value={street} onChange={(e) => setStreet(e.target.value)} /></>}
            </>
          )}
          <Field as="textarea" label="Why do you need this change?" value={s.why} onChange={(e) => setS({ ...s, why: e.target.value })} />
          <label className="field" style={noDoc ? { opacity: .5 } : undefined}><span className="field__label">{needsProof ? 'Proof of the change (required, image)' : noDoc ? 'Supporting document (not needed for an email change)' : 'Supporting document (optional, image)'}</span><input key={fileKey} type="file" disabled={noDoc} accept="image/jpeg,image/png" onChange={async (e) => { const f = e.target.files[0]; try { setS({ ...s, file: f ? await shrink(f, { max: 1600 }) : '' }); } catch (err) { toast(err.message, 'error'); e.target.value = ''; } }} /></label>
          <div className="dlg__actions"><Button disabled={!s.subject} onClick={review}>Send request</Button><Button variant="secondary" onClick={reset}>Clear form</Button><Button variant="secondary" onClick={onClose}>Cancel</Button></div>
        </div>
      </Dialog>

      <Dialog open={!!conf} onClose={() => !busy && setConf(null)} title="Please confirm" wide>
        {conf && (
          <div className="stack">
            <div className="banner banner--warn">
              <h3>Is everything correct?</h3>
              <p className="small">Please make sure the information is true and correct. Providing false or fraudulent information or documents may result in the suspension of your account. You can send another change request only after 30 days.</p>
            </div>
            {conf.rows.length > 0 ? conf.rows.map(([label, before, after]) => (
              <div key={label} className="info-box">
                <b>{label}</b>
                <div className="info-row"><span>Before</span><b style={{ textAlign: 'right', overflowWrap: 'anywhere' }}>{before || '—'}</b></div>
                <div className="info-row"><span>After</span><b style={{ textAlign: 'right', overflowWrap: 'anywhere', color: 'var(--brand)' }}>{after || '—'}</b></div>
              </div>
            )) : <div className="info-box"><b>{s.subject}</b></div>}
            <div className="info-box">
              <b>Your reason</b>
              <p className="small" style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{s.why}</p>
              {s.file && <p className="small muted" style={{ marginTop: 4 }}>A supporting document is attached.</p>}
            </div>
            <div className="dlg__actions"><Button loading={busy} onClick={send}>Yes, Confirmed</Button><Button variant="secondary" disabled={busy} onClick={() => setConf(null)}>Go back</Button></div>
          </div>
        )}
      </Dialog>
    </>
  );
}

function VerifyEmail() {
  const qc = useQueryClient(); const { refresh } = useAuth();
  const { data } = useQuery({ queryKey: ['emailcheck'], queryFn: () => call('change.pending'), refetchInterval: 60000 });
  const [code, setCode] = useState(''), [busy, setBusy] = useState(false);
  const r = data?.request;
  if (!r) return null;
  async function submit() {
    if (code.length !== 8) return toast('Enter the 8-digit code.', 'error');
    setBusy(true);
    try {
      const out = await call('change.verify', { code });
      if (out.applied) { toast('Email confirmed and updated.'); refresh(); qc.invalidateQueries({ queryKey: ['profile'] }); }
      else if (out.ok) toast('Email confirmed. Our team will finish your request.');
      else if (out.failed) toast('Wrong code 3 times. Your request was cancelled. You can try again in 30 days.', 'error');
      else toast(`Wrong code. ${out.left} ${out.left === 1 ? 'try' : 'tries'} left.`, 'error');
      setCode('');
      await Promise.all([qc.invalidateQueries({ queryKey: ['emailcheck'] }), qc.invalidateQueries({ queryKey: ['cooldown'] })]);
    } catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  }
  if (r.verified) return <div className="banner banner--ok"><h3>New email confirmed</h3><p>Thank you. Our team will finish your request soon.</p></div>;
  if (!r.codeSent) return <div className="banner banner--warn"><h3>Confirm your new email</h3><p>Our team will send a code to <b>{r.email}</b>. You will get a message here when it is sent.</p></div>;
  return (
    <div className="banner banner--warn" style={{ maxWidth: 560 }}>
      <h3>Enter the code sent to {r.email}</h3>
      <p className="small">You have {r.left} {r.left === 1 ? 'try' : 'tries'} left. After 3 wrong tries your request is cancelled and you must wait 30 days.</p>
      <OtpInput value={code} onChange={setCode} length={8} />
      <div style={{ marginTop: 12 }}><Button loading={busy} onClick={submit}>Confirm code</Button></div>
    </div>
  );
}

