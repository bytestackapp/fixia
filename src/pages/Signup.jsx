import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Wrench, Check, ChevronRight } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { shrink } from '../lib/image.js';
import { toast } from '../lib/toast.jsx';
import Logo from '../components/Logo.jsx';
import Field from '../components/ui/Field.jsx';
import Button from '../components/ui/Button.jsx';
import { Stepper } from '../components/ui/Kit.jsx';
import PlanPicker from '../components/PlanPicker.jsx';
import PlaceFields from '../components/PlaceFields.jsx';
import OtpInput from '../components/ui/OtpInput.jsx';
import { DocDialog } from './Info.jsx';
import Dialog from '../components/ui/Dialog.jsx';
import { peso, PERIOD } from '../lib/format.js';
import './Login.css';

const refCode = () => localStorage.getItem('fixia.ref') || null;
const ID_TYPES = ['PhilSys / National ID', "Driver's License", 'Passport', 'SSS / GSIS ID', 'Postal ID', "Voter's ID", 'PRC ID', 'TIN ID', 'Other Government ID'];
const Page = ({ children, wide }) => <div className="login"><main className="login__main" style={{ alignContent: 'start', maxWidth: wide ? 560 : 460 }}><div className="stack stack--lg" style={{ width: '100%' }}>{children}</div></main></div>;
const Perk = ({ children }) => <div className="perk"><Check size={12} aria-hidden="true" />{children}</div>;

export function SignupChoice() {
  const [sp] = useSearchParams();
  useEffect(() => { const r = sp.get('ref'); if (r) localStorage.setItem('fixia.ref', r); }, [sp]);
  return (
    <Page>
      <div className="logo-wrap"><Logo /><p className="logo-sub">Choose the account type that fits you</p></div>
      <Link to="/signup/customer" className="type-card">
        <span className="type-card__icon type-card__icon--a"><Search size={24} aria-hidden="true" /></span>
        <span className="type-card__body">
          <span className="type-card__title">Find Services</span>
          <span className="type-card__desc">Discover trusted professionals and service providers near you.</span>
          <span className="perks"><Perk>Free and easy sign-up</Perk><Perk>Browse verified providers near you</Perk><Perk>Read ratings and real customer reviews</Perk></span>
        </span>
        <ChevronRight size={18} className="type-card__arrow" aria-hidden="true" />
      </Link>
      <Link to="/signup/provider" className="type-card">
        <span className="type-card__icon type-card__icon--b"><Wrench size={24} aria-hidden="true" /></span>
        <span className="type-card__body">
          <span className="type-card__title">Offer Services</span>
          <span className="type-card__desc">Promote your skills or business and connect with customers in your area.</span>
          <span className="perks"><Perk>Create your service listing in minutes</Perk><Perk>Get discovered by nearby clients</Perk><Perk>Build trust through ratings and reviews</Perk></span>
        </span>
        <ChevronRight size={18} className="type-card__arrow" aria-hidden="true" />
      </Link>
      <p className="small muted" style={{ textAlign: 'center' }}>Already have an account? <Link to="/login">Sign in</Link></p>
    </Page>
  );
}

