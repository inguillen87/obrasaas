import { createHash } from 'node:crypto';
import { CutoverAuditError } from './legacy-cutover-audit.mjs';
import { auditConnectionConfig } from './read-legacy-cutover.mjs';

export const LINK_REHEARSAL_POLICY = 'reference-link-rehearsal-v1';
export const LINK_SCHEMA = 'obrasaas_link_rehearsal_v1';
// Reviewed infrastructure identity, not a credential. No production target is
// accepted by this CLI. A replacement endpoint requires a reviewed code change.
export const LINK_TARGET = Object.freeze({
  projectId: 'shy-cherry-97665417', branchId: 'br-green-rice-ac9ugond',
  host: 'ep-late-boat-acakm3wb.sa-east-1.aws.neon.tech', database: 'neondb',
});
export const failLink = code => { throw new CutoverAuditError(code); };
export const isDigest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const isRunId = value => typeof value === 'string' && /^run_[a-f0-9]{64}$/.test(value);
export const isOperationKey = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9:_-]{15,127}$/.test(value);
function canonical(value) {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype)
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  failLink('REHEARSAL_VALUE_INVALID');
}
export const linkDigest = value => createHash('sha256').update(JSON.stringify(canonical(value)), 'utf8').digest('hex');
export const linkFlags = Object.freeze({ businessDataWritten: false, importAuthorized: false,
  executionAllowed: false, reviewIdentityVerified: false, effect: 'REFERENCE_LEDGER_ONLY' });
export function linkRehearsalConfig(value, branchId, environment = process.env) {
  if (environment.VERCEL || environment.VERCEL_ENV || environment.VERCEL_TARGET_ENV) failLink('REHEARSAL_RUNTIME_FORBIDDEN');
  if (branchId !== LINK_TARGET.branchId) failLink('REHEARSAL_TARGET_FORBIDDEN');
  const config = auditConnectionConfig(value, LINK_TARGET.host);
  const url = new URL(config.connectionString);
  if (decodeURIComponent(url.pathname.slice(1)) !== LINK_TARGET.database || !url.username || !url.password)
    failLink('REHEARSAL_TARGET_FORBIDDEN');
  return { ...config, application_name: 'obrasaas-isolated-reference-rehearsal' };
}
export function recordCommand(manifest, { sourceSha, operationKey, targetRef = LINK_TARGET.branchId } = {}) {
  if (!/^[a-f0-9]{40}$/.test(sourceSha || '') || !isOperationKey(operationKey)) failLink('REHEARSAL_COMMAND_INVALID');
  if (!manifest || manifest.sourceSha !== sourceSha || manifest.intent !== 'LINK_EXISTING_IDENTITIES_ONLY' ||
      manifest.executionAllowed !== false || manifest.importAuthorized !== false ||
      !Array.isArray(manifest.records) || !manifest.records.length || manifest.records.length > 5000)
    failLink('REHEARSAL_MANIFEST_INVALID');
  return { operation: 'RECORD', operationKey, sourceSha, targetRef,
    requestDigest: linkDigest([LINK_REHEARSAL_POLICY, 'RECORD', targetRef, manifest]) };
}
export function revertCommand(receipt, { operationKey, targetRef = LINK_TARGET.branchId } = {}) {
  if (!isOperationKey(operationKey) || !receipt || receipt.policyVersion !== LINK_REHEARSAL_POLICY ||
      receipt.targetRef !== targetRef || !isRunId(receipt.runId) || !isDigest(receipt.recordDigest) ||
      receipt.importAuthorized !== false || receipt.businessDataWritten !== false)
    failLink('REHEARSAL_RECEIPT_INVALID');
  return { operation: 'REVERT', operationKey, targetRef, runId: receipt.runId,
    recordDigest: receipt.recordDigest,
    requestDigest: linkDigest([LINK_REHEARSAL_POLICY, 'REVERT', targetRef, receipt.runId, receipt.recordDigest]) };
}
export function classifyLinkError(error, commitStarted = false) {
  if (commitStarted) return new CutoverAuditError('REHEARSAL_COMMIT_UNCONFIRMED');
  if (error instanceof CutoverAuditError) return error;
  if (['55P03', '57014', '40P01', '40001'].includes(error?.code)) return new CutoverAuditError('REHEARSAL_BUSY_RETRY_SAME_KEY');
  return new CutoverAuditError('REHEARSAL_DATABASE_UNAVAILABLE');
}
