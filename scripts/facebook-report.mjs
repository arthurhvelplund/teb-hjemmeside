import {readFile, writeFile, mkdir, chmod, realpath, rename, rm} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join, dirname, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {CollectorError, assertPrivateOutput} from './facebook-analytics.mjs';
import {renderFacebookReport} from './facebook-report-template.mjs';

const defaultInput = join(homedir(), 'Library/Application Support/TEB/facebook-composio/data/latest.json');
const counterNames = {
  views: 'page_media_view', viewers: 'page_total_media_view_unique',
  interactions: 'page_post_engagements', followers: 'page_follows',
  follows: 'page_daily_follows_unique', unfollows: 'page_daily_unfollows_unique',
  reactions: 'page_actions_post_reactions_total', actions: 'page_total_actions', videos: 'page_video_views'
};
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

function valuesFor(snapshot, metric) {
  const result = new Map();
  for (const group of snapshot.pageMetrics || []) for (const series of group.series || []) {
    if (series.name !== metric || series.period !== 'day') continue;
    for (const item of series.values || []) {
      const time = Date.parse(item.end_time);
      if (!Number.isFinite(time) || time > Date.parse(snapshot.fetchedAt)) continue;
      const value = metric === 'page_actions_post_reactions_total' && item.value && typeof item.value === 'object'
        ? Object.values(item.value).every(value => number(value) !== null) ? Object.values(item.value).reduce((a, b) => a + b, 0) : null
        : number(item.value);
      if (result.has(time) && result.get(time).value !== value) throw new CollectorError('Conflicting duplicate daily metric values.');
      result.set(time, {endTime: item.end_time, value});
    }
  }
  return result;
}

function lifetime(post, name) {
  const candidates = (post.insights?.series || []).filter(series => series.name === name && series.period === 'lifetime');
  const values = candidates.flatMap(series => series.values || []);
  return values.length ? number(values.at(-1).value) : null;
}

function safeFacebookUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['www.facebook.com', 'facebook.com', 'm.facebook.com'].includes(url.hostname)
      && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

const sum = (rows, key) => rows.length && rows.every(row => row[key] !== null)
  ? rows.reduce((total, row) => total + row[key], 0) : null;
export function percentChange(current, previous) {
  return current !== null && previous !== null && previous > 0 ? (current / previous - 1) * 100 : null;
}

export function summarizeRange(model, requestedDays) {
  const length = requestedDays === 'all' ? model.daily.length - model.activeStart : Math.min(Number(requestedDays), model.daily.length);
  const start = model.daily.length - length;
  const current = model.daily.slice(start);
  const previous = start >= length ? model.daily.slice(start - length, start) : [];
  const totals = {}, prior = {};
  for (const key of ['views', 'interactions', 'follows', 'unfollows', 'reactions', 'actions', 'videos']) {
    totals[key] = sum(current, key);
    prior[key] = sum(previous, key);
  }
  const dailyViewers = sum(current, 'viewers');
  const boundary = model.daily[start - 1]?.time ?? (current[0]?.time - 86400000);
  const published = model.posts.filter(post => post.createdAt >= boundary && post.createdAt < current.at(-1)?.time);
  return {id: String(requestedDays), length, daily: current, totals, previous: prior,
    changes: {views: percentChange(totals.views, prior.views), interactions: percentChange(totals.interactions, prior.interactions),
      reactions: percentChange(totals.reactions, prior.reactions)},
    followersNow: model.followersNow, netFollows: totals.follows !== null && totals.unfollows !== null ? totals.follows - totals.unfollows : null,
    averageDailyViewers: dailyViewers === null ? null : dailyViewers / current.length,
    // A sum of daily unique viewers is deliberately not exposed as period reach.
    uniquePeriodViewers: null, publicationCount: published.length,
    comparisonIncludesInitialZeros: previous.length > 0 && start - length < model.activeStart,
    coverage: {expectedDays: length, missing: Object.fromEntries(Object.keys(counterNames).map(key => [key, current.filter(row => row[key] === null).length]))},
    firstEndTime: current[0]?.endTime || null, lastEndTime: current.at(-1)?.endTime || null,
    previousFirstEndTime: previous[0]?.endTime || null, previousLastEndTime: previous.at(-1)?.endTime || null};
}

