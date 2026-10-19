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

// Match only specific titles with the same stated date and time across sources.
export function groupCalendarSources(events){
 const groups=new Map(),result=[];
 for(const event of events){
  const title=(event.title||'').normalize('NFKC').toLocaleLowerCase('da').replace(/\s+/g,' ').trim();
  const key=title.length>=35?[title,event.date,event.time||'',event.endDate||'',event.endTime||''].join('|'):null;
  const existing=key&&groups.get(key);
  if(existing&&!existing.sources.some(source=>source.id===event.sourceId)){
   existing.sources.push({id:event.sourceId,name:event.sourceName,url:event.url});
   existing.sourceName=existing.sources.map(source=>source.name).join(' · ');
   existing.image ||= event.image;
  }else{
   const item={...event,sources:[{id:event.sourceId,name:event.sourceName,url:event.url}]};
   if(key&&!existing)groups.set(key,item);result.push(item);
  }
 }
 return result;
}
