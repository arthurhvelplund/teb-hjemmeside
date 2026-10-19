import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from '../scripts/sqlite.mjs';
import {localR2} from '../scripts/r2.mjs';
import {handleApi} from '../src/api.mjs';
import {token,copenhagenDate} from '../src/shared.mjs';
import {parsePulsen,createNewsService} from '../src/news.mjs';
import {snapshot} from '../src/editions.mjs';
import {groupNewsSources} from '../../site/js/feed-data.js';

function fixture(t){
 const DB=database();t.after(()=>DB.close());
 const origin='http://localhost:8799',env={DB,PDFS:localR2(),PUBLIC_ORIGIN:origin,LOCAL_PREVIEW:'true',EDITOR_EMAIL:'admin@example.test',TEB_ADMIN_EMAILS:'admin@example.test',EMAIL_FROM:'local@example.test',MAIL_ENCRYPTION_KEY:token()};
 function client(){let cookie='';const ip=crypto.randomUUID();
  const call=(path,data,headers={})=>handleApi(new Request(origin+'/api/kalender'+path,{method:data?'POST':'GET',headers:{'CF-Connecting-IP':ip,...(cookie?{Cookie:cookie}:{}),...(data?{Origin:origin,'Content-Type':'application/json'}:{}),...headers},...(data?{body:JSON.stringify(data)}:{})}),env);
  const login=async(email='admin@example.test')=>{
   const ch=await (await call('/auth/request',{email})).json();
   const mail=(await (await call('/local-mail')).json()).messages.find(m=>m.recipient===email&&m.subject==='Din engangskode til TEB');
   const r=await call('/auth/verify',{challengeId:ch.challengeId,code:mail.body.match(/\b\d{6}\b/)[0]});assert.equal(r.status,200);cookie=r.headers.get('Set-Cookie').split(';')[0];return r.json();
  };return {call,login};
 }
 return {env,DB,client,guest:client(),admin:client()};
}
const payload=(extra={})=>({requestKey:crypto.randomUUID(),authorToken:token(),startedAt:Date.now()-5000,email:'guest@example.test',post:{kind:'both',title:'Prøve: fællesspisning',author:'Testforeningen',description:'Et eksempel til forsøget.',body:'Hele historien\nMed et ekstra afsnit.',image:'https://example.test/photo.jpg',date:copenhagenDate(),time:'18:00',location:'Testhuset',print:true,channels:['flyers','screens']},...extra});
async function ok(r,status=200){assert.equal(r.status,status,await r.clone().text());return r.json();}

