import {restoreParticipantPreanalysisPreviousContract,restoreParticipantPreanalysisSourceSet} from '../scripts/lib/participant-preanalysis-current-ci-lineage.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {COMPANY_KYC_OUTBOUND_COMPACT_CHECKS,companyKycOutboundCompactSourceFiles} from '../scripts/verify-company-kyc-outbound-compact-postgres.mjs';
import {companyKycOutboundCompactCiSourceClosure} from '../scripts/verify-company-kyc-outbound-compact-ci.mjs';
import {validateContract,currentProducerSourceFiles,kycExpiredCurrentCompositionSelftest} from '../.github/scripts/verify-workspace-ci-parallelization.mjs';
import {KYC_EXPIRED_CURRENT_CONTRACT_PATH,KYC_EXPIRED_CURRENT_ADDITIONS,KYC_EXPIRED_CURRENT_REVIEWED_SOURCES,KYC_EXPIRED_CURRENT_VALIDATION_SOURCES,KYC_EXPIRED_CURRENT_SCENARIOS,KYC_EXPIRED_CURRENT_MEASUREMENTS,kycExpiredCurrentSourceFiles,validateKycExpiredCurrentSourceLineage,validateKycExpiredCurrentWorkspaceContract as validatePublishedH,verifyKycExpiredCurrentSources as verifyPublishedH,validateKycExpiredCurrentReceipt as validatePublishedReceipt} from '../scripts/lib/kyc-expired-current-ci-lineage.mjs';

