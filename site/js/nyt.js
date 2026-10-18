(async function () {
  'use strict';
  const list = document.getElementById('local-news');
  const status = document.getElementById('local-news-status');
  if (!list || !status) return;
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  try {
    const response = await fetch('/api/kalender/nyheder/tistrup-nyt', { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error('Unavailable');
    const data = await response.json();
    if (!Array.isArray(data.items) || !data.items.length) throw new Error('Empty');
    const cards = document.createDocumentFragment();
    for (const item of data.items) {
      const url = new URL(item.url);
      if (url.protocol !== 'https:' || !['tistrupnyt.dk', 'www.tistrupnyt.dk'].includes(url.hostname)) continue;
      const article = element('article', 'news-card');
      const link = element('a', 'news-card-link');
      link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
      if (item.image) {
        const imageUrl = new URL(item.image);
        if (imageUrl.protocol === 'https:' && ['ruban.nu', 'tistrupnyt.dk', 'www.tistrupnyt.dk'].includes(imageUrl.hostname)) {
          const image = element('img', 'news-card-image');
          image.src = imageUrl.href; image.alt = ''; image.loading = 'lazy'; image.decoding = 'async';
          image.width = 766; image.height = 511; image.referrerPolicy = 'no-referrer';
          image.addEventListener('error', () => { image.hidden = true; }, { once: true });
          link.append(image);
        }
      }
      const body = element('div', 'news-card-body');
      body.append(element('span', 'news-source', 'Tistrup Nyt'), element('h3', '', item.title));
      if (item.summary) body.append(element('p', '', item.summary));
      body.append(element('span', 'text-link', 'Læs hos Tistrup Nyt ↗'));
      link.append(body); article.append(link); cards.append(article);
    }
    if (!cards.childNodes.length) throw new Error('Empty');
    list.replaceChildren(cards);
    const date = new Date(data.fetchedAt);
    const updated = Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('da-DK', {
      dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Copenhagen'
    }).format(date);
    status.textContent = data.stale
      ? `Vi kan ikke opdatere lige nu. Viser senest hentede nyheder${updated ? ' fra ' + updated : ''}.`
      : `Hentet fra Tistrup Nyt${updated ? ' ' + updated : ''}.`;
  } catch {
    status.textContent = 'Nyhederne kan ikke vises lige nu. Du kan stadig læse dem hos Tistrup Nyt.';
    list.replaceChildren();
  } finally { list.setAttribute('aria-busy', 'false'); }
})();
