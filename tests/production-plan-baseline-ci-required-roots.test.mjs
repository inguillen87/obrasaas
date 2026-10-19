import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validatePlanBaselineContract,validateDocumentCurveUiContract} from '../.github/scripts/verify-workspace-ci-parallelization.mjs';

const canonical=()=>JSON.parse(readFileSync(new URL('../.github/workspace-acceptance-contract.json',import.meta.url),'utf8'));
const proof=contract=>contract.extension.proofs.find(spec=>spec.kind==='PG_PLAN_BASELINE');
const requiredPaths=["scripts/verify-plan-baseline-postgres.mjs","tests/production-plan-baseline-postgres-target.test.mjs","src/app/api/identity/plan-baseline/route.js","src/lib/plan-baseline-http.mjs","src/lib/plan-baseline-policy.mjs","src/lib/plan-baseline-runtime.mjs","src/lib/plan-baseline-store.mjs","package.json","package-lock.json"];
function deniedRequiredSource(path,mode){
 const contract=canonical(),spec=proof(contract),before=spec.sourceFiles.length,index=spec.sourceFiles.indexOf(path);
 assert.equal(spec.sourceFiles.filter(file=>file===path).length,1);assert.ok(index>=0);
 if(mode==='missing')spec.sourceFiles.splice(index,1);else{assert.equal(mode,'same-count-substitution');spec.sourceFiles[index]='tests/production-foreign-plan-baseline.test.mjs';spec.sourceFiles.sort();}
 assert.equal(spec.sourceFiles.length,mode==='missing'?before-1:before);assert.equal(spec.sourceFiles.includes(path),false);
 assert.throws(()=>validatePlanBaselineContract(contract),{code:'PLAN_BASELINE_SOURCE_CONTRACT'});
}

test('plan baseline current canonical contract retains valid count and source lineage',()=>{
 const contract=canonical(),before=structuredClone(contract);assert.doesNotThrow(()=>validatePlanBaselineContract(contract));assert.deepEqual(contract,before);
});

test('plan baseline rejects missing native producer before transitive lineage extraction',()=>deniedRequiredSource('scripts/verify-plan-baseline-postgres.mjs','missing'));

test('plan baseline rejects same-count substitution of native producer before transitive lineage extraction',()=>deniedRequiredSource('scripts/verify-plan-baseline-postgres.mjs','same-count-substitution'));

test('plan baseline rejects missing native target guard before transitive lineage extraction',()=>deniedRequiredSource('tests/production-plan-baseline-postgres-target.test.mjs','missing'));

test('plan baseline rejects same-count substitution of native target guard before transitive lineage extraction',()=>deniedRequiredSource('tests/production-plan-baseline-postgres-target.test.mjs','same-count-substitution'));

test('plan baseline rejects missing baseline route before transitive lineage extraction',()=>deniedRequiredSource('src/app/api/identity/plan-baseline/route.js','missing'));

test('plan baseline rejects same-count substitution of baseline route before transitive lineage extraction',()=>deniedRequiredSource('src/app/api/identity/plan-baseline/route.js','same-count-substitution'));

test('plan baseline rejects missing baseline HTTP module before transitive lineage extraction',()=>deniedRequiredSource('src/lib/plan-baseline-http.mjs','missing'));

test('plan baseline rejects same-count substitution of baseline HTTP module before transitive lineage extraction',()=>deniedRequiredSource('src/lib/plan-baseline-http.mjs','same-count-substitution'));

test('plan baseline rejects missing baseline policy module before transitive lineage extraction',()=>deniedRequiredSource('src/lib/plan-baseline-policy.mjs','missing'));

test('plan baseline rejects same-count substitution of baseline policy module before transitive lineage extraction',()=>deniedRequiredSource('src/lib/plan-baseline-policy.mjs','same-count-substitution'));

test('plan baseline rejects missing baseline runtime module before transitive lineage extraction',()=>deniedRequiredSource('src/lib/plan-baseline-runtime.mjs','missing'));

test('plan baseline rejects same-count substitution of baseline runtime module before transitive lineage extraction',()=>deniedRequiredSource('src/lib/plan-baseline-runtime.mjs','same-count-substitution'));

test('plan baseline rejects missing baseline store module before transitive lineage extraction',()=>deniedRequiredSource('src/lib/plan-baseline-store.mjs','missing'));

test('plan baseline rejects same-count substitution of baseline store module before transitive lineage extraction',()=>deniedRequiredSource('src/lib/plan-baseline-store.mjs','same-count-substitution'));

test('plan baseline rejects missing package manifest before transitive lineage extraction',()=>deniedRequiredSource('package.json','missing'));

test('plan baseline rejects same-count substitution of package manifest before transitive lineage extraction',()=>deniedRequiredSource('package.json','same-count-substitution'));

test('plan baseline rejects missing package lock before transitive lineage extraction',()=>deniedRequiredSource('package-lock.json','missing'));

test('plan baseline rejects same-count substitution of package lock before transitive lineage extraction',()=>deniedRequiredSource('package-lock.json','same-count-substitution'));

test('plan baseline retains transitive rejection for sorted same-count foreign non-root source',()=>{
 const contract=canonical(),spec=proof(contract),path='src/lib/plan-import-store.mjs',before=spec.sourceFiles.length,index=spec.sourceFiles.indexOf(path);
 assert.ok(index>=0);assert.equal(requiredPaths.includes(path),false);assert.equal(spec.sourceFiles.filter(file=>file===path).length,1);
 spec.sourceFiles[index]='src/lib/foreign-plan-baseline.mjs';spec.sourceFiles.sort();assert.equal(spec.sourceFiles.length,before);
 for(const required of requiredPaths)assert.equal(spec.sourceFiles.filter(file=>file===required).length,1);
 assert.throws(()=>validatePlanBaselineContract(contract),{code:'PLAN_MEASUREMENT_CURRENT_CI_LINEAGE_REJECTED'});
});

