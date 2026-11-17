import { useState } from 'react';
import Dialog from '../components/ui/Dialog.jsx';

const DOCS = {
  about: ['About Fixia', [['', 'Fixia is a service marketplace that helps Filipinos find trusted professionals for home, personal and technical needs. Built by ByteStack Labs.']]],
  support: ['Support', [['Email', 'support.fixia@gmail.com'], ['Messenger', 'Search "Fixia PH" on Facebook'], ['Hours', 'We reply within 1–2 business days.']]],
  privacy: ['Privacy policy', [['What we collect', 'Account details (name, email, phone), profile information, bookings and basic usage data.'], ['How we use it', 'To run the service, process bookings, send notifications and keep the platform safe.'], ['Sharing', 'We never sell personal data. We share information only with providers you book, payment processors, or when the law requires it.'], ['Provider IDs', 'Government IDs are used only to verify identity and are deleted once verification is complete.'], ['Your rights', 'You may ask to see, correct or delete your data (Data Privacy Act of 2012, RA 10173). Email support.fixia@gmail.com.']]],
  terms: ['Terms of service', [['Service', 'Fixia connects customers with independent providers. Fixia is not a party to the work agreed between them.'], ['Accounts', 'Keep your password private and your details accurate. We may suspend accounts that break these terms.'], ['Payments', 'Payment for jobs happens outside the app between customer and provider. Plan fees are paid to Fixia.'], ['Conduct', 'No false information, abuse, or attempts to disrupt the platform.'], ['Changes', 'We may update these terms. Continued use means you accept the update.']]],
};

export default function InfoLinks({ className = 'login__links' }) {
  const [open, setOpen] = useState(null);
  const [title, rows] = DOCS[open] || ['', []];
  return (
    <>
      <div className={className} style={{ display: 'flex', gap: 'var(--s5)', flexWrap: 'wrap' }}>
        {Object.entries(DOCS).map(([k, [t]]) => <button key={k} className="btn btn--quiet btn--sm" style={{ padding: 0 }} onClick={() => setOpen(k)}>{t.replace(' policy', '').replace(' of service', '').replace('About Fixia', 'About')}</button>)}
      </div>
      <Dialog open={!!open} onClose={() => setOpen(null)} title={title}>
        <dl className="defs" style={{ gridTemplateColumns: '1fr' }}>
          {rows.map(([k, v], i) => <div key={i} style={{ display: 'grid', gap: 2 }}>{k && <dt>{k}</dt>}<dd style={{ fontWeight: 400 }}>{v}</dd></div>)}
        </dl>
        <div className="dlg__actions"><button className="btn btn--secondary" onClick={() => setOpen(null)}>Close</button></div>
      </Dialog>
    </>
  );
}
