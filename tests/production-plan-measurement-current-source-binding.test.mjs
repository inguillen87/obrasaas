import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {verifyWorksiteLiveHoursCurrentSources} from '../scripts/lib/worksite-live-hours-current-ci-lineage.mjs';
import {verifyIntegratedIdentityCurrentSources} from '../scripts/lib/integrated-identity-current-ci-lineage.mjs';
import {verifyPlanMeasurementCurrentSources,currentFieldPrivacyRevision,restorePlanMeasurementPublishedKPrivacyProducerText} from '../scripts/lib/plan-measurement-current-ci-lineage.mjs';
import {restoreFieldOutboundPreviousContract} from '../scripts/lib/field-outbound-current-ci-lineage.mjs';
import {restorePlanBudgetAcceptancePreviousContract,verifyPlanBudgetCurrentSources,restorePlanBudgetAttendanceReviewProducerText,restorePlanBudgetMeasurementPrivacyPreviousContract,restorePlanBudgetMeasurementPrivacySource,restorePlanBudgetCheckTimePreviousContract,restorePlanBudgetPreviousContract,planBudgetValidationFiles,restorePlanBudgetIntakeWithdrawalUnitProducerText,restorePlanBudgetTrialExpiryNoticeSource,restorePlanBudgetTrialExpiryNoticeValidatorSource,restorePlanBudgetPilotIntegrationPreviousContract,restorePlanBudgetPilotIntegrationSource,planBudgetCurrentSourcePin,planBudgetPreviousSourcePin} from '../scripts/lib/plan-budget-current-ci-lineage.mjs';
import {gate} from '../.github/scripts/verify-workspace-ci-parallelization.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),read=file=>Buffer.from(readFileSync(path.join(root,file),'utf8').replaceAll('\r\n','\n')),sha=value=>createHash('sha256').update(value).digest('hex'),serialize=value=>JSON.stringify(value,null,2)+'\n',current=()=>JSON.parse(read('.github/workspace-acceptance-contract.json'));
// Intentionally missing lane records. Reaching its exact rejection proves only
// the real gate's prior source-binding stage, never aggregate/CI acceptance.
const input=(contract,readSource=read)=>({contract,readSource,needs:{},expectedHead:'a'.repeat(40),workflowSha256:'b'.repeat(64),runId:'100',runAttempt:'1'});
const bindingDenied=(contract,reader=read)=>assert.throws(()=>gate(input(contract,reader)),{code:'PROOF_BINDING_SOURCE'});

