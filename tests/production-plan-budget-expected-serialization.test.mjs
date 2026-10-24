import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {
 PLAN_BUDGET_CURRENT_SECTION as key,PLAN_BUDGET_CURRENT_REVISION as reviewed,
 planBudgetRetainedScreenshotPaths,planBudgetValidationFiles,planBudgetCurrentBrowserBinding,
 planBudgetCurrentSourcePin,planBudgetPreviousSourcePin,restorePlanBudgetSourceSet,
 restorePlanBudgetPreviousContract,restorePlanBudgetAcceptancePreviousContract,restorePlanBudgetAcceptancePreviousSource,verifyPlanBudgetCurrentSources,
 restoreCaptureRuntimePreviousSource,withCaptureRuntimePreviousSources,createCaptureRuntimeGate,
} from '../scripts/lib/plan-budget-current-ci-lineage.mjs';

// Current cases use actual public helpers and actual current contract. The final
// historical case separately authenticates a pinned literal Git1b fixture; it
// supplies no current source authority or provider/CI acceptance.
const current=()=>JSON.parse(readFileSync(new URL('../.github/workspace-acceptance-contract.json',import.meta.url),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),serialize=value=>JSON.stringify(value,null,2)+'\n';
const code='PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED';
const denied=(run,reason)=>assert.throws(run,error=>error.code===code&&error.reason===reason);
const observed=()=>{const value=current();let serializations=0;Object.defineProperty(value[key],'toJSON',{enumerable:false,value(){serializations++;return this;}});return {value,count:()=>serializations};};
const expectedPaths=value=>value[key].browser.retainedScreenshots.map(row=>row.path);
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};

test('Budget section serializes the actual caller on every successful helper call',()=>{
 const {value,count}=observed(),wanted=expectedPaths(value);
 for(let index=1;index<=3;index++){assert.deepEqual(planBudgetRetainedScreenshotPaths(value),wanted);assert.equal(count(),index);}
});

test('the same caller mutated after a successful check is rejected on every subsequent call',()=>{
 const {value,count}=observed();planBudgetRetainedScreenshotPaths(value);value[key].references[0].currentSha256='f'.repeat(64);
 for(let index=2;index<=3;index++){denied(()=>planBudgetRetainedScreenshotPaths(value),'IMMUTABLE_COMPANION');assert.equal(count(),index);}
});

test('standalone required helpers retain malformed contract and missing companion denials',()=>{
 for(const value of [null,[],false])denied(()=>planBudgetRetainedScreenshotPaths(value),'CONTRACT');
 denied(()=>planBudgetRetainedScreenshotPaths({}),'BUDGET_COMPANION_REQUIRED');
});

test('present malformed companion values cannot bypass the exact comparison',()=>{
 for(const companion of [null,[],false,0,'foreign',{}])denied(()=>planBudgetRetainedScreenshotPaths({[key]:companion}),'IMMUTABLE_COMPANION');
});

test('nested companion metadata remains validated instead of trusting an earlier check',()=>{
 const {value,count}=observed();planBudgetValidationFiles(value);value[key].pilotIntegrationRuntime.sourceHistory[0].inverseHunks.pop();
 denied(()=>planBudgetValidationFiles(value),'IMMUTABLE_COMPANION');assert.equal(count(),2);
});

test('reordered companion keys retain the original exact serialization contract',()=>{
 const value=current();value[key]=Object.fromEntries(Object.entries(value[key]).reverse());
 denied(()=>planBudgetRetainedScreenshotPaths(value),'IMMUTABLE_COMPANION');
});

test('extra caller companion fields cannot be concealed behind a cached identity',()=>{
 const {value,count}=observed();planBudgetRetainedScreenshotPaths(value);value[key].foreignCurrentAuthority=true;
 denied(()=>planBudgetRetainedScreenshotPaths(value),'IMMUTABLE_COMPANION');assert.equal(count(),2);
});

test('standalone source-set and presentation helpers reject a malformed companion without an enclosing gate',()=>{
 const {value,count}=observed();value[key].version=0;
 for(const run of [()=>restorePlanBudgetSourceSet(value,'FOREIGN_FAMILY',[]),()=>planBudgetCurrentBrowserBinding(value,{}),()=>planBudgetValidationFiles(value)])denied(run,'IMMUTABLE_COMPANION');
 assert.equal(count(),3);
});

