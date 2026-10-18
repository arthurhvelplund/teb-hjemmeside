import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { copenhagenDate,token } from '../src/shared.mjs';
const origin='http://localhost:8788',runtime=resolve('../tmp/kalender-browser-check'),output=resolve('../output/kalender-pilot');
await mkdir(output,{recursive:true});
const service=spawn(process.execPath,['scripts/dev.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:'8788',CALENDAR_DATA_DIR:runtime},stdio:['ignore','ignore','pipe']});
let serviceError='';service.stderr.on('data',data=>serviceError+=data.toString());
let browser;const testPages=[];
try{
 for(let i=0;i<50;i++){try{if((await fetch(origin+'/api/kalender/config')).ok)break;}catch{}if(i===49)throw new Error('Local test server did not start: '+serviceError);await new Promise(r=>setTimeout(r,200));}
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const authorContext=await browser.newContext({baseURL:origin,viewport:{width:1440,height:1000}}),editorContext=await browser.newContext({baseURL:origin,viewport:{width:1280,height:1000}});
 const page=await authorContext.newPage(),editor=await editorContext.newPage();
 testPages.push(page,editor);
 const pageErrors=[];for(const p of [page,editor])p.on('pageerror',error=>pageErrors.push(error.message));
 const next=new Date(copenhagenDate()+'T12:00:00Z');next.setUTCDate(1);next.setUTCMonth(next.getUTCMonth()+1);const month=next.toISOString().slice(0,7);
 await page.goto('/foreningsportal.html');
 for(const [label,value] of [['Hvad skal der ske?','Fællesspisning i hallen'],['Foreningens navn','Eksempelforeningen'],['Dato',month+'-12'],['Klokken','18:00'],['Hvor foregår det?','Hodde-Tistrup Hallen'],['Din e-mail','demo@example.org']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByLabel('Pris, tilmelding og lidt mere').fill('Et opdigtet arrangement til afprøvning af piloten.');
 assert.equal(await page.locator('#preview-title').textContent(),'Fællesspisning i hallen');
 await page.screenshot({path:output+'/formular-desktop.png',fullPage:true});await page.waitForTimeout(1600);
 await page.getByRole('button',{name:'Send til TEBs godkendelse',exact:true}).click();await page.getByRole('heading',{name:'Tak. Vi har modtaget det.'}).waitFor();
 const privatePath=await page.locator('#private-preview-link').getAttribute('href'),eventId=new URL(privatePath,origin).searchParams.get('id');
 const publicEvents=async()=>(await (await authorContext.request.get('/api/kalender/events')).json()).events;
 assert.equal((await publicEvents()).length,0);
 await editor.goto('/kalender-postkasse.html');await editor.getByText('Nyt arrangement til godkendelse:',{exact:false}).click();await editor.getByRole('link',{name:'Åbn TEBs godkendelse'}).click();await editor.getByRole('button',{name:'Åbn redaktionen',exact:true}).click();await editor.locator('#admin-workspace').waitFor({state:'visible'});
 assert.equal((await publicEvents()).length,0);
 await editor.screenshot({path:output+'/redaktion-desktop.png',fullPage:true});await editor.getByRole('button',{name:'Godkend og offentliggør',exact:true}).click();await editor.getByText('Arrangementet er godkendt og vises nu i kalenderen.',{exact:true}).waitFor();
 await page.goto('/'+privatePath);await page.getByText('Godkendt og offentliggjort',{exact:true}).waitFor();await page.getByText('Ret oplysningerne',{exact:true}).click();await page.getByLabel('Klokken',{exact:true}).fill('19:30');await page.getByRole('button',{name:'Send rettelsen til TEB'}).click();await page.getByText('Afventer TEBs godkendelse',{exact:true}).waitFor();
 assert.equal((await publicEvents())[0].time,'18:00');
 await editor.getByRole('button',{name:'Opdatér listen'}).click();await editor.getByRole('button',{name:'Godkend og offentliggør',exact:true}).click();await editor.getByText('Arrangementet er godkendt og vises nu i kalenderen.',{exact:true}).waitFor();assert.equal((await publicEvents())[0].time,'19:30');
 const titles=['Banko og kaffe','Fællessang','Foredrag i forsamlingshuset','Kom og spil krolf','Julehygge på torvet','Klubdag med gæst','Åben hal for familien','Koncert i kirken','Fælles gåtur','Julebanko','Håndbold for hele familien','Juleafslutning'];
 const locations=['Tistrup Plejecenter','Hodde Forsamlingshus','Hodde-Tistrup Hallen','Tistrup Torv'];
 for(let i=0;i<titles.length;i++){
  const date=new Date(next);if(i>=6)date.setUTCMonth(date.getUTCMonth()+1);date.setUTCDate(i%6*4+2);
  const payload={event:{title:titles[i],association:'Eksempelforeningen',date:date.toISOString().slice(0,10),time:i%2?'19:00':'14:30',location:locations[i%locations.length],description:'Opdigtet eksempel til afprøvning af kalender og print.'},email:'demo@example.org',authorToken:token(),requestKey:crypto.randomUUID(),startedAt:Date.now()-5000};
  const response=await authorContext.request.post('/api/kalender/events',{headers:{Origin:origin},data:payload});assert.equal(response.status(),201);const result=await response.json();assert.equal((await editorContext.request.post('/api/kalender/admin/events/'+result.id,{headers:{Origin:origin},data:{action:'approve',revision:1}})).status(),200);
 }
 await editor.getByLabel('Første måned').fill(month);await editor.getByLabel('Frist for godkendt indhold').fill(copenhagenDate());await editor.getByRole('button',{name:'Afslut og udgiv printudgaven'}).click();await editor.getByText('Printudgaven er afsluttet',{exact:false}).waitFor();
 const editions=(await (await authorContext.request.get('/api/kalender/editions')).json()).editions;assert.equal(editions.length,1);const pdf=await authorContext.request.get('/api/kalender/editions/'+editions[0].id+'/pdf');assert.equal(pdf.status(),200);await writeFile(output+'/tistrup-kalender-pilot.pdf',await pdf.body());
 await page.goto('/kalender.html');await page.getByRole('heading',{name:'Fællesspisning i hallen',exact:true}).waitFor();assert.equal(await page.locator('.calendar-event').count(),13);assert.equal(await page.locator('body').evaluate(node=>node.scrollWidth>innerWidth),false);await page.screenshot({path:output+'/kalender-desktop.png',fullPage:true});
 await page.goto('/'+privatePath);page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Bed TEB om at aflyse arrangementet'}).click();await page.getByText('Aflysning afventer TEBs godkendelse',{exact:true}).waitFor();assert.equal((await publicEvents()).find(e=>e.id===eventId).state,'approved');
 await editor.getByRole('button',{name:'Opdatér listen'}).click();const pendingRow=editor.locator('.calendar-review').filter({hasText:'Fællesspisning i hallen'});await pendingRow.waitFor();if(!await pendingRow.evaluate(node=>node.open))await pendingRow.locator('summary').first().click();await editor.getByRole('button',{name:'Godkend aflysningen'}).click();await editor.getByText('Aflysningen er godkendt.',{exact:true}).waitFor();assert.equal((await publicEvents()).find(e=>e.id===eventId).state,'cancelled');
 await page.setViewportSize({width:390,height:844});await page.goto('/foreningsportal.html');await page.locator('#send-activity:not(:disabled)').waitFor();assert.equal(await page.locator('body').evaluate(node=>node.scrollWidth>innerWidth),false);await page.screenshot({path:output+'/formular-mobil.png',fullPage:true});
 await page.goto('/kalender.html');await page.locator('.calendar-event').first().waitFor();assert.equal(await page.locator('body').evaluate(node=>node.scrollWidth>innerWidth),false);await page.screenshot({path:output+'/kalender-mobil.png',fullPage:true});
 await editor.setViewportSize({width:390,height:844});await editor.getByLabel('Vis',{exact:true}).selectOption('all');await editor.locator('.calendar-review').first().locator('summary').first().click();assert.equal(await editor.locator('body').evaluate(node=>node.scrollWidth>innerWidth),false);await editor.screenshot({path:output+'/redaktion-mobil.png',fullPage:true});
 assert.deepEqual(pageErrors,[]);console.log('Browser check passed: submission, private preview, approval, moderated edit, cancellation, PDF, 13 sample events, desktop and mobile. No real email sent.');
}catch(error){console.error(error.message);for(const [i,p] of testPages.entries()){await p.screenshot({path:output+'/failure-'+i+'.png',fullPage:true}).catch(()=>{});console.error('Visible page '+i+': '+(await p.locator('body').innerText()).slice(0,1800));}process.exitCode=1;}finally{if(browser)await browser.close();service.kill('SIGTERM');await new Promise(resolve=>service.once('exit',resolve));await rm(runtime,{recursive:true,force:true});}
