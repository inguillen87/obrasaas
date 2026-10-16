import {restoreWorkspaceContinuityPreviousContract} from '../scripts/lib/workspace-continuity-current-ci-lineage.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import checkpoint from './fixtures/plan-measurement-contract-a203.json' with {type:'json'};
import {DOCUMENT_TASK_ASSOCIATION_SECTION as section,DOCUMENT_TASK_ASSOCIATION_PREVIOUS_CONTRACT_SHA256 as previousSha,DOCUMENT_TASK_ASSOCIATION_CHECKPOINT_PATH as checkpointPath,DOCUMENT_TASK_ASSOCIATION_MEASUREMENT as measurement,composeDocumentTaskAssociationContract,restoreDocumentTaskAssociationPreviousContract,documentTaskAssociationCurrentSourcePin,documentTaskAssociationValidationFiles,verifyDocumentTaskAssociationCurrentSources,restoreDocumentTaskAssociationSourceSet} from '../scripts/lib/plan-measurement-document-association-ci-lineage.mjs';
import {restoreIntegratedIdentityPreviousContract,verifyIntegratedIdentityCurrentSources} from '../scripts/lib/integrated-identity-current-ci-lineage.mjs';
import {restoreParticipantPreanalysisPreviousContract,preloadParticipantPreanalysisConsumerSources} from '../scripts/lib/participant-preanalysis-current-ci-lineage.mjs';
import {restoreOoxmlAccountingPreviousContract} from '../scripts/lib/ooxml-accounting-current-ci-lineage.mjs';
import {reconstructPublishedHContract,verifyPlanMeasurementCurrentSources} from '../scripts/lib/plan-measurement-current-ci-lineage.mjs';
import {planMeasurementUiSourceClosure} from '../scripts/verify-plan-measurement-ui.mjs';
import {PLAN_MEASUREMENT_NATIVE_CHECKS} from '../scripts/verify-plan-measurement-ci.mjs';
import {validateParticipantKycPreanalysisCi} from '../scripts/verify-participant-kyc-preanalysis-ci.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),read=file=>existsSync(file)?readFileSync(file):null,current=()=>JSON.parse(read('.github/workspace-acceptance-contract.json')),bytes=value=>Buffer.from(JSON.stringify(value,null,2)+'\n'),reject=run=>assert.throws(run,{code:'PLAN_MEASUREMENT_DOCUMENT_ASSOCIATION_CI_LINEAGE_REJECTED'});

test('document association outer inverse restores complete a203 before every historical checkpoint and original H49',()=>{
 const contract=current(),before=JSON.stringify(contract),prior=restoreDocumentTaskAssociationPreviousContract(contract);
 assert.equal(sha(bytes(prior)),previousSha);assert.deepEqual(prior,checkpoint);assert.equal(JSON.stringify(contract),before);
 assert.equal(sha(bytes(restoreIntegratedIdentityPreviousContract(contract))),'3c1a184f2e6839bba6bd7116ccf6c062fbb015500ec4900583dbd15f82fe7270');
 assert.equal(sha(bytes(restoreParticipantPreanalysisPreviousContract(contract))),'c2ba8944d4b004d31451f5bd248132295b4c4539704b87cca3d1305bef9160bb');
 assert.equal(sha(bytes(restoreOoxmlAccountingPreviousContract(contract))),'63252e3af6a5e595f731302d33cf32e18182f24c75ac144cc062b0911efeda17');
 assert.equal(sha(bytes(reconstructPublishedHContract(contract))),'9dab901cb93f3834cad0f1ea9ba386c5bb12acc913463a7dfb6368847af3fd37');
 assert.deepEqual(contract.planMeasurementCurrentLineage.currentValidationSources,checkpoint.planMeasurementCurrentLineage.currentValidationSources);assert.equal(contract.planMeasurementCurrentLineage.currentValidationSources.length,49);
 assert.equal(sha(JSON.stringify(contract.kycExpiredCurrentComposition)),'6ac6cb2e19c9d3ecc803bfc556e62e316701754c7252734503699841e1ed2533');
});

test('new source closure metadata retains native118 and published113 AI115 compact137 G127 H125 and117',()=>{
 const contract=current(),value=verifyPlanMeasurementCurrentSources(contract,read);
 assert.equal(value.sourceCount,137);assert.equal(value.publishedCurrentSourceCount,127);assert.equal(value.previousSourceCount,125);assert.equal(value.historicalSourceCount,117);
 assert.equal(measurement.nativeCurrentCount,118);assert.equal(measurement.aiNativeCount,115);assert.equal(measurement.publishedNativeCount,113);
 assert.equal(measurement.nativeCount,17);assert.deepEqual(measurement.nativeCheckNames.slice(0,11),PLAN_MEASUREMENT_NATIVE_CHECKS);assert.equal(measurement.nativePreviousCount,11);assert.equal(measurement.uiPreviousCount,19);assert.equal(measurement.uiCount,25);assert.equal(measurement.previousUiVersion,'plan-measurement-ui-v2');assert.equal(measurement.uiVersion,'plan-measurement-ui-v3');
});

