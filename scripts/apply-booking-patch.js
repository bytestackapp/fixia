// node scripts/apply-booking-patch.js   (run from project root, safe to run twice)
const fs = require('fs');
const add = (file, tag, marker) => {
  if (!fs.existsSync(file)) return console.log('missing  ', file);
  let s = fs.readFileSync(file, 'utf8');
  if (s.includes(marker)) return console.log('already  ', file);
  const i = s.lastIndexOf('</body>');
  if (i < 0) return console.log('no </body>', file);
  fs.writeFileSync(file, s.slice(0, i) + tag + '\n' + s.slice(i));
  console.log('patched  ', file);
};
add('public/provider.html',      '<script src="js/page-booking.js"></script>', 'page-booking.js');
add('public/notifications.html', '<script src="js/page-booking.js"></script>', 'page-booking.js');

const boot = 'js/fx-boot.js';
let b = fs.readFileSync(boot, 'utf8');
if (b.includes('fx-messages.js')) console.log('already   ' + boot);
else { fs.appendFileSync(boot, "\n;(function(){var s=document.createElement('script');s.src='/js/fx-messages.js';s.async=false;document.head.appendChild(s);})();\n"); console.log('patched  ', boot); }

const sw = 'sw.js';
let w = fs.readFileSync(sw, 'utf8');
w = w.replace(/const CACHE_VERSION = 'v([\d.]+)'/, (m, v) => { const p = v.split('.'); p[2] = +p[2] + 1; return `const CACHE_VERSION = 'v${p.join('.')}'`; });
fs.writeFileSync(sw, w); console.log('bumped    sw.js cache version');
