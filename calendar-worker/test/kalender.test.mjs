import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { database } from '../scripts/sqlite.mjs';
import { handleApi } from '../src/api.mjs';
import { token, copenhagenDate, period } from '../src/shared.mjs';
import { makeCalendarPdf } from '../src/pdf.mjs';
import pdfLib from 'pdf-lib/dist/pdf-lib.min.js';
const {PDFDocument}=pdfLib;
const origin='http://localhost:8787';
const next=new Date(copenhagenDate()+'T12:00:00Z');next.setUTCDate(1);next.setUTCMonth(next.getUTCMonth()+1);
const month=next.toISOString().slice(0,7);
const event=(extra={})=>({title:'Fællesspisning og æblekage',association:'Eksempelforeningen',date:month+'-12',time:'18:00',location:'Hodde-Tistrup Hallen',description:'Pris 75 kr. Tilmeld jer senest fredag.',...extra});
function fixture(t){
 const messages=[],DB=database();t.after(()=>DB.close());
 const env={DB,LOCAL_PREVIEW:'true',PUBLIC_ORIGIN:origin,EDITOR_EMAIL:'editor@example.org',EMAIL_FROM:'kalender@example.org',TEB_EMAIL:{async send(message){messages.push(message);return {messageId:'test-only'};}},ASSETS:{async fetch(request){const name=new URL(request.url).pathname.split('/').at(-1);return new Response(await readFile(new URL('../../site/fonts/'+name,import.meta.url)));}}};
 let cookie='';
 const call=(path,{data,authorization,headers={},method}={})=>handleApi(new Request(origin+'/api/kalender'+path,{method:method||(data?'POST':'GET'),headers:{...(data?{'Content-Type':'application/json',Origin:origin}:{}),...(cookie?{Cookie:cookie}:{}),...(authorization?{Authorization:'Bearer '+authorization}:{}),...headers},...(data?{body:JSON.stringify(data)}:{})}),env);
 const submit=async(extra={})=>{const payload={event:event(),email:'sender@example.org',authorToken:token(),requestKey:crypto.randomUUID(),startedAt:Date.now()-5000,...extra};const response=await call('/events',{data:payload});assert.equal(response.status,201);return {...await response.json(),payload};};
 const login=async()=>{let message=messages.findLast(m=>m.to==='editor@example.org'&&m.text.includes('#login='));if(!message){assert.equal((await call('/admin/login',{data:{}})).status,200);message=messages.at(-1);}const loginToken=message.text.match(/#login=([a-f0-9]{64})/)[1];const response=await call('/admin/session',{data:{token:loginToken}});assert.equal(response.status,200);cookie=response.headers.get('Set-Cookie').split(';')[0];return loginToken;};
 const privateEvent=async s=>(await (await call('/private/'+s.id,{authorization:s.payload.authorToken})).json());
 const decide=async(s,action='approve',extra={})=>call('/admin/events/'+s.id,{data:{action,revision:(await privateEvent(s)).revision,...extra}});
 const publicEvents=async()=>(await (await call('/events')).json()).events;
 return {env,messages,call,submit,login,decide,privateEvent,publicEvents};
}
test('nye opslag er private; kontaktmail og adgangsnøgler er aldrig offentlige',async t=>{
 const f=fixture(t),s=await f.submit();assert.deepEqual(await f.publicEvents(),[]);assert.equal((await f.privateEvent(s)).email,'sender@example.org');
 assert.equal((await f.call('/private/'+s.id)).status,404);assert.equal((await f.call('/private/'+s.id,{authorization:token()})).status,404);
 await f.login();assert.equal((await f.decide(s)).status,200);const visible=JSON.stringify(await f.publicEvents());assert.ok(visible.includes(s.payload.event.title));assert.ok(!visible.includes('sender@example.org'));assert.ok(!visible.includes(s.payload.authorToken));assert.ok(!visible.includes('author_hash'));
});
test('gentaget indsendelse opretter ikke dubletter eller ekstra mails',async t=>{
 const f=fixture(t),s=await f.submit(),count=f.messages.length;const replay=await f.call('/events',{data:s.payload});assert.equal(replay.status,200);assert.equal((await replay.json()).id,s.id);assert.equal(f.messages.length,count);
 assert.equal((await f.call('/events',{data:{...s.payload,authorToken:token()}})).status,409);assert.equal((await f.env.DB.prepare('SELECT count(*) AS n FROM events').first()).n,1);
});
test('fremmed origin, spam og ugyldige datoer eller links bliver afvist',async t=>{
 const f=fixture(t),payload={event:event(),email:'sender@example.org',authorToken:token(),requestKey:crypto.randomUUID(),startedAt:Date.now()-5000};
 assert.equal((await f.call('/events',{data:payload,headers:{Origin:'https://foreign.example'}})).status,403);assert.equal((await f.call('/events',{data:{...payload,website:'spam'}})).status,400);
 for(const date of ['2027-02-30','2027-13-01','2027-00-01'])assert.equal((await f.call('/events',{data:{...payload,event:event({date})}})).status,400);
 assert.equal((await f.call('/events',{data:{...payload,event:event({link:'javascript:alert(1)'})}})).status,400);assert.equal((await f.call('/events',{data:{...payload,event:event({time:'25:00'})}})).status,400);
});
test('GET kan ikke godkende; adgangslinket kan kun bruges én gang',async t=>{
 const f=fixture(t),s=await f.submit();assert.equal((await f.decide(s)).status,401);assert.equal((await f.call('/admin/events/'+s.id)).status,404);const loginToken=f.messages[0].text.match(/#login=([a-f0-9]{64})/)[1];assert.equal((await f.call('/admin/session')).status,404);await f.login();assert.deepEqual(await f.publicEvents(),[]);assert.equal((await f.call('/admin/session',{data:{token:loginToken}})).status,401);
});
test('rettelser ændrer først den offentlige kalender efter TEBs godkendelse',async t=>{
 const f=fixture(t),s=await f.submit();await f.login();await f.decide(s);const own=await f.privateEvent(s);
 assert.equal((await f.call('/private/'+s.id,{authorization:s.payload.authorToken,data:{action:'update',event:event({title:'Fællesspisning med nyt tidspunkt',time:'19:00'}),revision:own.revision}})).status,200);
 assert.equal((await f.publicEvents())[0].time,'18:00');assert.equal((await f.privateEvent(s)).pendingKind,'update');assert.equal((await f.decide(s)).status,200);assert.equal((await f.publicEvents())[0].time,'19:00');
});
test('afvist rettelse bevarer den godkendte version og giver en begrundelse',async t=>{
 const f=fixture(t),s=await f.submit();await f.login();await f.decide(s);const own=await f.privateEvent(s);await f.call('/private/'+s.id,{authorization:s.payload.authorToken,data:{action:'update',event:event({time:'20:00'}),revision:own.revision}});
 assert.equal((await f.decide(s,'reject')).status,400);assert.equal((await f.decide(s,'reject',{note:'Kontakt os om tidspunktet.'})).status,200);assert.equal((await f.publicEvents())[0].time,'18:00');assert.equal((await f.privateEvent(s)).note,'Kontakt os om tidspunktet.');
});
test('TEB kan ikke godkende en revision ændret siden gennemgangen',async t=>{
 const f=fixture(t),s=await f.submit();await f.login();const before=await f.privateEvent(s);await f.call('/private/'+s.id,{authorization:s.payload.authorToken,data:{action:'update',event:event({title:'Ny titel'}),revision:before.revision}});
 assert.equal((await f.call('/admin/events/'+s.id,{data:{action:'approve',revision:before.revision}})).status,409);assert.deepEqual(await f.publicEvents(),[]);assert.equal((await f.privateEvent(s)).data.title,'Ny titel');
});
test('aflysning kræver godkendelse og markeres derefter som aflyst',async t=>{
 const f=fixture(t),s=await f.submit();await f.login();await f.decide(s);const own=await f.privateEvent(s);await f.call('/private/'+s.id,{authorization:s.payload.authorToken,data:{action:'cancel',revision:own.revision}});assert.equal((await f.publicEvents())[0].state,'approved');assert.equal((await f.decide(s)).status,200);assert.equal((await f.publicEvents())[0].state,'cancelled');
});
test('mailfejl mister ikke indsendelsen og udløser ikke blind genafsendelse',async t=>{
 const f=fixture(t);f.env.TEB_EMAIL.send=async()=>{throw new Error('test transport unavailable');};const s=await f.submit();assert.equal(s.notificationState,'failed');assert.equal(s.receiptState,'failed');assert.equal((await f.privateEvent(s)).pendingKind,'new');assert.equal((await f.call('/events',{data:s.payload})).status,200);
});
test('afsluttede printudgaver ændres ikke af senere rettelser',async t=>{
 const f=fixture(t),s=await f.submit();await f.login();await f.decide(s);const response=await f.call('/admin/editions',{data:{month,deadline:copenhagenDate()}});assert.equal(response.status,201);const edition=await response.json();const frozen=await f.env.DB.prepare('SELECT data_json FROM editions WHERE id=?').bind(edition.id).first();
 const own=await f.privateEvent(s);await f.call('/private/'+s.id,{authorization:s.payload.authorToken,data:{action:'update',event:event({time:'21:00'}),revision:own.revision}});await f.decide(s);const after=await f.env.DB.prepare('SELECT data_json FROM editions WHERE id=?').bind(edition.id).first();assert.equal(after.data_json,frozen.data_json);assert.equal((await f.publicEvents())[0].time,'21:00');
 const download=await f.call('/editions/'+edition.id+'/pdf');assert.equal(download.status,200);const pdf=await PDFDocument.load(await download.arrayBuffer());assert.equal(pdf.getPageCount(),1);assert.ok(Math.abs(pdf.getPage(0).getWidth()-500*72/25.4)<.1);
});
test('godkendelse efter printfristen erstatter ikke en tidligere godkendt version',async t=>{
 const f=fixture(t),s=await f.submit();await f.login();await f.decide(s);const yesterday=new Date(Date.now()-86400000).toISOString();await f.env.DB.prepare('UPDATE publications SET published_at=?').bind(yesterday).run();const own=await f.privateEvent(s);await f.call('/private/'+s.id,{authorization:s.payload.authorToken,data:{action:'update',event:event({time:'22:00'}),revision:own.revision}});await f.decide(s);
 const response=await f.call('/admin/editions',{data:{month,deadline:copenhagenDate(yesterday)}});assert.equal(response.status,201);const saved=await response.json();const row=await f.env.DB.prepare('SELECT data_json FROM editions WHERE id=?').bind(saved.id).first();assert.equal(JSON.parse(row.data_json).events[0].time,'18:00');
});
test('travle måneder giver flere læsbare sider',async t=>{
 const f=fixture(t),events=Array.from({length:45},(_,i)=>({id:String(i),...event({title:'Arrangement nummer '+(i+1)+' med et langt meningsfuldt navn'}),state:'approved'}));const pdf=await makeCalendarPdf({month,deadline:period(month).deadline,calendarUrl:origin+'/kalender.html',events},f.env);assert.ok(pdf.pages>=3);assert.equal((await PDFDocument.load(pdf.bytes)).getPageCount(),pdf.pages);
});
test('testpostkassen udleveres aldrig uden for lokal drift',async t=>{
 const f=fixture(t);f.env.LOCAL_PREVIEW='false';assert.equal((await f.call('/local-mail')).status,404);f.env.LOCAL_PREVIEW='true';assert.equal((await handleApi(new Request('https://public.example/api/kalender/local-mail'),f.env)).status,404);
});
test('samtidige indsendelser med samme nøgle gemmer ét arrangement og ét mailforløb',async t=>{
 const f=fixture(t),payload={event:event(),email:'sender@example.org',authorToken:token(),requestKey:crypto.randomUUID(),startedAt:Date.now()-5000};
 const responses=await Promise.all([f.call('/events',{data:payload}),f.call('/events',{data:payload})]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,201]);assert.equal((await f.env.DB.prepare('SELECT count(*) AS n FROM events').first()).n,1);assert.equal(f.messages.length,2);
});
test('to redaktørklik kan ikke offentliggøre samme revision to gange',async t=>{
 const f=fixture(t),s=await f.submit();await f.login();
 const responses=await Promise.all([f.call('/admin/events/'+s.id,{data:{action:'approve',revision:1}}),f.call('/admin/events/'+s.id,{data:{action:'approve',revision:1}})]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal((await f.env.DB.prepare('SELECT count(*) AS n FROM publications').first()).n,1);
});
