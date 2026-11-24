import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ChevronDown, Star } from 'lucide-react';
import { useLocation } from '../lib/location.jsx';
import { useHome } from '../lib/queries.js';
import ProviderList from '../components/ProviderList.jsx';
import { useAuth } from '../lib/auth.jsx';
import { daysLeft } from '../lib/format.js';
import LocationSheet from '../components/LocationSheet.jsx';
import { RowsSkeleton, ErrorState, Empty } from '../components/States.jsx';
import Button from '../components/ui/Button.jsx';

function FeaturedCard({ p }) {
  const where = p.city || p.province;
  return (
    <li>
      <Link to={`/p/${p.id}`} className="fcard">
        <span className="fcard__img">
          {p.avatarUrl ? <img src={p.avatarUrl} alt="" loading="lazy" /> : <span aria-hidden="true">{p.name.trim().charAt(0).toUpperCase() || '?'}</span>}
        </span>
        {p.isElite && <span className="fcard__badge">Elite</span>}
        <span className="fcard__rating"><Star size={12} fill="currentColor" strokeWidth={0} aria-hidden="true" />{p.reviews ? p.rating.toFixed(1) : 'New'}</span>
        <span className="fcard__body">
          <span className="fcard__name">{p.name}</span>
          {p.services[0] && <span className="fcard__service">{p.services[0]}</span>}
          {where && <span className="fcard__loc"><MapPin size={9} aria-hidden="true" />{where}</span>}
        </span>
      </Link>
    </li>
  );
}

export default function Home() {
  const { user } = useAuth(); const left = daysLeft(user.subscriptionEnd);
  const { loc, label } = useLocation();
  const [sheet, setSheet] = useState(false);
  const { data, error, isLoading, refetch } = useHome(loc);

  return (
    <>
      <button type="button" className="loc-bar" onClick={() => setSheet(true)}>
        <MapPin size={14} aria-hidden="true" />
        <span>Showing services in: <strong>{label || 'All Areas'}</strong></span>
        <span className="loc-bar__change">Change <ChevronDown size={14} aria-hidden="true" /></span>
      </button>

      {left !== null && left <= 7 && <div className="banner banner--warn" style={{ marginTop: 'var(--s4)' }}><h3>Your plan ends in {left} day{left === 1 ? '' : 's'}</h3><p>Renew to keep your benefits.</p><div><Link className="btn btn--primary btn--sm" to="/profile?tab=plan">Renew plan</Link></div></div>}

      <section className="section" aria-labelledby="h-feat" style={{ marginTop: 'var(--s5)' }}>
        <div className="section-head"><h2 id="h-feat">Featured Providers</h2></div>
        {isLoading ? <RowsSkeleton rows={3} /> : error ? <ErrorState error={error} retry={refetch} /> :
          data.featured.length ? <ul className="featured">{data.featured.map((p) => <FeaturedCard key={p.id} p={p} />)}</ul> :
          <Empty title="No featured providers yet" />}
      </section>

      <section className="section" aria-labelledby="h-near">
        <div className="section-head">
          <h2 id="h-near">{label ? `Providers near ${label}` : 'Providers Near You'}</h2>
          <Link to="/search">See all</Link>
        </div>
        {isLoading ? <RowsSkeleton /> : error ? null :
          data.nearby.length ? <ProviderList items={data.nearby} /> :
          <Empty title={label ? 'No providers in this area yet' : 'No providers yet'} action={label && <Button variant="secondary" size="sm" onClick={() => setSheet(true)}>Change area</Button>}>
            {label && 'Try a wider area, or browse all categories.'}
          </Empty>}
      </section>

      <LocationSheet open={sheet} onClose={() => setSheet(false)} />
    </>
  );
}
