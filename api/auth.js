// api/auth.js
import bcrypt from 'bcryptjs'; // add to package.json: "bcryptjs": "^2.4.3"

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { action, password, hash } = req.body;

  if (action === 'hash') {
    if (!password) return res.status(400).json({ error: 'Missing password' });
    const hashed = await bcrypt.hash(password, 12);
    return res.status(200).json({ hash: hashed });
  }

  if (action === 'verify') {
    if (!password || !hash) return res.status(400).json({ error: 'Missing fields' });
    const match = await bcrypt.compare(password, hash);
    return res.status(200).json({ match });
  }

  return res.status(400).json({ error: 'Unknown action' });
}