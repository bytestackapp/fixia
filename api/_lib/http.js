// Wraps an action table into a Vercel function: CORS (needed by the Android app), JSON errors, one place for logging.
export const clientIp = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null;

export function route(actions, { guard } = {}) {
  return async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { action, ...payload } = req.body || {};
    try {
      const run = actions[action];
      if (!run) return res.status(400).json({ error: 'Unknown action.' });
      const user = guard ? await guard(req, action) : null;
      return res.status(200).json((await run(user, payload, req)) ?? { ok: true });
    } catch (e) {
      if (!e.status) console.error(`[${action}]`, e);
      return res.status(e.status || 500).json({ error: e.status ? e.message : 'Something went wrong. Please try again.' });
    }
  };
}
