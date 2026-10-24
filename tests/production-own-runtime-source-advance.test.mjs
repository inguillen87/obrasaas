import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {focusedWorkspaceCiLocalImports} from '../scripts/verify-focused-workspace-ci.mjs';
import {fieldTaskPaginationCiLocalImports} from '../scripts/verify-field-task-pagination-ci.mjs';
import {worksiteLiveHoursCurrentSourcePin,worksiteLiveHoursPreviousSourcePin} from '../scripts/lib/worksite-live-hours-current-ci-lineage.mjs';
import {planPartidaPreviewCurrentSourcePin,planPartidaPreviewPreviousSourcePin} from '../scripts/lib/plan-partida-preview-current-ci-lineage.mjs';
import {verifyPlanBudgetCurrentSources,verifyPlanBudgetActualClosure,restorePlanBudgetPreviousContract,planBudgetCurrentSourcePin,planBudgetPreviousSourcePin,restorePlanBudgetSourceSet,planBudgetProofSourceAdditions} from '../scripts/lib/plan-budget-current-ci-lineage.mjs';

const baseHash='75140c878ebd4792bf59da6aa4dbc0f2db082963c8518acf867cffc7f78f5ac0',reviewedHash='f0c0c1e40171f3ed6d2af16bed2504eaf640ce9dff9995b33bd4c76d90b664da',parentHash='8b19235b22aa3c208098283537511fe1c816f7ff86404790a98999f0e818f839';
const read=file=>readFileSync(new URL('../'+file,import.meta.url)),hash=value=>createHash('sha256').update(value).digest('hex'),contract=JSON.parse(read('.github/workspace-acceptance-contract.json')),section=contract.planBudgetCurrentRevision,advance=section.ownRuntimeDiagnosticAdvance,clone=structuredClone;
const budgetRejected=error=>error?.code==='PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED';
function oppositeRaw(bytes){const text=bytes.toString(),normalized=text.replaceAll('\r\n','\n'),other=Buffer.from(text.includes('\r\n')?normalized:normalized.replaceAll('\n','\r\n'));assert.equal(other.equals(bytes),false);assert.equal(other.toString().replaceAll('\r\n','\n'),normalized);return other;}
function replacePointer(value,pointer,expected,next){const keys=pointer.slice(1).split('/');let at=value;for(const key of keys.slice(0,-1))at=at[key];assert.deepEqual(at[keys.at(-1)],expected);at[keys.at(-1)]=clone(next);}
function baseline(){const value=clone(contract);delete value.planBudgetCurrentRevision.ownRuntimeDiagnosticAdvance;for(const p of advance.metadataInverse.toReversed())replacePointer(value,p.pointer,p.after,p.before);return value;}
function previousBytes(file){if(file==='scripts/lib/plan-budget-current-ci-reviewed.mjs')return Buffer.from('// Exact budget-source CI declaration; compiler fills immutable reviewed source bindings.\nexport const PLAN_BUDGET_CURRENT_REVISION=Object.freeze('+JSON.stringify(baseline().planBudgetCurrentRevision,null,2)+');\n');const source=advance.sourceChanges.find(row=>row.path===file);if(!source)return read(file);let text=read(file).toString().replaceAll('\r\n','\n');for(const h of source.inverseHunks.toReversed()){assert.equal(text.slice(h.currentOffsetCharacters,h.currentOffsetCharacters+h.currentText.length),h.currentText);text=text.slice(0,h.currentOffsetCharacters)+h.previousText+text.slice(h.currentOffsetCharacters+h.currentText.length);}return source.previousSha256===null?null:Buffer.from(text);}

