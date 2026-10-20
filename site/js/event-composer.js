import {sharingGuideHTML} from './event-sharing.js';
import {api, getSession, requestKey, randomToken, today, dateText, escapeHTML as esc} from './portal-api.js';

const drafts = new Map();
let active = null;
const exampleImage = '/images/kalender-september-oktober-2026.jpg';
const draftPrefix = 'teb:event-draft:v1:';
const fields = ['title', 'association', 'date', 'time', 'endDate', 'endTime', 'location', 'description', 'price', 'link'];
const imagePath = /^\/api\/kalender\/event-images\/[a-f0-9-]{36}\.(?:jpg|png|webp)$/;
const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 11h16m-11 4h6m-3-3v6"/></svg>';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
function safeLink(value) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
function readDraft(key) {
  try { return JSON.parse(sessionStorage.getItem(draftPrefix + key)) || {}; } catch { return {}; }
}
function message(container, text, error = false) {
  container.textContent = text;
  container.classList.toggle('is-error', error);
  container.setAttribute('role', error ? 'alert' : 'status');
}
function showToast(text, reopen) {
  document.querySelector('.ec-toast')?.remove();
  const toast = el('div', 'ec-toast');
  toast.setAttribute('role', 'status');
  toast.append(el('span', '', text));
  if (reopen) {
    const button = el('button', '', 'Fortsæt');
    button.type = 'button'; button.onclick = () => { toast.remove(); reopen(); };
    toast.append(button);
  }
  const close = el('button', '', '×');
  close.type = 'button'; close.setAttribute('aria-label', 'Luk besked'); close.onclick = () => toast.remove();
  toast.append(close); document.body.append(toast);
}
function mountedDialog() {
  const dialog = el('dialog', 'ec-dialog');
  dialog.setAttribute('aria-labelledby', 'ec-title');
  dialog.innerHTML = '<div class="ec-loading" role="status">Henter formularen…</div>';
  document.body.append(dialog);
  dialog.showModal();
  document.body.classList.add('ec-modal-open');
  return dialog;
}

export function installEventComposer() {
  document.addEventListener('click', event => {
    const anchor = event.target.closest('a[href]');
    if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || anchor.target === '_blank') return;
    const url = new URL(anchor.href, location.href);
    if (url.origin !== location.origin || !url.pathname.endsWith('/kalender.html') || url.searchParams.get('opret') !== '1') return;
    event.preventDefault();
    openEventComposer({associationId: url.searchParams.get('forening') || ''});
  });
}

export async function openEventComposer({associationId = '', onSaved} = {}) {
  if (active?.open) { active.querySelector('input,button')?.focus(); return; }
  const opener = document.activeElement;
  const loading = mountedDialog(); active = loading;
  let dismissed = false;
  loading.addEventListener('close', () => { dismissed = true; if (active === loading) { document.body.classList.remove('ec-modal-open'); active = null; } loading.remove(); });
  try {
    const [session, config] = await Promise.all([getSession(), api('/config')]);
    if (dismissed) return;
    if (!config.submissionsEnabled) throw new Error('Indsendelse er ikke åben lige nu. Prøv igen senere.');
    let associations = (session.memberships || []).map(m => m.association).filter(Boolean);
    if (session.user?.isAdmin) associations = (await api('/associations')).associations;
    if (dismissed) return;
    associations = [...new Map(associations.map(a => [a.id, a])).values()];
    const key = (session.user?.id || 'guest') + ':' + (associationId || (associations.length === 1 ? associations[0].id : ''));
    let composer = drafts.get(key);
    if (!composer) {
      composer = makeComposer({key, associationId, associations, session, config, onSaved});
      drafts.set(key, composer);
    }
    loading.close();
    composer.open(opener);
  } catch (error) {
    if (dismissed) return;
    loading.innerHTML = '<div class="ec-loading"><h2 id="ec-title">Formularen kunne ikke åbnes</h2><p></p><button class="ec-primary" type="button">Prøv igen</button> <button class="ec-text" type="button">Luk</button></div>';
    loading.querySelector('p').textContent = error.message;
    loading.querySelector('.ec-primary').onclick = () => { loading.close(); openEventComposer({associationId, onSaved}); };
    loading.querySelector('.ec-text').onclick = () => loading.close();
    loading.querySelector('button').focus();
  }
}

