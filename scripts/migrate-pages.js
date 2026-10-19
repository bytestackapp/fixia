// node scripts/migrate-pages.js  — idempotent. Applies the theme + icons + boot script to every page in /public.
const fs=require('fs'),path=require('path');const dir='public';
for(const f of fs.readdirSync(dir).filter(x=>x.endsWith('.html'))){
  const p=path.join(dir,f);let s=fs.readFileSync(p,'utf8');const o=s;
  s=s.replace(/\s*<link[^>]+font-awesome[^>]*>/g,'').replace(/\s*<link[^>]+fonts\.googleapis[^>]*>/g,'');
  if(!s.includes('css/fixia.css'))s=s.replace('</head>','<link rel="stylesheet" href="css/icons.css">\n<link rel="stylesheet" href="css/fixia.css">\n</head>');
  if(!s.includes('env-config.js'))s=s.replace('<script src="fixia-data.js"></script>','<script src="env-config.js"></script>\n<script src="fixia-data.js"></script>\n<script src="js/fx-boot.js"></script>');
  s=s.replace(/setInterval\(refreshNotifBadge,\s*10000\)/g,'FX.every(refreshNotifBadge, 30000)');
  s=s.replace(/content="#0f2027"/g,'content="#ffffff"').replace(/black-translucent/g,'default');
  if(s!==o){fs.writeFileSync(p,s);console.log('updated',f);}
}
const d='public/fixia-data.js';let t=fs.readFileSync(d,'utf8');
t=t.replace(/const SUPA_URL\s*=\s*'[^']*';/,'const SUPA_URL = window.FX_ENV.SUPA_URL;').replace(/const SUPA_KEY\s*=\s*'[^']*';/,'const SUPA_KEY = window.FX_ENV.SUPA_KEY;');
fs.writeFileSync(d,t);console.log('fixia-data.js now reads keys from env-config.js');
