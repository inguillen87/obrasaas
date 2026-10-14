import test from 'node:test';
import assert from 'node:assert/strict';
import {planBaselineDisposableUrl,planBaselineOwnedDatabase,planBaselinePostgresSourceFiles,verifyPlanBaselinePostgres} from '../scripts/verify-plan-baseline-postgres.mjs';
const target={CUTOVER_TEST_DISPOSABLE:'1',CUTOVER_TEST_DATABASE_URL:'postgresql://cutover_test:cutover_test@127.0.0.1:6549/obrasaas_cutover_ci'};
test('baseline native target rejects every non-owned or unmarked database before creating a connection',async()=>{
 await assert.rejects(verifyPlanBaselinePostgres({}),{code:'PLAN_BASELINE_DISPOSABLE_TARGET_REJECTED'});
 const foreignHost=new URL(target.CUTOVER_TEST_DATABASE_URL);foreignHost.hostname='ep-fixture.neon.tech';
 for(const change of [{CUTOVER_TEST_DISPOSABLE:'0'},{CUTOVER_TEST_DATABASE_URL:foreignHost.href},{CUTOVER_TEST_DATABASE_URL:'postgresql://postgres@localhost:6549/obrasaas_cutover_ci'},{CUTOVER_TEST_DATABASE_URL:target.CUTOVER_TEST_DATABASE_URL+'?sslmode=require'},{CUTOVER_TEST_DATABASE_URL:target.CUTOVER_TEST_DATABASE_URL+'#fragment'},{VERCEL:'1'},{VERCEL_ENV:'production'},{VERCEL_TARGET:'preview'},{VERCEL_TARGET_ENV:'production'}])assert.throws(()=>planBaselineDisposableUrl({...target,...change}),{code:'PLAN_BASELINE_DISPOSABLE_TARGET_REJECTED'});
 for(const host of ['localhost','127.0.0.1'])for(const port of ['5432','6549'])assert.equal(planBaselineDisposableUrl({...target,CUTOVER_TEST_DATABASE_URL:`postgresql://cutover_test:cutover_test@${host}:${port}/obrasaas_cutover_ci`}).hostname,host);
});
test('owned baseline child database cannot name the bootstrap, another producer or a SQL/shell expression',()=>{
 assert.equal(planBaselineOwnedDatabase('obrasaas_plan_baseline_'+'a'.repeat(32)),'obrasaas_plan_baseline_'+'a'.repeat(32));
 for(const value of ['obrasaas_cutover_ci','postgres','obrasaas_plan_'+'a'.repeat(32),'obrasaas_plan_baseline_'+'A'.repeat(32),'obrasaas_plan_baseline_'+'a'.repeat(31),'obrasaas_plan_baseline_'+'a'.repeat(32)+';DROP DATABASE postgres'])assert.throws(()=>planBaselineOwnedDatabase(value),{code:'PLAN_BASELINE_OWNED_DATABASE_REJECTED'});
});
test('native actual AST closure resolves server route, canonical transaction, source parser and socket cleanup',()=>{
 const files=planBaselinePostgresSourceFiles();assert.equal(new Set(files).size,files.length);assert.deepEqual(files,[...files].sort());
 for(const file of ['src/app/api/identity/plan-baseline/route.js','src/lib/plan-baseline-store.mjs','src/lib/plan-baseline-policy.mjs','src/lib/plan-import-store.mjs','src/lib/plan-import-ooxml.mjs','src/lib/workspace-store.mjs','src/lib/participant-admission.mjs','scripts/lib/disposable-postgres-cleanup.mjs','tests/production-plan-baseline-postgres-target.test.mjs'])assert.ok(files.includes(file),file);
});
