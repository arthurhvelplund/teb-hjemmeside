import {api,getSession,today,dateText,randomToken,requestKey,showMessage,showMode} from './portal-api.js';
import {calendarGrid,calendarBounds} from './calendar-grid.js';
import {groupNewsSources} from './feed-data.js';

const $=s=>document.querySelector(s);
function el(tag,attrs={},...children){
 const n=document.createElement(tag);
 for(const[k,v]of Object.entries(attrs)){if(v===undefined||v===null||v===false)continue;if(k.startsWith('on'))n.addEventListener(k.slice(2).toLowerCase(),v);else if(k==='class')n.className=v;else if(k in n&&!['form','list'].includes(k))n[k]=v;else n.setAttribute(k,v);}
 for(const c of children.flat(Infinity))if(c!==undefined&&c!==null)n.append(c instanceof Node?c:document.createTextNode(String(c)));
 return n;
}
const button=(text,fn,cls='btn btn-secondary')=>el('button',{type:'button',class:cls,onClick:fn},text);
const safeURL=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
const shift=(date,days)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
const label=date=>dateText(date,{year:undefined});
const shortDate=date=>new Intl.DateTimeFormat('da-DK',{day:'numeric',month:'short',timeZone:'Europe/Copenhagen'}).format(new Date(date+'T12:00:00Z'));
const query=new URLSearchParams(location.search);
let siteMode='offline';
let session={authenticated:false,memberships:[]},posts=[],events=[],external=[],externalEvents=[],sourceStatus={},source='all',search='',visible=9,anchor=today(),mode='week',loading=false;
let sourceLoaded=false,eventLoaded=false,postLoaded=false;
const localPath=id=>'nyt.html?opslag='+encodeURIComponent(id);
const channels=[['flyers','Flyers i postkasser','Aftal omdeling, pris og frist med udbyderen.'],['portals','Analoge byportaler','Spørg om plads på byens portaler.'],['screens','Infoskærme','Kontakt udbyderen om format, pris og placering.'],['posters','Plakater i byen','Brug aftalte opslagstavler og pladser.']];
function photo(url,cls){const valid=safeURL(url);if(!valid)return null;return el('img',{src:valid,alt:'',class:cls,loading:'lazy',decoding:'async',referrerPolicy:'no-referrer',onError:e=>e.target.remove()});}
function when(p){return shortDate(p.date)+(p.time?' · kl. '+p.time.replace(':','.'):'')+(p.endDate&&p.endDate!==p.date?' til '+shortDate(p.endDate):'');}
function openDetails(item){
 const root=$('#ds-detail-content');root.replaceChildren();
 root.append(el('span',{class:'ds-meta'},item.sourceName||item.author||item.association||'Opslag'),el('h2',{id:'ds-detail-heading'},item.title));
 const img=photo(item.image,'');if(img)root.append(img);
 if(item.date)root.append(el('p',{class:'ds-event-chip'},(item.state==='cancelled'?'Aflyst · ':'')+when(item)+(item.location?' · '+item.location:'')));
 if(item.description)root.append(el('p',{},item.description));
 if(item.body)root.append(el('p',{},item.body));
 if(item.price)root.append(el('p',{},'Pris: '+item.price));
 if(safeURL(item.link)&&(!item.sourceId||item.link!==item.url))root.append(el('a',{href:item.link,target:'_blank',rel:'noopener noreferrer'},'Læs mere eller tilmeld dig ↗'));
 if(item.sourceId&&safeURL(item.url))root.append(el('a',{href:item.url,target:'_blank',rel:'noopener noreferrer'},'Se arrangementet hos '+item.sourceName+' ↗'));
 if(item.standardEvent)root.append(el('a',{href:'kalender.html?arrangement='+encodeURIComponent(item.id)},'Se arrangementet i aktivitetskalenderen →'));
 if(item.standardEvent&&(session.user?.isAdmin||session.memberships.some(m=>m.associationId===item.associationId)))root.append(el('p',{},el('a',{href:'kalender.html?ret='+encodeURIComponent(item.id)},'Ret eller aflys arrangementet')));
 if(!$('#ds-detail').open)$('#ds-detail').showModal();
}
$('#ds-detail-close').addEventListener('click',()=>$('#ds-detail').close());
$('#ds-detail').addEventListener('click',e=>{if(e.target===$('#ds-detail')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
function card(item,{preview=false}={}){
 const href=item.sourceId?safeURL(item.url):localPath(item.id);
 const article=el('article',{class:'ds-story'}),link=el(preview?'div':'a',{class:'ds-story-link',...(preview?{}:{href:href||'#',...(item.sourceId?{target:'_blank',rel:'noopener noreferrer'}:{onClick:e=>{if(!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();openDetails(item);}}})})});
 const img=photo(item.image,'ds-story-image');if(img)link.append(img);
 const body=el('div',{class:'ds-story-content'},el('span',{class:'ds-meta'},[item.sourceName||item.author||item.association||'Afsender',...(item.alsoSources||[]).map(s=>s.name)].join(' · ')),el('h3',{},item.title||'Din overskrift'),el('p',{},item.summary||item.description||'Her kommer den korte beskrivelse.'));
 if(item.date)body.append(el('span',{class:'ds-event-chip'},(item.state==='cancelled'?'Aflyst · ':'')+when(item)+(item.location?' · '+item.location:'')));
 link.append(body);article.append(link);return article;
}
function matches(item){return !search||[item.title,item.summary,item.description,item.body,item.location,item.author,item.association,item.sourceName].filter(Boolean).join(' ').toLocaleLowerCase('da').includes(search);}
function renderFeed(){
 const local=posts.filter(p=>p.kind!=='event').map(p=>({...p,sourceKey:'local'}));
 // Source dates are not guessed from titles. Keep each source's original ordering.
 const imported=source==='all'?groupNewsSources(external).filter(matches):external.filter(matches);
 let items=source==='local'?local:source==='all'?[...local,...imported]:imported.filter(p=>p.sourceId===source);
 items=items.filter(matches);
 const root=$('#ds-feed');root.replaceChildren(...items.slice(0,visible).map(p=>card(p)));
 if(!items.length)root.append(el('p',{class:'ds-empty'},!sourceLoaded&&!postLoaded?'Henter historier…':search?'Ingen historier passer til din søgning.':'Ingen historier at vise fra den valgte kilde lige nu.'));
 $('#ds-more').hidden=items.length<=visible;
 root.setAttribute('aria-busy',String(!sourceLoaded||!postLoaded));
 $('#ds-source-status').textContent=Object.values(sourceStatus).join(' ');
}
function allEvents(){
 const linked=new Map(posts.filter(p=>p.kind!=='news').map(p=>[p.id,p]));
 const list=events.map(e=>({...e,...linked.get(e.id),standardEvent:true,sourceName:'TEB aktivitetskalender'}));
 for(const p of linked.values())if(!events.some(e=>e.id===p.id))list.push(p);
 return [...list,...externalEvents].filter(p=>/^\d{4}-\d{2}-\d{2}$/.test(p.date||'')).sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||'')||a.title.localeCompare(b.title,'da'));
}
function renderCalendar(){
 const period=calendarBounds(anchor,mode,{rolling:true}),root=$('#ds-events');
 $('#ds-period').textContent=mode==='month'?dateText(period.from,{day:undefined,year:'numeric'}):(period.from.slice(0,7)===period.to.slice(0,7)?Number(period.from.slice(-2))+'–'+shortDate(period.to):shortDate(period.from)+' – '+shortDate(period.to));
 for(const m of ['week','month'])$('#ds-'+m).setAttribute('aria-pressed',String(mode===m));
 for(const [id,text]of [['prev','Forrige '],['next','Næste ']])$('#ds-'+id).setAttribute('aria-label',text+(mode==='week'?'uge':'måned'));
 document.querySelector('.calendar-scroll-hint').hidden=mode==='week';
 const selected=allEvents().filter(matches).map(event=>({...event,image:event.image||external.find(story=>story.sourceId===event.sourceId&&story.title.trim().toLocaleLowerCase('da')===event.title.trim().toLocaleLowerCase('da'))?.image}));
 root.replaceChildren(calendarGrid({events:selected,bounds:period,mode,onOpen:openDetails,eventHref:p=>p.sourceId?p.url:p.standardEvent?'kalender.html?arrangement='+encodeURIComponent(p.id):localPath(p.id)}));
 if(eventLoaded&&!selected.some(p=>p.date<=period.to&&(p.endDate||p.date)>=period.from))root.append(el('p',{class:'ds-source-status'},search?'Ingen arrangementer passer til søgningen i denne periode.':'Ingen arrangementer i denne periode.'));
 root.setAttribute('aria-busy',String(!eventLoaded));
 if(eventLoaded&&!$('#ds-events-status').textContent.includes('kunne')){const count=selected.filter(p=>p.date<=period.to&&(p.endDate||p.date)>=period.from).length;$('#ds-events-status').textContent=count+' '+(count===1?'arrangement':'arrangementer')+' · TEB og lokale kilder';}
}
$('#ds-search').addEventListener('input',e=>{search=e.target.value.trim().toLocaleLowerCase('da');visible=9;renderFeed();renderCalendar();});
$('#ds-source').addEventListener('change',e=>{source=e.target.value;visible=9;renderFeed();});
$('#ds-more').addEventListener('click',()=>{visible+=9;renderFeed();});
function changePeriod(direction){if(mode==='week')anchor=shift(anchor,7*direction);else{const d=new Date(anchor+'T12:00:00Z');d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+direction);anchor=d.toISOString().slice(0,10);}renderCalendar();}
$('#ds-prev').addEventListener('click',()=>changePeriod(-1));$('#ds-next').addEventListener('click',()=>changePeriod(1));
$('#ds-today').addEventListener('click',()=>{anchor=today();renderCalendar();});
for(const m of ['week','month'])$('#ds-'+m).addEventListener('click',()=>{mode=m;renderCalendar();});
async function loadSources(){
 const results=await Promise.allSettled([api('/nyheder/tistrup-nyt'),api('/nyheder/pulsen')]);
 const groups=[],previousEvents=externalEvents;externalEvents=[];
 for(let i=0;i<results.length;i++){
  const id=['tistrup-nyt','pulsen'][i],name=['Tistrup Nyt','Pulsen i Vest'][i],r=results[i];
  if(r.status==='fulfilled'){
   const data=r.value;groups.push((data.items||[]).map(p=>({...p,sourceId:id,sourceName:name})));
   externalEvents.push(...(data.events||[]).map(p=>({...p,sourceId:id,sourceName:name,link:p.url})));
   sourceStatus[id]=data.stale?name+': viser sidst hentede indhold.':name+': hentet '+(data.fetchedAt?new Intl.DateTimeFormat('da-DK',{hour:'2-digit',minute:'2-digit'}).format(new Date(data.fetchedAt)):'nu')+'.';
  }else{groups.push(external.filter(p=>p.sourceId===id));externalEvents.push(...previousEvents.filter(p=>p.sourceId===id));sourceStatus[id]=name+': kunne ikke opdateres. Prøv Opdatér eller besøg kilden nedenfor.';}
 }
 external=[];for(let n=0;n<Math.max(0,...groups.map(g=>g.length));n++)for(const g of groups)if(g[n])external.push(g[n]);
 sourceLoaded=true;renderFeed();renderCalendar();
}
async function loadLocal(){
 try{const data=await api('/posts');posts=data.posts||[];$('#ds-message').replaceChildren();}
 catch(e){showMessage($('#ds-message'),'Opslag kunne ikke hentes. '+e.message,true);}
 postLoaded=true;renderFeed();renderCalendar();
 const id=query.get('opslag');if(id){try{const item=posts.find(p=>p.id===id)||(await api('/posts/'+encodeURIComponent(id))).post;openDetails(item);}catch{showMessage($('#ds-message'),'Opslaget er ikke offentligt. Det kan afvente godkendelse eller være fjernet.');}}
}
async function loadEvents(){
 try{const data=await api('/events?from='+shift(today(),-370)+'&to='+(Number(today().slice(0,4))+3)+'-12-31');events=data.events||[];$('#ds-events-status').textContent='';}
 catch(e){$('#ds-events-status').textContent='Aktivitetskalenderen kunne ikke opdateres. Viser eventuelle sidst hentede oplysninger.';}
 eventLoaded=true;renderCalendar();
}
async function loadEditions(){
 try{const data=await api('/editions');$('#ds-editions').replaceChildren(...(data.editions||[]).map(p=>el('a',{href:'/api/kalender/editions/'+encodeURIComponent(p.id)+'/pdf',target:'_blank',rel:'noopener'},label(p.start||p.month+'-01')+(p.end?' til '+label(p.end):'')+' · PDF ↗')));}
 catch{$('#ds-editions').textContent='Nye printudgaver kunne ikke hentes. Den ældre udgave kan stadig åbnes.';}
}
async function review(){
 if(!session.user?.isAdmin)return;
 const root=$('#ds-review');root.hidden=false;
 root.replaceChildren(el('h2',{id:'ds-review-heading'},'TEB · til godkendelse'));
 try{
  const data=await api('/admin/posts');
  if(!data.posts?.length)root.append(el('p',{},'Ingen opslag afventer godkendelse.'));
  for(const p of data.posts||[]){
   const row=el('article',{},el('p',{class:'ds-meta'},'Oplyst afsender: '+p.author+' · ikke verificeret'),el('h3',{},p.title),el('p',{},p.description));
   if(p.body)row.append(el('p',{},p.body));if(p.date)row.append(el('p',{},when(p)+' · '+p.location));
   if(p.print||p.channels?.length)row.append(el('p',{},'Ønsker til deling: '+[p.print?'Analog kalender':null,...channels.filter(([id])=>p.channels?.includes(id)).map(([,name])=>name)].filter(Boolean).join(', ')));
   row.append(button('Se hele forhåndsvisningen',()=>openDetails(p),'ds-text-button'));
   const message=el('div',{'aria-live':'polite'}),actions=el('div',{class:'fp-actions'});
   for(const [action,text]of[['approve','Godkend og udgiv'],['reject','Afvis']])actions.append(button(text,async()=>{
    for(const b of actions.querySelectorAll('button'))b.disabled=true;
    try{await api('/admin/posts/'+p.id,{body:{action,revision:p.revision}});await Promise.all([review(),loadLocal(),loadEvents()]);}
    catch(e){showMessage(message,e.message,true);for(const b of actions.querySelectorAll('button'))b.disabled=false;}
   },action==='approve'?'btn':'btn btn-secondary'));
   row.append(actions,message);root.append(row);
  }
 }catch(e){showMessage(root,e.message,true);root.append(button('Prøv igen',review));}
}
let draft=null;
async function compose(initialKind='both'){
 const root=$('#ds-composer');root.hidden=false;root.replaceChildren(el('p',{},'Henter din adgang…'));root.scrollIntoView({behavior:'smooth',block:'start'});
 try{session=await getSession();}catch{root.replaceChildren(el('p',{},'Din adgang kunne ikke hentes.'),button('Prøv igen',()=>compose(initialKind)));return;}
 const associations=session.memberships.map(m=>m.association).filter(Boolean),direct=Boolean(session.user?.isAdmin||associations.length);
 let kind=initialKind,attempt=null,submitting=false,startedAt=Date.now();
 const message=el('div',{'aria-live':'polite'}),preview=el('aside',{class:'ds-preview','aria-label':'Privat forhåndsvisning'}),form=el('form',{class:'ds-form'}),inputs={};
 root.replaceChildren(el('div',{class:'ds-composer-head'},el('h2',{id:'ds-composer-heading',tabIndex:-1},'Del med byen'),button('Luk ×',()=>{root.hidden=true;$('#ds-create').focus();},'ds-text-button')));
 if(!direct)root.append(el('p',{},'Du kan indsende uden login. TEB godkender, før opslaget bliver synligt. ',el('a',{href:'forening.html?return=nyt.html#login'},'Har du foreningsadgang? Log ind.')));
 else root.append(el('p',{},'Du udgiver med din verificerede adgang. Opslaget bliver synligt med det samme.'));
 const types=el('div',{class:'ds-type-choice',role:'group','aria-label':'Hvad vil du dele?'});
 for(const[k,name]of[['event','Arrangement'],['news','Nyhed'],['both','Begge dele']])types.append(el('button',{type:'button','aria-pressed':String(k===kind),onClick:()=>{kind=k;for(const b of types.children)b.setAttribute('aria-pressed',String(b.textContent===name));update();}},name));
 root.append(types);
 if(associations.length){
  inputs.associationId=el('select',{id:'ds-association',required:true},associations.map(a=>el('option',{value:a.id},a.name)));
  form.append(el('div',{},el('label',{htmlFor:'ds-association'},'Din forening'),inputs.associationId));
 }
 function field(key,name,type='text',required=false,maxLength=100){
  const input=el(type==='textarea'?'textarea':'input',{id:'ds-field-'+key,name:key,...(type==='textarea'?{rows:key==='body'?7:3}:{type}),required,maxLength,...(key==='date'?{min:today()}:{})});inputs[key]=input;
  const row=el('div',{class:['date','time','endDate','endTime'].includes(key)?'ds-half':''},el('label',{htmlFor:input.id},name+(required?'':' · valgfrit')),input);form.append(row);return row;
 }
 const authorRow=field('author','Afsender', 'text',true);if(associations.length){authorRow.hidden=true;inputs.author.required=false;}else if(session.user?.isAdmin)inputs.author.value='TEB';
 field('title','Overskrift','text',true);field('description','Kort beskrivelse','textarea',true,1500);
 const eventRows=[field('date','Dato','date',true,10),field('time','Klokken','time',true,5),field('endDate','Slutdato','date',false,10),field('endTime','Sluttidspunkt','time',false,5),field('location','Sted','text',true,180),field('price','Pris','text',false,100)];
 const storyRows=[field('body','Hele historien','textarea',false,6000),field('image','Link til billede','url',false,500)];inputs.image.placeholder='https://…';inputs.image.after(el('small',{},'Brug et link til et billede, I har lov til at dele. Billedet hentes fra den adresse.'));
 field('link','Link til tilmelding eller mere information','url',false,500);inputs.link.placeholder='https://…';
 if(!direct){field('email','Din e-mail','email',true,254);inputs.email.autocomplete='email';inputs.email.value=session.user?.email||'';inputs.email.after(el('small',{},'Bruges kun til kvittering. Vises ikke offentligt.'));}
 const print=el('input',{type:'checkbox',id:'ds-print-choice'}),printLabel=el('label',{htmlFor:print.id},print,'Med på den analoge kalender');
 const sharing=el('fieldset',{},el('legend',{},'Nå flere i byen'),printLabel);
 const checks=[];
 for(const[key,name,description]of channels){const input=el('input',{type:'checkbox',value:key,id:'ds-share-'+key});checks.push(input);sharing.append(el('label',{htmlFor:input.id},input,el('span',{},name,el('small',{},description))));}
 sharing.append(el('small',{},'Ønskerne gemmes sammen med opslaget. Flyers, skærme og portaler aftaler I selv med udbyderne. Print er et ønske til en kommende udgave, ikke en garanti.'));
 form.append(sharing);
 const trap=el('input',{type:'text',name:'website',tabIndex:-1,autocomplete:'off'});form.append(el('div',{class:'ds-honeypot','aria-hidden':'true'},trap));
 const submit=el('button',{type:'submit',class:'btn'},direct?'Udgiv opslag':'Send til TEBs godkendelse');
 form.append(el('div',{},message,submit));root.append(el('div',{class:'ds-compose-layout'},form,preview));
 function value(){const data={kind,...Object.fromEntries(Object.entries(inputs).filter(([k])=>!['email','associationId'].includes(k)).map(([k,n])=>[k,n.value.trim()])),print:kind!=='news'&&print.checked,channels:checks.filter(n=>n.checked).map(n=>n.value)};if(associations.length)data.author=associations.find(a=>a.id===inputs.associationId.value)?.name||'';if(kind==='news')for(const key of ['date','time','endDate','endTime','location','price'])delete data[key];if(kind==='event'){data.body='';data.image='';}return data;}
 function update(){
  for(const row of eventRows){row.hidden=kind==='news';for(const input of row.querySelectorAll('input'))input.disabled=kind==='news';}
  for(const row of storyRows){row.hidden=kind==='event';for(const input of row.querySelectorAll('input,textarea'))input.disabled=kind==='event';}
  printLabel.hidden=kind==='news';inputs.endDate.min=inputs.date.value;
  const data=value();preview.replaceChildren(el('p',{class:'ds-meta'},'Privat forhåndsvisning'),el('p',{},'Sådan bliver opslaget vist efter udgivelse. Det er ikke gemt endnu.'),card({...data,date:kind==='news'?'':data.date,image:kind==='event'?'':data.image},{preview:true}));
 }
 if(draft){kind=draft.kind||kind;for(const[k,n]of Object.entries(inputs))if(typeof draft[k]==='string')n.value=draft[k];for(const b of types.children)b.setAttribute('aria-pressed',String(b.textContent===({event:'Arrangement',news:'Nyhed',both:'Begge dele'})[kind]));}
 form.addEventListener('input',()=>{draft=value();if(inputs.email)draft.email=inputs.email.value;update();});
 form.addEventListener('change',update);
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(submitting||!form.reportValidity())return;
  const post=value();
  if(kind!=='news'&&((post.endDate||post.date)<post.date||post.endTime&&(post.endDate||post.date)===post.date&&post.endTime<=post.time)){showMessage(message,'Slutningen skal ligge efter starten.',true);return;}
  for(const key of ['image','link'])if(post[key]&&!safeURL(post[key])){showMessage(message,'Brug en hel https-adresse til billede og link.',true);return;}
  if(!attempt)attempt={post,requestKey:requestKey(),startedAt,website:trap.value,...(direct?{associationId:inputs.associationId?.value}:{email:inputs.email.value.trim(),authorToken:randomToken()})};
  submitting=true;for(const n of [...form.elements,...types.querySelectorAll('button')])n.disabled=true;submit.textContent='Gemmer…';
  try{
   const result=await api('/posts',{body:attempt});if(!result.id)throw new Error('Kvitteringen mangler. Prøv samme indsendelse igen.');
   draft=null;root.replaceChildren(el('h2',{},result.published?'Opslaget er udgivet':'Tak. TEB har modtaget det.'),el('p',{},result.published?'Opslaget kan nu ses på siden'+(kind!=='news'?' og kalender.':'.'):'Opslaget bliver synligt, når TEB har godkendt det. Din forhåndsvisning står herunder.'),card(post,{preview:true}),el('p',{class:'fp-notice'},(siteMode==='local'?'Lokal afprøvning. Ingen e-mails er sendt. ':'')+({failed:'Beskeden til TEB kunne ikke sendes. Opslaget er gemt. Kontakt TEB.',pending:'Beskeden til TEB afventer afsendelse.',uncertain:'Opslaget er gemt. Vi kan ikke bekræfte, om beskeden til TEB blev sendt.'}[result.notificationState]||'')),el('div',{class:'fp-actions'},button('Del noget mere',()=>compose()),button('Tilbage til overblikket',()=>{root.hidden=true;$('#ds-create').focus();})));
   if(!direct){
    root.append(el('p',{},el('a',{href:'nyt.html?privat='+encodeURIComponent(result.id)+'#adgang='+attempt.authorToken},'Gem dit private link til status og senere rettelser')));
    if(['failed','uncertain'].includes(result.receiptState))root.append(el('p',{class:'fp-notice'},'Kvitteringsmailen kunne ikke bekræftes. Gem det private link her på siden.'));
   }else if(kind!=='news')root.append(el('p',{},el('a',{href:'kalender.html?ret='+encodeURIComponent(result.id)},'Ret eller aflys arrangementet')));
   await Promise.all([loadLocal(),loadEvents(),review()]);
  }catch(error){
   const uncertain=!error.status||error.status>=500;
   if(!uncertain){attempt=null;for(const n of [...form.elements,...types.querySelectorAll('button')])n.disabled=false;update();}
   else submit.disabled=false;
   submit.textContent=uncertain?'Prøv samme indsendelse igen':direct?'Udgiv opslag':'Send til TEBs godkendelse';
   showMessage(message,error.message+(uncertain?' Prøv igen med samme indsendelse for at undgå dubletter.':''),true);
  }finally{submitting=false;}
 });
 update();$('#ds-composer-heading').focus();
}
$('#ds-create').addEventListener('click',()=>compose());
async function privateReceipt(){
 const id=query.get('privat'),token=new URLSearchParams(location.hash.slice(1)).get('adgang');
 if(!id)return;
 const root=$('#ds-composer');root.hidden=false;root.replaceChildren(el('p',{},'Henter din indsendelse…'));
 try{
  const {post}=await api('/posts/private/'+encodeURIComponent(id),{token});
  const text={pending:'TEB har modtaget din indsendelse. Den er ikke offentlig endnu.',approved:'TEB har godkendt din indsendelse.',rejected:'TEB har ikke godkendt indsendelsen. Kontakt TEB, hvis der skal rettes noget.',withdrawn:'TEB har fjernet opslaget fra nyhedsoversigten.'}[post.status];
  root.replaceChildren(el('h2',{id:'ds-composer-heading'},'Din indsendelse'),el('p',{},text||'Kontakt TEB om indsendelsens status.'),card(post,{preview:true}),el('p',{class:'fp-note'},'Dette er dit private link. Del det kun med dem, der må følge og rette indsendelsen.'));
  if(post.hasEvent)root.append(el('p',{},el('a',{href:'kalender.html?privat='+encodeURIComponent(id)+'#adgang='+token},'Ret eller aflys arrangementet')));
  root.append(el('div',{class:'fp-actions'},button('Opdatér status',privateReceipt),el('a',{href:'kontakt.html'},'Kontakt TEB')));
 }catch(error){root.replaceChildren(el('h2',{id:'ds-composer-heading'},'Din indsendelse'));showMessage(root,error.message,true);root.append(button('Prøv igen',privateReceipt));}
}
async function refresh(){if(loading)return;loading=true;$('#ds-refresh').disabled=true;try{await Promise.allSettled([loadSources(),loadLocal(),loadEvents(),loadEditions(),review()]);}finally{loading=false;$('#ds-refresh').disabled=false;}}
$('#ds-refresh').addEventListener('click',refresh);
siteMode=(await showMode()).mode;
try{session=await getSession();if(session.authenticated){$('#ds-login').textContent=session.user.isAdmin?'TEB · administration →':'Mit foreningsområde →';}}catch{/* Reading public content remains available without login. */}
await refresh();
if(query.has('privat'))await privateReceipt();
if(query.has('opret'))compose();
setInterval(()=>{if(document.visibilityState==='visible'&&$('#ds-composer').hidden&&!$('#ds-detail').open&&!window.getSelection()?.toString())refresh();},60000);
