import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, readdir, rm, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createComposioClient, redactPayload, readComposioLogin, FACEBOOK_READ_TOOLS, ComposioToolError} from './composio-consumer.mjs';
import {collectComposio, historyWindows, validateComposioConfig, main} from './facebook-composio.mjs';

const example = JSON.parse(await readFile(new URL('../config/facebook-composio.example.json', import.meta.url), 'utf8'));
const config = {...example, orgId: 'ok_test', projectId: 'pr_test', userId: 'consumer-test', connectedAccountId: 'ca_test'};
const key = 'uak_test-never-save-this-value';
const now = new Date('2026-11-11T12:00:00Z');
const postId = config.pageId + '_42';
const json = (body, status = 200) => ({ok: status >= 200 && status < 300, status, json: async () => body});

function fixture({wrongPage = false, wrongPost = false, unsupported = false, empty = false, failPost = false, paginate = false} = {}) {
  const calls = [];
  const execute = async (slug, args) => {
    calls.push({slug, args});
    if (slug === 'FACEBOOK_LIST_MANAGED_PAGES') return {data: [
      {id: wrongPage ? '999' : config.pageId, name: config.expectedPageName, tasks: ['ANALYZE']},
      {id: '888', name: 'Other Page', tasks: ['MANAGE']}
    ]};
    if (slug === 'FACEBOOK_GET_PAGE_DETAILS') return {id: config.pageId, name: config.expectedPageName, followers_count: 166};
    if (slug === 'FACEBOOK_LIST_PUBLISHED_PAGE_POSTS') {
      const post = {id: wrongPost ? '888_42' : postId, created_time: '2025-01-01T12:00:00+0000', message: 'Old published post',
        shares: {count: 3}, reactions: {summary: {total_count: 5}}};
      return {data: [post], paging: {hasMore: paginate && !args.after, cursors: {after: 'next-page'}}};
    }
    if (slug === 'FACEBOOK_GET_PAGE_INSIGHTS') {
      if (unsupported && args.metrics === config.pageMetrics[0]) throw new ComposioToolError(slug, {error: '(#100) Invalid insights metric'});
      return {data: empty ? [] : [{name: args.metrics, period: 'day', values: [
        {value: 12, end_time: new Date((Number(args.since) + 86400) * 1000).toISOString()}
      ]}]};
    }
    if (slug === 'FACEBOOK_GET_POST_INSIGHTS') {
      if (failPost) throw new ComposioToolError(slug, {error: '(#190) Token invalid'});
      return {data: args.metrics.split(',').map(name => ({name, period: 'lifetime', values: [{value: 123}]}))};
    }
    throw new Error('Unexpected tool');
  };
  return {execute, calls};
}

test('history is split into at most 90-day windows, with an exclusive end and strict date validation', () => {
  const history = historyWindows(config, {now});
  assert.equal(history.windows.length, 9);
  assert.equal(history.until, '2026-11-11');
  assert.equal(history.windows[0].since, history.since);
  for (let i = 0; i < history.windows.length; i++) {
    const window = history.windows[i];
    assert.ok((Date.parse(window.until) - Date.parse(window.since)) / 86400000 <= 90);
    if (i) assert.equal(window.since, history.windows[i - 1].until);
  }
  for (const options of [{since: '2026-02-30'}, {days: 731}, {days: 0}, {until: '2026-11-12'}, {since: '2026-11-11'}]) {
    assert.throws(() => historyWindows(config, {...options, now}));
  }
  assert.throws(() => validateComposioConfig({...config, token: key}), /Credentials/);
  assert.throws(() => validateComposioConfig({...config, connectedAccountId: ''}), /setup/);
});

