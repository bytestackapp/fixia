import { useEffect, useState } from 'react';
import * as psgc from '../lib/psgc.js';
import Field from './ui/Field.jsx';

/* Region → province → city → barangay. Reports names (what is stored) via onChange. */
export default function PlaceFields({ onChange, required = true }) {
  const [L, setL] = useState({ regions: [], provinces: [], cities: [], barangays: [] });
  const [v, setV] = useState({ region: '', province: '', city: '', barangay: '' });
  const [metro, setMetro] = useState(false);
  const name = (list, c) => list.find((x) => x.code === c)?.name || '';
  useEffect(() => { psgc.regions().then((r) => setL((l) => ({ ...l, regions: r }))).catch(() => {}); }, []);
  const emit = (nv, nl, nm = metro) => onChange({
    region: nv.region, regionName: name(nl.regions, nv.region), province: nv.province, provName: nm ? 'Metro Manila' : name(nl.provinces, nv.province),
    city: nv.city, cityName: nv.city ? psgc.cityLabel(name(nl.cities, nv.city)) : '', barangay: nv.barangay, brgyName: name(nl.barangays, nv.barangay),
  });
  async function region(c) {
    const nv = { region: c, province: '', city: '', barangay: '' }; setV(nv);
    const nl = { ...L, provinces: [], cities: [], barangays: [] }; setMetro(false);
    if (c) {
      const provs = await psgc.provinces(c);
      if (provs.length) nl.provinces = provs; else { nl.cities = await psgc.citiesOfRegion(c); setMetro(true); }
    }
    setL(nl); emit(nv, nl, !!c && !nl.provinces.length);
  }
  async function province(c) { const nv = { ...v, province: c, city: '', barangay: '' }; setV(nv); const nl = { ...L, cities: c ? await psgc.citiesOfProvince(c) : [], barangays: [] }; setL(nl); emit(nv, nl); }
  async function city(c) { const nv = { ...v, city: c, barangay: '' }; setV(nv); const nl = { ...L, barangays: c ? await psgc.barangays(c) : [] }; setL(nl); emit(nv, nl); }
  const opts = (list, fmt = (s) => s) => list.map((i) => <option key={i.code} value={i.code}>{fmt(i.name)}</option>);
  return (
    <>
      <Field as="select" label={`Region${required ? '' : ' (optional)'}`} value={v.region} onChange={(e) => region(e.target.value)}><option value="">Select…</option>{opts(L.regions)}</Field>
      {!metro && <Field as="select" label="Province" value={v.province} disabled={!L.provinces.length} onChange={(e) => province(e.target.value)}><option value="">Select…</option>{opts(L.provinces)}</Field>}
      <Field as="select" label="City or municipality" value={v.city} disabled={!L.cities.length} onChange={(e) => city(e.target.value)}><option value="">Select…</option>{opts(L.cities, psgc.cityLabel)}</Field>
      <Field as="select" label="Barangay (optional)" value={v.barangay} disabled={!L.barangays.length} onChange={(e) => { const nv = { ...v, barangay: e.target.value }; setV(nv); emit(nv, L); }}><option value="">Select…</option>{opts(L.barangays)}</Field>
    </>
  );
}
