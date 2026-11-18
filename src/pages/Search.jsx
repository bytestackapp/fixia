import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapPin, ArrowUpDown, Check } from 'lucide-react';
import { useLocation } from '../lib/location.jsx';
import { useProviders } from '../lib/queries.js';
import { CATEGORIES, catLabel } from '../lib/categories.js';
import ProviderList from '../components/ProviderList.jsx';
import { bumpAd } from '../lib/ads.jsx';
import LocationSheet from '../components/LocationSheet.jsx';
import Dialog from '../components/ui/Dialog.jsx';
import { RowsSkeleton, ErrorState, Empty } from '../components/States.jsx';
import Button from '../components/ui/Button.jsx';

const PAGE = 20;
const SORTS = [['', 'Top rated'], ['reviews', 'Most reviewed'], ['newest', 'Newest']];

export default function Search() {
  const [sp, setSp] = useSearchParams();
  const { loc, label } = useLocation();
  const [sheet, setSheet] = useState(false), [sortOpen, setSortOpen] = useState(false);
  const p = { q: sp.get('q') || '', cat: sp.get('cat') || '', sub: sp.get('sub') || '', filter: sp.get('filter') || '', sort: sp.get('sort') || '', limit: Number(sp.get('n')) || PAGE };

  // typing waits 300ms before asking the server
  const [text, setText] = useState(p.q);
  useEffect(() => { const t = setTimeout(() => set({ q: text }), 300); return () => clearTimeout(t); }, [text]);   // eslint-disable-line
  useEffect(() => { setText(sp.get('q') || ''); }, [sp.get('q')]);   // eslint-disable-line
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
  const sortLabel = SORTS.find(([k]) => k === p.sort)?.[1] || 'Top rated';
  const Chip = ({ on, onClick, children }) => <button type="button" className="chip" aria-pressed={on} onClick={onClick}>{children}</button>;

  return (
    <>
      <header className="page-head"><h1>Search</h1></header>
      <div role="search">
        <label className="sr-only" htmlFor="s-q">Search services or providers</label>
        <input id="s-q" className="input" type="search" placeholder="Plumber, aircon cleaning, tutor…" value={text} onChange={(e) => setText(e.target.value)} />
      </div>

      <div className="chips" style={{ marginTop: 'var(--s3)' }} role="group" aria-label="Category">
        <Chip on={!p.cat} onClick={() => set({ cat: '' })}>All</Chip>
        {CATEGORIES.map((c) => <Chip key={c.key} on={p.cat === c.key} onClick={() => set({ cat: c.key })}>{c.label}</Chip>)}
      </div>
      {subs.length > 0 && (
        <div className="chips" role="group" aria-label="Service">
          <Chip on={!p.sub} onClick={() => set({ sub: '' })}>Any service</Chip>
          {subs.map((s) => <Chip key={s} on={p.sub === s} onClick={() => set({ sub: s })}>{s}</Chip>)}
        </div>
      )}
      <div className="chips" role="group" aria-label="Filters">
        <Chip on={p.filter === 'elite'} onClick={() => set({ filter: p.filter === 'elite' ? '' : 'elite' })}>Elite only</Chip>
        <Chip on={p.filter === 'top'} onClick={() => set({ filter: p.filter === 'top' ? '' : 'top' })}>Rated 4+</Chip>
      </div>

      <div className="results-bar" aria-live="polite">
        <span className="results-count">{isLoading ? 'Searching…' : <><strong>{data?.total ?? 0}</strong> provider{data?.total === 1 ? '' : 's'} found</>}{p.cat && ` in ${catLabel(p.cat)}`}{p.sub && ` · ${p.sub}`}</span>
        <span className="cluster" style={{ gap: 6 }}>
          <button type="button" className="sort-btn" onClick={() => setSortOpen(true)}><ArrowUpDown size={13} aria-hidden="true" /> {sortLabel}</button>
          <button type="button" className="sort-btn" onClick={() => setSheet(true)}><MapPin size={13} aria-hidden="true" /> {label || 'All areas'}</button>
        </span>
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

      <Dialog open={sortOpen} onClose={() => setSortOpen(false)} title="Sort by">
        <ul className="opt-list" role="radiogroup" aria-label="Sort by">
          {SORTS.map(([k, t]) => <li key={k || 'top'}><button type="button" className="opt" role="radio" aria-checked={p.sort === k} onClick={() => { set({ sort: k }); setSortOpen(false); }}>{t}{p.sort === k && <Check size={16} aria-hidden="true" />}</button></li>)}
        </ul>
      </Dialog>
      <LocationSheet open={sheet} onClose={() => setSheet(false)} />
    </>
  );
}
