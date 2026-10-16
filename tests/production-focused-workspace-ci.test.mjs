import {WORKSPACE_CONTINUITY_FOCUSED_UI} from '../scripts/lib/workspace-continuity-current-ci-lineage.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {focusedWorkspaceUiSourceFiles,focusedWorkspaceUiSourceClosure,focusedCompanyBootstrapUiSourceClosure} from '../scripts/verify-focused-workspace-ui.mjs';
import {FOCUSED_WORKSPACE_CI_VERSION,FOCUSED_WORKSPACE_CI_KIND,FOCUSED_WORKSPACE_CI_PROOF_ID,FOCUSED_WORKSPACE_CI_EVIDENCE,FOCUSED_WORKSPACE_CHECK_NAMES,focusedWorkspaceCiSourceClosure,focusedWorkspaceCiLocalImports,focusedWorkspaceUnitCases,normalizeFocusedWorkspaceChecks,normalizeFocusedWorkspaceCurrentChecks,parseFocusedWorkspaceTap,validateFocusedWorkspaceCi} from '../scripts/verify-focused-workspace-ci.mjs';

const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),hash=b=>createHash('sha256').update(b).digest('hex'),clone=structuredClone;
const head='a'.repeat(40),tree='b'.repeat(40),identity={repository:'inguillen87/obrasaas',workflow:'.github/workflows/workspace-acceptance.yml',runId:42,runAttempt:1,event:'workflow_dispatch',job:'workspace-ui'};
const previousUnitFiles=['tests/production-focused-workspace-navigation.test.mjs','tests/production-focused-workspace-ui.test.mjs','tests/production-focused-workspace-ci.test.mjs'];
const unitFiles=[...previousUnitFiles,'tests/production-focused-workspace-continuity-ui.test.mjs','tests/production-company-bootstrap-receipt.test.mjs'];
// This unit shadow never emits, rewrites, retags or claims real browser evidence.
const historicalFocusedCounts=result=>({checks:result.historicalChecks,unitSuites:result.historicalUnitSuites});
function fixture(){
 const current=WORKSPACE_CONTINUITY_FOCUSED_UI,sourceOverrides=new Map(),evidence=new Map();
 const readSource=file=>{if(sourceOverrides.has(file))return sourceOverrides.get(file);const target=path.join(root,file);if(existsSync(target)&&lstatSync(target).isFile())return readFileSync(target);if(file==='scripts/lib/integrated-identity-current-ci-lineage.mjs')return Buffer.from('export const pendingSyntheticShadowOnly=true;');if(file==='tests/production-integrated-identity-current-ci-lineage.test.mjs')return Buffer.from("import test from 'node:test';test('synthetic pending lineage shadow only',()=>{});");return null;};
 const ref=files=>files.map(file=>({path:file,sha256:hash(readSource(file))})),sourceFiles=focusedWorkspaceCiSourceClosure(readSource);
 let operation=0;const requests=current.requestMatrix.map(row=>{const value=clone(row);if(row.mode==='wizard'&&row.method==='POST'){value.operationId='00000000-0000-4000-8000-'+String(++operation).padStart(12,'0');value.recoveryReferenceSha256=String(operation+4).repeat(64);value.syntheticImageSha256=['1'.repeat(64),'2'.repeat(64),'3'.repeat(64)];}return value;});
 const workspace=focusedWorkspaceUiSourceClosure(readSource),bootstrap=focusedCompanyBootstrapUiSourceClosure(readSource);
 const raw={version:current.rawVersion,status:'PASS',sourceState:'EXACT_CI_SOURCE',ciRun:clone(identity),sourceRevision:head,sourceTree:tree,trackedClean:true,checkedAt:'2026-10-16T00:00:00.000Z',widths:[390,1440],continuityWidths:[...current.continuityWidths],historicalCheckCount:20,continuityCheckLedger:[...current.continuityCheckNames],expectedTotalCheckCount:current.checkNames.length,bootstrapSourceManifest:ref(bootstrap.files),bootstrapExternalImports:bootstrap.externalImports,checks:current.checkNames.map(name=>name.startsWith('hidden-panel-')?name+':8':name),totalCheckCount:current.checkNames.length,sourceManifest:ref(focusedWorkspaceUiSourceFiles(readSource)),sourceBytesUnchanged:true,externalImports:workspace.externalImports,requests,errors:[],screenshots:[],providerCalls:0,businessPosts:2,navigationPosts:0,productionDataTouched:false,actualAccountWorkspaceMounted:true,actualClerkOrSSRVerified:false,syntheticPixelsOnly:true,transport:'Controlled synthetic shadow only; no browser or provider is executed by this unit fixture.',cleanup:{browserClosed:true,serverClosed:true,gracefulCloseAcknowledged:true,fixtureRemoved:true,fixtureCleanupProof:{fixtureRemoved:true,attempts:[{attempt:1,phase:'POSTCONDITION',removalAttempted:true,rmCompleted:true,postcondition:'ABSENT',retryScheduled:false}],postcondition:{absent:true}}}};
 const browserPath=FOCUSED_WORKSPACE_CI_EVIDENCE+'run-synthetic/browser.json';
 for(const[i,name]of current.screenshotNames.entries()){const b=Buffer.from('synthetic nonpersonal pixels '+i),width=Number(/-(320|390|1440)\.png$/.exec(name)?.[1]);evidence.set(path.posix.dirname(browserPath)+'/'+name,b);raw.screenshots.push({path:name,sha256:hash(b),geometry:{width,height:1000,scrollWidth:width,identityActionTop:null}});}
 const unitSuites=unitFiles.map((file,index)=>{const cases=focusedWorkspaceUnitCases(readSource,file),text=['TAP version 13',...cases.map((name,i)=>'ok '+(i+1)+' - '+name),'1..'+cases.length,'# tests '+cases.length,'# pass '+cases.length,'# fail 0','# cancelled 0','# skipped 0','# todo 0',''].join('\n'),tap=Buffer.from(text),tapPath=FOCUSED_WORKSPACE_CI_EVIDENCE+'unit-'+index+'.tap';evidence.set(tapPath,tap);return{file,sourceSha256:hash(readSource(file)),exitCode:0,tap:{path:tapPath,bytes:tap.length,sha256:hash(tap)},result:parseFocusedWorkspaceTap(tap)};});
 const spec={id:FOCUSED_WORKSPACE_CI_PROOF_ID,kind:FOCUSED_WORKSPACE_CI_KIND,lane:'workspace-ui',blockId:64,path:FOCUSED_WORKSPACE_CI_EVIDENCE+'current-ci.json',producer:'scripts/verify-focused-workspace-ci.mjs',producerSha256:hash(readSource('scripts/verify-focused-workspace-ci.mjs')),sourceFiles,checkNames:[...current.checkNames]};
 const proof={version:FOCUSED_WORKSPACE_CI_VERSION,status:'PASS',sourceRevision:head,sourceTree:tree,sourceState:'EXACT_CI_SOURCE',trackedClean:true,ciRun:clone(identity),harnessSha256:spec.producerSha256,sourceManifest:ref(sourceFiles),checks:[...current.checkNames],historicalCheckCount:20,continuityCheckLedger:[...current.continuityCheckNames],historicalUnitSuiteCount:3,rawBrowser:null,unitSuites,providerCalls:0,realClerkOrSsrVerified:false,productionDataTouched:false,humanAccepted:false};
 const reseal=()=>{const b=Buffer.from(JSON.stringify(raw));evidence.set(browserPath,b);proof.rawBrowser={path:browserPath,bytes:b.length,sha256:hash(b)};};reseal();
 const validate=()=>validateFocusedWorkspaceCi(proof,{expectedHead:head,expectedTree:tree,readSource,readEvidence:file=>evidence.get(file)||null,spec,runId:42,runAttempt:1});
 return{raw,proof,spec,evidence,sourceOverrides,readSource,validate,reseal};
}
const denied=fn=>assert.throws(fn,{code:'FOCUSED_WORKSPACE_CI_REJECTED'});

