/*
 * ═══════════════════════════════════════════════════════════════
 *  FIXIA — Service Marketplace
 *  Local Development Server
 *  © ByteStack Labs 2025. All Rights Reserved.
 * ═══════════════════════════════════════════════════════════════
 *
 *  - Serves pages from /public and css/js/images/sw.js/manifest.json from the project root
 *  - Proxies /api/* calls to your live Vercel deployment
 *  - Run via: node server.js
 * ═══════════════════════════════════════════════════════════════
 */

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const PORT       = 3200;
const VERCEL_URL = 'https://gofixia.vercel.app'; // your live Vercel URL (update to your new domain)

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
};

const server = http.createServer((req, res) => {
  const parsed  = url.parse(req.url);
  const reqPath = parsed.pathname;

  // ── CORS headers for all responses ──────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token, x-user-id');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ── PROXY /api/* to live Vercel ──────────────────────────────
  if (reqPath.startsWith('/api/')) {
    const target = new url.URL(reqPath + (parsed.search || ''), VERCEL_URL);

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const options = {
        hostname: target.hostname,
        path:     target.pathname + (target.search || ''),
        method:   req.method,
        headers: {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...(req.headers.authorization       ? { 'Authorization':   req.headers.authorization } : {}),
          ...(req.headers['x-session-token']  ? { 'x-session-token': req.headers['x-session-token'] } : {}),
          ...(req.headers['x-user-id']        ? { 'x-user-id':       req.headers['x-user-id'] } : {}),
        },
      };

      const proxy = https.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, {
          'Content-Type': proxyRes.headers['content-type'] || 'application/json',
        });
        proxyRes.pipe(res);
      });

      proxy.on('error', (e) => {
        console.error('[Proxy Error]', e.message);
        res.writeHead(502);
        res.end(JSON.stringify({ error: 'Proxy error: ' + e.message }));
      });

      if (body) proxy.write(body);
      proxy.end();
    });

    return;
  }

  // ── SERVE STATIC FILES ──────────────────────────────────────
  let filePath = decodeURIComponent(reqPath);
  if (filePath === '/') filePath = '/presignup.html';
  if (!path.extname(filePath)) filePath += '.html';

  // css/js/images + sw.js/manifest.json live in the project root; pages live in /public
  const isAsset = ['/css/', '/js/', '/images/'].some(d => filePath.startsWith(d))
               || ['/sw.js', '/manifest.json'].includes(filePath);
  const baseDir  = isAsset ? __dirname : path.join(__dirname, 'public');
  const fullPath = path.normalize(path.join(baseDir, filePath));

  // Block ../ path traversal (the ONLY access check needed)
  if (!fullPath.startsWith(baseDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  const mimeType = MIME[path.extname(fullPath)] || 'application/octet-stream';

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: ' + filePath);
    } else {
      res.writeHead(200, {
        'Content-Type':  mimeType,
        'Cache-Control': 'no-store',   // dev only: avoid stale files
      });
      res.end(data);
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  ✅ Fixia local server running!');
  console.log('');
  console.log('  🌐 http://localhost:' + PORT);
  console.log('  📡 API calls proxied to: ' + VERCEL_URL);
  console.log('');
});
