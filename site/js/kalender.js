import {installEventComposer, openEventComposer} from './event-composer.js';
installEventComposer();
document.addEventListener('teb:event-saved', () => loadCalendar({quiet: true}));
import {api, getSession, randomToken, requestKey, today, dateText, showMessage, showMode, busy} from './portal-api.js';

import {calendarBounds} from './calendar-grid.js';
import {calendarBoard, upcomingCards, photo, sourceLabel} from './kalender-visning.js';
import {groupCalendarSources, withoutOwnDuplicates} from './feed-data.js';
import {loadEarlierSubmission} from './kalender-opslag.js';

// Identity, publication and revisions always come from the Worker.
const $ = selector => document.querySelector(selector);
function node(tag, attrs = {}, ...children) {
  const item = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on')) item.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'class') item.className = value;
    else if (key in item && !['form', 'list'].includes(key)) item[key] = value;
    else item.setAttribute(key, value);
  }
  for (const child of children.flat(Infinity)) if (child !== null && child !== undefined) item.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return item;
}
const button = (label, onClick, secondary = true) => node('button', {type: 'button', class: 'btn' + (secondary ? ' btn-secondary' : ''), onClick}, label);
const note = text => node('p', {class: 'fp-note'}, text);
const eventPath = id => 'kalender.html?arrangement=' + encodeURIComponent(id);
const publicURL = id => new URL(eventPath(id), location.href).href;
const privateURL = (id, token) => new URL('kalender.html?privat=' + encodeURIComponent(id) + '#adgang=' + token, location.href).href;
const loginURL = path => 'forening.html?return=' + encodeURIComponent(path) + '#login';
const query = new URLSearchParams(location.search);
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value + 'T12:00:00Z')) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
const asDate = value => new Date(value + 'T12:00:00Z');
const iso = value => value.toISOString().slice(0, 10);
function shiftDate(value, days) { const d = asDate(value); d.setUTCDate(d.getUTCDate() + days); return iso(d); }
function safeURL(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
function when(event) {
  if (!validDate(event.date)) return 'Dato mangler';
  return dateText(event.date) + (event.endDate && event.endDate !== event.date ? ' til ' + dateText(event.endDate) : '') +
    (event.time ? ' · kl. ' + event.time.replace(':', '.') : '') + (event.endTime ? ' til ' + event.endTime.replace(':', '.') : '');
}
function readableError(error) {
  return error.status ? error.message : 'Forbindelsen blev afbrudt. Prøv igen. Dine oplysninger bliver stående.';
}
function mailState(result) {
  const messages = [];
  if (result.notificationState === 'local' || result.receiptState === 'local') messages.push('Lokal afprøvning. Ingen e-mails er sendt.');
  if (result.notificationState === 'failed') messages.push('Beskeden til TEB kunne ikke sendes. Arrangementet er gemt. Kontakt TEB.');
  if (result.notificationState === 'pending') messages.push('Beskeden til TEB afventer afsendelse.');
  if (result.notificationState === 'uncertain') messages.push('Vi kan ikke bekræfte, om beskeden til TEB blev sendt. Arrangementet er gemt.');
  if (result.receiptState === 'failed') messages.push('Kvitteringsmailen kunne ikke sendes. Gem dit private link her på siden.');
  if (result.receiptState === 'pending') messages.push('Kvitteringsmailen afventer afsendelse. Gem dit private link.');
  if (result.receiptState === 'uncertain') messages.push('Vi kan ikke bekræfte, om kvitteringsmailen blev sendt. Gem dit private link her på siden.');
  if (result.receiptState === 'sent') messages.push('Kvitteringen er sendt til din e-mail.');
  return messages.join(' ');
}
function sharingChannels() {
  return node('section', {class: 'cal-channels', 'aria-label': 'Del flere steder'},
    node('h2', {}, 'Nå flere i byen'), node('p', {}, 'I kontakter selv udbyderen. Der bliver ikke bestilt eller delt noget automatisk.'),
    node('div', {class: 'fp-grid'},
      node('article', {class: 'fp-card'}, node('h3', {}, 'Flyers i postkasserne'), node('p', {}, 'Aftal flyer, pris og frist med en lokal omdeler.'), note('Kontakt til omdeling afventer TEBs aftaler.')),
      node('article', {class: 'fp-card'}, node('h3', {}, 'Byportaler og skærme'), node('p', {}, 'Spørg om plads på de analoge byportaler og lokale infoskærme.'), note('Udbydere, kontakter og priser afventer TEBs aftaler.')),
      node('article', {class: 'fp-card'}, node('h3', {}, 'Opslag i byen'), node('p', {}, 'Brug opslagstavler og aftalte pladser til plakater. Opslag på lygtepæle kræver ejerens tilladelse.'), note('Kontakter og godkendte pladser afventer TEBs aftaler.')),
      node('article', {class: 'fp-card'}, node('h3', {}, 'Lokale medier'), node('p', {}, 'Tip de lokale medier, eller del et offentligt link på jeres Facebook-side.'),
        node('a', {href: 'nyt.html'}, 'Find lokale medier'))));
}
// One detail layout for previews, published events and imported events. Empty fields are left out.
function eventCard(event, {detail = false, preview = false, heading = 'h3'} = {}) {
  const cancelled = event.state === 'cancelled', imported = Boolean(event.sourceId);
  const image = photo(event.imageUrl || event.image, 'cal-detail-image');
  const fact = (label, value) => value ? [node('dt', {}, label), node('dd', {}, value)] : null;
  const texts = [...new Set([event.body, event.description].map(text => (text || '').trim()).filter(text => text && text !== event.title))];
  const copy = node('div', {class: 'cal-detail-copy'},
    node('p', {class: 'cal-kicker' + (cancelled ? ' cal-cancelled-label' : '')}, cancelled ? 'Aflyst' : sourceLabel(event) || 'Tistrup og Hodde'),
    node(heading, {class: 'cal-detail-title'}, event.title || 'Arrangementets navn'),
    node('dl', {class: 'cal-facts'}, fact('Hvornår', when(event)), fact('Hvor', event.location || (preview ? 'Sted' : '')), fact('Arrangør', event.association || (preview ? 'Arrangør' : '')), fact('Pris', event.price)),
    texts.map(text => node('p', {class: 'cal-description'}, text)));
  const article = node('article', {class: 'cal-detail' + (image ? ' has-image' : '') + (cancelled ? ' is-cancelled' : '')}, image, copy);
  image?.addEventListener('error', () => { image.remove(); article.classList.remove('has-image'); });
  const link = safeURL(event.link);
  if (link) copy.append(node('p', {}, node('a', {href: link, target: '_blank', rel: 'noopener noreferrer'}, 'Tilmelding og mere information ↗')));
  if (imported) copy.append(node('div', {class: 'cal-detail-sources'}, (event.sources || [{name: event.sourceName, url: event.url}]).filter(source => safeURL(source.url)).map(source =>
    node('a', {href: source.url, target: '_blank', rel: 'noopener noreferrer'}, 'Læs mere hos ' + source.name + ' ↗'))));
  if (detail && !preview && event.id && !imported) {
    const message = node('div', {'aria-live': 'polite'});
    copy.append(node('div', {class: 'fp-actions cal-detail-actions'},
      button(cancelled ? 'Hent aflysning til min kalender' : 'Føj til min kalender', () => downloadICS(event), false),
      button('Del', async () => {
        try {
          if (navigator.share) await navigator.share({title: event.title, url: publicURL(event.id)});
          else { await navigator.clipboard.writeText(publicURL(event.id)); showMessage(message, 'Linket er kopieret.'); }
        } catch (error) {
          if (error.name !== 'AbortError') message.replaceChildren(note('Kopiér det offentlige link:'), node('a', {href: publicURL(event.id)}, publicURL(event.id)));
        }
      })), message);
  }
  return article;
}
function downloadICS(event) {
  const escape = text => String(text || '').replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const stamp = (date, time) => date.replaceAll('-', '') + 'T' + (time || '00:00').replace(':', '') + '00';
  const zones = ['BEGIN:VTIMEZONE', 'TZID:Europe/Copenhagen', 'BEGIN:DAYLIGHT', 'DTSTART:19700329T020000', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT', 'BEGIN:STANDARD', 'DTSTART:19701025T030000', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD', 'END:VTIMEZONE'];
  const fields = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TEB//Tistrup Kalender//DA', 'METHOD:PUBLISH', ...zones,
    'BEGIN:VEVENT', 'UID:' + escape(event.id) + '@teb-tistrup.dk', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''),
    'DTSTART;TZID=Europe/Copenhagen:' + stamp(event.date, event.time),
    ...(event.endTime ? ['DTEND;TZID=Europe/Copenhagen:' + stamp(event.endDate || event.date, event.endTime)] : event.endDate && event.endDate !== event.date ? ['DTEND;TZID=Europe/Copenhagen:' + stamp(shiftDate(event.endDate, 1), '00:00')] : []),
    'SUMMARY:' + escape(event.title), 'LOCATION:' + escape(event.location),
    'DESCRIPTION:' + escape([event.description, event.price ? 'Pris: ' + event.price : '', event.association].filter(Boolean).join('\n')),
    'URL:' + publicURL(event.id), 'STATUS:' + (event.state === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'), 'END:VEVENT', 'END:VCALENDAR'];
  // RFC 5545 lines are folded at 75 UTF-8 octets, including Danish letters.
  const encoder = new TextEncoder();
  const folded = fields.map(line => {
    let output = '', count = 0;
    for (const character of line) {
      const size = encoder.encode(character).length;
      if (count + size > 75) { output += '\r\n '; count = 1; }
      output += character; count += size;
    }
    return output;
  }).join('\r\n') + '\r\n';
  const url = URL.createObjectURL(new Blob([folded], {type: 'text/calendar;charset=utf-8'}));
  const anchor = node('a', {href: url, download: 'tistrup-arrangement.ics'}); anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

let currentDate = validDate(query.get('dato')) ? query.get('dato') : today();
let view = query.get('vis') === 'maaned' ? 'month' : 'week';
let importedEvents = [], sourceMessages = {}, upcoming = [], upcomingShown = 8;
let events = [], calendarRequest = 0, calendarLoaded = false, lastPeriod = '';
let workspaceRefresh = null;
function period() { return calendarBounds(currentDate, view); }
function periodLabel(bounds) {
  if(view==='month')return dateText(bounds.from,{day:undefined,month:'long',year:'numeric'});
  const short=day=>dateText(day,{month:'short',year:undefined});
  return bounds.from.slice(0,7)===bounds.to.slice(0,7)?Number(bounds.from.slice(-2))+'.–'+short(bounds.to):short(bounds.from)+' – '+short(bounds.to);
}
const byTime = (a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '') || a.title.localeCompare(b.title, 'da');
const handlers = {eventHref: event => event.sourceId ? event.url : eventPath(event.id), onOpen: event => event.sourceId ? openDetail(event) : publicDetails(event.id)};
const importedVisible = () => withoutOwnDuplicates([...events, ...upcoming], groupCalendarSources(importedEvents));
function renderCalendar(bounds) {
 const visible=[...events,...importedVisible()].sort(byTime);
 $('#calendar-events').replaceChildren(calendarBoard({events:visible,bounds,mode:view,onPickDay:pickDay,...handlers}));
 renderUpcoming();
}
function renderUpcoming() {
 const from=today(),to=shiftDate(from,30);
 const all=[...upcoming,...importedVisible()].filter(event=>(event.endDate||event.date)>=from&&event.date<=to).sort(byTime);
 $('#calendar-upcoming-list').replaceChildren(all.length?upcomingCards({events:all.slice(0,upcomingShown),...handlers}):note('Der er ingen arrangementer de næste 30 dage endnu.'));
 $('#calendar-upcoming-more').hidden=all.length<=upcomingShown;
}
function pickDay(day) { view = 'week'; currentDate = day; setPeriodURL(); loadCalendar(); }
async function loadSources() {
 const ids=['tistrup-nyt','pulsen'], names=['Tistrup Nyt','Pulsen i Vest'];
 const results=await Promise.allSettled(ids.map(id=>api('/kilder/'+id)));
 const next=[];
 for(let i=0;i<ids.length;i++){
  const id=ids[i], name=names[i], result=results[i];
  if(result.status==='fulfilled'){
   // Tistrup Nyt's daily roundup links to the other events and is not an event itself.
   next.push(...(result.value.events||[]).filter(e=>validDate(e.date)&&safeURL(e.url)&&!/^det sker i tistrup og hodde i dag$/i.test((e.title||'').trim())).map(e=>({...e,sourceId:id,sourceName:name})));
   sourceMessages[id]=name+(result.value.stale?': viser senest hentede arrangementer.':': opdateret.');
  }else{
   next.push(...importedEvents.filter(e=>e.sourceId===id));
   sourceMessages[id]=name+': kunne ikke opdateres. Besøg kilden eller prøv Opdatér.';
  }
 }
 importedEvents=next;
 $('#calendar-source-status').textContent=Object.values(sourceMessages).join(' ');
}
async function loadUpcoming() {
  try { upcoming = ((await api('/events?from=' + today() + '&to=' + shiftDate(today(), 45))).events || []).filter(event => validDate(event.date)); } catch { /* Highlights are optional. */ }
}
let openDialog = null;
function openDetail(event, {onClose} = {}) {
  openDialog?.close();
  const dialog = node('dialog', {class: 'cal-dialog', 'aria-labelledby': 'cal-dialog-title'});
  const close = node('button', {type: 'button', class: 'cal-dialog-close', onClick: () => dialog.close()}, 'Luk ×');
  const card = eventCard(event, {detail: true, heading: 'h2'});
  card.querySelector('.cal-detail-title').id = 'cal-dialog-title';
  dialog.append(close, card);
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { dialog.remove(); if (openDialog === dialog) openDialog = null; onClose?.(); });
  document.body.append(dialog); dialog.showModal(); openDialog = dialog;
  return dialog;
}
async function loadCalendar({quiet = false} = {}) {
  const serial = ++calendarRequest, bounds = period(), range = {from: bounds.loadFrom, to: bounds.loadTo}, key = range.from + range.to;
  const label = periodLabel(bounds); $('#calendar-period').textContent = label.charAt(0).toLocaleUpperCase('da') + label.slice(1);
  $('#calendar-month').setAttribute('aria-pressed', String(view === 'month'));
  $('#calendar-week').setAttribute('aria-pressed', String(view === 'week'));
  $('#calendar-events').setAttribute('aria-busy', 'true');
  if (!quiet && key !== lastPeriod) $('#calendar-events').replaceChildren(node('p', {}, 'Henter arrangementer…'));
  try {
    const result = await api('/events?from=' + range.from + '&to=' + range.to);
    if (serial !== calendarRequest) return;
    events = (result.events || []).filter(event => validDate(event.date)).sort(byTime);
    renderCalendar(bounds); calendarLoaded = true; lastPeriod = key;
    $('#calendar-message').replaceChildren();
    $('#calendar-updated').textContent = 'Senest hentet kl. ' + new Intl.DateTimeFormat('da-DK', {hour: '2-digit', minute: '2-digit'}).format(new Date()) + '. Kalenderen opdateres automatisk, mens siden er åben.';
  } catch (error) {
    if (serial !== calendarRequest) return;
    showMessage($('#calendar-message'), 'Kalenderen kunne ikke hentes. ' + readableError(error), true);
    if (!calendarLoaded || key !== lastPeriod) $('#calendar-events').replaceChildren();
    else $('#calendar-updated').textContent = 'Viser senest hentede oplysninger. Opdatér for at prøve igen.';
  } finally { if (serial === calendarRequest) $('#calendar-events').setAttribute('aria-busy', 'false'); }
}
function changePeriod(direction) {
  if (view === 'week') currentDate = shiftDate(currentDate, direction * 7);
  else { const d = asDate(currentDate); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + direction); currentDate = iso(d); }
  setPeriodURL(); loadCalendar();
}
function setPeriodURL() {
  const url = new URL(location.href); url.searchParams.set('dato', currentDate); url.searchParams.set('vis', view === 'week' ? 'uge' : 'maaned');
  history.replaceState(null, '', url);
}
$('#calendar-prev').addEventListener('click', () => changePeriod(-1));
$('#calendar-next').addEventListener('click', () => changePeriod(1));
$('#calendar-upcoming-more').addEventListener('click', () => { upcomingShown += 8; renderUpcoming(); });
$('#calendar-today').addEventListener('click', () => { currentDate = today(); setPeriodURL(); loadCalendar(); });
for (const mode of ['month', 'week']) $('#calendar-' + mode).addEventListener('click', () => { if (view === 'month' && mode === 'week' && currentDate.slice(0, 7) === today().slice(0, 7)) currentDate = today(); view = mode; setPeriodURL(); loadCalendar(); });
$('#calendar-refresh').addEventListener('click', async () => { await Promise.allSettled([loadCalendar(),loadSources(),loadUpcoming()]); renderCalendar(period()); });
async function loadEditions() {
  const root = $('#calendar-editions');
  try {
    const {editions} = await api('/editions');
    const label = edition => validDate(edition.start) && validDate(edition.end) ? dateText(edition.start, {year: undefined}) + ' til ' + dateText(edition.end) : /^\d{4}-\d{2}$/.test(edition.month || '') ? dateText(edition.month + '-01', {day: undefined}) : 'Printkalender';
    const pdf = edition => '/api/kalender/editions/' + encodeURIComponent(edition.id) + '/pdf';
    const [latest, ...older] = editions || [];
    if (latest) { const link = $('#calendar-print-latest'); link.href = pdf(latest); link.textContent = 'Hent ' + label(latest) + ' · PDF ↓'; }
    root.replaceChildren(...older.map(edition => node('a', {href: pdf(edition), target: '_blank', rel: 'noopener'}, label(edition) + ' · PDF ↗')));
  } catch (error) { showMessage(root, 'Printarkivet kunne ikke hentes. ' + readableError(error), true); root.append(button('Prøv igen', loadEditions)); }
}
const workspace = $('#calendar-workspace');
function openWorkspace(title, intro) {
  workspace.hidden = false;
  workspace.replaceChildren(node('div', {class: 'fp-row'}, node('h2', {tabIndex: -1, id: 'workspace-heading'}, title), node('a', {href: 'kalender.html'}, 'Tilbage til kalenderen')), intro ? node('p', {}, intro) : null);
  return workspace;
}
function retryWorkspace(title, error, retry) {
  openWorkspace(title); const message = node('div'); showMessage(message, readableError(error), true);
  workspace.append(message, button('Prøv igen', retry));
}
function privateAccessLink(id, token) {
  const url = privateURL(id, token), input = node('input', {type: 'text', readOnly: true, value: url, id: 'private-access-link', onFocus: event => event.target.select()});
  const message = node('div', {'aria-live': 'polite'});
  return node('div', {class: 'fp-panel cal-private-link'}, node('h3', {}, 'Gem dit private link'),
    node('p', {}, 'Linket giver adgang til at rette arrangementet. Del det kun med dem, der må rette.'),
    node('label', {htmlFor: input.id}, 'Dit private adgangslink'), input,
    node('div', {class: 'fp-actions'}, node('a', {class: 'btn', href: url, onClick: event => { event.preventDefault(); history.replaceState(null, '', url); privateEvent(id); }}, 'Se status og ret arrangementet'), button('Kopiér privat link', async () => {
      try { await navigator.clipboard.writeText(url); showMessage(message, 'Det private link er kopieret.'); }
      catch { input.focus(); input.select(); showMessage(message, 'Markér og kopiér linket i feltet.'); }
    })), message);
}
function statusText(wrapper) {
  if (wrapper.pendingKind === 'cancel') return 'Aflysning afventer TEBs godkendelse';
  if (wrapper.pendingKind) return wrapper.published ? 'Rettelse afventer TEBs godkendelse' : 'Afventer TEBs godkendelse';
  if (wrapper.status === 'rejected') return wrapper.published ? 'TEB har afvist ændringen' : 'TEB har afvist indsendelsen';
  if (wrapper.published?.state === 'cancelled') return 'Arrangementet er aflyst';
  return wrapper.published ? 'Godkendt og offentliggjort' : 'Ikke offentliggjort';
}

