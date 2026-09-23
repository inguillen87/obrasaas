import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const base='b7203e04cd0fb8a5afd8ca87836e2dbb55264221';
let source=execFileSync('git',['show',base+':scripts/verify-project-certificates-migration.mjs'],{encoding:'utf8'});
const begin=source.indexOf('async function assertDisposableArchiveVsPending(');
const end=source.indexOf('async function assertDisposableActorRevokeVsApprove(',begin);
assert.ok(begin>0&&end>begin);
const oldBlock="    const outcomes = await Promise.allSettled([\n      runDisposableQuery(connectionString, schema, 'archive-prepare', PREPARE_SQL,\n        prepareArgs(item, snapshot, {\n          operationKey: `${item.prefix}_archive_prepare`,\n          fingerprintValue: sha256(`${item.prefix}:archive-prepare`),\n        })),\n      runDisposableQuery(connectionString, schema, 'archive-project',\n        `UPDATE \"Project\" SET \"status\"='ARCHIVED' WHERE \"organizationId\"=$1 AND \"id\"=$2 RETURNING \"status\"::text`,\n        [item.organizationId, item.projectId]),\n    ]);";
const forcedOrder="    const archived = await Promise.allSettled([\n      runDisposableQuery(connectionString, schema, 'archive-project',\n        `UPDATE \"Project\" SET \"status\"='ARCHIVED' WHERE \"organizationId\"=$1 AND \"id\"=$2 RETURNING \"status\"::text`,\n        [item.organizationId, item.projectId]),\n    ]);\n    const prepared = await Promise.allSettled([\n      runDisposableQuery(connectionString, schema, 'archive-prepare', PREPARE_SQL,\n        prepareArgs(item, snapshot, {\n          operationKey: `${item.prefix}_archive_prepare`,\n          fingerprintValue: sha256(`${item.prefix}:archive-prepare`),\n        })),\n    ]);\n    const outcomes = [prepared[0], archived[0]];";

const original=source.slice(begin,end);assert.ok(original.includes(oldBlock));
source=source.slice(0,begin)+original.replace(oldBlock,forcedOrder)+source.slice(end);
const exportAnchor='export { appAdapter, assertRolledBack, expectDatabaseError };';assert.ok(source.includes(exportAnchor));
source=source.replace(exportAnchor,'export { appAdapter, assertRolledBack, expectDatabaseError, assertDisposableArchiveVsPending };');
writeFileSync('scripts/.certificate-archive-baseline.mjs',source);
const {configuration,assertDisposableArchiveVsPending}=await import('./scripts/.certificate-archive-baseline.mjs');
const config=configuration();assert.equal(config.local,true);assert.equal(config.disposable,true);
assert.notEqual(process.env.VERCEL_ENV,'production');assert.notEqual(process.env.VERCEL_TARGET_ENV,'production');
let observed=null;
await assert.rejects(assertDisposableArchiveVsPending(config.connectionString,config.schema),error=>{
  observed=error.message;
  return observed==='Archive-vs-pending loser was not controlled: code=42501 message=PROJECT_CERTIFICATE_PREPARER_REQUIRED: active SITE_MANAGER is required';
});
const result={base,expectedOriginalFailure:true,forcedOrder:'archive-committed-before-prepare',originalPredicateUnchanged:true,sqlFunctionsUnchanged:true,observed};
writeFileSync('evidence/baseline-reproduction.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
