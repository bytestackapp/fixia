import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CircleCheck, CircleX } from 'lucide-react';
import { api } from '../lib/api.js';
import { toast } from '../lib/toast.jsx';
import Logo from '../components/Logo.jsx';
import Field from '../components/ui/Field.jsx';
import Button from '../components/ui/Button.jsx';
import './Login.css';

export default function Reset() {
  const token = useSearchParams()[0].get('token') || '';
  const [state, setState] = useState('checking');          // checking | ok | invalid | done
  const [pw, setPw] = useState(''), [pw2, setPw2] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { api('auth', { action: 'reset.validate', token }).then((d) => setState(d.valid ? 'ok' : 'invalid')).catch(() => setState('invalid')); }, [token]);
  async function submit(e) {
    e.preventDefault();
    if (pw.length < 8) return toast('Use at least 8 characters.', 'error');
    if (pw !== pw2) return toast('The two passwords do not match.', 'error');
    setBusy(true);
    try { await api('auth', { action: 'reset.confirm', token, password: pw }); setState('done'); toast('Password updated. All your devices were signed out.'); } catch (err) { toast(err.message, 'error'); }
    setBusy(false);
  }
  return (
    <div className="login"><main className="login__main">
      <div className="logo-wrap"><Logo /></div>
      <div className="login__form">
        <h1>New password</h1>
        {state === 'checking' && <div className="skeleton" style={{ height: 46 }} />}
        {state === 'invalid' && <div className="state-box"><span className="state-icon tone--danger"><CircleX size={28} aria-hidden="true" /></span><p className="muted">This link is invalid, already used, or older than 1 hour.</p><Link className="btn btn--primary" to="/forgot">Get a new link</Link></div>}
        {state === 'done' && <div className="state-box"><span className="state-icon tone--ok"><CircleCheck size={28} aria-hidden="true" /></span><p className="muted">Your password has been updated.</p><Link className="btn btn--primary" to="/login">Sign in</Link></div>}
        {state === 'ok' && (
          <form className="stack" onSubmit={submit} noValidate>
            <Field label="New password" type="password" autoComplete="new-password" hint="8 characters or more" value={pw} onChange={(e) => setPw(e.target.value)} />
            <Field label="Repeat new password" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            <Button type="submit" block loading={busy}>Save password</Button>
          </form>
        )}
      </div>
    </main></div>
  );
}
