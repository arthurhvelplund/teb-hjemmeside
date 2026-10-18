import {mkdir,writeFile} from 'node:fs/promises';
import {copenhagenDate,token} from '../src/shared.mjs';
const origin='http://localhost:8787';
let cookie='';
async function call(path,data){
 const response=await fetch(origin+'/api/kalender'+path,{headers:{Origin:origin,'CF-Connecting-IP':'local-demo-seed',...(data?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(data?{method:'POST',body:JSON.stringify(data)}:{})});
 const result=await response.json();if(!response.ok)throw new Error(result.error||'Seed failed');return result;
}
if((await call('/config')).mode!=='local')throw new Error('Eksempeldata må kun oprettes på den lokale pilot.');
if((await call('/events')).events.length){console.log('Kalenderen har allerede arrangementer. Ingen eksempeldata tilføjet.');process.exit();}
const next=new Date(copenhagenDate()+'T12:00:00Z');next.setUTCDate(1);next.setUTCMonth(next.getUTCMonth()+1);const month=next.toISOString().slice(0,7);
const titles=['Banko og kaffe','Fællessang','Foredrag i forsamlingshuset','Fællesspisning i hallen','Kom og spil krolf','Julehygge på torvet','Klubdag med gæst','Åben hal for familien','Koncert i kirken','Fælles gåtur','Julebanko','Håndbold for hele familien','Juleafslutning','Frivilligaften'];
const places=['Tistrup Plejecenter','Hodde Forsamlingshus','Hodde-Tistrup Hallen','Tistrup Torv'];
for(let i=0;i<titles.length+1;i++){
 const date=new Date(next);if(i>=7)date.setUTCMonth(date.getUTCMonth()+1);date.setUTCDate(i%7*3+2);
 const data={title:titles[i]||'Nyt arrangement til godkendelse',association:'Eksempelforeningen',date:date.toISOString().slice(0,10),time:i%2?'19:00':'14:30',location:places[i%places.length],description:'Dette er et opdigtet eksempel til afprøvning af piloten. Arrangementet finder ikke sted.'};
 const result=await call('/events',{event:data,email:'demo@example.org',authorToken:token(),requestKey:crypto.randomUUID(),startedAt:Date.now()-5000});
 if(!cookie){
  const {messages}=await call('/local-mail');const message=messages.find(m=>m.body.includes('#login='));const login=message.body.match(/#login=([a-f0-9]{64})/)[1];
  const session=await fetch(origin+'/api/kalender/admin/session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({token:login})});if(!session.ok)throw new Error('Local login failed');cookie=session.headers.get('Set-Cookie').split(';')[0];
 }
 if(i<titles.length)await call('/admin/events/'+result.id,{action:'approve',revision:1});
}
const edition=await call('/admin/editions',{month,deadline:copenhagenDate()});
const pdf=await fetch(origin+'/api/kalender/editions/'+edition.id+'/pdf');if(!pdf.ok)throw new Error('PDF could not be generated');
const output=new URL('../../output/kalender-pilot/',import.meta.url);await mkdir(output,{recursive:true});await writeFile(new URL('tistrup-kalender-pilot.pdf',output),new Uint8Array(await pdf.arrayBuffer()));
console.log('14 opdigtede arrangementer er godkendt. Ét afventer godkendelse. Printudgaven er oprettet. Ingen e-mails er sendt.');
