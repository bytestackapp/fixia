import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { useLocation } from '../lib/location.jsx';
import { useProviders } from '../lib/queries.js';
import { CATEGORIES, catLabel } from '../lib/categories.js';
import ProviderList from '../components/ProviderList.jsx';
import { bumpAd } from '../lib/ads.jsx';
import LocationSheet from '../components/LocationSheet.jsx';
import { RowsSkeleton, ErrorState, Empty } from '../components/States.jsx';
import Button from '../components/ui/Button.jsx';

const PAGE = 20;

export default function Search() {
  const [sp, setSp] = useSearchParams();
  const { loc, label } = useLocation();
  const [sheet, setSheet] = useState(false);
  const p = { q: sp.get('q') || '', cat: sp.get('cat') || '', sub: sp.get('sub') || '', filter: sp.get('filter') || '', sort: sp.get('sort') || '', limit: Number(sp.get('n')) || PAGE };

  // typing waits 300ms before asking the server
  const [text, setText] = useState(p.q);
  useEffect(() => { const t = setTimeout(() => set({ q: text }), 300); return () => clearTimeout(t); }, [text]);   // eslint-disable-line
  function set(patch) {
    const next = new URLSearchParams(sp);
    Object.entries({ ...patch, n: '' }).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (patch.cat !== undefined && patch.cat !== sp.get('cat')) next.delete('sub');
    if (next.toString() !== sp.toString()) setSp(next, { replace: true });
  }

  const { data, error, isLoading, isFetching, refetch } = useProviders({ ...p, ...loc });
  useEffect(() => { if (data?.items.length) bumpAd(); }, [data?.total, p.q, p.cat]);   // eslint-disable-line
  const subs = CATEGORIES.find((c) => c.key === p.cat)?.subs || [];
  const noFilters = !p.q && !p.cat && !p.filter;

  return (
    <>
      <header className="page-head"><h1>Search</h1></header>
      <div role="search">
        <label className="sr-only" htmlFor="s-q">Search services or providers</label>
        <input id="s-q" className="input" type="search" placeholder="Plumber, aircon cleaning, tutor…" value={text} onChange={(e) => setText(e.target.value)} autoFocus={!p.cat} />
      </div>

      <div className="controls">
        <div className="field">
          <label className="field__label" htmlFor="s-cat">Category</label>
          <select id="s-cat" className="input" value={p.cat} onChange={(e) => set({ cat: e.target.value })}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        {subs.length > 0 && (
          <div className="field">
            <label className="field__label" htmlFor="s-sub">Service</label>
            <select id="s-sub" className="input" value={p.sub} onChange={(e) => set({ sub: e.target.value })}>
              <option value="">Any service</option>
              {subs.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <label className="field__label" htmlFor="s-sort">Sort by</label>
          <select id="s-sort" className="input" value={p.sort} onChange={(e) => set({ sort: e.target.value })}>
            <option value="">Top rated</option><option value="reviews">Most reviewed</option><option value="newest">Newest</option>
          </select>
        </div>
        <button className="toggle" aria-pressed={p.filter === 'elite'} onClick={() => set({ filter: p.filter === 'elite' ? '' : 'elite' })}>Elite only</button>
        <button className="toggle" aria-pressed={p.filter === 'top'} onClick={() => set({ filter: p.filter === 'top' ? '' : 'top' })}>Rated 4+</button>
      </div>

      <div className="meta-line" aria-live="polite">
        <span>{isLoading ? 'Searching…' : `${data?.total ?? 0} provider${data?.total === 1 ? '' : 's'}`}{p.cat && ` in ${catLabel(p.cat)}`}{p.sub && ` · ${p.sub}`}</span>
        <Button variant="quiet" size="sm" onClick={() => setSheet(true)}><MapPin size={14} aria-hidden="true" /> {label || 'All areas'}</Button>
      </div>

      <div style={{ opacity: isFetching && !isLoading ? 0.6 : 1, transition: 'opacity .15s' }}>
        {isLoading ? <RowsSkeleton /> : error ? <ErrorState error={error} retry={refetch} /> :
          data.items.length ? (
            <>
              <ProviderList items={data.items} />
              {data.total > data.items.length && (
                <div style={{ marginTop: 'var(--s5)' }}><Button variant="secondary" onClick={() => set({ n: String(p.limit + PAGE) })}>Show more</Button></div>
              )}
            </>
          ) : (
            <Empty title="No providers match" action={!noFilters && <Button variant="secondary" size="sm" onClick={() => { setText(''); setSp({}, { replace: true }); }}>Clear filters</Button>}>
              {label ? `Nothing found in ${label}. Try a wider area or fewer filters.` : 'Try different words or fewer filters.'}
            </Empty>
          )}
      </div>
      <LocationSheet open={sheet} onClose={() => setSheet(false)} />
    </>
  );
}
