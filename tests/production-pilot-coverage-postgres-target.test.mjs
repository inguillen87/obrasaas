import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pilotCoverageDisposableUrl,pilotCoverageOwnedDatabase,pilotCoveragePostgresArguments,pilotCoveragePostgresSourceFiles,pilotCoveragePostgresFailure,verifyPilotCoveragePostgres,PILOT_COVERAGE_POSTGRES_VERSION,PILOT_COVERAGE_POSTGRES_CHECKS} from '../scripts/verify-pilot-coverage-postgres.mjs';

const target={CUTOVER_TEST_DISPOSABLE:'1',CUTOVER_TEST_DATABASE_URL:'postgresql://cutover_test:cutover_test@127.0.0.1:5432/obrasaas_cutover_ci'};
test('native pilot script requires an explicit run flag and exact disposable opt in before any connection',async()=>{
 assert.deepEqual(pilotCoveragePostgresArguments(['--run-disposable-postgres']),{runDisposable:true});
 for(const args of [[],['--run'],['--run-disposable-postgres','--run-disposable-postgres'],['--run-disposable-postgres','--force'],null])assert.throws(()=>pilotCoveragePostgresArguments(args),{code:'PILOT_COVERAGE_POSTGRES_RUN_REQUIRED'});
 await assert.rejects(()=>verifyPilotCoveragePostgres(target),{code:'PILOT_COVERAGE_POSTGRES_RUN_REQUIRED'});
 for(const env of [{},{CUTOVER_TEST_DATABASE_URL:target.CUTOVER_TEST_DATABASE_URL},{...target,CUTOVER_TEST_DISPOSABLE:'true'},{CUTOVER_TEST_DISPOSABLE:'1',DATABASE_URL:target.CUTOVER_TEST_DATABASE_URL}])await assert.rejects(()=>verifyPilotCoveragePostgres(env,{runDisposable:true}),{code:'ORGANIZATION_USAGE_DISPOSABLE_TARGET_REJECTED'});
 assert.equal(pilotCoveragePostgresFailure(new Error('rejected before SQL')).postgresExecuted,false);
});
test('pilot fixture accepts only the existing localhost admin role database and port grammar',()=>{
 for(const host of ['localhost','127.0.0.1'])for(const port of ['5432','6549'])assert.equal(pilotCoverageDisposableUrl({...target,CUTOVER_TEST_DATABASE_URL:`postgresql://cutover_test@${host}:${port}/obrasaas_cutover_ci`}).hostname,host);
 for(const url of ['postgresql://cutover_test@ep-synthetic.neon.tech:5432/neondb','postgresql://cutover_test@example.invalid:5432/obrasaas_cutover_ci','postgresql://postgres@localhost:5432/obrasaas_cutover_ci','postgresql://cutover_test@localhost:5432/other','postgresql://cutover_test:foreign@localhost:5432/obrasaas_cutover_ci','postgresql://cutover_test:cutover_test@localhost:6549/obrasaas_cutover_ci','postgresql://cutover_test@localhost:6548/obrasaas_cutover_ci',target.CUTOVER_TEST_DATABASE_URL+'?sslmode=require',target.CUTOVER_TEST_DATABASE_URL+'#ignored'])assert.throws(()=>pilotCoverageDisposableUrl({...target,CUTOVER_TEST_DATABASE_URL:url}),{code:'ORGANIZATION_USAGE_DISPOSABLE_TARGET_REJECTED'});
 for(const key of ['VERCEL','VERCEL_ENV','VERCEL_TARGET_ENV'])assert.throws(()=>pilotCoverageDisposableUrl({...target,[key]:'production'}),{code:'ORGANIZATION_USAGE_DISPOSABLE_TARGET_REJECTED'});
});
test('cleanup accepts only a fresh database in this harness own UUID namespace',()=>{
 const own='obrasaas_pilot_coverage_'+'a'.repeat(32);assert.equal(pilotCoverageOwnedDatabase(own),own);
 for(const value of [null,undefined,'obrasaas_cutover_ci','postgres','obrasaas_resource_usage_'+'a'.repeat(32),own+'x','obrasaas_pilot_coverage_'+'A'.repeat(32),own+';DROP DATABASE postgres'])assert.throws(()=>pilotCoverageOwnedDatabase(value),{code:'PILOT_COVERAGE_OWNED_DATABASE_REJECTED'});
});
test('native fixed matrix retains race expiry HELD UNKNOWN and original commerce boundaries',()=>{
 assert.equal(PILOT_COVERAGE_POSTGRES_VERSION,'pilot-coverage-postgres-v1');assert.equal(PILOT_COVERAGE_POSTGRES_CHECKS.length,12);assert.equal(new Set(PILOT_COVERAGE_POSTGRES_CHECKS).size,12);assert.equal(Object.isFrozen(PILOT_COVERAGE_POSTGRES_CHECKS),true);
 for(const needle of ['native-concurrent-create','native-simultaneous-reservation','natural-SQL-expiry','UNKNOWN-source','current-HELD-v2','commercial-trials'])assert.ok(PILOT_COVERAGE_POSTGRES_CHECKS.some(c=>c.includes(needle)),needle);
});
test('real AST closure covers authority grant usage preanalysis source fixture cleanup and guard tests',()=>{
 const files=pilotCoveragePostgresSourceFiles();for(const file of ['scripts/verify-pilot-coverage-postgres.mjs','tests/production-pilot-coverage-postgres-target.test.mjs','src/lib/platform-operator-authority.mjs','src/lib/verified-session.mjs','src/lib/organization-pilot-coverage.mjs','src/lib/organization-resource-usage-store.mjs','src/lib/participant-kyc-preanalysis.mjs','tests/fixtures/participant-preanalysis-memory.mjs','scripts/lib/disposable-postgres-cleanup.mjs','scripts/verify-organization-usage-postgres.mjs','package.json','package-lock.json'])assert.ok(files.includes(file),file);
 assert.deepEqual(files,[...new Set(files)].sort());assert.ok(files.every(file=>!path.isAbsolute(file)&&!file.includes('..')));
});
test('failure proof is bounded and sanitized without claiming native acceptance',()=>{
 const secret='synthetic-private-details',context={stage:'NATIVE_CHECK',check:PILOT_COVERAGE_POSTGRES_CHECKS[9],completedCheckCount:9,postgresExecuted:true,poolClosed:true,databaseRemoved:true},error=Object.assign(new TypeError(secret),{code:'42703',schema:'public',table:'AuditLog',message:secret,detail:secret,query:secret});
 const proof=pilotCoveragePostgresFailure(error,{context});assert.equal(proof.version,PILOT_COVERAGE_POSTGRES_VERSION);assert.equal(proof.check,context.check);assert.equal(proof.completedCheckCount,9);assert.equal(proof.sourceAuthorityAccepted,false);assert.equal(proof.canonicalGatePassed,false);assert.equal(proof.postgresExecuted,true);assert.equal(proof.poolClosed,true);assert.equal(proof.databaseRemoved,true);assert.doesNotMatch(JSON.stringify(proof),new RegExp(secret));
 const invalid=pilotCoveragePostgresFailure(error,{context:{...context,check:secret,completedCheckCount:99,postgresExecuted:secret}});assert.equal(invalid.check,null);assert.equal(invalid.completedCheckCount,0);assert.equal(invalid.postgresExecuted,false);
});
