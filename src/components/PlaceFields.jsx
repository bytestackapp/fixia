import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Check } from 'lucide-react';
import * as psgc from '../lib/psgc.js';
import Dialog from './ui/Dialog.jsx';
import Button from './ui/Button.jsx';

const TITLES = { region: 'Choose a region', province: 'Choose a province', city: 'Choose a city or municipality', barangay: 'Choose a barangay' };

/* Region → province → city → barangay. Each pick opens the next list automatically. Reports names (what is stored) via onChange. */
export default function PlaceFields({ onChange, required = true }) {
  const [L, setL] = useState({ regions: [], provinces: [], cities: [], barangays: [] });
  const [v, setV] = useState({ region: '', province: '', city: '', barangay: '' });
  const [metro, setMetro] = useState(false);
  const [step, setStep] = useState(null);       // which list is open: region | province | city | barangay | null
  const name = (list, c) => list.find((x) => x.code === c)?.name || '';
  useEffect(() => { psgc.regions().then((r) => setL((l) => ({ ...l, regions: r }))).catch(() => {}); }, []);

  const emit = (nv, nl, nm = metro) => onChange({
    region: nv.region, regionName: name(nl.regions, nv.region), province: nv.province, provName: nm ? 'Metro Manila' : name(nl.provinces, nv.province),
    city: nv.city, cityName: nv.city ? psgc.cityLabel(name(nl.cities, nv.city)) : '', barangay: nv.barangay, brgyName: name(nl.barangays, nv.barangay),
  });

  async function pickRegion(c) {
    const nv = { region: c, province: '', city: '', barangay: '' }; setV(nv);
    const nl = { ...L, provinces: [], cities: [], barangays: [] }; setMetro(false);
    let nm = false;
    if (c) {
      try {
        const provs = await psgc.provinces(c);
        if (provs.length) nl.provinces = provs; else { nl.cities = await psgc.citiesOfRegion(c); nm = true; setMetro(true); }
      } catch { /* keep lists empty */ }
    }
    setL(nl); emit(nv, nl, nm);
    setStep(!c ? null : nm ? 'city' : 'province');
  }
  async function pickProvince(c) {
    const nv = { ...v, province: c, city: '', barangay: '' }; setV(nv);
    const nl = { ...L, cities: c ? await psgc.citiesOfProvince(c) : [], barangays: [] }; setL(nl); emit(nv, nl);
    setStep(c ? 'city' : null);
  }
  async function pickCity(c) {
    const nv = { ...v, city: c, barangay: '' }; setV(nv);
    const nl = { ...L, barangays: c ? await psgc.barangays(c) : [] }; setL(nl); emit(nv, nl);
    setStep(c && nl.barangays.length ? 'barangay' : null);
  }
  function pickBarangay(c) {
    const nv = { ...v, barangay: c }; setV(nv); emit(nv, L); setStep(null);
  }

  const PICK = { region: pickRegion, province: pickProvince, city: pickCity, barangay: pickBarangay };
  const LIST = { region: L.regions, province: L.provinces, city: L.cities, barangay: L.barangays };
  const PREV = { province: 'region', city: metro ? 'region' : 'province', barangay: 'city' };
  const fmt = (s, n) => (s === 'city' ? psgc.cityLabel(n) : n);

  const Trigger = ({ k, label, disabled, empty = 'Select…' }) => {
    const cur = v[k] ? fmt(k, name(LIST[k], v[k])) : '';
    return (
      <div className="field">
        <span className="field__label">{label}</span>
        <button type="button" className="input select-btn" disabled={disabled} onClick={() => setStep(k)}>
          <span className={cur ? undefined : 'select-btn__ph'}>{cur || empty}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </div>
    );
  };

  return (
    <>
      <Trigger k="region" label={`Region${required ? '' : ' (optional)'}`} />
      {!metro && <Trigger k="province" label="Province" disabled={!L.provinces.length} />}
      <Trigger k="city" label="City or municipality" disabled={!L.cities.length} />
      <Trigger k="barangay" label="Barangay (optional)" disabled={!L.barangays.length} empty="None" />

      <Dialog open={!!step} onClose={() => setStep(null)} title={step ? TITLES[step] : ''}>
        {step && (
          <>
            <ul className="sub-list">
              {step === 'barangay' && (
                <li><button type="button" className={`sub-card sub-card--all${!v.barangay ? ' is-on' : ''}`} onClick={() => pickBarangay('')}><span>None (skip barangay)</span>{!v.barangay ? <Check size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}</button></li>
              )}
              {LIST[step].map((i) => {
                const on = v[step] === i.code;
                return (
                  <li key={i.code}>
                    <button type="button" className={`sub-card${on ? ' is-on' : ''}`} onClick={() => PICK[step](i.code)}>
                      <span>{fmt(step, i.name)}</span>{on ? <Check size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="dlg__actions">
              {PREV[step] && <Button variant="secondary" onClick={() => setStep(PREV[step])}>← Back</Button>}
              <Button variant="secondary" onClick={() => setStep(null)}>Close</Button>
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}