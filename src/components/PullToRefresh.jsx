import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth.jsx';

const TRIGGER = 55, MAX = 100;

/* Pull down from the top of any page to reload its data. Touch screens only. */
export default function PullToRefresh() {
  const qc = useQueryClient(); const { refresh } = useAuth();
  const [pull, setPull] = useState(0), [busy, setBusy] = useState(false);
  const start = useRef(null), amount = useRef(0), working = useRef(false);

  useEffect(() => {
    const atTop = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 0;
    const onStart = (e) => {
      if (working.current || e.touches.length !== 1 || !atTop() || document.querySelector('dialog[open]')) { start.current = null; return; }
      start.current = e.touches[0].clientY;
    };
    const onMove = (e) => {
      if (start.current === null) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0 || !atTop()) { amount.current = 0; setPull(0); return; }
      amount.current = Math.min(MAX, dy * 0.5);
      setPull(amount.current);
    };
    const onEnd = async () => {
      if (start.current === null) return;
      start.current = null;
      const v = amount.current; amount.current = 0;
      if (v < TRIGGER) { setPull(0); return; }
      working.current = true; setBusy(true); setPull(TRIGGER);
      await Promise.allSettled([
        qc.refetchQueries({ type: 'active' }),
        refresh().catch(() => {}),
        new Promise((r) => setTimeout(r, 700)),
      ]);
      working.current = false; setBusy(false); setPull(0);
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [qc, refresh]);

  const show = pull > 0 || busy;
  const dragging = pull > 0 && !busy;
  const level = Math.min(1, pull / TRIGGER);
  const ease = dragging ? 'none' : 'opacity .3s ease, height .3s ease, transform .3s ease';
  return (
    <>
      <div className="ptr-glow" aria-hidden="true"
        style={{ height: `calc(var(--safe-top) + ${20 + pull * 1.8}px)`, opacity: show ? 0.25 + level * 0.75 : 0, transition: ease }} />
      <div className={`ptr${busy ? ' is-busy' : ''}`} aria-hidden="true"
        style={{ opacity: show ? Math.min(1, pull / 30 + (busy ? 1 : 0)) : 0, transform: `translateY(${pull}px)`, transition: ease }}>
        <svg width="30" height="30" viewBox="0 0 44 44" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="22" cy="22" r="14" stroke="rgba(255,255,255,.35)" />
          {busy
            ? <circle cx="22" cy="22" r="14" strokeDasharray="24 64" />
            : <path d="M22 15v10M17.5 21l4.5 4.5 4.5-4.5" style={{ transform: `rotate(${level * 180}deg)`, transformOrigin: '22px 22px' }} />}
        </svg>
      </div>
    </>
  );
}