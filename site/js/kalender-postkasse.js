import {api,showMessage,busy} from './portal-api.js';
import {mailParts} from './mail-content.js';

const root=document.querySelector('#mail-content');
const notice=document.querySelector('#mail-message');
const refresh=document.querySelector('#mail-refresh');
const updated=document.querySelector('#mail-updated');
const entries=new Map();
const dateFormat=new Intl.DateTimeFormat('da-DK',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Copenhagen'});
let inFlight,loaded=false,unavailable=false;

function selectionIn(node){
 const selection=window.getSelection();
 return selection&&!selection.isCollapsed&&
  (node.contains(selection.anchorNode)||node.contains(selection.focusNode));
}
function reading(){return root.contains(document.activeElement)||selectionIn(root);}
function protectedEntry(node){return node.contains(document.activeElement)||selectionIn(node);}

function createMessage(message){
 const item=document.createElement('details');item.className='fp-panel fp-mail';
 const title=document.createElement('summary');title.append(document.createTextNode(message.subject));
 const metadata=document.createElement('small');metadata.className='fp-note';
 const date=new Date(message.created_at);
 metadata.textContent='Til: '+message.recipient+(Number.isNaN(date.getTime())?'':' · '+dateFormat.format(date));
 title.append(document.createElement('br'),metadata);item.append(title);
 for(const line of message.body.split('\n')){
  const p=document.createElement('p');
  for(const part of mailParts(line,location.origin)){
   if(part.href){
    const link=document.createElement('a');link.href=part.href;link.textContent=part.text;
    link.referrerPolicy='no-referrer';p.append(link);
   }else p.append(document.createTextNode(part.text||' '));
  }
  item.append(p);
 }
 return item;
}

function render(messages){
 const seen=new Set();
 let previous=null;
 if(!loaded)root.replaceChildren();
 for(const source of messages){
  const message=Number.isSafeInteger(source?.id)?{...source,id:'legacy:'+source.id}:source;
  if(!message||typeof message.id!=='string'||seen.has(message.id)||
   !['subject','recipient','body','created_at'].every(key=>typeof message[key]==='string'))continue;
  seen.add(message.id);
  const fingerprint=JSON.stringify(message);
  let entry=entries.get(message.id);
  if(!entry){entry={node:createMessage(message),fingerprint};entries.set(message.id,entry);}
  else if(entry.fingerprint!==fingerprint&&!protectedEntry(entry.node)){
   const replacement=createMessage(message);replacement.open=entry.node.open;
   entry.node.replaceWith(replacement);entry.node=replacement;entry.fingerprint=fingerprint;
  }
  const expected=previous?previous.nextSibling:root.firstChild;
  if(expected!==entry.node)root.insertBefore(entry.node,expected);
  previous=entry.node;
 }
 for(const [id,entry] of entries){
  if(!seen.has(id)&&!protectedEntry(entry.node)){entry.node.remove();entries.delete(id);}
 }
 if(!entries.size)showMessage(root,'Ingen testmails endnu. Bed om en engangskode eller send et arrangement.');
 else for(const child of [...root.children])if(!child.matches('details'))child.remove();
 loaded=true;
 if(updated){
  const time=new Intl.DateTimeFormat('da-DK',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date());
  updated.textContent=entries.size+' '+(entries.size===1?'testmail':'testmails')+' · Opdateret kl. '+time;
 }
}

async function load({automatic=false}={}){
 if(automatic&&(document.hidden||reading()||unavailable))return;
 if(inFlight)return inFlight;
 inFlight=(async()=>{
  root.setAttribute('aria-busy','true');
  if(!loaded)showMessage(root,'Henter testmails …');
  try{
   const result=await api('/local-mail');
   if(!Array.isArray(result.messages))throw new Error('Invalid mailbox response');
   // A user can begin reading while the request is running. Wait until the next refresh.
   if(!reading())render(result.messages);
   unavailable=false;notice?.replaceChildren();
  }catch(error){
   unavailable=error.status===403||error.status===404;
   const explanation=unavailable
    ?'Testpostkassen findes kun på den lokale server. Åbn det lokale preview for at se testmails.'
    :navigator.onLine===false
     ?'Du er offline. Testmails hentes igen, når forbindelsen er tilbage.'
     :'Testmails kunne ikke hentes lige nu. Prøv “Hent nye testmails” igen.';
   showMessage(notice,explanation+(loaded&&entries.size?' De viste mails er fra den seneste opdatering.':''),true);
   if(!loaded)root.replaceChildren();
  }finally{root.setAttribute('aria-busy','false');inFlight=null;}
 })();
 return inFlight;
}

refresh.addEventListener('click',event=>busy(event.currentTarget,()=>load()));
let timer=setInterval(()=>load({automatic:true}),8000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load({automatic:true});});
window.addEventListener('online',()=>load({automatic:true}));
window.addEventListener('pagehide',()=>clearInterval(timer));
window.addEventListener('pageshow',event=>{
 if(event.persisted){clearInterval(timer);timer=setInterval(()=>load({automatic:true}),8000);load({automatic:true});}
});
await load();
