import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {PLAN_BUDGET_CURRENT_REVISION as liveReviewed} from '../scripts/lib/plan-budget-current-ci-reviewed.mjs';
import {createPilotCompletionLayer} from '../scripts/lib/pilot-completion-current-ci-layer.mjs';
import {
  restorePilotCompletionPreviousContract,restorePilotCompletionPreviousSourceText,restorePilotCompletionPreviousProofSpec,restorePilotCompletionPreviousFieldProof,
  restorePilotCompletionPreviousSourceSet,pilotCompletionNativeLibrarySources,
  restoreOwnOnboardingAdapterPreviousContract,verifyPlanBudgetCurrentSources,
  verifyPlanBudgetActualClosure,planBudgetValidationFiles,
  planBudgetCurrentSourcePin,planBudgetPreviousSourcePin,planBudgetProofSourceAdditions,
} from '../scripts/lib/plan-budget-current-ci-lineage.mjs';
import {verifyPlanMeasurementCurrentSources,currentFieldPrivacySpecRevision} from '../scripts/lib/plan-measurement-current-ci-lineage.mjs';
import {verifyFieldOutboundCurrentSources} from '../scripts/lib/field-outbound-current-ci-lineage.mjs';
import {verifyOoxmlAccountingCurrentSources} from '../scripts/lib/ooxml-accounting-current-ci-lineage.mjs';
import {verifyParticipantPreanalysisCurrentSources} from '../scripts/lib/participant-preanalysis-current-ci-lineage.mjs';
import {verifyIntegratedIdentityCurrentSources} from '../scripts/lib/integrated-identity-current-ci-lineage.mjs';
import {verifyDocumentTaskAssociationCurrentSources} from '../scripts/lib/plan-measurement-document-association-ci-lineage.mjs';
import {verifyWorkspaceContinuityCurrentSources} from '../scripts/lib/workspace-continuity-current-ci-lineage.mjs';
import {verifyWhatsappFieldContinuityCurrentSources} from '../scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs';
import {verifyExistingApiPlanCurrentSources} from '../scripts/lib/meta-existing-api-plan-current-ci-lineage.mjs';
import {verifyMaterialReviewCurrentSources} from '../scripts/lib/material-review-current-ci-lineage.mjs';
import {
  verifyParticipantDraftSafetyCurrentSources,verifyCustomerPhoneSelectionCurrentSources,
  verifyHomeDecisionsCurrentSources,verifyCompanyOnboardingUxCurrentSources,
  verifyWeeklyCypCurrentSources,verifyProgressEvidenceWaitCurrentSources,
  verifyIdentityDestinationUxCurrentSources,
} from '../scripts/lib/home-decisions-current-ci-lineage.mjs';
import {verifyWorksiteLiveHoursCurrentSources} from '../scripts/lib/worksite-live-hours-current-ci-lineage.mjs';
import {verifyPlanPartidaPreviewCurrentSources} from '../scripts/lib/plan-partida-preview-current-ci-lineage.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const read=file=>{try{return readFileSync(new URL('../'+file,import.meta.url));}catch{return null;}};
const contract=JSON.parse(read('.github/workspace-acceptance-contract.json'));
const current=contract.planBudgetCurrentRevision,advance=current.pilotCompletionAdvance;
const rejected=error=>error?.code==='PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED';
const declaration=value=>'// Exact budget-source CI declaration; compiler fills immutable reviewed source bindings.\nexport const PLAN_BUDGET_CURRENT_REVISION=Object.freeze('+JSON.stringify(value,null,2)+');\n';

test('pilot source layer restores the exact complete Own adapter and published predecessor without mutating input',()=>{
 const before=JSON.stringify(contract),prior=restorePilotCompletionPreviousContract(contract,read);
 assert.equal(hash(JSON.stringify(prior,null,2)+'\n'),'4d813ad4f40496d1355b2820607d138d899ea51d336ab176c9fb2febe6ce9a00');
 assert.equal(hash(declaration(prior.planBudgetCurrentRevision)),'38ff6cce6ed0f5dcb6d62e54e88e462a615271ae40a380715501314b97295a7e');
 assert.equal(hash(JSON.stringify(restoreOwnOnboardingAdapterPreviousContract(contract,read),null,2)+'\n'),'109fcc04d0ad9ad37cadf71248a7b0e7fe6de57bfedb5fb23d5d994081eb7c36');
 assert.equal(JSON.stringify(contract),before);
 prior.planBudgetCurrentRevision.version=99;
 assert.equal(restorePilotCompletionPreviousContract(contract,read).planBudgetCurrentRevision.version,1);
});

