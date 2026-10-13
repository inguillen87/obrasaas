import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {parse} from '@babel/parser';
import {companySubscriptionVerifiedView} from '../src/app/(identity)/cuenta/company-subscription-view.mjs';
import {organizationUsageUiOptions,organizationUsageUiSourceFiles,organizationUsageUiFixtureSourceFiles,organizationUsageSubscriptionFixture,ORGANIZATION_USAGE_UI_VERSION,ORGANIZATION_USAGE_UI_CHECKS,ORGANIZATION_USAGE_UI_WIDTHS} from '../scripts/verify-organization-usage-ui.mjs';
const repoRoot=fileURLToPath(new URL('../',import.meta.url)),head='a'.repeat(40),options=(args=[],environment={})=>organizationUsageUiOptions(args,{repoRoot,environment});
test('the isolated usage browser proof requires its own output directory and an exact event commit',()=>{
 assert.equal(ORGANIZATION_USAGE_UI_VERSION,'organization-usage-ui-v2');assert.equal(options().target,null);
 assert.equal(options(['--expected-head',head,'.vercel/private/organization-usage-evidence/browser.json'],{GITHUB_SHA:head}).target,path.join(repoRoot,'.vercel/private/organization-usage-evidence/browser.json'));
 assert.deepEqual(ORGANIZATION_USAGE_UI_WIDTHS,[320,390,768,1280]);assert.equal(ORGANIZATION_USAGE_UI_CHECKS.length,14);assert.equal(new Set(ORGANIZATION_USAGE_UI_CHECKS).size,14);
});

test('the real subscription response emitter satisfies the current crypto view while its historical DTO mutant rejects',async()=>{
 const source=readFileSync(new URL('../scripts/verify-organization-usage-ui.mjs',import.meta.url),'utf8'),ast=parse(source,{sourceType:'module'});let financial,interceptorCall=false;
 function walk(node){if(!node||typeof node!=='object')return;if(node.type==='VariableDeclarator'&&node.id?.name==='financial')financial=node.init;if(node.type==='AssignmentExpression'&&node.left?.name==='value'&&node.right?.type==='CallExpression'&&node.right.callee?.name==='financial')interceptorCall=true;for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}
 walk(ast.program);assert.ok(financial&&interceptorCall,'The endpoint must execute the tested fixture emitter');assert.equal(financial.body.type,'CallExpression');assert.equal(financial.body.callee.name,'organizationUsageSubscriptionFixture');
 const scope='a'.repeat(64),observedAt='2026-10-12T12:00:00.000Z',expression=source.slice(financial.start,financial.end),emit=factory=>runInNewContext('('+expression+')(scope)',{organizationUsageSubscriptionFixture:factory,scope,observedAt});
 const actual=emit(organizationUsageSubscriptionFixture),view=await companySubscriptionVerifiedView(actual,{scope});assert.equal(actual.version,2);assert.equal(view.organizationId,'org_synthetic_a');assert.equal(view.configurationReady,false);assert.equal(view.commercial.state,'TERMS_PENDING');assert.equal(view.acceptance,null);assert.equal(view.canBegin,false);assert.deepEqual(view.offers.map(offer=>[offer.priceLabel,offer.canAccept,offer.checkoutAvailable]),[['USD 149,00',false,false],['USD 349,00',false,false]]);
 const old=emit(input=>{const value=organizationUsageSubscriptionFixture(input);delete value.commercial;delete value.acceptance;return {...value,version:1};});assert.equal(old.version,1);await assert.rejects(companySubscriptionVerifiedView(old,{scope}),{code:'COMPANY_SUBSCRIPTION_RESULT_UNCONFIRMED'});
 const wrong=emit(organizationUsageSubscriptionFixture);wrong.commercial.catalogDigest='0'.repeat(64);await assert.rejects(companySubscriptionVerifiedView(wrong,{scope}),{code:'COMPANY_SUBSCRIPTION_RESULT_UNCONFIRMED'});
});

test('the executed Node fixture and both companies have complete separate source and scope bindings',async()=>{
 assert.deepEqual(organizationUsageUiFixtureSourceFiles(repoRoot),['scripts/lib/company-subscription-ui-fixture.mjs','src/lib/company-subscription-catalog.mjs','src/lib/workspace-policy.mjs']);
 for(const scope of ['a'.repeat(64),'b'.repeat(64)]){const value=organizationUsageSubscriptionFixture({scope,observedAt:'2026-10-12T12:00:00.000Z'}),view=await companySubscriptionVerifiedView(value,{scope});assert.equal(view.organizationId,scope.startsWith('a')?'org_synthetic_a':'org_synthetic_b');assert.ok(view.offers.every(offer=>!offer.canAccept&&!offer.checkoutAvailable));await assert.rejects(companySubscriptionVerifiedView(value,{scope:'c'.repeat(64)}),{code:'WORKSPACE_CONTEXT_CHANGED'});}
});
test('hosted deployments and foreign abbreviated or mismatched CI revisions cannot start the synthetic fixture',()=>{
 for(const key of ['VERCEL','VERCEL_ENV','VERCEL_TARGET_ENV'])assert.throws(()=>options([],{[key]:'production'}),{code:'ORGANIZATION_USAGE_UI_FIXTURE_REJECTED'});
 for(const args of [['--expected-head','abc123'],['--expected-head','not-a-commit'],['--expected-head']])assert.throws(()=>options(args),{code:'ORGANIZATION_USAGE_UI_FIXTURE_REJECTED'});
 assert.throws(()=>options(['--expected-head',head],{GITHUB_SHA:'b'.repeat(40)}),{code:'ORGANIZATION_USAGE_UI_FIXTURE_REJECTED'});
});
test('unexpected arguments traversal and foreign output paths fail before creating any process',()=>{
 for(const args of [['browser.json'],['.vercel/private/organization-usage-evidence/../foreign.json'],['.vercel/private/organization-usage-evidence'],['.vercel/private/organization-usage-evidence/browser.html'],['--unknown'],['a','b'],['--expected-head',head,'out','extra']])assert.throws(()=>options(args),{code:'ORGANIZATION_USAGE_UI_FIXTURE_REJECTED'});
});
test('the rendered dependency closure follows both real panels and their usage helpers without replacing the recovery journal',()=>{
 const files=organizationUsageUiSourceFiles(repoRoot);assert.deepEqual(files,[...files].sort());assert.equal(new Set(files).size,files.length);
 for(const suffix of ['company-subscription-panel.js','company-usage-panel.js','company-usage-view.mjs','company-subscription-panel.module.css','plan-import-panel.js','plan-import-usage-view.mjs','plan-import-panel.module.css','workspace-recovery-journal.mjs','workspace-request-lifecycle.js','workspace-request-lifecycle.mjs'])assert.ok(files.includes('src/app/(identity)/cuenta/'+suffix),suffix);
 assert.ok(files.length>=15);assert.ok(files.every(file=>file.startsWith('src/')&&!file.includes('/api/')));
});
