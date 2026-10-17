import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import checkpoint from './fixtures/workspace-continuity-contract-d5d.json' with {type:'json'};
import whatsappCheckpoint from './fixtures/whatsapp-field-continuity-contract-052.json' with {type:'json'};
import {WHATSAPP_FIELD_CONTINUITY_PREVIOUS_CONTRACT_SHA256 as whatsappPreviousSha,restoreWhatsappFieldContinuityPreviousContract,restoreWhatsappFieldContinuitySourceSet} from '../scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs';
import {WORKSPACE_CONTINUITY_SECTION as section,WORKSPACE_CONTINUITY_PREVIOUS_CONTRACT_SHA256 as previousSha,WORKSPACE_CONTINUITY_CHECKPOINT_PATH as checkpointPath,WORKSPACE_CONTINUITY_FOCUSED_UI as focused,composeWorkspaceContinuityContract,restoreWorkspaceContinuityPreviousContract,workspaceContinuityCurrentSourcePin,workspaceContinuityValidationFiles,verifyWorkspaceContinuityCurrentSources,restoreWorkspaceContinuitySourceSet,workspaceContinuityProofSourceAdditions} from '../scripts/lib/workspace-continuity-current-ci-lineage.mjs';
import {restoreDocumentTaskAssociationPreviousContract,verifyDocumentTaskAssociationCurrentSources} from '../scripts/lib/plan-measurement-document-association-ci-lineage.mjs';
import {restoreIntegratedIdentityPreviousContract} from '../scripts/lib/integrated-identity-current-ci-lineage.mjs';
import {restoreParticipantPreanalysisPreviousContract,preloadParticipantPreanalysisConsumerSources} from '../scripts/lib/participant-preanalysis-current-ci-lineage.mjs';
import {restoreOoxmlAccountingPreviousContract} from '../scripts/lib/ooxml-accounting-current-ci-lineage.mjs';
import {reconstructPublishedHContract} from '../scripts/lib/plan-measurement-current-ci-lineage.mjs';
import {focusedWorkspaceCiSourceClosure,normalizeFocusedWorkspaceChecks,normalizeFocusedWorkspaceCurrentChecks} from '../scripts/verify-focused-workspace-ci.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),read=file=>existsSync(file)?readFileSync(file):null,bytes=value=>Buffer.from(JSON.stringify(value,null,2)+'\n'),current=()=>JSON.parse(read('.github/workspace-acceptance-contract.json'));
const reject=run=>assert.throws(run,{code:'WORKSPACE_CONTINUITY_CURRENT_CI_LINEAGE_REJECTED'});
const previousCurrent=()=>{const restored=restoreWhatsappFieldContinuityPreviousContract(current());assert.deepEqual(restored,whatsappCheckpoint);assert.equal(sha(bytes(restored)),whatsappPreviousSha);assert.equal(whatsappPreviousSha,'f7a72979af7b789d92333d4f631d6bbbccf247c5c04ce6edd88f64f70b6099bb');return restored;};

test('continuity inverse restores complete immutable d5d before a203 AI OOXML and H without changing current',()=>{
 const contract=current(),before=JSON.stringify(contract),restored=restoreWorkspaceContinuityPreviousContract(contract);
 assert.equal(previousSha,'8c2afc33e9454b9c7a9d9fd2056f2c3de75f4657bbcbce4fb1bdf618e0590db3');assert.equal(sha(bytes(restored)),previousSha);assert.deepEqual(restored,checkpoint);assert.equal(JSON.stringify(contract),before);
 for(const[restore,expected]of [[restoreDocumentTaskAssociationPreviousContract,'10319b1ab8a283b7c89cab96a279e20e25fe4be2736d91caaa915a4e62afa524'],[restoreIntegratedIdentityPreviousContract,'3c1a184f2e6839bba6bd7116ccf6c062fbb015500ec4900583dbd15f82fe7270'],[restoreParticipantPreanalysisPreviousContract,'c2ba8944d4b004d31451f5bd248132295b4c4539704b87cca3d1305bef9160bb'],[restoreOoxmlAccountingPreviousContract,'63252e3af6a5e595f731302d33cf32e18182f24c75ac144cc062b0911efeda17'],[reconstructPublishedHContract,'9dab901cb93f3834cad0f1ea9ba386c5bb12acc913463a7dfb6368847af3fd37']])assert.equal(sha(bytes(restore(contract))),expected);
 assert.deepEqual(contract.planMeasurementCurrentLineage.currentValidationSources,checkpoint.planMeasurementCurrentLineage.currentValidationSources);assert.equal(contract.planMeasurementCurrentLineage.currentValidationSources.length,49);assert.equal(sha(JSON.stringify(contract.kycExpiredCurrentComposition)),'6ac6cb2e19c9d3ecc803bfc556e62e316701754c7252734503699841e1ed2533');
});