/* shared first steps: details → email code */
function useAccountSteps(role) {
  const [d, setD] = useState({ firstName: '', lastName: '', email: '', phone: '', username: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({}), [busy, setBusy] = useState(false);
  const [code, setCode] = useState(''), [proof, setProof] = useState('');
  const set = (k) => (e) => setD((x) => ({ ...x, [k]: e.target.value }));

  function validate() {
    const e = {};
    if (!d.firstName.trim()) e.firstName = 'Enter your first name.';
    if (!d.lastName.trim()) e.lastName = 'Enter your last name.';
    if (!/^\S+@\S+\.\S+$/.test(d.email)) e.email = 'Enter a valid email address.';
    if (!/^(09\d{9}|\+639\d{9})$/.test(d.phone)) e.phone = 'Enter your mobile number like 09XXXXXXXXX.';
    if (!/^[a-zA-Z0-9._]{3,30}$/.test(d.username)) e.username = 'Username: 3–30 letters, numbers, dot or underscore.';
    if (d.password.length < 8) e.password = 'Password needs at least 8 characters.';
    if (d.confirm !== d.password) e.confirm = 'The two passwords do not match.';
    setErrors(e);
    const first = Object.values(e)[0];
    if (first) toast(first, 'error');
    return !first;
  }
  async function sendCode() { return (await api('auth', { action: 'otp.send', email: d.email })).required; }
  async function verify() { setProof((await api('auth', { action: 'otp.verify', email: d.email, code })).proof); }
  return { d, set, errors, busy, setBusy, code, setCode, proof, validate, sendCode, verify, role };
}

function DetailsForm({ s, onNext }) {
  const { d, set, errors } = s;
  return (
    <form className="stack" noValidate onSubmit={(e) => { e.preventDefault(); onNext(); }}>
      <div className="two"><Field label="First name" autoComplete="given-name" value={d.firstName} onChange={set('firstName')} error={errors.firstName} /><Field label="Last name" autoComplete="family-name" value={d.lastName} onChange={set('lastName')} error={errors.lastName} /></div>
      <Field label="Email" type="email" autoComplete="email" value={d.email} onChange={set('email')} error={errors.email} />
      <Field label="Mobile number" type="tel" autoComplete="tel" placeholder="09XXXXXXXXX" value={d.phone} onChange={set('phone')} error={errors.phone} />
      <Field label="Username" autoComplete="username" autoCapitalize="none" value={d.username} onChange={set('username')} error={errors.username} />
      <Field label="Password" type="password" autoComplete="new-password" value={d.password} onChange={set('password')} error={errors.password} />
      <Field label="Repeat password" type="password" autoComplete="new-password" value={d.confirm} onChange={set('confirm')} error={errors.confirm} />
      <Button type="submit" block loading={s.busy}>Continue</Button>
    </form>
  );
}
function VerifyForm({ s, onBack, onNext }) {
  const [wait, setWait] = useState(60);
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(t); }, [wait]);
  async function submit(e) { e.preventDefault(); if (s.code.length !== 6) return toast('Enter the 6-digit code.', 'error'); s.setBusy(true); try { await s.verify(); onNext(); } catch (err) { toast(err.message, 'error'); } s.setBusy(false); }
  async function resend() {
    if (wait > 0) return;
    try { await s.sendCode(); s.setCode(''); setWait(60); toast('Code resent. Check your email.'); }
    catch (err) { toast(err.message, 'error'); }
  }
  return (
    <form className="stack" onSubmit={submit} noValidate>
      <p className="muted">We sent a 6-digit code to <b>{s.d.email}</b>.</p>
      <div className="field"><span className="field__label">Verification code</span><OtpInput value={s.code} onChange={s.setCode} /></div>
      <div className="vf-resend"><button type="button" onClick={resend} disabled={wait > 0}>{wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}</button></div>
      <div className="vf-actions"><Button type="submit" loading={s.busy}>Verify</Button><Button type="button" variant="secondary" onClick={onBack}>Back</Button></div>
    </form>
  );
}
function usePlans(type) {
  const [plans, setPlans] = useState(null);
  useEffect(() => { api('auth', { action: 'packages.public', type }).then((r) => setPlans(r.items)).catch((e) => toast(e.message, 'error')); }, [type]);
  return { plans };
}

/* ── payment choices (logos are in public/images) ── */
const LOGO = { paypal: 'paypal', paymongo: 'paymongo', tbc: 'tbc', gcash: 'gcash', maya: 'maya', bank: 'bpi' };
// key, name, fee percent, fixed fee, switched off?  (TBC has no payment service behind it yet)
const ONLINE = [['paypal', 'PayPal', 0.044, 15], ['paymongo', 'PayMongo', 0.029, 0], ['tbc', 'TBC', 0, 0, true]];
const MANUAL = [['gcash', 'GCash'], ['maya', 'Maya'], ['bank', 'Bank']];
const isManual = (k) => MANUAL.some((m) => m[0] === k);

