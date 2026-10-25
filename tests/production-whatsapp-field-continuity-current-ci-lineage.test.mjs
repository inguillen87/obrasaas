import {restoreOwnRuntimeDiagnosticPreviousContract,planBudgetCurrentSourcePin,restorePlanBudgetPreviousContract,restorePlanBudgetSourceSet,verifyPlanBudgetCurrentSources,planBudgetCompiledProof} from '../scripts/lib/plan-budget-current-ci-lineage.mjs';
import {WORKSITE_LIVE_HOURS_CURRENT_SECTION,restoreWorksiteLiveHoursSourceSet} from '../scripts/lib/worksite-live-hours-current-ci-lineage.mjs';
import {restoreHomeDecisionsPreviousContract,homeDecisionsCurrentSourcePin} from '../scripts/lib/home-decisions-current-ci-lineage.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import checkpoint from './fixtures/whatsapp-field-continuity-contract-052.json' with {type:'json'};
import {WHATSAPP_FIELD_CONTINUITY_SECTION as section,WHATSAPP_FIELD_CONTINUITY_PREVIOUS_CONTRACT_SHA256 as previousSha,WHATSAPP_FIELD_CONTINUITY_CHECKPOINT_PATH as checkpointPath,composeWhatsappFieldContinuityContract,restoreWhatsappFieldContinuityPreviousContract,whatsappFieldContinuityCurrentSourcePin,whatsappFieldContinuityValidationFiles,verifyWhatsappFieldContinuityCurrentSources,restoreWhatsappFieldContinuitySourceSet,whatsappFieldContinuityProofSourceAdditions,WHATSAPP_FIELD_CONTINUITY_NATIVE,validateWhatsappFieldNeutralStepNative,whatsappFieldNeutralStepShadowFixture} from '../scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs';
import {restoreWorkspaceContinuityPreviousContract} from '../scripts/lib/workspace-continuity-current-ci-lineage.mjs';
import {restoreDocumentTaskAssociationPreviousContract} from '../scripts/lib/plan-measurement-document-association-ci-lineage.mjs';
import {restoreIntegratedIdentityPreviousContract} from '../scripts/lib/integrated-identity-current-ci-lineage.mjs';
import {restoreParticipantPreanalysisPreviousContract,preloadParticipantPreanalysisConsumerSources} from '../scripts/lib/participant-preanalysis-current-ci-lineage.mjs';
import {restoreOoxmlAccountingPreviousContract} from '../scripts/lib/ooxml-accounting-current-ci-lineage.mjs';
import {reconstructPublishedHContract} from '../scripts/lib/plan-measurement-current-ci-lineage.mjs';
import {existingApiPlanProofSourceAdditions,existingApiPlanCurrentNativeSourceFiles} from '../scripts/lib/meta-existing-api-plan-current-ci-lineage.mjs';
import {restoreMaterialReviewPreviousContract,materialReviewCurrentSourcePin} from '../scripts/lib/material-review-current-ci-lineage.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex'),serialize=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const read=file=>existsSync(file)?readFileSync(file):null,current=()=>JSON.parse(read('.github/workspace-acceptance-contract.json'));
const denied=run=>assert.throws(run,{code:'WHATSAPP_FIELD_CONTINUITY_CURRENT_CI_LINEAGE_REJECTED'});
// Retain the current outer rejection and independently reach the original WA
// metadata oracle through the authenticated complete pre-budget inverse.
const deniedMetadata=edit=>{const contract=current(),historical=restorePlanBudgetPreviousContract(contract);edit(historical);denied(()=>restoreWhatsappFieldContinuityPreviousContract(historical));edit(contract);denied(()=>restoreWhatsappFieldContinuityPreviousContract(contract));};