test('current focused45 and wrapper record agree while the historical20 matrix remains independently available',()=>{
 const contract=previousCurrent(),spec=contract.extension.proofs.find(row=>row.id==='focused-workspace-ui'),prior=checkpoint.extension.proofs.find(row=>row.id===spec.id),change=contract[section].currentProofChanges.find(row=>row.id===spec.id),records=contract.evidenceProducers.filter(row=>row.path===spec.path);
 assert.equal(focused.rawVersion,2);assert.equal(focused.previousRawVersion,1);assert.equal(focused.previousCheckCount,20);assert.equal(prior.checkNames.length,20);assert.equal(spec.checkNames.length,45);assert.deepEqual(spec.checkNames.slice(0,20),prior.checkNames);assert.deepEqual(spec.checkNames.slice(20),focused.continuityCheckNames);assert.equal(focused.continuityCheckNames.length,25);
 assert.equal(change.previousProducerSha256,prior.producerSha256);assert.equal(spec.producerSha256,change.currentProducerSha256);assert.equal(records.length,1);assert.equal(records[0].producerSha256,spec.producerSha256);assert.deepEqual(change.currentCheckNames,spec.checkNames);
 const priorChecks=prior.checkNames.map(name=>name.startsWith('hidden-panel-headings-')?name+':12':name);assert.deepEqual(normalizeFocusedWorkspaceChecks(priorChecks),prior.checkNames);assert.throws(()=>normalizeFocusedWorkspaceCurrentChecks(priorChecks),{code:'FOCUSED_WORKSPACE_CI_REJECTED'});const previousChecks=[...priorChecks,...focused.continuityCheckNames];assert.throws(()=>normalizeFocusedWorkspaceCurrentChecks(previousChecks),{code:'FOCUSED_WORKSPACE_CI_REJECTED'});const actual=current(),currentSpec=actual.extension.proofs.find(row=>row.id===spec.id);assert.deepEqual(currentSpec.checkNames.slice(0,45),spec.checkNames);assert.deepEqual(normalizeFocusedWorkspaceCurrentChecks([...previousChecks,...currentSpec.checkNames.slice(45)]),currentSpec.checkNames);
});

test('complete continuity composition changes no command lane artifact or native matrix',()=>{
 const contract=previousCurrent();assert.deepEqual(composeWorkspaceContinuityContract(contract[section]),contract);for(const key of ['blocks','lanes','artifactPatterns','workflow'])assert.deepEqual(contract[key],checkpoint[key]);assert.equal(contract.extension.proofs.length,20);assert.equal(contract.blocks.length,58);assert.equal(contract.artifactPatterns.length,62);
 for(const spec of contract.extension.proofs.filter(row=>row.id!=='focused-workspace-ui')){const prior=checkpoint.extension.proofs.find(row=>row.id===spec.id);assert.deepEqual(spec.checkNames,prior.checkNames);assert.equal(spec.producerSha256,prior.producerSha256);}
 assert.deepEqual(contract.participantPreanalysisCurrentRevision.nativeSourceFiles,checkpoint.participantPreanalysisCurrentRevision.nativeSourceFiles);assert.deepEqual(contract.planMeasurementDocumentAssociationRevision.measurement,checkpoint.planMeasurementDocumentAssociationRevision.measurement);assert.equal(contract.planMeasurementDocumentAssociationRevision.measurement.nativeCurrentCount,118);assert.equal(contract.planMeasurementDocumentAssociationRevision.measurement.nativeCount,17);assert.equal(contract.planMeasurementDocumentAssociationRevision.measurement.uiCount,25);assert.equal(contract.planMeasurementDocumentAssociationRevision.measurement.aiNativeCount,115);assert.equal(contract.planMeasurementDocumentAssociationRevision.measurement.publishedNativeCount,113);
});

