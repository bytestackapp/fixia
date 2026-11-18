import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CircleCheck, CircleAlert } from 'lucide-react';
import { call } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { toast } from '../lib/toast.jsx';
import { peso } from '../lib/format.js';

export default function PaymentReturn() {
  const [sp] = useSearchParams(); const { refresh } = useAuth();
  const [state, setState] = useState({ s: 'wait' }); const once = useRef(false);
  useEffect(() => {
    if (once.current) return; once.current = true;
    const saved = JSON.parse(localStorage.getItem('fixia.pay') || '{}');
    const method = sp.get('method'), pkg = sp.get('pkg');
    const ref = method === 'paypal' ? sp.get('token') : saved.ref;
    const fail = (m) => { toast(m, 'error'); setState({ s: 'err' }); };
    if (!ref) return fail('We could not find this payment. If you were charged, contact support with your receipt.');
    call('pay.verify', { method, ref, packageId: pkg })
      .then(async (r) => { localStorage.removeItem('fixia.pay'); await refresh(); toast('Payment received. Your plan is active.'); setState({ s: 'ok', r }); })
      .catch((e) => fail(e.message));
  }, []);   // eslint-disable-line
  return (
    <div className="result">
      {state.s === 'wait' && <><div className="ring" aria-hidden="true" /><h1>Confirming payment…</h1><p className="muted">Please keep this page open.</p></>}
      {state.s === 'ok' && <>
        <span className="result__icon tone--ok"><CircleCheck size={34} aria-hidden="true" /></span>
        <h1>Payment received</h1>
        <div className="info-box"><div className="info-row"><span>Plan</span><b>{state.r.plan}</b></div>{state.r.amount ? <div className="info-row"><span>Paid</span><b className="num">{peso(state.r.amount)}</b></div> : null}</div>
        <Link className="btn btn--primary btn--block" to="/profile?tab=plan">See my plan</Link>
      </>}
      {state.s === 'err' && <>
        <span className="result__icon tone--danger"><CircleAlert size={34} aria-hidden="true" /></span>
        <h1>Payment problem</h1>
        <p className="muted">We could not confirm this payment.</p>
        <Link className="btn btn--secondary btn--block" to="/profile?tab=plan">Back to plans</Link>
      </>}
    </div>
  );
}
