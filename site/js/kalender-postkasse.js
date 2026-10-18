import {api,showMessage,busy} from './portal-api.js';
const root=document.querySelector('#mail-content');
async function load(){
 try{
  const {messages}=await api('/local-mail');root.replaceChildren();
  if(!messages.length){showMessage(root,'Ingen testmails endnu. Bed om en engangskode eller send et arrangement.');return;}
  for(const message of messages){
   const item=document.createElement('details');item.className='fp-panel fp-mail';
   const title=document.createElement('summary');title.textContent=message.subject;item.append(title);
   const recipient=document.createElement('p');recipient.className='fp-note';recipient.textContent='Til: '+message.recipient;item.append(recipient);
   for(const line of message.body.split('\n')){
    const p=document.createElement('p');
    let url;try{url=new URL(line);}catch{}
    if(url&&url.origin===location.origin&&['http:','https:'].includes(url.protocol)){
      const a=document.createElement('a');a.href=url.href;a.textContent=url.pathname.includes('forening')?'Åbn Forening':url.hash.includes('adgang')?'Åbn dit private arrangementslink':'Åbn kalenderen';p.append(a);
    }else p.textContent=line||' ';
    item.append(p);
   }root.append(item);
  }
 }catch{showMessage(document.querySelector('#mail-message'),'Testpostkassen er kun tilgængelig på den lokale server.',true);}
}
document.querySelector('#mail-refresh').addEventListener('click',event=>busy(event.currentTarget,load));
await load();
