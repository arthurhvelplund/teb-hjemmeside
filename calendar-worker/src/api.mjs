import { HttpError, ensure, now, token, hash, escapeHtml, copenhagenDate, validateEvent, validateMonth, validDate, period, publicEvent, json } from './shared.mjs';
import { makeCalendarPdf } from './pdf.mjs';

const base = '/api/kalender';
const expires = hours => new Date(Date.now() + hours * 3600000).toISOString();
const stmt = (env, sql, ...args) => env.DB.prepare(sql).bind(...args);
const all = async statement => (await statement.all()).results;
const bearer = request => request.headers.get('Authorization')?.replace(/^Bearer /, '') || '';
const cookieToken = request => (request.headers.get('Cookie') || '').split(';').map(x=>x.trim()).find(x=>x.startsWith('teb_calendar='))?.slice(13) || '';
const local = env => env.LOCAL_PREVIEW === 'true';

async function body(request, env) {
  ensure(request.headers.get('Origin') === env.PUBLIC_ORIGIN, 403, 'Indsendelsen skal komme fra kalenderens egen hjemmeside.');
  ensure(request.headers.get('Content-Type')?.split(';')[0] === 'application/json', 415, 'Ugyldigt formularformat.');
  ensure(Number(request.headers.get('Content-Length') || 0) <= 16000, 413, 'Indsendelsen er for stor.');
  const text = await request.text();
  ensure(new TextEncoder().encode(text).length <= 16000, 413, 'Indsendelsen er for stor.');
  try { const data = JSON.parse(text); ensure(data && typeof data === 'object' && !Array.isArray(data), 400, 'Ugyldigt formularformat.'); return data; }
  catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(400, 'Ugyldigt formularformat.'); }
}

async function rate(env, key, limit, minutes = 60) {
  const stamp = now();
  await stmt(env, 'DELETE FROM rate_limits WHERE expires_at < ?', stamp).run();
  const row = await stmt(env, `INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?)
    ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count`, key, new Date(Date.now()+minutes*60000).toISOString()).first();
  ensure(row.count <= limit, 429, 'Der er sendt mange forespørgsler. Vent lidt, og prøv igen.');
}

async function admin(request, env) {
  const value = cookieToken(request);
  ensure(/^[a-f0-9]{64}$/.test(value), 401, 'Åbn redaktionen via linket i din mail.');
  const session = await stmt(env, "SELECT hash FROM tokens WHERE hash=? AND kind='session' AND expires_at>?", await hash(value), now()).first();
  ensure(session, 401, 'Din adgang er udløbet. Få et nyt link på mail.');
}

async function author(request, env, id) {
  ensure(/^[a-f0-9]{64}$/.test(bearer(request)), 404, 'Det private link er ugyldigt.');
  const row = await stmt(env, 'SELECT * FROM events WHERE id=? AND author_hash=?', id, await hash(bearer(request))).first();
  ensure(row, 404, 'Det private link er ugyldigt.');
  return row;
}

async function send(env, recipient, subject, text) {
  ensure(env.TEB_EMAIL && env.EMAIL_FROM && env.EDITOR_EMAIL, 503, 'Mail er endnu ikke tilsluttet.');
  const html=text.split('\n').map(line=>line.startsWith(env.PUBLIC_ORIGIN+'/')?`<p><a href="${escapeHtml(line)}" style="display:inline-block;padding:12px 18px;background:#243b2b;color:#fff;text-decoration:none;border-radius:5px">${line.includes('/kalender-redaktion.html')?'Åbn TEBs redaktion':line.includes('/mit-arrangement.html')?'Se dit arrangement':'Se kalenderen'}</a></p>`:escapeHtml(line)).join('<br>');
  const result = await env.TEB_EMAIL.send({ from:{email:env.EMAIL_FROM,name:'Tistrup Kalenderen'}, to:recipient, subject,
    text, html:`<html lang="da"><body><div style="font:18px/1.6 system-ui,sans-serif;max-width:620px">${html}</div></body></html>` });
  ensure(result?.messageId, 503, 'Mailtjenesten har ikke bekræftet modtagelsen.');
}

async function loginLink(env, eventId = '') {
  const value = token();
  await stmt(env, 'INSERT INTO tokens(hash,kind,expires_at) VALUES(?,?,?)', await hash(value), 'login', expires(48)).run();
  return `${env.PUBLIC_ORIGIN}/kalender-redaktion.html${eventId ? '?arrangement='+encodeURIComponent(eventId) : ''}#login=${value}`;
}

