import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {accountHome,accountContinueLabel} from '../site/js/account-entry.js';
const source=await readFile(new URL('../site/js/forening.js',import.meta.url),'utf8');
const returnFunction=source.slice(source.indexOf('function returnTarget()'),source.indexOf('function heading('));
const gateStart=source.indexOf("if (r.page === 'min-side'");
const gate=source.slice(gateStart,source.indexOf('    navigation(r.page);',gateStart));
assert.ok(gateStart>0&&gate.includes('accountHome(session)'),'exercise actual account entrance routing');
for(const fixture of [
 {url:'forening.html#min-side',authenticated:false,page:'login'},
 {url:'forening.html#min-side',authenticated:true,isAdmin:true,page:'min-forening'},
 {url:'forening.html#min-side',authenticated:true,isAdmin:false,page:'min-forening'},
 {url:'forening.html?return=kalender.html#login',authenticated:true,isAdmin:true,page:'min-forening'},
 {url:'forening.html?return=kalender.html#login',authenticated:true,isAdmin:false,page:'min-forening'},
 {url:'forening.html?return=kalender.html%3Fret%3Dexample#login',authenticated:true,isAdmin:true,action:'kalender.html?ret=example'},
 {url:'forening.html#login',authenticated:true,isAdmin:true,completion:true,page:'login'}
]){
 const current=new URL(fixture.url,'https://teb.example.test/');let changed='',assigned='';
 const session={authenticated:fixture.authenticated,user:{isAdmin:fixture.isAdmin},memberships:[]};
 const r={page:current.hash.slice(1)};
 await runInNewContext('(async()=>{'+returnFunction+';'+gate+'})()',{
 URL,URLSearchParams,r,session,accountHome,loginCompletion:Boolean(fixture.completion),authenticated:()=>session.authenticated,
 location:{href:current.href,origin:current.origin,search:current.search,assign:value=>assigned=value},history:{replaceState:(_state,_title,url)=>changed=url}
 });
 if(fixture.action)assert.equal(assigned,new URL(fixture.action,current).href,'preserve requested event editing');
 else {assert.equal(r.page,fixture.page,fixture.url);assert.equal(assigned,'');if(changed){assert.equal(new URL(changed).hash,'#'+fixture.page);assert.equal(new URL(changed).searchParams.has('return'),false);}}
}
assert.equal(accountContinueLabel({user:{isAdmin:true}}),'Fortsæt til Min forening');
assert.equal(accountContinueLabel({user:{isAdmin:true}},'https://teb.example.test/forening.html#teb'),'Fortsæt til TEB-administration');
assert.equal(accountContinueLabel({user:{isAdmin:false}}),'Fortsæt til Min forening');
assert.equal(accountContinueLabel({user:{isAdmin:true}},'https://teb.example.test/kalender.html?ret=x'),'Fortsæt til arrangementet');
assert.equal(accountContinueLabel({user:{isAdmin:true}},'https://teb.example.test/nyt.html'),'Fortsæt');
const site=new URL('../site/',import.meta.url);let pages=0;
for(const name of await readdir(site))if(name.endsWith('.html')){
 const html=await readFile(new URL(name,site),'utf8');if(!html.includes('class="site-header"'))continue;
 pages++;assert.equal((html.match(/data-account-entry/g)||[]).length,1,name+' has one shared entrance');
 assert.ok(!/id="calendar-login"/.test(html),name+' has no extra calendar login');
 assert.equal((html.match(/id="forening-workspace-link"/g)||[]).length,name==='forening.html'?1:0,name+' preserves only the familiar association shortcut');
 assert.equal((html.match(/data-admin-entry/g)||[]).length,1,name+' has a separate administration entrance');
}
for(const directory of [site,new URL('js/',site)])for(const name of await readdir(directory))if(/\.(html|js)$/.test(name)){
 const text=await readFile(new URL(name,directory),'utf8');
 for(const match of text.matchAll(/<(a|button)\b[^>]*class=["'][^"']*\bbtn\b[^"']*["'][^>]*>[\s\S]*?<\/\1>/g))assert.ok(!/[→↗]/.test(match[0]),name+' embeds an arrow in a button already supplied by CSS');
}
console.log('Account entry checks passed: shared association defaults, separate admin return, legacy-calendar loop, event return, OTP completion, '+pages+' shared entrances and button arrow audit.');
