// node scripts\apply-audit-fixes.js — text patches for bugs/XSS found in the audit. Safe to re-run; prints "NOT FOUND" if a snippet has changed.
const fs=require('fs');
const P=[]; const add=(f,a,b,all=true)=>P.push({f,a,b,all});
// ── security: XSS ──
add('public/homepage.html','alt="${p.biz_name}"','alt="${esc(p.biz_name)}"');
add('public/homepage.html','src="${p.avatar_url}"','src="${esc(p.avatar_url)}"');
add('public/saved.html','alt="${p.bizName}"','alt="${esc(p.bizName)}"');
add('public/saved.html','${p.bizName}</div>','${esc(p.bizName)}</div>');
add('public/profile.html','<div class="lc-title">${l.title}</div>','<div class="lc-title">${esc(l.title)}</div>');
add('public/profile.html',"<div class=\"lc-desc\">${l.description || ''}</div>","<div class=\"lc-desc\">${esc(l.description || '')}</div>");
add('public/profile.html',"const displayName = r.display_name || 'Anonymous';","const displayName = esc(r.display_name || 'Anonymous');");
add('public/profile.html',"${r.comment || '<em style=\"color:var(--text-3);\">No comment left.</em>'}","${r.comment ? esc(r.comment) : '<em style=\"color:var(--text-3);\">No comment left.</em>'}");
add('public/admin.html',/\$\{(p|r|s|l|t|req|ad)\.(biz_name|provider_name|user_name|subject|title|requested_value|payment_reference|payment_method|other_service_desc|cat_sub|prov_type|advertiser)\}/g,'${esc($1.$2)}');
add('public/admin.html',/\$\{(p|r|ad)\.(biz_name|payment_reference|payment_method|package_name|id_type|description) \|\| '([^']*)'\}/g,"${esc($1.$2 || '$3')}");
add('public/fixia-data.js','data-ad-link="${ad.link_url || \'#\'}"','data-ad-link="${esc(ad.link_url || \'#\')}"');
add('public/fixia-data.js','>${ad.description}</div>','>${esc(ad.description)}</div>');
// ── bugs ──
add('public/admin.html',"document.querySelector('.sidebar-item:nth-child(4))')","null");                       // broken selector → "View All" threw
add('public/admin.html',/streetAddr:\s*document\.getElementById\('provStreetAddr'\)\.value\.trim\(\),/,"streetAddr: (document.getElementById('provStreetAddr').value.trim() || (_providerDataMap[providerId]?.street_addr || '')),"); // was wiping street address
add('public/homepage.html','!hasProvince && !selProv.disabled','!hasProvince && !prov.disabled');            // ReferenceError
add('public/payment-success.html','$${data.amount} USD','₱${data.amount}');                                  // PayPal charges PHP, not USD
add('api/send-email.js',"APP_URL + '/provider.html'","APP_URL + '/profile.html'");                           // provider.html needs ?id=
add('public/signup.html',"window.location.replace('presignup.html');","window.location.replace('presignup.html' + location.search);"); // keep ?ref=
add('public/login.html','/public/images/','images/');
add('api/send-push.js','/public/images/','/images/');
for(const v of ['Pedro','Cruz','pedrocruz','Juan','dela Cruz','juandelacruz','pedro@email.com','09989665522','juan@email.com','09281234567'])
  for(const f of ['public/signup-provider.html','public/signup-regular.html']) add(f,`value="${v}"`,'value=""');   // test data left in the real forms
