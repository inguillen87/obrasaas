import {OOXML_ACCOUNTING_CURRENT_REVISION,restoreOoxmlAccountingPreviousContract} from '../scripts/lib/ooxml-accounting-current-ci-lineage.mjs';
import {PLAN_BUDGET_CURRENT_SECTION,restorePlanBudgetPreviousContract,restorePlanBudgetSourceSet,verifyPlanBudgetCurrentSources,withCaptureRuntimePreviousSources,restorePlanBudgetAcceptancePreviousContract,restorePlanBudgetAcceptancePreviousSource} from '../scripts/lib/plan-budget-current-ci-lineage.mjs';
import {restoreWorksiteLiveHoursSourceSet} from '../scripts/lib/worksite-live-hours-current-ci-lineage.mjs';
import {restoreParticipantPreanalysisPreviousContract,restoreParticipantPreanalysisSourceSet} from '../scripts/lib/participant-preanalysis-current-ci-lineage.mjs';
import {restoreIntegratedIdentitySourceSet} from '../scripts/lib/integrated-identity-current-ci-lineage.mjs';
import {restoreWhatsappFieldContinuitySourceSet} from '../scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {FIELD_OUTBOUND_CURRENT_REVISION,restoreFieldOutboundPreviousContract,verifyFieldOutboundCurrentSources} from '../scripts/lib/field-outbound-current-ci-lineage.mjs';
import {verifyPlanMeasurementCurrentSources,reconstructPublishedHContract} from '../scripts/lib/plan-measurement-current-ci-lineage.mjs';
import {KYC_EXPIRED_CURRENT_REVIEWED_SOURCES,kycExpiredCurrentSourceFiles} from '../scripts/lib/kyc-expired-current-ci-lineage.mjs';
const root=new URL('../',import.meta.url),read=file=>readFileSync(new URL(file,root)),sha=value=>createHash('sha256').update(value).digest('hex');
const contract=JSON.parse(read('.github/workspace-acceptance-contract.json'));
// Authenticate the actual current companion before projecting metadata only.
// No historical source body is returned by this reader or used as current proof.
verifyPlanBudgetCurrentSources(contract,read);
const preBudgetContract=restorePlanBudgetPreviousContract(contract);
assert.equal(sha(JSON.stringify(preBudgetContract,null,2)+'\n'),'8b19235b22aa3c208098283537511fe1c816f7ff86404790a98999f0e818f839');
const outboundContract=restoreOoxmlAccountingPreviousContract(preBudgetContract);
assert.equal(sha(JSON.stringify(outboundContract,null,2)+'\n'),OOXML_ACCOUNTING_CURRENT_REVISION.previousContractSha256);
const denied=run=>assert.throws(run,{code:'PLAN_MEASUREMENT_CURRENT_CI_LINEAGE_REJECTED'});
const changed=(edit,{historicalShaOnly=false}={})=>{
 const value=structuredClone(contract);edit(value);denied(()=>verifyPlanMeasurementCurrentSources(value,read));
 // Independently retain the original outbound metadata inverse. An absent
 // historical optional companion remains a metadata no-op; the actual-current
 // verifier above must still deny it. This projection never supplies bytes.
 const previous=structuredClone(outboundContract);edit(previous);
 if(historicalShaOnly){
  // This metadata inverse validates SHA shape and discards its own section;
  // authenticating current source bytes is the separate denial above. A valid
  // but stale SHA must not be called a historical metadata rejection.
  assert.ok(Object.hasOwn(previous,'fieldOutboundCurrentRevision'));
  const prior=restoreFieldOutboundPreviousContract(previous);
  assert.equal(sha(JSON.stringify(prior,null,2)+'\n'),FIELD_OUTBOUND_CURRENT_REVISION.previousContractSha256);
  assert.equal(Object.hasOwn(prior,'fieldOutboundCurrentRevision'),false);
 }else if(Object.hasOwn(previous,'fieldOutboundCurrentRevision'))denied(()=>restoreFieldOutboundPreviousContract(previous));
 else assert.deepEqual(restoreFieldOutboundPreviousContract(previous),previous);
};


