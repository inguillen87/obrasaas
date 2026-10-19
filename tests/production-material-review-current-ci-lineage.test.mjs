import {PLAN_PARTIDA_PREVIEW_CURRENT_SECTION,restorePlanPartidaPreviewSourceSet} from '../scripts/lib/plan-partida-preview-current-ci-lineage.mjs';
import {WORKSITE_LIVE_HOURS_CURRENT_SECTION,restoreWorksiteLiveHoursSourceSet,worksiteLiveHoursPreviousSourcePin,worksiteLiveHoursCurrentSourcePin} from '../scripts/lib/worksite-live-hours-current-ci-lineage.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {MATERIAL_REVIEW_CURRENT_REVISION as expected,MATERIAL_REVIEW_CURRENT_SECTION as key,restoreMaterialReviewPreviousContract,restoreMaterialReviewSourceSet,materialReviewProofSourceAdditions,materialReviewCurrentSourcePin,materialReviewValidationFiles,verifyMaterialReviewCurrentSources,materialReviewUnchangedSurface} from '../scripts/lib/material-review-current-ci-lineage.mjs';
import {verifyWhatsappFieldContinuityCurrentSources,whatsappFieldContinuityCurrentSourcePin} from '../scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs';
import {restoreExistingApiPlanPreviousContract,existingApiPlanCurrentSourcePin} from '../scripts/lib/meta-existing-api-plan-current-ci-lineage.mjs';
import {currentProducerSourceFiles} from '../.github/scripts/verify-workspace-ci-parallelization.mjs';

const read=file=>existsSync(file)?readFileSync(file):null;
const current=()=>JSON.parse(read('.github/workspace-acceptance-contract.json'));
const sha=value=>createHash('sha256').update(value).digest('hex');
const serialize=value=>JSON.stringify(value,null,2)+'\n';
const denied=fn=>assert.throws(fn,{code:'MATERIAL_REVIEW_CURRENT_CI_LINEAGE_REJECTED'});

