import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parse} from '@babel/parser';
import {HOME_DECISIONS_CURRENT_REVISION as expected,HOME_DECISIONS_CURRENT_SECTION as key,restoreHomeDecisionsPreviousContract,homeDecisionsCurrentSourcePin,homeDecisionsValidationFiles,verifyHomeDecisionsCurrentSources,restoreHomeDecisionsSourceSet,homeDecisionsProofSourceAdditions,homeDecisionsLegacyOperationsAst,normalizeHomeDecisionsFocusedRaw,validateHomeDecisionsNativeProof,validateHomeDecisionsFieldProof,CUSTOMER_PHONE_SELECTION_CURRENT_REVISION as phoneExpected,CUSTOMER_PHONE_SELECTION_CURRENT_SECTION as phoneKey,restoreCustomerPhoneSelectionPreviousContract,customerPhoneSelectionCurrentSourcePin,customerPhoneSelectionPreviousSourcePin,customerPhoneSelectionValidationFiles,verifyCustomerPhoneSelectionCurrentSources,normalizeCustomerPhoneSelectionNativeProof} from '../scripts/lib/home-decisions-current-ci-lineage.mjs';
import {restoreExistingApiPlanPreviousContract,verifyExistingApiPlanCurrentSources} from '../scripts/lib/meta-existing-api-plan-current-ci-lineage.mjs';
import {verifyMaterialReviewCurrentSources} from '../scripts/lib/material-review-current-ci-lineage.mjs';
import {WHATSAPP_FIELD_CONTINUITY_FOCUSED_UI as previousFocused,verifyWhatsappFieldContinuityCurrentSources} from '../scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs';
import {currentProducerSourceFiles} from '../.github/scripts/verify-workspace-ci-parallelization.mjs';
const read=file=>existsSync(file)?readFileSync(file):null;
const current=()=>JSON.parse(read('.github/workspace-acceptance-contract.json'));
const sha=value=>createHash('sha256').update(value).digest('hex');
const serialize=value=>JSON.stringify(value,null,2)+'\n';
const denied=run=>assert.throws(run,{code:'HOME_DECISIONS_CURRENT_CI_LINEAGE_REJECTED'});
const syntax=value=>Array.isArray(value)?value.map(syntax):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>!['start','end','loc','extra','comments','leadingComments','innerComments','trailingComments'].includes(key)).map(([key,child])=>[key,syntax(child)])):value;

test('home decisions restores the complete published2b contract and every inherited layer without mutating input',()=>{
 const contract=current(),before=serialize(contract),previous=restoreHomeDecisionsPreviousContract(contract);
 assert.equal(expected.predecessorCommit,'2b98984628761783ba7bd7e6543dbe1d76c0203c');assert.equal(sha(serialize(previous)),'fe3fbd513518951d4e9625f0c76d89bd5c178919d923d3a385f32ab7c787590e');assert.equal(Object.hasOwn(previous,key),false);assert.equal(serialize(contract),before);
 for(const field of ['blocks','lanes','artifactPatterns','existingApiPlanCurrentRevision','materialReviewCurrentRevision','whatsappFieldContinuityCurrentRevision'])assert.deepEqual(previous[field],contract[field]);
 const previousRecords=structuredClone(contract.evidenceProducers);for(const delta of expected.proofProducerDeltas)previousRecords.find(row=>row.path===delta.path&&row.producer===delta.producer).producerSha256=delta.previousProducerSha256;assert.deepEqual(previous.evidenceProducers,previousRecords);
 assert.equal(sha(serialize(restoreExistingApiPlanPreviousContract(contract))),'8ec3226f985366168e3a6eb873a6f282bfa91778260e15c724ee208814f88b09');
});

test('current bytes authenticate only reviewed sources and every missing foreign validator or source is rejected',()=>{
 const contract=current(),result=verifyHomeDecisionsCurrentSources(contract,read);assert.equal(result.completePreviousContractRestored,true);assert.equal(result.nativeOrBrowserAcceptance,false);
 for(const file of homeDecisionsValidationFiles(contract))for(const substituted of [null,Buffer.from('foreign source bytes')])denied(()=>verifyHomeDecisionsCurrentSources(contract,path=>path===file?substituted:read(path)));
 for(const verify of [verifyExistingApiPlanCurrentSources,verifyMaterialReviewCurrentSources,verifyWhatsappFieldContinuityCurrentSources])assert.equal(verify(contract,read).nativeOrBrowserAcceptance,false);
});