// Current verification always uses this module's unchanged actual reader.
// Historical metadata and APIs below are separate owned fixtures, never a
// source reader supplied to current verification or a current CI receipt.
function authenticatedAcceptance(contract){
 const before=serialize(contract);verifyPlanBudgetCurrentSources(contract,read);
 const parent=restorePlanBudgetAcceptancePreviousContract(contract);
 assert.equal(sha(serialize(parent)),'a89d1a6c820b811359af23359e587f9110e7341bfa0c2b558b5ee452d9ac1042');
 assert.equal(serialize(contract),before);return {contract,parent};
}
function assertOneBSourcePin(boundary,file,bytes,oneBSha256){
 const raw=Buffer.from(bytes.toString('utf8').replaceAll('\r\n','\n')),history=boundary.contract.planBudgetCurrentRevision.pilotAcceptanceRuntime.sourceHistory.find(row=>row.path===file);
 if(history){assert.equal(sha(raw),history.currentSha256);assert.equal(raw.length,history.currentBytes);assert.equal(history.previousSha256,oneBSha256);}
 else assert.equal(sha(raw),oneBSha256);
}
function withPinnedGit1b(boundary,run){
 const {contract,parent}=boundary,sourcePath='scripts/lib/plan-budget-current-ci-lineage.mjs',history=contract.planBudgetCurrentRevision.pilotAcceptanceRuntime.sourceHistory.find(row=>row.path===sourcePath);
 assert.ok(history);let text=read(sourcePath).toString('utf8').replaceAll('\r\n','\n');
 assert.equal(sha(text),history.currentSha256);assert.equal(Buffer.byteLength(text),history.currentBytes);
 for(const hunk of [...history.inverseHunks].reverse()){const at=hunk.currentOffsetCharacters;assert.equal(text.slice(at,at+hunk.currentText.length),hunk.currentText);text=text.slice(0,at)+hunk.previousText+text.slice(at+hunk.currentText.length);}
 assert.equal(sha(text),'90bfa69a4e902dfab785ec10f210d6b0d0a21fe3992c3995c6b0e122748dab99');assert.equal(Buffer.byteLength(text),90144);
 const declaration='// Exact budget-source CI declaration; compiler fills immutable reviewed source bindings.\nexport const PLAN_BUDGET_CURRENT_REVISION=Object.freeze('+JSON.stringify(parent.planBudgetCurrentRevision,null,2)+');\n';
 assert.equal(sha(declaration),'e1be620f5040e7cba3ebaa0fc34190da0d0d2e1e7a164014e8c2ec3ba17f2a3c');
 const directory=mkdtempSync(path.join(tmpdir(),'obrasaas-boundary-git1b-')),moduleFile=path.join(directory,'plan-budget-current-ci-lineage.mjs'),companionFile=path.join(directory,'plan-budget-current-ci-reviewed.mjs');
 try{
  writeFileSync(moduleFile,text,{flag:'wx'});writeFileSync(companionFile,declaration,{flag:'wx'});
  const historical=createRequire(import.meta.url)(moduleFile);
  assert.equal(sha(serialize(historical.restorePlanBudgetPilotIntegrationPreviousContract(parent))),'6cb040ad517b8a87b86a0466f23fe822dd570227392aff6209eeff037e840c71');
  return run(historical,parent);
 }finally{
  for(const file of [moduleFile,companionFile]){assert.equal(path.dirname(file),directory);try{unlinkSync(file);}catch(error){if(error.code!=='ENOENT')throw error;}}
  rmdirSync(directory);
 }
}
test('current source binding executes the three actual outer verifiers without projecting the reader or contract',()=>{
 const contract=current(),before=serialize(contract),boundary=authenticatedAcceptance(contract);assert.ok(verifyWorksiteLiveHoursCurrentSources(contract,read));assert.ok(verifyIntegratedIdentityCurrentSources(contract,read));const result=verifyPlanMeasurementCurrentSources(contract,read);assert.equal(result.publishedCurrentSourceCount,127);assert.equal(result.sourceCount,contract.planBudgetCurrentRevision.sourceSetDeltas.find(row=>row.family==='COMPACT').currentCount);assert.equal(serialize(contract),before);
 const parent65d=restorePlanBudgetPilotIntegrationPreviousContract(contract),runtime=contract.planBudgetCurrentRevision.pilotIntegrationRuntime;assert.equal(sha(serialize(parent65d)),'6cb040ad517b8a87b86a0466f23fe822dd570227392aff6209eeff037e840c71');assert.equal(runtime.sourceHistory.length,11);withPinnedGit1b(boundary,(historical,parent)=>{assert.equal(sha(serialize(historical.restorePlanBudgetPilotIntegrationPreviousContract(parent))),'6cb040ad517b8a87b86a0466f23fe822dd570227392aff6209eeff037e840c71');});for(const h of runtime.sourceHistory){const actual=read(h.path),captured=Buffer.from(actual),previous=restorePlanBudgetPilotIntegrationSource(contract,h.path,actual);assertOneBSourcePin(boundary,h.path,actual,h.currentSha256);assert.equal(sha(previous),h.previousSha256);assert.equal(previous.length,h.previousBytes);assert.deepEqual(actual,captured);for(const invalid of [previous,actual.subarray(1),Buffer.concat([actual,Buffer.from('\n// foreign integration source\n')])])assert.throws(()=>restorePlanBudgetPilotIntegrationSource(contract,h.path,invalid),{code:'PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED'});}assert.equal(serialize(contract),before);
 const pin=runtime.sourceHistory.find(h=>h.path==='tests/production-meta-field.test.mjs');for(const absent of [null,{}, {other:true}])for(const digest of [pin.previousSha256,pin.currentSha256])for(const resolver of [planBudgetCurrentSourcePin,planBudgetPreviousSourcePin])assert.equal(resolver(absent,{path:pin.path,sha256:digest}),digest);
 const file='src/lib/meta-field-conversation.mjs',previous=restorePlanBudgetPilotIntegrationSource(contract,file,read(file)),reads=new Map();assert.throws(()=>verifyPlanBudgetCurrentSources(contract,p=>{const count=(reads.get(p)||0)+1;reads.set(p,count);return p===file&&count>=3?previous:read(p);}),{code:'PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED'});assert.equal(reads.get(file),3);verifyPlanBudgetCurrentSources(contract,read);assert.equal(serialize(contract),before);
});
test('the real aggregate gate passes source binding and still rejects an intentionally absent lane matrix',()=>{assert.throws(()=>gate(input(current())),{code:'MISSING_OR_EXTRA_LANE'});});
test('attendance producer comparison uses the complete authenticated L parent while the frozen L selector rejects the current producer',()=>{
 const contract=current(),before=serialize(contract),spec=contract.extension.proofs.find(row=>row.kind==='PG_FIELD'),raw=read(spec.producer),rawBefore=Buffer.from(raw),runtime=contract.planBudgetCurrentRevision.attendanceReviewRuntime.producer,parent=restoreFieldOutboundPreviousContract(contract),parentSpec=parent.extension.proofs.find(row=>row.id===spec.id);
 assert.equal(sha(raw),runtime.currentSha256);assert.equal(runtime.currentSha256,'4eb11afda80e9274e3fecdc229d12f21d53d29d444e6932e44837f257800ccc2');assert.throws(()=>currentFieldPrivacyRevision(contract,spec),{code:'PLAN_MEASUREMENT_CURRENT_CI_LINEAGE_REJECTED'});
 const comparison=restorePlanBudgetAttendanceReviewProducerText(contract,raw),revision=currentFieldPrivacyRevision(parent,parentSpec);assert.equal(sha(comparison),runtime.previousSha256);assert.equal(sha(comparison),revision.currentSha256);assert.equal(revision.currentSha256,'c3cf9eed8983b9ab43ad9b11cf0f59af206b08ba70f5e6697133bb448b940662');assert.equal(sha(restorePlanMeasurementPublishedKPrivacyProducerText(parent,spec.producer,comparison)),revision.previousSha256);assert.deepEqual(raw,rawBefore);assert.deepEqual(read(spec.producer),rawBefore);assert.equal(serialize(contract),before);
});
test('the binding successor restores complete9248 before9537 and eight-b while three current validator bodies remain authenticated',()=>{
 const contract=current(),before=serialize(contract),r=contract.planBudgetCurrentRevision.measurementPrivacyRuntime,parent=restorePlanBudgetMeasurementPrivacyPreviousContract(contract);assert.equal(planBudgetValidationFiles(contract).includes(r.validationSource.path),true);assert.equal(r.parentHead,'9248b8c521456f586dd8ffb3226136ff6828011a');assert.equal(sha(serialize(parent)),'eeebf3df17dfc1ab432101c2137b75742323bdce85d3412c67582c84f0cd0c7e');assert.equal(sha(serialize(restorePlanBudgetCheckTimePreviousContract(contract))),'18eaa0eec2d952cbfa130d1d245322e779c3b7eabffc704c453cdde834933c4c');assert.equal(sha(serialize(restorePlanBudgetPreviousContract(contract))),'8b19235b22aa3c208098283537511fe1c816f7ff86404790a98999f0e818f839');assert.equal(parent.planBudgetCurrentRevision.references.length,115);assert.equal(parent.planBudgetCurrentRevision.sourceSetDeltas.length,22);assert.equal(parent.planBudgetCurrentRevision.sourceFamilies.length,16);
 verifyPlanBudgetCurrentSources(contract,read);
 const trial=contract.planBudgetCurrentRevision.trialExpiryNoticeRuntime,advance=trial.validationSourceAdvance;
 assert.equal(r.validationSource.sha256,'e3d963f9740e4d17b3d4e15bcf9b6c34adc569fb988493ec7b10268a42514779');
 assert.deepEqual(advance,{path:r.validationSource.path,previousSha256:r.validationSource.sha256,currentSha256:sha(restorePlanBudgetPilotIntegrationSource(contract,r.validationSource.path,read(r.validationSource.path)))});
 assert.deepEqual(trial.sourceHistory.map(h=>h.path),['src/lib/participant-onboarding-authority.mjs','src/lib/participant-onboarding-reactive.mjs','scripts/lib/plan-budget-current-ci-lineage.mjs',r.validationSource.path]);
 assert.deepEqual(trial.sourceHistory.map(({path,previousSha256,currentSha256})=>({path,previousSha256,currentSha256})),[...trial.sourceAliases,trial.referenceAdvances[0],advance]);
 for(const h of trial.sourceHistory){const raw=read(h.path),rawBefore=Buffer.from(raw),comparison65d=restorePlanBudgetPilotIntegrationSource(contract,h.path,raw),old=h.path.startsWith('src/lib/')?restorePlanBudgetTrialExpiryNoticeSource(contract,h.path,raw):restorePlanBudgetTrialExpiryNoticeValidatorSource(contract,h.path,raw);assert.equal(sha(comparison65d),h.currentSha256);assert.equal(sha(old),h.previousSha256);assert.deepEqual(raw,rawBefore);}
 for(const h of r.sourceHistory){const raw=read(h.path),rawBefore=Buffer.from(raw),comparison=h.path==='scripts/lib/plan-budget-current-ci-lineage.mjs'?restorePlanBudgetTrialExpiryNoticeValidatorSource(contract,h.path,raw):restorePlanBudgetPilotIntegrationSource(contract,h.path,raw),old=restorePlanBudgetMeasurementPrivacySource(contract,h.path,raw);assert.equal(sha(comparison),h.currentSha256);assert.equal(sha(old),h.previousSha256);assert.deepEqual(raw,rawBefore);bindingDenied(contract,file=>file===h.path?old:read(file));}assert.equal(serialize(contract),before);
});
test('current source binding refuses old foreign resealed or omitted producer and successor validation bytes',()=>{
 const contract=current(),spec=contract.extension.proofs.find(row=>row.kind==='PG_FIELD'),raw=read(spec.producer),old=restorePlanBudgetAttendanceReviewProducerText(contract,raw);for(const value of [old,Buffer.concat([raw,Buffer.from('\n// foreign current producer\n')])])bindingDenied(contract,file=>file===spec.producer?value:read(file));
 const unit=contract.planBudgetCurrentRevision.intakeWithdrawalRuntime.unitProducer,unitSpec=contract.extension.proofs.find(row=>row.id==='bank-intake-units'),unitBytes=read(unit.producer),unitParent=restorePlanBudgetIntakeWithdrawalUnitProducerText(contract,unitBytes);assert.equal(unitSpec.producerSha256,unit.currentSha256);assert.equal(sha(unitBytes),unit.currentSha256);assert.equal(sha(unitParent),unit.previousSha256);assert.equal(unit.previousSha256,'470cdeddcce7ddf8117ca4bffeb45fc2733135aac59b399b468fd915b4b5628f');
 for(const value of [unitParent,Buffer.concat([unitBytes,Buffer.from('\n// altered current UNIT producer\n')])])bindingDenied(contract,file=>file===unit.producer?value:read(file));
 const resealed=structuredClone(contract);resealed.planBudgetCurrentRevision.intakeWithdrawalRuntime.unitProducer.currentSha256=sha(unitParent);bindingDenied(resealed,file=>file==='.github/workspace-acceptance-contract.json'?Buffer.from(serialize(resealed)):file===unit.producer?unitParent:read(file));
 const validation=contract.planBudgetCurrentRevision.measurementPrivacyRuntime.validationSource.path;for(const value of [null,Buffer.from('foreign regression source')])bindingDenied(contract,file=>file===validation?value:read(file));
 const validationParent=restorePlanBudgetTrialExpiryNoticeValidatorSource(contract,validation,read(validation));assert.equal(sha(validationParent),'e3d963f9740e4d17b3d4e15bcf9b6c34adc569fb988493ec7b10268a42514779');bindingDenied(contract,file=>file===validation?validationParent:read(file));
 for(const edit of [r=>r.sourceHistory.pop(),r=>r.sourceHistory.reverse(),r=>{r.sourceHistory[0].inverseHunks[0].currentText+='foreign';},r=>r.referenceAdvances.pop(),r=>r.familyManifestAdvances.pop(),r=>{r.validationSource.sha256='f'.repeat(64);},r=>{delete r.validationSource.sha256;},r=>{r.previousContractSha256='f'.repeat(64);},r=>{r.sourceHistory[0].currentSha256=sha(old);}]){const changed=structuredClone(contract);edit(changed.planBudgetCurrentRevision.measurementPrivacyRuntime);bindingDenied(changed,file=>file==='.github/workspace-acceptance-contract.json'?Buffer.from(serialize(changed)):read(file));}
});
