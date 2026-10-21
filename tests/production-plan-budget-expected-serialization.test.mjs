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
 restorePlanBudgetPreviousContract,restorePlanBudgetAcceptancePreviousContract,verifyPlanBudgetCurrentSources,
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
 assert.equal(sha(serialize(parent)),'a89d1a6c820b811359af23359e587f9110e7341bfa0c2b558b5ee452d9ac1042');
 const sourcePath='scripts/lib/plan-budget-current-ci-lineage.mjs',history=value[key].pilotAcceptanceRuntime.sourceHistory.find(row=>row.path===sourcePath);
 const bytes=readFileSync(new URL('../'+sourcePath,import.meta.url));let text=bytes.toString('utf8').replaceAll('\r\n','\n');
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
