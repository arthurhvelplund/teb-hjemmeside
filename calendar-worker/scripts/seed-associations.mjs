// Import public directory drafts into the local prototype. Never sends mail.
import { readFile } from 'node:fs/promises';

const origin = new URL(process.env.CALENDAR_ORIGIN || 'http://localhost:8787').origin;
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname)) throw Error('Import kræver en lokal loopback-adresse.');
const catalog = JSON.parse(await readFile(new URL('../../site/data/foreninger-udkast.json', import.meta.url), 'utf8'));
let cookie = '';
async function call(path, body) {
  const response = await fetch(origin + '/api/kalender' + path, {
    headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { method: 'POST', body: JSON.stringify(body) } : {})
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'Importen mislykkedes.');
  if (response.headers.get('Set-Cookie')) cookie = response.headers.get('Set-Cookie').split(';')[0];
  return result;
}
const config = await call('/config');
if (config.mode !== 'local') throw Error('Import kræver lokal afprøvning.');
const challenge = await call('/auth/request', { email: config.editorEmail });
const { messages } = await call('/local-mail');
const message = messages.find(m => m.recipient === config.editorEmail && m.subject === 'Din engangskode til TEB');
await call('/auth/verify', { challengeId: challenge.challengeId, code: message?.body.match(/\b\d{6}\b/)?.[0] });
const normalize = name => name.normalize('NFKC').trim().toLocaleLowerCase('da');
const existing = new Set((await call('/associations')).associations.map(a => normalize(a.name)));
let added = 0;
for (const row of catalog.associations) {
  if (existing.has(normalize(row.name))) continue;
  const association = Object.fromEntries(['name', 'category', 'description', 'website', 'place', 'imageUrl'].map(key => [key, row[key]]));
  await call('/admin/associations', { requestKey: row.requestKey, association });
  existing.add(normalize(row.name));
  added++;
}
console.log(`Tilføjede ${added} foreninger og fællesskaber. ${catalog.associations.length - added} fandtes allerede og er bevaret. Ingen eksterne mails sendes.`);
