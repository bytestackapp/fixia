import { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { toast } from '../lib/toast.jsx';
import Logo from '../components/Logo.jsx';
import Field from '../components/ui/Field.jsx';
import Button from '../components/ui/Button.jsx';
import InfoLinks from './Info.jsx';
import './Login.css';

export default function Login() {
  const { user, login, notice } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  // e.g. "You were signed out because this account was opened on another device."
  useEffect(() => { if (notice) toast(notice, 'error'); }, [notice]);

  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;

  async function submit(e) {
    e.preventDefault();
    if (!identifier.trim() || !password) return toast('Enter your email or username and your password.', 'error');
    setBusy(true);
    try { await login(identifier, password); }
    catch (err) { toast(err.message, 'error'); setBusy(false); }
  }

  return (
    <div className="login">
      <main className="login__main">
        <div className="logo-wrap"><Logo /><p className="logo-sub">Find any service near you</p></div>
        <form className="login__form" onSubmit={submit} noValidate>
          <Field label="Email or username" autoComplete="username" autoCapitalize="none" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
          <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" block loading={busy}>{busy ? 'Signing in' : 'Sign in'}</Button>
          <div className="login__links"><Link to="/forgot">Forgot your password?</Link></div>
          <div className="divider"><span>New to Fixia?</span></div>
          <Link className="btn btn--secondary btn--block" to="/signup">Create an account</Link>
        </form>
        <InfoLinks />
      </main>
    </div>
  );
}
