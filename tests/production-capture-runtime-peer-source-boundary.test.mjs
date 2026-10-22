import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
 verifyPlanBudgetCurrentSources,verifyPlanBudgetActualClosure,
 verifyCaptureRuntimeCurrentSources,restoreCaptureRuntimePreviousContract,
 restoreCaptureRuntimePreviousSource,withCaptureRuntimePreviousSources,
} from '../scripts/lib/plan-budget-current-ci-lineage.mjs';
import {verifyParticipantPreanalysisCurrentSources} from '../scripts/lib/participant-preanalysis-current-ci-lineage.mjs';

// Current positives read the actual public compiler, declaration and contract.
// Historical buffers exist only inside the explicit authenticated callback.
// These source-binding controls never supply a native receipt or CI lane proof.
const root=fileURLToPath(new URL('../',import.meta.url)),section='planBudgetCurrentRevision',revision='captureQualityRuntime';
const contractPath='.github/workspace-acceptance-contract.json',compiler='scripts/lib/plan-budget-current-ci-lineage.mjs';
const parentContractSha256='d5ef59b111dd3e25b8f08854d3e8e4df4838a7913e3e22b76299c1916b9913d2';
const parentCompilerSha256='0ba932090392ee957357d303ac8c4acd11fec9da46b4f01a9e5390e47d563510';
const read=file=>readFileSync(path.join(root,file)),current=()=>JSON.parse(read(contractPath));
const serialize=value=>JSON.stringify(value,null,2)+'\n',sha=value=>createHash('sha256').update(value).digest('hex'),lf=value=>Buffer.from(value.toString('utf8').replaceAll('\r\n','\n'));
const denied=run=>assert.throws(run,{code:'PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED'});

test('actual public source binding reports current references and closures before restoring the exact literal parent',()=>{
 const contract=current(),before=serialize(contract),budget=contract[section];assert.ok(budget[revision]);
 const result=verifyPlanBudgetCurrentSources(contract,read);assert.equal(result.referenceCount,budget.references.length);assert.equal(result.nativeOrBrowserAcceptance,false);
 verifyCaptureRuntimeCurrentSources(contract,read);
 for(const familyName of ['UI_FOCUSED_WORKSPACE','PLAN_BUDGET_UI']){
  const family=budget.sourceFamilies.find(row=>row.family===familyName);assert.ok(family);
  const result=verifyPlanBudgetActualClosure(contract,familyName,{files:family.currentFiles,externalImports:family.externalImports},read);
  assert.equal(result.sourceCount,family.currentFiles.length);assert.equal(result.sourcePathsSha256,sha(JSON.stringify(family.currentFiles)));assert.equal(result.nativeOrBrowserAcceptance,false);
 }
 const parent=restoreCaptureRuntimePreviousContract(contract);assert.equal(sha(serialize(parent)),parentContractSha256);
 assert.equal(Object.hasOwn(parent[section],revision),false);assert.equal(serialize(contract),before);
 let calls=0;withCaptureRuntimePreviousSources(contract,read,(historical,reader)=>{calls++;assert.equal(sha(serialize(historical)),parentContractSha256);assert.equal(sha(lf(reader(compiler))),parentCompilerSha256);return null;});assert.equal(calls,1);assert.equal(serialize(contract),before);
});

test('the same reader and caller cannot reuse an earlier successful current-source verification',()=>{
 const contract=current(),actual=read(compiler);let changed=false,reads=0;
 const reader=file=>{reads++;return file===compiler&&changed?Buffer.concat([actual,Buffer.from('\n// controlled peer mutation\n')]):read(file);};
 verifyPlanBudgetCurrentSources(contract,reader);assert.ok(reads>0);changed=true;denied(()=>verifyPlanBudgetCurrentSources(contract,reader));changed=false;
 verifyPlanBudgetCurrentSources(contract,reader);contract[section][revision].sourceHistory[0].currentSha256='f'.repeat(64);reads=0;
 denied(()=>verifyPlanBudgetCurrentSources(contract,reader));assert.equal(reads,0,'Caller metadata must fail before any source reader runs');
});

test('a parent callback cannot conceal changed current bytes or mutate the caller contract',()=>{
 for(const mode of ['reader-after','contract-after','companion-after','async']){
  const contract=current(),before=serialize(contract),actual=read(compiler);let changed=false,calls=0;
  const reader=file=>file===compiler&&changed?Buffer.concat([actual,Buffer.from('\n// changed while parent callback ran\n')]):read(file);
  denied(()=>withCaptureRuntimePreviousSources(contract,reader,()=>{calls++;if(mode==='reader-after')changed=true;if(mode==='contract-after')contract.sourceCommit='f'.repeat(40);if(mode==='companion-after')contract[section][revision].sourceHistory[0].currentSha256='f'.repeat(64);return mode==='async'?Promise.resolve(null):null;}));
  assert.equal(calls,1);if(['reader-after','async'].includes(mode))assert.equal(serialize(contract),before);
 }
});

