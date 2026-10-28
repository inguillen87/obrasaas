import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
import {PLAN_PARTIDA_PREVIEW_CURRENT_REVISION as expected,PLAN_PARTIDA_PREVIEW_CURRENT_SECTION as key,restorePlanPartidaPreviewPreviousContract,planPartidaPreviewCurrentSourcePin,verifyPlanPartidaPreviewCurrentSources,verifyPlanPartidaPreviewActualClosure,verifyPlanPartidaPreviewPng,validatePlanPartidaPreviewUiSupplement} from '../scripts/lib/plan-partida-preview-current-ci-lineage.mjs';
import {WEEKLY_CYP_CURRENT_REVISION,weeklyCypImportUiShadowFixture,validateWeeklyCypImportUiProofBytes,validatePlanPartidaPreviewImportUiProofBytes} from '../scripts/lib/home-decisions-current-ci-lineage.mjs';
import {validatePlanPartidaPreviewRetainedScreenshotBindings} from '../.github/scripts/verify-workspace-ci-parallelization.mjs';
import {restorePilotCompletionPreviousSourceSet,PLAN_BUDGET_CURRENT_REVISION,PLAN_BUDGET_CURRENT_SECTION,planBudgetCurrentSourcePin,planBudgetCurrentBrowserBinding,verifyPlanBudgetCurrentSources,verifyPlanBudgetActualClosure,restorePlanBudgetPreviousContract,restoreOwnRuntimeDiagnosticPreviousContract} from '../scripts/lib/plan-budget-current-ci-lineage.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const read=file=>Buffer.from(readFileSync(file,'utf8').replaceAll('\r\n','\n'));
const current=()=>JSON.parse(read('.github/workspace-acceptance-contract.json'));
const serialize=value=>JSON.stringify(value,null,2)+'\n';
const denied=run=>assert.throws(run,error=>['PLAN_PARTIDA_PREVIEW_CURRENT_CI_LINEAGE_REJECTED','PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED'].includes(error.code));
const currentPin=(contract,row)=>planBudgetCurrentSourcePin(contract,{path:row.path,sha256:row.currentSha256??row.sha256});
const currentFamilies=contract=>expected.sourceFamilies.map(row=>Object.hasOwn(contract,PLAN_BUDGET_CURRENT_SECTION)?PLAN_BUDGET_CURRENT_REVISION.sourceFamilies.find(current=>current.family===row.family):row);
const changedPaths=contract=>new Set([...expected.references,...(Object.hasOwn(contract,PLAN_BUDGET_CURRENT_SECTION)?PLAN_BUDGET_CURRENT_REVISION.references:[])].map(row=>row.path));
function historical(file){const bytes=read(file);if(file!==WEEKLY_CYP_CURRENT_REVISION.browser.producer)return bytes;assert.equal(sha(bytes),planBudgetCurrentBrowserBinding(current(),expected.browser).producerLfSha256);const old=read('tests/fixtures/plan-partida-preview-weekly-164-producer.txt');assert.equal(sha(old),WEEKLY_CYP_CURRENT_REVISION.browser.producerLfSha256);return old;}
function legacy(){const head='a'.repeat(40),tree='b'.repeat(40),fixture=weeklyCypImportUiShadowFixture(historical,head,tree);return {head,tree,...fixture};}

