import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import { workspaceConnectionConfig } from '../src/lib/workspace-policy.mjs';
import { CONSTRUCTOR_CRM_TARGET, constructorCrmMigrationArguments, constructorCrmProductionContext, executeConstructorCrmAdoption } from './lib/constructor-crm-migration.mjs';

let client, connectionFailed = false;
try {
  const command = constructorCrmMigrationArguments(process.argv.slice(2));
  if (command.expectedProject !== CONSTRUCTOR_CRM_TARGET.projectId || command.expectedTeam !== CONSTRUCTOR_CRM_TARGET.teamId) throw Object.assign(new Error('CONSTRUCTOR_CRM_MIGRATION_TARGET_REJECTED'), {code:'CONSTRUCTOR_CRM_MIGRATION_TARGET_REJECTED'});
  const project = JSON.parse(readFileSync(new URL('../.vercel/project.json', import.meta.url), 'utf8'));
  const context = constructorCrmProductionContext(process.env, project, command.expectedProject, command.expectedTeam);
  client = new Client({ ...workspaceConnectionConfig(), statement_timeout: 15000, query_timeout: 20000, application_name: 'obrasaas-constructor-crm-schema-adoption' });
  client.on('error', () => { connectionFailed = true; });
  await client.connect();
  const result = await executeConstructorCrmAdoption(client, command);
  await client.end(); client = null;
  if (connectionFailed) throw new Error('Connection outcome unconfirmed');
  console.log(JSON.stringify({ constructorCrmAdoption: { ...context, ...result } }));
} catch (error) {
  const known = /^CONSTRUCTOR_CRM_[A-Z_]+$/.test(error?.code || '') ? error.code : 'CONSTRUCTOR_CRM_MIGRATION_UNCONFIRMED';
  console.error(JSON.stringify({ constructorCrmAdoption: { status: known, destructive: false, productionDataWriteConfirmed: false, credentialsPrinted: false } })); process.exitCode = 1;
} finally { if (client) { try { await client.end(); } catch { console.error(JSON.stringify({ constructorCrmAdoption: { status: 'CONSTRUCTOR_CRM_MIGRATION_CLEANUP_UNCONFIRMED', credentialsPrinted: false } })); process.exitCode = 1; } } }