test('public current verifier authenticates physical source advance and restores both exact historical contracts',()=>{
 assert.equal(advance.sourceChanges.length,19);assert.deepEqual(advance.retainedDependencies.map(row=>({path:row.path,sha256:row.sha256,bytes:row.bytes})),[{"path":"src/app/(identity)/cuenta/kyc-camera-session.mjs","sha256":"e84404979093aaad5179cf47433b3930ddc71e7677fe36db6018fcd49bf8e5c4","bytes":4136},{"path":"src/app/(identity)/cuenta/kyc-photo-preparation.js","sha256":"d88c55b9fb97b6b1abb5ecb02cf66b9d8e016821525f1b6a3cc2a381e641c4e5","bytes":12504},{"path":"src/app/(identity)/cuenta/participant-kyc-capture.js","sha256":"556109c32d2f85be4b043513362d682ed7e14811a21a6f08200ac65c53af5d48","bytes":4864},{"path":"src/app/(identity)/cuenta/participant-panel.js","sha256":"1ec30c252d7f0fa8d65905f66eeca76da1644778b9ad710da5487ab667759c82","bytes":106608},{"path":"src/app/(identity)/cuenta/participant-panel.module.css","sha256":"31ef143f21af5f6ed0aba4f11bf1cf79549ae97c462ed0bef2daaf3e67635250","bytes":6728},{"path":"src/app/(identity)/cuenta/workspace-client.js","sha256":"f9acac2e8589afce076c51e07ef2bd4c3a67360faa9970b2cbbd447502c98bc0","bytes":75429}]);const result=verifyPlanBudgetCurrentSources(contract,read);assert.equal(result.completePreviousContractRestored,true);assert.equal(result.previousContractSha256,parentHash);
 const prior=baseline();assert.equal(hash(JSON.stringify(prior,null,2)+'\n'),baseHash);assert.equal(hash(previousBytes('scripts/lib/plan-budget-current-ci-reviewed.mjs')),reviewedHash);assert.equal(hash(JSON.stringify(restorePlanBudgetPreviousContract(contract),null,2)+'\n'),parentHash);
 assert.deepEqual(verifyPlanBudgetCurrentSources(prior,previousBytes),{completePreviousContractRestored:true,previousContractSha256:parentHash,referenceCount:85,nativeOrBrowserAcceptance:false});
});
test('all16 declared family DTOs validate positive physical sources before adversarial source checks',()=>{
 // Declared DTOs, not independent AST membership evidence. The separate22-source audit supplies that.
 assert.equal(section.sourceFamilies.length,16);for(const family of section.sourceFamilies){const result=verifyPlanBudgetActualClosure(contract,family.family,{files:clone(family.currentFiles),externalImports:clone(family.externalImports)},read);assert.equal(result.family,family.family);assert.equal(result.sourceCount,family.currentFiles.length);assert.equal(result.sourcePathsSha256,hash(JSON.stringify(family.currentFiles)));}
});
test('public pin aliases preserve b6 to102 lineage and bind only the declared new endpoint',()=>{
 const file='src/lib/meta-customer-provider.mjs',old=section.references.find(row=>row.path===file),now=advance.sourceChanges.find(row=>row.path===file);assert.equal(old.previousSha256,'b6cc572fb68ab4cb653ccee30cea754a6273b5631d13e61dd2c2f65535aa287f');assert.equal(old.currentSha256,'102ae45ad7d0a1054d2c65cdbfa3a6a96accfcd982bebce8d6c32c7bf24b21a2');assert.equal(now.previousSha256,old.currentSha256);
 for(const sha256 of [old.previousSha256,old.currentSha256,now.currentSha256])assert.equal(planBudgetCurrentSourcePin(contract,{path:file,sha256}),now.currentSha256);
 assert.equal(planBudgetPreviousSourcePin(contract,{path:file,sha256:now.currentSha256}),old.previousSha256);
 for(const fn of [planBudgetCurrentSourcePin,planBudgetPreviousSourcePin])assert.throws(()=>fn(contract,{path:file,sha256:'f'.repeat(64)}),budgetRejected);
 for(const changed of advance.sourceChanges.filter(s=>s.status==='MODIFIED'))assert.throws(()=>planBudgetCurrentSourcePin(contract,{path:changed.path,sha256:'f'.repeat(64)}),budgetRejected);
});
test('physical source omission corruption and final-read mutation fail through the real public verifier',()=>{
 for(const {path:file} of advance.sourceChanges){
  assert.throws(()=>verifyPlanBudgetCurrentSources(contract,p=>p===file?null:read(p)),budgetRejected);
  assert.throws(()=>verifyPlanBudgetCurrentSources(contract,p=>p===file?Buffer.concat([read(p),Buffer.from('\n// altered physical bytes\n')]):read(p)),budgetRejected);
 }
 const file='tests/production-own-runtime-source-advance.test.mjs';let reads=0;assert.throws(()=>verifyPlanBudgetCurrentSources(contract,p=>p===file&&++reads>1?oppositeRaw(read(p)):read(p)),error=>budgetRejected(error)&&error.reason==='OWN_SOURCE_CHANGED_DURING_CALL');assert.ok(reads>=2);
});
test('physical companion mismatch is rejected independently of the caller declaration',()=>{
 const file='scripts/lib/plan-budget-current-ci-reviewed.mjs';assert.throws(()=>verifyPlanBudgetCurrentSources(contract,p=>p===file?Buffer.concat([read(p),Buffer.from('\n')]):read(p)),budgetRejected);
});
test('closure verifier keeps its RAW fence and caller mutation denial on declared shadow closure input',()=>{
 // This DTO exercises the public validator; independent actual AST closure
 // collection is an explicitly separate post-apply22-producer check.
 const f=section.sourceFamilies[0],closure={files:clone(f.currentFiles),externalImports:clone(f.externalImports)},file='tests/production-own-runtime-source-advance.test.mjs';let reads=0;
 assert.throws(()=>verifyPlanBudgetActualClosure(contract,f.family,closure,p=>p===file&&++reads>1?oppositeRaw(read(p)):read(p)),error=>budgetRejected(error)&&error.reason==='OWN_SOURCE_CHANGED_DURING_CALL');
 const changed=clone(contract);let mutated=false,finalReads=0;assert.throws(()=>verifyPlanBudgetCurrentSources(changed,p=>{if(p===file){finalReads++;if(!mutated){mutated=true;changed.sourceCommit='f'.repeat(40);}}return read(p);}),error=>budgetRejected(error)&&error.reason==='OWN_CALLER_METADATA_CHANGED');assert.ok(finalReads>=2);
});
test('omitted extra source advances and inverse-delta changes cannot become caller authority',()=>{
 for(const edit of [a=>a.sourceChanges.pop(),a=>a.sourceChanges.push(clone(a.sourceChanges[0])),a=>a.metadataInverse.pop(),a=>a.metadataInverse.push(clone(a.metadataInverse[0])),a=>a.sourceChanges[0].inverseHunks[0].previousText+='foreign']){const changed=clone(contract);edit(changed.planBudgetCurrentRevision.ownRuntimeDiagnosticAdvance);assert.throws(()=>verifyPlanBudgetCurrentSources(changed,read),budgetRejected);}
});
test('only the reviewed view and retained camera additions restore the unchanged older source-set ledger',()=>{
 const prior=baseline();assert.equal(hash(JSON.stringify(prior,null,2)+'\n'),baseHash);assert.equal(hash(JSON.stringify(prior.planBudgetCurrentRevision.sourceSetDeltas.filter(r=>r.family!=='CONSUMPTION_FEEDBACK_UI'))),'380e99f8cf321760f4b64c8e52810d4ceb9e0890d8059dce1ca549a568b56cbd');
 for(const [index,additions]of [[3,['src/app/(identity)/cuenta/kyc-camera-session.mjs']],[13,['src/app/(identity)/cuenta/kyc-camera-session.mjs','src/app/(identity)/cuenta/own-company-runtime-diagnostic-view.mjs']],[18,['src/app/(identity)/cuenta/kyc-camera-session.mjs']],[19,['src/app/(identity)/cuenta/kyc-camera-session.mjs','src/app/(identity)/cuenta/own-company-runtime-diagnostic-view.mjs']]]){const proof=contract.extension.proofs[index],old=prior.extension.proofs[index],delta=prior.planBudgetCurrentRevision.sourceSetDeltas.find(r=>r.family===proof.kind),historical=old.sourceFiles.filter(file=>!delta.additions.includes(file));assert.equal(hash(JSON.stringify(historical)),delta.previousPathsSha256);assert.deepEqual(proof.sourceFiles,[...old.sourceFiles,...additions].sort());assert.deepEqual(planBudgetProofSourceAdditions(proof),[...delta.additions,...additions].sort());assert.deepEqual(restorePlanBudgetSourceSet(contract,proof.kind,proof.sourceFiles),historical);for(const files of [proof.sourceFiles.filter(f=>f!==additions[0]),[...proof.sourceFiles,'src/foreign.mjs'].sort()]){const changed=clone(contract);changed.extension.proofs[index].sourceFiles=files;assert.throws(()=>restorePlanBudgetPreviousContract(changed),budgetRejected);}}
 for(const index of [0,4]){const current=section.sourceFamilies[index],old=prior.planBudgetCurrentRevision.sourceFamilies[index],delta=prior.planBudgetCurrentRevision.sourceSetDeltas.find(r=>r.family===current.family);assert.equal(hash(JSON.stringify(old.previousFiles)),delta.previousPathsSha256);assert.deepEqual(restorePlanBudgetSourceSet(contract,current.family,current.currentFiles),old.previousFiles);}
});
test('dependency hash changes cannot bypass the exact0707 and8b19 inverses',()=>{
 const current=advance.sourceChanges.find(row=>row.path==='package-lock.json');assert.equal(contract.packageLockSha256,current.currentSha256);assert.equal(baseline().packageLockSha256,current.previousSha256);
 const changed=clone(contract);changed.packageLockSha256='f'.repeat(64);assert.throws(()=>restorePlanBudgetPreviousContract(changed),budgetRejected);
});