// This projection authenticates the current outer set before retaining the
// exact historical count/hash assertions belonging to the earlier CI revision.
function historicalCompactFiles(files,contract){
 const beforeBudget=restorePlanBudgetSourceSet(contract,'COMPACT',files);
 const historical=restoreWorksiteLiveHoursSourceSet(contract,'COMPACT',files);
 assert.equal(historical.length,139);assert.equal(sha(JSON.stringify(historical)),'cd474d8e9a3b754daaeef61f986e31f1c92997a8423cd9a14c06d43ea706dbea');
 assert.equal(beforeBudget.length,140);assert.deepEqual(beforeBudget,[...historical,'src/lib/field-hours-report.mjs'].sort());
 return historical;
}

test('outbound revision restores the complete exact P contract before L K I G H history',()=>{
 const prior=restoreFieldOutboundPreviousContract(contract);
 assert.equal(sha(JSON.stringify(prior,null,2)+'\n'),FIELD_OUTBOUND_CURRENT_REVISION.previousContractSha256);
 assert.equal(Object.hasOwn(prior,'fieldOutboundCurrentRevision'),false);
 assert.deepEqual(prior.kycExpiredCurrentComposition,contract.kycExpiredCurrentComposition);
 assert.equal(sha(JSON.stringify(reconstructPublishedHContract(contract),null,2)+'\n'),'9dab901cb93f3834cad0f1ea9ba386c5bb12acc913463a7dfb6368847af3fd37');
});
test('outbound source validation uses actual current bytes and certifies no native or human acceptance',()=>{
 const result=verifyFieldOutboundCurrentSources(contract,read);
 assert.equal(result.nativeAcceptance,false);assert.equal(result.historicalPinsPreserved,true);
 const lineage=verifyPlanMeasurementCurrentSources(contract,read);assert.equal(lineage.publishedCurrentSourceCount,127);
 const actualFiles=kycExpiredCurrentSourceFiles(read),historicalFiles=historicalCompactFiles(actualFiles,contract),checkpointFiles=restoreIntegratedIdentitySourceSet('COMPACT',actualFiles,contract);
 assert.equal(checkpointFiles.length,contract.participantPreanalysisCurrentRevision.consumerSourceDeltas.find(row=>row.family==='COMPACT').currentCount);
 const outer=contract.whatsappFieldContinuityCurrentRevision.sourceSetDeltas.find(row=>row.family==='COMPACT'),previousCurrentFiles=restoreWhatsappFieldContinuitySourceSet('COMPACT',actualFiles,contract);assert.equal(outer.previousCount,137);assert.equal(outer.currentCount,139);assert.deepEqual(outer.additions,['scripts/lib/kyc-neutral-step-guidance-native.mjs','scripts/lib/kyc-neutral-step-guidance-own-native.mjs']);assert.equal(sha(JSON.stringify(historicalFiles)),outer.currentPathsSha256);assert.equal(previousCurrentFiles.length,137);assert.equal(sha(JSON.stringify(previousCurrentFiles)),'ab60b810e098f47892e1a17cb01ce1f7f8e1796c1687776b528100e62cb3083f');assert.equal(previousCurrentFiles.length,contract.integratedIdentityCurrentRevision.consumerSourceDeltas.find(row=>row.family==='COMPACT').currentCount);assert.equal(lineage.sourceCount,actualFiles.length);assert.equal(historicalFiles.length,outer.currentCount);
});
test('original eight reviewed H source pins stay immutable and only two explicit current pins advance',()=>{
 assert.deepEqual(contract.kycExpiredCurrentComposition.reviewedSources,KYC_EXPIRED_CURRENT_REVIEWED_SOURCES);
 assert.equal(FIELD_OUTBOUND_CURRENT_REVISION.reviewedSourceChanges.length,2);
 for(const row of FIELD_OUTBOUND_CURRENT_REVISION.reviewedSourceChanges)assert.equal(KYC_EXPIRED_CURRENT_REVIEWED_SOURCES.find(ref=>ref.path===row.path).sha256,row.previousSha256);
});
test('missing or extra outbound revision metadata cannot authorize current source',()=>{
 changed(value=>{delete value.fieldOutboundCurrentRevision;});
 changed(value=>{value.fieldOutboundCurrentRevision.unreviewed=true;});
});
test('wrong reference head tree previous contract and helper delta are rejected',()=>{
 for(const key of ['referenceHead','referenceTree','previousContractSha256'])changed(value=>{value.fieldOutboundCurrentRevision[key]='f'.repeat(key==='previousContractSha256'?64:40);});
 for(const key of ['path','previousSha256','currentSha256'])changed(value=>{value.fieldOutboundCurrentRevision.validationDeltas[0][key]='foreign';});
});
test('third source override or changed prior reviewed pin is rejected',()=>{
 changed(value=>{value.fieldOutboundCurrentRevision.reviewedSourceChanges.push({...value.fieldOutboundCurrentRevision.reviewedSourceChanges[0],path:'src/lib/foreign.mjs'});});
 changed(value=>{value.kycExpiredCurrentComposition.reviewedSources[2].sha256=value.fieldOutboundCurrentRevision.reviewedSourceChanges[0].currentSha256;});
 for(const key of ['previousSha256','currentSha256','path'])changed(value=>{value.fieldOutboundCurrentRevision.reviewedSourceChanges[0][key]='foreign';});
});
test('every changed source and validation helper rejects stale or forged raw bytes',()=>{
 for(const row of [...FIELD_OUTBOUND_CURRENT_REVISION.reviewedSourceChanges,...FIELD_OUTBOUND_CURRENT_REVISION.validationDeltas,...contract.fieldOutboundCurrentRevision.validationSources]){
  denied(()=>verifyPlanMeasurementCurrentSources(contract,file=>file===row.path?Buffer.concat([read(file),Buffer.from('\n// changed source\n')]):read(file)));
 }
});
test('source validation cannot replace its reader with a manifest or text shim',()=>{
 denied(()=>verifyFieldOutboundCurrentSources(contract,()=>null));
 denied(()=>verifyFieldOutboundCurrentSources(contract,file=>read(file).toString('utf8')));
});
test('validation source path substitution duplication and stale pins fail closed',()=>{
 changed(value=>{value.fieldOutboundCurrentRevision.validationSources[0].path='scripts/foreign.mjs';});
 changed(value=>{value.fieldOutboundCurrentRevision.validationSources[1]=value.fieldOutboundCurrentRevision.validationSources[0];});
 changed(value=>{value.fieldOutboundCurrentRevision.validationSources[0].sha256='f'.repeat(64);},{historicalShaOnly:true});
});
test('original source lease simulated latency and source sets remain fixed',()=>{
 for(const key of Object.keys(FIELD_OUTBOUND_CURRENT_REVISION.limits))changed(value=>{value.fieldOutboundCurrentRevision.limits[key]++;});
});
test('runtime revision cannot reseal historical guards matrices source paths or producers',()=>{
 for(const edit of [value=>{value.blocks[0].commandSha256='f'.repeat(64);},value=>{value.extension.proofs[0].sourceFiles[0]='src/lib/foreign.mjs';},value=>{value.extension.proofs[0].producerSha256='f'.repeat(64);},value=>{value.kycExpiredCurrentComposition.sourceLeaseMs=120000;},value=>{value.planMeasurementCurrentLineage.currentValidationSources.pop();}])changed(edit);
});
test('the previous P contract remains preserved as metadata and is not a current runtime proof',()=>{
 const prior=restoreFieldOutboundPreviousContract(contract);
 denied(()=>verifyPlanMeasurementCurrentSources(prior,read));
 assert.equal(verifyFieldOutboundCurrentSources(prior,read),null);
});

