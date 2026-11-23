import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapPin, ArrowUpDown, Check, SlidersHorizontal, ChevronRight, House } from 'lucide-react';
import { useLocation } from '../lib/location.jsx';
import { useProviders } from '../lib/queries.js';
import { CATEGORIES, CAT_ICONS, catLabel } from '../lib/categories.js';
import ProviderList from '../components/ProviderList.jsx';
import { bumpAd } from '../lib/ads.jsx';
import LocationSheet from '../components/LocationSheet.jsx';
import Dialog from '../components/ui/Dialog.jsx';
import { Switch } from '../components/ui/Kit.jsx';
import { RowsSkeleton, ErrorState, Empty } from '../components/States.jsx';
import Button from '../components/ui/Button.jsx';

const PAGE = 20;
const SORTS = [['', 'Top rated'], ['reviews', 'Most reviewed'], ['newest', 'Newest']];

export default function Search() {
  const [sp, setSp] = useSearchParams();
  const { loc, label } = useLocation();
  const [sheet, setSheet] = useState(false), [sortOpen, setSortOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false), [subOpen, setSubOpen] = useState(false), [filterOpen, setFilterOpen] = useState(false);
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
  const pickCat = (k) => { set({ cat: k, sub: '' }); setCatOpen(false); if (k) setSubOpen(true); };
  const pickSub = (s) => { set({ sub: s }); setSubOpen(false); };

  const { data, error, isLoading, isFetching, refetch } = useProviders({ ...p, ...loc });
  useEffect(() => { if (data?.items.length) bumpAd(); }, [data?.total, p.q, p.cat]);   // eslint-disable-line
  const subs = CATEGORIES.find((c) => c.key === p.cat)?.subs || [];
  const noFilters = !p.q && !p.cat && !p.filter;
  const sortLabel = SORTS.find(([k]) => k === p.sort)?.[1] || 'Top rated';

  return (
    <>
      <header className="page-head"><h1>Search</h1><p>Find providers by service, name or area.</p></header>
      <div role="search">
        <label className="sr-only" htmlFor="s-q">Search services or providers</label>
        <input id="s-q" className="input" type="search" placeholder="Plumber, aircon cleaning, tutor…" value={text} onChange={(e) => setText(e.target.value)} />
      </div>

      <div className="results-bar" aria-live="polite" style={{ marginTop: 'var(--s4)' }}>
        <span className="results-count">
          {isLoading ? 'Searching…' : <><strong>{data?.total ?? 0}</strong> provider{data?.total === 1 ? '' : 's'} found</>}
          {' in '}
          <button type="button" className="crumb" onClick={() => setCatOpen(true)}>{p.cat ? catLabel(p.cat) : 'All categories'}</button>
          {p.cat && <>{' · '}<button type="button" className="crumb" onClick={() => setSubOpen(true)}>{p.sub || 'Any service'}</button></>}
        </span>
        <span className="cluster" style={{ gap: 6 }}>
          <button type="button" className="sort-btn" onClick={() => setSortOpen(true)}><ArrowUpDown size={13} aria-hidden="true" /> {sortLabel}</button>
          <button type="button" className="sort-btn" onClick={() => setFilterOpen(true)}><SlidersHorizontal size={13} aria-hidden="true" /> Filter{p.filter ? ' (1)' : ''}</button>
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

      <Dialog open={catOpen} onClose={() => setCatOpen(false)} title="Choose a category">
        <ul className="sub-list">
          <li><button type="button" className="sub-card sub-card--all" onClick={() => pickCat('')}>All categories<ChevronRight size={16} aria-hidden="true" /></button></li>
          {CATEGORIES.map((c) => {
            const Icon = CAT_ICONS[c.key] || House;
            return (
              <li key={c.key}>
                <button type="button" className={`sub-card${p.cat === c.key ? ' is-on' : ''}`} onClick={() => pickCat(c.key)}>
                  <span className="sub-card__main"><span className="sub-card__icon"><Icon size={18} aria-hidden="true" /></span>{c.label}</span>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      </Dialog>

      <Dialog open={subOpen} onClose={() => setSubOpen(false)} title={p.cat ? catLabel(p.cat) : 'Choose a service'}>
        <ul className="sub-list">
          <li><button type="button" className="sub-card sub-card--all" onClick={() => pickSub('')}>Any service<ChevronRight size={16} aria-hidden="true" /></button></li>
          {subs.map((s) => (
            <li key={s}><button type="button" className={`sub-card${p.sub === s ? ' is-on' : ''}`} onClick={() => pickSub(s)}>{s}<ChevronRight size={16} aria-hidden="true" /></button></li>
          ))}
        </ul>
        <div className="dlg__actions"><Button variant="secondary" onClick={() => { setSubOpen(false); setCatOpen(true); }}>← Back</Button></div>
      </Dialog>

      <Dialog open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter">
        <div className="cluster" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          <span><b>Elite only</b><br /><span className="small muted">Show Elite providers only.</span></span>
          <Switch checked={p.filter === 'elite'} label="Elite only" onChange={(v) => set({ filter: v ? 'elite' : '' })} />
        </div>
        <div className="dlg__actions"><Button onClick={() => setFilterOpen(false)}>Done</Button></div>
      </Dialog>

      <Dialog open={sortOpen} onClose={() => setSortOpen(false)} title="Sort by">
        <ul className="opt-list" role="radiogroup" aria-label="Sort by">
          {SORTS.map(([k, t]) => <li key={k || 'top'}><button type="button" className="opt" role="radio" aria-checked={p.sort === k} onClick={() => { set({ sort: k }); setSortOpen(false); }}>{t}{p.sort === k && <Check size={16} aria-hidden="true" />}</button></li>)}
        </ul>
      </Dialog>
      <LocationSheet open={sheet} onClose={() => setSheet(false)} />
    </>
  );
}