import assert from 'node:assert/strict';
import {DOCUMENT_TASK_ASSOCIATION_CURRENT_REVISION as documentRevision,restoreDocumentTaskAssociationPreviousContract} from '../scripts/lib/plan-measurement-document-association-ci-lineage.mjs';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {INTEGRATED_IDENTITY_CURRENT_REVISION,INTEGRATED_IDENTITY_CHECKPOINT_PATH,INTEGRATED_IDENTITY_VALIDATION_PATHS,composeIntegratedIdentityContract,restoreIntegratedIdentityPreviousContract,integratedIdentityCurrentSourcePin,verifyIntegratedIdentityCurrentSources,restoreIntegratedIdentitySourceSet,integratedIdentityProofSourceAdditions,validateIntegratedIdentityWorkspaceContract,validateIntegratedCompanyCurrentNative,validateIntegratedOwnCurrentNative,integratedCompanyCurrentShadowFixture,integratedOwnCurrentShadowFixture} from '../scripts/lib/integrated-identity-current-ci-lineage.mjs';
import {preloadParticipantPreanalysisConsumerSources,participantPreanalysisConsumerValidationFiles} from '../scripts/lib/participant-preanalysis-current-ci-lineage.mjs';

const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),hash=b=>createHash('sha256').update(b).digest('hex');
const contract=()=>JSON.parse(readFileSync(path.join(root,'.github/workspace-acceptance-contract.json')));
const reader=file=>{const target=path.join(root,file);return existsSync(target)&&lstatSync(target).isFile()?readFileSync(target):null;};
const current=()=>{const value=contract();assert.equal(value.integratedIdentityCurrentRevision.status,'REVIEWED_FROZEN_CURRENT_SOURCE');return value;};
const denied=fn=>assert.throws(fn,{code:'INTEGRATED_IDENTITY_CURRENT_CI_LINEAGE_REJECTED'});
const mutate=edit=>{const value=current();edit(value);denied(()=>restoreIntegratedIdentityPreviousContract(value));};

