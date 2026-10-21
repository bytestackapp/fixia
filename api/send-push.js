/*
 * ═══════════════════════════════════════════════════════════════
 *  FIXIA — Service Marketplace
 *  /api/send-push.js  —  Vercel Serverless Function
 *  © ByteStack Labs 2025. All Rights Reserved.
 *
 *  Sends Web Push notifications to subscribed devices.
 *  Called by: fixia-data.js → FX.sendPushNotification()
 * ═══════════════════════════════════════════════════════════════
 */

const webpush = require('web-push');

webpush.setVapidDetails(
  `mailto:${process.env.GMAIL_USER}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { subscriptions, title, body, url } = req.body || {};

  if (!subscriptions?.length) {
    return res.status(400).json({ error: 'No subscriptions provided.' });
  }

  const payload = JSON.stringify({
    title: title || 'Fixia',
    body:  body  || 'You have a new notification.',
    url:   url   || '/homepage.html',
    icon:  '/images/fixia-icon-192.png',
    badge: '/images/fixia-icon-192.png',
  });

  const results = await Promise.allSettled(
    subscriptions.map(sub => webpush.sendNotification(sub, payload))
  );

  const failed  = results.filter(r => r.status === 'rejected').length;
  const success = results.filter(r => r.status === 'fulfilled').length;

  console.log(`[Fixia Push] sent=${success} failed=${failed}`);
  return res.status(200).json({ ok: true, sent: success, failed });
};