test('exact predecessor current pins advance while foreign aliases cannot be silently resealed',()=>{
 const contract=current();for(const row of [...expected.reviewedSourceChanges,...expected.validationDeltas]){
  for(const pin of [row.previousSha256,row.currentSha256])assert.equal(homeDecisionsCurrentSourcePin(contract,{path:row.path,sha256:pin}),customerPhoneSelectionCurrentSourcePin(contract,{path:row.path,sha256:row.currentSha256}));
  denied(()=>homeDecisionsCurrentSourcePin(contract,{path:row.path,sha256:'f'.repeat(64)}));
 }
});

test('customer phone companion restores exact8599969 without changing historical Home metadata or any source set',()=>{
 const contract=current(),before=serialize(contract),previous=restoreCustomerPhoneSelectionPreviousContract(contract);
 assert.equal(phoneExpected.predecessorCommit,'8599969a1072c9b8e1afac0640df6a69219968b3');assert.equal(sha(serialize(previous)),'d3e0a5af11643ad3b5fb3c3ebb046edfc6f796a0142b23e1b604d0b15c14d5cb');assert.equal(Object.hasOwn(previous,phoneKey),false);assert.equal(serialize(contract),before);
 for(const field of Object.keys(previous))assert.deepEqual(contract[field],previous[field],'Published8599969 field remains byte-equivalent: '+field);
 assert.deepEqual(previous[key],contract[key]);assert.deepEqual(contract[key].reviewedSourceChanges,expected.reviewedSourceChanges);assert.equal(verifyCustomerPhoneSelectionCurrentSources(contract,read).nativeOrBrowserAcceptance,false);
 for(const spec of contract.extension.proofs)assert.deepEqual(currentProducerSourceFiles(spec,process.cwd()),spec.sourceFiles,'No source closure growth: '+spec.id);
});

test('customer phone source pins authenticate only the exact8599969 and reviewed current bytes',()=>{
 const contract=current(),value=contract[phoneKey],refs=[...value.reviewedSourceChanges,...value.validationPredecessors.map(row=>({path:row.path,previousSha256:row.sha256,currentSha256:value.validationSources.find(ref=>ref.path===row.path).sha256}))];
 for(const row of refs){
  for(const pin of [row.previousSha256,row.currentSha256])assert.equal(customerPhoneSelectionCurrentSourcePin(contract,{path:row.path,sha256:pin}),row.currentSha256);
  assert.equal(customerPhoneSelectionPreviousSourcePin(contract,{path:row.path,sha256:row.currentSha256}),row.previousSha256);
  denied(()=>customerPhoneSelectionCurrentSourcePin(contract,{path:row.path,sha256:'f'.repeat(64)}));
 }
 for(const file of customerPhoneSelectionValidationFiles(contract)){
  for(const replacement of [null,Buffer.from('unreviewed source')])denied(()=>verifyCustomerPhoneSelectionCurrentSources(contract,path=>path===file?replacement:read(path)));
 }
 denied(()=>verifyHomeDecisionsCurrentSources(restoreCustomerPhoneSelectionPreviousContract(contract),read));
});

test('customer phone companion rejects omitted duplicated reordered and tampered deltas or validators and modified predecessor fields',()=>{
 for(const edit of [
  c=>c[phoneKey].reviewedSourceChanges.pop(),c=>c[phoneKey].reviewedSourceChanges.push(c[phoneKey].reviewedSourceChanges[0]),c=>c[phoneKey].reviewedSourceChanges.reverse(),c=>{c[phoneKey].reviewedSourceChanges[0].previousSha256='f'.repeat(64);},c=>{c[phoneKey].reviewedSourceChanges[0].currentSha256='f'.repeat(64);},
  c=>c[phoneKey].validationSources.pop(),c=>c[phoneKey].validationSources.push(c[phoneKey].validationSources[0]),c=>c[phoneKey].validationSources.reverse(),c=>{c[phoneKey].validationSources[0].sha256='f'.repeat(64);},c=>{c[phoneKey].validationSources[0].path='scripts/lib/foreign-same-count.mjs';},
  c=>{c[phoneKey].previousContractSha256='f'.repeat(64);},c=>{c[phoneKey].nativeOrBrowserAcceptance=true;},c=>{c[key].validationSources[0].sha256=c[phoneKey].validationSources[0].sha256;},c=>c.blocks[0].step.run+='\ntrue',c=>c.extension.proofs[0].sourceFiles.pop()
 ]){const changed=current();edit(changed);denied(()=>verifyCustomerPhoneSelectionCurrentSources(changed,read));}
 const missing=current();delete missing[phoneKey];denied(()=>verifyHomeDecisionsCurrentSources(missing,read));
});

