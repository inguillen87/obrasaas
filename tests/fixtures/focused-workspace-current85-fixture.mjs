// UNIT MODEL ONLY. No browser, CI job, Git mutation, provider, personal data or environment changes.
// This fixture never reads a previously issued browser JSON or writes an evidence file.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {CURRENT85_SPEC,CURRENT85_CHECK_NAMES,CURRENT85_UNIT_FILES} from '../../scripts/lib/focused-workspace-current85-spec.mjs';
import {CURRENT85_CLAIMS,deriveCurrent85SourceContract} from '../../scripts/lib/focused-workspace-current85-evidence.mjs';
import {CURRENT85_CI_VERSION,current85Descriptor,validateFocusedWorkspaceCurrent85Ci} from '../../scripts/verify-focused-workspace-current85-ci.mjs';
import {focusedWorkspaceUnitCases,parseFocusedWorkspaceTap} from '../../scripts/verify-focused-workspace-ci.mjs';

const repository=fileURLToPath(new URL('../../',import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
const output='.vercel/private/focused-workspace-ui-evidence/';
const rawPath=output+'run-unit-synthetic/browser.json';
const unitHead='a'.repeat(40),unitTree='b'.repeat(40);
let blueprint;

function crc32(bytes){let value=0xffffffff;for(const b of bytes){value^=b;for(let i=0;i<8;i++)value=(value>>>1)^((value&1)?0xedb88320:0);}return(value^0xffffffff)>>>0;}
function pngChunk(type,data){const name=Buffer.from(type),result=Buffer.alloc(12+data.length);result.writeUInt32BE(data.length,0);name.copy(result,4);data.copy(result,8);result.writeUInt32BE(crc32(Buffer.concat([name,data])),8+data.length);return result;}
function syntheticPng(width,height){const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;const pixels=Buffer.alloc((width*3+1)*height);return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk('IHDR',header),pngChunk('IDAT',deflateSync(pixels)),pngChunk('IEND',Buffer.alloc(0))]);}
function literalTap(names){return Buffer.from('TAP version 13\n'+names.map((name,i)=>'ok '+(i+1)+' - '+name+'\n').join('')+'1..'+names.length+'\n# tests '+names.length+'\n# pass '+names.length+'\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n');}
function fact(c,pathValue,projectId=null){return{width:c.width,role:c.role,mode:c.mode,path:pathValue,method:'GET',projectId};}
function projection(requests){
 const indices=[];let home=0;
 requests.forEach((r,index)=>{if(r.mode.startsWith('home-')||r.mode.startsWith('identity-'))return;if(r.mode==='navigation'&&r.path==='/api/identity/operations-status'){home++;return;}indices.push(index);});
 return{baseChecks:59,selectedRequestCount:406,selectedRequestIndices:indices,frozenRequestMatrixSha256:CURRENT85_SPEC.frozenHistory.legacy59MatrixSha256Declared,navigationHomeObservedReads:home,navigationHomeSourceInitialContexts:4,navigationHomeTimerReadsHaveNoFittedExactCount:true,rawNeverRewritten:true,raw59Or77Fabricated:false};
}