test('historical verification authority exists only during the authenticated synchronous parent callback',async()=>{
 let historical,parentReader,pending,continued=false;
 const inspectParent=(parent,reader)=>{
  historical=parent;parentReader=reader;
  assert.equal(sha(serialize(parent)),parentContractSha256);
  const result=verifyPlanBudgetCurrentSources(parent,reader);assert.equal(result.nativeOrBrowserAcceptance,false);
  const family=parent[section].sourceFamilies.find(row=>row.family==='UI_FOCUSED_WORKSPACE');assert.ok(family);
  const closure=verifyPlanBudgetActualClosure(parent,family.family,{files:family.currentFiles,externalImports:family.externalImports},reader);
  assert.equal(closure.sourceCount,family.currentFiles.length);assert.equal(closure.nativeOrBrowserAcceptance,false);
 };
 const outside=()=>{
  denied(()=>verifyPlanBudgetCurrentSources(historical,parentReader));
  const family=historical[section].sourceFamilies.find(row=>row.family==='UI_FOCUSED_WORKSPACE');
  denied(()=>verifyPlanBudgetActualClosure(historical,family.family,{files:family.currentFiles,externalImports:family.externalImports},parentReader));
 };
 withCaptureRuntimePreviousSources(current(),read,inspectParent);outside();
 const sentinel=new Error('Controlled peer callback failure');
 assert.throws(()=>withCaptureRuntimePreviousSources(current(),read,(parent,reader)=>{inspectParent(parent,reader);throw sentinel;}),error=>error===sentinel);outside();
 denied(()=>withCaptureRuntimePreviousSources(current(),read,(parent,reader)=>{
  inspectParent(parent,reader);
  pending=Promise.resolve().then(()=>{outside();continued=true;});
  return pending;
 }));
 outside();await pending;assert.equal(continued,true);
 // A fresh valid boundary still works after both cleanup paths.
 withCaptureRuntimePreviousSources(current(),read,inspectParent);outside();
});

test('the capture inverse accepts current compiler bytes and rejects parent bytes relabelled as current',()=>{
 const contract=current(),actual=read(compiler),before=Buffer.from(actual),snapshot=serialize(contract);verifyPlanBudgetCurrentSources(contract,read);
 const history=contract[section][revision].sourceHistory.find(row=>row.path===compiler);assert.ok(history);assert.equal(history.previousSha256,parentCompilerSha256);
 const historical=restoreCaptureRuntimePreviousSource(contract,compiler,actual);assert.equal(sha(lf(historical)),parentCompilerSha256);assert.equal(historical.length,history.previousBytes);
 for(const bad of [historical,actual.subarray(1),Buffer.concat([actual,Buffer.from('\n// foreign compiler bytes\n')])])denied(()=>restoreCaptureRuntimePreviousSource(contract,compiler,bad));
 historical.fill(0);assert.equal(sha(lf(restoreCaptureRuntimePreviousSource(contract,compiler,actual))),parentCompilerSha256);assert.deepEqual(actual,before);assert.equal(serialize(contract),snapshot);
});

test('unchanged parent-reader buffers retain owned RAW LF and CRLF bytes without becoming native evidence',()=>{
 const contract=current(),file='package.json';assert.equal(contract[section][revision].sourceHistory.some(row=>row.path===file),false);
 // Explicit EOL port controls, not a substitute for the actual reader above.
 for(const eol of ['\n','\r\n']){
  const raw=Buffer.from(lf(read(file)).toString('utf8').replaceAll('\n',eol)),before=Buffer.from(raw);let calls=0;
  const reader=target=>target===file?raw:read(target);
  withCaptureRuntimePreviousSources(contract,reader,(_parent,parentReader)=>{calls++;const owned=parentReader(file);assert.deepEqual(owned,raw);assert.notEqual(owned,raw);owned.fill(0);assert.deepEqual(raw,before);assert.deepEqual(parentReader(file),before);return {nativeReceiptSupplied:false,ciLaneProofSupplied:false};});
  assert.equal(calls,1);assert.deepEqual(raw,before);
 }
});

test('current preanalysis authenticates frozen native and unit sources before its exact historical oracle',()=>{
 const contract=current(),snapshot=serialize(contract),result=verifyParticipantPreanalysisCurrentSources(contract,read);
 assert.equal(result.historicalContractRestored,true);assert.equal(result.historicalPinsPreserved,true);assert.equal(result.nativeAcceptance,false);
 const frozen=['scripts/verify-participant-kyc-preanalysis-postgres.mjs',...contract.participantPreanalysisCurrentRevision.unitSuites.map(row=>row.file)];
 assert.equal(new Set(frozen).size,frozen.length);
 for(const file of frozen){
  const actual=read(file),before=Buffer.from(actual),changed=Buffer.concat([actual,Buffer.from('\n// controlled frozen preanalysis source mutation\n')]);
  assert.throws(()=>verifyParticipantPreanalysisCurrentSources(contract,target=>target===file?changed:read(target)),error=>['PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED','PLAN_MEASUREMENT_CURRENT_CI_LINEAGE_REJECTED'].includes(error.code),file);
  assert.deepEqual(actual,before);assert.equal(serialize(contract),snapshot);
 }
 let parent,parentReader;
 withCaptureRuntimePreviousSources(contract,read,(historical,reader)=>{parent=historical;parentReader=reader;assert.equal(sha(serialize(historical)),parentContractSha256);});
 assert.throws(()=>verifyParticipantPreanalysisCurrentSources(parent,parentReader),{code:'PLAN_MEASUREMENT_CURRENT_CI_LINEAGE_REJECTED',message:/Capture quality lineage rejected: CURRENT_CAPTURE_RUNTIME_REQUIRED$/});
 assert.equal(serialize(contract),snapshot);
});
