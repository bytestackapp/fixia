import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import Logo from './Logo.jsx';
import pkg from '../../package.json';
import './Splash.css';

const MIN_MS = 2500;     // always show at least this long
const MAX_MS = 8000;     // never block the app longer than this
const FADE_MS = 400;
const KEY = 'fixia.splash';

const seen = () => { try { return !!sessionStorage.getItem(KEY); } catch { return false; } };
const markSeen = () => { try { sessionStorage.setItem(KEY, '1'); } catch { /* ignore */ } };

/* Shown once each time the app is opened. Waits for sign-in check, then fades out. */
export default function Splash() {
  const { ready } = useAuth();
  const [show, setShow] = useState(() => !seen());
  const [waited, setWaited] = useState(false);
  const [forced, setForced] = useState(false);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    if (!show) return;
    const a = setTimeout(() => setWaited(true), MIN_MS);
    const b = setTimeout(() => setForced(true), MAX_MS);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [show]);

  useEffect(() => {
    if (!show || !((ready && waited) || forced)) return;
    setFade(true);
    const t = setTimeout(() => { markSeen(); setShow(false); }, FADE_MS);
    return () => clearTimeout(t);
  }, [show, ready, waited, forced]);

  if (!show) return null;
  return (
    <div className={`splash${fade ? ' is-hiding' : ''}`} role="status" aria-live="polite" aria-label="Loading Fixia">
      <span className="splash__blob splash__blob--a" aria-hidden="true" />
      <span className="splash__blob splash__blob--b" aria-hidden="true" />

      <div className="splash__logo"><Logo width={190} /></div>
      <p className="splash__tag">Find any service near you</p>
      <div className="splash__dots" aria-hidden="true"><span /><span /><span /></div>

      <div className="splash__wave" aria-hidden="true">
        <svg viewBox="0 0 1440 260" preserveAspectRatio="none" width="100%" height="230" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="splashGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#F2622B" />
              <stop offset="100%" stopColor="#D94F1C" />
            </linearGradient>
          </defs>
          <path d="M0,140 C240,40 420,220 720,120 C1000,30 1200,200 1440,90 L1440,260 L0,260 Z" fill="#FFD9C7" />
          <path d="M0,180 C260,100 460,240 760,150 C1040,70 1220,220 1440,140 L1440,260 L0,260 Z" fill="url(#splashGrad)" />
        </svg>
      </div>

      <div className="splash__foot">
        <div>Version {pkg.version}</div>
        <div>&copy; {new Date().getFullYear()} ByteStack Labs. All rights reserved.</div>
      </div>
    </div>
  );
}