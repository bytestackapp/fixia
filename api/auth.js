/*
 * ═══════════════════════════════════════════════════════════════
 *  FIXIA — Service Marketplace
 *  /api/auth.js  —  Vercel Serverless Function
 *  © ByteStack Labs 2025. All Rights Reserved.
 * ═══════════════════════════════════════════════════════════════
 */

const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { action, password, hash } = req.body || {};
  if (typeof password === 'string' && password.length > 128) return res.status(400).json({ error: 'Password too long' });

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
};