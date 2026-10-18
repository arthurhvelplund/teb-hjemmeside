// Mail content stays plain text. Only links back to this preview become clickable.
export function mailParts(text,origin){
 const parts=[];
 let cursor=0;
 for(const match of text.matchAll(/https?:\/\/[^\s<>"']+/gi)){
  let raw=match[0].replace(/[.,;:!?]+$/,'');
  while(raw.endsWith(')')&&(raw.match(/\)/g)||[]).length>(raw.match(/\(/g)||[]).length)raw=raw.slice(0,-1);
  let url;try{url=new URL(raw);}catch{continue;}
  if(url.origin!==origin||url.username||url.password||!['http:','https:'].includes(url.protocol))continue;
  if(match.index>cursor)parts.push({text:text.slice(cursor,match.index)});
  const textLabel=url.pathname.includes('forening')?'Åbn Forening':
   url.hash.includes('adgang=')?'Åbn dit private arrangementslink':'Åbn kalenderen';
  parts.push({text:textLabel,href:url.href});cursor=match.index+raw.length;
 }
 if(cursor<text.length||!parts.length)parts.push({text:text.slice(cursor)});
 return parts;
}