function createBlueprint({sourceReader=null,head=unitHead,tree=unitTree,runId=101,runAttempt=2}={}){
 const cache=new Map();
 const readSource=file=>{
  if(typeof file!=='string'||file.includes('\\')||file.includes(':')||file.includes('\0')||path.posix.isAbsolute(file)||path.posix.normalize(file)!==file||file.split('/').includes('..'))return null;
  if(sourceReader!==null){const value=sourceReader(file);if(value===null||value===undefined)return null;if(!Buffer.isBuffer(value)||!Buffer.from(value.toString('utf8')).equals(value))throw new TypeError('Explicit unit source must provide UTF8 bytes');return Buffer.from(value);}
  if(cache.has(file))return cache.get(file);
  const filename=path.join(repository,file);
  if(!fs.existsSync(filename)||!fs.lstatSync(filename).isFile())return null;
  const original=fs.readFileSync(filename),text=original.toString('utf8');
  if(!Buffer.from(text).equals(original))throw new Error('Unit source model requires UTF8 text');
  // LF conversion belongs ONLY to this synthetic Linux-text source model, never the production validator.
  const bytes=Buffer.from(text.replaceAll('\r\n','\n'));cache.set(file,bytes);return bytes;
 };
 const source=deriveCurrent85SourceContract(readSource),descriptor=current85Descriptor(readSource),evidence=new Map();
 const identity={repository:'inguillen87/obrasaas',workflow:'.github/workflows/workspace-acceptance.yml',runId,runAttempt,event:'push',job:'workspace-ui'};
 const requests=structuredClone(CURRENT85_SPEC.frozenHistory.legacy59Requests);
 let wizard=0;
 for(const row of requests)if(row.method==='POST'){
  row.operationId=wizard===0?'11111111-1111-4111-8111-111111111111':'22222222-2222-4222-8222-222222222222';
  row.explicitFinalStep=true;row.syntheticImageSha256=['a'.repeat(64),'b'.repeat(64),'c'.repeat(64)];row.actualRecoveryJournalReferencePreserved=true;row.recoveryReferenceSha256=String(++wizard).repeat(64);
 }
 for(let mount=0;mount<source.navigationInitialHomeContextsPerWidth;mount++)for(const width of source.navigationInitialHomeWidths)requests.push(fact({width,role:'ADMIN',mode:'navigation'},'/api/identity/operations-status','project-a'));
 for(const c of CURRENT85_SPEC.homeCases){
  requests.push(fact(c,'/api/identity/workspace'));
  for(let i=0;i<c.operationsStatusRequestsAsserted;i++)requests.push(fact(c,'/api/identity/operations-status',c.projectId));
  if(c.mode==='home-normal')requests.push(fact(c,source.homeQueueReadEndpoint,'project-a'));
 }
 for(const c of CURRENT85_SPEC.identityCases){requests.push(fact(c,'/api/identity/workspace'));if(c.afterExplicitChoice)requests.push(fact(c,'/api/identity/workspace',c.afterExplicitChoice.requiredWorkspaceProject));}
 const pngs=new Map(),screenshots=CURRENT85_SPEC.screenshots.rows.map(row=>{
  if(!pngs.has(row.width))pngs.set(row.width,syntheticPng(row.width,1100));
  const png=pngs.get(row.width);evidence.set(path.posix.dirname(rawPath)+'/'+row.path,png);
  return{path:row.path,sha256:hash(png),geometry:{width:row.width,height:1000,scrollWidth:row.width,identityActionTop:null}};
 });
 const raw={version:4,status:'PASS',sourceState:'EXACT_CI_SOURCE',sourceRevision:head,sourceTree:tree,trackedClean:true,checkedAt:'2026-01-01T00:00:00.000Z',widths:[390,1440],continuityWidths:[320,390,1440],historicalCheckCount:20,continuityCheckLedger:CURRENT85_CHECK_NAMES.slice(20,45),previousTotalCheckCount:45,taskPagingWidths:[320,390,1440],taskPagingCheckLedger:CURRENT85_CHECK_NAMES.slice(45,59),taskPagingFixture:source.taskPagingFixture,homeDecisionsWidths:[320,390,768,1440],homeDecisionsCheckLedger:CURRENT85_CHECK_NAMES.slice(59,79),expectedTotalCheckCount:85,bootstrapSourceManifest:source.bootstrapSourcePaths.map(file=>({path:file,sha256:hash(readSource(file))})),bootstrapExternalImports:source.bootstrapExternalImports,checks:CURRENT85_SPEC.checks.map(c=>c.rawNameRule==='exact name'?c.name:c.name+':7'),totalCheckCount:85,sourceManifest:source.sourcePaths.map(file=>({path:file,sha256:hash(readSource(file))})),sourceBytesUnchanged:true,externalImports:source.externalImports,requests,errors:[],screenshots,providerCalls:0,businessPosts:2,navigationPosts:0,productionDataTouched:false,actualAccountWorkspaceMounted:true,actualClerkOrSSRVerified:false,syntheticPixelsOnly:true,transport:source.transport,cleanup:{browserClosed:true,serverClosed:true,gracefulCloseAcknowledged:true,fixtureRemoved:true,fixtureCleanupProof:{fixtureRemoved:true,attempts:[{attempt:1,phase:'POSTCONDITION',removalAttempted:true,rmCompleted:true,postcondition:'ABSENT',retryScheduled:false}],postcondition:{absent:true}}},ciRun:identity};
 const suites=CURRENT85_UNIT_FILES.map((file,index)=>{
  const tap=literalTap(focusedWorkspaceUnitCases(readSource,file)),stderr=Buffer.alloc(0),tapPath=output+'unit85-'+index+'.tap',stderrPath=output+'unit85-'+index+'.stderr.log';evidence.set(tapPath,tap);evidence.set(stderrPath,stderr);
  return{file,sourceSha256:hash(readSource(file)),exitCode:0,tap:{path:tapPath,bytes:tap.length,sha256:hash(tap)},stderr:{path:stderrPath,bytes:0,sha256:hash(stderr)},result:parseFocusedWorkspaceTap(tap)};
 });
 const proof={version:CURRENT85_CI_VERSION,status:'PASS',sourceRevision:head,sourceTree:tree,sourceState:'EXACT_CI_SOURCE',trackedClean:true,ciRun:identity,harnessSha256:descriptor.producerSha256,sourceManifest:descriptor.sourceFiles.map(file=>({path:file,sha256:hash(readSource(file))})),checks:[...CURRENT85_CHECK_NAMES],rawBrowser:{path:rawPath,bytes:1,sha256:'0'.repeat(64)},browserExitCode:0,unitSuites:suites,claims:CURRENT85_CLAIMS,legacy59Projection:projection(raw.requests)};
 return{readSource,source,descriptor,evidence,raw,proof};
}