test('WA field inverse restores exact published052 then all previous checkpoints and original49 pins',()=>{
 const contract=current(),before=JSON.stringify(contract),restored=restoreWhatsappFieldContinuityPreviousContract(contract);
 assert.equal(previousSha,'f7a72979af7b789d92333d4f631d6bbbccf247c5c04ce6edd88f64f70b6099bb');assert.deepEqual(restored,checkpoint);assert.equal(sha(serialize(restored)),previousSha);assert.equal(sha(read(checkpointPath)),previousSha);assert.equal(JSON.stringify(contract),before);
 for(const[restore,expected]of [[restoreWorkspaceContinuityPreviousContract,'8c2afc33e9454b9c7a9d9fd2056f2c3de75f4657bbcbce4fb1bdf618e0590db3'],[restoreDocumentTaskAssociationPreviousContract,'10319b1ab8a283b7c89cab96a279e20e25fe4be2736d91caaa915a4e62afa524'],[restoreIntegratedIdentityPreviousContract,'3c1a184f2e6839bba6bd7116ccf6c062fbb015500ec4900583dbd15f82fe7270'],[restoreParticipantPreanalysisPreviousContract,'c2ba8944d4b004d31451f5bd248132295b4c4539704b87cca3d1305bef9160bb'],[restoreOoxmlAccountingPreviousContract,'63252e3af6a5e595f731302d33cf32e18182f24c75ac144cc062b0911efeda17'],[reconstructPublishedHContract,'9dab901cb93f3834cad0f1ea9ba386c5bb12acc913463a7dfb6368847af3fd37']])assert.equal(sha(serialize(restore(contract))),expected);
 assert.deepEqual(contract.planMeasurementCurrentLineage.currentValidationSources,checkpoint.planMeasurementCurrentLineage.currentValidationSources);assert.equal(contract.planMeasurementCurrentLineage.currentValidationSources.length,49);assert.equal(sha(JSON.stringify(contract.kycExpiredCurrentComposition)),'6ac6cb2e19c9d3ecc803bfc556e62e316701754c7252734503699841e1ed2533');
});

test('the59th block ID65 and independent21st proof preserve every previous command and all eight lanes',()=>{
 const actual=current(),ownBase=restoreOwnRuntimeDiagnosticPreviousContract(actual,read),contract=restorePlanBudgetPreviousContract(ownBase),previous=restoreMaterialReviewPreviousContract(contract),revision=previous[section];assert.deepEqual(composeWhatsappFieldContinuityContract(revision),previous);
 assert.equal(verifyPlanBudgetCurrentSources(actual,read).nativeOrBrowserAcceptance,false);const budget=actual.planBudgetCurrentRevision;assert.deepEqual(actual.blocks,[...contract.blocks,budget.ownership.block]);assert.deepEqual(actual.extension.proofs.at(-1),planBudgetCompiledProof(actual));const inheritedProofs=ownBase.extension.proofs.slice(0,-1).map(spec=>({...spec,sourceFiles:restorePlanBudgetSourceSet(ownBase,spec.kind,spec.sourceFiles)}));assert.deepEqual(inheritedProofs,contract.extension.proofs);for(const index of [19,20]){const live=actual.extension.proofs[index],prior=ownBase.extension.proofs[index];assert.equal(live.producerSha256,planBudgetCurrentSourcePin(actual,{path:live.producer,sha256:prior.producerSha256}));assert.equal(sha(read(live.producer).toString().replaceAll('\r\n','\n')),live.producerSha256);}
 assert.deepEqual(contract.blocks.slice(0,58),checkpoint.blocks);assert.equal(contract.blocks.length,59);assert.equal(contract.blocks.at(-1).id,65);assert.equal(new Set(contract.blocks.map(row=>row.id)).size,59);assert.equal(contract.extension.proofs.length,21);assert.equal(contract.artifactPatterns.length,63);
 assert.deepEqual(Object.keys(contract.lanes),Object.keys(checkpoint.lanes));assert.equal(Object.keys(contract.lanes).length,8);for(const name of Object.keys(contract.lanes).filter(name=>name!=='field'))assert.deepEqual(contract.lanes[name],checkpoint.lanes[name]);
 assert.deepEqual(contract.lanes.field.blocks,[...checkpoint.lanes.field.blocks,65]);assert.deepEqual(contract.artifactPatterns.slice(0,62),checkpoint.artifactPatterns);
 const proof=contract.extension.proofs.at(-1);assert.equal(proof.kind,'UI_FIELD_TASK_PAGINATION');assert.equal(proof.blockId,65);assert.equal(proof.checkNames.length,33);assert.equal(proof.lane,'field');
 assert.equal(revision.addedArtifactPattern,'.vercel/private/field-task-pagination-ui-evidence/');assert.equal(proof.path,'.vercel/private/field-task-pagination-ui-evidence/current-ci.json');assert.equal(contract.lanes.field.artifacts.at(-1),revision.addedArtifactPattern);assert.equal(contract.lanes.field.requiredRetainedEvidence.at(-1),proof.path);
 const priorFocused=checkpoint.extension.proofs.find(row=>row.id==='focused-workspace-ui'),focused=contract.extension.proofs.find(row=>row.id===priorFocused.id);assert.equal(priorFocused.checkNames.length,45);assert.deepEqual(focused.checkNames.slice(0,45),priorFocused.checkNames);assert.equal(focused.checkNames.length,revision.focusedUi.checkNames.length);
 assert.deepEqual(contract.planMeasurementDocumentAssociationRevision.measurement,checkpoint.planMeasurementDocumentAssociationRevision.measurement);assert.equal(contract.planMeasurementDocumentAssociationRevision.measurement.nativeCount,17);assert.equal(contract.planMeasurementDocumentAssociationRevision.measurement.uiCount,25);
});

