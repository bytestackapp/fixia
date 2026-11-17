import { sb } from './db.js';
let cache = { t: 0, v: {} };
export async function settings() {
  if (Date.now() - cache.t < 30_000) return cache.v;
  const rows = (await sb('app_settings?select=key,value')) || [];
  cache = { t: Date.now(), v: Object.fromEntries(rows.map((r) => [r.key, r.value])) };
  return cache.v;
}
export const setting = async (k, d = null) => (await settings())[k] ?? d;
export async function setSetting(key, value) {
  await sb('app_settings', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: { key, value: String(value) } });
  cache.t = 0;
}
