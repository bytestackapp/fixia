import { useEffect, useRef, useState } from 'react';
import { CircleCheck, CircleAlert, Info } from 'lucide-react';

/* One toast for the whole app: toast('Saved') or toast('Something failed', 'error').  kinds: ok | error | info | warn */
export const toast = (text, kind = 'ok') => window.dispatchEvent(new CustomEvent('fixia:toast', { detail: { text, kind, id: Math.random() } }));

const ICON = { ok: CircleCheck, error: CircleAlert, warn: CircleAlert, info: Info };

export function Toaster() {
  const [t, setT] = useState(null);
  const box = useRef(null), timer = useRef();
  useEffect(() => {
    const on = (e) => { clearTimeout(timer.current); setT(e.detail); timer.current = setTimeout(() => setT(null), e.detail.kind === 'error' ? 5000 : 3200); };
    window.addEventListener('fixia:toast', on);
    return () => { window.removeEventListener('fixia:toast', on); clearTimeout(timer.current); };
  }, []);
  // "popover" puts the toast in the browser's top layer, so it also shows above open pop-ups and sheets
  useEffect(() => {
    const el = box.current;
    if (!el || !el.showPopover) return;
    try {
      if (el.matches(':popover-open')) el.hidePopover();
      if (t) el.showPopover();
    } catch { /* older browsers: the toast still shows normally */ }
  }, [t]);
  const Icon = t ? ICON[t.kind] || CircleAlert : null;
  return (
    <div ref={box} popover="manual" className="toaster" role="status" aria-live="polite">
      {t && <div key={t.id} className={`toast toast--${t.kind}`}><Icon size={18} aria-hidden="true" /><span>{t.text}</span></div>}
    </div>
  );
}
