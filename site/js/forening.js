import {installEventComposer} from './event-composer.js';
installEventComposer();
document.addEventListener('teb:event-saved', () => { if (currentRoute?.page === 'min-forening') render(); });
import {printEditorHtml,mountPrintEditor} from './kalender-print.js';
import {newsImage} from './association-news.js';
import { api, getSession, escapeHTML as esc, requestKey, today, dateText, showMessage, showMode, busy } from './portal-api.js';

const content = document.querySelector('#forening-content');
const nav = document.querySelector('#forening-nav');
const notice = document.querySelector('#forening-message');
let session = null;
let challenge = null;
let loginEmail = '';
let loginPending = false;
let loginMethod = 'email';
const loginCooldowns = new Map();
function saveLoginChallenge() {
  try {
    if (challenge) sessionStorage.setItem('teb-login-challenge', JSON.stringify(challenge));
    else sessionStorage.removeItem('teb-login-challenge');
  } catch { /* Login also works when browser storage is unavailable. */ }
}
try {
  const saved = JSON.parse(sessionStorage.getItem('teb-login-challenge') || 'null');
  if (saved && typeof saved.id === 'string' && typeof saved.email === 'string' && saved.expiresAt > Date.now()) {
    challenge = saved;
    loginEmail = saved.email;
    loginCooldowns.set(saved.email, saved.retryAt || 0);
  }
} catch { /* No saved challenge. */ }
function updateLoginCooldown() {
  for (const form of content.querySelectorAll('form[data-action="request-code"],form[data-action="resend-code"]')) {
    const email = (form.elements.email?.value || challenge?.email || '').trim().toLowerCase();
    const seconds = Math.max(0, Math.ceil(((loginCooldowns.get(email) || 0) - Date.now()) / 1000));
    const submit = form.querySelector('button[type="submit"]');
    if (submit) {
      submit.disabled = loginPending || seconds > 0;
      submit.textContent = seconds ? `Send en ny kode om ${seconds} sek.` : form.dataset.action === 'resend-code' ? 'Send en ny kode' : 'Send kode';
    }
  }
}
setInterval(updateLoginCooldown, 1000);
let directory = [];
let directoryView = 'cards';
try { if (localStorage.getItem('teb-association-view') === 'list') directoryView = 'list'; } catch { /* Browsing without storage still supports both views. */ }
const associationFallback = 'images/forening-faellesskab.webp';
let renderNumber = 0;
let currentRoute;
let localMode = false;
let directoryDraft = null;
const draftMeta = a => directoryDraft?.associations.find(row => row.name === a.name);
let flash = '';
let disposePrintEditor = null;
const associationRequests = new Map();
const eventSnapshots = new Map();
const profileFields = ['name', 'category', 'description', 'chair', 'email', 'phone', 'website', 'place', 'imageUrl'];
const eventFields = ['title', 'association', 'associationId', 'date', 'time', 'endDate', 'endTime', 'location', 'description', 'price', 'link', 'state'];
const idPath = id => encodeURIComponent(id);
const authenticated = () => session?.authenticated === true;
const admin = () => authenticated() && session.user?.isAdmin === true;
const memberships = () => session?.memberships || [];
const workURL = (id, tab = '') => '#min-forening?' + new URLSearchParams({ forening: id, ...(tab ? { fane: tab } : {}) });
const adminURL = (tab = 'afventer', id = '') => '#teb?' + new URLSearchParams({ fane: tab, ...(id ? { forening: id } : {}) });
const publicURL = id => 'forening.html?' + new URLSearchParams({ id });
const calendarURL = (key, id) => 'kalender.html?' + new URLSearchParams({ [key]: id });
const link = (text, href, button = false) => `<a${button ? ' class="btn btn-secondary"' : ''} href="${esc(href)}">${esc(text)}</a>`;
const empty = text => `<p class="fp-empty">${esc(text)}</p>`;
const statusNames = { pending: 'Afventer TEB', approved: 'Godkendt', published: 'Udgivet', rejected: 'Afvist', withdrawn: 'Fjernet', cancelled: 'Aflyst', active: 'Aktiv', invited: 'Inviteret', new: 'Nyt arrangement', edit: 'Rettelse', cancel: 'Aflysning' };
const status = value => `<span class="fp-status">${esc(statusNames[value] || 'Ukendt status')}</span>`;
const resultBox = () => '<div class="fa-form-result" aria-live="polite"></div>';
const formStart = (action, attrs = '') => `<form class="fp-form" data-action="${action}" ${attrs}>`;
const input = (name, label, value = '', type = 'text', extra = '') => `<label>${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
const textarea = (name, label, value = '', extra = '') => `<label>${esc(label)}<textarea name="${name}" ${extra}>${esc(value)}</textarea></label>`;
const button = (text, value = '', extra = '') => `<button type="submit" class="btn"${value ? ` value="${value}"` : ''} ${extra}>${esc(text)}</button>`;
const check = (name, text, required = false) => `<label class="fa-check"><input type="checkbox" name="${name}"${required ? ' required' : ''}>${esc(text)}</label>`;
function dateLabel(value) { try { return dateText(value); } catch { return 'Dato mangler'; } }
function errorText(error) {
  if (error.status === 401) return 'Dit login er udløbet. Log ind igen, og prøv derefter igen.';
  if (error.status === 403) return 'Du har ikke adgang til denne handling. Kontakt TEB.';
  if (error.status === 409) return 'Oplysningerne er ændret siden sidst. Hent siden igen, før du gemmer.';
  if (error.name === 'TimeoutError' || error.name === 'AbortError' || error instanceof TypeError) return 'Der er ikke forbindelse til serveren. Prøv igen. Ved afsendelse kan oplysningerne allerede være gemt.';
  return error.message || 'Oplysningerne kunne ikke hentes. Prøv igen.';
}
function route() {
  const query = new URLSearchParams(location.search);
  const [hash, params = ''] = location.hash.slice(1).split('?');
  // Gamle bogmærker til arbejdsrum og adgang åbner nu Min forening.
  const name = ['arbejdsrum', 'adgang'].includes(hash) ? 'min-forening' : hash;
  return { page: name || query.get('side') || (query.has('id') || query.has('forening') ? 'profil' : 'oversigt'), params: new URLSearchParams(params), query };
}
// Only explicitly allowed local portal pages can receive a user after login.
function returnTarget() {
  const raw = new URLSearchParams(location.search).get('return');
  if (!raw || !/^(?:kalender|forening|nyt|nyt-eksperiment)\.html(?:[?#]|$)/.test(raw) || /[\\\u0000-\u001f]/.test(raw)) return null;
  const target = new URL(raw, location.href);
  const expected = new URL(raw.split(/[?#]/)[0], location.href);
  if (target.origin !== location.origin || target.pathname !== expected.pathname) return null;
  if (target.pathname.endsWith('/forening.html') && (target.hash.startsWith('#login') || target.searchParams.get('side') === 'login' || target.searchParams.has('return'))) return null;
  return target.href;
}
function heading(title, text = '') { return `<h2>${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ''}`; }
function loginNeeded() {
  return loginPage();
}
function navigation(page) {
  const account = ['login', 'min-forening', 'teb'].includes(page);
  const loginScreen = account && !authenticated();
  document.body.classList.toggle('fa-account-screen', account);
  document.querySelector('#forening-main').classList.toggle('fa-auth-page', loginScreen);
  document.querySelector('#forening-main').classList.toggle('fa-private-page', account && authenticated());
  document.querySelector('#forening-main').classList.toggle('fa-directory', page === 'oversigt');
  document.querySelector('.fa-heading h1').textContent = 'Foreninger og institutioner';
  document.querySelector('#forening-main').classList.toggle('fa-compact-page', page !== 'oversigt');
  document.querySelector('#forening-main').classList.toggle('fa-profile-page', page === 'profil');
  // Kun TEB har en fanebjælke. En forening har alt samlet på Min forening.
  nav.hidden = page !== 'teb' || !admin();
  const tebOnly = admin() && !memberships().length;
  const workspaceLink = document.querySelector('#forening-workspace-link');
  workspaceLink.textContent = authenticated() ? tebOnly ? 'TEB' : 'Min forening' : 'Log ind';
  workspaceLink.href = authenticated() ? tebOnly ? '#teb' : '#min-forening' : '#login';
  const links = [['oversigt', 'Alle foreninger', 'forening.html']];
  if (memberships().length) links.push(['min-forening', 'Min forening', '#min-forening']);
  links.push(['teb', 'TEB', '#teb']);
  nav.innerHTML = links.map(([key, label, href]) => `<a href="${href}"${page === key ? ' aria-current="page"' : ''}>${label}</a>`).join('') +
    (authenticated() ? `<form data-action="logout"><button type="submit" class="btn btn-secondary">Log ud</button></form>` : '<a href="#login"' + (page === 'login' ? ' aria-current="page"' : '') + '>Log ind</a>');
}
async function render() {
  disposePrintEditor?.(); disposePrintEditor = null;
  const sequence = ++renderNumber;
  const r = route();
  currentRoute = r;
  navigation(r.page);
  content.setAttribute('aria-busy', 'true');
  content.innerHTML = '<p role="status">Henter oplysninger…</p>';
  notice.replaceChildren();
  try {
    let html;
    if (!session) session = await getSession();
    if (sequence !== renderNumber) return;
    navigation(r.page);
    switch (r.page) {
      case 'oversigt': html = await directoryPage(); break;
      case 'profil': html = await publicProfile(r.query.get('id') || r.params.get('id') || r.query.get('forening')); break;
      case 'login': html = loginPage(); break;
      case 'min-forening':
        if (admin() && !memberships().length) { location.replace('#teb'); return; }
        html = authenticated() ? await workspace(r) : loginNeeded(); break;
      case 'teb': html = admin() ? await adminPage(r) : authenticated() ? heading('Kun for TEB', 'Dit login giver ikke adgang til TEBs administration.') : loginNeeded(); break;
      default: html = heading('Siden findes ikke') + link('Se alle foreninger', 'forening.html');
    }
    if (sequence !== renderNumber) return;
    content.innerHTML = html;
    updateLoginCooldown();
    const printRoot = content.querySelector('[data-print-editor]');
    if (printRoot) disposePrintEditor = mountPrintEditor(printRoot);
    if (r.page === 'oversigt') filterDirectory();
    if (flash) { showMessage(notice, flash); flash = ''; }
  } catch (error) {
    if (sequence !== renderNumber) return;
    content.innerHTML = empty('Siden kunne ikke indlæses.') + '<div class="fp-actions"><button class="btn btn-secondary" type="button" data-reload>Prøv igen</button>' + link('Log ind', '#login') + '</div>';
    showMessage(notice, errorText(error), true);
  } finally {
    if (sequence === renderNumber) content.setAttribute('aria-busy', 'false');
  }
}
async function directoryPage() {
  // OK-Klubben was removed from the public directory at TEB's request on 23 October 2026.
  directory = (await api('/associations')).associations
    .filter(a => a.name !== 'OK-Klubben Tistrup')
    .sort((a, b) => a.name.localeCompare(b.name, 'da'));
  // Keep the original fictional seed in the database and workspaces, outside the real directory draft.
  if (directory.some(draftMeta)) directory = directory.filter(a => a.name !== 'Eksempelforeningen Solsiden');
  return `<aside class="fa-get-started" aria-labelledby="association-guide-title"><div><h2 id="association-guide-title">Ny forening, klub eller institution?</h2><p>Kom godt i gang med jeres profil og byens kalender. Guiden viser, hvordan I får adgang gennem TEB.</p></div><div class="fa-get-started-actions"><a class="btn btn-secondary" href="downloads/brugerguide-foreninger.pdf" target="_blank" rel="noopener">Åbn brugerguiden (PDF)<span class="fa-visually-hidden"> – åbner i en ny fane</span></a><a href="kontakt.html#form">Kontakt TEB om oprettelse →</a></div></aside>
  <section aria-label="Find en forening">
    <div class="fa-directory-tools">
      <label class="fa-directory-search"><span class="fa-visually-hidden">Søg efter en forening</span><span class="fa-search-icon" aria-hidden="true">⌕</span><input id="association-search" type="search" placeholder="Søg efter forening..." autocomplete="off"></label>
      <div class="fa-view-switch" role="group" aria-label="Vis foreninger som"><button type="button" data-directory-view="cards" aria-controls="association-results" aria-pressed="${directoryView === 'cards'}">Billede</button><button type="button" data-directory-view="list" aria-controls="association-results" aria-pressed="${directoryView === 'list'}">Liste</button></div>
    </div>
    <div class="fa-directory-meta"><p id="association-count" aria-live="polite"></p>${directory.some(draftMeta) ? '<span class="fa-directory-draft" title="Foreningerne har endnu ikke bekræftet oplysningerne.">Foreløbig oversigt</span>' : ''}</div>
    <div id="association-results" class="fa-associations" data-view="${directoryView}"></div>
  </section>`;
}
function associationImage(value) {
  if (!value || /[\\\u0000-\u0020]/.test(value)) return null;
  if (value.startsWith('/images/') && !value.includes('..') && !/[?#]/.test(value)) return value;
  if (/^\/api\/kalender\/association-images\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(value)) return value;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}
function associationPhoto(a, className = '', compact = false) {
  const image = associationImage(a.imageUrl);
  const draft = draftMeta(a);
  if (!image && (draft || compact)) {
    const initials = a.name.split(/[\s·-]+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('');
    return `<figure class="fa-association-photo fa-photo-missing ${className}" aria-label="Billede mangler for ${esc(a.name)}"><span aria-hidden="true">${esc(initials)}</span><figcaption>Billede mangler</figcaption></figure>`;
  }
  const fit = draft && image === draft.imageUrl && ['logo', 'poster'].includes(draft.imageKind) ? ' fa-photo-contain' : '';
  return `<figure class="fa-association-photo ${className}${fit}"><img src="${esc(image || associationFallback)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-association-image>${image ? '' : '<figcaption>Glimt fra byen</figcaption>'}</figure>`;
}
function filterDirectory() {
  const results = document.querySelector('#association-results');
  if (!results) return;
  const search = document.querySelector('#association-search').value.trim().toLocaleLowerCase('da');
  const filtered = directory.filter(a => [a.name, a.description, a.category, a.place].join(' ').toLocaleLowerCase('da').includes(search));
  document.querySelector('#association-count').textContent = `${filtered.length} ${filtered.length === 1 ? 'forening' : 'foreninger'}`;
  results.dataset.view = directoryView;
  results.innerHTML = filtered.map(a => `<article class="fa-association"><a class="fa-association-link" href="${esc(publicURL(a.id))}" aria-labelledby="association-name-${esc(a.id)}">${associationPhoto(a, '', true)}<div class="fa-association-copy"><h2 id="association-name-${esc(a.id)}">${esc(a.name)}</h2>${a.category ? `<p class="fa-association-category">${esc(a.category)}</p>` : ''}<span class="fa-association-action" aria-hidden="true"><span>Se forening</span><span>→</span></span></div></a></article>`).join('') || empty(directory.length ? 'Ingen foreninger passer til søgningen.' : 'Der er ingen foreninger i oversigten endnu.');
}
function safeWebsite(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
async function publicProfile(id) {
  if (!id) return heading('Vælg en forening') + link('Se alle foreninger', 'forening.html');
  const [{association:a},{events}]=await Promise.all([api('/associations/'+idPath(id)),api('/events?from=2000-01-01')]);
  const website=safeWebsite(a.website),draft=draftMeta(a),own=admin()||memberships().some(m=>m.associationId===id);
  const email=a.email?'mailto:'+encodeURIComponent(a.email):'',phone=a.phone?'tel:'+a.phone.replace(/[^+\d]/g,''):'';
  const contact=email||phone||website,ownEvents=events.filter(e=>e.associationId===id).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
  const upcoming=ownEvents.filter(e=>(e.endDate||e.date)>=today()),past=ownEvents.filter(e=>(e.endDate||e.date)<today()).reverse();
  const details=[['Kontaktperson',esc(a.chair)],['E-mail',email?'<a href="'+esc(email)+'">'+esc(a.email)+'</a>':''],['Telefon',phone?'<a href="'+esc(phone)+'">'+esc(a.phone)+'</a>':''],['Mødested',esc(a.place)]];
  const controls=own?link('Ret jeres side',memberships().some(m=>m.associationId===id)?workURL(id,'profil'):adminURL('foreninger',id),true):'';
  return '<div class="fa-profile-back">'+link('← Alle foreninger','forening.html')+controls+'</div>'+
    '<header class="fa-public-identity">'+associationPhoto(a,'fa-profile-mark',true)+'<div><h1>'+esc(a.name)+'</h1><p class="fp-note">'+esc([a.category,a.place].filter(Boolean).join(' · '))+'</p></div></header>'+
    '<p class="fa-public-intro">'+esc(a.description||'Kontakt foreningen for at høre mere om fællesskabet.')+'</p>'+
    '<div class="fp-actions fa-public-actions">'+(contact?'<a class="btn" href="'+esc(contact)+'"'+(!email&&!phone?' target="_blank" rel="noopener noreferrer"':'')+'>'+(email||phone?'Kontakt foreningen':'Besøg hjemmesiden')+'</a>':link('Spørg TEB om kontakt','kontakt.html#form',true))+
    (website&&(email||phone)?'<a class="btn btn-secondary" href="'+esc(website)+'" target="_blank" rel="noopener noreferrer">Besøg hjemmeside ↗</a>':'')+'</div>'+
    '<div class="fa-public-columns"><div><section aria-labelledby="association-events-heading"><h2 id="association-events-heading">Kommende arrangementer</h2>'+publicEvents(upcoming)+(past.length?'<details class="fa-past-events"><summary>Tidligere arrangementer ('+past.length+')</summary>'+publicEvents(past)+'</details>':'')+'</section>'+
    (draft?'<p class="fp-note fa-source">Profiludkast · Oplysningerne afventer foreningens bekræftelse. Kilde: <a href="'+esc(draft.sourceUrl)+'" target="_blank" rel="noopener noreferrer">'+esc(new URL(draft.sourceUrl).hostname.replace(/^www\./,''))+'</a>.'+(draft.imageCredit&&a.imageUrl===draft.imageUrl?' Billede/logo: '+esc(draft.imageCredit)+'.':'')+'</p>':'')+'</div>'+
    '<aside class="fa-public-contact"><h2>Tag kontakt</h2><dl class="fa-details">'+(details.filter(([,v])=>v).map(([k,v])=>'<dt>'+k+'</dt><dd>'+v+'</dd>').join('')||'<dd>Kontaktoplysninger er ikke tilføjet endnu.</dd>')+'</dl></aside></div>';
}
function publicEvents(events) {
  if (!events.length) return empty('Ingen kommende arrangementer.');
  return '<div class="fa-event-list">'+events.map(e => {
    const image = /^\/api\/kalender\/event-images\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(e.imageUrl || '') ? e.imageUrl : '';
    return `<article class="fa-event-card">${image ? `<a class="fa-event-image" href="${esc(calendarURL('arrangement',e.id))}" aria-label="${esc(e.title)}"><img src="${esc(image)}" alt="" loading="lazy" decoding="async"></a>` : ''}<div class="fa-event-copy"><p class="fa-event-date">${esc(dateLabel(e.date))}${e.endDate && e.endDate !== e.date ? ' – '+esc(dateLabel(e.endDate)) : ''} kl. ${esc(e.time)}</p><h3>${link(e.title, calendarURL('arrangement', e.id))}</h3><p>${esc(e.location)}</p>${e.description ? `<p class="fa-event-description">${esc(e.description)}</p>` : ''}${e.state === 'cancelled' ? status('cancelled') : ''}${link('Se arrangement',calendarURL('arrangement',e.id))}</div></article>`;
  }).join('')+'</div>';
}

function loginPage() {
  if (authenticated()) return `<section class="fa-welcome-panel"><h1>Du er logget ind.</h1><p>${esc(session.user.email)}</p>${link('Åbn Min forening', '#min-forening', true)}</section>`;
  const deliveryProblem = challenge && !['sent', 'delivered', 'local'].includes(challenge.deliveryState);
  const accessNote = challenge?.accessState === 'unlinked'
    ? '<p class="fp-note fa-login-access">Ingen foreningsadgang på denne mail. <a href="kontakt.html#form">Kontakt TEB</a>.</p>'
    : challenge?.accessState === 'linked' ? '<p class="fp-note fa-login-access">Mailadressen har adgang.</p>' : '';
  const form = challenge
    ? `<h1>${deliveryProblem ? 'Log ind.' : 'Indtast koden.'}</h1>
      <p class="fa-login-recipient">${deliveryProblem ? 'E-mail:' : challenge.deliveryState === 'local' ? 'Kode til' : 'Kode sendt til'} <strong>${esc(challenge.email)}</strong></p>
      ${accessNote}${deliveryProblem ? `<p class="fp-notice" role="alert">${esc(loginDeliveryText(challenge.deliveryState))}</p>` : ''}
      ${formStart('verify-code', `data-challenge="${esc(challenge.id)}"`)}
        ${input('code', 'Kode fra din mail', '', 'text', 'required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" minlength="6" aria-describedby="login-code-help"')}
        <p id="login-code-help" class="fp-note">6 cifre · gælder i 10 minutter.</p>
        ${button('Log ind')}${resultBox()}
      </form>
      <p class="fp-note fa-login-spam">Ingen mail? Tjek spam/uønsket post.</p>
      <div class="fa-login-options"><button class="fa-text-button" type="button" data-change-email>Ret e-mail</button>${formStart('resend-code')}${button('Send en ny kode')}${resultBox()}</form></div>`
    : `<h1>Log ind til din forening.</h1><p>Brug den mailadresse, der har adgang til din forening.</p>${formStart(loginMethod === 'password' ? 'password-login' : 'request-code')}${input('email', 'Din e-mail', loginEmail, 'email', 'required autocomplete="username" maxlength="254"')}${loginMethod === 'password' ? input('password', 'Adgangskode', '', 'password', 'required autocomplete="current-password" maxlength="128"') : ''}${button(loginMethod === 'password' ? 'Log ind' : 'Send kode')}${resultBox()}</form><p><button type="button" class="fa-text-button" data-login-method>${loginMethod === 'password' ? 'Glemt adgangskode? Få kode på mail' : 'Log ind med adgangskode'}</button></p>`;
  const help = '<p class="fa-login-help"><a href="kontakt.html#form">Kontakt TEB</a></p>';
  return `<div class="fa-login-layout"><a class="fa-back-link" href="forening.html">← Tilbage til foreningerne</a><section class="fa-login-card" aria-label="Login til din forening">${form}${localMode ? '<p class="fa-local-help">Lokal afprøvning. Find din kode i <a href="kalender-postkasse.html" target="_blank" rel="noopener">testpostkassen</a>.</p>' : ''}</section>${help}</div>`;
}
function loginDeliveryText(state) {
  if (state === 'failed') return 'Koden kunne ikke sendes. Prøv igen, når knappen er klar.';
  if (state === 'uncertain') return 'Afsendelsen er usikker. Tjek din mail, eller bed om en ny kode.';
  if (state === 'pending') return 'Koden venter på afsendelse. Tjek din mail om lidt.';
  return 'Afsendelsen kunne ikke bekræftes. Kontakt TEB.';
}
// Logget ind uden forening: Bed om adgang på samme side, ingen blindgyde.
async function accessPage() {
  const [{ associations }, { requests }] = await Promise.all([api('/associations'), api('/me/access-requests')]);
  const pending = requests.filter(r => r.status === 'pending');
  const name = r => associations.find(a => a.id === r.associationId)?.name || r.newAssociationName || 'Foreningsadgang';
  return `<p class="mf-back">${link('← Alle foreninger', 'forening.html')}</p><section class="mf-start"><span class="eyebrow">Min forening</span><h1>${pending.length ? 'TEB kigger på din anmodning.' : 'Hvilken forening hører du til?'}</h1>` +
    `<p class="fp-notice">Du er logget ind med <strong>${esc(session.user.email)}</strong>. Denne e-mailadresse er ikke tilknyttet en forening endnu. <a href="kontakt.html#form">Kontakt TEB</a>, eller bed om adgang nedenfor.</p>` +
    (pending.length ? `<p>Du får en mail, når TEB har givet dig adgang. Log derefter ind igen med ${esc(session.user.email)}.</p>` : '<p>TEB bekræfter din tilknytning, før du får adgang. Bagefter kan du oprette arrangementer, rette foreningens side og invitere andre.</p>') +
    (requests.length ? `<ul class="mf-requests">${requests.map(r => `<li><strong>${esc(name(r))}</strong>${status(r.status)}${r.note ? `<p>${esc(r.note)}</p>` : ''}</li>`).join('')}</ul>` : '') +
    `<details class="mf-request-form"${pending.length ? '' : ' open'}><summary>${pending.length ? 'Bed om adgang til en anden forening' : 'Bed om adgang'}</summary>${formStart('access-request')}<label>Forening<select name="associationId" data-access-choice><option value="">Min forening er ikke i oversigten</option>${associations.map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}</select></label><div data-new-association>${input('newAssociationName', 'Foreningens navn', '', 'text', 'required maxlength="100"')}</div>${input('name', 'Dit navn', '', 'text', 'required maxlength="100" autocomplete="name"')}${textarea('roleNote', 'Hvad laver du i foreningen?', '', 'required maxlength="1500" placeholder="Fx formand, kasserer eller træner"')}${button('Send til TEB')}${resultBox()}</form></details>` +
    accountLine() + '</section>';
}
function passwordForm(action, attributes = '') {
  return formStart(action, attributes) + input('password', 'Ny adgangskode', '', 'password', 'required minlength="12" maxlength="128" autocomplete="new-password"') +
    input('passwordAgain', 'Gentag adgangskode', '', 'password', 'required minlength="12" maxlength="128" autocomplete="new-password"') +
    '<p class="fp-note">Mindst 12 tegn. Adgangskoden gælder for denne loginmail.</p>' + button('Gem adgangskode') + resultBox() + '</form>';
}
function accountLine(extra = '') {
  return `<p class="mf-small mf-account">Logget ind som ${esc(session.user.email)}${extra}${admin() ? ' · <a href="#teb">TEBs administration</a>' : ''} · <button type="submit" form="mf-logout" class="fa-text-button">Log ud</button> · <a href="kontakt.html#form">Kontakt TEB</a></p><form id="mf-logout" data-action="logout"></form><details class="mf-request-form fa-password-settings"><summary>Min adgangskode</summary>${passwordForm('set-password')}</details>`;
}
function profileForm(a, creating = false) {
  return formStart(creating ? 'create-association' : 'save-profile', `data-id="${esc(a.id || '')}" data-revision="${esc(a.revision ?? '')}"`) +
    '<fieldset class="fa-profile-group"><legend>Om foreningen</legend>' +
    input('name', 'Foreningens navn', a.name, 'text', 'required maxlength="100"') +
    input('category', 'Interesse', a.category, 'text', 'maxlength="100" placeholder="Fx motion eller kultur"') +
    textarea('description', 'Kort om foreningen', a.description, 'maxlength="1500"') +
    '</fieldset><fieldset class="fa-profile-group"><legend>Kontakt</legend><p class="fp-note">Disse oplysninger vises på jeres offentlige side. En offentlig kontaktmail giver ikke automatisk login. Giv personer adgang under Personer med adgang efter oprettelsen.</p>' +
    input('chair', 'Formand eller kontaktperson', a.chair, 'text', 'maxlength="100"') +
    `<div class="fp-form-row">${input('email', 'Offentlig kontaktmail', a.email, 'email', 'maxlength="254"')}${input('phone', 'Offentligt telefonnummer', a.phone, 'tel', 'maxlength="50"')}</div>` +
    input('place', 'Mødested', a.place, 'text', 'maxlength="180"') +
    input('website', 'Hjemmeside', a.website, 'url', 'maxlength="500" placeholder="https://"') +
    `</fieldset><fieldset class="fa-profile-group"><legend>Billede</legend><input type="hidden" name="imageUrl" value="${esc(a.imageUrl || '')}">${creating ? '<p>Gem foreningen, før du tilføjer et billede.</p>' : `<div class="fa-image-editor">${associationPhoto(a)}<div><label class="fa-file-choice">Vælg billede<input type="file" data-profile-image accept="image/jpeg,image/png,image/webp" aria-describedby="association-image-help"></label><p id="association-image-help" class="fp-note">Vælg et foto fra telefonen eller computeren, som I må bruge.</p><button type="button" class="fa-text-button" data-remove-image${a.imageUrl ? '' : ' hidden'}>Fjern billedet</button><div class="fa-image-result" aria-live="polite"></div></div></div>`}</fieldset><div class="fa-profile-save">${button(creating ? 'Opret forening' : 'Gem profil')}<p class="fp-note">Ændringerne bliver synlige på jeres offentlige side, når du gemmer.</p></div>` + resultBox() + '</form>';
}
async function workspace(r) {
  if (!memberships().length) return accessPage();
  if (!r.params.get('forening') && memberships().length > 1) return '<section class="mf-start"><span class="eyebrow">Min forening</span><h1>Hvilken forening vil du åbne?</h1><div class="fa-membership-choices">'+memberships().map(m=>'<a href="'+esc(workURL(m.associationId))+'"><strong>'+esc(m.association?.name||m.associationId)+'</strong><span>Åbn →</span></a>').join('')+'</div>'+accountLine()+'</section>';
  const id=r.params.get('forening')||memberships()[0].associationId;
  if(!memberships().some(m=>m.associationId===id))return accessPage();
  const {association:a}=await api('/associations/'+idPath(id));
  const account=accountLine(memberships().length>1?' · <a href="#min-forening">Skift forening</a>':'');
  const top='<p class="mf-back">'+link('← Alle foreninger','forening.html')+'</p><header class="mf-header">'+associationPhoto(a,'fa-profile-mark',true)+'<div><span class="eyebrow">Min forening</span><h1>'+esc(a.name)+'</h1></div><a class="btn mf-create" href="'+esc('kalender.html?'+new URLSearchParams({opret:'1',forening:id}))+'">Opret arrangement</a></header>';
  if(r.params.get('fane')==='profil')return top+'<p>'+link('← Tilbage til Min forening',workURL(id))+'</p><section class="fa-profile-editor"><h2>Ret jeres side</h2>'+profileForm(a)+'</section>'+account;
  const {events}=await api('/me/events');
  const ownEvents=events.filter(e=>(e.associationId||e.data?.associationId)===id);
  const date=e=>(e.data||e.published||{}).date||'';
  const upcoming=ownEvents.filter(e=>date(e)>=today()).sort((a,b)=>date(a).localeCompare(date(b))),past=ownEvents.filter(e=>date(e)<today()).sort((a,b)=>date(b).localeCompare(date(a)));
  const summary=a.description?esc(a.description.length>180?a.description.slice(0,180).trim()+'…':a.description):'<span class="mf-missing">Der står ikke noget om jer endnu.</span>';
  return top+
    '<section class="mf-card"><h2>Jeres arrangementer</h2>'+(upcoming.length?ownRows(upcoming):'<p class="mf-missing">Ingen kommende arrangementer. Tryk på Opret arrangement for at tilføje det næste.</p>')+
    (past.length?'<details class="mf-past"><summary>Tidligere arrangementer ('+past.length+')</summary>'+ownRows(past)+'</details>':'')+'</section>'+
    '<div class="mf-columns"><section class="mf-card"><div class="mf-card-head"><h2>Jeres side</h2>'+link('Ret',workURL(id,'profil'),true)+'</div><p>'+summary+'</p>'+(a.chair?'<p class="mf-small">Kontakt: '+esc(a.chair)+'</p>':'')+'<p>'+link('Se siden som besøgende ↗',publicURL(id))+'</p></section>'+
    '<section class="mf-card">'+await memberPage(a)+'</section></div>'+account;
}
function ownRows(events) {
  return '<ul class="mf-events">'+events.map(e=>{
    const data=e.data||e.published||{},cancelled=data.state==='cancelled'||e.published?.state==='cancelled';
    const [label,tone]=cancelled?['Aflyst','off']:e.pendingKind||e.status==='pending'?['Venter på TEB','wait']:e.status==='rejected'?['Ikke godkendt','off']:e.published?['I kalenderen','']:[statusNames[e.status]||'Gemt','wait'];
    return '<li><div><h3>'+esc(data.title)+'</h3><span>'+esc(dateLabel(data.date))+' kl. '+esc(data.time)+' · '+esc(data.location)+'</span>'+(e.note?'<p class="mf-small">Besked fra TEB: '+esc(e.note)+'</p>':'')+mailWarnings(e)+'</div><span class="mf-tag'+(tone?' mf-tag-'+tone:'')+'">'+label+'</span>'+link('Ret',calendarURL('ret',e.id))+'</li>';
  }).join('')+'</ul>';
}
function privateEvents(events) {
  return events.map(e => {
    const data = e.data || e.published || {};
      return `<article class="fp-list-row"><h3>${esc(data.title)}</h3><p>${esc(dateLabel(data.date))} kl. ${esc(data.time)} · ${esc(data.location)}</p><div class="fa-status-row">${status(e.pendingKind ? 'pending' : e.status === 'approved' ? 'published' : e.status)}${data.state === 'cancelled' || e.published?.state === 'cancelled' ? status('cancelled') : ''}${e.pendingKind ? status(e.pendingKind) : ''}</div>${e.note ? `<p>${esc(e.note)}</p>` : ''}${mailWarnings(e)}<div class="fp-actions">${link('Ret eller aflys', calendarURL('ret', e.id))}${e.published ? link('Se i kalenderen', calendarURL('arrangement', e.id)) : ''}</div></article>`;
  }).join('') || empty('Der er ingen arrangementer endnu.');
}
// Alle med adgang til en forening har de samme rettigheder.
async function memberPage(a, isAdmin = false) {
  const { members } = await api('/associations/' + idPath(a.id) + '/members');
  const me = session.user.email.toLowerCase();
  return `<div class="mf-card-head"><h2>Personer med adgang</h2></div><p class="mf-small">Alle her kan oprette arrangementer, rette jeres side og invitere andre.</p><ul class="mf-people">` +
    members.map(m => `<li><div><strong>${esc(m.name || m.email)}</strong><span>${esc(m.email)}${m.email.toLowerCase() === me ? ' · dig' : ''} · ${m.status === 'active' ? 'Adgang aktiv' : m.invitationExpiresAt && Date.parse(m.invitationExpiresAt) <= Date.now() ? 'Invitation udløbet - invitér igen' : 'Inviteret - afventer første login'}</span>${m.status === 'invited' && ['failed','uncertain','pending'].includes(m.invitationDeliveryState) ? '<p class="fp-note">Invitationsmailen er ikke bekræftet sendt. Personen kan åbne Log ind og bede om en kode med denne adresse.</p>' : ''}${isAdmin ? '<details class="mf-invite fa-password-settings"><summary>Sæt adgangskode</summary>'+passwordForm('admin-password', `data-association="${esc(a.id)}" data-member="${esc(m.id)}"`)+'</details>' : ''}</div>` +
      (m.email.toLowerCase() !== me ? `${formStart('revoke-member', `data-association="${esc(a.id)}" data-member="${esc(m.id)}" data-email="${esc(m.email)}"`)}<button type="submit" class="fa-text-button">Fjern</button>${resultBox()}</form>` : '') + '</li>').join('') +
    `</ul>${!members.length ? '<p class="fp-notice">Ingen personer har adgang endnu. Den offentlige kontaktmail giver ikke login. Tilføj den første person nedenfor.</p>' : ''}` +
    `<details class="mf-invite"${isAdmin && !members.length ? ' open' : ''}><summary>+ Invitér en person</summary>${formStart(isAdmin ? 'admin-member' : 'invite-member', `data-id="${esc(a.id)}"`)}${input('name', 'Navn', '', 'text', 'required maxlength="100"')}${input('email', 'E-mail', '', 'email', 'required maxlength="254"')}${isAdmin ? check('verified', 'Jeg har kontrolleret personens tilknytning til foreningen', true) : '<p class="fp-note">Personen får en mail og logger ind med denne adresse.</p>'}${button('Send invitation')}${resultBox()}</form></details>`;
}
async function adminPage(r) {
  const tab=r.params.get('fane')||'afventer';
  const tabs=[['afventer','Til godkendelse'],['arrangementer','Indhold'],['foreninger','Foreninger'],['print','Print']];
  const top='<div class="fp-row fa-admin-heading"><h1>TEB</h1><button class="btn btn-secondary" type="button" data-reload>Opdatér kø</button></div><nav class="fp-tabs" aria-label="TEB administration">'+tabs.map(([key,label])=>'<a href="'+esc(adminURL(key))+'"'+(tab===key?' aria-current="page"':'')+'>'+label+'</a>').join('')+'</nav>';
  if(tab==='adgang')return top+await adminAccess();
  if(tab==='foreninger')return top+await adminAssociations(r.params.get('forening'));
  if(tab==='print')return top+await printPage();
  const [{events},{posts},{requests}]=await Promise.all([api('/admin/events'),api('/admin/posts'),api('/admin/access-requests')]);
  if(tab==='arrangementer')return top+heading('Arrangementer')+privateEvents(events);
  const pending=events.filter(e=>Boolean(e.pendingKind)),access=requests.filter(r=>r.status==='pending');
  const count=pending.length+posts.length+access.length;
  return top+heading(count?count+' opgaver venter':'Du er med.','Gennemgå indsendelser og adgang ét sted.')+pending.map(reviewForm).join('')+posts.map(postReviewForm).join('')+
    (access.length?'<section class="fa-section"><h2>Adgang til foreninger</h2>'+await adminAccess()+'</section>':'')+(!count?'<p class="fa-quiet-empty">Der er ingen indsendelser eller adgangsanmodninger, der afventer svar.</p>':'');
}
function postReviewForm(p) {
 return '<details class="fp-panel fa-review fa-section"><summary>'+esc(p.title)+' · '+(p.kind==='news'?'Nyhed':'Opslag med arrangement')+'</summary><p class="fp-note">Oplyst afsender: '+esc(p.author)+'</p>'+(newsImage(p.image)?'<img class="fa-story-photo" src="'+esc(newsImage(p.image))+'" alt="">':'')+'<p>'+esc(p.description)+'</p>'+(p.body?'<p class="fa-preline">'+esc(p.body)+'</p>':'')+(p.date?eventSummary({...p,association:p.author}):'')+formStart('review-post','data-id="'+esc(p.id)+'" data-revision="'+esc(p.revision)+'"')+textarea('note','Besked til afsenderen. Udfyld ved afvisning.',p.note||'','maxlength="500"')+'<div class="fp-actions">'+button('Godkend og udgiv','approve')+button('Afvis','reject','formnovalidate')+'</div>'+resultBox()+'</form></details>';
}
function eventSummary(e) {
  return `<p><strong>${esc(e.title)}</strong><br>${esc(e.association)}<br>${esc(dateLabel(e.date))} kl. ${esc(e.time)}${e.endDate || e.endTime ? ` til ${esc(e.endDate ? dateLabel(e.endDate) : dateLabel(e.date))} kl. ${esc(e.endTime || '')}` : ''}<br>${esc(e.location)}</p><p class="fa-preline">${esc(e.description)}</p><p>${esc(e.price)}${e.link ? `<br>${esc(e.link)}` : ''}</p>${e.state === 'cancelled' ? status('cancelled') : ''}`;
}
function sharingWishes(e) {
 const names={flyers:'Husstandsomdeling',portals:'Byportaler',screens:'Infoskærme',posters:'Opslagstavler'};
 const wishes=[e.printRequested?'Analog kalender':null,...(e.channels||[]).map(key=>names[key])].filter(Boolean);
 return wishes.length?`<p class="fp-notice">Ønsker til synlighed: ${esc(wishes.join(', '))}. Der er ikke bestilt ekstern deling.</p>`:'';
}
function eventInputs(e) {
  return input('title', 'Titel', e.title, 'text', 'required maxlength="100"') +
    input('association', 'Arrangør', e.association, 'text', 'required maxlength="100"') +
    `<input type="hidden" name="associationId" value="${esc(e.associationId || '')}"><input type="hidden" name="state" value="${esc(e.state || 'approved')}">` +
    `<div class="fp-form-row">${input('date', 'Startdato', e.date, 'date', 'required')}${input('time', 'Starttid', e.time, 'time', 'required')}</div>` +
    `<div class="fp-form-row">${input('endDate', 'Slutdato, valgfri', e.endDate, 'date')}${input('endTime', 'Sluttid, valgfri', e.endTime, 'time')}</div>` +
    input('location', 'Sted', e.location, 'text', 'required maxlength="180"') +
    textarea('description', 'Beskrivelse', e.description, 'maxlength="1500"') +
    input('price', 'Pris', e.price, 'text', 'maxlength="100"') +
    input('link', 'Link', e.link, 'url', 'maxlength="500"') + sharingWishes(e);
}
function reviewForm(e) {
  const snapshotKey = e.id + ':' + e.revision;
  eventSnapshots.set(snapshotKey, e);
  const data = e.data || {};
  return `<details class="fp-panel fa-review fa-section"><summary>${esc(data.title || 'Arrangement uden titel')} · ${esc(statusNames[e.pendingKind] || 'Afventer')}</summary><div class="fa-status-row">${status(e.pendingKind)}${status(e.status)}</div>` +
    (e.published ? `<section class="fa-event-compare"><h3>Allerede offentliggjort</h3>${eventSummary(e.published)}<p class="fp-note">Denne version bevares, hvis ændringen afvises.</p></section>` : '<p class="fp-note">Arrangementet er endnu ikke offentliggjort.</p>') +
    (e.possibleDuplicates?.length ? `<p class="fp-notice">Mulige dubletter: ${e.possibleDuplicates.map(d => esc(d.title)).join(', ')}. Kontrollér dem under Alle arrangementer.</p>` : '') +
    `${mailWarnings(e)}${formStart('review-event', `data-id="${esc(e.id)}" data-snapshot="${esc(snapshotKey)}" data-revision="${esc(e.revision)}"`)}<h3>${e.pendingKind === 'cancel' ? 'Anmodning om aflysning' : 'Indsendt indhold'}</h3>${data.imageUrl && /^\/api\/kalender\/event-images\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(data.imageUrl) ? `<img class="cal-event-photo" src="${esc(data.imageUrl)}" alt="Indsendt arrangementsbillede">` : ''}${eventInputs(data)}${textarea('note', 'Besked til afsenderen. Skal udfyldes ved afvisning.', e.note || '', 'maxlength="500"')}<div class="fp-actions">${button(e.pendingKind === 'cancel' ? 'Godkend aflysning' : 'Godkend og offentliggør', 'approve')}${button('Afvis', 'reject', 'formnovalidate')}</div>${resultBox()}</form></details>`;
}
async function adminAccess() {
  const [{ requests }, { associations }] = await Promise.all([api('/admin/access-requests'), api('/associations')]);
  const pending = requests.filter(r => r.status === 'pending');
  const history = requests.filter(r => r.status !== 'pending');
  return heading('Adgangsanmodninger', 'Kontrollér personens tilknytning, før du godkender.') +
    (pending.map(r => `<article class="fp-panel fa-section"><h3>${esc(associations.find(a => a.id === r.associationId)?.name || r.newAssociationName || 'Forening')}</h3><p><strong>${esc(r.name)}</strong><br>${esc(r.email)}</p><p class="fa-preline">${esc(r.roleNote)}</p>${formStart('review-access', `data-id="${esc(r.id)}"`)}${check('verified', 'Jeg har kontrolleret personens tilknytning til foreningen')}${textarea('note', 'Besked til personen', '', 'maxlength="1500"')}<div class="fp-actions">${button('Godkend', 'approve')}${button('Afvis', 'reject')}</div>${resultBox()}</form></article>`).join('') || empty('Der er ingen adgangsanmodninger, der afventer svar.')) +
    (history.length ? `<section class="fa-section"><h3>Tidligere svar</h3>${history.map(r => `<article class="fp-list-row"><strong>${esc(r.name)}</strong><p>${esc(r.email)} · ${esc(associations.find(a => a.id === r.associationId)?.name || r.newAssociationName)}</p>${status(r.status)}</article>`).join('')}</section>` : '');
}
async function adminAssociations(id) {
  const { associations } = await api('/associations');
  const listing = `<div class="fp-grid">${associations.map(a => `<article class="fp-card"><h3>${esc(a.name)}</h3>${link('Profil og personer med adgang', adminURL('foreninger', a.id))}</article>`).join('') || empty('Der er ingen foreninger endnu.')}</div>`;
  if (id === 'ny') return heading('Opret forening') + `<p>${link('Alle foreninger', adminURL('foreninger'))}</p><p class="fp-notice"><strong>1. Opret foreningens offentlige profil.</strong> Kun navnet er obligatorisk. <strong>2. Giv en person adgang.</strong> Efter oprettelsen skriver du personens navn og loginmail under Personer med adgang. Kontaktmail og loginmail kan være forskellige.</p><section class="fp-panel fa-form-narrow">${profileForm({}, true)}</section>`;
  if (id) {
    const { association: a } = await api('/associations/' + idPath(id));
    return heading(a.name) + `<p>${link('Alle foreninger', adminURL('foreninger'))} · ${link('Offentlig profil', publicURL(id))}</p><section class="fp-panel fa-form-narrow">${profileForm(a)}</section><section class="fa-section">${await memberPage(a, true)}</section>`;
  }
  return heading('Foreninger') + `<p>Find først foreningen nedenfor, så den kun oprettes én gang. Vælg Profil og personer med adgang for at give en person login.</p><p>${link('Opret forening', adminURL('foreninger', 'ny'), true)} · ${link('Brugermanual til TEB (PDF)', 'downloads/teb-admin-brugermanual.pdf')}</p>` + listing;
}
function editionLabel(e) {
  if (e.start && e.end) return `${dateLabel(e.start)} til ${dateLabel(e.end)}`;
  return e.month || 'Printudgave';
}
async function printPage() {
  const { editions } = await api('/editions');
  return heading('Lav en printudgave', 'Vælg arrangementerne, ret printteksten, og gennemse PDF’en før udgivelse.') + printEditorHtml() +
    `<section class="fa-section"><h2>Gemte printudgaver</h2><div data-print-archive>${editions.map(e => `<article class="fp-list-row" data-edition-id="${esc(e.id)}"><h3>${esc(editionLabel(e))}</h3><p>Frist ${esc(dateLabel(e.deadline))}${e.eventCount !== undefined ? ` · ${esc(e.eventCount)} arrangementer` : ''}</p><a href="/api/kalender/editions/${idPath(e.id)}/pdf" target="_blank" rel="noopener">Åbn gemt PDF</a></article>`).join('') || empty('Der er ingen gemte printudgaver.')}</div></section>`;
}
function values(form, names) {
  const data = new FormData(form);
  return Object.fromEntries(names.map(name => [name, String(data.get(name) ?? '').trim()]));
}
function deliveryMessage(result, subject) {
  const state = result.deliveryState;
  if (state === 'not_required') return subject + ' er allerede aktiv. Personen kan logge ind med sin e-mailadresse og bede om en kode.';
  if (state === 'failed') return subject + ' er gemt, men mailen kunne ikke sendes. Kontakt TEB, hvis personen ikke kan komme videre.';
  if (state === 'uncertain') return subject + ' er gemt. Vi kan ikke bekræfte, om mailen blev sendt. Personen kan prøve at logge ind med den valgte e-mailadresse.';
  if (state === 'pending') return subject + ' er gemt. Mailen venter på afsendelse.';
  if (localMode || state === 'local') return subject + ' er gemt. Mailen ligger i den lokale testpostkasse.';
  if (state === 'sent' || state === 'delivered') return subject + ' er gemt, og mailen er sendt.';
  return subject + ' er gemt. Maillevering er ikke bekræftet. Personen kan logge ind med den valgte e-mailadresse.';
}
function mailWarnings(event) {
  const messages = [];
  if (['failed', 'pending', 'uncertain'].includes(event.notificationState)) messages.push('Beskeden til TEB er ikke bekræftet sendt. Arrangementet er gemt.');
  if (['failed', 'pending', 'uncertain'].includes(event.receiptState)) messages.push('Kvitteringen til afsenderen er ikke bekræftet sendt. Arrangementet er gemt.');
  return messages.map(message => `<p class="fp-notice">${message}</p>`).join('');
}
async function refresh(message) {
  try { session = await getSession(); }
  catch (error) {
    showMessage(notice, message + ' Siden kunne ikke genindlæses. ' + errorText(error), true);
    return;
  }
  flash = message;
  await render();
}
async function onSubmit(event) {
  const form = event.target.closest('form[data-action]');
  if (!form) return;
  const action = form.dataset.action;
  const submitter = event.submitter;
  event.preventDefault();
  const loginAction = ['request-code', 'resend-code', 'verify-code', 'password-login'].includes(action);
  if (loginAction && loginPending) return;
  if (form.dataset.uploading === 'true') return;
  if (form.dataset.pending === 'true') return;
  if (loginAction) loginPending = true;
  form.dataset.pending = 'true';
  const box = form.querySelector('.fa-form-result') || notice;
  box.replaceChildren();
  try {
    await busy(submitter, async () => {
      switch (action) {
        case 'resend-code':
        case 'request-code': {
          const email = form.elements.email?.value.trim() || challenge?.email;
          if (!email) throw new Error('Skriv din e-mailadresse.');
          loginEmail = email;
          const response = await api('/auth/request', { body: { email } });
          if (!response.challengeId) throw new Error('Der kom ingen loginanmodning fra serveren. Prøv igen.');
          challenge = { id: response.challengeId, email: email.toLowerCase(), accessState: response.accessState, deliveryState: response.deliveryState, expiresAt: Date.now() + 600000, retryAt: Date.now() + (response.resendAfterSeconds || 60) * 1000 };
          loginCooldowns.set(email.toLowerCase(), challenge.retryAt);
          saveLoginChallenge();
          localMode = localMode || response.mode === 'local';
          flash = '';
          await render();
          document.querySelector('[name="code"]')?.focus();
          break;
        }
        case 'password-login':
        case 'verify-code': {
          if (action === 'password-login') {
            loginEmail = form.elements.email.value.trim();
            await api('/auth/password/login', { body: { email: loginEmail, password: form.elements.password.value } });
            form.elements.password.value = '';
          } else await api('/auth/verify', { body: { challengeId: form.dataset.challenge, code: form.elements.code.value.trim() } });
          session = await getSession();
          if (!authenticated()) throw new Error('Login kunne ikke bekræftes. Prøv igen.');
          challenge = null;
          saveLoginChallenge();
          const target = returnTarget();
          if (target) { location.assign(target); return; }
          flash = 'Du er logget ind.';
          if (admin() && currentRoute.page === 'teb') { await render(); break; }
          location.hash = admin() && !memberships().length ? '#teb' : '#min-forening';
          break;
        }
        case 'logout': {
          await api('/auth/logout', { body: {} });
          session = null;
          challenge = null;
          saveLoginChallenge();
          ++renderNumber;
          eventSnapshots.clear();
          disposePrintEditor?.(); disposePrintEditor = null;
          flash = 'Du er logget ud.';
          // Replace the private view immediately after confirmed logout.
          navigation('oversigt');
          content.replaceChildren();
          if (location.hash) location.hash = '';
          else await render();
          break;
        }
        case 'access-request': {
          const data = values(form, ['associationId', 'newAssociationName', 'name', 'roleNote']);
          if (data.associationId) delete data.newAssociationName;
          else delete data.associationId;
          await api('/access-requests', { body: data });
          await refresh('Din anmodning er gemt hos TEB. Du får først adgang, når den er godkendt.');
          break;
        }
        case 'save-profile': {
          const { association } = await api('/associations/' + idPath(form.dataset.id), { body: { association: values(form, profileFields), revision: Number(form.dataset.revision) } });
          form.dataset.revision = String(association.revision);
          await refresh('Profilen er gemt og kan ses af alle.');
          break;
        }
        case 'create-association': {
          const data = values(form, profileFields);
          const fingerprint = JSON.stringify(data);
          if (!associationRequests.has(fingerprint)) associationRequests.set(fingerprint, requestKey());
          const { association } = await api('/admin/associations', { body: { association: data, requestKey: associationRequests.get(fingerprint) } });
          if (typeof association?.id !== 'string' || !association.id.trim()) throw new Error('Oprettelsen kunne ikke bekræftes. Prøv igen. Foreningen kan allerede være gemt.');
          associationRequests.delete(fingerprint);
          flash = 'Foreningen er oprettet. Invitér en person nedenfor.';
          location.hash = adminURL('foreninger', association.id);
          break;
        }
        case 'invite-member':
        case 'admin-member': {
          const data = values(form, ['email', 'name']);
          if (!window.confirm(`${action === 'admin-member' ? 'Tilknyt' : 'Invitér'} ${data.email} til denne forening?`)) return;
          const path = action === 'admin-member' ? '/admin/associations/' + idPath(form.dataset.id) + '/members' : '/associations/' + idPath(form.dataset.id) + '/invitations';
          const response = await api(path, { body: data });
          await refresh(deliveryMessage(response, action === 'admin-member' ? 'Adgangen' : 'Invitationen'));
          break;
        }
        case 'set-password':
        case 'admin-password': {
          const password = form.elements.password.value;
          if (password !== form.elements.passwordAgain.value) throw new Error('Adgangskoderne er ikke ens.');
          const endpoint = action === 'admin-password' ? '/admin/associations/' + idPath(form.dataset.association) + '/members/' + idPath(form.dataset.member) + '/password' : '/auth/password';
          await api(endpoint, { body: { password } });
          form.reset();
          showMessage(box, 'Adgangskoden er gemt. Der er ikke sendt en mail.');
          break;
        }
        case 'revoke-member': {
          if (!window.confirm(`Fjern adgangen for ${form.dataset.email}? Personen kan derefter ikke redigere eller udgive for foreningen.`)) return;
          await api('/associations/' + idPath(form.dataset.association) + '/members/' + idPath(form.dataset.member) + '/revoke', { body: {} });
          await refresh('Adgangen er fjernet.');
          break;
        }
        case 'review-access': {
          const decision = submitter?.value;
          const verified = form.elements.verified.checked;
          const note = form.elements.note.value.trim();
          if (!['approve', 'reject'].includes(decision)) throw new Error('Vælg godkend eller afvis.');
          if (decision === 'approve' && !verified) throw new Error('Bekræft først, at du har kontrolleret personens tilknytning.');
          await api('/admin/access-requests/' + idPath(form.dataset.id), { body: { action: decision, verified, note } });
          await refresh(decision === 'approve' ? 'Anmodningen er godkendt.' : 'Anmodningen er afvist.');
          break;
        }
        case 'review-post': {
          const decision=submitter?.value,note=form.elements.note.value.trim();
          if(!['approve','reject'].includes(decision))throw new Error('Vælg godkend eller afvis.');
          if(decision==='reject'&&!note)throw new Error('Skriv en begrundelse for afvisningen.');
          await api('/admin/posts/'+idPath(form.dataset.id),{body:{action:decision,revision:Number(form.dataset.revision),note}});
          await refresh(decision==='approve'?'Opslaget er godkendt.':'Indsendelsen er afvist med en besked.');break;
        }
        case 'review-event': {
          const decision = submitter?.value;
          const note = form.elements.note.value.trim();
          if (!['approve', 'reject'].includes(decision)) throw new Error('Vælg godkend eller afvis.');
          if (decision === 'reject' && !note) { form.elements.note.focus(); throw new Error('Skriv en begrundelse for afvisningen.'); }
          const snapshot = eventSnapshots.get(form.dataset.snapshot);
          if (!snapshot) throw new Error('Hent siden igen, før du gennemgår arrangementet.');
          const eventData = { ...snapshot.data, ...values(form, eventFields) };
          await api('/admin/events/' + idPath(form.dataset.id), { body: { action: decision, revision: Number(form.dataset.revision), event: eventData, note } });
          await refresh(decision === 'approve' ? 'Arrangementet er godkendt.' : 'Anmodningen er afvist. En eventuel offentliggjort version er bevaret.');
          break;
        }

      }
    });
  } catch (error) {
    if (loginAction && action !== 'password-login' && error.status === 429 && error.retryAfterSeconds) {
      const email = (form.elements.email?.value || challenge?.email || '').trim().toLowerCase();
      loginCooldowns.set(email, Date.now() + error.retryAfterSeconds * 1000);
      if (challenge?.email === email) { challenge.retryAt = loginCooldowns.get(email); saveLoginChallenge(); }
    }
    showMessage(box.isConnected ? box : notice, loginAction && action !== 'password-login' && error.status === 401 ? 'Koden er forkert eller udløbet. Prøv igen, eller bed om en ny kode.' : errorText(error), true);
    if (error.status === 401) { session = null; navigation(currentRoute.page); }
  } finally {
    delete form.dataset.pending;
    if (loginAction) { loginPending = false; updateLoginCooldown(); }
  }
}
async function prepareProfileImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Vælg et JPG-, PNG- eller WebP-billede.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Billedet er for stort. Vælg et billede under 20 MB.');
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = url;
    await image.decode();
    if (image.naturalWidth * image.naturalHeight > 50000000) throw new Error('Billedet er for stort. Vælg et mindre foto.');
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Billedet kunne ikke klargøres. Prøv igen.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .82));
    if (!blob || blob.size > 2 * 1024 * 1024) throw new Error('Billedet er for stort. Vælg et mindre foto.');
    return blob;
  } catch (error) {
    if (error.name === 'EncodingError') throw new Error('Billedet kunne ikke åbnes. Prøv et andet JPG-, PNG- eller WebP-billede.');
    throw error;
  } finally { URL.revokeObjectURL(url); }
}
function updateImagePreview(form, value) {
  form.elements.imageUrl.value = value;
  const figure = form.querySelector('.fa-image-editor figure');
  const image = figure.querySelector('img');
  delete image.dataset.fallback;
  image.src = associationImage(value) || associationFallback;
  figure.querySelector('figcaption')?.remove();
  if (!value) { const caption = document.createElement('figcaption'); caption.textContent = 'Glimt fra byen'; figure.append(caption); }
  form.querySelector('[data-remove-image]').hidden = !value;
}
async function uploadProfileImage(input) {
  const file = input.files?.[0];
  if (!file) return;
  const form = input.form;
  if (form.dataset.uploading === 'true' || form.dataset.pending === 'true') return;
  const box = form.querySelector('.fa-image-result');
  const controls = [...form.querySelectorAll('button[type="submit"], [data-remove-image]')];
  const previousDisabled = controls.map(node => node.disabled);
  form.dataset.uploading = 'true';
  controls.forEach(node => node.disabled = true);
  input.disabled = true;
  showMessage(box, 'Klargør og gemmer billedet…');
  try {
    const blob = await prepareProfileImage(file);
    const response = await fetch('/api/kalender/associations/' + idPath(form.dataset.id) + '/image', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': blob.type }, body: blob, signal: AbortSignal.timeout(30000) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Billedet kunne ikke gemmes. Prøv igen.');
    if (!associationImage(result.imageUrl)) throw new Error('Billedet kunne ikke bekræftes. Prøv igen.');
    if (!form.isConnected) return;
    updateImagePreview(form, result.imageUrl);
    showMessage(box, 'Billedet er klar. Tryk Gem profil for at vise det på jeres offentlige side.');
  } catch (error) { if (form.isConnected) showMessage(box, errorText(error), true); }
  finally {
    delete form.dataset.uploading;
    input.disabled = false;
    input.value = '';
    controls.forEach((node, index) => node.disabled = previousDisabled[index]);
  }
}
document.addEventListener('submit', onSubmit);
document.addEventListener('input', event => {
  if (event.target.matches('form[data-action="request-code"] input[name="email"]')) updateLoginCooldown();
  if (event.target.id === 'association-search') filterDirectory();
});
document.addEventListener('change', event => {
  if (event.target.matches('[data-profile-image]')) { uploadProfileImage(event.target); return; }
  if (event.target.matches('[data-access-choice]')) {
    const group = event.target.form.querySelector('[data-new-association]');
    const existing = Boolean(event.target.value);
    group.hidden = existing;
    group.querySelector('input').disabled = existing;
    group.querySelector('input').required = !existing;
  }
});
document.addEventListener('click', event => {
  if (event.target.closest('[data-login-method]')) {
    if (loginPending) return;
    loginEmail = content.querySelector('input[name="email"]')?.value.trim() || loginEmail;
    loginMethod = loginMethod === 'password' ? 'email' : 'password';
    render().then(() => document.querySelector('input[name="email"]')?.focus());
    return;
  }
  if (event.target.closest('[data-change-email]')) {
    if (loginPending) return;
    challenge = null;
    saveLoginChallenge();
    render().then(() => document.querySelector('input[name="email"]')?.focus());
    return;
  }
  const removeImage = event.target.closest('[data-remove-image]');
  if (removeImage) {
    const form = removeImage.form;
    if (form.dataset.uploading === 'true' || form.dataset.pending === 'true') return;
    updateImagePreview(form, '');
    showMessage(form.querySelector('.fa-image-result'), 'Tryk Gem profil for at fjerne billedet fra den offentlige side.');
    return;
  }
  const viewButton = event.target.closest('[data-directory-view]');
  if (viewButton) {
    directoryView = viewButton.dataset.directoryView === 'list' ? 'list' : 'cards';
    try { localStorage.setItem('teb-association-view', directoryView); } catch { /* Storage is optional. */ }
    document.querySelectorAll('[data-directory-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.directoryView === directoryView)));
    filterDirectory();
    return;
  }
  if (event.target.closest('.fa-skip')) {
    event.preventDefault();
    document.querySelector('#forening-main').focus();
    return;
  }
  if (event.target.closest('[data-reload]')) { session = null; render(); }
});
document.addEventListener('error', event => {
  const image = event.target;
  if (!image.matches?.('[data-association-image]') || image.dataset.fallback) return;
  image.dataset.fallback = 'true';
  image.src = associationFallback;
  const figure = image.closest('figure');
  if (!figure.querySelector('figcaption')) { const caption = document.createElement('figcaption'); caption.textContent = 'Glimt fra byen'; figure.append(caption); }
}, true);
window.addEventListener('hashchange', () => {
  render();
  document.querySelector('#forening-main').focus({ preventScroll: true });
});
// Local-mode information is optional. Data and login failures remain visible in render().
showMode().then(async config => {
  localMode = config.mode === 'local';
  if (localMode) {
    try {
      const response = await fetch('data/foreninger-udkast.json', { signal: AbortSignal.timeout(5000) });
      if (response.ok) directoryDraft = await response.json();
    } catch { /* The normal directory and login remain usable without draft metadata. */ }
  }
  render();
});
