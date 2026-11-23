import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/* Native <dialog>: the browser handles focus trapping, Esc to close, and screen-reader roles.
   It is drawn on <body> and only reacts to its own close and click events, so a pop-up opened
   on top of another one closes alone and leaves the one underneath open. */
export default function Dialog({ open, onClose, title, label, children, wide, card }) {
  const ref = useRef(null);
  useEffect(() => { const d = ref.current; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
  return createPortal(
    <dialog
      ref={ref}
      className={`dlg${wide ? ' dlg--wide' : ''}${card ? ' dlg--card' : ''}`}
      aria-label={label || title}
      onClose={(e) => { e.stopPropagation(); if (e.target === ref.current) onClose(); }}
      onClick={(e) => { e.stopPropagation(); if (e.target === ref.current) onClose(); }}
    >
      {open && (
        <div className="dlg__body">
          {title && <h2>{title}</h2>}
          {children}
        </div>
      )}
    </dialog>,
    document.body
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