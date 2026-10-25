import { ensure, now, token, hash, json } from './shared.mjs';
import { stmt, all, rate, ipKey, emailAddress, local, loopback } from './db.mjs';
import { mailStatement, secretHash, deliverKeys, mailState } from './mail.mjs';
const duration=8*3600;
export const cookieToken=request=>(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('teb_calendar='))?.slice('teb_calendar='.length)||'';
export function cookie(env,value,maxAge=duration){
 ensure(env.PUBLIC_ORIGIN.startsWith('https:')||(local(env)&&loopback(env.PUBLIC_ORIGIN)),503,'Login kræver HTTPS.');
 return `teb_calendar=${value}; HttpOnly; SameSite=Strict; Path=/api/kalender; Max-Age=${maxAge}${env.PUBLIC_ORIGIN.startsWith('https:')?'; Secure':''}`;
}
export async function identity(request,env,required=false){
 const value=cookieToken(request);
 const sessionHash=/^[a-f0-9]{64}$/.test(value)?await hash(value):'';
 const user=sessionHash?await stmt(env,`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires_at>?`,sessionHash,now()).first():null;
 ensure(!required||user,401,'Log ind med adgangskode eller en kode fra din e-mail.');
 return {user,sessionHash};
}
export function guard(auth,associationId=null){
 const membership=associationId?` OR EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=u.id AND m.association_id=? AND m.status='active')`:'';
 return {sql:`EXISTS(SELECT 1 FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires_at>? AND (u.is_admin=1${membership}))`,args:[auth.sessionHash,now(),...(associationId?[associationId]:[])]};
}
export async function requireAccess(env,auth,associationId=null){
 ensure(auth.user,401,'Log ind med adgangskode eller en kode fra din e-mail.');
 const g=guard(auth,associationId);
 ensure(await stmt(env,`SELECT 1 WHERE ${g.sql}`,...g.args).first(),403,'Du har ikke adgang til denne handling.');
 return g;
}
export async function sessionData(env,auth){
 if(!auth.user)return {authenticated:false,user:null,memberships:[]};
 const rows=await all(stmt(env,`SELECT a.*,m.id AS membership_id,m.association_id,m.role AS membership_role FROM memberships m JOIN associations a ON a.id=m.association_id WHERE m.user_id=? AND m.status='active' ORDER BY a.name`,auth.user.id));
 return {authenticated:true,user:{id:auth.user.id,email:auth.user.email,isAdmin:Boolean(auth.user.is_admin)},memberships:rows.map(row=>({id:row.membership_id,associationId:row.association_id,role:row.membership_role,association:associationData(row)}))};
}
export function associationData(row){
 return {...Object.fromEntries(['id','name','category','description','chair','email','phone','website','place','revision'].map(k=>[k,row[k]])),imageUrl:row.image_url||''};
}
function randomCode(){
 let number;do{number=crypto.getRandomValues(new Uint32Array(1))[0];}while(number>=4294000000);
 return String(number%1000000).padStart(6,'0');
}
export async function requestOtp(request,env,data){
 const email=emailAddress(data.email),emailHash=await hash(email),ip=await ipKey(request);
 await rate(env,'otp-send-ip:'+ip,15,15);
 // Atomic reservation: a second tab/request must not replace a code that is
 // still on its way. Use the existing rate-limit table, without a migration.
 const cooldownKey='otp-cooldown:'+emailHash,stampNow=now();
 const reserved=await stmt(env,`INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?)
 ON CONFLICT(key) DO UPDATE SET count=1,expires_at=excluded.expires_at WHERE rate_limits.expires_at<=? RETURNING expires_at`,cooldownKey,new Date(Date.now()+60000).toISOString(),stampNow).first();
 if(!reserved){
  const row=await stmt(env,'SELECT expires_at FROM rate_limits WHERE key=?',cooldownKey).first();
  const retryAfterSeconds=Math.max(1,Math.ceil((Date.parse(row.expires_at)-Date.now())/1000));
  return json({error:`Vent ${retryAfterSeconds} sekunder, før du beder om en ny kode. Den seneste kode gælder stadig.`,retryAfterSeconds},429,{'Retry-After':String(retryAfterSeconds)});
 }
 await rate(env,'otp-send-email:'+emailHash,3,10);await rate(env,'otp-send-global',100,10);
 const admins=(env.TEB_ADMIN_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
 // Only disclose whether access exists, never association names or roles
 // until the person has verified ownership of the email address.
 const linked=admins.includes(email)||Boolean(await stmt(env,`SELECT 1 FROM users WHERE email=? AND is_admin=1
 UNION ALL SELECT 1 FROM memberships m WHERE m.email=? AND (m.status='active' OR
 (m.status='invited' AND EXISTS(SELECT 1 FROM invitations i WHERE i.id=m.invitation_id AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>?))) LIMIT 1`,email,email,now()).first());
 const id=crypto.randomUUID(),code=randomCode(),stamp=now(),expiry=new Date(Date.now()+600000).toISOString(),dedupe='otp:'+id;
 const job=await mailStatement(env,{dedupe,to:email,subject:'Din engangskode til TEB',text:`Din kode er ${code}\n\nKoden gælder i ti minutter og kan bruges én gang. Hvis du ikke bad om en kode, kan du se bort fra mailen.`,expiresAt:expiry});
 await env.DB.batch([
  stmt(env,`UPDATE mail_jobs SET state='cancelled',updated_at=? WHERE state IN ('pending','failed') AND dedupe_key IN (SELECT 'otp:'||id FROM otp_challenges WHERE email=? AND consumed_at IS NULL)`,stamp,email),
  stmt(env,'UPDATE otp_challenges SET consumed_at=? WHERE email=? AND consumed_at IS NULL',stamp,email),
  stmt(env,'INSERT INTO otp_challenges(id,email,code_hash,created_at,expires_at) VALUES(?,?,?,?,?)',id,email,await secretHash(env,id+':'+code),stamp,expiry),
  stmt(env,`INSERT INTO otp_invitations(challenge_id,invitation_id) SELECT ?,id FROM invitations WHERE email=? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>?`,id,email,stamp),job
 ]);
 await deliverKeys(env,[dedupe]);
 return json({challengeId:id,mode:local(env)?'local':'live',deliveryState:await mailState(env,dedupe),accessState:linked?'linked':'unlinked',resendAfterSeconds:60});
}
export async function verifyOtp(request,env,data){
 await rate(env,'otp-verify-ip:'+await ipKey(request),50,10);
 ensure(typeof data.challengeId==='string'&&data.challengeId.length===36,401,'Koden er ugyldig eller udløbet.');
 await rate(env,'otp-verify-challenge:'+data.challengeId,8,10);
 const challenge=await stmt(env,'SELECT email FROM otp_challenges WHERE id=?',data.challengeId).first();
 if(challenge)await rate(env,'otp-verify-email:'+await hash(challenge.email),25,10);
 const value=token(),sessionHash=await hash(value),stamp=now(),code=typeof data.code==='string'&&/^\d{6}$/.test(data.code)?data.code:'invalid';
 const codeHash=await secretHash(env,data.challengeId+':'+code);
 const admins=(env.TEB_ADMIN_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
 const results=await env.DB.batch([
  stmt(env,`UPDATE otp_challenges SET attempts=attempts+1,
   consumed_at=CASE WHEN code_hash=? OR attempts>=4 THEN ? ELSE NULL END,
   verified_at=CASE WHEN code_hash=? THEN ? ELSE NULL END,
   redemption_hash=CASE WHEN code_hash=? THEN ? ELSE NULL END
   WHERE id=? AND consumed_at IS NULL AND expires_at>? AND attempts<5`,codeHash,stamp,codeHash,stamp,codeHash,sessionHash,data.challengeId,stamp),
  stmt(env,`INSERT INTO users(id,email,is_admin,created_at) SELECT ?,email,?,? FROM otp_challenges WHERE id=? AND redemption_hash=?
   ON CONFLICT(email) DO UPDATE SET is_admin=CASE WHEN excluded.is_admin=1 THEN 1 ELSE users.is_admin END`,crypto.randomUUID(),challenge&&admins.includes(challenge.email)?1:0,stamp,data.challengeId,sessionHash),
  stmt(env,`INSERT INTO sessions(hash,user_id,created_at,expires_at) SELECT ?,u.id,?,? FROM users u JOIN otp_challenges c ON c.email=u.email WHERE c.id=? AND c.redemption_hash=?`,sessionHash,stamp,new Date(Date.now()+duration*1000).toISOString(),data.challengeId,sessionHash),
  stmt(env,`UPDATE memberships SET status='active',user_id=(SELECT u.id FROM users u JOIN otp_challenges c ON c.email=u.email WHERE c.id=? AND c.redemption_hash=?),activated_at=?
   WHERE status='invited' AND id IN (SELECT i.membership_id FROM invitations i JOIN otp_invitations oi ON oi.invitation_id=i.id JOIN otp_challenges c ON c.id=oi.challenge_id
   WHERE c.id=? AND c.redemption_hash=? AND i.email=c.email AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>?)`,data.challengeId,sessionHash,stamp,data.challengeId,sessionHash,stamp),
  stmt(env,`UPDATE invitations SET accepted_at=? WHERE id IN (SELECT oi.invitation_id FROM otp_invitations oi JOIN otp_challenges c ON c.id=oi.challenge_id WHERE c.id=? AND c.redemption_hash=?)
   AND revoked_at IS NULL AND accepted_at IS NULL AND expires_at>?`,stamp,data.challengeId,sessionHash,stamp)
 ]);
 ensure(results[2].meta.changes===1,401,'Koden er ugyldig, brugt eller udløbet.');
 const auth=await identity(new Request(request.url,{headers:{Cookie:'teb_calendar='+value}}),env,true);
 return json(await sessionData(env,auth),200,{'Set-Cookie':cookie(env,value)});
}
export async function logout(request,env){
 await stmt(env,'DELETE FROM sessions WHERE hash=?',await hash(cookieToken(request))).run();
 return json({saved:true},200,{'Set-Cookie':cookie(env,'',0)});
}
