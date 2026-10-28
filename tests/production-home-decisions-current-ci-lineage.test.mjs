import historicalWeeklyRuntime from './fixtures/plan-budget-weekly-164-runtime.json' with {type:'json'};
import {planBudgetValidationFiles,restorePlanBudgetPreviousContract,planBudgetCurrentBrowserBinding,planBudgetCompiledProof,verifyPlanBudgetCurrentSources,planBudgetCurrentSourcePin,restorePilotCompletionPreviousContract,restorePilotCompletionPreviousSourceText} from '../scripts/lib/plan-budget-current-ci-lineage.mjs';
import {PLAN_PARTIDA_PREVIEW_CURRENT_REVISION} from '../scripts/lib/plan-partida-preview-current-ci-lineage.mjs';
import {restoreWorksiteLiveHoursPreviousContract,restoreWorksiteLiveHoursSourceSet,worksiteLiveHoursCurrentSourcePin,worksiteLiveHoursValidationFiles} from '../scripts/lib/worksite-live-hours-current-ci-lineage.mjs';
import {IDENTITY_DESTINATION_UX_CURRENT_REVISION as destinationExpected,IDENTITY_DESTINATION_UX_CURRENT_SECTION as destinationKey,restoreIdentityDestinationUxPreviousContract,identityDestinationUxCurrentSourcePin,identityDestinationUxPreviousSourcePin,restoreIdentityDestinationUxPreviousProducerText,identityDestinationUxProofSourceAdditions,verifyIdentityDestinationUxCurrentSources,validateIdentityDestinationUxBrowserSupplement,identityDestinationUxBrowserShadow} from '../scripts/lib/home-decisions-current-ci-lineage.mjs';
import {PROGRESS_EVIDENCE_WAIT_CURRENT_REVISION as waitExpected,PROGRESS_EVIDENCE_WAIT_CURRENT_SECTION as waitKey,restoreProgressEvidenceWaitPreviousContract,progressEvidenceWaitCurrentSourcePin,progressEvidenceWaitPreviousSourcePin,verifyProgressEvidenceWaitCurrentSources,validateProgressEvidenceWaitNativeProofBytes,validateProgressEvidenceWaitCompanyFacts} from '../scripts/lib/home-decisions-current-ci-lineage.mjs';
import {COMPANY_ONBOARDING_UX_CURRENT_REVISION as companyExpected,COMPANY_ONBOARDING_UX_CURRENT_SECTION as companyKey,restoreCompanyOnboardingUxPreviousContract,companyOnboardingUxCurrentSourcePin,companyOnboardingUxPreviousSourcePin,verifyCompanyOnboardingUxCurrentSources,companyOnboardingUxHistoricalFocusedAssertions,COMPANY_ONBOARDING_UX_NATIVE_REVIEW,validateCompanyOnboardingUxNativeSourceManifest,validateCompanyOnboardingUxNativeProofBytes} from '../scripts/lib/home-decisions-current-ci-lineage.mjs';
import {WEEKLY_CYP_CURRENT_REVISION as weeklyExpected,WEEKLY_CYP_CURRENT_SECTION as weeklyKey,restoreWeeklyCypPreviousContract,weeklyCypCurrentSourcePin,weeklyCypPreviousSourcePin,weeklyCypProofSourceAdditions,verifyWeeklyCypCurrentSources,weeklyCypInvestmentUiSourceFiles,validateWeeklyCypImportUiProofBytes,weeklyCypImportUiShadowFixture,restoreWeeklyCypConsumerSourceSet} from '../scripts/lib/home-decisions-current-ci-lineage.mjs';
import {canonicalParticipantKycSourceFiles} from '../scripts/fixtures/canonical-participant-kyc.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import yaml from 'js-yaml';
import {createHash} from 'node:crypto';
import {parse} from '@babel/parser';
import {HOME_DECISIONS_CURRENT_REVISION as expected,HOME_DECISIONS_CURRENT_SECTION as key,restoreHomeDecisionsPreviousContract,homeDecisionsCurrentSourcePin,homeDecisionsValidationFiles,verifyHomeDecisionsCurrentSources,restoreHomeDecisionsSourceSet,homeDecisionsProofSourceAdditions,homeDecisionsLegacyOperationsAst,normalizeHomeDecisionsFocusedRaw,validateHomeDecisionsNativeProof,validateHomeDecisionsFieldProof,CUSTOMER_PHONE_SELECTION_CURRENT_REVISION as phoneExpected,CUSTOMER_PHONE_SELECTION_CURRENT_SECTION as phoneKey,restoreCustomerPhoneSelectionPreviousContract,customerPhoneSelectionCurrentSourcePin,customerPhoneSelectionPreviousSourcePin,customerPhoneSelectionValidationFiles,verifyCustomerPhoneSelectionCurrentSources,normalizeCustomerPhoneSelectionNativeProof,PARTICIPANT_DRAFT_SAFETY_CURRENT_REVISION as draftExpected,PARTICIPANT_DRAFT_SAFETY_CURRENT_SECTION as draftKey,restoreParticipantDraftSafetyPreviousContract,participantDraftSafetyCurrentSourcePin,participantDraftSafetyPreviousSourcePin,verifyParticipantDraftSafetyCurrentSources} from '../scripts/lib/home-decisions-current-ci-lineage.mjs';
import {restoreExistingApiPlanPreviousContract,verifyExistingApiPlanCurrentSources} from '../scripts/lib/meta-existing-api-plan-current-ci-lineage.mjs';
import {verifyMaterialReviewCurrentSources} from '../scripts/lib/material-review-current-ci-lineage.mjs';
import {WHATSAPP_FIELD_CONTINUITY_FOCUSED_UI as previousFocused,verifyWhatsappFieldContinuityCurrentSources} from '../scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs';
import {fieldOutboundCurrentSourcePin} from '../scripts/lib/field-outbound-current-ci-lineage.mjs';
import {currentProducerSourceFiles,retainWeeklyCypImportUiScreenshots,validateWeeklyCypRetainedScreenshotBindings} from '../.github/scripts/verify-workspace-ci-parallelization.mjs';
const read=file=>existsSync(file)?readFileSync(file):null;
const current=()=>JSON.parse(read('.github/workspace-acceptance-contract.json'));
// Decoder shadow only: the actual current producer requires all57 controls.
const syncFenceNativeShadow=historical=>({checks:[...historical,...["native-sync-membership-changed-after-reservation-denies-POST-and-keeps-nonreplayable-receipt","native-sync-token-changed-after-reservation-denies-POST-and-keeps-nonreplayable-receipt","native-sync-lease-changed-after-reservation-denies-POST-and-keeps-nonreplayable-receipt","native-six-second-signed-callback-timeout-during-eight-second-accepted-sync-re-delivers-durably-and-idempotently-with-one-POST","native-six-second-signed-callback-timeout-during-eight-second-lost-sync-response-preserves-uncertainty-and-re-delivers-without-repeated-POST"]],slowSyncCallbackTimings:['accepted','response-lost'].map(variant=>({variant,firstCallbackStatus:503,retryStatus:200,firstCallbackElapsedMs:6000,postElapsedMs:8000,posts:1,reDeliveredSameSignedBytes:true,realProviderCalls:0}))});
const sha=value=>createHash('sha256').update(value).digest('hex');
// Historical decoder fixture ONLY. Current source gates keep using read().
// Authenticate the current producer before substituting this explicit static
// 164-source preimage inside the two historical decoder/retention tests.
function historicalWeeklySource(){
 const contract=current(),binding=planBudgetCurrentBrowserBinding(contract,PLAN_PARTIDA_PREVIEW_CURRENT_REVISION.browser),actualFiles=weeklyCypInvestmentUiSourceFiles(read);
 assert.equal(verifyPlanBudgetCurrentSources(contract,read).nativeOrBrowserAcceptance,false);assert.equal(actualFiles.length,binding.investmentSourceCount);assert.equal(sha(JSON.stringify(actualFiles)),binding.investmentSourcePathsSha256);
 const fixtureRaw=read('tests/fixtures/plan-budget-weekly-164-runtime.json');assert.equal(Buffer.from(fixtureRaw.toString('utf8')).equals(fixtureRaw),true);const fixtureBytes=Buffer.from(fixtureRaw.toString('utf8').replaceAll('\r\n','\n'));assert.equal(sha(fixtureBytes),'ac1e1e5f5d538b304987b1fd4ad6ebff766a7b2175ffc5b53cb785bc9917d416');assert.deepEqual(JSON.parse(fixtureBytes),historicalWeeklyRuntime);
 assert.deepEqual(Object.keys(historicalWeeklyRuntime).sort(),['classification','files','sourceRevision','sourceTree','version']);assert.equal(historicalWeeklyRuntime.version,1);assert.equal(historicalWeeklyRuntime.classification,'HISTORICAL_WEEKLY164_RUNTIME_SOURCE_ONLY_NOT_CURRENT_OR_EXECUTION');assert.equal(historicalWeeklyRuntime.sourceRevision,'00cedd4175e93ce3731f93b97ec7f0859ffa034b');assert.equal(historicalWeeklyRuntime.sourceTree,'0a8b1862466a1a3cab60b6336365d58bfa4b7b18');
 const expected=[{"path":"src/lib/plan-import-analyzer.mjs","sha256":"0427c7fbdf0ba27b07c328661e52731c996e0a7b5f0749dcc6207410b28c52bb"},{"path":"src/lib/plan-import-policy.mjs","sha256":"f2d73b8c58df571fb0dc6e5d76e2fb5d60daffa6ed6a41bc2be3c7e536458696"},{"path":"src/lib/plan-import-store.mjs","sha256":"455c06e64301b2679e1278cc288cd4b06c875a222339e15c6720c58bc1f011c2"}],previous=new Map();assert.deepEqual(historicalWeeklyRuntime.files.map(row=>({path:row.path,sha256:row.sha256})),expected);
 for(const row of historicalWeeklyRuntime.files){assert.deepEqual(Object.keys(row).sort(),['path','sha256','source']);assert.equal(typeof row.source,'string');const bytes=Buffer.from(row.source);assert.equal(sha(bytes),row.sha256);assert.equal(contract.planBudgetCurrentRevision.references.find(ref=>ref.path===row.path).previousSha256,row.sha256);previous.set(row.path,bytes);}
 const producer=Buffer.from(readFileSync('tests/fixtures/plan-partida-preview-weekly-164-producer.txt','utf8').replaceAll('\r\n','\n'));assert.equal(sha(producer),weeklyExpected.browser.producerLfSha256);
 // Only the two historical decoder tests receive these preimages. Current
 // validation always keeps read(); these buffers are never current proof bytes.
 return file=>{
  const actual=read(file),bytes=actual&&Buffer.from(actual.toString('utf8').replaceAll('\r\n','\n'));
  if(file===weeklyExpected.browser.producer){assert.equal(sha(bytes),worksiteLiveHoursCurrentSourcePin(contract,{path:file,sha256:weeklyExpected.browser.producerLfSha256}));return Buffer.from(producer);}
  if(previous.has(file)){const ref=expected.find(row=>row.path===file);assert.equal(sha(bytes),planBudgetCurrentSourcePin(contract,ref));return Buffer.from(previous.get(file));}
  return bytes;
 };
}
// Explicit historical B frame for the legacy checks below. Current source
// verifiers, producer closures and receipts keep using current() and read().
let historicalPilotBCache;
function historicalPilotBFrame(){
 if(!historicalPilotBCache){
  const actualContract=current();
  assert.equal(verifyPlanBudgetCurrentSources(actualContract,read).nativeOrBrowserAcceptance,false);
  const previous=restorePilotCompletionPreviousContract(actualContract,read),contractJson=JSON.stringify(previous,null,2)+'\n';
  assert.equal(sha(contractJson),'4d813ad4f40496d1355b2820607d138d899ea51d336ab176c9fb2febe6ce9a00');
  const changes=new Map(actualContract.planBudgetCurrentRevision.pilotCompletionAdvance.sourceChanges.map(row=>[row.path,row]));
  const cache=new Map([['.github/workspace-acceptance-contract.json',Buffer.from(contractJson)]]);
  const readSource=file=>{
   if(changes.get(file)?.status==='ADDED')return null;
   if(cache.has(file))return Buffer.from(cache.get(file));
   const actual=read(file);if(actual===null)return null;
   const decoded=actual.toString('utf8');assert.equal(actual.equals(Buffer.from(decoded)),true,'Historical source must be UTF-8: '+file);
   const text=changes.has(file)||file==='scripts/lib/plan-budget-current-ci-reviewed.mjs'
    ?restorePilotCompletionPreviousSourceText(actualContract,file,decoded)
    :decoded.replaceAll('\r\n','\n');
   const bytes=Buffer.from(text);cache.set(file,bytes);return Buffer.from(bytes);
  };
  historicalPilotBCache={contractJson,readSource};
 }
 return {contract:JSON.parse(historicalPilotBCache.contractJson),readSource:historicalPilotBCache.readSource};
}
const serialize=value=>JSON.stringify(value,null,2)+'\n';
const denied=run=>assert.throws(run,{code:'HOME_DECISIONS_CURRENT_CI_LINEAGE_REJECTED'});
// Exercise the original metadata oracle as well as the full current denial.
function historicalMutation(edit,restore){const historical=restorePlanBudgetPreviousContract(current());edit(historical);denied(()=>restore(historical));}
function historicalWeeklyInvestmentFiles(source){
 const contract=current(),previous=restorePlanBudgetPreviousContract(contract),actual=weeklyCypInvestmentUiSourceFiles(read),binding=planBudgetCurrentBrowserBinding(contract,PLAN_PARTIDA_PREVIEW_CURRENT_REVISION.browser);
 assert.equal(verifyPlanBudgetCurrentSources(contract,read).nativeOrBrowserAcceptance,false);assert.equal(actual.length,binding.investmentSourceCount);assert.equal(sha(JSON.stringify(actual)),binding.investmentSourcePathsSha256);
 const b=historicalPilotBFrame(),bFiles=weeklyCypInvestmentUiSourceFiles(b.readSource),bBinding=planBudgetCurrentBrowserBinding(b.contract,PLAN_PARTIDA_PREVIEW_CURRENT_REVISION.browser);assert.equal(bFiles.length,bBinding.investmentSourceCount);assert.equal(sha(JSON.stringify(bFiles)),bBinding.investmentSourcePathsSha256);const historical=weeklyCypInvestmentUiSourceFiles(source);assert.deepEqual(bFiles,[...historical,'src/lib/plan-budget-source.mjs'].sort());assert.equal(historical.length,previous.weeklyCypCurrentRevision.browser.investmentSourceCount);assert.equal(sha(JSON.stringify(historical)),previous.weeklyCypCurrentRevision.browser.investmentSourcePathsSha256);return historical;
}
const syntax=value=>Array.isArray(value)?value.map(syntax):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>!['start','end','loc','extra','comments','leadingComments','innerComments','trailingComments'].includes(key)).map(([key,child])=>[key,syntax(child)])):value;

