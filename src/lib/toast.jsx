import { useEffect, useState } from 'react';
export const toast = (text, kind = 'ok') => window.dispatchEvent(new CustomEvent('fixia:toast', { detail: { text, kind, id: Math.random() } }));
export function Toaster() {
  const [t, setT] = useState(null);
  useEffect(() => { const on = (e) => { setT(e.detail); clearTimeout(on.timer); on.timer = setTimeout(() => setT(null), 3500); }; window.addEventListener('fixia:toast', on); return () => window.removeEventListener('fixia:toast', on); }, []);
  return <div className="toaster" role="status" aria-live="polite">{t && <div key={t.id} className={`notice notice--${t.kind === 'ok' ? 'ok' : 'error'}`}>{t.text}</div>}</div>;
}
