import {restoreParticipantPreanalysisPreviousContract,restoreParticipantPreanalysisSourceSet} from '../scripts/lib/participant-preanalysis-current-ci-lineage.mjs';
import {restoreWhatsappFieldContinuitySourceSet} from '../scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs';
import {restoreIntegratedIdentityPreviousContract,restoreIntegratedIdentitySourceSet,integratedIdentityCurrentSourcePin} from '../scripts/lib/integrated-identity-current-ci-lineage.mjs';
import assert from 'node:assert/strict';
import {DOCUMENT_TASK_ASSOCIATION_CURRENT_REVISION as documentRevision} from '../scripts/lib/plan-measurement-document-association-ci-lineage.mjs';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {OOXML_ACCOUNTING_CURRENT_REVISION,OOXML_ACCOUNTING_CURRENT_VALIDATION_PATHS,restoreOoxmlAccountingPreviousContract,ooxmlAccountingCurrentSourcePin,verifyOoxmlAccountingCurrentSources} from '../scripts/lib/ooxml-accounting-current-ci-lineage.mjs';
import {FIELD_OUTBOUND_CURRENT_REVISION,restoreFieldOutboundPreviousContract,fieldOutboundCurrentSourcePin,verifyFieldOutboundCurrentSources} from '../scripts/lib/field-outbound-current-ci-lineage.mjs';
import {verifyPlanMeasurementCurrentSources,reconstructPublishedHContract} from '../scripts/lib/plan-measurement-current-ci-lineage.mjs';
import {companyKycOutboundCompactCiSourceClosure} from '../scripts/verify-company-kyc-outbound-compact-ci.mjs';

const root=new URL('../',import.meta.url),read=file=>{try{return readFileSync(new URL(file,root));}catch(error){if(error.code==='ENOENT'||error.code==='EISDIR')return null;throw error;}},sha=value=>createHash('sha256').update(value).digest('hex');
const contract=JSON.parse(read('.github/workspace-acceptance-contract.json')),previous=restoreParticipantPreanalysisPreviousContract(contract);
const denied=run=>assert.throws(run,{code:'PLAN_MEASUREMENT_CURRENT_CI_LINEAGE_REJECTED'});
const changed=edit=>{const value=structuredClone(contract);edit(value);denied(()=>verifyPlanMeasurementCurrentSources(value,read));};
const changes=[...OOXML_ACCOUNTING_CURRENT_REVISION.reviewedSourceChanges,...OOXML_ACCOUNTING_CURRENT_REVISION.validationDeltas];

