import {api,escapeHTML as esc,today,requestKey,dateText,showMessage} from './portal-api.js';
const requests=new Map();
const fields=['start','end','deadline','format'];
const overrideFields=[['title','Kort titel',100],['details','Tid, sted og praktiske oplysninger',300],['association','Forening eller arrangør',100],['dateLabel','Anden tekst i datofeltet · valgfrit',20],['dateNote','Note under datofeltet · valgfrit',30]];
export function printEditorHtml(){
 const now=today(),[year,month]=now.split('-').map(Number),start=new Date(Date.UTC(year,month,1)).toISOString().slice(0,10),end=new Date(Date.UTC(year,month+2,0)).toISOString().slice(0,10);
 return `<section class="fp-panel fa-section" data-print-editor><form class="fp-form" data-print-form>
 <h3>1. Vælg periode og format</h3><div class="fp-form-row"><label>Fra dato<input name="start" type="date" value="${start}" required></label><label>Til dato<input name="end" type="date" value="${end}" required></label></div>
 <div class="fp-form-row"><label>Indhold godkendt senest<input name="deadline" type="date" value="${now}" max="${now}" required></label><label>Format<select name="format"><option value="poster">Plakat · 50 × 70 cm</option><option value="a3">A3 · 29,7 × 42 cm</option></select></label></div>
 <p class="fp-note">Godkendelse til netkalenderen og udvælgelse til papir er to forskellige ting. Her vælger du indholdet til denne ene udgave.</p>
 <button type="button" class="btn btn-secondary" data-print-load>Hent arrangementer til gennemgang</button><div data-print-status aria-live="polite"></div>
 <section data-print-review hidden><h3>2. Gennemgå arrangementerne</h3><p>Vælg til eller fra ved hvert arrangement. Printtekster ændrer kun denne udgave.</p><div data-print-events></div><p data-print-count class="fp-note" aria-live="polite"></p>
 <h3>3. Gennemse korrekturen</h3><button type="button" class="btn btn-secondary" data-print-preview>Lav korrektur-PDF</button><div data-print-proof hidden><p><a data-print-link target="_blank" rel="noopener">Åbn korrektur-PDF</a></p><p data-print-pages class="fp-note"></p><label class="fa-check"><input type="checkbox" name="proofread" disabled>Jeg har åbnet PDF’en og kontrolleret alle sider.</label></div>
 <h3>4. Gem den færdige udgave</h3><p class="fp-note">Den gemte PDF ændres ikke, når netkalenderen senere bliver rettet.</p><button type="submit" class="btn" data-print-finalize disabled>Gem fast printudgave</button></section>
 <div data-print-result aria-live="polite"></div></form></section>`;
}
export function mountPrintEditor(root){
 const form=root.querySelector('form'),status=root.querySelector('[data-print-status]'),result=root.querySelector('[data-print-result]');
 const proof=root.querySelector('[data-print-proof]'),proofLink=root.querySelector('[data-print-link]'),proofread=form.elements.proofread,save=root.querySelector('[data-print-finalize]');
 let candidates=null,proofUrl='',proofKey='',opened=false,version=0,disposed=false,pending=false;
 const currentOptions=()=>Object.fromEntries(fields.map(key=>[key,form.elements[key].value]));
 function clearProof(){if(proofUrl)URL.revokeObjectURL(proofUrl);proofUrl='';proofKey='';opened=false;proof.hidden=true;proofLink.removeAttribute('href');proofread.checked=false;proofread.disabled=true;save.disabled=true;}
 function reset(){++version;clearProof();result.replaceChildren();}
 function payload(){
  if(!candidates)throw new Error('Hent arrangementerne til gennemgang først.');
  const eventIds=[],printOverrides={};
  for(const row of root.querySelectorAll('[data-print-event]')){
   const choice=row.querySelector('select').value;
   if(!choice)throw new Error('Vælg til eller fra ved hvert arrangement.');
   if(choice!=='include')continue;
   const id=row.dataset.printEvent;eventIds.push(id);const values={};
   for(const [key] of overrideFields){const input=row.querySelector('[data-print-field="'+key+'"]');const value=input.value.trim();if(value&&value!==input.dataset.original)values[key]=value;}
   if(Object.keys(values).length)printOverrides[id]=values;
  }
  if(!eventIds.length)throw new Error('Vælg mindst ét arrangement til printudgaven.');
  return {...currentOptions(),eventIds,printOverrides,reviewHash:candidates.reviewHash};
 }
 function count(){const choices=[...root.querySelectorAll('[data-print-choice]')],selected=choices.filter(s=>s.value==='include').length,remaining=choices.filter(s=>!s.value).length;root.querySelector('[data-print-count]').textContent=selected+' valgt til print · '+remaining+' mangler at blive gennemgået.';}
 function validOptions(){for(const key of fields)if(!form.elements[key].reportValidity())return false;const o=currentOptions();if(o.start>o.end||o.deadline>today())throw new Error('Kontrollér perioden og fristen. Fristen må højst være i dag.');return true;}
 function showCandidates(){
  root.querySelector('[data-print-events]').innerHTML=candidates.events.map(e=>{
   const details='Kl. '+e.time.replace(':','.')+(e.endTime?' til '+e.endTime.replace(':','.'):'')+' · '+e.location;
   const defaults={title:e.title,details,association:e.association,dateLabel:'',dateNote:''};
   return `<article class="fa-print-event" data-print-event="${esc(e.id)}"><div class="fa-print-heading"><div><h4>${esc(e.title)}</h4><p class="fp-note">${esc(dateText(e.date))}${e.endDate&&e.endDate!==e.date?' til '+esc(dateText(e.endDate)):''}<br>${esc(details)}<br>${esc(e.association)}</p></div><label>Til denne printudgave<select required data-print-choice><option value="">Vælg til eller fra</option><option value="include">Med på plakaten</option><option value="exclude">Ikke med denne gang</option></select></label></div><details data-print-text hidden><summary>Ret teksten til print</summary><p class="fp-note">Lad datofeltet være tomt for at bruge dato og ugedag. Ved gentagelser kan du fx skrive HVER UGE og ons + søn. Kontrollér, at den praktiske tekst forklarer gentagelsen.</p>${overrideFields.map(([key,label,limit])=>`<label>${label}<input data-print-field="${key}" data-original="${esc(defaults[key])}" value="${esc(defaults[key])}" maxlength="${limit}"></label>`).join('')}</details></article>`;
  }).join('')||'<p class="fp-empty">Der er ingen godkendte arrangementer til print i perioden inden fristen.</p>';
  root.querySelector('[data-print-review]').hidden=false;root.querySelector('[data-print-preview]').disabled=!candidates.events.length;count();
 }
 root.querySelector('[data-print-load]').addEventListener('click',async event=>{
  try{if(!validOptions())return;reset();candidates=null;root.querySelector('[data-print-review]').hidden=true;const sequence=version;event.target.disabled=true;
   const data=await api('/admin/editions/events?'+new URLSearchParams(currentOptions()));if(disposed||sequence!==version)return;candidates=data;showCandidates();showMessage(status,'Gennemgå hvert arrangement, før du laver korrekturen.');
  }catch(error){showMessage(status,error.message,true);}finally{if(event.target.isConnected)event.target.disabled=false;}
 });
 form.addEventListener('input',event=>{
  if(event.target===proofread){save.disabled=!opened||!proofread.checked||pending;return;}
  reset();if(fields.includes(event.target.name)){candidates=null;root.querySelector('[data-print-review]').hidden=true;showMessage(status,'Perioden eller formatet er ændret. Hent arrangementerne igen.');}
 });
 form.addEventListener('change',event=>{if(event.target.matches('[data-print-choice]')){event.target.closest('[data-print-event]').querySelector('[data-print-text]').hidden=event.target.value!=='include';count();}});
 root.querySelector('[data-print-preview]').addEventListener('click',async event=>{
  try{if(!form.reportValidity())return;const data=payload();reset();const sequence=version;event.target.disabled=true;
   const response=await fetch('/api/kalender/admin/editions/preview',{method:'POST',credentials:'same-origin',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
   if(!response.ok){const error=await response.json();throw new Error(error.error||'PDF’en kunne ikke dannes.');}
   const blob=await response.blob();if(disposed||sequence!==version)return;
   proofUrl=URL.createObjectURL(blob);proofKey=JSON.stringify(data);proofLink.href=proofUrl;proof.hidden=false;
   const pages=Number(response.headers.get('X-Calendar-Pages'));
   root.querySelector('[data-print-pages]').textContent=pages+(pages===1?' side · ':' sider · ')+response.headers.get('X-Calendar-Event-Count')+' arrangementer. Åbn PDF’en og gennemse alle sider.';
  }catch(error){showMessage(result,error.message,true);}finally{if(event.target.isConnected)event.target.disabled=false;}
 });
 proofLink.addEventListener('click',()=>{opened=true;proofread.disabled=false;});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(pending)return;
  try{
   const data=payload(),key=JSON.stringify(data);
   if(!opened||!proofread.checked||key!==proofKey)throw new Error('Åbn og gennemse den aktuelle korrektur-PDF først.');
   let request=requests.get(key);if(!request){request={requestKey:requestKey()};requests.set(key,request);}
   pending=true;save.disabled=true;form.querySelectorAll('input,select,button').forEach(node=>node.disabled=true);
   if(!request.result){const saved=await api('/admin/editions',{body:{...data,requestKey:request.requestKey}});if(!saved.id||!Number.isInteger(saved.pages)||!Number.isInteger(saved.eventCount))throw new Error('Udgivelsen kunne ikke bekræftes. Prøv igen med samme indhold.');request.result=saved;}
   if(disposed)return;
   const saved=request.result;showMessage(result,'Printudgaven er gemt med '+saved.eventCount+' arrangementer på '+saved.pages+(saved.pages===1?' side.':' sider.'));
   const a=document.createElement('a');a.href='/api/kalender/editions/'+encodeURIComponent(saved.id)+'/pdf';a.target='_blank';a.rel='noopener';a.textContent='Åbn den gemte PDF';result.append(a);
   const archive=root.parentElement.querySelector('[data-print-archive]');
   if(archive&&!archive.querySelector('[data-edition-id="'+CSS.escape(saved.id)+'"]')){
    archive.querySelector('.fp-empty')?.remove();
    const article=document.createElement('article');article.className='fp-list-row';article.dataset.editionId=saved.id;
    const title=document.createElement('h3');title.textContent=dateText(data.start)+' til '+dateText(data.end)+' · '+(data.format==='a3'?'A3':'Plakat');
    const note=document.createElement('p');note.textContent='Frist '+dateText(data.deadline)+' · '+saved.eventCount+' arrangementer';
    const link=a.cloneNode(true);link.textContent='Åbn gemt PDF';article.append(title,note,link);archive.prepend(article);
   }
  }catch(error){if(!disposed)showMessage(result,error.message,true);}finally{
   pending=false;if(!disposed){form.querySelectorAll('input,select,button').forEach(node=>node.disabled=false);proofread.disabled=!opened;save.disabled=!opened||!proofread.checked;}
  }
 });
 return ()=>{disposed=true;++version;clearProof();};
}
