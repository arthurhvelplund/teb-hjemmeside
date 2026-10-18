import {$,el,api,setup,notice,eventCard,monthText} from './kalender-faelles.js';
await setup();
let events=[],focused=false;
function render(){
  const month=$('#calendar-month').value,root=$('#calendar-events');root.replaceChildren();
  const selected=events.filter(e=>!month||e.date.slice(0,7)===month||(e.endDate&&e.date.slice(0,7)<month&&e.endDate.slice(0,7)>=month));
  if(!selected.length){root.append(el('div',{class:'calendar-empty'},el('h2',{},'Der er plads til jeres næste arrangement.'),el('p',{},'Her vises arrangementerne, når TEB har godkendt dem.'),el('a',{class:'portal-button portal-button-secondary',href:'foreningsportal.html'},'Send et arrangement')));return;}
  let previous='';for(const event of selected){const label=event.date.slice(0,7);if(label!==previous){root.append(el('h2',{class:'calendar-month-heading'},monthText(label)));previous=label;}root.append(eventCard(event));}
}
async function load(){
  try{
    const [result,editions]=await Promise.all([api('/events'),api('/editions')]);events=result.events;
    const chosen=$('#calendar-month').value;
    $('#calendar-month').replaceChildren(el('option',{value:''},'Alle kommende'),...[...new Set(events.map(e=>e.date.slice(0,7)))].map(month=>el('option',{value:month},monthText(month))));
    if([...$('#calendar-month').options].some(option=>option.value===chosen))$('#calendar-month').value=chosen;
    $('#calendar-message').replaceChildren();render();
    $('#calendar-editions').replaceChildren(...(editions.editions.length?editions.editions.map(edition=>el('p',{},el('a',{href:'/api/kalender/editions/'+edition.id+'/pdf',target:'_blank',rel:'noopener'},'Åbn PDF · '+monthText(edition.month)))):[el('p',{class:'portal-note'},'Den første printudgave er endnu ikke udgivet.')]));
    const id=new URLSearchParams(location.search).get('arrangement'),selected=id&&document.getElementById('arrangement-'+id);if(selected){selected.classList.add('is-highlighted');if(!focused&&!document.hidden){selected.scrollIntoView({block:'center',behavior:'smooth'});focused=true;}}
  }catch(error){notice($('#calendar-message'),'Kalenderen kunne ikke indlæses. Prøv igen om lidt, eller kontakt tistrup.kalender@gmail.com.',true);$('#calendar-events').replaceChildren();}
}
$('#calendar-month').addEventListener('change',render);
await load();
setInterval(()=>{if(!document.hidden&&!document.querySelector('#calendar-events details[open]'))load();},60000);
