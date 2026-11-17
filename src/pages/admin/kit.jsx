import { Fragment, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { admin } from '../../lib/api.js';
import { toast } from '../../lib/toast.jsx';
import Dialog from '../../components/ui/Dialog.jsx';
import Button from '../../components/ui/Button.jsx';
import Field from '../../components/ui/Field.jsx';
import { RowsSkeleton, ErrorState } from '../../components/States.jsx';

export const useAdm = (action, payload = {}) => useQuery({ queryKey: ['adm', action, payload], queryFn: () => admin(action, payload), staleTime: 0 });

/* run an admin action, show a toast, refresh every admin list */
export function useDo(action, okText) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p) => admin(action, p),
    onSuccess: (d) => { toast(typeof okText === 'function' ? okText(d) : okText || 'Done'); qc.invalidateQueries({ queryKey: ['adm'] }); },
    onError: (e) => toast(e.message, 'error'),
  });
}

export function Load({ q, children, rows = 4 }) {
  if (q.isLoading) return <RowsSkeleton rows={rows} />;
  if (q.error) return <ErrorState error={q.error} retry={q.refetch} />;
  return children(q.data);
}

export const Head = ({ title, sub, children }) => <header className="page-head"><div className="cluster" style={{ justifyContent: 'space-between' }}><h1 style={{ fontSize: 'var(--t-xl)' }}>{title}</h1>{children}</div>{sub && <p>{sub}</p>}</header>;

export function Table({ cols, rows, empty = 'Nothing here.' }) {
  if (!rows.length) return <p className="muted" style={{ padding: 'var(--s5) 0' }}>{empty}</p>;
  return (
    <div className="table-wrap"><table className="table">
      <thead><tr>{cols.map((c) => <th key={c[0]}>{c[0]}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={r.id || i}>{cols.map((c) => <td key={c[0]}>{c[1](r)}</td>)}</tr>)}</tbody>
    </table></div>
  );
}

/* a dialog that asks for a reason (or note) before doing something */
export function Prompt({ open, title, label, required, confirmLabel = 'Confirm', danger, busy, onClose, onSubmit, children }) {
  const [v, setV] = useState('');
  return (
    <Dialog open={open} onClose={() => { setV(''); onClose(); }} title={title}>
      {children}
      {label && <Field as="textarea" label={label} value={v} onChange={(e) => setV(e.target.value)} />}
      <div className="dlg__actions"><Button variant={danger ? 'danger' : 'primary'} loading={busy} disabled={required && !v.trim()} onClick={() => { onSubmit(v); setV(''); }}>{confirmLabel}</Button><Button variant="quiet" onClick={() => { setV(''); onClose(); }}>Cancel</Button></div>
    </Dialog>
  );
}
export const Btn = (p) => <Button size="sm" {...p} />;
export const Detail = ({ rows }) => <dl className="defs">{rows.filter(Boolean).map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd style={{ wordBreak: 'break-word' }}>{v || '—'}</dd></Fragment>)}</dl>;