test('all52 current native controls are required before exact historical41 projection and the raw proof remains untouched',()=>{
 const contract=current(),previous=restoreCustomerPhoneSelectionPreviousContract(contract),old=previous.existingApiPlanCurrentRevision.native.currentCheckNames,checks=[...old,...phoneExpected.native.addedCheckNames],proof={status:'PASS',environment:'local-disposable-postgresql17',checks,realProviderCalls:0,physicalNumberTested:false,productionDataTouched:false},before=serialize(proof);
 assert.equal(old.length,41);assert.equal(phoneExpected.native.addedCheckNames.length,11);assert.equal(checks.length,52);
 assert.deepEqual(normalizeCustomerPhoneSelectionNativeProof(proof,contract,read),{...proof,checks:old});assert.equal(serialize(proof),before);
 const historical={...proof,checks:old};assert.equal(normalizeCustomerPhoneSelectionNativeProof(historical,previous,read),historical);
 for(const patch of [{checks:old},{checks:checks.slice(0,50)},{checks:checks.slice(1)},{checks:checks.slice(0,-1)},{checks:[...checks,checks.at(-1)]},{checks:[...checks.slice(0,-1),'foreign-same-count-control']},{checks:[...checks].reverse()},{realProviderCalls:1},{physicalNumberTested:true},{productionDataTouched:true},{status:'FAILED'},{environment:'production'}])denied(()=>normalizeCustomerPhoneSelectionNativeProof({...proof,...patch},contract,read));
});

test('the exact operations read projection preserves every inherited authority HTTP guard and full read query',()=>{
 const file='src/lib/operations-status.mjs',source=read(file).toString('utf8'),project=value=>sha(JSON.stringify(syntax(homeDecisionsLegacyOperationsAst(parse(value,{sourceType:'module'})))));
 assert.equal(project(source),expected.operationsProjection.previousAstSha256);
 for(const [before,after] of [['requireWorkspaceIdentity(session)','void session'],['workspace.integrationProject(session,context,false','workspace.integrationProject(session,context,true'],["request.method!=='GET'","request.method!=='POST'"],["canApproveProgress(member.role)","true"],["params.getAll(k).length!==1","false"]]){assert.ok(source.includes(before));assert.notEqual(project(source.replace(before,after)),expected.operationsProjection.previousAstSha256);}
});

test('actual producer import graphs add only the authenticated helper and preserve historical proof counts',()=>{
 const contract=current(),previous=restoreHomeDecisionsPreviousContract(contract);assert.equal(expected.proofSourceDeltas.length,3);
 for(const spec of contract.extension.proofs){
  assert.deepEqual(currentProducerSourceFiles(spec,process.cwd()),spec.sourceFiles,'Actual current import closure '+spec.id);const old=previous.extension.proofs.find(row=>row.id===spec.id),producer=expected.proofProducerDeltas.find(row=>row.id===spec.id);assert.deepEqual(spec.checkNames,old.checkNames);assert.equal(spec.producerSha256,producer?.currentProducerSha256??old.producerSha256);assert.equal(old.producerSha256,producer?.previousProducerSha256??spec.producerSha256);assert.equal(spec.producerSha256,sha(read(spec.producer).toString('utf8').replaceAll('\r\n','\n')),'Every official producer pin binds the actual LF source: '+spec.id);
  const delta=expected.proofSourceDeltas.find(row=>row.id===spec.id);if(!delta){assert.deepEqual(spec.sourceFiles,old.sourceFiles);continue;}
  assert.equal(delta.currentCount,delta.previousCount+1);assert.deepEqual(delta.additions,['scripts/lib/home-decisions-current-ci-lineage.mjs']);assert.deepEqual(restoreHomeDecisionsSourceSet(delta.family,spec.sourceFiles,contract),old.sourceFiles);assert.deepEqual(homeDecisionsProofSourceAdditions(spec),delta.additions);assert.deepEqual(homeDecisionsProofSourceAdditions(old),[]);
 }
});