test('all20 actual outer source verifiers authenticate the physical current pilot tree',()=>{
 const before=JSON.stringify(contract),verifiers=[
  verifyPlanBudgetCurrentSources,verifyPlanPartidaPreviewCurrentSources,verifyWorksiteLiveHoursCurrentSources,
  verifyPlanMeasurementCurrentSources,verifyFieldOutboundCurrentSources,verifyOoxmlAccountingCurrentSources,
  verifyParticipantPreanalysisCurrentSources,verifyIntegratedIdentityCurrentSources,
  verifyDocumentTaskAssociationCurrentSources,verifyWorkspaceContinuityCurrentSources,
  verifyWhatsappFieldContinuityCurrentSources,verifyExistingApiPlanCurrentSources,
  verifyMaterialReviewCurrentSources,verifyParticipantDraftSafetyCurrentSources,
  verifyCustomerPhoneSelectionCurrentSources,verifyHomeDecisionsCurrentSources,
  verifyCompanyOnboardingUxCurrentSources,verifyWeeklyCypCurrentSources,
  verifyProgressEvidenceWaitCurrentSources,verifyIdentityDestinationUxCurrentSources,
 ];
 assert.equal(verifiers.length,20);
 for(const verifier of verifiers){
  const result=verifier(contract,read);
  assert.ok(result && typeof result==='object',verifier.name);
  if(Object.hasOwn(result,'nativeOrBrowserAcceptance'))assert.equal(result.nativeOrBrowserAcceptance,false,verifier.name);
  assert.equal(JSON.stringify(contract),before,verifier.name);
 }
});

test('every current family binds its complete physical manifest and refuses missing added sources',()=>{
 for(const family of current.sourceFamilies){
  const closure={files:family.currentFiles,externalImports:family.externalImports};
  assert.equal(verifyPlanBudgetActualClosure(contract,family.family,closure,read).sourceCount,family.currentFiles.length);
 }
 const row=advance.sourceChanges.find(item=>item.status==='ADDED');
 assert.ok(row);
 assert.throws(()=>verifyPlanBudgetCurrentSources(contract,file=>file===row.path?null:read(file)),rejected);
 assert.throws(()=>verifyPlanBudgetCurrentSources(contract,file=>file===row.path?Buffer.from([0xff]):read(file)),rejected);
});

test('current source enumeration owns every new or changed file and works with only its declared reader',()=>{
 const files=planBudgetValidationFiles(contract),set=new Set(files);
 assert.equal(set.size,files.length);
 for(const row of advance.sourceChanges)assert.ok(set.has(row.path),row.path);
 assert.equal(verifyPlanBudgetCurrentSources(contract,file=>set.has(file)?read(file):null).nativeOrBrowserAcceptance,false);
});

test('source omission, changed bytes and raw line-ending mutation are rejected before returning history',()=>{
 const row=advance.sourceChanges.find(item=>item.status==='ADDED'&&item.path.endsWith('.mjs'));
 const bytes=read(row.path),text=bytes.toString('utf8'),lf=text.replaceAll('\r\n','\n');
 const other=Buffer.from(text.includes('\r\n')?lf:lf.replaceAll('\n','\r\n'));
 assert.equal(other.equals(bytes),false);
 assert.throws(()=>restorePilotCompletionPreviousContract(contract,file=>file===row.path?Buffer.concat([bytes,Buffer.from('\n// changed\n')]):read(file)),rejected);
 let reads=0;
 assert.throws(()=>restorePilotCompletionPreviousContract(contract,file=>file===row.path&&++reads>1?other:read(file)),error=>rejected(error)&&error.reason==='PILOT_SOURCE_CHANGED_DURING_CALL');
 assert.ok(reads>=2);
});

