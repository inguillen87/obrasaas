import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {restoreHomeDecisionsPreviousContract,homeDecisionsCurrentSourcePin} from '../scripts/lib/home-decisions-current-ci-lineage.mjs';
import {EXISTING_API_PLAN_CURRENT_REVISION as expected,EXISTING_API_PLAN_CURRENT_SECTION as key,restoreExistingApiPlanPreviousContract,existingApiPlanCurrentSourcePin,existingApiPlanValidationFiles,verifyExistingApiPlanCurrentSources,restoreExistingApiPlanSourceSet,existingApiPlanProofSourceAdditions,existingApiPlanCurrentNativeSourceFiles,validateExistingApiPlanNativeProof} from '../scripts/lib/meta-existing-api-plan-current-ci-lineage.mjs';
import {verifyMaterialReviewCurrentSources,restoreMaterialReviewPreviousContract} from '../scripts/lib/material-review-current-ci-lineage.mjs';
import {whatsappFieldCompanyNativeSourceFiles,verifyWhatsappFieldContinuityCurrentSources} from '../scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs';
import {currentProducerSourceFiles} from '../.github/scripts/verify-workspace-ci-parallelization.mjs';
const read=file=>existsSync(file)?readFileSync(file):null;
const current=()=>JSON.parse(read('.github/workspace-acceptance-contract.json'));
const sha=value=>createHash('sha256').update(value).digest('hex');
const serialize=value=>JSON.stringify(value,null,2)+'\n';
const denied=run=>assert.throws(run,{code:'EXISTING_API_PLAN_CURRENT_CI_LINEAGE_REJECTED'});

test('API plan revision restores the whole published material contract and every inherited proof',()=>{
 const contract=current(),before=serialize(contract),publishedHomePredecessor=restoreHomeDecisionsPreviousContract(contract),previous=restoreExistingApiPlanPreviousContract(contract);
 assert.equal(sha(serialize(previous)),expected.previousContractSha256);assert.equal(expected.predecessorCommit,'5d0c4303cbced786f2ec8a0a10edaa72b3aff02d');assert.equal(Object.hasOwn(previous,key),false);assert.equal(serialize(contract),before);
 assert.deepEqual(previous.materialReviewCurrentRevision,contract.materialReviewCurrentRevision);
 for(const name of ['blocks','lanes','artifactPatterns','evidenceProducers','whatsappFieldContinuityCurrentRevision'])assert.deepEqual(previous[name],publishedHomePredecessor[name]);
 const focusedProducer=value=>value.evidenceProducers.find(row=>row.producer==='scripts/verify-focused-workspace-ci.mjs');assert.equal(focusedProducer(contract).producerSha256,'48650c362bfc0b9d8fd49976fbc4ae1a124776167c60ba08f60d2b163ee94e24');assert.equal(focusedProducer(publishedHomePredecessor).producerSha256,'a4eb59cb781eeb9578e46ffcdec21833cce1ba79eb9f99e3543fda799dfc62f4');
 assert.equal(sha(serialize(restoreMaterialReviewPreviousContract(contract))),'1bb5e262dac06377590ea983a9c800163726cb6510ae0fbbbdca17309253c6af');
});

test('exact current source bytes authenticate the new layer without claiming provider or human acceptance',()=>{
 const contract=current(),result=verifyExistingApiPlanCurrentSources(contract,read);assert.equal(result.completePreviousContractRestored,true);assert.equal(result.nativeOrBrowserAcceptance,false);
 for(const file of existingApiPlanValidationFiles(contract)){denied(()=>verifyExistingApiPlanCurrentSources(contract,path=>path===file?null:read(path)));denied(()=>verifyExistingApiPlanCurrentSources(contract,path=>path===file?Buffer.from('foreign bytes'):read(path)));}
 assert.equal(verifyMaterialReviewCurrentSources(contract,read).nativeOrBrowserAcceptance,false);assert.equal(verifyWhatsappFieldContinuityCurrentSources(contract,read).nativeOrBrowserAcceptance,false);
});

test('only exact authenticated predecessor and current pins advance',()=>{
 const contract=current();for(const row of [...expected.reviewedSourceChanges,...expected.validationDeltas]){
  for(const pin of [row.previousSha256,row.currentSha256])assert.equal(existingApiPlanCurrentSourcePin(contract,{path:row.path,sha256:pin}),homeDecisionsCurrentSourcePin(contract,{path:row.path,sha256:row.currentSha256}));
  denied(()=>existingApiPlanCurrentSourcePin(contract,{path:row.path,sha256:'0'.repeat(64)}));
 }
});

