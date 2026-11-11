import { useId, useState } from 'react';

export default function Field({ label, hint, error, type = 'text', ...rest }) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const isPw = type === 'password';
  const describedBy = [hint && `${id}-h`, error && `${id}-e`].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>{label}</label>
      <div className="field__control">
        <input
          id={id} className="input" type={isPw && shown ? 'text' : type}
          aria-invalid={error ? 'true' : undefined} aria-describedby={describedBy}
          style={isPw ? { paddingRight: 72 } : undefined} {...rest}
        />
        {isPw && (
          <button type="button" className="field__toggle" onClick={() => setShown((s) => !s)} aria-pressed={shown}>
            {shown ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {hint && <div id={`${id}-h`} className="field__hint">{hint}</div>}
      {error && <div id={`${id}-e`} className="field__error">{error}</div>}
    </div>
  );
}
