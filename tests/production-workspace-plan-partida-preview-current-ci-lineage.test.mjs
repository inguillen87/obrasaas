import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
import {PLAN_PARTIDA_PREVIEW_CURRENT_REVISION as expected,PLAN_PARTIDA_PREVIEW_CURRENT_SECTION as key,restorePlanPartidaPreviewPreviousContract,planPartidaPreviewCurrentSourcePin,verifyPlanPartidaPreviewCurrentSources,verifyPlanPartidaPreviewActualClosure,verifyPlanPartidaPreviewPng} from '../scripts/lib/plan-partida-preview-current-ci-lineage.mjs';
import {WEEKLY_CYP_CURRENT_REVISION,weeklyCypImportUiShadowFixture,validateWeeklyCypImportUiProofBytes,validatePlanPartidaPreviewImportUiProofBytes} from '../scripts/lib/home-decisions-current-ci-lineage.mjs';
import {validatePlanPartidaPreviewRetainedScreenshotBindings} from '../.github/scripts/verify-workspace-ci-parallelization.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const read=file=>Buffer.from(readFileSync(file,'utf8').replaceAll('\r\n','\n'));
const current=()=>JSON.parse(read('.github/workspace-acceptance-contract.json'));
const serialize=value=>JSON.stringify(value,null,2)+'\n';
const denied=run=>assert.throws(run,{code:'PLAN_PARTIDA_PREVIEW_CURRENT_CI_LINEAGE_REJECTED'});
function historical(file){const bytes=read(file);if(file!==WEEKLY_CYP_CURRENT_REVISION.browser.producer)return bytes;assert.equal(sha(bytes),expected.browser.producerLfSha256);const old=read('tests/fixtures/plan-partida-preview-weekly-164-producer.txt');assert.equal(sha(old),WEEKLY_CYP_CURRENT_REVISION.browser.producerLfSha256);return old;}
function legacy(){const head='a'.repeat(40),tree='b'.repeat(40),fixture=weeklyCypImportUiShadowFixture(historical,head,tree);return {head,tree,...fixture};}

test('partida preview restores the entire exact3cc contract without mutating the current contract',()=>{
 const contract=current(),before=serialize(contract),previous=restorePlanPartidaPreviewPreviousContract(contract);assert.equal(serialize(contract),before);assert.equal(sha(serialize(previous)),'e8067f73d1e1a48ace92af3bfc34e5b775e16c49d3833df43bb03510a59bcf34');assert.equal(Object.hasOwn(previous,key),false);assert.equal(expected.finalAstDerived,true);assert.equal(expected.nativeOrBrowserAcceptance,false);
});
test('partida preview authenticates all current source bytes including the explicit declaration',()=>{
 assert.equal(verifyPlanPartidaPreviewCurrentSources(current(),read).nativeOrBrowserAcceptance,false);for(const row of expected.references)assert.equal(sha(read(row.path)),row.currentSha256);
});
test('partida preview rejects declaration co tamper and historical contract mutation',()=>{
 for(const change of [c=>{c[key].previousContractSha256='f'.repeat(64);},c=>{c[key].references[0].currentSha256='f'.repeat(64);},c=>{c.blocks[0].step.run+='\ntrue';},c=>c.evidenceProducers.pop()]){const contract=current();change(contract);denied(()=>verifyPlanPartidaPreviewCurrentSources(contract,read));}
});
test('partida preview rejects missing or modified current bytes even when the contract is unchanged',()=>{
 const contract=current();for(const row of expected.references){denied(()=>verifyPlanPartidaPreviewCurrentSources(contract,file=>file===row.path?null:read(file)));denied(()=>verifyPlanPartidaPreviewCurrentSources(contract,file=>file===row.path?Buffer.concat([read(file),Buffer.from('\n// changed\n')]):read(file)));}
});
test('partida preview source pins admit only their exact previous and current SHA',()=>{
 const contract=current();for(const row of expected.references){if(row.previousSha256)assert.equal(planPartidaPreviewCurrentSourcePin(contract,{path:row.path,sha256:row.previousSha256}),row.currentSha256);assert.equal(planPartidaPreviewCurrentSourcePin(contract,{path:row.path,sha256:row.currentSha256}),row.currentSha256);denied(()=>planPartidaPreviewCurrentSourcePin(contract,{path:row.path,sha256:'f'.repeat(64)}));}
});
test('partida preview rejects omitted or reordered typed additions without changing historical ledgers',()=>{
 for(const row of expected.sourceSetDeltas.filter(row=>row.contractPointer)){const contract=current(),index=Number(row.contractPointer.split('/')[3]);contract.extension.proofs[index].sourceFiles.pop();denied(()=>restorePlanPartidaPreviewPreviousContract(contract));const again=current();again.extension.proofs[index].sourceFiles.reverse();denied(()=>restorePlanPartidaPreviewPreviousContract(again));}
});
test('partida preview verifies family contents as well as paths and rejects an unchanged source tamper',()=>{
 const contract=current();for(const family of expected.sourceFamilies){const closure={files:family.currentFiles,externalImports:family.externalImports};assert.equal(verifyPlanPartidaPreviewActualClosure(contract,family.family,closure,read).sourceCount,family.currentFiles.length);const row=family.currentManifest.find(row=>row.sha256!=='REVIEWED_DECLARATION_TRUST_ANCHOR'&&!expected.references.some(ref=>ref.path===row.path));assert.ok(row,'Each family must exercise a non changed source');denied(()=>verifyPlanPartidaPreviewActualClosure(contract,family.family,closure,file=>file===row.path?Buffer.concat([read(file),Buffer.from('\n')]):read(file)));}
});
test('partida preview rejects a same count foreign AST source and an external import mismatch',()=>{
 const contract=current(),family=expected.sourceFamilies[0],files=[...family.currentFiles];files[0]='src/lib/foreign-preview-same-count.mjs';files.sort();denied(()=>verifyPlanPartidaPreviewActualClosure(contract,family.family,{files,externalImports:family.externalImports},read));denied(()=>verifyPlanPartidaPreviewActualClosure(contract,family.family,{files:family.currentFiles,externalImports:[...family.externalImports,'foreign-package'].sort()},read));
});
test('the historical164 decoder rejects the actual180 producer rather than adopting its hash',()=>{
 const {head,tree,proof,evidence}=legacy();assert.equal(proof.totalCheckCount,164);assert.throws(()=>validateWeeklyCypImportUiProofBytes(Buffer.from(JSON.stringify(proof)),read,{expectedHead:head,expectedTree:tree,readEvidence:file=>evidence.get(file)}),{code:'WEEKLY_CYP_UI_PROOF_REJECTED',reason:'PRODUCER'});proof.totalCheckCount=180;proof.harnessSha256=expected.browser.producerLfSha256;assert.throws(()=>validateWeeklyCypImportUiProofBytes(Buffer.from(JSON.stringify(proof)),read,{expectedHead:head,expectedTree:tree,readEvidence:file=>evidence.get(file)}),{code:'WEEKLY_CYP_UI_PROOF_REJECTED',reason:'PRODUCER'});
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
