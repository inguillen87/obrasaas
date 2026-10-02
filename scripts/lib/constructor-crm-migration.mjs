import { readFileSync } from 'node:fs';
import { readConstructorCrmCatalog, checkConstructorCrmCatalog, CONSTRUCTOR_CRM_SCHEMA_VERSION } from '../../src/lib/constructor-crm-schema.mjs';

export const CONSTRUCTOR_CRM_TARGET = Object.freeze({ projectId: 'prj_68NErbCqCFsDVaMak81gcwsGI9pF', teamId: 'team_BV1xuY6BnEzGanfok8GAyjZv', origin: 'https://obrasaas.com' });
const sql = readFileSync(new URL('./constructor-crm-adoption.sql', import.meta.url), 'utf8');
const failure = code => { const error = new Error(code); error.code = code; throw error; };
export function constructorCrmDisposableConnection(environment) {
  let url;
  try { url = new URL(environment.CUTOVER_TEST_DATABASE_URL); } catch { failure('CONSTRUCTOR_CRM_DISPOSABLE_TARGET_REJECTED'); }
  if (environment.CUTOVER_TEST_DISPOSABLE !== '1' || environment.VERCEL || environment.VERCEL_ENV || !['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname) || !['5432', '6549', ''].includes(url.port) || url.pathname !== '/obrasaas_cutover_ci' || url.search || url.hash) failure('CONSTRUCTOR_CRM_DISPOSABLE_TARGET_REJECTED');
  return url;
}
export function constructorCrmProductionContext(environment, project, expectedProject, expectedTeam) {
  if (expectedProject !== CONSTRUCTOR_CRM_TARGET.projectId || expectedTeam !== CONSTRUCTOR_CRM_TARGET.teamId || project?.projectId !== expectedProject || project?.orgId !== expectedTeam || environment.VERCEL_ENV !== 'production' || environment.VERCEL_PROJECT_ID !== expectedProject || environment.NEXT_PUBLIC_APP_URL !== CONSTRUCTOR_CRM_TARGET.origin || environment.VERCEL_ORG_ID !== undefined && environment.VERCEL_ORG_ID !== expectedTeam) failure('CONSTRUCTOR_CRM_MIGRATION_TARGET_REJECTED');
  return { projectVerified: true, environment: 'production' };
}
export function constructorCrmMigrationArguments(args) {
  const known = new Set(['--dry-run', '--apply', '--expected-project', '--expected-team', '--expected-fingerprint']);
  const result = { mode: 'DRY_RUN' }, seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!known.has(key) || seen.has(key)) failure('CONSTRUCTOR_CRM_MIGRATION_ARGUMENTS_INVALID');
    seen.add(key);
    if (key === '--apply' || key === '--dry-run') result.mode = key === '--apply' ? 'APPLY' : 'DRY_RUN';
    else { if (!args[i + 1] || args[i + 1].startsWith('--')) failure('CONSTRUCTOR_CRM_MIGRATION_ARGUMENTS_INVALID'); result[{ '--expected-project': 'expectedProject', '--expected-team': 'expectedTeam', '--expected-fingerprint': 'expectedFingerprint' }[key]] = args[++i]; }
  }
  if (seen.has('--apply') && seen.has('--dry-run') || !result.expectedProject || !result.expectedTeam || result.expectedFingerprint !== undefined && !/^[a-f0-9]{64}$/.test(result.expectedFingerprint) || result.mode === 'APPLY' && !result.expectedFingerprint) failure('CONSTRUCTOR_CRM_MIGRATION_ARGUMENTS_INVALID');
  return result;
}

