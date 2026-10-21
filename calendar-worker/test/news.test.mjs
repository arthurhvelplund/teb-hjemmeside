import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTistrupNews, createNewsService, NEWS_TTL } from '../src/news.mjs';
import worker from '../src/worker.mjs';
import { localR2 } from '../scripts/r2.mjs';

const card = ({ id = '2448700', host = 'tistrupnyt.dk', path = 'cid', title = 'Tistrup Cykelmotion &amp; fællesskab' } = {}) =>
  `<div class="newslinkmonthsepdark">oktober 2026</div><div class="newslinkmonthsep">tirsdag 20. oktober</div><a class="newslink" href="https://${host}/${path}/${id}/lokal-historie"><div class="listtitle"><b>16:30</b> ${title}</div><div class="listsubtitle">Vi starter fra klubhuset.</div></a>`;
const htmlResponse = html => new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

test('extracts calendar dates and times, excludes articles and neighbouring sites, deduplicates events', () => {
 const {items,events}=parseTistrupNews(card()+card()+card({host:'olgod.dk',id:'2'})+card({path:'id',id:'3'}));
 assert.deepEqual(items,[]);assert.equal(events.length,1);assert.equal(events[0].title,'Tistrup Cykelmotion & fællesskab');
 assert.equal(events[0].date,'2026-10-20');assert.equal(events[0].time,'16:30');assert.match(events[0].url,/\/cid\/2448700/);
});
test('ignores executable text, never guesses dates from titles, detects changed layout and accepts explicit empty months', () => {
 const {events}=parseTistrupNews(card({title:'Byens <em>arrangement</em><script>alert(1)</script>'}));
 assert.equal(events[0].title,'Byens arrangement');
 assert.equal(parseTistrupNews(card().replace('20. oktober','31. februar')).events.length,0);
 assert.throws(()=>parseTistrupNews('<h1>Arrangement 20. oktober 2026</h1>'));
 assert.deepEqual(parseTistrupNews('<div class="newslinkmonthsepdark">november 2026</div>').events,[]);
 const rollover=card().replace('oktober 2026','december 2026').replace('20. oktober','31. december')+card({id:'2'}).replace('oktober 2026','januar 2027').replace('20. oktober','01. januar');
 assert.deepEqual(parseTistrupNews(rollover).events.map(e=>e.date),['2026-12-31','2027-01-01']);
});

test('one fetch serves concurrent requests and the saved cache survives a service restart', async () => {
  const bucket = localR2(); let calls = 0, now = Date.parse('2026-10-18T12:00:00Z');
  const fetcher = async (url, options) => {
    calls++; assert.equal(url, 'https://tistrupnyt.dk/menu/kalender/lokal'); assert.equal(options.redirect, 'manual');
    assert.equal(options.headers.Cookie, undefined);
    return htmlResponse(card());
  };
  const service = createNewsService({ fetcher, clock: () => now });
  const [a, b] = await Promise.all([service(bucket), service(bucket)]);
  assert.deepEqual(a, b); assert.equal(calls, 1); assert.equal(a.stale, false);
  const restarted = createNewsService({ fetcher, clock: () => now });
  await restarted(bucket); assert.equal(calls, 1);
  now += NEWS_TTL; await restarted(bucket); assert.equal(calls, 2);
});

test('source failures and parser changes preserve the last good events and back off', async () => {
  const bucket = localR2(); let now = Date.now(), calls = 0, mode = 'good';
  const service = createNewsService({ clock: () => now, fetcher: async () => {
    calls++;
    if (mode === 'offline') throw new Error('Network down');
    return htmlResponse(mode === 'changed' ? '<h1>New layout</h1>' : card());
  } });
  const first = await service(bucket);
  now += NEWS_TTL; mode = 'offline'; const stale = await service(bucket);
  assert.equal(stale.stale, true); assert.equal(stale.fetchedAt, first.fetchedAt);
  assert.deepEqual(stale.events, first.events);
  await service(bucket); assert.equal(calls, 2);
  now += 5 * 60 * 1000; mode = 'changed';
  assert.equal((await service(bucket)).stale, true);
  now += 5 * 60 * 1000; mode = 'good';
  assert.equal((await service(bucket)).stale, false);
});

test('an initial outage is cached briefly instead of fetching on every visit', async () => {
  let calls = 0; const bucket = localR2();
  const service = createNewsService({ fetcher: async () => { calls++; throw new Error('Offline'); } });
  const result = await service(bucket); await service(bucket);
  assert.deepEqual(result.items, []); assert.equal(result.stale, true); assert.equal(calls, 1);
});

