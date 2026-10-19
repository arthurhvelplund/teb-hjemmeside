// Prepare a local review with directory drafts and private practice access.
// Existing records are preserved. This never creates example events or sends mail.
import './seed-associations.mjs';

const origin=new URL(process.env.CALENDAR_ORIGIN||'http://localhost:8787').origin;
let cookie='';
async function call(path,data){
 const response=await fetch(origin+'/api/kalender'+path,{headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(data?{'Content-Type':'application/json'}:{})},...(data?{method:'POST',body:JSON.stringify(data)}:{})});
 const body=await response.json();if(!response.ok)throw Error(body.error||'Piloten kunne ikke klargøres.');
 if(response.headers.get('Set-Cookie'))cookie=response.headers.get('Set-Cookie').split(';')[0];
 return body;
}
const config=await call('/config');
if(!['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname)||config.mode!=='local')throw Error('Pilotdata kræver lokal loopback-drift.');
const challenge=await call('/auth/request',{email:config.editorEmail});
const {messages}=await call('/local-mail');
const message=messages.find(m=>m.recipient===config.editorEmail&&m.subject==='Din engangskode til TEB');
await call('/auth/verify',{challengeId:challenge.challengeId,code:message?.body.match(/\b\d{6}\b/)?.[0]});
const {associations}=await call('/associations');
let association=associations.find(a=>a.name==='Eksempelforeningen Solsiden');
if(!association)association=(await call('/admin/associations',{requestKey:'b5c89a12-a7b7-4ad4-b7a5-e3f51605c4cc',association:{name:'Eksempelforeningen Solsiden',category:'Lokal afprøvning',description:'Opdigtet øveforening til login og administration. Ingen af oplysningerne beskriver en rigtig forening.',place:'Lokalt øveområde'}})).association;
const {members}=await call('/associations/'+association.id+'/members');
for(const [email,name,role]of [['ansvarlig@example.test','Øveansvarlig','manager'],['redaktor@example.test','Øveredaktør','editor']]){
 if(!members.some(m=>m.email===email&&['active','invited'].includes(m.status)))await call('/admin/associations/'+association.id+'/members',{email,name,role});
}
console.log('Lokal pilot klar med 24 foreningsudkast og en skjult øveforening. Ingen eksempelarrangementer er oprettet. Eksisterende data er bevaret.');
console.log('Øvelogin: ansvarlig@example.test. Koden findes kun i den lokale testpostkasse. Ingen eksterne mails sendes.');
