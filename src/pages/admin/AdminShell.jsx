import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Smartphone } from 'lucide-react';
import { useAuth } from '../../lib/auth.jsx';
import { useAdm } from './kit.jsx';
import PullToRefresh from '../../components/PullToRefresh.jsx';
import { Confirm } from '../../components/ui/Dialog.jsx';

const NAV = [['', 'Overview'], ['pending', 'Applications', 'pending'], ['providers', 'Providers'], ['customers', 'Customers'], ['upgrades', 'Upgrades', 'upgrades'], ['requests', 'Change requests', 'requests'], ['reports', 'Reports', 'reports'], ['uncategorized', 'Uncategorized', 'uncategorized'], ['suspicious', 'Suspicious ratings'], ['packages', 'Plans'], ['fees', 'Processing fees'], ['ads', 'Ads & featured'], ['messages', 'Messages'], ['settings', 'Settings']];

export default function AdminShell() {
  const { logout } = useAuth(); const nav = useNavigate();
  const [out, setOut] = useState(false);
  const d = useAdm('dash').data || {};
  const viewApp = () => { sessionStorage.setItem('fixia.adminView', '1'); nav('/'); };
  return (
    <div className="shell admin">
      <a className="skip-link" href="#main">Skip to content</a>
      <nav className="anav" aria-label="Admin">
        <div className="anav__brand">fixia <small>admin</small></div>
        <div className="anav__tools">
          <button type="button" className="anav__iconout" onClick={viewApp} aria-label="View the app" title="View the app"><Smartphone size={18} aria-hidden="true" /></button>
          <button type="button" className="anav__iconout anav__iconout--danger" onClick={() => setOut(true)} aria-label="Sign out" title="Sign out"><LogOut size={18} aria-hidden="true" /></button>
        </div>
        <ul>{NAV.map(([to, label, k]) => <li key={to}><NavLink end={to === ''} to={`/admin/${to}`} className="anav__link">{label}{k && d[k] > 0 && <b>{d[k]}</b>}</NavLink></li>)}</ul>
        <button className="btn btn--quiet btn--sm anav__out" style={{ marginBottom: 4 }} onClick={viewApp}>View app</button>
        <button className="btn btn--quiet btn--sm anav__out" onClick={() => setOut(true)}>Sign out</button>
      </nav>
      <main id="main" className="amain"><Outlet /></main>
      <PullToRefresh />
      <Confirm open={out} title="Sign out?" confirmLabel="Sign out" danger onClose={() => setOut(false)} onConfirm={logout}>You will need to sign in again to use the admin console.</Confirm>
    </div>
  );
}