test('home decisions restores the complete published2b contract and every inherited layer without mutating input',()=>{
 const contract=current(),before=serialize(contract),previous=restoreHomeDecisionsPreviousContract(contract);
 assert.equal(expected.predecessorCommit,'2b98984628761783ba7bd7e6543dbe1d76c0203c');assert.equal(sha(serialize(previous)),'fe3fbd513518951d4e9625f0c76d89bd5c178919d923d3a385f32ab7c787590e');assert.equal(Object.hasOwn(previous,key),false);assert.equal(serialize(contract),before);
 for(const field of ['blocks','lanes','artifactPatterns','existingApiPlanCurrentRevision','materialReviewCurrentRevision','whatsappFieldContinuityCurrentRevision'])assert.deepEqual(previous[field],restorePlanBudgetPreviousContract(contract)[field]);
 const previousRecords=structuredClone(restoreWeeklyCypPreviousContract(contract).evidenceProducers);for(const delta of expected.proofProducerDeltas)previousRecords.find(row=>row.path===delta.path&&row.producer===delta.producer).producerSha256=delta.previousProducerSha256;assert.deepEqual(previous.evidenceProducers,previousRecords);
 assert.equal(sha(serialize(restoreExistingApiPlanPreviousContract(contract))),'8ec3226f985366168e3a6eb873a6f282bfa91778260e15c724ee208814f88b09');
});

test('current bytes authenticate only reviewed sources and every missing foreign validator or source is rejected',()=>{
 const contract=current(),result=verifyHomeDecisionsCurrentSources(contract,read);assert.equal(result.completePreviousContractRestored,true);assert.equal(result.nativeOrBrowserAcceptance,false);
 const copier='scripts/lib/plan-document-curve-fixture-copy.mjs';assert.equal(homeDecisionsValidationFiles(contract).includes(copier),true);assert.equal(homeDecisionsValidationFiles(restoreWeeklyCypPreviousContract(contract)).includes(copier),false);for(const ref of contract[weeklyKey].validationSources)assert.equal(homeDecisionsValidationFiles(contract).includes(ref.path),true);
 for(const file of homeDecisionsValidationFiles(contract))for(const substituted of [null,Buffer.from('foreign source bytes')])denied(()=>verifyHomeDecisionsCurrentSources(contract,path=>path===file?substituted:read(path)));
 for(const verify of [verifyExistingApiPlanCurrentSources,verifyMaterialReviewCurrentSources,verifyWhatsappFieldContinuityCurrentSources])assert.equal(verify(contract,read).nativeOrBrowserAcceptance,false);
});

test('exact predecessor current pins advance while foreign aliases cannot be silently resealed',()=>{
 const contract=current();for(const row of [...expected.reviewedSourceChanges,...expected.validationDeltas]){
  for(const pin of [row.previousSha256,row.currentSha256])assert.equal(homeDecisionsCurrentSourcePin(contract,{path:row.path,sha256:pin}),customerPhoneSelectionCurrentSourcePin(contract,{path:row.path,sha256:row.currentSha256}));
  denied(()=>homeDecisionsCurrentSourcePin(contract,{path:row.path,sha256:'f'.repeat(64)}));
 }
});

test('customer phone companion restores exact8599969 without changing historical Home metadata or any source set',()=>{
 const contract=current(),before=serialize(contract),previous=restoreCustomerPhoneSelectionPreviousContract(contract);
 assert.equal(phoneExpected.predecessorCommit,'8599969a1072c9b8e1afac0640df6a69219968b3');assert.equal(sha(serialize(previous)),'d3e0a5af11643ad3b5fb3c3ebb046edfc6f796a0142b23e1b604d0b15c14d5cb');assert.equal(Object.hasOwn(previous,phoneKey),false);assert.equal(serialize(contract),before);
 for(const field of Object.keys(previous))assert.deepEqual(restoreCompanyOnboardingUxPreviousContract(contract)[field],previous[field],'Published8599969 field remains byte-equivalent: '+field);
 assert.deepEqual(previous[key],contract[key]);assert.deepEqual(contract[key].reviewedSourceChanges,expected.reviewedSourceChanges);assert.equal(verifyCustomerPhoneSelectionCurrentSources(contract,read).nativeOrBrowserAcceptance,false);
 for(const spec of contract.extension.proofs)assert.deepEqual(currentProducerSourceFiles(spec,process.cwd()),spec.sourceFiles,'No source closure growth: '+spec.id);
});

test('customer phone source pins authenticate only the exact8599969 and reviewed current bytes',()=>{
 const contract=current(),value=contract[phoneKey],refs=[...value.reviewedSourceChanges,...value.validationPredecessors.map(row=>({path:row.path,previousSha256:row.sha256,currentSha256:value.validationSources.find(ref=>ref.path===row.path).sha256}))];
 for(const row of refs){
  for(const pin of [row.previousSha256,row.currentSha256])assert.equal(customerPhoneSelectionCurrentSourcePin(contract,{path:row.path,sha256:pin}),participantDraftSafetyCurrentSourcePin(contract,{path:row.path,sha256:row.currentSha256}));
  assert.equal(customerPhoneSelectionPreviousSourcePin(contract,{path:row.path,sha256:customerPhoneSelectionCurrentSourcePin(contract,{path:row.path,sha256:row.currentSha256})}),row.previousSha256);
  denied(()=>customerPhoneSelectionCurrentSourcePin(contract,{path:row.path,sha256:'f'.repeat(64)}));
 }
 for(const file of customerPhoneSelectionValidationFiles(contract)){
  for(const replacement of [null,Buffer.from('unreviewed source')])denied(()=>verifyCustomerPhoneSelectionCurrentSources(contract,path=>path===file?replacement:read(path)));
 }
 denied(()=>verifyHomeDecisionsCurrentSources(restoreCustomerPhoneSelectionPreviousContract(contract),read));
});

test('customer phone companion rejects omitted duplicated reordered and tampered deltas or validators and modified predecessor fields',()=>{
 for(const edit of [
  c=>c[phoneKey].reviewedSourceChanges.pop(),c=>c[phoneKey].reviewedSourceChanges.push(c[phoneKey].reviewedSourceChanges[0]),c=>c[phoneKey].reviewedSourceChanges.reverse(),c=>{c[phoneKey].reviewedSourceChanges[0].previousSha256='f'.repeat(64);},c=>{c[phoneKey].reviewedSourceChanges[0].currentSha256='f'.repeat(64);},
  c=>c[phoneKey].validationSources.pop(),c=>c[phoneKey].validationSources.push(c[phoneKey].validationSources[0]),c=>c[phoneKey].validationSources.reverse(),c=>{c[phoneKey].validationSources[0].sha256='f'.repeat(64);},c=>{c[phoneKey].validationSources[0].path='scripts/lib/foreign-same-count.mjs';},
  c=>{c[phoneKey].previousContractSha256='f'.repeat(64);},c=>{c[phoneKey].nativeOrBrowserAcceptance=true;},c=>{c[key].validationSources[0].sha256=c[phoneKey].validationSources[0].sha256;},c=>c.blocks[0].step.run+='\ntrue',c=>c.extension.proofs[0].sourceFiles.pop()
 ]){historicalMutation(edit,restoreCustomerPhoneSelectionPreviousContract);const changed=current();edit(changed);denied(()=>verifyCustomerPhoneSelectionCurrentSources(changed,read));}
 const missing=current();delete missing[phoneKey];denied(()=>verifyHomeDecisionsCurrentSources(missing,read));
});

test('all52 current native controls are required before exact historical41 projection and the raw proof remains untouched',()=>{
 const contract=current(),previous=restoreCustomerPhoneSelectionPreviousContract(contract),old=previous.existingApiPlanCurrentRevision.native.currentCheckNames,checks=[...old,...phoneExpected.native.addedCheckNames],proof={status:'PASS',environment:'local-disposable-postgresql17',...syncFenceNativeShadow(checks),realProviderCalls:0,physicalNumberTested:false,productionDataTouched:false},before=serialize(proof);
 assert.equal(old.length,41);assert.equal(phoneExpected.native.addedCheckNames.length,11);assert.equal(checks.length,52);assert.equal(proof.checks.length,57);denied(()=>normalizeCustomerPhoneSelectionNativeProof({...proof,checks},contract,read));
 assert.deepEqual(normalizeCustomerPhoneSelectionNativeProof(proof,contract,read),{...proof,checks:old});assert.equal(serialize(proof),before);
 const historical={...proof,checks:old};assert.equal(normalizeCustomerPhoneSelectionNativeProof(historical,previous,read),historical);
 for(const patch of [{checks:old},{checks:checks.slice(0,50)},{checks:checks.slice(1)},{checks:checks.slice(0,-1)},{checks:[...checks,checks.at(-1)]},{checks:[...checks.slice(0,-1),'foreign-same-count-control']},{checks:[...checks].reverse()},{realProviderCalls:1},{physicalNumberTested:true},{productionDataTouched:true},{status:'FAILED'},{environment:'production'}])denied(()=>normalizeCustomerPhoneSelectionNativeProof({...proof,...patch},contract,read));
});

test('the exact operations read projection preserves every inherited authority HTTP guard and full read query',()=>{
 const c=current(),file='src/lib/operations-status.mjs',raw=read(file);
 assert.equal(verifyPlanBudgetCurrentSources(c,read).nativeOrBrowserAcceptance,false);
 const source=restorePilotCompletionPreviousSourceText(c,file,raw.toString('utf8')),project=value=>sha(JSON.stringify(syntax(homeDecisionsLegacyOperationsAst(parse(value,{sourceType:'module'})))));
 assert.equal(project(source),expected.operationsProjection.previousAstSha256);
 for(const [before,after] of [['requireWorkspaceIdentity(session)','void session'],['workspace.integrationProject(session,context,false','workspace.integrationProject(session,context,true'],["request.method!=='GET'","request.method!=='POST'"],["canApproveProgress(member.role)","true"],["params.getAll(k).length!==1","false"]]){assert.ok(source.includes(before));assert.notEqual(project(source.replace(before,after)),expected.operationsProjection.previousAstSha256);}
});

test('actual producer import graphs add only the authenticated helper and preserve historical proof counts',()=>{
 const contract=current(),inherited=restoreWeeklyCypPreviousContract(contract),previous=restoreHomeDecisionsPreviousContract(contract);assert.equal(expected.proofSourceDeltas.length,3);
 for(const observed of contract.extension.proofs){
  assert.deepEqual(currentProducerSourceFiles(observed,process.cwd()),observed.sourceFiles,'Actual current import closure '+observed.id);assert.equal(observed.producerSha256,sha(read(observed.producer).toString('utf8').replaceAll('\r\n','\n')),'Every official producer pin binds the actual LF source: '+observed.id);
  if(observed.id===planBudgetCompiledProof(contract).id){assert.deepEqual(observed,planBudgetCompiledProof(contract));continue;}
  const spec=inherited.extension.proofs.find(row=>row.id===observed.id),old=previous.extension.proofs.find(row=>row.id===spec.id),producer=expected.proofProducerDeltas.find(row=>row.id===spec.id);assert.deepEqual(spec.checkNames,old.checkNames);assert.equal(spec.producerSha256,producer?.currentProducerSha256??old.producerSha256);assert.equal(old.producerSha256,producer?.previousProducerSha256??spec.producerSha256);
  const delta=expected.proofSourceDeltas.find(row=>row.id===spec.id);if(!delta){assert.deepEqual(spec.sourceFiles,old.sourceFiles);continue;}
  assert.equal(delta.currentCount,delta.previousCount+1);assert.deepEqual(delta.additions,['scripts/lib/home-decisions-current-ci-lineage.mjs']);assert.deepEqual(restoreHomeDecisionsSourceSet(delta.family,observed.sourceFiles,contract),old.sourceFiles);assert.deepEqual(homeDecisionsProofSourceAdditions(observed),[...delta.additions,...weeklyCypProofSourceAdditions(observed)]);assert.deepEqual(homeDecisionsProofSourceAdditions(old),[]);
 }
});

