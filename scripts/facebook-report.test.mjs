import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, stat, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildFacebookReportModel, percentChange, writeFacebookReport} from './facebook-report.mjs';
import {renderFacebookReport} from './facebook-report-template.mjs';
import {renderFacebookEmail} from './facebook-report-email.mjs';

function fixture() {
  const metrics = {
    page_media_view: i => i < 28 ? 10 : 20,
    page_total_media_view_unique: () => 4,
    page_post_engagements: () => 3,
    page_follows: i => 100 + i,
    page_daily_follows_unique: () => 1,
    page_daily_unfollows_unique: () => 0,
    page_actions_post_reactions_total: () => ({like: 2, love: 1}),
    page_total_actions: () => 0,
    page_video_views: () => 0
  };
  return {schemaVersion: 2, source: 'composio-facebook', fetchedAt: '2026-11-01T12:00:00Z',
    page: {id: '123', name: 'Test Page', followers_count: 155}, coverage: {since: '2026-09-06', until: '2026-11-01'},
    pageMetrics: Object.entries(metrics).map(([name, fn]) => ({series: [{name, period: 'day', values: Array.from({length: 56}, (_, i) => ({
      end_time: new Date(Date.UTC(2026, 8, 7 + i, 8)).toISOString(), value: fn(i)
    }))}]})), posts: [{id: '123_1', created_time: '2026-09-10T12:00:00Z', message: 'An older post',
      reactions: 7, comments: 0, shares: null, permalink_url: 'https://www.facebook.com/test/posts/1', insights: {series: [
        {name: 'post_media_view', period: 'lifetime', values: [{value: 900}]},
        {name: 'post_total_media_view_unique', period: 'lifetime', values: [{value: 500}]}
      ]}}]};
}

test('compares equal 28-day periods without adding follower levels or unique audiences', () => {
  const model = buildFacebookReportModel(fixture()), range = model.ranges.find(row => row.id === '28');
  assert.equal(range.totals.views, 560);
  assert.equal(range.previous.views, 280);
  assert.equal(range.changes.views, 100);
  assert.equal(range.followersNow, 155);
  assert.equal(range.netFollows, 28);
  assert.equal(range.averageDailyViewers, 4);
  assert.equal(range.uniquePeriodViewers, null);
  assert.equal(range.totals.reactions, 84);
  assert.equal(range.totals.actions, 0);
  assert.equal(range.publicationCount, 0);
  assert.equal(model.posts[0].views, 900); // Older lifetime posts remain available.
  assert.equal(model.posts[0].shares, null);
  assert.equal(model.posts[0].comments, 0);
});

test('missing observations stay unknown, with reference dates supplied by other metrics', () => {
  const snapshot = fixture();
  snapshot.pageMetrics[0].series[0].values.pop();
  snapshot.pageMetrics[1].series[0].values.pop();
  const range = buildFacebookReportModel(snapshot).ranges.find(row => row.id === '28');
  assert.equal(range.length, 28);
  assert.equal(range.totals.views, null);
  assert.equal(range.averageDailyViewers, null);
  assert.equal(range.coverage.missing.views, 1);
  assert.equal(range.changes.views, null);
  assert.equal(range.totals.actions, 0);
});

test('zero comparison and short histories do not invent growth percentages', () => {
  assert.equal(percentChange(30, 0), null);
  assert.equal(percentChange(null, 20), null);
  const snapshot = fixture();
  for (const group of snapshot.pageMetrics) group.series[0].values = group.series[0].values.slice(-7);
  const range = buildFacebookReportModel(snapshot).ranges.find(row => row.id === '28');
  assert.equal(range.length, 7);
  assert.equal(range.previous.views, null);
  assert.equal(range.changes.views, null);
});