test('partida preview restores the entire exact3cc contract without mutating the current contract',()=>{
 const contract=current(),before=serialize(contract),previous=restorePlanPartidaPreviewPreviousContract(contract);assert.equal(serialize(contract),before);assert.equal(sha(serialize(previous)),'e8067f73d1e1a48ace92af3bfc34e5b775e16c49d3833df43bb03510a59bcf34');assert.equal(Object.hasOwn(previous,key),false);assert.equal(expected.finalAstDerived,true);assert.equal(expected.nativeOrBrowserAcceptance,false);
});
test('partida preview authenticates all current source bytes including the explicit declaration',()=>{
 const contract=current();assert.equal(verifyPlanPartidaPreviewCurrentSources(contract,read).nativeOrBrowserAcceptance,false);for(const row of expected.references)assert.equal(sha(read(row.path)),currentPin(contract,row));
});
test('compiled partida authority remains isolated from nested exported declaration mutation',()=>{
 const contract=current(),row=expected.references[0],original=row.currentSha256,pin=currentPin(contract,row),foreign=original==='f'.repeat(64)?'e'.repeat(64):'f'.repeat(64);verifyPlanPartidaPreviewCurrentSources(contract,read);
 try{row.currentSha256=foreign;assert.equal(expected.references[0].currentSha256,foreign);const forged=current();forged[key].references[0].currentSha256=foreign;denied(()=>planPartidaPreviewCurrentSourcePin(forged,{path:row.path,sha256:foreign}));assert.equal(planPartidaPreviewCurrentSourcePin(contract,{path:row.path,sha256:original}),pin);assert.equal(verifyPlanPartidaPreviewCurrentSources(contract,read).nativeOrBrowserAcceptance,false);}
 finally{row.currentSha256=original;}
});
test('compiled partida authority never memoizes a mutable contract after a successful validation',()=>{
 const contract=current();verifyPlanPartidaPreviewCurrentSources(contract,read);assert.equal(Object.isFrozen(contract),false);assert.equal(Object.isFrozen(contract[key].references[0]),false);contract[key].references[0].currentSha256='f'.repeat(64);denied(()=>verifyPlanPartidaPreviewCurrentSources(contract,read));
 const historical=current();verifyPlanPartidaPreviewCurrentSources(historical,read);historical.blocks[0].step.run+='\ntrue';denied(()=>restorePlanPartidaPreviewPreviousContract(historical));
});
test('compiled partida authority rereads changed bytes from the same reader after a successful validation',()=>{
 const contract=current(),target=expected.references[0].path;let changed=false,reads=0;const reader=file=>{if(file===target){reads++;return changed?Buffer.concat([read(file),Buffer.from('\n// changed after PASS\n')]):read(file);}return read(file);};verifyPlanPartidaPreviewCurrentSources(contract,reader);const priorReads=reads;changed=true;denied(()=>verifyPlanPartidaPreviewCurrentSources(contract,reader));assert.ok(reads>priorReads);
});
test('compiled partida authority still authenticates unchanged family bytes after a successful validation',()=>{
 const contract=current(),family=currentFamilies(contract)[0],closure={files:[...family.currentFiles],externalImports:[...family.externalImports]},changedSources=changedPaths(contract),target=family.currentManifest.find(row=>row.sha256!=='REVIEWED_DECLARATION_TRUST_ANCHOR'&&!changedSources.has(row.path));assert.ok(target);let changed=false,reads=0;const reader=file=>{if(file===target.path){reads++;return changed?Buffer.concat([read(file),Buffer.from('\n// family source changed after PASS\n')]):read(file);}return read(file);};verifyPlanPartidaPreviewActualClosure(contract,family.family,closure,reader);const priorReads=reads;changed=true;denied(()=>verifyPlanPartidaPreviewActualClosure(contract,family.family,closure,reader));assert.ok(reads>priorReads);
});
test('partida preview rejects declaration co tamper and historical contract mutation',()=>{
 for(const change of [c=>{c[key].previousContractSha256='f'.repeat(64);},c=>{c[key].references[0].currentSha256='f'.repeat(64);},c=>{c.blocks[0].step.run+='\ntrue';},c=>c.evidenceProducers.pop()]){const contract=current();change(contract);denied(()=>verifyPlanPartidaPreviewCurrentSources(contract,read));}
});
test('partida preview rejects missing or modified current bytes even when the contract is unchanged',()=>{
 const contract=current();for(const row of expected.references){denied(()=>verifyPlanPartidaPreviewCurrentSources(contract,file=>file===row.path?null:read(file)));denied(()=>verifyPlanPartidaPreviewCurrentSources(contract,file=>file===row.path?Buffer.concat([read(file),Buffer.from('\n// changed\n')]):read(file)));}
});
test('partida preview source pins admit only their exact previous and current SHA',()=>{
 const contract=current();for(const row of expected.references){const pin=currentPin(contract,row);if(row.previousSha256)assert.equal(planPartidaPreviewCurrentSourcePin(contract,{path:row.path,sha256:row.previousSha256}),pin);assert.equal(planPartidaPreviewCurrentSourcePin(contract,{path:row.path,sha256:row.currentSha256}),pin);assert.equal(planPartidaPreviewCurrentSourcePin(contract,{path:row.path,sha256:pin}),pin);denied(()=>planPartidaPreviewCurrentSourcePin(contract,{path:row.path,sha256:'f'.repeat(64)}));}
});
test('partida preview rejects omitted or reordered typed additions without changing historical ledgers',()=>{
 for(const row of expected.sourceSetDeltas.filter(row=>row.contractPointer)){const contract=current(),index=Number(row.contractPointer.split('/')[3]);contract.extension.proofs[index].sourceFiles.pop();denied(()=>restorePlanPartidaPreviewPreviousContract(contract));const again=current();again.extension.proofs[index].sourceFiles.reverse();denied(()=>restorePlanPartidaPreviewPreviousContract(again));}
});
test('partida preview verifies family contents as well as paths and rejects an unchanged source tamper',()=>{
 const contract=current(),changedSources=changedPaths(contract);for(const family of currentFamilies(contract)){const closure={files:family.currentFiles,externalImports:family.externalImports},previous=expected.sourceFamilies.find(row=>row.family===family.family);assert.equal(verifyPlanPartidaPreviewActualClosure(contract,family.family,closure,read).sourceCount,previous.currentFiles.length);const row=family.currentManifest.find(row=>row.sha256!=='REVIEWED_DECLARATION_TRUST_ANCHOR'&&!changedSources.has(row.path));assert.ok(row,'Each family must exercise an unchanged source outside both reviewed change lists');denied(()=>verifyPlanPartidaPreviewActualClosure(contract,family.family,closure,file=>file===row.path?Buffer.concat([read(file),Buffer.from('\n')]):read(file)));}
});
test('partida preview rejects a same count foreign AST source and an external import mismatch',()=>{
 const contract=current(),family=currentFamilies(contract)[0],files=[...family.currentFiles];files[0]='src/lib/foreign-preview-same-count.mjs';files.sort();denied(()=>verifyPlanPartidaPreviewActualClosure(contract,family.family,{files,externalImports:family.externalImports},read));denied(()=>verifyPlanPartidaPreviewActualClosure(contract,family.family,{files:family.currentFiles,externalImports:[...family.externalImports,'foreign-package'].sort()},read));
});
test('the historical164 decoder rejects the actual180 producer rather than adopting its hash',()=>{
 const {head,tree,proof,evidence}=legacy();assert.equal(proof.totalCheckCount,164);assert.throws(()=>validateWeeklyCypImportUiProofBytes(Buffer.from(JSON.stringify(proof)),read,{expectedHead:head,expectedTree:tree,readEvidence:file=>evidence.get(file)}),{code:'WEEKLY_CYP_UI_PROOF_REJECTED',reason:'PRODUCER'});proof.totalCheckCount=180;proof.harnessSha256=planBudgetCurrentBrowserBinding(current(),expected.browser).producerLfSha256;assert.throws(()=>validateWeeklyCypImportUiProofBytes(Buffer.from(JSON.stringify(proof)),read,{expectedHead:head,expectedTree:tree,readEvidence:file=>evidence.get(file)}),{code:'WEEKLY_CYP_UI_PROOF_REJECTED',reason:'PRODUCER'});
});
test('the current180 decoder rejects a historical164 harness and never treats it as current acceptance',()=>{
 const {head,tree,proof,evidence}=legacy();assert.throws(()=>validatePlanPartidaPreviewImportUiProofBytes(Buffer.from(JSON.stringify(proof)),read,{expectedHead:head,expectedTree:tree,expectedRoot:process.cwd(),readEvidence:file=>evidence.get(file)}),{code:'WEEKLY_CYP_UI_PROOF_REJECTED',reason:'PRODUCER'});
});
test('the current180 decoder rejects local overlay provenance before accepting browser facts',()=>{
 const {head,tree,proof,evidence}=legacy();proof.sourceState='LOCAL_SOURCE_OVERLAY';proof.trackedClean=false;assert.throws(()=>validatePlanPartidaPreviewImportUiProofBytes(Buffer.from(JSON.stringify(proof)),read,{expectedHead:head,expectedTree:tree,expectedRoot:process.cwd(),readEvidence:file=>evidence.get(file)}),{code:'WEEKLY_CYP_UI_PROOF_REJECTED',reason:'SOURCE_IDENTITY'});
});
test('partida table retention requires all four new captures in addition to all four historical captures',()=>{
 const all=[...WEEKLY_CYP_CURRENT_REVISION.browser.retainedScreenshots,...expected.browser.retainedTableScreenshots].map(row=>({path:row.path,sha256:'a'.repeat(64),bytes:4096}));validatePlanPartidaPreviewRetainedScreenshotBindings(all,all);for(const row of expected.browser.retainedTableScreenshots)assert.throws(()=>validatePlanPartidaPreviewRetainedScreenshotBindings(all.filter(file=>file.path!==row.path),all),{code:'PROOF_PLAN_PARTIDA_UI_SCREENSHOT_BINDING'});
});
test('partida table PNG validation decodes a synthetic RGB pixel and rejects truncated CRC or trailing bytes',()=>{
 const crc=bytes=>{let value=0xffffffff;for(const byte of bytes){value^=byte;for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0);}return(value^0xffffffff)>>>0;},chunk=(name,body)=>{const type=Buffer.from(name),head=Buffer.alloc(4),tail=Buffer.alloc(4);head.writeUInt32BE(body.length);tail.writeUInt32BE(crc(Buffer.concat([type,body])));return Buffer.concat([head,type,body,tail]);},header=Buffer.alloc(13);header.writeUInt32BE(1,0);header.writeUInt32BE(1,4);header[8]=8;header[9]=2;const png=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.from([0,255,0,0]))),chunk('IEND',Buffer.alloc(0))]);assert.equal(verifyPlanPartidaPreviewPng(png,1,1).sha256,sha(png));const wrongCrc=Buffer.from(png);wrongCrc[32]^=1;for(const bytes of [png.subarray(0,-1),wrongCrc,Buffer.concat([png,Buffer.from([0])])])assert.throws(()=>verifyPlanPartidaPreviewPng(bytes,1,1),{code:'PLAN_PARTIDA_PREVIEW_UI_PROOF_REJECTED'});
});
// These guard fixtures intentionally stop at the following matrix check. They do not claim a full180 PASS.
function rawHarnessFixture(crlf=false){
 const binding=planBudgetCurrentBrowserBinding(current(),expected.browser),raw=new Map(binding.harnessFiles.map(file=>[file,crlf?Buffer.from(read(file).toString('utf8').replaceAll('\n','\r\n')):read(file)]));
 const reader=file=>raw.get(file)??read(file),proof={fullSuite:true,focusedScenario:null,qaScope:'FULL_ORIGINAL180_ADAPTED_TO_REVIEWED_COMPACT_CONTROLS',totalCheckCount:180,partidaPreviewHarnessManifest:binding.harnessFiles.map(path=>({path,sha256:sha(raw.get(path))})),sourcePreviewChecks:[]};
 return {proof,reader,raw};
}
test('current180 harness evidence checks exact LF bytes before the preview matrix',()=>{
 const {proof,reader}=rawHarnessFixture();assert.throws(()=>validatePlanPartidaPreviewUiSupplement(proof,reader),{code:'PLAN_PARTIDA_PREVIEW_UI_PROOF_REJECTED',reason:'SOURCE_PREVIEW_MATRIX'});
});
test('current180 harness evidence checks exact CRLF bytes before the preview matrix',()=>{
 const {proof,reader}=rawHarnessFixture(true);assert.throws(()=>validatePlanPartidaPreviewUiSupplement(proof,reader),{code:'PLAN_PARTIDA_PREVIEW_UI_PROOF_REJECTED',reason:'SOURCE_PREVIEW_MATRIX'});
});
test('current180 harness evidence rejects a canonical LF digest for actual CRLF bytes',()=>{
 const {proof,reader}=rawHarnessFixture(true);proof.partidaPreviewHarnessManifest[0].sha256=sha(read(proof.partidaPreviewHarnessManifest[0].path));assert.throws(()=>validatePlanPartidaPreviewUiSupplement(proof,reader),{code:'PLAN_PARTIDA_PREVIEW_UI_PROOF_REJECTED',reason:'HARNESS_BYTES'});
});
test('current180 harness evidence cannot authorize changed source by replacing its raw digest',()=>{
 const {proof,reader,raw}=rawHarnessFixture(true),target=proof.partidaPreviewHarnessManifest[0];raw.set(target.path,Buffer.concat([raw.get(target.path),Buffer.from('\r\n// unreviewed helper change\r\n')]));target.sha256=sha(raw.get(target.path));denied(()=>validatePlanPartidaPreviewUiSupplement(proof,reader));
});