test('the sole current focused producer and evidence record advance together and reject omissions tampering duplicates or old-as-current pins',()=>{
 const contract=current(),previous=restoreHomeDecisionsPreviousContract(contract);assert.equal(expected.proofProducerDeltas.length,1);const delta=expected.proofProducerDeltas[0];
 assert.equal(delta.id,'focused-workspace-ui');assert.equal(delta.producer,'scripts/verify-focused-workspace-ci.mjs');assert.equal(delta.previousProducerSha256,'a4eb59cb781eeb9578e46ffcdec21833cce1ba79eb9f99e3543fda799dfc62f4');assert.equal(delta.currentProducerSha256,'48650c362bfc0b9d8fd49976fbc4ae1a124776167c60ba08f60d2b163ee94e24');
 const proof=value=>value.extension.proofs.find(row=>row.id===delta.id),record=value=>value.evidenceProducers.find(row=>row.path===delta.path&&row.producer===delta.producer);
 // The published producer pin remains immutable; the authenticated outer layer advances actual current bytes.
 const currentProducerPin=worksiteLiveHoursCurrentSourcePin(contract,{path:delta.producer,sha256:delta.currentProducerSha256});assert.equal(proof(contract).producerSha256,currentProducerPin);assert.equal(record(contract).producerSha256,currentProducerPin);assert.equal(proof(previous).producerSha256,delta.previousProducerSha256);assert.equal(record(previous).producerSha256,delta.previousProducerSha256);
 for(const edit of [value=>{value[key].proofProducerDeltas=[];},value=>{value.extension.proofs=value.extension.proofs.filter(row=>row.id!==delta.id);},value=>{value.extension.proofs.push(structuredClone(proof(value)));},value=>{value.evidenceProducers=value.evidenceProducers.filter(row=>row!==record(value));},value=>{value.evidenceProducers.push(structuredClone(record(value)));},value=>{proof(value).producerSha256=delta.previousProducerSha256;},value=>{record(value).producerSha256=delta.previousProducerSha256;},value=>{proof(value).producerSha256=record(value).producerSha256=delta.previousProducerSha256;},value=>{proof(value).producerSha256='f'.repeat(64);},value=>{record(value).producerSha256='f'.repeat(64);},value=>{proof(value).producer='scripts/foreign.mjs';},value=>{record(value).producer='scripts/foreign.mjs';}]){const changed=structuredClone(contract);edit(changed);denied(()=>restoreHomeDecisionsPreviousContract(changed));}
});

test('source sets reject omissions duplicates old-as-current reverse order and foreign same-count replacements',()=>{
 for(const contract of [current(),restorePlanBudgetPreviousContract(current())]){const previous=restoreHomeDecisionsPreviousContract(contract);
 for(const delta of expected.proofSourceDeltas){
  const spec=contract.extension.proofs.find(row=>row.id===delta.id),files=spec.sourceFiles,old=previous.extension.proofs.find(row=>row.id===delta.id);
  for(const changed of [files.slice(1),[...files,files[0]].sort(),[...files].reverse(),files.map((file,index)=>index===0?'scripts/lib/foreign-same-count.mjs':file).sort(),old.sourceFiles])denied(()=>restoreHomeDecisionsSourceSet(delta.family,changed,contract));
  denied(()=>homeDecisionsProofSourceAdditions({...spec,sourceFiles:files.map((file,index)=>index===0?'scripts/lib/foreign-same-count.mjs':file).sort()}));
 }
 }
});

// These unit shadows validate declarations in memory. They never emit or retag
// browser/PostgreSQL evidence and do not execute a provider or business request.
function focusedShadow(){
 const value=expected.focusedUi,requests=Array(value.currentRequestCount),evidence=new Map(),directory='synthetic-home-evidence';
 for(const [index,request] of previousFocused.requestMatrix.entries())requests[value.previousRequestIndices[index]]=structuredClone(request);
 for(const row of value.addedRequestFacts)requests[row.index]=structuredClone(row.request);
 let operation=0;for(const row of requests)if(row.mode==='wizard'&&row.method==='POST'){Object.assign(row,{operationId:'00000000-0000-4000-8000-'+String(++operation).padStart(12,'0'),recoveryReferenceSha256:String(operation+4).repeat(64),syntheticImageSha256:['1'.repeat(64),'2'.repeat(64),'3'.repeat(64)],explicitFinalStep:true,actualRecoveryJournalReferencePreserved:true});}
 const screenshots=value.screenshotNames.map((path,index)=>{const bytes=Buffer.from('synthetic nonpersonal unit image '+index),width=Number(/-(320|390|768|1440)\.png$/.exec(path)[1]);evidence.set(directory+'/'+path,bytes);return {path,sha256:sha(bytes),geometry:{width,height:1000,scrollWidth:width,identityActionTop:null}};});
 const raw={checks:[...value.previousCheckNames.map(name=>name.startsWith('hidden-panel-')?name+':8':name),...value.addedCheckNames],totalCheckCount:77,expectedTotalCheckCount:77,homeDecisionsWidths:[...value.widths],homeDecisionsCheckLedger:[...value.addedCheckNames],requests,screenshots};
 return {raw,evidence,normalize:()=>normalizeHomeDecisionsFocusedRaw(raw,{contract:current(),readSource:read,readEvidence:path=>evidence.get(path)||null,directory})};
}

test('all77 current observations exact135 new GET facts and four measured screenshots project to the unchanged59 ledger',()=>{
 const f=focusedShadow(),before=serialize(f.raw),previous=f.normalize();assert.equal(expected.focusedUi.previousRequestCount,406);assert.equal(expected.focusedUi.addedRequestFacts.length,135);assert.ok(expected.focusedUi.addedRequestFacts.every(row=>row.request.method==='GET'));
 assert.equal(previous.checks.length,59);assert.equal(previous.totalCheckCount,59);assert.equal(previous.expectedTotalCheckCount,59);assert.equal(previous.requests.length,406);assert.deepEqual(previous.screenshots.map(row=>row.path),previousFocused.screenshotNames);assert.equal(Object.hasOwn(previous,'homeDecisionsWidths'),false);assert.equal(serialize(f.raw),before);
});

test('current home focused observations cannot be omitted duplicated reordered retagged or replaced by historical-only checks',()=>{
 for(const mutate of [r=>{r.checks.pop();},r=>{r.checks[59]=r.checks[60];},r=>{[r.checks[59],r.checks[60]]=[r.checks[60],r.checks[59]];},r=>{r.totalCheckCount=59;},r=>{r.expectedTotalCheckCount=59;},r=>{r.homeDecisionsCheckLedger.pop();},r=>{r.homeDecisionsWidths=[320,390,1440];},r=>{r.checks=r.checks.slice(0,59);r.totalCheckCount=59;r.expectedTotalCheckCount=59;},r=>{delete r.homeDecisionsCheckLedger;}]){const f=focusedShadow();mutate(f.raw);denied(f.normalize);}
});

test('new requests screenshots viewport facts and actual evidence bytes are all mandatory before historical projection',()=>{
 const index=expected.focusedUi.addedRequestFacts[0].index;
 for(const mutate of [r=>{r.requests.splice(index,1);},r=>{r.requests.push(structuredClone(r.requests[index]));},r=>{r.requests[index].method='POST';},r=>{r.requests[index].projectId='foreign-project';},r=>{r.requests[index].unexpected=true;},r=>{r.requests[index]=null;},r=>{r.screenshots.pop();},r=>{r.screenshots.at(-1).path=r.screenshots.at(-2).path;},r=>{r.screenshots.at(-1).geometry.scrollWidth=1442;},r=>{r.screenshots.at(-1).sha256='0'.repeat(64);}]){const f=focusedShadow();mutate(f.raw);denied(f.normalize);}
 const f=focusedShadow();f.evidence.clear();denied(f.normalize);
});

test('the native24 observation requires the unchanged23 queue ledger exact two-query decisions and current source bytes',()=>{
 const value=expected.native,contract=current(),proof={status:'PASS',environment:'disposable-localhost-canonical-material-inventory',checks:value.currentCheckNames,checkCount:24,providerCalls:0,productionDataTouched:false,humanAccepted:false,newTables:false,participantKycFixture:{identityCertified:false,providerCalls:0},materialReviewQueue:structuredClone(value.previousMaterialReviewQueue),homeDecisions:structuredClone(value.homeDecisions),harnessSha256:sha(read(value.producer)),sourceManifest:value.sourceFiles.map(path=>({path,sha256:sha(read(path))}))};
 assert.equal(value.previousCheckNames.length,23);assert.equal(value.addedCheckNames.length,1);assert.deepEqual(value.currentCheckNames,[...value.previousCheckNames,...value.addedCheckNames]);assert.equal(value.sourceFiles.length,125);assert.equal(value.previousMaterialReviewQueue.readOnlyTransactions,24);assert.equal(validateHomeDecisionsNativeProof(proof,contract,read).nativeOrBrowserAcceptance,false);
 for(const edit of [p=>{p.checks=p.checks.slice(0,23);p.checkCount=23;},p=>{p.checks=[...p.checks,p.checks[0]];},p=>{p.materialReviewQueue.readOnlyTransactions=23;},p=>{p.homeDecisions.sqlQueriesPerRead=3;},p=>{p.homeDecisions.canonicalReadOnly=false;},p=>{p.homeDecisions.authorizationGranted=true;},p=>{p.providerCalls=1;},p=>{p.humanAccepted=true;},p=>{p.participantKycFixture.identityCertified=true;},p=>{p.sourceManifest.pop();},p=>{p.sourceManifest[0].sha256='0'.repeat(64);}]){const changed=structuredClone(proof);edit(changed);denied(()=>validateHomeDecisionsNativeProof(changed,contract,read));}
});

test('the full field producer preserves its entire historical ledger and adds exactly36 without accepting focused72 as FULL',()=>{
 const value=expected.fieldUi,contract=current(),proof={status:'PASS',environment:'actual-component-with-intercepted-synthetic-api',fullSuite:true,focusedScenario:null,widths:[320,390,768,1280],checks:value.currentCheckNames,providerCalls:0,metaMessagesSent:0,physicalGeolocationAccepted:false,cameraQrAccepted:false,physicalCameraAccepted:false,physicalMicrophoneAccepted:false,productionDataWritten:false,errors:[],harnessSha256:sha(read(value.producer)),sourceManifest:value.sourceFiles.map(path=>({path,sha256:sha(read(path))}))};
 assert.equal(value.addedCheckNames.length,36);assert.deepEqual(value.currentCheckNames.filter(name=>!value.addedCheckNames.includes(name)),value.previousCheckNames);assert.equal(validateHomeDecisionsFieldProof(proof,contract,read).nativeOrBrowserAcceptance,false);
 for(const edit of [p=>{p.fullSuite=false;p.focusedScenario='home-progress-pending';p.checks=value.addedCheckNames;},p=>{p.checks=value.currentCheckNames.slice(0,72);},p=>{p.checks=value.previousCheckNames;},p=>{p.checks=[...value.currentCheckNames,value.currentCheckNames[0]];},p=>{p.providerCalls=1;},p=>{p.physicalCameraAccepted=true;},p=>{p.humanAccepted=true;},p=>{p.sourceManifest.pop();},p=>{p.sourceManifest[0].sha256='0'.repeat(64);}]){const changed=structuredClone(proof);edit(changed);denied(()=>validateHomeDecisionsFieldProof(changed,contract,read));}
});

test('review declarations historical contracts immutable source references and proof arrays cannot be caller-resealed',()=>{
 assert.throws(()=>expected.proofSourceDeltas[0].additions.push('scripts/lib/foreign.mjs'),TypeError);
 for(const change of [c=>c[key].reviewedSourceChanges.pop(),c=>c[key].validationDeltas.pop(),c=>c[key].nativeOrBrowserAcceptance=true,c=>c[key].previousContractSha256='0'.repeat(64),c=>c[key].unreviewed=true,c=>c.blocks[0].step.run+='\ntrue',c=>c.extension.proofs[0].sourceFiles.pop(),c=>c[key].validationSources[0].path='scripts/foreign.mjs',c=>c[key].focusedUi.currentRequestCount--]){historicalMutation(change,restoreHomeDecisionsPreviousContract);const contract=current();change(contract);denied(()=>restoreHomeDecisionsPreviousContract(contract));}
 const previous=restoreHomeDecisionsPreviousContract(current());assert.equal(verifyHomeDecisionsCurrentSources(previous,read),null);assert.deepEqual(homeDecisionsValidationFiles(previous),[]);
});


