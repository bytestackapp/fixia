import { useEffect, useRef, useState } from 'react';
import { useLocation } from '../lib/location.jsx';
import * as psgc from '../lib/psgc.js';
import Button from './ui/Button.jsx';
import './LocationSheet.css';


export default function LocationSheet({ open, onClose }) {
  const ref = useRef(null);
  const { loc, setLoc } = useLocation();
  const [lists, setLists] = useState({ regions: [], provinces: [], cities: [], barangays: [] });
  const [pick, setPick] = useState({ region: '', province: '', city: '', barangay: '' });
  const [error, setError] = useState('');
  const [metro, setMetro] = useState(false);       // regions like NCR have no provinces

  useEffect(() => {
    const d = ref.current;
    if (open && !d.open) { d.showModal(); if (!lists.regions.length) psgc.regions().then((r) => setLists((l) => ({ ...l, regions: r }))).catch(() => setError('Could not load places. Check your connection.')); }
    if (!open && d.open) d.close();
  }, [open]);   // eslint-disable-line

  const name = (list, code) => list.find((x) => x.code === code)?.name || '';

  async function chooseRegion(region) {
    setError(''); setPick({ region, province: '', city: '', barangay: '' });
    setLists((l) => ({ ...l, provinces: [], cities: [], barangays: [] })); setMetro(false);
    if (!region) return;
    try {
      const provs = await psgc.provinces(region);
      if (provs.length) setLists((l) => ({ ...l, provinces: provs }));
      else { setMetro(true); psgc.citiesOfRegion(region).then((c) => setLists((l) => ({ ...l, cities: c }))); }
    } catch { setError('Could not load places.'); }
  }
  async function chooseProvince(province) {
    setPick((p) => ({ ...p, province, city: '', barangay: '' })); setLists((l) => ({ ...l, cities: [], barangays: [] }));
    if (province) psgc.citiesOfProvince(province).then((c) => setLists((l) => ({ ...l, cities: c })));
  }
  async function chooseCity(city) {
    setPick((p) => ({ ...p, city, barangay: '' })); setLists((l) => ({ ...l, barangays: [] }));
    if (city) psgc.barangays(city).then((b) => setLists((l) => ({ ...l, barangays: b })));
  }

  function apply() {
    const province = metro ? 'Metro Manila' : name(lists.provinces, pick.province);
    if (!province) { setError('Choose at least a region and province.'); return; }
    const cityName = pick.city ? psgc.cityLabel(name(lists.cities, pick.city)) : '';
    setLoc({ province, city: cityName, barangay: pick.barangay ? name(lists.barangays, pick.barangay) : '' });
    onClose();
  }

  const Select = ({ id, label, value, onChange, items, disabled, fmt = (s) => s }) => (
    <div className="field">
      <label className="field__label" htmlFor={id}>{label}</label>
      <select id={id} className="input" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {items.map((i) => <option key={i.code} value={i.code}>{fmt(i.name)}</option>)}
      </select>
    </div>
  );

  return (
    <dialog ref={ref} className="sheet" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-labelledby="loc-title">
      <div className="sheet__body">
        <h2 id="loc-title">Where do you need help?</h2>
        {loc.province && <p className="sheet__current">Now showing: <b>{loc.barangay ? `${loc.barangay}, ` : ''}{loc.city || loc.province}</b></p>}
        {error && <div className="notice notice--error" role="alert">{error}</div>}
        <Select id="l-region" label="Region" value={pick.region} onChange={chooseRegion} items={lists.regions} />
        {!metro && <Select id="l-prov" label="Province" value={pick.province} onChange={chooseProvince} items={lists.provinces} disabled={!lists.provinces.length} />}
        <Select id="l-city" label="City or municipality (optional)" value={pick.city} onChange={chooseCity} items={lists.cities} disabled={!lists.cities.length} fmt={psgc.cityLabel} />
        <Select id="l-brgy" label="Barangay (optional)" value={pick.barangay} onChange={(v) => setPick((p) => ({ ...p, barangay: v }))} items={lists.barangays} disabled={!lists.barangays.length} />
        <div className="sheet__actions">
          <Button onClick={apply}>Show providers here</Button>
          <Button variant="quiet" onClick={() => { setLoc(null); onClose(); }}>Show all areas</Button>
          <Button variant="quiet" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </dialog>
  );
}
