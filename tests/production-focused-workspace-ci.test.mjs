import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {focusedWorkspaceUiSourceFiles} from '../scripts/verify-focused-workspace-ui.mjs';
import {FOCUSED_WORKSPACE_CI_VERSION,FOCUSED_WORKSPACE_CI_KIND,FOCUSED_WORKSPACE_CI_PROOF_ID,FOCUSED_WORKSPACE_CI_EVIDENCE,FOCUSED_WORKSPACE_CHECK_NAMES,focusedWorkspaceCiSourceClosure,focusedWorkspaceUnitCases,normalizeFocusedWorkspaceChecks,parseFocusedWorkspaceTap,validateFocusedWorkspaceCi} from '../scripts/verify-focused-workspace-ci.mjs';

const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),hash=b=>createHash('sha256').update(b).digest('hex'),clone=structuredClone;
const head='a'.repeat(40),tree='b'.repeat(40),identity={repository:'inguillen87/obrasaas',workflow:'.github/workflows/workspace-acceptance.yml',runId:42,runAttempt:1,event:'workflow_dispatch',job:'workspace-ui'};
const unitFiles=['tests/production-focused-workspace-navigation.test.mjs','tests/production-focused-workspace-ui.test.mjs','tests/production-focused-workspace-ci.test.mjs'];
function fixture(){
 const sourceOverrides=new Map(),evidence=new Map();
 const readSource=file=>{if(sourceOverrides.has(file))return sourceOverrides.get(file);const target=path.join(root,file);if(existsSync(target)&&lstatSync(target).isFile())return readFileSync(target);if(file==='scripts/lib/integrated-identity-current-ci-lineage.mjs')return Buffer.from('export const pendingSyntheticShadowOnly=true;');if(file==='tests/production-integrated-identity-current-ci-lineage.test.mjs')return Buffer.from("import test from 'node:test';test('synthetic pending lineage shadow only',()=>{});");return null;};
 const ref=files=>files.map(file=>({path:file,sha256:hash(readSource(file))})),sourceFiles=focusedWorkspaceCiSourceClosure(readSource);
 const raw={version:1,status:'PASS',sourceState:'EXACT_CI_SOURCE',ciRun:clone(identity),sourceRevision:head,sourceTree:tree,trackedClean:true,checkedAt:'2026-10-16T00:00:00.000Z',widths:[390,1440],checks:FOCUSED_WORKSPACE_CHECK_NAMES.map(name=>name.startsWith('hidden-panel-')?name+':8':name),totalCheckCount:20,sourceManifest:ref(focusedWorkspaceUiSourceFiles(readSource)),sourceBytesUnchanged:true,externalImports:['react'],requests:[{method:'GET',mode:'navigation'},{method:'POST',mode:'wizard'},{method:'POST',mode:'wizard'}],errors:[],screenshots:[],providerCalls:0,businessPosts:2,navigationPosts:0,productionDataTouched:false,actualAccountWorkspaceMounted:true,actualClerkOrSSRVerified:false,syntheticPixelsOnly:true,transport:'Controlled synthetic shadow only; no browser or provider is executed by this unit fixture.',cleanup:{browserClosed:true,serverClosed:true,gracefulCloseAcknowledged:true,fixtureRemoved:true,fixtureCleanupProof:{fixtureRemoved:true}}};
 const browserPath=FOCUSED_WORKSPACE_CI_EVIDENCE+'run-synthetic/browser.json';
 for(let i=0;i<26;i++){const name='synthetic-geometric-'+i+'.png',b=Buffer.from('synthetic nonpersonal pixels '+i);evidence.set(path.posix.dirname(browserPath)+'/'+name,b);raw.screenshots.push({path:name,sha256:hash(b)});}
 const unitSuites=unitFiles.map((file,index)=>{const cases=focusedWorkspaceUnitCases(readSource,file),text=['TAP version 13',...cases.map((name,i)=>'ok '+(i+1)+' - '+name),'1..'+cases.length,'# tests '+cases.length,'# pass '+cases.length,'# fail 0','# cancelled 0','# skipped 0','# todo 0',''].join('\n'),tap=Buffer.from(text),tapPath=FOCUSED_WORKSPACE_CI_EVIDENCE+'unit-'+index+'.tap';evidence.set(tapPath,tap);return{file,sourceSha256:hash(readSource(file)),exitCode:0,tap:{path:tapPath,bytes:tap.length,sha256:hash(tap)},result:parseFocusedWorkspaceTap(tap)};});
 const spec={id:FOCUSED_WORKSPACE_CI_PROOF_ID,kind:FOCUSED_WORKSPACE_CI_KIND,lane:'workspace-ui',blockId:64,path:FOCUSED_WORKSPACE_CI_EVIDENCE+'current-ci.json',producer:'scripts/verify-focused-workspace-ci.mjs',producerSha256:hash(readSource('scripts/verify-focused-workspace-ci.mjs')),sourceFiles,checkNames:[...FOCUSED_WORKSPACE_CHECK_NAMES]};
 const proof={version:FOCUSED_WORKSPACE_CI_VERSION,status:'PASS',sourceRevision:head,sourceTree:tree,sourceState:'EXACT_CI_SOURCE',trackedClean:true,ciRun:clone(identity),harnessSha256:spec.producerSha256,sourceManifest:ref(sourceFiles),checks:[...FOCUSED_WORKSPACE_CHECK_NAMES],rawBrowser:null,unitSuites,providerCalls:0,realClerkOrSsrVerified:false,productionDataTouched:false,humanAccepted:false};
 const reseal=()=>{const b=Buffer.from(JSON.stringify(raw));evidence.set(browserPath,b);proof.rawBrowser={path:browserPath,bytes:b.length,sha256:hash(b)};};reseal();
 const validate=()=>validateFocusedWorkspaceCi(proof,{expectedHead:head,expectedTree:tree,readSource,readEvidence:file=>evidence.get(file)||null,spec,runId:42,runAttempt:1});
 return{raw,proof,spec,evidence,sourceOverrides,readSource,validate,reseal};
}
const denied=fn=>assert.throws(fn,{code:'FOCUSED_WORKSPACE_CI_REJECTED'});