test('caller metadata mutations and physical declaration corruption remain independent rejection paths',()=>{
 const changed=structuredClone(contract);
 changed.planBudgetCurrentRevision.pilotCompletionAdvance.sourceChanges[0].currentSha256='f'.repeat(64);
 let reads=0;
 assert.throws(()=>verifyPlanBudgetCurrentSources(changed,file=>{reads++;return read(file);}),error=>rejected(error)&&error.reason==='IMMUTABLE_COMPANION');
 assert.equal(reads,0);
 assert.throws(()=>verifyPlanBudgetCurrentSources(contract,file=>file==='scripts/lib/plan-budget-current-ci-reviewed.mjs'?Buffer.concat([read(file),Buffer.from('\n')]):read(file)),rejected);
 const during=structuredClone(contract);
 let once=false;
 assert.throws(()=>restorePilotCompletionPreviousContract(during,file=>{
  if(!once){once=true;during.planBudgetCurrentRevision.version=99;}
  return read(file);
 }),rejected);
});

test('compiled source path and previous-pin boundaries cannot be changed by replacing the reviewed object',()=>{
 for(const mutate of [
  value=>value.pilotCompletionAdvance.sourceChanges.pop(),
  value=>value.pilotCompletionAdvance.sourceChanges.reverse(),
  value=>{value.pilotCompletionAdvance.sourceChanges.find(row=>row.status==='MODIFIED').previousSha256='e'.repeat(64);},
  value=>value.pilotCompletionAdvance.metadataInverse.pop(),
  value=>{value.pilotCompletionAdvance.previousContractSha256='e'.repeat(64);},
 ]){
  const value=structuredClone(current);mutate(value);
  assert.throws(()=>createPilotCompletionLayer(value),rejected);
 }
});

test('same-path current pins and pure text inverses do not create authority for arbitrary or foreign digests',()=>{
 for(const row of advance.sourceChanges){
  assert.equal(planBudgetCurrentSourcePin(contract,{path:row.path,sha256:row.currentSha256}),row.currentSha256);
  assert.throws(()=>planBudgetCurrentSourcePin(contract,{path:row.path,sha256:'f'.repeat(64)}),rejected);
  const old=restorePilotCompletionPreviousSourceText(contract,row.path,read(row.path).toString('utf8'));
  assert.equal(Buffer.byteLength(old),row.previousBytes);
  assert.equal(row.previousSha256===null?old:hash(old),row.previousSha256===null?'':row.previousSha256);
  if(row.status==='ADDED')assert.equal(planBudgetPreviousSourcePin(contract,{path:row.path,sha256:row.currentSha256}),row.currentSha256);
 }
});

test('mutating the shallow reviewed export cannot redirect the private compiled snapshot',()=>{
 const original=liveReviewed.pilotCompletionAdvance.sourceChanges[0].currentSha256;
 try{
  liveReviewed.pilotCompletionAdvance.sourceChanges[0].currentSha256='f'.repeat(64);
  const row=advance.sourceChanges[0];
  assert.equal(planBudgetCurrentSourcePin(contract,{path:row.path,sha256:row.currentSha256}),row.currentSha256);
  assert.equal(verifyPlanBudgetCurrentSources(contract,read).nativeOrBrowserAcceptance,false);
 }finally{liveReviewed.pilotCompletionAdvance.sourceChanges[0].currentSha256=original;}
});

test('typed proof additions preserve prior sources and include the new closure layer explicitly',()=>{
 const spec=contract.extension.proofs.find(row=>row.kind==='UI_FOCUSED_WORKSPACE');
 const added=planBudgetProofSourceAdditions(spec);
 assert.ok(added.includes('scripts/lib/pilot-completion-current-ci-layer.mjs'));
 assert.equal(new Set(added).size,added.length);
 assert.ok(added.every(file=>spec.sourceFiles.includes(file)));
});