test('participant draft companion restores the complete published9b26 contract and preserves every inherited source set and producer record',()=>{
 const contract=current(),before=serialize(contract),previous=restoreParticipantDraftSafetyPreviousContract(contract);
 assert.equal(draftExpected.predecessorCommit,'9b26ac5f78ee469b4a61d83018b1ea98fb73aa3e');assert.equal(sha(serialize(previous)),'42ced37df92bfaa681e0844ba23839bf8630a0d00404415aeb5dbca77238c27e');assert.equal(Object.hasOwn(previous,draftKey),false);assert.equal(serialize(contract),before);
 for(const field of Object.keys(previous))assert.deepEqual(restoreCompanyOnboardingUxPreviousContract(contract)[field],previous[field],'Published9b26 field remains exact: '+field);
 assert.equal(draftExpected.sourceSetChanges,0);assert.deepEqual(restoreWeeklyCypPreviousContract(contract).extension,previous.extension);assert.deepEqual(restoreWeeklyCypPreviousContract(contract).evidenceProducers,previous.evidenceProducers);assert.deepEqual(contract[key],previous[key]);assert.deepEqual(contract[phoneKey],previous[phoneKey]);
 assert.deepEqual(draftExpected.fixtureSourceDeltas.map(row=>row.producer),['scripts/verify-participants-ui.mjs','scripts/verify-participant-kyc-chat-closure-ui.mjs']);for(const delta of draftExpected.fixtureSourceDeltas)assert.deepEqual(delta.additions,['participant-kyc-capture.js','participant-kyc-capture.module.css','participant-kyc-preanalysis-view.mjs'].map(name=>'src/app/(identity)/cuenta/'+name));
 assert.equal(verifyParticipantDraftSafetyCurrentSources(contract,read).nativeOrBrowserAcceptance,false);
 // Home keeps its published family source set; the composed Own diagnostic
 // additionally verifies one exact retained source outside that family.
 const uiFiles=draftExpected.reviewedSourceChanges.map(row=>row.path),requiredRetainedUi=planBudgetValidationFiles(contract).filter(file=>uiFiles.includes(file));
 assert.deepEqual(requiredRetainedUi,["scripts/verify-participant-kyc-chat-closure-ui.mjs","scripts/verify-participants-ui.mjs","src/app/(identity)/cuenta/participant-panel.js"]);
 assert.deepEqual(requiredRetainedUi.filter(file=>file!=='scripts/verify-participant-kyc-chat-closure-ui.mjs'),["scripts/verify-participants-ui.mjs","src/app/(identity)/cuenta/participant-panel.js"]);
 const closureOwner=contract.planBudgetCurrentRevision.ownRuntimeDiagnosticAdvance.sourceChanges.find(row=>row.path==='scripts/verify-participant-kyc-chat-closure-ui.mjs');assert.equal(closureOwner.status,'MODIFIED');assert.equal(sha(read(closureOwner.path).toString('utf8').replaceAll('\r\n','\n')),closureOwner.currentSha256);
 const noUiRead=file=>{assert.equal(uiFiles.includes(file)&&!requiredRetainedUi.includes(file),false,'Composed Home verification must not read unrelated UI sources: '+file);return read(file);};
 assert.equal(verifyHomeDecisionsCurrentSources(contract,noUiRead).nativeOrBrowserAcceptance,false);
 denied(()=>verifyHomeDecisionsCurrentSources(contract,file=>file==='scripts/verify-participant-kyc-chat-closure-ui.mjs'?null:read(file)));
 assert.equal(contract.extension.proofs.find(row=>row.id==='field-task-pagination-ui').sourceFiles.includes('src/app/(identity)/cuenta/participant-panel.js'),false);
});

test('participant draft pins allow only exact published current and authenticated Integrated panel aliases',()=>{
 const contract=current(),value=contract[draftKey],previous=restoreParticipantDraftSafetyPreviousContract(contract),refs=[...value.reviewedSourceChanges,...value.validationPredecessors.map(row=>({path:row.path,previousSha256:row.sha256,currentSha256:value.validationSources.find(ref=>ref.path===row.path).sha256}))];
 for(const row of refs){
  for(const pin of [row.previousSha256,row.currentSha256,...(row.authenticatedPreviousAliases||[])])assert.equal(participantDraftSafetyCurrentSourcePin(contract,{path:row.path,sha256:pin}),companyOnboardingUxCurrentSourcePin(contract,{path:row.path,sha256:row.currentSha256}));
  assert.equal(participantDraftSafetyPreviousSourcePin(contract,{path:row.path,sha256:row.currentSha256}),row.previousSha256);
  denied(()=>participantDraftSafetyCurrentSourcePin(contract,{path:row.path,sha256:'f'.repeat(64)}));
  assert.equal(homeDecisionsCurrentSourcePin(contract,{path:row.path,sha256:row.previousSha256}),companyOnboardingUxCurrentSourcePin(contract,{path:row.path,sha256:row.currentSha256}));
 }
 const panel=value.reviewedSourceChanges.find(row=>row.path.endsWith('/participant-panel.js')),oldPanel=previous.integratedIdentityCurrentRevision.reviewedSourceChanges.find(row=>row.path===panel.path);
 assert.deepEqual(panel.authenticatedPreviousAliases,[oldPanel.previousSha256]);assert.equal(panel.previousSha256,oldPanel.currentSha256);
 for(const row of refs)for(const replacement of [null,Buffer.from('unreviewed participant draft source')])denied(()=>verifyParticipantDraftSafetyCurrentSources(contract,file=>file===row.path?replacement:read(file)));
 denied(()=>verifyHomeDecisionsCurrentSources(previous,read));
});

test('participant draft companion rejects omitted duplicated reordered same-count foreign and current-as-prior declarations',()=>{
 for(const edit of [
  c=>c[draftKey].reviewedSourceChanges.pop(),c=>c[draftKey].reviewedSourceChanges.push(c[draftKey].reviewedSourceChanges[0]),c=>c[draftKey].reviewedSourceChanges.reverse(),c=>{c[draftKey].reviewedSourceChanges[0].path='scripts/foreign-same-count.mjs';},c=>{c[draftKey].reviewedSourceChanges[0].previousSha256=c[draftKey].reviewedSourceChanges[0].currentSha256;},c=>{c[draftKey].reviewedSourceChanges[0].currentSha256='f'.repeat(64);},c=>{c[draftKey].reviewedSourceChanges[0].authenticatedPreviousAliases=['f'.repeat(64)];},
  c=>c[draftKey].validationSources.pop(),c=>c[draftKey].validationSources.push(c[draftKey].validationSources[0]),c=>c[draftKey].validationSources.reverse(),c=>{c[draftKey].validationSources[0].path='scripts/lib/foreign-same-count.mjs';},c=>{c[draftKey].validationSources[0].sha256='f'.repeat(64);},
  c=>{c[draftKey].previousContractSha256='f'.repeat(64);},c=>{c[draftKey].nativeOrBrowserAcceptance=true;},c=>{c[draftKey].sourceSetChanges=1;},c=>c[draftKey].fixtureSourceDeltas[0].additions.pop(),c=>{c[phoneKey].native.currentCheckCount=41;},c=>{c[key].validationSources[0].sha256=c[draftKey].validationSources[0].sha256;},c=>c.evidenceProducers.pop(),c=>c.extension.proofs[0].sourceFiles.pop()
 ]){historicalMutation(edit,restoreParticipantDraftSafetyPreviousContract);const changed=current();edit(changed);denied(()=>verifyParticipantDraftSafetyCurrentSources(changed,read));}
 const missing=current();delete missing[draftKey];denied(()=>verifyHomeDecisionsCurrentSources(missing,read));
});

test('company onboarding companion restores exact published4f1 and every closure while authenticating all ten reviewed sources',()=>{
 const contract=current(),before=serialize(contract),previous=restoreCompanyOnboardingUxPreviousContract(contract);assert.equal(sha(serialize(previous)),companyExpected.previousContractSha256);assert.equal(companyExpected.previousContractSha256,'ecec0aa86b5826cdb38a75ff02803ae831479204e42bba97273c788b46ab834e');assert.equal(serialize(contract),before);assert.equal(Object.hasOwn(previous,companyKey),false);
 assert.deepEqual(restoreWeeklyCypPreviousContract(contract).extension,previous.extension);assert.deepEqual(restoreWeeklyCypPreviousContract(contract).evidenceProducers,previous.evidenceProducers);assert.deepEqual(contract[key],previous[key]);assert.deepEqual(contract[phoneKey],previous[phoneKey]);assert.deepEqual(contract[draftKey],previous[draftKey]);assert.equal(verifyCompanyOnboardingUxCurrentSources(contract,read).completePreviousContractRestored,true);
 const value=contract[companyKey],refs=[...value.reviewedSourceChanges,...value.validationPredecessors.map(p=>({path:p.path,previousSha256:p.sha256,currentSha256:value.validationSources.find(r=>r.path===p.path).sha256}))];assert.equal(refs.length,10);
 for(const row of refs){for(const pin of [row.previousSha256,row.currentSha256])assert.equal(companyOnboardingUxCurrentSourcePin(contract,{path:row.path,sha256:pin}),weeklyCypCurrentSourcePin(contract,{path:row.path,sha256:row.currentSha256}));assert.equal(companyOnboardingUxPreviousSourcePin(contract,{path:row.path,sha256:row.currentSha256}),row.previousSha256);denied(()=>companyOnboardingUxCurrentSourcePin(contract,{path:row.path,sha256:'f'.repeat(64)}));for(const bytes of [null,Buffer.from('foreign')])denied(()=>verifyCompanyOnboardingUxCurrentSources(contract,path=>path===row.path?bytes:read(path)));}
});
test('company onboarding rejects omitted duplicate foreign reordered current-as-prior declarations and altered published fields',()=>{
 for(const edit of [c=>c[companyKey].reviewedSourceChanges.pop(),c=>c[companyKey].reviewedSourceChanges.reverse(),c=>c[companyKey].reviewedSourceChanges.push(c[companyKey].reviewedSourceChanges[0]),c=>{c[companyKey].reviewedSourceChanges[0].previousSha256=c[companyKey].reviewedSourceChanges[0].currentSha256;},c=>{c[companyKey].reviewedSourceChanges[0].path='scripts/foreign.mjs';},c=>c[companyKey].validationSources.pop(),c=>c[companyKey].validationSources.reverse(),c=>c[companyKey].validationSources.push(c[companyKey].validationSources[0]),c=>{c[companyKey].validationSources[0].sha256='f'.repeat(64);},c=>{c[companyKey].native.totalCheckCount=49;},c=>{c[companyKey].nativeOrBrowserAcceptance=true;},c=>c.blocks.pop(),c=>c.extension.proofs[0].sourceFiles.pop()]){historicalMutation(edit,restoreCompanyOnboardingUxPreviousContract);const c=current();edit(c);denied(()=>verifyCompanyOnboardingUxCurrentSources(c,read));}
 const c=current();delete c[companyKey];denied(()=>verifyHomeDecisionsCurrentSources(c,read));
});
test('the reviewed current h23 assertions restore all201 historical instructions and reject producer tampering',()=>{
 const c=current(),source=read('scripts/verify-focused-workspace-ui.mjs'),calls=companyOnboardingUxHistoricalFocusedAssertions(source,c);assert.equal(calls.length,201);assert.equal(sha(JSON.stringify(calls)),companyExpected.focusedAssertions.previousAssertionsSha256);denied(()=>companyOnboardingUxHistoricalFocusedAssertions(Buffer.concat([source,Buffer.from('\n//unreviewed')]),c));assert.equal(companyExpected.native.totalCheckCount,54);assert.equal(companyExpected.native.addedCheckNames.length,5);assert.throws(()=>validateCompanyOnboardingUxNativeProofBytes(Buffer.from('{}'),read),{code:'COMPANY_ONBOARDING_UX_NATIVE_PROOF_REJECTED'});
});