test('OOXML restores the complete exact published Q contract before the Q P L K I G H chain',()=>{
 const prior=restoreOoxmlAccountingPreviousContract(contract);
 assert.equal(sha(JSON.stringify(prior,null,2)+'\n'),OOXML_ACCOUNTING_CURRENT_REVISION.previousContractSha256);
 assert.equal(Object.hasOwn(prior,'ooxmlAccountingCurrentRevision'),false);
 assert.deepEqual(prior.fieldOutboundCurrentRevision,contract.fieldOutboundCurrentRevision);
 assert.deepEqual(prior.planMeasurementCurrentLineage,contract.planMeasurementCurrentLineage);
 assert.equal(sha(JSON.stringify(restoreFieldOutboundPreviousContract(contract),null,2)+'\n'),FIELD_OUTBOUND_CURRENT_REVISION.previousContractSha256);
 assert.equal(sha(JSON.stringify(reconstructPublishedHContract(contract),null,2)+'\n'),'9dab901cb93f3834cad0f1ea9ba386c5bb12acc913463a7dfb6368847af3fd37');
});
test('only the seven reviewed OOXML and unit advisory source pins advance while all original 49 rows remain historical',()=>{
 const currentContract=contract;
 // The original assertions authenticate only the immutable27aa checkpoint layer.
 {
  const contract=restoreIntegratedIdentityPreviousContract(currentContract);
 assert.equal(contract.planMeasurementCurrentLineage.currentValidationSources.length,49);
 assert.equal(OOXML_ACCOUNTING_CURRENT_REVISION.reviewedSourceChanges.length,7);
 for(const row of OOXML_ACCOUNTING_CURRENT_REVISION.reviewedSourceChanges){
  const ref=contract.planMeasurementCurrentLineage.currentValidationSources.find(ref=>ref.path===row.path);
  assert.equal(ref.sha256,row.previousSha256);
  assert.equal(fieldOutboundCurrentSourcePin(contract,ref),row.currentSha256);
 }
 const originalQ=FIELD_OUTBOUND_CURRENT_REVISION.reviewedSourceChanges[0];
 assert.equal(fieldOutboundCurrentSourcePin(contract,{path:originalQ.path,sha256:originalQ.previousSha256}),originalQ.currentSha256);

 }
 // Current accessors are observed separately; prior expected pins are not resealed.
 for(const row of OOXML_ACCOUNTING_CURRENT_REVISION.reviewedSourceChanges){
  const checkpoint=restoreIntegratedIdentityPreviousContract(currentContract),ref=checkpoint.planMeasurementCurrentLineage.currentValidationSources.find(ref=>ref.path===row.path),checkpointPin=fieldOutboundCurrentSourcePin(checkpoint,ref);
  assert.equal(fieldOutboundCurrentSourcePin(currentContract,ref),integratedIdentityCurrentSourcePin(currentContract,{path:ref.path,sha256:checkpointPin}));
 }
});
test('current raw OOXML and validator bytes are checked without native or human acceptance',()=>{
 const result=verifyOoxmlAccountingCurrentSources(contract,read);
 assert.equal(result.historicalPinsPreserved,true);assert.equal(result.nativeAcceptance,false);
 assert.deepEqual(result.reviewedSourceChanges,OOXML_ACCOUNTING_CURRENT_REVISION.reviewedSourceChanges.map(row=>row.path));
 const lineage=verifyPlanMeasurementCurrentSources(contract,read);assert.equal(lineage.publishedCurrentSourceCount,127);
 const actualFiles=companyKycOutboundCompactCiSourceClosure(read).files,checkpointFiles=restoreIntegratedIdentitySourceSet('COMPACT',actualFiles,contract);
 assert.equal(checkpointFiles.length,contract.participantPreanalysisCurrentRevision.consumerSourceDeltas.find(row=>row.family==='COMPACT').currentCount);
 const outer=contract.whatsappFieldContinuityCurrentRevision.sourceSetDeltas.find(row=>row.family==='COMPACT'),previousCurrentFiles=restoreWhatsappFieldContinuitySourceSet('COMPACT',actualFiles,contract);assert.equal(outer.currentCount,139);assert.equal(sha(JSON.stringify(actualFiles)),outer.currentPathsSha256);assert.equal(previousCurrentFiles.length,137);assert.equal(sha(JSON.stringify(previousCurrentFiles)),'ab60b810e098f47892e1a17cb01ce1f7f8e1796c1687776b528100e62cb3083f');assert.equal(previousCurrentFiles.length,contract.integratedIdentityCurrentRevision.consumerSourceDeltas.find(row=>row.family==='COMPACT').currentCount);assert.equal(lineage.sourceCount,actualFiles.length);assert.equal(lineage.sourceCount,outer.currentCount);
});
test('the native compact closure remains 127 and the two new CI guards stay outside it',()=>{
 const requested=new Set(),source=file=>{requested.add(file);return read(file);},closure=companyKycOutboundCompactCiSourceClosure(source);
 assert.equal(restoreParticipantPreanalysisSourceSet('COMPACT',closure.files,contract).length,127);const checkpointFiles=restoreIntegratedIdentitySourceSet('COMPACT',closure.files,contract);
 assert.equal(checkpointFiles.length,contract.participantPreanalysisCurrentRevision.consumerSourceDeltas.find(row=>row.family==='COMPACT').currentCount);
 const previousCurrentFiles=restoreWhatsappFieldContinuitySourceSet('COMPACT',closure.files,contract);assert.equal(previousCurrentFiles.length,137);assert.equal(sha(JSON.stringify(previousCurrentFiles)),'ab60b810e098f47892e1a17cb01ce1f7f8e1796c1687776b528100e62cb3083f');assert.equal(previousCurrentFiles.length,contract.integratedIdentityCurrentRevision.consumerSourceDeltas.find(row=>row.family==='COMPACT').currentCount);assert.equal(closure.files.length,139);assert.equal(sha(JSON.stringify(closure.files)),contract.whatsappFieldContinuityCurrentRevision.sourceSetDeltas.find(row=>row.family==='COMPACT').currentPathsSha256);
 for(const file of OOXML_ACCOUNTING_CURRENT_VALIDATION_PATHS){assert.equal(requested.has(file),true);assert.equal(closure.files.includes(file),false);}
 for(const file of ['src/lib/plan-import-ooxml.mjs','src/lib/plan-measurement-source.mjs'])assert.equal(closure.files.includes(file),true);
});
test('an old contract or omitted OOXML revision cannot authorize the new source bytes',()=>{
 const prior=restoreOoxmlAccountingPreviousContract(contract);
 assert.equal(verifyOoxmlAccountingCurrentSources(prior,read),null);
 denied(()=>verifyPlanMeasurementCurrentSources(prior,read));
 changed(value=>{delete value.ooxmlAccountingCurrentRevision;});
});
test('foreign reference head tree or previous complete contract is rejected',()=>{
 for(const key of ['referenceHead','referenceTree','previousContractSha256'])changed(value=>{value.ooxmlAccountingCurrentRevision[key]='f'.repeat(key==='previousContractSha256'?64:40);});
});
test('omitted duplicate extra or foreign source and validator deltas are rejected',()=>{
 for(const key of ['reviewedSourceChanges','validationDeltas']){
  changed(value=>{value.ooxmlAccountingCurrentRevision[key].pop();});
  changed(value=>{value.ooxmlAccountingCurrentRevision[key][1]=value.ooxmlAccountingCurrentRevision[key][0];});
  changed(value=>{value.ooxmlAccountingCurrentRevision[key].push({...value.ooxmlAccountingCurrentRevision[key][0],path:'src/lib/foreign.mjs'});});
  for(const field of ['path','previousSha256','currentSha256'])changed(value=>{value.ooxmlAccountingCurrentRevision[key][0][field]='foreign';});
 }
});
test('old current or foreign pins for the same changed path cannot fall through to Q or historical source',()=>{
 const currentContract=contract;
 // The original assertions authenticate only the immutable27aa checkpoint layer.
 {
  const contract=restoreIntegratedIdentityPreviousContract(currentContract);
 for(const row of changes){
  assert.equal(ooxmlAccountingCurrentSourcePin(previous,{path:row.path,sha256:row.previousSha256}),row.currentSha256);const currentChange=contract.participantPreanalysisCurrentRevision.validationDeltas.find(ref=>ref.path===row.path);assert.equal(ooxmlAccountingCurrentSourcePin(contract,{path:row.path,sha256:row.previousSha256}),currentChange?.currentSha256||row.currentSha256);
  for(const badSha of [row.currentSha256,'f'.repeat(64)]){
   denied(()=>ooxmlAccountingCurrentSourcePin(contract,{path:row.path,sha256:badSha}));
   denied(()=>fieldOutboundCurrentSourcePin(contract,{path:row.path,sha256:badSha}));
  }
 }
 for(const key of ['reviewedSourceChanges','validationDeltas'])changed(value=>{const row=value.ooxmlAccountingCurrentRevision[key][0];row.currentSha256=row.previousSha256;});

 }
 // Current accessors are observed separately; prior expected pins are not resealed.
 for(const row of changes){
  const checkpoint=restoreIntegratedIdentityPreviousContract(currentContract),ref={path:row.path,sha256:row.previousSha256},checkpointPin=ooxmlAccountingCurrentSourcePin(checkpoint,ref),actualPin=integratedIdentityCurrentSourcePin(currentContract,{path:row.path,sha256:checkpointPin});
  assert.equal(ooxmlAccountingCurrentSourcePin(currentContract,ref),actualPin);assert.equal(fieldOutboundCurrentSourcePin(currentContract,ref),actualPin);
  const outer=documentRevision.reviewedSourceChanges.find(ref=>ref.path===row.path),currentNegativePin=outer?.currentSha256||row.currentSha256;
  for(const badSha of [currentNegativePin,'f'.repeat(64)]){denied(()=>ooxmlAccountingCurrentSourcePin(currentContract,{path:row.path,sha256:badSha}));denied(()=>fieldOutboundCurrentSourcePin(currentContract,{path:row.path,sha256:badSha}));}
 }
});
test('each reviewed source helper and test rejects independently tampered raw bytes',()=>{
 for(const row of [...changes,...contract.ooxmlAccountingCurrentRevision.validationSources]){
  denied(()=>verifyPlanMeasurementCurrentSources(contract,file=>file===row.path?Buffer.concat([read(file),Buffer.from('\n// changed source\n')]):read(file)));
 }
});
test('a manifest text shim missing source or invalid UTF8 cannot replace raw source bytes',()=>{
 denied(()=>verifyOoxmlAccountingCurrentSources(contract,()=>null));
 denied(()=>verifyOoxmlAccountingCurrentSources(contract,file=>read(file).toString('utf8')));
 denied(()=>verifyOoxmlAccountingCurrentSources(contract,file=>file===changes[0].path?Buffer.from([0xff]):read(file)));
});
test('missing extra or stale OOXML validation sources fail closed',()=>{
 changed(value=>{value.ooxmlAccountingCurrentRevision.validationSources.pop();});
 changed(value=>{value.ooxmlAccountingCurrentRevision.validationSources.push({path:'scripts/foreign.mjs',sha256:'f'.repeat(64)});});
 changed(value=>{value.ooxmlAccountingCurrentRevision.validationSources[0].path='scripts/foreign.mjs';});
 changed(value=>{value.ooxmlAccountingCurrentRevision.validationSources[1]=value.ooxmlAccountingCurrentRevision.validationSources[0];});
 changed(value=>{value.ooxmlAccountingCurrentRevision.validationSources[0].sha256='f'.repeat(64);});
});
test('rewriting any of the seven original current validation pins is rejected',()=>{
 for(const row of OOXML_ACCOUNTING_CURRENT_REVISION.reviewedSourceChanges)changed(value=>{value.planMeasurementCurrentLineage.currentValidationSources.find(ref=>ref.path===row.path).sha256=row.currentSha256;});
});
test('the Q revision and every historical producer path matrix and source budget remain immutable',()=>{
 for(const edit of [value=>{value.fieldOutboundCurrentRevision.validationSources[0].sha256='f'.repeat(64);},value=>{value.fieldOutboundCurrentRevision.reviewedSourceChanges.pop();},value=>{value.blocks[0].commandSha256='f'.repeat(64);},value=>{value.extension.proofs[0].sourceFiles[0]='src/lib/foreign.mjs';},value=>{value.extension.proofs[0].producerSha256='f'.repeat(64);},value=>{value.kycExpiredCurrentComposition.sourceLeaseMs=120000;},value=>{value.planMeasurementCurrentLineage.currentValidationSources.pop();}])changed(edit);
 for(const key of Object.keys(OOXML_ACCOUNTING_CURRENT_REVISION.limits))changed(value=>{value.ooxmlAccountingCurrentRevision.limits[key]++;});
});
test('OOXML metadata is verified before a missing Q section can return without checking current source',()=>{
 changed(value=>{delete value.fieldOutboundCurrentRevision;});
 const value=structuredClone(contract);delete value.fieldOutboundCurrentRevision;
 denied(()=>verifyFieldOutboundCurrentSources(value,read));
});