test('current source leaves are authenticated independently and substituted bytes cannot certify current',()=>{
 const contract=current(),value=verifyDocumentTaskAssociationCurrentSources(contract,read);assert.equal(value.nativeOrBrowserAcceptance,false);assert.equal(value.completeCheckpointRestored,true);
 for(const row of contract[section].reviewedSourceChanges){const stale=file=>file===row.path?Buffer.from('previous source bytes do not certify current '+row.path):read(file);reject(()=>verifyDocumentTaskAssociationCurrentSources(contract,stale));}
 assert.equal(verifyIntegratedIdentityCurrentSources(contract,read).nativeOrBrowserAcceptance,false);
});

test('only exact authenticated historical aliases advance and neither foreign nor current pins become historical',()=>{
 const actual=current(),contract=restoreWorkspaceContinuityPreviousContract(actual);for(const row of [...contract[section].reviewedSourceChanges,...contract[section].validationDeltas]){
  assert.equal(documentTaskAssociationCurrentSourcePin(contract,{path:row.path,sha256:row.previousSha256}),row.currentSha256);
  reject(()=>documentTaskAssociationCurrentSourcePin(contract,{path:row.path,sha256:'f'.repeat(64)}));reject(()=>documentTaskAssociationCurrentSourcePin(contract,{path:row.path,sha256:row.currentSha256}));
 }
 for(const path of ['tests/production-integrated-identity-current-ci-lineage.test.mjs','tests/production-plan-measurement-current-ci-lineage.test.mjs','tests/production-plan-measurement-document-association-ci-lineage.test.mjs']){const prior=contract[section].validationDeltas.find(row=>row.path===path)||contract[section].validationSources.map(row=>({path:row.path,currentSha256:row.sha256})).find(row=>row.path===path),currentSha=sha(read(path).toString('utf8').replaceAll('\r\n','\n'));assert.ok(prior);assert.notEqual(currentSha,prior.currentSha256);assert.equal(documentTaskAssociationCurrentSourcePin(actual,{path,sha256:prior.currentSha256}),currentSha);reject(()=>documentTaskAssociationCurrentSourcePin(actual,{path,sha256:currentSha}));reject(()=>documentTaskAssociationCurrentSourcePin(actual,{path,sha256:'f'.repeat(64)}));}
});

test('a foreign old49 pin or omitted duplicate and unreviewed delta cannot reseal the outer contract',()=>{
 for(const mutate of [c=>{c.planMeasurementCurrentLineage.currentValidationSources[0].sha256='e'.repeat(64);},c=>{c[section].reviewedSourceChanges.pop();},c=>{c[section].reviewedSourceChanges.push({...c[section].reviewedSourceChanges[0]});},c=>{c[section].validationDeltas[0].currentSha256='e'.repeat(64);},c=>{c[section].unexpected=true;},c=>{c.extension.proofs[0].checkNames.push('not-reviewed');}]){const contract=current();mutate(contract);reject(()=>restoreDocumentTaskAssociationPreviousContract(contract));}
});

test('UI node runtime17 restores the exact old14 without altering original manifests',()=>{
 const contract=current(),files=planMeasurementUiSourceClosure(read,{runtime:true}).files,before=JSON.stringify(files),restored=restoreDocumentTaskAssociationSourceSet('MEASUREMENT_UI_RUNTIME',files,contract);
 assert.equal(files.length,17);assert.equal(restored.length,14);assert.equal(sha(JSON.stringify(restored)),measurement.runtimePreviousPathsSha256);assert.equal(JSON.stringify(files),before);
 for(const list of [restored,files.slice(1),[...files,files[0]],[...files.slice(1),'src/lib/foreign.mjs'].sort()])reject(()=>restoreDocumentTaskAssociationSourceSet('MEASUREMENT_UI_RUNTIME',list,contract));
});