test('integrated identity restores the complete clean AI checkpoint and every historical matrix',()=>{
 const c=current(),previous=restoreIntegratedIdentityPreviousContract(c),checkpoint=JSON.parse(reader(INTEGRATED_IDENTITY_CHECKPOINT_PATH));assert.equal(hash(JSON.stringify(previous,null,2)+'\n'),'3c1a184f2e6839bba6bd7116ccf6c062fbb015500ec4900583dbd15f82fe7270');assert.deepEqual(previous,checkpoint);assert.equal(previous.blocks.length,57);assert.equal(previous.extension.proofs.length,19);assert.equal(previous.artifactPatterns.length,61);assert.deepEqual(previous.kycExpiredCurrentComposition.reviewedSources,checkpoint.kycExpiredCurrentComposition.reviewedSources);{const c=restoreDocumentTaskAssociationPreviousContract(current());assert.deepEqual(composeIntegratedIdentityContract(c.integratedIdentityCurrentRevision),c);assert.equal(hash(JSON.stringify(c,null,2)+'\n'),'10319b1ab8a283b7c89cab96a279e20e25fe4be2736d91caaa915a4e62afa524');}
});
test('integrated identity adds exactly one focused block proof artifact family and original AI19',()=>{
 const c=current(),result=validateIntegratedIdentityWorkspaceContract(c);assert.deepEqual(result,{version:1,commandBlocks:58,typedProofs:20,artifactPatterns:62,aiNativeChecks:19,companyCurrentCases:17,ownCurrentCases:4,checkpointRestored:true});assert.deepEqual(c.integratedIdentityCurrentRevision.validationSources.map(row=>row.path),INTEGRATED_IDENTITY_VALIDATION_PATHS);assert.equal(c.blocks.filter(row=>row.id===64).length,1);assert.equal(c.extension.proofs.filter(row=>row.kind==='UI_FOCUSED_WORKSPACE').length,1);
 const company={currentImageNative:integratedCompanyCurrentShadowFixture(c,reader)},own={currentImageOwnNative:integratedOwnCurrentShadowFixture(c)};assert.equal(validateIntegratedCompanyCurrentNative(company,c,reader).cases,17);assert.equal(validateIntegratedOwnCurrentNative(own,c,reader).cases,4);for(const [proof,validate,key]of [[company,validateIntegratedCompanyCurrentNative,'currentImageNative'],[own,validateIntegratedOwnCurrentNative,'currentImageOwnNative']]){for(const edit of [value=>{value[key].cases.pop();},value=>{value[key].cases.reverse();},value=>{value[key].cases[0].name='foreign';},value=>{value[key].identityCertified=true;},value=>{value[key].realProviderCalls=1;}]){const changed=structuredClone(proof);edit(changed);denied(()=>validate(changed,c,reader));}}
});
test('integrated identity authenticates every current added and validation source with exact checkpoint provenance',()=>{
 const c=current(),result=verifyIntegratedIdentityCurrentSources(c,reader);assert.equal(result.completeCheckpointRestored,true);assert.equal(result.historicalPinsPreserved,true);assert.equal(result.nativeOrBrowserAcceptance,false);
 {const c=restoreDocumentTaskAssociationPreviousContract(current());
 for(const row of [...INTEGRATED_IDENTITY_CURRENT_REVISION.reviewedSourceChanges,...INTEGRATED_IDENTITY_CURRENT_REVISION.validationDeltas])assert.equal(integratedIdentityCurrentSourcePin(c,{path:row.path,sha256:row.previousSha256}),row.currentSha256);
 }
 for(const row of [...INTEGRATED_IDENTITY_CURRENT_REVISION.reviewedSourceChanges,...INTEGRATED_IDENTITY_CURRENT_REVISION.validationDeltas]){const outer=[...documentRevision.reviewedSourceChanges,...documentRevision.validationDeltas].find(ref=>ref.path===row.path);assert.equal(integratedIdentityCurrentSourcePin(c,{path:row.path,sha256:row.previousSha256}),outer?.currentSha256||row.currentSha256);}
 const loaded=Object.create(null),lazy=file=>{const bytes=reader(file);if(bytes)loaded[file]=bytes;return bytes;},files=preloadParticipantPreanalysisConsumerSources({readSource:lazy,readCheckout:reader});assert.deepEqual(files,participantPreanalysisConsumerValidationFiles(c));assert.ok(files.includes('.github/workspace-acceptance-contract.json'));assert.ok(files.every(file=>Buffer.isBuffer(loaded[file])));assert.equal(verifyIntegratedIdentityCurrentSources(c,file=>loaded[file]||null).completeCheckpointRestored,true);assert.throws(()=>preloadParticipantPreanalysisConsumerSources({readSource:()=>null,readCheckout:reader}),{code:'PLAN_MEASUREMENT_CURRENT_CI_LINEAGE_REJECTED'});const leaf=files.find(file=>file!=='.github/workspace-acceptance-contract.json');assert.throws(()=>preloadParticipantPreanalysisConsumerSources({readSource:lazy,readCheckout:file=>file===leaf?Buffer.concat([reader(file),Buffer.from('\n// checkout changed')]):reader(file)}),{code:'PLAN_MEASUREMENT_CURRENT_CI_LINEAGE_REJECTED'});
});
test('integrated identity foreign checkpoint source tree or status cannot replace the reviewed delta',()=>{
 for(const [key,value]of [['referenceHead','f'.repeat(40)],['referenceTree','f'.repeat(40)],['previousContractSha256','f'.repeat(64)],['status','PENDING_INDEPENDENT_SOURCE_FREEZES']])mutate(c=>{c.integratedIdentityCurrentRevision[key]=value;});
});
test('integrated identity omitted changed duplicate or foreign source deltas remain denied',()=>{
 mutate(c=>{c.integratedIdentityCurrentRevision.reviewedSourceChanges.pop();});mutate(c=>{c.integratedIdentityCurrentRevision.validationDeltas.pop();});mutate(c=>{c.integratedIdentityCurrentRevision.addedSources.pop();});mutate(c=>{c.integratedIdentityCurrentRevision.validationSources[0].path='scripts/lib/foreign.mjs';});mutate(c=>{c.integratedIdentityCurrentRevision.validationSources.push(c.integratedIdentityCurrentRevision.validationSources[0]);});
});
test('integrated identity historical source rows and native checks cannot be silently rewritten',()=>{
 mutate(c=>{c.kycExpiredCurrentComposition.reviewedSources[0].sha256='f'.repeat(64);});mutate(c=>{c.participantPreanalysisCurrentRevision.nativeCheckNames.pop();});mutate(c=>{c.participantPreanalysisCurrentRevision.nativeProducerSha256='f'.repeat(64);});mutate(c=>{c.integratedIdentityCurrentRevision.companyCurrentCaseNames.pop();});mutate(c=>{c.integratedIdentityCurrentRevision.ownCurrentCaseNames.pop();});
});
test('integrated identity requires every additive source and reconstructs each exact predecessor set',()=>{
 const c=current();for(const delta of [...c.integratedIdentityCurrentRevision.proofSourceDeltas,...c.integratedIdentityCurrentRevision.consumerSourceDeltas]){const original=delta.id?c.extension.proofs.find(row=>row.id===delta.id).sourceFiles:[...delta.previousFiles,...delta.additions].sort();const restored=restoreIntegratedIdentitySourceSet(delta.family,original,c);assert.equal(restored.length,delta.previousCount);assert.equal(hash(JSON.stringify(restored)),delta.previousPathsSha256);for(const added of delta.additions){denied(()=>restoreIntegratedIdentitySourceSet(delta.family,original.filter(file=>file!==added),c));}denied(()=>restoreIntegratedIdentitySourceSet(delta.family,[...original,'src/lib/foreign-current.mjs'].sort(),c));}
});
test('integrated identity metadata restoration cannot discard an omitted proof delta or unrelated change',()=>{
 mutate(c=>{c.integratedIdentityCurrentRevision.proofSourceDeltas.pop();});mutate(c=>{c.extension.proofs[0].sourceFiles.pop();});mutate(c=>{c.setup.push({name:'foreign',run:'true'});});mutate(c=>{c.foreign=true;});
});
test('integrated identity focused binding cannot be removed duplicated moved or relabeled as historical',()=>{
 mutate(c=>{c.blocks=c.blocks.filter(row=>row.id!==64);});mutate(c=>{c.blocks.push(c.blocks.find(row=>row.id===64));});mutate(c=>{c.extension.proofs.find(row=>row.kind==='UI_FOCUSED_WORKSPACE').kind='UI_IDENTITY_ONLY';});mutate(c=>{c.lanes['workspace-ui'].blocks=c.lanes['workspace-ui'].blocks.filter(id=>id!==64);});mutate(c=>{c.artifactPatterns=c.artifactPatterns.filter(row=>row!=='.vercel/private/focused-workspace-ui-evidence/');});
});
test('integrated identity current producer and scenario additions retain every previous named check',()=>{
 const c=current();for(const row of c.integratedIdentityCurrentRevision.currentProofChanges){assert.deepEqual(row.currentCheckNames.slice(0,row.previousCheckNames.length),row.previousCheckNames);const proof=c.extension.proofs.find(proof=>proof.id===row.id);assert.deepEqual(proof.checkNames,row.currentCheckNames);assert.equal(proof.producerSha256,row.currentProducerSha256);}mutate(c=>{c.integratedIdentityCurrentRevision.currentProofChanges[0].previousCheckNames.pop();});
});
test('integrated identity omitted changed foreign RAW current source or predecessor fixture is rejected',()=>{
 const c=current();for(const row of [...c.integratedIdentityCurrentRevision.reviewedSourceChanges,...c.integratedIdentityCurrentRevision.validationDeltas,...c.integratedIdentityCurrentRevision.addedSources,...c.integratedIdentityCurrentRevision.validationSources]){denied(()=>verifyIntegratedIdentityCurrentSources(c,file=>file===row.path?null:reader(file)));denied(()=>verifyIntegratedIdentityCurrentSources(c,file=>file===row.path?Buffer.from('foreign current source'):reader(file)));}
});
test('integrated identity current source pin requires the exact unchanged predecessor SHA',()=>{
 const c=current();for(const row of [...c.integratedIdentityCurrentRevision.reviewedSourceChanges,...c.integratedIdentityCurrentRevision.validationDeltas])denied(()=>integratedIdentityCurrentSourcePin(c,{path:row.path,sha256:'f'.repeat(64)}));const ref={path:'src/lib/unmodified-external.mjs',sha256:'e'.repeat(64)};assert.equal(integratedIdentityCurrentSourcePin(c,ref),ref.sha256);
});
test('integrated identity proof source additions cannot reinterpret foreign current source sets',()=>{
 const currentContract=current();{const c=restoreDocumentTaskAssociationPreviousContract(currentContract);
 for(const delta of c.integratedIdentityCurrentRevision.proofSourceDeltas){const spec=c.extension.proofs.find(row=>row.id===delta.id);assert.deepEqual(integratedIdentityProofSourceAdditions(spec),delta.additions);const previous=restoreIntegratedIdentitySourceSet(delta.family,spec.sourceFiles,c);assert.deepEqual(integratedIdentityProofSourceAdditions({...spec,sourceFiles:previous}),[]);denied(()=>integratedIdentityProofSourceAdditions({...spec,sourceFiles:[...spec.sourceFiles,'src/lib/foreign.mjs'].sort()}));}
 }
 for(const outer of documentRevision.proofSourceDeltas){const spec=currentContract.extension.proofs.find(row=>row.id===outer.id),inner=INTEGRATED_IDENTITY_CURRENT_REVISION.proofSourceDeltas.find(row=>row.id===outer.id);assert.deepEqual(integratedIdentityProofSourceAdditions(spec),[...(inner?.additions||[]),...outer.additions]);denied(()=>integratedIdentityProofSourceAdditions({...spec,sourceFiles:[...spec.sourceFiles,'src/lib/foreign.mjs'].sort()}));}
});
test('integrated identity validation pin shape and new metadata supersets remain denied',()=>{
 mutate(c=>{c.integratedIdentityCurrentRevision.validationSources[0].trusted=true;});mutate(c=>{c.integratedIdentityCurrentRevision.foreign=true;});mutate(c=>{c.extension.proofs.find(row=>row.kind==='UI_FOCUSED_WORKSPACE').realSessionAccepted=true;});mutate(c=>{c.evidenceProducers.find(row=>row.blockId===64).retained=false;});
});
