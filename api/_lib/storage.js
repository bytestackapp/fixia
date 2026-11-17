import { httpError } from './auth.js';
const URL_ = process.env.SUPA_URL, KEY = process.env.SUPA_SERVICE_KEY;
const BUCKETS = ['fixia-avatars', 'fixia-ids', 'fixia-portfolio', 'fixia-requests'];
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' };

// dataUrl comes from the browser (already shrunk there). We check type and size again here.
export async function upload(bucket, name, dataUrl, { pdf = false } = {}) {
  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl || '');
  if (!m || !BUCKETS.includes(bucket) || !TYPES[m[1]] || (m[1] === 'application/pdf' && !pdf)) throw httpError(400, 'That file type is not allowed.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 3_000_000) throw httpError(400, 'That file is too large.');
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
