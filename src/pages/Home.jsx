import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { useLocation } from '../lib/location.jsx';
import { useHome } from '../lib/queries.js';
import { CATEGORIES } from '../lib/categories.js';
import ProviderList from '../components/ProviderList.jsx';
import ProviderRow from '../components/ProviderRow.jsx';
import { useAuth } from '../lib/auth.jsx';
import { daysLeft } from '../lib/format.js';
import LocationSheet from '../components/LocationSheet.jsx';
import { RowsSkeleton, ErrorState, Empty } from '../components/States.jsx';
import Button from '../components/ui/Button.jsx';

export default function Home() {
  const nav = useNavigate(); const { user } = useAuth(); const left = daysLeft(user.subscriptionEnd);
  const { loc, label } = useLocation();
  const [sheet, setSheet] = useState(false);
  const [text, setText] = useState('');
  const { data, error, isLoading, refetch } = useHome(loc);

  const submit = (e) => { e.preventDefault(); nav(`/search?q=${encodeURIComponent(text.trim())}`); };

  return (
    <>
      <header className="page-head">
        <h1>Find a provider.</h1>
        <form className="search-form" onSubmit={submit} role="search">
          <label className="sr-only" htmlFor="home-q">Search services or providers</label>
          <input id="home-q" className="input" type="search" placeholder="Plumber, aircon cleaning, tutor…" value={text} onChange={(e) => setText(e.target.value)} />
          <Button type="submit">Search</Button>
        </form>
        <div>
          <Button variant="quiet" size="sm" onClick={() => setSheet(true)} style={{ paddingLeft: 0 }}>
            <MapPin size={16} aria-hidden="true" /> {label ? `Showing ${label}` : 'Showing all areas'} — change
          </Button>
        </div>
      </header>

      {left !== null && left <= 7 && <div className="banner banner--warn"><h3>Your plan ends in {left} day{left === 1 ? '' : 's'}</h3><p>Renew to keep your benefits.</p><div><Link className="btn btn--primary btn--sm" to="/profile?tab=plan">Renew plan</Link></div></div>}

      <section className="section" aria-labelledby="h-feat" style={{ marginTop: 'var(--s5)' }}>
        <div className="section-head"><h2 id="h-feat">Featured</h2></div>
        {isLoading ? <RowsSkeleton rows={3} /> : error ? <ErrorState error={error} retry={refetch} /> :
          data.featured.length ? <ul className="rows">{data.featured.map((p) => <ProviderRow key={p.id} p={p} />)}</ul> :
          <Empty title="No featured providers yet" />}
      </section>

      <section className="section" aria-labelledby="h-near">
        <div className="section-head">
          <h2 id="h-near">{label ? `Near ${label}` : 'Providers'}</h2>
          <Link to="/search">See all</Link>
        </div>
        {isLoading ? <RowsSkeleton /> : error ? null :
          data.nearby.length ? <ProviderList items={data.nearby} /> :
          <Empty title={label ? 'No providers in this area yet' : 'No providers yet'} action={label && <Button variant="secondary" size="sm" onClick={() => setSheet(true)}>Change area</Button>}>
            {label && 'Try a wider area, or browse all categories.'}
          </Empty>}
      </section>

      <section className="section" aria-labelledby="h-cat">
        <div className="section-head"><h2 id="h-cat">Browse by category</h2><Link to="/browse">All services</Link></div>
        <ul className="link-list" style={{ marginTop: 'var(--s4)' }}>
          {CATEGORIES.map((c) => <li key={c.key}><Link to={`/search?cat=${c.key}`}>{c.label}</Link></li>)}
        </ul>
      </section>

      <LocationSheet open={sheet} onClose={() => setSheet(false)} />
    </>
  );
}
