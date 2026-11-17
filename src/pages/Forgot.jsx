import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import Field from '../components/ui/Field.jsx';
import Button from '../components/ui/Button.jsx';
import './Login.css';

export default function Forgot() {
  const [email, setEmail] = useState(''), [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter the email you signed up with.');
    setBusy(true); setError('');
    try { await api('auth', { action: 'reset.request', email }); setSent(true); } catch (err) { setError(err.message); }
    setBusy(false);
  }
  return (
    <div className="login"><main className="login__main" style={{ gridColumn: '1 / -1' }}>
      <form className="login__form" onSubmit={submit} noValidate>
        <h1>Reset password</h1>
        {sent ? <div className="notice notice--ok" role="status">If that email is registered, a reset link is on its way. It works for 1 hour.</div> : (
          <>
            <p className="muted">Enter your email and we will send you a link to choose a new password.</p>
            {error && <div className="notice notice--error" role="alert">{error}</div>}
            <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="submit" block loading={busy}>Send reset link</Button>
          </>
        )}
        <div className="login__links"><Link to="/login">Back to sign in</Link></div>
      </form>
    </main></div>
  );
}