test('current continuity source validation authenticates every leaf independently of a native or browser result',()=>{
 const contract=current(),result=verifyWorkspaceContinuityCurrentSources(contract,read);assert.equal(result.nativeOrBrowserAcceptance,false);assert.equal(result.completeCheckpointRestored,true);
 for(const row of result.auxiliaryValidationSources)reject(()=>verifyWorkspaceContinuityCurrentSources(contract,file=>file===row.path?Buffer.from('foreign current bytes '+file):read(file)));
 assert.equal(verifyDocumentTaskAssociationCurrentSources(contract,read).nativeOrBrowserAcceptance,false);
});

test('only authenticated predecessor aliases advance and old or foreign bytes cannot certify current',()=>{
 const contract=previousCurrent();for(const row of [...contract[section].reviewedSourceChanges,...contract[section].validationDeltas]){assert.equal(workspaceContinuityCurrentSourcePin(contract,{path:row.path,sha256:row.previousSha256}),row.currentSha256);reject(()=>workspaceContinuityCurrentSourcePin(contract,{path:row.path,sha256:'e'.repeat(64)}));reject(()=>workspaceContinuityCurrentSourcePin(contract,{path:row.path,sha256:row.currentSha256}));}
 const row=contract[section].reviewedSourceChanges.find(row=>row.path.endsWith('/workspace-client.js'));assert.equal(workspaceContinuityCurrentSourcePin(contract,{path:row.path,sha256:'4f3ccde7f433c98e63f0ada92cd1346f0757bea06ea8bf93abf9ac0ff62b79f8'}),row.currentSha256);
 const actual=current(),outer=actual.whatsappFieldContinuityCurrentRevision.reviewedSourceChanges.find(delta=>delta.path===row.path);assert.equal(workspaceContinuityCurrentSourcePin(actual,{path:row.path,sha256:row.currentSha256}),outer.currentSha256);reject(()=>workspaceContinuityCurrentSourcePin(actual,{path:row.path,sha256:outer.currentSha256}));reject(()=>workspaceContinuityCurrentSourcePin(actual,{path:row.path,sha256:'e'.repeat(64)}));
});

test('omitted duplicate substituted and unreviewed outer deltas cannot reseal a historical contract',()=>{
 for(const mutate of [c=>{c[section].reviewedSourceChanges.pop();},c=>{c[section].validationDeltas.push({...c[section].validationDeltas[0]});},c=>{c[section].reviewedSourceChanges[0].currentSha256=c[section].reviewedSourceChanges[0].previousSha256;},c=>{c[section].addedSources[0].sha256='f'.repeat(64);},c=>{c[section].unexpected=true;},c=>{c.planMeasurementCurrentLineage.currentValidationSources[0].sha256='f'.repeat(64);},c=>{c.extension.proofs.find(row=>row.id==='focused-workspace-ui').checkNames=checkpoint.extension.proofs.find(row=>row.id==='focused-workspace-ui').checkNames;},c=>{c.evidenceProducers.find(row=>row.path==='.vercel/private/focused-workspace-ui-evidence/current-ci.json').producerSha256='f'.repeat(64);}]){const contract=current();mutate(contract);reject(()=>restoreWorkspaceContinuityPreviousContract(contract));}
});

