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
