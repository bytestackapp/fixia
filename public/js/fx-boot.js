/* Load right AFTER fixia-data.js. 1) API base for the APK  2) read-through cache (fewer DB calls)  3) polling helper */
(function(){'use strict';
const ENV=window.FX_ENV||{};
/* 1 ── in the APK, '/api/…' must hit the Vercel domain */
if(ENV.API_BASE){const f=window.fetch.bind(window);window.fetch=(u,o)=>f(typeof u==='string'&&u.startsWith('/api/')?ENV.API_BASE+u:u,o);}

/* 2 ── stale-while-revalidate cache for PUBLIC read-only tables (TTL seconds) */
const RULES=[[/^packages\?/,600],[/^app_settings\?/,120],[/^ads\?/,120],[/^listings\?/,60],[/^ratings\?/,60],[/^provider_active_booking_counts/,30],[/^providers\?status=eq\.approved/,60]];
const PFX='fxc1:',mem=new Map(),pend=new Map(),memos=[];
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
  if(age<rule[1])return Promise.resolve(structuredClone(e.v));
  if(e){load(path,opts).catch(()=>{});return Promise.resolve(structuredClone(e.v));}   // stale → instant, refresh behind
  return load(path,opts).then(v=>structuredClone(v));
};
const origApi=window.apiFetch;                       // any write through /api/db invalidates everything
window.apiFetch=(...a)=>origApi(...a).then(r=>(clearAll(),r));
const origLogout=FX.logout.bind(FX);FX.logout=()=>{clearAll();return origLogout();};

/* memoise a lookup that is hit by every badge refresh */
const memo=fn=>{const c=new Map();memos.push(c);return function(a){const h=c.get(a);if(h&&Date.now()-h.t<20000)return h.p;const p=fn.call(this,a);c.set(a,{t:Date.now(),p});p.catch(()=>c.delete(a));return p;};};
FX.getProviderByUserId=memo(FX.getProviderByUserId);

/* 3 ── polling that sleeps while the app is in the background and refreshes on return */
FX.every=(fn,ms)=>{setInterval(()=>{if(!document.hidden)fn();},ms);document.addEventListener('visibilitychange',()=>{if(!document.hidden)fn();});};
})();
