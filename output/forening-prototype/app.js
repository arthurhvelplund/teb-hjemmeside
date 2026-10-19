'use strict';
const STORAGE='teb-forening-klikprototype-v1', VERSION=1, TODAY='2026-10-19';
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=v=>JSON.parse(JSON.stringify(v));
const uid=prefix=>prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);
const imageMap={solsiden:'forening-faellesskab.webp',thgu:'thgu.webp',trim:'trim.webp',spejder:'spejder.webp',film:'film.webp',forsamlingshus:'forsamlingshus.webp',hodde:'hodde.webp'};
const roles={visitor:'Besøgende',owner:'Foreningsansvarlig',editor:'Redaktør',admin:'TEB-redaktion',new:'Ny bruger'};
const btn=(label,action='',extra='',variant='')=>'<button type="button" class="btn '+variant+'" '+(action?'data-action="'+action+'" ':'')+extra+'>'+label+'</button>';
const link=(label,path,variant='')=>'<a class="btn '+variant+'" href="#'+esc(path)+'">'+label+'</a>';
const textLink=(label,path)=>'<a href="#'+esc(path)+'">'+label+'</a>';
const field=(name,label,value='',type='text',extra='')=>'<label class="field">'+label+'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+extra+'></label>';
const area=(name,label,value='',extra='')=>'<label class="field">'+label+'<textarea name="'+name+'" '+extra+'>'+esc(value)+'</textarea></label>';
const check=(name,label,checked=false,extra='')=>'<label class="check"><input type="checkbox" name="'+name+'" '+(checked?'checked ':'')+extra+'><span>'+label+'</span></label>';
const back=(label='Tilbage til foreningen',path='/forening/solsiden')=>'<a class="back" href="#'+esc(path)+'">← '+esc(label)+'</a>';
const statusLabel={published:'Udgivet',pending:'Afventer TEB',rejected:'Skal rettes',cancelled:'Aflyst',removed:'Fjernet',active:'Aktiv',invited:'Inviteret',approved:'Godkendt'};
const badge=(value,label='')=>'<span class="status '+esc(value)+'">'+esc(label||statusLabel[value]||value)+'</span>';
const dateText=(d,options={day:'numeric',month:'long'})=>d?new Intl.DateTimeFormat('da-DK',options).format(new Date(d+'T12:00:00')):'Dato kommer';
const shift=(d,n)=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
const monday=d=>{const x=new Date(d+'T12:00:00Z');return shift(d,-((x.getUTCDay()+6)%7));};
const initials=name=>name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('');
function seed(){
 const associations=(window.CATALOGUE||[]).map(a=>({id:a.key,...a,chair:'',email:'',phone:'',image:imageMap[a.key]?'assets/'+imageMap[a.key]:'',about:a.description}));
 associations.unshift({id:'solsiden',name:'Solsiden',category:'Fællesskab og fritid',place:'Tistrup',description:'Vi mødes om gåture, fællesspisning og gode stunder. Her er plads til både nye og kendte ansigter.',about:'Solsiden er et fællesskab for dig, der gerne vil møde andre i byen. Vi går ture, spiser sammen og finder på små oplevelser i hverdagen.\n\nDu behøver ikke kende nogen på forhånd. Kom med en enkelt gang, og mærk efter, om det er noget for dig. Kontakt Anne, hvis du har spørgsmål.',chair:'Anne Møller',email:'kontakt@solsiden.example.test',phone:'00 00 00 00',website:'https://example.org',image:'',photo:'assets/forening-faellesskab.webp',sourceUrl:'',imageCredit:'Stemningsbillede fra den eksisterende TEB-prototype'});
 const make=(id,aid,kind,title,date,time,location,description,more={})=>{
  const data={title,kind,date,time,location,description,body:'',price:'Gratis',endDate:'',endTime:'',link:'',image:'',alsoNews:kind==='news',print:true,...more};
  return {id,associationId:aid,author:associations.find(a=>a.id===aid)?.name||'Lokalt initiativ',source:'member',status:'published',data,published:clone(data),pending:null,pendingKind:null,note:'',createdAt:kind==='news'?date:TODAY};
 };
 const posts=[
  make('faellesspisning','solsiden','event','Fællesspisning med efterår på menuen','2026-10-23','18:00','Tistrup Forsamlingshus','Tag plads ved et langbord, og lær din nabo lidt bedre at kende. Vi laver maden sammen, og der er også plads til børnene.',{price:'60 kr. · Børn 30 kr.',body:'Vi mødes i køkkenet kl. 17, hvis du har lyst til at hjælpe. Selve middagen starter kl. 18.\n\nTag gerne en nabo med. Tilmeld dig hos Anne senest onsdag.',alsoNews:true}),
  make('soendagstur','solsiden','event','Søndagstur i efterårsfarver','2026-10-25','10:00','Ved hallens hovedindgang','En rolig gåtur på cirka fem kilometer. Vi slutter med kaffe fra termokanden. Alle kan være med.'),
  make('banko','solsiden','event','Banko og kaffe i godt selskab','2026-11-12','19:00','Tistrup Forsamlingshus','En hyggelig aften med banko, kaffe og små præmier.',{price:'25 kr. pr. plade'}),
  make('aabent-hold','thgu','event','Prøv gymnastik med hele familien','2026-10-20','16:30','Hodde-Tistrup Hallen','Kom i tøj, du kan bevæge dig i. Vi prøver et par lege og øvelser sammen.'),
  make('motion','trim','event','Motion med plads til alle','2026-10-22','17:00','Hodde-Tistrup Hallen','En times bevægelse i dit eget tempo. Du er velkommen til at prøve en gang.'),
  make('filmaften','film','event','Filmaften i byen','2026-10-24','19:30','Tistrup','En fælles filmoplevelse og en snak bagefter.',{price:'Se foreningens hjemmeside'}),
  make('tak','solsiden','news','Tak for en dejlig sensommer','2026-10-16','','','Vi var over 40 til fællesspisningen. Tak til alle, der dækkede bord, tog en ret med eller bare kom forbi.',{body:'Det er de små bidrag, der gør en stor forskel i vores fællesskab. Vi glæder os til at mødes igen i efteråret.\n\nHar du en idé til noget, vi kan lave sammen? Skriv til Anne, eller tag fat i os næste gang.',image:'assets/forening-faellesskab.webp'}),
  make('hjaelp','solsiden','news','Har du lyst til at give en hånd?','2026-10-18','','','Vi søger et par ekstra hænder til borddækning og kaffe. En time indimellem gør en forskel.'),
  make('sommer','solsiden','event','Sommerens sidste fællesspisning','2026-09-18','18:00','Tistrup Forsamlingshus','Tak for en dejlig aften.'),
  make('byttemarked',null,'event','Byttemarked på torvet','2026-10-31','10:00','Torvet i Tistrup','Tag noget med, du ikke længere bruger, og find noget, du kan få glæde af.')
 ];
 const old=posts.find(p=>p.id==='byttemarked');old.source='guest';old.author='Naboerne ved torvet';old.email='nabo@example.test';old.pending={...clone(old.data),time:'11:00',description:'Vi starter kl. 11 i stedet for kl. 10. Tag noget med, du ikke længere bruger.'};old.pendingKind='edit';old.status='pending';
 const pending=make('loppemarked',null,'event','Loppemarked ved hallen','2026-11-07','10:00','Hodde-Tistrup Hallen','Kom og gør et fund. Vi samler ind til nye aktiviteter for børnene.');
 pending.author='Byens frivillige';pending.source='guest';pending.email='frivillig@example.test';pending.status='pending';pending.pending=clone(pending.data);pending.pendingKind='new';pending.published=null;posts.push(pending);
 return {version:VERSION,role:'visitor',selectedAid:'solsiden',email:'',associations,posts,
  members:[{id:'anne',aid:'solsiden',name:'Anne Møller',email:'ansvarlig@example.test',role:'manager',status:'active'},{id:'bo',aid:'solsiden',name:'Bo Nielsen',email:'redaktor@example.test',role:'editor',status:'active'},{id:'camilla',aid:'solsiden',name:'Camilla Lund',email:'camilla@example.test',role:'editor',status:'invited'}],
  requests:[{id:'request-jens',aid:'film',name:'Jens Hansen',email:'jens@example.test',roleNote:'Jeg er med i bestyrelsen og står for vores filmaftener.',status:'pending',note:''}],
  editions:[],drafts:{},printDraft:null,receipts:[]};
}
let state;
try{state=JSON.parse(localStorage.getItem(STORAGE)||'null');}catch{}
if(!state||state.version!==VERSION||!Array.isArray(state.associations))state=seed();
let ctx={},toastTimer,login={email:'',returnTo:'',step:1},calendarMode='week',calendarAnchor=TODAY;
function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch{toast('Browseren kan ikke gemme mere. Ændringerne virker stadig i denne visning.');}}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4200);}
const assoc=id=>state.associations.find(a=>a.id===id);
const post=id=>state.posts.find(p=>p.id===id);
const signedIn=()=>state.role!=='visitor';
const isAdmin=()=>state.role==='admin';
function ownIds(){if(isAdmin())return state.associations.map(a=>a.id);if(state.role==='owner')return ['solsiden','trim'];if(state.role==='editor')return ['solsiden'];if(state.role==='new')return state.requests.filter(r=>r.email===(state.email||'ny@example.test')&&r.status==='approved').map(r=>r.aid);return [];}
const canEdit=id=>isAdmin()||ownIds().includes(id);
const canManage=id=>isAdmin()||state.role==='owner'&&ownIds().includes(id)||state.role==='new'&&ownIds().includes(id);
const canEditPost=p=>isAdmin()||p?.source==='member'&&canEdit(p.associationId);
const publicPosts=()=>state.posts.filter(p=>p.published&&p.status!=='removed');
const published=p=>({...p,...p.published,cancelled:p.published?.cancelled===true});
const current=p=>({...p,...(p.pending||p.data)});
function go(path){if(location.hash==='#'+path)render();else location.hash=path;}
function setRole(role,navigate=true){state.role=role;state.email={visitor:'',owner:'ansvarlig@example.test',editor:'redaktor@example.test',admin:'teb@example.test',new:'ny@example.test'}[role];const ids=ownIds();if(ids.length&&!ids.includes(state.selectedAid))state.selectedAid=ids[0];persist();if(navigate)go(role==='admin'?'/redaktion':role==='visitor'?'/forening/solsiden':ids.length?'/min-forening/'+state.selectedAid:'/adgang');else render();}
function mark(a,small=false){return '<div class="mark '+(a.id!=='solsiden'&&a.image?'contain':'')+'">'+(a.image?'<img src="'+esc(a.image)+'" alt="">':esc(initials(a.name)))+'</div>';}
function accountMenu(aid=state.selectedAid){
 if(!signedIn())return link('Log ind','/login','secondary pill-link');
 return '<details class="more"><summary>'+(isAdmin()?'TEB':'Mere')+' ⌄</summary><div class="more-menu">'+(ownIds().length?'<a href="#/min-forening/'+esc(aid)+'">Min forening</a>':'<a href="#/adgang">Bed om adgang</a>')+(canEdit(aid)?'<a href="#/adgange/'+esc(aid)+'">Personer med adgang</a>':'')+(ownIds().length>1?'<a href="#/vaelg-forening">Skift forening</a>':'')+(isAdmin()?'<a href="#/redaktion">TEBs redaktion</a>':'')+'<button data-action="help">Kontakt TEB</button><button data-action="logout">Log ud</button></div></details>';
}
function header(){
 $('#demo-role').value=state.role;
 const active=ctx.page==='kalender'?'kalender':ctx.page==='nyt'?'nyt':'foreninger';
 $('#nav').innerHTML=[['foreninger','Foreninger'],['kalender','Kalender'],['nyt','Det sker']].map(([key,label])=>'<a href="#/'+key+'" '+(key===active?'aria-current="page"':'')+'>'+label+'</a>').join('');
 $('#account').innerHTML=accountMenu(ctx.id&&assoc(ctx.id)?ctx.id:state.selectedAid);
}
function wrap(content,cls=''){return '<div class="wrap page '+cls+'">'+content+'</div>';}
function title(t,description='',action=''){return '<div class="page-title"><div><h1 tabindex="-1">'+esc(t)+'</h1>'+(description?'<p>'+esc(description)+'</p>':'')+'</div>'+action+'</div>';}
function denied(){return wrap(back() +title('Du mangler adgang','Log ind med den e-mail, som foreningen har inviteret.')+link('Log ind','/login?return='+encodeURIComponent(ctx.path)));}
function directory(){
 const categories=Array.from(new Set(state.associations.map(a=>a.category))).sort((a,b)=>a.localeCompare(b,'da'));
 return wrap(title('Foreninger','Find et fællesskab i Tistrup og Hodde.')+'<div class="filter-row"><div class="search"><label for="directory-search">Søg efter en forening</label><input id="directory-search" type="search" placeholder="Navn, interesse eller mødested"></div><div class="filter"><label for="directory-category">Interesse</label><select id="directory-category"><option value="">Alle interesser</option>'+categories.map(c=>'<option>'+esc(c)+'</option>').join('')+'</select></div><p class="count" id="directory-count"></p></div><div class="association-grid" id="association-results"></div><div class="help-band"><div><h2>Mangler jeres forening?</h2><p>Vi hjælper jer med at komme med i oversigten.</p></div>'+btn('Kontakt TEB','help','','secondary')+'</div>');
}
function filterDirectory(){
 const s=$('#directory-search').value.toLocaleLowerCase('da'),c=$('#directory-category').value;
 const rows=state.associations.filter(a=>(!c||a.category===c)&&[a.name,a.category,a.description,a.place].join(' ').toLocaleLowerCase('da').includes(s));
 $('#directory-count').textContent=rows.length+' '+(rows.length===1?'forening':'foreninger');
 $('#association-results').innerHTML=rows.map(a=>'<a href="#/forening/'+esc(a.id)+'" class="association-card">'+mark(a)+'<div><span class="meta">'+esc(a.category)+'</span><h2>'+esc(a.name)+'</h2><p>'+esc(a.description)+'</p><span class="card-link">Se foreningen <span aria-hidden="true">↗</span></span></div></a>').join('')||'<p class="empty">Ingen foreninger matcher. Prøv en anden søgning.</p>';
}
function dateTile(d){return '<div class="date-tile">'+esc(dateText(d,{month:'short'}).replace('.',''))+'<strong>'+esc(d?Number(d.slice(-2)):'?')+'</strong></div>';}
function eventRow(p,feature=false){const d=published(p);return '<article class="event-row '+(feature?'feature-event':'')+'">'+dateTile(d.date)+'<div class="event-text">'+(d.cancelled?badge('cancelled'):'')+'<h3>'+textLink(esc(d.title),'/opslag/'+p.id)+'</h3><p>'+esc(dateText(d.date))+' · kl. '+esc(d.time)+'<br>'+esc(d.location)+'</p></div><a class="arrow-link" href="#/opslag/'+esc(p.id)+'" aria-label="Se '+esc(d.title)+'">↗</a></article>';}
function profileActions(a){
 if(a.email||a.phone)return btn('Kontakt foreningen','contact','data-id="'+esc(a.id)+'"')+(a.website?btn('Besøg hjemmeside ↗','website','data-id="'+esc(a.id)+'"','secondary'):'');
 if(a.website)return btn('Besøg hjemmeside ↗','website','data-id="'+esc(a.id)+'"');
 return btn('Spørg TEB om kontakt','help','','secondary');
}
function publicProfile(id){
 const a=assoc(id);if(!a)return missing();
 const events=publicPosts().filter(p=>p.associationId===id&&p.data.kind!=='news'&&p.published.date>=TODAY).sort((x,y)=>x.published.date.localeCompare(y.published.date)||x.published.time.localeCompare(y.published.time));
 const news=publicPosts().filter(p=>p.associationId===id&&(p.data.kind==='news'||p.data.alsoNews)).sort((x,y)=>y.createdAt.localeCompare(x.createdAt));
 return wrap(back('Alle foreninger','/foreninger')+(canEdit(id)?'<div class="note" style="margin-top:0">Du har adgang til denne forening. '+textLink('Administrér foreningen →','/min-forening/'+id)+'</div>':'')+
 '<div class="profile-intro"><div class="association-heading">'+mark(a)+'<div><h1 tabindex="-1">'+esc(a.name)+'</h1><p class="meta">'+esc(a.category)+' · '+esc(a.place)+'</p></div></div><p class="lead">'+esc(a.description)+'</p><div class="actions">'+profileActions(a)+'</div></div>'+
 '<div class="profile-columns"><div><section><div class="section-heading"><h2>'+(events.length?'Næste arrangement':'Arrangementer')+'</h2>'+(events.length>1?'<a href="#/kalender?forening='+esc(id)+'">Se i kalenderen ↗</a>':'')+'</div>'+(events.length?events.slice(0,3).map((p,i)=>eventRow(p,i===0)).join(''):'<p class="empty">Ingen kommende arrangementer. Kontakt foreningen for at høre, hvad der er på vej.</p>')+'</section>'+
 '<section class="line-section"><div class="section-heading"><h2>Nyt fra foreningen</h2></div>'+(news.length?news.slice(0,3).map(p=>'<article class="story-mini"><span class="meta">'+esc(dateText(p.createdAt))+'</span><h3>'+textLink(esc(p.published.title),'/opslag/'+p.id)+'</h3><p>'+esc(p.published.description)+'</p></article>').join(''):'<p class="empty">Der er ikke delt nyheder endnu.</p>')+'</section><section class="profile-copy"><h2>Om '+esc(a.name)+'</h2><p>'+esc(a.about||a.description)+'</p>'+(a.photo?'<figure class="profile-photo"><img src="'+esc(a.photo)+'" alt="Glimt fra det lokale fællesskab" loading="lazy"><figcaption>'+esc(a.imageCredit)+'</figcaption></figure>':'')+'</section></div>'+
 '<aside class="profile-sidebar"><h2>Tag kontakt</h2>'+[['Kontaktperson',a.chair||'Spørg foreningen'],['Telefon',a.phone],['E-mail',a.email],['Mødested',a.place]].filter(([,v])=>v).map(([k,v])=>'<p class="contact-field"><span>'+esc(k)+'</span>'+esc(v)+'</p>').join('')+'<button class="text-button" data-action="contact" data-id="'+esc(id)+'">Skriv til foreningen →</button><p class="meta" style="margin-top:13px">Kontaktoplysninger er eksempeldata.</p>'+(a.sourceUrl?'<p class="meta" style="margin-top:14px">Profiludkast · '+btn('Se kilden','source','data-url="'+esc(a.sourceUrl)+'"','secondary small')+'</p>':'')+'</aside></div>');
}
function contentItem(p){
 const d=current(p),label=p.pendingKind==='edit'?'Rettelse afventer TEB':p.pendingKind==='cancel'?'Aflysning afventer TEB':'';
 return '<article class="content-item"><div><div class="item-top"><span class="meta">'+(d.kind==='news'?'Nyhed':'Arrangement')+'</span>'+badge(p.status,label)+'</div><h3>'+esc(d.title)+'</h3><p>'+esc(d.kind==='news'?dateText(p.createdAt):dateText(d.date)+' · kl. '+d.time+' · '+d.location)+'</p>'+(p.note?'<p class="note warning">Besked fra TEB: '+esc(p.note)+'</p>':'')+'</div><div class="actions">'+(p.status==='removed'?'':textLink('Ret','/opret/'+p.id+'?forening='+p.associationId))+(d.kind!=='news'&&p.status!=='cancelled'?'<button class="text-button danger" data-action="cancel" data-id="'+p.id+'">Aflys</button>':'')+(d.kind==='news'&&p.status!=='removed'?'<button class="text-button danger" data-action="remove-post" data-id="'+p.id+'">Fjern</button>':'')+(p.published&&p.status!=='removed'?textLink('Se','/opslag/'+p.id):'')+'</div></article>';
}
function owner(id){
 if(!canEdit(id))return ownIds().length?denied():accessPage();
 const a=assoc(id);if(!a)return missing();state.selectedAid=id;persist();
 return wrap('<div class="owner-intro"><div class="association-heading">'+mark(a)+'<div><p class="eyebrow">Min forening</p><h1 tabindex="-1">'+esc(a.name)+'</h1><p class="meta">'+(isAdmin()?'Du har adgang som TEB-administrator':state.role==='editor'?'Du har adgang som redaktør':'Du har adgang som foreningsansvarlig')+'</p></div></div></div><div class="owner-actions"><div class="actions">'+link('+ Opret arrangement','/opret?type=event&forening='+id)+link('Skriv nyhed','/opret?type=news&forening='+id,'secondary')+link('Redigér side','/profil/'+id,'secondary')+'</div><a href="#/forening/'+esc(id)+'">Vis som besøgende ↗</a></div>'+
 '<section><div class="section-heading"><h2>Jeres indhold</h2></div><div class="filter-row"><div class="filter"><label for="content-filter" class="sr">Filtrér jeres indhold</label><select id="content-filter"><option value="all">Alt indhold</option><option value="event">Arrangementer</option><option value="news">Nyheder</option><option value="cancelled">Aflyste</option></select></div><div class="search"><label for="content-search" class="sr">Søg i jeres indhold</label><input id="content-search" type="search" placeholder="Søg i jeres indhold"></div></div><div id="own-content"></div></section>');
}
function filterOwn(){
 const kind=$('#content-filter').value,s=$('#content-search').value.toLocaleLowerCase('da');
 const items=state.posts.filter(p=>p.associationId===ctx.id&&p.source==='member'&&(kind==='all'||kind==='cancelled'&&p.status==='cancelled'||p.data.kind===kind)&&p.data.title.toLocaleLowerCase('da').includes(s));
 const upcoming=items.filter(p=>p.data.kind==='news'||p.data.date>=TODAY),past=items.filter(p=>p.data.kind!=='news'&&p.data.date<TODAY);
 $('#own-content').innerHTML=(upcoming.map(contentItem).join('')||'<p class="empty">Ingen indhold her endnu. Brug knapperne ovenfor til at dele noget med byen.</p>')+(past.length?'<details class="past"><summary>Tidligere arrangementer ('+past.length+')</summary>'+past.map(contentItem).join('')+'</details>':'');
}
function profileForm(id){
 if(!canEdit(id))return denied();const a=assoc(id);if(!a)return missing();
 return wrap(back('Tilbage til jeres side','/min-forening/'+id)+title('Redigér foreningsside')+'<div class="form-layout"><form id="profile-form" class="form-card">'+field('name','Foreningens navn',a.name,'text','required maxlength="100"')+field('category','Interesse',a.category)+area('description','Kort introduktion',a.description,'required maxlength="450"')+area('about','Mere om foreningen <em>· valgfrit</em>',a.about||'','maxlength="1500"')+'<div class="form-section"><h2>Kontaktoplysninger</h2>'+field('chair','Kontaktperson',a.chair)+field('email','Offentlig e-mail',a.email,'email')+field('phone','Telefon',a.phone,'tel')+field('place','Mødested',a.place)+field('website','Hjemmeside',a.website,'url')+'</div><div class="form-section"><h2>Profilbillede</h2><div class="upload-row"><div id="profile-image-preview">'+mark(a)+'</div><div><label class="btn secondary small">Vælg billede<input class="sr" type="file" id="profile-file" accept="image/jpeg,image/png,image/webp"></label><br><button type="button" class="text-button" data-action="remove-image">Fjern billedet</button></div></div><input type="hidden" name="image" value="'+esc(a.image)+'"><p class="inline-help">Vælg et billede fra telefonen eller computeren, som I må bruge.</p></div><div class="form-result" role="alert"></div><div class="form-actions">'+link('Fortryd','/min-forening/'+id,'secondary')+'<button class="btn" type="submit">Gem ændringer</button></div></form><aside class="info-aside"><h2>Det her ser byen</h2><p>Oplysningerne vises på jeres offentlige foreningsside, når du gemmer.</p><p>Den offentlige kontaktmail kan være en anden end den mail, du logger ind med.</p><p class="meta">Ændringer gemmes kun i denne prototype.</p></aside></div>');
}
function profileSubmit(e){
 e.preventDefault();const form=e.currentTarget,data=Object.fromEntries(new FormData(form)),a=assoc(ctx.id);
 if(data.website&&!validURL(data.website))return formError(form,'Skriv en gyldig hjemmesideadresse med https://.');
 Object.assign(a,data);persist();go('/min-forening/'+a.id);toast('Foreningssiden er gemt. Se den under Vis som besøgende.');
}
function validURL(s){try{return ['http:','https:'].includes(new URL(s).protocol);}catch{return false;}}
function formError(form,message){const box=form.querySelector('.form-result');if(box){box.textContent=message;box.scrollIntoView({block:'nearest'});}else toast(message);}
function getDraft(form){const d=Object.fromEntries(new FormData(form));for(const key of ['alsoNews','print','flyers','screens','portals','posters'])d[key]=Boolean(form.elements[key]?.checked);return d;}
function compose(id){
 const original=id?post(id):null,privateMode=ctx.q.get('private')==='1';
 if(id&&!original)return missing();
 if(id&&!canEditPost(original)&&!(privateMode&&original.source==='guest'))return denied();
 const guestEdit=Boolean(original&&isAdmin()&&original.source==='guest'&&!original.associationId&&!privateMode);
 const aid=guestEdit?'':original?.associationId||ctx.q.get('forening')||(ownIds()[0]||''),a=assoc(aid);
 const direct=!privateMode&&(isAdmin()||Boolean(a&&canEdit(aid)));
 const key=id||'new',draft=state.drafts[key]||{},d={kind:ctx.q.get('type')||'event',date:'2026-10-26',time:'18:00',location:a?.place||'',price:'',print:true,...(original?clone(original.pending||original.data):{}),...draft};
 const kind=d.kind==='news'?'news':'event',event=kind==='event';
 return wrap(back(id?'Tilbage til indhold':'Tilbage',privateMode?'/status/'+id:guestEdit?'/redaktion?tab=indhold':direct?'/min-forening/'+aid:'/kalender')+title((id?'Ret ':'Opret ')+(event?'arrangement':'nyhed'))+'<div class="form-layout"><form id="compose-form" class="form-card" data-aid="'+esc(aid)+'" data-direct="'+direct+'" data-private="'+privateMode+'" data-edit-id="'+esc(id||'')+'">'+
 (!id?'<div class="segmented" style="margin-bottom:24px" aria-label="Indholdstype"><button type="button" data-action="compose-kind" data-kind="event" aria-pressed="'+event+'">Arrangement</button><button type="button" data-action="compose-kind" data-kind="news" aria-pressed="'+!event+'">Nyhed</button></div>':'')+'<input type="hidden" name="kind" value="'+kind+'">'+
 (direct&&!guestEdit?'<label class="field">Forening<select name="associationId">'+ownIds().map(x=>'<option value="'+esc(x)+'" '+(x===aid?'selected':'')+'>'+esc(assoc(x)?.name||x)+'</option>').join('')+'</select></label>':field('author','Arrangør eller afsender',d.author||original?.author||'','text','required maxlength="100"'))+
 field('title',event?'Hvad skal der ske?':'Overskrift',d.title||'','text','required maxlength="100"')+
 (event?'<div class="form-row">'+field('date','Dato',d.date,'date','required min="'+(id?'2000-01-01':TODAY)+'"')+field('time','Klokken',d.time,'time','required')+'</div>'+field('location','Hvor foregår det?',d.location,'text','required maxlength="180"'):'')+
 area('description','Kort beskrivelse',d.description||'','required maxlength="1500"')+
 (event?'<details><summary>Flere praktiske oplysninger</summary><div class="form-row">'+field('endDate','Slutdato <em>· valgfrit</em>',d.endDate||'','date')+field('endTime','Sluttid <em>· valgfrit</em>',d.endTime||'','time')+'</div>'+field('price','Pris <em>· valgfrit</em>',d.price||'')+field('link','Link til tilmelding <em>· valgfrit</em>',d.link||'','url')+'</details>'+check('alsoNews','Vis også som nyhed på Det sker',d.alsoNews):field('link','Læs mere-link <em>· valgfrit</em>',d.link||'','url'))+
 '<div id="story-fields" '+(event&&!d.alsoNews?'hidden':'')+'>'+area('body','Hele historien <em>· valgfrit</em>',d.body||'','maxlength="6000"')+'<label class="field">Billede <em>· valgfrit</em><input id="post-file" type="file" accept="image/jpeg,image/png,image/webp"><small>Vælg et billede, I må dele.</small></label><input type="hidden" name="image" value="'+esc(d.image||'')+'"><div id="post-image-preview">'+(d.image?'<img src="'+esc(d.image)+'" style="max-height:140px;border-radius:8px" alt="Valgt billede">':'')+'</div></div>'+
 '<details><summary>Papirkalender og anden synlighed</summary>'+(event?check('print','Jeg ønsker arrangementet med på papirkalenderen<small>TEB vælger indholdet til hver udgave. Et ønske er ikke en garanti.</small>',d.print):'')+
 [['flyers','Flyers i postkasser'],['screens','Infoskærme'],['portals','Byportaler'],['posters','Plakater i byen']].map(([key,label])=>check(key,label,d[key])).join('')+'<p class="inline-help">Der gemmes kun et ønske. Aftaler med udbydere laver I selv.</p></details>'+
 (!direct&&!id?field('email','Din e-mail <small>Kun til kvittering. Vises ikke offentligt.</small>',d.email||state.email||'','email','required'):'')+
 '<div class="form-result" role="alert"></div><div class="form-actions">'+btn('Forhåndsvis','preview-post','','secondary')+'<button type="submit" class="btn">'+(direct?id?'Gem og udgiv':'Udgiv '+(event?'arrangement':'nyhed'):id?'Send rettelsen til TEB':'Send til TEB')+'</button></div></form><aside class="info-aside"><p class="eyebrow">'+(direct?'Foreningsadgang':'Gæsteindsendelse')+'</p><h2>'+(direct?'Klar, når I er.':'TEB hjælper jer videre.')+'</h2><p>'+(direct?'Du udgiver med godkendt adgang. Indholdet bliver synligt med det samme.':'Du kan indsende uden login. TEB gennemgår indholdet, før det bliver offentligt.')+'</p><p>'+(direct?'Arrangementer vises i kalenderen og på jeres foreningsside. Nyheder vises også på Det sker.':'Efter indsendelsen får du en kvittering og et privat link til status.')+'</p>'+(!signedIn()?'<p>'+textLink('Har du adgang til en forening? Log ind →','/login?return='+encodeURIComponent(ctx.path))+'</p>':'')+'</aside></div>');
}
function composeSubmit(e){
 e.preventDefault();const form=e.currentTarget,d=getDraft(form),id=form.dataset.editId,direct=form.dataset.direct==='true';
 if(d.kind!=='news'&&((d.endDate||d.date)<d.date||d.endTime&&(d.endDate||d.date)===d.date&&d.endTime<=d.time))return formError(form,'Sluttidspunktet skal ligge efter starten.');
 if(d.link&&!validURL(d.link))return formError(form,'Skriv et gyldigt link med https://.');
 const aid=direct?d.associationId:null,a=assoc(aid);let p=id?post(id):null;
 const data={kind:d.kind,title:d.title.trim(),description:d.description.trim(),body:d.body||'',image:d.image||'',date:d.kind==='news'?'':d.date,time:d.kind==='news'?'':d.time,location:d.location||'',endDate:d.endDate||'',endTime:d.endTime||'',price:d.price||'',link:d.link||'',alsoNews:d.kind==='news'||d.alsoNews,print:d.kind!=='news'&&d.print,channels:['flyers','screens','portals','posters'].filter(x=>d[x])};
 if(!p){p={id:uid('indhold'),associationId:aid,author:a?.name||d.author,source:direct?'member':'guest',email:d.email||state.email,createdAt:TODAY,published:null,note:''};state.posts.unshift(p);}
 if(direct){if(!(id&&isAdmin()&&p.source==='guest'&&!p.associationId)){p.associationId=aid;p.author=a?.name||'TEB';p.source='member';}else p.author=d.author||p.author;p.data=clone(data);p.published=clone(data);p.pending=null;p.pendingKind=null;p.status='published';p.note='';}
 else {p.data=clone(data);p.pending=clone(data);p.pendingKind=p.published?'edit':'new';p.status='pending';p.note='';if(!state.receipts.includes(p.id))state.receipts.push(p.id);}
 delete state.drafts[id||'new'];persist();go(direct&&p.source==='guest'?'/opslag/'+p.id:'/kvittering/'+p.id);toast(direct?'Indholdet er udgivet i prototypen.':'Indsendelsen ligger nu til godkendelse hos TEB.');
}
function receipt(id){
 const p=post(id);if(!p)return missing();const d=current(p),direct=p.source==='member';
 return wrap(back('Tilbage',direct?'/min-forening/'+p.associationId:'/kalender')+'<div class="compact">'+title(direct?'Det er udgivet.':'Tak. TEB har modtaget det.',direct?'Indholdet kan nu ses i prototypens offentlige visninger.':'Dit indhold bliver offentligt, når TEB har godkendt det.')+'<div class="status-panel">'+badge(p.status)+'<h2>'+esc(d.title)+'</h2><p>'+esc(d.description)+'</p></div><div class="actions">'+(direct?link('Se det offentlige indhold','/opslag/'+p.id)+link('Tilbage til jeres side','/min-forening/'+p.associationId,'secondary'):link('Se status og ret indsendelsen','/status/'+p.id))+'</div>'+(!direct?'<div class="note"><strong>Gem dit private link</strong><a class="receipt-link" href="#/status/'+esc(p.id)+'">'+esc(location.href.split('#')[0]+'#/status/'+p.id)+'</a>'+btn('Kopiér link','copy-private','data-id="'+p.id+'"','secondary small')+'<p class="inline-help">Linket er kun til denne prototype. Ingen kvitteringsmail er sendt.</p></div>':'')+'</div>');
}
function privateStatus(id){
 const p=post(id);if(!p||p.source!=='guest')return missing();const d=current(p);
 return wrap(back('Tilbage til kalenderen','/kalender')+'<div class="compact">'+title('Din indsendelse','Dette er prototypens private statusvisning.')+'<div class="status-panel">'+badge(p.status,p.pendingKind==='cancel'?'Aflysning afventer TEB':'')+'<h2>'+esc(d.title)+'</h2><p>'+(p.pending?'TEB gennemgår din indsendelse. Den nye version er ikke offentlig endnu.':p.status==='rejected'?'TEB har bedt dig rette indholdet.':p.status==='cancelled'?'Arrangementet er markeret som aflyst.':'Indholdet er godkendt og offentliggjort.')+'</p>'+(p.note?'<p class="note warning"><strong>Besked fra TEB</strong><br>'+esc(p.note)+'</p>':'')+'</div>'+
 (p.pending&&p.published?'<section class="review-version"><p class="eyebrow">Din foreslåede ændring</p><h2>'+esc(p.pending.title)+'</h2><p>'+esc(p.pending.date)+' kl. '+esc(p.pending.time)+'</p><p>'+esc(p.pending.description)+'</p></section>':'')+
 '<p style="margin:20px 0">'+esc(d.description)+'</p><div class="actions">'+link('Ret indsendelsen','/opret/'+id+'?private=1','secondary')+(p.published&&p.status!=='cancelled'?btn('Bed om aflysning','guest-cancel','data-id="'+id+'"','secondary'):'')+btn('Opdatér status','refresh','','secondary')+'</div>'+
 (p.published?'<section class="line-section"><h2>Det ser borgerne lige nu</h2><p style="margin:15px 0">'+esc(p.published.title)+'<br>'+esc(dateText(p.published.date))+' kl. '+esc(p.published.time)+'</p>'+link('Åbn offentlig visning','/opslag/'+id,'secondary')+'</section>':'')+'<p class="inline-help">Prøv TEB-redaktionen i rollevælgeren for at behandle indsendelsen.</p></div>');
}
function detail(id){
 const p=post(id);if(!p?.published||p.status==='removed')return wrap(title('Indholdet er ikke offentligt','Det kan afvente godkendelse eller være fjernet.')+link('Tilbage til overblikket','/nyt','secondary'));
 const d=published(p),a=assoc(p.associationId);
 return wrap(back(a?'Tilbage til '+a.name:'Tilbage til kalenderen',a?'/forening/'+a.id:'/kalender')+'<div class="detail-layout"><article><p class="eyebrow">'+esc(d.kind==='news'?'Nyt fra '+p.author:p.author)+'</p>'+(d.cancelled?badge('cancelled'):'')+'<h1 tabindex="-1">'+esc(d.title)+'</h1><p class="lead">'+esc(d.description)+'</p>'+(d.kind!=='news'?'<div class="detail-when"><strong>'+esc(dateText(d.date,{weekday:'long',day:'numeric',month:'long'}))+' · kl. '+esc(d.time)+'</strong>'+esc(d.location)+'<br><span class="meta">'+esc(d.price||'Kontakt arrangøren om pris')+'</span></div>':'')+(d.image?'<img class="detail-image" src="'+esc(d.image)+'" alt="Billede til opslaget">':'')+(d.body?'<p class="body-copy">'+esc(d.body)+'</p>':'')+'<div class="actions" style="margin-top:26px">'+(d.link?btn('Tilmelding og mere information ↗','external','data-url="'+esc(d.link)+'"'):'')+btn('Del link','share','data-id="'+p.id+'"','secondary')+(d.kind!=='news'?btn('Føj til min kalender','ics','data-id="'+p.id+'"','secondary'):'')+'</div>'+(canEditPost(p)?'<div class="note">'+textLink('Ret indholdet →','/opret/'+p.id+'?forening='+p.associationId)+(d.kind!=='news'?' · <button class="text-button danger" data-action="cancel" data-id="'+p.id+'">Aflys arrangementet</button>':'')+'</div>':'')+'</article><aside class="profile-sidebar"><h2>Arrangøren</h2><p style="margin-bottom:14px">'+esc(p.author)+'</p>'+(a?link('Se foreningens side','/forening/'+a.id,'secondary small'):btn('Kontakt arrangøren','guest-contact','data-id="'+p.id+'"','secondary small'))+'<p class="meta" style="margin-top:18px">Eksempelindhold til gennemgang af designet.</p></aside></div>');
}
function loginPage(){
 login.returnTo=ctx.q.get('return')||login.returnTo||'';
 if(ctx.id!=='kode')return wrap('<div class="login-wrap">'+back('Tilbage','/foreninger')+'<form id="login-form" class="form-card"><p class="eyebrow">For foreninger</p><h1 tabindex="-1">Log ind med din e-mail.</h1><p>Vi sender dig en kode. Du behøver ikke en adgangskode.</p>'+field('email','Din e-mail',login.email,'email','required autocomplete="email"')+'<button class="btn" type="submit">Send kode</button><div class="form-result" role="alert"></div><details style="margin-top:18px"><summary>Prøv en eksempelkonto</summary><p class="meta">ansvarlig@example.test<br>redaktor@example.test<br>teb@example.test<br>En anden e-mail viser første adgang.</p></details></form><p class="login-help">Har du brug for hjælp? <button class="text-button" data-action="help">Kontakt TEB</button></p></div>');
 if(!login.email){go('/login');return '';}
 return wrap('<div class="login-wrap">'+back('Ret e-mailadressen','/login')+'<form id="code-form" class="form-card"><p class="eyebrow">Næsten fremme</p><h1 tabindex="-1">Skriv koden.</h1><p>Koden er til <strong>'+esc(login.email)+'</strong>.</p>'+field('code','De seks cifre','','text','required pattern="[0-9]{6}" maxlength="6" inputmode="numeric" autocomplete="one-time-code" class="otp"')+'<div class="code-demo">Der sendes ingen rigtig mail i prototypen.<br>Brug prøvekoden <strong>123456</strong>.</div><button class="btn" type="submit">Log ind</button><div class="form-result" role="alert"></div><div class="auth-options"><button class="text-button" type="button" data-action="resend">Send ny kode</button>'+textLink('Ret e-mail','/login')+'</div></form></div>');
}
function loginSubmit(e){e.preventDefault();login.email=e.currentTarget.elements.email.value.trim().toLowerCase();go('/login/kode');}
function verifySubmit(e){
 e.preventDefault();if(e.currentTarget.elements.code.value!=='123456')return formError(e.currentTarget,'Brug prototypens prøvekode 123456.');
 const email=login.email;state.role=email==='ansvarlig@example.test'?'owner':email==='redaktor@example.test'?'editor':email==='teb@example.test'?'admin':'new';state.email=email;persist();
 const target=login.returnTo;login.returnTo='';
 go(target|| (isAdmin()?'/redaktion':ownIds().length>1?'/vaelg-forening':ownIds().length?'/min-forening/'+ownIds()[0]:'/adgang'));toast('Du er logget ind i prototypen.');
}
function accessPage(){
 if(!signedIn())return loginPage();
 const email=state.email||'ny@example.test',requests=state.requests.filter(r=>r.email===email);
 if(requests.length)return wrap('<div class="compact">'+back('Alle foreninger','/foreninger')+title('Din adgang')+requests.map(r=>'<section class="status-panel">'+badge(r.status)+'<h2>'+esc(assoc(r.aid)?.name||r.newAssociationName)+'</h2><p>'+(r.status==='pending'?'TEB skal bekræfte din tilknytning, før du kan ændre foreningens side.':r.status==='approved'?'Din adgang er godkendt i prototypen. Du kan åbne foreningen nu.':'Din anmodning blev ikke godkendt. Kontakt TEB for at komme videre.')+'</p>'+(r.note?'<p>'+esc(r.note)+'</p>':'')+'</section>'+(r.status==='approved'?link('Åbn min forening','/min-forening/'+r.aid):'')).join('')+'<div class="actions">'+btn('Opdatér status','refresh','','secondary')+btn('Kontakt TEB','help','','secondary')+'</div><p class="inline-help">Skift til TEB-redaktion for at prøve godkendelsen.</p></div>');
 return wrap(back('Alle foreninger','/foreninger')+'<div class="compact">'+title('Hvilken forening er du fra?','TEB bekræfter din tilknytning, før du får adgang.')+'<form id="access-form" class="form-card">'+field('name','Dit navn','','text','required maxlength="100"')+'<label class="field">Forening<select name="aid" id="access-association" required><option value="">Vælg en forening</option>'+state.associations.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.name)+'</option>').join('')+'<option value="new">Min forening mangler</option></select></label><div id="new-association" hidden>'+field('newAssociationName','Foreningens navn')+'</div>'+area('roleNote','Hvad er din rolle i foreningen?','','required maxlength="1000"')+'<p class="meta">Du søger med '+esc(email)+'.</p><div class="form-actions"><button class="btn" type="submit">Bed om adgang</button>'+btn('Kontakt TEB','help','','secondary')+'</div></form></div>');
}
function chooseAssociation(){
 const ids=ownIds();if(!ids.length)return accessPage();
 return wrap(title('Hvilken forening vil du åbne?')+'<div class="choice-grid">'+ids.map(id=>{const a=assoc(id);return '<a class="choice-card" href="#/min-forening/'+esc(id)+'">'+mark(a)+'<h2>'+esc(a.name)+'</h2><p>'+esc(a.category)+'</p><span class="card-link">Åbn foreningen →</span></a>';}).join('')+'</div>');
}
function membersPage(id){
 if(!canEdit(id))return denied();const a=assoc(id);if(!a)return missing();const manage=canManage(id),rows=state.members.filter(m=>m.aid===id);
 return wrap(back('Tilbage til jeres side','/min-forening/'+id)+title('Personer med adgang',a.name)+'<div class="form-layout"><div>'+(rows.map(m=>'<article class="person"><div class="avatar">'+esc(initials(m.name))+'</div><div><strong>'+esc(m.name)+'</strong><p>'+esc(m.email)+'</p><p>'+(m.role==='manager'?'Foreningsansvarlig':'Redaktør')+' · '+badge(m.status)+'</p></div>'+(manage&&(m.role==='editor'||isAdmin())?'<div class="actions"><button class="text-button danger" data-action="revoke" data-id="'+m.id+'">Fjern adgang</button></div>':'')+'</article>').join('')||'<p class="empty">Ingen personer er tilknyttet endnu.</p>')+
 (manage?'<form id="invite-form" class="form-card" style="margin-top:28px"><h2>'+(isAdmin()?'Tilknyt en person':'Invitér en redaktør')+'</h2>'+field('name','Navn','','text','required')+field('email','E-mail','','email','required')+(isAdmin()?'<label class="field">Rolle<select name="role"><option value="editor">Redaktør</option><option value="manager">Foreningsansvarlig</option></select></label>':'')+'<p class="meta">Personen kan rette profilen og udgive indhold for foreningen.</p><div class="form-result" role="alert"></div><div class="form-actions"><button type="submit" class="btn">Send invitation</button></div></form>':'<p class="note">Den foreningsansvarlige inviterer og fjerner redaktører.</p>')+'</div><aside class="info-aside"><h2>Den rigtige adgang</h2><p>Redaktører kan hjælpe med indhold og profil. Ansvarlige kan også administrere redaktører.</p><p>TEB hjælper, når der skal ændres foreningsansvarlig.</p><p class="meta">Invitationer her bliver kun gemt som eksempeldata. Ingen mail sendes.</p></aside></div>');
}
function calendarPage(){
 return wrap(title('Kalender','Find noget at være med til.',link('+ Opret arrangement','/opret?type=event'))+'<div class="filter-row"><div class="search"><label for="calendar-search" class="sr">Søg i kalenderen</label><input type="search" id="calendar-search" placeholder="Søg efter et arrangement eller en forening"></div><div class="filter"><label for="calendar-association" class="sr">Forening</label><select id="calendar-association"><option value="">Alle foreninger</option>'+state.associations.filter(a=>publicPosts().some(p=>p.associationId===a.id&&p.data.kind!=='news')).map(a=>'<option value="'+a.id+'" '+(ctx.q.get('forening')===a.id?'selected':'')+'>'+esc(a.name)+'</option>').join('')+'</select></div></div><div class="calendar-top"><div class="period"><button data-action="calendar-prev" aria-label="Forrige periode">←</button><strong id="calendar-period"></strong><button data-action="calendar-next" aria-label="Næste periode">→</button></div><div class="actions">'+btn('I dag','calendar-today','','secondary small')+'<div class="segmented"><button data-action="calendar-week" id="calendar-week">Uge</button><button data-action="calendar-month" id="calendar-month">Måned</button></div></div></div><div id="calendar-grid"></div><section class="line-section"><div class="section-heading"><h2>Kommende arrangementer</h2></div><div id="calendar-list"></div></section><section class="line-section"><div class="section-heading"><h2>Kalenderen på papir</h2></div>'+(state.editions.length?state.editions.map(e=>'<p style="margin:12px 0">'+textLink(esc(e.title)+' →','/print-udgave/'+e.id)+'</p>').join(''):'<p class="meta">Her finder du de faste printudgaver, når redaktionen har færdiggjort en udgave.</p>')+'</section>');
}
function renderCalendar(){
 const search=$('#calendar-search').value.toLocaleLowerCase('da'),aid=$('#calendar-association').value;
 const rows=publicPosts().filter(p=>p.data.kind!=='news'&&(!aid||p.associationId===aid)&&[p.published.title,p.author,p.published.description].join(' ').toLocaleLowerCase('da').includes(search));
 $('#calendar-week').setAttribute('aria-pressed',calendarMode==='week');$('#calendar-month').setAttribute('aria-pressed',calendarMode==='month');
 if(calendarMode==='week'){
  const start=monday(calendarAnchor);$('#calendar-period').textContent=dateText(start)+' – '+dateText(shift(start,6));
  $('#calendar-grid').innerHTML='<div class="week-grid">'+Array.from({length:7},(_,i)=>{const d=shift(start,i),items=rows.filter(p=>p.published.date<=d&&(p.published.endDate||p.published.date)>=d);return '<div class="day-col"><div class="day-title">'+dateText(d,{weekday:'short'})+'<strong>'+Number(d.slice(-2))+'</strong></div>'+items.map(calendarCard).join('')+'</div>';}).join('')+'</div>';
 }else{
  const first=calendarAnchor.slice(0,8)+'01',start=monday(first),month=first.slice(0,7);$('#calendar-period').textContent=dateText(first,{month:'long',year:'numeric'});
  const after=new Date(first+'T12:00:00Z');after.setUTCMonth(after.getUTCMonth()+1);after.setUTCDate(0);const last=after.toISOString().slice(0,10),weeks=Math.ceil((Number(new Date(last+'T12:00:00Z')-new Date(start+'T12:00:00Z'))/86400000+1)/7);
  $('#calendar-grid').innerHTML='<div class="month-grid">'+['Man','Tir','Ons','Tor','Fre','Lør','Søn'].map(d=>'<div class="weekday">'+d+'</div>').join('')+Array.from({length:weeks*7},(_,i)=>{const d=shift(start,i);return '<div class="month-cell '+(d.startsWith(month)?'':'other')+'">'+Number(d.slice(-2))+rows.filter(p=>p.published.date<=d&&(p.published.endDate||p.published.date)>=d).map(calendarCard).join('')+'</div>';}).join('')+'</div>';
 }
 const upcoming=rows.filter(p=>p.published.date>=TODAY).sort((a,b)=>a.published.date.localeCompare(b.published.date));
 $('#calendar-list').innerHTML=upcoming.map(p=>eventRow(p)).join('')||'<p class="empty">Ingen arrangementer matcher søgningen.</p>';
}
function calendarCard(p){const d=published(p);return '<a class="calendar-event '+(d.cancelled?'is-cancelled':'')+'" href="#/opslag/'+p.id+'"><small>'+esc(d.time)+(d.cancelled?' · Aflyst':'')+'</small>'+esc(d.title)+'<small>'+esc(p.author)+'</small></a>';}
function newsPage(){
 return wrap(title('Det sker her.','Historier og nyt fra byens fællesskaber.',link('Del med byen','/opret?type=news'))+'<div class="filter-row"><div class="search"><label for="news-search" class="sr">Søg efter en nyhed</label><input id="news-search" type="search" placeholder="Søg i nyhederne"></div><div class="filter"><label for="news-source" class="sr">Vælg kilde</label><select id="news-source"><option value="all">Alle kilder</option><option value="local">Foreningerne</option><option value="tistrup-nyt">Tistrup Nyt</option><option value="pulsen">Pulsen i Vest</option></select></div></div><div class="feed-grid" id="news-feed"></div><div class="help-band"><div><h2>Har I noget på hjerte?</h2><p>Fortæl om jeres fællesskab, eller invitér byen med til noget.</p></div>'+link('Skriv et opslag','/opret?type=news','secondary')+'</div>');
}
function renderNews(){
 const source=$('#news-source').value,s=$('#news-search').value.toLocaleLowerCase('da');
 const rows=publicPosts().filter(p=>(p.data.kind==='news'||p.published.alsoNews)&&[p.published.title,p.author,p.published.description].join(' ').toLocaleLowerCase('da').includes(s));
 const local=source==='all'||source==='local'?rows.map(p=>{const d=published(p);return '<a class="story-card" href="#/opslag/'+p.id+'">'+(d.image?'<img src="'+esc(d.image)+'" alt="" loading="lazy">':'')+'<div class="story-body"><span class="meta">'+esc(p.author)+' · '+esc(dateText(p.createdAt))+'</span><h2>'+esc(d.title)+'</h2><p>'+esc(d.description)+'</p>'+(d.kind!=='news'?'<p style="margin-top:15px">'+badge('published',dateText(d.date)+' kl. '+d.time)+'</p>':'')+'<span class="card-link">Læs historien ↗</span></div></a>';}).join(''):'';
 const sources=[['tistrup-nyt','Tistrup Nyt','https://tistrupnyt.dk/'],['pulsen','Pulsen i Vest','https://pulsenivest.dk/by/tistrup']];
 const external=sources.filter(([id,name])=>(source==='all'||source===id)&&(!s||name.toLocaleLowerCase('da').includes(s))).map(([,name,url])=>'<button class="story-card" data-action="source" data-url="'+url+'" style="text-align:left;color:inherit"><div class="story-body"><span class="eyebrow">Lokalt medie</span><h2>'+name+'</h2><p>Flere historier fra Tistrup og Hodde. I den rigtige portal hentes mediets kort her.</p><span class="card-link">Besøg kilden ↗</span><p class="meta" style="margin-top:14px">Kildevisning i prototypen</p></div></button>').join('');
 $('#news-feed').innerHTML=local+external||'<p class="empty">Ingen historier matcher din søgning.</p>';
}
function adminShell(tab,content){return wrap('<p class="eyebrow">TEB</p>'+title('Redaktion','Det, der skal videre i byen.')+'<nav class="tabs" aria-label="Redaktion">'+[['koe','Til godkendelse'],['indhold','Indhold'],['foreninger','Foreninger'],['print','Print']].map(([key,label])=>'<a href="#/redaktion?tab='+key+'" '+(tab===key?'aria-current="page"':'')+'>'+label+(key==='koe'?' <span class="chip">'+queueCount()+'</span>':'')+'</a>').join('')+'</nav>'+content);}
const queueCount=()=>state.posts.filter(p=>p.pending).length+state.requests.filter(r=>r.status==='pending').length;
function adminPage(){
 if(!isAdmin())return denied();const tab=ctx.q.get('tab')||'koe';
 if(tab==='print')return adminShell(tab,printStart());
 if(tab==='foreninger')return adminShell(tab,'<div class="section-heading"><h2>Foreninger og ansvarlige</h2>'+btn('Opret forening','new-association','','secondary small')+'</div>'+state.associations.map(a=>'<article class="admin-association"><div><h2>'+esc(a.name)+'</h2><p class="meta">'+esc(a.category)+'</p></div><div class="actions">'+link('Redigér profil','/profil/'+a.id,'secondary small')+link('Personer','/adgange/'+a.id,'secondary small')+'</div></article>').join(''));
 if(tab==='indhold')return adminShell(tab,'<div class="section-heading"><h2>Alt indhold</h2>'+link('+ Opret indhold','/opret?type=event&forening=solsiden','secondary small')+'</div><div class="filter-row"><div class="search"><label class="sr" for="admin-search">Søg i alt indhold</label><input id="admin-search" type="search" placeholder="Søg efter titel, afsender eller sted"></div><div class="filter"><label for="admin-status" class="sr">Status</label><select id="admin-status"><option value="">Alle statusser</option><option value="published">Udgivet</option><option value="pending">Afventer TEB</option><option value="cancelled">Aflyst</option><option value="removed">Fjernet</option></select></div></div><div id="admin-content"></div>');
 const events=state.posts.filter(p=>p.pending),requests=state.requests.filter(r=>r.status==='pending');
 return adminShell(tab,'<div class="section-heading"><h2>'+queueCount()+' opgaver venter</h2></div>'+events.map(p=>'<article class="queue-item"><div><span class="queue-type">'+(p.pendingKind==='edit'?'Rettelse':p.pendingKind==='cancel'?'Aflysning':p.data.kind==='news'?'Nyhed fra gæst':'Arrangement fra gæst')+'</span><h2>'+esc(p.pending.title)+'</h2><p>'+esc(p.author)+' · '+esc(p.pending.date?dateText(p.pending.date):'Nyhed')+'</p></div>'+link('Gennemgå','/opgave/'+p.id,'secondary small')+'</article>').join('')+requests.map(r=>'<article class="queue-item"><div><span class="queue-type">Adgang til forening</span><h2>'+esc(r.name)+' søger adgang</h2><p>'+esc(assoc(r.aid)?.name||r.newAssociationName)+'</p></div>'+link('Gennemgå','/opgave/'+r.id+'?type=adgang','secondary small')+'</article>').join('')+(!queueCount()?'<div class="status-panel"><h2>Du er med.</h2><p>Der er ingen opgaver, der afventer svar lige nu.</p></div>':''));
}
function filterAdmin(){const s=$('#admin-search').value.toLocaleLowerCase('da'),status=$('#admin-status').value;$('#admin-content').innerHTML=state.posts.filter(p=>(!status||p.status===status)&&[p.data.title,p.author,p.data.location].join(' ').toLocaleLowerCase('da').includes(s)).map(p=>'<article class="content-item"><div>'+badge(p.status)+'<h3>'+esc(p.data.title)+'</h3><p>'+esc(p.author)+' · '+(p.data.kind==='news'?'Nyhed':esc(dateText(p.data.date)))+'</p></div><div class="actions">'+(p.pending?textLink('Gennemgå','/opgave/'+p.id):textLink('Ret','/opret/'+p.id+'?forening='+(p.associationId||'solsiden')))+(p.published?textLink('Se','/opslag/'+p.id):'')+'</div></article>').join('')||'<p class="empty">Ingen indhold matcher.</p>';}
function summary(d){return '<h2>'+esc(d.title)+'</h2>'+(d.kind!=='news'?'<p>'+esc(dateText(d.date))+' kl. '+esc(d.time)+'<br>'+esc(d.location)+'</p>':'')+'<p>'+esc(d.description)+'</p>'+(d.body?'<p>'+esc(d.body)+'</p>':'');}
function reviewPage(id){
 if(!isAdmin())return denied();const request=state.requests.find(r=>r.id===id);
 if(request)return wrap(back('Tilbage til redaktionen','/redaktion')+title('Gennemgå adgang')+'<div class="form-layout"><form id="review-access" class="form-card" data-id="'+id+'"><p class="eyebrow">'+esc(assoc(request.aid)?.name||request.newAssociationName)+'</p><h2>'+esc(request.name)+'</h2><p>'+esc(request.email)+'</p><p>'+esc(request.roleNote)+'</p>'+check('verified','Jeg har kontrolleret personens tilknytning til foreningen')+area('note','Besked til personen <em>· valgfrit ved godkendelse</em>','')+'<div class="form-result" role="alert"></div><div class="form-actions"><button type="submit" name="decision" value="approve" class="btn">Godkend ansvarlig</button><button type="submit" name="decision" value="reject" class="btn secondary" formnovalidate>Afvis</button></div></form><aside class="info-aside"><h2>Adgang kræver et tjek</h2><p>En e-mailbekræftelse viser, hvem der kan åbne mailen. TEB skal også kontrollere tilknytningen til foreningen.</p></aside></div>');
 const p=post(id);if(!p?.pending)return wrap(back('Tilbage til redaktionen','/redaktion')+title('Opgaven er behandlet')+link('Tilbage til redaktionen','/redaktion'));
 const d=p.pending;
 return wrap(back('Tilbage til redaktionen','/redaktion')+title(p.pendingKind==='cancel'?'Gennemgå aflysning':p.pendingKind==='edit'?'Gennemgå rettelse':'Gennemgå indsendelse','Oplyst afsender: '+p.author+' · '+(p.email||'Ingen mail i eksemplet'))+'<div class="review-columns"><section class="review-version"><p class="eyebrow">Det ser borgerne nu</p>'+(p.published?summary(p.published):'<h2>Endnu ikke offentligt</h2><p>Indsendelsen bliver først vist efter godkendelse.</p>')+'</section><section class="review-version"><p class="eyebrow">'+(p.pendingKind==='cancel'?'Ønsket aflysning':'Indsendt indhold')+'</p>'+summary(d)+(d.print?'<p>'+badge('published','Ønsker papirkalender')+'</p>':'')+'<details><summary>Ret indhold før godkendelse</summary>'+field('review-title','Titel',d.title)+area('review-description','Beskrivelse',d.description)+'</details></section></div><form id="review-event" class="review-actions" data-id="'+id+'">'+area('note','Besked til afsenderen <em>· påkrævet ved afvisning</em>','')+'<div class="form-result" role="alert"></div><div class="form-actions"><button type="submit" name="decision" value="approve" class="btn">'+(p.pendingKind==='cancel'?'Godkend aflysning':'Godkend og udgiv')+'</button><button type="submit" name="decision" value="reject" class="btn secondary">Bed om rettelse</button></div></form>');
}
function reviewEvent(e){
 e.preventDefault();const p=post(e.currentTarget.dataset.id),approve=e.submitter?.value==='approve',note=e.currentTarget.elements.note.value.trim();
 if(!approve&&!note)return formError(e.currentTarget,'Skriv en kort besked om det, der skal rettes.');
 if(approve){const d=clone(p.pending);if($('#main input[name="review-title"]'))d.title=$('#main input[name="review-title"]').value.trim()||d.title;if($('#main textarea[name="review-description"]'))d.description=$('#main textarea[name="review-description"]').value.trim()||d.description;if(p.pendingKind==='cancel')d.cancelled=true;p.published=d;p.data=clone(d);p.status=d.cancelled?'cancelled':'published';}
 else p.status='rejected';
 p.pending=null;p.pendingKind=null;p.note=note;persist();go('/redaktion');toast(approve?'Indholdet er godkendt og opdateret.':'Beskeden er gemt på gæstens statusvisning.');
}
function reviewAccess(e){
 e.preventDefault();const form=e.currentTarget,r=state.requests.find(x=>x.id===form.dataset.id),approve=e.submitter?.value==='approve',note=form.elements.note.value.trim();
 if(approve&&!form.elements.verified.checked)return formError(form,'Bekræft først, at du har kontrolleret tilknytningen.');
 if(!approve&&!note)return formError(form,'Skriv en kort begrundelse for afvisningen.');
 if(approve&&r.aid==='new'){r.aid=uid('forening');state.associations.push({id:r.aid,name:r.newAssociationName,category:'Fællesskab og fritid',place:'Tistrup',description:'Foreningen har endnu ikke skrevet en beskrivelse.',image:'',chair:r.name,email:'',phone:'',website:''});}
 r.status=approve?'approved':'rejected';r.note=note;
 if(approve&&!state.members.some(m=>m.aid===r.aid&&m.email===r.email))state.members.push({id:uid('person'),aid:r.aid,email:r.email,name:r.name,role:'manager',status:'invited'});
 persist();go('/redaktion');toast(approve?'Adgangen er godkendt i prototypen.':'Anmodningen er afvist med en besked.');
}
function printStart(){
 const d=state.printDraft||{start:'2026-10-19',end:'2026-11-30',format:'a3',title:'Det sker i Tistrup og Hodde'};
 return '<div class="section-heading"><h2>Lav en papirudgave</h2></div><p class="muted" style="font-size:15px">Vælg indholdet til netop denne udgave. Godkendelse på nettet er ikke det samme som plads på papir.</p>'+steps(1)+'<div class="form-layout"><form id="print-options" class="form-card">'+field('title','Overskrift på udgaven',d.title,'text','required')+'<div class="form-row">'+field('start','Fra dato',d.start,'date','required')+field('end','Til dato',d.end,'date','required')+'</div><label class="field">Format<select name="format"><option value="a3" '+(d.format==='a3'?'selected':'')+'>A3 · 29,7 × 42 cm</option><option value="poster" '+(d.format==='poster'?'selected':'')+'>Plakat · 50 × 70 cm</option></select></label><div class="form-result" role="alert"></div><div class="form-actions"><button type="submit" class="btn">Hent til gennemgang →</button></div></form><aside class="info-aside"><h2>Hver udgave er jeres valg.</h2><p>Vælg arrangementer til og fra. Tilpas teksten, og se hele korrekturen, før du gemmer udgaven.</p><p class="meta">Prototypen bruger en printvisning, som kan udskrives eller gemmes som PDF fra browseren.</p></aside></div><section class="line-section"><h2>Gemte udgaver</h2>'+(state.editions.length?state.editions.map(ed=>'<article class="content-item"><div><h3>'+esc(ed.title)+'</h3><p>'+esc(dateText(ed.start))+' – '+esc(dateText(ed.end))+' · '+ed.events.length+' arrangementer</p></div>'+link('Åbn fast udgave','/print-udgave/'+ed.id,'secondary small')+'</article>').join(''):'<p class="empty">Du har ikke gemt nogen udgave i prototypen endnu.</p>')+'</section>';
}
function steps(n){return '<div class="steps">'+['Periode','Udvælg','Korrektur','Gem'].map((t,i)=>'<span class="'+(i+1===n?'current':'')+'"><b>'+(i+1)+'</b>'+t+'</span>').join('')+'</div>';}
function printCandidates(){
 if(!isAdmin())return denied();const d=state.printDraft;if(!d)return adminShell('print',printStart());
 return wrap(back('Tilbage til periode','/redaktion?tab=print')+title('Vælg til eller fra','Du gennemgår '+d.candidates.length+' arrangementer til denne udgave.')+steps(2)+'<div class="compact"><div class="note">Printtekster ændrer kun papirudgaven. De offentlige arrangementer bliver stående.</div><form id="print-selection">'+(d.candidates.map(x=>{const choice=d.choices[x.id]||'',text=d.overrides[x.id]||{};return '<article class="print-item" data-print-id="'+x.id+'"><div class="print-item-head"><div><h3>'+esc(x.title)+'</h3><p class="meta">'+esc(dateText(x.date))+' · '+esc(x.time)+' · '+esc(x.location)+'<br>'+esc(x.author)+'</p></div><label><span class="sr">Udvælg '+esc(x.title)+'</span><select name="choice-'+x.id+'" data-choice="'+x.id+'"><option value="">Vælg til eller fra</option><option value="include" '+(choice==='include'?'selected':'')+'>Med på papiret</option><option value="exclude" '+(choice==='exclude'?'selected':'')+'>Ikke denne gang</option></select></label></div><details '+(choice!=='include'?'hidden':'')+' data-print-text="'+x.id+'"><summary>Ret teksten til papir</summary>'+field('title-'+x.id,'Kort titel',text.title||x.title,'text','data-print-field="title" data-id="'+x.id+'"')+field('details-'+x.id,'Tid og sted',text.details||'Kl. '+x.time+' · '+x.location,'text','data-print-field="details" data-id="'+x.id+'"')+field('author-'+x.id,'Arrangør',text.author||x.author,'text','data-print-field="author" data-id="'+x.id+'"')+'</details></article>';}).join('')||'<p class="empty">Ingen egnede arrangementer i den valgte periode.</p>')+'<div class="print-foot"><span id="print-count"></span><button class="btn" type="submit" id="proof-button">Lav korrektur →</button></div><div class="form-result" role="alert"></div></form></div>');
}
function printCount(){const d=state.printDraft,choices=Object.values(d.choices),included=choices.filter(x=>x==='include').length,remaining=d.candidates.length-choices.filter(Boolean).length;$('#print-count').textContent=included+' valgt · '+remaining+' mangler gennemgang';$('#proof-button').disabled=remaining>0||included===0;}
function paperHtml(edition){return '<div class="paper"><p class="paper-kicker">Sammen om Tistrup · '+(edition.format==='poster'?'Plakat':'A3')+'</p><h1>'+esc(edition.title)+'</h1><p style="font-size:14px">'+esc(dateText(edition.start))+' – '+esc(dateText(edition.end))+'</p>'+edition.events.map(x=>'<article class="paper-row"><div class="paper-date">'+esc(dateText(x.date,{day:'numeric',month:'short'}))+'</div><div><h2>'+esc(x.title)+'</h2><p>'+esc(x.details)+'</p><p>'+esc(x.author)+'</p></div></article>').join('')+'<p class="paper-footer">Tistrup Erhvervs- og Borgerforening · Se aktuelle oplysninger i netkalenderen.<br>Eksempeludgave fra en designprototype.</p></div>';}
function proofPage(saved=false,id=''){
 if(!saved&&!isAdmin())return denied();const d=saved?state.editions.find(e=>e.id===id):state.printDraft?.proof;
 if(!d)return missing();
 if(!saved){state.printDraft.opened=true;persist();}
 return wrap(back(saved?'Tilbage til kalenderen':'Tilbage til udvælgelsen',saved?'/kalender':'/print-udvaelg')+'<div class="no-print">'+title(saved?'Fast printudgave':'Gennemse korrekturen',saved?'Denne udgave ændres ikke, når indholdet på nettet bliver rettet.':'Kontrollér datoer, titler, tid og sted for alle arrangementer.',btn('Print / gem som PDF','print-browser','','secondary'))+(!saved?steps(3):'<p class="note success">Fast eksempeludgave · '+d.events.length+' arrangementer</p>')+'</div>'+paperHtml(d)+(!saved?'<form id="finalize-print" class="form-card compact no-print" style="margin:auto">'+check('proofread','Jeg har gennemgået hele korrekturen.',Boolean(state.printDraft.proofread))+'<div class="form-actions">'+link('Ret udvælgelsen','/print-udvaelg','secondary')+'<button type="submit" class="btn" id="finalize-button" '+(state.printDraft.proofread?'':'disabled')+'>Gem fast udgave</button></div></form>':''));
}
function missing(){return wrap(title('Den side findes ikke her.')+link('Tilbage til foreningerne','/foreninger'));}
function modal(title,content,actions=''){
 $('#dialog-content').innerHTML='<div class="dialog-top"><h2 id="dialog-title">'+esc(title)+'</h2><button data-action="close-dialog" aria-label="Luk">×</button></div>'+content+(actions?'<div class="actions">'+actions+'</div>':'');
 if(!$('#dialog').open)$('#dialog').showModal();
}
function confirmAction(title,message,label,callback,danger=false){modal(title,'<p>'+esc(message)+'</p>',btn('Fortryd','close-dialog','','secondary')+'<button id="confirm-action" class="btn '+(danger?'danger':'')+'">'+esc(label)+'</button>');$('#confirm-action').onclick=()=>{$('#dialog').close();callback();};}
async function copyText(text){try{await navigator.clipboard.writeText(text);toast('Linket er kopieret.');}catch{modal('Kopiér linket','<label class="field">Link<input value="'+esc(text)+'" readonly onclick="this.select()"></label>');}}
function cancelPost(id,guest=false){
 const p=post(id);if(!p||guest&&p.source!=='guest'||!guest&&!canEditPost(p))return;
 if(p.published?.cancelled)return toast('Arrangementet er allerede aflyst.');
 confirmAction(guest?'Bed TEB om aflysning?':'Aflys arrangementet?',guest?'Den offentlige version bliver stående, indtil TEB har godkendt aflysningen.':'Arrangementet bliver vist som aflyst i kalenderen og på foreningens side.',guest?'Send til TEB':'Ja, aflys',()=>{
  if(guest){p.pending=clone(p.published);p.pendingKind='cancel';p.status='pending';}
  else{p.published={...clone(p.published),cancelled:true};p.data=clone(p.published);p.status='cancelled';p.pending=null;p.pendingKind=null;}
  persist();render();toast(guest?'Aflysningen afventer nu TEB.':'Arrangementet er markeret som aflyst.');
 },!guest);
}
function guide(){modal('Prøv prototypen','<p>Vælg et forløb. Alle ændringer sker kun i prototypen.</p><div class="guide-list">'+[
 ['visitor','/forening/solsiden','1. Se en foreningsside som besøgende'],
 ['owner','/min-forening/solsiden','2. Opret et arrangement og se det offentligt'],
 ['editor','/min-forening/solsiden','3. Prøv en redaktørs adgang'],
 ['visitor','/opret?type=event','4. Indsend som gæst og følg status'],
 ['admin','/redaktion','5. Godkend indhold og adgang som TEB'],
 ['admin','/redaktion?tab=print','6. Udvælg og gem en papirudgave'],
 ['new','/adgang','7. Bed om adgang til en forening']
 ].map(([r,path,label])=>'<button data-action="guide-route" data-role="'+r+'" data-path="'+path+'">'+label+' →</button>').join('')+'</div>');}
