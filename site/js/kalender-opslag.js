// Receipts and posts from before the calendar move. New events use kalender.js.
import {api,getSession,showMessage} from './portal-api.js';
function el(tag,text){const n=document.createElement(tag);if(text)n.textContent=text;return n;}
function link(text,href){const n=el('a',text);n.href=href;return n;}
function button(text,run){const n=el('button',text);n.type='button';n.className='btn btn-secondary';n.addEventListener('click',run);return n;}
function content(post){
 const card=el('article');card.className='fp-panel';card.append(el('h3',post.title),el('p',post.author||post.association),el('p',post.date?[post.date,post.time,post.location].filter(Boolean).join(' · '):''),el('p',post.description),el('p',post.body));
 if(post.price)card.append(el('p','Pris: '+post.price));
 for(const [key,label] of [['image',''],['link','Tilmelding og mere information']]){
  try{const url=new URL(post[key]);if(url.protocol!=='https:'||url.username||url.password)continue;
   if(key==='image'){const image=el('img');image.src=url.href;image.alt='';image.className='cal-detail-image';image.referrerPolicy='no-referrer';card.append(image);}
   else {const anchor=link(label,url.href);anchor.target='_blank';anchor.rel='noopener noreferrer';card.append(anchor);}
  }catch{}
 }
 return card;
}
export async function loadEarlierSubmission(){
 const root=document.querySelector('#calendar-legacy');root.hidden=false;root.replaceChildren(el('h2','Tidligere indsendelse'));
 const query=new URLSearchParams(location.search),id=query.get('indsendelse');
 try{
  if(id){
   const token=new URLSearchParams(location.hash.slice(1)).get('adgang');
   const {post}=await api('/posts/private/'+encodeURIComponent(id),{token});
   const states={pending:'TEB har modtaget din indsendelse. Den er ikke offentlig endnu.',approved:'TEB har godkendt din indsendelse.',rejected:'TEB har ikke godkendt indsendelsen. Kontakt TEB, hvis der skal rettes noget.',withdrawn:'TEB har fjernet opslaget.'};
   root.append(el('p',states[post.status]||'Kontakt TEB om indsendelsen.'),content(post),el('p','Dette er dit private link. Del det kun med dem, der må følge og rette indsendelsen.'));
   if(post.hasEvent)root.append(link('Ret eller aflys arrangementet','kalender.html?privat='+encodeURIComponent(id)+'#adgang='+token));
   root.append(button('Opdatér status',loadEarlierSubmission));
  }else if(query.has('opslag')){
   const {post}=await api('/posts/'+encodeURIComponent(query.get('opslag')));root.append(content(post));
   if(post.kind!=='news')root.append(link('Se arrangementet','kalender.html?arrangement='+encodeURIComponent(post.id)));
  }else{
   const session=await getSession();
   if(!session.user?.isAdmin){root.append(link('Log ind som TEB','forening.html?return='+encodeURIComponent('kalender.html#godkendelse')+'#login'));return;}
   root.replaceChildren(el('h2','Tidligere opslag til godkendelse'),link('Gennemgå nye arrangementer i foreningsområdet','forening.html#teb'));
   const {posts}=await api('/admin/posts');
   if(!posts.length)root.append(el('p','Ingen tidligere opslag afventer godkendelse.'));
   for(const post of posts){
    const card=content(post);
    if(post.print||post.channels?.length)card.append(el('p','Ønsker til synlighed: '+[post.print?'Analog kalender':'',...(post.channels||[])].filter(Boolean).join(', ')));
    for(const [action,text]of [['approve','Godkend og udgiv'],['reject','Afvis']])card.append(button(text,async()=>{
     const buttons=[...card.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
     try{await api('/admin/posts/'+post.id,{body:{action,revision:post.revision}});await loadEarlierSubmission();document.dispatchEvent(new Event('calendar-updated'));}
     catch(error){showMessage(card,error.message,true);buttons.forEach(b=>b.disabled=false);}
    }));
    root.append(card);
   }
  }
 }catch(error){showMessage(root,error.message,true);root.append(button('Prøv igen',loadEarlierSubmission));}
}