test('weekly CyP restores the complete published0ac contract with monthly commands proofs and historical declarations intact',()=>{
 const c=current(),before=serialize(c),previous=restoreWeeklyCypPreviousContract(c),pilotB=historicalPilotBFrame().contract;assert.equal(sha(serialize(previous)),'04db9c3dd25a41425f3b8f71f5d51ab23fcf4ad575b88710350b005dff04502b');assert.equal(Object.hasOwn(previous,weeklyKey),false);assert.equal(serialize(c),before);assert.equal(weeklyExpected.predecessorCommit,'0acac0857310e57bc717a3d734e02923a5ea83a1');
 for(const field of ['blocks','lanes','artifactPatterns',key,phoneKey,draftKey,companyKey])assert.deepEqual(restorePlanBudgetPreviousContract(c)[field],previous[field]);assert.equal(verifyWeeklyCypCurrentSources(c,read).nativeOrBrowserAcceptance,false);
 assert.deepEqual(weeklyExpected.consumerSourceDeltas.map(row=>row.family),['CONSUMPTION_FEEDBACK_UI','ORGANIZATION_USAGE_UI','MEASUREMENT_UI']);for(const delta of weeklyExpected.consumerSourceDeltas){assert.deepEqual(delta.additions,['src/lib/plan-import-cyp-curve.mjs']);assert.equal(delta.currentCount,delta.previousCount+1);denied(()=>restoreWeeklyCypConsumerSourceSet(delta.family,[],c));}const untouched=['historical'];assert.equal(restoreWeeklyCypConsumerSourceSet('CONSUMPTION_FEEDBACK_UI',untouched,previous),untouched);
 assert.equal(weeklyExpected.reviewedSourceChanges.length,7);assert.equal(weeklyExpected.proofSourceDeltas.length,6);assert.equal(weeklyExpected.documentCurveCopy.version,2);assert.deepEqual(weeklyExpected.documentCurveCopy.dependencies,['src/lib/plan-import-document-curve.mjs','src/lib/plan-import-cyp-curve.mjs']);assert.equal(weeklyExpected.baselineNative.historicalCheckCount,16);assert.equal(weeklyExpected.baselineNative.addedCheckNames.length,7);assert.equal(weeklyExpected.baselineNative.totalCheckCount,23);
 for(const spec of c.extension.proofs){if(spec.id===planBudgetCompiledProof(c).id){assert.deepEqual(currentProducerSourceFiles(spec,process.cwd()),spec.sourceFiles);assert.deepEqual(spec,planBudgetCompiledProof(c));continue;}const prior=previous.extension.proofs.find(row=>row.id===spec.id);const historicalChecks=spec.kind==='PG_INTAKE'?pilotB.extension.proofs.find(row=>row.id===spec.id).checkNames:spec.checkNames;if(spec.kind==='PG_INTAKE')assert.deepEqual(spec.checkNames.slice(0,historicalChecks.length),historicalChecks);assert.deepEqual(historicalChecks,prior.checkNames);assert.deepEqual(currentProducerSourceFiles(spec,process.cwd()),spec.sourceFiles);const delta=weeklyExpected.proofSourceDeltas.find(row=>row.id===spec.id);assert.deepEqual(weeklyCypProofSourceAdditions(spec),[...(delta?.additions||[]),...identityDestinationUxProofSourceAdditions(spec)]);assert.deepEqual(weeklyCypProofSourceAdditions(prior),[]);if(delta){assert.equal(spec.sourceFiles.length,prior.sourceFiles.length+1+identityDestinationUxProofSourceAdditions(spec).length);assert.deepEqual(delta.additions,['src/lib/plan-import-cyp-curve.mjs']);}}
});
test('weekly CyP advances only the exact published pins and authenticates actual current bytes without relabelling history',()=>{
 const c=current(),value=c[weeklyKey],refs=[...value.reviewedSourceChanges,...value.validationPredecessors.map(row=>({path:row.path,previousSha256:row.sha256,currentSha256:value.validationSources.find(ref=>ref.path===row.path).sha256,authenticatedPreviousAliases:row.authenticatedPreviousAliases||[]}))];
 const previous=restoreWeeklyCypPreviousContract(c);let aliases=0;
 for(const row of refs){for(const pin of [row.previousSha256,row.currentSha256,...(row.authenticatedPreviousAliases||[])])assert.equal(weeklyCypCurrentSourcePin(c,{path:row.path,sha256:pin}),progressEvidenceWaitCurrentSourcePin(c,{path:row.path,sha256:row.currentSha256}));for(const alias of row.authenticatedPreviousAliases||[]){assert.equal(fieldOutboundCurrentSourcePin(previous,{path:row.path,sha256:alias}),row.previousSha256,'Every alias must already resolve through the complete unchanged published0ac pin chain');aliases++;}assert.equal(weeklyCypPreviousSourcePin(c,{path:row.path,sha256:row.currentSha256}),row.previousSha256);denied(()=>weeklyCypCurrentSourcePin(c,{path:row.path,sha256:'f'.repeat(64)}));for(const bytes of [null,Buffer.from('unreviewed')])denied(()=>verifyWeeklyCypCurrentSources(c,path=>path===row.path?bytes:read(path)));}assert.equal(aliases,11);
 for(const ref of weeklyExpected.reviewedSourceChanges)assert.equal(homeDecisionsCurrentSourcePin(c,{path:ref.path,sha256:ref.previousSha256}),worksiteLiveHoursCurrentSourcePin(c,{path:ref.path,sha256:ref.currentSha256}));
 denied(()=>verifyWeeklyCypCurrentSources(c,path=>path==='scripts/lib/plan-document-curve-fixture-copy.mjs'?Buffer.from('wrong copier'):read(path)));
});
test('weekly CyP inverse rejects omitted reordered foreign same-count changed predecessor and resealed source declarations',()=>{
 for(const edit of [c=>c[weeklyKey].reviewedSourceChanges.pop(),c=>c[weeklyKey].reviewedSourceChanges.reverse(),c=>{c[weeklyKey].reviewedSourceChanges[0].currentSha256='f'.repeat(64);},c=>c[weeklyKey].validationSources.pop(),c=>c[weeklyKey].validationSources.reverse(),c=>{c[weeklyKey].validationSources[0].sha256='f'.repeat(64);},c=>c[weeklyKey].consumerSourceDeltas.pop(),c=>c[weeklyKey].consumerSourceDeltas.reverse(),c=>{c[weeklyKey].consumerSourceDeltas[0].currentPathsSha256='f'.repeat(64);},c=>c[weeklyKey].proofSourceDeltas.pop(),c=>c[weeklyKey].proofSourceDeltas.reverse(),c=>c[weeklyKey].proofProducerDeltas.pop(),c=>{c[weeklyKey].baselineNative.addedCheckNames.pop();},c=>{c[weeklyKey].documentCurveCopy.dependencies.reverse();},c=>{c[weeklyKey].nativeOrBrowserAcceptance=true;},c=>c.blocks[0].step.run+='\ntrue',c=>c.extension.proofs[0].sourceFiles.pop(),c=>c.evidenceProducers.pop()]){historicalMutation(edit,restoreWeeklyCypPreviousContract);const c=current();edit(c);denied(()=>verifyWeeklyCypCurrentSources(c,read));}
 for(const delta of weeklyExpected.proofSourceDeltas){const c=current(),spec=c.extension.proofs.find(row=>row.id===delta.id);for(const edit of [p=>p.sourceFiles.reverse(),p=>p.sourceFiles.push(p.sourceFiles[0]),p=>{p.sourceFiles[p.sourceFiles.indexOf(delta.additions[0])]='src/lib/foreign-same-count.mjs';p.sourceFiles.sort();}]){const changed=structuredClone(spec);edit(changed);denied(()=>weeklyCypProofSourceAdditions(changed));}spec.sourceFiles=spec.sourceFiles.filter(p=>p!==delta.additions[0]);denied(()=>restoreWeeklyCypPreviousContract(c));}
 const c=current();delete c[weeklyKey];denied(()=>verifyHomeDecisionsCurrentSources(c,read));
});

test('weekly CyP browser decoder requires historical160 plus four canonical journeys and the actual31-source Node closure',()=>{
 const source=historicalWeeklySource(),head='a'.repeat(40),tree='b'.repeat(40),fixture=weeklyCypImportUiShadowFixture(source,head,tree),before=serialize(fixture.proof),validate=(proof,options={})=>validateWeeklyCypImportUiProofBytes(Buffer.from(JSON.stringify(proof)),source,{expectedHead:head,expectedTree:tree,readEvidence:file=>fixture.evidence.get(file),...options}),bad=edit=>{const proof=structuredClone(fixture.proof);edit(proof);assert.throws(()=>validate(proof),{code:'WEEKLY_CYP_UI_PROOF_REJECTED'});};
 assert.equal(fixture.boundary,'VALIDATOR_ONLY_NOT_BROWSER_EXECUTION');assert.equal(historicalWeeklyInvestmentFiles(source).length,31);assert.equal(validate(fixture.proof).totalCheckCount,164);assert.equal(validate(fixture.proof).nativePostgresExecuted,false);assert.equal(serialize(fixture.proof),before);const historicalProducerWithCurrentRuntime=file=>file===weeklyExpected.browser.producer?source(file):read(file),currentRuntimeFixture=weeklyCypImportUiShadowFixture(historicalProducerWithCurrentRuntime,head,tree);assert.equal(weeklyCypInvestmentUiSourceFiles(historicalProducerWithCurrentRuntime).length,planBudgetCurrentBrowserBinding(current(),PLAN_PARTIDA_PREVIEW_CURRENT_REVISION.browser).investmentSourceCount);assert.throws(()=>validateWeeklyCypImportUiProofBytes(Buffer.from(JSON.stringify(currentRuntimeFixture.proof)),historicalProducerWithCurrentRuntime,{expectedHead:head,expectedTree:tree,readEvidence:file=>currentRuntimeFixture.evidence.get(file)}),{code:'WEEKLY_CYP_UI_PROOF_REJECTED',reason:'INVESTMENT_CLOSURE'});
 for(const field of Object.keys(weeklyExpected.browser.historicalModes)){bad(p=>p[field].pop());bad(p=>p[field].reverse());bad(p=>{p[field][0].mode='foreign-same-count';});}
 for(const edit of [p=>p.investmentCurveChecks.pop(),p=>p.investmentCurveChecks.reverse(),p=>{p.investmentCurveChecks[0].width=319;},p=>{p.investmentCurveChecks[0].taskSqlAttempts=1;},p=>{p.investmentCurveChecks[0].applyPosts=2;},p=>{p.investmentCurveChecks[0].recoveryReads=0;},p=>{p.investmentCurveChecks[0].acknowledgmentBoundToReview=false;},p=>{p.investmentCurveChecks[0].transport='unverified-json';},p=>{p.investmentCurveChecks[0].baselineEffects=true;},p=>{p.investmentCurveChecks[0].realProviderCalls=1;},p=>{p.investmentCurveChecks[0].sourceDownloads=1;},p=>{p.investmentCurveChecks[0].exactDifference='0.047';},p=>{p.investmentCurveChecks[0].sourceManifestContext.projectId='foreign-project';},p=>p.investmentSourceManifest.pop(),p=>{p.investmentSourceManifest[0].sha256='f'.repeat(64);},p=>{p.investmentSourceManifest[0].path='src/lib/foreign-same-count.mjs';},p=>p.fixtureTransforms.pop(),p=>{p.fixtureTransforms[1].copiedBeforeSha256='f'.repeat(64);},p=>{p.fixtureRemoved=false;},p=>{p.trackedClean=false;},p=>{p.sourceState='LOCAL_REVIEW_SOURCE';},p=>{p.totalCheckCount=160;}])bad(edit);
 for(const field of ['sourceManifest','decisionSourceManifest','spreadsheetSourceManifest','documentSourceManifest','linkSourceManifest'])bad(p=>p[field].pop());
 assert.throws(()=>validate(fixture.proof,{readEvidence:()=>undefined}),{code:'WEEKLY_CYP_UI_PROOF_REJECTED'});assert.throws(()=>validate(fixture.proof,{readEvidence:file=>{const png=Buffer.from(fixture.evidence.get(file));png.writeUInt32BE(1,16);return png;}}),{code:'WEEKLY_CYP_UI_PROOF_REJECTED'});assert.throws(()=>validate(fixture.proof,{expectedHead:'c'.repeat(40)}),{code:'WEEKLY_CYP_UI_PROOF_REJECTED'});
});

test('weekly CyP retains four byte-exact viewport PNGs through the existing narrow upload and rejects missing or changed bindings',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'weekly-retained-png-')),source=historicalWeeklySource(),head='a'.repeat(40),tree='b'.repeat(40),fixture=weeklyCypImportUiShadowFixture(source,head,tree),bytes=Buffer.from(JSON.stringify(fixture.proof));
 try{
  for(const[file,data]of fixture.evidence){const target=path.join(root,file);mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,data);}
  const c=current(),old=restoreWeeklyCypPreviousContract(c),upload=yaml.load(read('.github/workflows/workspace-acceptance.yml').toString('utf8')).jobs.plans.steps.at(-1).with.path;
  assert.deepEqual(restorePlanBudgetPreviousContract(c).artifactPatterns,old.artifactPatterns);assert.deepEqual(restorePlanBudgetPreviousContract(c).lanes.plans,old.lanes.plans);assert.ok(c.artifactPatterns.includes('.vercel/private/plan-import-ui-*.png'));assert.ok(c.lanes.plans.artifacts.includes('.vercel/private/plan-import-ui-*.png'));assert.ok(upload.split('\n').includes('.vercel/private/plan-import-ui-*.png'));
  const kept=retainWeeklyCypImportUiScreenshots({root,bytes,readSource:source,expectedHead:head,expectedTree:tree});assert.equal(kept.length,4);assert.deepEqual(kept.map(row=>row.path),weeklyExpected.browser.retainedScreenshots.map(row=>row.path));
  for(const row of kept){const width=Number(/investment-(\d+)\.png$/.exec(row.path)[1]),original=fixture.evidence.get(fixture.proof.investmentCurveChecks.find(value=>value.width===width).screenshot),actual=readFileSync(path.join(root,row.path));assert.deepEqual(actual,original);assert.equal(row.sha256,sha(original));assert.equal(row.bytes,original.length);}
  validateWeeklyCypRetainedScreenshotBindings(kept,kept);for(const omitted of kept)assert.throws(()=>validateWeeklyCypRetainedScreenshotBindings(kept.filter(row=>row.path!==omitted.path),kept),{code:'PROOF_WEEKLY_CYP_UI_SCREENSHOT_BINDING'});
  for(const edit of [rows=>{rows[0].sha256='f'.repeat(64);},rows=>{rows[0].bytes++;},rows=>rows.push(rows[0]),rows=>{rows[0].path='.vercel/private/investment-ui-foreign/investment-320.png';}]){const changed=structuredClone(kept);edit(changed);assert.throws(()=>validateWeeklyCypRetainedScreenshotBindings(changed,kept),{code:'PROOF_WEEKLY_CYP_UI_SCREENSHOT_BINDING'});}
  assert.throws(()=>retainWeeklyCypImportUiScreenshots({root,bytes,readSource:source,expectedHead:head,expectedTree:tree}),{code:'EEXIST'},'Retention must never overwrite an existing file or link');
 }finally{assert.equal(path.dirname(path.resolve(root)),path.resolve(tmpdir()));assert.ok(path.basename(root).startsWith('weekly-retained-png-'));rmSync(root,{recursive:true,force:true});}
});

