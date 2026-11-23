import { Star } from 'lucide-react';

export const Tabs = ({ items, value, onChange, label = 'Sections' }) => (
  <div className="tabs" role="tablist" aria-label={label}>
    {items.map(([k, text, badge]) => (
      <button key={k} role="tab" aria-selected={value === k} className="tabs__tab" onClick={() => onChange(k)}>{text}{badge ? <span className="tabs__badge">{badge}</span> : null}</button>
    ))}
  </div>
);

export const Stepper = ({ steps, current, muted = [] }) => {
  const n = steps.length;
  const visible = Math.min(4, n);                                   // badges shown at once
  const start = Math.max(0, Math.min(current - 1, n - visible));    // first badge in view
  return (
    <div className="steps-win">
      <ol className="steps" aria-label="Progress" style={{ width: `${(n / visible) * 100}%`, transform: `translateX(-${(start * 100) / n}%)` }}>
        {steps.map((s, i) => <li key={s} style={{ flex: 'none', minWidth: 0, width: `${100 / n}%` }} aria-current={i === current ? 'step' : undefined} aria-disabled={muted.includes(s) || undefined} className={[i < current ? 'is-done' : '', muted.includes(s) ? 'is-muted' : ''].filter(Boolean).join(' ')}><span className="num">{i + 1}</span> {s}</li>)}
      </ol>
    </div>
  );
};

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

export function Switch({ checked, onChange, label, disabled, loading }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} aria-busy={loading || undefined} disabled={disabled || loading} className={`switch${loading ? ' is-loading' : ''}`} onClick={() => onChange(!checked)}><span>{loading && <i className="switch__spin" aria-hidden="true" />}</span></button>;
}

