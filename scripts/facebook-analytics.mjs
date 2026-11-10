import {readFile, mkdir, writeFile, rename, rm, realpath, chmod} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {homedir} from 'node:os';
import {resolve, relative, isAbsolute, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';

const repository = fileURLToPath(new URL('../', import.meta.url));
const graphOrigin = 'https://graph.facebook.com';
const runFile = promisify(execFile);

export class CollectorError extends Error {}

export function validateConfig(config) {
  const validMetrics = values => Array.isArray(values) && values.length > 0 && values.length <= 20
    && values.every(value => typeof value === 'string' && /^[a-z][a-z0-9_]+$/.test(value))
    && new Set(values).size === values.length;
  if (!/^v\d+\.\d+$/.test(config.apiVersion || '') || !/^\d+$/.test(config.pageId || '')
    || typeof config.expectedPageName !== 'string' || !config.expectedPageName.trim()
    || !validMetrics(config.pageMetrics) || !validMetrics(config.postMetrics)
    || !Number.isInteger(config.pageWindowDays) || config.pageWindowDays < 1 || config.pageWindowDays > 90
    || !Number.isInteger(config.postLookbackDays) || config.postLookbackDays < 1 || config.postLookbackDays > 730
    || typeof config.keychainService !== 'string' || !config.keychainService.trim()) {
    throw new CollectorError('Invalid Facebook analytics configuration. See docs/FACEBOOK_ANALYTICS.md.');
  }
  if (Object.keys(config).some(key => /token|secret|password/i.test(key))) {
    throw new CollectorError('Credentials must be supplied by the environment or Keychain, never configuration JSON.');
  }
  return config;
}

export function dateWindow(config, {since, until, now = new Date()} = {}) {
  const end = until || now.toISOString().slice(0, 10);
  const day = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new CollectorError('Dates must use YYYY-MM-DD.');
    const date = new Date(value + 'T00:00:00.000Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new CollectorError('Invalid calendar date.');
    }
    return date;
  };
  const endDate = day(end);
  const before = days => new Date(endDate.getTime() - days * 86400000).toISOString().slice(0, 10);
  const start = since || before(config.pageWindowDays);
  const startDate = day(start);
  const length = (endDate - startDate) / 86400000;
  if (length < 1 || length > 90) throw new CollectorError('Page date range must contain 1 to 90 UTC days.');
  if (endDate > now) throw new CollectorError('The exclusive end date must not be in the future.');
  return {since: start, until: end, postSince: before(config.postLookbackDays), timezone: 'UTC', untilExclusive: true};
}

export function createGraphClient({token, apiVersion, fetchImpl = fetch, sleep = ms => new Promise(r => setTimeout(r, ms))}) {
  if (!token || /\s/.test(token)) throw new CollectorError('A valid Page access token is required.');
  async function request(path, params) {
    const url = new URL(`/${apiVersion}/${path}`, graphOrigin);
    for (const [key, value] of Object.entries(params || {})) url.searchParams.set(key, String(value));
    for (let attempt = 0; attempt < 3; attempt++) {
      let response, body;
      try {
        response = await fetchImpl(url, {
          method: 'GET', headers: {Authorization: `Bearer ${token}`}, redirect: 'error',
          signal: AbortSignal.timeout(30000)
        });
        body = await response.json();
      } catch {
        if (attempt < 2) { await sleep(500 * 2 ** attempt); continue; }
        throw new CollectorError('Facebook network/response failure. No snapshot was published.');
      }
      if (response.ok && !body.error) return body;
      const code = Number.isInteger(body.error?.code) ? body.error.code : null;
      const transient = response.status === 429 || response.status >= 500 || body.error?.is_transient === true;
      if (transient && attempt < 2) { await sleep(500 * 2 ** attempt); continue; }
      const reason = code === 190 ? 'Token expired or invalid. Reconnect the Page.'
        : [10, 200].includes(code) ? 'Check app permissions, app access level and the Page Insights task.'
        : code === 100 ? 'Check the configured metric or field against this API version.'
        : 'Check the Meta app and Page access.';
      // Meta messages/URLs can echo credentials. Only controlled diagnostics leave this client.
      throw new CollectorError(`Facebook request failed (HTTP ${Number(response.status)}, code ${code ?? 'unknown'}). ${reason}`);
    }
  }
  async function list(path, params = {}) {
    const result = [], seen = new Set();
    let query = params;
    for (let page = 0; page < 1000; page++) {
      const body = await request(path, query);
      if (!Array.isArray(body.data)) throw new CollectorError('Facebook returned an invalid collection.');
      result.push(...body.data);
      if (!body.paging?.next) return result;
      let next;
      try { next = new URL(body.paging.next); } catch { throw new CollectorError('Invalid Facebook pagination URL.'); }
      if (next.origin !== graphOrigin || next.pathname !== `/${apiVersion}/${path}` || next.username || next.password || next.hash) {
        throw new CollectorError('Refused pagination outside the requested Facebook endpoint.');
      }
      next.searchParams.delete('access_token');
      next.searchParams.delete('appsecret_proof');
      const signature = next.searchParams.toString();
      if (seen.has(signature)) throw new CollectorError('Facebook pagination repeated a page.');
      seen.add(signature);
      query = Object.fromEntries(next.searchParams);
    }
    throw new CollectorError('Facebook pagination exceeded the collection limit.');
  }
  return {request, list};
}

