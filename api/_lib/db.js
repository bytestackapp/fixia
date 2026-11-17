// Server-only Supabase helper. The browser never talks to Supabase directly.
const URL_ = process.env.SUPA_URL;
const KEY = process.env.SUPA_SERVICE_KEY;

export async function sb(path, { method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: prefer || 'return=representation',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error('[db]', res.status, text.slice(0, 300));
    throw Object.assign(new Error('Database error'), { status: 500 });
  }
  return text ? JSON.parse(text) : null;
}

export const q = (v) => encodeURIComponent(String(v));