test('progress evidence wait restores the complete published5e25 contract and all eight source sets without mutations',()=>{
 const c=current(),before=serialize(c),previous=restoreProgressEvidenceWaitPreviousContract(c);assert.equal(sha(serialize(previous)),'0134ff841636654e447148bcc81f7c2127763089dd16b10166c4e26632b01b28');assert.equal(serialize(c),before);assert.equal(Object.hasOwn(previous,waitKey),false);assert.equal(waitExpected.proofSourceSets.length,8);
 for(const spec of c.extension.proofs){assert.deepEqual(restoreIdentityDestinationUxPreviousContract(c).extension.proofs.find(row=>row.id===spec.id),previous.extension.proofs.find(row=>row.id===spec.id));assert.deepEqual(currentProducerSourceFiles(spec,process.cwd()),spec.sourceFiles);}
 assert.equal(verifyProgressEvidenceWaitCurrentSources(c,read).sourceSetChanges,0);assert.equal(verifyHomeDecisionsCurrentSources(c,read).nativeOrBrowserAcceptance,false);
});
test('progress evidence wait advances only authenticated predecessor pins after historical composition and rejects changed declarations or bytes',()=>{
 const c=current();for(const row of waitExpected.reviewedSourceChanges){for(const pin of [row.previousSha256,row.currentSha256])assert.equal(progressEvidenceWaitCurrentSourcePin(c,{path:row.path,sha256:pin}),identityDestinationUxCurrentSourcePin(c,{path:row.path,sha256:row.currentSha256}));assert.equal(progressEvidenceWaitPreviousSourcePin(c,{path:row.path,sha256:row.currentSha256}),row.previousSha256);denied(()=>progressEvidenceWaitCurrentSourcePin(c,{path:row.path,sha256:'f'.repeat(64)}));for(const replacement of [null,Buffer.from('foreign')])denied(()=>verifyProgressEvidenceWaitCurrentSources(c,file=>file===row.path?replacement:read(file)));}
 for(const edit of [c=>c[waitKey].reviewedSourceChanges.pop(),c=>c[waitKey].reviewedSourceChanges.reverse(),c=>c[waitKey].validationSources.pop(),c=>{c[waitKey].validationSources[0].sha256='f'.repeat(64);},c=>{c[waitKey].previousContractSha256='f'.repeat(64);},c=>{c[waitKey].native.totalCheckCount=37;},c=>{c[waitKey].nativeOrBrowserAcceptance=true;},c=>{c.blocks[0].step.run+='\ntrue';}]){historicalMutation(edit,restoreProgressEvidenceWaitPreviousContract);const changed=current();edit(changed);denied(()=>verifyProgressEvidenceWaitCurrentSources(changed,read));}
 const previous=restoreProgressEvidenceWaitPreviousContract(c);denied(()=>verifyHomeDecisionsCurrentSources(previous,read));
});
function progressWaitNativeShadow(){
 const source=read(waitExpected.native.producer).toString('utf8'),tree=parse(source,{sourceType:'module'}),rows=[];function walk(n){if(!n||typeof n!=='object')return;if(n.type==='CallExpression'&&n.callee?.object?.name==='checks'&&n.callee?.property?.name==='push')for(const a of n.arguments){assert.equal(a.type,'StringLiteral');rows.push({start:a.start,name:a.value});}for(const v of Object.values(n))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}walk(tree.program);
 return {status:'PASS',environment:waitExpected.native.environment,checks:rows.sort((a,b)=>a.start-b.start).map(row=>row.name),provider:'controlled-synthetic-media-only',blob:'controlled-private-byte-store',outbound:'controlled-no-send-result-only',productionDataWritten:false,realMetaRequests:0,physicalAttendanceAccepted:false,realHumanIdentityAccepted:false,cleanup:{poolClosed:true,ownConnectionsClosed:true,databaseRemoved:true,adminClosed:true}};
}
test('progress evidence wait native decoder requires exact37 historical plus9 controls cleanup limits and current source bytes',()=>{
 const validate=proof=>validateProgressEvidenceWaitNativeProofBytes(Buffer.from(serialize(proof)),current(),read),proof=progressWaitNativeShadow(),before=serialize(proof);assert.equal(validate(proof).checks,46);assert.equal(serialize(proof),before);
 for(const edit of [p=>p.checks.pop(),p=>p.checks.reverse(),p=>{p.checks[37]=p.checks[38];},p=>{p.checks=p.checks.slice(0,37);},p=>{p.realMetaRequests=1;},p=>{p.productionDataWritten=true;},p=>{p.realHumanIdentityAccepted=true;},p=>{p.cleanup.databaseRemoved=false;},p=>{p.extra=true;}]){const changed=structuredClone(proof);edit(changed);assert.throws(()=>validate(changed),{code:'PROGRESS_EVIDENCE_WAIT_NATIVE_PROOF_REJECTED'});}
 assert.throws(()=>validateProgressEvidenceWaitNativeProofBytes(Buffer.from('{}'),current(),read),{code:'PROGRESS_EVIDENCE_WAIT_NATIVE_PROOF_REJECTED'});
});
function progressWaitCompanyShadow(){const e=n=>'customer_webhook_'+String(n).repeat(64),core={taskId:'task_'+'1'.repeat(32),projectId:'project-c',progress:{sourceEventId:e(4),submittedBy:'person'},evidence:{sourceEventId:e(5)}},deadline='2026-10-17T12:15:00.000Z';return {core,wait:{version:1,state:'PROGRESS_EVIDENCE_WAIT',taskId:core.taskId,taskRevision:'2026-10-17T12:00:00.123456',sectorId:'sector-main',progress:25,quantity:null,baseline:null,unit:null,originalDeadline:deadline,initial:{eventId:e(1),promptEventId:e(1),nonce:'1'.repeat(20),deadline},recheck:{eventId:e(2),promptEventId:e(2),nonce:'2'.repeat(20),deadline},resumed:{eventId:e(3),promptEventId:e(3),deadline},routePrincipal:{organizationId:'org-a',connectionId:'channel-a',routeId:'company_route_'+'a'.repeat(64),routeEpoch:13,projectId:core.projectId,workerId:'worker-c',actorId:'person',membershipId:'member',assignmentRevision:3,bindingId:'channel_binding_'+'b'.repeat(32)},taskUnchanged:true,proposalCount:0}};}
test('company wait facts require fixed deadline fresh prompt nonce preserved measurement and current route context without real acceptance',()=>{
 const {core,wait}=progressWaitCompanyShadow();assert.equal(validateProgressEvidenceWaitCompanyFacts(wait,core).realAcceptance,false);
 for(const edit of [w=>{delete w.quantity;},w=>{w.quantity=25;},w=>{w.extra=true;},w=>{w.recheck.deadline='2026-10-17T12:30:00.000Z';},w=>{w.recheck.nonce=w.initial.nonce;},w=>{w.resumed.eventId=w.initial.eventId;w.resumed.promptEventId=w.initial.eventId;},w=>{w.routePrincipal.projectId='project-a';},w=>{w.routePrincipal.actorId='foreign';},w=>{w.taskUnchanged=false;},w=>{w.proposalCount=1;}]){const changed=structuredClone(wait);edit(changed);assert.throws(()=>validateProgressEvidenceWaitCompanyFacts(changed,core),{code:'COMPANY_ONBOARDING_UX_NATIVE_PROOF_REJECTED'});}
});

test('identity destination outer restores complete9511 and preserves native46 company54 and historical103 before its exact two-source addition',()=>{
 // Project only historical metadata. Actual source readers and current verification below remain unchanged.
 const c=current(),published=restoreWorksiteLiveHoursPreviousContract(c),before=serialize(c),prior=restoreIdentityDestinationUxPreviousContract(c);assert.equal(sha(serialize(prior)),'9511a06c538d2e11de2fdbbc9c947476f89da0402744201594772170fdfe518b');assert.equal(serialize(c),before);assert.deepEqual(c.progressEvidenceWaitCurrentRevision,prior.progressEvidenceWaitCurrentRevision);assert.equal(c.progressEvidenceWaitCurrentRevision.native.totalCheckCount,46);assert.equal(c.progressEvidenceWaitCurrentRevision.company.totalCheckCount,54);
 const spec=c.extension.proofs.find(row=>row.id==='identity-only-ui'),publishedSpec=published.extension.proofs.find(row=>row.id===spec.id),old=prior.extension.proofs.find(row=>row.id===spec.id);assert.deepEqual(spec.checkNames,old.checkNames);assert.equal(spec.checkNames.length,103);assert.equal(old.sourceFiles.length,149);assert.deepEqual(restoreWorksiteLiveHoursSourceSet(c,spec.kind,spec.sourceFiles),publishedSpec.sourceFiles);assert.equal(publishedSpec.sourceFiles.length,151);assert.deepEqual(identityDestinationUxProofSourceAdditions(publishedSpec),['src/app/(identity)/cuenta/onboarding-guide.js','src/app/(identity)/cuenta/onboarding-guide.module.css']);assert.deepEqual(currentProducerSourceFiles(spec,process.cwd()),spec.sourceFiles);assert.equal(verifyIdentityDestinationUxCurrentSources(c,read).nativeOrBrowserAcceptance,false);
 for(const observed of published.extension.proofs)if(observed.id!==spec.id)assert.deepEqual(observed,prior.extension.proofs.find(row=>row.id===observed.id));
});
test('identity destination pins authenticate exact predecessor current and full source bytes without expanding aliases or mutable history',()=>{
 const c=current(),delta=destinationExpected.browser.producerDelta,refs=[...destinationExpected.reviewedSourceChanges,{path:delta.producer,previousSha256:delta.previousProducerSha256,currentSha256:delta.currentProducerSha256}];
 for(const row of refs){for(const pin of [row.previousSha256,row.currentSha256])assert.equal(identityDestinationUxCurrentSourcePin(c,{path:row.path,sha256:pin}),worksiteLiveHoursCurrentSourcePin(c,{path:row.path,sha256:row.currentSha256}));assert.equal(identityDestinationUxPreviousSourcePin(c,{path:row.path,sha256:row.currentSha256}),row.previousSha256);denied(()=>identityDestinationUxCurrentSourcePin(c,{path:row.path,sha256:'f'.repeat(64)}));for(const replacement of [null,Buffer.from('foreign')])denied(()=>verifyIdentityDestinationUxCurrentSources(c,file=>file===row.path?replacement:read(file)));}
 for(const edit of [c=>c[destinationKey].reviewedSourceChanges.pop(),c=>c[destinationKey].validationSources.reverse(),c=>{c[destinationKey].validationSources[0].sha256='f'.repeat(64);},c=>{c[destinationKey].browser.sourceDelta.additions.reverse();},c=>{c[destinationKey].browser.supplementalCheckCount=0;},c=>{c[destinationKey].previousContractSha256='f'.repeat(64);},c=>{c.blocks[0].step.run+='\ntrue';}]){historicalMutation(edit,restoreIdentityDestinationUxPreviousContract);const changed=current();edit(changed);denied(()=>verifyIdentityDestinationUxCurrentSources(changed,read));}
});
function destinationDecoderShadow(){const c=current(),f=identityDestinationUxBrowserShadow(c),spec=c.extension.proofs.find(row=>row.id==='identity-only-ui'),proof={checks:['untouched core shadow marker'],totalCheckCount:103,harnessSha256:sha(read(spec.producer)),sourceManifest:spec.sourceFiles.map(path=>({path,sha256:sha(read(path))})),...f.fields};return {c,f,proof,validate:p=>validateIdentityDestinationUxBrowserSupplement(p,c,{readSource:read,readEvidence:path=>f.evidence.get(path)||null})};}
test('the current identity producer restores exact published8c source solely for historical source tests while current gates keep raw bytes',()=>{
 const c=current(),p=destinationExpected.browser.producerDelta.producer,raw=read(p),unchanged=sha(raw),previous=restoreIdentityDestinationUxPreviousProducerText(c,p,raw),body=destinationExpected.browser.producerSourceHistory;assert.equal(sha(previous),'e11ed3c52c998f84c0e7ed21ebbe806a1aa8816007b7819203e7d6c4ef4add19');assert.equal(previous.length,55811);assert.equal(body.previousBytes,previous.length);assert.equal(sha(read(p)),unchanged);assert.deepEqual(restoreIdentityDestinationUxPreviousProducerText(c,p,Buffer.from(raw.toString('utf8').replaceAll('\r\n','\n'))),previous);assert.deepEqual(restoreIdentityDestinationUxPreviousProducerText(c,p,Buffer.from(raw.toString('utf8').replaceAll('\r\n','\n').replaceAll('\n','\r\n'))),previous);
 for(const bytes of [null,previous,Buffer.concat([raw,Buffer.from('\n')]),raw.subarray(1),Buffer.from([255])])denied(()=>restoreIdentityDestinationUxPreviousProducerText(c,p,bytes));denied(()=>restoreIdentityDestinationUxPreviousProducerText(c,'scripts/foreign.mjs',raw));const changed=current();changed[destinationKey].browser.producerSourceHistory.inverseHunks.pop();denied(()=>restoreIdentityDestinationUxPreviousProducerText(changed,p,raw));assert.equal(verifyIdentityDestinationUxCurrentSources(c,read).nativeOrBrowserAcceptance,false);
});
test('identity destination sixteen measured records strict append geometry network and PNG bytes validate before an immutable legacy103 projection',()=>{
 const s=destinationDecoderShadow(),before=serialize(s.proof),projected=s.validate(s.proof);assert.equal(s.f.boundary,'VALIDATOR_ONLY_NOT_BROWSER_EXECUTION');assert.equal(s.proof.destinationNavigation.checks.length,16);assert.equal(s.proof.combinedTotalCheckCount,119);assert.equal(Object.hasOwn(projected,'destinationNavigation'),false);assert.equal(Object.hasOwn(projected,'combinedTotalCheckCount'),false);assert.deepEqual(projected.checks,s.proof.checks);assert.deepEqual(projected.sourceManifest,s.proof.sourceManifest);assert.equal(serialize(s.proof),before);
 for(const edit of [p=>{delete p.destinationNavigation;},p=>p.destinationNavigation.checks.pop(),p=>p.destinationNavigation.checks.reverse(),p=>{p.destinationNavigation.checks[1]=p.destinationNavigation.checks[0];},p=>{p.combinedTotalCheckCount=103;},p=>{p.destinationNavigation.limits.realProviderCalls=1;},p=>{p.destinationNavigation.checks[0].beforeRelease.targetMounted=true;},p=>{p.destinationNavigation.checks[0].geometry.focused=false;},p=>{p.destinationNavigation.checks[0].geometry.documentWidth=9999;},p=>{p.destinationNavigation.checks[0].geometry.detailsOpen=true;},p=>{p.destinationNavigation.checks[0].geometry.screenHidden=true;},p=>{p.destinationNavigation.checks[0].geometry.screen='identidad';},p=>{p.destinationNavigation.checks[0].geometry.otherPrivateScreenHidden=false;},p=>{p.destinationNavigation.checks[0].profileRead.heldBeforeNavigation=false;},p=>{p.destinationNavigation.checks[0].profileRead.afterGeometry.top++;p.destinationNavigation.checks[0].profileRead.afterGeometry.bottom++;},p=>{p.destinationNavigation.checks[0].profileRead.afterGeometry.top=1231;p.destinationNavigation.checks[0].profileRead.afterGeometry.bottom=1261;},p=>{p.destinationNavigation.checks[1].draftPreservation.submitted=true;},p=>{p.destinationNavigation.checks[1].draftPreservation.hidden.formVisible=true;},p=>{p.destinationNavigation.checks[1].draftPreservation.after.sameForm=false;},p=>{p.destinationNavigation.checks[1].draftPreservation.after.consent=false;},p=>{p.destinationNavigation.checks[1].draftPreservation.after.imageCount=0;},p=>{p.destinationNavigation.checks[1].draftPreservation.after.sameImages=false;},p=>{p.destinationNavigation.checks[0].totalPosts=1;},p=>{p.destinationNavigation.checks[1].requestCountAfter=4;},p=>{p.destinationNavigation.checks[1].history[3].hash='#participant-title';},p=>{p.destinationNavigation.checks[1].append.projectReads[1].afterTask='foreign';},p=>{p.destinationNavigation.checks[1].append.after.activeId='worker-channel-title';},p=>{p.destinationNavigation.checks[1].append.pending.rect.top+=4;p.destinationNavigation.checks[1].append.pending.rect.bottom+=4;},p=>{p.destinationNavigation.checks[1].append.pending.activeTagName='H2';},p=>{p.destinationNavigation.checks[1].append.after.activeTagName='INPUT';},p=>{p.destinationNavigation.checks[1].append.pending.buttonDisabled=false;},p=>{p.destinationNavigation.checks[1].append.after.firstTaskTop=NaN;},p=>{p.destinationNavigation.checks[1].append.after.taskCount=1;},p=>{p.destinationNavigation.checks[2].oldFactsVisible=true;},p=>{p.destinationNavigation.checks[3].history[0].privateMounted=true;},p=>{p.destinationNavigation.checks[0].screenshot.sha256='f'.repeat(64);},p=>{p.destinationNavigation.checks[0].screenshot.height++;},p=>{p.sourceManifest[0].sha256='f'.repeat(64);},p=>{p.harnessSha256='f'.repeat(64);}]){const p=structuredClone(s.proof);edit(p);assert.throws(()=>s.validate(p),{code:'IDENTITY_DESTINATION_UX_PROOF_REJECTED'});}
 s.f.evidence.clear();assert.throws(()=>s.validate(s.proof),{code:'IDENTITY_DESTINATION_UX_PROOF_REJECTED'});
});

