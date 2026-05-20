// api/delete-storage-file.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { publicUrl } = req.body;
  if (!publicUrl) return res.status(400).json({ error: 'Missing publicUrl' });

  const match = publicUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
  if (!match) return res.status(400).json({ error: 'Invalid URL' });

  const [, bucket, path] = match;
  const SUPA_URL = process.env.SUPA_URL;
  const SUPA_SERVICE_KEY = process.env.SUPA_SERVICE_KEY;

  const r = await fetch(`${SUPA_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'DELETE',
    headers: {
      apikey: SUPA_SERVICE_KEY,
      Authorization: `Bearer ${SUPA_SERVICE_KEY}`,
    },
  });

  return res.status(r.ok ? 200 : r.status).json({ ok: r.ok });
}