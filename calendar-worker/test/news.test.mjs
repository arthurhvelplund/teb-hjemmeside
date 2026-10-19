import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTistrupNews, createNewsService, NEWS_TTL } from '../src/news.mjs';
import worker from '../src/worker.mjs';
import { localR2 } from '../scripts/r2.mjs';

const card = ({ id = '2448700', host = 'tistrupnyt.dk', path = 'id', title = 'Tistrup Cykelmotion &amp; fællesskab', image = 'https://ruban.nu/foto/b/cykelmotion.avif' } = {}) =>
  `<a class="event by2small frontpage shadow" href="https://${host}/${path}/${id}/lokal-historie"><div><img src="${image}"></div><div class="text"><h1>${title}</h1><h2>Der køres tirsdag kl. 16.30</h2></div></a>`;
const htmlResponse = html => new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

test('extracts text and photos, excludes calendar/neighbouring sites, deduplicates article IDs', () => {
  const items = parseTistrupNews(card() + card() + card({ host: 'olgod.dk', id: '2' }) + card({ path: 'cid', id: '3' }));
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Tistrup Cykelmotion & fællesskab');
  assert.equal(items[0].image, 'https://ruban.nu/foto/b/cykelmotion.avif');
  assert.equal(items[0].id, '2448700');
});

test('never imports executable HTML or foreign image hosts; changed layouts fail visibly', () => {
  const items = parseTistrupNews(card({ title: 'Byens <em>historie</em><script>alert(1)</script>', image: 'https://unknown.example/photo.jpg' }));
  assert.equal(items[0].title, 'Byens historie');
  assert.equal(items[0].image, null);
  assert.throws(() => parseTistrupNews('<h1>En ny sidestruktur</h1>'));
});

test('one fetch serves concurrent requests and the saved cache survives a service restart', async () => {
  const bucket = localR2(); let calls = 0, now = Date.parse('2026-10-18T12:00:00Z');
  const fetcher = async (url, options) => {
    calls++; assert.equal(url, 'https://tistrupnyt.dk/'); assert.equal(options.redirect, 'manual');
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

test('source failures and parser changes preserve the last good news and back off', async () => {
  const bucket = localR2(); let now = Date.now(), calls = 0, mode = 'good';
  const service = createNewsService({ clock: () => now, fetcher: async () => {
    calls++;
    if (mode === 'offline') throw new Error('Network down');
    return htmlResponse(mode === 'changed' ? '<h1>New layout</h1>' : card());
  } });
  const first = await service(bucket);
  now += NEWS_TTL; mode = 'offline'; const stale = await service(bucket);
  assert.equal(stale.stale, true); assert.equal(stale.fetchedAt, first.fetchedAt);
  assert.deepEqual(stale.items, first.items);
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
