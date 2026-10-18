import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, mkdir, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { syncSite } from './sync-site.mjs';

const site = new URL('../site/', import.meta.url);
await syncSite({ check: true });
let pages = 0;
for (const filename of await readdir(site)) {
  if (!filename.endsWith('.html')) continue;
  const html = await readFile(new URL(filename, site), 'utf8');
  if (!html.includes('class="site-header"')) continue;
  pages++;
  assert.equal((html.match(/<header\b/g) || []).length, 1, filename + ' header');
  assert.equal((html.match(/<footer\b/g) || []).length, 1, filename + ' footer');
  assert.equal((html.match(/src="js\/seasonal-theme\.js/g) || []).length, 1, filename + ' bootstrap');
  assert.equal((html.match(/href="css\/layout\.css/g) || []).length, 1, filename + ' shared layout');
  assert.ok(html.indexOf('src="js/seasonal-theme.js') < html.indexOf('</head>'), filename + ' early theme');
  assert.match(html, /<main[^>]*class="[^"]*\bsite-main\b/);
  assert.ok(!/fp-hero|fp-heading/.test(html), filename + ' has a page-specific theme layout');
  for (const reference of html.matchAll(/<(?:link|script|img|use)\b[^>]*\b(?:href|src)="([^"<>]+)"/g)) {
    const path = reference[1].split(/[?#]/)[0];
    if (!path || /^(?:https?:|data:|\/\/)/.test(path)) continue;
    await access(new URL(path, site)).catch(() => { throw Error(filename + ': missing asset ' + path); });
  }
}
assert.ok(pages >= 15);
const css = await readFile(new URL('css/seasonal-themes.css', site), 'utf8');
assert.ok(!/fp-main|fp-hero|fp-heading|kalender|forening/.test(css), 'Theme depends on a particular page');
for (const match of css.matchAll(/url\(['"]?([^'"\)]+)['"]?\)/g)) await access(new URL(match[1], new URL('css/', site)));

// A fresh page gains the complete shared frame without copying another page.
const fixture = await mkdtemp(join(tmpdir(), 'teb-shared-layout-'));
try {
  const directory = pathToFileURL(fixture + '/');
  for (const path of ['css/style.css', 'css/layout.css', 'css/seasonal-themes.css', 'js/main.js']) {
    await mkdir(join(fixture, dirname(path)), { recursive: true });
    await writeFile(join(fixture, path), await readFile(new URL(path, site)));
  }
  const fresh = '<!doctype html><html lang="da"><head><title>Ny side</title><link rel="stylesheet" href="css/style.css"></head><body><header class="site-header"></header><main><section class="hero"><div class="wrap"><h1>Eget indhold</h1></div></section></main><footer class="site-footer"></footer><script src="js/main.js"></script></body></html>';
  await writeFile(join(fixture, 'ny-side.html'), fresh);
  await assert.rejects(() => syncSite({ directory, check: true }));
  await syncSite({ directory });
  const generated = await readFile(join(fixture, 'ny-side.html'), 'utf8');
  assert.ok(generated.includes('Eget indhold') && generated.includes('primary-nav') && generated.includes('footer-mark'));
  assert.match(generated, /class="hero page-hero"/);
  assert.match(generated, /css\/layout\.css\?v=[a-f0-9]{12}/);
  assert.deepEqual(await syncSite({ directory }), []);
  await writeFile(join(fixture, 'uden-sideramme.html'), '<!doctype html><html><body><main>Ny side uden ramme</main></body></html>');
  await assert.rejects(() => syncSite({ directory, check: true }), /mangler fælles header/);
  await rm(join(fixture, 'uden-sideramme.html'));
  await writeFile(join(fixture, 'css/layout.css'), '/* An actual shared design change */');
  await assert.rejects(() => syncSite({ directory, check: true }));
  await syncSite({ directory });
  const refreshed = await readFile(join(fixture, 'ny-side.html'), 'utf8');
  assert.notEqual(refreshed.match(/css\/layout\.css\?v=([a-f0-9]+)/)[1], generated.match(/css\/layout\.css\?v=([a-f0-9]+)/)[1]);
} finally { await rm(fixture, { recursive: true, force: true }); }
console.log(`Shared layout passed: ${pages} pages, local assets, fresh-page generation, repeatable builds and stale-version detection.`);