test('CI import additions restore exact d5d source sets and old source sets cannot satisfy current acceptance',()=>{
 const contract=previousCurrent();for(const delta of contract[section].proofSourceDeltas){const spec=contract.extension.proofs.find(row=>row.id===delta.id),old=restoreWorkspaceContinuitySourceSet(delta.family,spec.sourceFiles,contract),prior=checkpoint.extension.proofs.find(row=>row.id===delta.id);assert.deepEqual(old,prior.sourceFiles);assert.equal(old.length,delta.previousCount);assert.equal(sha(JSON.stringify(old)),delta.previousPathsSha256);assert.deepEqual(workspaceContinuityProofSourceAdditions(spec),delta.additions);assert.deepEqual(workspaceContinuityProofSourceAdditions(prior),[]);
  for(const files of [old,spec.sourceFiles.slice(1),[...spec.sourceFiles,spec.sourceFiles[0]],[...spec.sourceFiles.slice(1),'src/lib/foreign.mjs'].sort()])reject(()=>restoreWorkspaceContinuitySourceSet(delta.family,files,contract));
  const changed=structuredClone(contract);changed.extension.proofs.find(row=>row.id===spec.id).sourceFiles=old;reject(()=>restoreWorkspaceContinuityPreviousContract(changed));
 }
 const actual=current();assert.deepEqual(restoreWhatsappFieldContinuitySourceSet('UI_FOCUSED_WORKSPACE',focusedWorkspaceCiSourceClosure(read),actual),contract.extension.proofs.find(row=>row.id==='focused-workspace-ui').sourceFiles);
 for(const delta of contract[section].proofSourceDeltas){const spec=actual.extension.proofs.find(row=>row.id===delta.id),outer=actual.whatsappFieldContinuityCurrentRevision.proofSourceDeltas.find(row=>row.id===delta.id),prior=checkpoint.extension.proofs.find(row=>row.id===delta.id);assert.ok(outer);assert.deepEqual(restoreWorkspaceContinuitySourceSet(delta.family,spec.sourceFiles,actual),prior.sourceFiles);const material=actual.materialReviewCurrentRevision.proofSourceDeltas.find(row=>row.id===spec.id);assert.deepEqual(workspaceContinuityProofSourceAdditions(spec),[...delta.additions,...outer.additions,...(material?.additions||[])]);for(const files of [prior.sourceFiles,contract.extension.proofs.find(row=>row.id===spec.id).sourceFiles,spec.sourceFiles.slice(1),[...spec.sourceFiles,spec.sourceFiles[0]],[...spec.sourceFiles.slice(1),'src/lib/foreign.mjs'].sort()])reject(()=>restoreWorkspaceContinuitySourceSet(delta.family,files,actual));}
 const unrelated=['src/lib/unrelated-source.mjs'];assert.deepEqual(restoreWorkspaceContinuitySourceSet('UNRELATED_FAMILY',unrelated,actual),unrelated);
});

test('closed source maps preload the immutable JSON and every new outer leaf without widening native sources',()=>{
 const contract=current(),files=workspaceContinuityValidationFiles(contract),seen=new Set(),loaded=preloadParticipantPreanalysisConsumerSources({readSource:file=>{seen.add(file);return read(file);},readCheckout:read});assert.ok(files.includes(checkpointPath));
 for(const file of files){assert.ok(loaded.includes(file));assert.ok(seen.has(file));}assert.equal(sha(read(checkpointPath)),previousSha);reject(()=>verifyWorkspaceContinuityCurrentSources(contract,file=>file===checkpointPath?Buffer.from('{}\n'):read(file)));
 const refs=verifyWorkspaceContinuityCurrentSources(contract,read).auxiliaryValidationSources;assert.ok(refs.every(row=>Object.keys(row).sort().join(',')==='path,sha256'));assert.equal(new Set(refs.map(row=>row.path)).size,refs.length);
 for(const file of [checkpointPath,'scripts/lib/workspace-continuity-current-ci-lineage.mjs'])assert.throws(()=>preloadParticipantPreanalysisConsumerSources({readSource:path=>path===file?null:read(path),readCheckout:read}));
});
