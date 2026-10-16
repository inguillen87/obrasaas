import {restoreParticipantPreanalysisPreviousContract,restoreParticipantPreanalysisSourceSet} from '../scripts/lib/participant-preanalysis-current-ci-lineage.mjs';
import {restoreIntegratedIdentitySourceSet} from '../scripts/lib/integrated-identity-current-ci-lineage.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {FIELD_OUTBOUND_CURRENT_REVISION,restoreFieldOutboundPreviousContract,verifyFieldOutboundCurrentSources} from '../scripts/lib/field-outbound-current-ci-lineage.mjs';
import {verifyPlanMeasurementCurrentSources,reconstructPublishedHContract} from '../scripts/lib/plan-measurement-current-ci-lineage.mjs';
import {KYC_EXPIRED_CURRENT_REVIEWED_SOURCES,kycExpiredCurrentSourceFiles} from '../scripts/lib/kyc-expired-current-ci-lineage.mjs';
const root=new URL('../',import.meta.url),read=file=>readFileSync(new URL(file,root)),sha=value=>createHash('sha256').update(value).digest('hex');
const contract=JSON.parse(read('.github/workspace-acceptance-contract.json'));
const denied=run=>assert.throws(run,{code:'PLAN_MEASUREMENT_CURRENT_CI_LINEAGE_REJECTED'});
const changed=edit=>{const value=structuredClone(contract);edit(value);denied(()=>verifyPlanMeasurementCurrentSources(value,read));};

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
 const actualFiles=kycExpiredCurrentSourceFiles(read),checkpointFiles=restoreIntegratedIdentitySourceSet('COMPACT',actualFiles,contract);
 assert.equal(checkpointFiles.length,contract.participantPreanalysisCurrentRevision.consumerSourceDeltas.find(row=>row.family==='COMPACT').currentCount);
 assert.equal(lineage.sourceCount,actualFiles.length);assert.equal(lineage.sourceCount,137);assert.equal(lineage.sourceCount,contract.integratedIdentityCurrentRevision.consumerSourceDeltas.find(row=>row.family==='COMPACT').currentCount);
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
 changed(value=>{value.fieldOutboundCurrentRevision.validationSources[0].sha256='f'.repeat(64);});
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