test('materials revision restores the whole published predecessor and preserves every historical proof',()=>{
 const contract=current(),before=serialize(contract),publishedMaterialCurrent=restoreExistingApiPlanPreviousContract(contract),previous=restoreMaterialReviewPreviousContract(contract);
 assert.equal(sha(serialize(previous)),expected.previousContractSha256);
 assert.equal(expected.predecessorCommit,'3c853aa6baf900b123efb7cbdd95ea86508bdb8a');
 assert.equal(Object.hasOwn(previous,key),false);assert.equal(serialize(contract),before);
 for(const name of ['blocks','lanes','evidenceProducers','artifactPatterns','planMeasurementCurrentLineage'])assert.deepEqual(previous[name],publishedMaterialCurrent[name]);
 const withoutCiPaths=value=>({...value,proofs:value.proofs.map(proof=>{const copy={...proof};delete copy.sourceFiles;return copy;})});
 assert.deepEqual(withoutCiPaths(previous.extension),withoutCiPaths(publishedMaterialCurrent.extension));
 const focusedProducer=value=>value.extension.proofs.find(row=>row.id==='focused-workspace-ui');// Project only the authenticated outer pin for the historical assertion; read current source bytes below.
 assert.equal(worksiteLiveHoursPreviousSourcePin(contract,{path:'scripts/verify-focused-workspace-ci.mjs',sha256:focusedProducer(contract).producerSha256}),'48650c362bfc0b9d8fd49976fbc4ae1a124776167c60ba08f60d2b163ee94e24');assert.equal(focusedProducer(contract).producerSha256,'532e37e994540a6fecd8c70d067730cddec4a66403686113cef4087828c2229c');assert.equal(worksiteLiveHoursCurrentSourcePin(contract,{path:'scripts/verify-focused-workspace-ci.mjs',sha256:'48650c362bfc0b9d8fd49976fbc4ae1a124776167c60ba08f60d2b163ee94e24'}),'532e37e994540a6fecd8c70d067730cddec4a66403686113cef4087828c2229c');assert.equal(sha(read('scripts/verify-focused-workspace-ci.mjs').toString('utf8').replaceAll('\r\n','\n')),focusedProducer(contract).producerSha256);assert.equal(focusedProducer(publishedMaterialCurrent).producerSha256,'a4eb59cb781eeb9578e46ffcdec21833cce1ba79eb9f99e3543fda799dfc62f4');
 const {ciSourceFiles:priorCi,...priorPreanalysis}=previous.participantPreanalysisCurrentRevision,{ciSourceFiles:currentCi,...currentPreanalysis}=contract.participantPreanalysisCurrentRevision;
 assert.deepEqual(priorPreanalysis,currentPreanalysis);
 const proof=contract.extension.proofs.find(row=>row.id==='participant-kyc-preanalysis-postgres'),delta=contract[WORKSITE_LIVE_HOURS_CURRENT_SECTION].sourceSetDeltas.find(row=>row.family==='PG_PARTICIPANT_KYC_PREANALYSIS');
 assert.equal(delta.contractPointer,'/extension/proofs/18/sourceFiles');assert.equal(proof.kind,delta.family);
 const outer=contract[PLAN_PARTIDA_PREVIEW_CURRENT_SECTION].sourceSetDeltas.find(row=>row.family===proof.kind),worksiteProofFiles=restorePlanPartidaPreviewSourceSet(contract,proof.kind,proof.sourceFiles);
 const previewAdditions=['scripts/lib/plan-partida-preview-current-ci-lineage.mjs','scripts/lib/plan-partida-preview-current-ci-reviewed.mjs'];
 assert.equal(outer.contractPointer,delta.contractPointer);assert.equal(outer.previousCount,241);assert.ok(outer.currentCount>=243);assert.ok(previewAdditions.every(file=>outer.additions.includes(file)));assert.equal(outer.currentCount,outer.previousCount+outer.additions.length);
 assert.equal(worksiteProofFiles.length,outer.previousCount);assert.equal(sha(JSON.stringify(worksiteProofFiles)),outer.previousPathsSha256);
 assert.equal(proof.sourceFiles.length,outer.currentCount);assert.equal(sha(JSON.stringify(proof.sourceFiles)),outer.currentPathsSha256);assert.deepEqual(proof.sourceFiles,[...worksiteProofFiles,...outer.additions].sort());
 // Compare historical metadata only after the authenticated outer projection.
 assert.deepEqual(currentCi,restoreWorksiteLiveHoursSourceSet(contract,delta.family,proof.sourceFiles));
 assert.equal(currentCi.length,delta.previousCount);assert.equal(sha(JSON.stringify(currentCi)),delta.previousPathsSha256);
 const additions=['scripts/lib/worksite-live-hours-current-ci-lineage.mjs','scripts/lib/worksite-live-hours-current-ci-reviewed.mjs','src/lib/field-hours-report.mjs'];
 assert.deepEqual(delta.additions,additions);assert.deepEqual(worksiteProofFiles,[...currentCi,...additions].sort());assert.equal(worksiteProofFiles.length,delta.currentCount);assert.equal(sha(JSON.stringify(worksiteProofFiles)),delta.currentPathsSha256);
 assert.equal(restoreExistingApiPlanPreviousContract(contract).participantPreanalysisCurrentRevision.ciSourceFiles.length,priorCi.length+1);
});

test('source validation authenticates actual current bytes without certifying native browser or human operation',()=>{
 const contract=current(),result=verifyMaterialReviewCurrentSources(contract,read);
 assert.equal(result.completePreviousContractRestored,true);assert.equal(result.historicalPinsPreserved,true);assert.equal(result.nativeOrBrowserAcceptance,false);
 assert.equal(result.unchangedBusinessSurfaces.length,4);
 const files=materialReviewValidationFiles(contract);assert.equal(new Set(files).size,files.length);
 for(const file of files){
  denied(()=>verifyMaterialReviewCurrentSources(contract,path=>path===file?null:read(path)));
  denied(()=>verifyMaterialReviewCurrentSources(contract,path=>path===file?Buffer.from('foreign source'):read(path)));
 }
 assert.equal(verifyWhatsappFieldContinuityCurrentSources(contract,read).nativeOrBrowserAcceptance,false);
});

