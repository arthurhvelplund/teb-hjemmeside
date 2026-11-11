import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, readdir, stat, rm, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {validateConfig, dateWindow, createGraphClient, collectAnalytics, saveSnapshot, assertPrivateOutput, main} from './facebook-analytics.mjs';

const config = JSON.parse(await readFile(new URL('../config/facebook-analytics.example.json', import.meta.url), 'utf8'));
const now = new Date('2026-11-10T12:00:00Z');
const token = 'test-credential-never-persist';
const postId = config.pageId + '_42';
const json = (body, status = 200) => ({ok: status >= 200 && status < 300, status, json: async () => body});
function fixture({failMetric, mismatch = false, paginated = false, emptyMetric} = {}) {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({url: String(url), options});
    assert.equal(options.method, 'GET');
    assert.equal(options.headers.Authorization, 'Bearer ' + token);
    assert.equal(url.searchParams.has('access_token'), false);
    const edge = url.pathname.split('/').at(-1);
    if (edge === 'me') return json({id: mismatch ? '999' : config.pageId, name: config.expectedPageName});
    if (edge === 'published_posts') {
      const post = {id: postId, message: 'Test post', created_time: '2026-10-25T12:00:00Z', permalink_url: 'https://www.facebook.com/example'};
      if (paginated && !url.searchParams.has('after')) return json({data: [post], paging: {
        next: `https://graph.facebook.com/${config.apiVersion}/${config.pageId}/published_posts?after=cursor&access_token=${token}`
      }});
      return json({data: [post, {...post, id: config.pageId + '_43', created_time: '2026-11-10T12:00:00Z'}]});
    }
    const metric = url.searchParams.get('metric');
    if (metric === failMetric) return json({error: {code: 100, message: token, error_data: {token}}}, 400);
    return json({data: metric === emptyMetric ? [] : [{name: metric, period: url.searchParams.get('period'),
      title: 'Test metric', values: [{value: metric.includes('reactions') ? {like: 4} : 12, end_time: '2026-10-26T07:00:00+0000'}]}]});
  };
  return {fetchImpl, requests};
}

test('validates dates, explicit metrics and credential-free config before making requests', () => {
  assert.equal(validateConfig(config), config);
  assert.deepEqual(dateWindow(config, {now}), {since: '2026-10-13', until: '2026-11-10', postSince: '2026-08-12', timezone: 'UTC', untilExclusive: true});
  for (const options of [{since: '2026-02-30'}, {since: '2026-11-10'}, {until: '2026-11-11'}, {since: '2020-01-01'}]) {
    assert.throws(() => dateWindow(config, {...options, now}));
  }
  assert.throws(() => validateConfig({...config, accessToken: token}), /Credentials/);
  assert.throws(() => validateConfig({...config, pageMetrics: []}));
  assert.throws(() => validateConfig({...config, pageMetrics: ['invalid,metric']}));
});

test('collects Page daily and post lifetime data, preserves raw end_time and safely paginates/deduplicates', async () => {
  const {fetchImpl, requests} = fixture({paginated: true});
  const snapshot = await collectAnalytics(config, {token, now, fetchImpl});
  assert.equal(snapshot.page.id, config.pageId);
  assert.equal(snapshot.posts.length, 1);
  assert.equal(snapshot.posts[0].id, postId);
  assert.equal(snapshot.posts[0].insights[0].series[0].period, 'lifetime');
  assert.equal(snapshot.pageMetrics[0].series[0].values[0].end_time, '2026-10-26T07:00:00+0000');
  assert.equal(snapshot.posts[0].insights[1].series[0].values[0].value, 12);
  assert.equal(JSON.stringify(snapshot).includes(token), false);
  assert.equal(JSON.stringify(snapshot).includes('paging'), false);
  assert.equal(requests.filter(request => request.url.includes('/published_posts')).length, 2);
});

test('rejects the wrong Page before fetching any analytics', async () => {
  const {fetchImpl, requests} = fixture({mismatch: true});
  await assert.rejects(collectAnalytics(config, {token, now, fetchImpl}), /identity/);
  assert.equal(requests.length, 1);
});

test('does not relabel empty insights as zero', async () => {
  const {fetchImpl} = fixture({emptyMetric: config.pageMetrics[0]});
  const snapshot = await collectAnalytics(config, {token, now, fetchImpl});
  assert.deepEqual(snapshot.pageMetrics[0], {metric: config.pageMetrics[0], status: 'empty', series: []});
});

test('rejects credential-bearing, foreign or wrong-endpoint pagination without sending a second request', async () => {
  for (const next of ['https://evil.example/collect', `https://graph.facebook.com/${config.apiVersion}/other/insights`,
    `https://user:password@graph.facebook.com/${config.apiVersion}/123/insights`, 'not-a-url']) {
    let calls = 0;
    const client = createGraphClient({token, apiVersion: config.apiVersion,
      fetchImpl: async () => { calls++; return json({data: [], paging: {next}}); }});
    await assert.rejects(client.list('123/insights'), /pagination/i);
    assert.equal(calls, 1);
  }
});

