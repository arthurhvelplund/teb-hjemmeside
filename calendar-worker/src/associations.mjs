import { ensure, now, json, hash } from './shared.mjs';
import { stmt, all, field, emailAddress, rate } from './db.mjs';
import { guard, requireAccess, associationData } from './auth.mjs';
import { mailStatement, deliverKeys, mailState } from './mail.mjs';
import { storedImagePath } from './association-images.mjs';
export function validateAssociation(input){
 const result={};
 for(const [key,max,required] of [['name',100,true],['category',100],['description',3000],['chair',150],['email',254],['phone',60],['website',500],['place',180]])result[key]=field(input,key,max,required);
 if(result.email)result.email=emailAddress(result.email);
 if(result.website){let url;try{url=new URL(result.website);}catch{}ensure(url&&['http:','https:'].includes(url.protocol)&&!url.username&&!url.password,400,'Skriv en gyldig hjemmesideadresse.');result.website=url.href;}
 result.imageUrl=field(input,'imageUrl',1000);
 if(result.imageUrl){
  const local=(/^\/images\/[^\\\s?#]+$/.test(result.imageUrl)&&!result.imageUrl.includes('..'))||storedImagePath.test(result.imageUrl);
  let url;try{url=new URL(result.imageUrl);}catch{}
  ensure(local||(url?.protocol==='https:'&&!url.username&&!url.password&&!/[\\\u0000-\u0020]/.test(result.imageUrl)),400,'Brug et billedlink, der begynder med https://, eller et billede fra hjemmesiden.');
  if(!local)result.imageUrl=url.href;
 }
 return result;
}
export async function associations(env,id){
 if(id){const row=await stmt(env,'SELECT * FROM associations WHERE id=?',id).first();ensure(row,404,'Foreningen findes ikke.');return json({association:associationData(row)});}
 return json({associations:(await all(stmt(env,'SELECT * FROM associations ORDER BY name COLLATE NOCASE'))).map(associationData)});
}
export async function saveAssociation(env,auth,id,data){
 const g=await requireAccess(env,auth,id);
 const a=validateAssociation(data.association);
 ensure(Number.isInteger(data.revision),400,'Genindlæs foreningens oplysninger.');
 const {imageUrl,...fields}=a;
 const result=await stmt(env,`UPDATE associations SET name=?,category=?,description=?,chair=?,email=?,phone=?,website=?,place=?,image_url=COALESCE(?,image_url),revision=revision+1,updated_at=? WHERE id=? AND revision=? AND ${g.sql}`,...Object.values(fields),Object.hasOwn(data.association,'imageUrl')?imageUrl:null,now(),id,data.revision,...g.args).run();
 ensure(result.meta.changes===1,409,'Foreningen er ændret, eller din adgang er ophørt. Genindlæs siden.');
 return associations(env,id);
}
export async function createAssociation(env,auth,data){
 const g=await requireAccess(env,auth),a=validateAssociation(data.association);
 ensure(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(data.requestKey||''),400,'Genindlæs formularen og prøv igen.');
 // Validation fixes field order and normalizes contacts before hashing. Keep the
 // original hash even when the public profile is subsequently edited.
 const {imageUrl,...legacyFields}=a;
 const requestHash=await hash(JSON.stringify(imageUrl?a:legacyFields)),id=crypto.randomUUID(),stamp=now();
 await stmt(env,`INSERT OR IGNORE INTO associations(id,name,category,description,chair,email,phone,website,place,image_url,created_at,updated_at,creation_request_key,creation_actor,creation_hash)
 SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${g.sql}`,id,...Object.values(a),stamp,stamp,data.requestKey,auth.user.id,requestHash,...g.args).run();
 const row=await stmt(env,`SELECT *,(${g.sql}) AS permitted FROM associations WHERE creation_request_key=?`,...g.args,data.requestKey).first();
 ensure(row?.permitted,403,'Din adgang er ophørt.');
 ensure(row.creation_actor===auth.user.id&&row.creation_hash===requestHash,409,'Nøglen er allerede brugt til en anden oprettelse. Genindlæs formularen.');
 return json({association:associationData(row)});
}
export async function members(env,auth,id){
 await requireAccess(env,auth,id);
 const rows=await all(stmt(env,`SELECT m.id,m.email,m.name,m.role,m.status,i.expires_at AS invitationExpiresAt,j.state AS invitationDeliveryState
 FROM memberships m LEFT JOIN invitations i ON i.id=m.invitation_id LEFT JOIN mail_jobs j ON j.dedupe_key='invitation:'||i.id
 WHERE m.association_id=? AND m.status IN ('active','invited') ORDER BY m.role DESC,m.name,m.email`,id));
 return json({members:rows});
}
// Invitationer har ingen aktiveringsfrist. Den eksisterende NOT NULL-datokolonne bruger en fjern slutdato.
export async function invitationStatements(env,{associationId,email,name,role,g,replaceRole=false,associationName='',condition='1',args=[]}){
 const id=crypto.randomUUID(),membershipId=crypto.randomUUID(),stamp=now(),expiry='9999-12-31T23:59:59.999Z';
 const conditionSql=`${g.sql} AND (${condition})`;
 const conditionArgs=[...g.args,...args];
 const active=`EXISTS(SELECT 1 FROM memberships WHERE association_id=? AND email=? AND invitation_id=?)`;
 const activeArgs=[associationId,email,id];
 const a=await stmt(env,'SELECT name FROM associations WHERE id=?',associationId).first();
 const job=await mailStatement(env,{dedupe:'invitation:'+id,to:email,subject:'Invitation til '+(a?.name||associationName||'din forening'),text:`Hej ${name||email}\n\nDu er inviteret til at få adgang til ${a?.name||associationName||'din forening'} på TEBs hjemmeside. Med adgangen kan du oprette arrangementer, rette foreningens side og invitere andre.\nÅbn ${env.PUBLIC_ORIGIN}/forening.html og log ind med denne e-mailadresse. Bed om en ny engangskode efter invitationen.`,expiresAt:expiry,condition:active,args:activeArgs});
 return {id,membershipId,statements:[
  stmt(env,`INSERT INTO memberships(id,association_id,email,name,role,status,invited_at,invitation_id) SELECT ?,?,?,?,?,'invited',?,? WHERE ${conditionSql}
  ON CONFLICT(association_id,email) DO UPDATE SET name=excluded.name,role=excluded.role,status='invited',invited_at=excluded.invited_at,invitation_id=excluded.invitation_id,revoked_at=NULL,user_id=NULL,activated_at=NULL
  WHERE memberships.status='revoked' OR (memberships.status='invited' AND NOT EXISTS(SELECT 1 FROM invitations WHERE membership_id=memberships.id AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>?)) OR (?=1 AND memberships.role!=excluded.role)`,membershipId,associationId,email,name,role,stamp,id,...conditionArgs,stamp,replaceRole?1:0),
  stmt(env,`UPDATE mail_jobs SET state='cancelled',updated_at=? WHERE state IN ('pending','failed') AND dedupe_key IN (SELECT 'invitation:'||id FROM invitations WHERE membership_id IN (SELECT id FROM memberships WHERE association_id=? AND email=? AND invitation_id=?))`,stamp,...activeArgs),
  stmt(env,`UPDATE invitations SET revoked_at=? WHERE accepted_at IS NULL AND revoked_at IS NULL AND membership_id IN (SELECT id FROM memberships WHERE association_id=? AND email=? AND invitation_id=?)`,stamp,...activeArgs),
  stmt(env,`INSERT INTO invitations(id,membership_id,email,created_at,expires_at) SELECT ?,id,?,?,? FROM memberships WHERE association_id=? AND email=? AND invitation_id=?`,id,email,stamp,expiry,...activeArgs),job
 ]};
}
// Alle med adgang til en forening har de samme rettigheder. Rollen gemmes kun af hensyn til ældre rækker.
export async function invite(env,auth,associationId,data,adminOnly=false){
 const g=await requireAccess(env,auth,adminOnly?null:associationId);
 ensure(await stmt(env,'SELECT id FROM associations WHERE id=?',associationId).first(),404,'Foreningen findes ikke.');
 const email=emailAddress(data.email),name=field(data,'name',150),role='manager';
 await rate(env,'invite:'+auth.user.id,30);
 const existing=await stmt(env,'SELECT * FROM memberships WHERE association_id=? AND email=?',associationId,email).first();
 if(existing?.status==='active')return json({saved:true,deliveryState:'not_required'});
 const invitation=await invitationStatements(env,{associationId,email,name,role,g});
 const result=await env.DB.batch(invitation.statements);
 if(result[0].meta.changes!==1){
  const row=await stmt(env,`SELECT m.*,i.id AS live_invitation FROM memberships m JOIN invitations i ON i.id=m.invitation_id WHERE m.association_id=? AND m.email=? AND m.status='invited' AND i.revoked_at IS NULL AND i.accepted_at IS NULL AND i.expires_at>?`,associationId,email,now()).first();
  ensure(row,409,'Adgangen er allerede ændret. Genindlæs siden.');
  return json({saved:true,deliveryState:await mailState(env,'invitation:'+row.live_invitation)});
 }
 await deliverKeys(env,['invitation:'+invitation.id]);
 return json({saved:true,deliveryState:await mailState(env,'invitation:'+invitation.id)});
}
export async function revoke(env,auth,associationId,memberId){
 const g=await requireAccess(env,auth,associationId),stamp=now();
 const target=await stmt(env,'SELECT * FROM memberships WHERE id=? AND association_id=?',memberId,associationId).first();
 ensure(target,404,'Medlemmet findes ikke.');
 ensure(auth.user.is_admin||target.user_id!==auth.user.id,400,'Du kan ikke fjerne din egen adgang. Bed en anden i foreningen eller TEB om det.');
 const result=await env.DB.batch([
  stmt(env,`UPDATE memberships SET status='revoked',revoked_at=? WHERE id=? AND association_id=? AND ${g.sql}`,stamp,memberId,associationId,...g.args),
  stmt(env,`UPDATE mail_jobs SET state='cancelled',updated_at=? WHERE state IN ('pending','failed') AND dedupe_key IN (SELECT 'invitation:'||i.id FROM invitations i JOIN memberships m ON m.id=i.membership_id WHERE m.id=? AND m.status='revoked')`,stamp,memberId),
  stmt(env,`UPDATE invitations SET revoked_at=? WHERE membership_id=? AND revoked_at IS NULL AND EXISTS(SELECT 1 FROM memberships WHERE id=? AND status='revoked')`,stamp,memberId,memberId)
 ]);
 ensure(result[0].meta.changes===1,403,'Din adgang er ophørt.');return json({saved:true});
}
export function requestData(row){return {id:row.id,email:row.email,name:row.name,associationId:row.association_id,newAssociationName:row.new_association_name,roleNote:row.role_note,status:row.status,note:row.note};}
export async function accessRequests(env,auth,isAdmin=false){
 if(isAdmin)await requireAccess(env,auth);
 const rows=await all(stmt(env,`SELECT * FROM access_requests ${isAdmin?'':'WHERE user_id=?'} ORDER BY created_at DESC`,...(isAdmin?[]:[auth.user.id])));
 return json({requests:rows.map(requestData)});
}
export async function requestAccess(env,auth,data){
 const associationId=typeof data.associationId==='string'&&data.associationId?data.associationId:null,newName=field(data,'newAssociationName',100),name=field(data,'name',150,true),note=field(data,'roleNote',1000);
 ensure(Boolean(associationId)!==Boolean(newName),400,'Vælg en forening, eller skriv navnet på en ny.');
 const association=associationId?await stmt(env,'SELECT name FROM associations WHERE id=?',associationId).first():null;
 if(associationId)ensure(association,404,'Foreningen findes ikke.');
 await rate(env,'access-request:'+auth.user.id,10);
 const id=crypto.randomUUID(),dedupe='access-request:'+id;
 const recipients=[...new Set((env.ACCESS_REQUEST_EMAIL||env.TEB_ADMIN_EMAILS||'').split(',').map(email=>email.trim().toLowerCase()).filter(Boolean))];
 ensure(recipients.length,503,'TEBs mailmodtager er ikke konfigureret. Prøv igen senere.');
 const job=await mailStatement(env,{dedupe,to:recipients.length===1?recipients[0]:recipients,
  subject:'Adgangsanmodning: '+(association?.name||newName),
  text:`En person beder om adgang til en forening på TEBs hjemmeside.\n\nNavn: ${name}\nE-mail: ${auth.user.email}\nForening: ${association?.name||newName}${associationId?'':' (ny forening)'}\nRolle/besked: ${note||'Ikke oplyst'}\n\nKontrollér personens tilknytning og godkend eller afvis anmodningen i administrationen:\n${env.PUBLIC_ORIGIN}/forening.html#teb?fane=adgang\n\nAnmodningen giver ikke i sig selv adgang til foreningen.`,
  condition:'EXISTS(SELECT 1 FROM access_requests WHERE id=? AND user_id=?)',args:[id,auth.user.id]});
 // Persist the request and its encrypted notification together. The newly
 // inserted request ID prevents duplicate submissions from queuing more mail.
 const [result]=await env.DB.batch([stmt(env,`INSERT OR IGNORE INTO access_requests(id,user_id,email,name,association_id,new_association_name,role_note,created_at)
 SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM sessions WHERE hash=? AND expires_at>?)`,id,auth.user.id,auth.user.email,name,associationId,newName,note,now(),auth.sessionHash,now()),job]);
 if(!result.meta.changes){
  const existing=await stmt(env,"SELECT id,status FROM access_requests WHERE user_id=? AND ifnull(association_id,'')=? AND new_association_name=? AND status='pending'",auth.user.id,associationId||'',newName).first();
  ensure(existing,401,'Log ind igen.');await deliverKeys(env,['access-request:'+existing.id]);return json(existing);
 }
 await deliverKeys(env,[dedupe]);
 return json({id,status:'pending'},201);
}
export async function decideAccess(env,auth,id,data){
 const g=await requireAccess(env,auth),row=await stmt(env,'SELECT * FROM access_requests WHERE id=?',id).first();
 ensure(row,404,'Anmodningen findes ikke.');ensure(row.status==='pending',409,'Anmodningen er allerede behandlet.');
 ensure(['approve','reject'].includes(data.action),400,'Vælg Godkend eller Afvis.');
 ensure(data.action!=='approve'||data.verified===true,400,'Bekræft at TEB har verificeret den ansvarlige.');
 const note=field(data,'note',1000),stamp=now(),decision=crypto.randomUUID(),associationId=row.association_id||crypto.randomUUID(),status=data.action==='approve'?'approved':'rejected';
 const condition='EXISTS(SELECT 1 FROM access_requests WHERE id=? AND decision_key=?)',args=[id,decision];
 const operations=[stmt(env,`UPDATE access_requests SET status=?,verified=?,note=?,decided_at=?,decision_key=? WHERE id=? AND status='pending' AND ${g.sql}`,status,data.verified===true?1:0,note,stamp,decision,id,...g.args)];
 let invitation;
 if(status==='approved'){
  if(!row.association_id)operations.push(stmt(env,`INSERT INTO associations(id,name,created_at,updated_at) SELECT ?,?,?,? WHERE ${condition}`,associationId,row.new_association_name,stamp,stamp,...args));
  // Association is created in the same batch; invitation text uses request name.
  invitation=await invitationStatements(env,{associationId,email:row.email,name:row.name,role:'manager',g,replaceRole:true,associationName:row.new_association_name,condition,args});operations.push(...invitation.statements);
  operations.push(stmt(env,`UPDATE access_requests SET association_id=? WHERE id=? AND decision_key=?`,associationId,id,decision));
 }
 const results=await env.DB.batch(operations);ensure(results[0].meta.changes===1,409,'Anmodningen er allerede behandlet, eller din adgang er ophørt.');
 if(invitation)await deliverKeys(env,['invitation:'+invitation.id]);
 return json({saved:true,status,...(invitation?{deliveryState:await mailState(env,'invitation:'+invitation.id)}:{})});
}