test('experiment guest stays private; TEB receives mail and can approve once; one record appears in news and calendar',async t=>{
 const f=fixture(t),p=payload(),created=await ok(await f.guest.call('/experiment/posts',p),201);
 assert.equal(created.published,false);assert.deepEqual((await ok(await f.guest.call('/experiment/posts'))).posts,[]);
 assert.equal((await f.guest.call('/experiment/admin/posts')).status,401);
 const messages=(await ok(await f.guest.call('/local-mail'))).messages;
 assert.equal(messages.length,2);assert.ok(messages.some(m=>m.recipient==='admin@example.test'&&m.body.includes('#godkendelse')));
 await f.admin.login();const pending=(await ok(await f.admin.call('/experiment/admin/posts'))).posts;
 assert.equal(pending[0].id,created.id);assert.equal(pending[0].body,p.post.body);assert.equal(pending[0].print,true);
 await ok(await f.admin.call('/experiment/admin/posts/'+created.id,{action:'approve',revision:1}));
 const posts=(await ok(await f.guest.call('/experiment/posts'))).posts;
 assert.equal(posts.length,1);assert.equal(posts[0].kind,'both');assert.equal(posts[0].date,p.post.date);
 assert.ok(!JSON.stringify(posts).includes('guest@example.test'));assert.ok(!JSON.stringify(posts).includes(p.authorToken));
 assert.equal((await f.admin.call('/experiment/admin/posts/'+created.id,{action:'approve',revision:1})).status,409);
 assert.equal((await ok(await f.guest.call('/events'))).events.length,0,'experiment never changes stable calendar');
});
test('retries create one post and two mail jobs, changed payload cannot reuse key',async t=>{
 const f=fixture(t),p=payload();const results=await Promise.all([f.guest.call('/experiment/posts',p),f.guest.call('/experiment/posts',p)]);
 const records=await Promise.all(results.map(r=>ok(r,201)));assert.equal(records[0].id,records[1].id);
 assert.equal((await f.DB.prepare('SELECT count(*) AS n FROM experiment_posts').first()).n,1);
 assert.equal((await f.DB.prepare('SELECT count(*) AS n FROM mail_jobs').first()).n,2);
 await ok(await f.guest.call('/experiment/posts',p));
 assert.equal((await f.guest.call('/experiment/posts',{...p,post:{...p.post,title:'Changed'}})).status,409);
});
test('a verified member publishes canonical identity; revocation prevents retry and another association is denied',async t=>{
 const f=fixture(t);await f.admin.login();
 const {association:a}=await ok(await f.admin.call('/admin/associations',{requestKey:crypto.randomUUID(),association:{name:'Den rigtige forening'}}));
 await ok(await f.admin.call('/admin/associations/'+a.id+'/members',{email:'member@example.test',role:'editor',name:'Testmedlem'}));
 const member=f.client();await member.login('member@example.test');
 const p=payload({associationId:a.id});const created=await ok(await member.call('/experiment/posts',p),201);assert.equal(created.published,true);
 const pub=(await ok(await f.guest.call('/experiment/posts'))).posts[0];assert.equal(pub.author,'Den rigtige forening');
 assert.equal((await member.call('/experiment/posts',payload({associationId:crypto.randomUUID()}))).status,403);
 await f.DB.prepare("UPDATE memberships SET status='revoked' WHERE association_id=?").bind(a.id).run();
 assert.equal((await member.call('/experiment/posts',p)).status,403);
});
test('email login alone never grants publishing rights; news needs no event date; reject remains private',async t=>{
 const f=fixture(t);await f.guest.login('outsider@example.test');
 const p=payload();p.post={kind:'news',title:'Nyhed uden dato',author:'Afsender',description:'En nyhed',print:true};
 const saved=await ok(await f.guest.call('/experiment/posts',p),201);assert.equal(saved.published,false);
 await f.admin.login();await ok(await f.admin.call('/experiment/admin/posts/'+saved.id,{action:'reject',revision:1}));
 assert.deepEqual((await ok(await f.guest.call('/experiment/posts'))).posts,[]);
 const stored=JSON.parse((await f.DB.prepare('SELECT data_json FROM experiment_posts WHERE id=?').bind(saved.id).first()).data_json);assert.equal(stored.print,false);assert.equal(stored.date,undefined);
});
test('unsafe links, honeypots, invalid dates and unknown sharing channels are rejected; production lab API stays closed',async t=>{
 const f=fixture(t);
 for(const change of [{image:'javascript:alert(1)'},{link:'https://user:pass@example.test/'},{date:'2026-02-30'},{channels:['unknown']},{kind:'unknown'}]){
  const p=payload();Object.assign(p.post,change);assert.equal((await f.guest.call('/experiment/posts',p)).status,400);
 }
 assert.equal((await f.guest.call('/experiment/posts',payload({website:'spam'}))).status,400);
 assert.equal((await f.guest.call('/experiment/posts',payload(),{Origin:'https://evil.test'})).status,403);
 f.env.LOCAL_PREVIEW='false';assert.equal((await f.guest.call('/experiment/posts')).status,404);
});
test('Pulsen source extracts original news and dated events, ignores scripts, foreign URLs and duplicate cards',async()=>{
 const story='<article class="city-story" data-puls-content-id="1"><a href="/nyhed/test"><img src="/image-cache/variants/ab/test.avif"></a><h3><a href="/nyhed/test">En <em>historie</em><script>bad()</script></a></h3><p class="city-teaser">Kort beskrivelse</p></article>';
 const event='<article class="city-event"><time datetime="2026-10-19T14:00:00+02:00"></time><h3><a href="/event/test/2026-10-19">Prøvebegivenhed</a></h3><p class="city-card-meta">Tistrup</p></article>';
 const result=parsePulsen(story+story+event+event+story.replaceAll('/nyhed/test','https://evil.test/nyhed/test'));
 assert.equal(result.items.length,1);assert.equal(result.items[0].title,'En historie');assert.equal(result.events.length,1);
 assert.equal(result.events[0].date,'2026-10-19');assert.equal(result.events[0].time,'14:00');assert.equal(result.events[0].location,'Tistrup');
 assert.throws(()=>parsePulsen('<h1>Changed markup</h1>'));
 const service=createNewsService({source:{id:'pulsen',name:'Pulsen i Vest',url:'https://pulsenivest.dk/by/tistrup'},parser:parsePulsen,fetcher:async()=>new Response(story+event,{headers:{'Content-Type':'text/html'}})});
 const bucket=localR2(),data=await service(bucket);assert.equal(data.events.length,1);assert.ok(await bucket.get('news/pulsen-v1.json'));
});
test('syndicated long headlines retain both source links while generic short titles stay separate',()=>{
 const title='Fælles arbejdsdag i Tistrup Anlæg på søndag';
 const items=[{title,sourceId:'tistrup-nyt',sourceName:'Tistrup Nyt',url:'https://tistrupnyt.dk/id/123/test'},
  {title: title.toUpperCase(),sourceId:'pulsen',sourceName:'Pulsen i Vest',url:'https://pulsenivest.dk/nyhed/test'},
  {title:'Generalforsamling',sourceId:'a',url:'https://example.test/a'},
  {title:'Generalforsamling',sourceId:'b',url:'https://example.test/b'}];
 const grouped=groupNewsSources(items);assert.equal(grouped.length,3);assert.equal(grouped[0].alsoSources[0].url,items[1].url);
 assert.equal(grouped[0].sourceName,'Tistrup Nyt');assert.equal(items[0].alsoSources,undefined);
});

