// Only group exact, sufficiently specific syndicated headlines. Local posts
// and differently named occurrences keep their own identities.
export function groupNewsSources(items){
 const normalize=value=>value.normalize('NFKC').toLocaleLowerCase('da').replace(/\s+/g,' ').trim();
 const seen=new Map(),result=[];
 for(const item of items){
  const title=normalize(item.title||''),key=title.length>=35?'title:'+title:'url:'+item.url;
  const existing=seen.get(key);
  if(existing){if(existing.sourceId!==item.sourceId)existing.alsoSources.push({name:item.sourceName,url:item.url});continue;}
  const grouped={...item,alsoSources:[]};seen.set(key,grouped);result.push(grouped);
 }
 return result;
}

// Same title, date and time from two sources is one event. Short, generic titles
// ("Gudstjeneste") also need a stated time, so different occurrences stay apart.
const calendarTitle=value=>(value||'').normalize('NFKC').toLocaleLowerCase('da').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\b20\d\d\b/g,'').replace(/\s+/g,' ').trim();
// One title may extend the other ("Gudstjeneste i Hodde Kirke" and "… v/ Lars Bom Nielsen") at the same stated time.
const similarTitle=(a,b)=>a===b||(Math.min(a.length,b.length)>=12&&(a.startsWith(b)||b.startsWith(a)));
export function groupCalendarSources(events){
 const groups=new Map(),result=[];
 for(const event of events){
  const title=calendarTitle(event.title);
  const key=title&&(title.length>=35||event.time)?[title,event.date,event.time||'',event.endDate||'',event.endTime||''].join('|'):null;
  const existing=(key&&groups.get(key))||(event.time&&result.find(item=>item.date===event.date&&item.time===event.time&&(item.endDate||'')===(event.endDate||'')&&similarTitle(calendarTitle(item.title),title)));
  if(existing&&!existing.sources.some(source=>source.id===event.sourceId)){
   existing.sources.push({id:event.sourceId,name:event.sourceName,url:event.url});
   existing.sourceName=existing.sources.map(source=>source.name).join(' · ');
   existing.image ||= event.image;
   existing.location ||= event.location;
   if((event.description||'').length>(existing.description||'').length)existing.description=event.description;
  }else{
   const item={...event,sources:[{id:event.sourceId,name:event.sourceName,url:event.url}]};
   if(key&&!existing)groups.set(key,item);result.push(item);
  }
 }
 return result;
}

// An association's own event replaces the same event found in the local media.
export function withoutOwnDuplicates(own,imported){
 const similar=(a,b)=>similarTitle(a,b)||(Math.min(a.length,b.length)>=12&&(a.includes(b)||b.includes(a)));
 return imported.filter(event=>{const title=calendarTitle(event.title);
  return !own.some(item=>item.date===event.date&&(!item.time||!event.time||item.time===event.time)&&similar(calendarTitle(item.title),title));});
}