test('every current source is authenticated before inherited consumers and no proof claims acceptance',()=>{
 const contract=current(),result=verifyWhatsappFieldContinuityCurrentSources(contract,read);assert.equal(result.completeCheckpointRestored,true);assert.equal(result.historical49PinsPreserved,true);assert.equal(result.nativeOrBrowserAcceptance,false);
 const files=whatsappFieldContinuityValidationFiles(contract);assert.ok(files.includes(checkpointPath));for(const row of result.auxiliaryValidationSources){assert.ok(files.includes(row.path));denied(()=>verifyWhatsappFieldContinuityCurrentSources(contract,file=>file===row.path?Buffer.from('foreign current source'):read(file)));denied(()=>verifyWhatsappFieldContinuityCurrentSources(contract,file=>file===row.path?null:read(file)));}
 const loaded=preloadParticipantPreanalysisConsumerSources({readSource:read,readCheckout:read});for(const file of files)assert.ok(loaded.includes(file));assert.equal(verifyWhatsappFieldContinuityCurrentSources(checkpoint,read),null);
});

test('only exact inherited and052 source aliases advance while current bytes cannot impersonate a predecessor',()=>{
 const contract=current();for(const row of [...contract[section].reviewedSourceChanges,...contract[section].validationDeltas]){assert.equal(whatsappFieldContinuityCurrentSourcePin(contract,{path:row.path,sha256:row.previousSha256}),materialReviewCurrentSourcePin(contract,{path:row.path,sha256:row.currentSha256}));denied(()=>whatsappFieldContinuityCurrentSourcePin(contract,{path:row.path,sha256:'e'.repeat(64)}));}
 const previousLayer=restoreHomeDecisionsPreviousContract(contract),row=previousLayer[section].reviewedSourceChanges.find(row=>row.path.endsWith('/workspace-client.js'));assert.ok(row);const inherited={path:row.path,sha256:'4f3ccde7f433c98e63f0ada92cd1346f0757bea06ea8bf93abf9ac0ff62b79f8'},currentPin=homeDecisionsCurrentSourcePin(contract,{path:row.path,sha256:row.currentSha256});assert.equal(whatsappFieldContinuityCurrentSourcePin(previousLayer,inherited),row.currentSha256);denied(()=>whatsappFieldContinuityCurrentSourcePin(previousLayer,{path:row.path,sha256:row.currentSha256}));assert.equal(whatsappFieldContinuityCurrentSourcePin(contract,inherited),currentPin);assert.equal(whatsappFieldContinuityCurrentSourcePin(contract,{path:row.path,sha256:row.currentSha256}),currentPin);
});

