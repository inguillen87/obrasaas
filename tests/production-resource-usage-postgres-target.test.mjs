import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {resourceUsageDisposableUrl,resourceUsageOwnedDatabase,resourceUsageSourceFiles,resourceUsageFailure,RESOURCE_USAGE_POSTGRES_PROOF_VERSION,RESOURCE_USAGE_POSTGRES_CHECKS} from '../scripts/verify-resource-usage-postgres.mjs';

// Guard/source-proof tests only. Importing the native harness must not connect,
// execute SQL, create a database or call a provider.
const target={CUTOVER_TEST_DISPOSABLE:'1',CUTOVER_TEST_DATABASE_URL:'postgresql://cutover_test:cutover_test@127.0.0.1:5432/obrasaas_cutover_ci'};
const denied=value=>assert.throws(()=>resourceUsageDisposableUrl(value),{code:'ORGANIZATION_USAGE_DISPOSABLE_TARGET_REJECTED'});

test('resource native verification reuses the explicit disposable target guard before connections',()=>{
 for(const value of [{},{CUTOVER_TEST_DATABASE_URL:target.CUTOVER_TEST_DATABASE_URL},{...target,CUTOVER_TEST_DISPOSABLE:'0'},{...target,CUTOVER_TEST_DISPOSABLE:'true'},{CUTOVER_TEST_DISPOSABLE:'1',DATABASE_URL:target.CUTOVER_TEST_DATABASE_URL}])denied(value);
});

test('only the exact localhost port database and fixture role identities are accepted',()=>{
 assert.equal(resourceUsageDisposableUrl(target).href,target.CUTOVER_TEST_DATABASE_URL);
 for(const host of ['localhost','127.0.0.1'])for(const port of ['5432','6549'])assert.equal(resourceUsageDisposableUrl({...target,CUTOVER_TEST_DATABASE_URL:`postgresql://cutover_test@${host}:${port}/obrasaas_cutover_ci`}).hostname,host);
});

test('remote production URLs foreign databases roles options and Vercel contexts are rejected',()=>{
 for(const url of ['postgresql://cutover_test@ep-synthetic.neon.tech:5432/neondb','postgresql://cutover_test@example.invalid:5432/obrasaas_cutover_ci','postgresql://cutover_test@localhost:5432/production','postgresql://postgres@localhost:5432/obrasaas_cutover_ci','postgresql://cutover_test:foreign@localhost:5432/obrasaas_cutover_ci','postgresql://cutover_test:cutover_test@localhost:6549/obrasaas_cutover_ci','postgresql://cutover_test@localhost:6548/obrasaas_cutover_ci',target.CUTOVER_TEST_DATABASE_URL+'?sslmode=require',target.CUTOVER_TEST_DATABASE_URL+'#ignored','https://localhost:5432/obrasaas_cutover_ci'])denied({...target,CUTOVER_TEST_DATABASE_URL:url});
 for(const key of ['VERCEL','VERCEL_ENV','VERCEL_TARGET_ENV'])denied({...target,[key]:'production'});
});

test('database cleanup ownership permits only the harness-specific fresh lowercase UUID grammar',()=>{
 const own='obrasaas_resource_usage_'+ 'a'.repeat(32);assert.equal(resourceUsageOwnedDatabase(own),own);
 for(const value of [undefined,null,'obrasaas_cutover_ci','postgres','obrasaas_org_usage_'+ 'a'.repeat(32),'obrasaas_resource_usage_'+ 'A'.repeat(32),own+'x',own+';DROP DATABASE postgres','"'+own+'"','obrasaas_resource_usage_'+ 'a'.repeat(31)])assert.throws(()=>resourceUsageOwnedDatabase(value),{code:'RESOURCE_USAGE_OWNED_DATABASE_REJECTED'});
});

test('fixed native checks include actual lock races and the older reserved capability regression',()=>{
 assert.equal(RESOURCE_USAGE_POSTGRES_PROOF_VERSION,'resource-usage-postgres-v2');assert.equal(RESOURCE_USAGE_POSTGRES_CHECKS.length,16);assert.equal(new Set(RESOURCE_USAGE_POSTGRES_CHECKS).size,16);assert.ok(Object.isFrozen(RESOURCE_USAGE_POSTGRES_CHECKS));
 assert.ok(RESOURCE_USAGE_POSTGRES_CHECKS.some(value=>value.startsWith('native-resource-held-organization-lock')));assert.ok(RESOURCE_USAGE_POSTGRES_CHECKS.some(value=>value.startsWith('native-plan-held-organization-lock')));assert.ok(RESOURCE_USAGE_POSTGRES_CHECKS.some(value=>value.startsWith('older-RESERVED-capability')));
});

test('AST source closure includes both ledger versions canonical owner authority fixtures and guard tests',()=>{
 const files=resourceUsageSourceFiles();
 for(const file of ['package.json','package-lock.json','scripts/verify-resource-usage-postgres.mjs','scripts/verify-organization-usage-postgres.mjs','scripts/lib/company-channel-disposable-fixture.mjs','scripts/lib/disposable-postgres-cleanup.mjs','tests/production-resource-usage-postgres-target.test.mjs','src/lib/workspace-store.mjs','src/lib/organization-usage-store.mjs','src/lib/organization-resource-usage-store.mjs','src/lib/organization-resource-usage-policy.mjs'])assert.ok(files.includes(file),file);
 assert.deepEqual(files,[...files].sort());assert.equal(new Set(files).size,files.length);assert.ok(files.every(value=>!value.includes('..')&&!path.isAbsolute(value)));
});

test('safe failure proof retains native check and cleanup facts without private messages URLs or objects',()=>{
 const sensitive='synthetic-secret-material',context={stage:'NATIVE_CHECK',check:RESOURCE_USAGE_POSTGRES_CHECKS[15],completedCheckCount:15,poolClosed:true,databaseRemoved:true},root=process.cwd(),source=path.join(root,'scripts/verify-resource-usage-postgres.mjs');
 const error=Object.assign(new TypeError(sensitive),{stack:`TypeError: ${sensitive}\n    at fence (${source}:200:20)\n    at external (/private/${sensitive}.js:1:1)`,actual:{token:sensitive},expected:sensitive}),proof=resourceUsageFailure(error,{root,context});
 assert.equal(proof.version,RESOURCE_USAGE_POSTGRES_PROOF_VERSION);assert.equal(proof.check,context.check);assert.equal(proof.completedCheckCount,15);assert.equal(proof.poolClosed,true);assert.equal(proof.databaseRemoved,true);assert.equal(proof.errorName,'TypeError');assert.deepEqual(proof.locations,['scripts/verify-resource-usage-postgres.mjs:200:20']);assert.doesNotMatch(JSON.stringify(proof),new RegExp(sensitive));
 const sql=resourceUsageFailure({name:'error',code:'42703',schema:'public',table:'AuditLog',column:'metadata',message:sensitive,detail:sensitive,query:sensitive},{context});assert.equal(sql.sql.code,'42703');assert.doesNotMatch(JSON.stringify(sql),new RegExp(sensitive));
 const invalid=resourceUsageFailure({message:sensitive},{context:{...context,check:sensitive,completedCheckCount:1000}});assert.equal(invalid.check,null);assert.equal(invalid.completedCheckCount,0);assert.doesNotMatch(JSON.stringify(invalid),new RegExp(sensitive));
});
