import {$,el,api,setup,notice,eventCard,eventForm,formEvent,busy,monthText,today} from './kalender-faelles.js';
await setup();
let loginToken=new URLSearchParams(location.hash.slice(1)).get('login');
try{if(loginToken)sessionStorage.setItem('teb-calendar-login',loginToken);else loginToken=sessionStorage.getItem('teb-calendar-login');}catch{}
if(location.hash)history.replaceState(null,'',location.pathname+location.search);
$('#admin-open').hidden=!loginToken;
let entries=[];
const focusId=new URLSearchParams(location.search).get('arrangement');
function render(){
  const root=$('#admin-events');root.replaceChildren();const pending=$('#admin-filter').value==='pending';const visible=entries.filter(e=>!pending||e.pendingKind);
  if(!visible.length)root.append(el('div',{class:'calendar-empty'},el('h2',{},'Ingen arrangementer afventer godkendelse.'),el('p',{},'Nye indsendelser vises her. TEB får også besked på mail.')));
  for(const entry of visible){
    const item=el('details',{class:'calendar-review',open:entry.id===focusId});
    const label=entry.pendingKind==='cancel'?'Aflysning':entry.pendingKind==='update'?'Rettelse':entry.pendingKind?'Nyt arrangement':entry.status==='rejected'?'Afvist':entry.status==='cancelled'?'Aflyst':'Godkendt';
    item.append(el('summary',{},el('span',{class:'calendar-status'},label),el('span',{},entry.data.title)));
    item.append(el('p',{class:'calendar-sender'},'Oplyst forening: '+entry.data.association+' · Kontakt: ',el('a',{href:'mailto:'+entry.email},entry.email)),el('p',{class:'portal-note'},'Tilknytningen til foreningen er ikke verificeret. Vurder indsendelsen før godkendelse.'));
    if(entry.notificationState==='failed')item.append(el('p',{class:'calendar-notice is-error'},'Mailen til TEB kunne ikke sendes. Indsendelsen er gemt her.'));
    if(entry.possibleDuplicates.length)item.append(el('p',{class:'calendar-notice'},'Mulig dublet eller sammenfald: '+entry.possibleDuplicates.map(e=>e.title).join(', ')+'. Gennemse indsendelserne, før du godkender.'));
    item.append(eventCard(entry.data,{compact:true}));
    if(entry.published&&entry.pendingKind){const old=el('details',{},el('summary',{},'Se den nuværende offentlige version'),eventCard(entry.published,{compact:true}));item.append(old);}
    if(entry.pendingKind){
      const form=eventForm(entry.data);if(entry.pendingKind==='cancel')form.hidden=true;
      else item.append(el('details',{class:'calendar-editor'},el('summary',{},'Ret teksten inden godkendelse'),form));
      const note=el('textarea',{rows:2,maxLength:500,placeholder:'Skriv en begrundelse ved afvisning',id:'note-'+entry.id});
      item.append(el('label',{htmlFor:note.id,class:'calendar-note-label'},'Besked til afsenderen'),note);
      const result=el('div',{'aria-live':'polite'});const buttons=[];
      function decide(action){return async()=>{
        if(action==='approve'&&entry.pendingKind!=='cancel'&&!form.reportValidity())return;
        buttons.forEach(b=>b.disabled=true);
        try{await api('/admin/events/'+entry.id,{body:{action,revision:entry.revision,note:note.value,event:formEvent(form)}});await load();notice($('#admin-message'),action==='reject'?'Indsendelsen er afvist.':entry.pendingKind==='cancel'?'Aflysningen er godkendt.':'Arrangementet er godkendt og vises nu i kalenderen.');}catch(error){notice(result,error.message,true);buttons.forEach(b=>b.disabled=false);}
      };}
      buttons.push(el('button',{type:'button',class:'portal-button',onClick:decide('approve')},entry.pendingKind==='cancel'?'Godkend aflysningen':'Godkend og offentliggør'),el('button',{type:'button',class:'portal-button portal-button-secondary',onClick:decide('reject')},'Afvis indsendelsen'));
      item.append(el('div',{class:'calendar-actions'},...buttons),result);
    }else if(entry.note)item.append(el('p',{},'Besked til afsenderen: '+entry.note));
    root.append(item);
  }
}
async function load(){
  const result=await api('/admin/events');entries=result.events;$('#admin-login').hidden=true;$('#admin-workspace').hidden=false;render();
  const editions=await api('/editions');$('#admin-editions').replaceChildren(...editions.editions.map(edition=>el('p',{},el('a',{href:'/api/kalender/editions/'+edition.id+'/pdf',target:'_blank',rel:'noopener'},'Fast printudgave · '+monthText(edition.month)))));
}
$('#admin-open').addEventListener('click',()=>busy($('#admin-open'),async()=>{try{await api('/admin/session',{body:{token:loginToken}});loginToken=null;try{sessionStorage.removeItem('teb-calendar-login');}catch{}await load();$('#admin-message').replaceChildren();}catch(error){notice($('#admin-message'),error.message,true);}}));
$('#admin-send').addEventListener('click',()=>busy($('#admin-send'),async()=>{try{const result=await api('/admin/login',{body:{}});notice($('#admin-message'),result.mode==='local'?'Linket ligger i den lokale testpostkasse. Ingen mail er sendt.':'Adgangslinket er sendt til TEBs kalenderadresse.');}catch(error){notice($('#admin-message'),error.message,true);}}));
$('#admin-logout').addEventListener('click',async()=>{try{await api('/admin/logout',{body:{}});$('#admin-workspace').hidden=true;$('#admin-login').hidden=false;$('#admin-open').hidden=true;notice($('#admin-message'),'Du er logget ud.');}catch(error){notice($('#admin-message'),error.message,true);}});
$('#admin-filter').addEventListener('change',render);
$('#admin-refresh').addEventListener('click',()=>busy($('#admin-refresh'),async()=>{try{await load();}catch(error){notice($('#admin-message'),error.message,true);}}));
function setDeadline(){const [year,month]=$('#edition-month').value.split('-').map(Number);$('#edition-deadline').value=new Date(Date.UTC(year,month-2,15)).toISOString().slice(0,10);}
const next=new Date(today()+'T12:00:00Z');next.setUTCDate(1);next.setUTCMonth(next.getUTCMonth()+1);$('#edition-month').value=next.toISOString().slice(0,7);setDeadline();
$('#edition-month').addEventListener('change',()=>{if($('#edition-month').value)setDeadline();});
$('#edition-preview').addEventListener('click',()=>{if(!$('#edition-form').reportValidity())return;const link='/api/kalender/admin/editions/preview?month='+encodeURIComponent($('#edition-month').value)+'&deadline='+encodeURIComponent($('#edition-deadline').value);window.open(link,'_blank','noopener');});
$('#edition-form').addEventListener('submit',event=>{event.preventDefault();busy($('#edition-publish'),async()=>{try{const result=await api('/admin/editions',{body:{month:$('#edition-month').value,deadline:$('#edition-deadline').value}});await load();notice($('#edition-message'),'Printudgaven er afsluttet med '+result.eventCount+' arrangementer på '+result.pages+' side'+(result.pages===1?'':'r')+'. Gennemse alle sider før tryk.');}catch(error){notice($('#edition-message'),error.message,true);}});});
try{await load();}catch(error){if(error.status!==401)notice($('#admin-message'),error.message,true);}
