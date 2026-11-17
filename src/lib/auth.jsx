import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, getToken, setToken } from './api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!getToken());
  const [notice, setNotice] = useState('');

  const clear = useCallback((msg = '') => { setToken(null); setUser(null); setNotice(msg); qc.clear(); }, [qc]);

  useEffect(() => {
    if (!getToken()) return;
    api('auth', { action: 'me' }).then((d) => setUser(d.user)).catch((e) => clear(e.status === 401 ? e.message : '')).finally(() => setReady(true));
  }, [clear]);

  // any request answered "401" (signed in elsewhere, suspended…) ends the session everywhere in the app
  useEffect(() => {
    const on = (e) => clear(e.detail || 'Please sign in again.');
    window.addEventListener('fixia:signed-out', on);
    return () => window.removeEventListener('fixia:signed-out', on);
  }, [clear]);

  const adopt = useCallback((token, u) => { setToken(token); setUser(u); setNotice(''); }, []);
  const login = useCallback(async (identifier, password) => { const d = await api('auth', { action: 'login', identifier, password }); adopt(d.token, d.user); return d.user; }, [adopt]);
  const refresh = useCallback(() => api('auth', { action: 'me' }).then((d) => setUser(d.user)), []);
  const logout = useCallback(async () => { try { await api('auth', { action: 'logout' }); } catch { /* local sign-out is enough */ } clear(); }, [clear]);

  return <Ctx.Provider value={{ user, ready, notice, login, adopt, refresh, logout }}>{children}</Ctx.Provider>;
}