test('rejects non-HTML and oversized responses without replacing good cached content', async () => {
  for (const response of [new Response('{}', { headers: { 'Content-Type': 'application/json' } }),
    htmlResponse('x'.repeat(2 * 1024 * 1024 + 1))]) {
    const service = createNewsService({ fetcher: async () => response });
    assert.deepEqual((await service(localR2())).items, []);
  }
});

test('public endpoint needs no calendar login/DB, rejects writes, and reports missing cache honestly', async () => {
  const url = 'http://localhost/api/kalender/nyheder/tistrup-nyt';
  assert.equal((await worker.fetch(new Request(url), {})).status, 503);
  const denied = await worker.fetch(new Request(url, { method: 'POST' }), {});
  assert.equal(denied.status, 405); assert.equal(denied.headers.get('allow'), 'GET');
  assert.equal((await worker.fetch(new Request('http://localhost/api/formular'), {})).status, 404);
});

test('valid empty calendars are fresh; article caches cannot reappear in event-only endpoints',async()=>{
 const bucket=localR2();
 await bucket.put('news/tistrup-nyt-v1.json',new TextEncoder().encode(JSON.stringify({version:1,items:[{title:'Old article'}],nextCheckAt:Date.now()+NEWS_TTL})));
 const service=createNewsService({fetcher:async()=>htmlResponse('<div class="newslinkmonthsepdark">november 2026</div>')});
 const data=await service(bucket);assert.deepEqual(data.items,[]);assert.deepEqual(data.events,[]);assert.equal(data.stale,false);assert.ok(data.fetchedAt);
 const endpoint=await worker.fetch(new Request('http://localhost/api/kalender/kilder/tistrup-nyt'),{PDFS:bucket});assert.equal(endpoint.status,200);assert.deepEqual((await endpoint.json()).items,[]);
});

test('source articles add their sharing image and fuller description, ignore logos and are read again only weekly', async () => {
  const bucket = localR2(); let now = Date.parse('2026-10-18T12:00:00Z'); const fetched = [];
  const article = (image, description) => htmlResponse(`<meta property="og:image" content="${image}"><meta name="description" content="${description}">`);
  const list = card() + card({ id: '2448701', title: 'Banko' }) + card({ id: '2448702', title: 'Loppemarked' });
  const service = createNewsService({ articleDetails: true, clock: () => now, fetcher: async url => {
    fetched.push(url);
    if (url.endsWith('/lokal')) return htmlResponse(list);
    if (url.includes('2448700')) return article('https://ruban.nu/foto/a/cykel.jpg', 'Der køres tirsdag kl. 16.30 (husk lys) og lørdag kl. 10.00 fra klubhuset.');
    if (url.includes('2448701')) return article('javascript:alert(1)', 'Kort');
    throw new Error('Offline');
  } });
  const { events } = await service(bucket);
  const cykel = events.find(e => e.url.includes('2448700')), banko = events.find(e => e.url.includes('2448701'));
  assert.equal(cykel.image, 'https://ruban.nu/foto/a/cykel.jpg');
  assert.match(cykel.description, /husk lys/);
  assert.equal(banko.image, null); assert.equal(banko.description, 'Vi starter fra klubhuset.');
  assert.equal(fetched.length, 4);
  now += 60 * 60 * 1000; await service(bucket); assert.equal(fetched.length, 5);
  now += 7 * 24 * 60 * 60 * 1000; await service(bucket); assert.equal(fetched.length, 9);
});

test('an image used by many articles is treated as the site logo', async () => {
  const { withArticleDetails } = await import('../src/news.mjs');
  const details = Object.fromEntries(['a', 'b', 'c', 'd'].map(id => ['https://tistrupnyt.dk/cid/1/' + id, { image: 'https://ruban.nu/foto/logo.png', description: '' }]));
  const [event] = withArticleDetails([{ url: 'https://tistrupnyt.dk/cid/1/a', description: 'Tekst' }], details);
  assert.equal(event.image, null); assert.equal(event.description, 'Tekst');
});

