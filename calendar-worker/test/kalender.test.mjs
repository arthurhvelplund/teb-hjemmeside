import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { database } from '../scripts/sqlite.mjs';
import { localR2 } from '../scripts/r2.mjs';
import { handleApi } from '../src/api.mjs';
import worker from '../src/worker.mjs';
import { token, copenhagenDate, period, hash } from '../src/shared.mjs';
import { makeCalendarPdf } from '../src/pdf.mjs';
import { snapshot, editionOptions } from '../src/editions.mjs';
import { flushMail } from '../src/mail.mjs';
import pdfLib from 'pdf-lib/dist/pdf-lib.min.js';
const { PDFDocument }=pdfLib;
const origin='https://teb.example.test';
const next=new Date(copenhagenDate()+'T12:00:00Z');next.setUTCDate(1);next.setUTCMonth(next.getUTCMonth()+1);
const month=next.toISOString().slice(0,7);
const event=(extra={})=>({title:'Fællesspisning og æblekage',association:'Eksempelforeningen',date:month+'-12',time:'18:00',location:'Eksempelhuset',description:'Opdigtet testarrangement',price:'75 kr.',...extra});
function fixture(t){
 const DB=database(),messages=[];t.after(()=>DB.close());
 const env={DB,PDFS:localR2(),PUBLIC_ORIGIN:origin,MAIL_ENCRYPTION_KEY:token(),TEB_ADMIN_EMAILS:'admin@example.test',EDITOR_EMAIL:'admin@example.test',EMAIL_FROM:'sender@example.test',
  TEB_EMAIL:{async send(message){messages.push(message);return {messageId:crypto.randomUUID()};}},
  ASSETS:{async fetch(request){return new Response(await readFile(new URL('../assets/fonts/'+new URL(request.url).pathname.split('/').at(-1),import.meta.url)));}}};
 function client(){
  let cookie='';const ip=crypto.randomUUID();
  const call=(path,{data,authorization,headers={},method}={})=>handleApi(new Request(env.PUBLIC_ORIGIN+'/api/kalender'+path,{method:method||(data?'POST':'GET'),headers:{'CF-Connecting-IP':ip,...(data?{'Content-Type':'application/json',Origin:env.PUBLIC_ORIGIN}:{}),...(cookie?{Cookie:cookie}:{}),...(authorization?{Authorization:'Bearer '+authorization}:{}),...headers},...(data?{body:JSON.stringify(data)}:{})}),env);
  const request=async email=>{const r=await call('/auth/request',{data:{email}});assert.equal(r.status,200,await r.clone().text());const data=await r.json();const message=messages.findLast(m=>m.to===email);return {...data,code:message?.text.match(/\b\d{6}\b/)[0]};};
  const verify=async challenge=>{const r=await call('/auth/verify',{data:{challengeId:challenge.challengeId,code:challenge.code}});if(r.ok)cookie=r.headers.get('Set-Cookie').split(';')[0];return r;};
  const login=async email=>{const challenge=await request(email),r=await verify(challenge);assert.equal(r.status,200,await r.clone().text());return r.json();};
  return {call,request,verify,login,cookie:()=>cookie};
 }
 const guest=client(),admin=client();
 const submit=async(extra={})=>{const payload={event:event(),email:'guest@example.test',authorToken:token(),requestKey:crypto.randomUUID(),startedAt:Date.now()-5000,...extra};const r=await guest.call('/events',{data:payload});assert.equal(r.status,201,await r.clone().text());return {...await r.json(),payload};};
 const privateEvent=async s=>(await (await guest.call('/private/'+s.id,{authorization:s.payload.authorToken})).json());
 const decide=async(s,action='approve',extra={})=>admin.call('/admin/events/'+s.id,{data:{action,revision:(await privateEvent(s)).revision,...extra}});
 const publicEvents=async(query='')=>(await (await guest.call('/events'+query)).json()).events;
 const association=async(name='Eksempelforeningen')=>{const r=await admin.call('/admin/associations',{data:{requestKey:crypto.randomUUID(),association:{name,chair:'Offentlig Formand',email:'public@example.test'}}});assert.equal(r.status,200,await r.clone().text());return (await r.json()).association;};
 const invite=async(a,email='manager@example.test',role='manager')=>{const r=await admin.call('/admin/associations/'+a.id+'/members',{data:{email,name:'Eksempel Medlem',role}});assert.equal(r.status,200,await r.clone().text());return r.json();};
 const member=async()=>{await admin.login('admin@example.test');const a=await association();await invite(a);const user=client();await user.login('manager@example.test');return {a,user};};
 const memberEvent=async(user,a,extra={})=>{const payload={event:event(),associationId:a.id,requestKey:crypto.randomUUID(),...extra},r=await user.call('/events',{data:payload});assert.equal(r.status,201,await r.clone().text());return {...await r.json(),payload};};
 return {DB,env,messages,client,guest,admin,submit,privateEvent,decide,publicEvents,association,invite,member,memberEvent};
}
const ok=async(response,status=200)=>{assert.equal(response.status,status,await response.clone().text());return response.json();};

