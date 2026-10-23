import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import yaml from 'js-yaml';
import {buildWorkflow,currentProducerSourceFiles,equivalent,loadContract,validateContract} from '../.github/scripts/verify-workspace-ci-parallelization.mjs';
import * as budget from '../scripts/lib/plan-budget-current-ci-lineage.mjs';
import {buildCaptureRuntimeWorkflow} from '../scripts/lib/capture-runtime-canonical-collectors.mjs';
import {participantPreanalysisCiSourceClosure} from '../scripts/verify-participant-kyc-preanalysis-ci.mjs';
import {verifyIntegratedIdentityCurrentSources} from '../scripts/lib/integrated-identity-current-ci-lineage.mjs';

const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const contractPath=path.join(root,'.github/workspace-acceptance-contract.json');
const contract=JSON.parse(readFileSync(contractPath));
const sha=value=>createHash('sha256').update(value).digest('hex');
const kinds=['PG_BANK','PG_INTAKE','UI_INTAKE','PG_FIELD','PG_PARTICIPANT_KYC_PREANALYSIS','PG_COMPANY_KYC','UI_FOCUSED_WORKSPACE','UI_FIELD_TASK_PAGINATION','UI_PLAN_BUDGET_SOURCE'];

for(const kind of kinds)test(kind+' current canonical collector derives the complete actual emitter and dependency set',()=>{
 const spec=contract.extension.proofs.find(row=>row.kind===kind);assert.ok(spec,'Current proof exists: '+kind);
 const files=currentProducerSourceFiles(spec,root);
 assert.deepEqual(files,spec.sourceFiles);
 if(kind==='PG_PARTICIPANT_KYC_PREANALYSIS')assert.deepEqual(participantPreanalysisCiSourceClosure(file=>{try{return readFileSync(path.join(root,file));}catch{return null;}}),files,'The real CI producer emits these rows itself');
 assert.equal(new Set(files).size,files.length);
 for(const file of files)assert.ok(readFileSync(path.join(root,file)).length>0);
});

test('a current collector rejects forged proof specs, same-count substitutions and missing new dependencies',()=>{
 const spec=contract.extension.proofs.find(row=>row.kind==='PG_BANK');
 for(const mode of ['same-count-substitution','missing-new','stale-producer']){
  const value=structuredClone(spec);
  if(mode==='same-count-substitution')value.sourceFiles[0]='src/lib/unreviewed-substitution.mjs';
  if(mode==='missing-new')value.sourceFiles=value.sourceFiles.filter(file=>file!=='src/lib/capture-quality-gate.mjs');
  if(mode==='stale-producer')value.producerSha256='f'.repeat(64);
  assert.throws(()=>currentProducerSourceFiles(value,root),error=>error.code==='CAPTURE_QUALITY_COLLECTOR_REJECTED'&&error.reason==='EXACT_CURRENT_PROOF_SPEC',mode);
 }
});

test('the real preanalysis emitter refuses a missing literal dependency instead of accepting a consumer-decorated list',()=>{
 const owner='.github/scripts/verify-workspace-ci-parallelization.mjs';
 assert.throws(()=>participantPreanalysisCiSourceClosure(file=>{
  try{const raw=readFileSync(path.join(root,file));return file===owner?Buffer.from(raw.toString('utf8').replace("'../../scripts/lib/capture-runtime-canonical-collectors.mjs'","'../../scripts/lib/unbound-capture-collector.mjs'")):raw;}catch{return null;}
 }),error=>error.code==='PARTICIPANT_PREANALYSIS_CI_REJECTED');
});

test('the actual integrated source verifier preserves the frozen copier oracle behind authenticated capture sources',()=>{
 const read=file=>{try{return readFileSync(path.join(root,file));}catch{return null;}};
 assert.ok(verifyIntegratedIdentityCurrentSources(contract,read));
 const changed=structuredClone(contract);changed.planBudgetCurrentRevision.references[0].currentSha256='f'.repeat(64);
 assert.throws(()=>validateContract(changed),error=>error.code==='PROOF_BINDING_SOURCE');
 const copier='scripts/lib/plan-document-curve-fixture-copy.mjs';
 assert.throws(()=>verifyIntegratedIdentityCurrentSources(contract,file=>file===copier?Buffer.from('changed actual copier'):read(file)));
});

test('the complete historical workflow and all eight lanes survive only the exact declared quality step',()=>{
 const parent=budget.restoreCaptureRuntimePreviousContract(contract),previous=buildWorkflow(parent),actual=buildWorkflow(contract);
 assert.equal(sha(JSON.stringify(previous)),'5700a2a48386409dff99edf94a7cc896c9d27198d0784fb06b1305df640ca891');
 const additions=budget.captureRuntimeWorkflowAdditions(contract),restored=structuredClone(actual);
 assert.equal(additions.length,1);
 assert.equal(additions[0].step.name,'Image capture quality before private persistence');
 for(const row of [...additions].reverse()){
  assert.deepEqual(restored.jobs[row.lane].steps[row.index],row.step);
  restored.jobs[row.lane].steps.splice(row.index,1);
 }
 assert.deepEqual(restored,previous);
 assert.equal(actual.jobs.workspace.needs.length,8);
 assert.deepEqual(actual.jobs.workspace.needs,previous.jobs.workspace.needs);
 assert.deepEqual(loadContract(contractPath),contract);
 assert.deepEqual(equivalent(yaml.load(readFileSync(path.join(root,'.github/workflows/workspace-acceptance.yml'),'utf8')),contract),{blocks:contract.blocks.length,artifactPatterns:contract.artifactPatterns.length,lanes:8});
 for(const edit of [workflow=>workflow.jobs.contracts.steps.shift(),workflow=>workflow.jobs.workspace.needs.pop()]){
  const changed=structuredClone(previous);edit(changed);
  assert.throws(()=>buildCaptureRuntimeWorkflow(contract,changed),error=>error.code==='CAPTURE_QUALITY_COLLECTOR_REJECTED'&&error.reason==='EXACT_PARENT_WORKFLOW');
 }
});