test('local calendar keeps either town in titles, summaries, locations or the full event text', async () => {
  const events = [
    {id:'title', title:'TISTRUP Cykelmotion'},
    {id:'summary', title:'Indoor cycling', description:'TRIM Tistrup, kl. 8–12'},
    {id:'location', title:'Fællesspisning', location:'Hodde Forsamlingshus'},
    {id:'body', title:'Musikaften'},
    {id:'outside', title:'Koncert i Ølgod', description:'Kulturhuset i Ølgod'},
    {id:'footer', title:'Fodbold', description:'Spillested Horne Stadion'},
    {id:'partial', title:'Foredrag i Hodderup'},
  ].map(event => ({description:'', ...event, date:'2026-10-24', url:'https://tistrupnyt.dk/cid/123/' + event.id}));
  const article = (title, body) => htmlResponse(`<nav>Tistrup Hodde</nav><meta name="description" content="Tistrup Nyt dækker området"><div class="event"><div class="newsfullpicture">Tistrup Foto:</div><div class="text"><h1>${title}</h1><div class="event_content">${body}</div></div><div class="event_tags">Hodde Tistrup</div></div><aside>Tistrup kirke</aside><footer>Hodde</footer>`);
  const service = createNewsService({localOnly:true, articleDetails:true, parser:() => ({events}), fetcher:async url => {
    if (url.endsWith('/lokal')) return htmlResponse('calendar');
    const event = events.find(event => event.url === url);
    // The only locality mention can occur beyond the metadata/teaser length.
    return article(event.title, event.id === 'body' ? '<p>' + 'Program og praktisk information. '.repeat(40) + '</p><p>Vi mødes i <strong>Hodde</strong>.</p>' : '<p>Program og tilmelding.</p><script>Tistrup</script>');
  }});
  const result = await service(localR2());
  assert.deepEqual(result.events.map(event => event.id), ['title','summary','location','body']);
  assert.ok(result.events.every(event => !('localityMatch' in event)));
});

test('existing caches are checked immediately and never restore unrelated events during an outage', async () => {
  const bucket = localR2(), stamp = Date.parse('2026-10-21T12:00:00Z');
  const events = [{id:'body',title:'Fællesspisning'}, {id:'outside',title:'Koncert i Ølgod'}]
    .map(event => ({...event,description:'',date:'2026-10-24',url:'https://tistrupnyt.dk/cid/123/'+event.id}));
  await bucket.put('calendar-sources/tistrup-nyt-v2.json', new TextEncoder().encode(JSON.stringify({version:2,events,
    details:Object.fromEntries(events.map(event => [event.url,{image:null,description:'',checkedAt:stamp}])),
    fetchedAt:new Date(stamp).toISOString(),nextCheckAt:stamp+NEWS_TTL,failed:false})));
  let calls = 0, now = stamp;
  const service = createNewsService({localOnly:true,articleDetails:true,clock:()=>now,parser:()=>({events}),fetcher:async url => {
    calls++;
    return htmlResponse(url.endsWith('/body') ? '<div class="event"><div class="text"><h1>Fællesspisning</h1><p>Hodde Forsamlingshus</p></div></div>' : '<div class="event"><div class="text"><h1>Koncert i Ølgod</h1></div></div>');
  }});
  const first = await service(bucket);
  assert.deepEqual(first.events.map(event=>event.id),['body']); assert.equal(calls,3);
  now += NEWS_TTL;
  const restarted = createNewsService({localOnly:true,articleDetails:true,clock:()=>now,fetcher:async()=>{throw Error('Offline');}});
  const stale = await restarted(bucket);
  assert.equal(stale.stale,true); assert.deepEqual(stale.events,first.events);
});

test('the other media source uses the same local rule and reads its own article layout', async () => {
  const source={id:'pulsen',name:'Pulsen i Vest',url:'https://pulsenivest.dk/by/tistrup'};
  const events=[{id:'local',title:'Musikaften'},{id:'outside',title:'Arrangement i Ølgod Kulturdage'}]
    .map(event=>({...event,date:'2026-10-24',description:'',url:'https://pulsenivest.dk/event/'+event.id}));
  const service=createNewsService({source,localOnly:true,articleDetails:true,parser:()=>({events}),fetcher:async url=>htmlResponse(
    '<header>Tistrup Hodde</header><article class="event-detail"><h1>Musikaften</h1><p>'+
    (url.endsWith('/local')?'Vi mødes i Tistrup.':'Dagens program i Ølgod.')+'</p></article><footer>Tistrup</footer>')});
  const result=await service(localR2());
  assert.deepEqual(result.events.map(event=>event.id),['local']); assert.deepEqual(result.source,source);
});