test('complete restoration retains the authenticated parent hash and does not mutate the caller',()=>{
 const value=current(),before=serialize(value),parent=restorePlanBudgetPreviousContract(value);
 assert.equal(sha(serialize(parent)),value[key].previousContractSha256);assert.equal(Object.hasOwn(parent,key),false);assert.equal(serialize(value),before);
});

test('mutating a restored result cannot poison the caller or a subsequent restored result',()=>{
 const value=current(),before=serialize(value),first=restorePlanBudgetPreviousContract(value);first.extension.proofs[0].checkNames[0]='foreign';
 const next=restorePlanBudgetPreviousContract(value);assert.equal(sha(serialize(next)),value[key].previousContractSha256);assert.equal(serialize(value),before);assert.notEqual(next.extension.proofs[0].checkNames[0],'foreign');
});

test('an unchanged companion does not excuse an unrelated historical contract mutation',()=>{
 const {value,count}=observed();planBudgetRetainedScreenshotPaths(value);value.sourceCommit='f'.repeat(40);
 denied(()=>restorePlanBudgetPreviousContract(value),'ACCEPTANCE_COMPLETE_1B_CONTRACT');assert.equal(count(),2);
});

test('owned frozen caller values remain accepted without freezing or mutating public inputs',()=>{
 const value=freeze(current()),before=serialize(value);assert.deepEqual(planBudgetRetainedScreenshotPaths(value),expectedPaths(value));
 assert.equal(sha(serialize(restorePlanBudgetPreviousContract(value))),value[key].previousContractSha256);assert.equal(serialize(value),before);
 const mutable=current();planBudgetRetainedScreenshotPaths(mutable);assert.equal(Object.isFrozen(mutable),false);assert.equal(Object.isFrozen(mutable[key].references[0]),false);
});

test('nested mutation of the exported reviewed declaration cannot redefine the private expected value',()=>{
 const value=current(),wanted=expectedPaths(value),original=reviewed.references[0].currentSha256;
 try{reviewed.references[0].currentSha256='e'.repeat(64);assert.deepEqual(planBudgetRetainedScreenshotPaths(value),wanted);const forged=current();forged[key].references[0].currentSha256='e'.repeat(64);denied(()=>planBudgetRetainedScreenshotPaths(forged),'IMMUTABLE_COMPANION');}
 finally{reviewed.references[0].currentSha256=original;}
});

test('pin aliases preserve the early return when the caller has no Budget companion',()=>{
 const ref={path:'src/lib/not-a-budget-alias.mjs',sha256:'a'.repeat(64)};
 for(const value of [null,[],{}])for(const resolve of [planBudgetCurrentSourcePin,planBudgetPreviousSourcePin])assert.equal(resolve(value,ref),ref.sha256);
});

