import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from '../scripts/sqlite.mjs';
import {handleApi} from '../src/api.mjs';
import {token} from '../src/shared.mjs';
function fixture(t){
 const DB=database();t.after(()=>DB.close());const messages=[];
 const env={DB,PUBLIC_ORIGIN:'https://teb.example.test',MAIL_ENCRYPTION_KEY:token(),EMAIL_FROM:'sender@example.test',TEB_ADMIN_EMAILS:'admin@example.test',TEB_EMAIL:{async send(m){messages.push(m);return {messageId:'test-id'};}}};
 const request=email=>handleApi(new Request(env.PUBLIC_ORIGIN+'/api/kalender/auth/request',{method:'POST',headers:{Origin:env.PUBLIC_ORIGIN,'Content-Type':'application/json','CF-Connecting-IP':crypto.randomUUID()},body:JSON.stringify({email})}),env);
 return {DB,env,messages,request};
}
test('login warns that an unknown email has no association before any code is entered',async t=>{
 const f=fixture(t),r=await f.request('unknown@example.test'),data=await r.json();
 assert.equal(r.status,200);assert.equal(data.accessState,'unlinked');assert.ok(data.challengeId);assert.equal(f.messages.length,1);
 assert.equal(data.resendAfterSeconds,60);assert.ok(!JSON.stringify(data).includes('code'));
});
test('resending within 60 seconds does not invalidate the code already on its way',async t=>{
 const f=fixture(t),first=await (await f.request('one@example.test')).json(),r=await f.request('one@example.test'),data=await r.json();
 assert.equal(r.status,429);assert.ok(data.retryAfterSeconds>0);assert.equal(f.messages.length,1);
 assert.equal((await f.DB.prepare('SELECT consumed_at FROM otp_challenges WHERE id=?').bind(first.challengeId).first()).consumed_at,null);
 assert.ok(Number(r.headers.get('Retry-After'))>0);
});
test('simultaneous code requests reserve one send and the code remains usable',async t=>{
 const f=fixture(t),responses=await Promise.all([f.request('one@example.test'),f.request('one@example.test')]);
 assert.deepEqual(responses.map(r=>r.status).sort(),[200,429]);assert.equal(f.messages.length,1);
 const data=await responses.find(r=>r.ok).json(),code=f.messages[0].text.match(/\b\d{6}\b/)[0];
 const verified=await handleApi(new Request(f.env.PUBLIC_ORIGIN+'/api/kalender/auth/verify',{method:'POST',headers:{Origin:f.env.PUBLIC_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({challengeId:data.challengeId,code})}),f.env);
 assert.equal(verified.status,200);
});
test('access indication uses actual access, not the public contact address, and hides association names',async t=>{
 const f=fixture(t),stamp=new Date().toISOString();
 await f.DB.prepare('INSERT INTO associations(id,name,email,created_at,updated_at) VALUES(?,?,?,?,?)').bind('a','Private association name','public@example.test',stamp,stamp).run();
 for(const [index,status,expires] of [[0,'active',null],[1,'invited','2099-01-01'],[2,'invited','2000-01-01'],[3,'revoked',null]]){
  const email='member'+index+'@example.test',id='m'+index,invitation='i'+index;
  await f.DB.prepare('INSERT INTO memberships(id,association_id,email,role,status,invited_at,invitation_id) VALUES(?,?,?,?,?,?,?)').bind(id,'a',email,'manager',status,stamp,invitation).run();
  if(expires)await f.DB.prepare('INSERT INTO invitations(id,membership_id,email,created_at,expires_at) VALUES(?,?,?,?,?)').bind(invitation,id,email,stamp,expires).run();
  const data=await (await f.request(email)).json();assert.equal(data.accessState,index<2?'linked':'unlinked');assert.ok(!JSON.stringify(data).includes('Private association name'));
 }
 assert.equal((await (await f.request('public@example.test')).json()).accessState,'unlinked');
 assert.equal((await (await f.request(' ADMIN@example.test ')).json()).accessState,'linked');
});
test('after the cooldown a new code replaces the old one; delivery failures are reported honestly',async t=>{
 const f=fixture(t),first=await (await f.request('one@example.test')).json();
 await f.DB.prepare("UPDATE rate_limits SET expires_at='2000-01-01' WHERE key LIKE 'otp-cooldown:%'").run();
 f.env.TEB_EMAIL.send=async()=>{throw Object.assign(new Error('rejected'),{code:'E_RECIPIENT_SUPPRESSED'});};
 const second=await (await f.request('one@example.test')).json();assert.notEqual(second.challengeId,first.challengeId);assert.equal(second.deliveryState,'failed');
 assert.ok((await f.DB.prepare('SELECT consumed_at FROM otp_challenges WHERE id=?').bind(first.challengeId).first()).consumed_at);
});
