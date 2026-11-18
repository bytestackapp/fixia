import { useState } from 'react';
import { Link } from 'react-router-dom';
import { House, Car, Trees, Zap, Sparkles, GraduationCap, HeartPulse, Laptop, HardHat, SprayCan, PawPrint, PartyPopper } from 'lucide-react';
import { CATEGORIES } from '../lib/categories.js';
import Dialog from '../components/ui/Dialog.jsx';

const ICONS = { home: House, auto: Car, garden: Trees, elec: Zap, beauty: Sparkles, edu: GraduationCap, health: HeartPulse, tech: Laptop, build: HardHat, clean: SprayCan, pet: PawPrint, event: PartyPopper };

export default function Browse() {
  const [open, setOpen] = useState('');
  const cat = CATEGORIES.find((c) => c.key === open);
  const close = () => setOpen('');

  return (
    <>
      <header className="page-head">
        <h1>Browse</h1>
        <p>Pick a category, then the exact service you need.</p>
      </header>
      <div className="cat-grid">
        {CATEGORIES.map((c) => {
          const Icon = ICONS[c.key] || House;
          return (
            <button key={c.key} type="button" data-cat={c.key} className="cat-card" onClick={() => setOpen(c.key)}>
              <span className="cat-icon-wrap"><Icon size={22} aria-hidden="true" /></span>
              <span className="cat-name">{c.label}</span>
              <span className="cat-count">{c.subs.length} services</span>
            </button>
          );
        })}
      </div>

      {/* sub-list: slide-up sheet on phones, pop-up on desktop */}
      <Dialog open={!!cat} onClose={close} title={cat?.label}>
        {cat && (
          <ul className="link-list">
            <li><Link to={`/search?cat=${cat.key}`} onClick={close}><b>All {cat.label.toLowerCase()}</b></Link></li>
            {cat.subs.map((s) => <li key={s}><Link to={`/search?cat=${cat.key}&sub=${encodeURIComponent(s)}`} onClick={close}>{s}</Link></li>)}
          </ul>
        )}
      </Dialog>
    </>
  );
}
