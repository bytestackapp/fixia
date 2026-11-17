import { Star } from 'lucide-react';

export const Tabs = ({ items, value, onChange, label = 'Sections' }) => (
  <div className="tabs" role="tablist" aria-label={label}>
    {items.map(([k, text, badge]) => (
      <button key={k} role="tab" aria-selected={value === k} className="tabs__tab" onClick={() => onChange(k)}>{text}{badge ? <span className="tabs__badge">{badge}</span> : null}</button>
    ))}
  </div>
);

export const Stepper = ({ steps, current }) => (
  <ol className="steps" aria-label="Progress">
    {steps.map((s, i) => <li key={s} aria-current={i === current ? 'step' : undefined} className={i < current ? 'is-done' : ''}><span className="num">{i + 1}</span> {s}</li>)}
  </ol>
);

export const Status = ({ kind = 'neutral', children }) => <span className={`pill pill--${kind}`}>{children}</span>;

export function StarPicker({ value, onChange }) {
  return (
    <div className="starpick" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => onChange(n)}>
          <Star size={30} fill={n <= value ? 'currentColor' : 'none'} strokeWidth={1.5} />
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className="switch" onClick={() => onChange(!checked)}><span /></button>;
}
