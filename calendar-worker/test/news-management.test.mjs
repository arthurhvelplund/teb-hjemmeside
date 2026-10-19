import test from 'node:test';
import assert from 'node:assert/strict';
import { database } from '../scripts/sqlite.mjs';
import { localR2 } from '../scripts/r2.mjs';
import { handleApi } from '../src/api.mjs';
import { token, copenhagenDate } from '../src/shared.mjs';

function fixture(t) {
  const DB = database(); t.after(() => DB.close());
  const origin = 'http://localhost:8799';
  const env = { DB, PDFS: localR2(), PUBLIC_ORIGIN: origin, LOCAL_PREVIEW: 'true',
    EDITOR_EMAIL: 'admin@example.test', TEB_ADMIN_EMAILS: 'admin@example.test',
    EMAIL_FROM: 'local@example.test', MAIL_ENCRYPTION_KEY: token() };
  function client() {
    let cookie = ''; const ip = crypto.randomUUID();
    const call = (path, data, headers = {}) => handleApi(new Request(origin + '/api/kalender' + path, {
      method: data ? 'POST' : 'GET',
      headers: { 'CF-Connecting-IP': ip, ...(cookie ? { Cookie: cookie } : {}),
        ...(data ? { Origin: origin, 'Content-Type': 'application/json' } : {}), ...headers },
      ...(data ? { body: JSON.stringify(data) } : {}),
    }), env);
    const login = async email => {
      const ch = await ok(await call('/auth/request', { email }));
      const messages = (await ok(await call('/local-mail'))).messages;
      const mail = messages.find(m => m.recipient === email && m.subject === 'Din engangskode til TEB');
      const response = await call('/auth/verify', { challengeId: ch.challengeId, code: mail.body.match(/\b\d{6}\b/)[0] });
      await ok(response); cookie = response.headers.get('Set-Cookie').split(';')[0];
    };
    return { call, login };
  }
  return { DB, env, client, admin: client(), guest: client() };
}
async function ok(response, status = 200) {
  assert.equal(response.status, status, await response.clone().text());
  return response.json();
}
const news = (extra = {}) => ({ kind: 'news', title: 'En nyhed', author: 'Oplyst afsender',
  description: 'En kort beskrivelse.', body: 'Hele historien.', ...extra });
const payload = (post = news(), extra = {}) => ({ requestKey: crypto.randomUUID(),
  authorToken: token(), startedAt: Date.now() - 5000, email: 'guest@example.test', post, ...extra });
async function association(f, name = 'Foreningen') {
  return (await ok(await f.admin.call('/admin/associations', { requestKey: crypto.randomUUID(), association: { name } }))).association;
}
async function member(f, a, email = 'editor@example.test') {
  await ok(await f.admin.call('/admin/associations/' + a.id + '/members', { email, name: 'Redaktør', role: 'editor' }));
  const c = f.client(); await c.login(email); return c;
}

test('news is linked to canonical association and is editable only by active members', async t => {
  const f = fixture(t); await f.admin.login('admin@example.test');
  const a = await association(f), c = await member(f, a);
  const created = await ok(await c.call('/posts', payload(news(), { associationId: a.id })), 201);
  const list = (await ok(await c.call('/me/posts'))).posts;
  assert.equal(list.length, 1); assert.equal(list[0].associationId, a.id);
  assert.equal(list[0].data.author, a.name);
  const saved = await ok(await c.call('/member/posts/' + created.id,
    { action: 'update', revision: 1, post: news({ title: 'Rettet', author: 'Falsk afsender' }) }));
  assert.equal(saved.post.revision, 2); assert.equal(saved.post.data.author, a.name);
  const publicList = (await ok(await f.guest.call('/posts?association=' + a.id + '&kind=news'))).posts;
  assert.equal(publicList[0].title, 'Rettet'); assert.equal(publicList[0].associationId, a.id);
  assert.ok(!JSON.stringify(publicList).includes('editor@example.test'));
  assert.equal((await f.guest.call('/member/posts/' + created.id)).status, 401);
  const b = await association(f, 'Anden forening'), other = await member(f, b, 'other@example.test');
  assert.equal((await other.call('/member/posts/' + created.id)).status, 403);
  assert.equal((await other.call('/member/posts/' + created.id,
    { action: 'withdraw', revision: 2 })).status, 403);
  await f.DB.prepare("UPDATE memberships SET status='revoked' WHERE association_id=?").bind(a.id).run();
  assert.equal((await c.call('/member/posts/' + created.id,
    { action: 'update', revision: 2, post: news() })).status, 403);
});