test('the sole current focused producer and evidence record advance together and reject omissions tampering duplicates or old-as-current pins',()=>{
 const contract=current(),previous=restoreHomeDecisionsPreviousContract(contract);assert.equal(expected.proofProducerDeltas.length,1);const delta=expected.proofProducerDeltas[0];
 assert.equal(delta.id,'focused-workspace-ui');assert.equal(delta.producer,'scripts/verify-focused-workspace-ci.mjs');assert.equal(delta.previousProducerSha256,'a4eb59cb781eeb9578e46ffcdec21833cce1ba79eb9f99e3543fda799dfc62f4');assert.equal(delta.currentProducerSha256,'48650c362bfc0b9d8fd49976fbc4ae1a124776167c60ba08f60d2b163ee94e24');
 const proof=value=>value.extension.proofs.find(row=>row.id===delta.id),record=value=>value.evidenceProducers.find(row=>row.path===delta.path&&row.producer===delta.producer);
 assert.equal(proof(contract).producerSha256,delta.currentProducerSha256);assert.equal(record(contract).producerSha256,delta.currentProducerSha256);assert.equal(proof(previous).producerSha256,delta.previousProducerSha256);assert.equal(record(previous).producerSha256,delta.previousProducerSha256);
 for(const edit of [value=>{value[key].proofProducerDeltas=[];},value=>{value.extension.proofs=value.extension.proofs.filter(row=>row.id!==delta.id);},value=>{value.extension.proofs.push(structuredClone(proof(value)));},value=>{value.evidenceProducers=value.evidenceProducers.filter(row=>row!==record(value));},value=>{value.evidenceProducers.push(structuredClone(record(value)));},value=>{proof(value).producerSha256=delta.previousProducerSha256;},value=>{record(value).producerSha256=delta.previousProducerSha256;},value=>{proof(value).producerSha256=record(value).producerSha256=delta.previousProducerSha256;},value=>{proof(value).producerSha256='f'.repeat(64);},value=>{record(value).producerSha256='f'.repeat(64);},value=>{proof(value).producer='scripts/foreign.mjs';},value=>{record(value).producer='scripts/foreign.mjs';}]){const changed=structuredClone(contract);edit(changed);denied(()=>restoreHomeDecisionsPreviousContract(changed));}
});

test('source sets reject omissions duplicates old-as-current reverse order and foreign same-count replacements',()=>{
 const contract=current(),previous=restoreHomeDecisionsPreviousContract(contract);
 for(const delta of expected.proofSourceDeltas){
  const spec=contract.extension.proofs.find(row=>row.id===delta.id),files=spec.sourceFiles,old=previous.extension.proofs.find(row=>row.id===delta.id);
  for(const changed of [files.slice(1),[...files,files[0]].sort(),[...files].reverse(),files.map((file,index)=>index===0?'scripts/lib/foreign-same-count.mjs':file).sort(),old.sourceFiles])denied(()=>restoreHomeDecisionsSourceSet(delta.family,changed,contract));
  denied(()=>homeDecisionsProofSourceAdditions({...spec,sourceFiles:files.map((file,index)=>index===0?'scripts/lib/foreign-same-count.mjs':file).sort()}));
 }
});

