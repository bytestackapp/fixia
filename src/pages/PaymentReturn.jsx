import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { call } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { peso } from '../lib/format.js';

export default function PaymentReturn() {
  const [sp] = useSearchParams(); const { refresh } = useAuth();
  const [state, setState] = useState({ s: 'wait' }); const once = useRef(false);
  useEffect(() => {
    if (once.current) return; once.current = true;
    const saved = JSON.parse(localStorage.getItem('fixia.pay') || '{}');
    const method = sp.get('method'), pkg = sp.get('pkg');
    const ref = method === 'paypal' ? sp.get('token') : saved.ref;
    if (!ref) return setState({ s: 'err', m: 'We could not find this payment. If you were charged, contact support with your receipt.' });
    call('pay.verify', { method, ref, packageId: pkg })
      .then(async (r) => { localStorage.removeItem('fixia.pay'); await refresh(); setState({ s: 'ok', r }); })
      .catch((e) => setState({ s: 'err', m: e.message }));
  }, []);   // eslint-disable-line
  return (
    <div className="stack" style={{ maxWidth: 520 }}>
      <header className="page-head"><h1>{state.s === 'ok' ? 'Payment received' : state.s === 'err' ? 'Payment problem' : 'Confirming payment…'}</h1></header>
      {state.s === 'wait' && <><div className="skeleton" style={{ height: 24, width: 260 }} /><p className="muted">Please keep this page open.</p></>}
      {state.s === 'ok' && <><div className="notice notice--ok" role="status">Your <b>{state.r.plan}</b> plan is active{state.r.amount ? ` (${peso(state.r.amount)} paid)` : ''}.</div><Link className="btn btn--primary" to="/profile?tab=plan">See my plan</Link></>}
      {state.s === 'err' && <><div className="notice notice--error" role="alert">{state.m}</div><Link className="btn btn--secondary" to="/profile?tab=plan">Back to plans</Link></>}
    </div>
  );
}
