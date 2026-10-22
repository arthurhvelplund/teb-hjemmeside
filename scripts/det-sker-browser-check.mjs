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
const output=resolve(root,'output/kalender-flytning');await mkdir(output,{recursive:true});
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
 await ctx.route('**/api/kalender/kilder/*',route=>route.fulfill({json:{items:route.request().url().endsWith('/pulsen')?[]:news,events:route.request().url().endsWith('/pulsen')?[{id:'imported-event',title:'Arrangement fra Pulsen',date,time:'14:00',image:'https://images.example.test/event.jpg',location:'Tistrup',url:'https://pulsenivest.dk/event/test/'+date},{id:'next-week',title:'Arrangement om seks dage',date:futureDate,time:'12:00',location:'Tistrup',url:'https://pulsenivest.dk/event/future/'+futureDate}]:[{id:'tistrup-event',title:'Arrangement fra Tistrup Nyt',date,time:'10:00',url:'https://tistrupnyt.dk/cid/123/test'}],fetchedAt:new Date().toISOString(),stale:false}}));
 await ctx.route('https://images.example.test/event.jpg',route=>route.fulfill({path:resolve(root,'site/images/tistrup-torv.jpg')}));
 ctx.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));return ctx;
}
try{
 const deadline=Date.now()+45000;
 for(;;){if(service.exitCode!==null||Date.now()>deadline)throw Error('Local startup failed: '+stderr.slice(-800));try{if((await fetch(origin+'/api/kalender/config',{signal:AbortSignal.timeout(1000)})).ok)break;}catch{}await new Promise(done=>setTimeout(done,100));}
 let executablePath=process.env.CHROME_PATH;if(!executablePath&&process.platform==='darwin'){const path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';try{await access(path);executablePath=path;}catch{}}
 browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
 const guest=await context(),page=await guest.newPage();page.setDefaultTimeout(12000);
 const sourceRequests=[];page.on('request',r=>{if(r.url().includes('/kilder/'))sourceRequests.push(r.url());});
 await page.goto('/nyt.html');await page.locator('.ds-source-card').first().waitFor();assert.equal(await page.locator('main h1').textContent(),'Det sker her.');assert.equal(await page.locator('main h1').count(),1);
 assert.equal(await page.locator('.ds-group .ds-source-card').count(),7);assert.equal(await page.locator('.ds-source-card img').count(),7);assert.equal(await page.locator('#calendar-events,#ds-events,#ds-feed').count(),0);
 assert.equal(await page.locator('#association-news-feed, a[href*="#skriv"]').count(),0);assert.equal(await page.locator('#facebook').count(),1);assert.equal(await page.locator('main > section:last-child').getAttribute('id'),'facebook');assert.equal(sourceRequests.length,0);
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:resolve(output,'nyt-'+width+'.png'),fullPage:true});}
 await page.goto('/index.html');
 // Forsiden slutter med medlemskab, som ligger under Facebook-feedet.
 assert.equal(await page.locator('main > section#facebook').count(),1);
 check('Det sker preserves media links and Facebook without association news, ends with Facebook, and the home page keeps the Facebook feed');
 await page.setViewportSize({width:1440,height:1000});await page.goto('/kalender.html');await page.locator('#calendar-events[aria-busy="false"]').waitFor();await page.locator('.cal-card').filter({hasText:'Arrangement om seks dage'}).waitFor();
 assert.equal(await page.locator('#calendar-week').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#calendar-search').count(),0);
 assert.equal(await page.locator('.cal-board--week .cal-day').count(),7);assert.equal(await page.locator('.cal-board--week .cal-day.is-today').count(),1);
 assert.equal(await page.locator('.cal-print').count(),1);assert.equal(await page.locator('#calendar-print-latest').isVisible(),true);
 await page.locator('.cal-print summary').click();assert.equal(await page.locator('.cal-print details').getAttribute('open'),'');await page.locator('.cal-print summary').click();
 assert.equal(await page.getByText('Historie 0 fra den lokale testavis',{exact:true}).count(),0);
 assert.equal(await page.locator('.cal-chip').filter({hasText:'Arrangement fra Tistrup Nyt'}).count(),1);
 await page.locator('.cal-chip-image').first().waitFor();await page.locator('.cal-card-image').first().waitFor();
 const nyt=page.locator('.cal-chip').filter({hasText:'Arrangement fra Tistrup Nyt'});await nyt.click();await page.locator('dialog[open]').waitFor();
 assert.equal(/null|undefined/.test(await page.locator('dialog[open]').innerText()),false);await page.keyboard.press('Escape');
 const imported=page.locator('.cal-chip').filter({hasText:'Arrangement fra Pulsen'});await imported.click();await page.locator('dialog[open]').waitFor();assert.ok(await page.locator('dialog a[href^="https://pulsenivest.dk/event/"]').count());assert.equal(await page.locator('dialog .cal-detail-image').count(),1);await page.keyboard.press('Escape');
 check('new calendar screen: one column per day, upcoming events with photos, details without empty fields and print calendar');
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:resolve(output,'kalender-'+width+'.png'),fullPage:true});}
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('#calendar-month').click();await page.locator('.cal-board--month').waitFor();assert.ok(await page.locator('.cal-board--month .cal-day').count()>=28);
 await page.locator('.cal-board--month .cal-chip').filter({hasText:'Arrangement fra Pulsen'}).waitFor();
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:resolve(output,'kalender-maaned-'+width+'.png'),fullPage:true});}
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('.cal-board--month .cal-day.is-today button.cal-day-number').click();await page.locator('#calendar-week[aria-pressed="true"]').waitFor();
 check('calendar desktop/mobile layout and month switch');
 await page.goto('/kalender.html?opret=1');const form=page.locator('#ec-form');await form.waitFor();
 for(const[name,value]of Object.entries({association:'Prøveforeningen',title:'Gæstens prøvearrangement',description:'Kort beskrivelse af fællesspisningen.',date,time:'18:00',location:'Prøvehuset',email:'guest@example.test'}))await form.locator('[name="'+name+'"]').fill(value);
 await form.locator('[name=printRequested]').check();assert.ok((await page.locator('.ec-web-preview').innerText()).includes('Gæstens prøvearrangement'));
 await page.setViewportSize({width:320,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 let intercepted=false;const keys=[];
 await page.route('**/api/kalender/events',async route=>{if(route.request().method()==='POST'){keys.push(route.request().postDataJSON().requestKey);if(!intercepted){intercepted=true;const response=await route.fetch();assert.equal(response.status(),201);return route.fulfill({status:201,contentType:'application/json',body:'{'});}}await route.continue();});
 await new Promise(done=>setTimeout(done,1600));await page.locator('.ec-send').click();await page.getByRole('button',{name:'Prøv samme indsendelse igen'}).click();await page.getByRole('heading',{name:'Tak. TEB har modtaget det.'}).waitFor();assert.equal(new Set(keys).size,1);
 assert.equal((await call(guest,'/events')).events.length,0);
 const privateLink=await page.locator('.ec-private-link input').inputValue();const privatePage=await guest.newPage();await privatePage.goto(privateLink);await privatePage.getByText('Afventer TEBs godkendelse',{exact:true}).waitFor();
 check('guest creation, visibility wishes, preview and uncertain-response retry preserve one private submission');
 const admin=await context();await login(admin,'tistrup.kalender@gmail.com');const adminPage=await admin.newPage();await adminPage.goto('/forening.html#teb');
 const pending=adminPage.locator('details.fa-review').filter({hasText:'Gæstens prøvearrangement'});await pending.locator('summary').click();assert.ok((await pending.innerText()).includes('Analog kalender'));
 await pending.getByRole('button',{name:'Godkend og offentliggør'}).click();await adminPage.getByText('Arrangementet er godkendt.',{exact:true}).waitFor();
 const approved=(await call(guest,'/events')).events;assert.equal(approved.length,1);assert.equal(approved[0].printRequested,true);
 await privatePage.reload();await privatePage.getByText('Godkendt og offentliggjort',{exact:true}).waitFor();await privatePage.getByRole('button',{name:'Ret oplysningerne'}).click();assert.equal(await privatePage.locator('[name=printRequested]').isChecked(),true);await privatePage.close();
 check('TEB reviews visibility wishes; approval publishes once; existing private edit retains selected wishes');
 const association=(await call(admin,'/admin/associations',{requestKey:crypto.randomUUID(),association:{name:'Den verificerede forening'}})).association;
 await call(admin,'/admin/associations/'+association.id+'/members',{email:'member@example.test',role:'manager',name:'Prøvemedlem'});
 const member=await context();await login(member,'member@example.test');const memberPage=await member.newPage();await memberPage.goto('/kalender.html?opret=1&forening='+association.id);const memberForm=memberPage.locator('#ec-form');await memberForm.waitFor();
 for(const[name,value]of Object.entries({title:'Foreningens direkte arrangement',date,time:'17:00',location:'Hallen'}))await memberForm.locator('[name="'+name+'"]').fill(value);
 await memberPage.locator('.ec-send').click();await memberPage.getByRole('heading',{name:'Så er invitationen ude.'}).waitFor();assert.equal((await call(guest,'/events')).events.length,2);
 check('verified association publishes directly from its own calendar creation link');
 const token='a'.repeat(64),post=await call(guest,'/posts',{requestKey:crypto.randomUUID(),authorToken:token,startedAt:Date.now()-5000,email:'legacy@example.test',post:{kind:'both',author:'Tidligere afsender',title:'Tidligere kalenderopslag',description:'Indsendt før flytningen.',body:'Hele den oprindelige tekst.',date,time:'16:00',location:'Prøvestedet',print:true,channels:['screens']}});
 await page.goto('/nyt.html?privat='+post.id+'#adgang='+token);await page.waitForURL('**/kalender.html?indsendelse=*');await page.getByText('TEB har modtaget din indsendelse. Den er ikke offentlig endnu.').waitFor();assert.equal(new URL(page.url()).hash,'#adgang='+token);assert.equal(await page.getByRole('link',{name:'Ret eller aflys arrangementet',exact:true}).count(),0);
 await adminPage.goto('/kalender.html#godkendelse');await adminPage.waitForURL('**/forening.html#teb');const oldReview=adminPage.locator('details').filter({hasText:'Tidligere kalenderopslag'});await oldReview.locator('summary').click();await oldReview.locator('button[value=approve]').click();await adminPage.getByText('Opslaget er godkendt.',{exact:true}).waitFor();
 await page.getByRole('button',{name:/^Opdatér status/}).click();await page.getByText('TEB har godkendt din indsendelse.').waitFor();await page.getByRole('link',{name:'Ret eller aflys arrangementet',exact:true}).click();await page.getByRole('heading',{name:'Dit private arrangement',exact:true}).waitFor();
 await page.goto('/nyt.html?opslag='+post.id);await page.locator('#calendar-legacy').getByText('Hele den oprindelige tekst.').waitFor();
 await page.goto('/kalender.html?arrangement='+post.id);await page.locator('dialog[open]').getByText('Hele den oprindelige tekst.').waitFor();
 await page.goto('/nyt.html?opret=1');await page.waitForURL('**/kalender.html?opret=1');await page.locator('#ec-form').waitFor();
 check('old guest, public and creation URLs survive the move; former submissions still approve and open private editing');
 await page.goto('/kalender.html');await page.locator('.cal-chip').filter({hasText:'Arrangement fra Pulsen'}).waitFor();
 await guest.route('**/api/kalender/kilder/*',route=>route.fulfill({status:503,json:{error:'Kilden er midlertidigt nede.'}}));await page.locator('#calendar-refresh').click();await page.locator('#calendar-source-status').getByText(/kunne ikke opdateres/).waitFor();assert.equal(await page.locator('.cal-chip').filter({hasText:'Arrangement fra Pulsen'}).count(),1);
 check('source outage retains previously loaded calendar events and shows a useful status');
 assert.deepEqual(errors,[]);await writeFile(resolve(output,'checks.json'),JSON.stringify(checks,null,2));
 console.log('Calendar move browser workflow passed: '+checks.length+' scenarios.');
}finally{
 await browser?.close();if(service.exitCode===null){const done=once(service,'exit');service.kill('SIGTERM');const force=setTimeout(()=>service.kill('SIGKILL'),5000);await done;clearTimeout(force);}await rm(runtime,{recursive:true,force:true});
}
