// node scripts/restructure.js — moves css/images/js out of /public and fixes references
const fs = require('fs'), path = require('path');

function moveDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) {
    const s = path.join(from, f), d = path.join(to, f);
    if (fs.statSync(s).isDirectory()) { moveDir(s, d); continue; }
    if (fs.existsSync(d)) { console.log('skip (already exists):', d); continue; }
    fs.renameSync(s, d);
  }
  if (!fs.readdirSync(from).length) fs.rmdirSync(from);
}
function moveFile(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (fs.existsSync(to)) { console.log('skip (already exists):', to); return; }
  fs.renameSync(from, to);
}
function patch(file, pairs) {
  if (!fs.existsSync(file)) return;
  let s = fs.readFileSync(file, 'utf8'); const o = s;
  for (const [a, b] of pairs) s = s.split(a).join(b);
  if (s !== o) { fs.writeFileSync(file, s); console.log('patched', file); }
}

/* 1 ── move folders / files */
moveDir('public/css',    'css');
moveDir('public/images', 'images');
moveDir('public/js',     'js');
moveFile('public/env-config.js',  'js/env-config.js');
moveFile('public/fixia-data.js',  'js/fixia-data.js');

/* 2 ── fix <script> paths in every page */
for (const f of fs.readdirSync('public').filter(x => x.endsWith('.html'))) {
  patch(path.join('public', f), [
    ['src="env-config.js"',  'src="js/env-config.js"'],
    ['src="fixia-data.js"',  'src="js/fixia-data.js"'],
    ['/public/images/',      '/images/'],            // PWA toast icon in login.html
  ]);
}

/* 3 ── other files that point at the old locations */
patch('sw.js', [
  ["'/fixia-data.js','/env-config.js'", "'/js/fixia-data.js','/js/env-config.js'"],
  ["'v2.0.0'", "'v2.0.1'"],                          // bump so old caches are dropped
]);
patch('api/send-push.js', [['/public/images/', '/images/']]);
patch('scripts/build-icons.js', [["'public/css", "'css"]]);
patch('scripts/generate-env.js', [
  ["fs.mkdirSync('www',",   "fs.mkdirSync('www/js',"],
  ["'www/env-config.js'",   "'www/js/env-config.js'"],
]);
patch('.github/workflows/build-android.yml', [
  ['mkdir -p www && cp -r public/. www/', 'mkdir -p www && cp -r public/. www/ && cp -r css images js www/'],
]);
patch('git-push.bat', [
  ['public\\js\\version.js',  'js\\version.js'],
  ['public\\css\\fixia.css',  'css\\fixia.css'],
]);

console.log('\nDone. Now update vercel.json and server.js, then test locally.');