test('the real preanalysis emitter binds all three facial audit and historical challenge fixtures',()=>{
 const fixtures=["tests/fixtures/meta-kyc-challenge-legacy-v2.mjs","tests/fixtures/participant-facial-audit-memory.mjs","tests/fixtures/participant-facial-chat-audit-memory.mjs"];
 const read=file=>{try{return readFileSync(path.join(root,file));}catch{return null;}};
 const files=participantPreanalysisCiSourceClosure(read);assert.equal(files.length,273);
 for(const missing of fixtures){
  assert.ok(files.includes(missing));
  assert.throws(()=>participantPreanalysisCiSourceClosure(file=>file===missing?null:read(file)),error=>error.code==='PARTICIPANT_PREANALYSIS_CI_REJECTED',missing);
 }
});

test('the current preanalysis emitter binds the exact pagination inventory edge and preserves its prior 270 paths',()=>{
 const owner='scripts/verify-field-task-pagination-ui.mjs',leaf='src/app/(identity)/cuenta/material-inventory-view.mjs',literal="'../src/app/(identity)/cuenta/material-inventory-view.mjs'";
 const read=file=>{try{return readFileSync(path.join(root,file));}catch{return null;}};
 const additions=['scripts/verify-field-task-pagination-ci.mjs',owner,leaf];
 const files=participantPreanalysisCiSourceClosure(read),prior=files.filter(file=>!additions.includes(file));
 assert.equal(files.length,273);for(const file of additions)assert.equal(files.filter(row=>row===file).length,1);
 assert.equal(prior.length,270);assert.equal(sha(JSON.stringify(prior)),'2a09915ece2c8ede847ca9a7f7b9b2e80eeb9c5e4e336e0cbbb21f3395a5dad8');
 const main='.github/scripts/verify-workspace-ci-parallelization.mjs',mainLiteral="'../../scripts/verify-field-task-pagination-ci.mjs'",source=read(owner).toString('utf8'),mainSource=read(main).toString('utf8');assert.equal(source.split(literal).length,2);assert.equal(mainSource.split(mainLiteral).length,2);
 for(const missing of additions)assert.throws(()=>participantPreanalysisCiSourceClosure(file=>file===missing?null:read(file)),error=>error.code==='PARTICIPANT_PREANALYSIS_CI_REJECTED',missing);
 for(const mode of ['substituted-field-literal','substituted-main-literal'])assert.throws(()=>participantPreanalysisCiSourceClosure(file=>{
  if(mode==='substituted-field-literal'&&file===owner)return Buffer.from(source.replace(literal,"'../src/app/(identity)/cuenta/project-preparation-format.mjs'"));
  if(mode==='substituted-main-literal'&&file===main)return Buffer.from(mainSource.replace(mainLiteral,"'../../scripts/verify-focused-workspace-ci.mjs'"));
  return read(file);
 }),error=>error.code==='PARTICIPANT_PREANALYSIS_CI_REJECTED',mode);
});

test('the current COMPANY collector binds the sealed legacy fixture row and its actual import',()=>{
 const spec=contract.extension.proofs.find(row=>row.kind==='PG_COMPANY_KYC'),fixture='tests/fixtures/meta-kyc-challenge-legacy-v2.mjs',files=currentProducerSourceFiles(spec,root);
 assert.equal(files.length,253);assert.ok(files.includes(fixture));assert.deepEqual(files,spec.sourceFiles);
 for(const mode of ['missing-fixture','extra-row']){const changed=structuredClone(spec);if(mode==='missing-fixture')changed.sourceFiles=changed.sourceFiles.filter(file=>file!==fixture);else changed.sourceFiles=[...changed.sourceFiles,'src/lib/unbound-company-source.mjs'].sort();assert.throws(()=>currentProducerSourceFiles(changed,root),error=>error.code==='CAPTURE_QUALITY_COLLECTOR_REJECTED'&&error.reason==='EXACT_CURRENT_PROOF_SPEC',mode);}
 const read=file=>{try{return readFileSync(path.join(root,file));}catch{return null;}},producer=spec.producer,raw=read(producer),from="'../tests/fixtures/meta-kyc-challenge-legacy-v2.mjs'",to="'../tests/fixtures/company-kyc-memory.mjs'";assert.equal(raw.toString('utf8').split(from).length,2);
 assert.throws(()=>budget.verifyCaptureRuntimeCurrentSources(contract,file=>file===producer?Buffer.from(raw.toString('utf8').replace(from,to)):read(file)),error=>error.code==='PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED'&&error.reason==='CURRENT_REFERENCE_'+producer);
 assert.throws(()=>budget.verifyCaptureRuntimeCurrentSources(contract,file=>file===fixture?null:read(file)),error=>error.code==='PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED');
});
