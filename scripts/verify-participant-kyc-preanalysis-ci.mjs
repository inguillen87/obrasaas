import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from '@babel/parser';
import {PARTICIPANT_KYC_PREANALYSIS_CHECKS,verifyParticipantKycPreanalysisPostgres,participantPreanalysisDisposableTarget} from './verify-participant-kyc-preanalysis-postgres.mjs';
import {PARTICIPANT_PREANALYSIS_CONTRACT_PATH,PARTICIPANT_PREANALYSIS_EVIDENCE,PARTICIPANT_PREANALYSIS_PROOF_ID,PARTICIPANT_PREANALYSIS_KIND,verifyParticipantPreanalysisCurrentSources} from './lib/participant-preanalysis-current-ci-lineage.mjs';

export const PARTICIPANT_PREANALYSIS_CI_VERSION='participant-kyc-preanalysis-ci-v1';
export const PARTICIPANT_PREANALYSIS_CI_PATH=PARTICIPANT_PREANALYSIS_EVIDENCE+'current-ci.json';
const producer='scripts/verify-participant-kyc-preanalysis-ci.mjs';
const nativeProducer='scripts/verify-participant-kyc-preanalysis-postgres.mjs';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const sha=value=>createHash('sha256').update(value).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const requireProof=(ok,message)=>{if(!ok)throw Object.assign(new Error(message),{code:'PARTICIPANT_PREANALYSIS_CI_REJECTED'});};
const keys=(value,expected,label)=>requireProof(value&&same(Object.keys(value).sort(),[...expected].sort()),'Invalid '+label+' shape');
const safe=file=>typeof file==='string'&&!/[\\\x00-\x1f]/.test(file)&&!file.startsWith('/')&&file.split('/').every(part=>part&&part!=='.'&&part!=='..');
const bytes=(read,file)=>{requireProof(safe(file)&&typeof read==='function','Bound source/evidence reader required');const value=read(file);requireProof(Buffer.isBuffer(value),'Missing bound bytes: '+file);return value;};
const refs=(files,read)=>files.map(file=>{const value=bytes(read,file);return {path:file,sha256:sha(value)};});

// Native/runtime and actual unit/UI import graphs are walked independently of
// the contract's declared list. The index and previously reviewed CI validators
// are additional bound leaves, not a claim about their native execution.
export function participantPreanalysisCiSourceClosure(readSource){
 const files=new Set(['api/_biometric_core.py','package.json','package-lock.json']);
 function visit(file){
  requireProof(safe(file),'Unsafe current CI source path');if(files.has(file))return;
  const value=bytes(readSource,file);files.add(file);if(!/\.[cm]?jsx?$/.test(file))return;
  const ast=parse(value.toString('utf8'),{sourceType:'unambiguous',plugins:['jsx'],createImportExpressions:true}),imports=[];
  function walk(node){
   if(!node||typeof node!=='object')return;
   const dynamic=node.type==='ImportExpression'||node.type==='CallExpression'&&node.callee?.type==='Import';
   const ref=['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration','ImportExpression'].includes(node.type)?node.source:dynamic?node.arguments[0]:null;
   if(ref){requireProof(ref.type==='StringLiteral','Unbounded current CI source import: '+file);imports.push(ref.value);}
   for(const item of Object.values(node))if(Array.isArray(item))item.forEach(walk);else if(item&&typeof item==='object')walk(item);
  }
  walk(ast.program);
  for(const ref of imports){
   if(!ref.startsWith('.')){requireProof(!/^(?:https?:|file:|data:)/.test(ref),'Remote source import is forbidden');continue;}
   const base=path.posix.normalize(path.posix.join(path.posix.dirname(file),ref));requireProof(safe(base),'Source import escapes repository');
   const target=[base,base+'.js',base+'.mjs',base+'.css',base+'/index.js'].find(candidate=>Buffer.isBuffer(readSource(candidate)));
   requireProof(Boolean(target),'Missing current source import: '+file+' '+ref);visit(target);
  }
 }
 [nativeProducer,producer,'src/app/api/identity/participants/route.js','src/app/api/meta/customer-process/route.js','tests/production-participant-preanalysis-current-ci-lineage.test.mjs','tests/production-participant-kyc-preanalysis.test.mjs','tests/production-participant-kyc-preanalysis-view.test.mjs','src/app/(identity)/cuenta/participant-panel.js'].forEach(visit);
 const contractBytes=readSource(PARTICIPANT_PREANALYSIS_CONTRACT_PATH);
 if(Buffer.isBuffer(contractBytes)){
  const contract=JSON.parse(contractBytes);
  for(const ref of contract.participantPreanalysisCurrentRevision?.validationDeltas||[]){bytes(readSource,ref.path);files.add(ref.path);}
 }
 files.add('.github/scripts/verify-workspace-ci-parallelization.mjs');
 for(const file of files)bytes(readSource,file);
 return [...files].sort();
}

