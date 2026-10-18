import { parseDocument, DomUtils } from 'htmlparser2';
import { validDate } from './shared.mjs';

const SOURCE = { id: 'tistrup-nyt', name: 'Tistrup Nyt', url: 'https://tistrupnyt.dk/' };
const CACHE_KEY = 'news/tistrup-nyt-v1.json';
export const NEWS_TTL = 60 * 60 * 1000;
const RETRY_DELAY = 5 * 60 * 1000;
const MAX_BYTES = 2 * 1024 * 1024;
const clean = (text, max) => text.replace(/[\u0000-\u001f\u007f\s]+/g, ' ').trim().slice(0, max);

function sourceUrl(value, image = false) {
  try {
    const url = new URL(value, SOURCE.url);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (image) {
      if (!['ruban.nu', 'tistrupnyt.dk', 'www.tistrupnyt.dk'].includes(url.hostname) ||
          !/^\/foto\/.+\.(avif|webp|jpe?g|png)$/i.test(url.pathname)) return null;
    } else if (!['tistrupnyt.dk', 'www.tistrupnyt.dk'].includes(url.hostname) ||
               !/^\/id\/\d+\/[^/]+\/?$/.test(url.pathname)) return null;
    url.hash = ''; url.search = '';
    return url.href;
  } catch { return null; }
}

// Read only the source's article cards. Never send their HTML or scripts to a browser.
export function parseTistrupNews(html) {
  const document = parseDocument(html);
  for (const node of DomUtils.getElementsByTagName('script', document)) DomUtils.removeElement(node);
  for (const node of DomUtils.getElementsByTagName('style', document)) DomUtils.removeElement(node);
  const items = [], seen = new Set();
  for (const link of DomUtils.getElementsByTagName('a', document)) {
    if (!(link.attribs.class || '').split(/\s+/).includes('frontpage')) continue;
    const url = sourceUrl(link.attribs.href);
    if (!url) continue;
    const id = new URL(url).pathname.split('/')[2];
    if (seen.has(id)) continue;
    const heading = DomUtils.getElementsByTagName('h1', link)[0];
    const title = heading ? clean(DomUtils.textContent(heading), 240) : '';
    if (!title) continue;
    const subheading = DomUtils.getElementsByTagName('h2', link)[0];
    const summary = subheading ? clean(DomUtils.textContent(subheading), 380) : '';
    const picture = DomUtils.getElementsByTagName('img', link)[0];
    items.push({ id, title, summary: summary === '.' ? '' : summary, url,
      image: picture ? sourceUrl(picture.attribs.src, true) : null });
    seen.add(id);
    if (items.length === 12) break;
  }
  // An empty extraction usually means the source changed its layout. Keep the last good copy.
  if (!items.length) throw new Error('No source article cards found');
  return items;
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

export function createNewsService({ fetcher = fetch, clock = () => Date.now(), source = SOURCE, parser = parseTistrupNews } = {}) {
  const cacheKey = source.id === SOURCE.id ? CACHE_KEY : `news/${source.id}-v1.json`;
  const pending = new WeakMap();
  async function load(bucket) {
    const now = clock();
    const object = await bucket.get(cacheKey);
    let cached = null;
    if (object) {
      try { cached = JSON.parse(new TextDecoder().decode(await object.arrayBuffer())); }
      catch { /* Replace a corrupt cache with a fresh source response. */ }
    }
    if (cached?.version !== 1 || !Array.isArray(cached.items)) cached = null;
    if (cached && now < cached.nextCheckAt) return result(cached, now);
    let record;
    try {
      const response = await fetcher(source.url, {
        headers: { Accept: 'text/html', 'User-Agent': 'TEB-Tistrup-News/1.0 (+https://www.teb-tistrup.dk/)' },
        redirect: 'manual', signal: AbortSignal.timeout(12000)
      });
      const parsed = parser(await readHtml(response));
      const {items, events = []} = Array.isArray(parsed) ? {items: parsed} : parsed;
      record = { version: 1, items, events, fetchedAt: new Date(now).toISOString(), nextCheckAt: now + NEWS_TTL, failed: false };
    } catch {
      record = { version: 1, items: cached?.items || [], events: cached?.events || [], fetchedAt: cached?.fetchedAt || null,
        nextCheckAt: now + RETRY_DELAY, failed: true };
    }
    await bucket.put(cacheKey, new TextEncoder().encode(JSON.stringify(record)), {
      httpMetadata: { contentType: 'application/json' }
    });
    return result(record, now);
  }
  function result(record, now) {
    return { source, items: record.items, events: record.events || [], fetchedAt: record.fetchedAt,
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

const news = createNewsService();
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
  const isEvent=hasClass(article,'city-event');if(!isEvent&&!hasClass(article,'city-story'))continue;
  const heading=DomUtils.getElementsByTagName('h3',article)[0],link=heading&&DomUtils.getElementsByTagName('a',heading)[0];
  const url=link&&pulsenURL(link.attribs.href),title=textOf(heading,240);if(!url||!title||seen.has(url))continue;
  const summary=textOf(byClass(article,'city-teaser'),380),imageNode=DomUtils.getElementsByTagName('img',article)[0];
  const item={id:url,title,summary,url,image:imageNode?pulsenURL(imageNode.attribs.src,true):null};
  if(isEvent){
   const stamp=DomUtils.getElementsByTagName('time',article)[0]?.attribs.datetime;
   if(!/^20\d\d-\d\d-\d\dT(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d[+-]\d\d:\d\d$/.test(stamp||'')||!validDate(stamp.slice(0,10))||!Number.isFinite(Date.parse(stamp)))continue;
   // The card's Copenhagen-local date/time is authoritative. Never infer dates from titles.
   events.push({...item,date:stamp.slice(0,10),time:stamp.slice(11,16)==='00:00'?'':stamp.slice(11,16),description:summary,location:textOf(byClass(article,'city-card-meta'),180)});
  }else if(items.length<12)items.push(item);
  seen.add(url);
 }
 if(!items.length)throw new Error('No source article cards found');
 return {items,events:events.slice(0,60)};
}
const pulsen = createNewsService({source:pulsenSource,parser:parsePulsen});
export async function handleNews(request, env, sourceId = 'tistrup-nyt') {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (request.method !== 'GET') return Response.json({ error: 'Denne handling er ikke tilladt.' }, { status: 405, headers: { ...headers, Allow: 'GET' } });
  try {
    const data = await (sourceId === 'pulsen' ? pulsen : news)(env.PDFS);
    return Response.json(data.items.length ? data : { ...data, error: 'Nyhederne kan ikke hentes lige nu.' }, {
      status: data.items.length ? 200 : 503, headers
    });
  } catch {
    return Response.json({ error: 'Nyhederne kan ikke hentes lige nu.' }, { status: 503, headers });
  }
}
