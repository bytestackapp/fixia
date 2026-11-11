import { createContext, useContext, useState, useCallback } from 'react';

const KEY = 'fixia.location';
const Ctx = createContext(null);
export const useLocation = () => useContext(Ctx);

const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };

export function LocationProvider({ children }) {
  const [loc, setLocState] = useState(read);
  const setLoc = useCallback((next) => {
    const v = next || {};
    if (next) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY);
    setLocState(v);
  }, []);
  const label = loc.barangay ? `${loc.barangay}, ${loc.city}` : loc.city ? `${loc.city}, ${loc.province}` : loc.province || '';
  return <Ctx.Provider value={{ loc, setLoc, label }}>{children}</Ctx.Provider>;
}