test('budget consumption media UI admits only the exact reviewed closure and preserves all inherited deltas',()=>{
 const contract=current(),value=contract[PLAN_BUDGET_CURRENT_SECTION],delta=value.sourceSetDeltas.find(row=>row.family==='CONSUMPTION_FEEDBACK_UI'),family=value.sourceFamilies.find(row=>row.family==='CONSUMPTION_FEEDBACK_UI'),before=serialize(contract);
 assert.deepEqual(delta,{"family":"CONSUMPTION_FEEDBACK_UI","contractPointer":null,"previousCount":26,"previousPathsSha256":"710e01893f5a62e3889bdaddca949989edac48b312c75ea419ea822b744c864a","currentCount":28,"currentPathsSha256":"ac29e18d380c5706e620702b48fd9510f5d358bc857a5cb4a08d0c49561de16e","additions":["src/app/(identity)/cuenta/field-media-preview.js","src/app/(identity)/cuenta/field-operations-panel.module.css"]});
 assert.equal(sha(JSON.stringify(value.sourceSetDeltas.filter(row=>row.family!=='CONSUMPTION_FEEDBACK_UI'))),'380e99f8cf321760f4b64c8e52810d4ceb9e0890d8059dce1ca549a568b56cbd');
 assert.equal(verifyPlanBudgetCurrentSources(contract,read).nativeOrBrowserAcceptance,false);
 const ownBase=restoreOwnRuntimeDiagnosticPreviousContract(contract,read),beforeOwnFamily=ownBase[PLAN_BUDGET_CURRENT_SECTION].sourceFamilies.find(row=>row.family===family.family);assert.equal(beforeOwnFamily.currentFiles.length,28);assert.equal(sha(JSON.stringify(beforeOwnFamily.currentFiles)),delta.currentPathsSha256);const pilotPreviousFiles=restorePilotCompletionPreviousSourceSet(contract,family.family,family.currentFiles);assert.deepEqual(pilotPreviousFiles,[...beforeOwnFamily.currentFiles,'src/app/(identity)/cuenta/field-execution-mandate-panel.js','src/app/(identity)/cuenta/field-execution-mandate-panel.module.css','src/app/(identity)/cuenta/field-execution-view.mjs','src/lib/procurement-quantity.js','src/lib/progress-measurement-quantity.js','src/lib/task-progress-measurement.js'].sort());assert.equal(verifyPlanBudgetActualClosure(contract,family.family,{files:family.currentFiles,externalImports:family.externalImports},read).sourceCount,family.currentFiles.length);
 assert.equal(sha(serialize(restorePlanBudgetPreviousContract(contract))),'8b19235b22aa3c208098283537511fe1c816f7ff86404790a98999f0e818f839');assert.equal(serialize(contract),before);
 const rejectBudget=run=>assert.throws(run,{code:'PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED'});
 for(const change of [v=>{v.sourceSetDeltas=v.sourceSetDeltas.filter(row=>row.family!=='CONSUMPTION_FEEDBACK_UI');},v=>v.sourceSetDeltas.push({...structuredClone(delta),family:'FOREIGN_UI'}),v=>v.sourceSetDeltas.reverse(),v=>{v.sourceSetDeltas.find(row=>row.family==='CONSUMPTION_FEEDBACK_UI').additions.reverse();},v=>{v.sourceSetDeltas.find(row=>row.family==='CONSUMPTION_FEEDBACK_UI').additions[0]='src/lib/foreign-consumption-ui.mjs';}]){
  const forged=structuredClone(contract);change(forged[PLAN_BUDGET_CURRENT_SECTION]);rejectBudget(()=>verifyPlanBudgetCurrentSources(forged,read));
 }
 const omitted=family.currentFiles.filter(file=>file!==delta.additions[0]);rejectBudget(()=>verifyPlanBudgetActualClosure(contract,family.family,{files:omitted,externalImports:family.externalImports},read));
 const extra=[...family.currentFiles,'src/lib/foreign-consumption-ui.mjs'].sort();rejectBudget(()=>verifyPlanBudgetActualClosure(contract,family.family,{files:extra,externalImports:family.externalImports},read));
 rejectBudget(()=>verifyPlanBudgetActualClosure(contract,family.family,{files:[...family.currentFiles].reverse(),externalImports:family.externalImports},read));
 const foreign=[...family.currentFiles];foreign[foreign.indexOf(delta.additions[0])]='src/lib/foreign-consumption-ui.mjs';foreign.sort();rejectBudget(()=>verifyPlanBudgetActualClosure(contract,family.family,{files:foreign,externalImports:family.externalImports},read));
 for(const file of delta.additions)rejectBudget(()=>verifyPlanBudgetActualClosure(contract,family.family,{files:family.currentFiles,externalImports:family.externalImports},target=>target===file?null:read(target)));
});
