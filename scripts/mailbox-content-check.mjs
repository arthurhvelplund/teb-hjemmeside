// Exercise the real mailbox module against an isolated local HTTP fixture.
// No email body, login code or private link is written to the test output.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,access} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(root+'calendar-worker/package.json');
const {chromium}=require('playwright');
let messages=[],status=200,requests=0;
const server=createServer(async(req,res)=>{
 if(req.url==='/api/kalender/local-mail'){
  requests++;res.writeHead(status,{'Content-Type':'application/json'});
  res.end(JSON.stringify(status===200?{messages}:{error:'Test fixture unavailable'}));return;
 }
 if(['/js/kalender-postkasse.js','/js/mail-content.js','/js/portal-api.js'].includes(req.url)){
  res.writeHead(200,{'Content-Type':'application/javascript'});res.end(await readFile(root+'site'+req.url));return;
 }
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
 res.end('<!doctype html><html lang="da"><title>Mailbox test</title><button id="mail-refresh">Hent nye testmails</button><p id="mail-updated"></p><div id="mail-message"></div><main id="mail-content"></main><script type="module" src="/js/kalender-postkasse.js"></script></html>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 let executablePath=process.env.CHROME_PATH;
 if(!executablePath&&process.platform==='darwin'){
  const path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  try{await access(path);executablePath=path;}catch{}
 }
 browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
 const page=await browser.newPage();const errors=[],outside=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>{
  if(new URL(route.request().url()).origin!==origin){outside.push(true);return route.abort();}
  return route.continue();
 });
 await page.clock.install();await page.goto(origin);
 await page.getByText('Ingen testmails endnu.',{exact:false}).waitFor();
 const privateMarker='fixture-private-value';
 messages=[{id:'test-1',recipient:'member@example.test',subject:'En mail til gennemgang',created_at:'2026-10-18T10:30:00Z',
  body:'Log ind på '+origin+'/forening.html for at gennemgå indsendelsen.\n'+
   'Privat link ('+origin+'/kalender.html?privat=fixture#adgang='+privateMarker+').\n'+
   '<img src="https://external.example/pixel"> https://external.example/side\nEngangskode: 123456'}];
 await page.getByRole('button').click();await page.locator('summary').waitFor();
 assert.match(await page.locator('summary').innerText(),/member@example.test/);
 assert.match(await page.locator('summary').innerText(),/18\. okt\. 2026/);
 await page.locator('summary').click();
 assert.equal(await page.locator('#mail-content a').count(),2);
 assert.ok((await page.getByRole('link',{name:'Åbn dit private arrangementslink'}).getAttribute('href')).endsWith(privateMarker));
 assert.ok(!(await page.locator('#mail-content').innerText()).includes(privateMarker));
 assert.equal(await page.locator('#mail-content img').count(),0);
 await page.locator('details').evaluate(node=>node.fixtureIdentity=true);
 await page.getByRole('button').click();
 assert.ok(await page.locator('details').evaluate(node=>node.open&&node.fixtureIdentity));
 await page.locator('summary').focus();const before=requests;
 messages.unshift({...messages[0],id:'test-2',subject:'Ny mail'});
 await page.clock.fastForward(8500);
 assert.equal(requests,before,'Background refresh waits while a message is focused');
 assert.equal(await page.locator('details').count(),1);
 await page.getByRole('button').focus();await page.clock.fastForward(8500);
 await page.getByText('Ny mail',{exact:false}).waitFor();
 assert.ok(await page.locator('details').last().evaluate(node=>node.open&&node.fixtureIdentity));
 // Preserve a selected login code when an automatic refresh would otherwise run.
 await page.locator('details').last().locator('p').last().evaluate(node=>{
  const selection=window.getSelection();const range=document.createRange();
  range.selectNodeContents(node);selection.removeAllRanges();selection.addRange(range);
 });
 const selectedBefore=requests;await page.clock.fastForward(8500);
 assert.equal(requests,selectedBefore);assert.ok(await page.evaluate(()=>!getSelection().isCollapsed));
 await page.evaluate(()=>getSelection().removeAllRanges());
 await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}));
 const hiddenBefore=requests;await page.clock.fastForward(8500);assert.equal(requests,hiddenBefore);
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForFunction(()=>document.querySelector('#mail-content').getAttribute('aria-busy')==='false');
 status=503;await page.getByRole('button').click();
 await page.getByText('Testmails kunne ikke hentes lige nu.',{exact:false}).waitFor();
 assert.equal(await page.locator('details').count(),2);
 status=200;await page.getByRole('button').click();
 await page.waitForFunction(()=>!document.querySelector('#mail-message').textContent);
 status=403;await page.getByRole('button').click();
 await page.getByText('Testpostkassen findes kun på den lokale server.',{exact:false}).waitFor();
 const stopped=requests;await page.clock.fastForward(8500);assert.equal(requests,stopped);
 status=200;await page.getByRole('button').click();
 await page.waitForFunction(()=>!document.querySelector('#mail-message').textContent);
 await page.context().setOffline(true);await page.getByRole('button').click();
 await page.getByText('Du er offline.',{exact:false}).waitFor();
 await page.context().setOffline(false);
 await page.waitForFunction(()=>!document.querySelector('#mail-message').textContent);
 messages.push({...messages[0],id:7,subject:'Bevaret mail fra den oprindelige pilot'});
 await page.getByRole('button').click();
 await page.getByText('Bevaret mail fra den oprindelige pilot',{exact:false}).waitFor();
 assert.equal(await page.locator('details').count(),3,'Original numeric mailbox IDs are retained');
 assert.equal(errors.length,0,'No browser exceptions');assert.equal(outside.length,0,'No external requests');
 console.log('Mailbox check passed: inline links, safe text, recipient/date, refresh, preserved focus/selection, offline and error recovery.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