test('session is pinned to one account, enables only analytics tools and disables proxy, workbench and Instant', async () => {
  const requests = [];
  const client = createComposioClient({userApiKey: key, orgId: config.orgId, projectId: config.projectId, fetchImpl: async (url, options) => {
    requests.push({url: String(url), ...options});
    return json({session_id: 'trs_test'});
  }});
  assert.equal(await client.createSession(config), 'trs_test');
  const request = requests[0];
  assert.equal(request.url, 'https://backend.composio.dev/api/v3.1/tool_router/session');
  assert.equal(request.redirect, 'error');
  assert.equal(request.headers['x-user-api-key'], key);
  assert.equal(request.headers['x-org-id'], config.orgId);
  assert.equal(request.headers['x-project-id'], config.projectId);
  const body = JSON.parse(request.body);
  assert.deepEqual(body.connected_accounts, {facebook: ['ca_test']});
  assert.deepEqual(body.tools.facebook.enable, FACEBOOK_READ_TOOLS);
  assert.equal(body.instant, false);
  assert.equal(body.workbench.enable, false);
  assert.equal(body.proxy_execute.enable, false);
  await assert.rejects(client.execute('trs_test', 'FACEBOOK_CREATE_POST', {}, 'ca_test'), /allowlist/);
  assert.equal(requests.length, 1);
  assert.throws(() => createComposioClient({userApiKey: key, orgId: config.orgId}), /both/);
});

test('parses real tool envelopes and removes credential fields and pagination URLs', async () => {
  const client = createComposioClient({userApiKey: key, fetchImpl: async () => json({result_type: 'completed', data: JSON.stringify({
    successful: true, data: {data: [{id: '1', access_token: 'private-provider-token'}],
      paging: {next: 'https://graph.facebook.com/next?access_token=private', cursors: {after: 'cursor'}}}
  })})});
  const result = await client.execute('trs_test', 'FACEBOOK_LIST_MANAGED_PAGES', {}, 'ca_test');
  assert.deepEqual(result, {data: [{id: '1'}], paging: {hasMore: true, cursors: {after: 'cursor', before: undefined}}});
  assert.equal(JSON.stringify(result).includes('private'), false);
  const clean = redactPayload({authorization: key, nested: {api_key: key, note: key, url: 'https://x.test/?access_token=other'}} , key);
  assert.equal(JSON.stringify(clean).includes(key), false);
  assert.equal(JSON.stringify(clean).includes('=other'), false);
});

test('errors never echo upstream response bodies or keys', async () => {
  const client = createComposioClient({userApiKey: key, fetchImpl: async () => json({error: key}, 401)});
  await assert.rejects(client.request('/api/v3.1/anything'), error => /401/.test(error.message) && !error.message.includes(key));
  await assert.rejects(client.request('https://evil.example/'), /unexpected/);
  const tool = new ComposioToolError('FACEBOOK_GET_PAGE_INSIGHTS', {error: '(#100) Invalid insights metric ' + key});
  assert.equal(tool.unsupportedMetric, true);
  assert.equal(tool.code, 100);
  assert.equal(tool.message.includes(key), false);
});

test('collects all published posts including older posts, follows cursors, deduplicates and preserves missing counts', async () => {
  const {execute, calls} = fixture({paginate: true});
  const result = await collectComposio(config, {execute, now, days: 2});
  assert.equal(result.posts.length, 1);
  assert.equal(result.posts[0].created_time, '2025-01-01T12:00:00+0000');
  assert.equal(result.posts[0].comments, null);
  assert.equal(result.posts[0].shares, 3);
  assert.equal(result.posts[0].reactions, 5);
  assert.equal(result.posts[0].insights.series[0].period, 'lifetime');
  assert.equal(result.coverage.publishedPostCount, 1);
  assert.equal(calls.filter(call => call.slug === 'FACEBOOK_LIST_PUBLISHED_PAGE_POSTS').length, 2);
  assert.equal(calls.filter(call => call.slug === 'FACEBOOK_GET_POST_INSIGHTS').length, 1);
  assert.ok(calls.every(call => !call.args.page_id || call.args.page_id === config.pageId));
  assert.equal(JSON.stringify(result).includes('Other Page'), false);
});

