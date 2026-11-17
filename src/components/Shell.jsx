import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { House, Bookmark, LayoutGrid, ClipboardList, User } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useCounts } from '../lib/queries.js';
import { enablePush } from '../lib/push.js';
import { PopupHost } from '../lib/ads.jsx';
import MessageGate from './MessageGate.jsx';
import './Shell.css';

export default function Shell() {
  const { user } = useAuth();
  const unread = useCounts().data?.unread || 0;
  const isPro = user.role === 'provider';
  const nav = [
    { to: '/', label: 'Home', icon: House, end: true },
    !isPro && { to: '/saved', label: 'Saved', icon: Bookmark },
    { to: '/browse', label: 'Browse', icon: LayoutGrid },
    { to: '/bookings', label: isPro ? 'Jobs' : 'Bookings', icon: ClipboardList, badge: unread },
    { to: '/profile', label: 'Profile', icon: User },
  ].filter(Boolean);
  // if this device already allowed notifications, keep its subscription fresh
  useEffect(() => { enablePush().catch(() => {}); }, []);
  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <nav className="nav" aria-label="Main">
        <div className="nav__brand">fixia</div>
        <ul className="nav__list" style={{ '--n': nav.length }}>
          {nav.map(({ to, label, icon: Icon, end, badge }) => (
            <li key={to}>
              <NavLink to={to} end={end} className="nav__link">
                <span className="nav__icon"><Icon size={20} strokeWidth={1.75} aria-hidden="true" />{badge > 0 && <b className="nav__badge" aria-label={`${badge} new`}>{badge > 9 ? '9+' : badge}</b>}</span>
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main id="main" className="main"><Outlet /></main>
      <MessageGate />
      <PopupHost />
    </div>
  );
}
