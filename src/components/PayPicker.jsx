import { useState } from 'react';
import { PROVIDERS, MANUAL } from '../lib/fees.js';

// image file names in public/images (the image supplies its own padding)
const LOGO = { paypal: 'paypal', gcash: 'gcash', maya: 'maya', qrph: 'qrph', card: 'cards', grab: 'grabpay', bank: 'bpi' };

function Opt({ id, logo, name, on, onPick }) {
  const [bad, setBad] = useState(false);
  return (
    <label className={`plan pm${on ? ' is-on' : ''}`}>
      <input className="sr-only" type="radio" name="pm" checked={on} onChange={() => onPick(id)} />
      {!bad && <img className="pm__logo" src={`/images/${LOGO[logo]}.png`} alt="" onError={() => setBad(true)} />}
      <span className="pm__name">{name}</span>
    </label>
  );
}

export default function PayPicker({ fees, method, onPick }) {
  return (
    <>
      <fieldset className="plans plans--methods">
        <legend className="plans__legend">Pay online <span className="muted small" style={{ fontWeight: 400 }}>— with processing fee, instant account activation</span></legend>
        {fees.map((f) => <Opt key={f.key} id={f.key} logo={f.provider} name={PROVIDERS[f.provider]} on={method === f.key} onPick={onPick} />)}
      </fieldset>
      <fieldset className="plans plans--methods">
        <legend className="plans__legend">Pay manually <span className="muted small" style={{ fontWeight: 400 }}>— without processing fee, requires admin review</span></legend>
        {MANUAL.map(([k, n]) => <Opt key={k} id={k} logo={k} name={n} on={method === k} onPick={onPick} />)}
      </fieldset>
    </>
  );
}