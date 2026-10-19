/*
 * ═══════════════════════════════════════════════════════════════
 *  FIXIA — Service Marketplace
 *  Local Development Server
 *  © ByteStack Labs 2025. All Rights Reserved.
 * ═══════════════════════════════════════════════════════════════
 *
 *  - Serves static files from /public
 *  - Proxies /api/* calls to your live Vercel deployment
 *  - Run via fixia.bat or: node server.js
 * ═══════════════════════════════════════════════════════════════
 */

const http      = require('http');
const https     = require('https');
const fs        = require('fs');
const path      = require('path');
const url       = require('url');

const PORT       = 3200;
const VERCEL_URL = 'https://gofixia.vercel.app'; // your live Vercel URL

// MIME types for static files
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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
          ...(req.headers.authorization       ? { 'Authorization':    req.headers.authorization } : {}),
          ...(req.headers['x-session-token']  ? { 'x-session-token':  req.headers['x-session-token'] } : {}),
          ...(req.headers['x-user-id']        ? { 'x-user-id':        req.headers['x-user-id'] } : {}),
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

  // ── SERVE STATIC FILES from /public ─────────────────────────
  let filePath = reqPath;

  // Root → homepage
  if (filePath === '/') filePath = '/presignup.html';

  // No extension → try .html
  if (!path.extname(filePath)) filePath += '.html';

  const fullPath = path.join(__dirname, 'public', filePath);
  const ext      = path.extname(fullPath);
  const mimeType = MIME[ext] || 'application/octet-stream';

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      // Try without /public prefix (for files in root like sw.js, manifest.json)
      const rootPath = path.join(__dirname, filePath);
      fs.readFile(rootPath, (err2, data2) => {
        if (err2) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found: ' + filePath);
        } else {
          res.writeHead(200, { 'Content-Type': mimeType });
          res.end(data2);
        }
      });
    } else {
      res.writeHead(200, { 'Content-Type': mimeType });
      res.end(data);
    }
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ✅ Fixia local server running!');
  console.log('');
  console.log('  🌐 http://localhost:' + PORT);
  console.log('  📡 API calls proxied to: ' + VERCEL_URL);
  console.log('');
});
