import {PLAN_BUDGET_CURRENT_SECTION,restorePlanBudgetPreviousContract,restorePlanBudgetSourceSet,withCaptureRuntimePreviousSources} from './lib/plan-budget-current-ci-lineage.mjs';
import {WORKSITE_LIVE_HOURS_CURRENT_SECTION,restoreWorksiteLiveHoursSourceSet as worksiteSourceCheck0,verifyWorksiteLiveHoursCurrentSources as worksiteSourceCheck1,verifyWorksiteLiveHoursActualClosure as worksiteSourceCheck2} from './lib/worksite-live-hours-current-ci-lineage.mjs';
function checkWorksiteSource(action){try{return action();}catch(error){if(error.code==='WORKSITE_LIVE_HOURS_CURRENT_CI_LINEAGE_REJECTED')guard(false,error.message);throw error;}}
const restoreWorksiteLiveHoursSourceSet=(...args)=>checkWorksiteSource(()=>worksiteSourceCheck0(...args));
const verifyWorksiteLiveHoursCurrentSources=(...args)=>checkWorksiteSource(()=>worksiteSourceCheck1(...args));
const verifyWorksiteLiveHoursActualClosure=(...args)=>checkWorksiteSource(()=>worksiteSourceCheck2(...args));
import {WORKSITE_LIVE_HOURS_CURRENT_REVISION} from './lib/worksite-live-hours-current-ci-reviewed.mjs';
import {WEEKLY_CYP_CURRENT_REVISION,restoreWeeklyCypConsumerSourceSet} from './lib/home-decisions-current-ci-lineage.mjs';
import {DOCUMENT_TASK_ASSOCIATION_MEASUREMENT,restoreDocumentTaskAssociationSourceSet} from './lib/plan-measurement-document-association-ci-lineage.mjs';
import {INTEGRATED_IDENTITY_CURRENT_REVISION} from './lib/integrated-identity-current-ci-lineage.mjs';
import {createHash} from 'node:crypto';
import {participantPreanalysisConsumerSourceFiles,preloadParticipantPreanalysisConsumerSources,PARTICIPANT_PREANALYSIS_CURRENT_REVISION} from './lib/participant-preanalysis-current-ci-lineage.mjs';
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,mkdirSync,writeFileSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from '@babel/parser';
import {PLAN_MEASUREMENT_UI_VERSION,PLAN_MEASUREMENT_UI_WIDTHS,planMeasurementUiSourceIdentity,planMeasurementUiSourceClosure} from './verify-plan-measurement-ui.mjs';

