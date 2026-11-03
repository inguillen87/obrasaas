import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,lstatSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {observeFieldTaskRequestBody,validateFieldTaskCapturedBodies,FIELD_TASK_BODY_LIMIT} from '../scripts/lib/field-task-request-body.mjs';
import {fieldTaskPaginationUiCiOptions,fieldTaskPaginationSourceClosure} from '../scripts/verify-field-task-pagination-ui.mjs';
import {WHATSAPP_FIELD_CONTINUITY_PAGINATION_UI as historical} from '../scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs';
import {FIELD_TASK_PAGINATION_CI_VERSION,FIELD_TASK_PAGINATION_CI_KIND,FIELD_TASK_PAGINATION_CI_PROOF_ID,FIELD_TASK_PAGINATION_CI_EVIDENCE as prefix,FIELD_TASK_PAGINATION_UNIT_FILES,fieldTaskPaginationCiSourceClosure,fieldTaskPaginationCiLocalImports,fieldTaskPaginationUnitCases,parseFieldTaskPaginationTap,fieldTaskPaginationCurrentMetadata,validateFieldTaskPaginationCi,FIELD_TASK_PAGINATION_RAW2_COMMAND_GROUPS,validateFieldTaskPaginationRequests} from '../scripts/verify-field-task-pagination-ci.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex'),head='a'.repeat(40),tree='b'.repeat(40);
const identity={repository:'inguillen87/obrasaas',workflow:'.github/workflows/workspace-acceptance.yml',runId:42,runAttempt:1,event:'workflow_dispatch',job:'field'};
const environment={CI:'true',GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:identity.repository,GITHUB_JOB:'field',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/operations/synthetic-ci-unit',GITHUB_WORKFLOW_REF:'inguillen87/obrasaas/.github/workflows/workspace-acceptance.yml@refs/heads/operations/synthetic-ci-unit',GITHUB_SHA:head,GITHUB_RUN_ID:'42',GITHUB_RUN_ATTEMPT:'1'};
const denied=run=>assert.throws(run,{code:'FIELD_TASK_PAGINATION_CI_REJECTED'});

// A pure shadow exercises the acceptor. It never emits or rewrites evidence,
// executes a browser or claims that this synthetic identity was a real CI run.
function fixture(){
 const overrides=new Map(),evidence=new Map(),readSource=file=>{if(overrides.has(file))return overrides.get(file);return existsSync(file)&&lstatSync(file).isFile()?readFileSync(file):null;},refs=files=>files.map(path=>({path,sha256:sha(readSource(path))}));
 const current=fieldTaskPaginationCurrentMetadata(readSource),sourceFiles=fieldTaskPaginationCiSourceClosure(readSource),spec={id:FIELD_TASK_PAGINATION_CI_PROOF_ID,lane:'field',blockId:65,path:prefix+'current-ci.json',kind:FIELD_TASK_PAGINATION_CI_KIND,producer:'scripts/verify-field-task-pagination-ci.mjs',producerSha256:sha(readSource('scripts/verify-field-task-pagination-ci.mjs')),sourceFiles,checkNames:[...current.checkNames]};
 const requestGroup=new Map();current.commandEqualityGroups.forEach((group,index)=>group.forEach(position=>requestGroup.set(position,index)));
 const requestBodies=[];let bodySequence=0;
 const requests=current.requestMatrix.map((row,index)=>{const value=structuredClone(row);if(row.method==='POST'){const group=requestGroup.get(index);value.operationId='00000000-0000-4000-8000-'+String(group+1).padStart(12,'0');const command={operationId:value.operationId,projectId:'project-page-fixture',scope:'a'.repeat(64)},capture=syntheticCapturedBody(command,row.mode==='evidence'),file='request-body-'+(++bodySequence)+'.bin';value.bodySha256=sha(capture.body);evidence.set(prefix+'run-synthetic/'+file,capture.body);requestBodies.push({requestIndex:index,path:file,contentType:capture.contentType,bytes:capture.body.length,sha256:value.bodySha256});}return value;});
 const closure=fieldTaskPaginationSourceClosure(readSource),rawFiles=[...new Set([...closure.files,'package.json','package-lock.json','scripts/verify-field-task-pagination-ui.mjs','scripts/lib/owned-fixture-cleanup.mjs','scripts/lib/field-task-request-body.mjs'])].sort();
 const raw={version:current.rawVersion,status:'PASS',sourceState:'EXACT_CI_SOURCE',trackedClean:true,ciRun:structuredClone(identity),sourceRevision:head,sourceTree:tree,checkedAt:'2026-10-17T00:00:01.000Z',sourceManifest:refs(rawFiles),sourceBytesUnchanged:true,externalImports:closure.externalImports,widths:[320,390,1440],checks:[...current.checkNames],totalCheckCount:33,requests,requestBodies,errors:[],screenshots:[],mediaActions:[320,390,1440].map(width=>({width,buttons:current.mediaActionLabels.map(label=>({label,width:100,height:44,words:label.split(' ').map(word=>({word,lineRects:1}))}))})),actualConsumerComponentsMounted:true,productionPagerFactoryReused:true,pagingActivatedWithKeyboard:true,syntheticOnly:true,providerCalls:0,productionDataTouched:false,humanAccepted:false,posts:current.postCount,cleanup:{browserClosed:true,serverClosed:true,gracefulCloseAcknowledged:true,fixtureRemoved:true,fixtureCleanupProof:{fixtureRemoved:true,attempts:[{attempt:1,phase:'POSTCONDITION',postcondition:'ABSENT',removalAttempted:true,retryScheduled:false,rmCompleted:true}],postcondition:{absent:true}}}};
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

// The selector always reads the actual on-disk contract and source files. Only
// browser/process evidence below is synthetic; no CI or provider claim follows.
test('current raw3 binary protocol retains the raw2 request matrix and nine pending inventory reads',()=>{
 const read=file=>existsSync(file)&&lstatSync(file).isFile()?readFileSync(file):null,current=fieldTaskPaginationCurrentMetadata(read);
 assert.equal(current.rawVersion,3);assert.equal(current.requestMatrix.length,108);assert.equal(current.postCount,9);assert.equal(current.checkNames.length,33);
 assert.equal(historical.rawVersion,1);assert.equal(historical.requestMatrix.length,99);assert.deepEqual(current.checkNames,historical.checkNames);
 const positions=[[9,10],[22,23],[35,36],[48,49],[61,62],[74,75],[84,85],[94,95],[104,105]];
 assert.equal(positions.length,9);for(const[base,pending]of positions){const a=current.requestMatrix[base],b=current.requestMatrix[pending];assert.equal(a.method,'GET');assert.equal(a.mode,'consumption');assert.equal(a.path,'/api/identity/field-operations');assert.equal(a.inventoryFilter,null);assert.equal(b.inventoryFilter,'PENDING');assert.deepEqual(Object.keys(a),['width','mode','path','method','afterTask','inventoryFilter','responseStatus']);assert.deepEqual(Object.keys(b),Object.keys(a));assert.deepEqual({...b,inventoryFilter:null},a);assert.equal(pending,base+1);}
 assert.equal(current.requestMatrix.filter(row=>row.inventoryFilter==='PENDING').length,9);assert.equal(current.requestMatrix.filter(row=>Object.hasOwn(row,'inventoryFilter')).length,18);
 assert.deepEqual(FIELD_TASK_PAGINATION_RAW2_COMMAND_GROUPS,[[80,90,100],[83],[87],[93],[97],[103],[107]]);assert.deepEqual(current.commandEqualityGroups,[[80],[83],[87],[90],[93],[97],[100],[103],[107]]);
 assert.deepEqual(current.requestMatrix.filter(row=>row.method==='POST'),historical.requestMatrix.filter(row=>row.method==='POST'));
 assert.ok(Object.isFrozen(current)&&Object.isFrozen(current.requestMatrix)&&current.requestMatrix.every(Object.isFrozen)&&Object.isFrozen(current.commandEqualityGroups)&&current.commandEqualityGroups.every(Object.isFrozen));
});

test('raw1 missing pending duplicate swapped filtered and extra inventory observations cannot certify current raw3',()=>{
 const pending=[10,23,36,49,62,75,85,95,105];
 for(const edit of [r=>{r.version=1;},r=>{r.requests=r.requests.filter(row=>row.inventoryFilter!=='PENDING').map(row=>{delete row.inventoryFilter;return row;});},r=>{delete r.requests[pending[0]].inventoryFilter;},r=>{r.requests.splice(pending[0],1);},r=>{r.requests.splice(pending[0],1,structuredClone(r.requests[pending[0]-1]));},r=>{[r.requests[pending[0]-1],r.requests[pending[0]]]=[r.requests[pending[0]],r.requests[pending[0]-1]];},r=>{[r.requests[pending[0]],r.requests[pending[1]]]=[r.requests[pending[1]],r.requests[pending[0]]];},r=>{r.requests.push(structuredClone(r.requests[pending[0]]));}]){const value=fixture();edit(value.raw);value.reseal();denied(value.validate);}
});

test('current pagination selection rejects changed producer contract missing sources and producer substitution',()=>{
 const read=file=>existsSync(file)&&lstatSync(file).isFile()?readFileSync(file):null,file='scripts/verify-field-task-pagination-ui.mjs',contract='.github/workspace-acceptance-contract.json';
 assert.equal(fieldTaskPaginationCurrentMetadata(read).rawVersion,3);
 for(const target of [file,contract]){denied(()=>fieldTaskPaginationCurrentMetadata(name=>name===target?Buffer.from('export const unrelated=true;'):read(name)));denied(()=>fieldTaskPaginationCurrentMetadata(name=>name===target?null:read(name)));}
 const original=read(file);denied(()=>fieldTaskPaginationCurrentMetadata(name=>name===file?Buffer.concat([original,Buffer.from('\n// unreviewed producer')]):read(name)));
 const altered=JSON.parse(read(contract)),row=altered.planBudgetCurrentRevision.ownRuntimeDiagnosticAdvance.sourceChanges.find(row=>row.path===file);assert.ok(row);row.currentSha256='f'.repeat(64);
 denied(()=>fieldTaskPaginationCurrentMetadata(name=>name===contract?Buffer.from(JSON.stringify(altered)):read(name)));
});

// Measure the ordinary reader schedule first, then alter only the final RAW
// read in a negative call. LF-equivalent source and JSON-equivalent contract
// bytes must still fail the independent final RAW equality fence.
test('current pagination source selection rechecks exact RAW producer and contract bytes after authentication',()=>{
 const source='scripts/verify-field-task-pagination-ui.mjs',contract='.github/workspace-acceptance-contract.json',read=file=>existsSync(file)&&lstatSync(file).isFile()?readFileSync(file):null,counts=new Map();
 const counted=file=>{counts.set(file,(counts.get(file)||0)+1);return read(file);};assert.equal(fieldTaskPaginationCurrentMetadata(counted).rawVersion,3);
 for(const target of [source,contract]){const original=read(target),changed=target===contract?Buffer.concat([original,Buffer.from('\n')]):Buffer.from(original.toString().includes('\r\n')?original.toString().replaceAll('\r\n','\n'):original.toString().replaceAll('\n','\r\n'));assert.ok(!original.equals(changed));const seen=new Map(),last=counts.get(target);assert.ok(last>1);
  denied(()=>fieldTaskPaginationCurrentMetadata(file=>{const count=(seen.get(file)||0)+1;seen.set(file,count);return file===target&&count===last?changed:read(file);}));assert.equal(seen.get(target),last);
 }
});

// Pure binary fixtures exercise the closed capture acceptor, never a browser.
function syntheticCapturedBody(command,multipart=false){
 if(!multipart)return{body:Buffer.from(JSON.stringify(command)),contentType:'application/json'};
 const boundary='SyntheticFieldTaskBoundary',chunks=[];for(const[key,value]of Object.entries(command))chunks.push(Buffer.from('--'+boundary+'\r\nContent-Disposition: form-data; name="'+key+'"\r\n\r\n'+value+'\r\n'));
 chunks.push(Buffer.from('--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="synthetic.png"\r\nContent-Type: image/png\r\n\r\n'),Buffer.from([137,80,78,71,0,255,10,13]),Buffer.from('\r\n--'+boundary+'--\r\n'));return{body:Buffer.concat(chunks),contentType:'multipart/form-data; boundary='+boundary};
}
test('observed HTTP binary multipart preserves nonUTF8 file bytes and canonical UUID',()=>{
 const command={operationId:'00000000-0000-4000-8000-000000000001',projectId:'project-page-fixture',scope:'a'.repeat(64)},capture=syntheticCapturedBody(command,true),observed=observeFieldTaskRequestBody(capture.body,{path:'/api/identity/field-media',contentType:capture.contentType});assert.equal(observed.operationId,command.operationId);assert.equal(observed.bodySha256,sha(capture.body));assert.equal(observed.file.sha256,sha(Buffer.from([137,80,78,71,0,255,10,13])));assert.notEqual(sha(Buffer.from(capture.body.toString('utf8'))),observed.bodySha256);
 const json=syntheticCapturedBody(command);assert.equal(observeFieldTaskRequestBody(json.body,{path:'/api/identity/field-operations',contentType:json.contentType}).operationId,command.operationId);
});
test('HTTP body observer rejects missing duplicate malformed oversized and wrong-content-type commands',()=>{
 const command={operationId:'00000000-0000-4000-8000-000000000001',projectId:'project-page-fixture',scope:'a'.repeat(64)},capture=syntheticCapturedBody(command,true),options={path:'/api/identity/field-media',contentType:capture.contentType};
 const missing=syntheticCapturedBody({...command,operationId:''},true),duplicate=Buffer.from(capture.body.toString('latin1').replace('--SyntheticFieldTaskBoundary\r\n','--SyntheticFieldTaskBoundary\r\nContent-Disposition: form-data; name="operationId"\r\n\r\n'+command.operationId+'\r\n--SyntheticFieldTaskBoundary\r\n'),'latin1');
 for(const body of [Buffer.alloc(0),Buffer.alloc(FIELD_TASK_BODY_LIMIT+1),missing.body,duplicate,capture.body.subarray(0,capture.body.length-10)])assert.throws(()=>observeFieldTaskRequestBody(body,options));
 assert.throws(()=>observeFieldTaskRequestBody(capture.body,{...options,contentType:'text/plain'}));assert.throws(()=>observeFieldTaskRequestBody(capture.body,{...options,path:'/api/identity/foreign'}));assert.throws(()=>observeFieldTaskRequestBody(capture.body,{...options,contentType:'multipart/form-data; boundary=foreign'}));
 const duplicated=Buffer.from('{"operationId":"foreign",'+JSON.stringify(command).slice(1));assert.throws(()=>observeFieldTaskRequestBody(duplicated,{path:'/api/identity/field-operations',contentType:'application/json'}));
});
test('raw3 independent binary captures reject missing substituted reordered and changed body or UUID',()=>{
 for(const edit of [f=>{f.raw.requestBodies.pop();},f=>{delete f.raw.requestBodies;},f=>{f.raw.requestBodies[0].requestIndex++;},f=>{f.raw.requestBodies[0].path='../foreign.bin';},f=>{f.raw.requestBodies[0].sha256='f'.repeat(64);},f=>{f.raw.requests.find(row=>row.method==='POST').operationId='00000000-0000-4000-8000-000000000099';},f=>{const capture=f.raw.requestBodies[0];f.evidence.set(prefix+'run-synthetic/'+capture.path,Buffer.from('substituted'));},f=>{[f.raw.requestBodies[0],f.raw.requestBodies[1]]=[f.raw.requestBodies[1],f.raw.requestBodies[0]];},f=>{f.raw.version=2;}]){const value=fixture();edit(value);value.reseal();denied(value.validate);}
 const valid=fixture();assert.deepEqual(validateFieldTaskCapturedBodies(valid.raw,{directory:prefix+'run-synthetic',readEvidence:file=>valid.evidence.get(file)}),{capturedBodies:9,exactBinaryBytesRehashed:true});
});

test('raw3 independent browser contexts cannot share an operation UUID even with internally valid body captures',()=>{
 const value=fixture(),first=value.raw.requestBodies[0],other=value.raw.requestBodies[3],left=value.raw.requests[first.requestIndex],right=value.raw.requests[other.requestIndex],path=prefix+'run-synthetic/'+other.path,body=value.evidence.get(path),needle=Buffer.from(right.operationId),offset=body.indexOf(needle);assert.ok(offset>=0);assert.equal(body.indexOf(needle,offset+needle.length),-1);const replacement=Buffer.concat([body.subarray(0,offset),Buffer.from(left.operationId),body.subarray(offset+needle.length)]);right.operationId=left.operationId;right.bodySha256=sha(replacement);other.sha256=right.bodySha256;other.bytes=replacement.length;value.evidence.set(path,replacement);assert.equal(observeFieldTaskRequestBody(replacement,{path:right.path,contentType:other.contentType}).operationId,left.operationId);value.reseal();denied(value.validate);
});
test('a genuinely declared retry group still requires the same operation UUID and exact observed body hash',()=>{
 const post={width:390,mode:'progress',path:'/api/identity/field-operations',method:'POST',afterTask:null,responseStatus:503},current={requestMatrix:[structuredClone(post),structuredClone(post)],commandEqualityGroups:[[0,1]]},command={...post,operationId:'00000000-0000-4000-8000-000000000001',bodySha256:sha(Buffer.from('identical actual test body'))},requests=[structuredClone(command),structuredClone(command)];assert.doesNotThrow(()=>validateFieldTaskPaginationRequests(requests,current));
 for(const edit of [rows=>{rows[1].operationId='00000000-0000-4000-8000-000000000002';},rows=>{rows[1].bodySha256=sha(Buffer.from('changed actual test body'));}]){const changed=structuredClone(requests);edit(changed);denied(()=>validateFieldTaskPaginationRequests(changed,current));}
});
