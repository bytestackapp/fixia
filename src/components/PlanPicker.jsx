import { Check } from 'lucide-react';
import { peso, PERIOD } from '../lib/format.js';

/* Plans as a list of choices (radio group), not marketing cards. */
export default function PlanPicker({ plans, value, onChange, name = 'plan' }) {
  return (
    <fieldset className="plans">
      <legend className="sr-only">Choose a plan</legend>
      {plans.map((p) => {
        const feats = (p.features || []).map((f) => (typeof f === 'string' ? f : f.label)).filter(Boolean);
        return (
          <label key={p.id} className={`plan${value === p.id ? ' is-on' : ''}`}>
            <input type="radio" name={name} value={p.id} checked={value === p.id} onChange={() => onChange(p.id)} className="sr-only" />
            <span className="plan__head">
              <span className="plan__name">{p.name}{p.popular && <span className="tag">{p.badge_label || 'Popular'}</span>}</span>
              <span className="plan__price num">{p.price === 0 ? 'Free' : <>{peso(p.price)}<small> / {PERIOD[p.period] || p.period}</small></>}</span>
            </span>
            {feats.length > 0 && <ul className="plan__list">{feats.map((f) => <li key={f}>{f}</li>)}</ul>}
            <span className="plan__mark" aria-hidden="true">{value === p.id && <Check size={18} />}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
