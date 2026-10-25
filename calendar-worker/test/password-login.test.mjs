import test from 'node:test';
import assert from 'node:assert/strict';
import { database } from '../scripts/sqlite.mjs';
import { token, hash } from '../src/shared.mjs';
import { requestOtp, verifyOtp, identity, sessionData } from '../src/auth.mjs';
import { loginPassword, setPassword, ownPassword } from '../src/passwords.mjs';
const origin='https://teb.example.test';
function fixture(t){
 const DB=database();t.after(()=>DB.close());const messages=[];
 const env={DB,PUBLIC_ORIGIN:origin,MAIL_ENCRYPTION_KEY:token(),EMAIL_FROM:'sender@example.test',TEB_ADMIN_EMAILS:'admin@example.test',
 TEB_EMAIL:{async send(message){messages.push(message);return {messageId:crypto.randomUUID()};}}};
 const request=()=>new Request(origin+'/api/kalender/auth/password/login',{headers:{'CF-Connecting-IP':crypto.randomUUID()}});
 async function loginOtp(email){
  const r=await requestOtp(request(),env,{email}),challenge=await r.json();
  const code=messages.findLast(m=>m.to===email).text.match(/\b\d{6}\b/)[0];
  const verified=await verifyOtp(request(),env,{challengeId:challenge.challengeId,code});
  const cookie=verified.headers.get('Set-Cookie').split(';')[0];
  const auth=await identity(new Request(origin,{headers:{Cookie:cookie}}),env,true);
  return {auth,cookie};
 }
 async function member(email='member@example.test',status='invited',association='a'){
  const stamp=new Date().toISOString(),id=crypto.randomUUID(),invitation=crypto.randomUUID();
  DB.prepare('INSERT OR IGNORE INTO associations(id,name,created_at,updated_at) VALUES(?,?,?,?)').bind(association,'Test association',stamp,stamp).run();
  const user=DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
  DB.prepare('INSERT INTO memberships(id,association_id,email,user_id,role,status,invited_at,invitation_id) VALUES(?,?,?,?,?,?,?,?)').bind(id,association,email,user?.id||null,'manager',status,stamp,invitation).run();
  if(status==='invited')DB.prepare('INSERT INTO invitations(id,membership_id,email,created_at,expires_at) VALUES(?,?,?,?,?)').bind(invitation,id,email,stamp,'2099-01-01').run();
  return id;
 }
 return {DB,env,messages,request,loginOtp,member};
}
const good='A long test password!2026',other='Another long password!2026';
const rejects=(fn,status)=>assert.rejects(fn,e=>e.status===status);
test('TEB assigns an optional password before first login; only assigned invitation activates; no mail is sent',async t=>{
 const f=fixture(t),admin=await f.loginOtp('admin@example.test'),id=await f.member();
 await f.member('member@example.test','invited','b');const count=f.messages.length;
 await setPassword(f.request(),f.env,admin.auth,{password:good},'a',id);
 assert.equal(f.messages.length,count);
 assert.equal(f.DB.prepare('SELECT status FROM memberships WHERE id=?').bind(id).first().status,'invited');
 const response=await loginPassword(f.request(),f.env,{email:' MEMBER@example.test ',password:good}),data=await response.json();
 assert.equal(data.authenticated,true);assert.equal(data.user.isAdmin,false);assert.deepEqual(data.memberships.map(m=>m.associationId),['a']);
 assert.match(response.headers.get('Set-Cookie'),/HttpOnly; SameSite=Strict/);assert.match(response.headers.get('Set-Cookie'),/Secure/);
 assert.ok(f.DB.prepare('SELECT accepted_at FROM invitations WHERE membership_id=?').bind(id).first().accepted_at);
 assert.equal(f.DB.prepare("SELECT status FROM memberships WHERE association_id='b'").first().status,'invited');
 const stored=f.DB.prepare('SELECT * FROM password_credentials').first();
 assert.equal(stored.password_hash.length,64);assert.ok(!JSON.stringify(stored).includes(good));assert.ok(!JSON.stringify(data).includes(stored.password_hash));
});
test('unknown email, absent password and wrong password give the same error and no sessions',async t=>{
 const f=fixture(t),admin=await f.loginOtp('admin@example.test'),id=await f.member();
 await setPassword(f.request(),f.env,admin.auth,{password:good},'a',id);
 const errors=[];
 for(const [email,password] of [['unknown@example.test',good],['admin@example.test',good],['member@example.test',other],['member@example.test',undefined]]){
  try{await loginPassword(f.request(),f.env,{email,password});assert.fail('Should fail');}catch(e){assert.equal(e.status,401);errors.push(e.message);}
 }
 assert.equal(new Set(errors).size,1);assert.equal(f.DB.prepare('SELECT count(*) AS n FROM sessions').first().n,1);
});
test('member cannot reset another email or assign a password; unauthenticated own change is denied',async t=>{
 const f=fixture(t),member=await f.loginOtp('member@example.test'),id=await f.member('other@example.test');
 await rejects(()=>setPassword(f.request(),f.env,member.auth,{password:good},'a',id),403);
 await rejects(()=>ownPassword(f.env,{user:null},{password:good}),401);
});
test('own password change works after OTP and invalidates other sessions but preserves caller',async t=>{
 const f=fixture(t),member=await f.loginOtp('member@example.test');
 await ownPassword(f.env,member.auth,{password:good,email:'other@example.test'});
 const first=await loginPassword(f.request(),f.env,{email:'member@example.test',password:good}),oldCookie=first.headers.get('Set-Cookie').split(';')[0];
 await ownPassword(f.env,member.auth,{password:other});
 assert.equal((await identity(new Request(origin,{headers:{Cookie:oldCookie}}),f.env)).user,null);
 assert.ok((await identity(new Request(origin,{headers:{Cookie:member.cookie}}),f.env)).user);
 await rejects(()=>loginPassword(f.request(),f.env,{email:'member@example.test',password:good}),401);
 assert.equal((await loginPassword(f.request(),f.env,{email:'member@example.test',password:other})).status,200);
});
test('expired/revoked invitations cannot be assigned and removed access is not restored by password login',async t=>{
 const f=fixture(t),admin=await f.loginOtp('admin@example.test'),id=await f.member();
 await setPassword(f.request(),f.env,admin.auth,{password:good},'a',id);
 f.DB.prepare("UPDATE invitations SET expires_at='2000-01-01' WHERE membership_id=?").bind(id).run();
 const response=await loginPassword(f.request(),f.env,{email:'member@example.test',password:good});
 assert.equal((await response.json()).memberships.length,0);
 await rejects(()=>setPassword(f.request(),f.env,admin.auth,{password:other},'a',id),409);
 f.DB.prepare("UPDATE memberships SET status='revoked' WHERE id=?").bind(id).run();
 assert.equal((await (await loginPassword(f.request(),f.env,{email:'member@example.test',password:good})).json()).memberships.length,0);
 await rejects(()=>setPassword(f.request(),f.env,admin.auth,{password:other},'a',id),409);
});
test('password reset logs other user out, rejects old password, and salts hashes independently',async t=>{
 const f=fixture(t),admin=await f.loginOtp('admin@example.test'),id=await f.member();
 await setPassword(f.request(),f.env,admin.auth,{password:good},'a',id);
 const login=await loginPassword(f.request(),f.env,{email:'member@example.test',password:good}),cookie=login.headers.get('Set-Cookie').split(';')[0];
 const before=f.DB.prepare('SELECT * FROM password_credentials').first();
 await setPassword(f.request(),f.env,admin.auth,{password:good},'a',id);
 const after=f.DB.prepare('SELECT * FROM password_credentials').first();
 assert.notEqual(before.salt,after.salt);assert.notEqual(before.password_hash,after.password_hash);
 assert.equal((await identity(new Request(origin,{headers:{Cookie:cookie}}),f.env)).user,null);
});
test('no cross-association assignment, no expired admin session, no other administrator reset',async t=>{
 const f=fixture(t),admin=await f.loginOtp('admin@example.test'),id=await f.member();
 await rejects(()=>setPassword(f.request(),f.env,admin.auth,{password:good},'wrong',id),409);
 await f.loginOtp('second@example.test');f.DB.prepare("UPDATE users SET is_admin=1 WHERE email='second@example.test'").run();
 const adminMember=await f.member('second@example.test','active');
 await rejects(()=>setPassword(f.request(),f.env,admin.auth,{password:good},'a',adminMember),403);
 f.DB.prepare("UPDATE sessions SET expires_at='2000-01-01'").run();
 await rejects(()=>setPassword(f.request(),f.env,admin.auth,{password:good},'a',id),403);
});
test('password validation keeps spaces, rejects short and oversized inputs; no plaintext in database',async t=>{
 const f=fixture(t),member=await f.loginOtp('member@example.test');
 for(const password of ['',null,'short','x'.repeat(129)])await rejects(()=>ownPassword(f.env,member.auth,{password}),400);
 const password='  Spaces matter!  ';
 await ownPassword(f.env,member.auth,{password});
 await rejects(()=>loginPassword(f.request(),f.env,{email:'member@example.test',password:password.trim()}),401);
 assert.equal((await loginPassword(f.request(),f.env,{email:'member@example.test',password})).status,200);
});
test('password brute force limit is enforced without blocking the OTP recovery channel',async t=>{
 const f=fixture(t);
 for(let i=0;i<8;i++)await rejects(()=>loginPassword(f.request(),f.env,{email:'member@example.test',password:good}),401);
 await rejects(()=>loginPassword(f.request(),f.env,{email:'member@example.test',password:good}),429);
 assert.equal((await requestOtp(f.request(),f.env,{email:'member@example.test'})).status,200);
});
test('mail code login is still available after setting a password',async t=>{
 const f=fixture(t),admin=await f.loginOtp('admin@example.test'),id=await f.member();
 await setPassword(f.request(),f.env,admin.auth,{password:good},'a',id);
 const member=await f.loginOtp('member@example.test');
 assert.equal((await sessionData(f.env,member.auth)).memberships[0].associationId,'a');
});