export function createSyntheticCurrent85Fixture(){
 if(!blueprint)blueprint=createBlueprint();
 const raw=structuredClone(blueprint.raw),proof=structuredClone(blueprint.proof),evidence=new Map(blueprint.evidence),readSource=file=>blueprint.readSource(file);
 const gitAuthority={resolveGitTree:revision=>revision===unitHead?unitTree:null,readGitBlob:(revision,file)=>revision===unitHead?readSource(file):null,readWorkingSource:file=>readSource(file)};
 const options={expectedHead:unitHead,expectedTree:unitTree,readSource,readEvidence:file=>evidence.get(file)||null,spec:structuredClone(blueprint.descriptor),runId:101,runAttempt:2,gitAuthority};
 const synchronizeRaw=()=>{const bytes=Buffer.from(JSON.stringify(raw));evidence.set(rawPath,bytes);proof.rawBrowser={path:rawPath,bytes:bytes.length,sha256:hash(bytes)};proof.legacy59Projection=projection(raw.requests);return bytes;};
 synchronizeRaw();
 return{syntheticFixture:true,fixtureBoundary:'UNIT_SCHEMA_MODEL_ONLY_NOT_ISSUED_CI_OR_BROWSER_EVIDENCE',gitAuthorityBoundary:'IN_MEMORY_GIT_MODEL_OF_PUBLIC_SOURCE_SNAPSHOTS',sourceNormalization:'LF_ONLY_IN_UNIT_MODEL',raw,proof,options,evidence,source:blueprint.source,readSource,synchronizeRaw,validate:()=>validateFocusedWorkspaceCurrent85Ci(proof,options),hash};
}

// Explicit unit-model composition. The Git snapshots are captured as test data;
// the current source and working-source readers remain live on every validation.
// This API never edits process.env, invokes Git, runs CI/browser or writes files.
export function createSyntheticCurrent85FixtureFromSource({readSource:sourceReader,expectedHead=unitHead,expectedTree=unitTree,runId=101,runAttempt=2}){
 if(typeof sourceReader!=='function'||!/^[a-f0-9]{40}$/.test(expectedHead)||!/^[a-f0-9]{40}$/.test(expectedTree)||!Number.isSafeInteger(runId)||runId<1||!Number.isSafeInteger(runAttempt)||runAttempt<1)throw new TypeError('Explicit unit source and identity model required');
 const prepared=createBlueprint({sourceReader,head:expectedHead,tree:expectedTree,runId,runAttempt});
 const raw=structuredClone(prepared.raw),proof=structuredClone(prepared.proof),evidence=new Map([...prepared.evidence].map(([file,bytes])=>[file,Buffer.from(bytes)]));
 const readSource=file=>{const bytes=sourceReader(file);return Buffer.isBuffer(bytes)?Buffer.from(bytes):null;};
 const gitSnapshots=new Map(prepared.descriptor.sourceFiles.map(file=>[file,Buffer.from(prepared.readSource(file))]));
 const gitAuthority={resolveGitTree:revision=>revision===expectedHead?expectedTree:null,readGitBlob:(revision,file)=>revision===expectedHead&&gitSnapshots.has(file)?Buffer.from(gitSnapshots.get(file)):null,readWorkingSource:file=>readSource(file)};
 const options={expectedHead,expectedTree,readSource,readEvidence:file=>evidence.has(file)?Buffer.from(evidence.get(file)):null,spec:structuredClone(prepared.descriptor),runId,runAttempt,gitAuthority};
 const synchronizeRaw=()=>{const bytes=Buffer.from(JSON.stringify(raw));evidence.set(rawPath,bytes);proof.rawBrowser={path:rawPath,bytes:bytes.length,sha256:hash(bytes)};proof.legacy59Projection=projection(raw.requests);return bytes;};
 synchronizeRaw();
 return{syntheticFixture:true,fixtureBoundary:'UNIT_SCHEMA_MODEL_ONLY_NOT_ISSUED_CI_OR_BROWSER_EVIDENCE',gitAuthorityBoundary:'EXPLICIT_IMMUTABLE_GIT_UNIT_SNAPSHOT_AND_LIVE_WORKING_READER',sourceNormalization:'CALLER_PROVIDED_UNIT_SOURCE_BYTES',raw,proof,options,evidence,source:prepared.source,readSource,synchronizeRaw,validate:()=>validateFocusedWorkspaceCurrent85Ci(proof,options),hash};
}