function PayOpt({ k, label, on, disabled, onPick }) {
  return (
    <label className={`plan pm${on ? ' is-on' : ''}${disabled ? ' is-off' : ''}`}>
      <input className="sr-only" type="radio" name="pm" checked={on} disabled={disabled} onChange={() => onPick(k)} />
      <img className="pm__logo" src={`/images/${LOGO[k]}.png`} alt={label} />
      {disabled && <span className="small muted">Coming soon</span>}
    </label>
  );
}

function PayModal({ open, plan, busy, actionLabel, onClose, onPay }) {
  const [method, setMethod] = useState(''), [ref, setRef] = useState(''), [amt, setAmt] = useState('');
  const price = plan?.price || 0;
  const online = ONLINE.find((m) => m[0] === method), manual = MANUAL.find((m) => m[0] === method);
  const fee = online ? Math.ceil(price * online[2] + online[3]) : 0;
  const close = () => { if (busy) return; setMethod(''); setRef(''); setAmt(''); onClose(); };
  function pick(k) { setMethod(k); if (isManual(k) && !amt) setAmt(String(price)); }
  function submit() {
    if (!method) return toast('Choose how you want to pay.', 'error');
    if (manual && !ref.trim()) return toast('Enter your reference number.', 'error');
    if (manual && !(Number(amt) > 0)) return toast('Enter the amount you sent.', 'error');
    onPay({ method, reference: ref.trim(), amount: amt });
  }
  return (
    <Dialog open={open} onClose={close} title="Choose how to pay">
      {plan && (
        <div className="paycard">
          <span className="paycard__label">Your plan</span>
          <b className="paycard__name">{plan.name}</b>
          <span className="paycard__price num">{peso(plan.price)}<small> / {PERIOD[plan.period] || plan.period}</small></span>
          {online && <dl className="paycard__rows"><div><dt>Processing fee</dt><dd className="num">{peso(fee)}</dd></div><div className="total"><dt>Total to pay</dt><dd className="num">{peso(plan.price + fee)}</dd></div></dl>}
        </div>
      )}
      <fieldset className="plans plans--methods">
        <legend className="plans__legend">Pay online <span className="muted small" style={{ fontWeight: 400 }}>— activated right away</span></legend>
        {ONLINE.map(([k, n, , , off]) => <PayOpt key={k} k={k} label={n} on={method === k} disabled={!!off} onPick={pick} />)}
      </fieldset>
      <fieldset className="plans plans--methods">
        <legend className="plans__legend">Pay manually <span className="muted small" style={{ fontWeight: 400 }}>— no fee, checked by our team</span></legend>
        {MANUAL.map(([k, n]) => <PayOpt key={k} k={k} label={n} on={method === k} onPick={pick} />)}
      </fieldset>
      {manual && (
        <div className="stack">
          <p className="muted small">Scan the code and send exactly <b>{peso(price)}</b> using {manual[1]}. Then enter the reference number from your receipt.</p>
          <img src={`/images/${method}-qr.png`} alt={`${manual[1]} QR code`} width="180" height="180" style={{ objectFit: 'contain', border: '1px solid var(--line)', borderRadius: 10, justifySelf: 'center' }} onError={(e) => (e.currentTarget.style.display = 'none')} />
          <Field label="Reference number" value={ref} onChange={(e) => setRef(e.target.value)} />
          <Field label="Amount sent (₱)" type="number" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} />
        </div>
      )}
      <p className="small muted">
        {manual
          ? <>Manual payments have no fee.<br />Your account is created now, and your plan starts once our team approves your payment.</>
          : <>Online payments add a small processing fee, shown above.<br />Your account is created after your payment is confirmed.</>}
      </p>
      <div className="vf-actions"><Button onClick={submit} loading={busy} disabled={!method}>{manual ? actionLabel : 'Pay now'}</Button><Button variant="secondary" disabled={busy} onClick={close}>Not now</Button></div>
    </Dialog>
  );
}

