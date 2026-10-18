// Explicit, fictional local seed. Uses only the loopback API and never email.
import { copenhagenDate,token } from '../src/shared.mjs';
const origin=process.env.CALENDAR_ORIGIN||'http://localhost:8787';
if(!['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname))throw new Error('Seed requires loopback.');
let cookie='';
async function call(path,data){
 const response=await fetch(origin+'/api/kalender'+path,{headers:{Origin:origin,...(data?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(data?{method:'POST',body:JSON.stringify(data)}:{})});
 const result=await response.json();if(!response.ok)throw new Error(result.error||'Seed failed');
 if(response.headers.get('Set-Cookie'))cookie=response.headers.get('Set-Cookie').split(';')[0];return result;
}
async function login(email){
 const challenge=await call('/auth/request',{email});
 const {messages}=await call('/local-mail');const message=messages.find(m=>m.recipient===email&&m.subject==='Din engangskode til TEB');
 await call('/auth/verify',{challengeId:challenge.challengeId,code:message.body.match(/\b\d{6}\b/)[0]});
}
if((await call('/config')).mode!=='local')throw new Error('Example data requires local mode.');
await login('teb-admin@example.test');
const existing=(await call('/associations')).associations;
let association=existing.find(a=>a.name==='Eksempelforeningen Solsiden');
if(!association)association=(await call('/admin/associations',{association:{name:'Eksempelforeningen Solsiden',category:'Fritid',description:'Opdigtet forening til lokal afprøvning. Ingen af arrangementerne finder sted.',chair:'Eksempel Formand',email:'kontakt@example.test',place:'Eksempelhuset'}})).association;
const roster=(await call('/associations/'+association.id+'/members')).members;
for(const [email,name,role] of [['ansvarlig@example.test','Eksempel Ansvarlig','manager'],['redaktor@example.test','Eksempel Redaktør','editor']]){
 if(!roster.some(m=>m.email===email))await call('/admin/associations/'+association.id+'/members',{email,name,role});
}
const publicEvents=(await call('/events?from=2000-01-01&to=2099-12-31')).events;
if(!publicEvents.some(e=>e.associationId===association.id)){
 await login('ansvarlig@example.test');
 const next=new Date(copenhagenDate()+'T12:00:00Z');next.setUTCDate(1);next.setUTCMonth(next.getUTCMonth()+1);
 for(let i=0;i<8;i++){
  const date=new Date(next);date.setUTCDate(2+i*3);
  await call('/events',{associationId:association.id,requestKey:crypto.randomUUID(),event:{title:['Fællesspisning','Fællessang','Banko og kaffe','Åben hal','Frivilligaften','Fælles gåtur','Foredrag','Klubdag'][i],association:association.name,date:date.toISOString().slice(0,10),time:'18:00',location:'Eksempelhuset',description:'Opdigtet lokalt eksempel.',price:'50 kr.'}});
 }
 await call('/events',{event:{title:'Gæstens forslag til godkendelse',association:'Eksempelgæsterne',date:next.toISOString().slice(0,10),time:'19:00',location:'Eksempelhuset'},email:'gaest@example.test',authorToken:token(),requestKey:crypto.randomUUID(),startedAt:Date.now()-5000});
}
console.log('Fiktive lokale data klar. OTP-login: teb-admin@example.test, ansvarlig@example.test og redaktor@example.test. Koder findes kun i /api/kalender/local-mail. Ingen e-mails sendes.');
