import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PLAN_BASELINE_POSTGRES_CHECKS,PLAN_BASELINE_INVESTMENT_POSTGRES_CHECKS,planBaselineDisposableUrl,planBaselineOwnedDatabase,planBaselinePostgresSourceFiles,verifyPlanBaselinePostgres} from '../scripts/verify-plan-baseline-postgres.mjs';
const target={CUTOVER_TEST_DISPOSABLE:'1',CUTOVER_TEST_DATABASE_URL:'postgresql://cutover_test:cutover_test@127.0.0.1:6549/obrasaas_cutover_ci'};
test('baseline native target rejects every non-owned or unmarked database before creating a connection',async()=>{
 await assert.rejects(verifyPlanBaselinePostgres({}),{code:'PLAN_BASELINE_DISPOSABLE_TARGET_REJECTED'});
 const foreignHost=new URL(target.CUTOVER_TEST_DATABASE_URL);foreignHost.hostname='ep-fixture.neon.tech';
 for(const change of [{CUTOVER_TEST_DISPOSABLE:'0'},{CUTOVER_TEST_DATABASE_URL:foreignHost.href},{CUTOVER_TEST_DATABASE_URL:'postgresql://postgres@localhost:6549/obrasaas_cutover_ci'},{CUTOVER_TEST_DATABASE_URL:target.CUTOVER_TEST_DATABASE_URL+'?sslmode=require'},{CUTOVER_TEST_DATABASE_URL:target.CUTOVER_TEST_DATABASE_URL+'#fragment'},{VERCEL:'1'},{VERCEL_ENV:'production'},{VERCEL_TARGET:'preview'},{VERCEL_TARGET_ENV:'production'}])assert.throws(()=>planBaselineDisposableUrl({...target,...change}),{code:'PLAN_BASELINE_DISPOSABLE_TARGET_REJECTED'});
 for(const host of ['localhost','127.0.0.1'])for(const port of ['5432','6549'])assert.equal(planBaselineDisposableUrl({...target,CUTOVER_TEST_DATABASE_URL:`postgresql://cutover_test:cutover_test@${host}:${port}/obrasaas_cutover_ci`}).hostname,host);
 assert.throws(()=>planBaselineDisposableUrl({...target,CUTOVER_TEST_DATABASE_URL:'postgresql://cutover_test:cutover_test@127.0.0.1:55417/obrasaas_cutover_ci'}),{code:'PLAN_BASELINE_DISPOSABLE_TARGET_REJECTED'});
});
test('owned baseline child database cannot name the bootstrap, another producer or a SQL/shell expression',()=>{
 assert.equal(planBaselineOwnedDatabase('obrasaas_plan_baseline_'+'a'.repeat(32)),'obrasaas_plan_baseline_'+'a'.repeat(32));
 for(const value of ['obrasaas_cutover_ci','postgres','obrasaas_plan_'+'a'.repeat(32),'obrasaas_plan_baseline_'+'A'.repeat(32),'obrasaas_plan_baseline_'+'a'.repeat(31),'obrasaas_plan_baseline_'+'a'.repeat(32)+';DROP DATABASE postgres'])assert.throws(()=>planBaselineOwnedDatabase(value),{code:'PLAN_BASELINE_OWNED_DATABASE_REJECTED'});
});

test('native v5 evidence is supplemental and cannot relabel the sixteen published historical checks',()=>{
 assert.equal(PLAN_BASELINE_POSTGRES_CHECKS.length,16);
 assert.equal(createHash('sha256').update(JSON.stringify(PLAN_BASELINE_POSTGRES_CHECKS)).digest('hex'),'e1193128abdf8413b6cf212905eae5debe086f181518a6f9d8348d41d3e3cd91');
 assert.equal(PLAN_BASELINE_INVESTMENT_POSTGRES_CHECKS.length,7);assert.equal(new Set([...PLAN_BASELINE_POSTGRES_CHECKS,...PLAN_BASELINE_INVESTMENT_POSTGRES_CHECKS]).size,23);assert.ok(PLAN_BASELINE_INVESTMENT_POSTGRES_CHECKS.every(name=>name.startsWith('v5-')));
});
test('native actual AST closure resolves server route, canonical transaction, source parser and socket cleanup',()=>{
 const files=planBaselinePostgresSourceFiles();assert.equal(new Set(files).size,files.length);assert.deepEqual(files,[...files].sort());
 for(const file of ['src/app/api/identity/plan-baseline/route.js','src/lib/plan-baseline-store.mjs','src/lib/plan-baseline-policy.mjs','src/lib/plan-import-store.mjs','src/lib/plan-import-ooxml.mjs','src/lib/workspace-store.mjs','src/lib/participant-admission.mjs','scripts/lib/disposable-postgres-cleanup.mjs','tests/production-plan-baseline-postgres-target.test.mjs'])assert.ok(files.includes(file),file);
 for(const file of ['src/lib/plan-import-cyp-curve.mjs','tests/fixtures/plan-import-cyp-curve-synthetic.mjs'])assert.ok(files.includes(file),file);
});