test('only authenticated predecessor or current material pins may advance and older aliases pass the inherited validator',()=>{
 const contract=current();
 for(const row of [...expected.reviewedSourceChanges,...expected.validationDeltas]){
  for(const pin of [row.previousSha256,row.currentSha256])assert.equal(materialReviewCurrentSourcePin(contract,{path:row.path,sha256:pin}),existingApiPlanCurrentSourcePin(contract,{path:row.path,sha256:row.currentSha256}));
  denied(()=>materialReviewCurrentSourcePin(contract,{path:row.path,sha256:'0'.repeat(64)}));
 }
 for(const row of contract.whatsappFieldContinuityCurrentRevision.reviewedSourceChanges){
  const legacy=whatsappFieldContinuityCurrentSourcePin(contract,{path:row.path,sha256:row.previousSha256});
  const delta=expected.reviewedSourceChanges.find(item=>item.path===row.path);
  assert.equal(legacy,existingApiPlanCurrentSourcePin(contract,{path:row.path,sha256:delta?.currentSha256??row.currentSha256}));
 }
});

test('material read projections retain inherited stock writers canonical composition HTTP guards and identity verification',()=>{
 const changes=[
  ['src/lib/material-inventory.mjs',"direction==='IN'","direction==='OUT'"],
  ['src/lib/field-operations-store.mjs',"canApproveProgress(member.role)","true"],
  ['src/lib/field-operations-http.mjs',"request.method!=='GET'","request.method!=='POST'"],
  ['src/lib/operations-status.mjs','requireWorkspaceIdentity(session)','void session'],
 ];
 for(const [file,from,to] of changes){
  const bytes=read(file),text=bytes.toString('utf8');assert.ok(text.includes(from),'Mutation anchor '+file);
  assert.notEqual(materialReviewUnchangedSurface(file,Buffer.from(text.replace(from,to))),materialReviewUnchangedSurface(file,bytes));
 }
 for(const row of expected.reviewedSourceChanges.filter(item=>item.unchangedSurfaceSha256))assert.equal(materialReviewUnchangedSurface(row.path,read(row.path)),row.unchangedSurfaceSha256);
});

test('unreviewed source declarations contract edits or validation pins cannot be resealed by a caller',()=>{
 for(const edit of [c=>{c[key].reviewedSourceChanges.pop();},c=>{c[key].addedSources.pop();},c=>{c[key].validationDeltas.pop();},c=>{c[key].previousContractSha256='0'.repeat(64);},c=>{c[key].nativeOrBrowserAcceptance=true;},c=>{c[key].unreviewedTolerance=true;},c=>{c.blocks[0].step.run+='\ntrue';},c=>{c.extension.proofs[0].sourceFiles.pop();},c=>{c[key].validationSources[0].path='scripts/foreign.mjs';},c=>{c.whatsappFieldContinuityCurrentRevision.validationSources[0].sha256='0'.repeat(64);}]){
  const contract=current();edit(contract);denied(()=>restoreMaterialReviewPreviousContract(contract));
 }
 const contract=current();contract[key].validationSources[0].sha256='0'.repeat(64);denied(()=>verifyMaterialReviewCurrentSources(contract,read));
});