test('accepts a DST boundary, deduplicates exact overlaps and rejects gaps or conflicting values', () => {
  const snapshot = fixture(), views = snapshot.pageMetrics[0].series[0];
  views.values.push({...views.values[0]});
  assert.equal(buildFacebookReportModel(snapshot).daily.length, 56);
  views.values.at(-1).value = 999;
  assert.throws(() => buildFacebookReportModel(snapshot), /Conflicting/);
  views.values.pop();
  for (const group of snapshot.pageMetrics) group.series[0].values.splice(35, 1);
  assert.throws(() => buildFacebookReportModel(snapshot), /date gap/);
  const dst = fixture();
  for (const group of dst.pageMetrics) for (const [index, value] of group.series[0].values.entries()) {
    if (index < 49) value.end_time = value.end_time.replace('08:00:', '07:00:');
  }
  assert.equal(buildFacebookReportModel(dst).daily.length, 56);
});

test('rejects cross-Page posts and strips unsafe links and non-report fields', () => {
  const snapshot = fixture();
  snapshot.posts[0].permalink_url = 'https://facebook.com.evil.example/';
  snapshot.access_token = 'private-token';
  snapshot.posts[0].image_url = 'https://tracking.example/';
  const model = buildFacebookReportModel(snapshot);
  assert.equal(model.posts[0].url, null);
  assert.equal(JSON.stringify(model).includes('private-token'), false);
  assert.equal(JSON.stringify(model).includes('tracking.example'), false);
  snapshot.posts[0].id = '456_1';
  assert.throws(() => buildFacebookReportModel(snapshot), /outside/);
});

test('embedded post text cannot close a script or title and execute HTML', () => {
  const snapshot = fixture();
  snapshot.page.name = '</title><img src=x onerror=alert(1)>';
  snapshot.posts[0].message = '</script><script>alert(1)</script>\u2028&';
  const model = buildFacebookReportModel(snapshot), html = renderFacebookReport(model);
  assert.equal(html.includes(snapshot.posts[0].message), false);
  assert.equal(html.includes(snapshot.page.name), false);
  assert.match(html, /connect-src 'none'/);
  const json = html.match(/<script id="report-data" type="application\/json">([\s\S]*?)<\/script>/)[1];
  assert.equal(JSON.parse(json).posts[0].message, snapshot.posts[0].message);
  assert.equal((html.match(/<script[ >]/g) || []).length, 2);
});

test('writes an offline private report atomically outside the repo and rejects symlink output into it', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'teb-report-'));
  try {
    const output = join(directory, 'data/report.html');
    await writeFacebookReport(fixture(), output);
    const good = await readFile(output, 'utf8');
    assert.match(good, /Facebookrapport/);
    assert.equal((await stat(output)).mode & 0o777, 0o600);
    assert.equal((await stat(join(directory, 'data'))).mode & 0o777, 0o700);
    await assert.rejects(writeFacebookReport({}, output), /valid Composio/);
    assert.equal(await readFile(output, 'utf8'), good);
    const repository = new URL('../', import.meta.url).pathname;
    await assert.rejects(writeFacebookReport(fixture(), join(repository, 'report.html')), /outside/);
    await symlink(repository, join(directory, 'linked'));
    await assert.rejects(writeFacebookReport(fixture(), join(directory, 'linked/report.html')), /outside/);
  } finally { await rm(directory, {recursive: true, force: true}); }
});

test('email contains static readable numbers, escaped content and safe links, without active code or attachments', () => {
  const snapshot = fixture();
  snapshot.posts[0].message = '<script>alert(1)</script> & Report';
  snapshot.posts[0].permalink_url = 'javascript:alert(1)';
  const {html, text, subject} = renderFacebookEmail(buildFacebookReportModel(snapshot));
  assert.match(html, /560/);
  assert.match(html, /900/);
  assert.match(html, /Livstid/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script|<svg|<img|<iframe|<input|<button|javascript:|display:grid|display:flex/i);
  assert.match(text, /Visninger: 560/);
  assert.match(text, /dagligt gennemsnit/i);
  assert.match(subject, /TEB/);
  assert.equal(Buffer.byteLength(html) < 90000, true);
});