function metricSeries(items, metric) {
  if (!items.length) return {metric, status: 'empty', series: []};
  if (items.some(item => item.name !== metric || !Array.isArray(item.values))) {
    throw new CollectorError('Facebook returned an unexpected metric shape.');
  }
  return {metric, status: 'available', series: items.map(item => ({
    name: item.name, period: item.period, title: item.title,
    description: item.description, values: item.values.map(value => ({value: value.value, end_time: value.end_time}))
  }))};
}

export async function collectAnalytics(config, {token, since, until, now = new Date(), fetchImpl, sleep} = {}) {
  validateConfig(config);
  const window = dateWindow(config, {since, until, now});
  const graph = createGraphClient({token, apiVersion: config.apiVersion, fetchImpl, sleep});
  const identity = await graph.request('me', {fields: 'id,name'});
  if (identity.id !== config.pageId || identity.name !== config.expectedPageName) {
    throw new CollectorError('Token Page identity does not match the configured TEB Page. Nothing was collected.');
  }
  const epoch = value => Date.parse(value + 'T00:00:00Z') / 1000;
  const pageMetrics = [];
  for (const metric of config.pageMetrics) {
    pageMetrics.push(metricSeries(await graph.list(`${config.pageId}/insights`, {
      metric, period: 'day', since: epoch(window.since), until: epoch(window.until)
    }), metric));
  }
  const candidates = await graph.list(`${config.pageId}/published_posts`, {
    fields: 'id,message,created_time,permalink_url', limit: 100,
    since: epoch(window.postSince), until: epoch(window.until)
  });
  const posts = [];
  const ids = new Set();
  for (const post of candidates) {
    if (typeof post.id !== 'string' || !new RegExp(`^${config.pageId}_[0-9]+$`).test(post.id)
      || !Number.isFinite(Date.parse(post.created_time))) throw new CollectorError('Unexpected Facebook post identity/date.');
    const created = Date.parse(post.created_time);
    if (created < epoch(window.postSince) * 1000 || created >= epoch(window.until) * 1000 || ids.has(post.id)) continue;
    ids.add(post.id);
    const insights = [];
    for (const metric of config.postMetrics) {
      insights.push(metricSeries(await graph.list(`${post.id}/insights`, {metric, period: 'lifetime'}), metric));
    }
    posts.push({id: post.id, message: post.message || '', created_time: post.created_time,
      permalink_url: post.permalink_url, insights});
  }
  return {schemaVersion: 1, fetchedAt: now.toISOString(), apiVersion: config.apiVersion,
    page: {id: identity.id, name: identity.name}, window, pageMetrics, posts,
    notes: ['Page metrics use day periods; preserve Meta end_time values without relabelling their timezone.',
      'Post metrics are lifetime values at fetchedAt for posts published within postSince <= created_time < until.',
      'Empty metrics mean unavailable/no data, never zero. Stories and dedicated reels analytics are outside this collector.']};
}