export function parseParticipantPreanalysisTap(input){
 requireProof(Buffer.isBuffer(input),'TAP bytes required');const text=input.toString('utf8');
 requireProof(input.equals(Buffer.from(text))&&!/^not ok\b/m.test(text),'Unit TAP reports failure');
 const values={};for(const key of ['tests','pass','fail','cancelled','skipped','todo']){
  const matches=[...text.matchAll(new RegExp('^# '+key+' (\\d+)\\s*$','gm'))];requireProof(matches.length===1,'One final TAP total required: '+key);values[key]=Number(matches[0][1]);
 }
 requireProof(values.tests>0&&values.pass===values.tests&&['fail','cancelled','skipped','todo'].every(key=>values[key]===0),'Every unit case must execute and pass');
 values.caseNames=[...text.matchAll(/^ok \d+ - (.+)$/gm)].map(match=>match[1]);
 requireProof(values.caseNames.length===values.tests&&new Set(values.caseNames).size===values.tests,'Unique executed unit case names required');
 return values;
}

export function validateParticipantKycPreanalysisNative(native,{readSource,nativeSourceFiles}){
 requireProof(native?.version===1&&native.status==='PASS'&&native.postgresExecuted===true&&native.failure===null,'Actual successful native PostgreSQL execution required');
 requireProof(native.completedCheckCount===PARTICIPANT_KYC_PREANALYSIS_CHECKS.length&&same(native.checks,PARTICIPANT_KYC_PREANALYSIS_CHECKS),'Every current native check must execute in order');
 requireProof(native.engine?.host==='127.0.0.1'&&[5432,6549].includes(native.engine?.port)&&native.engine.version>=170000&&native.engine.version<180000&&native.engine.database==='obrasaas_cutover_ci'&&native.engine.actor==='cutover_test'&&native.engine.role==='cutover_test','Owned local PostgreSQL17 engine required');
 requireProof(/^obrasaas_kyc_preanalysis_[a-f0-9]{32}$/.test(native.ownership?.datname)&&Number.isInteger(native.ownership?.oid)&&native.ownership.owner==='cutover_test','Owned random child database required');
 requireProof(Array.isArray(native.ownedConnectionPids)&&native.ownedConnectionPids.length>0&&native.ownedConnectionPids.every(pid=>Number.isSafeInteger(pid)&&pid>0),'Observed native connection ownership required');
 requireProof(native.providerRequests===0&&native.productionDataWritten===false&&native.realConsentOrIdentityVerified===false&&native.humanApprovalPerformed===false&&native.counts?.unexpectedNetwork===0,'Closed synthetic provider and identity boundary required');
 requireProof(same(native.sqlFailures,[])&&native.cleanup?.poolClosed===true&&native.cleanup.databaseRemoved===true&&native.cleanup.adminClosed===true&&native.cleanup.sourceBytesUnchanged===true&&native.cleanup.ownSessionsBeforeDrop===0&&!native.cleanup.failureCode,'Native cleanup and zero SQL failures required');
 requireProof(same(native.leaseFixtures,{normalServiceMs:150000,expiryOnlyFixtureMs:1000,sqlClockObservedBeforeRelease:true,productionLeaseConfigurationChanged:false}),'Original service lease and explicit expiry fixture required');
 requireProof(Array.isArray(native.lockObservations)&&native.lockObservations.some(row=>row.kind==='INITIAL_CLAIM_SERIALIZATION'&&row.canonicalWorkerLock===true&&row.postgresReportedBlockingPid===true&&Number.isInteger(row.blockerPid)&&Number.isInteger(row.waiterPid)&&row.blockerPid!==row.waiterPid),'Actual PostgreSQL lock observation required');
 requireProof(Array.isArray(nativeSourceFiles)&&nativeSourceFiles.length>0&&same(nativeSourceFiles,[...new Set(nativeSourceFiles)].sort()),'Frozen native source path set required');
 requireProof(same(native.sourceManifest?.map(row=>row.path),nativeSourceFiles),'Complete native source manifest required');
 for(const row of native.sourceManifest){keys(row,['path','bytes','sha256'],'native source');const value=bytes(readSource,row.path);requireProof(value.length===row.bytes&&sha(value)===row.sha256,'Current native source bytes differ: '+row.path);}
 // The producer uses the canonical workspace digest (SHA256 JSON serialization).
 requireProof(native.sourceDigest===sha(JSON.stringify(native.sourceManifest))&&native.harnessSha256===sha(bytes(readSource,nativeProducer)),'Original native digest and producer bytes required');
 return {nativeCheckCount:native.checks.length,nativeSourceCount:native.sourceManifest.length,providerRequests:0,realConsentOrIdentityVerified:false};
}