const fields = [
  ['title', 'Hvad skal der ske?', 'text', true, 100],
  ['association', 'Arrangørens navn', 'text', true, 100],
  ['date', 'Dato', 'date', true, 10], ['time', 'Klokken', 'time', true, 5],
  ['endDate', 'Slutdato', 'date', false, 10], ['endTime', 'Sluttidspunkt', 'time', false, 5],
  ['location', 'Hvor foregår det?', 'text', true, 180],
  ['description', 'Beskriv arrangementet', 'textarea', false, 1500],
  ['price', 'Pris', 'text', false, 100], ['link', 'Link til tilmelding eller mere information', 'url', false, 500]
];
function eventForm({data = {}, associations = [], selectedId = '', guest = false, email = '', creating = false, onSave, onCancel}) {
  const form = node('form', {class: 'fp-form fp-panel'}), inputs = {};
  const message = node('div', {'aria-live': 'polite'}), preview = node('aside', {class: 'cal-preview fp-panel', 'aria-label': 'Privat forhåndsvisning'});
  let associationId = selectedId, attempt = null, submitting = false;
  const startedAt = Date.now();
  if (associations.length) {
    const select = node('select', {id: 'event-membership', name: 'associationId', required: true}, node('option', {value: ''}, 'Vælg forening'), associations.map(association => node('option', {value: association.id}, association.name)));
    select.value = associations.some(association => association.id === selectedId) ? selectedId : associations.length === 1 ? associations[0].id : '';
    associationId = select.value;
    select.addEventListener('change', () => { associationId = select.value; inputs.association.value = associations.find(item => item.id === select.value)?.name || ''; updatePreview(); });
    form.append(node('div', {}, node('label', {htmlFor: select.id}, 'Forening'), select));
  }
  for (const [name, label, type, required, maxLength] of fields) {
    const input = node(type === 'textarea' ? 'textarea' : 'input', {id: 'event-' + name, name, required, maxLength, ...(type === 'textarea' ? {rows: 5} : {type}), value: data[name] || ''});
    inputs[name] = input;
    if (name === 'association' && associations.length) { input.value = associations.find(item => item.id === associationId)?.name || data.association || ''; input.readOnly = true; input.required = false; }
    if (name === 'date' && creating) input.min = today();
    if (name === 'price') input.placeholder = 'Fx gratis eller 50 kr.';
    if (name === 'link') input.placeholder = 'https://';
    const row = node('div', {class: ['date', 'time', 'endDate', 'endTime'].includes(name) ? 'cal-half-field' : ''}, node('label', {htmlFor: input.id}, label + (required ? '' : ' · valgfrit')), input);
    if (name === 'association' && associations.length) row.hidden = true;
    form.append(row);
  }
  if (guest && creating) {
    const input = node('input', {id: 'event-email', name: 'email', type: 'email', required: true, maxLength: 254, autoComplete: 'email', value: email});
    form.append(node('div', {class: 'cal-full-field'}, node('label', {htmlFor: input.id}, 'Din e-mail'), input, note('Bruges til kvittering og dit private link. Vises aldrig offentligt.')));
    const trap = node('input', {type: 'text', name: 'website', id: 'event-website', tabIndex: -1, autoComplete: 'off'});
    form.append(node('div', {class: 'cal-honeypot', 'aria-hidden': 'true'}, node('label', {htmlFor: trap.id}, 'Lad dette felt være tomt'), trap));
  }
  const printChoice=node('input',{type:'checkbox',id:'event-print',checked:data.printRequested===true});
  const sharing=node('fieldset',{class:'cal-full-field cal-sharing'},node('legend',{},'Nå flere i byen'),node('label',{htmlFor:printChoice.id},printChoice,'Med på den analoge kalender'));
  const channelChecks=[];
  for(const [key,label] of [['flyers','Flyers i postkasser'],['portals','Analoge byportaler'],['screens','Infoskærme'],['posters','Plakater i byen']]){
    const input=node('input',{type:'checkbox',id:'event-channel-'+key,value:key,checked:data.channels?.includes(key)});channelChecks.push(input);sharing.append(node('label',{htmlFor:input.id},input,label));
  }
  sharing.append(note('Ønskerne gemmes med arrangementet. Print kræver TEBs udvælgelse. Flyers, portaler, skærme og plakater aftaler I selv med udbyderen. Kontakter og link til Varde Kommunes byportal tilføjes, når TEB har dem.'));
  form.append(sharing);
  const label = creating ? guest ? 'Send til TEBs godkendelse' : 'Udgiv arrangement' : guest ? 'Send rettelsen til TEB' : 'Gem og udgiv rettelsen';
  const submit = node('button', {type: 'submit', class: 'btn'}, label);
  const abort = onCancel ? button('Fortryd', onCancel) : null;
  form.append(node('div', {class: 'cal-full-field'}, note(guest ? 'TEB skal godkende indsendelsen. En eksisterende offentlig version bliver stående, indtil TEB godkender ændringen.' : 'Arrangementet offentliggøres med det samme for den valgte forening.'), message, node('div', {class: 'fp-actions'}, submit, abort)));
  function formData() {
    const event = {...data, ...Object.fromEntries(fields.map(([key]) => [key, inputs[key].value.trim()]))};
    event.printRequested=printChoice.checked; event.channels=channelChecks.filter(input=>input.checked).map(input=>input.value);
    if (associationId) event.associationId = associationId;
    return event;
  }
  function updatePreview() {
    inputs.endDate.min = inputs.date.value;
    const event = formData();
    preview.replaceChildren(node('p', {class: 'eyebrow'}, 'Privat forhåndsvisning'), note('Sådan ser oplysningerne ud. De er ikke gemt endnu.'), eventCard(event, {preview: true}));
  }
  form.addEventListener('input', event => {
    if (event.target === inputs.association && !associations.length && event.target.value !== data.association) associationId = '';
    updatePreview();
  });
  function lock(locked) {
    for (const input of form.querySelectorAll('input, textarea, select, button')) input.disabled = locked;
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting || !form.reportValidity()) return;
    const value = formData(), endDate = value.endDate || value.date;
    if (endDate < value.date || value.endTime && endDate === value.date && value.endTime <= value.time) { showMessage(message, 'Slutningen skal ligge efter starten.', true); return; }
    if (value.link && !safeURL(value.link)) { showMessage(message, 'Brug et almindeligt http- eller https-link.', true); return; }
    if (!attempt) attempt = {event: value, associationId: associationId || undefined, ...(creating ? {requestKey: requestKey(), startedAt, website: form.elements.website?.value || ''} : {}), ...(guest && creating ? {email: form.elements.email.value.trim(), authorToken: randomToken()} : {})};
    submitting = true; lock(true); submit.textContent = 'Gemmer…';
    try { await onSave(attempt); }
    catch (error) {
      const uncertain = !error.status || error.status >= 500;
      if (!uncertain) { attempt = null; lock(false); }
      else { submit.disabled = false; if (abort) abort.disabled = false; }
      // An uncertain create retries the exact same request key and payload.
      submit.textContent = uncertain ? 'Prøv samme indsendelse igen' : label;
      showMessage(message, readableError(error) + (uncertain ? ' Prøv samme indsendelse igen for at undgå en dublet.' : ''), true);
      if (error.status === 409) message.append(button('Hent den nyeste version', () => location.reload()));
    } finally { submitting = false; }
  });
  updatePreview();
  return node('div', {class: 'fp-split cal-editor'}, form, preview);
}