test('real posts share a canonical event and print history; sandbox remains separate',async t=>{
 const f=fixture(t),p=payload(),saved=await ok(await f.guest.call('/posts',p),201);
 assert.equal((await ok(await f.guest.call('/events'))).events.length,0);
 assert.equal((await f.guest.call('/posts/'+saved.id)).status,404);
 await f.admin.login();await ok(await f.admin.call('/admin/posts/'+saved.id,{action:'approve',revision:1}));
 let events=(await ok(await f.guest.call('/events'))).events;
 assert.equal(events.length,1);assert.equal(events[0].id,saved.id);assert.equal(events[0].printRequested,true);
 assert.equal((await ok(await f.guest.call('/posts/'+saved.id))).post.body,p.post.body);
 assert.equal((await ok(await f.guest.call('/experiment/posts'))).posts.length,0);
 assert.equal((await snapshot(f.env,{start:p.post.date,end:p.post.date,deadline:copenhagenDate()})).events.length,1);
 const row=await f.DB.prepare('SELECT revision FROM events WHERE id=?').bind(saved.id).first();
 await ok(await f.admin.call('/member/events/'+saved.id,{action:'update',revision:row.revision,event:{...events[0],title:'Rettet i kalenderen'}}));
 const publicPost=(await ok(await f.guest.call('/posts'))).posts[0];assert.equal(publicPost.title,'Rettet i kalenderen');assert.equal(publicPost.body,p.post.body);assert.equal(publicPost.printRequested,true);
 await ok(await f.admin.call('/admin/posts/'+saved.id,{action:'withdraw',revision:2}));
 assert.equal((await ok(await f.guest.call('/posts'))).posts.length,0);assert.equal((await ok(await f.guest.call('/events'))).events[0].state,'cancelled');
});
test('real member publication is idempotent; print opt-out and news-only publication work',async t=>{
 const f=fixture(t);await f.admin.login();const p=payload();p.post.print=false;
 const saved=await ok(await f.admin.call('/posts',p),201);await ok(await f.admin.call('/posts',p));
 assert.equal((await ok(await f.guest.call('/events'))).events.length,1);
 assert.equal((await snapshot(f.env,{start:p.post.date,end:p.post.date,deadline:copenhagenDate()})).events.length,0);
 const news=payload();news.post={kind:'news',title:'En nyhed',author:'TEB',description:'Kun i nyhederne'};
 await ok(await f.admin.call('/posts',news),201);assert.equal((await ok(await f.guest.call('/events'))).events.length,1);
 assert.equal((await ok(await f.guest.call('/posts'))).posts.length,2);
 assert.equal((await f.DB.prepare('SELECT count(*) AS n FROM publications WHERE event_id=?').bind(saved.id).first()).n,1);
 f.env.LOCAL_PREVIEW='false';assert.equal((await f.guest.call('/posts')).status,200);assert.equal((await f.guest.call('/experiment/posts')).status,404);
});

