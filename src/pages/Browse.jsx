import { Link } from 'react-router-dom';
import { CATEGORIES } from '../lib/categories.js';

export default function Browse() {
  return (
    <>
      <header className="page-head">
        <h1>Browse</h1>
        <p>Pick a category, then the exact service you need.</p>
      </header>
      <div className="index" style={{ borderTop: '1px solid var(--ink)' }}>
        {CATEGORIES.map((c) => (
          <details key={c.key}>
            <summary><span>{c.label}</span><small>{c.subs.length} services</small></summary>
            <ul className="link-list">
              <li><Link to={`/search?cat=${c.key}`}><b>All {c.label.toLowerCase()}</b></Link></li>
              {c.subs.map((s) => <li key={s}><Link to={`/search?cat=${c.key}&sub=${encodeURIComponent(s)}`}>{s}</Link></li>)}
            </ul>
          </details>
        ))}
      </div>
    </>
  );
}
