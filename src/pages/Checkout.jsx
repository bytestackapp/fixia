import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { call } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { toast } from '../lib/toast.jsx';
import { peso, PERIOD } from '../lib/format.js';
import Button from '../components/ui/Button.jsx';
import Field from '../components/ui/Field.jsx';
import Dialog from '../components/ui/Dialog.jsx';
import { ErrorState } from '../components/States.jsx';

const ONLINE = [['paypal', 'PayPal', 'Card or PayPal balance', 0.044, 15], ['paymongo', 'PayMongo', 'Card, GCash, Maya, GrabPay', 0.029, 0]];
const MANUAL = [['gcash', 'GCash'], ['maya', 'Maya'], ['bank', 'Bank transfer']];

export default function Checkout() {
  const { id } = useParams(); const nav = useNavigate(); const { refresh } = useAuth();
  const sp = useSearchParams()[0];
  const cancelled = sp.get('cancelled');
  const preset = sp.get('m');
  const auto = useRef(false);
  const { data, error, refetch } = useQuery({ queryKey: ['calc', id], queryFn: () => call('upgrade.calc', { packageId: id }) });
  const [method, setMethod] = useState(preset || ''), [busy, setBusy] = useState(false);
  const [qr, setQr] = useState(false), [ref, setRef] = useState(''), [amt, setAmt] = useState('');
  useEffect(() => { if (cancelled) toast('Payment was cancelled. You have not been charged.', 'info'); }, [cancelled]);
  // arriving from sign-up with a chosen method: start that payment straight away
  useEffect(() => { if (data && preset && !cancelled && !auto.current) { auto.current = true; go(preset); } }, [data]);   // eslint-disable-line
  if (error) return <ErrorState error={error} retry={refetch} />;
  if (!data) return <div className="skeleton" style={{ height: 200 }} />;
  const { plan } = data;
  const online = ONLINE.find((m) => m[0] === method);
  const fee = online ? Math.ceil(plan.price * online[3] + online[4]) : 0;
  const manual = MANUAL.find((m) => m[0] === method);

  async function go(m = method) {
    if (!m) return toast('Choose how you want to pay.', 'error');
    if (MANUAL.some((x) => x[0] === m)) return setQr(true);
    setBusy(true);
    try {
      const r = await call('pay.checkout', { packageId: id, method: m });
      localStorage.setItem('fixia.pay', JSON.stringify({ method: m, pkg: id, ref: r.ref || null }));
      window.location.href = r.url;
    } catch (e) { toast(e.message, 'error'); setBusy(false); }
  }
  async function sendManual() {
    setBusy(true);
    try { await call('upgrade.manual', { packageId: id, method, reference: ref, amount: amt }); await refresh(); toast('Payment sent. We will check it and message you.'); nav('/profile?tab=plan', { replace: true }); }
    catch (e) { toast(e.message, 'error'); setBusy(false); }
  }

  return (
    <>
      <header className="page-head"><h1>Checkout</h1></header>
      <div className="stack stack--lg" style={{ maxWidth: 560 }}>
        <div className="sec" style={{ marginBottom: 0 }}>
          <dl className="defs" style={{ marginTop: 0 }}>
            <dt>Plan</dt><dd>{plan.name}</dd><dt>Billing</dt><dd>{PERIOD[plan.period] || plan.period}</dd><dt>Price</dt><dd className="num">{peso(plan.price)}</dd>
            {data.carryoverDays > 0 && <><dt>Credit</dt><dd>+{data.carryoverDays} days from your current plan</dd></>}
            {online && <><dt>Processing fee</dt><dd className="num">{peso(fee)}</dd><dt>Total</dt><dd className="num">{peso(plan.price + fee)}</dd></>}
          </dl>
        </div>
        <fieldset className="plans plans--methods">
          <legend className="plans__legend">Pay online <span className="muted small" style={{ fontWeight: 400 }}>— activated right away</span></legend>
          {ONLINE.map(([k, n, d]) => <label key={k} className={`plan${method === k ? ' is-on' : ''}`}><input className="sr-only" type="radio" name="m" checked={method === k} onChange={() => setMethod(k)} /><span className="plan__head"><span className="plan__name">{n}</span></span><span className="small muted">{d}</span></label>)}
        </fieldset>
        <fieldset className="plans plans--methods">
          <legend className="plans__legend">Pay manually <span className="muted small" style={{ fontWeight: 400 }}>— no fee, checked by our team</span></legend>
          {MANUAL.map(([k, n]) => <label key={k} className={`plan${method === k ? ' is-on' : ''}`}><input className="sr-only" type="radio" name="m" checked={method === k} onChange={() => setMethod(k)} /><span className="plan__head"><span className="plan__name">{n}</span></span></label>)}
        </fieldset>
        <div className="cluster"><Button onClick={() => go()} loading={busy && !qr}>{manual ? 'Continue' : 'Pay now'}</Button><Link className="btn btn--quiet" to="/profile?tab=plan">Not now</Link></div>
      </div>

      <Dialog open={qr} onClose={() => setQr(false)} title={`${manual?.[1] || ''} payment`}>
        <p className="muted small">Scan the code and send exactly <b>{peso(plan.price)}</b>. Then enter the reference number from your receipt.</p>
        <img src={`/images/${method}-qr.png`} alt={`${manual?.[1]} QR code`} width="180" height="180" style={{ objectFit: 'contain', border: '1px solid var(--line)', borderRadius: 10, justifySelf: 'center' }} onError={(e) => (e.currentTarget.style.display = 'none')} />
        <Field label="Reference number" value={ref} onChange={(e) => setRef(e.target.value)} />
        <Field label="Amount sent (₱)" type="number" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} />
        <div className="dlg__actions"><Button loading={busy} onClick={sendManual}>Submit payment</Button><Button variant="quiet" onClick={() => setQr(false)}>Cancel</Button></div>
      </Dialog>
    </>
  );
}