test('news updates reject stale revisions, including simultaneous saves', async t => {
  const f = fixture(t); await f.admin.login('admin@example.test');
  const a = await association(f), c = await member(f, a);
  const { id } = await ok(await c.call('/posts', payload(news(), { associationId: a.id })), 201);
  const responses = await Promise.all(['A', 'B'].map(title => c.call('/member/posts/' + id,
    { action: 'update', revision: 1, post: news({ title }) })));
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  assert.equal((await ok(await c.call('/member/posts/' + id))).post.revision, 2);
});

test('withdrawn news disappears publicly and cannot be revived by an old form', async t => {
  const f = fixture(t); await f.admin.login('admin@example.test');
  const a = await association(f), c = await member(f, a);
  const { id } = await ok(await c.call('/posts', payload(news(), { associationId: a.id })), 201);
  await ok(await c.call('/member/posts/' + id, { action: 'withdraw', revision: 1 }));
  assert.deepEqual((await ok(await f.guest.call('/posts'))).posts, []);
  assert.equal((await f.guest.call('/posts/' + id)).status, 404);
  assert.equal((await c.call('/member/posts/' + id,
    { action: 'update', revision: 2, post: news() })).status, 409);
  assert.equal((await ok(await c.call('/me/posts'))).posts[0].status, 'withdrawn');
});

test('news image paths must belong to the publishing association', async t => {
  const f = fixture(t); await f.admin.login('admin@example.test');
  const a = await association(f), b = await association(f, 'Anden'), c = await member(f, a);
  const own = '/api/kalender/association-images/' + a.id + '/' + crypto.randomUUID() + '.webp';
  const foreign = '/api/kalender/association-images/' + b.id + '/' + crypto.randomUUID() + '.webp';
  const { id } = await ok(await c.call('/posts', payload(news({ image: own }), { associationId: a.id })), 201);
  assert.equal((await c.call('/member/posts/' + id,
    { action: 'update', revision: 1, post: news({ image: foreign }) })).status, 403);
  assert.equal((await f.guest.call('/posts', payload(news({ image: own })))).status, 403);
  assert.equal((await c.call('/member/posts/' + id,
    { action: 'update', revision: 1, post: news({ image: 'javascript:alert(1)' }) })).status, 400);
});

test('news endpoint cannot edit linked calendar posts or expose another associations content', async t => {
  const f = fixture(t); await f.admin.login('admin@example.test');
  const a = await association(f), c = await member(f, a);
  const linked = payload(news({ kind: 'both', date: copenhagenDate(), time: '18:00', location: 'Hallen' }),
    { associationId: a.id });
  const { id } = await ok(await c.call('/posts', linked), 201);
  assert.equal((await c.call('/member/posts/' + id,
    { action: 'update', revision: 1, post: news() })).status, 400);
  assert.deepEqual((await ok(await c.call('/me/posts'))).posts, []);
  const outsider = f.client(); await outsider.login('outsider@example.test');
  assert.deepEqual((await ok(await outsider.call('/me/posts'))).posts, []);
  assert.equal((await ok(await f.guest.call('/events/' + id))).event.title, linked.post.title);
});

test('moderation feedback stays private and the sandbox still uses its unchanged schema', async t => {
  const f = fixture(t), p = payload();
  const { id } = await ok(await f.guest.call('/posts', p), 201);
  await f.admin.login('admin@example.test');
  await ok(await f.admin.call('/admin/posts/' + id, { action: 'reject', revision: 1, note: 'Skriv et sted.' }));
  const receipt = await ok(await f.guest.call('/posts/private/' + id, undefined, { Authorization: 'Bearer ' + p.authorToken }));
  assert.equal(receipt.post.note, 'Skriv et sted.');
  assert.deepEqual((await ok(await f.guest.call('/posts'))).posts, []);
  const lab = await ok(await f.guest.call('/experiment/posts', payload()), 201);
  await ok(await f.admin.call('/experiment/admin/posts/' + lab.id, { action: 'reject', revision: 1 }));
});


test('association and kind filters run before the public feed limit', async t => {
 const f=fixture(t);await f.admin.login('admin@example.test');
 const a=await association(f),c=await member(f,a);
 const {id}=await ok(await c.call('/posts',payload(news(),{associationId:a.id})),201);
 await f.DB.prepare("UPDATE posts SET created_at='2020-01-01T00:00:00.000Z' WHERE id=?").bind(id).run();
 const insert=f.DB.prepare("INSERT INTO posts(id,request_key,request_hash,owner_hash,contact_email,data_json,status,created_at,updated_at) VALUES(?,?,'hash','owner','other@example.test',?,'approved','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z')");
 for(let i=0;i<201;i++)await insert.bind(crypto.randomUUID(),crypto.randomUUID(),JSON.stringify(news({kind:'both'}))).run();
 const list=(await ok(await f.guest.call('/posts?association='+a.id+'&kind=news'))).posts;
 assert.equal(list.length,1);assert.equal(list[0].id,id);
 assert.equal((await ok(await f.guest.call('/posts?kind=news'))).posts[0].id,id);
});