test('focused CI complete shadow binds actual AST sources all browser observations and every unit name',()=>{
 const f=fixture(),result=f.validate(),historical=historicalFocusedCounts(result);assert.equal(result.status,'PASS');assert.equal(historical.checks,20);assert.equal(historical.unitSuites,3);assert.equal(result.version,2);assert.equal(result.checks,WORKSPACE_CONTINUITY_FOCUSED_UI.checkNames.length);assert.equal(result.continuityChecks,WORKSPACE_CONTINUITY_FOCUSED_UI.continuityCheckNames.length);assert.equal(result.unitSuites,5);assert.deepEqual(result.widths,[390,1440]);assert.equal(result.originalBrowserRewritten,false);assert.equal(result.realSessionOrIdentityAccepted,false);assert.equal(result.unitTests,unitFiles.reduce((sum,file)=>sum+focusedWorkspaceUnitCases(f.readSource,file).length,0));assert.ok(result.sourceReferences>140);
});
test('focused CI accessibility normalization retains the original measured count and full check order',()=>{
 const f=fixture();assert.deepEqual(normalizeFocusedWorkspaceChecks(f.raw.checks.slice(0,20)),FOCUSED_WORKSPACE_CHECK_NAMES);
 for(const value of [':0',':4',':NaN',':5x',':9007199254740992']){const rows=f.raw.checks.slice(0,20);rows[0]=FOCUSED_WORKSPACE_CHECK_NAMES[0]+value;denied(()=>normalizeFocusedWorkspaceChecks(rows));}
 const missing=f.raw.checks.slice(1,20);denied(()=>normalizeFocusedWorkspaceChecks(missing));const reordered=f.raw.checks.slice(0,20);[reordered[1],reordered[2]]=[reordered[2],reordered[1]];denied(()=>normalizeFocusedWorkspaceChecks(reordered));
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
 for(const edit of [r=>{r.requests[0]=null;},r=>{r.screenshots[0]=null;},r=>{r.cleanup=null;}]){const value=fixture();edit(value.raw);value.reseal();denied(value.validate);}
 const nullJson=fixture(),nullBytes=Buffer.from('null');nullJson.evidence.set(nullJson.proof.rawBrowser.path,nullBytes);nullJson.proof.rawBrowser.bytes=nullBytes.length;nullJson.proof.rawBrowser.sha256=hash(nullBytes);denied(nullJson.validate);
});

