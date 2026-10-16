import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {focusedWorkspaceUiOptions,focusedWorkspaceUiCiOptions,focusedWorkspaceUiNotices,focusedWorkspaceUiSourceClosure,FOCUSED_WORKSPACE_WIDTHS} from '../scripts/verify-focused-workspace-ui.mjs';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),entry='src/app/(identity)/cuenta/workspace-client.js';
const reader=files=>file=>Object.hasOwn(files,file)?Buffer.from(files[file]):null;
test('focused UI accepts only local explicit source expectations and fixed evidence destination',()=>{
 assert.deepEqual(FOCUSED_WORKSPACE_WIDTHS,[390,1440]);assert.equal(focusedWorkspaceUiOptions([],{repoRoot:root}).expectedHead,null);
 assert.equal(focusedWorkspaceUiOptions(['--expected-head','a'.repeat(40)],{repoRoot:root}).expectedHead,'a'.repeat(40));
 assert.equal(focusedWorkspaceUiOptions([],{repoRoot:root}).outputRoot,path.join(root,'.vercel/private/focused-workspace-ui-evidence'));
});
test('focused UI rejects provider CI context and arbitrary path or head inputs before browser setup',()=>{
 for(const environment of [{VERCEL:'1'},{VERCEL_ENV:'preview'},{VERCEL_TARGET_ENV:'production'},{CI:'true'}])assert.throws(()=>focusedWorkspaceUiOptions([],{repoRoot:root,environment}),{code:'FOCUSED_WORKSPACE_UI_BOUNDARY_REJECTED'});
 for(const args of [['out.json'],['--expected-head','abc'],['--expected-head','a'.repeat(40),'extra'],['--output','../outside']])assert.throws(()=>focusedWorkspaceUiOptions(args,{repoRoot:root}),{code:'FOCUSED_WORKSPACE_UI_BOUNDARY_REJECTED'});
 assert.throws(()=>focusedWorkspaceUiOptions([],{repoRoot:'relative'}),{code:'FOCUSED_WORKSPACE_UI_BOUNDARY_REJECTED'});
});
test('focused UI derives exact JSX CSS and alias dependency closure from AST without reading runtime authority',()=>{
 const files={[entry]:"import {X} from './screen';import './workspace.module.css';import React from 'react';export const V=()=> <X/>;",'src/app/(identity)/cuenta/screen.js':"export {x} from '@/lib/pure.mjs';",'src/app/(identity)/cuenta/workspace.module.css':'.panel[hidden]{display:none!important}','src/lib/pure.mjs':'export const x=1;'};
 const found=focusedWorkspaceUiSourceClosure(reader(files));assert.deepEqual(found.files,Object.keys(files).sort());assert.deepEqual(found.externalImports,['react']);
});
test('focused UI fails closed when an actual relative or alias dependency is unavailable',()=>{
 for(const ref of ['./missing','@/lib/missing.mjs'])assert.throws(()=>focusedWorkspaceUiSourceClosure(reader({[entry]:`import '${ref}';`})),{code:'FOCUSED_WORKSPACE_UI_BOUNDARY_REJECTED'});
});
test('focused UI rejects executable remote imports and escaping relative sources',()=>{
 for(const ref of ['https://example.invalid/code.js','file:/private/source.mjs','data:text/javascript,void0','../../../../outside.mjs'])assert.throws(()=>focusedWorkspaceUiSourceClosure(reader({[entry]:`import '${ref}';`,'outside.mjs':'export const x=1;'})),{code:'FOCUSED_WORKSPACE_UI_BOUNDARY_REJECTED'});
});
test('focused UI captures static dynamic imports and rejects CSS external network dependencies',()=>{
 const files={[entry]:"export const load=()=>import('./screen');",'src/app/(identity)/cuenta/screen.js':"import './bad.css';",'src/app/(identity)/cuenta/bad.css':'body{background:url(https://example.invalid/image.png)}'};
 assert.throws(()=>focusedWorkspaceUiSourceClosure(reader(files)),{code:'FOCUSED_WORKSPACE_UI_BOUNDARY_REJECTED'});
 files['src/app/(identity)/cuenta/bad.css']='body{color:#fff}';assert.equal(focusedWorkspaceUiSourceClosure(reader(files)).files.length,3);
});

