import { useSearchParams } from 'react-router-dom';
import Dialog from './ui/Dialog.jsx';
import Button from './ui/Button.jsx';

const MSG = {
  ok: ['Account created', 'Your payment was received and your account was created. Sign in to enjoy your plan.'],
  okpro: ['Application submitted', 'Your payment was received and your provider application was submitted. Our team will review it within 24–48 hours. Sign in to check its status.'],
  fail: ['Payment not completed', 'Your payment was unsuccessful or cancelled, so no account was created. If you were charged, please contact Support (link below) with your email address.'],
  support: ['Payment received, account needs help', 'Your payment went through, but we could not finish creating your account. Please contact Support (link below) with your email address and we will fix it quickly.'],
};

/* Shows the result of an online sign-up payment on the login page (?paid=ok | okpro | fail | support). */
export default function PaidNotice() {
  const [sp, setSp] = useSearchParams();
  const m = MSG[sp.get('paid')];
  const close = () => setSp({}, { replace: true });
  return (
    <Dialog open={!!m} onClose={close} title={m?.[0] || ''}>
      {m && <><p>{m[1]}</p><div className="dlg__actions"><Button onClick={close}>OK</Button></div></>}
    </Dialog>
  );
}