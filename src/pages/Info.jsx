import { useState } from 'react';
import Dialog from '../components/ui/Dialog.jsx';
import { DOCS } from '../lib/legal.js';

/* Pop-up that shows one document (about, support, privacy or terms). Used on Login and Sign-up. */
export function DocDialog({ doc, onClose }) {
  const [title, rows] = DOCS[doc] || ['', []];
  return (
    <Dialog open={!!doc} onClose={onClose} title={title}>
      <dl className="defs" style={{ gridTemplateColumns: '1fr' }}>
        {rows.map(([k, v], i) => <div key={i} style={{ display: 'grid', gap: 2 }}>{k && <dt>{k}</dt>}<dd style={{ fontWeight: 400 }}>{v}</dd></div>)}
      </dl>
      <div className="dlg__actions"><button className="btn btn--secondary" onClick={onClose}>Close</button></div>
    </Dialog>
  );
}

export default function InfoLinks({ className = 'login__links' }) {
  const [open, setOpen] = useState(null);
  return (
    <>
      <div className={className} style={{ display: 'flex', gap: 'var(--s5)', flexWrap: 'wrap' }}>
        {Object.entries(DOCS).map(([k, [t]]) => <button key={k} className="btn btn--quiet btn--sm" style={{ padding: 0 }} onClick={() => setOpen(k)}>{t.replace(' policy', '').replace(' of service', '').replace('About Fixia', 'About')}</button>)}
      </div>
      <DocDialog doc={open} onClose={() => setOpen(null)} />
    </>
  );
}