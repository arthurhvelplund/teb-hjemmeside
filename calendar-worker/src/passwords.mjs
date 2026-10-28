import { ensure, now, token, hash, json } from './shared.mjs';
import { stmt, rate, ipKey, emailAddress } from './db.mjs';
import { identity, sessionData, requireAccess, cookie, sessionDuration, requestOtp } from './auth.mjs';
import { secretHash } from './mail.mjs';
import { timingSafeEqual } from 'node:crypto';

// Workers caps a single PBKDF2 invocation at 100,000 iterations. A server-side
// pepper also keeps a stolen database from being sufficient for offline guesses.
const iterations=100000;
const invalid='E-mail eller adgangskode er forkert. Brug eventuelt en engangskode.';
function passwordValue(value){
 ensure(typeof value==='string'&&value.length>=12&&value.length<=128,400,'Brug en adgangskode på 12–128 tegn.');
 return value;
}
async function derive(env,password,salt){
 const material=await secretHash(env,'password-v1:'+password);
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(material),'PBKDF2',false,['deriveBits']);
 return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',iterations,salt:new TextEncoder().encode(salt)},key,256));
}
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
// Email-first discovery returns only the next login method, never profile/access data.
export async function startLogin(request,env,data){
 const email=emailAddress(data.email);
 await rate(env,'login-start-ip:'+await ipKey(request),30,15);
 await rate(env,'login-start-email:'+await hash(email),12,15);
 await rate(env,'login-start-global',150,15);
 const credential=await stmt(env,'SELECT 1 FROM password_credentials p JOIN users u ON u.id=p.user_id WHERE u.email=?',email).first();
 if(credential)return json({method:'password'});
 const response=await requestOtp(request,env,{email});
 if(!response.ok)return response;
 return json({method:'email',...await response.json()});
}
export async function loginPassword(request,env,data){
 await rate(env,'password-ip:'+await ipKey(request),30,15);
 const email=emailAddress(data.email);
 await rate(env,'password-email:'+await hash(email),8,15);
 await rate(env,'password-global',150,15);
 const row=await stmt(env,`SELECT p.*,u.email FROM password_credentials p JOIN users u ON u.id=p.user_id WHERE u.email=?`,email).first();
 const supplied=typeof data.password==='string'&&data.password.length<=128?data.password:'';
 // Same derivation and error for unknown emails and accounts without a password.
 const candidate=await derive(env,supplied,row?.salt||'00000000000000000000000000000000');
 const expected=row?Uint8Array.from(row.password_hash.match(/../g),v=>parseInt(v,16)):new Uint8Array(32);
 ensure(timingSafeEqual(candidate,expected)&&row,401,invalid);
 const maxAge=sessionDuration(data);
 const value=token(),sessionHash=await hash(value),stamp=now();
 const validCredential='EXISTS(SELECT 1 FROM password_credentials p WHERE p.user_id=? AND p.version=?)';
 const results=await env.DB.batch([
  stmt(env,`INSERT INTO sessions(hash,user_id,created_at,expires_at) SELECT ?,?,?,? WHERE ${validCredential}`,sessionHash,row.user_id,stamp,new Date(Date.now()+maxAge*1000).toISOString(),row.user_id,row.version),
  // Only an invitation explicitly assigned by TEB may be accepted without OTP.
  stmt(env,`UPDATE memberships SET status='active',user_id=?,activated_at=?
   WHERE id=? AND email=? AND status='invited' AND ${validCredential}
   AND EXISTS(SELECT 1 FROM invitations i WHERE i.id=memberships.invitation_id AND i.membership_id=memberships.id AND i.email=memberships.email AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>?)`,
   row.user_id,stamp,row.assigned_membership_id,email,row.user_id,row.version,stamp),
  stmt(env,`UPDATE invitations SET accepted_at=? WHERE membership_id=? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>? AND ${validCredential}
   AND EXISTS(SELECT 1 FROM memberships m WHERE m.id=invitations.membership_id AND m.invitation_id=invitations.id AND m.status='active' AND m.user_id=?)`,
   stamp,row.assigned_membership_id,stamp,row.user_id,row.version,row.user_id)
 ]);
 ensure(results[0].meta.changes===1,401,invalid);
 const auth=await identity(new Request(request.url,{headers:{Cookie:'teb_calendar='+value}}),env,true);
 return json(await sessionData(env,auth),200,{'Set-Cookie':cookie(env,value,maxAge)});
}
export async function setPassword(request,env,auth,data,associationId=null,memberId=null){
 const g=await requireAccess(env,auth);
 // Self-service is handled separately below; assignment always requires TEB admin.
 return savePassword(env,auth,data,g,associationId,memberId);
}
export async function ownPassword(env,auth,data){
 ensure(auth.user,401,'Log ind først.');
 const g={sql:'EXISTS(SELECT 1 FROM sessions WHERE hash=? AND user_id=? AND expires_at>?)',args:[auth.sessionHash,auth.user.id,now()]};
 return savePassword(env,auth,data,g,null,null);
}
async function savePassword(env,auth,data,g,associationId,memberId){
 const password=passwordValue(data.password);
 await rate(env,'password-set:'+auth.user.id,20,60);
 let target={user_id:auth.user.id,email:auth.user.email,id:null};
 if(associationId){
  target=await stmt(env,`SELECT m.* FROM memberships m WHERE m.id=? AND m.association_id=? AND
   (m.status='active' OR (m.status='invited' AND EXISTS(SELECT 1 FROM invitations i WHERE i.id=m.invitation_id AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>?)))`,memberId,associationId,now()).first();
  ensure(target,409,'Adgangen er udløbet eller fjernet. Invitér personen igen først.');
  const admins=(env.TEB_ADMIN_EMAILS||'').split(',').map(s=>s.trim().toLowerCase());
  const existing=await stmt(env,'SELECT id,is_admin FROM users WHERE email=?',target.email).first();
  ensure(!(existing?.is_admin||admins.includes(target.email))||existing?.id===auth.user.id,403,'En anden TEB-administrator skal selv vælge sin adgangskode.');
 }
 const salt=token(),passwordHash=hex(await derive(env,password,salt)),version=token(),stamp=now();
 const targetCondition=associationId?`EXISTS(SELECT 1 FROM memberships m WHERE m.id=? AND m.association_id=? AND m.email=? AND (m.status='active' OR (m.status='invited' AND EXISTS(SELECT 1 FROM invitations i WHERE i.id=m.invitation_id AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>?))))`:'1';
 const args=associationId?[memberId,associationId,target.email,stamp]:[];
 const condition=`${g.sql} AND ${targetCondition}`,conditionArgs=[...g.args,...args];
 const results=await env.DB.batch([
  stmt(env,`INSERT INTO users(id,email,created_at) SELECT ?,?,? WHERE ${condition} ON CONFLICT(email) DO NOTHING`,crypto.randomUUID(),target.email,stamp,...conditionArgs),
  stmt(env,`INSERT INTO password_credentials(user_id,salt,password_hash,version,assigned_membership_id,updated_at)
   SELECT id,?,?,?,?,? FROM users WHERE email=? AND ${condition}
   ON CONFLICT(user_id) DO UPDATE SET salt=excluded.salt,password_hash=excluded.password_hash,version=excluded.version,assigned_membership_id=excluded.assigned_membership_id,updated_at=excluded.updated_at`,
   salt,passwordHash,version,associationId?memberId:null,stamp,target.email,...conditionArgs),
  // A reset logs out other devices. Keep only the caller's own session, if any.
  stmt(env,`DELETE FROM sessions WHERE user_id IN (SELECT u.id FROM users u JOIN password_credentials p ON p.user_id=u.id WHERE u.email=? AND p.version=?) AND hash!=?`,target.email,version,auth.sessionHash)
 ]);
 ensure(results[1].meta.changes===1,403,'Adgangen er ændret. Genindlæs siden.');
 return json({saved:true});
}
