/* FIXIA — /api/delete-storage-file.js (now authenticated; was open to the whole internet) */
const SUPA_URL = process.env.SUPA_URL;
const KEY      = process.env.SUPA_SERVICE_KEY;
const BUCKETS  = ['fixia-avatars', 'fixia-requests', 'fixia-portfolio', 'fixia-ids'];
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).end();
  if (!SUPA_URL || !KEY)       return res.status(500).json({ error: 'Server not configured.' });

  const token = req.headers['x-session-token'], uid = req.headers['x-user-id'];
  if (!token || !uid) return res.status(401).json({ error: 'Unauthorized' });
  const r0 = await fetch(`${SUPA_URL}/rest/v1/users?id=eq.${encodeURIComponent(uid)}&session_token=eq.${encodeURIComponent(token)}&select=id,role,username,status&limit=1`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  const user = (await r0.json())?.[0];
  if (!user || user.status === 'suspended') return res.status(401).json({ error: 'Unauthorized' });

  const { publicUrl } = req.body || {};
  const m = typeof publicUrl === 'string' && publicUrl.match(new RegExp('^' + esc(SUPA_URL) + '/storage/v1/object/public/([^/]+)/([^?#]+)$'));
  if (!m) return res.status(400).json({ error: 'Invalid URL' });
  const bucket = m[1], path = decodeURIComponent(m[2]);
  if (!BUCKETS.includes(bucket) || path.includes('..')) return res.status(403).json({ error: 'Forbidden' });

  if (user.role !== 'admin') {                         // users may only delete their own avatar files
    const name = path.split('/').pop();
    if (!(name.startsWith(user.id + '_') || name.startsWith(user.username + '_'))) return res.status(403).json({ error: 'Forbidden' });
  }
  const r = await fetch(`${SUPA_URL}/storage/v1/object/${bucket}/${path}`, { method: 'DELETE', headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  return res.status(r.ok ? 200 : r.status).json({ ok: r.ok });
};
