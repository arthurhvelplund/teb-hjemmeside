import {today,dateText} from './portal-api.js';
import {shiftDay,overlapsDay} from './calendar-grid.js';

// Public calendar views: one column per day for a week or a month, and the upcoming events below.
function element(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
export function photo(url,cls){
 if(typeof url!=='string'||!url.trim())return null;
 try{const u=new URL(url,location.href);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||(u.protocol==='http:'&&u.origin!==location.origin))return null;const img=element('img',cls);img.src=u.href;img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';return img;}catch{return null;}
}
const clock=time=>time.replace(':','.');
export const sourceLabel=event=>event.association||event.sourceName||'';
function link(event,{eventHref,onOpen},cls){
 const a=element('a',cls+(event.state==='cancelled'?' is-cancelled':''));a.href=eventHref(event);
 if(onOpen)a.addEventListener('click',e=>{if(e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();onOpen(event);}});
 return a;
}
const weekday=(day,style='short')=>{const name=dateText(day,{weekday:style,day:undefined,month:undefined,year:undefined});return name.charAt(0).toLocaleUpperCase('da')+name.slice(1);};

export function calendarBoard({events,bounds,mode,onPickDay,...handlers}){
 const board=element('div','cal-board cal-board--'+mode);
 if(mode==='month'){const head=element('div','cal-board-head');for(let i=0;i<7;i++)head.append(element('span','',weekday(shiftDay(bounds.loadFrom,i))));board.append(head);}
 const grid=element('div','cal-board-grid');
 const first=mode==='month'?bounds.loadFrom:bounds.from,last=mode==='month'?bounds.loadTo:bounds.to;
 for(let day=first;day<=last;day=shiftDay(day,1)){
  const items=events.filter(e=>overlapsDay(e,day));
  const cell=element('section','cal-day'+(day===today()?' is-today':'')+(day<bounds.from||day>bounds.to?' is-outside':'')+(items.length?'':' is-empty'));
  cell.setAttribute('aria-label',dateText(day,{weekday:'long'})+(items.length?'':'. Ingen arrangementer'));
  const heading=element('h3','cal-day-date');
  const number=element(mode==='month'?'button':'span','cal-day-number',String(Number(day.slice(-2))));
  if(mode==='month'){number.type='button';number.setAttribute('aria-label','Vis ugen med '+dateText(day));number.addEventListener('click',()=>onPickDay(day));}
  heading.append(element('span','cal-day-weekday',day===today()?'I dag':weekday(day)),number);
  if(mode==='month'&&items.length)heading.append(element('span','cal-day-count',String(items.length)));
  const list=element('div','cal-day-events');
  for(const event of items){
   const chip=link(event,handlers,'cal-chip'),cancelled=event.state==='cancelled';
   const caption=cancelled?'Aflyst':event.date!==day?'Fortsat':event.time?clock(event.time):'Hele dagen';
   chip.setAttribute('aria-label',(cancelled?'Aflyst. ':'')+event.title+'. '+dateText(day)+(event.time?' kl. '+clock(event.time):''));
   if(mode==='week'){const img=photo(event.imageUrl || event.image,'cal-chip-image');if(img){img.addEventListener('error',()=>img.remove());chip.append(img);}}
   chip.append(element('span','cal-chip-time',caption),element('strong','cal-chip-title',event.title));
   if(mode==='week'&&event.location)chip.append(element('span','cal-chip-place',event.location));
   list.append(chip);
  }
  if(mode==='week'&&!items.length)list.append(element('p','cal-day-none','Intet planlagt'));
  cell.append(heading,list);grid.append(cell);
 }
 board.append(grid);return board;
}

export function upcomingCards({events,...handlers}){
 const list=element('div','cal-upcoming-grid');
 for(const event of events){
  const card=link(event,handlers,'cal-card'),media=element('span','cal-card-media'),img=photo(event.imageUrl || event.image,'cal-card-image');
  const tile=element('span','cal-card-tile');tile.append(element('span','',weekday(event.date)),element('strong','',String(Number(event.date.slice(-2)))),element('span','',dateText(event.date,{day:undefined,month:'short',year:undefined})));
  if(img){img.addEventListener('error',()=>img.replaceWith(tile));media.append(img);}else media.append(tile);
  const copy=element('span','cal-card-copy');
  copy.append(element('span','cal-kicker',(event.state==='cancelled'?'Aflyst · ':'')+dateText(event.date,{weekday:'short',month:'short',year:undefined})+(event.time?' · kl. '+clock(event.time):'')),element('strong','cal-card-title',event.title));
  const meta=event.location||sourceLabel(event);if(meta)copy.append(element('span','cal-card-meta',meta));
  card.setAttribute('aria-label',event.title+'. '+dateText(event.date)+(event.time?' kl. '+clock(event.time):''));
  card.append(media,copy);list.append(card);
 }
 return list;
}
