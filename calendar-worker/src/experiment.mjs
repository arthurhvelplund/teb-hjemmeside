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
const publicPost=row=>({id:row.id,...JSON.parse(row.data_json),createdAt:row.created_at});

// This experiment is explicitly local. A production deployment exposes no lab API.
export async function experiment(request,env,auth,route,data){
 ensure(local(env)&&loopback(request.url)&&loopback(env.PUBLIC_ORIGIN),404,'Forsøget er kun til lokal afprøvning.');
 const method=request.method;
 if(route==='/experiment/posts'&&method==='GET')return json({posts:(await all(stmt(env,"SELECT * FROM experiment_posts WHERE status='approved' ORDER BY created_at DESC LIMIT 200"))).map(publicPost)});
 if(route==='/experiment/admin/posts'&&method==='GET'){
  await requireAccess(env,auth);
  return json({posts:(await all(stmt(env,"SELECT * FROM experiment_posts WHERE status='pending' ORDER BY created_at"))).map(r=>({...publicPost(r),revision:r.revision}))});
 }
 const match=route.match(/^\/experiment\/admin\/posts\/([a-f0-9-]{36})$/);
 if(match&&method==='POST'){
  const g=await requireAccess(env,auth);
  ensure(['approve','reject','withdraw'].includes(data.action),400,'Vælg Godkend, Afvis eller Fjern.');
  const row=await stmt(env,'SELECT * FROM experiment_posts WHERE id=?',match[1]).first();
  ensure(row,404,'Opslaget findes ikke.');
  ensure(row.revision===data.revision&&(data.action==='withdraw'?row.status==='approved':row.status==='pending'),409,'Opslaget er allerede behandlet.');
  const status={approve:'approved',reject:'rejected',withdraw:'withdrawn'}[data.action],stamp=now();
  const key=`experiment:${row.id}:decision:${row.revision}`;
  const guard='EXISTS(SELECT 1 FROM experiment_posts WHERE id=? AND revision=? AND status=? AND updated_at=?)';
  const message=await mailStatement(env,{dedupe:key,to:row.contact_email,subject:'Svar fra TEB: '+JSON.parse(row.data_json).title,
   text:`Dit prøveopslag er ${status==='approved'?'godkendt':status==='rejected'?'afvist':'fjernet'}.\n${env.PUBLIC_ORIGIN}/nyt-eksperiment.html?opslag=${row.id}`,
   condition:guard,args:[row.id,row.revision+1,status,stamp]});
  const result=await env.DB.batch([stmt(env,`UPDATE experiment_posts SET status=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND status=? AND ${g.sql}`,status,stamp,row.id,row.revision,row.status,...g.args),message]);
  ensure(result[0].meta.changes,409,'Opslaget er ændret, eller din adgang er ophørt.');
  await deliverKeys(env,[key]);return json({saved:true});
 }
 if(route==='/experiment/posts'&&method==='POST'){
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
  const old=await stmt(env,'SELECT * FROM experiment_posts WHERE request_key=?',data.requestKey).first();
  const result=async(row,status=200)=>json({id:row.id,published:row.status==='approved',status:row.status,notificationState:member?'not_required':await mailState(env,'experiment:'+row.id+':editor')},status);
  if(old){ensure(old.owner_hash===owner&&old.request_hash===signature,409,'Nøglen er allerede brugt til en anden indsendelse.');return result(old);}
  if(!member)ensure(typeof data.startedAt==='number'&&Date.now()-data.startedAt>=1500&&Date.now()-data.startedAt<86400000,400,'Vent et øjeblik, og prøv igen.');
  await rate(env,'experiment:'+await ipKey(request),30);
  const id=crypto.randomUUID(),stamp=now(),status=member?'approved':'pending';
  const messages=[];
  const condition='EXISTS(SELECT 1 FROM experiment_posts WHERE id=?)';
  if(!member){
   for(const [suffix,to,subject,text] of [
    ['editor',env.EDITOR_EMAIL,'Prøveopslag til godkendelse: '+post.title,`Et prøveopslag afventer TEB.\n${post.title}\nOplyst afsender: ${post.author}\nTilknytningen er ikke verificeret.\nLog ind og gennemgå: ${env.PUBLIC_ORIGIN}/nyt-eksperiment.html#godkendelse`],
    ['receipt',email,'Modtaget: '+post.title,`Dit prøveopslag afventer TEBs godkendelse. Ingen ekstern deling er bestilt.\n${post.title}\n${env.PUBLIC_ORIGIN}/nyt-eksperiment.html`]
   ])messages.push({key:`experiment:${id}:${suffix}`,statement:await mailStatement(env,{dedupe:`experiment:${id}:${suffix}`,to,subject,text,condition,args:[id]})});
  }
  const operations=[stmt(env,`INSERT OR IGNORE INTO experiment_posts(id,request_key,request_hash,owner_hash,contact_email,association_id,data_json,status,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE ${member?g.sql:'1'}`,id,data.requestKey,signature,owner,email,data.associationId||null,JSON.stringify(post),status,stamp,stamp,...(member?g.args:[])),...messages.map(m=>m.statement)];
  const results=await env.DB.batch(operations);
  const saved=await stmt(env,'SELECT * FROM experiment_posts WHERE request_key=?',data.requestKey).first();
  ensure(saved&&saved.owner_hash===owner&&saved.request_hash===signature,409,'Indsendelsen er ændret, eller din adgang er ophørt.');
  if(results[0].meta.changes)await deliverKeys(env,messages.map(m=>m.key));
  return result(saved,201);
 }
 ensure(false,404,'Siden findes ikke.');
}