// The CLI verifies the production project/team and strict TLS connection before
// calling this transaction helper. Disposable tests call it on a unique local DB.
// Dry-run never executes DDL or takes table locks. Apply requires explicit mode,
// a prior catalog fingerprint and bounded locks; a mismatching legacy schema fails.
export async function executeConstructorCrmAdoption(client, { mode = 'DRY_RUN', expectedFingerprint } = {}) {
  if (!['DRY_RUN', 'APPLY'].includes(mode) || expectedFingerprint !== undefined && !/^[a-f0-9]{64}$/.test(expectedFingerprint) || mode === 'APPLY' && !expectedFingerprint) failure('CONSTRUCTOR_CRM_MIGRATION_COMMAND_INVALID');
  let transaction = false;
  try {
    await client.query(mode === 'DRY_RUN' ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN ISOLATION LEVEL READ COMMITTED'); transaction = true;
    await client.query("SET LOCAL statement_timeout='15000ms'");
    await client.query("SET LOCAL lock_timeout='1500ms'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout='30000ms'");
    if (mode === 'DRY_RUN' && (await client.query("SELECT current_setting('transaction_read_only') AS readonly")).rows[0]?.readonly !== 'on') failure('CONSTRUCTOR_CRM_READ_ONLY_NOT_ENFORCED');
    let catalog = await readConstructorCrmCatalog(client), before = checkConstructorCrmCatalog(catalog, { allowLegacy: true });
    if (!before.compatible) failure('CONSTRUCTOR_CRM_MIGRATION_SCHEMA_REJECTED');
    const canApply = catalog.relation.canAlter === true && catalog.relation.canCreateIndex === true && catalog.organization.canReference === true && catalog.organization.canLock === true;
    const matching = expectedFingerprint === undefined || expectedFingerprint === before.fingerprint;
    if (before.state === 'LEGACY' && !matching) failure('CONSTRUCTOR_CRM_MIGRATION_FINGERPRINT_CHANGED');
    let after = before, applied = false;
    if (mode === 'APPLY' && before.state === 'LEGACY') {
      if (!canApply) failure('CONSTRUCTOR_CRM_MIGRATION_PERMISSION_REQUIRED');
      // Organization ownership is locked before CRM, matching tenant operations.
      await client.query('LOCK TABLE public."Organization" IN SHARE ROW EXCLUSIVE MODE');
      await client.query('LOCK TABLE public."CrmAccount" IN ACCESS EXCLUSIVE MODE');
      catalog = await readConstructorCrmCatalog(client);
      const locked = checkConstructorCrmCatalog(catalog, { allowLegacy: true });
      if (!locked.compatible || locked.state !== 'LEGACY' || locked.fingerprint !== before.fingerprint) failure('CONSTRUCTOR_CRM_MIGRATION_FINGERPRINT_CHANGED');
      await client.query(sql);
      after = checkConstructorCrmCatalog(await readConstructorCrmCatalog(client));
      if (!after.compatible || after.state !== 'ADOPTED') failure('CONSTRUCTOR_CRM_MIGRATION_POSTCHECK_FAILED');
      applied = true;
    }
    const proof = { version: CONSTRUCTOR_CRM_SCHEMA_VERSION, status: applied ? 'APPLIED' : before.state === 'ADOPTED' ? 'ALREADY_ADOPTED' : 'DRY_RUN_READY', mode,
      readOnly: mode === 'DRY_RUN', destructive: false, ddlExecuted: applied, canApply, expectedFingerprintMatched: matching,
      before: { state: before.state, fingerprint: before.fingerprint, columns: before.columns, constraints: before.constraints, indexes: before.indexes },
      after: { state: after.state, fingerprint: after.fingerprint, columns: after.columns, constraints: after.constraints, indexes: after.indexes },
      businessRowsRead: 0, businessDataWritten: false, ownershipBackfilled: false, platformRecordsImported: false, credentialsPrinted: false };
    await client.query(mode === 'DRY_RUN' ? 'ROLLBACK' : 'COMMIT'); transaction = false;
    return proof;
  } catch (error) {
    if (transaction) await client.query('ROLLBACK');
    throw error;
  }
}