// These unit shadows validate declarations in memory. They never emit or retag
// browser/PostgreSQL evidence and do not execute a provider or business request.
function focusedShadow(){
 const value=expected.focusedUi,requests=Array(value.currentRequestCount),evidence=new Map(),directory='synthetic-home-evidence';
 for(const [index,request] of previousFocused.requestMatrix.entries())requests[value.previousRequestIndices[index]]=structuredClone(request);
 for(const row of value.addedRequestFacts)requests[row.index]=structuredClone(row.request);
 let operation=0;for(const row of requests)if(row.mode==='wizard'&&row.method==='POST'){Object.assign(row,{operationId:'00000000-0000-4000-8000-'+String(++operation).padStart(12,'0'),recoveryReferenceSha256:String(operation+4).repeat(64),syntheticImageSha256:['1'.repeat(64),'2'.repeat(64),'3'.repeat(64)],explicitFinalStep:true,actualRecoveryJournalReferencePreserved:true});}
 const screenshots=value.screenshotNames.map((path,index)=>{const bytes=Buffer.from('synthetic nonpersonal unit image '+index),width=Number(/-(320|390|768|1440)\.png$/.exec(path)[1]);evidence.set(directory+'/'+path,bytes);return {path,sha256:sha(bytes),geometry:{width,height:1000,scrollWidth:width,identityActionTop:null}};});
 const raw={checks:[...value.previousCheckNames.map(name=>name.startsWith('hidden-panel-')?name+':8':name),...value.addedCheckNames],totalCheckCount:77,expectedTotalCheckCount:77,homeDecisionsWidths:[...value.widths],homeDecisionsCheckLedger:[...value.addedCheckNames],requests,screenshots};
 return {raw,evidence,normalize:()=>normalizeHomeDecisionsFocusedRaw(raw,{contract:current(),readSource:read,readEvidence:path=>evidence.get(path)||null,directory})};
}

test('all77 current observations exact135 new GET facts and four measured screenshots project to the unchanged59 ledger',()=>{
 const f=focusedShadow(),before=serialize(f.raw),previous=f.normalize();assert.equal(expected.focusedUi.previousRequestCount,406);assert.equal(expected.focusedUi.addedRequestFacts.length,135);assert.ok(expected.focusedUi.addedRequestFacts.every(row=>row.request.method==='GET'));
 assert.equal(previous.checks.length,59);assert.equal(previous.totalCheckCount,59);assert.equal(previous.expectedTotalCheckCount,59);assert.equal(previous.requests.length,406);assert.deepEqual(previous.screenshots.map(row=>row.path),previousFocused.screenshotNames);assert.equal(Object.hasOwn(previous,'homeDecisionsWidths'),false);assert.equal(serialize(f.raw),before);
});

test('current home focused observations cannot be omitted duplicated reordered retagged or replaced by historical-only checks',()=>{
 for(const mutate of [r=>{r.checks.pop();},r=>{r.checks[59]=r.checks[60];},r=>{[r.checks[59],r.checks[60]]=[r.checks[60],r.checks[59]];},r=>{r.totalCheckCount=59;},r=>{r.expectedTotalCheckCount=59;},r=>{r.homeDecisionsCheckLedger.pop();},r=>{r.homeDecisionsWidths=[320,390,1440];},r=>{r.checks=r.checks.slice(0,59);r.totalCheckCount=59;r.expectedTotalCheckCount=59;},r=>{delete r.homeDecisionsCheckLedger;}]){const f=focusedShadow();mutate(f.raw);denied(f.normalize);}
});

test('new requests screenshots viewport facts and actual evidence bytes are all mandatory before historical projection',()=>{
 const index=expected.focusedUi.addedRequestFacts[0].index;
 for(const mutate of [r=>{r.requests.splice(index,1);},r=>{r.requests.push(structuredClone(r.requests[index]));},r=>{r.requests[index].method='POST';},r=>{r.requests[index].projectId='foreign-project';},r=>{r.requests[index].unexpected=true;},r=>{r.requests[index]=null;},r=>{r.screenshots.pop();},r=>{r.screenshots.at(-1).path=r.screenshots.at(-2).path;},r=>{r.screenshots.at(-1).geometry.scrollWidth=1442;},r=>{r.screenshots.at(-1).sha256='0'.repeat(64);}]){const f=focusedShadow();mutate(f.raw);denied(f.normalize);}
 const f=focusedShadow();f.evidence.clear();denied(f.normalize);
});