test('the unchanged camera dependency has an exact independent pin and before-final RAW fence',()=>{
 const {path:file,sha256}=advance.retainedDependencies.find(row=>row.path.endsWith('/kyc-camera-session.mjs'));assert.equal(advance.sourceChanges.some(row=>row.path===file),false);assert.equal(hash(read(file).toString().replaceAll('\r\n','\n')),sha256);assert.equal(planBudgetCurrentSourcePin(contract,{path:file,sha256}),sha256);assert.throws(()=>planBudgetCurrentSourcePin(contract,{path:file,sha256:'f'.repeat(64)}),budgetRejected);
 for(const {path:retainedFile}of advance.retainedDependencies){for(const fn of [planBudgetCurrentSourcePin,planBudgetPreviousSourcePin])assert.throws(()=>fn(contract,{path:retainedFile,sha256:'f'.repeat(64)}),budgetRejected);for(const reader of [p=>p===retainedFile?null:read(p),p=>p===retainedFile?Buffer.concat([read(p),Buffer.from('\n// foreign\n')]):read(p)])assert.throws(()=>verifyPlanBudgetCurrentSources(contract,reader),budgetRejected);}
 let reads=0;assert.throws(()=>verifyPlanBudgetCurrentSources(contract,p=>p===file&&++reads>1?oppositeRaw(read(p)):read(p)),error=>budgetRejected(error)&&error.reason==='OWN_SOURCE_CHANGED_DURING_CALL');assert.ok(reads>=2);
 for(const edit of [a=>a.retainedDependencies.pop(),a=>a.retainedDependencies.push(clone(a.retainedDependencies[0])),a=>a.retainedDependencies[0].sha256='f'.repeat(64)]){const changed=clone(contract);edit(changed.planBudgetCurrentRevision.ownRuntimeDiagnosticAdvance);assert.throws(()=>verifyPlanBudgetCurrentSources(changed,read),budgetRejected);}
});
test('retained workspace metadata aliases compose through real Partida and Worksite owners',()=>{
 const path='src/app/(identity)/cuenta/workspace-client.js',earlier='e53ad474a3677243fbcaff6ce526c0983514d42e78c6daf60e73ba06d6f63bec',previous='2fe5a56a7caf7d46f11e4292d2e145e3e72072198a09f9951ace42c2613e8db9',current='f9acac2e8589afce076c51e07ef2bd4c3a67360faa9970b2cbbd447502c98bc0';
 for(const sha256 of [earlier,previous,current])for(const fn of [planBudgetCurrentSourcePin,planPartidaPreviewCurrentSourcePin,worksiteLiveHoursCurrentSourcePin])assert.equal(fn(contract,{path,sha256}),current);
 assert.equal(planBudgetPreviousSourcePin(contract,{path,sha256:current}),previous);assert.equal(planPartidaPreviewPreviousSourcePin(contract,{path,sha256:current}),previous);assert.equal(worksiteLiveHoursPreviousSourcePin(contract,{path,sha256:current}),earlier);
 const retained=advance.retainedDependencies.find(row=>row.path.endsWith('/kyc-camera-session.mjs'));assert.equal(planBudgetPreviousSourcePin(contract,{path:retained.path,sha256:retained.sha256}),retained.sha256);
});
test('both real controlled SWC import guards bind the corrected physical compiler lock through Budget',()=>{
 for(const [fn,file,kind]of [[focusedWorkspaceCiLocalImports,'tests/production-company-bootstrap-receipt.test.mjs','FOCUSED_WORKSPACE_CI_REJECTED'],[fieldTaskPaginationCiLocalImports,'tests/production-worksite-task-selector.test.mjs','FIELD_TASK_PAGINATION_CI_REJECTED']]){
  const legacyLock=previousBytes('package-lock.json'),component='src/app/(identity)/cuenta/'+(file.includes('bootstrap')?'company-bootstrap-panel.js':'worksite-task-selector.js');assert.ok(fn(read(file),file,p=>p==='package-lock.json'?legacyLock:p===component?read(p):null).includes('../'+component));const strict=p=>{if(p==='package-lock.json')return legacyLock;if(p===component)return read(p);throw new Error('Historical reader does not support '+p);};assert.ok(fn(read(file),file,strict).includes('../'+component));for(const metadata of [Buffer.from('{'),Buffer.from('null'),Buffer.from('[]'),'non-buffer'])assert.throws(()=>fn(read(file),file,p=>p==='.github/workspace-acceptance-contract.json'?metadata:p==='package-lock.json'?legacyLock:p===component?read(p):null),error=>error.code===kind);assert.throws(()=>fn(read(file),file,p=>p==='package-lock.json'?legacyLock:(()=>{try{return read(p);}catch{return null;}})()),error=>error.code===kind);
  const actual=fn(read(file),file,p=>{try{return read(p);}catch{return null;}});assert.ok(actual.includes('../'+(file.includes('bootstrap')?'src/app/(identity)/cuenta/company-bootstrap-panel.js':'src/app/(identity)/cuenta/worksite-task-selector.js')));
  assert.throws(()=>fn(read(file),file,p=>p==='package-lock.json'?Buffer.concat([read(p),Buffer.from('\n')]):(()=>{try{return read(p);}catch{return null;}})()),error=>error.code===kind);
  const shared=Buffer.from(read('.github/workspace-acceptance-contract.json'));let changedBuffer=false;assert.throws(()=>fn(read(file),file,p=>{if(p==='.github/workspace-acceptance-contract.json')return shared;if(p==='package-lock.json'&&!changedBuffer){changedBuffer=true;shared[0]=shared[0]===123?91:123;}try{return read(p);}catch{return null;}}),error=>error.code===kind);assert.equal(changedBuffer,true);
  const fake=clone(contract);fake.planBudgetCurrentRevision.ownRuntimeDiagnosticAdvance.sourceChanges.find(row=>row.path==='package-lock.json').currentSha256='f'.repeat(64);assert.throws(()=>fn(read(file),file,p=>p==='.github/workspace-acceptance-contract.json'?Buffer.from(JSON.stringify(fake)):(()=>{try{return read(p);}catch{return null;}})()),error=>error.code===kind);
 }
});
