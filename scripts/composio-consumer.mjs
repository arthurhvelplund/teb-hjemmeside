import {readFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {CollectorError} from './facebook-analytics.mjs';

export const FACEBOOK_READ_TOOLS = Object.freeze([
  'FACEBOOK_LIST_MANAGED_PAGES', 'FACEBOOK_GET_PAGE_DETAILS',
  'FACEBOOK_LIST_PUBLISHED_PAGE_POSTS', 'FACEBOOK_GET_PAGE_INSIGHTS', 'FACEBOOK_GET_POST_INSIGHTS'
]);
const base = 'https://backend.composio.dev';

export class ComposioToolError extends CollectorError {
  constructor(slug, payload) {
    const text = typeof payload.error === 'string' ? payload.error : JSON.stringify(payload.error || {});
    const code = payload.error?.code ?? Number(text.match(/\(#(\d+)\)|"code"\s*:\s*(\d+)/)?.slice(1).find(Boolean));
    super(`Composio ${slug} failed${Number.isFinite(code) ? ` (provider code ${code})` : ''}. Check connection permissions and the Composio execution log.`);
    this.code = Number.isFinite(code) ? code : null;
    this.unsupportedMetric = code === 100 && /metric|insight/i.test(text);
  }
}

export function redactPayload(value, credential = '') {
  if (Array.isArray(value)) return value.map(item => redactPayload(item, credential));
  if (value && typeof value === 'object') {
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      if (/token|secret|authorization|headers/i.test(key)) continue;
      if (key === 'paging' && item && typeof item === 'object') {
        result.paging = {hasMore: Boolean(item.next || item.hasMore), cursors: item.cursors ? {after: item.cursors.after, before: item.cursors.before} : undefined};
      } else result[key] = redactPayload(item, credential);
    }
    return result;
  }
  if (typeof value === 'string') {
    let clean = credential ? value.split(credential).join('[redacted]') : value;
    clean = clean.replace(/([?&](?:access_token|appsecret_proof|api_key)=)[^&\s]+/gi, '$1[redacted]');
    return clean;
  }
  return value;
}

export function createComposioClient({userApiKey, orgId, projectId, fetchImpl = fetch}) {
  if (!/^uak_\S+$/.test(userApiKey || '')) throw new CollectorError('Composio user login is missing. Run composio login first.');
  if (Boolean(orgId) !== Boolean(projectId) || (orgId && (!/^(?:org|ok)_[\w-]+$/.test(orgId) || !/^(?:proj|pr)_[\w-]+$/.test(projectId)))) {
    throw new CollectorError('Composio requires both organization and consumer-project nano IDs.');
  }
  async function request(path, {method = 'GET', body, organization = orgId, project = projectId} = {}) {
    if (!path.startsWith('/api/v3.1/') || path.includes('://') || path.includes('..')) throw new CollectorError('Refused an unexpected Composio endpoint.');
    const headers = {'x-user-api-key': userApiKey, 'Content-Type': 'application/json'};
    if (organization) headers['x-org-id'] = organization;
    if (project) headers['x-project-id'] = project;
    let response, result;
    try {
      response = await fetchImpl(new URL(path, base), {method, headers, body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'error', signal: AbortSignal.timeout(120000)});
      result = await response.json();
    } catch { throw new CollectorError('Composio request failed or timed out. Credentials and response bodies are not printed.'); }
    if (!response.ok) throw new CollectorError(`Composio HTTP ${Number(response.status)}. Check local login, scope and service availability.`);
    return result;
  }
  async function createSession({userId, connectedAccountId}) {
    if (!userId || !connectedAccountId) throw new CollectorError('Explicit Composio user and Facebook connected-account IDs are required.');
    const result = await request('/api/v3.1/tool_router/session', {method: 'POST', body: {
      user_id: userId, toolkits: {enable: ['facebook']},
      connected_accounts: {facebook: [connectedAccountId]},
      tools: {facebook: {enable: [...FACEBOOK_READ_TOOLS]}},
      instant: false, manage_connections: {enable: false}, workbench: {enable: false},
      proxy_execute: {enable: false}, search: {enable: false}, execute: {enable_multi_execute: false},
      experimental: {no_elicitation_support_fallback: 'deny'}
    }});
    if (!/^trs_[\w-]+$/.test(result.session_id || '')) throw new CollectorError('Composio did not return a valid session ID.');
    return result.session_id;
  }
  async function execute(sessionId, slug, args, connectedAccountId) {
    if (!FACEBOOK_READ_TOOLS.includes(slug)) throw new CollectorError('Refused a tool outside the Facebook analytics allowlist.');
    if (!/^trs_[\w-]+$/.test(sessionId || '')) throw new CollectorError('Invalid Composio session ID.');
    const result = await request(`/api/v3.1/tool_router/session/${sessionId}/execute`, {method: 'POST',
      body: {tool_slug: slug, arguments: args, account: connectedAccountId, enable_auto_workbench_offload: false}});
    if (result.result_type !== 'completed' || result.error || result.successful === false) throw new ComposioToolError(slug, result);
    let data = result.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { throw new CollectorError('Composio returned an unexpected tool result.'); }
    }
    if (data?.successful === false || data?.error) throw new ComposioToolError(slug, data);
    if (data?.successful === true && 'data' in data) data = data.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { throw new CollectorError('Composio returned non-JSON Facebook data.'); }
    }
    return redactPayload(data, userApiKey);
  }
  async function closeSession(sessionId) {
    if (!/^trs_[\w-]+$/.test(sessionId || '')) throw new CollectorError('Invalid Composio session ID.');
    return request(`/api/v3.1/tool_router/session/${sessionId}`, {method: 'DELETE'});
  }
  return {request, createSession, execute, closeSession};
}

export async function readComposioLogin({env = process.env, file = join(homedir(), '.composio/user_data.json')} = {}) {
  if (env.COMPOSIO_USER_API_KEY) return {userApiKey: env.COMPOSIO_USER_API_KEY};
  let saved;
  try { saved = JSON.parse(await readFile(file, 'utf8')); }
  catch { throw new CollectorError('No local Composio login found. Run the setup instructions before collecting.'); }
  const userApiKey = saved.user_api_key || saved.userApiKey || saved.api_key || saved.apiKey;
  if (!/^uak_\S+$/.test(userApiKey || '')) throw new CollectorError('The local Composio login has no user API key. Run composio login again.');
  return {userApiKey, orgId: saved.org_id};
}
