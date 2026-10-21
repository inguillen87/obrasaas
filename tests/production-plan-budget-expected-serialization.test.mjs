import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {
 PLAN_BUDGET_CURRENT_SECTION as key,PLAN_BUDGET_CURRENT_REVISION as reviewed,
 planBudgetRetainedScreenshotPaths,planBudgetValidationFiles,planBudgetCurrentBrowserBinding,
 planBudgetCurrentSourcePin,planBudgetPreviousSourcePin,restorePlanBudgetSourceSet,
 restorePlanBudgetPreviousContract,
} from '../scripts/lib/plan-budget-current-ci-lineage.mjs';

// Actual public helpers and actual contract. No copied implementation, source
// substitution, provider or claim that current source pins are already accepted.
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
 denied(()=>restorePlanBudgetPreviousContract(value),'INTEGRATION_COMPLETE_65D_CONTRACT');assert.equal(count(),3);
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