function makeComposer({key, associationId, associations, session, config, onSaved}) {
  const saved = readDraft(key);
  const guest = !associations.length;
  let selectedId = associations.some(a => a.id === saved.associationId) ? saved.associationId : associations.some(a => a.id === associationId) ? associationId : associations.length === 1 ? associations[0].id : '';
  let imageData = typeof saved.imageData === 'string' && /^data:image\/webp;base64,/.test(saved.imageData) ? saved.imageData : '';
  let imageUrl = imagePath.test(saved.imageUrl || '') ? saved.imageUrl : '';
  let busy = false, complete = false, attempt = null, returnFocus = null, imagePending = false;
  const startedAt = Date.now();
  const dialog = el('dialog', 'ec-dialog');
  dialog.setAttribute('aria-labelledby', 'ec-title');
  dialog.innerHTML = `
    <div class="ec-shell">
      <header class="ec-header">
        <div class="ec-header-top"><span class="ec-eyebrow">${icon} Tistrup og Hodde</span><button type="button" class="ec-close" aria-label="Luk og gem kladde">×</button></div>
        <h2 id="ec-title" tabindex="-1">Tilføj et arrangement.</h2>
        <p class="ec-intro">Udfyld oplysningerne. Invitationen opdateres undervejs.</p><button type="button" class="ec-text ec-sharing-shortcut">Se muligheder for tryk, omdeling og skærme ↓</button>
      </header>
      <div class="ec-body">
        <div class="ec-compose">
          <div class="ec-layout">
            <form id="ec-form" class="ec-form">
              <section class="ec-section"><h3>Hvad inviterer I til?</h3>
                <label>Arrangementets navn<input name="title" required maxlength="100" placeholder="Fx fællesspisning i forsamlingshuset" autocomplete="off"></label>
                ${guest ? '<label>Arrangør<input name="association" required maxlength="100" placeholder="Forening, fællesskab eller dit navn"></label>' : `<label>Forening<select name="associationId" required><option value="">Vælg forening</option>${associations.map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}</select></label><input name="association" type="hidden">`}
                <div class="ec-field-row"><label>Dato<input name="date" type="date" required min="${today()}"></label><label>Klokken<input name="time" type="time" required></label></div>
                <details class="ec-optional"><summary>Tilføj sluttid eller flere dage</summary><div class="ec-field-row"><label>Slutdato <span>valgfrit</span><input name="endDate" type="date"></label><label>Sluttid <span>valgfrit</span><input name="endTime" type="time"></label></div></details>
                <label>Hvor foregår det?<input name="location" required maxlength="180" placeholder="Fx Hodde-Tistrup Hallen"></label>
                <label>Kort om arrangementet <span>valgfrit</span><textarea name="description" maxlength="1500" rows="3" placeholder="Hvad kan man glæde sig til, og hvem er det for?"></textarea></label>
                <div class="ec-field-row"><label>Pris <span>valgfrit</span><input name="price" maxlength="100" placeholder="Fx gratis eller 50 kr."></label><label>Link til tilmelding <span>valgfrit</span><input name="link" type="url" maxlength="500" placeholder="https://"></label></div>
              </section>
              <section class="ec-section"><h3>Giv invitationen et billede <span>valgfrit</span></h3>
                <div class="ec-image-choice"><div class="ec-image-mini" hidden><img alt="Dit valgte arrangementsbillede"></div><div class="ec-image-copy"><label class="ec-upload">${icon}<span>Vælg et billede<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="ec-image-help"></span></label><p id="ec-image-help">Et foto, I må bruge. JPG, PNG eller WebP, op til 20 MB.</p><button class="ec-text ec-remove-image" type="button" hidden>Fjern billedet</button></div></div>
                <p class="ec-image-message" aria-live="polite"></p>
              </section>
              ${sharingGuideHTML({choices: true, composer: true})}
              ${guest ? '<section class="ec-section ec-contact"><label>Din e-mail<input name="email" required type="email" maxlength="254" autocomplete="email" placeholder="din@email.dk"></label><p>Her får du kvittering og et privat link til at rette arrangementet. Mailadressen vises ikke offentligt.</p><p>Har du foreningsadgang? <a href="forening.html?return=kalender.html%3Fopret%3D1#login">Log ind her</a>.</p></section>' : '<p class="ec-access-note">Du opretter med din foreningsadgang. Arrangementet udgives, når du bekræfter.</p>'}
              <div class="ec-trap" aria-hidden="true"><label>Lad feltet stå tomt<input name="website" tabindex="-1" autocomplete="off"></label></div>
            </form>
            <aside class="ec-live" aria-label="Forhåndsvisning"><span class="ec-eyebrow">Din invitation</span>
          <div class="ec-preview-tabs" role="group" aria-label="Vælg forhåndsvisning"><button type="button" data-preview="web" aria-pressed="true">I kalenderen</button><button type="button" data-preview="print" aria-pressed="false">På tryk</button></div>
          <div class="ec-web-preview"><details class="ec-invitation"><summary><div class="ec-live-card"></div><span class="ec-open-label">Åbn invitationen ↗</span></summary><div class="ec-invitation-details"></div></details></div>
          <div class="ec-print-preview" hidden>
            <div class="ec-print-layout"><div><span class="ec-eyebrow">Eksempel på kalendertekst</span><div class="ec-print-paper"><div class="ec-print-masthead">DET SKER<br><em>I TISTRUP & HODDE</em></div><div class="ec-print-month"></div><div class="ec-print-event"></div><p>Flere oplevelser i byen på teb-tistrup.dk</p></div><p class="ec-caption">Billedet bruges på hjemmesiden. Den trykte kalender samler arrangementerne som korte tekster.</p></div><div><span class="ec-eyebrow">Se en hel udgave</span><button type="button" class="ec-poster-button" aria-expanded="false"><img src="${exampleImage}" alt="Eksempel på Tistrups trykte kalender for september og oktober 2026"><span>Forstør kalenderen ↗</span></button></div></div>
            <div class="ec-poster-full" hidden><img src="${exampleImage}" alt="Hele eksempeludgaven for september og oktober 2026"></div>
            <p class="ec-print-disclaimer">Eksempel. TEB vælger indhold og tilpasser teksten til den endelige udgave. Dit arrangement er ikke sikret en plads ved indsendelse.</p>
          </div>
          <div class="ec-review-status"></div>
            </aside>
          </div>
        </div>
        <section class="ec-receipt" hidden aria-label="Kvittering"></section>
      </div>
      <footer class="ec-footer"><div><p class="ec-save-hint">Du kan lukke og fortsætte senere i denne fane.</p><p class="ec-form-message" aria-live="polite"></p></div><div class="ec-footer-actions"><button type="button" class="ec-text ec-preview-shortcut">Se invitationen ↑</button><button type="button" class="ec-primary ec-send">${guest ? 'Send til TEBs godkendelse' : 'Udgiv arrangement'}</button></div></footer>
    </div>`;
  const $ = selector => dialog.querySelector(selector);
  const form = $('#ec-form');
  for (const name of [...fields, 'email']) if (form.elements[name] && typeof saved[name] === 'string') form.elements[name].value = saved[name];
  if (form.elements.email && !form.elements.email.value) form.elements.email.value = session.user?.email || '';
  form.elements.printRequested.checked = saved.printRequested === true;
  const channelChecks = [...form.querySelectorAll('[name="channels"]')];
  for (const input of channelChecks) input.checked = saved.channels?.includes(input.value) === true;
  if (!guest) { form.elements.associationId.value = selectedId; form.elements.association.value = associations.find(a => a.id === selectedId)?.name || ''; }

  function values() {
    return {...Object.fromEntries(fields.map(name => [name, form.elements[name].value.trim()])), printRequested: form.elements.printRequested.checked, channels: channelChecks.filter(input => input.checked).map(input => input.value), imageUrl};
  }
  function persist() {
    if (complete) return;
    try { sessionStorage.setItem(draftPrefix + key, JSON.stringify({...values(), associationId: selectedId, email: form.elements.email?.value || '', imageData})); }
    catch { $('.ec-save-hint').textContent = 'Kladden bevares, mens siden er åben.'; }
  }
  function card(event, detailed = false) {
    const card = el('article', 'ec-event-card');
    const source = imageData || event.imageUrl;
    if (source) { const image = el('img', 'ec-event-photo'); image.src = source; image.alt = ''; card.append(image); }
    else { const graphic = el('div', 'ec-event-placeholder'); graphic.innerHTML = icon + '<span>Vi ses i byen</span>'; card.append(graphic); }
    const copy = el('div', 'ec-event-copy');
    let when = 'Dato og tidspunkt';
    if (event.date && !Number.isNaN(Date.parse(event.date))) when = dateText(event.date, {year: undefined}) + (event.time ? ' · kl. ' + event.time.replace(':', '.') : '');
    copy.append(el('p', 'ec-event-date', when), el('h3', '', event.title || 'Jeres næste arrangement'), el('p', 'ec-event-place', event.location || 'Et sted i Tistrup eller Hodde'), el('p', 'ec-event-organizer', event.association || 'Arrangørens navn'));
    if (detailed) {
      if (event.endTime || event.endDate) copy.append(el('p', 'ec-event-end', 'Slutter ' + (event.endDate ? dateText(event.endDate, {year: undefined}) + ' ' : '') + (event.endTime ? 'kl. ' + event.endTime.replace(':', '.') : '')));
      if (event.description) copy.append(el('p', 'ec-event-description', event.description));
      if (event.price) copy.append(el('p', 'ec-event-price', 'Pris: ' + event.price));
      if (safeLink(event.link)) { const link = el('a', '', 'Tilmelding og mere information ↗'); link.href = safeLink(event.link); link.target = '_blank'; link.rel = 'noopener noreferrer'; copy.append(link); }
    }
    card.append(copy); return card;
  }
  function render() {
    const event = values();
    $('.ec-live-card').replaceChildren(card(event));
    $('.ec-invitation-details').replaceChildren(card(event, true));
    $('.ec-print-month').textContent = event.date ? dateText(event.date, {day: undefined, year: undefined}) : 'Kommende arrangementer';
    const row = $('.ec-print-event'); row.replaceChildren();
    row.append(el('strong', '', (event.date ? dateText(event.date, {month: 'short', year: undefined}) : 'Dato') + (event.time ? ' · ' + event.time.replace(':', '.') : '')), el('h4', '', event.title || 'Arrangementets navn'), el('p', '', [event.location, event.association, event.price].filter(Boolean).join(' · ')));
    $('.ec-review-status').textContent = event.printRequested ? 'Dit ønske om en plads i den trykte kalender sendes med arrangementet.' : 'Forhåndsvisning. Arrangementet er ikke sendt endnu.';
    const hasImage = Boolean(imageData || imageUrl);
    $('.ec-image-mini').hidden = !hasImage;
    if (hasImage) $('.ec-image-mini img').src = imageData || imageUrl;
    $('.ec-remove-image').hidden = !hasImage;
    $('.ec-upload span').firstChild.textContent = hasImage ? 'Vælg et andet billede' : 'Vælg et billede';
    form.elements.endDate.min = form.elements.date.value;
  }
  function scrollTop() { dialog.scrollTop = 0; $('.ec-body').scrollTop = 0; }
  function setPreview(mode) {
    $('.ec-web-preview').hidden = mode !== 'web'; $('.ec-print-preview').hidden = mode !== 'print';
    dialog.querySelectorAll('[data-preview]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.preview === mode)));
  }
  function valid() {
    if (!form.reportValidity()) return false;
    const event = values(), end = event.endDate || event.date;
    if (end < event.date || event.endTime && end === event.date && event.endTime <= event.time) { message($('.ec-form-message'), 'Slutningen skal ligge efter starten.', true); return false; }
    if (event.link && !safeLink(event.link)) { message($('.ec-form-message'), 'Brug et almindeligt http- eller https-link.', true); return false; }
    message($('.ec-form-message'), ''); return true;
  }
  function close() {
    if (busy || imagePending) { message($('.ec-form-message'), imagePending ? 'Vent, mens billedet klargøres.' : 'Vent, mens arrangementet gemmes.'); return; }
    persist(); dialog.close();
  }
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close(); } });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('ec-modal-open'); if (active === dialog) active = null;
    if (location.pathname.endsWith('/kalender.html') && new URL(location.href).searchParams.has('opret')) { const url = new URL(location.href); url.searchParams.delete('opret'); url.searchParams.delete('forening'); history.replaceState(null, '', url); }
    returnFocus?.isConnected && returnFocus.focus({preventScroll: true});
    dialog.remove();
    if (!complete && (form.elements.title.value || imageData)) showToast('Din kladde er gemt i denne fane.', () => instance.open(returnFocus));
  });
  $('.ec-close').onclick = close;
  form.onsubmit = event => { event.preventDefault(); $('.ec-send').click(); };
  function focusPreview() {
    $('.ec-live').scrollTop = 0;
    if (matchMedia('(max-width: 600px)').matches) $('.ec-live').scrollIntoView({behavior: 'smooth', block: 'start'});
  }
  $('.ec-sharing-shortcut').onclick = () => { $('.ec-sharing').scrollIntoView({behavior: 'smooth', block: 'start'}); $('.ec-sharing input').focus({preventScroll: true}); };
  $('.ec-show-print').onclick = () => { setPreview('print'); focusPreview(); };
  $('.ec-preview-shortcut').onclick = focusPreview;
  $('.ec-invitation').addEventListener('toggle', () => { $('.ec-open-label').textContent = $('.ec-invitation').open ? '← Luk invitationen' : 'Åbn invitationen ↗'; });
  dialog.querySelectorAll('[data-preview]').forEach(button => { button.onclick = () => setPreview(button.dataset.preview); });
  $('.ec-poster-button').onclick = () => { const full = $('.ec-poster-full'); full.hidden = !full.hidden; $('.ec-poster-button').setAttribute('aria-expanded', String(!full.hidden)); if (!full.hidden) full.scrollIntoView({behavior: 'smooth', block: 'start'}); };
  form.addEventListener('input', event => {
    if (event.target === form.elements.printRequested) setPreview(form.elements.printRequested.checked ? 'print' : 'web');
    if (!guest) { selectedId = form.elements.associationId.value; form.elements.association.value = associations.find(a => a.id === selectedId)?.name || ''; }
    render(); persist();
  });
  $('.ec-remove-image').onclick = () => { imageData = ''; imageUrl = ''; form.elements.photo.value = ''; message($('.ec-image-message'), 'Billedet er fjernet fra kladden.'); render(); persist(); };
  form.elements.photo.onchange = async () => {
    const file = form.elements.photo.files[0]; if (!file) return;
    imagePending = true; $('.ec-send').disabled = true; $('.ec-remove-image').disabled = true;
    try {
      message($('.ec-image-message'), 'Klargør billedet…');
      const blob = await prepareImage(file);
      const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
      imageData = data; imageUrl = ''; render(); persist();
      message($('.ec-image-message'), 'Billedet er klar. Du kan se det i forhåndsvisningen.');
    } catch (error) { message($('.ec-image-message'), error.message || 'Billedet kunne ikke åbnes. Prøv et andet.', true); }
    finally { imagePending = false; $('.ec-send').disabled = false; $('.ec-remove-image').disabled = false; form.elements.photo.value = ''; }
  };
  $('.ec-send').onclick = async () => {
    if (busy || imagePending) return;
    if (!attempt && !valid()) return;
    if (!attempt) {
      attempt = {event: values(), requestKey: requestKey(), startedAt, website: form.elements.website.value, ...(guest ? {email: form.elements.email.value.trim(), authorToken: randomToken()} : {associationId: selectedId})};
    }
    busy = true;
    for (const input of form.querySelectorAll('input, select, textarea')) input.disabled = true;
    for (const button of dialog.querySelectorAll('button')) button.disabled = true;
    $('.ec-send').textContent = 'Gemmer arrangementet…';
    message($('.ec-form-message'), '');
    try {
      if (imageData && !attempt.event.imageUrl) {
        const blob = await (await fetch(imageData)).blob();
        const response = await fetch('/api/kalender/event-images', {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': blob.type}, body: blob, signal: AbortSignal.timeout(30000)});
        const result = await response.json();
        if (!response.ok || !imagePath.test(result.imageUrl || '')) throw Object.assign(new Error(result.error || 'Billedet kunne ikke gemmes.'), {status: response.status});
        imageUrl = result.imageUrl; attempt.event.imageUrl = imageUrl; persist();
      }
      const result = await api('/events', {body: attempt});
      if (!result.id) throw new Error('Kvitteringen kunne ikke bekræftes. Prøv samme indsendelse igen.');
      complete = true; drafts.delete(key);
      try { sessionStorage.removeItem(draftPrefix + key); } catch { /* Storage may be disabled. The event is still saved. */ }
      renderReceipt(result, attempt);
      try { await onSaved?.(result); } catch { /* The receipt remains valid if calendar refresh fails. */ }
      document.dispatchEvent(new CustomEvent('teb:event-saved', {detail: result}));
    } catch (error) {
      const uncertain = !error.status || error.status >= 500;
      if (!uncertain) { attempt = null; for (const input of form.querySelectorAll('input, select, textarea')) input.disabled = false; }
      message($('.ec-form-message'), error.message + (uncertain ? ' Brug knappen igen for at prøve samme indsendelse uden dubletter.' : ''), true);
      $('.ec-send').textContent = uncertain ? 'Prøv samme indsendelse igen' : guest ? 'Send til TEBs godkendelse' : 'Udgiv arrangement';
    } finally {
      busy = false;
      for (const button of dialog.querySelectorAll('button')) button.disabled = false;
    }
  };
  function renderReceipt(result, payload) {
    $('.ec-compose').hidden = true;
    $('.ec-sharing-shortcut').hidden = true;
    $('.ec-footer').hidden = true; $('.ec-receipt').hidden = false;
    $('#ec-title').textContent = result.published ? 'Så er invitationen ude.' : 'Tak. TEB har modtaget det.';
    $('.ec-intro').textContent = result.published ? 'Arrangementet er nu synligt i byens kalender.' : 'Arrangementet afventer godkendelse og er endnu ikke offentligt.';
    const receipt = $('.ec-receipt'); receipt.replaceChildren();
    receipt.append(card(payload.event));
    if (payload.event.channels.length) receipt.append(el('p', 'ec-receipt-print', 'Jeres øvrige ønsker til deling er gemt. Aftal det praktiske særskilt med den ansvarlige.'));
    if (payload.event.printRequested) receipt.append(el('p', 'ec-receipt-print', 'Dit ønske om at komme med i den trykte kalender er også gemt.'));
    if (config.mode === 'local') receipt.append(el('p', 'ec-local-note', 'Lokal afprøvning. Ingen e-mails er sendt.'));
    if (result.receiptState === 'sent') receipt.append(el('p', '', 'Kvitteringen er sendt til din e-mail.'));
    if (['failed', 'uncertain', 'pending'].includes(result.receiptState)) receipt.append(el('p', 'ec-local-note', 'Kvitteringsmailen er ikke bekræftet. Gem dit private link nedenfor.'));
    if (['failed', 'uncertain'].includes(result.notificationState)) receipt.append(el('p', 'ec-local-note', 'Beskeden til TEB er ikke bekræftet. Arrangementet er gemt. Kontakt TEB.'));
    if (guest) {
      const url = new URL('kalender.html?privat=' + encodeURIComponent(result.id) + '#adgang=' + payload.authorToken, location.href).href;
      const box = el('section', 'ec-private-link'); box.innerHTML = '<h3>Gem dit private link</h3><p>Brug linket til at se status, rette eller aflyse. Del det kun med dem, der må rette.</p>';
      const input = el('input'); input.type = 'text'; input.readOnly = true; input.value = url; input.setAttribute('aria-label', 'Dit private link'); input.onfocus = () => input.select();
      const copy = el('button', 'ec-secondary', 'Kopiér privat link'); copy.type = 'button'; copy.onclick = async () => { try { await navigator.clipboard.writeText(url); copy.textContent = 'Linket er kopieret'; } catch { input.focus(); input.select(); copy.textContent = 'Kopiér det markerede link'; } };
      const status = el('a', 'ec-text', 'Se status og ret arrangementet'); status.href = url;
      box.append(input, copy, status); receipt.append(box);
    } else {
      const link = el('a', 'ec-primary', 'Se arrangementet i kalenderen →'); link.href = 'kalender.html?arrangement=' + encodeURIComponent(result.id); receipt.append(link);
    }
    const channels = el('section', 'ec-channels');
    channels.innerHTML = sharingGuideHTML();
    receipt.append(channels);
    const done = el('button', 'ec-primary ec-done', 'Færdig'); done.type = 'button'; done.onclick = close; receipt.append(done);
    scrollTop(); $('#ec-title').focus({preventScroll: true});
  }
  const instance = {open(opener) {
    returnFocus = opener;
    document.querySelector('.ec-toast')?.remove();
    if (!dialog.isConnected) document.body.append(dialog);
    active = dialog; document.body.classList.add('ec-modal-open'); dialog.showModal();
    render(); scrollTop(); $('#ec-title').focus({preventScroll: true});
  }};
  render(); return instance;
}

async function prepareImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Vælg et JPG-, PNG- eller WebP-billede.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Vælg et billede under 20 MB.');
  const url = URL.createObjectURL(file), image = new Image();
  try {
    image.src = url; await image.decode();
    if (image.naturalWidth * image.naturalHeight > 50000000) throw new Error('Billedet er for stort. Vælg et mindre foto.');
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .84));
    if (!blob || blob.size > 2 * 1024 * 1024) throw new Error('Billedet kunne ikke klargøres. Prøv et mindre foto.');
    return blob;
  } finally { URL.revokeObjectURL(url); }
}