test('paginates insight date windows without copying a token to the request URL', async () => {
  let calls = 0;
  const client = createGraphClient({token, apiVersion: config.apiVersion, fetchImpl: async url => {
    assert.equal(url.searchParams.has('access_token'), false);
    calls++;
    return calls === 1 ? json({data: [1], paging: {next:
      `https://graph.facebook.com/${config.apiVersion}/123/insights?since=5&until=10&access_token=${token}`}}) : json({data: [2]});
  }});
  assert.deepEqual(await client.list('123/insights'), [1, 2]);
});

test('bounds pagination loops and retries transient failures but not expired tokens', async () => {
  let calls = 0;
  const client = createGraphClient({token, apiVersion: config.apiVersion, sleep: async () => {}, fetchImpl: async () => {
    calls++;
    if (calls === 1) return json({error: {is_transient: true}}, 503);
    return json({data: [1]});
  }});
  assert.deepEqual(await client.list('123/insights'), [1]);
  assert.equal(calls, 2);
  calls = 0;
  const expired = createGraphClient({token, apiVersion: config.apiVersion, fetchImpl: async () => {
    calls++; return json({error: {code: 190, message: token}}, 400);
  }});
  await assert.rejects(expired.list('123/insights'), error => !error.message.includes(token) && /expired/.test(error.message));
  assert.equal(calls, 1);
  const loop = createGraphClient({token, apiVersion: config.apiVersion, fetchImpl: async () => json({data: [],
    paging: {next: `https://graph.facebook.com/${config.apiVersion}/123/insights?after=repeated`}})});
  await assert.rejects(loop.list('123/insights'), /repeated/);
});

test('atomic latest snapshot survives an API/metric failure and private snapshots contain no token', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'teb-facebook-test-'));
  try {
    const old = '{"lastKnownGood":true}\n';
    await writeFile(join(directory, 'latest.json'), old);
    const failed = fixture({failMetric: config.postMetrics[0]});
    await assert.rejects(async () => saveSnapshot(directory, await collectAnalytics(config, {token, now, fetchImpl: failed.fetchImpl})),
      error => /code 100/.test(error.message) && !error.message.includes(token));
    assert.equal(await readFile(join(directory, 'latest.json'), 'utf8'), old);
    assert.deepEqual(await readdir(directory), ['latest.json']);
    const good = fixture();
    const snapshot = await collectAnalytics(config, {token, now, fetchImpl: good.fetchImpl});
    const saved = await saveSnapshot(directory, snapshot);
    const data = await readFile(saved, 'utf8');
    assert.equal(data, await readFile(join(directory, 'latest.json'), 'utf8'));
    assert.equal(data.includes(token), false);
    assert.equal((await stat(saved)).mode & 0o777, 0o600);
    assert.equal((await stat(join(directory, 'latest.json'))).mode & 0o777, 0o600);
    assert.equal((await readdir(directory)).some(name => name.endsWith('.tmp')), false);
  } finally { await rm(directory, {recursive: true, force: true}); }
});

test('rejects analytics output inside the website or repository', () => {
  assert.throws(() => assertPrivateOutput(new URL('../site/facebook', import.meta.url).pathname), /outside/);
  assert.throws(() => assertPrivateOutput(new URL('../private-data', import.meta.url).pathname), /outside/);
  assert.doesNotThrow(() => assertPrivateOutput(join(tmpdir(), 'teb-private')));
});

test('CLI check-config is a credential-free preflight and rejects unknown/token arguments', () => {
  const script = new URL('./facebook-analytics.mjs', import.meta.url).pathname;
  const result = execFileSync(process.execPath, [script, '--check-config'], {encoding: 'utf8', env: {...process.env, TEB_FB_PAGE_ACCESS_TOKEN: token}});
  assert.match(result, /No token was read/);
  assert.throws(() => execFileSync(process.execPath, [script, '--token', token], {stdio: 'pipe'}),
    error => error.status === 1 && !error.stderr.toString().includes(token));
});

test('real CLI runner publishes once, preserves latest on failure, releases its lock and rejects a symlink into the repo', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'teb-facebook-runner-'));
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.TEB_FB_PAGE_ACCESS_TOKEN;
  const originalLog = console.log;
  const configFile = new URL('../config/facebook-analytics.example.json', import.meta.url).pathname;
  const args = ['--config', configFile, '--output', directory, '--since', '2026-10-13', '--until', '2026-11-10'];
  try {
    process.env.TEB_FB_PAGE_ACCESS_TOKEN = token;
    console.log = () => {};
    globalThis.fetch = fixture().fetchImpl;
    await main(args);
    const good = await readFile(join(directory, 'latest.json'), 'utf8');
    assert.equal(JSON.parse(good).posts.length, 1);
    assert.equal((await stat(directory)).mode & 0o777, 0o700);
    globalThis.fetch = fixture({failMetric: config.pageMetrics[0]}).fetchImpl;
    await assert.rejects(main(args), /code 100/);
    assert.equal(await readFile(join(directory, 'latest.json'), 'utf8'), good);
    assert.equal((await readdir(directory)).includes('.collector-lock'), false);
    const target = join(directory, 'linked-site');
    await symlink(new URL('../site', import.meta.url).pathname, target);
    await assert.rejects(main(['--config', configFile, '--output', target]), /outside/);
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    if (originalToken === undefined) delete process.env.TEB_FB_PAGE_ACCESS_TOKEN;
    else process.env.TEB_FB_PAGE_ACCESS_TOKEN = originalToken;
    await rm(directory, {recursive: true, force: true});
  }
});
