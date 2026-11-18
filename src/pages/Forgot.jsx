import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { api } from '../lib/api.js';
import { toast } from '../lib/toast.jsx';
import Logo from '../components/Logo.jsx';
import Field from '../components/ui/Field.jsx';
import Button from '../components/ui/Button.jsx';
import './Login.css';

export default function Forgot() {
  const [email, setEmail] = useState(''), [busy, setBusy] = useState(false), [sent, setSent] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast('Enter the email you signed up with.', 'error');
    setBusy(true);
    try { await api('auth', { action: 'reset.request', email }); setSent(true); toast('If that email is registered, a reset link is on its way.'); } catch (err) { toast(err.message, 'error'); }
    setBusy(false);
  }
  return (
    <div className="login"><main className="login__main">
      <div className="logo-wrap"><Logo /></div>
      <form className="login__form" onSubmit={submit} noValidate>
        <h1>Reset password</h1>
        {sent ? (
          <div className="state-box"><span className="state-icon tone--ok"><MailCheck size={28} aria-hidden="true" /></span><p className="muted">Check your inbox. The link works for 1 hour.</p></div>
        ) : (
          <>
            <p className="muted" style={{ textAlign: 'center' }}>Enter your email and we will send you a link to choose a new password.</p>
            <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="submit" block loading={busy}>Send reset link</Button>
          </>
        )}
        <div className="login__links"><Link to="/login">Back to sign in</Link></div>
      </form>
    </main></div>
  );
}