test('real guest receipt keeps its secret in the fragment and follows approval into existing event editing',async t=>{
 const f=fixture(t),p=payload(),saved=await ok(await f.guest.call('/posts',p),201);
 const path='/posts/private/'+saved.id,headers={Authorization:'Bearer '+p.authorToken};
 assert.equal(saved.receiptState,'local');
 assert.equal((await f.guest.call(path)).status,404);
 assert.equal((await f.guest.call(path,undefined,{Authorization:'Bearer '+token()})).status,404);
 let status=await ok(await f.guest.call(path,undefined,headers));assert.equal(status.post.status,'pending');assert.equal(status.post.hasEvent,false);
 const mail=(await ok(await f.guest.call('/local-mail'))).messages.find(m=>m.recipient===p.email&&m.subject.startsWith('Modtaget:'));
 const url=new URL(mail.body.match(/https?:\/\/[^\s]+/)[0]);assert.equal(url.searchParams.get('privat'),saved.id);assert.equal(url.searchParams.has('adgang'),false);assert.equal(url.hash,'#adgang='+p.authorToken);
 assert.ok(!JSON.stringify(status).includes(p.authorToken));
 await f.admin.login();await ok(await f.admin.call('/admin/posts/'+saved.id,{action:'approve',revision:1}));
 status=await ok(await f.guest.call(path,undefined,headers));assert.equal(status.post.status,'approved');assert.equal(status.post.hasEvent,true);
 const event=await ok(await f.guest.call('/private/'+saved.id,undefined,headers));
 await ok(await f.guest.call('/private/'+saved.id,{action:'edit',revision:event.revision,event:{...event.data,title:'Gæstens rettelse'}},headers));
 const pending=await ok(await f.admin.call('/admin/events'));const revision=pending.events.find(e=>e.id===saved.id).revision;
 await ok(await f.admin.call('/admin/events/'+saved.id,{action:'approve',revision}));
 assert.equal((await ok(await f.guest.call('/posts/'+saved.id))).post.title,'Gæstens rettelse');
 const revised=await ok(await f.guest.call('/private/'+saved.id,undefined,headers));
 await ok(await f.guest.call('/private/'+saved.id,{action:'cancel',revision:revised.revision},headers));
 const cancellations=await ok(await f.admin.call('/admin/events'));await ok(await f.admin.call('/admin/events/'+saved.id,{action:'approve',revision:cancellations.events.find(e=>e.id===saved.id).revision}));
 assert.equal((await ok(await f.guest.call('/posts/'+saved.id))).post.state,'cancelled');
});
