import { httpError } from './auth.js';
const URL_ = process.env.SUPA_URL, KEY = process.env.SUPA_SERVICE_KEY;
const BUCKETS = ['fixia-avatars', 'fixia-ids', 'fixia-portfolio', 'fixia-requests'];
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' };

// dataUrl comes from the browser (already shrunk there). We check type and size again here.
export async function upload(bucket, name, dataUrl, { pdf = false } = {}) {
  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl || '');
  if (!m || !BUCKETS.includes(bucket) || !TYPES[m[1]] || (m[1] === 'application/pdf' && !pdf)) throw httpError(400, 'That file type is not allowed.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 51_200) throw httpError(400, 'That image is too large (max 50 KB).');
  const path = `${name}.${TYPES[m[1]]}`;
  const r = await fetch(`${URL_}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': m[1] }, body: buf,
  });
  if (!r.ok) { console.error('[storage]', r.status, await r.text()); throw httpError(500, 'Upload failed. Please try again.'); }
  return { url: `${URL_}/storage/v1/object/public/${bucket}/${path}`, path };
}

export async function remove(publicUrl) {
  const m = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/.exec(publicUrl || '');
  if (!m || !BUCKETS.includes(m[1])) return;
  await fetch(`${URL_}/storage/v1/object/${m[1]}/${m[2]}`, { method: 'DELETE', headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }).catch(() => {});
}


// Private files (government IDs): makes a link that works for 10 minutes, for admin review only.
export async function signedUrl(publicUrl) {
  const m = /\/storage\/v1\/object\/(?:public|sign)\/([^/?]+)\/([^?]+)/.exec(publicUrl || '');
  if (!m || !BUCKETS.includes(m[1])) return publicUrl || null;
  try {
    const r = await fetch(`${URL_}/storage/v1/object/sign/${m[1]}/${m[2]}`, {
      method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 600 }),
    });
    const j = await r.json();
    return j.signedURL ? `${URL_}/storage/v1${j.signedURL}` : null;
  } catch { return null; }
}