const documentProof=contract=>contract.extension.proofs.find(spec=>spec.kind==='UI_DOCUMENT_CURVE');
const documentRequiredPaths=["src/app/(identity)/cuenta/plan-import-panel.js","src/app/(identity)/cuenta/plan-baseline-panel.js","scripts/lib/plan-document-curve-ui-fixture.mjs","src/lib/plan-import-document-curve.mjs","scripts/lib/owned-fixture-cleanup.mjs","package.json","package-lock.json"];
function deniedDocumentRequiredSource(path,mode){
 const contract=canonical(),spec=documentProof(contract),before=spec.sourceFiles.length,index=spec.sourceFiles.indexOf(path);
 assert.equal(spec.sourceFiles.filter(file=>file===path).length,1);assert.ok(index>=0);
 if(mode==='missing')spec.sourceFiles.splice(index,1);else{assert.equal(mode,'same-count-substitution');spec.sourceFiles[index]='src/lib/foreign-document-curve.mjs';spec.sourceFiles.sort();}
 assert.equal(spec.sourceFiles.length,mode==='missing'?before-1:before);assert.equal(spec.sourceFiles.includes(path),false);
 assert.throws(()=>validateDocumentCurveUiContract(contract),{code:'DOCUMENT_CURVE_UI_SOURCE_CONTRACT'});
}

test('document curve UI canonical contract retains exact current count and source lineage',()=>{
 const contract=canonical(),before=structuredClone(contract);assert.doesNotThrow(()=>validateDocumentCurveUiContract(contract));assert.deepEqual(contract,before);
});

test("document curve UI rejects missing rendered import panel before transitive lineage extraction",()=>deniedDocumentRequiredSource("src/app/(identity)/cuenta/plan-import-panel.js","missing"));

test("document curve UI rejects same-count substitution of rendered import panel before transitive lineage extraction",()=>deniedDocumentRequiredSource("src/app/(identity)/cuenta/plan-import-panel.js","same-count-substitution"));

test("document curve UI rejects missing rendered baseline panel before transitive lineage extraction",()=>deniedDocumentRequiredSource("src/app/(identity)/cuenta/plan-baseline-panel.js","missing"));

test("document curve UI rejects same-count substitution of rendered baseline panel before transitive lineage extraction",()=>deniedDocumentRequiredSource("src/app/(identity)/cuenta/plan-baseline-panel.js","same-count-substitution"));

test("document curve UI rejects missing browser fixture root before transitive lineage extraction",()=>deniedDocumentRequiredSource("scripts/lib/plan-document-curve-ui-fixture.mjs","missing"));

test("document curve UI rejects same-count substitution of browser fixture root before transitive lineage extraction",()=>deniedDocumentRequiredSource("scripts/lib/plan-document-curve-ui-fixture.mjs","same-count-substitution"));

test("document curve UI rejects missing document curve source before transitive lineage extraction",()=>deniedDocumentRequiredSource("src/lib/plan-import-document-curve.mjs","missing"));

test("document curve UI rejects same-count substitution of document curve source before transitive lineage extraction",()=>deniedDocumentRequiredSource("src/lib/plan-import-document-curve.mjs","same-count-substitution"));

test("document curve UI rejects missing owned cleanup helper before transitive lineage extraction",()=>deniedDocumentRequiredSource("scripts/lib/owned-fixture-cleanup.mjs","missing"));

test("document curve UI rejects same-count substitution of owned cleanup helper before transitive lineage extraction",()=>deniedDocumentRequiredSource("scripts/lib/owned-fixture-cleanup.mjs","same-count-substitution"));

test("document curve UI rejects missing package manifest before transitive lineage extraction",()=>deniedDocumentRequiredSource("package.json","missing"));

test("document curve UI rejects same-count substitution of package manifest before transitive lineage extraction",()=>deniedDocumentRequiredSource("package.json","same-count-substitution"));

test("document curve UI rejects missing package lock before transitive lineage extraction",()=>deniedDocumentRequiredSource("package-lock.json","missing"));

test("document curve UI rejects same-count substitution of package lock before transitive lineage extraction",()=>deniedDocumentRequiredSource("package-lock.json","same-count-substitution"));

test('document curve UI retains transitive rejection for sorted same-count foreign non-root source',()=>{
 const contract=canonical(),spec=documentProof(contract),path='src/lib/plan-import-ooxml.mjs',before=spec.sourceFiles.length,index=spec.sourceFiles.indexOf(path);
 assert.ok(index>=0);assert.equal(documentRequiredPaths.includes(path),false);assert.equal(spec.sourceFiles.filter(file=>file===path).length,1);
 spec.sourceFiles[index]='src/lib/foreign-document-curve.mjs';spec.sourceFiles.sort();assert.equal(spec.sourceFiles.length,before);
 for(const required of documentRequiredPaths)assert.equal(spec.sourceFiles.filter(file=>file===required).length,1);
 assert.throws(()=>validateDocumentCurveUiContract(contract),{code:'PLAN_MEASUREMENT_CURRENT_CI_LINEAGE_REJECTED'});
});
