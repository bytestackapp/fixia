import { useEffect, useState } from 'react';
import { NavLink, Link, Outlet, useNavigate, useLocation as useRoute } from 'react-router-dom';
import { House, Bookmark, LayoutGrid, ClipboardList, User, Bell, Search, LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useCounts } from '../lib/queries.js';
import { enablePush } from '../lib/push.js';
import { PopupHost } from '../lib/ads.jsx';
import Logo from './Logo.jsx';
import MessageGate from './MessageGate.jsx';
import { Confirm } from './ui/Dialog.jsx';
import './Shell.css';

// The same five items for everyone, in the same order, on every page.
const ITEMS = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/saved', label: 'Saved', icon: Bookmark },
  { to: '/browse', label: 'Browse', icon: LayoutGrid, center: true },
  { to: '/bookings', label: 'Bookings', proLabel: 'Jobs', icon: ClipboardList, badge: true },
  { to: '/profile', label: 'Profile', icon: User },
];

export default function Shell() {
  const { user, logout } = useAuth();
  const unread = useCounts().data?.unread || 0;
  const isPro = user.role === 'provider';
  const go = useNavigate();
  const { pathname } = useRoute();
  const [text, setText] = useState(''), [out, setOut] = useState(false);
  // if this device already allowed notifications, keep its subscription fresh
  useEffect(() => { enablePush().catch(() => {}); }, []);

  function search(e) {
    e.preventDefault();
    go(`/search?q=${encodeURIComponent(text.trim())}`);
    setText('');
  }

  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>

      <header className="topbar">
        <Link to="/" className="topbar__logo" aria-label="Fixia home">fix<span>ia</span></Link>
        {pathname.startsWith('/search') ? <span className="topbar__spacer" /> : (
          <form className="topbar__search" onSubmit={search} role="search">
            <Search size={15} aria-hidden="true" />
            <label className="sr-only" htmlFor="top-q">Search services or providers</label>
            <input id="top-q" type="search" placeholder="Search services, providers…" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} />
          </form>
        )}
        <Link to="/notifications" className="topbar__btn" aria-label={unread ? `Updates, ${unread} new` : 'Updates'} title="Updates">
          <Bell size={18} aria-hidden="true" />
          {unread > 0 && <b className="nav__badge">{unread > 9 ? '9+' : unread}</b>}
        </Link>
        <button type="button" className="topbar__btn topbar__btn--out" onClick={() => setOut(true)} aria-label="Sign out" title="Sign out">
          <LogOut size={18} aria-hidden="true" />
        </button>
      </header>

      <nav className="nav" aria-label="Main">
        <Link to="/" className="nav__brand" aria-label="Fixia home"><Logo width={112} /></Link>
        <ul className="nav__list">
          {ITEMS.map(({ to, label, proLabel, icon: Icon, end, badge, center }) => {
            const text = isPro && proLabel ? proLabel : label;
            return (
              <li key={to} className={center ? 'nav__center' : undefined}>
                <NavLink to={to} end={end} className={`nav__link${center ? ' nav__link--center' : ''}`} aria-label={center ? text : undefined}>
                  <span className="nav__icon"><Icon strokeWidth={1.75} aria-hidden="true" />{badge && unread > 0 && <b className="nav__badge" aria-label={`${unread} new`}>{unread > 9 ? '9+' : unread}</b>}</span>
                  <span className="nav__label">{text}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <main id="main" className="main"><Outlet /></main>
      <MessageGate />
      <PopupHost />
      <Confirm open={out} title="Sign out?" confirmLabel="Sign out" danger onClose={() => setOut(false)} onConfirm={logout}>You will need to sign in again to use Fixia.</Confirm>
    </div>
  );
}
