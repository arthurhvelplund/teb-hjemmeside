import {$,api,setup,today,notice,formEvent} from './kalender-faelles.js';
const form=$('#activity-form'),button=$('#send-activity'),receipt=$('#activity-receipt');
const config=await setup();
let startedAt=Date.now(),attempt=null;
const field=name=>form.elements.namedItem(name);
const value=name=>field(name)?.value.trim()||'';
function updatePreview(){
  const date=value('date')?new Date(value('date')+'T12:00:00'):null;
  $('#preview-day').hidden=!date;$('#preview-day').textContent=date?String(date.getDate()):'';
  $('#preview-month').textContent=date?date.toLocaleDateString('da-DK',{month:'short'}).replace('.',''):'Din dato';
  $('#preview-time').textContent=[date?date.toLocaleDateString('da-DK',{day:'numeric',month:'long',year:'numeric'}):'',value('time')?'kl. '+value('time').replace(':','.'):''].filter(Boolean).join(' · ')||'Dato og tid';
  $('#preview-title').textContent=value('title')||'Jeres næste arrangement';$('#preview-location').textContent=value('location')||'Sted og adresse';
  $('#preview-description').textContent=value('description')||'Her står lidt om arrangementet.';$('#preview-association').textContent=value('association')||'Jeres forening';
  const lines=[['Arrangement',value('title')],['Forening',value('association')],['Dato',value('date')],['Klokken',value('time')],['Sted',value('location')],['Beskrivelse',value('description')],['Kontakt',value('email')]].filter(x=>x[1]);
  $('#send-activity-email').href='mailto:tistrup.kalender@gmail.com?subject='+encodeURIComponent('Arrangement til kalenderen'+(value('title')?': '+value('title'):''))+'&body='+encodeURIComponent(lines.map(x=>x[0]+': '+x[1]).join('\n'));
}
form.addEventListener('input',event=>{if(['title','association','location'].includes(event.target.name))event.target.setCustomValidity(event.target.value.trim()?'':'Skriv venligst i dette felt.');updatePreview();});
form.addEventListener('change',updatePreview);
field('date').min=today();field('endDate').min=today();
try{const stored=sessionStorage.getItem('teb-calendar-unsure');if(stored){attempt=JSON.parse(stored);for(const [name,text] of Object.entries({...attempt.event,email:attempt.email}))if(field(name))field(name).value=text;notice($('#submission-message'),'En tidligere indsendelse blev ikke bekræftet. Tryk igen for at kontrollere den samme indsendelse.');}}catch{}
function lockInputs(locked){for(const input of form.querySelectorAll('input,textarea'))input.readOnly=locked;}
if(attempt)lockInputs(true);
form.addEventListener('submit',async event=>{
  event.preventDefault();if(button.disabled||!form.reportValidity())return;
  button.disabled=true;button.textContent='Sender…';$('#submission-message').replaceChildren();
  if(!attempt){const bytes=crypto.getRandomValues(new Uint8Array(32));attempt={event:formEvent(form),email:value('email'),website:value('website'),startedAt,requestKey:crypto.randomUUID(),authorToken:Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('')};}
  try{sessionStorage.setItem('teb-calendar-unsure',JSON.stringify(attempt));}catch{}
  lockInputs(true);
  try{
    const result=await api('/events',{body:attempt});
    const link='mit-arrangement.html?id='+result.id+'#adgang='+attempt.authorToken;$('#private-preview-link').href=link;
    form.hidden=true;receipt.hidden=false;
    const text=result.notificationState==='local'?'Gemt i den lokale pilot. TEBs besked og din kvittering ligger i testpostkassen. Ingen e-mails er sendt.':result.notificationState==='failed'?'Arrangementet er gemt, men mailen til TEB kunne ikke sendes. Kontakt TEB på tistrup.kalender@gmail.com.':result.notificationState==='pending'?'Arrangementet er gemt. Beskeden til TEB afventer afsendelse. Gem dit private link her.':result.receiptState!=='sent'?'Mailen til TEB er afsendt. Gem dit private link her, da din kvitteringsmail endnu ikke er bekræftet afsendt.':'Mailen til TEB er afsendt. Dit private link er også sendt til din e-mail.';
    notice($('#receipt-delivery'),text,result.notificationState==='failed');
    try{sessionStorage.removeItem('teb-calendar-unsure');}catch{}
    attempt=null;$('#receipt-heading').focus();
  }catch(error){
    const unsure=!error.status||error.status>=500;
    notice($('#submission-message'),unsure?'Vi kunne ikke bekræfte modtagelsen. Tryk på knappen igen. Den samme indsendelse kontrolleres, så arrangementet ikke bliver oprettet to gange.':error.message,true);
    if(!unsure){attempt=null;lockInputs(false);try{sessionStorage.removeItem('teb-calendar-unsure');}catch{}}
  }finally{button.disabled=false;button.textContent=attempt?'Prøv den samme indsendelse igen':'Send til TEBs godkendelse';}
});
$('#another-activity').addEventListener('click',()=>{form.reset();lockInputs(false);form.hidden=false;receipt.hidden=true;startedAt=Date.now();button.textContent='Send til TEBs godkendelse';updatePreview();field('title').focus();});
button.disabled=!config.submissionsEnabled;
$('#submission-mode').textContent=config.mode==='local'?'Lokal pilot. Oplysninger gemmes her. Ingen e-mails sendes.':config.submissionsEnabled?'TEB gennemgår alle arrangementer inden offentliggørelse.':'Kun forhåndsvisning. Indsendelse er endnu ikke åbnet her. Send i stedet en e-mail.';
updatePreview();