test('actual producer closures grow only by their exact reviewed dependencies',()=>{
 const full=current(),contract=restoreHomeDecisionsPreviousContract(full),previous=restoreExistingApiPlanPreviousContract(contract);
 for(const spec of contract.extension.proofs){
  const actual=full.extension.proofs.find(row=>row.id===spec.id);assert.deepEqual(currentProducerSourceFiles(actual,process.cwd()),actual.sourceFiles,'Actual current source closure '+spec.id);
  const delta=expected.proofSourceDeltas.find(row=>row.id===spec.id),prior=previous.extension.proofs.find(row=>row.id===spec.id);assert.deepEqual(spec.checkNames,prior.checkNames);assert.equal(spec.producerSha256,prior.producerSha256);
  if(!delta){assert.deepEqual(spec.sourceFiles,prior.sourceFiles);continue;}
  assert.deepEqual(restoreExistingApiPlanSourceSet(delta.family,spec.sourceFiles,contract),prior.sourceFiles);assert.deepEqual(existingApiPlanProofSourceAdditions(spec),delta.additions);assert.deepEqual(existingApiPlanProofSourceAdditions(prior),[]);
 }
});

test('source-set negatives reject omission duplicate old-set-as-current reverse order and same-count foreign paths',()=>{
 const contract=current(),previous=restoreExistingApiPlanPreviousContract(contract);
 for(const delta of expected.proofSourceDeltas){
  const spec=contract.extension.proofs.find(row=>row.id===delta.id),prior=previous.extension.proofs.find(row=>row.id===delta.id),files=spec.sourceFiles;
  for(const changed of [files.slice(1),[...files,files[0]].sort(),[...files].reverse(),files.map((file,index)=>index===0?'src/lib/foreign-same-count.mjs':file).sort(),prior.sourceFiles])denied(()=>restoreExistingApiPlanSourceSet(delta.family,changed,contract));
  denied(()=>existingApiPlanProofSourceAdditions({...spec,sourceFiles:files.map((file,index)=>index===0?'src/lib/foreign-same-count.mjs':file).sort()}));
 }
});

test('COMPANY gains only the new server module while every historical native matrix remains intact',()=>{
 const contract=current(),families=contract.whatsappFieldContinuityCurrentRevision.native.families;
 const company=existingApiPlanCurrentNativeSourceFiles(contract,'COMPANY',families.COMPANY.sourceFiles);assert.equal(company.length,236);assert.deepEqual(company.filter(file=>!families.COMPANY.sourceFiles.includes(file)),['src/lib/meta-existing-api-plan.mjs']);
 assert.deepEqual(existingApiPlanCurrentNativeSourceFiles(contract,'OWN',families.OWN.sourceFiles),families.OWN.sourceFiles);assert.equal(families.OWN.sourceFiles.length,139);
 const scan=directory=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?scan(directory+'/'+entry.name):[directory+'/'+entry.name]);assert.deepEqual(whatsappFieldCompanyNativeSourceFiles(read,scan('src/lib').sort()),company);
 for(const changed of [families.COMPANY.sourceFiles.slice(1),[...families.COMPANY.sourceFiles,families.COMPANY.sourceFiles[0]],company])denied(()=>existingApiPlanCurrentNativeSourceFiles(contract,'COMPANY',changed));
});

test('the local native proof requires all 38 historical and three additive observations without acceptance claims',()=>{
 const contract=current(),proof={status:'PASS',environment:'local-disposable-postgresql17',checks:expected.native.currentCheckNames,realProviderCalls:0,physicalNumberTested:false,productionDataTouched:false};
 assert.equal(expected.native.previousCheckNames.length,38);assert.equal(expected.native.addedCheckNames.length,3);assert.deepEqual(expected.native.currentCheckNames.filter(name=>!expected.native.addedCheckNames.includes(name)),expected.native.previousCheckNames);assert.equal(expected.native.currentCheckNames.length,41);
 assert.deepEqual(validateExistingApiPlanNativeProof(proof,contract,read),{version:1,status:'PASS',historicalChecksPreserved:38,addedChecks:3,nativeOrBrowserAcceptance:false});
 for(const patch of [{checks:proof.checks.slice(1)},{checks:[...proof.checks,proof.checks[0]]},{realProviderCalls:1},{physicalNumberTested:true},{productionDataTouched:true}])denied(()=>validateExistingApiPlanNativeProof({...proof,...patch},contract,read));
});

test('contract declarations and historical fields cannot be altered or resealed by callers',()=>{
 assert.throws(()=>expected.proofSourceDeltas[0].additions.push('src/lib/foreign.mjs'),TypeError);assert.throws(()=>{expected.reviewedSourceChanges[0].currentSha256='0'.repeat(64);},TypeError);
 for(const change of [c=>c[key].reviewedSourceChanges.pop(),c=>c[key].addedSources.pop(),c=>c[key].nativeOrBrowserAcceptance=true,c=>c[key].previousContractSha256='0'.repeat(64),c=>c[key].unreviewed=true,c=>c.blocks[0].step.run+='\ntrue',c=>c.extension.proofs[0].sourceFiles.pop(),c=>c[key].validationSources[0].path='scripts/foreign.mjs']){const contract=current();change(contract);denied(()=>restoreExistingApiPlanPreviousContract(contract));}
});
