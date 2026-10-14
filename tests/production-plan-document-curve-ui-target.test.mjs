import test from 'node:test';
import assert from 'node:assert/strict';
import {copyFileSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {planDocumentCurveUiOptions,planDocumentCurveUiSourceFiles,planDocumentCurveUiFixtureSourceFiles,PLAN_DOCUMENT_CURVE_UI_CHECKS,PLAN_DOCUMENT_CURVE_UI_WIDTHS} from '../scripts/verify-plan-document-curve-ui.mjs';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),head='a'.repeat(40);
test('document UI producer requires exact event SHA and keeps evidence in its private directory',()=>{
 const output='.vercel/private/plan-document-curve-evidence/current-browser.json';assert.equal(planDocumentCurveUiOptions(['--expected-head',head,output],{repoRoot:root,environment:{GITHUB_SHA:head}}).target,path.join(root,output));
 for(const args of [['--expected-head','abc'],['--expected-head','b'.repeat(40),output],['--expected-head',head,'../foreign.json'],['--expected-head',head,'.vercel/private/other/current.json'],['--unknown']])assert.throws(()=>planDocumentCurveUiOptions(args,{repoRoot:root,environment:{GITHUB_SHA:head}}),{code:'PLAN_DOCUMENT_CURVE_UI_FIXTURE_REJECTED'});
});
test('document UI producer rejects any deployment environment before fixture creation',()=>{
 for(const name of ['VERCEL','VERCEL_ENV','VERCEL_TARGET_ENV'])assert.throws(()=>planDocumentCurveUiOptions([],{repoRoot:root,environment:{[name]:'production'}}),{code:'PLAN_DOCUMENT_CURVE_UI_FIXTURE_REJECTED'});
});
test('actual import closure includes the shared document validator and every reference-only journal dependency',()=>{
 const sources=planDocumentCurveUiSourceFiles(root);assert.ok(sources.includes('src/lib/plan-import-document-curve.mjs'));for(const name of ['plan-baseline-view.mjs','plan-source-curve.mjs','workspace-recovery-journal.mjs','workspace-recovery-storage.mjs','workspace-session-request.mjs'])assert.ok(sources.includes('src/app/(identity)/cuenta/'+name));assert.equal(new Set(sources).size,sources.length);assert.ok(sources.every(name=>name.startsWith('src/')));
 const fixture=planDocumentCurveUiFixtureSourceFiles(root);assert.ok(fixture.includes('scripts/lib/plan-document-curve-ui-fixture.mjs'));assert.ok(fixture.includes('src/lib/plan-import-policy.mjs'));assert.ok(fixture.includes('src/lib/plan-baseline-policy.mjs'));
});
function copiedSource(run){const temporary=mkdtempSync(path.join(os.tmpdir(),'obrasaas-doc-ui-')),resolved=path.resolve(temporary);assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));try{for(const relative of planDocumentCurveUiSourceFiles(root)){const destination=path.join(temporary,relative);mkdirSync(path.dirname(destination),{recursive:true});copyFileSync(path.join(root,relative),destination);}return run(temporary);}finally{assert.equal(path.resolve(temporary),resolved);rmSync(temporary,{recursive:true,force:false});}}
test('omitting either genuine document or baseline dependency causally prevents a complete rendered source proof',()=>{
 for(const relative of ['src/lib/plan-import-document-curve.mjs','src/app/(identity)/cuenta/plan-baseline-view.mjs'])copiedSource(temporary=>{assert.deepEqual(planDocumentCurveUiSourceFiles(temporary),planDocumentCurveUiSourceFiles(root));rmSync(path.join(temporary,relative));assert.throws(()=>planDocumentCurveUiSourceFiles(temporary),{code:'PLAN_DOCUMENT_CURVE_UI_FIXTURE_REJECTED'});});
});
test('computed or external browser import mutants fail before server or Chromium startup',()=>{
 for(const addition of ["\nimport 'node:fs';\n","\nexport const unsafe=()=>import(window.location.href);\n"]){copiedSource(temporary=>{const file=path.join(temporary,'src/lib/plan-import-document-curve.mjs');writeFileSync(file,readFileSync(file,'utf8')+addition);assert.throws(()=>planDocumentCurveUiSourceFiles(temporary),{code:'PLAN_DOCUMENT_CURVE_UI_FIXTURE_REJECTED'});});}
});
test('the browser matrix retains real responsive journeys and separate uncertainty and authority controls',()=>{
 assert.deepEqual(PLAN_DOCUMENT_CURVE_UI_WIDTHS,[320,390,1280]);assert.equal(PLAN_DOCUMENT_CURVE_UI_CHECKS.length,10);assert.equal(new Set(PLAN_DOCUMENT_CURVE_UI_CHECKS).size,10);for(const name of ['site-manager-tasks-only','lost-apply-ack-reload-get-only','unknown-upload-reload-get-only','crossed-source-hides-private-result','scope-change-purges-private-review'])assert.ok(PLAN_DOCUMENT_CURVE_UI_CHECKS.includes(name));
});
