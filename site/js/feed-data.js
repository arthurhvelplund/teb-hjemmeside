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