// These tests authenticate the physical source frame only. They do not construct
// a synthetic native proof or replace the real PostgreSQL producer execution.
const PILOT_COMPANY_NATIVE_ADDITIONS=[
 'src/lib/consumption-evidence-catalog.mjs',
 'src/lib/consumption-evidence-http.mjs',
 'src/lib/plan-budget-csv-source.mjs',
];
function companyNativePhysicalManifest(){
 // The Native producer scans all src/lib files; Main's PG_COMPANY_KYC
 // declaration intentionally uses a different historical238-source binding.
 const files=new Set();
 function scan(relative){for(const entry of readdirSync(relative,{withFileTypes:true})){const file=relative+'/'+entry.name;if(entry.isDirectory())scan(file);else files.add(file);}}
 scan('src/lib');
 for(const file of ['scripts/lib/company-channel-disposable-fixture.mjs','scripts/lib/company-channel-migration.mjs','scripts/lib/disposable-postgres-cleanup.mjs','scripts/fixtures/meta-signup-field-lifecycle-fixture.mjs','tests/fixtures/own-company-meta.mjs',...canonicalParticipantKycSourceFiles()])files.add(file);
 const paths=[...files].sort(),previousPaths=paths.filter(file=>!PILOT_COMPANY_NATIVE_ADDITIONS.includes(file));
 assert.deepEqual(paths.filter(file=>PILOT_COMPANY_NATIVE_ADDITIONS.includes(file)),PILOT_COMPANY_NATIVE_ADDITIONS);
 assert.equal(previousPaths.length,250);assert.equal(new Set(previousPaths).size,250);
 assert.equal(paths.length,253);assert.equal(new Set(paths).size,253);
 return paths.map(path=>({path,sha256:sha(read(path))}));
}
const companyNativeDenied=error=>error?.code==='COMPANY_ONBOARDING_UX_NATIVE_PROOF_REJECTED';
test('company native source frame authenticates243 physical RAW sources while preserving238 historical and54 semantic checks',()=>{
 const manifest=companyNativePhysicalManifest(),before=serialize(manifest),contractBefore=read('.github/workspace-acceptance-contract.json');
 const result=validateCompanyOnboardingUxNativeSourceManifest(manifest,read);
 assert.deepEqual(result,{status:'PASS',sourceReferences:253,historicalSourceReferences:238,sourceScope:'CURRENT_AUTHENTICATED_OWNERS',nativeOrBrowserAcceptance:false});
 assert.equal(serialize(manifest),before);assert.deepEqual(read('.github/workspace-acceptance-contract.json'),contractBefore);
 assert.equal(COMPANY_ONBOARDING_UX_NATIVE_REVIEW.sourceCount,238);assert.equal(COMPANY_ONBOARDING_UX_NATIVE_REVIEW.totalCheckCount,54);assert.equal(COMPANY_ONBOARDING_UX_NATIVE_REVIEW.addedCheckNames.length,5);
 assert.equal(companyExpected.native.sourceCount,238);assert.equal(companyExpected.native.totalCheckCount,54);
 const historical=manifest.map(row=>row.path).filter(path=>!['src/lib/field-hours-report.mjs','src/lib/plan-budget-source.mjs','scripts/lib/synthetic-capture-quality.mjs','src/lib/field-execution-policy.mjs','src/lib/field-execution-store.mjs','src/lib/meta-field-execution-conversation.mjs',"src/lib/capture-quality-gate.mjs","src/lib/capture-quality-policy.mjs","src/lib/participant-facial-attempt.mjs","src/lib/participant-facial-policy.mjs","src/lib/participant-facial-precommit.mjs","src/lib/private-capture-quality.mjs",...PILOT_COMPANY_NATIVE_ADDITIONS].includes(path)).sort();
 assert.equal(historical.length,238);assert.equal(sha(JSON.stringify(historical)),COMPANY_ONBOARDING_UX_NATIVE_REVIEW.sourcePathsSha256);
});
test('company native source frame rejects missing foreign duplicate and corrupt source references',()=>{
 const original=companyNativePhysicalManifest();
 for(const edit of [m=>m.pop(),m=>m.push({...m[0]}),m=>{m[0]={...m[1]};},m=>{m[0].path='src/lib/foreign-native-source.mjs';},m=>{m[0].sha256='f'.repeat(64);},m=>{m[0].unreviewed=true;}]){
  const manifest=structuredClone(original);edit(manifest);assert.throws(()=>validateCompanyOnboardingUxNativeSourceManifest(manifest,read),companyNativeDenied);
 }
 for(const file of ['src/lib/field-hours-report.mjs','src/lib/plan-budget-source.mjs','src/lib/field-execution-policy.mjs','src/lib/field-execution-store.mjs','src/lib/meta-field-execution-conversation.mjs',...PILOT_COMPANY_NATIVE_ADDITIONS]){
  assert.throws(()=>validateCompanyOnboardingUxNativeSourceManifest(original,p=>p===file?null:read(p)),companyNativeDenied);
  assert.throws(()=>validateCompanyOnboardingUxNativeSourceManifest(original,p=>p===file?Buffer.concat([read(p),Buffer.from('\n// corrupt RAW bytes\n')]):read(p)),companyNativeDenied);
 }
});
test('company native source frame rejects partial missing corrupt and foreign owner metadata',()=>{
 const manifest=companyNativePhysicalManifest();
 for(const edit of [c=>{delete c.worksiteLiveHoursCurrentRevision;},c=>{delete c.planBudgetCurrentRevision;},c=>{delete c.worksiteLiveHoursCurrentRevision;delete c.planBudgetCurrentRevision;},c=>{c.worksiteLiveHoursCurrentRevision={};},c=>{c.planBudgetCurrentRevision={};},c=>{c.planBudgetCurrentRevision.references[0].currentSha256='f'.repeat(64);},c=>{delete c.planBudgetCurrentRevision.pilotCompletionAdvance;},c=>{c.planBudgetCurrentRevision.pilotCompletionAdvance.sourceChanges=c.planBudgetCurrentRevision.pilotCompletionAdvance.sourceChanges.filter(row=>row.path!==PILOT_COMPANY_NATIVE_ADDITIONS[0]);}]){
  const contract=current();edit(contract);const raw=Buffer.from(serialize(contract));
  assert.throws(()=>validateCompanyOnboardingUxNativeSourceManifest(manifest,p=>p==='.github/workspace-acceptance-contract.json'?raw:read(p)),companyNativeDenied);
 }
});
test('company native source frame detects late baseline addition and contract RAW changes and copies mutable reader buffers',()=>{
 const manifest=companyNativePhysicalManifest();
 for(const file of [manifest[0].path,'src/lib/field-hours-report.mjs','src/lib/plan-budget-source.mjs',...PILOT_COMPANY_NATIVE_ADDITIONS,'.github/workspace-acceptance-contract.json']){
  const original=read(file),text=original.toString('utf8'),normalized=text.replaceAll('\r\n','\n'),changed=Buffer.from(text.includes('\r\n')?normalized:normalized.replaceAll('\n','\r\n'));assert.equal(changed.equals(original),false);
  let count=0;const observed=new Set();
  assert.throws(()=>validateCompanyOnboardingUxNativeSourceManifest(manifest,p=>{observed.add(p);return p===file&&++count>1?changed:read(p);}),companyNativeDenied);assert.ok(count>=2);assert.ok(observed.has(file));
 }
 const file='src/lib/field-hours-report.mjs',shared=Buffer.from(read(file));let reads=0;
 assert.throws(()=>validateCompanyOnboardingUxNativeSourceManifest(manifest,p=>{if(p!==file)return read(p);if(++reads===2)shared[0]^=1;return shared;}),companyNativeDenied);assert.ok(reads>=2);
});
test('company native source frame rejects caller manifest mutation and preserves failure fences without native acceptance',()=>{
 const manifest=companyNativePhysicalManifest(),first=manifest[0].path;let mutated=false,finalReads=0;
 assert.throws(()=>validateCompanyOnboardingUxNativeSourceManifest(manifest,p=>{if(p===first){finalReads++;if(!mutated){mutated=true;manifest[0].sha256='f'.repeat(64);}}return read(p);}),companyNativeDenied);assert.ok(finalReads>=2);
 const other=companyNativePhysicalManifest(),target=other[0].path;other[1].sha256='f'.repeat(64);let reads=0;
 assert.throws(()=>validateCompanyOnboardingUxNativeSourceManifest(other,p=>{if(p===target)reads++;return read(p);}),companyNativeDenied);assert.ok(reads>=2);
});

test('company native historical source-set frame preserves the238 minimum reader without declaring historical proof acceptance',()=>{
 const additions=['src/lib/field-hours-report.mjs','src/lib/plan-budget-source.mjs','scripts/lib/synthetic-capture-quality.mjs','src/lib/field-execution-policy.mjs','src/lib/field-execution-store.mjs','src/lib/meta-field-execution-conversation.mjs',"src/lib/capture-quality-gate.mjs","src/lib/capture-quality-policy.mjs","src/lib/participant-facial-attempt.mjs","src/lib/participant-facial-policy.mjs","src/lib/participant-facial-precommit.mjs","src/lib/private-capture-quality.mjs",...PILOT_COMPANY_NATIVE_ADDITIONS],manifest=companyNativePhysicalManifest().filter(row=>!additions.includes(row.path)),allowed=new Set(manifest.map(row=>row.path));assert.equal(manifest.length,238);allowed.add(COMPANY_ONBOARDING_UX_NATIVE_REVIEW.producer);allowed.add('.github/workspace-acceptance-contract.json');
 const outside=[];const result=validateCompanyOnboardingUxNativeSourceManifest(manifest,file=>{if(!allowed.has(file)){outside.push(file);return null;}return file==='.github/workspace-acceptance-contract.json'?Buffer.from('{}'):read(file);});
 assert.deepEqual(outside,[]);assert.deepEqual(result,{status:'PASS',sourceReferences:238,historicalSourceReferences:238,sourceScope:'HISTORICAL_SOURCE_SET',nativeOrBrowserAcceptance:false});
});

