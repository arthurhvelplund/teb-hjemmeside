export const $ = selector => document.querySelector(selector);
export function el(tag, attributes={}, ...children) {
  const node=document.createElement(tag);
  for(const [key,value] of Object.entries(attributes)) {
    if(key.startsWith('on'))node.addEventListener(key.slice(2).toLowerCase(),value);
    else if(key==='class')node.className=value;
    else if(key==='text')node.textContent=value;
    else if(key in node && !['form','list'].includes(key))node[key]=value;
    else node.setAttribute(key,value);
  }
  for(const child of children.flat())if(child!==null&&child!==undefined)node.append(typeof child==='string'?document.createTextNode(child):child);
  return node;
}
export async function api(path,options={}) {
  const {body,token,...rest}=options;
  const response=await fetch('/api/kalender'+path,{signal:AbortSignal.timeout(25000),...rest,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});
  const result=await response.json().catch(()=>({error:'Kalenderen kunne ikke kontaktes. Prøv igen om lidt.'}));
  if(!response.ok){const error=new Error(result.error||'Der opstod en fejl.');error.status=response.status;throw error;}
  return result;
}
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Copenhagen',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function dateText(date,options={}) { return new Intl.DateTimeFormat('da-DK',{day:'numeric',month:'long',year:'numeric',...options}).format(new Date(date+'T12:00:00')); }
export function monthText(month) { return new Intl.DateTimeFormat('da-DK',{month:'long',year:'numeric'}).format(new Date(month+'-01T12:00:00')); }
export function when(data) { return dateText(data.date)+(data.endDate&&data.endDate!==data.date?' til '+dateText(data.endDate):'')+' · kl. '+data.time.replace(':','.')+(data.endTime?'–'+data.endTime.replace(':','.'):''); }
export function notice(node,message,error=false) { node.replaceChildren(el('p',{class:error?'calendar-notice is-error':'calendar-notice',role:error?'alert':'status'},message)); }
export async function setup() {
  try {
    const config=await api('/config');
    if(config.mode==='local') {
      const banner=el('div',{class:'calendar-pilot'},'Lokal pilot. Data gemmes her på computeren. Ingen e-mails sendes. ',el('a',{href:'kalender-postkasse.html'},'Åbn testpostkassen'));
      document.querySelector('header').after(banner);
    }
    return config;
  } catch { return {mode:'offline',submissionsEnabled:false}; }
}
export function eventCard(event,{compact=false}={}) {
  const cancelled=event.state==='cancelled';
  const date=new Date(event.date+'T12:00:00');
  const details=el('div',{class:'calendar-event-content'},
    cancelled?el('p',{class:'calendar-status cancelled'},'Aflyst'):null,
    el('h3',{},event.title),el('p',{class:'calendar-event-when'},when(event)),
    el('p',{},event.location),el('p',{class:'calendar-organizer'},event.association));
  if(!compact) {
    const more=el('details',{},el('summary',{},'Læs mere'));
    if(event.description)more.append(el('p',{class:'calendar-description'},event.description));
    if(event.link&&!cancelled)more.append(el('a',{href:event.link,target:'_blank',rel:'noopener noreferrer',class:'calendar-inline-link'},'Tilmelding og mere information'));
    if(event.id) {
      const url=new URL('kalender.html?arrangement='+event.id,location.href).href;
      const share=el('button',{type:'button',class:'calendar-link-button',onClick:async()=>{try{if(navigator.share)await navigator.share({title:event.title,url});else{await navigator.clipboard.writeText(url);share.textContent='Link kopieret';}}catch{share.textContent='Link: '+url;}}},'Del arrangementet');
      more.append(share);
      if(!cancelled)more.append(el('button',{type:'button',class:'calendar-link-button',onClick:()=>downloadIcs(event)},'Føj til min kalender'));
    }
    details.append(more);
  } else if(event.description)details.append(el('p',{class:'calendar-description'},event.description));
  return el('article',{class:'calendar-event'+(cancelled?' is-cancelled':''),id:event.id?'arrangement-'+event.id:''},
    el('div',{class:'calendar-date'},el('strong',{},String(date.getDate())),el('span',{},date.toLocaleDateString('da-DK',{month:'short'}))),details);
}
function icsEscape(text){return String(text).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');}
function downloadIcs(event) {
  const stamp=(date,time)=>date.replaceAll('-','')+'T'+time.replace(':','')+'00';
  const timeZone=['BEGIN:VTIMEZONE','TZID:Europe/Copenhagen','BEGIN:DAYLIGHT','DTSTART:19700329T020000','TZOFFSETFROM:+0100','TZOFFSETTO:+0200','RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU','END:DAYLIGHT','BEGIN:STANDARD','DTSTART:19701025T030000','TZOFFSETFROM:+0200','TZOFFSETTO:+0100','RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU','END:STANDARD','END:VTIMEZONE'];
  const fields=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//TEB//Tistrup Kalenderen//DA',...timeZone,'BEGIN:VEVENT','UID:'+event.id+'@tistrup-kalender', 'DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''),'DTSTART;TZID=Europe/Copenhagen:'+stamp(event.date,event.time),
    ...(event.endTime?['DTEND;TZID=Europe/Copenhagen:'+stamp(event.endDate||event.date,event.endTime)]:[]),
    'SUMMARY:'+icsEscape(event.title),'LOCATION:'+icsEscape(event.location),'DESCRIPTION:'+icsEscape(event.description||''),'END:VEVENT','END:VCALENDAR'];
  const url=URL.createObjectURL(new Blob([fields.join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'}));
  const link=el('a',{href:url,download:'tistrup-arrangement.ics'});link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function eventForm(data={}) {
  const form=el('form',{class:'portal-form'});
  for(const [name,label,type,required,maxLength] of [['title','Hvad skal der ske?','text',true,100],['association','Foreningens navn','text',true,100],['date','Dato','date',true,10],['time','Klokken','time',true,5],['location','Hvor foregår det?','text',true,180],['description','Pris, tilmelding og lidt mere','textarea',false,1500],['link','Link til tilmelding eller mere information','url',false,500],['endDate','Slutdato, hvis det varer flere dage','date',false,10],['endTime','Sluttidspunkt, hvis det er kendt','time',false,5]]) {
    const id='field-'+crypto.randomUUID();
    const input=el(type==='textarea'?'textarea':'input',{name,id,required,maxLength,value:data[name]||'',...(type==='textarea'?{rows:3}:{type})});
    if(type==='date')input.min=today();
    form.append(el('div',{},el('label',{htmlFor:id},label+(required?'':' · valgfrit')),input));
  }
  return form;
}
export function formEvent(form) { const data=Object.fromEntries(new FormData(form));return Object.fromEntries(['title','association','date','time','endDate','endTime','location','description','link'].map(key=>[key,String(data[key]||'').trim()])); }
export async function busy(button,task) { button.disabled=true;try{await task();}finally{if(button.isConnected)button.disabled=false;} }
