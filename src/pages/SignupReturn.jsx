import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';

/* Where PayPal / PayMongo send the person back after sign-up payment. Confirms it, then goes to the login page. */
export default function SignupReturn() {
  const [sp] = useSearchParams(); const nav = useNavigate(); const once = useRef(false);
  useEffect(() => {
    if (once.current) return; once.current = true;
    const pid = sp.get('pid');
    const go = (k) => nav(`/login?paid=${k}`, { replace: true });
    if (!pid || sp.get('cancelled')) return go('fail');
    api('auth', { action: 'signup.finish', pid })
      .then((r) => go(r.role === 'provider' ? 'okpro' : 'ok'))
      .catch((e) => go(e.status === 409 ? 'support' : 'fail'));
  }, []);   // eslint-disable-line
  return (
    <div className="result">
      <div className="ring" aria-hidden="true" />
      <h1>Confirming payment…</h1>
      <p className="muted">Please keep this page open.</p>
    </div>
  );
}