test('the native24 observation requires the unchanged23 queue ledger exact two-query decisions and current source bytes',()=>{
 const value=expected.native,contract=current(),proof={status:'PASS',environment:'disposable-localhost-canonical-material-inventory',checks:value.currentCheckNames,checkCount:24,providerCalls:0,productionDataTouched:false,humanAccepted:false,newTables:false,participantKycFixture:{identityCertified:false,providerCalls:0},materialReviewQueue:structuredClone(value.previousMaterialReviewQueue),homeDecisions:structuredClone(value.homeDecisions),harnessSha256:sha(read(value.producer)),sourceManifest:value.sourceFiles.map(path=>({path,sha256:sha(read(path))}))};
 assert.equal(value.previousCheckNames.length,23);assert.equal(value.addedCheckNames.length,1);assert.deepEqual(value.currentCheckNames,[...value.previousCheckNames,...value.addedCheckNames]);assert.equal(value.sourceFiles.length,125);assert.equal(value.previousMaterialReviewQueue.readOnlyTransactions,24);assert.equal(validateHomeDecisionsNativeProof(proof,contract,read).nativeOrBrowserAcceptance,false);
 for(const edit of [p=>{p.checks=p.checks.slice(0,23);p.checkCount=23;},p=>{p.checks=[...p.checks,p.checks[0]];},p=>{p.materialReviewQueue.readOnlyTransactions=23;},p=>{p.homeDecisions.sqlQueriesPerRead=3;},p=>{p.homeDecisions.canonicalReadOnly=false;},p=>{p.homeDecisions.authorizationGranted=true;},p=>{p.providerCalls=1;},p=>{p.humanAccepted=true;},p=>{p.participantKycFixture.identityCertified=true;},p=>{p.sourceManifest.pop();},p=>{p.sourceManifest[0].sha256='0'.repeat(64);}]){const changed=structuredClone(proof);edit(changed);denied(()=>validateHomeDecisionsNativeProof(changed,contract,read));}
});

test('the full field producer preserves its entire historical ledger and adds exactly36 without accepting focused72 as FULL',()=>{
 const value=expected.fieldUi,contract=current(),proof={status:'PASS',environment:'actual-component-with-intercepted-synthetic-api',fullSuite:true,focusedScenario:null,widths:[320,390,768,1280],checks:value.currentCheckNames,providerCalls:0,metaMessagesSent:0,physicalGeolocationAccepted:false,cameraQrAccepted:false,physicalCameraAccepted:false,physicalMicrophoneAccepted:false,productionDataWritten:false,errors:[],harnessSha256:sha(read(value.producer)),sourceManifest:value.sourceFiles.map(path=>({path,sha256:sha(read(path))}))};
 assert.equal(value.addedCheckNames.length,36);assert.deepEqual(value.currentCheckNames.filter(name=>!value.addedCheckNames.includes(name)),value.previousCheckNames);assert.equal(validateHomeDecisionsFieldProof(proof,contract,read).nativeOrBrowserAcceptance,false);
 for(const edit of [p=>{p.fullSuite=false;p.focusedScenario='home-progress-pending';p.checks=value.addedCheckNames;},p=>{p.checks=value.currentCheckNames.slice(0,72);},p=>{p.checks=value.previousCheckNames;},p=>{p.checks=[...value.currentCheckNames,value.currentCheckNames[0]];},p=>{p.providerCalls=1;},p=>{p.physicalCameraAccepted=true;},p=>{p.humanAccepted=true;},p=>{p.sourceManifest.pop();},p=>{p.sourceManifest[0].sha256='0'.repeat(64);}]){const changed=structuredClone(proof);edit(changed);denied(()=>validateHomeDecisionsFieldProof(changed,contract,read));}
});

test('review declarations historical contracts immutable source references and proof arrays cannot be caller-resealed',()=>{
 assert.throws(()=>expected.proofSourceDeltas[0].additions.push('scripts/lib/foreign.mjs'),TypeError);
 for(const change of [c=>c[key].reviewedSourceChanges.pop(),c=>c[key].validationDeltas.pop(),c=>c[key].nativeOrBrowserAcceptance=true,c=>c[key].previousContractSha256='0'.repeat(64),c=>c[key].unreviewed=true,c=>c.blocks[0].step.run+='\ntrue',c=>c.extension.proofs[0].sourceFiles.pop(),c=>c[key].validationSources[0].path='scripts/foreign.mjs',c=>c[key].focusedUi.currentRequestCount--]){const contract=current();change(contract);denied(()=>restoreHomeDecisionsPreviousContract(contract));}
 const previous=restoreHomeDecisionsPreviousContract(current());assert.equal(verifyHomeDecisionsCurrentSources(previous,read),null);assert.deepEqual(homeDecisionsValidationFiles(previous),[]);
});
