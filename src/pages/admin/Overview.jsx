import { Link } from 'react-router-dom';
import { useAdm, Load, Head } from './kit.jsx';

const ITEMS = [['pending', 'Provider applications to review', 'pending'], ['upgrades', 'Upgrade payments to check', 'upgrades'], ['requests', 'Change requests', 'requests'], ['reports', 'Provider reports', 'reports'], ['uncategorized', 'Listings needing a category', 'uncategorized']];

export default function Overview() {
  const q = useAdm('dash');
  return (
    <>
      <Head title="Overview" sub="What needs you today." />
      <Load q={q} rows={5}>{(d) => (
        <>
          <ul className="todo">{ITEMS.map(([to, label, k]) => <li key={k}><Link to={`/admin/${to}`}><span>{label}</span><b className={d[k] ? '' : 'zero'}>{d[k]}</b></Link></li>)}</ul>
          <p className="muted" style={{ marginTop: 'var(--s6)' }}><span className="num">{d.providers}</span> active providers · <span className="num">{d.elite}</span> Elite · <span className="num">{d.customers}</span> customers</p>
        </>
      )}</Load>
    </>
  );
}
