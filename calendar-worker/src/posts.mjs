import { ensure, json, hash, now, validateEvent } from './shared.mjs';
import { stmt, all, field, emailAddress, rate, ipKey, local, loopback } from './db.mjs';
import { requireAccess } from './auth.mjs';
import { mailStatement, deliverKeys, mailState } from './mail.mjs';

export function validatePost(input) {
 ensure(input && ['event','news','both'].includes(input.kind),400,'Vælg arrangement, nyhed eller begge.');
 const data={kind:input.kind,title:field(input,'title',100,true),author:field(input,'author',100,true),
  description:field(input,'description',1500,true),body:field(input,'body',6000),image:field(input,'image',500),link:field(input,'link',500)};
 for(const key of ['image','link'])if(data[key]){
  let url;try{url=new URL(data[key]);}catch{ensure(false,400,'Brug en hel https-adresse.');}
  ensure(url.protocol==='https:'&&!url.username&&!url.password,400,'Brug en almindelig https-adresse.');data[key]=url.href;
 }
 if(input.kind!=='news'){
  const event=validateEvent({...input,association:data.author});
  for(const key of ['date','time','endDate','endTime','location','price'])data[key]=event[key];
 }
 ensure(!input.channels||Array.isArray(input.channels),400,'Vælg gyldige muligheder for deling.');
 const channels=[...new Set(input.channels||[])];
 ensure(channels.every(c=>['flyers','screens','portals','posters'].includes(c)),400,'Vælg gyldige muligheder for deling.');
 data.channels=channels;data.print=input.kind!=='news'&&input.print===true;
 return data;
}
const publicPost=row=>({id:row.id,...JSON.parse(row.data_json),...(row.event_json?JSON.parse(row.event_json):{}),createdAt:row.created_at});
function projectEvent(env,table,row,createdBy=null){
 const post=JSON.parse(row.data_json);
 if(post.kind==='news')return [];
 const event={...validateEvent({...post,association:post.author},{allowPast:true}),state:'approved',postId:row.id,printRequested:post.print};
 if(row.association_id)event.associationId=row.association_id;
 return [stmt(env,`INSERT OR IGNORE INTO events(id,request_key,request_hash,author_hash,contact_email,published_json,status,notification_state,receipt_state,created_at,updated_at,association_id,created_by)
 SELECT ?,?,?,?,?,?,'approved','not_required','not_required',?,?,?,? WHERE EXISTS(SELECT 1 FROM ${table} WHERE id=? AND status='approved' AND revision=?)`,row.id,'post:'+row.id,row.request_hash,row.owner_hash,row.contact_email,JSON.stringify(event),row.created_at,row.updated_at,row.association_id,createdBy,row.id,row.revision)];
}

