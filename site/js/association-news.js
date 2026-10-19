import {api, getSession, escapeHTML as esc, requestKey, randomToken, dateText, showMessage, today} from './portal-api.js';

export function newsImage(value) {
  if (/^\/api\/kalender\/association-images\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(value || '')) return value;
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; }
}
export const newsURL = id => 'forening.html#opslag?' + new URLSearchParams({id});
export function newsCards(posts, {small = false} = {}) {
  if (!posts.length) return '<p class="fa-quiet-empty">Der er ikke delt nyheder endnu.</p>';
  return '<div class="fa-news-grid' + (small ? ' is-small' : '') + '">' + posts.map(p =>
    '<article class="fa-news-card">' + (!small && newsImage(p.image) ? '<img src="' + esc(newsImage(p.image)) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '') +
    '<div><p class="fp-note">' + esc(p.author) + ' · ' + esc(dateText(p.createdAt.slice(0,10))) + '</p>' +
    '<h3><a href="' + esc(newsURL(p.id)) + '">' + esc(p.title) + '</a></h3><p>' + esc(p.description) +
    '</p><a class="fa-news-read" href="' + esc(newsURL(p.id)) + '">Læs nyheden →</a></div></article>').join('') + '</div>';
}
const field = (name, label, value = '', type = 'text', attrs = '') =>
  '<label>' + label + '<input name="' + name + '" type="' + type + '" value="' + esc(value) + '" ' + attrs + '></label>';
const area = (name, label, value = '', attrs = '') =>
  '<label>' + label + '<textarea name="' + name + '" ' + attrs + '>' + esc(value) + '</textarea></label>';

async function imageFile(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw Error('Vælg et JPG-, PNG- eller WebP-billede.');
  if (file.size > 16 * 1024 * 1024) throw Error('Vælg et billede under 16 MB.');
  const url = URL.createObjectURL(file), image = new Image();
  try {
    image.src = url; await image.decode();
    if (image.naturalWidth * image.naturalHeight > 50000000) throw Error('Billedet er for stort.');
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/webp',.82));
    if (!blob || blob.size > 2 * 1024 * 1024) throw Error('Vælg et mindre billede.');
    return blob;
  } finally { URL.revokeObjectURL(url); }
}

