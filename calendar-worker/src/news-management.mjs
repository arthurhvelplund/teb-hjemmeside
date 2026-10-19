import { ensure, json, now } from './shared.mjs';
import { stmt, all } from './db.mjs';
import { requireAccess } from './auth.mjs';

const privatePost = row => ({
  id: row.id, associationId: row.association_id, revision: row.revision,
  status: row.status, data: JSON.parse(row.data_json),
  note: row.moderation_note, createdAt: row.created_at, updatedAt: row.updated_at,
});

export async function manageNews(request, env, auth, route, data, validatePost) {
  if (route === '/me/posts' && request.method === 'GET') {
    ensure(auth.user, 401, 'Log ind først.');
    const rows = await all(stmt(env,
      "SELECT p.* FROM posts p WHERE json_extract(p.data_json,'$.kind')='news' AND EXISTS(" +
      "SELECT 1 FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires_at>? " +
      "AND (u.is_admin=1 OR EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=u.id " +
      "AND m.association_id=p.association_id AND m.status='active'))) ORDER BY p.updated_at DESC",
      auth.sessionHash, now()));
    return json({ posts: rows.map(privatePost) });
  }
  const match = route.match(/^\/member\/posts\/([a-f0-9-]{36})$/);
  if (!match) return null;
  const row = await stmt(env, 'SELECT * FROM posts WHERE id=?', match[1]).first();
  ensure(row, 404, 'Nyheden findes ikke.');
  const access = await requireAccess(env, auth, row.association_id);
  ensure(JSON.parse(row.data_json).kind === 'news', 400, 'Ret arrangementet i kalenderen.');
  if (request.method === 'GET') return json({ post: privatePost(row) });
  ensure(['update', 'withdraw'].includes(data.action), 400, 'Vælg rettelse eller fjernelse.');
  ensure(Number.isInteger(data.revision) && data.revision === row.revision, 409,
    'Nyheden er ændret. Hent den seneste version, før du gemmer.');
  ensure(row.status !== 'withdrawn', 409, 'Nyheden er allerede fjernet.');
  let post = JSON.parse(row.data_json);
  if (data.action === 'update') {
    const association = row.association_id
      ? await stmt(env, 'SELECT name FROM associations WHERE id=?', row.association_id).first() : null;
    post = validatePost({ ...data.post, kind: 'news', author: association?.name || post.author });
    const stored = post.image?.match(/^\/api\/kalender\/association-images\/([^/]+)\//);
    ensure(!stored || auth.user.is_admin || stored[1] === row.association_id, 403,
      'Vælg et billede fra jeres egen forening.');
  }
  const result = await stmt(env,
    "UPDATE posts SET data_json=?,status=?,moderation_note='',revision=revision+1,updated_at=? " +
    'WHERE id=? AND revision=? AND ' + access.sql,
    JSON.stringify(post), data.action === 'withdraw' ? 'withdrawn' : 'approved',
    now(), row.id, row.revision, ...access.args).run();
  ensure(result.meta.changes, 409, 'Nyheden er ændret, eller din adgang er ophørt.');
  return json({ post: privatePost(await stmt(env, 'SELECT * FROM posts WHERE id=?', row.id).first()) });
}
