import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from './api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!getToken());   // no token = nothing to check
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!getToken()) return;
    api('auth', { action: 'me' })
      .then((d) => setUser(d.user))
      .catch((e) => { setToken(null); if (e.status === 401) setNotice(e.message); })
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (identifier, password) => {
    const d = await api('auth', { action: 'login', identifier, password });
    setToken(d.token); setUser(d.user); setNotice('');
  }, []);

  const logout = useCallback(async () => {
    try { await api('auth', { action: 'logout' }); } catch { /* signing out locally is enough */ }
    setToken(null); setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, ready, notice, login, logout }}>{children}</Ctx.Provider>;
}