async function notifyEditor(env, id, data, kind, contactEmail) {
  try {
    const link = await loginLink(env, id);
    await send(env, env.EDITOR_EMAIL, `${kind === 'cancel' ? 'Aflysning' : kind === 'update' ? 'Rettelse' : 'Nyt arrangement'} til godkendelse: ${data.title}`, [
      'Et arrangement afventer TEBs godkendelse.', '', data.title, `${data.date} kl. ${data.time}`, data.location,
      `Oplyst forening: ${data.association}`, `Kontakt: ${contactEmail}`, '',
      'Afsenderens tilknytning til foreningen er ikke verificeret. Intet offentliggøres, før TEB godkender.', '',
      'Åbn redaktionen, gennemse arrangementet og vælg Godkend eller Afvis:', link, '',
      'Linket gælder i 48 timer. Åbning af mailen eller linket godkender ikke arrangementet.'
    ].join('\n'));
    await stmt(env, 'UPDATE events SET notification_state=? WHERE id=?', local(env)?'local':'sent', id).run();
    return local(env)?'local':'sent';
  } catch {
    await stmt(env, "UPDATE events SET notification_state='failed' WHERE id=?", id).run();
    return 'failed';
  }
}

function privateData(row) {
  return { id:row.id, data:JSON.parse(row.pending_json || row.published_json || '{}'), published:row.published_json?JSON.parse(row.published_json):null,
    email:row.contact_email, pendingKind:row.pending_kind, status:row.status, revision:row.revision, note:row.moderation_note, notificationState:row.notification_state,receiptState:row.receipt_state };
}

async function createEvent(request, env, data) {
  ensure(!data.website, 400, 'Indsendelsen kunne ikke modtages.');
  ensure(typeof data.startedAt === 'number' && Date.now()-data.startedAt>=1500 && Date.now()-data.startedAt<86400000, 400, 'Vent et øjeblik, eller genindlæs siden og prøv igen.');
  ensure(/^[a-f0-9]{64}$/.test(data.authorToken || '') && /^[a-f0-9-]{36}$/.test(data.requestKey || ''), 400, 'Genindlæs formularen og prøv igen.');
  const event = validateEvent(data.event || {});
  const email = typeof data.email === 'string' ? data.email.trim() : '';
  ensure(email.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 400, 'Skriv en gyldig e-mailadresse.');
  const authorHash = await hash(data.authorToken);
  const requestHash = await hash(JSON.stringify([event,email]));
  const existing = await stmt(env, 'SELECT * FROM events WHERE request_key=?', data.requestKey).first();
  if (existing) {
    ensure(existing.author_hash===authorHash && existing.request_hash===requestHash, 409, 'Denne indsendelse er allerede gemt med andre oplysninger. Genindlæs siden.');
    return json({id:existing.id,notificationState:existing.notification_state,receiptState:existing.receipt_state,replayed:true},200);
  }
  const ip = await hash(request.headers.get('CF-Connecting-IP') || 'local');
  await rate(env, 'submit:'+ip, 15);
  const id = crypto.randomUUID(), stamp = now();
  const inserted=await stmt(env, `INSERT OR IGNORE INTO events(id,request_key,request_hash,author_hash,contact_email,pending_json,pending_kind,created_at,updated_at)
    VALUES(?,?,?,?,?,?,'new',?,?)`, id,data.requestKey,requestHash,authorHash,email,JSON.stringify(event),stamp,stamp).run();
  if(inserted.meta.changes!==1){
    const saved=await stmt(env,'SELECT id,author_hash,request_hash,notification_state,receipt_state FROM events WHERE request_key=?',data.requestKey).first();
    ensure(saved&&saved.author_hash===authorHash&&saved.request_hash===requestHash,409,'Indsendelsen er allerede gemt med andre oplysninger.');
    return json({id:saved.id,notificationState:saved.notification_state,receiptState:saved.receipt_state,replayed:true});
  }
  const notificationState = await notifyEditor(env,id,event,'new',email);
  let receiptState = 'failed';
  try {
    await send(env,email,`Modtaget til godkendelse: ${event.title}`,
      `Tak for dit arrangement. Det afventer TEBs godkendelse og er endnu ikke offentligt.\n\nSe en forhåndsvisning, ret oplysningerne eller bed om en aflysning via dit private link:\n${env.PUBLIC_ORIGIN}/mit-arrangement.html?id=${id}#adgang=${data.authorToken}\n\nGem linket og del det kun med dem, der må rette arrangementet. Din kontaktmail vises ikke i kalenderen.`);
    receiptState = local(env)?'local':'sent';
  } catch { /* The on-screen private link remains available even if the receipt cannot be sent. */ }
  await stmt(env,'UPDATE events SET receipt_state=? WHERE id=?',receiptState,id).run();
  return json({id,notificationState,receiptState},201);
}