// Both clients use the same validation and moderation. The legacy sandbox stays isolated.
export async function handlePosts(request,env,auth,route,data,{legacy=false}={}){
 const table=legacy?'experiment_posts':'posts';
 const page=legacy?'nyt-eksperiment.html':'kalender.html';
 if(legacy)route=route.replace('/experiment/','/');
 if(legacy)ensure(local(env)&&loopback(request.url)&&loopback(env.PUBLIC_ORIGIN),404,'Forsøget er kun til lokal afprøvning.');
 const method=request.method;
 const privateId=!legacy&&route.match(/^\/posts\/private\/([a-f0-9-]{36})$/);
 if(privateId&&method==='GET'){
  const token=request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  ensure(token,404,'Det private link er ugyldigt.');
  const row=await stmt(env,`SELECT p.*,e.published_json AS event_json FROM posts p LEFT JOIN events e ON e.id=p.id WHERE p.id=? AND p.owner_hash=? AND p.association_id IS NULL`,privateId[1],await hash(token)).first();
  ensure(row,404,'Det private link er ugyldigt.');
  return json({post:{...publicPost(row),status:row.status,hasEvent:Boolean(row.event_json)}});
 }
 if(route==='/posts'&&method==='GET')return json({posts:(await all(stmt(env,`SELECT p.*${legacy?'':',e.published_json AS event_json'} FROM ${table} p ${legacy?'':'LEFT JOIN events e ON e.id=p.id'} WHERE p.status='approved' ORDER BY p.created_at DESC LIMIT 200`))).map(publicPost)});
 const publicId=route.match(/^\/posts\/([a-f0-9-]{36})$/);
 if(publicId&&method==='GET'){
  const row=await stmt(env,`SELECT p.*${legacy?'':',e.published_json AS event_json'} FROM ${table} p ${legacy?'':'LEFT JOIN events e ON e.id=p.id'} WHERE p.id=? AND p.status='approved'`,publicId[1]).first();
  ensure(row,404,'Opslaget er ikke offentligt.');return json({post:publicPost(row)});
 }
 if(route==='/admin/posts'&&method==='GET'){
  await requireAccess(env,auth);
  return json({posts:(await all(stmt(env,`SELECT * FROM ${table} WHERE status='pending' ORDER BY created_at`))).map(r=>({...publicPost(r),revision:r.revision}))});
 }
 const match=route.match(/^\/admin\/posts\/([a-f0-9-]{36})$/);
 if(match&&method==='POST'){
  const g=await requireAccess(env,auth);
  ensure(['approve','reject','withdraw'].includes(data.action),400,'Vælg Godkend, Afvis eller Fjern.');
  const row=await stmt(env,`SELECT * FROM ${table} WHERE id=?`,match[1]).first();
  ensure(row,404,'Opslaget findes ikke.');
  ensure(row.revision===data.revision&&(data.action==='withdraw'?row.status==='approved':row.status==='pending'),409,'Opslaget er allerede behandlet.');
  const status={approve:'approved',reject:'rejected',withdraw:'withdrawn'}[data.action],stamp=now();
  const key=`experiment:${row.id}:decision:${row.revision}`;
  const guard=`EXISTS(SELECT 1 FROM ${table} WHERE id=? AND revision=? AND status=? AND updated_at=?)`;
  const message=await mailStatement(env,{dedupe:key,to:row.contact_email,subject:'Svar fra TEB: '+JSON.parse(row.data_json).title,
   text:`Dit opslag er ${status==='approved'?'godkendt':status==='rejected'?'afvist':'fjernet'}.\n${env.PUBLIC_ORIGIN}/${page}?opslag=${row.id}`,
   condition:guard,args:[row.id,row.revision+1,status,stamp]});
  const result=await env.DB.batch([stmt(env,`UPDATE ${table} SET status=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND status=? AND ${g.sql}`,status,stamp,row.id,row.revision,row.status,...g.args),...(!legacy&&status==='approved'?projectEvent(env,table,{...row,revision:row.revision+1,updated_at:stamp}):[]),...(!legacy&&status==='withdrawn'?[stmt(env,`UPDATE events SET published_json=json_set(published_json,'$.state','cancelled'),revision=revision+1,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM ${table} WHERE id=? AND status='withdrawn' AND revision=?)`,stamp,row.id,row.id,row.revision+1)]:[]),message]);
  ensure(result[0].meta.changes,409,'Opslaget er ændret, eller din adgang er ophørt.');
  await deliverKeys(env,[key]);return json({saved:true});
 }
 if(route==='/posts'&&method==='POST'){
  ensure(!data.website,400,'Indsendelsen kunne ikke modtages.');
  ensure(/^[a-f0-9-]{36}$/.test(data.requestKey||''),400,'Genindlæs formularen.');
  const member=Boolean(auth.user&&(data.associationId||auth.user.is_admin));
  let g,association;
  if(member){g=await requireAccess(env,auth,data.associationId||null);if(data.associationId){association=await stmt(env,'SELECT name FROM associations WHERE id=?',data.associationId).first();ensure(association,404,'Foreningen findes ikke.');}}
  else ensure(/^[a-f0-9]{64}$/.test(data.authorToken||''),400,'Genindlæs formularen.');
  const post=validatePost({...data.post,...(association?{author:association.name}:{})});
  const email=member?auth.user.email:emailAddress(data.email);
  const owner=await hash(member?'member:'+auth.user.id:data.authorToken);
  const signature=await hash(JSON.stringify([post,email,data.associationId||null]));
  const old=await stmt(env,`SELECT * FROM ${table} WHERE request_key=?`,data.requestKey).first();
  const result=async(row,status=200)=>json({id:row.id,published:row.status==='approved',status:row.status,notificationState:member?'not_required':await mailState(env,'experiment:'+row.id+':editor'),receiptState:member?'not_required':await mailState(env,'experiment:'+row.id+':receipt')},status);
  if(old){ensure(old.owner_hash===owner&&old.request_hash===signature,409,'Nøglen er allerede brugt til en anden indsendelse.');return result(old);}
  if(!member)ensure(typeof data.startedAt==='number'&&Date.now()-data.startedAt>=1500&&Date.now()-data.startedAt<86400000,400,'Vent et øjeblik, og prøv igen.');
  await rate(env,'experiment:'+await ipKey(request),30);
  const id=crypto.randomUUID(),stamp=now(),status=member?'approved':'pending';
  const messages=[];
  const condition=`EXISTS(SELECT 1 FROM ${table} WHERE id=?)`;
  if(!member){
   for(const [suffix,to,subject,text] of [
    ['editor',env.EDITOR_EMAIL,'Opslag til godkendelse: '+post.title,`Et opslag afventer TEB.\n${post.title}\nOplyst afsender: ${post.author}\nTilknytningen er ikke verificeret.\nLog ind og gennemgå: ${env.PUBLIC_ORIGIN}/${page}#godkendelse`],
    ['receipt',email,'Modtaget: '+post.title,`Dit opslag afventer TEBs godkendelse. Ingen ekstern deling er bestilt.\n${post.title}\n${legacy?env.PUBLIC_ORIGIN+'/'+page:env.PUBLIC_ORIGIN+'/kalender.html?indsendelse='+id+'#adgang='+data.authorToken}\n${legacy?'':'Gem dit private link, og del det kun med dem, der må følge og rette indsendelsen.'}`]
   ])messages.push({key:`experiment:${id}:${suffix}`,statement:await mailStatement(env,{dedupe:`experiment:${id}:${suffix}`,to,subject,text,condition,args:[id]})});
  }
  const operations=[stmt(env,`INSERT OR IGNORE INTO ${table}(id,request_key,request_hash,owner_hash,contact_email,association_id,data_json,status,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE ${member?g.sql:'1'}`,id,data.requestKey,signature,owner,email,data.associationId||null,JSON.stringify(post),status,stamp,stamp,...(member?g.args:[])),...(!legacy&&member?projectEvent(env,table,{id,request_hash:signature,owner_hash:owner,contact_email:email,association_id:data.associationId||null,data_json:JSON.stringify(post),created_at:stamp,updated_at:stamp,revision:1},auth.user.id):[]),...messages.map(m=>m.statement)];
  const results=await env.DB.batch(operations);
  const saved=await stmt(env,`SELECT * FROM ${table} WHERE request_key=?`,data.requestKey).first();
  ensure(saved&&saved.owner_hash===owner&&saved.request_hash===signature,409,'Indsendelsen er ændret, eller din adgang er ophørt.');
  if(results[0].meta.changes)await deliverKeys(env,messages.map(m=>m.key));
  return result(saved,201);
 }
 ensure(false,404,'Siden findes ikke.');
}