test('omitted deltas foreign checkpoints modified old matrices and inconsistent producer records are denied',()=>{
 for(const edit of [c=>{c[section].reviewedSourceChanges.pop();},c=>{c[section].previousContractSha256='f'.repeat(64);},c=>{c.blocks[0].step.run+='\ntrue';},c=>{c.planMeasurementCurrentLineage.currentValidationSources.pop();},c=>{c.extension.proofs.find(row=>row.id==='focused-workspace-ui').checkNames=checkpoint.extension.proofs.find(row=>row.id==='focused-workspace-ui').checkNames;},c=>{c.evidenceProducers.at(-1).producerSha256='f'.repeat(64);},c=>{c.lanes.field.blocks.pop();}]){deniedMetadata(edit);}
 const contract=current();denied(()=>verifyWhatsappFieldContinuityCurrentSources(contract,file=>file===checkpointPath?Buffer.from('{}'):read(file)));
});

test('actual source additions restore exact predecessor sets and old or same-count foreign sets cannot satisfy current',()=>{
 const contract=current(),priorMaterial=restoreMaterialReviewPreviousContract(contract);for(const delta of [...contract[section].sourceSetDeltas,...contract[section].proofSourceDeltas]){const files=delta.id?contract.extension.proofs.find(row=>row.id===delta.id).sourceFiles:delta.currentFiles,priorFiles=delta.id?priorMaterial.extension.proofs.find(row=>row.id===delta.id).sourceFiles:delta.currentFiles;assert.equal(priorFiles.length,delta.currentCount);assert.equal(sha(JSON.stringify(priorFiles)),delta.currentPathsSha256);const previous=restoreWhatsappFieldContinuitySourceSet(delta.family,files,contract);assert.equal(previous.length,delta.previousCount);assert.equal(sha(JSON.stringify(previous)),delta.previousPathsSha256);if(delta.additions.length){denied(()=>restoreWhatsappFieldContinuitySourceSet(delta.family,previous,contract));const foreign=[...files];foreign[foreign.indexOf(delta.additions[0])]='src/lib/foreign-current-source.mjs';foreign.sort();denied(()=>restoreWhatsappFieldContinuitySourceSet(delta.family,foreign,contract));}}
});

test('proof additions accept only authenticated historical context or the exact complete current set',()=>{
 const contract=current();for(const delta of contract[section].proofSourceDeltas){const prior=checkpoint.extension.proofs.find(row=>row.id===delta.id),spec=contract.extension.proofs.find(row=>row.id===delta.id);assert.deepEqual(whatsappFieldContinuityProofSourceAdditions(prior),[]);const material=contract.materialReviewCurrentRevision.proofSourceDeltas.find(row=>row.id===spec.id);assert.deepEqual(whatsappFieldContinuityProofSourceAdditions(spec),[...delta.additions,...(material?.additions||[]),...existingApiPlanProofSourceAdditions(spec)]);const changed=structuredClone(spec);changed.sourceFiles=[...changed.sourceFiles.slice(0,-1),'src/lib/foreign-proof-source.mjs'].sort();denied(()=>whatsappFieldContinuityProofSourceAdditions(changed));}
});

test('unrelated contract records cannot be smuggled through a valid outer revision',()=>{
 const contract=current();for(const key of ['packageLockSha256','requirementsSha256','sourceWorkflowGitBlobSha256'])deniedMetadata(changed=>{changed[key]='d'.repeat(64);});
 deniedMetadata(changed=>{changed[section].unreviewedTolerance=true;});assert.equal(JSON.stringify(checkpoint).includes('unreviewedTolerance'),false);
 const foreignNamespace=structuredClone(contract);foreignNamespace[section].addedArtifactPattern='.vercel/field-task-pagination-ci-evidence/';foreignNamespace[section].addedProof.path=foreignNamespace[section].addedArtifactPattern+'current-ci.json';foreignNamespace[section].addedEvidenceProducer.path=foreignNamespace[section].addedProof.path;denied(()=>composeWhatsappFieldContinuityContract(foreignNamespace[section]));
});

