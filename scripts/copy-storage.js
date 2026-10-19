// OLD_URL=… OLD_KEY=<service> NEW_URL=… NEW_KEY=<service> node scripts/copy-storage.js
const {createClient}=require('@supabase/supabase-js');const e=process.env;
const a=createClient(e.OLD_URL,e.OLD_KEY),b=createClient(e.NEW_URL,e.NEW_KEY);
const BUCKETS=['fixia-avatars','fixia-ids','fixia-portfolio','fixia-requests'];
async function walk(bk,pre=''){const{data}=await a.storage.from(bk).list(pre,{limit:1000});let out=[];
  for(const x of data||[]) x.id?out.push(pre+x.name):out.push(...await walk(bk,pre+x.name+'/'));return out;}
(async()=>{for(const bk of BUCKETS){await b.storage.createBucket(bk,{public:true}).catch(()=>{});
  const files=await walk(bk);console.log(bk,files.length,'files');
  for(const f of files){const{data,error}=await a.storage.from(bk).download(f);if(error){console.log('skip',f);continue;}
    await b.storage.from(bk).upload(f,data,{upsert:true,contentType:data.type});}}console.log('done');})();
