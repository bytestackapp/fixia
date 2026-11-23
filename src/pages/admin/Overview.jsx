import { Link } from 'react-router-dom';
import { useAdm, Load, Head } from './kit.jsx';

const ITEMS = [['pending', 'Provider applications to review', 'pending'], ['upgrades', 'Upgrade payments to check', 'upgrades'], ['requests', 'Change requests', 'requests'], ['reports', 'Provider reports', 'reports'], ['uncategorized', 'Listings needing a category', 'uncategorized']];
const STATS = [['providers', 'Providers'], ['elite', 'Elites'], ['customers', 'Customers']];

export default function Overview() {
  const q = useAdm('dash');
  return (
    <>
      <Head title="Overview" sub="What needs you today." />
      <Load q={q} rows={5}>{(d) => (
        <>
          <div className="stat-cards">{STATS.map(([k, label]) => <div key={k} className="stat-card"><b className="num">{d[k]}</b><span>{label}</span></div>)}</div>
          <ul className="todo">{ITEMS.map(([to, label, k]) => <li key={k}><Link to={`/admin/${to}`}><span>{label}</span><b className={d[k] ? '' : 'zero'}>{d[k]}</b></Link></li>)}</ul>
        </>
      )}</Load>
    </>
  );
}