export async function saveSnapshot(output, snapshot) {
  const suffix = snapshot.fetchedAt.replace(/[:.]/g, '-') + '-' + randomUUID();
  const file = join(output, `snapshot-${suffix}.json`);
  const temporary = join(output, `.latest-${randomUUID()}.tmp`);
  await writeFile(file, JSON.stringify(snapshot, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
  try {
    await writeFile(temporary, JSON.stringify(snapshot, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
    await rename(temporary, join(output, 'latest.json'));
  } finally { await rm(temporary, {force: true}); }
  return file;
}

export function assertPrivateOutput(output) {
  const path = relative(repository, resolve(output));
  if (!path || (!isAbsolute(path) && path !== '..' && !path.startsWith('../'))) {
    throw new CollectorError('Analytics output must be outside the Git repository and website.');
  }
}

async function readToken(config, env) {
  if (env.TEB_FB_PAGE_ACCESS_TOKEN) return env.TEB_FB_PAGE_ACCESS_TOKEN.trim();
  if (process.platform === 'darwin') {
    try {
      const {stdout} = await runFile('/usr/bin/security', ['find-generic-password', '-s', config.keychainService, '-a', config.pageId, '-w'], {timeout: 15000});
      return stdout.trim();
    } catch { /* Do not print child-process output, which could contain credentials. */ }
  }
  throw new CollectorError('Missing Page token. Set TEB_FB_PAGE_ACCESS_TOKEN via a secret manager, or add the documented macOS Keychain item.');
}

export async function main(args = process.argv.slice(2)) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const name = args[index];
    if (name === '--help') {
      console.log('node scripts/facebook-analytics.mjs [--config path] [--output directory] [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--check-config]');
      return;
    }
    if (name === '--check-config') { options.check = true; continue; }
    if (!['--config', '--output', '--since', '--until'].includes(name) || !args[index + 1] || args[index + 1].startsWith('--')) {
      throw new CollectorError('Unknown or incomplete option. Use --help. Never pass a token as an argument.');
    }
    options[name.slice(2)] = args[++index];
  }
  const configFile = options.config || join(repository, 'config/facebook-analytics.example.json');
  let config;
  try { config = validateConfig(JSON.parse(await readFile(configFile, 'utf8'))); }
  catch (error) { if (error instanceof CollectorError) throw error; throw new CollectorError('Cannot read analytics configuration JSON.'); }
  dateWindow(config, options);
  const output = resolve(options.output || join(homedir(), 'Library/Application Support/TEB/facebook-analytics'));
  assertPrivateOutput(output);
  if (options.check) { console.log('Configuration valid. No token was read and no Facebook request was made.'); return; }
  const token = await readToken(config, process.env);
  await mkdir(output, {recursive: true, mode: 0o700});
  assertPrivateOutput(await realpath(output));
  await chmod(output, 0o700);
  const lock = join(output, '.collector-lock');
  try { await mkdir(lock, {mode: 0o700}); }
  catch { throw new CollectorError('Collector output is locked or unavailable. Check for another run before removing a stale .collector-lock.'); }
  try {
    const snapshot = await collectAnalytics(config, {token, since: options.since, until: options.until});
    await saveSnapshot(output, snapshot);
    const empty = [...snapshot.pageMetrics, ...snapshot.posts.flatMap(post => post.insights)].filter(item => item.status === 'empty').length;
    console.log(`Facebook snapshot saved: ${snapshot.posts.length} posts, ${snapshot.pageMetrics.length} Page metrics, ${empty} empty metric results.`);
  } finally { await rm(lock, {recursive: true, force: true}); }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    console.error(error instanceof CollectorError ? error.message : 'Collector failed. No success is reported; check configuration and output permissions.');
    process.exitCode = 1;
  });
}
