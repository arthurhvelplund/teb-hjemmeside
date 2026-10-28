import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from '../scripts/sqlite.mjs';
import {handleApi} from '../src/api.mjs';
import {token} from '../src/shared.mjs';
function fixture(t){
 const DB=database();t.after(()=>DB.close());const messages=[];
 const origin='https://teb.example.test';
 const env={DB,PUBLIC_ORIGIN:origin,MAIL_ENCRYPTION_KEY:token(),EMAIL_FROM:'sender@example.test',TEB_ADMIN_EMAILS:'admin@example.test',
 TEB_EMAIL:{async send(message){messages.push(message);return {messageId:crypto.randomUUID()};}}};
 async function call(path,data,cookie='',extra={}){
  const response=await handleApi(new Request(origin+'/api/kalender'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'127.0.0.1',...(cookie?{Cookie:cookie}:{}),...extra},body:JSON.stringify(data)}),env);
  return {response,data:await response.json()};
 }
 const code=email=>messages.findLast(m=>m.to===email).text.match(/\b\d{6}\b/)[0];
 return {DB,messages,env,call,code};
}
test('email-first start sends one engangskode, verifies it once and gives no access automatically',async t=>{
 const f=fixture(t),email='new@example.test';
 const start=await f.call('/auth/start',{email});
 assert.equal(start.response.status,200);assert.equal(start.data.method,'email');
 assert.equal(f.messages.length,1);assert.ok(start.data.challengeId);
 assert.equal('password' in start.data,false);assert.equal('code' in start.data,false);
 const blocked=await f.call('/auth/start',{email});
 assert.equal(blocked.response.status,429);assert.equal(f.messages.length,1);
 const verified=await f.call('/auth/verify',{challengeId:start.data.challengeId,code:f.code(email),rememberMe:true});
 assert.equal(verified.response.status,200);assert.equal(verified.data.authenticated,true);
 assert.deepEqual(verified.data.memberships,[]);
 assert.match(verified.response.headers.get('Set-Cookie'),/Max-Age=2592000/);
 assert.equal((await f.call('/auth/verify',{challengeId:start.data.challengeId,code:f.code(email)})).response.status,401);
});
test('password accounts are routed to password without sending email and retain OTP fallback',async t=>{
 const f=fixture(t),email='member@example.test';
 const start=await f.call('/auth/start',{email});
 const verified=await f.call('/auth/verify',{challengeId:start.data.challengeId,code:f.code(email)});
 const cookie=verified.response.headers.get('Set-Cookie').split(';')[0];
 assert.equal((await f.call('/auth/password',{password:'A long test password!2026'},cookie)).response.status,200);
 const count=f.messages.length;
 const next=await f.call('/auth/start',{email:' MEMBER@example.test '});
 assert.deepEqual(next.data,{method:'password'});assert.equal(f.messages.length,count);
 assert.equal((await f.call('/auth/password/login',{email,password:'wrong'})).response.status,401);
 f.DB.prepare("UPDATE rate_limits SET expires_at='2000-01-01' WHERE key LIKE 'otp-cooldown:%'").run();
 const fallback=await f.call('/auth/request',{email});
 assert.equal(fallback.response.status,200);assert.ok(fallback.data.challengeId);
 assert.equal(f.messages.length,count+1);
 assert.equal((await f.call('/auth/verify',{challengeId:fallback.data.challengeId,code:f.code(email)})).response.status,200);
});
test('email-first discovery validates request origin and email and rate limits repeated password lookups',async t=>{
 const f=fixture(t);
 assert.equal((await f.call('/auth/start',{email:'x@example.test'},'',{Origin:'https://evil.example'})).response.status,403);
 assert.equal((await f.call('/auth/start',{email:'x@example.test'},'',{'Content-Type':'text/plain'})).response.status,415);
 assert.equal((await f.call('/auth/start',{email:'invalid'})).response.status,400);
 const email='member@example.test';
 const start=await f.call('/auth/start',{email});
 const verified=await f.call('/auth/verify',{challengeId:start.data.challengeId,code:f.code(email)});
 const cookie=verified.response.headers.get('Set-Cookie').split(';')[0];
 await f.call('/auth/password',{password:'A long test password!2026'},cookie);
 for(let i=0;i<11;i++)assert.equal((await f.call('/auth/start',{email})).response.status,200);
 const blocked=await f.call('/auth/start',{email});
 assert.equal(blocked.response.status,429);
 assert.ok(Number(blocked.response.headers.get('Retry-After'))>0);
});
