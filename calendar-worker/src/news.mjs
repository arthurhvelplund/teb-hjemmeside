import { parseDocument, DomUtils } from 'htmlparser2';
import { validDate } from './shared.mjs';

const SOURCE = { id: 'tistrup-nyt', name: 'Tistrup Nyt', url: 'https://tistrupnyt.dk/menu/kalender/lokal' };
const CACHE_KEY = 'calendar-sources/tistrup-nyt-v2.json';
export const NEWS_TTL = 60 * 60 * 1000;
const RETRY_DELAY = 5 * 60 * 1000;
const MAX_BYTES = 2 * 1024 * 1024;
const clean = (text, max) => text.replace(/[\u0000-\u001f\u007f\s]+/g, ' ').trim().slice(0, max);

function sourceUrl(value) {
  try {
    const url = new URL(value, SOURCE.url);
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !['tistrupnyt.dk','www.tistrupnyt.dk'].includes(url.hostname) ||
        !/^\/cid\/\d+\/[^/]+\/?$/.test(url.pathname)) return null;
    url.hash = ''; url.search = ''; return url.href;
  } catch { return null; }
}

// Calendar headers carry explicit month/year and day. Never infer a date from a title.
export function parseTistrupNews(html) {
  const document = parseDocument(html);
  for (const name of ['script', 'style']) for (const n of DomUtils.getElementsByTagName(name, document)) DomUtils.removeElement(n);
  const months = ['januar','februar','marts','april','maj','juni','juli','august','september','oktober','november','december'];
  const events = [], seen = new Set();
  let year = '', month = '', date = '', recognized = false;
  for (const n of DomUtils.findAll(n => n.type === 'tag', document.children)) {
    const classes = (n.attribs.class || '').split(/\s+/);
    if (classes.includes('newslinkmonthsepdark')) {
      const match = clean(DomUtils.textContent(n), 80).toLowerCase().match(/^(\S+) (20\d{2})$/);
      month = match ? String(months.indexOf(match[1]) + 1).padStart(2, '0') : '';
      year = match?.[2] || ''; date = '';
      recognized ||= Boolean(year && month !== '00');
    } else if (classes.includes('newslinkmonthsep')) {
      const match = clean(DomUtils.textContent(n), 80).toLowerCase().match(/^\S+ (\d{1,2})\. (\S+)$/);
      const candidate = match && months.indexOf(match[2]) + 1 === Number(month) ? year + '-' + month + '-' + match[1].padStart(2,'0') : '';
      date = validDate(candidate) ? candidate : '';
    } else if (n.name === 'a' && classes.includes('newslink') && date) {
      const url = sourceUrl(n.attribs.href), heading = byClass(n, 'listtitle');
      const timeNode = heading && DomUtils.getElementsByTagName('b', heading)[0];
      const time = textOf(timeNode, 5);
      if (!url || !heading || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) continue;
      if (timeNode) DomUtils.removeElement(timeNode);
      const title = textOf(heading, 240), key = url + ':' + date;
      if (!title || seen.has(key)) continue;
      const summary = textOf(byClass(n,'listsubtitle'), 380);
      events.push({id:key,title,date,time:time === '00:00' ? '' : time,description:summary === '.' ? '' : summary,url});
      seen.add(key);
    }
  }
  if (!recognized) throw new Error('No source calendar headers found');
  return {items:[],events};
}

async function readHtml(response) {
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html') || !response.body) {
    throw new Error('Source unavailable');
  }
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Source too large');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let bytes = 0, html = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) { await reader.cancel(); throw new Error('Source too large'); }
      html += decoder.decode(value, { stream: true });
    }
    return html + decoder.decode();
  } finally { reader.releaseLock(); }
}

