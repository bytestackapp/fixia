import { sb, q } from '../db.js';
import { withServices } from './providers.js';

const FIELDS = 'id,biz_name,avatar_url,is_elite,avg_rating,total_ratings,city_name,province_name,barangay_name';

export async function list(user) {
  const rows = (await sb(`saved_providers?user_id=eq.${q(user.id)}&order=saved_at.desc&select=provider_id`)) || [];
  if (!rows.length) return { items: [] };
  const ids = rows.map((r) => r.provider_id).join(',');
  const provs = (await sb(`providers?id=in.(${ids})&status=eq.approved&select=${FIELDS}`)) || [];
  const byId = Object.fromEntries((await withServices(provs)).map((p) => [p.id, p]));
  return { items: rows.map((r) => byId[r.provider_id]).filter(Boolean) };
}

export async function set(user, { providerId, saved }) {
  const where = `user_id=eq.${q(user.id)}&provider_id=eq.${q(providerId)}`;
  await sb(`saved_providers?${where}`, { method: 'DELETE', prefer: 'return=minimal' });
  if (saved) await sb('saved_providers', { method: 'POST', prefer: 'return=minimal', body: { user_id: user.id, provider_id: providerId } });
  return { saved: !!saved };
}