test('predecessor contracts retain their exact behavior with no materials source overlay',()=>{
 const previous=restoreMaterialReviewPreviousContract(current());
 assert.equal(verifyMaterialReviewCurrentSources(previous,read),null);assert.deepEqual(materialReviewValidationFiles(previous),[]);
 const ref={path:'src/lib/material-inventory.mjs',sha256:'0'.repeat(64)};assert.equal(materialReviewCurrentSourcePin(previous,ref),ref.sha256);
});
test('only the new reviewed helper extends the three actual CI import graphs and native manifests remain unchanged',()=>{
 const full=current(),contract=restoreExistingApiPlanPreviousContract(full),previous=restoreMaterialReviewPreviousContract(contract);
 assert.deepEqual(expected.proofSourceDeltas.map(row=>row.id),['participant-kyc-preanalysis-postgres','focused-workspace-ui','field-task-pagination-ui']);assert.deepEqual(expected.sourceSetDeltas,[]);
 for(const spec of contract.extension.proofs){
  assert.deepEqual(currentProducerSourceFiles(full.extension.proofs.find(row=>row.id===spec.id),process.cwd()),full.extension.proofs.find(row=>row.id===spec.id).sourceFiles,'Actual producer import graph '+spec.id);
  const delta=expected.proofSourceDeltas.find(row=>row.id===spec.id),prior=previous.extension.proofs.find(row=>row.id===spec.id);
  assert.deepEqual(spec.checkNames,prior.checkNames);assert.equal(spec.producerSha256,prior.producerSha256);
  if(!delta){assert.deepEqual(spec.sourceFiles,prior.sourceFiles);continue;}
  assert.deepEqual(delta.additions,['scripts/lib/material-review-current-ci-lineage.mjs']);assert.equal(delta.currentCount,delta.previousCount+1);
  assert.deepEqual(restoreMaterialReviewSourceSet(delta.family,spec.sourceFiles,contract),prior.sourceFiles);assert.deepEqual(materialReviewProofSourceAdditions(spec),delta.additions);assert.deepEqual(materialReviewProofSourceAdditions(prior),[]);
 }
 assert.deepEqual(contract.participantPreanalysisCurrentRevision.nativeSourceFiles,previous.participantPreanalysisCurrentRevision.nativeSourceFiles);
 assert.deepEqual(contract.participantPreanalysisCurrentRevision.nativeCheckNames,previous.participantPreanalysisCurrentRevision.nativeCheckNames);
});
test('material CI closure inverses reject omitted duplicate old unsorted foreign and extra paths without permissive filtering',()=>{
 const contract=current(),previous=restoreMaterialReviewPreviousContract(contract);
 for(const delta of expected.proofSourceDeltas){
  const spec=contract.extension.proofs.find(row=>row.id===delta.id),prior=previous.extension.proofs.find(row=>row.id===delta.id),files=spec.sourceFiles;
  for(const malformed of [prior.sourceFiles,files.slice(1),[...files,files[0]],[...files].reverse(),[...files,'scripts/foreign-extra.mjs'].sort(),files.map(file=>file===delta.additions[0]?'scripts/foreign-substitute.mjs':file).sort()]){
   denied(()=>restoreMaterialReviewSourceSet(delta.family,malformed,contract));if(malformed!==prior.sourceFiles){denied(()=>materialReviewProofSourceAdditions({...spec,sourceFiles:malformed}));denied(()=>materialReviewProofSourceAdditions({...spec,sourceFiles:malformed},{historical:true}));}
  }
  for(const edit of [value=>{value[key].proofSourceDeltas.pop();},value=>{value[key].proofSourceDeltas[0].additions.push('scripts/foreign-extra.mjs');},value=>{value[key].proofSourceDeltas[0].previousCount=value[key].proofSourceDeltas[0].currentCount;value[key].proofSourceDeltas[0].previousPathsSha256=value[key].proofSourceDeltas[0].currentPathsSha256;},value=>{value.extension.proofs.find(row=>row.id===delta.id).sourceFiles=prior.sourceFiles;},value=>{value.participantPreanalysisCurrentRevision.ciSourceFiles.pop();}]){const changed=structuredClone(contract);edit(changed);denied(()=>restoreMaterialReviewPreviousContract(changed));}
 }
});