export async function mountNewsEditor(root, params) {
  const session = await getSession(), id = params.get('id'), associationId = params.get('forening');
  let associations = session.memberships.map(m => m.association).filter(Boolean), existing = null;
  if (session.user?.isAdmin) associations = (await api('/associations')).associations;
  if (id) existing = (await api('/member/posts/' + encodeURIComponent(id))).post;
  if (!root.isConnected) return;
  const direct = Boolean(session.user?.isAdmin || associations.length);
  const selected = existing ? existing.associationId : (associations.some(a => a.id === associationId) ? associationId : associations[0]?.id);
  const data = existing?.data || {}, back = session.user?.isAdmin ? 'forening.html#teb?fane=arrangementer' : selected ? 'forening.html#arbejdsrum?' + new URLSearchParams({forening:selected}) : 'forening.html';
  root.innerHTML = '<a class="fa-back-link" href="' + esc(back) + '">← Tilbage</a><h1>' + (id ? 'Ret nyheden' : 'Skriv en nyhed') + '</h1>' +
    '<div class="fa-news-editor"><form class="fp-form fp-panel" id="news-editor-form">' +
    (direct && selected && associations.length ? id ? '<p>Forening: ' + esc(associations.find(a => a.id === selected)?.name || data.author) + '</p><input type="hidden" name="associationId" value="' + esc(selected) + '">' : '<label>Forening<select name="associationId">' + associations.map(a => '<option value="' + esc(a.id) + '"' + (a.id === selected ? ' selected' : '') + '>' + esc(a.name) + '</option>').join('') + '</select></label>' : field('author','Afsender', data.author || (direct ? 'TEB' : ''),'text','required maxlength="100"' + (id ? ' readonly' : ''))) +
    field('title','Overskrift',data.title,'text','required maxlength="100"') +
    area('description','Kort beskrivelse',data.description,'required maxlength="1500"') +
    area('body','Hele historien · valgfrit',data.body,'maxlength="6000"') +
    '<input type="hidden" name="image" value="' + esc(data.image || '') + '">' +
    (direct && selected && associations.length ? '<label class="fa-file-choice">Vælg billede<input type="file" name="photo" accept="image/jpeg,image/png,image/webp"></label><p class="fp-note">Vælg et billede fra telefonen eller computeren, som I må dele.</p>' : field('imageLink','Billedadresse · valgfrit',data.image,'url','placeholder="https://"')) +
    '<div class="fa-news-image-preview"></div>' + field('link','Læs mere-link · valgfrit',data.link,'url','placeholder="https://"') +
    (!direct ? field('email','Din e-mail',session.user?.email || '','email','required autocomplete="email"') + '<p class="fp-note">Bruges til kvittering. Vises ikke offentligt.</p>' : '') +
    '<div class="fa-news-trap" aria-hidden="true">' + field('website','Lad feltet stå tomt','','text','tabindex="-1" autocomplete="off"') + '</div>' +
    '<div class="fa-news-result" role="status" aria-live="polite"></div><div class="fp-actions"><button class="btn" type="submit">' +
    (direct ? id ? 'Gem og udgiv' : 'Udgiv nyhed' : 'Send til TEB') + '</button><a href="' + esc(back) + '">Fortryd</a></div></form>' +
    '<aside class="fa-news-live-preview"><p class="eyebrow">Privat forhåndsvisning</p><p class="fp-note">Indholdet er ikke gemt endnu.</p><div data-news-preview></div>' +
    '<p class="fp-note">' + (direct ? 'Nyheden bliver offentlig, når du udgiver.' : 'TEB skal godkende indholdet, før det bliver offentligt.') + '</p></aside></div>';
  const form = root.querySelector('form'), result = root.querySelector('.fa-news-result');
  const startedAt = Date.now(); let attempt = null, submitting = false, uploading = false;
  const values = () => {
    const read = name => form.elements[name]?.value || '', aid = read('associationId');
    return {kind:'news', title:read('title').trim(), description:read('description').trim(),
      body:read('body').trim(), image:form.elements.imageLink ? form.elements.imageLink.value.trim() : form.elements.image.value,
      author:associations.find(a => a.id === aid)?.name || read('author').trim(),
      link:read('link').trim()};
  };
  const preview = () => {
    const p = values();
    root.querySelector('[data-news-preview]').innerHTML = newsCards([{...p,id:'preview',title:p.title || 'Din overskrift',
      description:p.description || 'Din korte beskrivelse',createdAt:today()}]);
    root.querySelector('[data-news-preview] a').removeAttribute('href');
    root.querySelector('[data-news-preview] .fa-news-read').remove();
    root.querySelector('.fa-news-image-preview').innerHTML = p.image ? '<button class="fa-text-button" type="button" data-clear-news-image>Fjern billedet</button>' : '';
  };
  const lock = value => form.querySelectorAll('input,textarea,select,button').forEach(n => n.disabled = value);
  form.addEventListener('input', preview);
  form.addEventListener('click', event => { if(!event.target.closest('[data-clear-news-image]') || uploading || submitting)return; form.elements.image.value=''; if(form.elements.imageLink)form.elements.imageLink.value=''; if(form.elements.photo)form.elements.photo.value=''; preview(); });
  form.elements.associationId?.addEventListener('change', () => { form.elements.image.value = ''; if(form.elements.photo)form.elements.photo.value = ''; preview(); });
  form.elements.photo?.addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file || submitting || uploading) return;
    uploading = true; lock(true); showMessage(result,'Billedet bliver klargjort…');
    try {
      const blob = await imageFile(file);
      const response = await fetch('/api/kalender/associations/' + encodeURIComponent(form.elements.associationId.value) + '/image',
        {method:'POST',credentials:'same-origin',headers:{'Content-Type':blob.type},body:blob,signal:AbortSignal.timeout(30000)});
      const saved = await response.json();
      if (!response.ok || !newsImage(saved.imageUrl)) throw Error(saved.error || 'Billedet kunne ikke gemmes.');
      if (!root.isConnected) return;
      form.elements.image.value = saved.imageUrl; preview(); showMessage(result,'Billedet er klar. Udgiv nyheden for at vise det.');
    } catch(error) { if(root.isConnected)showMessage(result,error.message,true); }
    finally { uploading = false; lock(false); }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (submitting || uploading || !form.reportValidity()) return;
    if (!attempt) attempt = id ? {action:'update',revision:existing.revision,post:values()} :
      {post:values(),requestKey:requestKey(),startedAt,website:form.elements.website.value,
        ...(direct ? {associationId:form.elements.associationId?.value} : {email:form.elements.email.value.trim(),authorToken:randomToken()})};
    submitting = true; lock(true);
    try {
      const saved = await api(id ? '/member/posts/' + encodeURIComponent(id) : '/posts',{body:attempt});
      const savedId = id || saved.id;
      if (!/^[a-f0-9-]{36}$/.test(savedId || '') || (id && (saved.post?.id !== id || saved.post.revision !== existing.revision + 1))) throw Error('Gemningen kunne ikke bekræftes.');
      if (!root.isConnected) return;
      const isPublic = id || saved.published;
      root.innerHTML = '<section class="fa-welcome-panel"><p class="eyebrow">' + (isPublic ? 'Udgivet' : 'Afventer TEB') + '</p><h1>' +
        (isPublic ? 'Nyheden er udgivet.' : 'Tak. TEB har modtaget nyheden.') + '</h1><p>' +
        (isPublic ? selected ? 'Nyheden kan nu ses på foreningens side og på Det sker.' : 'Nyheden kan nu ses på Det sker.' : 'Nyheden bliver synlig, når TEB har godkendt den.') + '</p><div class="fp-actions">' +
        (isPublic ? '<a class="btn" href="' + esc(newsURL(savedId)) + '">Se nyheden</a><a href="' + esc(back) + '">Tilbage til jeres side</a>' :
          '<a class="btn" href="kalender.html?indsendelse=' + encodeURIComponent(savedId) + '#adgang=' + attempt.authorToken + '">Gem dit private link til status</a>') +
        '</div><div data-delivery-note></div></section>';
      const mail = saved.receiptState || saved.notificationState;
      if (['local','pending','failed','uncertain'].includes(mail)) showMessage(root.querySelector('[data-delivery-note]'),
        mail === 'local' ? 'Lokal afprøvning. Ingen mail er sendt. Gem det private link.' :
          'Nyheden er gemt. Maillevering er ikke bekræftet. Gem det private link.');
    } catch(error) {
      const uncertain = !error.status || error.status >= 500;
      if (!uncertain) { attempt = null; lock(false); }
      else if(!id) form.querySelector('[type=submit]').disabled = false;
      if (root.isConnected) {
        showMessage(result,error.message + (uncertain && !id ? ' Prøv samme indsendelse igen.' : ''),true);
        if(error.status===409||uncertain&&id){
          const a=document.createElement('a');a.href=location.href;a.textContent='Hent den seneste version';a.onclick=e=>{e.preventDefault();location.reload();};result.append(a);
        }
      }
    } finally { submitting = false; }
  });
  preview();
}
