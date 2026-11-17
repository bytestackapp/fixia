import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import Field from '../components/ui/Field.jsx';
import Button from '../components/ui/Button.jsx';
import InfoLinks from './Info.jsx';
import './Login.css';

const SERVICES = ['Plumbing', 'Aircon service', 'Electrical', 'Painting', 'Home cleaning', 'Auto repair', 'Tutoring', 'Pet grooming', 'Photography'];

export default function Login() {
  const { user, login, notice } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;

  async function submit(e) {
    e.preventDefault();
    if (!identifier.trim() || !password) { setError('Enter your email or username and your password.'); return; }
    setBusy(true); setError('');
    try { await login(identifier, password); }
    catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <div className="login">
      <aside className="login__aside" aria-hidden="true">
        <div className="login__brand">fixia</div>
        <p className="login__tag">All services. One place.</p>
        <ul className="login__index">{SERVICES.map((s) => <li key={s}>{s}</li>)}</ul>
      </aside>

      <main className="login__main">
        <div className="login__brand login__brand--mobile">fixia</div>
        <form className="login__form" onSubmit={submit} noValidate>
          <h1>Sign in</h1>
          {(error || notice) && <div className="notice notice--error" role="alert">{error || notice}</div>}
          <Field label="Email or username" autoComplete="username" autoCapitalize="none" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
          <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" block loading={busy}>{busy ? 'Signing in' : 'Sign in'}</Button>
          <div className="login__links">
            <Link to="/forgot">Forgot your password?</Link>
            <span>New here? <Link to="/signup">Create an account</Link></span>
          </div>
        </form>
        <InfoLinks />
      </main>
    </div>
  );
}