function assertCurrentNativeReceipt(familyName){
 const contract=current(),family=WHATSAPP_FIELD_CONTINUITY_NATIVE.families[familyName],kind=familyName==='COMPANY'?'PG_COMPANY_KYC':'COMPACT';
 const previous=existingApiPlanCurrentNativeSourceFiles(contract,familyName,family.sourceFiles),delta=contract[WORKSITE_LIVE_HOURS_CURRENT_SECTION].sourceSetDeltas.find(row=>row.family===kind);
 assert.equal(previous.length,familyName==='COMPANY'?236:139);assert.equal(previous.length,delta.previousCount);assert.equal(sha(JSON.stringify(previous)),delta.previousPathsSha256);
 assert.deepEqual(delta.additions,['src/lib/field-hours-report.mjs']);const worksiteFiles=[...previous,...delta.additions].sort();
 assert.equal(worksiteFiles.length,familyName==='COMPANY'?237:140);assert.equal(worksiteFiles.length,delta.currentCount);assert.equal(sha(JSON.stringify(worksiteFiles)),delta.currentPathsSha256);assert.deepEqual(restoreWorksiteLiveHoursSourceSet(contract,kind,worksiteFiles),previous);
 assert.equal(verifyPlanBudgetCurrentSources(contract,read).nativeOrBrowserAcceptance,false);const budget=contract.planBudgetCurrentRevision.sourceSetDeltas.find(row=>row.family===kind);assert.ok(budget);assert.deepEqual(budget.additions,['src/lib/plan-budget-source.mjs']);assert.equal(worksiteFiles.length,budget.previousCount);assert.equal(sha(JSON.stringify(worksiteFiles)),budget.previousPathsSha256);const files=[...worksiteFiles,...budget.additions].sort();assert.equal(files.length,budget.currentCount);assert.equal(sha(JSON.stringify(files)),budget.currentPathsSha256);assert.deepEqual(restorePlanBudgetSourceSet(contract,kind,files),worksiteFiles);
  const ownAdditions=['src/lib/field-execution-policy.mjs','src/lib/field-execution-store.mjs','src/lib/meta-field-execution-conversation.mjs'];
  const currentFiles=familyName==='COMPANY'?contract.extension.proofs.find(row=>row.kind===kind)?.sourceFiles:contract.planBudgetCurrentRevision.sourceFamilies.find(row=>row.family===kind)?.currentFiles;
  assert.ok(Array.isArray(currentFiles));assert.deepEqual(currentFiles,[...files,...ownAdditions].sort());assert.equal(currentFiles.length,familyName==='COMPANY'?241:144);
  const ownPrevious=restoreOwnRuntimeDiagnosticPreviousContract(contract,read),ownPreviousFiles=familyName==='COMPANY'?ownPrevious.extension.proofs.find(row=>row.kind===kind).sourceFiles:ownPrevious.planBudgetCurrentRevision.sourceFamilies.find(row=>row.family===kind).currentFiles;
  assert.deepEqual(ownPreviousFiles,files);assert.equal(ownPreviousFiles.length,familyName==='COMPANY'?238:141);assert.deepEqual(restorePlanBudgetSourceSet(contract,kind,currentFiles),worksiteFiles);
  const proof={harnessSha256:sha(read(family.producer)),sourceManifest:currentFiles.map(path=>({path,sha256:sha(read(path))})),[family.dtoField]:whatsappFieldNeutralStepShadowFixture(familyName)};
 const before=JSON.stringify(proof),contractBefore=JSON.stringify(contract),value=validateWhatsappFieldNeutralStepNative(proof,familyName,contract,read);
 assert.equal(value.currentNativeSourceCount,currentFiles.length);assert.equal(value.rawProofTransformed,false);assert.equal(value.identityOrProviderAccepted,false);assert.equal(JSON.stringify(proof),before);assert.equal(JSON.stringify(contract),contractBefore);
 const rejectProof=edit=>{const changed=structuredClone(proof);edit(changed);denied(()=>validateWhatsappFieldNeutralStepNative(changed,familyName,contract,read));};
  rejectProof(p=>{p.sourceManifest=files.map(path=>({path,sha256:sha(read(path))}));});
  for(const added of ownAdditions){
   rejectProof(p=>{p.sourceManifest=p.sourceManifest.filter(row=>row.path!==added);});
   rejectProof(p=>{p.sourceManifest.find(row=>row.path===added).path='src/lib/foreign-current-material-source.mjs';});
  }
  const wrongCurrentFamily=structuredClone(contract);
  if(familyName==='COMPANY')wrongCurrentFamily.extension.proofs.find(row=>row.kind===kind).kind='PG_PARTICIPANT_KYC_PREANALYSIS';
  else wrongCurrentFamily.planBudgetCurrentRevision.sourceFamilies.find(row=>row.family===kind).family='CONSUMPTION_FEEDBACK';
  denied(()=>validateWhatsappFieldNeutralStepNative(proof,familyName,wrongCurrentFamily,read));
  if(familyName==='COMPANY'){const wrongPointer=structuredClone(contract);wrongPointer.planBudgetCurrentRevision.sourceSetDeltas.find(row=>row.family===kind).contractPointer='/extension/proofs/0/sourceFiles';denied(()=>validateWhatsappFieldNeutralStepNative(proof,familyName,wrongPointer,read));}
 rejectProof(p=>{p.sourceManifest=p.sourceManifest.filter(row=>row.path!=='src/lib/field-hours-report.mjs');});
 rejectProof(p=>{p.sourceManifest=previous.map(path=>({path,sha256:sha(read(path))}));});
 rejectProof(p=>{p.sourceManifest.find(row=>row.path==='src/lib/field-hours-report.mjs').path='src/lib/foreign-native-source.mjs';});
 rejectProof(p=>{p.sourceManifest.push({...p.sourceManifest[0]});});
 rejectProof(p=>{p.sourceManifest.find(row=>row.path==='src/lib/field-hours-report.mjs').sha256='f'.repeat(64);});
 rejectProof(p=>{p.sourceManifest=p.sourceManifest.filter(row=>row.path!=='src/lib/plan-budget-source.mjs');});
 rejectProof(p=>{p.sourceManifest.find(row=>row.path==='src/lib/plan-budget-source.mjs').sha256='f'.repeat(64);});
 denied(()=>validateWhatsappFieldNeutralStepNative(proof,familyName,contract,path=>path==='src/lib/plan-budget-source.mjs'?Buffer.from('changed current Budget source'):read(path)));
 const coTampered=structuredClone(contract),coDelta=coTampered[WORKSITE_LIVE_HOURS_CURRENT_SECTION].sourceSetDeltas.find(row=>row.family===kind);coDelta.currentCount=previous.length;coDelta.currentPathsSha256=sha(JSON.stringify(previous));coDelta.additions=[];
 const shortened={...proof,sourceManifest:previous.map(path=>({path,sha256:sha(read(path))}))};denied(()=>validateWhatsappFieldNeutralStepNative(shortened,familyName,coTampered,read));
 const historicalTampered=restorePlanBudgetPreviousContract(contract),historicalDelta=historicalTampered[WORKSITE_LIVE_HOURS_CURRENT_SECTION].sourceSetDeltas.find(row=>row.family===kind);historicalDelta.currentCount=previous.length;historicalDelta.currentPathsSha256=sha(JSON.stringify(previous));historicalDelta.additions=[];denied(()=>restoreWhatsappFieldContinuityPreviousContract(historicalTampered));
}

test("current native COMPANY receipt binds the exact live-hours union and rejects historical or resealed manifests",()=>assertCurrentNativeReceipt("COMPANY"));
test("current native OWN receipt binds the exact live-hours union and rejects historical or resealed manifests",()=>assertCurrentNativeReceipt("OWN"));