function action(e){
 const el=e.target.closest('[data-action]');if(!el)return;const a=el.dataset.action,id=el.dataset.id;e.preventDefault();
 if(a==='close-dialog')return $('#dialog').close();
 if(a==='guide')return guide();
 if(a==='guide-route'){$('#dialog').close();setRole(el.dataset.role,false);return go(el.dataset.path);}
 if(a==='reset')return confirmAction('Start forfra?','Alle ændringer i denne prototype erstattes med de oprindelige eksempeldata.','Nulstil prototype',()=>{state=seed();persist();go('/forening/solsiden');toast('Prototypen er nulstillet.');});
 if(a==='help')return modal('Kontakt TEB','<p>I den rigtige portal kan du kontakte TEB om adgang, indhold og hjælp til foreningssiden.</p><p>Denne prototype sender ingen beskeder.</p>',btn('Luk','close-dialog','','secondary'));
 if(a==='contact'){const x=assoc(id);return modal('Kontakt '+x.name,'<p>'+esc(x.chair||'Foreningens kontaktperson')+'</p><p>'+esc(x.email||'Kontakt via foreningens hjemmeside')+(x.phone?'<br>'+esc(x.phone):'')+'</p><p class="meta">Eksempeloplysninger. Ingen besked sendes herfra.</p>',btn('Luk','close-dialog','','secondary'));}
 if(a==='guest-contact')return modal('Kontakt arrangøren','<p>Kontaktoplysninger vises her, når arrangøren har valgt at dele dem offentligt.</p><p class="meta">Kvitteringsmailen fra en gæsteindsendelse er privat.</p>');
 if(a==='website'){const x=assoc(id);return modal(x.name+' på nettet','<p>Hjemmesiden åbner i en ny fane. Eksempeloplysninger på foreningssiden er kun til denne prototype.</p>','<a class="btn" href="'+esc(x.website)+'" target="_blank" rel="noopener noreferrer">Besøg hjemmesiden ↗</a>');}
 if(a==='source'||a==='external'){if(!validURL(el.dataset.url))return;return modal(a==='source'?'Besøg kilden':'Mere information','<p>Du forlader prototypen og åbner siden i en ny fane.</p>','<a class="btn" href="'+esc(el.dataset.url)+'" target="_blank" rel="noopener noreferrer">Åbn siden ↗</a>');}
 if(a==='logout'){state.role='visitor';state.email='';persist();go('/foreninger');return toast('Du er logget ud af prototypen.');}
 if(a==='refresh'){render();return toast('Status er opdateret.');}
 if(a==='resend')return toast('Prøvekoden er stadig 123456. Ingen mail sendes.');
 if(a==='cancel')return cancelPost(id);
 if(a==='guest-cancel')return cancelPost(id,true);
 if(a==='remove-post'){const p=post(id);if(!canEditPost(p))return;return confirmAction('Fjern nyheden?','Nyheden forsvinder fra de offentlige sider.','Ja, fjern',()=>{p.status='removed';persist();render();toast('Nyheden er fjernet fra de offentlige visninger.');},true);}
 if(a==='revoke'){const m=state.members.find(x=>x.id===id);if(!m||!canManage(m.aid)||m.role==='manager'&&!isAdmin())return;return confirmAction('Fjern adgangen?','Fjern '+m.name+' fra foreningens adgangsliste.','Fjern adgang',()=>{state.members=state.members.filter(x=>x.id!==id);persist();render();toast('Adgangen er fjernet i prototypen.');},true);}
 if(a==='remove-image'){const form=$('#profile-form');form.elements.image.value='';$('#profile-image-preview').innerHTML='<div class="mark">'+esc(initials(form.elements.name.value))+'</div>';return;}
 if(a==='compose-kind'){const form=$('#compose-form');state.drafts[form.dataset.editId||'new']=getDraft(form);state.drafts[form.dataset.editId||'new'].kind=el.dataset.kind;persist();return render();}
 if(a==='preview-post'){const form=$('#compose-form'),d=getDraft(form);return modal('Privat forhåndsvisning','<p class="meta">Indholdet er ikke gemt endnu.</p>'+summary({...d,title:d.title||'Din overskrift',description:d.description||'Din korte beskrivelse'}),btn('Tilbage til formularen','close-dialog','','secondary'));}
 if(a==='copy-private')return copyText(location.href.split('#')[0]+'#/status/'+id);
 if(a==='share')return copyText(location.href.split('#')[0]+'#/opslag/'+id);
 if(a==='ics')return downloadICS(post(id));
 if(a.startsWith('calendar-')){
  if(a==='calendar-week')calendarMode='week';if(a==='calendar-month')calendarMode='month';if(a==='calendar-today')calendarAnchor=TODAY;
  if(a==='calendar-prev'||a==='calendar-next'){const n=a==='calendar-prev'?-1:1;if(calendarMode==='week')calendarAnchor=shift(calendarAnchor,n*7);else{const d=new Date(calendarAnchor.slice(0,8)+'01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);calendarAnchor=d.toISOString().slice(0,10);}}
  return renderCalendar();
 }
 if(a==='print-browser')return window.print();
 if(a==='new-association')return modal('Opret forening','<form id="new-association-form">'+field('name','Foreningens navn','','text','required maxlength="100"')+field('category','Interesse','Fællesskab og fritid')+field('place','Mødested','Tistrup')+'<div class="form-actions"><button type="submit" class="btn">Opret forening</button></div></form>');
}
function downloadICS(p){
 if(!p?.published)return;const d=p.published,clean=x=>String(x||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;'),date=d.date.replaceAll('-',''),time=d.time.replace(':','');
 const text=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//TEB prototype//DA','BEGIN:VEVENT','UID:'+p.id+'@prototype.example.test','DTSTART;TZID=Europe/Copenhagen:'+date+'T'+time+'00','SUMMARY:'+clean(d.title),'LOCATION:'+clean(d.location),'DESCRIPTION:'+clean(d.description),'STATUS:'+(d.cancelled?'CANCELLED':'CONFIRMED'),'END:VEVENT','END:VCALENDAR'].join('\r\n');
 const url=URL.createObjectURL(new Blob([text],{type:'text/calendar;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='eksempel-arrangement.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('Eksempelarrangementet er hentet som kalenderfil.');
}
async function imageUpload(input,target,preview){
 const file=input.files[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type))return toast('Vælg et JPG-, PNG- eller WebP-billede.');if(file.size>12*1024*1024)return toast('Vælg et billede under 12 MB.');
 const form=input.closest('form'),submit=form?.querySelector('button[type="submit"]');
 if(submit)submit.disabled=true;input.disabled=true;
 const unlock=()=>{input.disabled=false;if(submit)submit.disabled=false;};
 const fail=()=>{unlock();toast('Billedet kunne ikke åbnes. Vælg et andet billede.');};
 const reader=new FileReader();reader.onerror=fail;reader.onload=()=>{
  const img=new Image();img.onerror=fail;img.onload=()=>{
   try{
    const scale=Math.min(1,1000/img.width,1000/img.height),canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
    const data=canvas.toDataURL('image/jpeg',.8);target.value=data;preview.innerHTML='<img src="'+data+'" alt="Valgt billede" style="max-height:140px;border-radius:8px">';
    if(form?.id==='compose-form'){state.drafts[form.dataset.editId||'new']=getDraft(form);persist();}
    unlock();
   }catch{fail();}
  };img.src=reader.result;
 };reader.readAsDataURL(file);
}
function bind(){
 if($('#directory-search')){filterDirectory();$('#directory-search').oninput=filterDirectory;$('#directory-category').onchange=filterDirectory;}
 if($('#content-search')){filterOwn();$('#content-search').oninput=filterOwn;$('#content-filter').onchange=filterOwn;}
 if($('#profile-form')){$('#profile-form').onsubmit=profileSubmit;$('#profile-file').onchange=e=>imageUpload(e.target,$('#profile-form').elements.image,$('#profile-image-preview'));}
 if($('#compose-form')){
  const f=$('#compose-form');f.onsubmit=composeSubmit;f.oninput=()=>{state.drafts[f.dataset.editId||'new']=getDraft(f);persist();};f.onchange=()=>{if(f.elements.alsoNews)$('#story-fields').hidden=!f.elements.alsoNews.checked;state.drafts[f.dataset.editId||'new']=getDraft(f);persist();};$('#post-file').onchange=e=>imageUpload(e.target,f.elements.image,$('#post-image-preview'));
 }
 if($('#login-form'))$('#login-form').onsubmit=loginSubmit;
 if($('#code-form'))$('#code-form').onsubmit=verifySubmit;
 if($('#access-form')){
  $('#access-association').onchange=e=>{const isNew=e.target.value==='new';$('#new-association').hidden=!isNew;$('#access-form').elements.newAssociationName.required=isNew;};
  $('#access-form').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget));state.requests.push({id:uid('request'),...d,email:state.email||'ny@example.test',status:'pending',note:''});persist();render();toast('Din adgangsanmodning er gemt hos TEB i prototypen.');};
 }
 if($('#invite-form'))$('#invite-form').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget));if(state.members.some(m=>m.aid===ctx.id&&m.email===d.email.toLowerCase()))return formError(e.currentTarget,'Den e-mail findes allerede på adgangslisten.');state.members.push({id:uid('person'),aid:ctx.id,name:d.name,email:d.email.toLowerCase(),role:d.role||'editor',status:'invited'});persist();render();toast('Invitationen er gemt. Ingen rigtig mail er sendt.');};
 if($('#calendar-grid')){renderCalendar();$('#calendar-search').oninput=renderCalendar;$('#calendar-association').onchange=renderCalendar;}
 if($('#news-feed')){renderNews();$('#news-search').oninput=renderNews;$('#news-source').onchange=renderNews;}
 if($('#admin-content')){filterAdmin();$('#admin-search').oninput=filterAdmin;$('#admin-status').onchange=filterAdmin;}
 if($('#review-event'))$('#review-event').onsubmit=reviewEvent;
 if($('#review-access'))$('#review-access').onsubmit=reviewAccess;
 if($('#print-options'))$('#print-options').onsubmit=e=>{
  e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget));if(d.start>d.end)return formError(e.currentTarget,'Slutdatoen skal ligge efter startdatoen.');
  const old=state.printDraft,same=old&&old.start===d.start&&old.end===d.end&&old.format===d.format&&old.title===d.title;
  if(!same)state.printDraft={...d,candidates:publicPosts().filter(p=>p.data.kind!=='news'&&!p.published.cancelled&&p.published.print!==false&&p.published.date<=d.end&&(p.published.endDate||p.published.date)>=d.start).map(p=>({id:p.id,author:p.author,...clone(p.published)})).sort((a,b)=>a.date.localeCompare(b.date)),choices:{},overrides:{},opened:false,proofread:false,proof:null};
  persist();go('/print-udvaelg');
 };
 if($('#print-selection')){
  printCount();const f=$('#print-selection');
  f.oninput=e=>{const d=state.printDraft;if(e.target.dataset.printField){const id=e.target.dataset.id;d.overrides[id]??={};d.overrides[id][e.target.dataset.printField]=e.target.value;}d.proof=null;d.proofread=false;persist();};
  f.onchange=e=>{if(!e.target.dataset.choice)return;const d=state.printDraft,id=e.target.dataset.choice;d.choices[id]=e.target.value;d.proof=null;d.proofread=false;f.querySelector('[data-print-text="'+id+'"]').hidden=e.target.value!=='include';persist();printCount();};
  f.onsubmit=e=>{e.preventDefault();const d=state.printDraft;if(d.candidates.some(x=>!d.choices[x.id]))return formError(f,'Vælg til eller fra ved hvert arrangement.');const events=d.candidates.filter(x=>d.choices[x.id]==='include').map(x=>({date:x.date,title:d.overrides[x.id]?.title||x.title,details:d.overrides[x.id]?.details||'Kl. '+x.time+' · '+x.location,author:d.overrides[x.id]?.author||x.author}));if(!events.length)return formError(f,'Vælg mindst ét arrangement.');d.proof={title:d.title,start:d.start,end:d.end,format:d.format,events};d.opened=false;d.proofread=false;persist();go('/print-korrektur');};
 }
 if($('#finalize-print')){
  const f=$('#finalize-print');f.onchange=()=>{state.printDraft.proofread=f.elements.proofread.checked;persist();$('#finalize-button').disabled=!f.elements.proofread.checked;};
  f.onsubmit=e=>{e.preventDefault();if(!state.printDraft.opened||!f.elements.proofread.checked)return;const edition={id:uid('udgave'),...clone(state.printDraft.proof)};state.editions.unshift(edition);state.printDraft=null;persist();go('/print-udgave/'+edition.id);toast('Den faste eksempeludgave er gemt.');};
 }
}
function render(){
 const raw=location.hash.slice(1)||'/forening/solsiden',[path,query='']=raw.split('?'),parts=path.split('/').filter(Boolean);ctx={path:raw,page:parts[0]||'forening',id:parts[1]||'',q:new URLSearchParams(query)};
 header();let html;
 switch(ctx.page){
  case 'foreninger':html=directory();break;
  case 'forening':html=publicProfile(ctx.id||'solsiden');break;
  case 'min-forening':html=owner(ctx.id||state.selectedAid);break;
  case 'profil':html=profileForm(ctx.id);break;
  case 'opret':html=compose(ctx.id);break;
  case 'kvittering':html=receipt(ctx.id);break;
  case 'status':html=privateStatus(ctx.id);break;
  case 'opslag':html=detail(ctx.id);break;
  case 'login':html=loginPage();break;
  case 'adgang':html=accessPage();break;
  case 'vaelg-forening':html=chooseAssociation();break;
  case 'adgange':html=membersPage(ctx.id);break;
  case 'kalender':html=calendarPage();break;
  case 'nyt':html=newsPage();break;
  case 'redaktion':html=adminPage();break;
  case 'opgave':html=reviewPage(ctx.id);break;
  case 'print-udvaelg':html=printCandidates();break;
  case 'print-korrektur':html=proofPage();break;
  case 'print-udgave':html=proofPage(true,ctx.id);break;
  default:html=missing();
 }
 $('#main').innerHTML=html||'';bind();window.scrollTo({top:0,behavior:'instant'});$('#main h1')?.focus({preventScroll:true});document.title=($('#main h1')?.textContent||'Foreningsliv')+' · TEB prototype';
 let printStyle=$('#print-page-size');if(!printStyle){printStyle=document.createElement('style');printStyle.id='print-page-size';document.head.append(printStyle);}const edition=ctx.page==='print-udgave'?state.editions.find(e=>e.id===ctx.id):state.printDraft?.proof;printStyle.textContent='@page{size:'+(edition?.format==='poster'?'500mm 700mm':'A3 portrait')+';margin:15mm}';
}
document.addEventListener('click',action);
$('.skip').onclick=e=>{e.preventDefault();$('#main').focus();$('#main').scrollIntoView({block:'start'});};
document.addEventListener('submit',e=>{if(e.target.id==='new-association-form'){e.preventDefault();if(!isAdmin())return;const data=Object.fromEntries(new FormData(e.target)),a={id:uid('forening'),...data,description:'Skriv en kort introduktion til foreningen.',about:'',chair:'',email:'',phone:'',website:'',image:''};state.associations.push(a);persist();$('#dialog').close();go('/profil/'+a.id);toast('Foreningen er oprettet. Tilføj profil og ansvarlige.');}});
$('#demo-role').onchange=e=>setRole(e.target.value);
$('#dialog').addEventListener('click',e=>{if(e.target===$('#dialog')){const r=$('#dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('#dialog').close();}});
window.addEventListener('hashchange',()=>{if($('#dialog').open)$('#dialog').close();render();});
persist();render();
