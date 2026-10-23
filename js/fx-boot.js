/* Load right AFTER fixia-data.js. 1) API base for the APK  2) read-through cache (fewer DB calls)  3) polling helper */
(function(){'use strict';
const ENV=window.FX_ENV||{};
/* 1 ── in the APK, '/api/…' must hit the Vercel domain */
if(ENV.API_BASE){const f=window.fetch.bind(window);window.fetch=(u,o)=>f(typeof u==='string'&&u.startsWith('/api/')?ENV.API_BASE+u:u,o);}

/* 2 ── stale-while-revalidate cache for PUBLIC read-only tables (TTL seconds) */
const RULES=[[/^packages\?/,600],[/^app_settings\?/,120],[/^ads\?/,120],[/^listings\?/,60],[/^ratings\?/,60],[/^provider_active_booking_counts/,30],[/^providers\?status=eq\.approved/,60]];
const PFX='fxc1:',mem=new Map(),pend=new Map(),memos=[];
const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)));
const ls=()=>Object.keys(localStorage).filter(k=>k.startsWith(PFX));
const read=k=>{let e=mem.get(k);if(!e){try{e=JSON.parse(localStorage.getItem(PFX+k));}catch(_){}if(e)mem.set(k,e);}return e;};
const write=(k,v)=>{const e={t:Date.now(),v};mem.set(k,e);try{localStorage.setItem(PFX+k,JSON.stringify(e));}catch(_){ls().forEach(x=>localStorage.removeItem(x));}};
const drop=t=>{[...mem.keys()].forEach(k=>k.startsWith(t)&&mem.delete(k));ls().forEach(k=>k.startsWith(PFX+t)&&localStorage.removeItem(k));memos.forEach(m=>m.clear());};
const clearAll=()=>{mem.clear();ls().forEach(k=>localStorage.removeItem(k));memos.forEach(m=>m.clear());};
const origSb=window.sbFetch;
const load=(p,o)=>pend.get(p)||(pend.set(p,origSb(p,o).then(v=>(write(p,v),v)).finally(()=>pend.delete(p))),pend.get(p));
window.sbFetch=function(path,opts={}){
  const m=(opts.method||'GET').toUpperCase();
  if(m!=='GET'){const r=origSb(path,opts);r.then(()=>drop(path.split(/[?/]/)[0]),()=>{});return r;}
  const rule=RULES.find(r=>r[0].test(path));
  if(!rule||path.includes('featured_impressions')||path.includes('session_token'))return origSb(path,opts);
  const e=read(path),age=e?(Date.now()-e.t)/1e3:Infinity;
  if(age<rule[1])return Promise.resolve(clone(e.v));
  if(e){load(path,opts).catch(()=>{});return Promise.resolve(clone(e.v));}   // stale → instant, refresh behind
  return load(path,opts).then(v=>clone(v));
};
const origApi=window.apiFetch;                       // any write through /api/db invalidates everything
window.apiFetch=(...a)=>origApi(...a).then(r=>(clearAll(),r));
const origLogout=FX.logout.bind(FX);FX.logout=()=>{clearAll();return origLogout();};

/* memoise a lookup that is hit by every badge refresh */
const memo=(fn,ttl=20000)=>{const c=new Map();memos.push(c);return function(a){const h=c.get(a);if(h&&Date.now()-h.t<ttl)return h.p;const p=fn.call(this,a);c.set(a,{t:Date.now(),p});p.catch(()=>c.delete(a));return p;};};
FX.getProviderByUserId=memo(FX.getProviderByUserId);
FX.getUserById=memo(FX.getUserById,5000);          // profile pages called this 4-8× per load; any write clears it
FX.getProviderById=memo(FX.getProviderById,5000);

/* all app settings in ONE call (was one call per key, 5-8 per page) */
FX.getSetting=async k=>{const rows=await sbFetch('app_settings?select=key,value');return (rows||[]).find(r=>r.key===k)?.value??null;};
/* initAds ran twice per page (auto + explicit) */
{const oi=FX.initAds.bind(FX);let ip;FX.initAds=()=>ip||(ip=oi());}

/* storage deletes now need the session headers (endpoint is authenticated) */
window.sbDelete=async u=>{try{if(!u)return;const s=FX.getSession()||{};await fetch('/api/delete-storage-file',{method:'POST',headers:{'Content-Type':'application/json','x-session-token':s.sessionToken||'','x-user-id':s.userId||''},body:JSON.stringify({publicUrl:u})});}catch(e){console.warn(e);}};

