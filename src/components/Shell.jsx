import { NavLink, Outlet } from 'react-router-dom';
import { House, Bookmark, LayoutGrid, ClipboardList, User } from 'lucide-react';
import './Shell.css';

const NAV = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/saved', label: 'Saved', icon: Bookmark },
  { to: '/browse', label: 'Browse', icon: LayoutGrid },
  { to: '/bookings', label: 'Bookings', icon: ClipboardList },
  { to: '/profile', label: 'Profile', icon: User },
];

export default function Shell() {
  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <nav className="nav" aria-label="Main">
        <div className="nav__brand">fixia</div>
        <ul className="nav__list">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink to={to} end={end} className="nav__link">
                <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main id="main" className="main"><Outlet /></main>
    </div>
  );
}
