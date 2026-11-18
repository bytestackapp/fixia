import { useId, useState } from 'react';

// as="input" (default) | "textarea" | "select" (pass <option>s as children)
// error: when truthy the field gets a red border. The message itself is shown as a toast, not under the field.
export default function Field({ label, hint, error, type = 'text', as: As = 'input', children, className = '', ...rest }) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const isPw = type === 'password';
  const described = hint ? `${id}-h` : undefined;
  const props = { id, className: `input${As === 'textarea' ? ' input--area' : ''}`, 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': described, ...rest };
  return (
    <div className={`field ${className}`}>
      <label className="field__label" htmlFor={id}>{label}</label>
      <div className="field__control">
        {As === 'input' ? <input type={isPw && shown ? 'text' : type} style={isPw ? { paddingRight: 72 } : undefined} {...props} /> : <As {...props}>{children}</As>}
        {isPw && <button type="button" className="field__toggle" onClick={() => setShown((s) => !s)} aria-pressed={shown}>{shown ? 'Hide' : 'Show'}</button>}
      </div>
      {hint && <div id={`${id}-h`} className="field__hint">{hint}</div>}
    </div>
  );
}