async function updateEvent(request, env, id, data) {
  const row = await author(request,env,id);
  ensure(data.revision === row.revision,409,'Arrangementet er ændret siden sidst. Genindlæs siden, før du sender igen.');
  ensure(['update','cancel'].includes(data.action),400,'Vælg rettelse eller aflysning.');
  ensure(data.action!=='cancel' || row.published_json,400,'Arrangementet er endnu ikke offentligt. Ret indsendelsen eller kontakt TEB.');
  const event = data.action==='cancel' ? JSON.parse(row.published_json) : validateEvent(data.event || {});
  const kind = data.action==='cancel'?'cancel':row.published_json?'update':'new';
  await rate(env,'edit:'+id,10);
  const result = await stmt(env, `UPDATE events SET pending_json=?,pending_kind=?,revision=revision+1,moderation_note='',notification_state='pending',updated_at=?,status=CASE WHEN published_json IS NULL THEN 'pending' ELSE status END WHERE id=? AND revision=?`,
    JSON.stringify(event),kind,now(),id,data.revision).run();
  ensure(result.meta.changes===1,409,'Arrangementet er ændret. Genindlæs siden.');
  const notificationState = await notifyEditor(env,id,event,kind,row.contact_email);
  return json({saved:true,notificationState,revision:row.revision+1});
}

async function review(request, env, id, data) {
  await admin(request,env);
  const row = await stmt(env,'SELECT * FROM events WHERE id=?',id).first();
  ensure(row,404,'Arrangementet findes ikke.');
  ensure(row.pending_kind && data.revision===row.revision,409,'Arrangementet er allerede behandlet eller ændret. Genindlæs listen.');
  ensure(['approve','reject'].includes(data.action),400,'Vælg Godkend eller Afvis.');
  const note = typeof data.note==='string'?data.note.trim():'';
  ensure(note.length<=500,400,'Beskeden må højst være 500 tegn.');
  ensure(data.action!=='reject' || note,400,'Skriv en kort begrundelse til afsenderen.');
  let published = row.published_json, status = row.status;
  const revision = row.revision+1, stamp = now();
  if (data.action==='approve') {
    const event = row.pending_kind==='cancel' ? JSON.parse(row.published_json) : validateEvent(data.event || JSON.parse(row.pending_json));
    event.state = row.pending_kind==='cancel'?'cancelled':'approved';
    published=JSON.stringify(event); status=event.state;
  } else if (!published) status='rejected';
  const operations = [stmt(env, `UPDATE events SET published_json=?,pending_json=NULL,pending_kind=NULL,status=?,moderation_note=?,revision=?,updated_at=? WHERE id=? AND revision=?`,
    published,status,note,revision,stamp,id,row.revision)];
  // Record publication only if this exact pending revision was consumed. D1 batch is atomic.
  if (data.action==='approve') operations.push(stmt(env, `INSERT INTO publications(event_id,revision,data_json,published_at)
    SELECT id,revision,published_json,? FROM events WHERE id=? AND revision=? AND pending_kind IS NULL AND changes()=1`,stamp,id,revision));
  const results = await env.DB.batch(operations);
  ensure(results[0].meta.changes===1,409,'En anden redaktør har allerede behandlet arrangementet.');
  try {
    const event=JSON.parse(row.pending_json);
    await send(env,row.contact_email,`${data.action==='reject'?'Svar fra TEB':row.pending_kind==='cancel'?'Aflysning godkendt':'Arrangement godkendt'}: ${event.title}`,
      `${data.action==='reject'?'TEB har ikke godkendt indsendelsen.':row.pending_kind==='cancel'?'TEB har godkendt aflysningen. Kalenderen viser nu arrangementet som aflyst.':'TEB har godkendt arrangementet. Du kan se det her:\n'+env.PUBLIC_ORIGIN+'/kalender.html?arrangement='+id}${note?'\n\nBesked fra TEB: '+note:''}\n\nEn eventuel allerede trykt kalender kan ikke ændres.`);
  } catch { /* Approval is durable even if the receipt service is unavailable. */ }
  return json({saved:true,status});
}

