import { useEffect, useRef } from 'react';

/* Native <dialog>: the browser handles focus trapping, Esc to close, and screen-reader roles. */
export default function Dialog({ open, onClose, title, label, children, wide }) {
  const ref = useRef(null);
  useEffect(() => { const d = ref.current; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
  return (
    <dialog ref={ref} className={`dlg${wide ? ' dlg--wide' : ''}`} aria-label={label || title} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      {open && (
        <div className="dlg__body">
          {title && <h2>{title}</h2>}
          {children}
        </div>
      )}
    </dialog>
  );
}

export function Confirm({ open, title, children, confirmLabel = 'Confirm', danger, busy, onConfirm, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      {children && <p>{children}</p>}
      <div className="dlg__actions">
        <button className={`btn btn--${danger ? 'danger' : 'primary'}`} disabled={busy} aria-busy={busy || undefined} onClick={onConfirm}>{busy && <span className="spinner" aria-hidden="true" />}{confirmLabel}</button>
        <button className="btn btn--quiet" onClick={onClose}>Cancel</button>
      </div>
    </Dialog>
  );
}
