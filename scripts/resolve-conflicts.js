// node scripts/resolve-conflicts.js
// Keeps the HEAD side of every merge conflict, deletes the other side and the markers.
const fs = require('fs'), path = require('path');
const SKIP = new Set(['node_modules', '.git', 'android', 'www']);
const EXT  = /\.(html|js|json|css|md|yml|bat)$/i;
const RE   = /^<<<<<<< [^\r\n]*\r?\n([\s\S]*?)^=======\r?\n[\s\S]*?^>>>>>>> [^\r\n]*(?:\r?\n|$)/gm;

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    if (SKIP.has(f)) continue;
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { walk(p); continue; }
    if (!EXT.test(f)) continue;
    const s = fs.readFileSync(p, 'utf8');
    if (!/^<<<<<<< /m.test(s)) continue;
    const out = s.replace(RE, '$1');
    fs.writeFileSync(p, out);
    console.log('fixed', p, (s.match(/^<<<<<<< /gm) || []).length, 'conflict(s)');
  }
}
walk('.');