test('focused CI complete shadow binds actual AST sources all browser observations and every unit name',()=>{
 const f=fixture(),result=f.validate();assert.equal(result.status,'PASS');assert.equal(result.checks,20);assert.deepEqual(result.widths,[390,1440]);assert.equal(result.originalBrowserRewritten,false);assert.equal(result.realSessionOrIdentityAccepted,false);assert.equal(result.unitTests,unitFiles.reduce((sum,file)=>sum+focusedWorkspaceUnitCases(f.readSource,file).length,0));assert.ok(result.sourceReferences>140);
});
test('focused CI accessibility normalization retains the original measured count and full check order',()=>{
 const f=fixture();assert.deepEqual(normalizeFocusedWorkspaceChecks(f.raw.checks),FOCUSED_WORKSPACE_CHECK_NAMES);
 for(const value of [':0',':4',':NaN',':5x',':9007199254740992']){const rows=[...f.raw.checks];rows[0]=FOCUSED_WORKSPACE_CHECK_NAMES[0]+value;denied(()=>normalizeFocusedWorkspaceChecks(rows));}
 const missing=f.raw.checks.slice(1);denied(()=>normalizeFocusedWorkspaceChecks(missing));const reordered=[...f.raw.checks];[reordered[1],reordered[2]]=[reordered[2],reordered[1]];denied(()=>normalizeFocusedWorkspaceChecks(reordered));
});
test('focused CI foreign head tree repository run attempt event and lane remain denied',()=>{
 for(const edit of [f=>{f.proof.sourceRevision='f'.repeat(40);},f=>{f.proof.sourceTree='f'.repeat(40);},f=>{f.proof.ciRun.repository='foreign/repo';},f=>{f.proof.ciRun.runId=43;},f=>{f.proof.ciRun.runAttempt=2;},f=>{f.proof.ciRun.event='pull_request';},f=>{f.proof.ciRun.job='people';}]){const f=fixture();edit(f);denied(f.validate);}
});
test('focused CI refuses old local browser proof retagging and extra acceptance claims',()=>{
 for(const edit of [r=>{r.sourceState='LOCAL_REVIEW_SOURCE';},r=>{delete r.ciRun;},r=>{r.ciRun.runId=43;},r=>{r.trackedClean=false;},r=>{r.realIdentityAccepted=true;}]){const f=fixture();edit(f.raw);f.reseal();denied(f.validate);}
});
test('focused CI changed missing duplicate or omitted RAW sources cannot enter either manifest',()=>{
 for(const edit of [f=>{f.proof.sourceManifest.pop();},f=>{f.proof.sourceManifest[0].sha256='f'.repeat(64);},f=>{f.spec.sourceFiles.pop();},f=>{f.raw.sourceManifest.pop();f.reseal();},f=>{f.raw.sourceManifest.push(clone(f.raw.sourceManifest[0]));f.reseal();},f=>{f.sourceOverrides.set('src/app/(identity)/cuenta/workspace-client.js',Buffer.from('export const substituted=true;'));}]){const f=fixture();edit(f);denied(f.validate);}
});
test('focused CI never repairs changed original browser bytes or an escaping evidence reference',()=>{
 const changed=fixture();changed.evidence.set(changed.proof.rawBrowser.path,Buffer.from('{}'));denied(changed.validate);
 for(const value of ['../outside/browser.json','/outside/browser.json',FOCUSED_WORKSPACE_CI_EVIDENCE+'run-x/../browser.json']){const f=fixture();f.proof.rawBrowser.path=value;denied(f.validate);}
});
test('focused CI no provider session business navigation or automatic acceptance can be asserted',()=>{
 for(const edit of [r=>{r.providerCalls=1;},r=>{r.navigationPosts=1;},r=>{r.businessPosts=3;},r=>{r.actualClerkOrSSRVerified=true;},r=>{r.actualAccountWorkspaceMounted=false;},r=>{r.requests.push({method:'POST',mode:'navigation'});}]){const f=fixture();edit(f.raw);f.reseal();denied(f.validate);}
 const f=fixture();f.proof.humanAccepted=true;denied(f.validate);
});
test('focused CI original screenshots cleanup and source postconditions remain mandatory',()=>{
 for(const key of ['browserClosed','serverClosed','gracefulCloseAcknowledged','fixtureRemoved']){const f=fixture();f.raw.cleanup[key]=false;f.reseal();denied(f.validate);}
 const unremoved=fixture();unremoved.raw.cleanup.fixtureCleanupProof.fixtureRemoved=false;unremoved.reseal();denied(unremoved.validate);
 const mutated=fixture();mutated.evidence.delete(path.posix.dirname(mutated.proof.rawBrowser.path)+'/'+mutated.raw.screenshots[0].path);denied(mutated.validate);
 const drifted=fixture();drifted.raw.sourceBytesUnchanged=false;drifted.reseal();denied(drifted.validate);
});
test('focused CI TAP skipped failed cancelled partial or duplicate summaries remain denied',()=>{
 for(const text of ['ok 1 - a\n# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 1\n# todo 0\n','not ok 1 - a\n# tests 1\n# pass 0\n# fail 1\n# cancelled 0\n# skipped 0\n# todo 0\n','ok 1 - a\n# tests 1\n# pass 1\n# fail 0\n# cancelled 1\n# skipped 0\n# todo 0\n','# tests 1\n# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n','ok 1 - a\n'])denied(()=>parseFocusedWorkspaceTap(text));
});
test('focused CI an omitted unit or resealed shortened TAP cannot replace all source-declared cases',()=>{
 const omitted=fixture();omitted.proof.unitSuites.pop();denied(omitted.validate);
 const f=fixture(),row=f.proof.unitSuites[0],tap=Buffer.from('ok 1 - '+row.result.cases[0]+'\n# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n');f.evidence.set(row.tap.path,tap);row.tap.bytes=tap.length;row.tap.sha256=hash(tap);row.result=parseFocusedWorkspaceTap(tap);denied(f.validate);
});
test('focused CI extra envelope metadata and resealed malformed original JSON remain denied',()=>{
 const extra=fixture();extra.proof.syntheticApproval=true;denied(extra.validate);
 const f=fixture(),raw=Buffer.from('{malformed');f.evidence.set(f.proof.rawBrowser.path,raw);f.proof.rawBrowser.bytes=raw.length;f.proof.rawBrowser.sha256=hash(raw);denied(f.validate);
 const badTimestamp=fixture();badTimestamp.raw.checkedAt='not-a-completion-time';badTimestamp.reseal();denied(badTimestamp.validate);
});