test('CI-only import growth reconstructs exact a203 source sets and never expands a native manifest',()=>{
 const contract=current();for(const delta of contract[section].proofSourceDeltas){const spec=contract.extension.proofs.find(row=>row.id===delta.id),before=JSON.stringify(spec),old=restoreDocumentTaskAssociationSourceSet(delta.family,spec.sourceFiles,contract);
  assert.equal(old.length,delta.previousCount);assert.equal(sha(JSON.stringify(old)),delta.previousPathsSha256);assert.deepEqual(old,checkpoint.extension.proofs.find(row=>row.id===spec.id).sourceFiles);assert.equal(JSON.stringify(spec),before);
  const changed=structuredClone(contract);changed.extension.proofs.find(row=>row.id===spec.id).sourceFiles=old;reject(()=>restoreDocumentTaskAssociationPreviousContract(changed));
 }
 assert.deepEqual(contract.participantPreanalysisCurrentRevision.nativeSourceFiles,checkpoint.participantPreanalysisCurrentRevision.nativeSourceFiles);
 const id='participant-kyc-preanalysis-postgres',prior=checkpoint.extension.proofs.find(row=>row.id===id),inner=checkpoint.integratedIdentityCurrentRevision.proofSourceDeltas.find(row=>row.id===id),historic=prior.sourceFiles.filter(file=>!inner.additions.includes(file));
 assert.equal(historic.length,200);assert.equal(sha(JSON.stringify(historic)),inner.previousPathsSha256);
 const changed=structuredClone(contract),spec=changed.extension.proofs.find(row=>row.id===id);spec.sourceFiles=historic;reject(()=>restoreDocumentTaskAssociationPreviousContract(changed));
 const source=file=>file==='.github/workspace-acceptance-contract.json'?bytes(changed):read(file);assert.throws(()=>preloadParticipantPreanalysisConsumerSources({readSource:source,readCheckout:source}),{code:'PLAN_MEASUREMENT_DOCUMENT_ASSOCIATION_CI_LINEAGE_REJECTED'});
 assert.throws(()=>validateParticipantKycPreanalysisCi({}, {expectedHead:'a'.repeat(40),expectedTree:'b'.repeat(40),readSource:read,readEvidence:()=>null,spec}),error=>error.code==='PARTICIPANT_PREANALYSIS_CI_REJECTED'&&error.message==='Only the exact committed proof spec may be validated');
});

test('closed consumer maps preload the new checkpoint and outer auxiliary leaves before verification',()=>{
 const contract=current(),expected=documentTaskAssociationValidationFiles(contract),seen=new Set();assert.ok(expected.includes(checkpointPath));assert.ok(expected.includes('scripts/lib/plan-measurement-document-association-ci-lineage.mjs'));assert.ok(expected.includes('tests/production-plan-measurement-document-association-ci-lineage.test.mjs'));
 const loaded=preloadParticipantPreanalysisConsumerSources({readSource:file=>{seen.add(file);return read(file);},readCheckout:read});for(const file of expected){assert.ok(loaded.includes(file));assert.ok(seen.has(file));}
 for(const missing of [checkpointPath,'scripts/lib/plan-measurement-document-association-ci-lineage.mjs'])assert.throws(()=>preloadParticipantPreanalysisConsumerSources({readSource:file=>file===missing?null:read(file),readCheckout:read}));
});

test('the immutable a203 JSON is an explicit authenticated validation dependency',()=>{
 const contract=current();assert.equal(sha(read(checkpointPath)),previousSha);reject(()=>verifyDocumentTaskAssociationCurrentSources(contract,file=>file===checkpointPath?Buffer.from('{}\n'):read(file)));
 const refs=verifyDocumentTaskAssociationCurrentSources(contract,read).auxiliaryValidationSources;assert.ok(refs.every(row=>Object.keys(row).sort().join(',')==='path,sha256'));assert.equal(new Set(refs.map(row=>row.path)).size,refs.length);
});

test('current outer composition changes no workflow command lane artifact or historical proof labels',()=>{
 const actual=current(),contract=restoreWorkspaceContinuityPreviousContract(actual),rebuilt=composeDocumentTaskAssociationContract(contract[section]);assert.deepEqual(rebuilt,contract);assert.deepEqual(contract.blocks,checkpoint.blocks);assert.deepEqual(contract.lanes,checkpoint.lanes);assert.deepEqual(contract.artifactPatterns,checkpoint.artifactPatterns);assert.equal(contract.extension.proofs.length,20);
 for(const spec of contract.extension.proofs){const old=checkpoint.extension.proofs.find(row=>row.id===spec.id);assert.deepEqual(spec.checkNames,old.checkNames);assert.equal(spec.producerSha256,old.producerSha256);}
 const focused=actual.extension.proofs.find(row=>row.id==='focused-workspace-ui'),prior=contract.extension.proofs.find(row=>row.id===focused.id);assert.equal(prior.checkNames.length,20);assert.equal(focused.checkNames.length,45);assert.deepEqual(focused.checkNames.slice(0,20),prior.checkNames);assert.equal(focused.producerSha256,'b7d134ed370e7984f8aed315127b82e4d2bdebe20a6d0d79a7453bf7e1f63dab');assert.equal(actual.evidenceProducers.find(row=>row.path===focused.path).producerSha256,focused.producerSha256);
});