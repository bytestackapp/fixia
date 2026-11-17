import { Link } from 'react-router-dom';
import { useSaved } from '../lib/queries.js';
import ProviderRow from '../components/ProviderRow.jsx';
import { RowsSkeleton, ErrorState, Empty } from '../components/States.jsx';

export default function Saved() {
  const { data, error, isLoading, refetch } = useSaved();
  return (
    <>
      <header className="page-head"><h1>Saved</h1><p>Providers you bookmarked, for quick access.</p></header>
      {isLoading ? <RowsSkeleton rows={3} /> : error ? <ErrorState error={error} retry={refetch} /> :
        data.items.length ? <ul className="rows">{data.items.map((p) => <ProviderRow key={p.id} p={p} />)}</ul> :
        <Empty title="Nothing saved yet" action={<Link className="btn btn--secondary btn--sm" to="/browse">Browse services</Link>}>
          Tap Save on any provider's page and they will appear here.
        </Empty>}
    </>
  );
}
