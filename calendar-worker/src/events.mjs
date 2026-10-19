import { ensure, now, hash, validateEvent, copenhagenDate, validDate, json } from './shared.mjs';
import { stmt, all, emailAddress, rate, ipKey, field } from './db.mjs';
import { requireAccess } from './auth.mjs';
import { mailStatement, deliverKeys } from './mail.mjs';
const bearer=request=>request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1]||'';
export function privateData(row){
 return {id:row.id,data:JSON.parse(row.pending_json||row.published_json||'{}'),published:row.published_json?JSON.parse(row.published_json):null,
  pendingKind:row.pending_kind==='update'?'edit':row.pending_kind,status:row.status,revision:row.revision,note:row.moderation_note,associationId:row.association_id,
  email:row.contact_email,notificationState:row.notification_state,receiptState:row.receipt_state};
}
export async function author(request,env,id){
 ensure(bearer(request),404,'Det private link er ugyldigt.');
 const row=await stmt(env,'SELECT * FROM events WHERE id=? AND author_hash=? AND created_by IS NULL',id,await hash(bearer(request))).first();
 ensure(row,404,'Det private link er ugyldigt.');return row;
}
const eventSort=(a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)||a.title.localeCompare(b.title,'da');
export async function publicEvents(env,url,id){
 if(id){const row=await stmt(env,'SELECT id,published_json FROM events WHERE id=? AND published_json IS NOT NULL',id).first();ensure(row,404,'Arrangementet findes ikke.');return json({event:{id:row.id,...JSON.parse(row.published_json)}});}
 const from=url.searchParams.get('from'),to=url.searchParams.get('to');
 ensure((!from||validDate(from))&&(!to||validDate(to))&&(!from||!to||from<=to),400,'Vælg et gyldigt datointerval.');
 const rows=await all(stmt(env,'SELECT id,published_json FROM events WHERE published_json IS NOT NULL'));
 return json({events:rows.map(r=>({id:r.id,...JSON.parse(r.published_json)})).filter(e=>(e.endDate||e.date)>=(from||(!to?copenhagenDate():'2000-01-01'))&&(!to||e.date<=to)).sort(eventSort)});
}
async function eventMail(env,{id,revision,event,email,kind,authorToken,condition,args,review=false,note=''}){
 const keys=[],statements=[];
 const make=async(suffix,to,subject,text,column)=>{
  const dedupe=`event:${id}:${revision}:${suffix}`;keys.push(dedupe);
  statements.push(await mailStatement(env,{dedupe,to,subject,text,eventId:id,eventRevision:revision,column,condition,args}));
 };
 if(!review){
  await make('editor',env.EDITOR_EMAIL||'',`${kind==='cancel'?'Aflysning':kind==='edit'?'Rettelse':'Nyt arrangement'} til godkendelse: ${event.title}`,
   `Et arrangement afventer TEBs godkendelse.\n\n${event.title}\n${event.date} kl. ${event.time}\n${event.location}\nOplyst forening: ${event.association}\nKontakt: ${email}\n\nTilknytningen er ikke verificeret. Log ind på ${env.PUBLIC_ORIGIN}/forening.html for at gennemgå indsendelsen.`, 'notification_state');
  if(authorToken)await make('receipt',email,`Modtaget til godkendelse: ${event.title}`,
   `Dit arrangement er gemt og afventer TEBs godkendelse.\n\nDit private link til status, rettelser og aflysning:\n${env.PUBLIC_ORIGIN}/kalender.html?privat=${id}#adgang=${authorToken}\n\nGem linket, og del det kun med dem, der må rette arrangementet. Din kontaktmail offentliggøres ikke.`, 'receipt_state');
 } else await make('decision',email,`Svar fra TEB: ${event.title}`,
  `${kind==='reject'?'TEB har ikke godkendt forslaget.':'TEB har godkendt forslaget. Se arrangementet på '+env.PUBLIC_ORIGIN+'/kalender.html?arrangement='+id}\n${note?'\nBesked fra TEB: '+note:''}\n\nAllerede udgivne printudgaver ændres ikke.`, 'receipt_state');
 return {keys,statements};
}
function createResult(row){return {id:row.id,status:row.status,notificationState:row.notification_state,receiptState:row.receipt_state,published:Boolean(row.published_json)};}
export async function createEvent(request,env,auth,data){
 ensure(!data.website,400,'Indsendelsen kunne ikke modtages.');
 ensure(/^[a-f0-9-]{36}$/.test(data.requestKey||''),400,'Genindlæs formularen og prøv igen.');
 const associationId=data.associationId||data.event?.associationId||null;
 const member=Boolean(auth.user&&associationId);
 let g,a,event;
 if(member){g=await requireAccess(env,auth,associationId);a=await stmt(env,'SELECT * FROM associations WHERE id=?',associationId).first();ensure(a,404,'Foreningen findes ikke.');}
 else ensure(/^[a-f0-9]{64}$/.test(data.authorToken||''),400,'Genindlæs formularen og prøv igen.');
 event=validateEvent({...data.event,...(a?{association:a.name}:{})},{allowPast:true});
 if(member)event.associationId=associationId;
 const email=member?auth.user.email:emailAddress(data.email);
 const authorHash=await hash(member?'member:'+auth.user.id:data.authorToken);
 const requestHash=await hash(JSON.stringify([event,email,member?associationId:null,member?auth.user.id:null]));
 const existing=await stmt(env,'SELECT * FROM events WHERE request_key=?',data.requestKey).first();
 if(existing){ensure(existing.author_hash===authorHash&&existing.request_hash===requestHash,409,'Nøglen er allerede brugt til en anden indsendelse.');return json(createResult(existing));}
 validateEvent(event);
 if(!member)ensure(typeof data.startedAt==='number'&&Date.now()-data.startedAt>=1500&&Date.now()-data.startedAt<86400000,400,'Vent et øjeblik, eller genindlæs siden.');
 await rate(env,'event-submit:'+await ipKey(request),30);
 if(member)await rate(env,'event-member:'+auth.user.id,60);
 const id=crypto.randomUUID(),stamp=now();
 event.state='approved';
 const condition='EXISTS(SELECT 1 FROM events WHERE id=?)',args=[id];
 const mail=member?{keys:[],statements:[]}:await eventMail(env,{id,revision:1,event,email,kind:'new',authorToken:data.authorToken,condition,args});
 const operations=[stmt(env,`INSERT OR IGNORE INTO events(id,request_key,request_hash,author_hash,contact_email,pending_json,pending_kind,published_json,status,notification_state,receipt_state,created_at,updated_at,association_id,created_by)
 SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${member?g.sql:'1'}`,id,data.requestKey,requestHash,authorHash,email,member?null:JSON.stringify(event),member?null:'new',member?JSON.stringify(event):null,member?'approved':'pending',member?'not_required':'pending',member?'not_required':'pending',stamp,stamp,member?associationId:null,member?auth.user.id:null,...(member?g.args:[])),...mail.statements];
 const results=await env.DB.batch(operations);
 if(!results[0].meta.changes){const row=await stmt(env,'SELECT * FROM events WHERE request_key=?',data.requestKey).first();ensure(row&&row.author_hash===authorHash&&row.request_hash===requestHash,409,'Indsendelsen er ændret, eller din adgang er ophørt.');return json(createResult(row));}
 await deliverKeys(env,mail.keys);
 return json(createResult(await stmt(env,'SELECT * FROM events WHERE id=?',id).first()),201);
}
export async function guestUpdate(request,env,id,data){
 const row=await author(request,env,id);
 ensure(data.revision===row.revision,409,'Arrangementet er ændret. Genindlæs siden.');
 ensure(['edit','update','cancel'].includes(data.action),400,'Vælg rettelse eller aflysning.');
 ensure(data.action!=='cancel'||row.published_json,400,'Arrangementet er endnu ikke offentligt.');
 const event=data.action==='cancel'?JSON.parse(row.published_json):validateEvent(data.event||{},{allowPast:true});
 const kind=data.action==='cancel'?'cancel':row.published_json?'edit':'new',stamp=now(),revision=row.revision+1;
 await rate(env,'event-edit:'+id,20);
 const condition='EXISTS(SELECT 1 FROM events WHERE id=? AND revision=? AND updated_at=?)',args=[id,revision,stamp];
 const mail=await eventMail(env,{id,revision,event,email:row.contact_email,kind,condition,args});
 const result=await env.DB.batch([stmt(env,`UPDATE events SET pending_json=?,pending_kind=?,status='pending',revision=revision+1,moderation_note='',notification_state='pending',updated_at=? WHERE id=? AND revision=? AND author_hash=? AND created_by IS NULL`,JSON.stringify(event),kind,stamp,id,row.revision,row.author_hash),...mail.statements]);
 ensure(result[0].meta.changes>0,409,'Arrangementet er ændret. Genindlæs siden.');
 await deliverKeys(env,mail.keys);
 return json({saved:true,...privateData(await stmt(env,'SELECT * FROM events WHERE id=?',id).first())});
}
export async function memberUpdate(env,auth,id,data){
 const row=await stmt(env,'SELECT * FROM events WHERE id=?',id).first();ensure(row,404,'Arrangementet findes ikke.');
 // Guest submissions remain TEB-owned even if they name a real association.
 const g=await requireAccess(env,auth,row.association_id);
 ensure(data.revision===row.revision,409,'Arrangementet er ændret. Genindlæs siden.');
 ensure(['update','edit','cancel'].includes(data.action),400,'Vælg rettelse eller aflysning.');
 ensure(data.action!=='cancel'||row.published_json,400,'Arrangementet er endnu ikke offentligt.');
 const associationId=data.associationId||row.association_id;
 ensure(associationId===row.association_id||auth.user.is_admin,403,'Arrangementet kan ikke flyttes til en anden forening.');
 const a=associationId?await stmt(env,'SELECT name FROM associations WHERE id=?',associationId).first():null;
 ensure(!associationId||a,404,'Foreningen findes ikke.');
 const event=data.action==='cancel'?JSON.parse(row.published_json):validateEvent({...data.event,...(a?{association:a.name}:{})},{allowPast:true});
 if(associationId)event.associationId=associationId;
 if(row.published_json){const previous=JSON.parse(row.published_json);if(previous.postId){event.postId=previous.postId;event.printRequested=previous.printRequested;}}
 event.state=data.action==='cancel'?'cancelled':'approved';
 const result=await stmt(env,`UPDATE events SET published_json=?,pending_json=NULL,pending_kind=NULL,status=?,moderation_note='',revision=revision+1,association_id=?,updated_at=? WHERE id=? AND revision=? AND ${g.sql}`,
 JSON.stringify(event),event.state==='cancelled'?'approved':event.state,associationId,now(),id,row.revision,...g.args).run();
 ensure(result.meta.changes>0,409,'Arrangementet er ændret, eller din adgang er ophørt.');
 return json({saved:true,...privateData(await stmt(env,'SELECT * FROM events WHERE id=?',id).first())});
}
export async function review(env,auth,id,data){
 const g=await requireAccess(env,auth),row=await stmt(env,'SELECT * FROM events WHERE id=?',id).first();
 ensure(row,404,'Arrangementet findes ikke.');ensure(row.pending_kind&&data.revision===row.revision,409,'Arrangementet er allerede behandlet eller ændret.');
 ensure(['approve','reject'].includes(data.action),400,'Vælg Godkend eller Afvis.');
 const note=field(data,'note',500,data.action==='reject'),revision=row.revision+1,stamp=now();
 let published=row.published_json,event=JSON.parse(row.pending_json||row.published_json);
 if(data.action==='approve'){
  event=row.pending_kind==='cancel'?JSON.parse(row.published_json):validateEvent({...event,...data.event},{allowPast:true});
  if(row.published_json){const previous=JSON.parse(row.published_json);if(previous.postId){event.postId=previous.postId;event.printRequested=previous.printRequested;}}
  event.state=row.pending_kind==='cancel'?'cancelled':'approved';published=JSON.stringify(event);
 }
 const status=data.action==='approve'?'approved':'rejected';
 const condition='EXISTS(SELECT 1 FROM events WHERE id=? AND revision=? AND updated_at=?)',args=[id,revision,stamp];
 const mail=await eventMail(env,{id,revision,event,email:row.contact_email,kind:data.action,note,review:true,condition,args});
 const results=await env.DB.batch([stmt(env,`UPDATE events SET published_json=?,pending_json=?,pending_kind=NULL,status=?,moderation_note=?,revision=revision+1,receipt_state='pending',updated_at=? WHERE id=? AND revision=? AND pending_kind IS NOT NULL AND ${g.sql}`,
 published,data.action==='reject'?row.pending_json:null,status,note,stamp,id,row.revision,...g.args),...mail.statements]);
 ensure(results[0].meta.changes>0,409,'En anden redaktør har behandlet arrangementet, eller din adgang er ophørt.');
 await deliverKeys(env,mail.keys);return json({saved:true,status});
}
export async function myEvents(env,auth){
 const rows=await all(stmt(env,`SELECT e.* FROM events e WHERE EXISTS(SELECT 1 FROM memberships m WHERE m.association_id=e.association_id AND m.user_id=? AND m.status='active') ORDER BY e.updated_at DESC`,auth.user.id));
 return json({events:rows.map(privateData)});
}
export async function adminEvents(env,auth){
 await requireAccess(env,auth);
 const rows=await all(stmt(env,'SELECT * FROM events ORDER BY CASE WHEN pending_kind IS NOT NULL THEN 0 ELSE 1 END,updated_at DESC'));
 const events=rows.map(r=>({...privateData(r),createdAt:r.created_at,updatedAt:r.updated_at}));
 for(const event of events)event.possibleDuplicates=events.filter(other=>other.id!==event.id&&other.data.date===event.data.date&&(other.data.title.toLocaleLowerCase('da')===event.data.title.toLocaleLowerCase('da')||other.data.association.toLocaleLowerCase('da')===event.data.association.toLocaleLowerCase('da'))).map(other=>({id:other.id,title:other.data.title}));
 return json({events});
}
