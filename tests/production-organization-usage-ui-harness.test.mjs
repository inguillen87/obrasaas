import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {organizationUsageUiOptions,organizationUsageUiSourceFiles,ORGANIZATION_USAGE_UI_VERSION,ORGANIZATION_USAGE_UI_CHECKS,ORGANIZATION_USAGE_UI_WIDTHS} from '../scripts/verify-organization-usage-ui.mjs';
const repoRoot=fileURLToPath(new URL('../',import.meta.url)),head='a'.repeat(40),options=(args=[],environment={})=>organizationUsageUiOptions(args,{repoRoot,environment});
test('the isolated usage browser proof requires its own output directory and an exact event commit',()=>{
 assert.equal(ORGANIZATION_USAGE_UI_VERSION,'organization-usage-ui-v1');assert.equal(options().target,null);
 assert.equal(options(['--expected-head',head,'.vercel/private/organization-usage-evidence/browser.json'],{GITHUB_SHA:head}).target,path.join(repoRoot,'.vercel/private/organization-usage-evidence/browser.json'));
 assert.deepEqual(ORGANIZATION_USAGE_UI_WIDTHS,[320,390,768,1280]);assert.equal(ORGANIZATION_USAGE_UI_CHECKS.length,14);assert.equal(new Set(ORGANIZATION_USAGE_UI_CHECKS).size,14);
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