test('refuses a different Page or cross-Page post before collecting analytics', async () => {
  const wrong = fixture({wrongPage: true});
  await assert.rejects(collectComposio(config, {...wrong, now, days: 1}), /ANALYZE/);
  assert.equal(wrong.calls.length, 1);
  const cross = fixture({wrongPost: true});
  await assert.rejects(collectComposio(config, {...cross, now, days: 1}), /outside/);
  assert.equal(cross.calls.some(call => call.slug.includes('INSIGHTS')), false);
});

test('records unsupported and empty metrics without replacing them with zero or retrying every old window', async () => {
  const unsupported = fixture({unsupported: true});
  const result = await collectComposio(config, {...unsupported, now});
  assert.equal(result.pageMetrics[0].status, 'unsupported');
  assert.deepEqual(result.pageMetrics[0].series, []);
  assert.deepEqual(result.coverage.unsupportedPageMetrics, [config.pageMetrics[0]]);
  assert.equal(unsupported.calls.filter(call => call.args.metrics === config.pageMetrics[0]).length, 1);
  const empty = await collectComposio(config, {...fixture({empty: true}), now, days: 1});
  assert.equal(empty.pageMetrics[0].status, 'empty');
});

test('real runner preserves latest on token failure, closes sessions, and never publishes credentials', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'teb-composio-test-'));
  const configPath = join(directory, 'config.json');
  const output = join(directory, 'data');
  await writeFile(configPath, JSON.stringify(config));
  const originalFetch = globalThis.fetch, originalKey = process.env.COMPOSIO_USER_API_KEY, originalLog = console.log;
  let failed = false, deletions = 0;
  try {
    process.env.COMPOSIO_USER_API_KEY = key;
    console.log = () => {};
    globalThis.fetch = async (url, options) => {
      if (options.method === 'DELETE') { deletions++; return json({success: true}); }
      if (url.pathname.endsWith('/session')) return json({session_id: 'trs_test'});
      const body = JSON.parse(options.body);
      if (failed && body.tool_slug === 'FACEBOOK_GET_POST_INSIGHTS') return json({result_type: 'failed', error: '(#190) ' + key});
      return json({result_type: 'completed', data: await fixture().execute(body.tool_slug, body.arguments)});
    };
    const args = ['pull', '--config', configPath, '--output', output, '--since', '2026-11-01', '--until', '2026-11-10'];
    await main(args);
    const good = await readFile(join(output, 'latest.json'), 'utf8');
    const report = await readFile(join(output, 'report.html'), 'utf8');
    assert.match(report, /Facebookrapport/);
    assert.equal(report.includes(key), false);
    assert.equal((await stat(join(output, 'report.html'))).mode & 0o777, 0o600);
    assert.equal(good.includes(key), false);
    assert.equal((await stat(join(output, 'latest.json'))).mode & 0o777, 0o600);
    failed = true;
    await assert.rejects(main(args), error => error.code === 190 && !error.message.includes(key));
    assert.equal(await readFile(join(output, 'latest.json'), 'utf8'), good);
    assert.equal(await readFile(join(output, 'report.html'), 'utf8'), report);
    assert.equal((await readdir(output)).includes('.collector-lock'), false);
    assert.equal(deletions, 2);
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    if (originalKey === undefined) delete process.env.COMPOSIO_USER_API_KEY;
    else process.env.COMPOSIO_USER_API_KEY = originalKey;
    await rm(directory, {recursive: true, force: true});
  }
});

test('reads only the local login schema and returns no credential in errors', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'teb-composio-login-'));
  const file = join(directory, 'user_data.json');
  try {
    await writeFile(file, JSON.stringify({api_key: key, org_id: config.orgId}));
    assert.deepEqual(await readComposioLogin({env: {}, file}), {userApiKey: key, orgId: config.orgId});
    await writeFile(file, JSON.stringify({api_key: 'ak_wrong-kind-secret'}));
    await assert.rejects(readComposioLogin({env: {}, file}), error => !error.message.includes('wrong-kind-secret'));
  } finally { await rm(directory, {recursive: true, force: true}); }
});
