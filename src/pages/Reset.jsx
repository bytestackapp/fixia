import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import Field from '../components/ui/Field.jsx';
import Button from '../components/ui/Button.jsx';
import './Login.css';

export default function Reset() {
  const token = useSearchParams()[0].get('token') || '';
  const [state, setState] = useState('checking');          // checking | ok | invalid | done
  const [pw, setPw] = useState(''), [pw2, setPw2] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { api('auth', { action: 'reset.validate', token }).then((d) => setState(d.valid ? 'ok' : 'invalid')).catch(() => setState('invalid')); }, [token]);
  async function submit(e) {
    e.preventDefault();
    if (pw.length < 8) return setError('Use at least 8 characters.');
    if (pw !== pw2) return setError('The two passwords do not match.');
    setBusy(true); setError('');
    try { await api('auth', { action: 'reset.confirm', token, password: pw }); setState('done'); } catch (err) { setError(err.message); }
    setBusy(false);
  }
  return (
    <div className="login"><main className="login__main" style={{ gridColumn: '1 / -1' }}>
      <div className="login__form">
        <h1>New password</h1>
        {state === 'checking' && <div className="skeleton" style={{ height: 46 }} />}
        {state === 'invalid' && <><div className="notice notice--error" role="alert">This link is invalid, already used, or older than 1 hour.</div><Link className="btn btn--primary" to="/forgot">Get a new link</Link></>}
        {state === 'done' && <><div className="notice notice--ok" role="status">Password updated. All your devices were signed out.</div><Link className="btn btn--primary" to="/login">Sign in</Link></>}
        {state === 'ok' && (
          <form className="stack" onSubmit={submit} noValidate>
            {error && <div className="notice notice--error" role="alert">{error}</div>}
            <Field label="New password" type="password" autoComplete="new-password" hint="8 characters or more" value={pw} onChange={(e) => setPw(e.target.value)} />
            <Field label="Repeat new password" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            <Button type="submit" block loading={busy}>Save password</Button>
          </form>
        )}
      </div>
    </main></div>
  );
}
