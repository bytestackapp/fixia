import { useRef } from 'react';

/* 6 boxes. Typing moves to the next box, Backspace moves back, pasting a code fills all boxes. */
export default function OtpInput({ value = '', onChange, length = 6 }) {
  const refs = useRef([]);
  const digits = Array.from({ length }, (_, i) => value[i] || '');
  const focus = (i) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  function type(i, e) {
    const d = e.target.value.replace(/\D/g, '');
    if (!d) return;
    const at = Math.min(i, value.length);
    const next = (value.slice(0, at) + d + value.slice(at + d.length)).slice(0, length);
    onChange(next);
    focus(at + d.length);
  }
  function key(i, e) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[i]) onChange(value.slice(0, i) + value.slice(i + 1));
      else if (i > 0) { onChange(value.slice(0, i - 1) + value.slice(i)); focus(i - 1); }
    } else if (e.key === 'ArrowLeft') { e.preventDefault(); focus(i - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); focus(i + 1); }
  }
  function paste(e) {
    e.preventDefault();
    const d = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!d) return;
    onChange(d);
    focus(d.length);
  }

  return (
    <div className="otp" role="group" aria-label="Verification code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className="otp__box"
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          autoFocus={i === 0}
          maxLength={1}
          value={d}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => type(i, e)}
          onKeyDown={(e) => key(i, e)}
          onPaste={paste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}