// The Home -> Company chain owns this earlier overview pin. Outer Previous must
// preserve it so that owner can validate it; Current must never promote it early.
test('historical same-path aliases survive Previous only and caller metadata cannot enroll new aliases',()=>{
 const path='src/app/(identity)/cuenta/workspace-overview.js';
 const alias='1efd9a741ddd4e38492c38f62d95104a0a98c715a962df44aab0d1f793031b00';
 const row=advance.sourceChanges.find(item=>item.path===path);
 assert.ok(row && row.status==='MODIFIED');
 assert.equal(planBudgetPreviousSourcePin(contract,{path,sha256:alias}),alias);
 assert.equal(planBudgetPreviousSourcePin(contract,{path,sha256:row.currentSha256}),row.previousSha256);
 assert.throws(()=>planBudgetCurrentSourcePin(contract,{path,sha256:alias}),rejected);
 assert.throws(()=>planBudgetPreviousSourcePin(contract,{path,sha256:'f'.repeat(64)}),rejected);
 const foreign=advance.sourceChanges.find(item=>item.status==='ADDED');
 assert.throws(()=>planBudgetPreviousSourcePin(contract,{path:foreign.path,sha256:alias}),rejected);
 const forged=structuredClone(contract);
 forged.homeDecisionsCurrentRevision.reviewedSourceChanges.find(item=>item.path===path).currentSha256='f'.repeat(64);
 assert.throws(()=>planBudgetPreviousSourcePin(forged,{path,sha256:'f'.repeat(64)}),rejected);
});

test('field proof history accepts only the complete compiled current spec and preserves its exact 67-check ledger',()=>{
 const spec=contract.extension.proofs.find(row=>row.kind==='PG_FIELD');
 const old=restorePilotCompletionPreviousProofSpec(spec);
 assert.notEqual(old,spec);
 assert.equal(old.producerSha256,'c3cf9eed8983b9ab43ad9b11cf0f59af206b08ba70f5e6697133bb448b940662');
 assert.equal(spec.producerSha256,hash(read(spec.producer).toString('utf8').replaceAll('\r\n','\n')));
 assert.deepEqual(old.checkNames,spec.checkNames);
 assert.equal(old.checkNames.length,67);
 assert.equal(currentFieldPrivacySpecRevision(spec).currentCheckCount,67);
 for(const mutate of [value=>value.checkNames.reverse(),value=>value.sourceFiles.pop(),value=>{value.producerSha256='f'.repeat(64);}]){
  const forged=structuredClone(spec);mutate(forged);
  assert.equal(restorePilotCompletionPreviousProofSpec(forged),forged);
  assert.throws(()=>currentFieldPrivacySpecRevision(forged));
 }
 old.checkNames.pop();
 assert.equal(restorePilotCompletionPreviousProofSpec(spec).checkNames.length,67);
});