/* password reset via server (browser can no longer read reset tokens) */
const pr=b=>fetch('/api/password-reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
FX.sendPasswordReset=async email=>{await pr({action:'request',email});};
FX.validateResetToken=async token=>{const d=await (await pr({action:'validate',token})).json();return d.valid?{ok:true}:null;};
FX.consumeResetToken=async(token,password)=>{const r=await pr({action:'confirm',token,password});const d=await r.json();if(!r.ok)throw new Error(d.error||'Invalid or expired reset link.');};

/* faster first request */
if(ENV.SUPA_URL){const l=document.createElement('link');l.rel='preconnect';l.href=ENV.SUPA_URL;document.head.appendChild(l);}

/* 3 ── polling that sleeps while the app is in the background and refreshes on return */
FX.every=(fn,ms)=>{setInterval(()=>{if(!document.hidden)fn();},ms);document.addEventListener('visibilitychange',()=>{if(!document.hidden)fn();});};
})();

/* ── Emoji → SVG icons ── */
(function(){'use strict';
const I={
wrench:['M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.7 2.7-2.3-.7-.7-2.3z','','🔧🛠'],
search:['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3','','🔍🔎'],
party:['M4 20l4-12 8 8zM14 4v2M19 9h2M18 5l1.5-1.5M10 4l.5 1.5','','🎉'],
hourglass:['M6 3h12M6 21h12M7 3v4l5 5-5 5v4M17 3v4l-5 5 5 5v4','','⏳'],
warn:['M12 3 2 21h20zM12 10v5M12 18v.01','#F59E0B','⚠'],
ok:['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 12l3 3 5-6','#10B981','✅'],
check:['M20 6 9 17l-5-5','#10B981','✔'],
no:['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9 9l6 6M15 9l-6 6','#DC3545','❌'],
ban:['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM5 5l14 14','#DC3545','🚫⛔'],
crown:['M3 18h18M4 18 3 7l5 4 4-7 4 7 5-4-1 11','#F59E0B','👑'],
star:['M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21 7 14.2l-5-4.9 6.9-1z','#F59E0B','⭐🌟','f'],
card:['M2 6h20v12H2zM2 10h20M6 15h4','','💳'],
clip:['M9 3h6v3H9zM7 5H5v16h14V5h-2M9 11h6M9 15h6','','📋'],
send:['M22 2 11 13M22 2l-7 20-4-9-9-4z','','📤'],
mail:['M3 5h18v14H3zM3 6l9 7 9-7','','📩📧'],
inbox:['M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5','','📥📭'],
box:['M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8','','📦'],
gift:['M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8c-2 0-4-1-4-3a2 2 0 0 1 4 0zM12 8c2 0 4-1 4-3a2 2 0 0 0-4 0z','','🎁'],
rocket:['M5 19c-1 0-2-1-2-2 0-2 2-3 3-3l3 3c0 1-1 3-3 3zM9 15l-3-3 6-8c3-2 7-2 9-2 0 2 0 6-2 9l-8 6zM15 9h.01','','🚀'],
house:['M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z','','🏠🏢'],
car:['M4 16v-4l2-5h12l2 5v4zM4 16v3M20 16v3M7 12h10','','🚗'],
leaf:['M5 19C5 10 11 4 20 4c0 9-6 15-15 15zM5 19l8-8','','🌿🌱'],
bolt:['M13 2 4 14h7l-1 8 9-12h-7z','','⚡'],
scissors:['M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.1 7.9 20 20M8.1 16.1 20 4','','💇✂'],
steth:['M6 3v6a4 4 0 0 0 8 0V3M10 13v2a5 5 0 0 0 10 0v-2M20 11a2 2 0 1 0 0 4 2 2 0 0 0 0-4z','','🩺'],
laptop:['M4 5h16v11H4zM2 20h20','','💻'],
phone:['M7 2h10v20H7zM11 18h2','','📱'],
hammer:['M14 4l6 6-2.5 2.5-6-6zM12 9 3 18l3 3 9-9','','🔨🏗'],
broom:['M14 3l7 7M13 7l4 4-6 6H5v-6zM5 17l-2 4h5','','🧹'],
paw:['M7 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM10 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM14 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 12c-3 0-6 3-6 6 0 2 2 2 6 2s6 0 6-2c0-3-3-6-6-6z','','🐾'],
book:['M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h8','','📚'],
bell:['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0','','🔔'],
bookmark:['M6 3h12v18l-6-4-6 4z','','🔖'],
user:['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0','','👤🙂'],
users:['M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 3.5a4 4 0 0 1 0 7M22 21a7 7 0 0 0-4-6','','👥'],
chart:['M4 20V10M10 20V4M16 20v-8M22 20H2','','📊📈'],
mega:['M3 11v2a2 2 0 0 0 2 2h1l3.5 5V4L6 9H5a2 2 0 0 0-2 2zM13 8.5v7a4 4 0 0 0 4-1v-5a4 4 0 0 0-4-1z','','📢📣'],
lock:['M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4','','🔒🔐'],
key:['M7 20a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM10 13l11-11M17 6l3 3','','🔑'],
flag:['M5 22V4M5 4h12l-2 4 2 4H5','','🏁🚩'],
undo:['M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3','','↩'],
trash:['M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3','','🗑'],
globe:['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20','','🌐'],
repeat:['M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3','','🔁🔄'],
wave:['M2 8c3-3 5 3 8 0s5 3 8 0 3 0 4 0M2 15c3-3 5 3 8 0s5 3 8 0 3 0 4 0','','🌊'],
cursor:['M5 3l14 8-6 2-2 6z','','🖱'],
eye:['M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z','','👁'],
bulb:['M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z','','💡'],
coin:['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6v2M12 16v2','','💰💵'],
pin:['M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z','','📍'],
cal:['M4 5h16v16H4zM4 10h16M8 3v4M16 3v4','','📅'],
note:['M5 3h10l4 4v14H5zM15 3v4h4M8 12h8M8 16h8','','📝'],
trophy:['M8 4h8v6a4 4 0 0 1-8 0zM8 6H4v2a3 3 0 0 0 4 3M16 6h4v2a3 3 0 0 1-4 3M12 14v4M8 21h8M10 18h4','','🏆'],
folder:['M3 6h6l2 2h10v12H3z','','🗂📁'],
sad:['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 16c1-1.5 2.5-2 4-2s3 .5 4 2M9 9.5h.01M15 9.5h.01','','😕'],
hat:['M4 17a8 8 0 0 1 16 0zM3 17h18v3H3zM12 6v5','','👷'],
snow:['M12 2v20M3.3 7l17.4 10M20.7 7 3.3 17','','❄'],
palette:['M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2-.6-1.2.2-2.5 1.5-2.5H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3zM7.5 11h.01M10 7h.01M15 7h.01','','🎨'],
id:['M3 5h18v14H3zM13 9h5M13 13h5M5 16c.5-2 3.5-2 4 0','','🪪'],
up:['M12 19V5M5 12l7-7 7 7','','⬆'],
play:['M6 4l14 8-14 8z','','▶'],
image:['M3 4h18v16H3zM3 16l5-5 5 5 3-3 5 5M9 9h.01','','🖼'],
hand:['M8 12V5a1.5 1.5 0 0 1 3 0v6M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V6a1.5 1.5 0 0 1 3 0v8c0 4-2 7-6 7-3 0-5-2-6-5l-1-4a1.5 1.5 0 0 1 3 0z','','👋'],
spark:['M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z','','✨'],
stop:['M8 2h8l6 6v8l-6 6H8l-6-6V8z','#DC3545','🛑'],
msg:['M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z','','💬'],
call:['M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z','','📞'],
dotB:['M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z','#3B82F6','🔵','f'],
dotO:['M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z','#FF5A1F','🟠','f'],
dotP:['M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z','#7C3AED','🟣','f']
};
const EM={};for(const n in I)for(const ch of Array.from(I[n][2]))EM[ch]=n;
const keys=Object.keys(EM).sort((a,b)=>b.length-a.length).join('|');
const PEOPLE='[\\u{1F468}\\u{1F469}][\\u{1F3FB}-\\u{1F3FF}]?(?:\\u200D\\p{Extended_Pictographic}[\\u{1F3FB}-\\u{1F3FF}]?\\uFE0F?)*';
const src='('+PEOPLE+'|'+keys+')\\uFE0F?';
const RX=new RegExp(src,'u'), RXG=new RegExp(src,'gu');
const SKIP=/^(SCRIPT|STYLE|TEXTAREA|INPUT|OPTION|TITLE|NOSCRIPT)$/;
const st=document.createElement('style');
st.textContent='.fxi{display:inline-flex;width:1.1em;height:1.1em;vertical-align:-.18em;flex-shrink:0}.fxi svg{width:100%;height:100%}';
document.head.appendChild(st);
function mk(n){const d=I[n],c=d[1]||'currentColor',s=document.createElement('span');
  s.className='fxi';s.setAttribute('aria-hidden','true');
  s.innerHTML='<svg viewBox="0 0 24 24" fill="'+(d[3]?c:'none')+'" stroke="'+c+'" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="'+d[0]+'"/></svg>';return s;}
function swap(t){const s=t.nodeValue,f=document.createDocumentFragment();let i=0,m;RXG.lastIndex=0;
  while((m=RXG.exec(s))){const k=m[1].replace(/\uFE0F/g,'');const n=EM[k]||'user';
    if(m.index>i)f.append(s.slice(i,m.index));f.append(mk(n));i=RXG.lastIndex;}
  if(i<s.length)f.append(s.slice(i));t.replaceWith(f);}
function scan(root){const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),list=[];let n;
  while((n=w.nextNode()))if(!SKIP.test(n.parentNode.nodeName)&&RX.test(n.nodeValue))list.push(n);
  list.forEach(swap);}
scan(document.body);
new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{
  if(n.nodeType===3){if(!SKIP.test(n.parentNode.nodeName)&&RX.test(n.nodeValue))swap(n);}
  else if(n.nodeType===1)scan(n);
}))).observe(document.documentElement,{childList:true,subtree:true});
})();
