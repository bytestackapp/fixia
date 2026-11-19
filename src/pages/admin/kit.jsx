import { Fragment, useEffect, useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { admin } from '../../lib/api.js';
import { toast } from '../../lib/toast.jsx';
import Dialog from '../../components/ui/Dialog.jsx';
import Button from '../../components/ui/Button.jsx';
import Field from '../../components/ui/Field.jsx';
import { RowsSkeleton, ErrorState, Empty } from '../../components/States.jsx';

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

/* Every row is a card: first column = title, column with an empty label = action icons, the rest = small label/value pairs */
export function Table({ cols, rows, empty = 'Nothing here.' }) {
  if (!rows.length) return <Empty title={empty} />;
  const [head, ...rest] = cols;
  const act = rest.find((c) => c[0] === '');
  const info = rest.filter((c) => c[0] !== '');
  return (
    <ul className="rows acards">
      {rows.map((r, i) => (
        <li key={r.id || i} className="row acard">
          <div className="acard__top">
            <div className="acard__title">{head[1](r)}</div>
            {act && <div className="acard__actions">{act[1](r)}</div>}
          </div>
          {info.length > 0 && <dl className="acard__info">{info.map((c) => <div key={c[0]}><dt>{c[0]}</dt><dd>{c[1](r)}</dd></div>)}</dl>}
        </li>
      ))}
    </ul>
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

/* icon-only button with a tooltip. variant: secondary | primary | danger.  size: sm | md */
export function IconBtn({ icon: Icon, label, variant = 'secondary', size = 'sm', loading, disabled, ...rest }) {
  return (
    <button type="button" className={`iconbtn${size === 'sm' ? ' iconbtn--sm' : ''} ibtn--${variant}`} data-tip={label} aria-label={label} aria-busy={loading || undefined} disabled={loading || disabled} {...rest}>
      {loading ? <span className="spinner" aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}
    </button>
  );
}
/* three-dot menu: items = [{ icon, label, onClick, danger }]  (falsy items are skipped) */
export function Menu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const off = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', off); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="kebab" ref={ref}>
      <IconBtn icon={MoreVertical} label="Actions" aria-expanded={open} onClick={() => setOpen(!open)} />
      {open && (
        <ul className="kebab__menu" role="menu">
          {items.filter(Boolean).map(({ icon: Icon, label, onClick, danger }) => (
            <li key={label}><button type="button" role="menuitem" className={`kebab__item${danger ? ' is-danger' : ''}`} onClick={() => { setOpen(false); onClick(); }}><Icon size={16} aria-hidden="true" />{label}</button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
export const Detail = ({ rows }) => <dl className="defs">{rows.filter(Boolean).map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd style={{ wordBreak: 'break-word' }}>{v || '—'}</dd></Fragment>)}</dl>;