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
  async function submit(e) { e.preventDefault(); if (s.code.length !== 6) return toast('Enter the 6-digit code.', 'error'); s.setBusy(true); try { await s.verify(); onNext(); } catch (err) { toast(err.message, 'error'); } s.setBusy(false); }
  async function resend() { try { await s.sendCode(); toast('A new code was sent.'); } catch (err) { toast(err.message, 'error'); } }
  return (
    <form className="stack" onSubmit={submit} noValidate>
      <p className="muted">We sent a 6-digit code to <b>{s.d.email}</b>.</p>
      <Field label="Verification code" inputMode="numeric" maxLength={6} autoComplete="one-time-code" value={s.code} onChange={(e) => s.setCode(e.target.value.replace(/\D/g, ''))} style={{ fontSize: '1.5rem', letterSpacing: '.3em', textAlign: 'center', fontWeight: 700 }} />
      <div className="cluster"><Button type="submit" loading={s.busy}>Verify</Button><Button type="button" variant="secondary" onClick={onBack}>Back</Button><Button type="button" variant="quiet" onClick={resend}>Resend code</Button></div>
    </form>
  );
}
function usePlans(type) {
  const [plans, setPlans] = useState(null);
  useEffect(() => { api('auth', { action: 'packages.public', type }).then((r) => setPlans(r.items)).catch((e) => toast(e.message, 'error')); }, [type]);
  return { plans };
}

export function SignupCustomer() {
  const { user, adopt } = useAuth(); const nav = useNavigate();
  const s = useAccountSteps('regular'); const [step, setStep] = useState(0); const [needsCode, setNeedsCode] = useState(true);
  const { plans } = usePlans('regular'); const [plan, setPlan] = useState('');
  useEffect(() => { if (plans && !plan) setPlan(plans.find((p) => p.price === 0)?.id || plans[0]?.id); }, [plans, plan]);
  if (user) return <Navigate to="/" replace />;
  const steps = needsCode ? ['Details', 'Verify email', 'Plan'] : ['Details', 'Plan'];
  const planStep = steps.length - 1;

  async function next() {
    if (!s.validate()) return; s.setBusy(true);
    try { const req = await s.sendCode(); setNeedsCode(req); setStep(1); } catch (e) { toast(e.message, 'error'); setStep(0); }
    s.setBusy(false);
  }
  async function create() {
    s.setBusy(true);
    try {
      const { token, user: u } = await api('auth', { action: 'register.regular', ...s.d, proof: s.proof, referredBy: refCode() });
      localStorage.removeItem('fixia.ref'); adopt(token, u);
      toast('Welcome to Fixia!');
      const chosen = plans.find((p) => p.id === plan);
      nav(chosen && chosen.price > 0 ? `/checkout/${chosen.id}` : '/', { replace: true });
    } catch (e) { toast(e.message, 'error'); s.setBusy(false); }
  }
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
          <div className="cluster"><Button onClick={create} loading={s.busy} disabled={!plan}>Create account</Button>{needsCode && <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>}</div>
          <p className="small muted">By continuing you agree to the Terms of service and Privacy policy.</p>
        </div>
      )}
      <p className="small muted" style={{ textAlign: 'center' }}>Already registered? <Link to="/login">Sign in</Link></p>
    </Page>
  );
}

export function SignupProvider() {
  const { user, adopt } = useAuth(); const nav = useNavigate();
  const s = useAccountSteps('provider'); const [step, setStep] = useState(0); const [needsCode, setNeedsCode] = useState(true);
  const { plans } = usePlans('provider'); const [plan, setPlan] = useState('');
  const [biz, setBiz] = useState(''), [street, setStreet] = useState(''), [place, setPlace] = useState({});
  const [avatar, setAvatar] = useState(''), [idType, setIdType] = useState(''), [idFile, setIdFile] = useState('');
  if (user) return <Navigate to="/" replace />;
  const all = ['Details', 'Verify email', 'Business', 'Photos & ID', 'Plan'];
  const steps = needsCode ? all : all.filter((x) => x !== 'Verify email');
  const name = steps[step];
  const bad = (m) => toast(m, 'error');

  async function next() {
    if (!s.validate()) return; s.setBusy(true);
    try { const req = await s.sendCode(); setNeedsCode(req); setStep(1); } catch (e) { bad(e.message); }
    s.setBusy(false);
  }
  const go = (n) => setStep(n);
  const bizNext = () => { if (!biz.trim()) return bad('Enter your business or shop name.'); if (!place.regionName || !place.cityName) return bad('Choose your region and city.'); go(step + 1); };
  const photoNext = () => { if (!avatar) return bad('Add a profile photo or logo.'); if (!idType) return bad('Choose your ID type.'); if (!idFile) return bad('Upload your government ID.'); go(step + 1); };
  async function pick(setter, opts, e) { try { setter(await shrink(e.target.files[0], opts)); } catch (err) { bad(err.message); } e.target.value = ''; }

  async function create() {
    s.setBusy(true);
    try {
      const out = await api('auth', { action: 'register.provider', ...s.d, proof: s.proof, referredBy: refCode(), bizName: biz, streetAddr: street, ...place, idType, idFile, avatar, packageId: plan });
      localStorage.removeItem('fixia.ref'); adopt(out.token, out.user);
      toast('Application sent. We will review it within 24–48 hours.');
      nav(out.free ? '/profile' : `/checkout/${plan}`, { replace: true });
    } catch (e) { bad(e.message); s.setBusy(false); }
  }

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
          <p className="muted">Choose a plan. Paid plans are paid on the next screen; our team reviews every application within 24–48 hours.</p>
          {plans ? <PlanPicker plans={plans} value={plan} onChange={setPlan} /> : <div className="skeleton" style={{ height: 120 }} />}
          <div className="cluster"><Button onClick={create} loading={s.busy} disabled={!plan}>Submit application</Button><Button variant="secondary" onClick={() => go(step - 1)}>Back</Button></div>
        </div>
      )}
      <p className="small muted" style={{ textAlign: 'center' }}>Already registered? <Link to="/login">Sign in</Link></p>
    </Page>
  );
}