test('focused current v2 keeps the exact historical twenty while requiring every appended current observation',()=>{
 const f=fixture();assert.deepEqual(normalizeFocusedWorkspaceCurrentChecks(f.raw.checks),WORKSPACE_CONTINUITY_FOCUSED_UI.checkNames);assert.deepEqual(f.raw.checks.slice(0,20).map(row=>row.replace(/:[0-9]+$/,'')),FOCUSED_WORKSPACE_CHECK_NAMES);assert.deepEqual(unitFiles.slice(0,3),previousUnitFiles);assert.deepEqual(unitFiles,WORKSPACE_CONTINUITY_FOCUSED_UI.unitFiles);
 for(let index=20;index<WORKSPACE_CONTINUITY_FOCUSED_UI.checkNames.length;index++){const value=fixture();value.raw.checks[index]='unrelated-current-positive-only-check';value.reseal();denied(value.validate);}
 for(const edit of [r=>{r.version=1;r.checks=r.checks.slice(0,20);r.totalCheckCount=20;},r=>{r.totalCheckCount=20;},r=>{r.historicalCheckCount=19;},r=>{r.expectedTotalCheckCount=20;},r=>{r.continuityCheckLedger.pop();},r=>{r.continuityWidths=[390,1440];},r=>{[r.checks[20],r.checks[21]]=[r.checks[21],r.checks[20]];}]){const value=fixture();edit(value.raw);value.reseal();denied(value.validate);}
 const envelope=fixture();envelope.proof.version='focused-workspace-ci-v1';denied(envelope.validate);const oldNormalizer=fixture();denied(()=>normalizeFocusedWorkspaceCurrentChecks(oldNormalizer.raw.checks.slice(0,20)));
});
test('focused current bootstrap subtree external imports and original producer hashes are independently mandatory',()=>{
 for(const edit of [r=>{r.bootstrapSourceManifest.pop();},r=>{r.bootstrapSourceManifest.push(clone(r.bootstrapSourceManifest[0]));},r=>{r.bootstrapSourceManifest[0].sha256='0'.repeat(64);},r=>{r.bootstrapExternalImports.push('foreign-provider');},r=>{r.externalImports.push('foreign-package');},r=>{r.sourceManifest.find(row=>row.path==='scripts/verify-focused-workspace-ui.mjs').sha256='6d61015a48202dc0affe71afe37bd026618dda325b055f1863589bdecee2963d';}]){const f=fixture();edit(f.raw);f.reseal();denied(f.validate);}
 const absent=fixture();absent.sourceOverrides.set('src/app/(identity)/cuenta/company-bootstrap-panel.js',null);assert.throws(absent.validate,{code:'FOCUSED_WORKSPACE_UI_BOUNDARY_REJECTED'});
 const unit='tests/production-company-bootstrap-receipt.test.mjs',original=fixture(),unitBytes=original.readSource(unit),imports=focusedWorkspaceCiLocalImports(unitBytes,unit,original.readSource);assert.ok(imports.includes('../src/app/(identity)/cuenta/company-bootstrap-panel.js'));assert.ok(imports.includes('next/dist/build/swc/index.js'));assert.ok(imports.includes('react'));assert.ok(imports.includes('react-dom/server'));
 denied(()=>focusedWorkspaceCiLocalImports(unitBytes,'tests/foreign-bootstrap-receipt.test.mjs',original.readSource));
 for(const[before,after]of [["../src/app/(identity)/cuenta/company-bootstrap-panel.js","../src/app/(identity)/cuenta/foreign-panel.js"],["const source=readFileSync(new URL(","const source=foreignRead(new URL("],["next/dist/build/swc/index.js","next/dist/build/swc/foreign.js"],["const compiled=await transform(","const compiled=await foreignTransform("],["import.meta.resolve('react')","import.meta.resolve('foreign-react')"],["Buffer.from(compiled.code)","Buffer.from(source)"],[".toString('base64')",".toString('hex')"],["data:text/javascript;base64,","https://example.invalid/module/"]]){assert.ok(unitBytes.toString().includes(before));denied(()=>focusedWorkspaceCiLocalImports(Buffer.from(unitBytes.toString().replace(before,after)),unit,original.readSource));}
 denied(()=>focusedWorkspaceCiLocalImports(Buffer.from('await import(specifier);'),'scripts/foreign-transform.mjs',original.readSource));
 const remote=fixture();remote.sourceOverrides.set(unit,Buffer.from("await import('https://example.invalid/module.mjs');"));denied(()=>focusedWorkspaceCiSourceClosure(remote.readSource));
 const wrongLock=fixture();wrongLock.sourceOverrides.set('package-lock.json',Buffer.from('{}'));denied(()=>focusedWorkspaceCiSourceClosure(wrongLock.readSource));
});
test('focused current exact request matrix rejects omitted extra reordered and altered fresh-context facts',()=>{
 for(const edit of [r=>{r.requests.pop();},r=>{r.requests.push(clone(r.requests[0]));},r=>{[r.requests[0],r.requests[1]]=[r.requests[1],r.requests[0]];},r=>{const row=r.requests.find(row=>row.mode.startsWith('continuity-'));row.method='POST';},r=>{const row=r.requests.find(row=>row.mode.startsWith('continuity-'));row.projectId='foreign-project';},r=>{const row=r.requests.find(row=>Object.hasOwn(row,'responseStatus'));row.responseStatus=201;},r=>{r.requests[0].unexpectedScope='foreign';}]){const f=fixture();edit(f.raw);f.reseal();denied(f.validate);}
});
test('focused current wizard unknown references require exact fields distinct UUIDs images and explicit final steps',()=>{
 const wizard=raw=>raw.requests.filter(row=>row.mode==='wizard'&&row.method==='POST');
 for(const edit of [r=>{delete wizard(r)[0].operationId;},r=>{wizard(r)[0].operationId='00000000-0000-0000-0000-000000000001';},r=>{wizard(r)[1].operationId=wizard(r)[0].operationId;},r=>{wizard(r)[0].recoveryReferenceSha256='invalid';},r=>{wizard(r)[1].recoveryReferenceSha256=wizard(r)[0].recoveryReferenceSha256;},r=>{wizard(r)[0].syntheticImageSha256.pop();},r=>{wizard(r)[0].syntheticImageSha256[1]=wizard(r)[0].syntheticImageSha256[0];},r=>{wizard(r)[0].explicitFinalStep=false;},r=>{wizard(r)[0].actualRecoveryJournalReferencePreserved=false;},r=>{r.requests.find(row=>row.method==='GET').operationId='00000000-0000-4000-8000-000000000099';}]){const f=fixture();edit(f.raw);f.reseal();denied(f.validate);}
});
test('focused current screenshots preserve exact names geometry bytes and compact receipt viewport fit',()=>{
 for(const edit of [r=>{r.screenshots.pop();},r=>{r.screenshots[0]=clone(r.screenshots[1]);},r=>{r.screenshots[0].geometry.width=999;},r=>{r.screenshots[0].geometry.height=0;},r=>{r.screenshots[0].geometry.identityActionTop='claimed';},r=>{const row=r.screenshots.find(row=>row.path.startsWith('bootstrap-ready-'));row.geometry.scrollWidth=row.geometry.width+2;},r=>{delete r.screenshots[0].geometry;}]){const f=fixture();edit(f.raw);f.reseal();denied(f.validate);}
});
test('focused current owned cleanup and historical three plus current five executed unit suites are explicit',()=>{
 for(const edit of [f=>{f.raw.cleanup.fixtureCleanupProof.postcondition.absent=false;f.reseal();},f=>{f.raw.cleanup.fixtureCleanupProof.attempts[0].retryScheduled=true;f.reseal();},f=>{f.proof.historicalUnitSuiteCount=5;},f=>{f.proof.unitSuites=f.proof.unitSuites.slice(0,3);}]){const f=fixture();edit(f);denied(f.validate);}
});
