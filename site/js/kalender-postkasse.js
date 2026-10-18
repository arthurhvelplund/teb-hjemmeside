import {$,el,api,notice} from './kalender-faelles.js';
async function load(){try{const {messages}=await api('/local-mail');const root=$('#mail-content');root.replaceChildren();if(!messages.length)root.append(el('p',{},'Ingen testmails endnu. Send et prøvearrangement gennem formularen.'));
for(const message of messages){const item=el('details',{class:'calendar-review'},el('summary',{},message.subject),el('p',{class:'portal-note'},'Til: '+message.recipient));const text=el('div',{class:'calendar-mail-body'});for(const line of message.body.split('\n')){
  if(/^https?:\/\//.test(line)&&new URL(line).origin===location.origin)text.append(el('p',{},el('a',{href:line},line.includes('kalender-redaktion')?'Åbn TEBs godkendelse':line.includes('mit-arrangement')?'Åbn foreningens private forhåndsvisning':'Åbn kalenderen')));
  else text.append(el('p',{},line||' '));
}item.append(text);root.append(item);}}catch(error){notice($('#mail-content'),'Testpostkassen er kun tilgængelig på den lokale pilotserver.',true);}}
$('#mail-refresh').addEventListener('click',load);await load();
