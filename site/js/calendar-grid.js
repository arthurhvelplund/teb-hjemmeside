import {today,dateText} from './portal-api.js';

export function shiftDay(day,offset){const date=new Date(day+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10);}
export const mondayOf=day=>shiftDay(day,-((new Date(day+'T12:00:00Z').getUTCDay()+6)%7));
export function calendarBounds(anchor,mode,{rolling=false}={}){
 if(mode==='week'){const from=rolling?anchor:mondayOf(anchor);return {from,to:shiftDay(from,6),loadFrom:from,loadTo:shiftDay(from,6)};}
 const from=anchor.slice(0,7)+'-01',next=new Date(from+'T12:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);
 const to=shiftDay(next.toISOString().slice(0,10),-1);
 return {from,to,loadFrom:mondayOf(from),loadTo:shiftDay(mondayOf(to),6)};
}
export const overlapsDay=(event,day)=>event.date<=day&&(event.endDate||event.date)>=day;
function element(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function picture(url){
 try{const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password)return null;const img=element('img','calendar-entry-image');img.src=u.href;img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';img.addEventListener('error',()=>img.remove());return img;}catch{return null;}
}
// The shared week view groups photo cards inside their dates. Month retains its grid.
export function calendarGrid({events,bounds,mode,onOpen,eventHref}){
 const viewport=element('div','calendar-viewport calendar-viewport--'+mode);
 viewport.setAttribute('role','region');viewport.setAttribute('aria-label','Kalender. '+(mode==='month'?'Rul vandret på små skærme, eller vælg ugevisning.':'Ugens arrangementer, grupperet efter dato.'));
 if(mode==='month')viewport.tabIndex=0;
 const grid=element('div','calendar-grid calendar-grid--'+mode);
 const strip=element('div','calendar-week-strip');strip.setAttribute('role','group');strip.setAttribute('aria-label','Vælg en dag');
 const cells=[],tabs=[];let selected='';
 const reset=element('button','calendar-reset','Vis hele ugen');reset.type='button';reset.hidden=true;
 function select(day){selected=selected===day?'':day;for(const {cell,date,count}of cells)cell.hidden=Boolean(mode==='week'&&(selected?date!==selected:!count));for(const {tab,date}of tabs)tab.setAttribute('aria-pressed',String(date===selected));reset.hidden=!selected;}
 reset.addEventListener('click',()=>select(selected));
 if(mode==='month')for(let i=0;i<7;i++)grid.append(element('div','calendar-weekday',dateText(shiftDay(bounds.loadFrom,i),{weekday:'long',day:undefined,month:undefined,year:undefined})));
 for(let day=bounds.loadFrom;day<=bounds.loadTo;day=shiftDay(day,1)){
  const items=events.filter(e=>overlapsDay(e,day)),weekday=dateText(day,{weekday:'short',day:undefined,month:undefined,year:undefined});
  const cell=element('section','calendar-day'+(day<bounds.from||day>bounds.to?' is-outside':'')+(day===today()?' is-today':''));
  cell.id='calendar-day-'+day;cell.setAttribute('aria-label',dateText(day));
  const heading=element('h3','calendar-day-heading'),time=element('time','',String(Number(day.slice(-2))));time.dateTime=day;
  heading.append(element('span','calendar-day-weekday',weekday),time);cell.append(heading);
  if(mode==='week'){
   const tab=element('button','calendar-day-tab'+(day===today()?' is-today':''));tab.type='button';tab.setAttribute('aria-controls',cell.id);tab.setAttribute('aria-pressed','false');tab.setAttribute('aria-label',dateText(day)+' · '+items.length+' arrangementer');
   tab.append(element('span','calendar-tab-weekday',weekday),element('strong','',String(Number(day.slice(-2)))),element('span','calendar-tab-count',items.length?String(items.length):'–'));
   tab.addEventListener('click',()=>select(day));strip.append(tab);tabs.push({tab,date:day});
  }
  for(const event of items){
   const entry=element('a','calendar-entry'+(event.sourceId?' is-imported':'')+(event.state==='cancelled'?' is-cancelled':''));
   entry.href=eventHref(event);entry.setAttribute('aria-label',(event.state==='cancelled'?'Aflyst. ':'')+event.title+'. '+dateText(day)+(event.time?' kl. '+event.time:''));
   if(onOpen)entry.addEventListener('click',e=>{if(e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();onOpen(event);}});
   if(mode==='week'){const img=picture(event.image);if(img)entry.append(img);}
   const caption=event.state==='cancelled'?'Aflyst':event.date!==day?'Fortsætter':event.time?'Kl. '+event.time.replace(':','.'):'Hele dagen';
   const copy=element('span','calendar-entry-copy');copy.append(element('span','calendar-entry-time',caption),element('strong','calendar-entry-title',event.title));
   if(event.location)copy.append(element('span','calendar-entry-place',event.location));entry.append(copy);cell.append(entry);
  }
  if(!items.length)cell.append(element('span','calendar-day-empty','Ingen arrangementer denne dag.'));
  cells.push({cell,date:day,count:items.length});grid.append(cell);
 }
 if(mode==='week'){select('');viewport.append(strip,reset);}
 viewport.append(grid);return viewport;
}