export const PLAN_MEASUREMENT_CI_VERSION='plan-measurement-ci-v2';
export const PLAN_MEASUREMENT_NATIVE_CHECKS=Object.freeze([
 'canonical-responsible-permission-scope-and-foreign-project-before-storage',
 'real-private-local-upload-retains-source-exact-quantity-provenance-without-task-or-provider-effects',
 'audited-predecision-rejection-replay-recovery-has-zero-task-draft-proposal-effects-and-allows-fresh-review',
 'source-draft-and-explicit-task-identity-CAS-deny-without-writes',
 'native-receipt-failure-rolls-back-whole-task-batch-and-review-state',
 'native-concurrent-apply-exact-replay-creates-once-with-execution-zero-and-maker-source-trail',
 'same-source-second-application-denied-and-unsealed-definition-requires-explicit-replacement',
 'imported-definition-enters-canonical-quantity-proposal-without-crediting-work-before-independent-review',
 'pending-even-expired-proposal-blocks-import-replacement-until-canonical-reconciliation',
 'independent-authorized-approval-seals-exact-baseline-and-prevents-import-source-relabel',
 'current-membership-revocation-denies-private-source-and-exact-receipt-recovery',
]);
export const PLAN_MEASUREMENT_UI_CASES=Object.freeze([
 ['lost-ack-readback-then-explicit-same-UUID-digest-command',2],
 ['403-preserves-corrections-and-reference-across-close',0],
 ['late-private-read-cannot-enter-next-scope',0],
 ['Excel-local-private-purpose-needs-explicit-consent-no-POST',0],
 ['document-OpenAI-purpose-change-revokes-prior-consent-no-POST',0],
 ['audited-bound-409-preserves-corrections-fresh-GET-explicit-newUUID-review',2],
 ['generic-409-never-clears-unverified-reference-or-enables-new-command',1],
 ['wrong-receipt-409-never-clears-unverified-reference-or-enables-new-command',1],
 ['inline-text-quantity-literal-preserved-in-original-and-saved-review-with-human-correction',1],
 ['shared-text-quantity-literal-preserved-in-original-and-saved-review-with-human-correction',1],
 ['closed-dirty-work-blocks-keyed-project-unmount-until-explicit-local-discard',0],
 ['closed-uncertain-attempt-retains-reference-and-context-lock-no-local-discard',1],
 ['500-bound-rejection-body-retains-reference-corrections-readback-explicit-same-UUID',2],
 ['saved-200-bounded-comparison-whole-review-explicit-apply-no-execution',1],
 ['pending-200-cross-page-locator-preserves-corrections-and-localizes-error-no-POST',0],
].map(row=>Object.freeze(row)));
export const PLAN_MEASUREMENT_UI_LARGE_CASES=Object.freeze([
 Object.freeze({check:'saved-200-bounded-comparison-whole-review-explicit-apply-no-execution',posts:1,sourceRows:200,included:175,excluded:25,maxRenderedRows:10,lastSourceRowId:'source-200',applyBeforeComparison:true,appliedSnapshots:175}),
 Object.freeze({check:'pending-200-cross-page-locator-preserves-corrections-and-localizes-error-no-POST',posts:0,sourceRows:200,completed:199,pending:1,pendingSourceRowId:'source-200',pendingPage:20,focusedRowIndex:199,renderedRows:10,automaticConfirmations:0}),
]);
// These facts describe closed synthetic document fixtures; they do not claim
// provider, production, identity or human acceptance.
export const PLAN_MEASUREMENT_DOCUMENT_NATIVE_FACTS=Object.freeze([
 Object.freeze({name:'existing',createdTasks:0,progressChanged:false,sourceCode:null,trailVersion:2}),
 Object.freeze({name:'lost-ack',realCommitObserved:true,receiptCount:1,replayWrites:0}),
 Object.freeze({name:'task-cas',taskEffects:false,draftEffects:false,proposalEffects:false}),
 Object.freeze({name:'pending-after-review',realCanonicalProposal:true,taskEffects:false}),
 Object.freeze({name:'foreign-null-source',sourceRelabeled:false}),
 Object.freeze({name:'second-row-rollback',realSqlRollback:true,createdTasks:0,replayWrites:0}),
]);
export const PLAN_MEASUREMENT_DOCUMENT_UI_ASSOCIATION=Object.freeze({version:1,mode:'DOCUMENT_ROW',sourceSha256:'eccd049d1a76160e5754d4f28456266e079adcbd084a236ecf6be26eb170d707',sourceDigest:'76f7a82e73eb5277163367229447fecbe8b8370903928aa58e776b7e094b0ffb',sourceRowId:'document:1',taskId:'document-task-a',taskRevision:'2026-10-14T12:00:00.000001',confirmed:true});
export const PLAN_MEASUREMENT_DOCUMENT_UI_CHECKS=Object.freeze([
 ...PLAN_MEASUREMENT_UI_WIDTHS.map(width=>Object.freeze({check:'document-explicit-association-proof-saved-responsive',width})),
 Object.freeze({check:'document-task-mode-refresh-invalidates-captured-proof',width:390}),
 Object.freeze({check:'document-unknown-readback-explicit-exact-UUID-body-proof-retry',width:390}),
]);
export const PLAN_MEASUREMENT_PROOF_PATHS=Object.freeze({postgres:'.vercel/private/plan-measurement-postgres.json',ui:'.vercel/private/plan-measurement-ui-evidence/browser.json',ci:'.vercel/private/plan-measurement-ci.json',artifacts:'.vercel/private/plan-measurement-ci-artifacts.json'});
const pgHarness='scripts/verify-plan-measurement-postgres.mjs',uiHarness='scripts/verify-plan-measurement-ui.mjs',validator='scripts/verify-plan-measurement-ci.mjs',workflow='.github/workflows/task-measurement.yml',cleanupHelper='scripts/lib/owned-fixture-cleanup.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),revision=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value),uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
function guard(condition,message){if(!condition)throw Object.assign(new Error(message),{code:'PLAN_MEASUREMENT_CI_REJECTED'});}
function same(actual,expected,message){guard(JSON.stringify(actual)===JSON.stringify(expected),message);}
function sourcePath(file){return typeof file==='string'&&/^(?:src|scripts|tests)\//.test(file)&&!file.includes('\\')&&!file.includes('\0')&&path.posix.normalize(file)===file;}
function importPaths(bytes,file){
 if(file.endsWith('.css'))return [];
 const tree=parse(bytes.toString(),{sourceType:'module',plugins:['jsx'],createImportExpressions:true}),refs=[];
 function walk(node){if(!node||typeof node!=='object')return;if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration','ImportExpression'].includes(node.type)&&node.source){guard(node.source.type==='StringLiteral','Nonliteral source import: '+file);refs.push(node.source.value);}if(node.type==='CallExpression'&&node.callee?.type==='Import'){guard(node.arguments.length===1&&node.arguments[0]?.type==='StringLiteral','Nonliteral dynamic import: '+file);refs.push(node.arguments[0].value);}for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}
 walk(tree.program);return refs;
}
// Independent AST closure; no producer, database, provider or browser is invoked.
export function planMeasurementNativeSourceClosure(readSource){
 const files=new Set(),external=new Set();function visit(file){guard(sourcePath(file),'Unsafe source path: '+file);if(files.has(file))return;const bytes=readSource(file);guard(Buffer.isBuffer(bytes),'Missing native source: '+file);files.add(file);for(const ref of importPaths(bytes,file)){if(!ref.startsWith('.')){guard(!/^(?:https?:|file:|data:)/.test(ref),'External executable source');external.add(ref);continue;}const value=path.posix.normalize(path.posix.join(path.posix.dirname(file),ref)),dependency=[value,value+'.js',value+'.mjs',value+'.css'].find(candidate=>sourcePath(candidate)&&readSource(candidate)!==null);guard(Boolean(dependency),'Missing native dependency '+ref+' from '+file);visit(dependency);}}visit(pgHarness);return {files:[...files].sort(),externalImports:[...external].sort()};
}
function closedManifest(records,files,readSource,label){
 guard(Array.isArray(records)&&records.length===files.length,label+' manifest count');const found=new Map();for(const row of records){guard(row&&typeof row==='object'&&!Array.isArray(row)&&Object.keys(row).sort().join(',')==='path,sha256'&&typeof row.path==='string'&&hash(row.sha256)&&!found.has(row.path),label+' duplicate or malformed source');found.set(row.path,row.sha256);}same([...found.keys()].sort(),[...files].sort(),label+' full closed source paths');for(const file of files)guard(Buffer.isBuffer(readSource(file))&&found.get(file)===sha(readSource(file)),label+' stale Git blob hash: '+file);
}
function worksiteHoursSourceContract(readSource){
 const bytes=readSource('.github/workspace-acceptance-contract.json');if(!Buffer.isBuffer(bytes))return null;const contract=JSON.parse(bytes);if(!contract[WORKSITE_LIVE_HOURS_CURRENT_SECTION])return null;
 verifyWorksiteLiveHoursCurrentSources(contract,readSource);return contract;
}
function checkedBudgetSource(action){try{return action();}catch(error){if(error.code==='PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED')guard(false,error.message);throw error;}}
// Counts come only from the authenticated immutable current companion. The
// actual source manifests stay intact; historical count/path oracles stay fixed.
// Current count acceptance comes from the authenticated current family. The
// old Budget source-set delta remains an independently checked parent count.
function currentBudgetSourceCounts(contract,readSource,verifyInputs=undefined){
 if(!contract?.[PLAN_BUDGET_CURRENT_SECTION])return null;
 checkedBudgetSource(()=>restorePlanBudgetPreviousContract(contract));
 const deltas=contract[PLAN_BUDGET_CURRENT_SECTION].sourceSetDeltas,native=deltas.find(row=>row.family==='PLAN_MEASUREMENT'),runtime=deltas.find(row=>row.family==='MEASUREMENT_UI_RUNTIME');
 guard(native&&runtime&&Number.isSafeInteger(native.currentCount)&&Number.isSafeInteger(runtime.currentCount),'Exact compiled Budget measurement source deltas required');
 if(!contract[PLAN_BUDGET_CURRENT_SECTION].captureQualityRuntime)return {nativeCount:native.currentCount,runtimeCount:runtime.currentCount};
 const before=JSON.stringify(contract),verify=()=>{if(verifyInputs)verifyInputs();guard(JSON.stringify(contract)===before,'Current source contract changed during count binding');verifyWorksiteLiveHoursCurrentSources(contract,readSource);};
 verify();
 try{return checkedBudgetSource(()=>withCaptureRuntimePreviousSources(contract,readSource,(parent)=>{
  const current=contract[PLAN_BUDGET_CURRENT_SECTION].sourceFamilies,historical=parent[PLAN_BUDGET_CURRENT_SECTION].sourceFamilies,currentNative=current.find(row=>row.family==='PLAN_MEASUREMENT'),currentRuntime=current.find(row=>row.family==='MEASUREMENT_UI_RUNTIME'),parentNative=historical.find(row=>row.family==='PLAN_MEASUREMENT'),parentRuntime=historical.find(row=>row.family==='MEASUREMENT_UI_RUNTIME');
  guard(currentNative&&currentRuntime&&parentNative&&parentRuntime,'Authenticated current and historical count families required');
  guard(parentNative.currentFiles.length===native.currentCount&&parentRuntime.currentFiles.length===runtime.currentCount,'Historical Budget counts must remain exact');
  const binding={sourceBasis:'AUTHENTICATED_CURRENT_CAPTURE_FAMILY',historicalSourceBasis:'AUTHENTICATED_PRE_CAPTURE_PARENT',nativeSourceCount:currentNative.currentFiles.length,runtimeSourceCount:currentRuntime.currentFiles.length,historicalNativeSourceCount:parentNative.currentFiles.length,historicalRuntimeSourceCount:parentRuntime.currentFiles.length};
  return {nativeCount:binding.nativeSourceCount,runtimeCount:binding.runtimeSourceCount,sourceCountBinding:binding};
 }));}finally{verify();}
}
// The original public CURRENT verifier and complete family check surround each
// historical path assertion. No reader or authority result leaves this scope.
function historicalPlanClosure(contract,family,closure,readSource,run,verifyInputs){
 const before={contract:JSON.stringify(contract),closure:JSON.stringify(closure)};
 const verify=()=>{
  if(verifyInputs)verifyInputs();guard(JSON.stringify(contract)===before.contract&&JSON.stringify(closure)===before.closure,'Current contract or closure changed during historical source validation');
  verifyWorksiteLiveHoursCurrentSources(contract,readSource);verifyWorksiteLiveHoursActualClosure(contract,family,closure,readSource);
 };
 verify();
 try{return checkedBudgetSource(()=>withCaptureRuntimePreviousSources(contract,readSource,(parent,parentRead)=>{
  const descriptor=parent[PLAN_BUDGET_CURRENT_SECTION].sourceFamilies.find(row=>row.family===family);guard(descriptor&&Array.isArray(descriptor.currentFiles),'Authenticated historical measurement family required');
  return run(parent,parentRead,[...descriptor.currentFiles]);
 }));}finally{verify();}
}
function pinnedClosure(closure,count,pathsSha,label,readSource,authenticatedCurrentContract=undefined,verifyInputs=undefined){
 // The optional object is private to this validation call. Re-read the captured
 // contract before every actual closure; no accepted reader is cached.
 const current=authenticatedCurrentContract===undefined?worksiteHoursSourceContract(readSource):authenticatedCurrentContract;
 if(authenticatedCurrentContract!==undefined){
  const bytes=readSource('.github/workspace-acceptance-contract.json');
  if(current){guard(Buffer.isBuffer(bytes),'Current source contract changed during validation');same(JSON.parse(bytes),current,'Current source contract changed during validation');}
  else guard(!Buffer.isBuffer(bytes)||!JSON.parse(bytes)[WORKSITE_LIVE_HOURS_CURRENT_SECTION],'Current source contract changed during validation');
 }
 let historicalFiles=closure.files;const family={'Native':'PLAN_MEASUREMENT','Actual browser':'MEASUREMENT_UI','UI Node runtime':'MEASUREMENT_UI_RUNTIME'}[label];
 const predecessorFiles=current?(verifyWorksiteLiveHoursActualClosure(current,family,closure,readSource),restoreWorksiteLiveHoursSourceSet(current,family,closure.files)):closure.files;
 const restore=(sourceContract,sourceRead,files)=>{
  let historical=files;
  if(label==='Actual browser'){const contract=sourceRead('.github/workspace-acceptance-contract.json');guard(Buffer.isBuffer(contract),'Current UI browser source contract required');historical=restoreWeeklyCypConsumerSourceSet('MEASUREMENT_UI',files,JSON.parse(contract));}
  if(label==='Native'){guard(predecessorFiles.length===DOCUMENT_TASK_ASSOCIATION_MEASUREMENT.nativeCurrentCount,'All current native source paths required');historical=participantPreanalysisConsumerSourceFiles('PLAN_MEASUREMENT',files,sourceRead);}
  if(label==='UI Node runtime'){const beforeBudget=sourceContract?.[PLAN_BUDGET_CURRENT_SECTION]?checkedBudgetSource(()=>restorePlanBudgetSourceSet(sourceContract,'MEASUREMENT_UI_RUNTIME',files)):files;guard(beforeBudget.length===DOCUMENT_TASK_ASSOCIATION_MEASUREMENT.runtimeSourceCount&&sha(JSON.stringify(beforeBudget))===DOCUMENT_TASK_ASSOCIATION_MEASUREMENT.runtimeCurrentPathsSha256,'Exact current document UI runtime source paths required');const contract=sourceRead('.github/workspace-acceptance-contract.json');guard(Buffer.isBuffer(contract),'Current UI runtime source contract required');historical=restoreDocumentTaskAssociationSourceSet('MEASUREMENT_UI_RUNTIME',files,JSON.parse(contract));}
  return historical;
 };
 historicalFiles=current?.[PLAN_BUDGET_CURRENT_SECTION]?.captureQualityRuntime?historicalPlanClosure(current,family,closure,readSource,restore,verifyInputs):restore(current,readSource,closure.files);
 guard(historicalFiles.length===count&&sha(JSON.stringify(historicalFiles))===pathsSha,label+' recursive source lineage changed');
}
// Share the real CLI source-collection path before callers close their RAW map.
// The three original historical guards run against the physical/lazy reader;
// only CURRENT closures return, never a parent reader or accepted authority.
export function planMeasurementCiSourceClosures(readSource){
 const nativeClosure=planMeasurementNativeSourceClosure(readSource),browserClosure=planMeasurementUiSourceClosure(readSource),runtimeClosure=planMeasurementUiSourceClosure(readSource,{runtime:true});pinnedClosure(nativeClosure,113,'d4107d17d5270dc8d0de8f3d49a9b5a7d824d2e648b520bceffed658a2336cff','Native',readSource);pinnedClosure(browserClosure,18,'4fe202152d08827101fe2f70ef6ddd12dd0c88f681723fc9350266b479899b2f','Actual browser',readSource);pinnedClosure(runtimeClosure,14,'c568a33fc8226eb64c1a09e1b5aef30a335abfb37fa603c49e3f99b3dd026f8a','UI Node runtime',readSource);
 return {nativeClosure,browserClosure,runtimeClosure};
}
function cleanupCheck(cleanup){
 guard(cleanup?.browserClosed===true&&cleanup.serverClosed===true&&cleanup.gracefulCloseAcknowledged===true&&cleanup.fixtureRemoved===true,'Browser and owned server must close before removal');const proof=cleanup.fixtureCleanupProof;guard(proof?.fixtureRemoved===true&&proof.postcondition?.absent===true&&Array.isArray(proof.attempts)&&proof.attempts.length>=1&&proof.attempts.length<=3,'Owned fixture absent postcondition required');
 for(const [index,row]of proof.attempts.entries()){guard(row&&Object.keys(row).sort().join(',')==='attempt,phase,postcondition,removalAttempted,retryScheduled,rmCompleted'&&row.attempt===index+1&&typeof row.removalAttempted==='boolean'&&typeof row.rmCompleted==='boolean'&&typeof row.retryScheduled==='boolean','Bounded sequential cleanup attempts');if(index===proof.attempts.length-1)guard(row.postcondition==='ABSENT'&&row.retryScheduled===false&&(row.phase==='POSTCONDITION'&&row.removalAttempted&&row.rmCompleted||row.phase==='GUARD'&&!row.removalAttempted&&!row.rmCompleted),'Final real absence after owned cleanup');else guard(row.phase==='DELAY'&&row.postcondition==='PRESENT'&&row.removalAttempted&&row.rmCompleted&&row.retryScheduled,'Cleanup retries require successful guarded removal');}
}
export function planMeasurementUiHistoricalRequestMatrix(){
 const matrix=[];const add=(mode,width,methods)=>{for(const method of methods)matrix.push({mode,width,method:method==='RECOVERY'?'GET':method,recovery:method==='RECOVERY'});};
 for(const width of PLAN_MEASUREMENT_UI_WIDTHS)add('normal',width,['GET','GET','POST','POST']);
 add('lost-ack',390,['GET','GET','POST','RECOVERY','POST']);add('normal',390,['GET','GET','POST']);add('late-context',390,['GET']);add('consent',390,['GET']);add('audited-409',390,['GET','GET','POST','GET','POST']);add('generic-409',390,['GET','GET','POST']);add('wrong-receipt-409',390,['GET','GET','POST']);add('inline-text-quantity',390,['GET','GET','POST']);add('shared-text-quantity',390,['GET','GET','POST']);add('closed-work',390,['GET','GET']);add('generic-409',390,['GET','GET','POST']);add('bound-500',390,['GET','GET','POST','RECOVERY','POST']);add('saved-200',390,['GET','GET','POST']);add('pending-200',390,['GET','GET']);return matrix;
}
export function planMeasurementUiRequestMatrix(){
 const matrix=planMeasurementUiHistoricalRequestMatrix(),add=(mode,width,methods)=>{for(const method of methods)matrix.push({mode,width,method:method==='RECOVERY'?'GET':method,recovery:method==='RECOVERY'});};
 for(const width of PLAN_MEASUREMENT_UI_WIDTHS)add('document',width,['GET','GET','POST']);
 add('document',390,['GET','GET','GET','POST']);add('document-unknown',390,['GET','GET','POST','RECOVERY','POST']);return matrix;
}
export function planMeasurementDocumentNativeProof(){return {version:1,checks:DOCUMENT_TASK_ASSOCIATION_MEASUREMENT.nativeCheckNames.slice(PLAN_MEASUREMENT_NATIVE_CHECKS.length),facts:PLAN_MEASUREMENT_DOCUMENT_NATIVE_FACTS.map(row=>({...row})),sourceFormat:'DOCUMENT',syntheticResponsesRequests:6,realProviderCalls:0,privateStorage:'CLOSED_MEMORY_FIXTURE',originalChecksPreserved:11,existingTaskAssociationOnly:true,identityApproved:false,productionDataWritten:false};}
function documentUiChecks(checks,ledger){
 same(ledger,PLAN_MEASUREMENT_DOCUMENT_UI_CHECKS,'Exact six additive document UI checks');guard(Array.isArray(checks)&&checks.length===6,'All six document association UI facts required');
 const metrics=(row,width)=>{same(Object.keys(row||{}).sort(),['documentWidth','targets','width'],'Document measured metrics shape');guard(row.width===width&&Number.isSafeInteger(row.documentWidth)&&row.documentWidth>0&&row.documentWidth<=width&&Array.isArray(row.targets)&&row.targets.length>=2&&row.targets.every(value=>Number.isFinite(value)&&value>=44),'Measured document responsive width and accessible controls');};
 for(const [index,width]of PLAN_MEASUREMENT_UI_WIDTHS.entries()){const row=checks[index];same(Object.keys(row||{}).sort(),['after','automaticAssociations','before','check','documentAssociation','posts','savedReferenceCollapsed','sourceReferenceCollapsed','sourceReferenceDisclosed','taskReferenceDisclosed','width'],'Document responsive check shape');guard(row.check===PLAN_MEASUREMENT_DOCUMENT_UI_CHECKS[index].check&&row.width===width&&row.posts===1&&row.automaticAssociations===0&&row.sourceReferenceCollapsed===true&&row.savedReferenceCollapsed===true&&row.sourceReferenceDisclosed===true&&row.taskReferenceDisclosed===true,'Explicit document association and progressive source disclosure required');metrics(row.before,width);metrics(row.after,width);same(row.documentAssociation,PLAN_MEASUREMENT_DOCUMENT_UI_ASSOCIATION,'Document source row, selected task and captured revision proof');}
 same(checks[4],{check:PLAN_MEASUREMENT_DOCUMENT_UI_CHECKS[4].check,width:390,posts:1,blockedSubmissions:3,taskChangeReset:true,modeChangeReset:true,refreshReset:true,automaticConfirmations:0,documentAssociation:{...PLAN_MEASUREMENT_DOCUMENT_UI_ASSOCIATION,taskId:'document-task-b',taskRevision:'2026-10-14T12:00:01.000002'}},'Changing task, mode and current state invalidates the captured document proof');
 same(checks[5],{check:PLAN_MEASUREMENT_DOCUMENT_UI_CHECKS[5].check,width:390,posts:2,readbacks:1,exactBodyRetry:true,exactUuidRetry:true,exactProofRetry:true,automaticRetries:0,documentAssociation:PLAN_MEASUREMENT_DOCUMENT_UI_ASSOCIATION},'Unknown document acknowledgment requires exact explicit UUID/body/proof retry');
}
function uiChecks(ui){
 same(ui.widths,PLAN_MEASUREMENT_UI_WIDTHS,'Complete responsive width matrix');guard(ui.version===DOCUMENT_TASK_ASSOCIATION_MEASUREMENT.uiVersion&&ui.totalCheckCount===DOCUMENT_TASK_ASSOCIATION_MEASUREMENT.uiCount&&Array.isArray(ui.checks)&&ui.checks.length===DOCUMENT_TASK_ASSOCIATION_MEASUREMENT.uiCount&&ui.historicalCheckCount===DOCUMENT_TASK_ASSOCIATION_MEASUREMENT.uiPreviousCount&&ui.expectedTotalCheckCount===DOCUMENT_TASK_ASSOCIATION_MEASUREMENT.uiCount,'All 25 current and 19 historical actual UI checks required');
 for(const [index,width]of PLAN_MEASUREMENT_UI_WIDTHS.entries()){const row=ui.checks[index];guard(row?.check==='explicit-review-replace-zero-progress-and-apply-responsive'&&row.width===width&&row.posts===2&&Number.isSafeInteger(row.documentWidth)&&row.documentWidth>0&&row.documentWidth<=width&&Array.isArray(row.targets)&&row.targets.length>=2&&row.targets.every(value=>Number.isFinite(value)&&value>=44),'Measured responsive review/application and accessible targets');same(Object.keys(row).sort(),['check','documentWidth','posts','targets','width'],'Responsive check shape');}
 same(ui.checks.slice(4,17),PLAN_MEASUREMENT_UI_CASES.slice(0,13).map(([check,posts])=>({check,posts})),'Recovery, denial, literal quantity, correction, exclusion and lost-work scenarios required');same(ui.checks.slice(17,19),PLAN_MEASUREMENT_UI_LARGE_CASES,'Actual 200-row bounded comparison and cross-page correction facts required');documentUiChecks(ui.checks.slice(19),ui.documentAssociationCheckLedger);
 const expected=planMeasurementUiRequestMatrix();guard(Array.isArray(ui.apiRequests)&&ui.apiRequests.length===expected.length,'Exact actual API request count');for(const [index,row]of ui.apiRequests.entries()){const want=expected[index];same(Object.keys(row).sort(),['method','mode','operationId','width'],'Request metadata shape');guard(row.mode===want.mode&&row.width===want.width&&row.method===want.method&&(want.recovery?uuid(row.operationId):row.operationId===null),'Exact readonly readback and explicitly initiated POST matrix');}const operations=ui.apiRequests.filter(row=>row.operationId!==null).map(row=>row.operationId);guard(operations.length===3&&new Set(operations).size===3,'Separate legacy lost acknowledgment, 500 and document original recovery UUIDs');
}
// Rejection-only DTO checks, extracted literally from the current late guards.
// No source read, authorization decision or accepted DTO is retained here.
function validatePlanMeasurementNativeDto(postgres,head){
 guard(postgres.status==='PASS'&&postgres.protocol==='plan-measurement-postgresql-v1'&&postgres.postgresExecuted===true&&postgres.sourceState==='EXACT_CI_SOURCE'&&postgres.sourceRevision===head&&postgres.trackedClean===true&&!Object.hasOwn(postgres,'failure'),'Current native disposable producer provenance');guard(postgres.totalCheckCount===DOCUMENT_TASK_ASSOCIATION_MEASUREMENT.nativeCount&&Array.isArray(postgres.checks),'All 17 current native checks required');same(postgres.checks.slice(0,11),PLAN_MEASUREMENT_NATIVE_CHECKS,'Exact historical 11 native CAS/rollback/rejection/authority/approval checks');same(postgres.checks,DOCUMENT_TASK_ASSOCIATION_MEASUREMENT.nativeCheckNames,'Exact current native document association contract');same(postgres.documentAssociationNative,planMeasurementDocumentNativeProof(),'Exact additive native document SQL, rollback, CAS, lost acknowledgment and synthetic provider facts');guard(postgres.providerCalls===0&&postgres.realIdentityDocuments===false&&postgres.realSourceAccepted===false&&postgres.productionDataWritten===false,'Native real-provider/identity/production boundary');guard(postgres.databaseRemoved===true&&postgres.poolClosed===true&&postgres.adminClosed===true&&postgres.pgStatActivityBeforeDrop===0,'Native clients, database and administrator cleanup postconditions');
}
function validatePlanMeasurementUiProvenanceDto(ui,head,sourceTree,ciRun){
 guard(ui.version===PLAN_MEASUREMENT_UI_VERSION&&ui.status==='PASS'&&ui.sourceState==='EXACT_CI_SOURCE'&&ui.sourceRevision===head&&ui.sourceTree===sourceTree&&ui.expectedHead===head&&ui.trackedClean===true&&!Object.hasOwn(ui,'failure')&&!Object.hasOwn(ui,'serverLog'),'Fresh exact UI producer provenance');same(ui.ciRun,ciRun,'UI actual run/attempt/event binding');guard(typeof ui.checkedAt==='string'&&Number.isFinite(Date.parse(ui.checkedAt)),'Actual browser proof timestamp');guard(Array.isArray(ui.errors)&&ui.errors.length===0&&ui.providerCalls===0,'No browser/runtime errors or provider calls');for(const key of ['productionLoginVerified','productionDataTouched','realIdentityDocuments','realSourceAccepted','governmentProviderUsed','fullWorkspaceMounted','humanAccepted','physicalDeviceAccepted'])guard(ui[key]===false,'Technical synthetic UI boundary: '+key);
}

// Raw proof bytes are retained and hashed; no LOCAL proof is re-labelled as CI.
export function validatePlanMeasurementCi({expectedHead,head,sourceTree,trackedClean,ciRun,gitSources,postgresBytes,uiBytes}){
 guard(revision(expectedHead)&&head===expectedHead&&revision(sourceTree)&&trackedClean===true,'Exact committed expected HEAD/tree and clean tracked source required');guard(gitSources&&typeof gitSources==='object'&&!Array.isArray(gitSources)&&Buffer.isBuffer(postgresBytes)&&Buffer.isBuffer(uiBytes),'Committed Git blobs and actual raw proof bytes required');
 const proofInputsBefore={postgres:sha(postgresBytes),ui:sha(uiBytes),ciRun:JSON.stringify(ciRun)};
 const verifyProofInputs=()=>guard(sha(postgresBytes)===proofInputsBefore.postgres&&sha(uiBytes)===proofInputsBefore.ui&&JSON.stringify(ciRun)===proofInputsBefore.ciRun,'Caller RAW proofs or CI identity changed during source validation');
 // Capture caller-owned blobs once. All authentication, closures and output
 // hashes below use these private Buffers, not a mutable map or caller getter.
 const sourceSnapshot=Object.create(null);
 for(const file of Object.getOwnPropertyNames(gitSources)){const bytes=gitSources[file];guard(Buffer.isBuffer(bytes),'Committed Git source Buffer required: '+file);sourceSnapshot[file]=Buffer.from(bytes);}
 const readSource=file=>Object.hasOwn(sourceSnapshot,file)?sourceSnapshot[file]:null;
 const identity=planMeasurementUiSourceIdentity({head,sourceTree,trackedClean,expectedHead,environment:{CI:'true',GITHUB_SHA:head,GITHUB_REPOSITORY:ciRun?.repository,GITHUB_WORKFLOW:ciRun?.workflow,GITHUB_RUN_ID:String(ciRun?.runId),GITHUB_RUN_ATTEMPT:String(ciRun?.runAttempt),GITHUB_EVENT_NAME:ciRun?.event}});same(ciRun,identity.ciRun,'Actual CI run identity');
 // Denial-only parse of the original RAW bytes. A valid DTO continues through
 // every CURRENT source check and is parsed/rechecked again at the old point.
 verifyProofInputs();
 {
  let earlyPostgres,earlyUi;try{earlyPostgres=JSON.parse(postgresBytes);earlyUi=JSON.parse(uiBytes);}catch{guard(false,'Unreadable raw producer proof');}guard(earlyPostgres&&earlyUi&&!Array.isArray(earlyPostgres)&&!Array.isArray(earlyUi),'Producer proof objects required');
  validatePlanMeasurementNativeDto(earlyPostgres,head);validatePlanMeasurementUiProvenanceDto(earlyUi,head,sourceTree,ciRun);uiChecks(earlyUi);cleanupCheck(earlyUi.cleanup);
 }
 const currentWorksiteContract=worksiteHoursSourceContract(readSource),currentWorksiteDelta=currentWorksiteContract?WORKSITE_LIVE_HOURS_CURRENT_REVISION.sourceSetDeltas.find(row=>row.family==='PLAN_MEASUREMENT')||null:null;
 let postgres,ui;try{postgres=JSON.parse(postgresBytes);ui=JSON.parse(uiBytes);}catch{guard(false,'Unreadable raw producer proof');}guard(postgres&&ui&&!Array.isArray(postgres)&&!Array.isArray(ui),'Producer proof objects required');
 const nativeClosure=planMeasurementNativeSourceClosure(readSource),browserClosure=planMeasurementUiSourceClosure(readSource),runtimeClosure=planMeasurementUiSourceClosure(readSource,{runtime:true});pinnedClosure(nativeClosure,113,'d4107d17d5270dc8d0de8f3d49a9b5a7d824d2e648b520bceffed658a2336cff','Native',readSource,currentWorksiteContract,verifyProofInputs);pinnedClosure(browserClosure,18,'4fe202152d08827101fe2f70ef6ddd12dd0c88f681723fc9350266b479899b2f','Actual browser',readSource,currentWorksiteContract,verifyProofInputs);pinnedClosure(runtimeClosure,14,'c568a33fc8226eb64c1a09e1b5aef30a335abfb37fa603c49e3f99b3dd026f8a','UI Node runtime',readSource,currentWorksiteContract,verifyProofInputs);
 validatePlanMeasurementNativeDto(postgres,head);closedManifest(postgres.sourceManifest,nativeClosure.files,readSource,'Native',readSource);guard(postgres.harnessSha256===sha(readSource(pgHarness)),'Native committed producer bytes');
 validatePlanMeasurementUiProvenanceDto(ui,head,sourceTree,ciRun);
 uiChecks(ui);cleanupCheck(ui.cleanup);closedManifest(ui.sourceManifest,browserClosure.files,readSource,'Actual JSX');closedManifest(ui.runtimeSourceManifest,runtimeClosure.files,readSource,'UI API/parser/runtime');closedManifest(ui.dependencyManifest,['package.json','package-lock.json'],readSource,'Pinned dependencies');closedManifest(ui.integrationSourceManifest,['src/app/(identity)/cuenta/workspace-client.js'],readSource,'Canonical workspace integration');same(ui.externalImports,browserClosure.externalImports,'Browser external dependency closure');same(ui.externalImports,['react'],'Bounded browser package imports');same(ui.runtimeExternalImports,runtimeClosure.externalImports,'Actual Node API/parser dependency imports');guard(ui.harnessSha256===sha(readSource(uiHarness))&&ui.cleanupHelperSha256===sha(readSource(cleanupHelper)),'UI producer and owned cleanup committed bytes');for(const file of [validator,workflow])guard(Buffer.isBuffer(readSource(file)),'Committed CI contract missing: '+file);
 verifyProofInputs();
 return {version:PLAN_MEASUREMENT_CI_VERSION,status:'PASS',sourceRevision:head,sourceTree,sourceState:'EXACT_CI_SOURCE',trackedClean:true,ciRun,postgres:{protocol:postgres.protocol,totalCheckCount:postgres.totalCheckCount,historicalCheckCount:11,documentAssociationNative:postgres.documentAssociationNative,sourceCount:nativeClosure.files.length,publishedCurrentSourceCount:113,sourceLineage:PARTICIPANT_PREANALYSIS_CURRENT_REVISION.consumerSourceDeltas.find(row=>row.family==='PLAN_MEASUREMENT')||null,integratedSourceLineage:INTEGRATED_IDENTITY_CURRENT_REVISION.consumerSourceDeltas.find(row=>row.family==='PLAN_MEASUREMENT')||null,sourceTreeBinding:'EXPECTED_COMMIT_GIT_BLOBS',harnessSha256:postgres.harnessSha256,...(currentWorksiteContract?{worksiteLiveHoursSourceLineage:currentWorksiteDelta}:{})},ui:{version:ui.version,totalCheckCount:ui.totalCheckCount,historicalCheckCount:19,documentAssociationCheckLedger:ui.documentAssociationCheckLedger,documentAssociationChecks:ui.checks.slice(19),sourceCount:browserClosure.files.length,runtimeSourceCount:runtimeClosure.files.length,dependencyCount:2,integrationSourceCount:1,widths:[...PLAN_MEASUREMENT_UI_WIDTHS],apiRequestCount:ui.apiRequests.length,httpPostCount:ui.apiRequests.filter(row=>row.method==='POST').length,harnessSha256:ui.harnessSha256,cleanupHelperSha256:ui.cleanupHelperSha256},validatorSha256:sha(readSource(validator)),workflowSha256:sha(readSource(workflow)),inputProofs:[{path:PLAN_MEASUREMENT_PROOF_PATHS.postgres,sha256:sha(postgresBytes)},{path:PLAN_MEASUREMENT_PROOF_PATHS.ui,sha256:sha(uiBytes)}],dependencyManifest:ui.dependencyManifest,integrationSourceManifest:ui.integrationSourceManifest,providerCalls:0,productionDataWritten:false,productionLoginVerified:false,humanAccepted:false,physicalDeviceAccepted:false,artifactArchiveValidated:false};
}
export function bindPlanMeasurementArtifacts({proofBytes,expectedHead,ciRun,artifacts,readSource}){
 guard(Buffer.isBuffer(proofBytes)&&revision(expectedHead),'Actual connected CI bytes and immutable head required');
 const bindingInputsBefore={proof:sha(proofBytes),ciRun:JSON.stringify(ciRun),artifacts:JSON.stringify(artifacts)},verifyBindingInputs=()=>guard(sha(proofBytes)===bindingInputsBefore.proof&&JSON.stringify(ciRun)===bindingInputsBefore.ciRun&&JSON.stringify(artifacts)===bindingInputsBefore.artifacts,'Caller connected RAW receipt, CI identity or artifact DTOs changed during count binding');
 const proof=JSON.parse(proofBytes),currentWorksiteContract=typeof readSource==='function'?worksiteHoursSourceContract(readSource):null,currentWorksiteDelta=currentWorksiteContract?WORKSITE_LIVE_HOURS_CURRENT_REVISION.sourceSetDeltas.find(row=>row.family==='PLAN_MEASUREMENT')||null:null;
 const budgetCounts=currentBudgetSourceCounts(currentWorksiteContract,readSource,verifyBindingInputs);
 if(currentWorksiteContract){same(proof.postgres?.worksiteLiveHoursSourceLineage,currentWorksiteDelta,'Exact reviewed live/hours native source lineage required');}else guard(!Object.hasOwn(proof.postgres||{},'worksiteLiveHoursSourceLineage'),'Current lineage requires an actual committed contract reader');
 guard(proof.version===PLAN_MEASUREMENT_CI_VERSION&&proof.status==='PASS'&&proof.sourceRevision===expectedHead&&revision(proof.sourceTree)&&proof.sourceState==='EXACT_CI_SOURCE'&&proof.trackedClean===true&&proof.postgres?.protocol==='plan-measurement-postgresql-v1'&&proof.postgres.totalCheckCount===DOCUMENT_TASK_ASSOCIATION_MEASUREMENT.nativeCount&&proof.postgres.historicalCheckCount===DOCUMENT_TASK_ASSOCIATION_MEASUREMENT.nativePreviousCount&&proof.postgres.sourceCount===(budgetCounts?.nativeCount??currentWorksiteDelta?.currentCount??DOCUMENT_TASK_ASSOCIATION_MEASUREMENT.nativeCurrentCount)&&proof.postgres.publishedCurrentSourceCount===113&&proof.ui?.version===DOCUMENT_TASK_ASSOCIATION_MEASUREMENT.uiVersion&&proof.ui.totalCheckCount===DOCUMENT_TASK_ASSOCIATION_MEASUREMENT.uiCount&&proof.ui.historicalCheckCount===DOCUMENT_TASK_ASSOCIATION_MEASUREMENT.uiPreviousCount&&proof.ui.sourceCount===WEEKLY_CYP_CURRENT_REVISION.consumerSourceDeltas.find(row=>row.family==='MEASUREMENT_UI').currentCount&&proof.ui.runtimeSourceCount===(budgetCounts?.runtimeCount??DOCUMENT_TASK_ASSOCIATION_MEASUREMENT.runtimeSourceCount)&&proof.ui.dependencyCount===2&&proof.ui.integrationSourceCount===1&&proof.ui.apiRequestCount===planMeasurementUiRequestMatrix().length&&proof.ui.httpPostCount===planMeasurementUiRequestMatrix().filter(row=>row.method==='POST').length&&hash(proof.validatorSha256)&&hash(proof.workflowSha256)&&proof.artifactArchiveValidated===false,'Connected exact source receipt required');same(proof.postgres.documentAssociationNative,planMeasurementDocumentNativeProof(),'Connected native document association facts required');documentUiChecks(proof.ui.documentAssociationChecks,proof.ui.documentAssociationCheckLedger);same(proof.ui.widths,PLAN_MEASUREMENT_UI_WIDTHS,'Connected responsive width matrix');same(proof.postgres.sourceLineage,PARTICIPANT_PREANALYSIS_CURRENT_REVISION.consumerSourceDeltas.find(row=>row.family==='PLAN_MEASUREMENT')||null,'Connected current and historical source lineage required');same(proof.postgres.integratedSourceLineage,INTEGRATED_IDENTITY_CURRENT_REVISION.consumerSourceDeltas.find(row=>row.family==='PLAN_MEASUREMENT')||null,'Exact additive integrated source lineage required');same(proof.ciRun,ciRun,'Upload binding actual run');const identity=planMeasurementUiSourceIdentity({head:expectedHead,sourceTree:proof.sourceTree,trackedClean:true,expectedHead,environment:{CI:'true',GITHUB_SHA:expectedHead,GITHUB_REPOSITORY:ciRun?.repository,GITHUB_WORKFLOW:ciRun?.workflow,GITHUB_RUN_ID:String(ciRun?.runId),GITHUB_RUN_ATTEMPT:String(ciRun?.runAttempt),GITHUB_EVENT_NAME:ciRun?.event}});same(ciRun,identity.ciRun,'Actual upload run identity');guard(Array.isArray(proof.inputProofs)&&proof.inputProofs.length===2,'Connected raw producer input hashes required');for(const [index,row]of proof.inputProofs.entries())guard(row&&Object.keys(row).sort().join(',')==='path,sha256'&&row.path===PLAN_MEASUREMENT_PROOF_PATHS[index===0?'postgres':'ui']&&hash(row.sha256),'Connected input must bind exact bounded raw producer path/hash');guard(Array.isArray(artifacts)&&artifacts.length===2,'Both actual producer artifacts required');const found=new Set();for(const [index,row]of artifacts.entries()){const kind=index===0?'postgres':'ui',name='plan-measurement-'+kind+'-'+expectedHead+'-'+ciRun.runAttempt;guard(row?.kind===kind&&row.name===name&&Number.isSafeInteger(row.id)&&row.id>0&&!found.has(row.id)&&hash(row.archiveSha256)&&row.url==='https://github.com/inguillen87/obrasaas/actions/runs/'+ciRun.runId+'/artifacts/'+row.id,'Actual uploaded producer ID/name/archive digest/URL required');found.add(row.id);}
 verifyBindingInputs();
 return {version:'plan-measurement-ci-artifacts-v2',status:'PASS',sourceRevision:expectedHead,sourceTree:proof.sourceTree,ciRun,connectedReceipt:{path:PLAN_MEASUREMENT_PROOF_PATHS.ci,sha256:sha(proofBytes)},inputProofs:proof.inputProofs,artifacts,...(budgetCounts?.sourceCountBinding?{sourceCountBinding:budgetCounts.sourceCountBinding}:{}),digestSource:'ACTIONS_UPLOAD_ARTIFACT_OUTPUT',downloadedArchiveValidated:false,providerCalls:0,productionDataWritten:false};
}
function main(){
 const args=process.argv.slice(2),mode=args[0]==='--preflight'?'preflight':args[0]==='--bind-artifacts'?'bind':'validate',input=mode==='validate'?args:args.slice(1);guard(input.length===2&&input[0]==='--expected-head'&&revision(input[1]),'Usage: [--preflight|--bind-artifacts] --expected-head <full Git SHA>');const expectedHead=input[1],root=realpathSync(process.cwd()),git=(...values)=>execFileSync('git',values,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:24*1024*1024}).trim();guard(process.env.CI==='true','CI validator requires actual CI environment; local evidence remains LOCAL');guard(!process.env.VERCEL&&!process.env.VERCEL_ENV&&!process.env.VERCEL_TARGET_ENV,'Production/provider execution prohibited');
 const head=git('rev-parse','HEAD'),sourceTree=git('rev-parse','HEAD^{tree}'),trackedClean=git('status','--porcelain','--untracked-files=no')==='',identity=planMeasurementUiSourceIdentity({head,sourceTree,trackedClean,expectedHead,environment:process.env}),committed=new Set(git('ls-tree','-r','--name-only',head).split('\n')),gitSources=Object.create(null),readSource=file=>{if(!committed.has(file))return null;if(!Object.hasOwn(gitSources,file))gitSources[file]=execFileSync('git',['show',head+':'+file],{cwd:root,windowsHide:true,maxBuffer:24*1024*1024});return gitSources[file];};
 preloadParticipantPreanalysisConsumerSources({readSource,readCheckout:file=>readFileSync(path.join(root,file))});
 const {nativeClosure,browserClosure,runtimeClosure}=planMeasurementCiSourceClosures(readSource);const files=new Set([validator,workflow,'package.json','package-lock.json','src/app/(identity)/cuenta/workspace-client.js',...nativeClosure.files,...browserClosure.files,...runtimeClosure.files,...Object.keys(gitSources)]);for(const file of files)guard(Buffer.isBuffer(readSource(file))&&sha(readFileSync(path.join(root,file)))===sha(readSource(file)),'Actual checkout differs from committed Git blob: '+file);
 const finalSource=()=>{preloadParticipantPreanalysisConsumerSources({readSource,readCheckout:file=>readFileSync(path.join(root,file))});guard(git('rev-parse','HEAD')===head&&git('rev-parse','HEAD^{tree}')===sourceTree&&git('status','--porcelain','--untracked-files=no')==='','Source changed during validation');for(const file of files)guard(sha(readFileSync(path.join(root,file)))===sha(readSource(file)),'Source bytes changed during validation: '+file);};
 if(mode==='preflight'){for(const filename of Object.values(PLAN_MEASUREMENT_PROOF_PATHS))guard(!existsSync(path.join(root,filename)),'Fresh producer/receipt path required; prior raw proof must be preserved: '+filename);finalSource();console.log(JSON.stringify({status:'PASS',mode:'SOURCE_PREFLIGHT',sourceRevision:head,sourceTree,ciRun:identity.ciRun}));return;}
 let result,target;if(mode==='bind'){const proofBytes=readFileSync(path.join(root,PLAN_MEASUREMENT_PROOF_PATHS.ci)),artifacts=['postgres','ui'].map(kind=>{const prefix='PLAN_MEASUREMENT_'+kind.toUpperCase()+'_ARTIFACT_';return {kind,name:'plan-measurement-'+kind+'-'+head+'-'+identity.ciRun.runAttempt,id:Number(process.env[prefix+'ID']),archiveSha256:process.env[prefix+'DIGEST'],url:process.env[prefix+'URL']};});result=bindPlanMeasurementArtifacts({proofBytes,expectedHead,ciRun:identity.ciRun,artifacts,readSource});target=PLAN_MEASUREMENT_PROOF_PATHS.artifacts;}else{const postgresBytes=readFileSync(path.join(root,PLAN_MEASUREMENT_PROOF_PATHS.postgres)),uiBytes=readFileSync(path.join(root,PLAN_MEASUREMENT_PROOF_PATHS.ui));result=validatePlanMeasurementCi({expectedHead,head,sourceTree,trackedClean,ciRun:identity.ciRun,gitSources,postgresBytes,uiBytes});target=PLAN_MEASUREMENT_PROOF_PATHS.ci;}
 finalSource();for(const row of result.inputProofs)guard(sha(readFileSync(path.join(root,row.path)))===row.sha256,'Raw producer proof changed before receipt emission: '+row.path);if(mode==='bind')guard(sha(readFileSync(path.join(root,PLAN_MEASUREMENT_PROOF_PATHS.ci)))===result.connectedReceipt.sha256,'Connected receipt changed before upload binding');const output=path.join(root,target);mkdirSync(path.dirname(output),{recursive:true});writeFileSync(output,JSON.stringify({...result,checkedAt:new Date().toISOString()},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'PASS',mode,sourceRevision:head,sourceTree,output:target,nativeChecks:DOCUMENT_TASK_ASSOCIATION_MEASUREMENT.nativeCount,uiChecks:DOCUMENT_TASK_ASSOCIATION_MEASUREMENT.uiCount}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{main();}catch(error){console.error(JSON.stringify({status:'FAIL',code:error.code==='PLAN_MEASUREMENT_CI_REJECTED'?error.code:'PLAN_MEASUREMENT_CI_UNCONFIRMED',reason:error.message}));process.exitCode=1;}}
