import {readFile, writeFile, mkdir, chmod, realpath, rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {homedir} from 'node:os';
import {resolve, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {CollectorError, assertPrivateOutput, saveSnapshot} from './facebook-analytics.mjs';
import {createComposioClient, readComposioLogin, ComposioToolError, redactPayload} from './composio-consumer.mjs';

const runFile = promisify(execFile);
const repository = fileURLToPath(new URL('../', import.meta.url));
export const defaultDirectory = join(homedir(), 'Library/Application Support/TEB/facebook-composio');
const defaultConfig = join(defaultDirectory, 'config.json');
const epoch = date => Date.parse(date + 'T00:00:00Z') / 1000;

export function validateComposioConfig(config, {requireConnection = true} = {}) {
  if (!/^\d+$/.test(config.pageId || '') || typeof config.expectedPageName !== 'string' || !config.expectedPageName
    || !Number.isInteger(config.historyDays) || config.historyDays < 1 || config.historyDays > 730) {
    throw new CollectorError('Invalid Composio collector Page or history configuration.');
  }
  for (const [kind, prefix] of [['pageMetrics', 'page_'], ['postMetrics', 'post_']]) {
    if (!Array.isArray(config[kind]) || !config[kind].length || config[kind].length > 20
      || config[kind].some(metric => !new RegExp('^' + prefix + '[a-z0-9_]+$').test(metric))
      || new Set(config[kind]).size !== config[kind].length) throw new CollectorError('Invalid analytics metric list.');
  }
  if (Object.keys(config).some(key => /token|secret|password|api.?key/i.test(key))) {
    throw new CollectorError('Credentials must not be stored in collector configuration.');
  }
  if (requireConnection && (!/^(?:org|ok)_[\w-]+$/.test(config.orgId || '')
    || !/^(?:proj|pr)_[\w-]+$/.test(config.projectId || '') || !/^ca_[\w-]+$/.test(config.connectedAccountId || '')
    || typeof config.userId !== 'string' || !config.userId)) throw new CollectorError('Run setup to configure your own Composio connection.');
  return config;
}

export function historyWindows(config, {since, until, days, now = new Date()} = {}) {
  const parse = date => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new CollectorError('Dates must use YYYY-MM-DD.');
    const value = new Date(date + 'T00:00:00Z');
    if (!Number.isFinite(value.getTime()) || value.toISOString().slice(0, 10) !== date) throw new CollectorError('Invalid date.');
    return value;
  };
  const end = parse(until || now.toISOString().slice(0, 10));
  const count = days === undefined ? config.historyDays : Number(days);
  if (!Number.isInteger(count) || count < 1 || count > 730) throw new CollectorError('History length must be 1 to 730 days.');
  const start = since ? parse(since) : new Date(end.getTime() - count * 86400000);
  if (start >= end || end > now || end - start > 730 * 86400000) throw new CollectorError('Choose 1 to 730 completed UTC days.');
  const windows = [];
  for (let cursor = start.getTime(); cursor < end.getTime(); cursor += 90 * 86400000) {
    windows.push({since: new Date(cursor).toISOString().slice(0, 10),
      until: new Date(Math.min(cursor + 90 * 86400000, end.getTime())).toISOString().slice(0, 10)});
  }
  return {since: start.toISOString().slice(0, 10), until: end.toISOString().slice(0, 10), windows};
}

export async function listAll(execute, slug, args) {
  const data = [], seen = new Set();
  let after;
  for (let page = 0; page < 1000; page++) {
    const response = await execute(slug, {...args, ...(after ? {after} : {})});
    if (!Array.isArray(response?.data)) throw new CollectorError('Unexpected Facebook collection response.');
    data.push(...response.data);
    if (!response.paging?.hasMore) return data;
    after = response.paging.cursors?.after;
    if (typeof after !== 'string' || !after || seen.has(after)) throw new CollectorError('Facebook pagination is incomplete or repeated. No complete snapshot can be published.');
    seen.add(after);
  }
  throw new CollectorError('Facebook pagination limit reached. No complete snapshot was published.');
}

function normalizeMetrics(response, requested) {
  if (!Array.isArray(response?.data)) throw new CollectorError('Unexpected Facebook Insights response.');
  return response.data.map(item => {
    if (typeof item.name !== 'string' || !Array.isArray(item.values)) throw new CollectorError('Unexpected Facebook metric shape.');
    return {requestedMetric: requested, name: item.name, period: item.period,
      title: item.title, description: item.description,
      values: item.values.map(value => ({value: value.value, end_time: value.end_time}))};
  });
}

export async function collectComposio(config, {execute, now = new Date(), since, until, days, progress = () => {}}) {
  validateComposioConfig(config);
  const history = historyWindows(config, {since, until, days, now});
  const managed = await listAll(execute, 'FACEBOOK_LIST_MANAGED_PAGES', {fields: 'id,name,tasks', limit: 100});
  const pageAccess = managed.find(page => page.id === config.pageId && page.name === config.expectedPageName);
  if (!pageAccess || !Array.isArray(pageAccess.tasks) || !pageAccess.tasks.includes('ANALYZE')) {
    throw new CollectorError('The selected connection does not grant ANALYZE access to the configured TEB Page.');
  }
  const page = await execute('FACEBOOK_GET_PAGE_DETAILS', {page_id: config.pageId, fields: 'id,name,fan_count,followers_count,website,link'});
  if (page.id !== config.pageId || page.name !== config.expectedPageName) throw new CollectorError('TEB Page identity verification failed.');
  const published = await listAll(execute, 'FACEBOOK_LIST_PUBLISHED_PAGE_POSTS', {page_id: config.pageId, limit: 100,
    fields: 'id,message,story,created_time,updated_time,permalink_url,full_picture,shares,reactions.limit(0).summary(true),comments.limit(0).summary(true)'});
  const uniquePosts = new Map();
  for (const post of published) {
    if (!new RegExp(`^${config.pageId}_[0-9]+$`).test(post.id || '') || !Number.isFinite(Date.parse(post.created_time))) {
      throw new CollectorError('Facebook returned a post outside the configured Page or without a valid date.');
    }
    uniquePosts.set(post.id, post);
  }
  progress(`Verified TEB. Found ${uniquePosts.size} published posts. Fetching ${history.windows.length} history windows.`);
  const pageMetrics = [];
  for (const metric of config.pageMetrics) {
    const chunks = [], series = new Map();
    for (const window of history.windows) {
      try {
        const response = await execute('FACEBOOK_GET_PAGE_INSIGHTS', {
          page_id: config.pageId, metrics: metric, period: 'day', since: String(epoch(window.since)), until: String(epoch(window.until))
        });
        const items = normalizeMetrics(response, metric);
        chunks.push({...window, status: items.length ? 'available' : 'empty'});
        for (const item of items) {
          const key = item.name + '/' + item.period;
          if (!series.has(key)) series.set(key, {...item, values: new Map()});
          for (const value of item.values) {
            if (!value.end_time || !Number.isFinite(Date.parse(value.end_time))) throw new CollectorError('Daily insight has no valid end_time.');
            series.get(key).values.set(value.end_time, value);
          }
        }
      } catch (error) {
        if (!(error instanceof ComposioToolError) || !error.unsupportedMetric) throw error;
        chunks.push({...window, status: 'unsupported', code: error.code});
        break;
      }
    }
    const values = [...series.values()].map(item => ({...item, values: [...item.values.values()].sort((a, b) => Date.parse(a.end_time) - Date.parse(b.end_time))}));
    pageMetrics.push({requestedMetric: metric, status: chunks.some(chunk => chunk.status === 'unsupported') ? 'unsupported'
      : values.some(item => item.values.length) ? 'available' : 'empty', chunks, series: values});
    progress(`Page metric ${pageMetrics.length}/${config.pageMetrics.length} completed.`);
  }
  const posts = [];
  for (const post of uniquePosts.values()) {
    let insights;
    try {
      const response = await execute('FACEBOOK_GET_POST_INSIGHTS', {post_id: post.id, metrics: config.postMetrics.join(','), period: 'lifetime'});
      insights = {status: response.data?.length ? 'available' : 'empty', requestedMetrics: config.postMetrics,
        series: normalizeMetrics(response, config.postMetrics.join(','))};
    } catch (error) {
      if (!(error instanceof ComposioToolError) || !error.unsupportedMetric) throw error;
      insights = {status: 'unsupported', code: error.code, requestedMetrics: config.postMetrics, series: []};
    }
    const count = value => Number.isFinite(value) && value >= 0 ? value : null;
    posts.push({id: post.id, message: post.message ?? null, story: post.story ?? null, created_time: post.created_time,
      updated_time: post.updated_time ?? null, permalink_url: post.permalink_url ?? null, image_url: post.full_picture ?? null,
      reactions: count(post.reactions?.summary?.total_count), comments: count(post.comments?.summary?.total_count),
      shares: count(post.shares?.count), insights});
    if (posts.length % 5 === 0 || posts.length === uniquePosts.size) progress(`Post insights ${posts.length}/${uniquePosts.size} completed.`);
  }
  return {schemaVersion: 2, source: 'composio-facebook', fetchedAt: now.toISOString(),
    page: {id: page.id, name: page.name, fan_count: page.fan_count ?? null, followers_count: page.followers_count ?? null,
      website: page.website ?? null, link: page.link ?? null},
    coverage: {since: history.since, until: history.until, untilExclusive: true, requestedTimezone: 'UTC',
      publishedPosts: 'All published posts returned by the Page endpoint, with cursor pagination.',
      publishedPostCount: posts.length, pageWindowCount: history.windows.length,
      unsupportedPageMetrics: pageMetrics.filter(item => item.status === 'unsupported').map(item => item.requestedMetric),
      unsupportedPostCount: posts.filter(post => post.insights.status === 'unsupported').length},
    pageMetrics, posts,
    notes: ['Raw Meta metric names and end_time values are preserved. Missing and unsupported data are never zero.',
      'Post metrics and engagement counts are lifetime observations at fetchedAt, not totals limited to the Page history window.',
      'All available means the named metrics and published posts exposed by this authorized API, not every Business Suite metric.',
      'Messages, visitor comments, ads administration, stories endpoints, and downloading media files are outside this collector.',
      'Unique viewers are not additive across days or posts. Image URLs may expire.']};
}

async function privateDirectory(directory) {
  assertPrivateOutput(directory);
  await mkdir(directory, {recursive: true, mode: 0o700});
  assertPrivateOutput(await realpath(directory));
  await chmod(directory, 0o700);
}

export async function setupComposio({configPath = defaultConfig, account, templatePath = join(repository, 'config/facebook-composio.example.json')} = {}) {
  const template = validateComposioConfig(JSON.parse(await readFile(templatePath, 'utf8')), {requireConnection: false});
  const login = await readComposioLogin();
  const orgId = process.env.COMPOSIO_ORG_ID || login.orgId;
  if (!orgId) throw new CollectorError('Select an organization with composio login or set COMPOSIO_ORG_ID.');
  const initial = createComposioClient({userApiKey: login.userApiKey});
  const project = await initial.request('/api/v3.1/org/consumer/project/resolve', {method: 'POST', organization: orgId});
  let connections;
  try {
    const {stdout} = await runFile(process.env.TEB_COMPOSIO_CLI || join(homedir(), '.local/bin/composio'), ['connections', 'list', '--toolkit', 'facebook'],
      {env: {...process.env, COMPOSIO_CLI_TELEMETRY_DISABLED: '1'}, timeout: 30000});
    connections = JSON.parse(stdout).facebook?.filter(item => item.status === 'ACTIVE' && (!account || item.id === account || item.word_id === account));
  } catch { throw new CollectorError('Cannot list local Facebook connections. Check composio login and CLI installation.'); }
  if (connections?.length !== 1) throw new CollectorError('Select exactly one active Facebook connection with setup --account <connection-id>.');
  const config = validateComposioConfig({...template, orgId: project.org_id, projectId: project.project_nano_id,
    userId: project.consumer_user_id, connectedAccountId: connections[0].id});
  const client = createComposioClient({...login, orgId: config.orgId, projectId: config.projectId});
  const sessionId = await client.createSession(config);
  try {
    const pages = await listAll((slug, args) => client.execute(sessionId, slug, args, config.connectedAccountId),
      'FACEBOOK_LIST_MANAGED_PAGES', {fields: 'id,name,tasks', limit: 100});
    if (!pages.some(page => page.id === config.pageId && page.name === config.expectedPageName && page.tasks?.includes('ANALYZE'))) {
      throw new CollectorError('This Composio account does not have TEB Insights access. Connect the correct Facebook account first.');
    }
    const directory = resolve(configPath, '..');
    await privateDirectory(directory);
    await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', {mode: 0o600});
    await chmod(configPath, 0o600);
    console.log('Composio setup verified TEB ANALYZE access. Private configuration saved; no credentials were copied.');
  } finally { await client.closeSession(sessionId).catch(() => {}); }
  return config;
}

export async function main(args = process.argv.slice(2)) {
  const command = args[0] || 'pull', options = {};
  if (command === '--help' || command === 'help') {
    console.log('node scripts/facebook-composio.mjs setup|pull|check [--config path] [--account connection-id] [--output directory] [--days 1..730] [--since YYYY-MM-DD] [--until YYYY-MM-DD]');
    return;
  }
  if (!['setup', 'pull', 'check'].includes(command)) throw new CollectorError('Unknown command. Use --help.');
  for (let i = 1; i < args.length; i++) {
    if (!['--config', '--account', '--output', '--days', '--since', '--until'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) {
      throw new CollectorError('Unknown/incomplete option. Never pass credentials on the command line.');
    }
    options[args[i].slice(2)] = args[++i];
  }
  const configPath = resolve(options.config || defaultConfig);
  if (command === 'setup') return setupComposio({configPath, account: options.account});
  let config;
  try { config = validateComposioConfig(JSON.parse(await readFile(configPath, 'utf8'))); }
  catch (error) { if (error instanceof CollectorError) throw error; throw new CollectorError('Run setup first; private Composio configuration was not found.'); }
  historyWindows(config, options);
  if (command === 'check') { console.log('Local collector configuration is valid. No external request was made.'); return; }
  const output = resolve(options.output || join(defaultDirectory, 'data'));
  await privateDirectory(output);
  const lock = join(output, '.collector-lock');
  try { await mkdir(lock, {mode: 0o700}); } catch { throw new CollectorError('Another run owns the collector lock, or output is unavailable.'); }
  let client, sessionId;
  try {
    const login = await readComposioLogin();
    client = createComposioClient({...login, orgId: config.orgId, projectId: config.projectId});
    sessionId = await client.createSession(config);
    const snapshot = await collectComposio(config, {...options,
      execute: (slug, params) => client.execute(sessionId, slug, params, config.connectedAccountId), progress: line => console.log(line)});
    const path = await saveSnapshot(output, redactPayload(snapshot, login.userApiKey));
    console.log(`Saved ${snapshot.posts.length} TEB posts and ${snapshot.pageMetrics.length} Page metric histories to ${path}`);
  } finally {
    if (sessionId) await client.closeSession(sessionId).catch(() => {});
    await rm(lock, {recursive: true, force: true});
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    console.error(error instanceof CollectorError ? error.message : 'Composio collector failed. The last good snapshot was not replaced.');
    process.exitCode = 1;
  });
}