test('the separately authenticated literal Git1b helper retains the original complete65d denial',()=>{
 const value=current(),parent=restorePlanBudgetAcceptancePreviousContract(value);
 verifyPlanBudgetCurrentSources(value,file=>readFileSync(new URL('../'+file,import.meta.url)));
 assert.equal(sha(serialize(parent)),'a89d1a6c820b811359af23359e587f9110e7341bfa0c2b558b5ee452d9ac1042');
 const sourcePath='scripts/lib/plan-budget-current-ci-lineage.mjs',history=value[key].pilotAcceptanceRuntime.sourceHistory.find(row=>row.path===sourcePath);
 const actualBytes=readFileSync(new URL('../'+sourcePath,import.meta.url)),bytes=restoreCaptureRuntimePreviousSource(value,sourcePath,actualBytes);let text=bytes.toString('utf8').replaceAll('\r\n','\n');
 assert.equal(sha(text),history.currentSha256);assert.equal(Buffer.byteLength(text),history.currentBytes);
 // Retained inverse bytes construct an owned HISTORICAL fixture. The exact Git1b
 // digest independently pins the complete body; it is never a current reader.
 for(const hunk of [...history.inverseHunks].reverse()){const at=hunk.currentOffsetCharacters;assert.equal(text.slice(at,at+hunk.currentText.length),hunk.currentText);text=text.slice(0,at)+hunk.previousText+text.slice(at+hunk.currentText.length);}
 assert.equal(sha(text),'90bfa69a4e902dfab785ec10f210d6b0d0a21fe3992c3995c6b0e122748dab99');assert.equal(Buffer.byteLength(text),90144);
 const declaration='// Exact budget-source CI declaration; compiler fills immutable reviewed source bindings.\nexport const PLAN_BUDGET_CURRENT_REVISION=Object.freeze('+JSON.stringify(parent[key],null,2)+');\n';
 assert.equal(sha(declaration),'e1be620f5040e7cba3ebaa0fc34190da0d0d2e1e7a164014e8c2ec3ba17f2a3c');
 const directory=mkdtempSync(path.join(tmpdir(),'obrasaas-budget-git1b-')),moduleFile=path.join(directory,'plan-budget-current-ci-lineage.mjs'),companionFile=path.join(directory,'plan-budget-current-ci-reviewed.mjs');
 try{
  writeFileSync(moduleFile,text,{flag:'wx'});writeFileSync(companionFile,declaration,{flag:'wx'});
  const historical=createRequire(import.meta.url)(moduleFile);
  assert.equal(sha(serialize(historical.restorePlanBudgetPilotIntegrationPreviousContract(parent))),'6cb040ad517b8a87b86a0466f23fe822dd570227392aff6209eeff037e840c71');
  const mutated=structuredClone(parent);mutated.sourceCommit='f'.repeat(40);
  denied(()=>historical.restorePlanBudgetPreviousContract(mutated),'INTEGRATION_COMPLETE_65D_CONTRACT');
 }finally{
  // Only two files created above are removed. No recursive deletion or process.
  for(const file of [moduleFile,companionFile]){assert.equal(path.dirname(file),directory);try{unlinkSync(file);}catch(error){if(error.code!=='ENOENT')throw error;}}
  rmdirSync(directory);
 }
});

test('pin aliases retain private-index semantics while metadata and authority validators still reject a changed caller',()=>{
 const value=current(),history=new Set(value[key].pilotAcceptanceRuntime.sourceHistory.map(row=>row.path)),row=value[key].references.find(row=>!history.has(row.path)),ref={path:row.path,sha256:row.currentSha256};
 const wantedCurrent=planBudgetCurrentSourcePin(value,ref),wantedPrevious=planBudgetPreviousSourcePin(value,ref);
 for(const run of [()=>planBudgetValidationFiles(value),()=>planBudgetCurrentBrowserBinding(value,{}),()=>planBudgetRetainedScreenshotPaths(value)])run();
 value[key].references[0].currentSha256='f'.repeat(64);
 assert.equal(planBudgetCurrentSourcePin(value,ref),wantedCurrent);assert.equal(planBudgetPreviousSourcePin(value,ref),wantedPrevious);
 for(const run of [()=>planBudgetValidationFiles(value),()=>planBudgetCurrentBrowserBinding(value,{}),()=>planBudgetRetainedScreenshotPaths(value)])denied(run,'IMMUTABLE_COMPANION');
 denied(()=>restorePlanBudgetPreviousContract(value),'IMMUTABLE_COMPANION');let reads=0;
 denied(()=>verifyPlanBudgetCurrentSources(value,()=>{reads++;throw new Error('No reader may run before caller authentication');}),'IMMUTABLE_COMPANION');assert.equal(reads,0);
});


