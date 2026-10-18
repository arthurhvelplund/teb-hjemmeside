// End-to-end against the real local API, isolated database and local mail adapter.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,writeFile,rm,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
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
const record=(name,value=true)=>{assert.ok(value,name);checks.push(name);};
const stamp=new Date();stamp.setUTCMonth(stamp.getUTCMonth()+1,12);
const date=stamp.toISOString().slice(0,10),month=date.slice(0,7);
const adminEmail='tistrup.kalender@gmail.com',memberEmail='forening@example.org',editorEmail='redaktoer@example.org';
async function json(context,path,options={}){
 const response=await context.request.fetch('/api/kalender'+path,{...options,headers:{Origin:origin,...options.headers}});
 const result=await response.json();assert.ok(response.ok(),path+': '+response.status()+' '+(result.error||''));return result;
}
async function fill(form,values){for(const [name,value]of Object.entries(values)){const field=form.locator('[name="'+name+'"]');if(await field.evaluate(node=>node.tagName==='SELECT'))await field.selectOption(value);else await field.fill(value);}}
async function login(page,email){
 await page.goto('/forening.html#login');
 const request=page.locator('form[data-action="request-code"]');await request.waitFor();await fill(request,{email});
 const response=page.waitForResponse(r=>r.url().endsWith('/auth/request')&&r.request().method()==='POST');
 await request.locator('button[type="submit"]').click();assert.ok((await response).ok());
 const {messages}=await json(page.context(),'/local-mail');
 const code=messages.filter(m=>m.recipient.toLowerCase()===email.toLowerCase()).map(m=>m.body.match(/\b\d{6}\b/)?.[0]).find(Boolean);
 assert.ok(code,'Local mailbox contains requested OTP');
 const verify=page.locator('form[data-action="verify-code"]');await verify.waitFor();await fill(verify,{code});await verify.locator('button').click();
 await page.waitForURL(url=>!url.hash.startsWith('#login'));
 const session=await json(page.context(),'/session');assert.equal(session.user.email.toLowerCase(),email.toLowerCase());
}
async function mainForm(page){const form=page.locator('form').filter({has:page.locator('[name="title"]')}).first();await form.waitFor();return form;}
async function published(context,id){return (await json(context,'/events/'+id)).event;}
try{
 for(let i=0;i<80;i++){try{if((await fetch(origin+'/api/kalender/config')).ok)break;}catch{}if(i===79)throw Error('Server did not start: '+serviceError.slice(-1200));await new Promise(r=>setTimeout(r,150));}
 let executablePath=process.env.CHROME_PATH;
 if(!executablePath&&process.platform==='darwin'){const path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';try{await access(path);executablePath=path;}catch{}}
 browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
 const adminContext=await browser.newContext({baseURL:origin,viewport:{width:1440,height:1000}});
 const memberContext=await browser.newContext({baseURL:origin,viewport:{width:1440,height:1000}});
 const guestContext=await browser.newContext({baseURL:origin,viewport:{width:1440,height:1000}});
 const editorContext=await browser.newContext({baseURL:origin,viewport:{width:1440,height:1000}});
 const [admin,member,guest,editor]=await Promise.all([adminContext.newPage(),memberContext.newPage(),guestContext.newPage(),editorContext.newPage()]);
 pages.push(admin,member,guest,editor);for(const page of pages){page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());}
 await login(admin,adminEmail);record('TEB email-code login');
 await admin.goto('/forening.html#teb?fane=foreninger&forening=ny');
 const create=admin.locator('form[data-action="create-association"]');await fill(create,{name:'Integrationens eksempelforening',category:'Fællesskab',description:'Kun testdata i en isoleret database.',chair:'Eksempel Formand',email:'kontakt@example.org',phone:'12 34 56 78',place:'Eksempelhallen'});
 await create.locator('button[type="submit"]').click();await admin.locator('form[data-action="admin-member"]').waitFor();
 const association=(await json(adminContext,'/associations')).associations.find(a=>a.name==='Integrationens eksempelforening');assert.ok(association);
 record('TEB creates a real association record');
 const membership=admin.locator('form[data-action="admin-member"]');await fill(membership,{name:'Foreningsansvarlig',email:memberEmail,role:'manager'});await membership.locator('[name="verified"]').check();
 await membership.locator('button').click();await admin.getByText('Adgangen er gemt.',{exact:false}).waitFor();
 await login(member,memberEmail);const memberSession=await json(memberContext,'/session');record('Invited manager gains only assigned association',memberSession.memberships.length===1&&memberSession.memberships[0].associationId===association.id);
 await member.goto('/forening.html#arbejdsrum?forening='+association.id+'&fane=profil');
 const profile=member.locator('form[data-action="save-profile"]');await fill(profile,{description:'Profil ændret gennem den rigtige API.'});await profile.locator('button').click();await member.getByText('Profilen er gemt og kan ses af alle.').waitFor();
 await guest.goto('/forening.html?id='+association.id);await guest.getByText('Profil ændret gennem den rigtige API.').waitFor();record('Profile update visible to a separate visitor');
 await guest.goto('/kalender.html?opret=1');const guestForm=await mainForm(guest);
 await fill(guestForm,{title:'Gæstens integrationstest',association:'En gæsteforening',date,time:'18:00',location:'Eksempelhuset',description:'Gæsteindsendelsen skal først godkendes.',email:'gaest@example.org'});
 await guest.getByText('Gæstens integrationstest',{exact:true}).first().waitFor();await guest.waitForTimeout(1600);
 const createdResponse=guest.waitForResponse(r=>new URL(r.url()).pathname==='/api/kalender/events'&&r.request().method()==='POST');
 await guestForm.locator('button[type="submit"]').click();const response=await createdResponse;assert.ok(response.ok());const result=await response.json();const payload=JSON.parse(response.request().postData());
 const privateURL='/kalender.html?privat='+result.id+'#adgang='+payload.authorToken;
 assert.equal((await guestContext.request.get('/api/kalender/events/'+result.id)).status(),404);record('Guest remains private before approval');
 await admin.goto('/forening.html#teb');const review=admin.locator('details').filter({hasText:'Gæstens integrationstest'});await review.locator('summary').click();await review.locator('button[value="approve"]').click();
 await admin.getByText('Arrangementet er godkendt.',{exact:true}).waitFor();assert.equal((await published(guestContext,result.id)).title,'Gæstens integrationstest');record('TEB approval publishes guest event');
 await guest.goto(privateURL);await guest.getByText('Godkendt og offentliggjort',{exact:true}).waitFor();
 await guest.getByRole('button',{name:'Ret oplysningerne',exact:true}).click();const editGuest=await mainForm(guest);await fill(editGuest,{time:'19:00'});await editGuest.locator('button[type="submit"]').click();
 await guest.getByText('Afventer TEBs godkendelse',{exact:false}).first().waitFor();assert.equal((await published(guestContext,result.id)).time,'18:00');record('Pending guest revision preserves public version');
 await member.goto('/kalender.html?opret=1&forening='+association.id);const memberForm=await mainForm(member);await fill(memberForm,{title:'Foreningens direkte arrangement',associationId:association.id,date,time:'17:00',location:'Eksempelhallen',description:'Udgivet med godkendt foreningsadgang.'});
 const directResponse=member.waitForResponse(r=>new URL(r.url()).pathname==='/api/kalender/events'&&r.request().method()==='POST');await memberForm.locator('button[type="submit"]').click();const direct=await (await directResponse).json();
 assert.equal((await published(guestContext,direct.id)).title,'Foreningens direkte arrangement');record('Member publishes directly through the real API');
 await member.goto('/forening.html#arbejdsrum?forening='+association.id+'&fane=personer');const invite=member.locator('form[data-action="invite-member"]');await fill(invite,{name:'Ny redaktør',email:editorEmail});await invite.locator('button').click();await member.getByText('Invitationen er gemt.',{exact:false}).waitFor();
 await login(editor,editorEmail);await editor.goto('/forening.html#arbejdsrum?forening='+association.id+'&fane=personer');await editor.getByText('Den foreningsansvarlige kan invitere og fjerne redaktører.').waitFor();record('Invitation accepted by matching email without manager privileges');
 await member.reload();const revoke=member.locator('form[data-action="revoke-member"][data-email="'+editorEmail+'"]');await revoke.locator('button').click();await member.getByText('Adgangen er fjernet.').waitFor();
 assert.equal((await json(editorContext,'/session')).memberships.length,0);record('Revocation affects an existing session');
 await admin.goto('/forening.html#teb?fane=print');const print=admin.locator('form[data-action="print-edition"]');await fill(print,{start:month+'-01',end:new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).toISOString().slice(0,10),format:'a3'});
 await print.locator('button[value="finalize"]').click();await admin.getByText('Printudgaven er gemt med',{exact:false}).waitFor();const editions=(await json(adminContext,'/editions')).editions;assert.equal(editions.length,1);
 const pdf1=await (await guestContext.request.get('/api/kalender/editions/'+editions[0].id+'/pdf')).body();assert.equal(pdf1.subarray(0,5).toString(),'%PDF-');await writeFile(resolve(output,'kalender-a3.pdf'),pdf1);
 await member.goto('/kalender.html?ret='+direct.id);const editMember=await mainForm(member);await fill(editMember,{title:'Rettet efter print'});await editMember.locator('button[type="submit"]').click();
 await member.getByText('Rettet efter print',{exact:true}).first().waitFor();const pdf2=await (await guestContext.request.get('/api/kalender/editions/'+editions[0].id+'/pdf')).body();assert.ok(pdf1.equals(pdf2));record('Published PDF bytes remain unchanged after event edit');
 await guest.goto('/forening.html');await guest.locator('.fp-card').first().waitFor();await guest.screenshot({path:resolve(output,'forening-desktop.png'),fullPage:true});
 await guest.goto('/kalender.html');await guest.locator('#calendar-content, #calendar-grid, .cal-month').first().waitFor();await guest.screenshot({path:resolve(output,'kalender-desktop.png'),fullPage:true});
 for(const width of [390,320]){
  await guest.setViewportSize({width,height:844});
  for(const path of ['/forening.html','/kalender.html','/kalender.html?opret=1','/nyt.html']){await guest.goto(path);await guest.waitForTimeout(150);assert.equal(await guest.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,path+' at '+width);}
 }
 await guest.goto('/kalender.html');await guest.screenshot({path:resolve(output,'kalender-mobil.png'),fullPage:true});record('Public pages fit 390px and 320px without horizontal overflow');
 assert.deepEqual(errors,[]);await writeFile(resolve(output,'checks.json'),JSON.stringify({date:new Date().toISOString(),checks,errors,externalMailSent:false},null,2));
 console.log('Portal browser checks passed: '+checks.length+' complete real API/UI scenarios. No external mail sent.');
}catch(error){
 console.error(error.message);for(const [i,page]of pages.entries())await page.screenshot({path:resolve(output,'failure-'+i+'.png'),fullPage:true}).catch(()=>{});process.exitCode=1;
}finally{
 await browser?.close();if(service.exitCode===null){service.kill('SIGTERM');await new Promise(resolve=>service.once('exit',resolve));}await rm(runtime,{recursive:true,force:true});
}