test('anonymous session, secret-free OTP responses and secure authenticated session',async t=>{
 const f=fixture(t);assert.deepEqual(await ok(await f.guest.call('/session')),{authenticated:false,user:null,memberships:[]});
 const challenge=await f.guest.request('unknown@example.test');assert.ok(!JSON.stringify(challenge).includes('authorToken'));
 const raw=await f.DB.prepare('SELECT * FROM otp_challenges WHERE id=?').bind(challenge.challengeId).first();assert.notEqual(raw.code_hash,challenge.code);assert.equal(raw.attempts,0);
 const r=await f.guest.verify(challenge);assert.match(r.headers.get('Set-Cookie'),/HttpOnly; SameSite=Strict; Path=\/api\/kalender; Max-Age=28800; Secure/);
 const session=await ok(r);assert.equal(session.authenticated,true);assert.equal(session.user.isAdmin,false);assert.deepEqual(session.memberships,[]);
 assert.equal((await f.guest.call('/admin/events')).status,403);assert.equal((await f.guest.call('/admin/session',{data:{token:token()}})).status,404);
 const api=await f.client().call('/auth/request',{data:{email:'other@example.test'}});const response=await api.json();assert.deepEqual(Object.keys(response).sort(),['challengeId','deliveryState','mode']);
 const jobs=(await f.DB.prepare('SELECT payload FROM mail_jobs').all()).results;assert.ok(jobs.every(j=>!j.payload.includes('@')&&!j.payload.includes(challenge.code)));
});
test('OTP expiry, replay and five failed attempts',async t=>{
 const f=fixture(t),c=f.client(),ch=await c.request('one@example.test');
 await f.DB.prepare('UPDATE otp_challenges SET expires_at=? WHERE id=?').bind(new Date(Date.now()-1000).toISOString(),ch.challengeId).run();assert.equal((await c.verify(ch)).status,401);
 const second=await c.request('two@example.test');for(let i=0;i<5;i++)assert.equal((await c.verify({...second,code:second.code==='000000'?'111111':'000000'})).status,401);
 assert.equal((await c.verify(second)).status,401);assert.equal((await f.DB.prepare('SELECT attempts FROM otp_challenges WHERE id=?').bind(second.challengeId).first()).attempts,5);
 const third=await c.request('three@example.test');assert.equal((await c.verify(third)).status,200);assert.equal((await c.verify(third)).status,401);
});
test('OTP is single-use under concurrent verification',async t=>{
 const f=fixture(t),c=f.client(),ch=await c.request('one@example.test');const results=await Promise.all([c.verify(ch),c.verify(ch)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,401]);assert.equal((await f.DB.prepare('SELECT count(*) AS n FROM sessions').first()).n,1);
});
test('new OTP invalidates older challenges and request/verification limits apply',async t=>{
 const f=fixture(t),c=f.client(),first=await c.request('one@example.test'),second=await c.request('one@example.test');assert.equal((await c.verify(first)).status,401);assert.equal((await c.verify(second)).status,200);
 await c.request('one@example.test');assert.equal((await c.call('/auth/request',{data:{email:'one@example.test'}})).status,429);
 const ch=await c.request('two@example.test');for(let i=0;i<8;i++)await c.verify({...ch,code:'invalid'});assert.equal((await c.verify(ch)).status,429);
});
test('logout and expired sessions immediately stop access',async t=>{
 const f=fixture(t);await f.admin.login('admin@example.test');assert.equal((await f.admin.call('/admin/events')).status,200);await ok(await f.admin.call('/auth/logout',{data:{}}));assert.equal((await f.admin.call('/admin/events')).status,401);
 await f.admin.login('admin@example.test');await f.DB.prepare('UPDATE sessions SET expires_at=?').bind(new Date(Date.now()-1000).toISOString()).run();assert.equal((await f.admin.call('/admin/events')).status,401);
});
test('directory exposes profile contacts, never login memberships; optimistic profile revisions',async t=>{
 const f=fixture(t),{a,user}=await f.member(),other=f.client();await other.login('other@example.test');
 const directory=await ok(await f.guest.call('/associations'));assert.equal(directory.associations[0].email,'public@example.test');assert.ok(!JSON.stringify(directory).includes('manager@example.test'));
 assert.equal((await other.call('/associations/'+a.id+'/members')).status,403);assert.equal((await f.guest.call('/associations/'+a.id,{data:{association:a,revision:1}})).status,401);
 const changed=await ok(await user.call('/associations/'+a.id,{data:{association:{...a,description:'Opdateret'},revision:1}}));assert.equal(changed.association.revision,2);
 assert.equal((await user.call('/associations/'+a.id,{data:{association:a,revision:1}})).status,409);
 const s=await ok(await user.call('/session'));assert.equal(s.memberships[0].association.id,a.id);assert.equal(s.memberships[0].associationId,a.id);assert.equal(s.memberships[0].role,'manager');
});
test('association creation retries and concurrent requests create one directory entry',async t=>{
 const f=fixture(t);await f.admin.login('admin@example.test');
 const payload={association:{name:' Retry Forening ',email:' PUBLIC@example.test ',website:'https://example.test'},requestKey:crypto.randomUUID()};
 const responses=await Promise.all([f.admin.call('/admin/associations',{data:payload}),f.admin.call('/admin/associations',{data:payload})]);
 const results=await Promise.all(responses.map(r=>ok(r)));assert.equal(results[0].association.id,results[1].association.id);
 assert.equal((await f.DB.prepare('SELECT count(*) AS n FROM associations').first()).n,1);
 const normalized={...payload,association:{name:'Retry Forening',email:'public@example.test',website:'https://example.test/'}};
 assert.equal((await ok(await f.admin.call('/admin/associations',{data:normalized}))).association.id,results[0].association.id);
 const original=results[0].association;
 await ok(await f.admin.call('/associations/'+original.id,{data:{association:{...original,name:'Senere rettet navn'},revision:original.revision}}));
 const replay=await ok(await f.admin.call('/admin/associations',{data:payload}));assert.equal(replay.association.id,original.id);assert.equal(replay.association.name,'Senere rettet navn');
 assert.equal((await f.admin.call('/admin/associations',{data:{...payload,association:{...payload.association,name:'Anden forening'}}})).status,409);
 assert.equal((await f.admin.call('/admin/associations',{data:{association:payload.association}})).status,400);
 assert.equal((await f.DB.prepare('SELECT count(*) AS n FROM associations').first()).n,1);
});
test('association creation retry keys belong to one administrator and revoked access stops retries',async t=>{
 const f=fixture(t);await f.admin.login('admin@example.test');const payload={association:{name:'Beskyttet oprettelse'},requestKey:crypto.randomUUID()};
 await ok(await f.admin.call('/admin/associations',{data:payload}));
 f.env.TEB_ADMIN_EMAILS+=',second-admin@example.test';const second=f.client();await second.login('second-admin@example.test');
 assert.equal((await second.call('/admin/associations',{data:payload})).status,409);
 await f.DB.prepare("UPDATE users SET is_admin=0 WHERE email='admin@example.test'").run();
 assert.equal((await f.admin.call('/admin/associations',{data:payload})).status,403);
 assert.equal((await f.DB.prepare('SELECT count(*) AS n FROM associations').first()).n,1);
});
test('association creation checks administrator rights inside the insert',async t=>{
 const f=fixture(t);await f.admin.login('admin@example.test');const real=f.env.DB;
 f.env.DB={...real,prepare(sql){const statement=real.prepare(sql);if(!sql.startsWith('INSERT OR IGNORE INTO associations('))return statement;return {bind(...args){return {run(){real.prepare('UPDATE users SET is_admin=0').run();return statement.bind(...args).run();}};}};}};
 const response=await f.admin.call('/admin/associations',{data:{association:{name:'Skal ikke oprettes'},requestKey:crypto.randomUUID()}});
 assert.equal(response.status,403);assert.equal((await f.DB.prepare('SELECT count(*) AS n FROM associations').first()).n,0);
});
test('invitation requires the same email and a fresh OTP, with no rights from an older session',async t=>{
 const f=fixture(t);await f.admin.login('admin@example.test');const a=await f.association(),c=f.client();await c.login('member@example.test');
 const oldChallenge=await c.request('member@example.test');await f.invite(a,'member@example.test','editor');
 await ok(await c.verify(oldChallenge));assert.deepEqual((await ok(await c.call('/session'))).memberships,[]);
 const wrong=f.client();await wrong.login('wrong@example.test');assert.deepEqual((await ok(await wrong.call('/session'))).memberships,[]);
 await c.login('member@example.test');assert.equal((await ok(await c.call('/session'))).memberships[0].role,'editor');
 const invitation=await f.DB.prepare('SELECT * FROM invitations').first();assert.ok(invitation.accepted_at);assert.equal((await c.verify(oldChallenge)).status,401);
});
test('manager invitations only grant editor, editors cannot invite, expired invitations do not activate',async t=>{
 const f=fixture(t),{a,user}=await f.member();await ok(await user.call('/associations/'+a.id+'/invitations',{data:{email:'editor@example.test',name:'Eksempel',role:'manager'}}));
 const editor=f.client();await editor.login('editor@example.test');assert.equal((await ok(await editor.call('/session'))).memberships[0].role,'editor');
 assert.equal((await editor.call('/associations/'+a.id+'/invitations',{data:{email:'escalate@example.test'}})).status,403);
 assert.equal((await user.call('/admin/associations/'+a.id+'/members',{data:{email:'escalate@example.test',role:'manager'}})).status,403);
 await f.invite(a,'expired@example.test','editor');await f.DB.prepare("UPDATE invitations SET expires_at=? WHERE email='expired@example.test'").bind(new Date(Date.now()-1000).toISOString()).run();const expired=f.client();await expired.login('expired@example.test');assert.deepEqual((await ok(await expired.call('/session'))).memberships,[]);
});
test('revocation blocks existing sessions and cannot be undone by stale OTP',async t=>{
 const f=fixture(t),{a,user}=await f.member();await f.invite(a,'editor@example.test','editor');const editor=f.client(),ch=await editor.request('editor@example.test');
 const members=(await ok(await user.call('/associations/'+a.id+'/members'))).members,target=members.find(m=>m.email==='editor@example.test');
 await ok(await user.call('/associations/'+a.id+'/members/'+target.id+'/revoke',{data:{}}));await editor.verify(ch);assert.deepEqual((await ok(await editor.call('/session'))).memberships,[]);
 await f.invite(a,'editor@example.test','editor');assert.deepEqual((await ok(await editor.call('/session'))).memberships,[]);await editor.login('editor@example.test');
 await ok(await user.call('/associations/'+a.id+'/members/'+target.id+'/revoke',{data:{}}));assert.equal((await editor.call('/associations/'+a.id,{data:{association:a,revision:a.revision}})).status,403);
 const own=members.find(m=>m.role==='manager');assert.equal((await user.call('/associations/'+a.id+'/members/'+own.id+'/revoke',{data:{}})).status,403);
});
test('concurrent invitations create one live invitation and one mail',async t=>{
 const f=fixture(t),{a,user}=await f.member(),before=f.messages.length;
 const responses=await Promise.all([user.call('/associations/'+a.id+'/invitations',{data:{email:'new@example.test'}}),user.call('/associations/'+a.id+'/invitations',{data:{email:'new@example.test'}})]);
 assert.deepEqual(responses.map(r=>r.status),[200,200]);assert.equal(f.messages.length,before+1);assert.equal((await f.DB.prepare("SELECT count(*) AS n FROM invitations WHERE email='new@example.test' AND revoked_at IS NULL").first()).n,1);
});
test('verified access request requires explicit TEB verification, then fresh OTP grants manager',async t=>{
 const f=fixture(t),c=f.client();assert.equal((await c.call('/access-requests',{data:{newAssociationName:'Eksempel',name:'Person'}})).status,401);await c.login('requester@example.test');
 const request=await ok(await c.call('/access-requests',{data:{newAssociationName:'Ny Eksempelforening',name:'Person',roleNote:'Kontakt mig',email:'spoof@example.test'}}),201);
 assert.equal((await ok(await c.call('/me/access-requests'))).requests[0].email,'requester@example.test');
 assert.equal((await c.call('/admin/access-requests/'+request.id,{data:{action:'approve',verified:true}})).status,403);
 await f.admin.login('admin@example.test');assert.equal((await f.admin.call('/admin/access-requests/'+request.id,{data:{action:'approve'}})).status,400);
 const responses=await Promise.all([f.admin.call('/admin/access-requests/'+request.id,{data:{action:'approve',verified:true}}),f.admin.call('/admin/access-requests/'+request.id,{data:{action:'approve',verified:true}})]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
 assert.equal((await f.DB.prepare('SELECT count(*) AS n FROM associations').first()).n,1);assert.equal((await f.DB.prepare('SELECT count(*) AS n FROM invitations').first()).n,1);
 assert.deepEqual((await ok(await c.call('/session'))).memberships,[]);await c.login('requester@example.test');assert.equal((await ok(await c.call('/session'))).memberships[0].role,'manager');
});
test('rejected access and duplicate pending requests grant no membership',async t=>{
 const f=fixture(t),c=f.client();await c.login('requester@example.test');const payload={newAssociationName:'Eksempel',name:'Person'};
 const request=await ok(await c.call('/access-requests',{data:payload}),201),replay=await ok(await c.call('/access-requests',{data:payload}));assert.equal(request.id,replay.id);
 await f.admin.login('admin@example.test');await ok(await f.admin.call('/admin/access-requests/'+request.id,{data:{action:'reject',note:'Kontakt os'}}));assert.equal((await f.DB.prepare('SELECT count(*) AS n FROM memberships').first()).n,0);
});
test('members publish directly with canonical association identity and no author token',async t=>{
 const f=fixture(t),{a,user}=await f.member(),s=await f.memberEvent(user,a,{event:event({association:'Spoofed association'})});assert.equal(s.published,true);assert.equal(s.status,'approved');
 const visible=await f.publicEvents();assert.equal(visible[0].association,a.name);assert.equal(visible[0].associationId,a.id);assert.equal(visible[0].price,'75 kr.');assert.equal(visible[0].state,'approved');
 assert.equal((await ok(await user.call('/me/events'))).events[0].pendingKind,null);assert.equal((await user.call('/private/'+s.id,{authorization:token()})).status,404);
 const replay=await ok(await user.call('/events',{data:s.payload}));assert.equal(replay.id,s.id);assert.equal((await f.DB.prepare('SELECT count(*) AS n FROM publications').first()).n,1);
});
test('cross-association access, transfer and unaffiliated publishing are denied server-side',async t=>{
 const f=fixture(t),{a,user}=await f.member(),b=await f.association('Anden Forening'),c=f.client();await c.login('outsider@example.test');
 assert.equal((await c.call('/events',{data:{associationId:a.id,event:event(),requestKey:crypto.randomUUID()}})).status,403);
 assert.equal((await user.call('/events',{data:{associationId:b.id,event:event(),requestKey:crypto.randomUUID()}})).status,403);
 const s=await f.memberEvent(user,a);assert.equal((await c.call('/member/events/'+s.id,{data:{action:'update',event:event(),revision:1,associationId:a.id}})).status,403);
 assert.equal((await user.call('/member/events/'+s.id,{data:{action:'update',event:event(),revision:1,associationId:b.id}})).status,403);
 const g=await f.submit();assert.equal((await user.call('/member/events/'+g.id,{data:{action:'update',event:event(),revision:1}})).status,403);
});
test('member edits/cancellation publish immediately and concurrent revisions publish once',async t=>{
 const f=fixture(t),{a,user}=await f.member(),s=await f.memberEvent(user,a);
 const responses=await Promise.all([user.call('/member/events/'+s.id,{data:{action:'update',event:event({time:'19:00'}),revision:1,associationId:a.id}}),user.call('/member/events/'+s.id,{data:{action:'update',event:event({time:'20:00'}),revision:1,associationId:a.id}})]);
 assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal((await f.DB.prepare('SELECT count(*) AS n FROM publications').first()).n,2);
 await ok(await user.call('/member/events/'+s.id,{data:{action:'cancel',revision:2,associationId:a.id}}));assert.equal((await f.publicEvents())[0].state,'cancelled');
});
test('permission is checked atomically if membership is revoked during event mutation',async t=>{
 const f=fixture(t),{a,user}=await f.member(),s=await f.memberEvent(user,a),real=f.env.DB;
 f.env.DB={...real,prepare(sql){const statement=real.prepare(sql);if(!sql.startsWith('UPDATE events SET published_json='))return statement;return {bind(...args){return {run(){real.prepare("UPDATE memberships SET status='revoked' WHERE association_id=?").bind(a.id).run();return statement.bind(...args).run();}};}};}};
 const response=await user.call('/member/events/'+s.id,{data:{action:'cancel',revision:1}});assert.equal(response.status,409);assert.equal((await f.publicEvents())[0].state,'approved');
});
test('guest new submission stays private; only author token grants private access',async t=>{
 const f=fixture(t),s=await f.submit();assert.equal(s.status,'pending');assert.equal(s.published,false);assert.deepEqual(await f.publicEvents(),[]);assert.equal((await f.privateEvent(s)).pendingKind,'new');
 assert.equal((await f.guest.call('/private/'+s.id)).status,404);assert.equal((await f.guest.call('/private/'+s.id,{authorization:token()})).status,404);
 await f.admin.login('admin@example.test');await ok(await f.decide(s));const visible=JSON.stringify(await f.publicEvents());assert.ok(visible.includes(s.payload.event.title));assert.ok(!visible.includes('guest@example.test'));assert.ok(!visible.includes(s.payload.authorToken));assert.ok(!visible.includes('author_hash'));
 const receipt=f.messages.find(m=>m.to==='guest@example.test');assert.match(receipt.text,new RegExp('#adgang='+s.payload.authorToken));assert.ok(!receipt.text.includes('?adgang='));
});
test('guest edit alias uses pendingKind edit, rejection preserves published content',async t=>{
 const f=fixture(t),s=await f.submit();await f.admin.login('admin@example.test');await ok(await f.decide(s));
 const r=await ok(await f.guest.call('/private/'+s.id,{authorization:s.payload.authorToken,data:{action:'edit',event:event({time:'20:00'}),revision:2}}));assert.equal(r.pendingKind,'edit');assert.equal(r.status,'pending');assert.equal((await f.publicEvents())[0].time,'18:00');
 assert.equal((await f.decide(s,'reject')).status,400);await ok(await f.decide(s,'reject',{note:'Ring til os'}));assert.equal((await f.publicEvents())[0].time,'18:00');const own=await f.privateEvent(s);assert.equal(own.note,'Ring til os');assert.equal(own.status,'rejected');assert.equal(own.pendingKind,null);
 await ok(await f.guest.call('/private/'+s.id,{authorization:s.payload.authorToken,data:{action:'update',event:event({time:'19:00'}),revision:own.revision}}));assert.equal((await f.privateEvent(s)).pendingKind,'edit');await ok(await f.decide(s));assert.equal((await f.publicEvents())[0].time,'19:00');
});
test('guest cancellation needs approval, concurrent moderation cannot consume twice',async t=>{
 const f=fixture(t),s=await f.submit();await f.admin.login('admin@example.test');const rs=await Promise.all([f.decide(s),f.decide(s)]);assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);assert.equal((await f.DB.prepare('SELECT count(*) AS n FROM publications').first()).n,1);
 await ok(await f.guest.call('/private/'+s.id,{authorization:s.payload.authorToken,data:{action:'cancel',revision:2}}));assert.equal((await f.publicEvents())[0].state,'approved');await ok(await f.decide(s));assert.equal((await f.publicEvents())[0].state,'cancelled');assert.equal((await f.privateEvent(s)).status,'approved');
});
test('stale guest/editor revisions do not overwrite drafts',async t=>{
 const f=fixture(t),s=await f.submit();await f.admin.login('admin@example.test');await ok(await f.guest.call('/private/'+s.id,{authorization:s.payload.authorToken,data:{action:'edit',revision:1,event:event({time:'21:00'})}}));
 assert.equal((await f.admin.call('/admin/events/'+s.id,{data:{action:'approve',revision:1}})).status,409);assert.equal((await f.guest.call('/private/'+s.id,{authorization:s.payload.authorToken,data:{action:'cancel',revision:1}})).status,409);assert.deepEqual(await f.publicEvents(),[]);
});
test('guest concurrent idempotent submission saves one event and one mail flow',async t=>{
 const f=fixture(t),payload={event:event(),email:'guest@example.test',authorToken:token(),requestKey:crypto.randomUUID(),startedAt:Date.now()-5000};
 const responses=await Promise.all([f.guest.call('/events',{data:payload}),f.guest.call('/events',{data:payload})]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,201]);assert.equal(f.messages.length,2);assert.equal((await f.DB.prepare('SELECT count(*) AS n FROM events').first()).n,1);
 assert.equal((await f.guest.call('/events',{data:{...payload,authorToken:token()}})).status,409);assert.equal((await f.guest.call('/events',{data:{...payload,event:event({title:'Anden titel'})}})).status,409);
});
test('origin, payload size, honeypot, date, price and URL validation',async t=>{
 const f=fixture(t),payload={event:event(),email:'guest@example.test',authorToken:token(),requestKey:crypto.randomUUID(),startedAt:Date.now()-5000};
 assert.equal((await f.guest.call('/events',{data:payload,headers:{Origin:'https://foreign.test'}})).status,403);assert.equal((await f.guest.call('/events',{data:{...payload,website:'spam'}})).status,400);
 for(const ev of [{date:'2027-02-30'},{time:'25:00'},{link:'javascript:alert(1)'},{link:'https://user:pass@example.test'},{price:'x'.repeat(101)}])assert.equal((await f.guest.call('/events',{data:{...payload,event:event(ev)}})).status,400);
 assert.equal((await f.guest.call('/events',{data:{...payload,unused:'x'.repeat(17000)}})).status,413);assert.equal((await f.guest.call('/events',{method:'DELETE'})).status,405);
});
test('public date range and event detail include cancelled/historical events without contact mail',async t=>{
 const f=fixture(t),{a,user}=await f.member(),s=await f.memberEvent(user,a),historical=event({date:'2020-01-02',state:'approved',associationId:a.id});
 await f.DB.prepare('UPDATE events SET published_json=?,revision=revision+1 WHERE id=?').bind(JSON.stringify(historical),s.id).run();assert.deepEqual(await f.publicEvents(),[]);assert.equal((await f.publicEvents('?from=2020-01-01&to=2020-02-01')).length,1);
 const detail=await ok(await f.guest.call('/events/'+s.id));assert.equal(detail.event.date,'2020-01-02');assert.ok(!JSON.stringify(detail).includes('manager@example.test'));assert.equal((await f.guest.call('/events?from=2027-02-30')).status,400);
});
test('definite mail failure preserves data, retries safely and idempotent replay sends nothing',async t=>{
 const f=fixture(t);f.env.TEB_EMAIL.send=async()=>{throw Object.assign(new Error('rejected before dispatch'),{code:'E_SENDER_NOT_VERIFIED',definitive:true});};const s=await f.submit();assert.equal(s.notificationState,'failed');assert.equal(s.receiptState,'failed');assert.equal((await f.privateEvent(s)).status,'pending');
 let calls=0;f.env.TEB_EMAIL.send=async()=>{calls++;return {messageId:'accepted'};};await ok(await f.guest.call('/events',{data:s.payload}));assert.equal(calls,0);
 await Promise.all([flushMail(f.env),flushMail(f.env)]);assert.equal(calls,2);await flushMail(f.env);assert.equal(calls,2);assert.equal((await f.privateEvent(s)).receiptState,'sent');
});
test('uncertain provider acceptance is not retried, expired OTP mail is not retried',async t=>{
 const f=fixture(t);let calls=0;f.env.TEB_EMAIL.send=async()=>{calls++;throw new Error('timeout after dispatch');};const s=await f.submit();assert.equal(s.receiptState,'uncertain');await flushMail(f.env);assert.equal(calls,2);
 f.env.TEB_EMAIL=null;await f.guest.request('expired@example.test');await f.DB.prepare("UPDATE mail_jobs SET expires_at=? WHERE dedupe_key LIKE 'otp:%'").bind(new Date(Date.now()-1).toISOString()).run();
 f.env.TEB_EMAIL={async send(){calls++;return {messageId:'accepted'};}};await flushMail(f.env);assert.equal(calls,2);
});
test('invitation mail failure is durable and does not activate membership',async t=>{
 const f=fixture(t);await f.admin.login('admin@example.test');const a=await f.association();f.env.TEB_EMAIL=null;const result=await f.invite(a);assert.equal(result.deliveryState,'failed');const m=await f.DB.prepare('SELECT * FROM memberships').first();assert.equal(m.status,'invited');assert.equal(m.user_id,null);
});
test('local mailbox is loopback-only even when LOCAL_PREVIEW is accidentally true',async t=>{
 const f=fixture(t);assert.equal((await f.guest.call('/local-mail')).status,404);f.env.LOCAL_PREVIEW='true';assert.equal((await f.guest.call('/local-mail')).status,404);
 assert.equal((await handleApi(new Request('http://localhost/api/kalender/local-mail'),f.env)).status,404);
 f.env.PUBLIC_ORIGIN='http://localhost:8787';const before=f.messages.length,ch=await f.guest.call('/auth/request',{data:{email:'local@example.test'}});assert.equal(ch.status,200);assert.equal(f.messages.length,before);
 const mailbox=await ok(await f.guest.call('/local-mail'));assert.match(mailbox.messages[0].body,/\b\d{6}\b/);assert.equal((await f.DB.prepare('SELECT count(*) AS n FROM local_mail').first()).n,0);
 const response=await handleApi(new Request('https://public.test/api/kalender/local-mail'),f.env);assert.equal(response.status,404);
});
test('PDF finalization stores immutable bytes and snapshot, supports custom range and A3',async t=>{
 const f=fixture(t),{a,user}=await f.member(),s=await f.memberEvent(user,a),payload={start:month+'-01',end:month+'-20',deadline:copenhagenDate(),format:'a3',requestKey:crypto.randomUUID()};
 const edition=await ok(await f.admin.call('/admin/editions',{data:payload}),201),first=await f.guest.call('/editions/'+edition.id+'/pdf');assert.equal(first.status,200);const bytes=await first.arrayBuffer(),pdf=await PDFDocument.load(bytes);assert.equal(pdf.getPageCount(),1);assert.ok(Math.abs(pdf.getPage(0).getWidth()-297*72/25.4)<.1);assert.ok(Math.abs(pdf.getPage(0).getHeight()-420*72/25.4)<.1);
 await ok(await user.call('/member/events/'+s.id,{data:{action:'update',revision:1,event:event({time:'21:00'})}}));assert.equal((await f.publicEvents())[0].time,'21:00');
 const second=await (await f.guest.call('/editions/'+edition.id+'/pdf')).arrayBuffer();assert.deepEqual(new Uint8Array(second),new Uint8Array(bytes));
 const again=await ok(await f.admin.call('/admin/editions',{data:payload}));assert.equal(again.id,edition.id);assert.equal((await f.DB.prepare('SELECT count(*) AS n FROM editions').first()).n,1);
 const list=(await ok(await f.guest.call('/editions'))).editions[0];assert.equal(list.start,payload.start);assert.equal(list.end,payload.end);assert.equal(list.format,'a3');assert.equal(list.eventCount,1);assert.ok(list.createdAt);
 const frozen=await f.DB.prepare('SELECT data_json FROM editions WHERE id=?').bind(edition.id).first();assert.equal(JSON.parse(frozen.data_json).events[0].time,'18:00');
});
test('deadline snapshots choose latest approved Copenhagen-day revision before later changes/cancellation',async t=>{
 const f=fixture(t),{a,user}=await f.member(),s=await f.memberEvent(user,a);
 await f.DB.prepare('UPDATE publications SET published_at=?').bind('2026-03-29T21:30:00.000Z').run();
 await ok(await user.call('/member/events/'+s.id,{data:{action:'update',revision:1,event:event({time:'22:00'})}}));
 await f.DB.prepare('UPDATE publications SET published_at=? WHERE revision=2').bind('2026-03-29T22:30:00.000Z').run();
 await ok(await user.call('/member/events/'+s.id,{data:{action:'cancel',revision:2}}));
 const data=await snapshot(f.env,editionOptions({month,deadline:'2026-03-29'}));assert.equal(data.events.length,1);assert.equal(data.events[0].time,'18:00');
 const following=await snapshot(f.env,editionOptions({month,deadline:'2026-03-30'}));assert.equal(following.events[0].time,'22:00');
 const today=await snapshot(f.env,editionOptions({month,deadline:copenhagenDate()}));assert.equal(today.events.length,0);
});
test('PDF cannot finalize without R2 or after failed storage; same key recovers',async t=>{
 const f=fixture(t),{a,user}=await f.member();await f.memberEvent(user,a);const payload={month,deadline:copenhagenDate(),requestKey:crypto.randomUUID()},r2=f.env.PDFS;f.env.PDFS=null;
 assert.equal((await f.admin.call('/admin/editions',{data:payload})).status,503);assert.equal((await f.DB.prepare('SELECT count(*) AS n FROM editions').first()).n,0);
 f.env.PDFS={get:async()=>null,put:async()=>{throw new Error('storage down');}};assert.equal((await f.admin.call('/admin/editions',{data:payload})).status,500);assert.equal((await f.DB.prepare('SELECT count(*) AS n FROM editions').first()).n,0);
 f.env.PDFS=r2;await ok(await f.admin.call('/admin/editions',{data:payload}),201);assert.equal((await f.DB.prepare('SELECT count(*) AS n FROM editions').first()).n,1);
});
test('concurrent edition creation is idempotent and cannot overwrite R2 bytes',async t=>{
 const f=fixture(t),{a,user}=await f.member();await f.memberEvent(user,a);const payload={month,deadline:copenhagenDate(),requestKey:crypto.randomUUID()};
 const rs=await Promise.all([f.admin.call('/admin/editions',{data:payload}),f.admin.call('/admin/editions',{data:payload})]);assert.deepEqual(rs.map(r=>r.status).sort(),[200,201]);const bodies=await Promise.all(rs.map(r=>r.json()));assert.equal(bodies[0].id,bodies[1].id);assert.equal((await f.DB.prepare('SELECT count(*) AS n FROM editions').first()).n,1);
 assert.equal((await f.admin.call('/admin/editions',{data:{...payload,format:'a3'}})).status,409);
});
test('legacy editions are preserved and their first PDF is frozen once',async t=>{
 const f=fixture(t),id=crypto.randomUUID(),data={month,deadline:copenhagenDate(),events:[event({state:'approved'})],calendarUrl:origin+'/kalender.html'};
 await f.DB.prepare('INSERT INTO editions(id,month,deadline,data_json,created_at) VALUES(?,?,?,?,?)').bind(id,month,copenhagenDate(),JSON.stringify(data),new Date().toISOString()).run();
 const a=await f.guest.call('/editions/'+id+'/pdf'),b=await f.guest.call('/editions/'+id+'/pdf');assert.equal(a.status,200);assert.deepEqual(new Uint8Array(await a.arrayBuffer()),new Uint8Array(await b.arrayBuffer()));assert.equal((await f.DB.prepare('SELECT data_json FROM editions WHERE id=?').bind(id).first()).data_json,JSON.stringify(data));
});
test('busy PDF months paginate without dropping events; preview never creates an edition',async t=>{
 const f=fixture(t),events=Array.from({length:45},(_,i)=>({id:String(i),...event({title:'Arrangement nummer '+(i+1)+' med et langt meningsfuldt navn'}),state:'approved'}));
 const pdf=await makeCalendarPdf({month,start:month+'-01',end:period(month).end,format:'poster',deadline:copenhagenDate(),calendarUrl:origin+'/kalender.html',events},f.env);assert.ok(pdf.pages>=3);assert.equal((await PDFDocument.load(pdf.bytes)).getPageCount(),pdf.pages);
 await f.admin.login('admin@example.test');const r=await f.admin.call('/admin/editions/preview?start='+month+'-01&end='+month+'-25&deadline='+copenhagenDate()+'&format=a3');assert.equal(r.status,200);assert.equal(r.headers.get('Content-Type'),'application/pdf');assert.equal((await f.DB.prepare('SELECT count(*) AS n FROM editions').first()).n,0);
});
test('local R2 persists bytes, conditionally creates objects and rejects traversal',async()=>{
 const path=await mkdtemp(join(tmpdir(),'teb-r2-'));try{const r2=localR2(path);await r2.put('editions/test.pdf',new Uint8Array([1,2,3]),{onlyIf:{etagDoesNotMatch:'*'}});assert.equal(await r2.put('editions/test.pdf',new Uint8Array([4]),{onlyIf:{etagDoesNotMatch:'*'}}),null);assert.deepEqual(new Uint8Array(await (await localR2(path).get('editions/test.pdf')).arrayBuffer()),new Uint8Array([1,2,3]));await assert.rejects(r2.get('../outside'));}finally{await rm(path,{recursive:true,force:true});}
});
test('migration upgrades a pilot database once without changing original rows',async()=>{
 const path=await mkdtemp(join(tmpdir(),'teb-migrations-'));try{
  const file=join(path,'pilot.sqlite'),old=new DatabaseSync(file);old.exec(await readFile(new URL('../migrations/0001_calendar.sql',import.meta.url),'utf8'));old.prepare('INSERT INTO editions(id,month,deadline,data_json,created_at) VALUES(?,?,?,?,?)').run('original',month,copenhagenDate(),JSON.stringify({events:[]}),new Date().toISOString());old.close();
  let db=database(file);assert.equal((await db.prepare('SELECT count(*) AS n FROM editions').first()).n,1);assert.equal((await db.prepare('SELECT count(*) AS n FROM d1_migrations').first()).n,4);db.close();db=database(file);assert.equal((await db.prepare('SELECT count(*) AS n FROM d1_migrations').first()).n,4);assert.equal((await db.prepare('SELECT id FROM editions').first()).id,'original');db.close();
 }finally{await rm(path,{recursive:true,force:true});}
});
test('production worker never redirects root or exposes assets/site/CMS',async t=>{
 const f=fixture(t);for(const path of ['/','/index.html','/admin/','/api/formular','/fonts/NotoSans-Regular.ttf'])assert.equal((await worker.fetch(new Request(origin+path),f.env)).status,404);assert.equal((await worker.fetch(new Request(origin+'/api/kalender/config'),f.env)).status,200);
});
test('TEB role changes revoke old access until a fresh invited-email OTP activates the new role',async t=>{
 const f=fixture(t),{a,user}=await f.member();await ok(await f.admin.call('/admin/associations/'+a.id+'/members',{data:{email:'manager@example.test',name:'Person',role:'editor'}}));
 assert.deepEqual((await ok(await user.call('/session'))).memberships,[]);await user.login('manager@example.test');assert.equal((await ok(await user.call('/session'))).memberships[0].role,'editor');
 assert.equal((await user.call('/associations/'+a.id+'/invitations',{data:{email:'another@example.test'}})).status,403);
});
test('revoked invitations and superseded OTP messages cannot be retried',async t=>{
 const f=fixture(t);await f.admin.login('admin@example.test');const a=await f.association();f.env.TEB_EMAIL=null;await f.invite(a,'not-sent@example.test','editor');
 const m=await f.DB.prepare("SELECT id FROM memberships WHERE email='not-sent@example.test'").first();await ok(await f.admin.call('/associations/'+a.id+'/members/'+m.id+'/revoke',{data:{}}));
 const first=await f.guest.request('not-sent@example.test');await f.guest.request('not-sent@example.test');assert.equal((await f.DB.prepare('SELECT state FROM mail_jobs WHERE dedupe_key=?').bind('otp:'+first.challengeId).first()).state,'cancelled');
 let calls=0;f.env.TEB_EMAIL={async send(){calls++;return {messageId:'accepted'};}};await flushMail(f.env);assert.equal(calls,1);
});
test('abandoned sends become uncertain in both job status and event wrapper',async t=>{
 const f=fixture(t);f.env.TEB_EMAIL=null;const s=await f.submit();await f.DB.prepare("UPDATE mail_jobs SET state='sending',lease_until=? WHERE event_id=?").bind(new Date(Date.now()-1).toISOString(),s.id).run();await flushMail(f.env);assert.equal((await f.privateEvent(s)).notificationState,'uncertain');assert.equal((await f.privateEvent(s)).receiptState,'uncertain');
});