export function validateParticipantKycPreanalysisCi(proof,{expectedHead,expectedTree,readSource,readEvidence,spec,runId,runAttempt}){
 requireProof(/^[a-f0-9]{40}$/.test(expectedHead)&&/^[a-f0-9]{40}$/.test(expectedTree),'Exact CI commit and tree required');
 requireProof(spec?.id===PARTICIPANT_PREANALYSIS_PROOF_ID&&spec.kind===PARTICIPANT_PREANALYSIS_KIND&&spec.blockId===63&&spec.lane==='people'&&spec.producer===producer&&spec.path===PARTICIPANT_PREANALYSIS_CI_PATH,'Exact current preanalysis proof binding required');
 const contract=JSON.parse(bytes(readSource,PARTICIPANT_PREANALYSIS_CONTRACT_PATH)),revision=contract.participantPreanalysisCurrentRevision;
 verifyParticipantPreanalysisCurrentSources(contract,readSource);
 requireProof(same(contract.extension.proofs.find(row=>row.id===spec.id),spec),'Only the exact committed proof spec may be validated');
 requireProof(proof?.version===PARTICIPANT_PREANALYSIS_CI_VERSION&&proof.status==='PASS'&&proof.sourceRevision===expectedHead&&proof.sourceTree===expectedTree&&proof.sourceState==='EXACT_CI_SOURCE'&&proof.trackedClean===true,'Exact clean current CI envelope required');
 requireProof(same(proof.dirtyTrackedPaths,[])&&proof.productionDataWritten===false&&proof.providerRequests===0&&proof.realConsentOrIdentityVerified===false&&proof.humanApprovalPerformed===false,'Explicit non-production acceptance boundary required');
 keys(proof.ciRun,['repository','runId','runAttempt','event','workflow'],'CI execution');
 requireProof(proof.ciRun.repository==='inguillen87/obrasaas'&&/^\d+$/.test(proof.ciRun.runId)&&/^[1-9]\d*$/.test(proof.ciRun.runAttempt)&&['push','workflow_dispatch'].includes(proof.ciRun.event)&&proof.ciRun.workflow==='Authorized workspace acceptance','Actual workflow execution identity required');
 if(runId!==undefined)requireProof(proof.ciRun.runId===String(runId),'Foreign CI run');if(runAttempt!==undefined)requireProof(proof.ciRun.runAttempt===String(runAttempt),'Foreign CI attempt');
 requireProof(proof.harnessSha256===spec.producerSha256&&proof.harnessSha256===sha(bytes(readSource,producer))&&same(proof.checks,spec.checkNames)&&same(proof.checks,PARTICIPANT_KYC_PREANALYSIS_CHECKS),'Current CI runner and native check binding required');
 requireProof(same(spec.sourceFiles,participantPreanalysisCiSourceClosure(readSource)),'Declared source set must equal actual native, unit and UI import graphs plus reviewed CI leaves');
 requireProof(same(proof.sourceManifest,refs(spec.sourceFiles,readSource)),'Every current CI source reference must match raw Git bytes');
 const raw=proof.rawNative;keys(raw,['path','bytes','sha256'],'raw native reference');requireProof(raw.path===PARTICIPANT_PREANALYSIS_EVIDENCE+'native-original.json'&&hash(raw.sha256),'Original native proof reference required');
 const nativeBytes=bytes(readEvidence,raw.path);requireProof(nativeBytes.length===raw.bytes&&sha(nativeBytes)===raw.sha256,'Raw native evidence changed');
 const native=JSON.parse(nativeBytes),result=validateParticipantKycPreanalysisNative(native,{readSource,nativeSourceFiles:revision.nativeSourceFiles});
 requireProof(Array.isArray(proof.unitSuites)&&same(proof.unitSuites.map(row=>row.file),revision.unitSuites.map(row=>row.file)),'Every frozen backend and UI unit suite must execute');
 for(const [index,suite]of proof.unitSuites.entries()){
  keys(suite,['file','sourceSha256','exitCode','tap','result'],'unit suite');keys(suite.tap,['path','bytes','sha256'],'unit TAP');
  requireProof(suite.exitCode===0&&suite.sourceSha256===sha(bytes(readSource,suite.file))&&suite.tap.path===PARTICIPANT_PREANALYSIS_EVIDENCE+'suite-'+index+'.tap','Exact executed unit source and TAP required');
  const tap=bytes(readEvidence,suite.tap.path);requireProof(tap.length===suite.tap.bytes&&sha(tap)===suite.tap.sha256,'Unit TAP changed');const parsed=parseParticipantPreanalysisTap(tap);
  requireProof(same(parsed,suite.result)&&same(parsed.caseNames,revision.unitSuites[index].caseNames),'Original executed unit names/counts required');
 }
 return {version:PARTICIPANT_PREANALYSIS_CI_VERSION,status:'PASS',sourceRevision:expectedHead,sourceTree:expectedTree,ciRun:proof.ciRun,...result,unitTests:proof.unitSuites.reduce((sum,row)=>sum+row.result.tests,0),sourceReferences:proof.sourceManifest.length,rawNativeSha256:raw.sha256,nativeProofRewritten:false,productionDataWritten:false,humanApprovalPerformed:false};
}