test('acceptance source inverse authenticates current workspace recovery bytes before a local Git1b comparison',()=>{
 const value=current(),before=serialize(value),file='scripts/verify-workspace-plan-recovery-ui.mjs',bytes=readFileSync(new URL('../'+file,import.meta.url)),captured=Buffer.from(bytes);
 const expected='ef7a5f0e099e468d5f0ec903ae78f6b9df4cf8dc48e1ed272e7ef9e31010c6c8',first=restorePlanBudgetAcceptancePreviousSource(value,file,bytes);
 assert.ok(Buffer.isBuffer(first));assert.equal(sha(first),expected);assert.equal(first.length,61975);assert.deepEqual(bytes,captured);assert.equal(serialize(value),before);
 const malformed=current();malformed[key]=null;
 for(const [caller,reason] of [[null,'CONTRACT'],[{},'BUDGET_COMPANION_REQUIRED'],[malformed,'IMMUTABLE_COMPANION']]){
  const callerBefore=serialize(caller);denied(()=>restorePlanBudgetAcceptancePreviousSource(caller,file,bytes),reason);
  assert.equal(serialize(caller),callerBefore);assert.deepEqual(bytes,captured);
 }
 const old=Buffer.from(first);
 for(const invalid of [old,bytes.subarray(1),Buffer.concat([bytes,Buffer.from('\n// foreign current workspace recovery source\n')])]){
  const invalidBefore=Buffer.from(invalid);denied(()=>restorePlanBudgetAcceptancePreviousSource(value,file,invalid),'ACCEPTANCE_CURRENT_SOURCE_'+file);
  assert.deepEqual(invalid,invalidBefore);assert.deepEqual(bytes,captured);assert.equal(serialize(value),before);
 }
 first.fill(0);const next=restorePlanBudgetAcceptancePreviousSource(value,file,bytes);
 assert.notEqual(next,first);assert.equal(sha(next),expected);assert.equal(next.length,61975);assert.deepEqual(bytes,captured);assert.equal(serialize(value),before);
 const unrelated=structuredClone(value);unrelated.sourceCommit='f'.repeat(40);const unrelatedBefore=serialize(unrelated);
 denied(()=>restorePlanBudgetAcceptancePreviousSource(unrelated,file,bytes),'ACCEPTANCE_COMPLETE_1B_CONTRACT');
 assert.equal(serialize(unrelated),unrelatedBefore);assert.equal(serialize(value),before);assert.deepEqual(bytes,captured);
});


// These synthetic cases exercise the literal Git731 checkpoint only. Current
// source authority uses the unchanged physical reader before and after this
// synchronous boundary. No synthetic receipt is supplied to current adapters.
function historical731Test(name,run){test('literal Git731 checkpoint: '+name,()=>{
 const actual=current(),physicalRead=file=>readFileSync(new URL('../'+file,import.meta.url));
 return withCaptureRuntimePreviousSources(actual,physicalRead,(parent,parentRead)=>{
  assert.equal(sha(serialize(parent)),'d5ef59b111dd3e25b8f08854d3e8e4df4838a7913e3e22b76299c1916b9913d2');
  assert.equal(sha(restoreCaptureRuntimePreviousSource(actual,'scripts/lib/plan-budget-current-ci-lineage.mjs',physicalRead('scripts/lib/plan-budget-current-ci-lineage.mjs'))),'0ba932090392ee957357d303ac8c4acd11fec9da46b4f01a9e5390e47d563510');
  // The factory checks its literal parent body pin before returning these APIs.
  const api=createCaptureRuntimeGate(actual[key]).parentGate;
  return run({...api,current:()=>structuredClone(parent),readCaptureParent:parentRead});
 });
});}