// These are count/history data frames only; never a projected source reader or current contract.
const OWN171_COUNT_FRAME_ADDITIONS=[{"path":"scripts/lib/participant-preanalysis-current-ci-lineage.mjs","status":"MODIFIED","previousSha256":"3c330d4f821d7f2c998dd17064c67ffdcc52dc3cfbd033c165af39e071333f7b","previousBytes":54987},{"path":"scripts/verify-participant-kyc-preanalysis-postgres.mjs","status":"MODIFIED","previousSha256":"d2fabf981cd77c28ebf4be49867f07dcf1a23ae8616848e9c0c038b8291f83d8","previousBytes":61792}];
const OWN169_COUNT_FRAME_ADDITION={"path":"tests/production-whatsapp-feedback-workspace-ci.test.mjs","status":"MODIFIED","previousSha256":"4cbba761beac4b8a5d72560a20c5395ba50bc5cbcfd68000de96e5c20022e342","previousBytes":13355};
function ownSourceCountFrames171(advance){
 const current171=advance.sourceChanges.map(({path,status,previousSha256,previousBytes})=>({path,status,previousSha256,previousBytes}));
 const digest=rows=>sha(JSON.stringify(rows,null,2)+'\n');
 assert.equal(current171.length,171);assert.equal(new Set(current171.map(row=>row.path)).size,171);assert.equal(digest(current171),'1cf69da9df253cac86ec5afd6d44e7847f6bc73e4d88fdb5bf47300d08b213f7');
 const additions=current171.filter(row=>OWN171_COUNT_FRAME_ADDITIONS.some(added=>added.path===row.path));assert.deepEqual(additions,OWN171_COUNT_FRAME_ADDITIONS);
 const wa169=current171.filter(row=>!OWN171_COUNT_FRAME_ADDITIONS.some(added=>added.path===row.path));assert.equal(wa169.length,169);assert.equal(digest(wa169),'51b0eaad0135f542ffa03343c76721396d75d09020052ad22e1972ae7d1ca8cb');
 assert.deepEqual(wa169.find(row=>row.path===OWN169_COUNT_FRAME_ADDITION.path),OWN169_COUNT_FRAME_ADDITION);
 const historical168=wa169.filter(row=>row.path!==OWN169_COUNT_FRAME_ADDITION.path);assert.equal(historical168.length,168);assert.equal(digest(historical168),'5d1233d36cb473fc0a65e3c04270f223437b4021d0cc015eeb97382bbf046c5a');
 return{historical168,wa169,current171};
}
// Additional count/history frame only; never a source reader or current contract.
const OWN173_COUNT_FRAME_ADDITIONS=[{"path":"scripts/verify-consumption-feedback-ci.mjs","status":"MODIFIED","previousSha256":"860684a236deb8608f191b6247f88d7bab428175eb5c90757940bd624c8eb25e","previousBytes":18656},{"path":"scripts/verify-kyc-reply-feedback-ci.mjs","status":"MODIFIED","previousSha256":"c07f34ff0f4d49325b1fae912bec581d183cd2b2ee21214840b3ff9c6a900dc3","previousBytes":19002}];
function ownSourceCountFrames173(advance){
 const current173=advance.sourceChanges.map(({path,status,previousSha256,previousBytes})=>({path,status,previousSha256,previousBytes}));
 const digest=rows=>sha(JSON.stringify(rows,null,2)+'\n');
 assert.equal(current173.length,173);assert.equal(new Set(current173.map(row=>row.path)).size,173);assert.equal(digest(current173),'7b63471dd34b6ad2ba4e3880520d3c68843f75aa99b937589dc7455640272412');
 const additions=current173.filter(row=>OWN173_COUNT_FRAME_ADDITIONS.some(added=>added.path===row.path));assert.deepEqual(additions,OWN173_COUNT_FRAME_ADDITIONS);
 const previous171=current173.filter(row=>!OWN173_COUNT_FRAME_ADDITIONS.some(added=>added.path===row.path));
 const previous=ownSourceCountFrames171({sourceChanges:previous171});return{...previous,current173};
}
// Additive exact current frame. The complete173 historical helper and assertions remain unchanged.
const OWN181_COUNT_FRAME_ADDITIONS=[{"path":"scripts/verify-company-kyc-outbound-compact-ci.mjs","status":"MODIFIED","previousSha256":"d3a08f3d3c7027556cd2d517db29cb85b8b432f413de50079fd2f6cc46913b68","previousBytes":26621},{"path":"src/app/(identity)/cuenta/participant-onboarding-next-step.mjs","status":"MODIFIED","previousSha256":"18481bd2c61887a04321523aad36aa22c43406089e29f1450ff0874133a6d4ae","previousBytes":27166},{"path":"src/lib/meta-customer-templates.mjs","status":"MODIFIED","previousSha256":"ca9e491b8b1b4c25c89585408cb53eae13e2423fdf48a93deed0846126e1c46c","previousBytes":14322},{"path":"src/lib/participant-http.mjs","status":"MODIFIED","previousSha256":"192b048051ee0be58792ca74bda3c53876fc678fd68a43ee3ea0e4e5af1b10ba","previousBytes":11950},{"path":"src/lib/participant-onboarding-delivery.mjs","status":"MODIFIED","previousSha256":"615592cc1a6215e24c48e8873a27211421853f99ca9093e6f490f77532b3d013","previousBytes":18051},{"path":"src/lib/participant-onboarding-intent.mjs","status":"MODIFIED","previousSha256":"07114f6066e10617357c4e5d8e2db2b9dc846e5f4cffbc5aef09f2b7bfada9de","previousBytes":2544},{"path":"src/lib/participant-onboarding-policy.mjs","status":"MODIFIED","previousSha256":"59409797ce3e13b7cfe63fe21d8d7e2c848ee49e0766015939242a9f43687c03","previousBytes":3824},{"path":"tests/production-participant-onboarding-next-step.test.mjs","status":"MODIFIED","previousSha256":"b7af8bd17e7e9e9bfb6f7dd5ff219cfa89663fec4a060d0562d317d5fe933240","previousBytes":16946}];
function ownSourceCountFrames181(advance){
 const current181=advance.sourceChanges.map(({path,status,previousSha256,previousBytes})=>({path,status,previousSha256,previousBytes})),digest=rows=>sha(JSON.stringify(rows,null,2)+'\n');
 assert.equal(current181.length,181);assert.equal(new Set(current181.map(row=>row.path)).size,181);assert.equal(digest(current181),"7443e1d3f4a83e600b2846b88114bfff92804ccd9808b673710b11ead557298b");assert.deepEqual(current181.filter(row=>OWN181_COUNT_FRAME_ADDITIONS.some(a=>a.path===row.path)),OWN181_COUNT_FRAME_ADDITIONS);
 const previous173=current181.filter(row=>!OWN181_COUNT_FRAME_ADDITIONS.some(a=>a.path===row.path)),previous=ownSourceCountFrames173({sourceChanges:previous173});return{...previous,current181};
}



// Additive reviewed UX frame. All historical181 tuples and assertions remain intact.
const OWN186_COUNT_FRAME_ADDITIONS=[{"path":"scripts/verify-clerk-access-ui.mjs","status":"MODIFIED","previousSha256":"9945c3ba3ff802d481ca3b9ce05b1fa122927a6b398ec31dc60b545aecf40fd8","previousBytes":46873},{"path":"scripts/verify-participant-ai-ui.mjs","status":"MODIFIED","previousSha256":"a3064b7f3b2b2d2ec361f24ac35385a61d86b2e10e864600dd9e4bbfcf56e494","previousBytes":34296},{"path":"scripts/verify-participant-bank-intake-ui.mjs","status":"MODIFIED","previousSha256":"55c7ff7caf96501804ee9eb605a405f9a982cf20b1c1d0b007b8332dda925154","previousBytes":19693},{"path":"src/app/(identity)/cuenta/workspace-tools-navigation.js","status":"MODIFIED","previousSha256":"6e3bc5b9d14973153e080a55ba55a51f1c36838641c8510af4f2f664e676ddc9","previousBytes":4512},{"path":"src/app/(identity)/cuenta/workspace.module.css","status":"MODIFIED","previousSha256":"339fee2591a341bbb7839a19d55a5c298c728ef1de38a2efc3680999f4636db4","previousBytes":19064}];
function ownSourceCountFrames186(advance){
 const current186=advance.sourceChanges.map(({path,status,previousSha256,previousBytes})=>({path,status,previousSha256,previousBytes}));
 assert.equal(current186.length,186);assert.equal(new Set(current186.map(row=>row.path)).size,186);assert.equal(sha(JSON.stringify(current186,null,2)+'\n'),"ec7026d9b583b5d5a315ff666eb708be0cf5f7a5678b2ad18b5770d7bb5c877e");
 assert.deepEqual(current186.filter(row=>OWN186_COUNT_FRAME_ADDITIONS.some(added=>added.path===row.path)),OWN186_COUNT_FRAME_ADDITIONS);
 const previous181=current186.filter(row=>!OWN186_COUNT_FRAME_ADDITIONS.some(added=>added.path===row.path));
 assert.equal(previous181.length,181);
 return {...ownSourceCountFrames181({sourceChanges:previous181}),current186};
}

test("native materials membership requires all three exact source owners and the complete bounded actual owner frame",function nativeMaterials(){
 const manifest=companyNativePhysicalManifest(),paths=["src/lib/field-execution-policy.mjs","src/lib/field-execution-store.mjs","src/lib/meta-field-execution-conversation.mjs"],contract=current(),own=contract.planBudgetCurrentRevision.ownRuntimeDiagnosticAdvance;assert.equal(verifyPlanBudgetCurrentSources(contract,read).nativeOrBrowserAcceptance,false);
 const ownStages=ownSourceCountFrames186(own);assert.equal(ownStages.current186.length,186);assert.equal(ownStages.current186.filter(row=>row.status==='MODIFIED').length,140);assert.equal(ownStages.current181.length,181);assert.equal(ownStages.current181.filter(row=>row.status==='MODIFIED').length,135);assert.equal(ownStages.historical168.length,168);assert.equal(sha(serialize(ownStages.historical168)),'5d1233d36cb473fc0a65e3c04270f223437b4021d0cc015eeb97382bbf046c5a');assert.equal(ownStages.wa169.length,169);assert.equal(sha(serialize(ownStages.wa169)),'51b0eaad0135f542ffa03343c76721396d75d09020052ad22e1972ae7d1ca8cb');assert.equal(ownStages.current171.length,171);assert.equal(sha(serialize(ownStages.current171)),'1cf69da9df253cac86ec5afd6d44e7847f6bc73e4d88fdb5bf47300d08b213f7');assert.equal(ownStages.current173.length,173);assert.equal(sha(serialize(ownStages.current173)),'7b63471dd34b6ad2ba4e3880520d3c68843f75aa99b937589dc7455640272412');assert.equal(ownStages.current173.filter(row=>row.status==='MODIFIED').length,127);
 assert.deepEqual(own.retainedDependencies.map(row=>row.path),["src/app/(identity)/cuenta/kyc-camera-session.mjs","src/app/(identity)/cuenta/participant-panel.module.css"]);
 for(const path of paths){const row=own.sourceChanges.find(r=>r.path===path);assert.equal(row.status,'ADDED');assert.equal(row.previousSha256,null);assert.equal(sha(read(path).toString('utf8').replaceAll('\r\n','\n')),row.currentSha256);const changed=structuredClone(contract);changed.planBudgetCurrentRevision.ownRuntimeDiagnosticAdvance.sourceChanges=changed.planBudgetCurrentRevision.ownRuntimeDiagnosticAdvance.sourceChanges.filter(r=>r.path!==path);assert.throws(()=>validateCompanyOnboardingUxNativeSourceManifest(manifest,p=>p==='.github/workspace-acceptance-contract.json'?Buffer.from(serialize(changed)):read(p)),companyNativeDenied);}
 const allowed=new Set([...planBudgetValidationFiles(contract),...homeDecisionsValidationFiles(contract),...worksiteLiveHoursValidationFiles(contract)]),nativePaths=new Set(manifest.map(r=>r.path));const limited=file=>allowed.has(file)||nativePaths.has(file)||file===COMPANY_ONBOARDING_UX_NATIVE_REVIEW.producer||file==='.github/workspace-acceptance-contract.json'?read(file):null;
 assert.equal(validateCompanyOnboardingUxNativeSourceManifest(manifest,limited).sourceReferences,253);
});

test('current material authority survives the closed KYC ownership expansion and denies partial resealing',()=>{
 const contract=current(),advance=contract.planBudgetCurrentRevision.ownRuntimeDiagnosticAdvance,before=JSON.stringify(contract);assert.equal(verifyPlanBudgetCurrentSources(contract,read).nativeOrBrowserAcceptance,false);
 for(const file of ['src/lib/field-execution-policy.mjs','src/lib/field-execution-store.mjs','src/lib/meta-field-execution-conversation.mjs']){const row=advance.sourceChanges.find(row=>row.path===file);assert.equal(row.status,'ADDED');assert.equal(row.previousSha256,null);assert.equal(row.previousBytes,0);}
 for(const file of ['src/lib/capture-quality-gate.mjs','src/lib/participant-facial-precommit.mjs'])assert.throws(()=>verifyPlanBudgetCurrentSources(contract,path=>path===file?null:read(path)),{code:'PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED'});
 for(const mutate of [value=>value.sourceChanges.pop(),value=>value.sourceChanges.push(structuredClone(value.sourceChanges[0])),value=>value.retainedDependencies.push({path:'src/lib/foreign.mjs',sha256:'f'.repeat(64),bytes:1,previousMetadataSha256:null,metadataPins:[]})]){const changed=structuredClone(contract);mutate(changed.planBudgetCurrentRevision.ownRuntimeDiagnosticAdvance);assert.throws(()=>verifyPlanBudgetCurrentSources(changed,read),{code:'PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED'});}
 assert.equal(JSON.stringify(contract),before);
});