// Each source article is read once a week for its sharing image and fuller description.
const ARTICLE_TTL = 7 * 24 * 60 * 60 * 1000, ARTICLE_RETRY = 24 * 60 * 60 * 1000, ARTICLE_BATCH = 24, ARTICLE_PARALLEL = 6;
const IMAGE_HOSTS = ['ruban.nu', 'tistrupnyt.dk', 'pulsenivest.dk'];
function articleImage(value, base) {
  try {
    const url = new URL(value, base);
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !IMAGE_HOSTS.some(host => url.hostname === host || url.hostname.endsWith('.' + host)) ||
        !/\.(?:jpe?g|png|webp)$/i.test(url.pathname)) return null;
    url.hash = ''; return url.href;
  } catch { return null; }
}
export function parseArticle(html, base) {
  const metas = DomUtils.getElementsByTagName('meta', parseDocument(html));
  const meta = name => metas.find(m => m.attribs.property === name || m.attribs.name === name)?.attribs.content || '';
  const description = clean(meta('og:description') || meta('description'), 600);
  return { image: articleImage(meta('og:image'), base), description: /\p{L}{3}/u.test(description) ? description : '' };
}
// An image shared by several articles is the site's logo, not a picture of the event.
export function withArticleDetails(events, details = {}) {
  const uses = new Map();
  for (const detail of Object.values(details)) if (detail.image) uses.set(detail.image, (uses.get(detail.image) || 0) + 1);
  return events.map(event => {
    const detail = details[event.url];
    if (!detail) return event;
    const image = event.image || (detail.image && uses.get(detail.image) <= 3 ? detail.image : null);
    const description = detail.description.length > (event.description || '').length ? detail.description : event.description;
    return { ...event, image, description };
  });
}

export function createNewsService({ fetcher = fetch, clock = () => Date.now(), source = SOURCE, parser = parseTistrupNews, articleDetails = false } = {}) {
  const cacheKey = source.id === SOURCE.id ? CACHE_KEY : `calendar-sources/${source.id}-v2.json`;
  const pending = new WeakMap();
  const request = { headers: { Accept: 'text/html', 'User-Agent': 'TEB-Tistrup-Calendar/2.0 (+https://www.teb-tistrup.dk/)' }, redirect: 'manual' };
  async function refreshDetails(events, previous, now) {
    const urls = [...new Set(events.map(event => event.url))];
    const details = Object.fromEntries(urls.filter(url => previous[url]).map(url => [url, previous[url]]));
    const due = urls.filter(url => !details[url] || now - details[url].checkedAt >= (details[url].failed ? ARTICLE_RETRY : ARTICLE_TTL)).slice(0, ARTICLE_BATCH);
    for (let i = 0; i < due.length; i += ARTICLE_PARALLEL) await Promise.all(due.slice(i, i + ARTICLE_PARALLEL).map(async url => {
      try {
        const response = await fetcher(url, { ...request, signal: AbortSignal.timeout(8000) });
        details[url] = { ...parseArticle(await readHtml(response), url), checkedAt: now };
      } catch { details[url] = { ...(details[url] || { image: null, description: '' }), checkedAt: now, failed: true }; }
    }));
    return details;
  }
  async function load(bucket) {
    const now = clock();
    const object = await bucket.get(cacheKey);
    let cached = null;
    if (object) {
      try { cached = JSON.parse(new TextDecoder().decode(await object.arrayBuffer())); }
      catch { /* Replace a corrupt cache with a fresh source response. */ }
    }
    if (cached?.version !== 2 || !Array.isArray(cached.events)) cached = null;
    if (cached && now < cached.nextCheckAt) return result(cached, now);
    let record;
    try {
      const response = await fetcher(source.url, { ...request, signal: AbortSignal.timeout(12000) });
      const parsed = parser(await readHtml(response));
      const {events = []} = parsed;
      const items = []; // Only calendar events are cached or returned.
      const details = articleDetails ? await refreshDetails(events, cached?.details || {}, now) : {};
      // Large first imports are read in batches a few minutes apart.
      const unread = articleDetails && events.some(event => !details[event.url]);
      record = { version: 2, items, events, details, fetchedAt: new Date(now).toISOString(), nextCheckAt: now + (unread ? RETRY_DELAY : NEWS_TTL), failed: false };
    } catch {
      record = { version: 2, items: cached?.items || [], events: cached?.events || [], details: cached?.details || {}, fetchedAt: cached?.fetchedAt || null,
        nextCheckAt: now + RETRY_DELAY, failed: true };
    }
    await bucket.put(cacheKey, new TextEncoder().encode(JSON.stringify(record)), {
      httpMetadata: { contentType: 'application/json' }
    });
    return result(record, now);
  }
  function result(record, now) {
    return { source, items: [], events: withArticleDetails(record.events || [], record.details), fetchedAt: record.fetchedAt,
      stale: record.failed || now - Date.parse(record.fetchedAt) >= NEWS_TTL,
      nextCheckAt: new Date(record.nextCheckAt).toISOString() };
  }
  return async bucket => {
    if (!bucket) throw new Error('News cache not configured');
    if (pending.has(bucket)) return pending.get(bucket);
    const job = load(bucket);
    pending.set(bucket, job);
    try { return await job; } finally { pending.delete(bucket); }
  };
}

