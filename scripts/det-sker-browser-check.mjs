// Repository browser workflow: isolated local API/database, real auth and UI,
// deterministic external-source fixtures. Never writes to the user's preview.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,rm,access,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {copenhagenDate} from '../calendar-worker/src/shared.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(resolve(root,'calendar-worker/package.json')),{chromium}=require('playwright');
const socket=createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(done=>socket.close(done));
const origin='http://localhost:'+port,runtime=await mkdtemp(join(tmpdir(),'teb-feed-'));
const output=resolve(root,'output/det-sker-eksperiment');await mkdir(output,{recursive:true});
const service=spawn(process.execPath,['scripts/dev.mjs'],{cwd:resolve(root,'calendar-worker'),env:{...process.env,PORT:String(port),CALENDAR_DATA_DIR:runtime},stdio:['ignore','ignore','pipe']});
let browser,stderr='';service.stderr.on('data',x=>stderr+=x);const errors=[],checks=[];
const check=(name,value=true)=>{assert.ok(value,name);checks.push(name);console.log('OK: '+name);};
const date=copenhagenDate(),future=new Date(date+'T12:00:00Z');future.setUTCDate(future.getUTCDate()+6);
const futureDate=future.toISOString().slice(0,10);
const news=Array.from({length:12},(_,i)=>({id:String(i),title:'Historie '+i+' fra den lokale testavis',summary:'En kort nyhed fra byen.',url:'https://tistrupnyt.dk/id/'+(100+i)+'/test'}));
async function call(context,path,data){const r=await context.request.fetch(origin+'/api/kalender'+path,{...(data?{method:'POST',data}:{}),headers:{Origin:origin}});const body=await r.json();assert.ok(r.ok(),JSON.stringify(body));return body;}
async function login(context,email){
 const challenge=await call(context,'/auth/request',{email});
 const {messages}=await call(context,'/local-mail');const mail=messages.find(m=>m.recipient===email&&m.subject==='Din engangskode til TEB');
 return call(context,'/auth/verify',{challengeId:challenge.challengeId,code:mail.body.match(/\b\d{6}\b/)[0]});
}
async function context(){
 const ctx=await browser.newContext({baseURL:origin,viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await ctx.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 await ctx.route('**/api/kalender/nyheder/*',route=>route.fulfill({json:{items:route.request().url().endsWith('/pulsen')?[]:news,events:route.request().url().endsWith('/pulsen')?[{id:'imported-event',title:'Arrangement fra Pulsen',date,time:'14:00',image:'https://images.example.test/event.jpg',location:'Tistrup',url:'https://pulsenivest.dk/event/test/'+date},{id:'next-week',title:'Arrangement om seks dage',date:futureDate,time:'12:00',location:'Tistrup',url:'https://pulsenivest.dk/event/future/'+futureDate}]:[],fetchedAt:new Date().toISOString(),stale:false}}));
 await ctx.route('https://images.example.test/event.jpg',route=>route.fulfill({path:resolve(root,'site/images/tistrup-torv.jpg')}));
 ctx.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));return ctx;
}
try{
 const deadline=Date.now()+45000;
 for(;;){if(service.exitCode!==null||Date.now()>deadline)throw Error('Local startup failed: '+stderr.slice(-800));try{if((await fetch(origin+'/api/kalender/config',{signal:AbortSignal.timeout(1000)})).ok)break;}catch{}await new Promise(done=>setTimeout(done,100));}
 let executablePath=process.env.CHROME_PATH;if(!executablePath&&process.platform==='darwin'){const path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';try{await access(path);executablePath=path;}catch{}}
 browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
 const guest=await context(),page=await guest.newPage();page.setDefaultTimeout(12000);
 await page.goto('/nyt.html');await page.locator('#ds-feed article').first().waitFor();
 assert.equal(await page.locator('#ds-feed article').count(),9);await page.locator('#ds-more').click();assert.equal(await page.locator('#ds-feed article').count(),12);
 await page.locator('#ds-search').fill('Nothing matches');assert.equal(await page.locator('#ds-feed article').count(),0);await page.locator('#ds-search').fill('');
 assert.equal(await page.locator('#ds-feed article a').count(),9);assert.equal(await page.getByText('Læs historien',{exact:true}).count(),0);
 assert.equal(await page.locator('#ds-reach').count(),0);assert.equal(await page.getByRole('button',{name:'År',exact:true}).count(),0);
 assert.equal(await page.locator('.ds-print summary').count(),1);
 assert.equal(await page.locator('#ds-week').getAttribute('aria-pressed'),'true');
 const strip=await page.locator('.calendar-week-strip').boundingBox();assert.ok(strip.y<360,'upcoming days appear near the top');
 await page.locator('.ds-print summary').click();assert.equal(await page.locator('.ds-print-archive').isVisible(),true);assert.ok(await page.locator('.ds-print summary img').count());await page.locator('.ds-print summary').click();
 const calendarTop=await page.locator('.ds-calendar').boundingBox(),newsTop=await page.locator('.ds-news').boundingBox();assert.ok(calendarTop.y<newsTop.y);
 assert.equal(await page.locator('.calendar-week-strip button').count(),7);
 assert.equal(await page.locator('.calendar-entry').filter({hasText:'Arrangement om seks dage'}).count(),1,'default week includes the next six days');
 await page.locator('.calendar-entry-image').first().waitFor();
 await page.locator('.calendar-week-strip button').first().click();assert.equal(await page.locator('.calendar-reset').isVisible(),true);await page.locator('.calendar-reset').click();
 check('compact landing, next seven days, photos, day selection, physical archive and direct news links');
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:resolve(output,'feed-'+width+'.png'),fullPage:true});await page.screenshot({path:resolve(output,'feed-top-'+width+'.png')});}
 check('desktop and mobile layout at 1440, 390 and 320 pixels');
 await page.setViewportSize({width:1440,height:1000});await page.locator('#ds-create').click();await page.locator('#ds-field-title').waitFor();
 for(const[name,value]of Object.entries({author:'Prøveforeningen',title:'Prøve: fællesspisning og historie',description:'Kort beskrivelse af fællesspisningen.',body:'Hele historien med ekstra information.',date,time:'18:00',location:'Prøvehuset',email:'guest@example.test'}))await page.locator('#ds-field-'+name).fill(value);
 await page.locator('#ds-print-choice').check();await page.locator('#ds-share-flyers').check();assert.ok((await page.locator('.ds-preview').innerText()).includes('Prøve: fællesspisning'));
 await page.screenshot({path:resolve(output,'composer-desktop.png'),fullPage:true});
 await page.setViewportSize({width:320,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:resolve(output,'composer-mobile.png'),fullPage:true});
 // First response is unreadable after a successful mutation. Retry must keep its key.
 let intercepted=false;
 await page.route('**/api/kalender/posts',async route=>{if(route.request().method()==='POST'&&!intercepted){intercepted=true;const response=await route.fetch();assert.equal(response.status(),201);await route.fulfill({status:201,contentType:'application/json',body:'{'});}else await route.continue();});
 await new Promise(done=>setTimeout(done,1600));await page.locator('.ds-form button[type=submit]').click();await page.getByRole('button',{name:'Prøv samme indsendelse igen'}).waitFor();await page.getByRole('button',{name:'Prøv samme indsendelse igen'}).click();
 await page.getByRole('heading',{name:'Tak. TEB har modtaget det.'}).waitFor();assert.equal((await call(guest,'/posts')).posts.length,0);
 check('guest preview, print/channel choices, lost-response retry and private pending submission');
 const admin=await context(),adminPage=await admin.newPage();
 await adminPage.goto('/forening.html?return=nyt.html#login');
 await adminPage.locator('form[data-action="request-code"] [name=email]').fill('tistrup.kalender@gmail.com');
 await adminPage.locator('form[data-action="request-code"] button[type=submit]').click();
 await adminPage.locator('form[data-action="verify-code"]').waitFor();
 const adminMail=(await call(admin,'/local-mail')).messages.find(m=>m.recipient==='tistrup.kalender@gmail.com'&&m.subject==='Din engangskode til TEB');
 await adminPage.locator('form[data-action="verify-code"] [name=code]').fill(adminMail.body.match(/\b\d{6}\b/)[0]);
 await adminPage.locator('form[data-action="verify-code"] button[type=submit]').click();
 await adminPage.waitForURL('**/nyt.html');
 const pending=adminPage.locator('#ds-review article');await pending.waitFor();assert.equal(await pending.count(),1);assert.ok((await pending.innerText()).includes('Analog kalender'));
 await pending.getByRole('button',{name:/Godkend og udgiv/}).click();await adminPage.getByText('Ingen opslag afventer godkendelse.').waitFor();
 await page.locator('#ds-refresh').click();await page.locator('#ds-feed article').filter({hasText:'Prøve: fællesspisning og historie'}).waitFor();
 assert.equal((await call(guest,'/posts')).posts.length,1);assert.equal((await call(guest,'/events')).events.length,1);
 await page.getByRole('button',{name:'Tilbage til overblikket'}).click();await page.locator('#ds-month').click();
 assert.ok(await page.locator('.calendar-grid--month .calendar-day').count()>=28);
 assert.equal(await page.locator('.calendar-entry').filter({hasText:'Prøve: fællesspisning'}).count(),1,'linked event is rendered once, inside the day');
 await page.locator('.calendar-entry').filter({hasText:'Prøve: fællesspisning'}).click();await page.locator('#ds-detail[open]').waitFor();assert.ok((await page.locator('#ds-detail').innerText()).includes('Hele historien med ekstra information.'));await page.keyboard.press('Escape');
 await page.locator('#ds-week').click();assert.equal(await page.locator('.calendar-grid--week .calendar-day').count(),7);
 await page.setViewportSize({width:320,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await page.locator('.calendar-entry').filter({hasText:'Prøve: fællesspisning'}).count(),1);
 await page.screenshot({path:resolve(output,'real-week-mobile.png'),fullPage:true});await page.setViewportSize({width:1440,height:1000});await page.locator('#ds-month').click();await page.screenshot({path:resolve(output,'real-month-desktop.png'),fullPage:true});
 const imported=page.locator('.calendar-entry').filter({hasText:'Arrangement fra Pulsen'});await imported.click();await page.locator('#ds-detail[open]').waitFor();assert.ok(await page.locator('#ds-detail a[href^="https://pulsenivest.dk/event/"]').count());await page.keyboard.press('Escape');
 check('TEB approval, single linked record, week/month cells, full story and imported source details');
 await adminPage.locator('#ds-create').click();await adminPage.getByRole('button',{name:'Nyhed',exact:true}).click();
 for(const[name,value]of Object.entries({title:'Prøve: en nyhed uden dato',description:'Kun en nyhed, ingen kalenderdato.'}))await adminPage.locator('#ds-field-'+name).fill(value);
 assert.equal(await adminPage.locator('#ds-field-date').isVisible(),false);await adminPage.locator('.ds-form button[type=submit]').click();await adminPage.getByRole('heading',{name:'Opslaget er udgivet'}).waitFor();
 const pub=(await call(guest,'/posts')).posts;assert.equal(pub.length,2);assert.equal(pub.find(p=>p.kind==='news').date,undefined);
 check('verified login publishes immediately and news-only posts never enter calendar');
 await page.goto('/index.html');assert.equal(await page.locator('#facebook').count(),1);await page.goto('/nyt.html');assert.equal(await page.locator('#facebook').count(),0);
 check('Facebook feed exists only on home page');
 assert.deepEqual(errors,[]);await writeFile(resolve(output,'checks.json'),JSON.stringify(checks,null,2));
 console.log('Det sker browser workflow passed: '+checks.length+' scenarios.');
}finally{
 await browser?.close();if(service.exitCode===null){const done=once(service,'exit');service.kill('SIGTERM');const force=setTimeout(()=>service.kill('SIGKILL'),5000);await done;clearTimeout(force);}await rm(runtime,{recursive:true,force:true});
}