function ReviewNotice({ open, text, onDone }) {
  return (
    <Dialog open={open} onClose={onDone} title="Payment under review">
      <p>{text}</p>
      <div className="dlg__actions"><Button onClick={onDone}>Continue</Button></div>
    </Dialog>
  );
}

function AgreeNote({ checked, onChange }) {
  const [doc, setDoc] = useState(null);
  const link = (k, t) => <button type="button" className="linkbtn" onClick={() => setDoc(k)}>{t}</button>;
  return (
    <>
      <label className="check check--top">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="small">I agree to the {link('terms', 'Terms of service')} and {link('privacy', 'Privacy policy')}.</span>
      </label>
      <DocDialog doc={doc} onClose={() => setDoc(null)} />
    </>
  );
}

export function SignupCustomer() {
  const { user, adopt } = useAuth(); const nav = useNavigate();
  const s = useAccountSteps('regular'); const [step, setStep] = useState(0); const [needsCode, setNeedsCode] = useState(true);
  const { plans } = usePlans('regular'); const [plan, setPlan] = useState(''); const [agree, setAgree] = useState(false);
  const [payOpen, setPayOpen] = useState(false), [done, setDone] = useState(null);
  useEffect(() => { if (plans && !plan) setPlan(plans.find((p) => p.price === 0)?.id || plans[0]?.id); }, [plans, plan]);
  if (user) return <Navigate to="/" replace />;
  const steps = needsCode ? ['Details', 'Verify email', 'Plan'] : ['Details', 'Plan'];
  const planStep = steps.length - 1;
  const picked = plans?.find((p) => p.id === plan);
  const paid = !!picked && picked.price > 0;

  async function next() {
    if (!s.validate()) return; s.setBusy(true);
    try { const req = await s.sendCode(); setNeedsCode(req); setStep(1); } catch (e) { toast(e.message, 'error'); setStep(0); }
    s.setBusy(false);
  }
  // free plan: no payment. manual payment: account starts on Free, upgrade waits for approval.
  async function create(payment) {
    s.setBusy(true);
    try {
      const { token, user: u } = await api('auth', { action: 'register.regular', ...s.d, proof: s.proof, referredBy: refCode(), ...(payment ? { packageId: plan, payment } : {}) });
      localStorage.removeItem('fixia.ref');
      if (payment) { setPayOpen(false); setDone({ token, u }); }      // he reads the notice first, then enters the app
      else { adopt(token, u); toast('Welcome to Fixia!'); nav('/', { replace: true }); }
    } catch (e) { toast(e.message, 'error'); }
    s.setBusy(false);
  }
  // online payment: nothing is created yet. The server saves the details and opens the payment page.
  async function payOnline(method) {
    s.setBusy(true);
    try {
      const { url } = await api('auth', { action: 'signup.pay', ...s.d, role: 'regular', proof: s.proof, referredBy: refCode(), packageId: plan, method });
      window.location.href = url;
    } catch (e) { toast(e.message, 'error'); s.setBusy(false); }
  }
  const onPay = (p) => (isManual(p.method) ? create(p) : payOnline(p.method));
  const finish = () => { if (!done) return; adopt(done.token, done.u); nav('/', { replace: true }); };

  return (
    <Page>
      <div className="logo-wrap"><Logo /></div><h1 style={{ textAlign: 'center' }}>Create your account</h1>
      <Stepper steps={steps} current={step} />
      {step === 0 && <DetailsForm s={s} onNext={next} />}
      {needsCode && step === 1 && <VerifyForm s={s} onBack={() => setStep(0)} onNext={() => setStep(2)} />}
      {step === planStep && (
        <div className="stack">
          <p className="muted">Start free. You can upgrade any time.</p>
          {plans ? <PlanPicker plans={plans} value={plan} onChange={setPlan} /> : <div className="skeleton" style={{ height: 120 }} />}
          <AgreeNote checked={agree} onChange={setAgree} />
          <div className="vf-actions"><Button onClick={paid ? () => setPayOpen(true) : () => create()} loading={s.busy && !payOpen} disabled={!plan || !agree}>{paid ? 'Continue to payment' : 'Create account'}</Button>{needsCode && <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>}</div>
          <PayModal open={payOpen} plan={picked} busy={s.busy} actionLabel="Create account" onClose={() => setPayOpen(false)} onPay={onPay} />
        </div>
      )}
      <ReviewNotice open={!!done} onDone={finish} text="We received your payment details and your account is ready. Our team will check your payment and activate your plan once it is approved. Until then, you can use Fixia on the Free plan." />
      <p className="small muted" style={{ textAlign: 'center' }}>Already registered? <Link to="/login">Sign in</Link></p>
    </Page>
  );
}