historical731Test('native proofs retain actual RAW LF and CRLF hashes through the local acceptance bridge without mutating inputs',({current,readCaptureParent,normalizePlanBudgetPilotNativeProof,normalizePlanBudgetIntakeWithdrawalNativeProof})=>{
 const value=current(),before=serialize(value),runtime=value[key],intake=runtime.intakeWithdrawalRuntime,material=runtime.consumptionEvidenceRuntime.materialNative;
 const supplement=runtime.pilotWhatsAppRuntime.nativeSupplements.find(row=>row.producer===material.producer),spec=value.extension.proofs.find(row=>row.kind==='PG_INTAKE');
 const alias=runtime.trialExpiryNoticeRuntime.sourceAliases[0],nativeFiles=new Set([...intake.native.currentManifest.map(row=>row.path),...material.currentFiles,intake.producer.producer]);
 assert.equal(intake.native.currentManifest.length,32);assert.equal(material.currentFiles.length,130);
 for(const history of runtime.pilotAcceptanceRuntime.sourceHistory)assert.equal(nativeFiles.has(history.path),false);
 assert.equal(spec.producerSha256,intake.producer.currentSha256);assert.deepEqual(spec.sourceFiles,intake.native.currentManifest.map(row=>row.path));assert.deepEqual(spec.checkNames,intake.native.previousCheckNames);
 for(const eol of ['\n','\r\n']){
  let tamper=null;const observed=[];
  const reader=file=>{
   const actual=readCaptureParent(file);let bytes=Buffer.from(actual);
   if(nativeFiles.has(file))bytes=Buffer.from(actual.toString('utf8').replaceAll('\r\n','\n').replaceAll('\n',eol));
   if(file===tamper)bytes=Buffer.concat([bytes,Buffer.from('\n// foreign native current bytes\n')]);
   if(nativeFiles.has(file))observed.push({bytes,digest:sha(bytes)});return bytes;
  };
  const proofs=[
   {name:'intake',producer:intake.producer.producer,oldHarness:intake.producer.previousSha256,reason:'INTAKE_CURRENT_HARNESS',sourceReason:'INTAKE_CURRENT_SOURCE_'+alias.path,
    raw:{checks:[...intake.native.previousCheckNames,...intake.native.addedCheckNames],checkCount:35,totalCheckCount:35,sourceManifest:intake.native.currentManifest.map(row=>({path:row.path,sha256:sha(reader(row.path))})),harnessSha256:sha(reader(intake.producer.producer))}},
   {name:'material',producer:material.producer,oldHarness:material.sourceHistory.previousSha256,reason:'PILOT_COMPLETE_NATIVE_MANIFEST',sourceReason:'PILOT_COMPLETE_NATIVE_MANIFEST',
    raw:{checks:[...supplement.previousCheckNames,...supplement.addedCheckNames],checkCount:26,sourceManifest:material.currentFiles.map(path=>({path,sha256:sha(reader(path))})),harnessSha256:sha(reader(material.producer))}},
  ];
  const run=entry=>entry.name==='intake'?normalizePlanBudgetIntakeWithdrawalNativeProof(entry.raw,value,reader,spec):normalizePlanBudgetPilotNativeProof(value,entry.producer,entry.raw,reader);
  for(const entry of proofs){
   const captured=serialize(entry.raw),result=run(entry);
   assert.equal(serialize(entry.raw),captured);assert.equal(serialize(value),before);assert.equal(result.harnessSha256,entry.raw.harnessSha256);
   if(entry.name==='intake'){assert.deepEqual(result.sourceManifest,entry.raw.sourceManifest);assert.deepEqual(result.checks,intake.native.previousCheckNames);assert.equal(result.checkCount,33);assert.equal(result.totalCheckCount,33);}
   else{assert.deepEqual(result.sourceManifest,entry.raw.sourceManifest.filter(row=>supplement.sourceManifestAdvance.previousFiles.includes(row.path)));assert.equal(result.sourceManifest.length,125);assert.deepEqual(result.checks,supplement.previousCheckNames);assert.equal(result.checkCount,24);}
   for(const digest of [entry.oldHarness,'f'.repeat(64)]){
    const invalid={...entry,raw:structuredClone(entry.raw)};assert.notEqual(digest,invalid.raw.harnessSha256);invalid.raw.harnessSha256=digest;const invalidBefore=serialize(invalid.raw);
    denied(()=>run(invalid),entry.reason);assert.equal(serialize(invalid.raw),invalidBefore);assert.equal(serialize(entry.raw),captured);
   }
   for(const digest of [alias.previousSha256,'f'.repeat(64)]){
    const invalid={...entry,raw:structuredClone(entry.raw)},row=invalid.raw.sourceManifest.find(row=>row.path===alias.path);assert.ok(row);assert.notEqual(digest,row.sha256);row.sha256=digest;const invalidBefore=serialize(invalid.raw);
    denied(()=>run(invalid),entry.sourceReason);assert.equal(serialize(invalid.raw),invalidBefore);assert.equal(serialize(entry.raw),captured);
   }
   assert.ok(runtime.references.some(row=>row.path===entry.producer));tamper=entry.producer;
   denied(()=>run(entry),'ACCEPTANCE_CURRENT_REFERENCE_'+entry.producer);tamper=null;
   assert.equal(serialize(entry.raw),captured);assert.equal(serialize(value),before);
  }
  const incomplete={...proofs[0],raw:structuredClone(proofs[0].raw)};incomplete.raw.checks.pop();const incompleteBefore=serialize(incomplete.raw);
  denied(()=>run(incomplete),'INTAKE_CHECK_NAMES');assert.equal(serialize(incomplete.raw),incompleteBefore);
  for(const record of observed)assert.equal(sha(record.bytes),record.digest);
 }
 assert.equal(serialize(value),before);
});