async function snapshot(env, month, deadline) {
  const range = period(month);
  const rows = await all(stmt(env,'SELECT event_id,data_json,published_at FROM publications ORDER BY id ASC'));
  const latest = new Map();
  for (const row of rows) if (copenhagenDate(row.published_at)<=deadline) latest.set(row.event_id,{id:row.event_id,...JSON.parse(row.data_json)});
  return { month, deadline, calendarUrl:env.PUBLIC_ORIGIN+'/kalender.html', events:[...latest.values()].filter(e=>e.state==='approved' && e.date<=range.end && (e.endDate||e.date)>=range.start).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)||a.title.localeCompare(b.title,'da')) };
}

async function api(request, env) {
  const url = new URL(request.url), route=url.pathname.slice(base.length), method=request.method;
  if (route==='/config' && method==='GET') return json({mode:local(env)?'local':'live',submissionsEnabled:Boolean(env.DB&&env.TEB_EMAIL&&env.EDITOR_EMAIL&&env.EMAIL_FROM&&env.PUBLIC_ORIGIN),editorEmail:env.EDITOR_EMAIL||'tistrup.kalender@gmail.com'});
  ensure(env.DB && env.PUBLIC_ORIGIN,503,'Kalenderens database er endnu ikke tilsluttet.');
  let data;
  if (method==='POST') data=await body(request,env);
  ensure(['GET','POST'].includes(method),405,'Denne handling er ikke tilladt.');
  if (route==='/events' && method==='POST') {
    ensure(env.TEB_EMAIL&&env.EDITOR_EMAIL&&env.EMAIL_FROM,503,'Indsendelse er endnu ikke åbnet. Brug kalenderens mailadresse.');
    return createEvent(request,env,data);
  }
  if (route==='/events' && method==='GET') {
    const rows=await all(stmt(env,'SELECT id,published_json FROM events WHERE published_json IS NOT NULL'));
    return json({events:rows.map(publicEvent).filter(e=>(e.endDate||e.date)>=copenhagenDate()).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)||a.title.localeCompare(b.title,'da'))});
  }
  const privateMatch=route.match(/^\/private\/([a-f0-9-]{36})$/);
  if(privateMatch) {
    if(method==='GET') return json(privateData(await author(request,env,privateMatch[1])));
    return updateEvent(request,env,privateMatch[1],data);
  }
  if(route==='/admin/login' && method==='POST') {
    await rate(env,'login:'+await hash(request.headers.get('CF-Connecting-IP')||'local'),3);
    await rate(env,'login-global',12);
    await send(env,env.EDITOR_EMAIL,'Din adgang til Tistrup Kalenderens redaktion',`Åbn redaktionen med dette link:\n${await loginLink(env)}\n\nLinket kan bruges én gang og gælder i 48 timer. Del det ikke med andre.`);
    return json({sent:true,mode:local(env)?'local':'live'});
  }
  if(route==='/admin/session' && method==='POST') {
    ensure(/^[a-f0-9]{64}$/.test(data.token||''),401,'Adgangslinket er ugyldigt.');
    const login=await stmt(env,"DELETE FROM tokens WHERE hash=? AND kind='login' AND expires_at>? RETURNING hash",await hash(data.token),now()).first();
    ensure(login,401,'Linket er brugt eller udløbet. Få et nyt link på mail.');
    const value=token();
    await stmt(env,'INSERT INTO tokens(hash,kind,expires_at) VALUES(?,?,?)',await hash(value),'session',expires(8)).run();
    return json({authenticated:true},200,{'Set-Cookie':`teb_calendar=${value}; HttpOnly; SameSite=Strict; Path=/api/kalender/; Max-Age=28800${env.PUBLIC_ORIGIN.startsWith('https:')?'; Secure':''}`});
  }
  if(route==='/admin/logout' && method==='POST') {
    await stmt(env,'DELETE FROM tokens WHERE hash=?',await hash(cookieToken(request))).run();
    return json({saved:true},200,{'Set-Cookie':'teb_calendar=; HttpOnly; SameSite=Strict; Path=/api/kalender/; Max-Age=0'});
  }
  if(route==='/admin/events' && method==='GET') {
    await admin(request,env);
    const rows=await all(stmt(env,'SELECT * FROM events ORDER BY CASE WHEN pending_kind IS NOT NULL THEN 0 ELSE 1 END, updated_at DESC'));
    const events=rows.map(row=>({...privateData(row),createdAt:row.created_at,updatedAt:row.updated_at}));
    for(const event of events) event.possibleDuplicates=events.filter(other=>other.id!==event.id && other.data.date===event.data.date && (other.data.title.toLocaleLowerCase('da')===event.data.title.toLocaleLowerCase('da') || other.data.association.toLocaleLowerCase('da')===event.data.association.toLocaleLowerCase('da'))).map(other=>({id:other.id,title:other.data.title}));
    return json({events});
  }
  const reviewMatch=route.match(/^\/admin\/events\/([a-f0-9-]{36})$/);
  if(reviewMatch && method==='POST') return review(request,env,reviewMatch[1],data);
  if(route==='/admin/editions/preview' && method==='GET') {
    await admin(request,env);
    const month=validateMonth(url.searchParams.get('month')||'');
    const deadline=url.searchParams.get('deadline')||copenhagenDate();
    ensure(validDate(deadline),400,'Vælg en gyldig printfrist.');
    const data=await snapshot(env,month,deadline<copenhagenDate()?deadline:copenhagenDate());
    const pdf=await makeCalendarPdf({...data,draft:true},env);
    return new Response(pdf.bytes,{headers:{'Content-Type':'application/pdf','Content-Disposition':`inline; filename="kalender-${month}-forhaandsvisning.pdf"`,'Cache-Control':'no-store','X-Calendar-Pages':String(pdf.pages)}});
  }
  if(route==='/admin/editions' && method==='POST') {
    await admin(request,env);
    const month=validateMonth(data.month||'');
    ensure(validDate(data.deadline||'') && data.deadline<period(month).start && data.deadline<=copenhagenDate(),400,'Printfristen må ikke ligge i fremtiden og skal ligge før udgavens første måned.');
    const edition=await snapshot(env,month,data.deadline);
    ensure(edition.events.length,400,'Der er ingen godkendte arrangementer inden for udgaven og fristen.');
    // Validate that the frozen content really can be typeset before making it public.
    const pdf=await makeCalendarPdf(edition,env);
    const id=crypto.randomUUID();
    await stmt(env,'INSERT INTO editions(id,month,deadline,data_json,created_at) VALUES(?,?,?,?,?)',id,month,data.deadline,JSON.stringify(edition),now()).run();
    return json({id,pages:pdf.pages,eventCount:edition.events.length},201);
  }
  if(route==='/editions' && method==='GET') return json({editions:await all(stmt(env,'SELECT id,month,deadline,created_at FROM editions ORDER BY created_at DESC'))});
  const editionMatch=route.match(/^\/editions\/([a-f0-9-]{36})\/pdf$/);
  if(editionMatch && method==='GET') {
    const edition=await stmt(env,'SELECT data_json,month FROM editions WHERE id=?',editionMatch[1]).first();
    ensure(edition,404,'Printudgaven findes ikke.');
    const pdf=await makeCalendarPdf(JSON.parse(edition.data_json),env);
    return new Response(pdf.bytes,{headers:{'Content-Type':'application/pdf','Content-Disposition':`inline; filename="tistrup-kalender-${edition.month}.pdf"`,'Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'}});
  }
  if(route==='/local-mail' && method==='GET' && local(env)) {
    ensure(['localhost','127.0.0.1','[::1]'].includes(url.hostname),404,'Siden findes ikke.');
    return json({messages:await all(stmt(env,'SELECT * FROM local_mail ORDER BY id DESC LIMIT 50'))});
  }
  throw new HttpError(404,'Siden findes ikke.');
}

export async function handleApi(request, env) {
  try { return await api(request,env); }
  catch(error) {
    if(error instanceof HttpError) return json({error:error.message},error.status);
    console.error('Calendar request failed:',error?.name||'Error');
    return json({error:'Der opstod en fejl. Genindlæs siden, før du prøver igen.'},500);
  }
}
