import { inspectWhatsAppPublicAppUrl, resolveWhatsAppPublicAppUrl } from './public-app-url.js';
const GRAPH_ORIGIN = 'https://graph.facebook.com';
const MAX_BODY_BYTES = 65536;
const SECRET_KEYS = ['META_APP_SECRET','META_VERIFY_TOKEN','WHATSAPP_CREDENTIALS_ENCRYPTION_KEY'];
const item = (key, status) => ({ key, status });
export function inspectWhatsAppPlatformPrerequisites(env = process.env) {
  const appValid = /^\d{5,32}$/.test(env.NEXT_PUBLIC_META_APP_ID || '');
  const versionValid = /^v[1-9]\d*\.0$/.test(env.META_GRAPH_API_VERSION || 'v23.0');
  const configuredUrl = inspectWhatsAppPublicAppUrl(env);
  let encryptionValid = false;
  try { encryptionValid = Buffer.from(env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY || '', 'base64').length === 32; } catch { /* invalid configuration */ }
  return [item('appId', appValid ? 'PRESENT' : 'MISSING_OR_INVALID'),
    item('appSecret', env.META_APP_SECRET ? 'PRESENT_UNVERIFIED' : 'MISSING'),
    item('verifyToken', env.META_VERIFY_TOKEN ? 'PRESENT_UNVERIFIED' : 'MISSING'),
    item('encryption', encryptionValid ? 'VALID_FORMAT' : 'MISSING_OR_INVALID'),
    item('publicOrigin', configuredUrl.configured ? 'VALID_FORMAT' : 'MISSING_OR_INVALID'),
    item('graphVersion', versionValid ? 'VALID_FORMAT' : 'MISSING_OR_INVALID')];
}
class ProbeError extends Error {
  constructor(code) { super('Meta platform preflight failed'); this.code = code; }
}
async function boundedJson(response) {
  if (response.status >= 300 && response.status < 400) throw new ProbeError('REDIRECT_BLOCKED');
  if (Number(response.headers.get('content-length') || 0) > MAX_BODY_BYTES) throw new ProbeError('RESPONSE_TOO_LARGE');
  if (!response.body?.getReader) throw new ProbeError('INVALID_RESPONSE');
  const reader = response.body.getReader(); let total = 0; const chunks = [];
  try {
    while (true) { const part = await reader.read(); if (part.done) break; total += part.value.byteLength;
      if (total > MAX_BODY_BYTES) { await reader.cancel(); throw new ProbeError('RESPONSE_TOO_LARGE'); } chunks.push(Buffer.from(part.value)); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) { if (error instanceof ProbeError) throw error; throw new ProbeError('INVALID_RESPONSE'); }
  finally { reader.releaseLock(); }
}
export async function verifyWhatsAppPlatform({ env = process.env, fetchImpl = globalThis.fetch, now = () => new Date(), timeoutMs = 12000 } = {}) {
  const config = Object.fromEntries(['NEXT_PUBLIC_META_APP_ID','META_GRAPH_API_VERSION','NEXT_PUBLIC_APP_URL','VERCEL_ENV','VERCEL','NODE_ENV','VERCEL_PROJECT_PRODUCTION_URL','WHATSAPP_PREVIEW_ALLOWED_PUBLIC_ORIGINS','WHATSAPP_PRODUCTION_PUBLIC_ORIGINS',...SECRET_KEYS].map(key => [key, env[key]]));
  const configuration = inspectWhatsAppPlatformPrerequisites(config);
  const result = { version: 1, checkedAt: now().toISOString(), configuration,
    authentication: { status: 'NOT_CHECKED', code: 'PREREQUISITE_MISSING' },
    webhook: { status: 'NOT_CHECKED', code: 'APP_NOT_VERIFIED' }, requests: 0,
    writesToMeta: false, messagesSent: false, provesOperationalTraffic: false };
  if (!/^\d{5,32}$/.test(config.NEXT_PUBLIC_META_APP_ID || '') || !config.META_APP_SECRET || !/^v[1-9]\d*\.0$/.test(config.META_GRAPH_API_VERSION || 'v23.0')) return result;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(15000, Math.max(100, timeoutMs)));
  async function get(path) {
    result.requests++;
    const response = await fetchImpl(GRAPH_ORIGIN + '/' + (config.META_GRAPH_API_VERSION || 'v23.0') + '/' + path,
      { method: 'GET', cache: 'no-store', redirect: 'error', signal: controller.signal,
        headers: { Authorization: 'Bearer ' + config.NEXT_PUBLIC_META_APP_ID + '|' + config.META_APP_SECRET } });
    const body = await boundedJson(response);
    if (!response.ok) {
      if (body?.error?.code === 190 || response.status === 401) throw new ProbeError('APP_CREDENTIAL_REJECTED');
      if (response.status === 429 || [4,17,32,613].includes(body?.error?.code)) throw new ProbeError('META_RATE_LIMIT');
      throw new ProbeError(response.status === 403 ? 'META_PERMISSION_DENIED' : 'META_UNAVAILABLE');
    }
    return body;
  }
  try {
    const identity = await get(config.NEXT_PUBLIC_META_APP_ID + '?fields=id');
    if (String(identity?.id || '') !== config.NEXT_PUBLIC_META_APP_ID) throw new ProbeError('APP_ID_MISMATCH');
    result.authentication = { status: 'VERIFIED', code: 'APP_AUTHENTICATED' };
    if (!inspectWhatsAppPublicAppUrl(config).configured) {
      result.webhook = { status: 'NOT_CHECKED', code: 'PUBLIC_ORIGIN_INVALID' }; return result;
    }
    const origin = resolveWhatsAppPublicAppUrl(config);
    if (!origin.startsWith('https://')) { result.webhook = { status: 'NOT_CHECKED', code: 'PUBLIC_ORIGIN_INVALID' }; return result; }
    const payload = await get(config.NEXT_PUBLIC_META_APP_ID + '/subscriptions');
    if (!Array.isArray(payload?.data) || payload.data.length > 100) throw new ProbeError('INVALID_RESPONSE');
    const subscriptions = payload.data.filter(row => row?.object === 'whatsapp_business_account');
    const expected = origin + '/api/webhooks/whatsapp';
    const matching = subscriptions.find(row => row.callback_url === expected);
    if (!matching && payload.paging?.next) result.webhook = { status: 'NOT_CHECKED', code: 'SUBSCRIPTIONS_TRUNCATED' };
    else if (!subscriptions.length) result.webhook = { status: 'BLOCKED', code: 'WEBHOOK_NOT_REGISTERED' };
    else if (!matching) result.webhook = { status: 'BLOCKED', code: 'CALLBACK_MISMATCH' };
    else if (matching.active !== true) result.webhook = { status: 'BLOCKED', code: 'WEBHOOK_INACTIVE' };
    else if (!Array.isArray(matching.fields) || !matching.fields.some(field => (typeof field === 'string' ? field : field?.name) === 'messages')) result.webhook = { status: 'BLOCKED', code: 'MESSAGES_FIELD_MISSING' };
    else result.webhook = { status: 'VERIFIED', code: 'CALLBACK_CONFIGURATION_MATCHES' };
  } catch (error) {
    const code = error instanceof ProbeError ? error.code : controller.signal.aborted ? 'META_TIMEOUT' : 'META_UNAVAILABLE';
    if (result.authentication.status !== 'VERIFIED') result.authentication = { status: 'BLOCKED', code };
    else result.webhook = { status: 'BLOCKED', code };
  } finally { clearTimeout(timer); }
  return result;
}
