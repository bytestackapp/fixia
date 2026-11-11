// The one place the browser talks to the server. Inside the APK, API_BASE points at your Vercel domain.
const BASE = import.meta.env.VITE_API_BASE || '';
const KEY = 'fixia.token';

export const getToken = () => localStorage.getItem(KEY);
export const setToken = (t) => (t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY));

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

export async function api(path, body = {}) {
  let res;
  try {
    res = await fetch(`${BASE}/api/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('No connection. Check your internet and try again.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Something went wrong. Please try again.', res.status);
  return data;
}

// Signed-in actions: call('providers.list', { q: 'plumber' })
export const call = (action, payload = {}) => api('app', { action, ...payload });
