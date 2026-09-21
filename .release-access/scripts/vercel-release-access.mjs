import { pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Read-only operational check, not a deployment tool. Never decrypts values.
export const RELEASE_TARGET = Object.freeze({
  teamId: 'team_BV1xuY6BnEzGanfok8GAyjZv',
  projectId: 'prj_68NErbCqCFsDVaMak81gcwsGI9pF',
  repoId: 1282374475,
});
export const RELEASE_KEY_NAMES = Object.freeze([
  'NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY',
  'CLERK_AUTHORIZED_PARTIES', 'CLERK_EXPECTED_INSTANCE_ID',
  'CLERK_WEBHOOK_SIGNING_SECRET', 'CLERK_WEBHOOK_EVIDENCE_SECRET',
  'META_APP_SECRET', 'META_VERIFY_TOKEN', 'NEXT_PUBLIC_META_APP_ID',
  'NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID', 'META_GRAPH_API_VERSION',
  'WHATSAPP_CREDENTIALS_ENCRYPTION_KEY', 'WEBVIEW_TOKEN_SECRET', 'CRON_SECRET',
  'PRIVATE_MEDIA_PROVIDER', 'OBRASAAS_PRODUCTION_DATABASE_IDENTITY_SHA256',
  'OBRASAAS_PRODUCTION_MIGRATION_RELEASE_SHA',
]);
const MAX_BYTES = 2 * 1024 * 1024;
class CheckFailure extends Error {
  constructor(code, httpStatus = null) { super(code); this.code = code; this.httpStatus = httpStatus; }
}
async function boundedJson(response) {
  if (!response.body?.getReader) throw new CheckFailure('RESPONSE_UNCONFIRMED');
  const reader = response.body.getReader(); const chunks = []; let bytes = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAX_BYTES) throw new CheckFailure('RESPONSE_TOO_LARGE');
      chunks.push(part.value);
    }
    const all = new Uint8Array(bytes); let offset = 0;
    for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(all));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data;
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error instanceof CheckFailure ? error : new CheckFailure('RESPONSE_UNCONFIRMED');
  } finally { reader.releaseLock(); }
}
export async function inspectVercelReleaseAccess({ token, fetcher = globalThis.fetch } = {}) {
  const report = { version: 1, checkedAt: new Date().toISOString(), target: RELEASE_TARGET,
    status: 'BLOCKED', reason: null, requests: 0, accessVerified: false,
    productionKeyNames: null, databaseKeyPresent: null,
    valuesVerified: false, writePermissionVerified: false, runtimeVerified: false,
    migrationAuthorized: false, deploymentCreated: false, productionPromoted: false };
  if (typeof token !== 'string' || !token.trim()) return { ...report, reason: 'CI_TOKEN_NOT_AVAILABLE' };
  if (token !== token.trim() || /[\u0000-\u0020\u007f]/.test(token)) return { ...report, reason: 'TOKEN_FORMAT_INVALID' };
  async function get(path, extra = {}) {
    const url = new URL(path, 'https://api.vercel.com');
    url.search = new URLSearchParams({ teamId: RELEASE_TARGET.teamId, ...extra }).toString();
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 12000);
    report.requests++;
    try {
      const response = await fetcher(url, { method: 'GET', redirect: 'error', signal: controller.signal,
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } });
      if (response.status === 401 || response.status === 403) throw new CheckFailure('VERCEL_SCOPE_NOT_AUTHORIZED', response.status);
      if (!response.ok) throw new CheckFailure('VERCEL_READ_UNCONFIRMED', response.status);
      return await boundedJson(response);
    } finally { clearTimeout(timer); }
  }
  try {
    const project = await get('/v9/projects/' + RELEASE_TARGET.projectId);
    if (project.id !== RELEASE_TARGET.projectId || project.accountId !== RELEASE_TARGET.teamId
      || project.link?.type !== 'github' || String(project.link.repoId) !== String(RELEASE_TARGET.repoId)) {
      throw new CheckFailure('PROJECT_BINDING_MISMATCH');
    }
    report.accessVerified = true;
    const metadata = await get('/v10/projects/' + RELEASE_TARGET.projectId + '/env', { decrypt: 'false' });
    if (!Array.isArray(metadata.envs) || metadata.envs.length > 10000 || metadata.pagination?.next) throw new CheckFailure('ENV_METADATA_UNCONFIRMED');
    const keys = new Set();
    for (const row of metadata.envs) {
      if (!row || typeof row.key !== 'string' || !Array.isArray(row.target)) throw new CheckFailure('ENV_METADATA_UNCONFIRMED');
      if (row.target.includes('production')) keys.add(row.key);
    }
    // Only fixed, known key names survive. No values, returned URLs or secrets.
    report.productionKeyNames = RELEASE_KEY_NAMES.map(key => ({ key, present: keys.has(key) }));
    report.databaseKeyPresent = ['DIRECT_URL', 'DATABASE_URL_UNPOOLED', 'DATABASE_URL'].some(key => keys.has(key));
    const missing = report.productionKeyNames.some(item => !item.present) || !report.databaseKeyPresent;
    report.status = missing ? 'BLOCKED' : 'ACCESS_AND_NAMES_CHECKED';
    report.reason = missing ? 'PRODUCTION_NAMES_NOT_RETURNED' : null;
  } catch (error) {
    report.reason = error instanceof CheckFailure ? error.code : 'NETWORK_OR_RESPONSE_UNCONFIRMED';
    if (error instanceof CheckFailure && error.httpStatus !== null) report.httpStatus = error.httpStatus;
  }
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 2) { console.error('Usage: node scripts/vercel-release-access.mjs'); process.exitCode = 2; }
  else {
    const result = await inspectVercelReleaseAccess({ token: process.env.VERCEL_TOKEN });
    const output = resolve('evidence/vercel-release-access.json');
    mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    if (result.status === 'BLOCKED') process.exitCode = 1;
  }
}
