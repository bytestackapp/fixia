import { NavLink, Outlet } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../lib/auth.jsx';
import { useAdm } from './kit.jsx';
import PullToRefresh from '../../components/PullToRefresh.jsx';

const NAV = [['', 'Overview'], ['pending', 'Applications', 'pending'], ['providers', 'Providers'], ['customers', 'Customers'], ['upgrades', 'Upgrades', 'upgrades'], ['requests', 'Change requests', 'requests'], ['reports', 'Reports', 'reports'], ['uncategorized', 'Uncategorized', 'uncategorized'], ['suspicious', 'Suspicious ratings'], ['packages', 'Plans'], ['ads', 'Ads & featured'], ['messages', 'Messages'], ['settings', 'Settings']];

export default function AdminShell() {
  const { logout } = useAuth();
  const d = useAdm('dash').data || {};
  return (
    <div className="shell admin">
      <a className="skip-link" href="#main">Skip to content</a>
      <nav className="anav" aria-label="Admin">
        <div className="anav__brand">fixia <small>admin</small></div>
        <button type="button" className="anav__iconout" onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={18} aria-hidden="true" /></button>
        <ul>{NAV.map(([to, label, k]) => <li key={to}><NavLink end={to === ''} to={`/admin/${to}`} className="anav__link">{label}{k && d[k] > 0 && <b>{d[k]}</b>}</NavLink></li>)}</ul>
        <button className="btn btn--quiet btn--sm anav__out" onClick={logout}>Sign out</button>
      </nav>
      <main id="main" className="amain"><Outlet /></main>
      <PullToRefresh />
    </div>
  );
}
