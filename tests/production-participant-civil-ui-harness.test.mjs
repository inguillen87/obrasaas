import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdirSync,mkdtempSync,readFileSync,readdirSync,unlinkSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {participantCivilUiOptions,participantCivilUiSourceFiles,participantCivilUiServerEnvironment,verifyParticipantCivilUi,PARTICIPANT_CIVIL_UI_VERSION,PARTICIPANT_CIVIL_UI_WIDTHS,PARTICIPANT_CIVIL_UI_CHECKS} from '../scripts/verify-participant-civil-ui.mjs';
import {captureOwnedFixture,removeOwnedFixture} from '../scripts/lib/owned-fixture-cleanup.mjs';
const repoRoot=path.resolve(fileURLToPath(new URL('../',import.meta.url))),head='a'.repeat(40),options=(args=[],environment={})=>participantCivilUiOptions(args,{repoRoot,environment});

test('civil browser evidence binds the exact event commit its own output directory and ten bounded groups',()=>{
 assert.equal(PARTICIPANT_CIVIL_UI_VERSION,'participant-civil-ui-v1');assert.equal(options().target,null);
 assert.equal(options(['--expected-head',head,'.vercel/private/participant-civil-evidence/current-browser.json'],{GITHUB_SHA:head}).target,path.join(repoRoot,'.vercel/private/participant-civil-evidence/current-browser.json'));
 assert.deepEqual(PARTICIPANT_CIVIL_UI_WIDTHS,[320,390,768,1280]);assert.equal(PARTICIPANT_CIVIL_UI_CHECKS.length,10);assert.equal(new Set(PARTICIPANT_CIVIL_UI_CHECKS).size,10);
});

test('hosted environments abbreviated commits and foreign output paths fail before any fixture starts',()=>{
 for(const key of ['VERCEL','VERCEL_ENV','VERCEL_TARGET_ENV'])assert.throws(()=>options([],{[key]:'production'}),{code:'PARTICIPANT_CIVIL_UI_FIXTURE_REJECTED'});
 for(const args of [['--expected-head','abc123'],['--expected-head','invalid'],['--expected-head'],['--unknown'],['a','b'],['current-browser.json'],['.vercel/private/participant-civil-evidence/../foreign.json'],['.vercel/private/participant-civil-evidence'],['.vercel/private/participant-civil-evidence/browser.html'],['.vercel/private/participant-civil-evidence/nested/browser.json'],['--expected-head',head,'out','extra']])assert.throws(()=>options(args),{code:'PARTICIPANT_CIVIL_UI_FIXTURE_REJECTED'});
 assert.throws(()=>options(['--expected-head',head],{GITHUB_SHA:'b'.repeat(40)}),{code:'PARTICIPANT_CIVIL_UI_FIXTURE_REJECTED'});
});

test('an existing proof cannot be overwritten and rejects before creating an owned server directory',async()=>{
 const privateRoot=path.join(repoRoot,'.vercel/private'),outputRoot=path.join(privateRoot,'participant-civil-evidence');mkdirSync(outputRoot,{recursive:true});const relative='.vercel/private/participant-civil-evidence/guard-'+randomUUID()+'.json',filename=path.join(repoRoot,relative),bytes='{"immutable":true}\n';writeFileSync(filename,bytes,{flag:'wx'});
 const before=readdirSync(privateRoot).filter(name=>name.startsWith('participant-civil-ui-')).sort();
 try{await assert.rejects(verifyParticipantCivilUi([relative]),{code:'PARTICIPANT_CIVIL_UI_FIXTURE_REJECTED'});assert.equal(readFileSync(filename,'utf8'),bytes);assert.deepEqual(readdirSync(privateRoot).filter(name=>name.startsWith('participant-civil-ui-')).sort(),before);}
 finally{unlinkSync(filename);}
});

test('actual AST closure includes the civil JSX strict validator canonical lifecycle transport and production styling',()=>{
 const files=participantCivilUiSourceFiles(repoRoot),base='src/app/(identity)/cuenta/';
 assert.deepEqual(files,['participant-civil-data-panel.js','participant-civil-data-view.mjs','participant-panel.module.css','workspace-request-lifecycle.mjs','workspace-session-request.mjs'].map(file=>base+file).sort());
 assert.equal(new Set(files).size,files.length);assert.ok(files.every(file=>file.startsWith('src/')&&!file.includes('/api/')&&!file.includes('store')));
});

test('fixture process environment removes provider database Clerk and deployment credentials',()=>{
 const selected=participantCivilUiServerEnvironment({Path:'synthetic-path',TEMP:'synthetic-temp',BINDX_PASSWORD:'secret',DATABASE_URL:'secret',CLERK_SECRET_KEY:'secret',VERCEL:'1',NODE_OPTIONS:'--require unsafe',HTTP_PROXY:'secret',NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:'secret',NEXT_TELEMETRY_DISABLED:'0',NODE_ENV:'production'});
 assert.deepEqual(selected,{Path:'synthetic-path',TEMP:'synthetic-temp',NEXT_TELEMETRY_DISABLED:'1',NODE_ENV:'development'});assert.ok(!JSON.stringify(selected).includes('secret'));
});

test('closure rejects escaped files server imports dynamic imports and remote CSS before copying any dependency',async()=>{
 const privateRoot=path.join(repoRoot,'.vercel/private');mkdirSync(privateRoot,{recursive:true});const fixture=mkdtempSync(path.join(privateRoot,'civil-harness-guard-')),ownership=captureOwnedFixture({workspaceRoot:repoRoot,privateRoot,fixture,prefix:'civil-harness-guard-'});
 try{
  const panel=path.join(fixture,'src/app/(identity)/cuenta/participant-civil-data-panel.js');mkdirSync(path.dirname(panel),{recursive:true});writeFileSync(path.join(fixture,'outside.mjs'),'export const privateValue=1;');
  for(const bytes of ["import '../../../../outside.mjs';","import 'node:fs';","const target='./view.mjs';import(target);","import './remote.css';"]){
   writeFileSync(panel,bytes);writeFileSync(path.join(path.dirname(panel),'remote.css'),'@import "https://example.invalid/private.css";');assert.throws(()=>participantCivilUiSourceFiles(fixture),{code:'PARTICIPANT_CIVIL_UI_FIXTURE_REJECTED'});
  }
 }finally{const proof=await removeOwnedFixture(ownership,{serverClosedBeforeFixtureRemoval:true});assert.equal(proof.fixtureRemoved,true);}
});
