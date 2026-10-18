import { ensure, now, hash, copenhagenDate, validDate, validateMonth, period, json } from './shared.mjs';
import { stmt, all } from './db.mjs';
import { requireAccess } from './auth.mjs';
import { makeCalendarPdf } from './pdf.mjs';
export function editionOptions(input){
 const month=input.month?validateMonth(input.month):null,legacy=month?period(month):{};
 const start=input.start||legacy.start,end=input.end||legacy.end,deadline=input.deadline||copenhagenDate(),format=input.format||'poster';
 ensure(validDate(start||'')&&validDate(end||'')&&start<=end,400,'Vælg et gyldigt datointerval.');
 ensure(validDate(deadline)&&deadline<=copenhagenDate(),400,'Printfristen må ikke ligge i fremtiden.');
 ensure(['poster','a3'].includes(format),400,'Vælg plakat eller A3.');
 ensure(new Date(end)-new Date(start)<=366*86400000,400,'En printudgave kan højst dække et år.');
 return {month:month||start.slice(0,7),start,end,deadline,format};
}
export async function snapshot(env,options){
 // Published versions are ordered by publication time and id. The date comparison
 // includes the whole deadline day in Copenhagen, including DST transitions.
 const rows=await all(stmt(env,'SELECT event_id,data_json,published_at FROM publications ORDER BY published_at ASC,id ASC'));
 const latest=new Map();
 for(const row of rows)if(copenhagenDate(row.published_at)<=options.deadline)latest.set(row.event_id,{id:row.event_id,...JSON.parse(row.data_json)});
 return {...options,calendarUrl:env.PUBLIC_ORIGIN+'/kalender.html',events:[...latest.values()].filter(e=>e.state==='approved'&&e.printRequested!==false&&e.date<=options.end&&(e.endDate||e.date)>=options.start).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)||a.title.localeCompare(b.title,'da'))};
}
function selection(input){
 ensure(Array.isArray(input.eventIds)&&input.eventIds.length<=500&&input.eventIds.every(id=>typeof id==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(id)),400,'Gennemgå arrangementerne, og vælg dem, der skal med i printudgaven.');
 ensure(new Set(input.eventIds).size===input.eventIds.length,400,'Et arrangement er valgt mere end én gang.');
 ensure(typeof input.reviewHash==='string'&&/^[a-f0-9]{64}$/.test(input.reviewHash),400,'Hent arrangementerne til gennemgang, før du laver PDF’en.');
 const overrides=input.printOverrides||{};
 ensure(overrides&&typeof overrides==='object'&&!Array.isArray(overrides),400,'Ugyldige printtekster.');
 const printOverrides={};
 for(const id of Object.keys(overrides).sort()){
  ensure(input.eventIds.includes(id),400,'Printtekst må kun tilføjes til et valgt arrangement.');
  const fields=overrides[id];ensure(fields&&typeof fields==='object'&&!Array.isArray(fields),400,'Ugyldige printtekster.');
  const cleaned={};
  for(const [key,limit] of [['title',100],['details',300],['association',100],['dateLabel',20],['dateNote',30]]){
   if(fields[key]===undefined)continue;
   ensure(typeof fields[key]==='string'&&fields[key].length<=limit&&!/[\u0000-\u001f\u007f]/.test(fields[key]),400,'En printtekst er for lang eller indeholder ugyldige tegn.');
   if(fields[key].trim())cleaned[key]=fields[key].trim();
  }
  ensure(!cleaned.dateNote||cleaned.dateLabel,400,'Udfyld også datofeltet, når du skriver en dato-note.');
  if(Object.keys(cleaned).length)printOverrides[id]=cleaned;
 }
 return {eventIds:[...input.eventIds].sort(),printOverrides,reviewHash:input.reviewHash};
}
export async function editionCandidates(env,auth,url){
 await requireAccess(env,auth);
 const data=await snapshot(env,editionOptions(Object.fromEntries(url.searchParams)));
 return json({...data,reviewHash:await hash(JSON.stringify(data))});
}
async function reviewedSnapshot(env,options,chosen){
 const data=await snapshot(env,options);
 ensure(await hash(JSON.stringify(data))===chosen.reviewHash,409,'Kalenderen er ændret. Hent arrangementerne igen, og gennemse en ny PDF.');
 const eligible=new Set(data.events.map(e=>e.id));
 ensure(chosen.eventIds.every(id=>eligible.has(id)),400,'Et valgt arrangement er ikke godkendt til denne periode og frist.');
 return {...data,reviewHash:chosen.reviewHash,events:data.events.filter(e=>chosen.eventIds.includes(e.id)).map(e=>({...e,...(chosen.printOverrides[e.id]?{print:chosen.printOverrides[e.id]}:{})}))};
}
const pdfResponse=(bytes,id,extra={})=>new Response(bytes,{headers:{'Content-Type':'application/pdf','Content-Disposition':`inline; filename="tistrup-kalender-${id}.pdf"`,'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff',...extra}});
async function bytesHash(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');}
async function storePdf(env,key,bytes){
 ensure(env.PDFS,503,'PDF-lagring er ikke tilsluttet. Udgaven er ikke afsluttet.');
 const existing=await env.PDFS.get(key);
 if(existing)return {bytes:new Uint8Array(await existing.arrayBuffer())};
 // Conditional creation makes the first stored bytes immutable, even if two
 // requests render the same reserved edition simultaneously.
 const stored=await env.PDFS.put(key,bytes,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/pdf'}});
 if(stored)return {bytes};
 const winner=await env.PDFS.get(key);ensure(winner,503,'PDF-filen blev ikke gemt. Prøv igen med samme nøgle.');
 return {bytes:new Uint8Array(await winner.arrayBuffer())};
}
export async function previewEdition(env,auth,url,input=null){
 await requireAccess(env,auth);
 const options=editionOptions(input||Object.fromEntries(url.searchParams));
 const data=input?await reviewedSnapshot(env,options,selection(input)):await snapshot(env,options),pdf=await makeCalendarPdf({...data,draft:true},env);
 return pdfResponse(pdf.bytes,'forhaandsvisning',{'Cache-Control':'no-store','X-Calendar-Pages':String(pdf.pages),'X-Calendar-Event-Count':String(data.events.length)});
}
export async function finalizeEdition(env,auth,input){
 const g=await requireAccess(env,auth),options=editionOptions(input);
 ensure(env.PDFS,503,'PDF-lagring er ikke tilsluttet. Udgaven er ikke afsluttet.');
 const chosen=selection(input);
 // Legacy clients had no key. New clients MUST persist and reuse requestKey.
 const requestKey=input.requestKey||('legacy-'+await hash(JSON.stringify({...options,...chosen})));
 ensure(/^[a-zA-Z0-9-]{16,100}$/.test(requestKey),400,'Genindlæs printformularen og prøv igen.');
 const requestHash=await hash(JSON.stringify({...options,...chosen}));
 let build=await stmt(env,'SELECT * FROM edition_builds WHERE request_key=?',requestKey).first();
 if(!build){
  const edition=await reviewedSnapshot(env,options,chosen);
  ensure(edition.events.length,400,'Der er ingen godkendte arrangementer inden for intervallet og fristen.');
  await stmt(env,`INSERT OR IGNORE INTO edition_builds(request_key,id,owner,request_hash,data_json,created_at) SELECT ?,?,?,?,?,? WHERE ${g.sql}`,requestKey,crypto.randomUUID(),auth.user.id,requestHash,JSON.stringify(edition),now(),...g.args).run();
  build=await stmt(env,'SELECT * FROM edition_builds WHERE request_key=?',requestKey).first();
 }
 ensure(build&&build.request_hash===requestHash,409,'Nøglen er allerede brugt til en anden printudgave.');
 const existing=await stmt(env,'SELECT * FROM editions WHERE id=?',build.id).first();
 if(existing)return json({id:existing.id,pages:existing.pages,eventCount:existing.event_count});
 const data=JSON.parse(build.data_json),pdf=await makeCalendarPdf(data,env),key='editions/'+build.id+'.pdf';
 const saved=await storePdf(env,key,pdf.bytes),digest=await bytesHash(saved.bytes);
 const result=await stmt(env,`INSERT OR IGNORE INTO editions(id,month,deadline,data_json,created_at,start,end,format,pdf_key,pdf_hash,pages,event_count,request_key,request_hash)
 SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${g.sql}`,build.id,data.month,data.deadline,build.data_json,build.created_at,data.start,data.end,data.format,key,digest,pdf.pages,data.events.length,requestKey,requestHash,...g.args).run();
 ensure(result.meta.changes===1||await stmt(env,'SELECT id FROM editions WHERE id=?',build.id).first(),403,'Din adgang er ophørt. Udgaven er ikke afsluttet.');
 return json({id:build.id,pages:pdf.pages,eventCount:data.events.length},result.meta.changes?201:200);
}
export async function listEditions(env){
 const rows=await all(stmt(env,'SELECT * FROM editions ORDER BY created_at DESC'));
 return json({editions:rows.map(row=>{
  const legacy=period(row.month),data=JSON.parse(row.data_json);
  return {id:row.id,start:row.start||legacy.start,end:row.end||legacy.end,deadline:row.deadline,format:row.format,createdAt:row.created_at,eventCount:row.event_count??data.events.length,month:row.month};
 })});
}
export async function editionPdf(env,id){
 const row=await stmt(env,'SELECT * FROM editions WHERE id=?',id).first();ensure(row,404,'Printudgaven findes ikke.');
 ensure(env.PDFS,503,'PDF-arkivet er ikke tilsluttet.');
 let pdfKey=row.pdf_key;
 if(!pdfKey){
  // The old pilot stored snapshots only. Freeze each legacy PDF once, without
  // changing its snapshot or id; subsequent downloads serve those exact bytes.
  const data=JSON.parse(row.data_json),legacy=period(row.month);
  const pdf=await makeCalendarPdf({...data,start:legacy.start,end:legacy.end,format:'poster'},env);
  pdfKey='editions/'+row.id+'.pdf';const saved=await storePdf(env,pdfKey,pdf.bytes);
  await stmt(env,'UPDATE editions SET pdf_key=?,pdf_hash=?,pages=?,event_count=? WHERE id=? AND pdf_key IS NULL',pdfKey,await bytesHash(saved.bytes),pdf.pages,data.events.length,id).run();
 }
 const object=await env.PDFS.get(pdfKey);ensure(object,503,'Den gemte PDF kunne ikke hentes.');
 return pdfResponse(object.body||await object.arrayBuffer(),row.id);
}
