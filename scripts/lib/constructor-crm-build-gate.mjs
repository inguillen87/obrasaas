import { Client } from 'pg';
import { workspaceConnectionConfig } from '../../src/lib/workspace-policy.mjs';
import { assertConstructorCrmSchema } from '../../src/lib/constructor-crm-schema.mjs';
import { CONSTRUCTOR_CRM_TARGET } from './constructor-crm-migration.mjs';

export async function inspectConstructorCrmBuildGate({ environment = process.env, makeClient = config => new Client(config) } = {}) {
  const base = { version: 1, required: environment.VERCEL_ENV === 'production', passed: false, readOnly: true, businessRowsRead: 0, businessDataWritten: false, ddlExecuted: false, customerCrmAccepted: false };
  if (!base.required) return { ...base, status: 'SKIPPED_NON_PRODUCTION' };
  if (environment.VERCEL_PROJECT_ID !== CONSTRUCTOR_CRM_TARGET.projectId || environment.NEXT_PUBLIC_APP_URL !== CONSTRUCTOR_CRM_TARGET.origin || environment.VERCEL_ORG_ID !== undefined && environment.VERCEL_ORG_ID !== CONSTRUCTOR_CRM_TARGET.teamId) return { ...base, status: 'CONTEXT_REJECTED' };
  let client, result, connectionFailed = false;
  try {
    client = makeClient({ ...workspaceConnectionConfig(environment), application_name: 'obrasaas-constructor-crm-schema-readonly' });
    client.on?.('error', () => { connectionFailed = true; });
    await client.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL statement_timeout='5000ms'");
    await client.query("SET LOCAL lock_timeout='1500ms'");
    if ((await client.query("SELECT current_setting('transaction_read_only') AS readonly")).rows[0]?.readonly !== 'on') throw new Error('READ_ONLY_NOT_ENFORCED');
    const checked = await assertConstructorCrmSchema(client);
    result = { ...base, passed: true, status: 'SCHEMA_VERIFIED', schemaVersion: checked.version, fingerprint: checked.fingerprint, requiredColumnsPresent: true, roleHasRequiredTablePrivileges: true };
  } catch (error) {
    result = { ...base, status: ['CONSTRUCTOR_CRM_SCHEMA_PENDING', 'CONSTRUCTOR_CRM_SCHEMA_INCOMPATIBLE', 'CONSTRUCTOR_CRM_SCHEMA_PERMISSION_REQUIRED'].includes(error?.code) ? error.code : 'UNCONFIRMED' };
  } finally {
    if (client) {
      try { await client.query('ROLLBACK'); }
      catch { result = { ...base, status: 'CLEANUP_UNCONFIRMED' }; }
      try { await client.end(); }
      catch { result = { ...base, status: 'CLEANUP_UNCONFIRMED' }; }
    }
  }
  if (connectionFailed) result = { ...base, status: 'UNCONFIRMED' };
  return result;
}
