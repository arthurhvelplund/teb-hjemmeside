// HTTP integration smoke test. UI/browser acceptance belongs to the site owner.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { get } from 'node:http';
import { createServer } from 'node:net';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const socket=createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(r=>socket.close(r));
const runtime=await mkdtemp(join(tmpdir(),'teb-http-')),origin='http://localhost:'+port;
const env={...process.env,PORT:String(port),CALENDAR_DATA_DIR:runtime,CALENDAR_ORIGIN:origin};
const service=spawn(process.execPath,['scripts/dev.mjs'],{cwd:new URL('../',import.meta.url),env,stdio:['ignore','pipe','pipe']});let errors='';service.stderr.on('data',s=>errors+=s);
try{
 let ready=false;for(let i=0;i<60;i++){try{if((await fetch(origin+'/api/kalender/config')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,'Dev server failed to start: '+errors);
 const root=await fetch(origin+'/');assert.equal(root.status,200);assert.equal(root.redirected,false);assert.equal(await root.text(),await readFile(new URL('../../site/index.html',import.meta.url),'utf8'));assert.equal(root.headers.get('X-Robots-Tag'),null);
 const externalHost=await new Promise((resolve,reject)=>{get(origin+'/api/kalender/local-mail',{headers:{Host:'public.example.test'}},r=>{r.resume();resolve(r.statusCode);}).on('error',reject);});assert.equal(externalHost,403);
 const seed=async()=>{const child=spawn(process.execPath,['scripts/seed.mjs'],{cwd:new URL('../',import.meta.url),env,stdio:['ignore','pipe','pipe']});let output='';child.stderr.on('data',s=>output+=s);const [code]=await once(child,'exit');assert.equal(code,0,output);};
 await seed();await seed();
 let cookie='';
 const api=async(path,data)=>{
  const r=await fetch(origin+'/api/kalender'+path,{headers:{...(data?{'Content-Type':'application/json',Origin:origin}:{}),...(cookie?{Cookie:cookie}:{})},...(data?{method:'POST',body:JSON.stringify(data)}:{})});assert.ok(r.ok,await r.clone().text());if(r.headers.get('Set-Cookie'))cookie=r.headers.get('Set-Cookie').split(';')[0];return r.json();
 };
 async function login(email){const challenge=await api('/auth/request',{email});const {messages}=await api('/local-mail');const message=messages.find(m=>m.recipient===email&&m.subject==='Din engangskode til TEB');const code=message.body.match(/\b\d{6}\b/)[0];return api('/auth/verify',{challengeId:challenge.challengeId,code});}
 const publicBefore=await api('/events');assert.equal(publicBefore.events.length,8);
 await login('teb-admin@example.test');const {events}=await api('/admin/events'),pending=events.find(e=>e.pendingKind==='new');assert.ok(pending);
 await api('/admin/events/'+pending.id,{action:'approve',revision:pending.revision});assert.equal((await api('/events')).events.length,9);
 const association=(await api('/associations')).associations[0],adminCookie=cookie;
 const member=await login('redaktor@example.test');assert.equal(member.memberships[0].role,'editor');
 await api('/associations/'+association.id,{association:{...association,description:'Opdateret via den lokale API-test'},revision:association.revision});
 const own=(await api('/me/events')).events[0];await api('/member/events/'+own.id,{action:'cancel',revision:own.revision});
 assert.equal((await api('/events/'+own.id)).event.state,'cancelled');
 cookie=adminCookie;const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Copenhagen',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const edition=await api('/admin/editions',{start:publicBefore.events[0].date.slice(0,7)+'-01',end:publicBefore.events[0].date.slice(0,7)+'-28',deadline:today,format:'a3',requestKey:crypto.randomUUID()});
 const a=new Uint8Array(await (await fetch(origin+'/api/kalender/editions/'+edition.id+'/pdf')).arrayBuffer());assert.equal(new TextDecoder().decode(a.slice(0,5)),'%PDF-');
 const b=new Uint8Array(await (await fetch(origin+'/api/kalender/editions/'+edition.id+'/pdf')).arrayBuffer());assert.deepEqual(a,b);
 console.log('HTTP integration passed: root index, Host restriction, repeatable fictional seed, local OTP for admin/member, guest approval, member edit/cancellation and stored PDF. No external mail sent.');
}finally{
 const exited=once(service,'exit');service.kill('SIGTERM');await exited;await rm(runtime,{recursive:true,force:true});
}