const ciHead='a'.repeat(40),ciArgs=['--ci','--expected-head',ciHead];
const ciEnvironment=()=>({CI:'true',GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'inguillen87/obrasaas',GITHUB_SHA:ciHead,GITHUB_WORKFLOW:'Authorized workspace acceptance',GITHUB_JOB:'workspace-ui',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_RUN_ID:'123456',GITHUB_RUN_ATTEMPT:'1',GITHUB_REF:'refs/heads/fix/synthetic-fixture',GITHUB_WORKFLOW_REF:'inguillen87/obrasaas/.github/workflows/workspace-acceptance.yml@refs/heads/fix/synthetic-fixture'});
test('focused UI explicit CI entry binds the original workflow lane head run attempt and event',()=>{
 const options=focusedWorkspaceUiCiOptions(ciArgs,{repoRoot:root,environment:ciEnvironment()});
 assert.equal(options.expectedHead,ciHead);assert.equal(options.outputRoot,path.join(root,'.vercel/private/focused-workspace-ui-evidence'));
 assert.deepEqual(options.ciRun,{repository:'inguillen87/obrasaas',workflow:'.github/workflows/workspace-acceptance.yml',runId:123456,runAttempt:1,event:'workflow_dispatch',job:'workspace-ui'});
 assert.equal(focusedWorkspaceUiCiOptions(ciArgs,{repoRoot:root,environment:{...ciEnvironment(),GITHUB_EVENT_NAME:'push'}}).ciRun.event,'push');
 assert.throws(()=>focusedWorkspaceUiOptions(['--expected-head',ciHead],{repoRoot:root,environment:ciEnvironment()}),{code:'FOCUSED_WORKSPACE_UI_BOUNDARY_REJECTED'});
});
test('focused UI explicit CI entry rejects missing foreign or ambiguous identity before setup',()=>{
 for(const [key,value]of Object.entries({CI:'false',GITHUB_ACTIONS:'false',GITHUB_REPOSITORY:'foreign/repo',GITHUB_SHA:'b'.repeat(40),GITHUB_WORKFLOW:'Another workflow',GITHUB_JOB:'people',GITHUB_EVENT_NAME:'pull_request',GITHUB_RUN_ID:'9007199254740992',GITHUB_RUN_ATTEMPT:'0',GITHUB_REF:'refs/pull/1/merge',GITHUB_WORKFLOW_REF:'foreign/repo/.github/workflows/workspace-acceptance.yml@refs/heads/fix/synthetic-fixture'}))assert.throws(()=>focusedWorkspaceUiCiOptions(ciArgs,{repoRoot:root,environment:{...ciEnvironment(),[key]:value}}),{code:'FOCUSED_WORKSPACE_UI_BOUNDARY_REJECTED'});
 for(const key of Object.keys(ciEnvironment())){const environment=ciEnvironment();delete environment[key];assert.throws(()=>focusedWorkspaceUiCiOptions(ciArgs,{repoRoot:root,environment}),{code:'FOCUSED_WORKSPACE_UI_BOUNDARY_REJECTED'});}
});
test('focused UI explicit CI entry retains provider root and CLI boundary guards',()=>{
 for(const key of ['VERCEL','VERCEL_ENV','VERCEL_TARGET_ENV'])assert.throws(()=>focusedWorkspaceUiCiOptions(ciArgs,{repoRoot:root,environment:{...ciEnvironment(),[key]:'1'}}),{code:'FOCUSED_WORKSPACE_UI_BOUNDARY_REJECTED'});
 for(const args of [[],['--expected-head',ciHead],['--ci','--expected-head','bad'],[...ciArgs,'extra'],['--ci','--output','../outside']])assert.throws(()=>focusedWorkspaceUiCiOptions(args,{repoRoot:root,environment:ciEnvironment()}),{code:'FOCUSED_WORKSPACE_UI_BOUNDARY_REJECTED'});
 assert.throws(()=>focusedWorkspaceUiCiOptions(ciArgs,{repoRoot:'relative',environment:ciEnvironment()}),{code:'FOCUSED_WORKSPACE_UI_BOUNDARY_REJECTED'});
});
const noticeFile='src/lib/participant-analysis-consent.mjs';
const noticeSource="throw new Error('A declaration reader must not execute this module');\nexport const PARTICIPANT_AUTO_OCR_NOTICE_VERSION='ocr-v2';export const PARTICIPANT_AUTO_OCR_NOTICE='Current OCR';export const PARTICIPANT_AUTO_BIOMETRIC_NOTICE_VERSION='bio-v2';export const PARTICIPANT_AUTO_BIOMETRIC_NOTICE='Current facial comparison';";
test('focused UI controlled response reads current independent v2 consent literals without executing runtime',()=>{
 assert.deepEqual(focusedWorkspaceUiNotices(reader({[noticeFile]:noticeSource})),{externalOcrNotice:{version:'ocr-v2',text:'Current OCR'},privateBiometricNotice:{version:'bio-v2',text:'Current facial comparison'}});
});
test('focused UI controlled consent response rejects missing computed or duplicate declarations',()=>{
 assert.throws(()=>focusedWorkspaceUiNotices(reader({})),{code:'FOCUSED_WORKSPACE_UI_BOUNDARY_REJECTED'});
 for(const source of [noticeSource.replace("export const PARTICIPANT_AUTO_OCR_NOTICE_VERSION='ocr-v2';",''),noticeSource.replace("'Current OCR'","String('Current OCR')"),noticeSource+"export const PARTICIPANT_AUTO_OCR_NOTICE_VERSION='foreign';"])assert.throws(()=>focusedWorkspaceUiNotices(reader({[noticeFile]:source})),{code:'FOCUSED_WORKSPACE_UI_BOUNDARY_REJECTED'});
});
