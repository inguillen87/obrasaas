import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,lstatSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fieldTaskPaginationUiCiOptions,fieldTaskPaginationSourceClosure} from '../scripts/verify-field-task-pagination-ui.mjs';
import {WHATSAPP_FIELD_CONTINUITY_PAGINATION_UI as current} from '../scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs';
import {FIELD_TASK_PAGINATION_CI_VERSION,FIELD_TASK_PAGINATION_CI_KIND,FIELD_TASK_PAGINATION_CI_PROOF_ID,FIELD_TASK_PAGINATION_CI_EVIDENCE as prefix,FIELD_TASK_PAGINATION_UNIT_FILES,fieldTaskPaginationCiSourceClosure,fieldTaskPaginationCiLocalImports,fieldTaskPaginationUnitCases,parseFieldTaskPaginationTap,validateFieldTaskPaginationCi} from '../scripts/verify-field-task-pagination-ci.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex'),head='a'.repeat(40),tree='b'.repeat(40);
const identity={repository:'inguillen87/obrasaas',workflow:'.github/workflows/workspace-acceptance.yml',runId:42,runAttempt:1,event:'workflow_dispatch',job:'field'};
const environment={CI:'true',GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:identity.repository,GITHUB_JOB:'field',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/operations/synthetic-ci-unit',GITHUB_WORKFLOW_REF:'inguillen87/obrasaas/.github/workflows/workspace-acceptance.yml@refs/heads/operations/synthetic-ci-unit',GITHUB_SHA:head,GITHUB_RUN_ID:'42',GITHUB_RUN_ATTEMPT:'1'};
const denied=run=>assert.throws(run,{code:'FIELD_TASK_PAGINATION_CI_REJECTED'});

// A pure shadow exercises the acceptor. It never emits or rewrites evidence,
// executes a browser or claims that this synthetic identity was a real CI run.
function fixture(){
 const overrides=new Map(),evidence=new Map(),readSource=file=>{if(overrides.has(file))return overrides.get(file);return existsSync(file)&&lstatSync(file).isFile()?readFileSync(file):null;},refs=files=>files.map(path=>({path,sha256:sha(readSource(path))}));
 const sourceFiles=fieldTaskPaginationCiSourceClosure(readSource),spec={id:FIELD_TASK_PAGINATION_CI_PROOF_ID,lane:'field',blockId:65,path:prefix+'current-ci.json',kind:FIELD_TASK_PAGINATION_CI_KIND,producer:'scripts/verify-field-task-pagination-ci.mjs',producerSha256:sha(readSource('scripts/verify-field-task-pagination-ci.mjs')),sourceFiles,checkNames:[...current.checkNames]};
 const requestGroup=new Map();current.commandEqualityGroups.forEach((group,index)=>group.forEach(position=>requestGroup.set(position,index)));
 const requests=current.requestMatrix.map((row,index)=>{const value=structuredClone(row);if(row.method==='POST'){const group=requestGroup.get(index);value.operationId='00000000-0000-4000-8000-'+String(group+1).padStart(12,'0');value.bodySha256=sha('synthetic exact body '+group);}return value;});
 const closure=fieldTaskPaginationSourceClosure(readSource),rawFiles=[...new Set([...closure.files,'package.json','package-lock.json','scripts/verify-field-task-pagination-ui.mjs','scripts/lib/owned-fixture-cleanup.mjs'])].sort();
 const raw={version:1,status:'PASS',sourceState:'EXACT_CI_SOURCE',trackedClean:true,ciRun:structuredClone(identity),sourceRevision:head,sourceTree:tree,checkedAt:'2026-10-17T00:00:01.000Z',sourceManifest:refs(rawFiles),sourceBytesUnchanged:true,externalImports:closure.externalImports,widths:[320,390,1440],checks:[...current.checkNames],totalCheckCount:33,requests,errors:[],screenshots:[],mediaActions:[320,390,1440].map(width=>({width,buttons:current.mediaActionLabels.map(label=>({label,width:100,height:44,words:label.split(' ').map(word=>({word,lineRects:1}))}))})),actualConsumerComponentsMounted:true,productionPagerFactoryReused:true,pagingActivatedWithKeyboard:true,syntheticOnly:true,providerCalls:0,productionDataTouched:false,humanAccepted:false,posts:current.postCount,cleanup:{browserClosed:true,serverClosed:true,gracefulCloseAcknowledged:true,fixtureRemoved:true,fixtureCleanupProof:{fixtureRemoved:true,attempts:[{attempt:1,phase:'POSTCONDITION',postcondition:'ABSENT',removalAttempted:true,retryScheduled:false,rmCompleted:true}],postcondition:{absent:true}}}};
 const rawPath=prefix+'run-synthetic/browser.json';for(const[index,name]of current.screenshotNames.entries()){const value=Buffer.from('synthetic screenshot bytes '+index),width=Number(/-(320|390|1440)\.png$/.exec(name)[1]);evidence.set(path.posix.dirname(rawPath)+'/'+name,value);raw.screenshots.push({path:name,sha256:sha(value),geometry:{width,scrollWidth:width}});}
 const unitSuites=FIELD_TASK_PAGINATION_UNIT_FILES.map((file,index)=>{const names=fieldTaskPaginationUnitCases(readSource,file),value=Buffer.from(['TAP version 13',...names.map((name,i)=>'ok '+(i+1)+' - '+name),'1..'+names.length,'# tests '+names.length,'# pass '+names.length,'# fail 0','# cancelled 0','# skipped 0','# todo 0',''].join('\n')),filePath=prefix+'unit-'+index+'.tap';evidence.set(filePath,value);return{file,sourceSha256:sha(readSource(file)),exitCode:0,tap:{path:filePath,bytes:value.length,sha256:sha(value)},result:parseFieldTaskPaginationTap(value)};});
 const logs={};for(const key of ['stdout','stderr']){const value=Buffer.from(key==='stdout'?'synthetic process observation\n':''),file=prefix+'browser.'+key+'.log';evidence.set(file,value);logs[key]={path:file,bytes:value.length,sha256:sha(value)};}
 const proof={version:FIELD_TASK_PAGINATION_CI_VERSION,status:'PASS',sourceRevision:head,sourceTree:tree,sourceState:'EXACT_CI_SOURCE',trackedClean:true,ciRun:structuredClone(identity),harnessSha256:spec.producerSha256,sourceManifest:refs(sourceFiles),checks:[...current.checkNames],rawBrowser:null,browserExecution:{exitCode:0,startedAt:'2026-10-17T00:00:00.000Z',finishedAt:'2026-10-17T00:00:02.000Z',...logs},unitSuites,providerCalls:0,productionDataTouched:false,humanAccepted:false};
 const reseal=()=>{const value=Buffer.from(JSON.stringify(raw));evidence.set(rawPath,value);proof.rawBrowser={path:rawPath,bytes:value.length,sha256:sha(value)};const stdout=Buffer.from(JSON.stringify({status:raw.status,totalCheckCount:raw.totalCheckCount,target:'/synthetic-workspace/'+rawPath,sha256:sha(value),cleanup:raw.cleanup})+'\n');evidence.set(proof.browserExecution.stdout.path,stdout);proof.browserExecution.stdout.bytes=stdout.length;proof.browserExecution.stdout.sha256=sha(stdout);};reseal();
 const validate=()=>validateFieldTaskPaginationCi(proof,{expectedHead:head,expectedTree:tree,readSource,readEvidence:file=>evidence.get(file)||null,spec,runId:42,runAttempt:1});return{raw,proof,spec,evidence,overrides,readSource,reseal,validate};
}

test('pagination CI entry requires explicit actual workflow lane source ref run and attempt context',()=>{
 assert.equal(fieldTaskPaginationUiCiOptions([],{environment:{}}).ci,false);const valid=fieldTaskPaginationUiCiOptions(['--ci','--expected-head',head],{environment});assert.equal(valid.ci,true);assert.deepEqual(valid.ciRun,identity);
 for(const edit of [e=>{delete e.CI;},e=>{e.GITHUB_ACTIONS='false';},e=>{e.GITHUB_REPOSITORY='foreign/repo';},e=>{e.GITHUB_JOB='workspace-ui';},e=>{e.GITHUB_EVENT_NAME='pull_request_target';},e=>{e.GITHUB_SHA='c'.repeat(40);},e=>{e.GITHUB_RUN_ID='042';},e=>{e.GITHUB_RUN_ATTEMPT='0';},e=>{e.GITHUB_WORKFLOW_REF+='-foreign';},e=>{e.GITHUB_REF='refs/heads/../foreign';},e=>{e.VERCEL='1';}]){const changed={...environment};edit(changed);assert.throws(()=>fieldTaskPaginationUiCiOptions(['--ci','--expected-head',head],{environment:changed}));}
 for(const args of [[],['--expected-head',head],['--ci','--expected-head',head,'--allow-local'],['--ci','--expected-head','f'.repeat(39)]])assert.throws(()=>fieldTaskPaginationUiCiOptions(args,{environment}));
});

test('complete pagination shadow binds all33 real-consumer observations source cases and original raw bytes',()=>{
 const value=fixture(),result=value.validate();assert.equal(result.status,'PASS');assert.equal(result.checks,33);assert.equal(result.originalBrowserRewritten,false);assert.equal(result.unitSuites,4);assert.equal(result.providerOrHumanAcceptance,false);assert.equal(value.raw.posts,9);
});

test('local old source wrong run foreign attempt and shortened matrices cannot certify current pagination',()=>{
 for(const edit of [r=>{r.sourceState='LOCAL_REVIEW_SOURCE';},r=>{delete r.ciRun;},r=>{r.ciRun.runId=43;},r=>{r.ciRun.runAttempt=2;},r=>{r.sourceRevision='c'.repeat(40);},r=>{r.sourceTree='c'.repeat(40);},r=>{r.trackedClean=false;},r=>{r.checks.pop();r.totalCheckCount--;},r=>{r.checks=r.checks.slice(0,19);r.totalCheckCount=19;},r=>{r.widths=[390,1440];}]){const value=fixture();edit(value.raw);value.reseal();denied(value.validate);}
 const value=fixture();value.proof.ciRun.event='pull_request';denied(value.validate);
});

test('missing duplicate substituted or changed current dependencies are rejected independently in both manifests',()=>{
 for(const edit of [f=>{f.proof.sourceManifest.pop();},f=>{f.proof.sourceManifest[0].sha256='e'.repeat(64);},f=>{f.spec.sourceFiles.pop();},f=>{f.raw.sourceManifest.pop();f.reseal();},f=>{f.raw.sourceManifest.push(structuredClone(f.raw.sourceManifest[0]));f.reseal();},f=>{f.overrides.set('src/app/(identity)/cuenta/workspace-task-page.mjs',Buffer.from('export const unrelated=true;'));}]){const value=fixture();edit(value);denied(value.validate);}
});

test('the selector source transform is restricted to its exact unit origin compiler shape and lock',()=>{
 const value=fixture(),file='tests/production-worksite-task-selector.test.mjs',original=value.readSource(file),imports=fieldTaskPaginationCiLocalImports(original,file,value.readSource);assert.ok(imports.includes('../src/app/(identity)/cuenta/worksite-task-selector.js'));assert.ok(imports.includes('next/dist/build/swc/index.js'));
 denied(()=>fieldTaskPaginationCiLocalImports(original,'tests/foreign-selector.test.mjs',value.readSource));
 for(const[before,after]of [['../src/app/(identity)/cuenta/worksite-task-selector.js','../src/app/(identity)/cuenta/foreign.js'],['next/dist/build/swc/index.js','next/dist/build/swc/foreign.js'],['const compiled=await transform(','const compiled=await unrelated('],['Buffer.from(compiled.code)','Buffer.from(source)'],["import.meta.resolve('react')","import.meta.resolve('foreign-react')"],['data:text/javascript;base64,','https://example.invalid/module/']]){assert.ok(original.toString().includes(before));denied(()=>fieldTaskPaginationCiLocalImports(Buffer.from(original.toString().replace(before,after)),file,value.readSource));}
 denied(()=>fieldTaskPaginationCiLocalImports(Buffer.from('await import(specifier);'),'tests/foreign-selector.test.mjs',value.readSource));value.overrides.set('package-lock.json',Buffer.from('{}'));denied(()=>fieldTaskPaginationCiSourceClosure(value.readSource));
});

test('cursor method status request order command UUID and exact unknown body are mandatory observations',()=>{
 for(const edit of [r=>{r.requests.pop();},r=>{r.requests.push(structuredClone(r.requests[0]));},r=>{[r.requests[0],r.requests[1]]=[r.requests[1],r.requests[0]];},r=>{r.requests.find(row=>row.afterTask).afterTask='foreign-cursor';},r=>{r.requests.find(row=>row.method==='GET').method='POST';},r=>{r.requests.find(row=>row.method==='POST').operationId='invalid';},r=>{r.requests.find(row=>row.method==='POST').bodySha256='invalid';},r=>{r.posts=0;},r=>{r.requests[0].extraAuthority=true;}]){const value=fixture();edit(value.raw);value.reseal();denied(value.validate);}
});

test('actual browser process successful exit original logs and completion window cannot be forged by metadata',()=>{
 for(const edit of [f=>{f.proof.browserExecution.exitCode=1;},f=>{f.proof.browserExecution.startedAt='2026-10-17T00:00:03.000Z';},f=>{f.proof.browserExecution.finishedAt='2026-10-16T23:59:59.000Z';},f=>{f.evidence.set(f.proof.browserExecution.stdout.path,Buffer.from('changed output'));},f=>{f.raw.checkedAt='invalid';f.reseal();},f=>{f.proof.rawBrowser.path='../foreign/browser.json';}]){const value=fixture();edit(value);denied(value.validate);}
});

test('screenshots image-action accessibility and every owned cleanup postcondition remain required',()=>{
 for(const edit of [r=>{r.screenshots.pop();},r=>{r.screenshots[0].geometry.scrollWidth+=2;},r=>{r.mediaActions.pop();},r=>{r.mediaActions[0].buttons[0].height=1;},r=>{r.mediaActions[0].buttons[0].words[0].lineRects=2;},r=>{r.cleanup.browserClosed=false;},r=>{r.cleanup.fixtureCleanupProof.postcondition.absent=false;},r=>{r.cleanup.fixtureCleanupProof.attempts[0].retryScheduled=true;}]){const value=fixture();edit(value.raw);value.reseal();denied(value.validate);}
 const value=fixture();value.evidence.delete(path.posix.dirname(value.proof.rawBrowser.path)+'/'+value.raw.screenshots[0].path);denied(value.validate);
});

test('unit failures omissions shortened TAP skips duplicates and changed source case lists cannot pass',()=>{
 for(const edit of [f=>{f.proof.unitSuites.pop();},f=>{f.proof.unitSuites[0].exitCode=1;},f=>{f.proof.unitSuites[0].sourceSha256='e'.repeat(64);},f=>{f.evidence.set(f.proof.unitSuites[0].tap.path,Buffer.from('changed TAP'));}]){const value=fixture();edit(value);denied(value.validate);}
 for(const value of ['# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 1\n# todo 0\n','ok 1 - omitted-summary\n','# tests 1\n# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n'])denied(()=>parseFieldTaskPaginationTap(value));
});

test('provider production human acceptance malformed raw and extra authority metadata are always rejected',()=>{
 for(const edit of [r=>{r.providerCalls=1;},r=>{r.productionDataTouched=true;},r=>{r.humanAccepted=true;},r=>{r.actualConsumerComponentsMounted=false;},r=>{r.productionPagerFactoryReused=false;},r=>{r.pagingActivatedWithKeyboard=false;},r=>{r.syntheticOnly=false;},r=>{r.realAuthorityAccepted=true;}]){const value=fixture();edit(value.raw);value.reseal();denied(value.validate);}
 const value=fixture();value.proof.humanAccepted=true;denied(value.validate);for(const text of ['null','{malformed']){const f=fixture(),bytes=Buffer.from(text);f.evidence.set(f.proof.rawBrowser.path,bytes);f.proof.rawBrowser.bytes=bytes.length;f.proof.rawBrowser.sha256=sha(bytes);denied(f.validate);}
});