async function main(){
 const [mode,flag,expectedHead]=process.argv.slice(2);requireProof(['native','verify'].includes(mode)&&flag==='--expected-head'&&/^[a-f0-9]{40}$/.test(expectedHead),'Use native|verify --expected-head <commit>');
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:12*1024*1024}).trim();
 const head=git('rev-parse','HEAD'),tree=git('rev-parse','HEAD^{tree}');requireProof(head===expectedHead&&git('status','--porcelain','--untracked-files=no')==='','Exact clean committed source required');
 const committed=new Set(git('ls-tree','-r','--name-only',head).split('\n')),sourceCache=new Map();
 const readSource=file=>{if(!committed.has(file))return null;if(!sourceCache.has(file))sourceCache.set(file,execFileSync('git',['show',head+':'+file],{cwd:root,maxBuffer:12*1024*1024}));return sourceCache.get(file);};
 const contract=JSON.parse(readSource(PARTICIPANT_PREANALYSIS_CONTRACT_PATH)),spec=contract.extension.proofs.find(row=>row.id===PARTICIPANT_PREANALYSIS_PROOF_ID),revision=contract.participantPreanalysisCurrentRevision;
 verifyParticipantPreanalysisCurrentSources(contract,readSource);
 const readEvidence=file=>readFileSync(path.join(root,file));
 const identity={repository:process.env.GITHUB_REPOSITORY,runId:process.env.GITHUB_RUN_ID,runAttempt:process.env.GITHUB_RUN_ATTEMPT,event:process.env.GITHUB_EVENT_NAME,workflow:process.env.GITHUB_WORKFLOW};
 requireProof(process.env.CI==='true'&&identity.repository==='inguillen87/obrasaas'&&/^\d+$/.test(identity.runId)&&/^[1-9]\d*$/.test(identity.runAttempt)&&['push','workflow_dispatch'].includes(identity.event)&&identity.workflow==='Authorized workspace acceptance'&&process.env.GITHUB_SHA===head,'Actual current GitHub workflow metadata required');
 const output=path.join(root,PARTICIPANT_PREANALYSIS_CI_PATH);
 if(mode==='native'){
  participantPreanalysisDisposableTarget(process.env);requireProof(!existsSync(output),'Fresh CI output required');mkdirSync(path.dirname(output),{recursive:true});
  const unitSuites=[];
  for(const [index,row]of revision.unitSuites.entries()){
   const run=spawnSync(process.execPath,['--test','--test-reporter=tap',row.file],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024,env:process.env});
   const tap=Buffer.from(run.stdout||''),tapPath=PARTICIPANT_PREANALYSIS_EVIDENCE+'suite-'+index+'.tap';writeFileSync(path.join(root,tapPath),tap,{flag:'wx'});
   requireProof(run.status===0&&!run.error&&!run.signal,'Backend/UI unit execution failed: '+row.file);
   unitSuites.push({file:row.file,sourceSha256:sha(readSource(row.file)),exitCode:run.status,tap:{path:tapPath,bytes:tap.length,sha256:sha(tap)},result:parseParticipantPreanalysisTap(tap)});
  }
  // Retain the native return value byte-for-byte as its own original document;
  // source/run provenance belongs to this new envelope, never to a retagged raw.
  const native=await verifyParticipantKycPreanalysisPostgres(process.env),rawBytes=Buffer.from(JSON.stringify(native,null,2)+'\n'),rawPath=PARTICIPANT_PREANALYSIS_EVIDENCE+'native-original.json';
  writeFileSync(path.join(root,rawPath),rawBytes,{flag:'wx'});
  const proof={version:PARTICIPANT_PREANALYSIS_CI_VERSION,status:native.status,sourceRevision:head,sourceTree:tree,sourceState:'EXACT_CI_SOURCE',trackedClean:true,dirtyTrackedPaths:[],ciRun:identity,harnessSha256:sha(readSource(producer)),sourceManifest:refs(spec.sourceFiles,readSource),checks:native.checks,rawNative:{path:rawPath,bytes:rawBytes.length,sha256:sha(rawBytes)},unitSuites,providerRequests:0,productionDataWritten:false,realConsentOrIdentityVerified:false,humanApprovalPerformed:false};
  writeFileSync(output,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});requireProof(native.status==='PASS','Native run failed; original failure evidence retained');
 }
 const result=validateParticipantKycPreanalysisCi(JSON.parse(readFileSync(output)),{expectedHead:head,expectedTree:tree,readSource,readEvidence,spec,runId:identity.runId,runAttempt:identity.runAttempt});
 requireProof(git('rev-parse','HEAD')===head&&git('rev-parse','HEAD^{tree}')===tree&&git('status','--porcelain','--untracked-files=no')==='','Source changed during CI validation');
 // All source rows also remain byte-identical in the checkout after execution.
 for(const row of refs(spec.sourceFiles,readSource))requireProof(sha(readFileSync(path.join(root,row.path)))===row.sha256,'Checkout source changed: '+row.path);
 console.log(JSON.stringify(result));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.code||error.name,error.message);process.exitCode=1;});