export function SignupProvider() {
  const { user, adopt } = useAuth(); const nav = useNavigate();
  const s = useAccountSteps('provider'); const [step, setStep] = useState(0); const [needsCode, setNeedsCode] = useState(true);
  const { plans } = usePlans('provider'); const [plan, setPlan] = useState(''); const [agree, setAgree] = useState(false);
  const [biz, setBiz] = useState(''), [street, setStreet] = useState(''), [place, setPlace] = useState({});
  const [avatar, setAvatar] = useState(''), [idType, setIdType] = useState(''), [idFile, setIdFile] = useState('');
  const [payOpen, setPayOpen] = useState(false), [done, setDone] = useState(null);
  if (user) return <Navigate to="/" replace />;
  const all = ['Details', 'Verify email', 'Business', 'Photos & ID', 'Plan'];
  const steps = needsCode ? all : all.filter((x) => x !== 'Verify email');
  const name = steps[step];
  const bad = (m) => toast(m, 'error');
  const picked = plans?.find((p) => p.id === plan);
  const paid = !!picked && picked.price > 0;

  async function next() {
    if (!s.validate()) return; s.setBusy(true);
    try { const req = await s.sendCode(); setNeedsCode(req); setStep(1); } catch (e) { bad(e.message); }
    s.setBusy(false);
  }
  const go = (n) => setStep(n);
  const bizNext = () => { if (!biz.trim()) return bad('Enter your business or shop name.'); if (!place.regionName || !place.cityName) return bad('Choose your region and city.'); go(step + 1); };
  const photoNext = () => { if (!avatar) return bad('Add a profile photo or logo.'); if (!idType) return bad('Choose your ID type.'); if (!idFile) return bad('Upload your government ID.'); go(step + 1); };
  async function pick(setter, opts, e) { try { setter(await shrink(e.target.files[0], opts)); } catch (err) { bad(err.message); } e.target.value = ''; }
  const body = () => ({ ...s.d, proof: s.proof, referredBy: refCode(), bizName: biz, streetAddr: street, ...place, idType, idFile, avatar, packageId: plan });

  // free plan: no payment. manual payment: application is sent with the payment details for review.
  async function create(payment) {
    s.setBusy(true);
    try {
      const out = await api('auth', { action: 'register.provider', ...body(), ...(payment ? { payment } : {}) });
      localStorage.removeItem('fixia.ref');
      if (payment) { setPayOpen(false); setDone(out); }
      else { adopt(out.token, out.user); toast('Application sent. We will review it within 24–48 hours.'); nav('/profile', { replace: true }); }
    } catch (e) { bad(e.message); }
    s.setBusy(false);
  }
  // online payment: nothing is created yet. The server saves the details and opens the payment page.
  async function payOnline(method) {
    s.setBusy(true);
    try {
      const { url } = await api('auth', { action: 'signup.pay', ...body(), role: 'provider', method });
      window.location.href = url;
    } catch (e) { bad(e.message); s.setBusy(false); }
  }
  const onPay = (p) => (isManual(p.method) ? create(p) : payOnline(p.method));
  const finish = () => { if (!done) return; adopt(done.token, done.user); nav('/profile', { replace: true }); };

  return (
    <Page wide>
      <div className="logo-wrap"><Logo /></div><h1 style={{ textAlign: 'center' }}>Offer your services</h1>
      <Stepper steps={steps} current={step} />
      {name === 'Details' && <DetailsForm s={s} onNext={next} />}
      {name === 'Verify email' && <VerifyForm s={s} onBack={() => go(0)} onNext={() => go(2)} />}
      {name === 'Business' && (
        <form className="stack" noValidate onSubmit={(e) => { e.preventDefault(); bizNext(); }}>
          <Field label="Business or shop name" value={biz} onChange={(e) => setBiz(e.target.value)} />
          <PlaceFields onChange={setPlace} />
          <Field label="Street address (optional)" placeholder="House no., street, purok / sitio" value={street} onChange={(e) => setStreet(e.target.value)} />
          <div className="cluster"><Button type="submit">Continue</Button><Button type="button" variant="secondary" onClick={() => go(step - 1)}>Back</Button></div>
        </form>
      )}
      {name === 'Photos & ID' && (
        <form className="stack stack--lg" noValidate onSubmit={(e) => { e.preventDefault(); photoNext(); }}>
          <div className="stack">
            <b>Profile photo or logo</b><p className="small muted">Shown on your listings and in search. A square image works best.</p>
            <div className="cluster">{avatar && <img src={avatar} alt="Your photo" width="72" height="72" className="avatar" />}<label className="btn btn--secondary">{avatar ? 'Change photo' : 'Choose photo'}<input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(setAvatar, { square: 320 }, e)} /></label></div>
          </div>
          <div className="stack">
            <b>Government-issued ID</b><p className="small muted">Used only by our team to verify you. Never shown to customers, and deleted after verification.</p>
            <Field as="select" label="ID type" value={idType} onChange={(e) => setIdType(e.target.value)}><option value="">Select…</option>{ID_TYPES.map((t) => <option key={t}>{t}</option>)}</Field>
            {idFile && <img src={idFile} alt="Your ID, as uploaded" style={{ maxHeight: 160, objectFit: 'contain', border: '1px solid var(--line)', borderRadius: 10 }} />}
            <div><label className="btn btn--secondary">{idFile ? 'Change ID photo' : 'Upload ID photo'}<input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(setIdFile, { max: 1200 }, e)} /></label></div>
          </div>
          <div className="cluster"><Button type="submit">Continue</Button><Button type="button" variant="secondary" onClick={() => go(step - 1)}>Back</Button></div>
        </form>
      )}
      {name === 'Plan' && (
        <div className="stack">
          <p className="muted">Choose a plan. Our team reviews every application within 24–48 hours.</p>
          {plans ? <PlanPicker plans={plans} value={plan} onChange={setPlan} /> : <div className="skeleton" style={{ height: 120 }} />}
          <AgreeNote checked={agree} onChange={setAgree} />
          <div className="vf-actions"><Button onClick={paid ? () => setPayOpen(true) : () => create()} loading={s.busy && !payOpen} disabled={!plan || !agree}>{paid ? 'Continue to payment' : 'Submit application'}</Button><Button variant="secondary" onClick={() => go(step - 1)}>Back</Button></div>
          <PayModal open={payOpen} plan={picked} busy={s.busy} actionLabel="Submit application" onClose={() => setPayOpen(false)} onPay={onPay} />
        </div>
      )}
      <ReviewNotice open={!!done} onDone={finish} text="We received your application and payment details. Our team will check them within 24–48 hours and email you the result." />
      <p className="small muted" style={{ textAlign: 'center' }}>Already registered? <Link to="/login">Sign in</Link></p>
    </Page>
  );
}