import {reconstructPublishedHContract,verifyPlanMeasurementCurrentSources,validatePlanMeasurementCurrentCompactReceipt,PLAN_MEASUREMENT_CURRENT_SOURCES} from '../scripts/lib/plan-measurement-current-ci-lineage.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),sha=value=>createHash('sha256').update(value).digest('hex'),readSource=file=>readFileSync(path.join(root,file));
const contract=JSON.parse(readSource(KYC_EXPIRED_CURRENT_CONTRACT_PATH)),section=contract.kycExpiredCurrentComposition;
const currentFiles=kycExpiredCurrentSourceFiles(readSource),previous=restoreParticipantPreanalysisPreviousContract(contract),currentCount=contract.participantPreanalysisCurrentRevision.consumerSourceDeltas.find(row=>row.family==='COMPACT').currentCount;
const validateKycExpiredCurrentWorkspaceContract=value=>{validatePublishedH(value.planMeasurementCurrentLineage?reconstructPublishedHContract(value):value);return value.kycExpiredCurrentComposition;};
const verifyKycExpiredCurrentSources=(value,read)=>contract.planMeasurementCurrentLineage?verifyPlanMeasurementCurrentSources(contract,read):verifyPublishedH(value,read);
const validateKycExpiredCurrentReceipt=(proof,value,read)=>contract.planMeasurementCurrentLineage?validatePlanMeasurementCurrentCompactReceipt(proof,contract,read):validatePublishedReceipt(proof,value,read);
const rejected=run=>assert.throws(run,error=>['KYC_EXPIRED_CURRENT_LINEAGE_REJECTED','PLAN_MEASUREMENT_CURRENT_CI_LINEAGE_REJECTED'].includes(error.code));
function receiptFixture(){
 const context={measurement:{providerPosts:1,replayedPosts:0,sourceLeaseMs:60000,leaseExtended:false,statementDelayMs:225,graphDelayMs:200},consentChosen:false,identitySubmitted:false,privateMediaCalls:0,realProviderCalls:0,productionDataTouched:false,humanAccepted:false};
 return {checks:[...COMPANY_KYC_OUTBOUND_COMPACT_CHECKS],scenarios:KYC_EXPIRED_CURRENT_SCENARIOS.map((name,index)=>({name,providerPosts:index<3||index===10?1:0,...(index<11?{replayedPosts:0}:{})})),measurements:KYC_EXPIRED_CURRENT_MEASUREMENTS.map(kind=>({kind})),syntheticMessagePostCount:4,totalSyntheticMessagePostCount:6,sourceManifest:currentFiles.map(file=>({path:file,sha256:sha(readSource(file))})),
  contextFeedbackNative:{...structuredClone(context),checks:[...section.priorContextChecks]},latestExpiredContextNative:{...structuredClone(context),checks:[...section.composedCurrentChecks],compositionFactory:'createMetaCustomerProductionProcessor',quotedLatestPrompt:true,fixtureConversationExpired:true,challengeStillValid:true,challengeStatus:'CLAIMED',measurement:{...context.measurement,beforeDispatchReads:1,sourceLeaseWrites:1,workerWrites:0},calls:{rejectionRecovery:1,expiryRecovery:1,contextRecovery:1,contextPredispatch:1,intake:0,capture:0,app:0,company:0,field:0,expiryFallback:0,authorizationDefer:0}}};
}
test('H appends its contract while every published field retains the exact previous checksum',()=>{
 const previous=contract.planMeasurementCurrentLineage?reconstructPublishedHContract(contract):structuredClone(contract);delete previous.kycExpiredCurrentComposition;assert.equal(sha(JSON.stringify(previous,null,2)+'\n'),section.previousContractSha256);assert.equal(validateContract(contract),contract);assert.equal(validateKycExpiredCurrentWorkspaceContract(contract),section);
 const changed=structuredClone(contract);changed.extension.proofs[0].producerSha256='f'.repeat(64);rejected(()=>validateKycExpiredCurrentWorkspaceContract(changed));
});
test('all eighteen current producer closures match and retain the published H counts as prior metadata',()=>{
 assert.equal(previous.extension.proofs.length,18);assert.equal(contract.extension.proofs.length,19);for(const spec of contract.extension.proofs)assert.deepEqual(currentProducerSourceFiles(spec,root),[...spec.sourceFiles].sort(),spec.id);assert.equal(previous.extension.proofs.find(spec=>spec.kind==='PG_COMPANY_KYC').sourceFiles.length,220+(contract.planMeasurementCurrentLineage?6:0));assert.equal(contract.extension.proofs.find(spec=>spec.kind==='PG_COMPANY_KYC').sourceFiles.length,230);
});
test('independent runtime AST native and CI current closures agree while the published H125 path set stays intact',()=>{
 const independent=kycExpiredCurrentSourceFiles(readSource);assert.equal(independent.length,currentCount);const publishedCurrent=restoreParticipantPreanalysisSourceSet('COMPACT',independent,contract);assert.equal(publishedCurrent.length,127);assert.deepEqual(publishedCurrent.filter(file=>!contract.planMeasurementCurrentLineage||!PLAN_MEASUREMENT_CURRENT_SOURCES.includes(file)),section.sourceFiles);assert.deepEqual(independent,companyKycOutboundCompactSourceFiles(root));assert.deepEqual(independent,companyKycOutboundCompactCiSourceClosure(readSource).files);assert.equal(verifyKycExpiredCurrentSources(section,readSource).sourceCount,currentCount);
});
test('117 historical paths remain exact before the eight separately declared current runtime additions',()=>{
 const old=section.sourceFiles.filter(file=>!KYC_EXPIRED_CURRENT_ADDITIONS.includes(file));assert.equal(old.length,117);assert.equal(sha(JSON.stringify(old)),section.previousSourcePathsSha256);rejected(()=>validateKycExpiredCurrentSourceLineage(old));
 for(const edit of [files=>files.pop(),files=>{files[0]='src/lib/foreign.mjs';files.sort();},files=>{files[1]=files[0];},files=>files.reverse()]){const files=[...section.sourceFiles];edit(files);rejected(()=>validateKycExpiredCurrentSourceLineage(files));}
});
test('missing runtime dependencies cannot be hidden by a declared125 count',()=>{
 for(const file of KYC_EXPIRED_CURRENT_ADDITIONS)rejected(()=>verifyKycExpiredCurrentSources(section,name=>name===file?null:readSource(name)));
});
test('reviewed factory runtime native and regression bytes are bound independently of a mutable closure',()=>{
 for(const ref of KYC_EXPIRED_CURRENT_REVIEWED_SOURCES)rejected(()=>verifyKycExpiredCurrentSources(section,file=>file===ref.path?Buffer.concat([readSource(file),Buffer.from('\n// substituted source\n')]):readSource(file)));
 const changed=structuredClone(contract);changed.kycExpiredCurrentComposition.reviewedSources[0].sha256=section.previousProducerSha256;rejected(()=>validateKycExpiredCurrentWorkspaceContract(changed));
});
test('new validator helper and guard test bytes need their own committed pins',()=>{
 for(const file of KYC_EXPIRED_CURRENT_VALIDATION_SOURCES){rejected(()=>verifyKycExpiredCurrentSources(section,name=>name===file?Buffer.concat([readSource(file),Buffer.from('\n// changed validator\n')]):readSource(name)));const changed=structuredClone(contract);changed.kycExpiredCurrentComposition.validationSources=changed.kycExpiredCurrentComposition.validationSources.filter(ref=>ref.path!==file);rejected(()=>validateKycExpiredCurrentWorkspaceContract(changed));}
 const old=structuredClone(contract);old.kycExpiredCurrentComposition.validationSources.find(ref=>ref.path==='scripts/verify-company-kyc-outbound-compact-ci.mjs').sha256=section.previousValidatorSha256;rejected(()=>validateKycExpiredCurrentWorkspaceContract(old));
});
test('source graph rejects computed remote outside encoding and unreadable dependencies without executing them',()=>{
 const producer=section.nativeProducer;for(const addition of ['\nexport const hidden=()=>import(unbounded);','\nimport "https://foreign.invalid/no.mjs";','\nimport "../../../../outside.mjs";'])rejected(()=>kycExpiredCurrentSourceFiles(file=>file===producer?Buffer.concat([readSource(file),Buffer.from(addition)]):readSource(file)));
 rejected(()=>kycExpiredCurrentSourceFiles(file=>file==='src/lib/meta-customer-processing-runtime.mjs'?Buffer.from([255]):readSource(file)));
});
test('a pure receipt binds all validation bytes separately without inventing native or human acceptance',()=>{
 const proof=receiptFixture(),before=JSON.stringify(proof),lineage=validateKycExpiredCurrentReceipt(proof,section,readSource);assert.equal(JSON.stringify(proof),before);assert.equal(lineage.sourceCount,currentCount);assert.equal(lineage.previousSourceCount,contract.planMeasurementCurrentLineage?125:117);assert.equal(lineage.totalPostCount,6);assert.equal(lineage.nativeManifestSha256,sha(JSON.stringify(proof.sourceManifest)));
 assert.deepEqual(lineage.validationSourceManifest.map(ref=>ref.path),[KYC_EXPIRED_CURRENT_CONTRACT_PATH,...(contract.planMeasurementCurrentLineage?contract.planMeasurementCurrentLineage.currentValidationSources.map(ref=>ref.path):KYC_EXPIRED_CURRENT_VALIDATION_SOURCES)]);for(const ref of lineage.validationSourceManifest)assert.equal(ref.sha256,sha(readSource(ref.path)));assert.equal(Object.hasOwn(lineage,'humanAccepted'),false);
});
test('thirteen historical checks scenarios and three measurements cannot be reordered removed or replaced',()=>{
 for(const edit of [proof=>proof.checks.pop(),proof=>proof.checks.reverse(),proof=>{proof.checks[1]=proof.checks[0];},proof=>proof.scenarios.reverse(),proof=>proof.scenarios.pop(),proof=>proof.measurements.reverse(),proof=>proof.measurements.pop()]){const proof=receiptFixture();edit(proof);rejected(()=>validateKycExpiredCurrentReceipt(proof,section,readSource));}
});
test('a blanket6 counter cannot substitute historical four prior one and composed current one',()=>{
 for(const edit of [proof=>{proof.syntheticMessagePostCount=6;proof.contextFeedbackNative.measurement.providerPosts=0;proof.latestExpiredContextNative.measurement.providerPosts=0;},proof=>{proof.scenarios[0].providerPosts=0;proof.scenarios[3].providerPosts=1;},proof=>{proof.totalSyntheticMessagePostCount=5;},proof=>{proof.latestExpiredContextNative=proof.contextFeedbackNative;},proof=>{proof.contextFeedbackNative=proof.latestExpiredContextNative;}]){const proof=receiptFixture();edit(proof);rejected(()=>validateKycExpiredCurrentReceipt(proof,section,readSource));}
});
test('current composition requires each observed recovery exact source claim and zero alternate execution',()=>{
 for(const edit of [proof=>{proof.latestExpiredContextNative.compositionFactory='assumed-equivalent';},proof=>{proof.latestExpiredContextNative.quotedLatestPrompt=false;},proof=>{proof.latestExpiredContextNative.challengeStillValid=false;},proof=>{proof.latestExpiredContextNative.calls.intake=1;},proof=>{proof.latestExpiredContextNative.calls.expiryRecovery=0;},proof=>{proof.latestExpiredContextNative.measurement.sourceLeaseWrites=2;},proof=>{proof.latestExpiredContextNative.measurement.beforeDispatchReads=0;},proof=>{proof.latestExpiredContextNative.measurement.workerWrites=1;}]){const proof=receiptFixture();edit(proof);rejected(()=>validateKycExpiredCurrentReceipt(proof,section,readSource));}
});
test('replay changedlease changedlatency private capture and real acceptance cannot enter either feedback group',()=>{
 for(const group of ['contextFeedbackNative','latestExpiredContextNative'])for(const [key,value]of [['replayedPosts',1],['sourceLeaseMs',120000],['leaseExtended',true],['statementDelayMs',0],['graphDelayMs',0]]){const proof=receiptFixture();proof[group].measurement[key]=value;rejected(()=>validateKycExpiredCurrentReceipt(proof,section,readSource));}
 for(const group of ['contextFeedbackNative','latestExpiredContextNative'])for(const [key,value]of [['consentChosen',true],['identitySubmitted',true],['privateMediaCalls',1],['realProviderCalls',1],['productionDataTouched',true],['humanAccepted',true]]){const proof=receiptFixture();proof[group][key]=value;rejected(()=>validateKycExpiredCurrentReceipt(proof,section,readSource));}
});
test('old missing duplicate samecount foreign and stale native manifests cannot claim current composition',()=>{
 for(const edit of [proof=>{proof.sourceManifest=proof.sourceManifest.filter(ref=>!KYC_EXPIRED_CURRENT_ADDITIONS.includes(ref.path));},proof=>proof.sourceManifest.pop(),proof=>{proof.sourceManifest[1]={...proof.sourceManifest[0]};},proof=>{proof.sourceManifest[0].path='src/lib/foreign.mjs';},proof=>{proof.sourceManifest[0].sha256='f'.repeat(64);},proof=>{proof.sourceManifest[0].implicitApproval=true;}]){const proof=receiptFixture();edit(proof);rejected(()=>validateKycExpiredCurrentReceipt(proof,section,readSource));}
});
test('official index exposes source and contract negatives without certification of dirty local evidence',()=>{
 const checks=kycExpiredCurrentCompositionSelftest(contract,root);assert.ok(checks.length>=35);assert.ok(checks.every(check=>check.result==='PASS'));assert.ok(checks.every(check=>typeof check.boundary==='string'));assert.equal(checks.some(check=>check.sourceState==='EXACT_CI_SOURCE'),false);
});