export function buildFacebookReportModel(snapshot) {
  if (snapshot?.schemaVersion !== 2 || snapshot.source !== 'composio-facebook' || !/^\d+$/.test(snapshot.page?.id || '')
    || typeof snapshot.page?.name !== 'string' || !Number.isFinite(Date.parse(snapshot.fetchedAt))) {
    throw new CollectorError('The report requires a valid Composio Facebook snapshot, schemaVersion 2.');
  }
  const maps = Object.fromEntries(Object.entries(counterNames).map(([key, metric]) => [key, valuesFor(snapshot, metric)]));
  const times = [...new Set(Object.values(maps).flatMap(map => [...map.keys()]))].sort((a, b) => a - b);
  if (!times.length) throw new CollectorError('No daily Page metrics are available to define the report period.');
  if (times.some((time, index) => index && (time - times[index - 1] < 22 * 3600000 || time - times[index - 1] > 26 * 3600000))) {
    throw new CollectorError('Daily history contains a date gap or inconsistent day boundaries. Collect a complete period before reporting.');
  }
  const daily = times.map(time => ({time, endTime: Object.values(maps).find(map => map.has(time)).get(time).endTime,
    ...Object.fromEntries(Object.keys(counterNames).map(key => [key, maps[key].get(time)?.value ?? null]))}));
  let activeStart = daily.findIndex(row => Object.keys(counterNames).some(key => row[key] !== null && row[key] > 0));
  if (activeStart < 0) activeStart = 0;
  const posts = (snapshot.posts || []).map(post => {
    if (!new RegExp(`^${snapshot.page.id}_[0-9]+$`).test(post.id || '') || !Number.isFinite(Date.parse(post.created_time))) {
      throw new CollectorError('The report refused a post outside the snapshot Page.');
    }
    const message = typeof post.message === 'string' ? post.message : typeof post.story === 'string' ? post.story : '';
    const headline = message.normalize('NFKC').split(/\r?\n/).find(line => line.trim())?.replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\uFE0F\u200D]/gu, '').trim() || 'Opslag uden tekst';
    return {id: post.id, headline, message, createdAt: Date.parse(post.created_time), createdTime: post.created_time,
      url: safeFacebookUrl(post.permalink_url), views: lifetime(post, 'post_media_view'), viewers: lifetime(post, 'post_total_media_view_unique'),
      reactions: number(post.reactions), comments: number(post.comments), shares: number(post.shares)};
  });
  if (new Set(posts.map(post => post.id)).size !== posts.length) throw new CollectorError('Duplicate post IDs in snapshot.');
  const model = {page: {id: snapshot.page.id, name: snapshot.page.name}, fetchedAt: snapshot.fetchedAt,
    followersNow: number(snapshot.page.followers_count), daily, activeStart, posts,
    requestedCoverage: {since: snapshot.coverage?.since || null, until: snapshot.coverage?.until || null},
    summary: {snapshotDays: daily.length, activeDays: daily.length - activeStart,
      unsupportedPageMetrics: snapshot.coverage?.unsupportedPageMetrics || [], unsupportedPostCount: snapshot.coverage?.unsupportedPostCount || 0}};
  model.ranges = [7, 28, 90, 'all'].map(days => summarizeRange(model, days));
  return model;
}

export async function writeFacebookReport(snapshot, output) {
  const destination = resolve(output);
  assertPrivateOutput(destination);
  const directory = dirname(destination);
  assertPrivateOutput(directory);
  await mkdir(directory, {recursive: true, mode: 0o700});
  assertPrivateOutput(await realpath(directory));
  await chmod(directory, 0o700);
  const html = renderFacebookReport(buildFacebookReportModel(snapshot));
  const temporary = join(directory, `.report-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, html, {mode: 0o600, flag: 'wx'});
    await rename(temporary, destination);
  } finally { await rm(temporary, {force: true}); }
  return destination;
}

export async function main(args = process.argv.slice(2)) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help') { console.log('node scripts/facebook-report.mjs [--input snapshot.json] [--output private-report.html]'); return; }
    if (!['--input', '--output'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) throw new CollectorError('Unknown report option. Use --help.');
    options[args[i].slice(2)] = args[++i];
  }
  const input = resolve(options.input || defaultInput);
  let snapshot;
  try { snapshot = JSON.parse(await readFile(input, 'utf8')); }
  catch { throw new CollectorError('Cannot read the analytics snapshot. Run the collector first.'); }
  const output = await writeFacebookReport(snapshot, options.output || join(dirname(input), 'report.html'));
  console.log(`HTML report saved to ${output}`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(error instanceof CollectorError ? error.message : 'Could not generate the HTML report.'); process.exitCode = 1; });
}