add('public/fixia-data.js','setInterval(beat, 120000)','setInterval(()=>{ if(!document.hidden) beat(); }, 120000)');
add('public/fixia-data.js','setInterval(checkMessages, 120000)','setInterval(()=>{ if(!document.hidden) checkMessages(); }, 120000)');
add('public/fixia-data.js',/let liveUser;\s*try\s*\{\s*liveUser = await this\.getUserById\(session\.userId\);\s*\} catch\(e\) \{ return; \}/,''); // unused DB call every 2 min
add('public/fixia-data.js','if (window.scrollY === 0) {',"if (window.scrollY === 0 && !e.target.closest('.modal-sheet,.modal-box,.modal-popup,.add-form,.subcat-panel,.sheet,.dp-overlay,.gate-sheet,input,textarea,select')) {"); // pull-to-refresh reloaded the page from inside dialogs
add('public/browse.html',"name:'Personal Trainer'","name:'Personal Training'");
add('public/browse.html',"name:'Home Labs'","name:'Home Laboratory'");
add('public/browse.html',"name:'Med Delivery'","name:'Medicine Delivery'");
add('public/browse.html',"name:'Dental Visit'","name:'Dental (Home Visit)'");
add('public/browse.html',"name:'Vet Visit'","name:'Veterinary (Home Visit)'");
add('public/browse.html',"name:'DJ / Band'","name:'DJ / Live Band'");
add('public/browse.html',"name:'General Repair'","name:'General Auto Repair'");
// ── server ──
add('api/db.js',/const text = await res\.text\(\);\s*return text \? JSON\.parse\(text\) : null;/,"const text = await res.text();\n  if (!res.ok) { let m = 'Database error'; try { m = JSON.parse(text).message || m; } catch(e) {} console.error('[Fixia DB]', res.status, text.slice(0,200)); throw { status: 500, message: m }; }\n  return text ? JSON.parse(text) : null;"); // failed writes used to return {ok:true}
add('api/db.js',/booking_limit:\s+data\.bookingLimit\s+\?\? 5,/,"listing_limit: data.listingLimit ?? 5,\n      booking_limit: data.bookingLimit ?? 5,");   // createPackage dropped listing_limit
add('api/db.js',"const limit = pkg?.listing_limit ?? 0;","const limit = pkg?.listing_limit ?? 5;");
add('api/subscription-cron.js',"if (req.headers.authorization !== `Bearer ${CRON_SECRET}`) {","if (!CRON_SECRET || req.headers.authorization !== `Bearer ${CRON_SECRET}`) {"); // 'Bearer undefined' passed when env missing
add('api/subscription-cron.js',/isProvider \? user\.package_id : 'free'/,"isProvider ? user.package_id : 'regular-free'");
add('api/subscription-cron.js','const SUPA_KEY  = process.env.SUPA_KEY;','const SUPA_KEY  = process.env.SUPA_SERVICE_KEY || process.env.SUPA_KEY;');
for(const f of ['api/send-otp.js','api/auth.js']) add(f,"if (req.method !== 'POST') return res.status(405).end();","if (req.method === 'OPTIONS') return res.status(200).end();\n  if (req.method !== 'POST') return res.status(405).end();"); // APK preflight
add('api/send-otp.js','const SUPA_KEY = process.env.SUPA_KEY;','const SUPA_KEY = process.env.SUPA_SERVICE_KEY || process.env.SUPA_KEY;');
add('api/auth.js',"const { action, password, hash } = req.body;","const { action, password, hash } = req.body || {};\n  if (typeof password === 'string' && password.length > 128) return res.status(400).json({ error: 'Password too long' });");
add('server.js',"server.listen(PORT, () => {","server.listen(PORT, '127.0.0.1', () => {");
add('server.js',"fs.readFile(fullPath, (err, data) => {","if (!fullPath.startsWith(path.join(__dirname, 'public'))) { res.writeHead(403); return res.end('Forbidden'); }\n  fs.readFile(fullPath, (err, data) => {");
add('server.js',"const rootPath = path.join(__dirname, filePath);","const rootPath = ['/sw.js','/manifest.json'].includes(filePath) ? path.join(__dirname, filePath) : path.join(__dirname, '__none__');");
let done=0,miss=0;
for(const {f,a,b,all} of P){ if(!fs.existsSync(f)){console.log('SKIP (no file)',f);continue;}
  let s=fs.readFileSync(f,'utf8'),n;
  if(a instanceof RegExp){n=(s.match(a)||[]).length;s=s.replace(a,b);} else {n=s.split(a).length-1;s=s.split(a).join(b);}
  if(n){fs.writeFileSync(f,s);done++;console.log('ok  ',f,'x'+n);} else {miss++;console.log('NOT FOUND (already fixed?)',f,String(a).slice(0,50));}}
console.log(`\n${done} patches applied, ${miss} not found.`);
