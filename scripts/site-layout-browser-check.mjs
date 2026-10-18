import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { readFile, readdir, mkdtemp, mkdir, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(resolve(root, 'calendar-worker/package.json'));
const { chromium } = require('playwright');
const socket = createServer();socket.listen(0, '127.0.0.1');await once(socket, 'listening');
const port = socket.address().port;await new Promise(done => socket.close(done));
const origin = 'http://localhost:' + port;
const runtime = await mkdtemp(join(tmpdir(), 'teb-layout-browser-'));
const output = resolve(root, 'output/portal-integreret');await mkdir(output, { recursive: true });
const service = spawn(process.execPath, ['scripts/dev.mjs'], { cwd: resolve(root, 'calendar-worker'), env: { ...process.env, PORT: String(port), CALENDAR_DATA_DIR: runtime }, stdio: ['ignore', 'ignore', 'pipe'] });
let browser, stderr = '';service.stderr.on('data', chunk => stderr += chunk);
try {
  const readyDeadline = Date.now() + 45000;
  for (;;) {
    if (service.exitCode !== null || Date.now() >= readyDeadline) throw Error('Local startup failed: ' + stderr.slice(-800));
    try { if ((await fetch('http://127.0.0.1:' + port + '/api/kalender/config', {signal:AbortSignal.timeout(1000)})).ok) break; } catch {}
    await new Promise(done => setTimeout(done, 150));
  }
  let executablePath = process.env.CHROME_PATH;
  if (!executablePath && process.platform === 'darwin') {
    const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    try { await access(chrome);executablePath = chrome; } catch {}
  }
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const context = await browser.newContext({ baseURL: origin, viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage();page.setDefaultTimeout(15000);
  const errors = [], broken = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().startsWith(origin) && response.status() >= 400 && ['stylesheet','script','image','font'].includes(response.request().resourceType())) broken.push(new URL(response.url()).pathname);
  });
  await page.clock.install({ time: new Date('2026-10-18T12:00:00Z') });
  const pages = [];
  for (const name of await readdir(resolve(root, 'site'))) {
    if (name.endsWith('.html') && (await readFile(resolve(root, 'site', name), 'utf8')).includes('class="site-header"')) pages.push(name);
  }
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const name of pages) {
      await page.goto('/' + name);await page.locator('main').waitFor();
      const result = await page.evaluate(() => {
        const hero = document.querySelector('main > .hero-full, main > .page-hero');
        const foreground = [...(hero?.querySelectorAll('.eyebrow,h1,.lead,.btn-row a,.fp-actions a,.fp-actions button') || [])].map(node => node.getBoundingClientRect());
        const overlap = (a, b) => Math.min(a.right,b.right)-Math.max(a.left,b.left)>2 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2;
        const collisions = hero?.classList.contains('hero-full') ? [] : [...(hero?.querySelectorAll('.halloween-decor img') || [])].filter(node => node.getClientRects().length).filter(node => foreground.some(box => overlap(node.getBoundingClientRect(),box))).map(node => node.parentElement.className);
        const bounds=hero.getBoundingClientRect(),decorBounds=hero.querySelector('[data-seasonal-decor]').getBoundingClientRect();
        return {
          theme: document.documentElement.dataset.seasonalTheme, decor: document.querySelectorAll('[data-seasonal-decor]').length,
          header: document.querySelectorAll('.site-header').length, footer: document.querySelectorAll('.site-footer').length,
          overflow: document.documentElement.scrollWidth > innerWidth, collisions,
          contained:['left','top','width','height'].every(key=>Math.abs(bounds[key]-decorBounds[key])<1),
          heroBackground: hero?.classList.contains('hero-full') ? 'image' : getComputedStyle(hero).backgroundImage
        };
      });
      assert.equal(result.theme, 'halloween', name);assert.equal(result.decor, 1, name);
      assert.equal(result.header, 1);assert.equal(result.footer, 1);
      assert.ok(result.contained,name+' decoration must stay inside its own heading');
      if (result.overflow) {
        console.log(await page.evaluate(() => [...document.querySelectorAll('main *')].filter(node => node.getBoundingClientRect().right > innerWidth + 1).map(node => ({tag:node.tagName,class:node.className,right:Math.round(node.getBoundingClientRect().right)})).slice(0,12)));
        await page.screenshot({path:resolve(output,'layout-overflow.png'),fullPage:true});
      }
      assert.equal(result.overflow, false, name + ' overflow at ' + width);
      assert.deepEqual(result.collisions, [], name + ' decoration overlaps text at ' + width);
      if (result.heroBackground !== 'image') assert.equal(result.heroBackground, 'none', name + ' detached hero background');
      if (['index.html','forening.html','kalender.html','kalender-postkasse.html','nyt.html'].includes(name) && width !== 390) await page.screenshot({ path: resolve(output, `layout-${name.replace('.html','')}-${width}.png`), fullPage: true });
    }
  }
  for (const date of ['2026-10-08T12:00:00Z', '2026-11-01T12:00:00Z']) {
    await page.clock.setFixedTime(new Date(date));
    for (const name of pages) {
      await page.goto('/' + name);
      assert.equal(await page.locator('html').getAttribute('data-seasonal-theme'), null, name + ' inactive theme');
      assert.equal(await page.locator('[data-seasonal-decor]').count(), 0, name + ' inactive decoration');
    }
  }
  // Theme switches off while a page stays open, and repeated script loads stay idempotent.
  const boundaryContext = await browser.newContext({ baseURL: origin });
  const boundary = await boundaryContext.newPage();
  boundary.on('pageerror', error => errors.push(error.message));
  await boundary.clock.install({ time: new Date('2026-10-31T22:59:50Z') });
  await boundary.goto('/kalender-postkasse.html');
  const source = await boundary.locator('script[src*="seasonal-theme.js"]').getAttribute('src');
  await boundary.addScriptTag({ url: source });await boundary.evaluate(() => window.TEBSeasonalTheme.refresh());
  assert.equal(await boundary.locator('[data-seasonal-decor]').count(), 1);
  await boundary.clock.runFor(10100);
  assert.equal(await boundary.locator('html').getAttribute('data-seasonal-theme'), null);
  assert.equal(await boundary.locator('[data-seasonal-decor]').count(), 0);
  assert.deepEqual(errors, []);assert.deepEqual(broken, []);
  console.log(`Shared browser checks passed: ${pages.length} pages at 3 widths, no overlaps/seams/broken assets, inactive dates, live expiry and duplicate bootstrap.`);
} finally {
  await browser?.close();
  if (service.exitCode === null) {
    const exited = once(service, 'exit');service.kill('SIGTERM');
    const force=setTimeout(()=>service.kill('SIGKILL'),5000);
    await exited;clearTimeout(force);
  }
  await rm(runtime, { recursive: true, force: true });
}