test('Budget outer denial retains the legacy outbound category and cannot authorize an old companion or tampered current module',()=>{
 const changed=structuredClone(contract);changed[PLAN_BUDGET_CURRENT_SECTION].references[0].currentSha256='f'.repeat(64);
 assert.throws(()=>verifyPlanBudgetCurrentSources(changed,read),{code:'PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED',reason:'IMMUTABLE_COMPANION'});
 denied(()=>verifyFieldOutboundCurrentSources(changed,read));denied(()=>verifyPlanMeasurementCurrentSources(changed,read));
 const file='src/lib/plan-budget-source.mjs',tampered=path=>path===file?Buffer.concat([read(path),Buffer.from('\n// Changed current Budget module\n')]):read(path);
 assert.throws(()=>verifyPlanBudgetCurrentSources(contract,tampered),{code:'PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED',reason:'CURRENT_REFERENCE_'+file});
 // CURRENT_SOURCE belongs to literal Git65d, below the 731/1b wrappers.
 // Authenticate current sources before/after this synchronous local fixture.
 withCaptureRuntimePreviousSources(contract,read,(parent,parentRead)=>{
  const serialize=value=>JSON.stringify(value,null,2)+'\n',compiler='scripts/lib/plan-budget-current-ci-lineage.mjs',anchor='scripts/lib/plan-budget-current-ci-reviewed.mjs',contractPath='.github/workspace-acceptance-contract.json',oneB=restorePlanBudgetAcceptancePreviousContract(parent);
  assert.equal(sha(serialize(oneB)),'a89d1a6c820b811359af23359e587f9110e7341bfa0c2b558b5ee452d9ac1042');
  const declaration=value=>'// Exact budget-source CI declaration; compiler fills immutable reviewed source bindings.\nexport const PLAN_BUDGET_CURRENT_REVISION=Object.freeze('+JSON.stringify(value[PLAN_BUDGET_CURRENT_SECTION],null,2)+');\n';
  const oneBRead=source=>{const raw=parentRead(source);if(source===contractPath){assert.equal(raw.toString('utf8'),serialize(parent));return Buffer.from(serialize(oneB));}if(source===anchor){assert.equal(raw.toString('utf8'),declaration(parent));return Buffer.from(declaration(oneB));}return restorePlanBudgetAcceptancePreviousSource(parent,source,raw);};
  const literal=(raw,pin,transformedPin,checkpoint,names)=>{const text=raw.toString('utf8').replaceAll('\r\n','\n');assert.equal(sha(text),pin);const body=text.split('\n').filter(line=>!line.startsWith('import ')&&!line.startsWith('export {')).map(line=>line.startsWith('export ')?line.slice(7):line).join('\n');assert.equal(sha(body),transformedPin);return Function('reviewed','createHash','path',body+'\nreturn {'+names+'};')(checkpoint[PLAN_BUDGET_CURRENT_SECTION],createHash,path);};
  const oneBApi=literal(oneBRead(compiler),'90bfa69a4e902dfab785ec10f210d6b0d0a21fe3992c3995c6b0e122748dab99','b8ae60979c1f1f0447bcef680474b8c2f93bd691f6b565dc01c11f1f33ee8c04',oneB,'verifyPlanBudgetCurrentSources,restorePlanBudgetPilotIntegrationPreviousContract,restorePlanBudgetPilotIntegrationSource');
  assert.equal(oneBApi.verifyPlanBudgetCurrentSources(oneB,oneBRead).nativeOrBrowserAcceptance,false);
  const checkpoint=oneBApi.restorePlanBudgetPilotIntegrationPreviousContract(oneB);assert.equal(sha(serialize(checkpoint)),'6cb040ad517b8a87b86a0466f23fe822dd570227392aff6209eeff037e840c71');
  const previousRead=source=>{const raw=oneBRead(source);if(source===contractPath)return Buffer.from(serialize(checkpoint));if(source===anchor)return Buffer.from(declaration(checkpoint));return oneBApi.restorePlanBudgetPilotIntegrationSource(oneB,source,raw);};
  const historical=literal(previousRead(compiler),'40f82005d0fbca72d1491f0100a8395f61dcbe1455f3eaf086c39e12d1a2dcdb','3313395315e24f3b042f6373128f468ef813814b60a5519c16d8e740a7475add',checkpoint,'verifyPlanBudgetCurrentSources');
  assert.equal(historical.verifyPlanBudgetCurrentSources(checkpoint,previousRead).nativeOrBrowserAcceptance,false);
  const previousTampered=source=>source===file?Buffer.concat([previousRead(source),Buffer.from('\n// Changed current Budget module\n')]):previousRead(source);
  assert.throws(()=>historical.verifyPlanBudgetCurrentSources(checkpoint,previousTampered),{code:'PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED',reason:'CURRENT_SOURCE_'+file});
 });
 denied(()=>verifyFieldOutboundCurrentSources(contract,tampered));denied(()=>verifyPlanMeasurementCurrentSources(contract,tampered));
 denied(()=>verifyFieldOutboundCurrentSources(preBudgetContract,read));denied(()=>verifyPlanMeasurementCurrentSources(preBudgetContract,read));
});