async function createEvent() {
  return openEventComposer({associationId: query.get('forening') || ''});
}

async function publicDetails(id, {direct = false} = {}) {
  try {
    const {event} = await api('/events/' + encodeURIComponent(id));
    if(event.postId){try{const {post}=await api('/posts/'+encodeURIComponent(event.postId));event.body=post.body;event.image=post.image;}catch{}}
    const url = new URL(location.href); url.searchParams.set('arrangement', id);
    history.replaceState(null, '', url);
    openDetail(event, {onClose: () => { const back = new URL(location.href); back.searchParams.delete('arrangement'); history.replaceState(null, '', back); }});
    // Direct links must also work for historical events outside the visible range.
    if (direct && !query.has('dato') && validDate(event.date)) { currentDate = event.date; await loadCalendar(); }
  } catch (error) { showMessage($('#calendar-message'), 'Arrangementet kunne ikke hentes. ' + readableError(error), true); }
}
async function memberEdit(id) {
  openWorkspace('Ret arrangement', 'Henter jeres seneste oplysninger…');
  try {
    const session = await getSession();
    if (!session.authenticated) {
      openWorkspace('Log ind for at rette'); workspace.append(node('p', {}, 'Brug din verificerede foreningsadgang. Har du indsendt som gæst, skal du bruge det private link i din kvittering.'), node('a', {class: 'btn', href: loginURL('kalender.html?ret=' + encodeURIComponent(id))}, 'Gå til login')); return;
    }
    // A public event cannot supply the private revision needed for an atomic update.
    const result = await api(session.user?.isAdmin ? '/admin/events' : '/me/events');
    const wrapper = result.events.find(event => event.id === id);
    if (!wrapper) { openWorkspace('Ingen adgang til arrangementet'); workspace.append(node('p', {}, 'Arrangementet findes ikke blandt dem, du kan rette.'), node('a', {href: 'forening.html'}, 'Gå til foreningsområdet')); return; }
    const associationId = wrapper.associationId || wrapper.data.associationId || wrapper.published?.associationId || '';
    let associations = (session.memberships || []).map(membership => membership.association).filter(item => item?.id === associationId);
    // Admins may also edit an event submitted by a guest without a linked association.
    if (session.user?.isAdmin && associationId && !associations.length) associations = [(await api('/associations/' + encodeURIComponent(associationId))).association];
    openWorkspace('Ret arrangement', 'Rettelsen offentliggøres med det samme.');
    if (wrapper.pendingKind) workspace.append(node('p', {class: 'fp-notice'}, 'Der er også en ventende indsendelse. Den vises i formularen. Gemmer du her, udgiver du oplysningerne direkte.'));
    const message = node('div', {'aria-live': 'polite'});
    workspace.append(eventForm({data: wrapper.data, associations, selectedId: associationId, onSave: async attempt => {
      await api('/member/events/' + encodeURIComponent(id), {body: {event: attempt.event, associationId: attempt.associationId || associationId || undefined, action: 'update', revision: wrapper.revision}});
      await memberEdit(id); showMessage($('#member-edit-message'), 'Rettelsen er gemt og offentliggjort.'); await loadCalendar({quiet: true});
    }}));
    message.id = 'member-edit-message'; workspace.append(message);
    if (wrapper.published?.state !== 'cancelled') workspace.append(cancellation({id, wrapper, member: true, associationId, refresh: () => memberEdit(id)}));
    else workspace.append(note('Arrangementet er allerede markeret som aflyst.'));
  } catch (error) { retryWorkspace('Arrangementet kunne ikke åbnes', error, () => memberEdit(id)); }
}
function cancellation({id, wrapper, member = false, token, associationId, refresh}) {
  const panel = node('div', {class: 'fp-panel cal-cancel-panel'}), message = node('div', {'aria-live': 'polite'});
  const confirm = node('div', {hidden: true}, node('p', {}, member ? 'Vil du markere arrangementet som aflyst? Det bliver synligt med det samme.' : 'Vil du bede TEB om at aflyse arrangementet? Det forbliver offentligt, indtil TEB har godkendt.'));
  const send = button(member ? 'Ja, aflys arrangementet' : 'Ja, send aflysning til TEB', () => busy(send, async () => {
    try {
      const result = await api((member ? '/member/events/' : '/private/') + encodeURIComponent(id), {token, body: {action: 'cancel', revision: wrapper.revision, ...(associationId ? {associationId} : {})}});
      await refresh(); await loadCalendar({quiet: true});
      showMessage($('#private-action-message') || $('#member-edit-message'), (member ? 'Arrangementet er aflyst.' : 'Aflysningen er sendt til TEB.') + ' ' + mailState(result));
    } catch (error) {
      showMessage(message, readableError(error), true);
      if (error.status === 409 || !error.status || error.status >= 500) { send.hidden = true; message.append(button('Hent seneste status før du prøver igen', refresh)); }
    }
  }), false);
  confirm.append(node('div', {class: 'fp-actions'}, send, button('Fortryd', () => { confirm.hidden = true; })));
  panel.append(node('h3', {}, 'Aflysning'), button(member ? 'Aflys arrangementet' : 'Bed TEB om at aflyse arrangementet', () => { confirm.hidden = false; send.focus(); }), confirm, message);
  return panel;
}
async function privateEvent(id) {
  const token = new URLSearchParams(location.hash.slice(1)).get('adgang') || '';
  if (!/^[a-f0-9]{64}$/.test(token)) {
    openWorkspace('Det private link mangler adgang'); workspace.append(node('p', {}, 'Åbn hele linket fra din kvittering. Den sidste del efter # skal være med.'), node('a', {href: 'kontakt.html'}, 'Kontakt TEB, hvis du mangler linket')); return;
  }
  let wrapper, editing = false;
  const fetchWrapper = () => api('/private/' + encodeURIComponent(id), {token});
  async function refresh() {
    try { wrapper = await fetchWrapper(); editing = false; render(); }
    catch (error) { retryWorkspace('Det private arrangement kunne ikke hentes', error, refresh); }
  }
  function render() {
    openWorkspace('Dit private arrangement', 'Kun personer med dit private link kan se denne side.');
    workspace.append(node('p', {class: 'fp-status'}, statusText(wrapper)), node('div', {id: 'private-action-message', 'aria-live': 'polite'}));
    if (wrapper.note) workspace.append(node('p', {class: 'fp-notice'}, 'Besked fra TEB: ' + wrapper.note));
    if (mailState(wrapper)) workspace.append(note(mailState(wrapper)));
    const statusMessage = node('div', {'aria-live': 'polite'});
    workspace.append(button('Opdatér status', async () => { if (editing) { showMessage(statusMessage, 'Gem eller fortryd rettelsen, før du opdaterer status.'); return; } await refresh(); }), statusMessage);
    const editor = node('div');
    if (wrapper.pendingKind || !wrapper.published || wrapper.status === 'rejected') {
      workspace.append(node('h3', {}, wrapper.pendingKind === 'cancel' ? 'Ønsket aflysning' : 'Din indsendelse'), note('Disse oplysninger er private og afventer TEB, medmindre status ovenfor siger, at indsendelsen er afvist.'), eventCard(wrapper.data, {preview: true}));
    }
    if (wrapper.published) workspace.append(node('h3', {}, 'Det ser borgerne lige nu'), eventCard({...wrapper.published, id}, {detail: true}), node('a', {href: eventPath(id)}, 'Åbn det offentlige arrangement'));
    const edit = button('Ret oplysningerne', () => {
      editing = true; edit.hidden = true;
      editor.replaceChildren(eventForm({data: wrapper.data, guest: true, onCancel: () => { editing = false; editor.replaceChildren(); edit.hidden = false; edit.focus(); }, onSave: async attempt => {
        // Keep the retained pilot action "update"; the backend contract permits an "edit" alias.
        const result = await api('/private/' + encodeURIComponent(id), {token, body: {event: attempt.event, action: 'update', revision: wrapper.revision}});
        await refresh(); showMessage($('#private-action-message'), 'Rettelsen er sendt til TEB. ' + mailState(result)); await loadCalendar({quiet: true});
      }}));
      editor.querySelector('input')?.focus();
    });
    workspace.append(node('div', {class: 'fp-actions cal-private-actions'}, edit), editor);
    if (wrapper.published && wrapper.published.state !== 'cancelled' && wrapper.pendingKind !== 'cancel') workspace.append(cancellation({id, wrapper, token, refresh}));
    else if (!wrapper.published) workspace.append(note('Vil du trække en indsendelse tilbage, før den er offentliggjort? Kontakt TEB og oplys arrangementets navn.'), node('a', {href: 'kontakt.html'}, 'Kontakt TEB'));
    workspace.append(privateAccessLink(id, token), sharingChannels());
  }
  workspaceRefresh = async () => {
    if (editing) return;
    try {
      const next = await fetchWrapper();
      if (JSON.stringify(next) !== JSON.stringify(wrapper)) { wrapper = next; render(); }
    } catch { showMessage($('#private-action-message'), 'Status kunne ikke opdateres automatisk. Brug Opdatér status for at prøve igen.', true); }
  };
  await refresh();
}
document.addEventListener('calendar-updated',()=>loadCalendar({quiet:true}));
showMode();
try { const session=await getSession(); if(session.authenticated) $('#calendar-login').textContent=session.user?.isAdmin?'TEB · administration →':'Mit foreningsområde →'; } catch {}
const route = query.has('indsendelse') || query.has('opslag') || location.hash==='#godkendelse' ? loadEarlierSubmission() : query.has('privat') ? privateEvent(query.get('privat'))
  : query.has('ret') ? memberEdit(query.get('ret'))
  : query.get('opret') === '1' ? createEvent()
  : query.has('arrangement') ? publicDetails(query.get('arrangement'), {direct: true}) : Promise.resolve();
await Promise.allSettled([loadCalendar(), loadEditions(), route, Promise.all([loadSources(), loadUpcoming()]).then(()=>renderCalendar(period()))]);
if (!workspace.hidden) $('#workspace-heading')?.focus({preventScroll: true});

// Refresh only visible pages, and never replace a form or a focused calendar link.
let lastRefresh = Date.now();
async function periodicRefresh() {
  if (document.hidden || Date.now() - lastRefresh < 45000) return;
  lastRefresh = Date.now();
  if (!$('#calendar-events').contains(document.activeElement) && !openDialog) { await Promise.allSettled([loadCalendar({quiet:true}),loadSources(),loadUpcoming()]); renderCalendar(period()); }
  const focusedControl = workspace.contains(document.activeElement) && document.activeElement.matches('input, textarea, select, button, a, summary');
  if (workspaceRefresh && !focusedControl) await workspaceRefresh();
}
setInterval(periodicRefresh, 60000);
document.addEventListener('visibilitychange', periodicRefresh);
window.addEventListener('pageshow', event => { if (event.persisted) { lastRefresh = 0; periodicRefresh(); } });