test('attendance supplement requires all four current observations before preserving the historical proof matrix',()=>{
 const spec=contract.extension.proofs.find(row=>row.kind==='PG_FIELD');
 const names=[...read(spec.producer).toString('utf8').matchAll(/\battendanceReviewChecks\.push\('([^']+)'\)/g)].map(match=>match[1]);
 assert.equal(names.length,4);
 const proof={attendanceReviewChecks:names,attendanceReviewCheckCount:4,totalChecks:71,harnessSha256:spec.producerSha256,sourceManifest:[{path:'observed-source',sha256:'a'.repeat(64)}],providerCalls:0};
 const before=JSON.stringify(proof),out=restorePilotCompletionPreviousFieldProof(spec,proof);
 assert.deepEqual(out,{totalChecks:67,harnessSha256:proof.harnessSha256,sourceManifest:proof.sourceManifest,providerCalls:0});
 assert.equal(JSON.stringify(proof),before);
 for(const mutate of [p=>{delete p.attendanceReviewChecks;},p=>{delete p.attendanceReviewCheckCount;},p=>p.attendanceReviewChecks.reverse(),p=>p.attendanceReviewChecks.pop(),p=>p.attendanceReviewChecks.push('foreign'),p=>{p.attendanceReviewCheckCount='4';},p=>{p.totalChecks=67;},p=>{p.totalChecks=72;},p=>{p.attendanceReviewProviderCalls=1;}]){
  const changed=structuredClone(proof);mutate(changed);assert.throws(()=>restorePilotCompletionPreviousFieldProof(spec,changed),rejected);
 }
 assert.throws(()=>restorePilotCompletionPreviousFieldProof(restorePilotCompletionPreviousProofSpec(spec),proof),rejected);
 const foreign=structuredClone(spec);foreign.checkNames[0]='foreign';assert.throws(()=>restorePilotCompletionPreviousFieldProof(foreign,proof),rejected);
});

test('withdrawal native proof retains all 33 previous observations and requires both new PostgreSQL cases',()=>{
 const prior=restorePilotCompletionPreviousContract(contract,read);
 const old=prior.extension.proofs.find(row=>row.kind==='PG_INTAKE'),now=contract.extension.proofs.find(row=>row.kind==='PG_INTAKE');
 assert.equal(old.checkNames.length,33);assert.equal(now.checkNames.length,35);
 assert.deepEqual(now.checkNames.filter(name=>old.checkNames.includes(name)),old.checkNames);
 assert.deepEqual(now.checkNames.filter(name=>!old.checkNames.includes(name)),[
  'real-PG-signed-pending-withdrawal-preserves-original-envelope-replays-once-and-denies-old-and-current-admission-revisions',
  'real-PG-admission-first-CANCELAR-preserves-person-and-reviewed-permissions-without-revocation',
 ]);
});


test('historical source-set projection requires the complete current typed family and returns independent copies',()=>{
 const prior=restorePilotCompletionPreviousContract(contract,read);
 for(const name of ['COMPACT','PG_COMPANY_KYC','PG_PARTICIPANT_KYC_PREANALYSIS']){
  const now=current.sourceFamilies.find(row=>row.family===name)?.currentFiles??contract.extension.proofs.find(row=>row.kind===name)?.sourceFiles;
  const old=prior.planBudgetCurrentRevision.sourceFamilies.find(row=>row.family===name)?.currentFiles??prior.extension.proofs.find(row=>row.kind===name)?.sourceFiles;
  assert.ok(now&&old,name);
  const out=restorePilotCompletionPreviousSourceSet(contract,name,now);
  assert.deepEqual(out,old);assert.notEqual(out,old);assert.notEqual(out,now);
  out.pop();assert.deepEqual(restorePilotCompletionPreviousSourceSet(contract,name,now),old);
  assert.throws(()=>restorePilotCompletionPreviousSourceSet(contract,name,now.slice(1)),rejected);
  assert.throws(()=>restorePilotCompletionPreviousSourceSet(contract,name,[...now,now[0]]),rejected);
  assert.throws(()=>restorePilotCompletionPreviousSourceSet(contract,name,['foreign',...now.slice(1)]),rejected);
  assert.throws(()=>restorePilotCompletionPreviousSourceSet(contract,name,[...now].reverse()),rejected);
 }
 assert.throws(()=>restorePilotCompletionPreviousSourceSet(contract,'FOREIGN',[]),rejected);
});

test('company native additions require exact authenticated metadata and expose only the three new library pins',()=>{
 const expected=['src/lib/consumption-evidence-catalog.mjs','src/lib/consumption-evidence-http.mjs','src/lib/plan-budget-csv-source.mjs'];
 const before=JSON.stringify(contract),rows=pilotCompletionNativeLibrarySources(contract);
 assert.deepEqual(rows.map(row=>row.path),expected);
 for(const row of rows)assert.equal(row.sha256,hash(read(row.path).toString('utf8').replaceAll('\r\n','\n')));
 rows[0].sha256='f'.repeat(64);rows.pop();assert.equal(pilotCompletionNativeLibrarySources(contract).length,3);
 assert.notEqual(pilotCompletionNativeLibrarySources(contract)[0].sha256,'f'.repeat(64));
 for(const mutate of [c=>c.planBudgetCurrentRevision.pilotCompletionAdvance.sourceChanges.pop(),c=>{c.extension.proofs[0].producerSha256='f'.repeat(64);}]){
  const forged=structuredClone(contract);mutate(forged);assert.throws(()=>pilotCompletionNativeLibrarySources(forged),rejected);
 }
 assert.equal(JSON.stringify(contract),before);
});
