/* /api/app — every signed-in action goes through here. Add new screens' actions to the table below. */
import { requireUser } from './_lib/auth.js';
import * as providers from './_lib/actions/providers.js';
import * as saved from './_lib/actions/saved.js';

const actions = {
  'home': providers.home,
  'providers.list': providers.list,
  'providers.get': providers.get,
  'providers.contact': providers.contact,
  'saved.list': saved.list,
  'saved.set': saved.set,
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { action, ...payload } = req.body || {};
  try {
    const run = actions[action];
    if (!run) return res.status(400).json({ error: 'Unknown action.' });
    const user = await requireUser(req);
    return res.status(200).json(await run(user, payload));
  } catch (e) {
    if (!e.status) console.error(`[app:${action}]`, e);
    return res.status(e.status || 500).json({ error: e.status ? e.message : 'Something went wrong. Please try again.' });
  }
}
