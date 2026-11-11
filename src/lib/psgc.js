// Philippine regions / provinces / cities / barangays (public PSGC service), cached per session.
const BASE = 'https://psgc.gitlab.io/api';
const cache = new Map();
const get = (p) => {
  if (!cache.has(p)) cache.set(p, fetch(BASE + p).then((r) => { if (!r.ok) throw new Error('PSGC'); return r.json(); }).catch((e) => { cache.delete(p); throw e; }));
  return cache.get(p);
};
const sorted = (a) => [...a].sort((x, y) => x.name.localeCompare(y.name));
// Same wording providers used at signup, so filters match what is stored.
export const cityLabel = (n) => n.replace(/^City of (.+)/, '$1 City');

export const regions = () => get('/regions/').then(sorted);
export const provinces = (r) => get(`/regions/${r}/provinces/`).then(sorted);
export const citiesOfRegion = (r) => get(`/regions/${r}/cities-municipalities/`).then(sorted);
export const citiesOfProvince = (p) => get(`/provinces/${p}/cities-municipalities/`).then(sorted);
export const barangays = (c) => get(`/cities-municipalities/${c}/barangays/`).then(sorted);
