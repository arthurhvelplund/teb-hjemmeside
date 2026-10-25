// End-to-end against the real local API, isolated database and local mail adapter.
import assert from 'node:assert/strict';
import {checkAssociationFlows} from './association-flows-browser-check.mjs';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,writeFile,rm,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
const root=fileURLToPath(new URL('../',import.meta.url));
const backend=resolve(root,'calendar-worker');
const require=createRequire(resolve(backend,'package.json'));
const {chromium}=require('playwright');
const port=process.env.PORTAL_TEST_PORT||'8794',origin='http://localhost:'+port;
const output=resolve(root,'output/portal-integreret');
await mkdir(output,{recursive:true});await mkdir(resolve(root,'tmp'),{recursive:true});
const runtime=await mkdtemp(resolve(root,'tmp/portal-browser-'));
const service=spawn(process.execPath,['scripts/dev.mjs'],{cwd:backend,env:{...process.env,PORT:port,CALENDAR_DATA_DIR:runtime},stdio:['ignore','ignore','pipe']});
let serviceError='',browser;service.stderr.on('data',data=>serviceError+=data.toString());
const pages=[],checks=[],errors=[];
const record=(name,value=true)=>{assert.ok(value,name);checks.push(name);console.log('OK: '+name);};
const stamp=new Date();stamp.setUTCDate(stamp.getUTCDate()+1);
const date=stamp.toISOString().slice(0,10),month=date.slice(0,7);
const currentMonth=new Date().toISOString().slice(0,7),today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Copenhagen',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const adminEmail='tistrup.kalender@gmail.com',memberEmail='forening@example.org',editorEmail='redaktoer@example.org';
async function json(context,path,options={}){
 const response=await context.request.fetch('/api/kalender'+path,{...options,headers:{Origin:origin,...options.headers}});
 const result=await response.json();assert.ok(response.ok(),path+': '+response.status()+' '+(result.error||''));return result;
}
async function fill(form,values){for(const [name,value]of Object.entries(values)){const field=form.locator('[name="'+name+'"]');if(await field.evaluate(node=>node.tagName==='SELECT'))await field.selectOption(value);else await field.fill(value);}}
function expireCooldowns(){const db=new DatabaseSync(resolve(runtime,'calendar.sqlite'));try{db.prepare("UPDATE rate_limits SET expires_at='2000-01-01' WHERE key LIKE 'otp-cooldown:%'").run();}finally{db.close();}}
async function login(page,email,exerciseSteps=false){
 expireCooldowns();
 await page.goto('/forening.html#login');
 const request=page.locator('form[data-action="request-code"]');await request.waitFor();await fill(request,{email});
 const response=page.waitForResponse(r=>r.url().endsWith('/auth/request')&&r.request().method()==='POST');
 await request.locator('button[type="submit"]').click();assert.ok((await response).ok());
 await page.locator('form[data-action="verify-code"]').waitFor();
 assert.ok((await page.locator('.fa-login-card').innerText()).includes('spam/uønsket post'));
 if(email===memberEmail)assert.ok((await page.locator('.fa-login-card').innerText()).includes('Mailadressen har adgang.'));
 assert.equal(await page.locator('form[data-action="request-code"]').count(),0,'Email and code are separate steps');
 if(exerciseSteps){
  assert.equal(await page.locator('form[data-action="resend-code"] button').isDisabled(),true);
  await page.clock.install();await page.clock.fastForward(61000);expireCooldowns();
  await page.locator('[data-change-email]').click();await request.waitFor();assert.equal(await request.locator('[name="email"]').inputValue(),email);
  const next=page.waitForResponse(r=>r.url().endsWith('/auth/request')&&r.request().method()==='POST');await request.locator('button[type="submit"]').click();assert.ok((await next).ok());
  const resend=page.locator('form[data-action="resend-code"]');await resend.waitFor();
  assert.equal(await resend.locator('button').isDisabled(),true);await page.clock.fastForward(61000);expireCooldowns();
  const resent=page.waitForResponse(r=>r.url().endsWith('/auth/request')&&r.request().method()==='POST');await resend.locator('button[type="submit"]').click();assert.ok((await resent).ok());await page.locator('form[data-action="verify-code"]').waitFor();
 }
 const mailbox=await page.context().newPage();mailbox.on('pageerror',error=>errors.push(error.message));
 await mailbox.goto('/kalender-postkasse.html');
 const message=mailbox.locator('details.fp-mail').filter({has:mailbox.locator('summary').filter({hasText:email})}).filter({hasText:'Din engangskode til TEB'}).first();
 await message.locator('summary').click();
 const code=(await message.innerText()).match(/\b\d{6}\b/)?.[0];
 assert.ok(code,'Requested OTP is readable through the actual local mailbox page');await mailbox.close();
 const verify=page.locator('form[data-action="verify-code"]');await verify.waitFor();
 if(exerciseSteps){await fill(verify,{code:code==='000000'?'111111':'000000'});await verify.locator('button').click();await page.getByText('Koden er forkert eller udløbet.',{exact:false}).waitFor();}
 await fill(verify,{code});await verify.locator('button').click();
 await page.waitForURL(url=>!url.hash.startsWith('#login'));
 const session=await json(page.context(),'/session');assert.equal(session.user.email.toLowerCase(),email.toLowerCase());
}
async function mainForm(page){const form=page.locator('form').filter({has:page.locator('[name="title"]')}).first();await form.waitFor();return form;}
async function published(context,id){return (await json(context,'/events/'+id)).event;}
try{
 for(let i=0;i<800;i++){try{if((await fetch(origin+'/api/kalender/config')).ok)break;}catch{}if(i===799)throw Error('Server did not start: '+serviceError.slice(-1200));await new Promise(r=>setTimeout(r,150));}
 let executablePath=process.env.CHROME_PATH;
 if(!executablePath&&process.platform==='darwin'){const path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';try{await access(path);executablePath=path;}catch{}}
 browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
 const adminContext=await browser.newContext({baseURL:origin,viewport:{width:1440,height:1000}});
 const memberContext=await browser.newContext({baseURL:origin,viewport:{width:1440,height:1000}});
 const guestContext=await browser.newContext({baseURL:origin,viewport:{width:1440,height:1000}});
 const editorContext=await browser.newContext({baseURL:origin,viewport:{width:1440,height:1000}});
 for(const context of [adminContext,memberContext,guestContext,editorContext]) await context.route('**/api/kalender/kilder/*',route=>route.fulfill({json:{items:[],events:[],stale:false,fetchedAt:new Date().toISOString()}}));
 const [admin,member,guest,editor]=await Promise.all([adminContext.newPage(),memberContext.newPage(),guestContext.newPage(),editorContext.newPage()]);
 pages.push(admin,member,guest,editor);for(const page of pages){page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());}
 await login(admin,adminEmail,true);record('Two-step login, email correction, resend and wrong-code recovery use the real API');
 await admin.goto('/forening.html#teb?fane=foreninger&forening=ny');
 const create=admin.locator('form[data-action="create-association"]');await fill(create,{name:'Integrationens eksempelforening',category:'Fællesskab',description:'Kun testdata i en isoleret database.',chair:'Eksempel Formand',email:'kontakt@example.org',phone:'12 34 56 78',place:'Eksempelhallen'});
 let creationAttempt=0;const creationKeys=[];
 await admin.route('**/api/kalender/admin/associations',async route=>{
  creationKeys.push(route.request().postDataJSON().requestKey);creationAttempt++;
  if(creationAttempt>3)return route.continue();
  const response=await route.fetch();assert.ok(response.ok());
  if(creationAttempt===1)return route.abort('failed');
  return route.fulfill({response,body:creationAttempt===2?'{"association":':'{}'});
 });
 await create.locator('button[type="submit"]').click();await create.getByText('Der er ikke forbindelse til serveren.',{exact:false}).waitFor();
 await create.locator('button[type="submit"]').click();await create.getByText('Svaret fra serveren kunne ikke læses.',{exact:false}).waitFor();
 await create.locator('button[type="submit"]').click();await create.getByText('Oprettelsen kunne ikke bekræftes.',{exact:false}).waitFor();
 await create.locator('button[type="submit"]').click();await admin.locator('form[data-action="admin-member"]').waitFor();
 const matchingAssociations=(await json(adminContext,'/associations')).associations.filter(a=>a.name==='Integrationens eksempelforening');assert.equal(matchingAssociations.length,1);const association=matchingAssociations[0];
 assert.equal(creationKeys.length,4);assert.equal(new Set(creationKeys).size,1);
 await admin.unroute('**/api/kalender/admin/associations');record('Lost, truncated and incomplete creation responses retain one key and create one association');
 record('TEB creates a real association record');
 const membership=admin.locator('form[data-action="admin-member"]');await fill(membership,{name:'Foreningsperson',email:memberEmail});await membership.locator('[name="verified"]').check();
 await membership.locator('button').click();await admin.getByText('Adgangen er gemt.',{exact:false}).waitFor();
 await login(member,memberEmail);const memberSession=await json(memberContext,'/session');record('Invited person gains only assigned association',memberSession.memberships.length===1&&memberSession.memberships[0].associationId===association.id);
 await member.locator('.mf-header h1').waitFor();assert.equal(await member.locator('.mf-header h1').innerText(),association.name);
 assert.equal(await member.locator('#forening-nav').isVisible(),false);assert.equal(await member.locator('.fa-more').count(),0);record('Single-association login opens its own overview without TEB administration');
 await member.locator('.mf-card-head a').click();await member.waitForURL(/fane=profil/);
 const profile=member.locator('form[data-action="save-profile"]');await fill(profile,{description:'Profil ændret gennem den rigtige API.'});
 const imageUpload=member.waitForResponse(r=>r.url().endsWith('/associations/'+association.id+'/image')&&r.request().method()==='POST');
 await profile.locator('[data-profile-image]').setInputFiles(resolve(root,'site/images/tistrup-torv.jpg'));
 const uploadResponse=await imageUpload;assert.equal(uploadResponse.status(),201);const uploadedImageURL=(await uploadResponse.json()).imageUrl;
 await profile.getByText('Billedet er klar.',{exact:false}).waitFor();await profile.locator('button[type="submit"]').click();await member.getByText('Profilen er gemt og kan ses af alle.').waitFor();
 await guest.goto('/forening.html?id='+association.id);await guest.getByText('Profil ændret gennem den rigtige API.').waitFor();record('Profile update visible to a separate visitor');
 assert.equal(await guest.locator('.fa-profile-mark img').getAttribute('src'),uploadedImageURL);assert.ok((await guestContext.request.get(uploadedImageURL)).ok());record('File picker uploads and publishes a real association photo');
 await guest.goto('/forening.html');await guest.locator('.fa-association').waitFor();
 assert.equal(await guest.locator('#association-results').getAttribute('data-view'),'cards');
 await guest.locator('#association-search').fill('Integrationens');assert.equal(await guest.locator('#association-filter-toggle, #association-category').count(),0);
 await guest.getByRole('button',{name:'Liste',exact:true}).click();assert.equal(await guest.locator('#association-results').getAttribute('data-view'),'list');
 assert.equal(await guest.locator('#association-search').inputValue(),'Integrationens');assert.equal(await guest.locator('.fa-association').count(),1);
 await guest.reload();await guest.locator('.fa-association').waitFor();assert.equal(await guest.locator('#association-results').getAttribute('data-view'),'list');
 await guest.getByRole('button',{name:'Billede',exact:true}).click();await guest.locator('.fa-association-photo img').waitFor();
 assert.equal(await guest.locator('.fa-association-photo img').getAttribute('src'),uploadedImageURL);
 record('Picture/list switching is directly available, preserves search and remembers the selected view');
 await guest.getByRole('link',{name:/^Kontakt TEB/}).click();await guest.locator('#form form[action="/api/formular"]').waitFor();assert.ok(guest.url().endsWith('/kontakt.html#form'));
 record('Contact TEB opens the real contact form without submitting a message');
 await guest.goto('/kalender.html?opret=1');const guestForm=await mainForm(guest);
 await fill(guestForm,{title:'Gæstens integrationstest',association:'En gæsteforening',date,time:'18:00',location:'Eksempelhuset',description:'Gæsteindsendelsen skal først godkendes.',email:'gaest@example.org'});
 await guest.getByText('Gæstens integrationstest',{exact:true}).first().waitFor();
 await guestForm.locator('[name="photo"]').setInputFiles(resolve(root,'site/images/tistrup-torv.jpg'));
 await guest.getByText('Billedet er klar. Du kan se det i forhåndsvisningen.',{exact:true}).waitFor();
 await guestForm.locator('[name="printRequested"]').check();
 assert.equal(await guestForm.locator('[name=channels], [data-sharing], .ec-sharing').count(),0);
 assert.ok((await guestForm.locator('.ec-print-choice').innerText()).includes('TEB gennemgår ønsket og vælger indholdet manuelt'));
 await guest.keyboard.press('Escape');await guest.locator('dialog[open]').waitFor({state:'hidden'});
 await guest.locator('a[href="kalender.html?opret=1"]').first().click();await guestForm.waitFor();
 assert.equal(await guestForm.locator('[name="title"]').inputValue(),'Gæstens integrationstest');
 assert.equal(await guestForm.locator('[name="printRequested"]').isChecked(),true);
 assert.equal(await guestForm.locator('[name=channels]').count(),0);
 assert.ok((await guest.locator('.ec-image-mini img').getAttribute('src')).startsWith('data:image/webp;'));
 await guest.getByRole('button',{name:'I kalenderen',exact:true}).click();await guest.locator('.ec-web-preview').waitFor();
 assert.equal(await guest.locator('.ec-next').count(),0);await guest.locator('.ec-invitation summary').click();await guest.locator('.ec-invitation-details').waitFor();assert.ok((await guest.locator('.ec-invitation-details').innerText()).includes('Gæsteindsendelsen skal først godkendes.'));
 assert.equal(await guestForm.isVisible(),true);record('Single-step form stays visible while opening the invitation and changing previews');
 await guest.getByRole('button',{name:'På tryk',exact:true}).click();await guest.locator('.ec-print-preview').waitFor();
 assert.ok((await guest.locator('.ec-print-event').innerText()).includes('Gæstens integrationstest'));
 await guest.locator('.ec-poster-button').click();await guest.locator('.ec-poster-full').waitFor();
 await guest.getByRole('button',{name:'I kalenderen',exact:true}).click();
 record('Popup retains the draft and photo after closing; website and print previews show the event');
 await guest.waitForTimeout(1600);
 const createdResponse=guest.waitForResponse(r=>new URL(r.url()).pathname==='/api/kalender/events'&&r.request().method()==='POST');
 await guest.locator('.ec-send').click();const response=await createdResponse;assert.ok(response.ok());const result=await response.json();const payload=JSON.parse(response.request().postData());
 await guest.locator('.ec-receipt').waitFor();assert.equal(await guest.locator('.ec-receipt .ec-sharing, .ec-receipt .ec-channels').count(),0);assert.equal(payload.event.channels,undefined);record('Popup and receipt only request manual print consideration without external sharing choices');
 const receipt=(await json(guestContext,'/local-mail')).messages.find(message=>message.recipient==='gaest@example.org'&&message.body.includes('#adgang='));
 const privateURL=receipt?.body.match(/http:\/\/localhost:\d+\/kalender\.html\?privat=[^\s]+/)?.[0];
 assert.ok(privateURL,'Receipt contains the actual private route');assert.equal(new URL(privateURL).hash,'#adgang='+payload.authorToken);
 assert.equal((await guestContext.request.get('/api/kalender/events/'+result.id)).status(),404);record('Guest remains private before approval');
 await admin.goto('/forening.html#teb');const review=admin.locator('details').filter({hasText:'Gæstens integrationstest'});await review.locator('summary').click();await review.locator('button[value="approve"]').click();
 await admin.getByText('Arrangementet er godkendt.',{exact:true}).waitFor();assert.equal((await published(guestContext,result.id)).title,'Gæstens integrationstest');
 const guestPublished=await published(guestContext,result.id);assert.equal(guestPublished.printRequested,true);assert.equal(guestPublished.channels,undefined);assert.ok(guestPublished.imageUrl.startsWith('/api/kalender/event-images/'));assert.ok((await guestContext.request.get(guestPublished.imageUrl)).ok());
 record('TEB approval publishes guest event with the uploaded photo and print request');
 await guest.getByRole('link',{name:/Se status og ret arrangementet/}).click();await guest.getByText('Godkendt og offentliggjort',{exact:true}).waitFor();
 await guest.goto('/kalender.html');await guest.goto(privateURL);await guest.getByText('Godkendt og offentliggjort',{exact:true}).waitFor();record('Actual receipt URL and on-page private status link open the approved event');
 const decision=(await json(guestContext,'/local-mail')).messages.find(message=>message.recipient==='gaest@example.org'&&message.body.includes('?arrangement='));
 const publicLink=decision?.body.match(/http:\/\/localhost:\d+\/kalender\.html\?arrangement=[^\s]+/)?.[0];assert.ok(publicLink);
 const publicPage=await guestContext.newPage();await publicPage.goto(publicLink);await publicPage.locator('dialog[open]').getByRole('heading',{name:'Gæstens integrationstest',exact:true}).waitFor();await publicPage.close();record('Approval mail opens public event details');
 await guest.getByRole('button',{name:/Ret oplysningerne/}).click();const editGuest=await mainForm(guest);await fill(editGuest,{time:'19:00'});assert.equal(await editGuest.locator('[name=channels]').count(),0);assert.equal(await editGuest.locator('[name=printRequested]').isChecked(),true);await editGuest.locator('button[type="submit"]').click();
 await guest.getByText('Afventer TEBs godkendelse',{exact:false}).first().waitFor();assert.equal((await published(guestContext,result.id)).time,'18:00');record('Pending guest revision preserves public version');
 await member.goto('/forening.html#min-forening?forening='+association.id);await member.getByRole('link',{name:/Opret arrangement/}).click();assert.ok(member.url().includes('/forening.html'));const memberForm=await mainForm(member);assert.equal(await memberForm.locator('[name=associationId]').inputValue(),association.id);await fill(memberForm,{title:'Foreningens direkte arrangement',associationId:association.id,date,time:'17:00',location:'Eksempelhallen',description:'Udgivet med godkendt foreningsadgang.'});
 await memberForm.locator('[name=printRequested]').check();
 const directResponse=member.waitForResponse(r=>new URL(r.url()).pathname==='/api/kalender/events'&&r.request().method()==='POST');await member.locator('.ec-send').click();const direct=await (await directResponse).json();
 assert.equal((await published(guestContext,direct.id)).title,'Foreningens direkte arrangement');record('Member publishes directly through the real API');await member.locator('.ec-done').click();await member.getByRole('heading',{name:'Foreningens direkte arrangement',exact:true}).waitFor();record('Association creation stays in its own popup and refreshes the event list');

 await checkAssociationFlows({member,guest,association,record});
 await member.goto('/forening.html#min-forening?forening='+association.id);await member.locator('.mf-invite summary').click();const invite=member.locator('form[data-action="invite-member"]');await fill(invite,{name:'Ny person',email:editorEmail});await invite.locator('button').click();await member.getByText('Invitationen er gemt.',{exact:false}).waitFor();
 await login(editor,editorEmail);await editor.goto('/forening.html#min-forening?forening='+association.id);await editor.locator('.mf-invite summary').waitFor();assert.equal(await editor.locator('form[data-action="revoke-member"][data-email="'+memberEmail+'"]').count(),1);assert.equal(await editor.locator('form[data-action="revoke-member"][data-email="'+editorEmail+'"]').count(),0);record('Invited person gets the same rights and cannot remove themselves');
 await member.reload();const revoke=member.locator('form[data-action="revoke-member"][data-email="'+editorEmail+'"]');await revoke.locator('button').click();await member.getByText('Adgangen er fjernet.').waitFor();
 assert.equal((await json(editorContext,'/session')).memberships.length,0);record('Revocation affects an existing session');
 await admin.goto('/forening.html#teb?fane=print');const print=admin.locator('form[data-print-form]');await fill(print,{start:currentMonth+'-01',end:new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).toISOString().slice(0,10),deadline:today,format:'a3'});
 await print.locator('[data-print-load]').click();await print.locator('[data-print-event]').first().waitFor();
 assert.ok(await print.locator('[data-print-finalize]').isDisabled());
 const choices=print.locator('[data-print-choice]');for(const choice of await choices.all())assert.equal(await choice.inputValue(),'');record('Print starts with no preselected events and requires manual review');
 for(const row of await print.locator('[data-print-event]').all())await row.locator('select').selectOption(await row.getAttribute('data-print-event')===direct.id?'include':'exclude');
 const selected=print.locator('[data-print-event="'+direct.id+'"]');await selected.locator('summary').click();await selected.locator('[data-print-field="title"]').fill('Kort titel til plakaten');
 const previewResponse=adminContext.waitForEvent('response',r=>new URL(r.url()).pathname==='/api/kalender/admin/editions/preview');await print.locator('[data-print-preview]').click();const preview=await previewResponse;assert.ok(preview.ok());assert.equal(preview.headers()['content-type'],'application/pdf');assert.equal(preview.headers()['x-calendar-event-count'],'1');record('Print preview includes only selected events and supports separate print text');
 const popupPromise=admin.waitForEvent('popup');await print.locator('[data-print-link]').click();const popup=await popupPromise;await popup.close();await print.locator('[name="proofread"]').check();
 await selected.locator('[data-print-field="title"]').fill('Endelig kort printtitel');assert.ok(await print.locator('[data-print-finalize]').isDisabled());assert.equal(await print.locator('[name="proofread"]').isChecked(),false);record('Editing print text invalidates the proof and finalization');
 await print.locator('[data-print-preview]').click();await print.locator('[data-print-link]').waitFor({state:'visible'});const proofPopup=admin.waitForEvent('popup');await print.locator('[data-print-link]').click();await (await proofPopup).close();await print.locator('[name="proofread"]').check();
 await print.locator('[data-print-finalize]').click();await admin.getByText('Printudgaven er gemt med',{exact:false}).waitFor();const editions=(await json(adminContext,'/editions')).editions;assert.equal(editions.length,1);assert.equal(editions[0].eventCount,1);
 assert.equal((await published(guestContext,direct.id)).title,'Foreningens direkte arrangement');record('Saving print-specific text preserves the public event');
 assert.equal(await admin.locator('[data-print-archive] [data-edition-id]').count(),1);record('Newly saved print appears in the archive without a reload');
 await admin.screenshot({path:resolve(output,'print-redaktion-desktop.png'),fullPage:true});
 for(const width of [390,320]){await admin.setViewportSize({width,height:844});assert.equal(await admin.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Print editor at '+width);}
 await admin.screenshot({path:resolve(output,'print-redaktion-mobil.png'),fullPage:true});record('Print editor fits desktop and small phones');
 const pdf1=await (await guestContext.request.get('/api/kalender/editions/'+editions[0].id+'/pdf')).body();assert.equal(pdf1.subarray(0,5).toString(),'%PDF-');await writeFile(resolve(output,'kalender-a3.pdf'),pdf1);
 await member.goto('/forening.html#min-forening?forening='+association.id);await member.locator('.mf-events li').filter({hasText:'Foreningens direkte arrangement'}).getByRole('link',{name:'Ret',exact:true}).click();
 const editMember=member.locator('dialog[open] #ec-form');await editMember.waitFor();assert.ok(member.url().includes('/forening.html'));assert.equal(await editMember.locator('[name=title]').inputValue(),'Foreningens direkte arrangement');
 await fill(editMember,{title:'Rettet efter print'});await member.getByRole('button',{name:'Gem rettelsen'}).click();
 await member.getByRole('heading',{name:'Rettelsen er gemt.'}).waitFor();await member.getByRole('button',{name:'Færdig'}).click();
 await member.locator('.mf-events li').filter({hasText:'Rettet efter print'}).waitFor();record('Ret opens the same popup on Min forening and refreshes the list');
 await member.goto('/kalender.html?ret='+direct.id);await member.locator('dialog[open] #ec-form').waitFor();await member.screenshot({path:resolve(output,'ret-popup-desktop.png')});
 await member.getByRole('button',{name:'Aflys arrangementet'}).click();await member.getByRole('heading',{name:'Arrangementet er aflyst.'}).waitFor();
 assert.equal((await published(guestContext,direct.id)).state,'cancelled');await member.getByRole('button',{name:'Færdig'}).click();await member.waitForURL(url=>!url.search.includes('ret='));record('Direct edit links open the popup, and cancelling there takes effect immediately');assert.equal((await published(guestContext,direct.id)).title,'Rettet efter print');const pdf2=await (await guestContext.request.get('/api/kalender/editions/'+editions[0].id+'/pdf')).body();assert.ok(pdf1.equals(pdf2));record('Published PDF bytes remain unchanged after event edit');
 await member.goto('/forening.html#arbejdsrum');await member.locator('.mf-header').waitFor();assert.ok(member.url().endsWith('#arbejdsrum'));await member.locator('.mf-header img').evaluate(image=>image.decode());await member.screenshot({path:resolve(output,'min-forening-desktop.png'),fullPage:true});
 await member.goto('/forening.html#min-forening?forening='+association.id+'&fane=profil');await member.locator('[data-profile-image]').waitFor();await member.screenshot({path:resolve(output,'profil-desktop.png'),fullPage:true});
 await guest.goto('/forening.html#login');await guest.locator('form[data-action="request-code"]').waitFor();await guest.screenshot({path:resolve(output,'login-desktop.png'),fullPage:true});
 for(const width of [390,320]){
  await member.setViewportSize({width,height:844});await guest.setViewportSize({width,height:844});
  for(const tab of ['','profil']){await member.goto('/forening.html#min-forening?forening='+association.id+(tab?'&fane='+tab:''));await member.locator('.mf-header').waitFor();assert.equal(await member.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,tab+' at '+width);}
  await guest.goto('/forening.html#login');await guest.locator('form[data-action="request-code"]').waitFor();assert.equal(await guest.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'login at '+width);
 }
 record('Login, Min forening and profile editor fit 390px and 320px');
 await member.setViewportSize({width:1440,height:1000});await guest.setViewportSize({width:1440,height:1000});
 const second=(await json(adminContext,'/admin/associations',{method:'POST',data:{requestKey:crypto.randomUUID(),association:{name:'Anden integrationstestforening'}}})).association;
 await json(adminContext,'/admin/associations/'+second.id+'/members',{method:'POST',data:{email:memberEmail,name:'Foreningsperson'}});
 await member.locator('.mf-account').getByRole('button',{name:'Log ud'}).click();await member.waitForURL(url=>!url.hash);await login(member,memberEmail);await member.getByRole('heading',{name:'Hvilken forening vil du åbne?'}).waitFor();
 await member.locator('.fa-membership-choices a').filter({hasText:second.name}).click();await member.locator('.mf-header h1').filter({hasText:second.name}).waitFor();record('Multiple-association users choose only among their own associations');
 await login(guest,'ny-forening@example.org');await guest.getByRole('heading',{name:'Hvilken forening hører du til?'}).waitFor();assert.equal(await guest.locator('.mf-account').getByRole('link',{name:/^Kontakt TEB/}).getAttribute('href'),'kontakt.html#form');
 const accessRequest=guest.locator('form[data-action=access-request]');await fill(accessRequest,{name:'Ny foreningsperson',associationId:association.id,roleNote:'Ansvarlig i foreningen.'});await accessRequest.locator('button').click();await guest.getByText('Din anmodning er gemt hos TEB.',{exact:false}).waitFor();
 await admin.goto('/forening.html#teb');const accessReview=admin.locator('form[data-action=review-access]');await accessReview.waitFor();await accessReview.locator('button[value=approve]').click();await accessReview.getByText('Bekræft først, at du har kontrolleret personens tilknytning.').waitFor();await accessReview.locator('[name=note]').fill('Vi kontakter jer først.');await accessReview.locator('button[value=reject]').click();await admin.getByText('Anmodningen er afvist.').waitFor();
 await guest.reload();await guest.getByText('Vi kontakter jer først.').waitFor();record('Unassigned accounts request access through the UI and the shared queue requires explicit verification');
 await guest.locator('.mf-account').getByRole('button',{name:'Log ud'}).click();await guest.waitForURL(url=>!url.hash);record('Unassigned verified users get Contact TEB without editing access');
 await guest.goto('/forening.html');await guest.locator('.fa-association').first().waitFor();await guest.screenshot({path:resolve(output,'forening-desktop.png'),fullPage:true});
 await guest.goto('/kalender.html');await guest.locator('#calendar-events[aria-busy="false"]').waitFor();await guest.screenshot({path:resolve(output,'kalender-desktop.png'),fullPage:true});
 for(const width of [390,320]){
  await guest.setViewportSize({width,height:844});
  for(const path of ['/forening.html','/kalender.html','/kalender.html?opret=1','/nyt.html']){await guest.goto(path);await guest.waitForTimeout(150);if(path.includes('opret')){await guest.locator('dialog[open] #ec-form').waitFor();assert.equal(await guest.locator('dialog[open]').evaluate(d=>d.scrollWidth>innerWidth),false,'dialog at '+width);await guest.screenshot({path:resolve(output,'arrangement-popup-'+width+'.png')});await guest.keyboard.press('Escape');assert.equal(await guest.locator('dialog[open]').count(),0);}assert.equal(await guest.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,path+' at '+width);}
 }
 await guest.goto('/kalender.html');await guest.screenshot({path:resolve(output,'kalender-mobil.png'),fullPage:true});record('Public pages fit 390px and 320px without horizontal overflow');
 assert.deepEqual(errors,[]);await writeFile(resolve(output,'checks.json'),JSON.stringify({date:new Date().toISOString(),checks,errors,externalMailSent:false},null,2));
 const loginContext=await browser.newContext({baseURL:origin,viewport:{width:320,height:844}});
 const loginPage=await loginContext.newPage();pages.push(loginPage);loginPage.on('pageerror',error=>errors.push(error.message));
 await loginPage.clock.install();
 const longEmail='a-long-association-email-for-testing-layout@example.org';
 for(const state of ['failed','uncertain','pending']){
  await loginPage.evaluate(()=>sessionStorage.clear()).catch(()=>{});
  await loginContext.route('**/api/kalender/auth/request',route=>route.fulfill({json:{challengeId:crypto.randomUUID(),mode:'live',deliveryState:state,accessState:'unlinked',resendAfterSeconds:60}}));
  await loginPage.goto('/forening.html?login-state='+state+'#login');
  const form=loginPage.locator('form[data-action="request-code"]');await form.waitFor();await fill(form,{email:longEmail});await form.locator('button').click();
  await loginPage.locator('form[data-action="verify-code"]').waitFor();
  const text=await loginPage.locator('.fa-login-card').innerText();assert.ok(text.includes('Ingen foreningsadgang på denne mail.'));assert.ok(!text.includes('Koden er sendt.'));
  assert.equal(await loginPage.locator('form[data-action="resend-code"] button').isDisabled(),true);
  assert.equal(await loginPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'code state '+state+' on 320px');
  await loginPage.reload();await loginPage.locator('form[data-action="verify-code"]').waitFor();
  assert.equal(await loginPage.locator('form[data-action="resend-code"] button').isDisabled(),true);
  await loginPage.clock.fastForward(61000);assert.equal(await loginPage.locator('form[data-action="resend-code"] button').isDisabled(),false);
  if(state==='failed')await loginPage.screenshot({path:resolve(output,'login-failed-320.png'),fullPage:true});
  await loginContext.unroute('**/api/kalender/auth/request');
 }
 record('Failed, uncertain and pending delivery never claims a sent code; unknown-email guidance and countdown survive reload on 320px');
 await loginContext.route('**/api/kalender/auth/request',route=>route.fulfill({status:429,headers:{'Retry-After':'120'},json:{error:'For mange forsøg. Vent lidt, og prøv igen.',retryAfterSeconds:120}}));
 await loginPage.locator('form[data-action="resend-code"] button').click();await loginPage.getByText('For mange forsøg. Vent lidt, og prøv igen.',{exact:true}).waitFor();
 assert.ok((await loginPage.locator('form[data-action="resend-code"] button').innerText()).includes('120'));assert.equal(await loginPage.locator('form[data-action="verify-code"]').count(),1);
 record('Server rate limits update the countdown while preserving the existing code form');
 await loginContext.close();
 assert.deepEqual(errors,[],'No uncaught browser errors in login failure states');
 console.log('Portal browser checks passed: '+checks.length+' complete real API/UI scenarios. No external mail sent.');
}catch(error){
 console.error(error.stack || error.message);for(const [i,page]of pages.entries())await page.screenshot({path:resolve(output,'failure-'+i+'.png'),fullPage:true}).catch(()=>{});process.exitCode=1;
}finally{
 await browser?.close();if(service.exitCode===null){service.kill('SIGTERM');await new Promise(resolve=>service.once('exit',resolve));}await rm(runtime,{recursive:true,force:true});
}
