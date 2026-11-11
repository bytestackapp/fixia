import Button from './ui/Button.jsx';

export function RowsSkeleton({ rows = 5 }) {
  return (
    <ul className="rows" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="prow" style={{ pointerEvents: 'none' }}>
          <div className="skeleton" style={{ width: 48, height: 48 }} />
          <div style={{ display: 'grid', gap: 8 }}><div className="skeleton" style={{ height: 16, width: '55%' }} /><div className="skeleton" style={{ height: 12, width: '35%' }} /></div>
          <div className="skeleton" style={{ height: 14, width: 44 }} />
        </li>
      ))}
    </ul>
  );
}

export function ErrorState({ error, retry }) {
  return (
    <div className="empty" role="alert">
      <h3>Could not load this</h3>
      <p>{error?.message || 'Something went wrong.'}</p>
      {retry && <Button variant="secondary" size="sm" onClick={retry}>Try again</Button>}
    </div>
  );
}

export function Empty({ title, children, action }) {
  return <div className="empty"><h3>{title}</h3>{children && <p>{children}</p>}{action}</div>;
}
