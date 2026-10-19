const fs=require('fs');const e=process.env;
fs.mkdirSync('www',{recursive:true});
fs.writeFileSync('www/env-config.js','window.FX_ENV='+JSON.stringify({SUPA_URL:e.SUPABASE_URL,SUPA_KEY:e.SUPABASE_ANON_KEY,API_BASE:e.API_BASE,NATIVE:true})+';');
console.log('env-config.js written');
