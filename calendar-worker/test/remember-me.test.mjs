import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from '../scripts/sqlite.mjs';
import {token} from '../src/shared.mjs';
import {requestOtp,verifyOtp,identity,logout,sessionDuration} from '../src/auth.mjs';
import {ownPassword,loginPassword} from '../src/passwords.mjs';

test('remember me requires boolean opt-in',()=>{
 for(const rememberMe of [undefined,false,'true',1,{},null])assert.equal(sessionDuration({rememberMe}),28800);
 assert.equal(sessionDuration({rememberMe:true}),2592000);
});

for(const rememberMe of [false,true])test(`OTP and password use matching cookie and server lifetimes (remember=${rememberMe})`,async t=>{
 const DB=database();t.after(()=>DB.close());const messages=[];
 const env={DB,PUBLIC_ORIGIN:'https://teb.example.test',MAIL_ENCRYPTION_KEY:token(),EMAIL_FROM:'sender@example.test',TEB_EMAIL:{async send(m){messages.push(m);return {messageId:'test'};}}};
 const request=()=>new Request(env.PUBLIC_ORIGIN+'/api/kalender/auth/verify',{headers:{'CF-Connecting-IP':crypto.randomUUID()}});
 const email='remember@example.test';
 const challenge=await (await requestOtp(request(),env,{email})).json();
 const code=messages[0].text.match(/\b\d{6}\b/)[0];
 const response=await verifyOtp(request(),env,{challengeId:challenge.challengeId,code,rememberMe});
 const expected=rememberMe?2592000:28800;
 function check(response){
  const header=response.headers.get('Set-Cookie');
  assert.match(header,new RegExp('Max-Age='+expected+'; Secure'));
  assert.match(header,/HttpOnly; SameSite=Strict; Path=\/api\/kalender/);
  const row=DB.prepare('SELECT * FROM sessions ORDER BY created_at DESC LIMIT 1').first();
  assert.ok(Math.abs(Date.parse(row.expires_at)-Date.parse(row.created_at)-expected*1000)<100);
  return header.split(';')[0];
 }
 const otpCookie=check(response);
 const auth=await identity(new Request(env.PUBLIC_ORIGIN,{headers:{Cookie:otpCookie}}),env,true);
 await ownPassword(env,auth,{password:'Remember test password 2026!'});
 const passwordResponse=await loginPassword(request(),env,{email,password:'Remember test password 2026!',rememberMe});
 const passwordCookie=check(passwordResponse);
 const passwordRequest=new Request(env.PUBLIC_ORIGIN,{headers:{Cookie:passwordCookie}});
 assert.ok((await identity(passwordRequest,env)).user);
 const loggedOut=await logout(passwordRequest,env);
 assert.match(loggedOut.headers.get('Set-Cookie'),/Max-Age=0/);
 assert.equal((await identity(passwordRequest,env)).user,null);
 const another=await loginPassword(request(),env,{email,password:'Remember test password 2026!',rememberMe});
 const anotherRequest=new Request(env.PUBLIC_ORIGIN,{headers:{Cookie:check(another)}});
 await ownPassword(env,auth,{password:'Changed remember password 2026!'});
 assert.equal((await identity(anotherRequest,env)).user,null);
 DB.prepare("UPDATE sessions SET expires_at='2000-01-01'").run();
 assert.equal((await identity(new Request(env.PUBLIC_ORIGIN,{headers:{Cookie:otpCookie}}),env)).user,null);
});
