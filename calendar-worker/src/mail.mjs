import { ensure, now, escapeHtml } from './shared.mjs';
import { stmt, all, local, loopback } from './db.mjs';
const encoder=new TextEncoder();
function keyBytes(env){
 ensure(/^[a-f0-9]{64}$/i.test(env.MAIL_ENCRYPTION_KEY||''),503,'Mailkryptering er ikke konfigureret.');
 return Uint8Array.from(env.MAIL_ENCRYPTION_KEY.match(/../g),s=>parseInt(s,16));
}
async function key(env){return crypto.subtle.importKey('raw',keyBytes(env),'AES-GCM',false,['encrypt','decrypt']);}
export async function secretHash(env,value){
 const k=await crypto.subtle.importKey('raw',keyBytes(env),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',k,encoder.encode(value))),v=>v.toString(16).padStart(2,'0')).join('');
}
async function encrypt(env,value){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const bytes=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(env),encoder.encode(JSON.stringify(value))));
 return [...iv,...bytes].map(v=>v.toString(16).padStart(2,'0')).join('');
}
async function decrypt(env,value){
 const bytes=Uint8Array.from(value.match(/../g),v=>parseInt(v,16));
 return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12)},await key(env),bytes.slice(12))));
}
// EDITOR_EMAIL kan være flere adresser adskilt af komma. De får samme besked.
export function editorRecipients(env){
 const list=(env.EDITOR_EMAIL||'').split(',').map(value=>value.trim()).filter(Boolean);
 return list.length>1?list:list[0]||'';
}
export async function mailStatement(env,{dedupe,to,subject,text,eventId=null,eventRevision=null,column=null,expiresAt=null,condition='1',args=[]}){
 const payload=await encrypt(env,{to,subject,text});
 return stmt(env,`INSERT OR IGNORE INTO mail_jobs(id,dedupe_key,payload,event_id,event_revision,state_column,created_at,updated_at,expires_at)
 SELECT ?,?,?,?,?,?,?,?,? WHERE ${condition}`,crypto.randomUUID(),dedupe,payload,eventId,eventRevision,column,now(),now(),expiresAt,...args);
}
async function setEventState(env,job,state){
 if(job.event_id&&job.state_column)await stmt(env,`UPDATE events SET ${job.state_column}=? WHERE id=? AND revision=?`,state,job.event_id,job.event_revision).run();
}
export async function deliverMail(env,id){
 const stamp=now();
 const job=await stmt(env,`UPDATE mail_jobs SET state='sending',attempts=attempts+1,updated_at=?,lease_until=?
 WHERE id=? AND state IN ('pending','failed') AND (expires_at IS NULL OR expires_at>?) RETURNING *`,stamp,new Date(Date.now()+120000).toISOString(),id,stamp).first();
 if(!job)return;
 let state,providerId=null;
 // A missing transport is a definite failure before dispatch. A network/transport
 // exception is uncertain: the provider may already have accepted the message.
 try {
  const message=await decrypt(env,job.payload);
  if(local(env)){state='local';}
  else if(!env.TEB_EMAIL||!env.EMAIL_FROM){state='failed';}
  else {
   const result=await env.TEB_EMAIL.send({from:{email:env.EMAIL_FROM,name:'Tistrup Kalenderen'},to:message.to,...(env.REPLY_TO?{replyTo:env.REPLY_TO}:{}),subject:message.subject,text:message.text,
    html:`<html lang="da"><body><div style="font:18px/1.6 system-ui,sans-serif;max-width:620px">${escapeHtml(message.text).replace(/\n/g,'<br>')}</div></body></html>`});
   state=result?.messageId?'sent':'uncertain';providerId=result?.messageId||null;
  }
 }catch(error){
  const rejected=new Set(['E_VALIDATION_ERROR','E_FIELD_MISSING','E_TOO_MANY_RECIPIENTS','E_SENDER_NOT_VERIFIED','E_RECIPIENT_NOT_ALLOWED','E_RECIPIENT_SUPPRESSED','E_SENDER_DOMAIN_NOT_AVAILABLE','E_CONTENT_TOO_LARGE','E_RATE_LIMIT_EXCEEDED','E_DAILY_LIMIT_EXCEEDED','E_HEADER_NOT_ALLOWED','E_HEADER_USE_API_FIELD','E_HEADER_VALUE_INVALID','E_HEADER_VALUE_TOO_LONG','E_HEADER_NAME_INVALID','E_HEADERS_TOO_LARGE','E_HEADERS_TOO_MANY']);
  state=error?.definitive===true||rejected.has(error?.code)?'failed':'uncertain';
 }
 await stmt(env,'UPDATE mail_jobs SET state=?,provider_id=?,updated_at=?,lease_until=NULL WHERE id=? AND state=\'sending\'',state,providerId,now(),id).run();
 await setEventState(env,job,state);
}
export async function flushMail(env,limit=20){
 // A crashed dispatch is never retried automatically. This prevents duplicates
 // when the transport has no idempotency support.
 const abandoned=await all(stmt(env,"UPDATE mail_jobs SET state='uncertain',updated_at=? WHERE state='sending' AND lease_until<? RETURNING *",now(),now()));
 for(const job of abandoned)await setEventState(env,job,'uncertain');
 const jobs=await all(stmt(env,"SELECT id FROM mail_jobs WHERE state IN ('pending','failed') AND attempts<5 AND (expires_at IS NULL OR expires_at>?) ORDER BY created_at LIMIT ?",now(),limit));
 for(const job of jobs)await deliverMail(env,job.id);
}
export async function deliverKeys(env,keys){
 for(const dedupe of keys){const job=await stmt(env,'SELECT id FROM mail_jobs WHERE dedupe_key=?',dedupe).first();if(job)await deliverMail(env,job.id);}
}
export async function localMailbox(request,env){
 ensure(local(env)&&loopback(request.url)&&loopback(env.PUBLIC_ORIGIN),404,'Siden findes ikke.');
 const jobs=await all(stmt(env,"SELECT * FROM mail_jobs WHERE state='local' ORDER BY created_at DESC,id DESC LIMIT 100"));
 const messages=[];
 for(const job of jobs){const payload=await decrypt(env,job.payload);messages.push({id:job.id,recipient:payload.to,subject:payload.subject,body:payload.text,created_at:job.created_at});}
 // Original local pilot messages are retained. They are only accessible here.
 const old=await all(stmt(env,'SELECT * FROM local_mail ORDER BY id DESC LIMIT 50'));
 return {messages:[...messages,...old]};
}
export async function mailState(env,dedupe){return (await stmt(env,'SELECT state FROM mail_jobs WHERE dedupe_key=?',dedupe).first())?.state||'pending';}
