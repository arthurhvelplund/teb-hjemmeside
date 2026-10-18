import {$,el,api,setup,notice,eventCard,eventForm,formEvent,busy} from './kalender-faelles.js';
await setup();
const id=new URLSearchParams(location.search).get('id');
const key='teb-calendar-author-'+id;
let access=new URLSearchParams(location.hash.slice(1)).get('adgang');
try{if(access)sessionStorage.setItem(key,access);else access=sessionStorage.getItem(key);}catch{}
if(location.hash)history.replaceState(null,'',location.pathname+location.search);
const privateLink=location.origin+'/mit-arrangement.html?id='+id+'#adgang='+access;
async function load(){
  try{
    const entry=await api('/private/'+id,{token:access});const root=$('#private-content');root.replaceChildren();
    const pending=entry.pendingKind;
    const status=pending==='cancel'?'Aflysning afventer TEBs godkendelse':pending?'Afventer TEBs godkendelse':entry.status==='rejected'?'Ikke godkendt':entry.status==='cancelled'?'Aflyst':'Godkendt og offentliggjort';
    root.append(el('p',{class:'calendar-status'},status));
    if(pending)root.append(el('p',{},entry.published?'Den senest godkendte version står fortsat i kalenderen, indtil TEB har behandlet ændringen.':'Dette er en privat forhåndsvisning. Arrangementet er endnu ikke offentligt.'));
    if(entry.note)root.append(el('div',{class:'calendar-notice'},el('strong',{},'Besked fra TEB'),el('p',{},entry.note)));
    root.append(eventCard(entry.data,{compact:true}));
    const copy=el('button',{type:'button',class:'calendar-link-button',onClick:async()=>{try{await navigator.clipboard.writeText(privateLink);copy.textContent='Privat link kopieret';}catch{notice($('#private-message'),'Gem linket fra din kvittering eller mail.');}}},'Kopiér dit private link');
    root.append(el('p',{class:'portal-note'},'Gem linket. Alle med linket kan foreslå rettelser. Din e-mail vises ikke offentligt.'),copy);
    if(!pending&&entry.status==='approved')root.append(el('p',{},el('a',{href:'kalender.html?arrangement='+id},'Se arrangementet i kalenderen')));
    const editor=el('details',{class:'calendar-editor'},el('summary',{},'Ret oplysningerne'));
    const form=eventForm(entry.data),button=el('button',{class:'portal-button',type:'submit'},'Send rettelsen til TEB');
    form.append(button,el('p',{class:'portal-note'},'TEB godkender også rettelser, før de bliver offentlige.'));
    form.addEventListener('submit',event=>{event.preventDefault();busy(button,async()=>{try{const result=await api('/private/'+id,{token:access,body:{action:'update',event:formEvent(form),revision:entry.revision}});await load();notice($('#private-message'),result.notificationState==='failed'?'Rettelsen er gemt, men mailen til TEB kunne ikke sendes. Kontakt TEB.':'Din rettelse afventer TEBs godkendelse.');}catch(error){notice($('#private-message'),error.message,true);}});});
    editor.append(form);root.append(editor);
    if(entry.published&&entry.published.state!=='cancelled'&&pending!=='cancel'){
      const cancel=el('button',{class:'calendar-link-button calendar-danger',type:'button',onClick:()=>{if(!confirm('Vil du sende en anmodning om aflysning til TEB? Arrangementet ændres først, når TEB godkender.'))return;busy(cancel,async()=>{try{const result=await api('/private/'+id,{token:access,body:{action:'cancel',revision:entry.revision}});await load();notice($('#private-message'),result.notificationState==='failed'?'Anmodningen er gemt, men mailen til TEB kunne ikke sendes. Kontakt TEB.':'Aflysningen afventer TEBs godkendelse.');}catch(error){notice($('#private-message'),error.message,true);}});}},'Bed TEB om at aflyse arrangementet');root.append(cancel);
    }
  }catch(error){$('#private-content').replaceChildren();notice($('#private-message'),error.message,true);}
}
if(!id||!access){$('#private-content').replaceChildren();notice($('#private-message'),'Åbn dit private link fra kvitteringen eller mailen fra Tistrup Kalenderen.',true);}else await load();
