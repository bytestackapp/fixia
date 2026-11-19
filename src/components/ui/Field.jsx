import { Children, useId, useState } from 'react';
import { Eye, EyeOff, ChevronDown, ChevronRight, Check } from 'lucide-react';
import Dialog from './Dialog.jsx';

/* a select that opens a pop-up list instead of the browser dropdown. Takes <option> children like a normal select. */
function Picker({ id, label, value, onChange, disabled, error, described, children }) {
  const [open, setOpen] = useState(false);
  const opts = Children.toArray(children)
    .filter((c) => c && c.type === 'option')
    .map((o) => { const text = Children.toArray(o.props.children).join(''); return { value: o.props.value ?? text, label: text }; })
    .filter((o) => !(o.value === '' && o.label === 'Select…'));
  const cur = opts.find((o) => String(o.value) === String(value ?? ''));
  return (
    <>
      <button type="button" id={id} className="input select-btn" aria-haspopup="dialog" aria-invalid={error ? 'true' : undefined} aria-describedby={described} disabled={disabled} onClick={() => setOpen(true)}>
        <span className={cur ? undefined : 'select-btn__ph'}>{cur ? cur.label : 'Select…'}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={label}>
        <ul className="sub-list">
          {opts.map((o) => {
            const on = cur && String(cur.value) === String(o.value);
            return (
              <li key={String(o.value)}>
                <button type="button" className={`sub-card${on ? ' is-on' : ''}`} onClick={() => { onChange?.({ target: { value: o.value, type: 'select-one' } }); setOpen(false); }}>
                  <span>{o.label}</span>{on ? <Check size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      </Dialog>
    </>
  );
}

// as="input" (default) | "textarea" | "select" (pass <option>s as children; opens as a pop-up)
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
        {As === 'select'
          ? <Picker id={id} label={label} value={rest.value} onChange={rest.onChange} disabled={rest.disabled} error={error} described={described}>{children}</Picker>
          : As === 'input' ? <input type={isPw && shown ? 'text' : type} style={isPw ? { paddingRight: 48 } : undefined} {...props} /> : <As {...props}>{children}</As>}
        {isPw && <button type="button" className="field__toggle" onClick={() => setShown((s) => !s)} aria-pressed={shown} aria-label={shown ? 'Hide password' : 'Show password'}>{shown ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button>}
      </div>
      {hint && <div id={`${id}-h`} className="field__hint">{hint}</div>}
    </div>
  );
}