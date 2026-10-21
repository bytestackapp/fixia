const fs=require('fs');const e=process.env;
fs.mkdirSync('www/js',{recursive:true});
fs.writeFileSync('www/js/env-config.js','window.FX_ENV='+JSON.stringify({SUPA_URL:e.SUPABASE_URL,SUPA_KEY:e.SUPABASE_ANON_KEY,API_BASE:e.API_BASE,SITE_URL: e.SITE_URL || 'https://onecoreapp.vercel.app',NATIVE:true})+';');
console.log('env-config.js written');