const news = createNewsService({ articleDetails: true });
const pulsenSource = {id:'pulsen',name:'Pulsen i Vest',url:'https://pulsenivest.dk/by/tistrup'};
const hasClass = (node,name) => (node.attribs?.class||'').split(/\s+/).includes(name);
const byClass = (node,name) => DomUtils.findOne(n=>hasClass(n,name),node.children||[],true);
const textOf = (node,max) => clean(node?DomUtils.textContent(node):'',max);
function pulsenURL(value,image=false){
 try{const url=new URL(value,pulsenSource.url);if(url.protocol!=='https:'||url.hostname!=='pulsenivest.dk'||url.username||url.password||url.port)return null;
  if(image?!/^\/(?:image-cache\/variants|media\/puls)\//.test(url.pathname):!/^\/(?:nyhed|event)\//.test(url.pathname))return null;
  url.hash='';return url.href;
 }catch{return null;}
}
export function parsePulsen(html){
 const document=parseDocument(html);
 for(const name of ['script','style'])for(const node of DomUtils.getElementsByTagName(name,document))DomUtils.removeElement(node);
 const items=[],events=[],seen=new Set();
 for(const article of DomUtils.getElementsByTagName('article',document)){
  const isEvent=hasClass(article,'city-event');if(!isEvent)continue;
  const heading=DomUtils.getElementsByTagName('h3',article)[0],link=heading&&DomUtils.getElementsByTagName('a',heading)[0];
  const url=link&&pulsenURL(link.attribs.href),title=textOf(heading,240);if(!url||!title||seen.has(url))continue;
  const summary=textOf(byClass(article,'city-teaser'),380),imageNode=DomUtils.getElementsByTagName('img',article)[0];
  const item={id:url,title,summary,url,image:imageNode?pulsenURL(imageNode.attribs.src,true):null};
  if(isEvent){
   const stamp=DomUtils.getElementsByTagName('time',article)[0]?.attribs.datetime;
   if(!/^20\d\d-\d\d-\d\dT(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d[+-]\d\d:\d\d$/.test(stamp||'')||!validDate(stamp.slice(0,10))||!Number.isFinite(Date.parse(stamp)))continue;
   // The card's Copenhagen-local date/time is authoritative. Never infer dates from titles.
   events.push({...item,date:stamp.slice(0,10),time:stamp.slice(11,16)==='00:00'?'':stamp.slice(11,16),description:summary,location:textOf(byClass(article,'city-card-meta'),180)});
  }
  seen.add(url);
 }
 if(!events.length && !byClass(document,'city-events-grid'))throw new Error('No source calendar found');
 return {items,events:events.slice(0,60)};
}
const pulsen = createNewsService({source:pulsenSource,parser:parsePulsen,articleDetails:true});
export async function handleNews(request, env, sourceId = 'tistrup-nyt') {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (request.method !== 'GET') return Response.json({ error: 'Denne handling er ikke tilladt.' }, { status: 405, headers: { ...headers, Allow: 'GET' } });
  try {
    const data = await (sourceId === 'pulsen' ? pulsen : news)(env.PDFS);
    return Response.json(data.fetchedAt ? data : { ...data, error: 'Arrangementerne kan ikke hentes lige nu.' }, {
      status: data.fetchedAt ? 200 : 503, headers
    });
  } catch {
    return Response.json({ error: 'Arrangementerne kan ikke hentes lige nu.' }, { status: 503, headers });
  }
}
