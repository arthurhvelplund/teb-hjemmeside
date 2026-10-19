import {printEditorHtml,mountPrintEditor} from './kalender-print.js';
import { api, getSession, escapeHTML as esc, requestKey, today, dateText, showMessage, showMode, busy } from './portal-api.js';

const content = document.querySelector('#forening-content');
const nav = document.querySelector('#forening-nav');
const notice = document.querySelector('#forening-message');
let session = null;
let challenge = null;
let loginEmail = '';
let loginPending = false;
let directory = [];
let directoryView = 'cards';
let directoryFiltersOpen = false;
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
const workURL = (id, tab = 'overblik') => '#arbejdsrum?' + new URLSearchParams({ forening: id, fane: tab });
const adminURL = (tab = 'afventer', id = '') => '#teb?' + new URLSearchParams({ fane: tab, ...(id ? { forening: id } : {}) });
const publicURL = id => 'forening.html?' + new URLSearchParams({ id });
const calendarURL = (key, id) => 'kalender.html?' + new URLSearchParams({ [key]: id });
const link = (text, href, button = false) => `<a${button ? ' class="btn btn-secondary"' : ''} href="${esc(href)}">${esc(text)}</a>`;
const empty = text => `<p class="fp-empty">${esc(text)}</p>`;
const statusNames = { pending: 'Afventer TEB', approved: 'Godkendt', published: 'Udgivet', rejected: 'Afvist', cancelled: 'Aflyst', active: 'Aktiv', invited: 'Inviteret', new: 'Nyt arrangement', edit: 'Rettelse', cancel: 'Aflysning' };
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
  if (error.status === 403) return 'Du har ikke adgang til denne handling. Kontakt den foreningsansvarlige eller TEB.';
  if (error.status === 409) return 'Oplysningerne er ændret siden sidst. Hent siden igen, før du gemmer.';
  if (error.name === 'TimeoutError' || error.name === 'AbortError' || error instanceof TypeError) return 'Der er ikke forbindelse til serveren. Prøv igen. Ved afsendelse kan oplysningerne allerede være gemt.';
  return error.message || 'Oplysningerne kunne ikke hentes. Prøv igen.';
}
function route() {
  const query = new URLSearchParams(location.search);
  const [name, params = ''] = location.hash.slice(1).split('?');
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
function noAccess() {
  return `<section class="fa-welcome-panel"><span class="eyebrow">Min forening</span><h1>Din e-mail er bekræftet.</h1><p>TEB skal knytte dig til en forening, før du kan rette oplysninger og oprette arrangementer.</p><a class="btn" href="kontakt.html#form">Kontakt TEB</a><p class="fp-note">Du er logget ind med ${esc(session.user.email)}.</p></section>`;
}
function navigation(page) {
  const account = ['login', 'arbejdsrum', 'teb', 'adgang'].includes(page);
  const loginScreen = account && !authenticated();
  document.body.classList.toggle('fa-account-screen', account);
  document.querySelector('#forening-main').classList.toggle('fa-auth-page', loginScreen);
  document.querySelector('#forening-main').classList.toggle('fa-private-page', account && authenticated());
  document.querySelector('#forening-main').classList.toggle('fa-directory', page === 'oversigt');
  document.querySelector('.fa-heading h1').textContent = 'Foreninger';
  nav.hidden = page === 'oversigt' || loginScreen;
  const workspaceLink = document.querySelector('#forening-workspace-link');
  workspaceLink.textContent = authenticated() ? admin() ? 'TEBs område' : 'Min forening' : 'Log ind';
  workspaceLink.href = authenticated() ? admin() ? '#teb' : '#arbejdsrum' : '#login';
  const links = [['oversigt', 'Alle foreninger', 'forening.html']];
  if (authenticated() && (memberships().length || !admin()) && page !== 'arbejdsrum') links.push(['arbejdsrum', 'Min forening', '#arbejdsrum']);
  if (admin() && page !== 'teb') links.push(['teb', 'TEBs arbejdsområde', '#teb']);
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
      case 'adgang': html = authenticated() ? await accessPage() : loginNeeded(); break;
      case 'arbejdsrum': html = authenticated() ? await workspace(r) : loginNeeded(); break;
      case 'teb': html = admin() ? await adminPage(r) : authenticated() ? heading('Kun for TEB', 'Dit login giver ikke adgang til TEBs administration.') : loginNeeded(); break;
      default: html = heading('Siden findes ikke') + link('Se alle foreninger', 'forening.html');
    }
    if (sequence !== renderNumber) return;
    content.innerHTML = html;
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
  directory = (await api('/associations')).associations.sort((a, b) => a.name.localeCompare(b.name, 'da'));
  // Keep the original fictional seed in the database and workspaces, outside the real directory draft.
  if (directory.some(draftMeta)) directory = directory.filter(a => a.name !== 'Eksempelforeningen Solsiden');
  const categories = [...new Set(directory.map(a => a.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'da'));
  return `<section aria-label="Find en forening">
    <div class="fa-directory-tools">
      <label class="fa-directory-search"><span class="fa-visually-hidden">Søg efter en forening eller interesse</span><span class="fa-search-icon" aria-hidden="true">⌕</span><input id="association-search" type="search" placeholder="Søg efter forening..." autocomplete="off"></label>
      <button class="fa-filter-toggle" id="association-filter-toggle" type="button" aria-expanded="${directoryFiltersOpen}" aria-controls="association-filters"><span data-filter-label>Filtre</span><span aria-hidden="true">⌄</span></button>
      <div class="fa-directory-filters" id="association-filters"${directoryFiltersOpen ? '' : ' hidden'}>
        <label>Interesse<select id="association-category"><option value="">Alle interesser</option>${categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select></label>
        <fieldset class="fa-view-options"><legend>Visning</legend><div class="fa-view-switch" role="group" aria-label="Vis foreninger som"><button type="button" data-directory-view="cards" aria-controls="association-results" aria-pressed="${directoryView === 'cards'}">Billeder</button><button type="button" data-directory-view="list" aria-controls="association-results" aria-pressed="${directoryView === 'list'}">Liste</button></div></fieldset>
      </div>
    </div>
    <div class="fa-directory-meta"><p id="association-count" aria-live="polite"></p>${directory.some(draftMeta) ? '<span class="fa-directory-draft" title="Foreningerne har endnu ikke bekræftet oplysningerne.">Foreløbig oversigt</span>' : ''}</div>
    <div id="association-results" class="fa-associations" data-view="${directoryView}"></div>
  </section><p class="fa-contact">Mangler din forening? <a href="kontakt.html#form">Kontakt TEB</a></p>`;
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
  const category = document.querySelector('#association-category').value;
  const filtered = directory.filter(a => (!category || a.category === category) && [a.name, a.description, a.category, a.place].join(' ').toLocaleLowerCase('da').includes(search));
  document.querySelector('#association-count').textContent = `${filtered.length} ${filtered.length === 1 ? 'forening' : 'foreninger'}`;
  results.dataset.view = directoryView;
  document.querySelector('[data-filter-label]').textContent = category ? 'Filtre · 1' : 'Filtre';
  results.innerHTML = filtered.map(a => `<article class="fa-association"><a class="fa-association-link" href="${esc(publicURL(a.id))}" aria-labelledby="association-name-${esc(a.id)}">${associationPhoto(a, '', true)}<div class="fa-association-copy"><h2 id="association-name-${esc(a.id)}">${esc(a.name)}</h2>${a.category ? `<p class="fa-association-category">${esc(a.category)}</p>` : ''}<span class="fa-association-action" aria-hidden="true"><span>Se forening</span><span>→</span></span></div></a></article>`).join('') || empty(directory.length ? 'Ingen foreninger passer til søgningen.' : 'Der er ingen foreninger i oversigten endnu.');
}
function safeWebsite(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
async function publicProfile(id) {
  if (!id) return heading('Vælg en forening') + link('Se alle foreninger', 'forening.html');
  const [{ association: a }, { events }] = await Promise.all([api('/associations/' + idPath(id)), api('/events')]);
  const website = safeWebsite(a.website);
  const draft = draftMeta(a);
  const details = [['Formand', esc(a.chair)], ['Kontaktmail', a.email ? `<a href="mailto:${esc(encodeURIComponent(a.email))}">${esc(a.email)}</a>` : ''], ['Telefon', a.phone ? `<a href="tel:${esc(a.phone.replace(/[^+\d]/g, ''))}">${esc(a.phone)}</a>` : ''], ['Mødested', esc(a.place)], ['Hjemmeside', website ? `<a href="${esc(website)}" target="_blank" rel="noopener noreferrer">${esc(a.website)}</a>` : esc(a.website)]];
  return `<p class="fp-breadcrumb">${link('Alle foreninger', 'forening.html')}</p>` + heading(a.name) + (draft ? `<p class="fp-notice">Foreløbigt udkast. Oplysningerne afventer foreningens bekræftelse.</p>` : '') + (associationImage(a.imageUrl) ? associationPhoto(a, 'fa-profile-photo') : '') +
    `<div class="fp-split"><section><p class="fp-note">${esc(a.category)}</p><p class="fa-preline">${esc(a.description || 'Foreningen har endnu ikke skrevet en beskrivelse.')}</p></section><aside class="fp-panel"><h3>Kontakt foreningen</h3><dl class="fa-details">${details.filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') || '<dd>Kontaktoplysninger er ikke tilføjet endnu.</dd>'}</dl></aside></div>` +
    (draft ? `<p class="fp-note fa-source">Kilde: <a href="${esc(draft.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(new URL(draft.sourceUrl).hostname.replace(/^www\./, ''))}</a>. Hentet 18. oktober 2026.${draft.imageCredit && a.imageUrl === draft.imageUrl ? ` Billede/logo: ${esc(draft.imageCredit)}.` : ''}</p>` : '') +
    (admin() || memberships().some(m => m.associationId === id) ? `<p class="fa-section">${link('Redigér forening', admin() ? adminURL('foreninger', id) : workURL(id, 'profil'), true)}</p>` : '') +
    `<section class="fa-section"><h2>Kommende arrangementer</h2>${publicEvents(events.filter(e => e.associationId === id))}</section>`;
}
function publicEvents(events) {
  return events.map(e => `<article class="fp-list-row"><h3>${link(e.title, calendarURL('arrangement', e.id))}</h3><p>${esc(dateLabel(e.date))} kl. ${esc(e.time)} · ${esc(e.location)}</p>${e.state === 'cancelled' ? status('cancelled') : ''}</article>`).join('') || empty('Ingen kommende arrangementer.');
}
function loginPage() {
  if (authenticated()) return `<section class="fa-welcome-panel"><h1>Du er logget ind.</h1><p>${esc(session.user.email)}</p>${link(admin() ? 'Åbn TEBs arbejdsområde' : 'Åbn min forening', admin() ? '#teb' : '#arbejdsrum', true)}</section>`;
  const form = challenge
    ? `<h1>Tjek din e-mail.</h1><p>Vi har sendt en kode til <strong>${esc(challenge.email)}</strong>.</p>${formStart('verify-code', `data-challenge="${esc(challenge.id)}"`)}${input('code', 'Koden fra din mail', '', 'text', 'required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" minlength="6" aria-describedby="login-code-help"')}<p id="login-code-help" class="fp-note">Skriv de seks cifre. Koden gælder i 10 minutter.</p>${button('Log ind')}${resultBox()}</form><div class="fa-login-options"><button class="fa-text-button" type="button" data-change-email>Ret e-mailadressen</button>${formStart('resend-code')}${button('Send en ny kode')}${resultBox()}</form></div>`
    : `<h1>Log ind til din forening.</h1><p>Brug din e-mailadresse. Vi sender en engangskode, så du slipper for at huske en adgangskode.</p>${formStart('request-code')}${input('email', 'Din e-mail', loginEmail, 'email', 'required autocomplete="email" maxlength="254"')}${button('Send kode')}${resultBox()}</form>`;
  return `<div class="fa-login-layout"><a class="fa-back-link" href="forening.html">← Tilbage til foreningerne</a><section class="fa-login-card" aria-label="Login til din forening"><span class="eyebrow">For foreninger</span>${form}${localMode ? '<p class="fa-local-help">Lokal afprøvning. Find din kode i <a href="kalender-postkasse.html" target="_blank" rel="noopener">testpostkassen</a>.</p>' : ''}</section><p class="fa-login-help">Har du brug for hjælp? <a href="kontakt.html#form">Kontakt TEB</a>.</p></div>`;
}
async function accessPage() {
  const [{ associations }, { requests }] = await Promise.all([api('/associations'), api('/me/access-requests')]);
  return heading('Få adgang til en forening', 'TEB bekræfter din tilknytning, før du får adgang som foreningsansvarlig.') +
    `<section class="fp-panel fa-form-narrow"><p>Du søger med ${esc(session.user.email)}.</p>${formStart('access-request')}${input('name', 'Dit navn', '', 'text', 'required maxlength="100" autocomplete="name"')}<label>Forening<select name="associationId" data-access-choice><option value="">Min forening er ikke i oversigten</option>${associations.map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}</select></label><div data-new-association>${input('newAssociationName', 'Foreningens navn', '', 'text', 'required maxlength="100"')}</div>${textarea('roleNote', 'Din tilknytning til foreningen', '', 'required maxlength="1500"')}${button('Send anmodning')}${resultBox()}</form></section>` +
    `<section class="fa-section"><h2>Dine anmodninger</h2>${requests.map(r => `<article class="fp-list-row"><h3>${esc(associations.find(a => a.id === r.associationId)?.name || r.newAssociationName || 'Foreningsadgang')}</h3>${status(r.status)}${r.note ? `<p>${esc(r.note)}</p>` : ''}</article>`).join('') || empty('Du har ikke sendt nogen anmodninger.')}</section>`;
}
function profileForm(a, creating = false) {
  return formStart(creating ? 'create-association' : 'save-profile', `data-id="${esc(a.id || '')}" data-revision="${esc(a.revision ?? '')}"`) +
    '<fieldset class="fa-profile-group"><legend>Om foreningen</legend>' +
    input('name', 'Foreningens navn', a.name, 'text', 'required maxlength="100"') +
    input('category', 'Interesse', a.category, 'text', 'maxlength="100" placeholder="Fx motion eller kultur"') +
    textarea('description', 'Kort om foreningen', a.description, 'maxlength="1500"') +
    '</fieldset><fieldset class="fa-profile-group"><legend>Kontakt</legend><p class="fp-note">Disse oplysninger vises på jeres offentlige side.</p>' +
    input('chair', 'Formand eller kontaktperson', a.chair, 'text', 'maxlength="100"') +
    `<div class="fp-form-row">${input('email', 'Offentlig kontaktmail', a.email, 'email', 'maxlength="254"')}${input('phone', 'Offentligt telefonnummer', a.phone, 'tel', 'maxlength="50"')}</div>` +
    input('place', 'Mødested', a.place, 'text', 'maxlength="180"') +
    input('website', 'Hjemmeside', a.website, 'url', 'maxlength="500" placeholder="https://"') +
    `</fieldset><fieldset class="fa-profile-group"><legend>Billede</legend><input type="hidden" name="imageUrl" value="${esc(a.imageUrl || '')}">${creating ? '<p>Gem foreningen, før du tilføjer et billede.</p>' : `<div class="fa-image-editor">${associationPhoto(a)}<div><label class="fa-file-choice">Vælg billede<input type="file" data-profile-image accept="image/jpeg,image/png,image/webp" aria-describedby="association-image-help"></label><p id="association-image-help" class="fp-note">Vælg et foto fra telefonen eller computeren, som I må bruge.</p><button type="button" class="fa-text-button" data-remove-image${a.imageUrl ? '' : ' hidden'}>Fjern billedet</button><div class="fa-image-result" aria-live="polite"></div></div></div>`}</fieldset><div class="fa-profile-save">${button(creating ? 'Opret forening' : 'Gem profil')}<p class="fp-note">Ændringerne bliver synlige på jeres offentlige side, når du gemmer.</p></div>` + resultBox() + '</form>';
}
async function workspace(r) {
  if (!memberships().length) return noAccess();
  if (!r.params.get('forening') && memberships().length > 1) return `<section class="fa-welcome-panel"><span class="eyebrow">Min forening</span><h1>Hvilken forening vil du åbne?</h1><div class="fa-membership-choices">${memberships().map(m => `<a href="${esc(workURL(m.associationId))}"><strong>${esc(m.association?.name || m.associationId)}</strong><span>${m.role === 'manager' ? 'Foreningsansvarlig' : 'Redaktør'} →</span></a>`).join('')}</div></section>`;
  const id = r.params.get('forening') || memberships()[0].associationId;
  const membership = memberships().find(m => m.associationId === id);
  if (!membership) return noAccess();
  const { association: a } = await api('/associations/' + idPath(id));
  const requestedTab = r.params.get('fane') || 'overblik';
  const tab = requestedTab === 'arrangementer' ? 'overblik' : requestedTab;
  const tabs = [['overblik', 'Overblik'], ['profil', 'Foreningens oplysninger'], ['personer', 'Personer med adgang']];
  const top = `<header class="fa-workspace-header">${associationPhoto(a)}<div><span class="eyebrow">Min forening</span><h1>${esc(a.name)}</h1><p class="fa-login-email">${esc(session.user.email)} · ${membership.role === 'manager' ? 'Foreningsansvarlig' : 'Redaktør'}</p><a href="${esc(publicURL(id))}">Se den offentlige side →</a></div></header>` +
    (memberships().length > 1 ? '<p>' + link('Skift forening', '#arbejdsrum') + '</p>' : '') +
    `<nav class="fp-tabs" aria-label="Min forening">${tabs.map(([key, label]) => `<a href="${esc(workURL(id, key))}"${tab === key ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>`;
  if (tab === 'profil') return top + `<section class="fa-profile-editor"><h2>Foreningens oplysninger</h2>${profileForm(a)}</section>`;
  if (tab === 'personer') return top + await memberPage(a, membership.role === 'manager' || admin());
  const { events } = await api('/me/events');
  const ownEvents = events.filter(e => (e.associationId || e.data?.associationId) === id);
  const date = e => (e.data || e.published || {}).date || '';
  const upcoming = ownEvents.filter(e => date(e) >= today()).sort((a,b) => date(a).localeCompare(date(b)));
  const past = ownEvents.filter(e => date(e) < today()).sort((a,b) => date(b).localeCompare(date(a)));
  return top + `<div class="fa-workspace-actions"><a class="btn" href="${esc('kalender.html?' + new URLSearchParams({ opret: '1', forening: id }))}">Opret arrangement</a>${link('Ret foreningens oplysninger', workURL(id, 'profil'), true)}</div><section class="fa-workspace-events"><h2>Jeres arrangementer</h2>${upcoming.length ? privateEvents(upcoming) : '<div class="fa-welcome-panel"><h3>Hvad har I på programmet?</h3><p>Opret jeres næste arrangement, så det kan findes i byens kalender.</p></div>'}${past.length ? `<details class="fa-past-events"><summary>Tidligere arrangementer (${past.length})</summary>${privateEvents(past)}</details>` : ''}</section>`;
}
function privateEvents(events) {
  return events.map(e => {
    const data = e.data || e.published || {};
      return `<article class="fp-list-row"><h3>${esc(data.title)}</h3><p>${esc(dateLabel(data.date))} kl. ${esc(data.time)} · ${esc(data.location)}</p><div class="fa-status-row">${status(e.pendingKind ? 'pending' : e.status === 'approved' ? 'published' : e.status)}${data.state === 'cancelled' || e.published?.state === 'cancelled' ? status('cancelled') : ''}${e.pendingKind ? status(e.pendingKind) : ''}</div>${e.note ? `<p>${esc(e.note)}</p>` : ''}${mailWarnings(e)}<div class="fp-actions">${link('Ret eller aflys', calendarURL('ret', e.id))}${e.published ? link('Se i kalenderen', calendarURL('arrangement', e.id)) : ''}</div></article>`;
  }).join('') || empty('Der er ingen arrangementer endnu.');
}
async function memberPage(a, canManage, isAdmin = false) {
  const { members } = await api('/associations/' + idPath(a.id) + '/members');
  return `<h3>Personer med adgang</h3><p>Disse personer kan rette profilen og udgive arrangementer. Offentlig kontaktperson står på profilen.</p>` +
    members.map(m => `<article class="fp-list-row fa-member"><div><strong>${esc(m.name || m.email)}</strong><p>${esc(m.email)} · ${m.role === 'manager' ? 'Foreningsansvarlig' : 'Redaktør'}</p>${status(m.status)}</div>` +
      (canManage && (isAdmin || m.role === 'editor') && m.email.toLowerCase() !== session.user.email.toLowerCase() ? `${formStart('revoke-member', `data-association="${esc(a.id)}" data-member="${esc(m.id)}" data-email="${esc(m.email)}"`)}${button('Fjern adgang')}${resultBox()}</form>` : '') + '</article>').join('') +
    (!members.length ? empty('Ingen personer har adgang endnu.') : '') +
    (canManage ? `<section class="fp-panel fa-section fa-form-narrow"><h3>${isAdmin ? 'Tilknyt en person' : 'Invitér en redaktør'}</h3>${formStart(isAdmin ? 'admin-member' : 'invite-member', `data-id="${esc(a.id)}"`)}${input('name', 'Navn', '', 'text', 'required maxlength="100"')}${input('email', 'E-mail', '', 'email', 'required maxlength="254"')}${isAdmin ? '<label>Adgang<select name="role"><option value="manager">Foreningsansvarlig</option><option value="editor">Redaktør</option></select></label>' + check('verified', 'Jeg har kontrolleret personens tilknytning til foreningen', true) : '<p class="fp-note">Redaktøren kan rette profilen og udgive arrangementer. Personen skal logge ind med denne e-mail.</p>'}${button(isAdmin ? 'Tilknyt person' : 'Send invitation')}${resultBox()}</form></section>` : '<p class="fp-notice">Den foreningsansvarlige kan invitere og fjerne redaktører.</p>');
}
async function adminPage(r) {
  const tab = r.params.get('fane') || 'afventer';
  const tabs = [['afventer', 'Afventer godkendelse'], ['arrangementer', 'Alle arrangementer'], ['adgang', 'Adgangsanmodninger'], ['foreninger', 'Foreninger og ansvarlige'], ['print', 'Printudgaver']];
  const top = heading('TEBs arbejdsområde') + '<p class="fp-note"><a href="kalender.html#godkendelse">Tidligere opslag til godkendelse</a></p>' + `<nav class="fp-tabs" aria-label="TEB administration">${tabs.map(([key, label]) => `<a href="${esc(adminURL(key))}"${tab === key ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>`;
  if (tab === 'adgang') return top + await adminAccess();
  if (tab === 'foreninger') return top + await adminAssociations(r.params.get('forening'));
  if (tab === 'print') return top + await printPage();
  const { events } = await api('/admin/events');
  if (tab === 'arrangementer') return top + heading('Alle arrangementer', 'Åbn et arrangement for at rette eller aflyse det.') + privateEvents(events);
  const pending = events.filter(e => Boolean(e.pendingKind));
  return top + heading('Afventer godkendelse', 'Gennemgå indholdet, før du godkender. Afvisninger skal have en begrundelse.') +
    (pending.map(reviewForm).join('') || empty('Der er ingen arrangementer, der afventer godkendelse.'));
}
function eventSummary(e) {
  return `<p><strong>${esc(e.title)}</strong><br>${esc(e.association)}<br>${esc(dateLabel(e.date))} kl. ${esc(e.time)}${e.endDate || e.endTime ? ` til ${esc(e.endDate ? dateLabel(e.endDate) : dateLabel(e.date))} kl. ${esc(e.endTime || '')}` : ''}<br>${esc(e.location)}</p><p class="fa-preline">${esc(e.description)}</p><p>${esc(e.price)}${e.link ? `<br>${esc(e.link)}` : ''}</p>${e.state === 'cancelled' ? status('cancelled') : ''}`;
}
function sharingWishes(e) {
 const names={flyers:'Flyers i postkasser',portals:'Analoge byportaler',screens:'Infoskærme',posters:'Plakater i byen'};
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
    `${mailWarnings(e)}${formStart('review-event', `data-id="${esc(e.id)}" data-snapshot="${esc(snapshotKey)}" data-revision="${esc(e.revision)}"`)}<h3>${e.pendingKind === 'cancel' ? 'Anmodning om aflysning' : 'Indsendt indhold'}</h3>${eventInputs(data)}${textarea('note', 'Besked til afsenderen. Skal udfyldes ved afvisning.', e.note || '', 'maxlength="500"')}<div class="fp-actions">${button(e.pendingKind === 'cancel' ? 'Godkend aflysning' : 'Godkend og offentliggør', 'approve')}${button('Afvis', 'reject', 'formnovalidate')}</div>${resultBox()}</form></details>`;
}
async function adminAccess() {
  const [{ requests }, { associations }] = await Promise.all([api('/admin/access-requests'), api('/associations')]);
  const pending = requests.filter(r => r.status === 'pending');
  const history = requests.filter(r => r.status !== 'pending');
  return heading('Adgangsanmodninger', 'Kontrollér personens tilknytning, før du godkender som foreningsansvarlig.') +
    (pending.map(r => `<article class="fp-panel fa-section"><h3>${esc(associations.find(a => a.id === r.associationId)?.name || r.newAssociationName || 'Forening')}</h3><p><strong>${esc(r.name)}</strong><br>${esc(r.email)}</p><p class="fa-preline">${esc(r.roleNote)}</p>${formStart('review-access', `data-id="${esc(r.id)}"`)}${check('verified', 'Jeg har kontrolleret personens tilknytning til foreningen')}${textarea('note', 'Besked til personen', '', 'maxlength="1500"')}<div class="fp-actions">${button('Godkend som ansvarlig', 'approve')}${button('Afvis', 'reject')}</div>${resultBox()}</form></article>`).join('') || empty('Der er ingen adgangsanmodninger, der afventer svar.')) +
    (history.length ? `<section class="fa-section"><h3>Tidligere svar</h3>${history.map(r => `<article class="fp-list-row"><strong>${esc(r.name)}</strong><p>${esc(r.email)} · ${esc(associations.find(a => a.id === r.associationId)?.name || r.newAssociationName)}</p>${status(r.status)}</article>`).join('')}</section>` : '');
}
async function adminAssociations(id) {
  const { associations } = await api('/associations');
  const listing = `<div class="fp-grid">${associations.map(a => `<article class="fp-card"><h3>${esc(a.name)}</h3>${link('Profil og personer med adgang', adminURL('foreninger', a.id))}</article>`).join('') || empty('Der er ingen foreninger endnu.')}</div>`;
  if (id === 'ny') return heading('Opret forening') + `<p>${link('Alle foreninger', adminURL('foreninger'))}</p><section class="fp-panel fa-form-narrow">${profileForm({}, true)}</section>`;
  if (id) {
    const { association: a } = await api('/associations/' + idPath(id));
    return heading(a.name) + `<p>${link('Alle foreninger', adminURL('foreninger'))} · ${link('Offentlig profil', publicURL(id))}</p><section class="fp-panel fa-form-narrow">${profileForm(a)}</section><section class="fa-section">${await memberPage(a, true, true)}</section>`;
  }
  return heading('Foreninger og ansvarlige') + `<p>${link('Opret forening', adminURL('foreninger', 'ny'), true)}</p>` + listing;
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
  const loginAction = ['request-code', 'resend-code', 'verify-code'].includes(action);
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
          challenge = { id: response.challengeId, email };
          localMode = localMode || response.mode === 'local';
          flash = response.deliveryState === 'failed' ? 'Koden kunne ikke sendes. Bed om en ny kode om lidt, eller kontakt TEB.'
            : response.deliveryState === 'uncertain' ? 'Vi kan ikke bekræfte, om koden blev sendt. Tjek din mail, og bed om en ny kode, hvis den ikke kommer.'
            : response.deliveryState === 'pending' ? 'Koden venter på afsendelse. Tjek din mail om lidt.'
            : '';
          await render();
          document.querySelector('[name="code"]')?.focus();
          break;
        }
        case 'verify-code': {
          await api('/auth/verify', { body: { challengeId: form.dataset.challenge, code: form.elements.code.value.trim() } });
          session = await getSession();
          if (!authenticated()) throw new Error('Login kunne ikke bekræftes. Prøv igen.');
          challenge = null;
          const target = returnTarget();
          if (target) { location.assign(target); return; }
          flash = 'Du er logget ind.';
          location.hash = admin() ? '#teb' : '#arbejdsrum';
          break;
        }
        case 'logout': {
          await api('/auth/logout', { body: {} });
          session = null;
          challenge = null;
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
          flash = 'Foreningen er oprettet. Tilknyt en ansvarlig nedenfor.';
          location.hash = adminURL('foreninger', association.id);
          break;
        }
        case 'invite-member':
        case 'admin-member': {
          const data = values(form, action === 'admin-member' ? ['email', 'name', 'role'] : ['email', 'name']);
          if (!window.confirm(`${action === 'admin-member' ? 'Tilknyt' : 'Invitér'} ${data.email} til denne forening?`)) return;
          const path = action === 'admin-member' ? '/admin/associations/' + idPath(form.dataset.id) + '/members' : '/associations/' + idPath(form.dataset.id) + '/invitations';
          const response = await api(path, { body: data });
          await refresh(deliveryMessage(response, action === 'admin-member' ? 'Adgangen' : 'Invitationen'));
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
    showMessage(box.isConnected ? box : notice, loginAction && error.status === 401 ? 'Koden er forkert eller udløbet. Prøv igen, eller bed om en ny kode.' : errorText(error), true);
    if (error.status === 401) { session = null; navigation(currentRoute.page); }
  } finally {
    delete form.dataset.pending;
    if (loginAction) loginPending = false;
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
  if (event.target.id === 'association-search') filterDirectory();
});
document.addEventListener('change', event => {
  if (event.target.matches('[data-profile-image]')) { uploadProfileImage(event.target); return; }
  if (event.target.id === 'association-category') filterDirectory();
  if (event.target.matches('[data-access-choice]')) {
    const group = event.target.form.querySelector('[data-new-association]');
    const existing = Boolean(event.target.value);
    group.hidden = existing;
    group.querySelector('input').disabled = existing;
    group.querySelector('input').required = !existing;
  }
});
document.addEventListener('click', event => {
  if (event.target.closest('[data-change-email]')) {
    if (loginPending) return;
    challenge = null;
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
  const filterToggle = event.target.closest('#association-filter-toggle');
  if (filterToggle) {
    directoryFiltersOpen = !directoryFiltersOpen;
    filterToggle.setAttribute('aria-expanded', String(directoryFiltersOpen));
    document.querySelector('#association-filters').hidden = !directoryFiltersOpen;
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
