import {today,dateText} from './portal-api.js';

export function shiftDay(day,offset){const date=new Date(day+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10);}
export const mondayOf=day=>shiftDay(day,-((new Date(day+'T12:00:00Z').getUTCDay()+6)%7));
export function calendarBounds(anchor,mode){
 if(mode==='week'){const from=mondayOf(anchor);return {from,to:shiftDay(from,6),loadFrom:from,loadTo:shiftDay(from,6)};}
 const from=anchor.slice(0,7)+'-01',next=new Date(from+'T12:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);
 const to=shiftDay(next.toISOString().slice(0,10),-1);
 return {from,to,loadFrom:mondayOf(from),loadTo:shiftDay(mondayOf(to),6)};
}
export const overlapsDay=(event,day)=>event.date<=day&&(event.endDate||event.date)>=day;
function element(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
// One renderer for Det sker and Kalender. Every event stays inside its date cell.
export function calendarGrid({events,bounds,mode,onOpen,eventHref}){
 const viewport=element('div','calendar-viewport');viewport.tabIndex=0;viewport.setAttribute('role','region');viewport.setAttribute('aria-label','Kalender. '+(mode==='month'?'Rul vandret på små skærme, eller vælg ugevisning.':'Ugens arrangementer.'));
 const grid=element('div','calendar-grid calendar-grid--'+mode);
 for(const name of ['Mandag','Tirsdag','Onsdag','Torsdag','Fredag','Lørdag','Søndag'])grid.append(element('div','calendar-weekday',name));
 for(let day=bounds.loadFrom;day<=bounds.loadTo;day=shiftDay(day,1)){
  const cell=element('section','calendar-day'+(day<bounds.from||day>bounds.to?' is-outside':'')+(day===today()?' is-today':''));
  cell.setAttribute('aria-label',dateText(day));
  const heading=element('h3','calendar-day-heading'),time=element('time','',String(Number(day.slice(-2))));time.dateTime=day;
  heading.append(element('span','calendar-mobile-weekday',dateText(day,{weekday:'long',day:undefined,month:undefined,year:undefined})),time);cell.append(heading);
  const items=events.filter(e=>overlapsDay(e,day));
  for(const event of items){
   const entry=element('a','calendar-entry'+(event.sourceId?' is-imported':'')+(event.state==='cancelled'?' is-cancelled':''));
   entry.href=eventHref(event);entry.setAttribute('aria-label',(event.state==='cancelled'?'Aflyst. ':'')+event.title+'. '+dateText(day)+(event.time?' kl. '+event.time:''));
   if(onOpen)entry.addEventListener('click',e=>{if(e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();onOpen(event);}});
   const caption=event.state==='cancelled'?'Aflyst':event.date!==day?'Fortsætter':event.time?'Kl. '+event.time.replace(':','.'):'Hele dagen';
   entry.append(element('span','calendar-entry-time',caption),element('strong','calendar-entry-title',event.title));
   if(event.location)entry.append(element('span','calendar-entry-place',event.location));
   cell.append(entry);
  }
  if(!items.length)cell.append(element('span','calendar-day-empty','Ingen arrangementer'));
  grid.append(cell);
 }
 viewport.append(grid);return viewport;
}
