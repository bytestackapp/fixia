import { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Eye, EyeOff, LogIn, UserPlus, Fingerprint } from 'lucide-react';
import { biometricSupported, savedLogin, saveLogin, clearLogin, unlockLogin } from '../lib/biometric.js';
import { useAuth } from '../lib/auth.jsx';
import { toast } from '../lib/toast.jsx';
import Logo from '../components/Logo.jsx';
import InfoLinks from './Info.jsx';
import './Login.css';

export default function Login() {
  const { user, login, notice } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bio, setBio] = useState(false);
  useEffect(() => { (async () => { if (await biometricSupported() && await savedLogin()) setBio(true); })(); }, []);

  // e.g. "You were signed out because this account was opened on another device."
  useEffect(() => { if (notice) toast(notice, 'error'); }, [notice]);

  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;

  async function offer(id, pw) {
    try {
      if (!(await biometricSupported())) return;
      const saved = await savedLogin();
      if (saved && saved.username === id) { await saveLogin(id, pw); return; }
      if (window.confirm('Use fingerprint or face unlock to sign in next time?')) await saveLogin(id, pw);
    } catch { /* skip */ }
  }
  async function bioLogin() {
    setBusy(true);
    try { const c = await unlockLogin(); await login(c.username, c.password); }
    catch (err) {
      if (err.status === 401) { await clearLogin(); setBio(false); toast('Your saved details are out of date. Sign in with your password.', 'error'); }
      else if (err.status) toast(err.message, 'error');
      setBusy(false);
    }
  }
  async function submit(e) {
    e.preventDefault();
    if (!identifier.trim() || !password) return toast('Enter your email or username and your password.', 'error');
    setBusy(true);
    try { await login(identifier, password); offer(identifier.trim().toLowerCase(), password); }
    catch (err) { toast(err.message, 'error'); setBusy(false); }
  }

  return (
    <div className="login login--classic">
      <div className="bg-shapes" aria-hidden="true"><span /><span /><span /><span /></div>
      <main className="login__main">
        <div className="lc-logo">
          <Logo width={140} />
          <p className="lc-sub">Find any service near you</p>
        </div>

        <form className="lc-form" onSubmit={submit} noValidate>
          <div className="lc-group">
            <label className="lc-label" htmlFor="lc-id">Email or username</label>
            <input id="lc-id" className="lc-input" placeholder="Enter email or username" autoComplete="username" autoCapitalize="none" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
          </div>

          <div className="lc-group">
            <label className="lc-label" htmlFor="lc-pw">Password</label>
            <div className="lc-pw">
              <input id="lc-pw" className="lc-input" type={show ? 'text' : 'password'} placeholder="Enter your password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="lc-eye" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
                {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
          </div>

          <div className="lc-forgot"><Link to="/forgot">Forgot password?</Link></div>

          <div className="lc-row">
            <button type="submit" className="lc-btn lc-btn--brand" disabled={busy} aria-busy={busy || undefined}>
              {busy ? <span className="spinner" aria-hidden="true" /> : <><LogIn size={18} aria-hidden="true" /> Sign In</>}
            </button>
            {bio && <button type="button" className="lc-bio" onClick={bioLogin} disabled={busy} aria-label="Sign in with fingerprint or face" title="Fingerprint / face"><Fingerprint size={24} aria-hidden="true" /></button>}
          </div>

          <div className="lc-divider"><span>New to Fixia?</span></div>

          <Link to="/signup" className="lc-btn lc-btn--outline"><UserPlus size={18} aria-hidden="true" /> Create an Account</Link>
        </form>

        <InfoLinks className="lc-footer" />
      </main>
    </div>
  );
}