// Real workerd/D1/R2 local runtime. No cloud credentials or external mail.
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { token, copenhagenDate } from '../src/shared.mjs';
const origin='http://localhost:8787';
let newsFetches=0;
const mf=new Miniflare(convertV4MiniflareOptions({name:'calendar',scriptPath:resolve('.wrangler/build/worker.js'),modules:true,compatibilityDate:'2026-09-04',compatibilityFlags:['nodejs_compat'],
 outboundService:async request=>{
  assert.equal(request.url,'https://tistrupnyt.dk/');newsFetches++;
  return new Response('<a class="event frontpage" href="https://tistrupnyt.dk/id/2448700/cykelmotion"><img src="https://ruban.nu/foto/b/cykelmotion.avif"><h1>Tistrup Cykelmotion &amp; fællesskab</h1><h2>Der køres tirsdag</h2></a>',{headers:{'Content-Type':'text/html'}});
 },
 d1Databases:['DB'],r2Buckets:['PDFS'],bindings:{PUBLIC_ORIGIN:origin,LOCAL_PREVIEW:'true',MAIL_ENCRYPTION_KEY:token(),EDITOR_EMAIL:'admin@example.test',EMAIL_FROM:'sender@example.test',TEB_ADMIN_EMAILS:'admin@example.test'},
 serviceBindings:{ASSETS:async request=>new Response(await readFile(new URL('../assets/fonts/'+new URL(request.url).pathname.split('/').at(-1),import.meta.url)))} }));
try{
 const newsUrl=origin+'/api/kalender/nyheder/tistrup-nyt';
 const news=await (await mf.dispatchFetch(newsUrl)).json();
 assert.equal(news.items.length,1);assert.equal(news.items[0].title,'Tistrup Cykelmotion & fællesskab');assert.equal(news.stale,false);
 await mf.dispatchFetch(newsUrl);assert.equal(newsFetches,1);
 assert.ok(await (await mf.getR2Bucket('PDFS')).get('news/tistrup-nyt-v1.json'));
 const db=await mf.getD1Database('DB');
 // db.exec deliberately splits at newlines, so execute whole migration scripts
 // as prepared statements, using the same SQLite parser as the D1 local engine.
 for(const filename of (await readdir(new URL('../migrations/',import.meta.url))).filter(n=>n.endsWith('.sql')).sort()){
  const sql=await readFile(new URL('../migrations/'+filename,import.meta.url),'utf8');
  // Migration statements are separated at semicolons except trigger bodies.
  const statements=[];let buffer='',inTrigger=false;
  for(const line of sql.split('\n')){
   if(line.trim().startsWith('--'))continue;
   if(/^CREATE TRIGGER/.test(line))inTrigger=true;
   buffer+=line+'\n';
   if(inTrigger){if(line.trim()==='END;'){statements.push(buffer);buffer='';inTrigger=false;}}
   else if(line.trim().endsWith(';')){statements.push(buffer);buffer='';}
  }
  for(const statement of statements)await db.prepare(statement).run();
 }
 let cookie='';
 const api=async(path,data)=>{
  const r=await mf.dispatchFetch(origin+'/api/kalender'+path,{headers:{...(data?{'Content-Type':'application/json',Origin:origin}:{}),...(cookie?{Cookie:cookie}:{})},...(data?{method:'POST',body:JSON.stringify(data)}:{})});assert.ok(r.ok,await r.clone().text());if(r.headers.get('Set-Cookie'))cookie=r.headers.get('Set-Cookie').split(';')[0];return r.json();
 };
 async function login(email){const ch=await api('/auth/request',{email});const job=await db.prepare('SELECT id FROM mail_jobs WHERE dedupe_key=?').bind('otp:'+ch.challengeId).first();const {messages}=await api('/local-mail'),code=messages.find(m=>m.id===job.id).body.match(/\b\d{6}\b/)[0];return api('/auth/verify',{challengeId:ch.challengeId,code});}
 await login('admin@example.test');const adminCookie=cookie;
 const a=(await api('/admin/associations',{requestKey:crypto.randomUUID(),association:{name:'Workerd Eksempelforening'}})).association;
 await api('/admin/associations/'+a.id+'/members',{email:'manager@example.test',role:'manager'});const member=await login('manager@example.test');assert.equal(member.memberships[0].role,'manager');
 const next=new Date(copenhagenDate()+'T12:00:00Z');next.setUTCDate(1);next.setUTCMonth(next.getUTCMonth()+1);const month=next.toISOString().slice(0,7);
 const event={title:'Workerd testarrangement',date:month+'-12',time:'18:00',location:'Eksempelhuset',association:a.name};
 const s=await api('/events',{event,associationId:a.id,requestKey:crypto.randomUUID()});assert.equal(s.published,true);
 await api('/member/events/'+s.id,{event:{...event,time:'19:00'},action:'update',revision:1});assert.equal((await api('/events/'+s.id)).event.time,'19:00');
 cookie='';const payload={event,email:'guest@example.test',authorToken:token(),requestKey:crypto.randomUUID(),startedAt:Date.now()-5000};const guest=await api('/events',payload);assert.equal(guest.published,false);
 cookie=adminCookie;await api('/admin/events/'+guest.id,{action:'approve',revision:1});assert.equal((await api('/events')).events.length,2);
 const edition=await api('/admin/editions',{month,deadline:copenhagenDate(),format:'a3',requestKey:crypto.randomUUID()});assert.equal(edition.eventCount,2);
 const pdf=await mf.dispatchFetch(origin+'/api/kalender/editions/'+edition.id+'/pdf');assert.equal(pdf.status,200);assert.equal(new TextDecoder().decode(new Uint8Array(await pdf.arrayBuffer()).slice(0,5)),'%PDF-');
 assert.equal((await db.prepare('SELECT count(*) AS n FROM publications').first()).n,3);
 console.log('Cloudflare local runtime passed: workerd Worker, D1 migrations/triggers/batches, OTP/invitation, direct/member/guest publishing and R2 PDF. No network mail.');
}finally{await mf.dispose();}
