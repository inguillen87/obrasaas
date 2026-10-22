import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync,mkdtempSync,writeFileSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import * as lineage from '../scripts/lib/plan-budget-current-ci-lineage.mjs';
import {planBudgetUiSourceBinding} from '../scripts/lib/plan-budget-ui-contract.mjs';
import {weeklyCypInvestmentUiSourceFiles} from '../scripts/lib/home-decisions-current-ci-lineage.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),contractPath='.github/workspace-acceptance-contract.json',read=file=>{try{return readFileSync(path.join(root,file));}catch(error){if(error.code==='ENOENT')return null;throw error;}},current=()=>JSON.parse(read(contractPath)),sha=value=>createHash('sha256').update(value).digest('hex'),json=value=>JSON.stringify(value,null,2)+'\n';
const denied=(run,reason)=>assert.throws(run,error=>Boolean(error.code)&&(!reason||error.reason===reason));
function syntheticNative(kind){
 const contract=current(),spec=contract.extension.proofs.find(row=>row.kind===kind),descriptor=contract.planBudgetCurrentRevision.captureQualityRuntime.nativeSourceAdvances.find(row=>row.kind===kind),proof={status:'PASS',checks:[...spec.checkNames],harnessSha256:sha(read(spec.producer)),business:{componentOnly:true,providerCalls:0,identityCertified:false}};
 if(kind==='PG_FIELD'){for(const map of descriptor.nested.maps){const rows=Object.fromEntries(map.currentFiles.map(file=>[file,sha(read(file))]));if(map.field==='participantKycFixture.sourceSha256')proof.participantKycFixture={sourceSha256:rows,records:[{componentOnly:true}]};else proof[map.field]=rows;}}
 else proof.sourceManifest=spec.sourceFiles.map(path=>({path,sha256:sha(read(path))}));
 if(kind==='PG_COMPANY_KYC')proof.currentImageNative={sourceManifest:descriptor.nested.currentFiles.map(path=>({path,sha256:sha(read(path))})),cases:[{componentOnly:true,privatePuts:3,identityCertified:false}]};
 return{contract,spec,proof,raw:Buffer.from(json(proof))};
}

test('all41 historical exports remain available and every old contract checkpoint preserves its target',()=>{
 const c=current(),parent=lineage.restoreCaptureRuntimePreviousContract(c),core=lineage.createCaptureRuntimeGate(c.planBudgetCurrentRevision);
 assert.equal(sha(json(parent)),'d5ef59b111dd3e25b8f08854d3e8e4df4838a7913e3e22b76299c1916b9913d2');assert.equal(Object.keys(core.parentGate).length,41);for(const key of Object.keys(core.parentGate))assert.ok(Object.hasOwn(lineage,key),key);
 for(const name of ['restorePlanBudgetAcceptancePreviousContract','restorePlanBudgetPilotIntegrationPreviousContract','restorePlanBudgetTrialExpiryNoticePreviousContract','restorePlanBudgetMeasurementPrivacyPreviousContract','restorePlanBudgetCheckTimePreviousContract','restorePlanBudgetPreviousContract'])assert.deepEqual(lineage[name](c),core.parentGate[name](parent),name);
 const spec=lineage.planBudgetCompiledProof(c),prior=core.parentGate.planBudgetCompiledProof(parent);assert.deepEqual(spec,c.extension.proofs.find(row=>row.id===prior.id));assert.deepEqual({...spec,sourceFiles:prior.sourceFiles,producerSha256:prior.producerSha256},prior);
});

test('every new inverse authenticates current bytes and restores exact owned731 source',()=>{
 const c=current();for(const row of c.planBudgetCurrentRevision.captureQualityRuntime.sourceHistory){const raw=read(row.path),before=Buffer.from(raw),out=lineage.restoreCaptureRuntimePreviousSource(c,row.path,raw);assert.deepEqual(raw,before);if(row.previousSha256===null)assert.equal(out,null);else{assert.equal(sha(out),row.previousSha256,row.path);assert.equal(out.length,row.previousBytes,row.path);denied(()=>lineage.restoreCaptureRuntimePreviousSource(c,row.path,out),'CURRENT_SOURCE_'+row.path);}}
});

test('all current proof sets and source pin aliases preserve exact current metadata',()=>{
 const c=current(),r=c.planBudgetCurrentRevision.captureQualityRuntime,core=lineage.createCaptureRuntimeGate(c.planBudgetCurrentRevision),parent=lineage.restoreCaptureRuntimePreviousContract(c);for(const row of r.proofSourceSetAdvances){assert.deepEqual(lineage.captureRuntimeProofSourceSet(c,row.kind),row.currentFiles);for(const name of ['restorePlanBudgetSourceSet','restorePlanBudgetFieldReviewSourceSet','restorePlanBudgetConsumptionEvidenceSourceSet'])assert.deepEqual(lineage[name](c,row.kind,row.currentFiles),core.parentGate[name](parent,row.kind,row.previousFiles));if(row.additions.length>1)denied(()=>lineage.restorePlanBudgetSourceSet(c,row.kind,[...row.previousFiles,row.additions[0]].sort()),'EXACT_CURRENT_SOURCE_SET_'+row.kind);}
 const ref=c.planBudgetCurrentRevision.references.find(row=>!r.sourceHistory.some(h=>h.path===row.path)),pin={path:ref.path,sha256:ref.currentSha256},expected=lineage.planBudgetCurrentSourcePin(c,pin);c.planBudgetCurrentRevision.references[0].currentSha256='f'.repeat(64);assert.equal(lineage.planBudgetCurrentSourcePin(c,pin),expected);let reads=0;denied(()=>lineage.verifyPlanBudgetCurrentSources(c,()=>{reads++;return null;}),'IMMUTABLE_COMPANION');assert.equal(reads,0);
});

test('four native source adapters authenticate actual RAW shapes and preserve all business facts (synthetic component inputs only)',()=>{
 for(const kind of ['PG_BANK','PG_INTAKE','PG_FIELD','PG_COMPANY_KYC']){const value=syntheticNative(kind);let calls=0;const result=lineage.normalizeCaptureRuntimeNativeProof(value.contract,value.spec,value.proof,read,()=>value.raw,(parent,previous,projected,parentRead)=>{calls++;assert.equal(sha(json(parent)),'d5ef59b111dd3e25b8f08854d3e8e4df4838a7913e3e22b76299c1916b9913d2');assert.deepEqual(projected.business,value.proof.business);assert.deepEqual(projected.checks,value.proof.checks);assert.equal(projected.harnessSha256,sha(parentRead(previous.producer)));if(kind==='PG_FIELD'){assert.equal(Object.hasOwn(projected,'sourceManifest'),false);assert.equal(Object.keys(projected.participantKycFixture.sourceSha256).length,115);}else assert.deepEqual(projected.sourceManifest,previous.sourceFiles.map(path=>({path,sha256:sha(parentRead(path))})));if(kind==='PG_COMPANY_KYC'){assert.equal(projected.currentImageNative.sourceManifest.length,4);assert.deepEqual(projected.currentImageNative.cases,value.proof.currentImageNative.cases);}return{componentOnly:true};});assert.deepEqual(result,{componentOnly:true});assert.equal(calls,1);}
});

test('native missing RAW, changed harness, omitted new source and proof-plus-RAW callback mutation cannot pass',()=>{
 for(const mode of ['no-evidence','bad-harness','omitted-source','changed-input']){const value=syntheticNative('PG_BANK');let raw=value.raw,calls=0;if(mode==='bad-harness'){value.proof.harnessSha256='0'.repeat(64);raw=Buffer.from(json(value.proof));}if(mode==='omitted-source'){value.proof.sourceManifest.pop();raw=Buffer.from(json(value.proof));}denied(()=>lineage.normalizeCaptureRuntimeNativeProof(value.contract,value.spec,value.proof,read,mode==='no-evidence'?undefined:()=>raw,()=>{calls++;value.proof.business={changed:true};raw=Buffer.from(json(value.proof));return{componentOnly:true};}));if(mode!=='changed-input')assert.equal(calls,0);}
});

test('FIELD RAW five maps are exact; forged array, omitted pilot map key and changed package reject before callback',()=>{
 for(const mode of ['invented-array','missing-pilot','changed-source']){const value=syntheticNative('PG_FIELD');if(mode==='invented-array')value.proof.sourceManifest=[];if(mode==='missing-pilot')delete value.proof.sourceSha256['src/lib/organization-pilot-coverage.mjs'];const raw=Buffer.from(json(value.proof));let calls=0;denied(()=>lineage.normalizeCaptureRuntimeNativeProof(value.contract,value.spec,value.proof,file=>mode==='changed-source'&&file==='src/lib/organization-pilot-coverage.mjs'?Buffer.from('foreign source'):read(file),()=>raw,()=>{calls++;return{componentOnly:true};}));assert.equal(calls,0);}
});

test('historical verification reauthenticates the same outer reader on each call inside its owned scope',()=>{
 const c=current(),file=c.planBudgetCurrentRevision.captureQualityRuntime.sourceHistory[0].path;let changed=false,calls=0;const actual=filePath=>changed&&filePath===file?Buffer.from('changed during callback'):read(filePath);
 denied(()=>lineage.withCaptureRuntimePreviousSources(c,actual,(parent,parentRead)=>{lineage.verifyPlanBudgetCurrentSources(parent,parentRead);calls++;changed=true;lineage.verifyPlanBudgetCurrentSources(parent,parentRead);calls++;}),'CURRENT_REFERENCE_'+file);assert.equal(calls,1);
 changed=false;lineage.withCaptureRuntimePreviousSources(c,actual,(parent,parentRead)=>{lineage.verifyPlanBudgetCurrentSources(parent,parentRead);calls++;});assert.equal(calls,2);
});

test('missing native evidence has a stable lineage denial and unrelated contract mutations retain the literal old denial',()=>{
 const c=current(),producer='scripts/verify-material-inventory-postgres.mjs';assert.throws(()=>lineage.normalizePlanBudgetPilotNativeProof(c,producer,{status:'PASS'},file=>{if(file==='.vercel/material-inventory-evidence/postgres.json')throw Object.assign(new Error('Missing evidence'),{code:'ENOENT'});return read(file);}),{code:'PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED',reason:'ACTUAL_NATIVE_PROOF_BYTES'});
 const invalid=current();invalid.sourceCommit='f'.repeat(40);assert.throws(()=>lineage.restorePlanBudgetPreviousContract(invalid),{code:'PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED',reason:'ACCEPTANCE_COMPLETE_1B_CONTRACT'});
 const malformed=current();malformed.planBudgetCurrentRevision.references[0].currentSha256='f'.repeat(64);let reads=0;assert.throws(()=>lineage.normalizePlanBudgetPilotNativeProof(malformed,producer,{status:'PASS'},()=>{reads++;return null;}),{code:'PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED',reason:'IMMUTABLE_COMPANION'});assert.equal(reads,0);
});

test('the intake count metadata helper preserves exact parent specs and rejects a mixed current set',()=>{
 const c=current(),parent=lineage.restoreCaptureRuntimePreviousContract(c),spec=c.extension.proofs.find(row=>row.kind==='PG_INTAKE'),prior=parent.extension.proofs.find(row=>row.kind==='PG_INTAKE');assert.equal(lineage.intakeWithdrawalCurrentCheckCount(spec),35);assert.equal(lineage.intakeWithdrawalCurrentCheckCount(prior),35);const advance=c.planBudgetCurrentRevision.captureQualityRuntime.proofSourceSetAdvances.find(row=>row.kind==='PG_INTAKE');assert.throws(()=>lineage.intakeWithdrawalCurrentCheckCount({...spec,sourceFiles:[...prior.sourceFiles,advance.additions[0]].sort()}),{code:'PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED',reason:'EXACT_CURRENT_SOURCE_SET_PG_INTAKE'});
});

test('a Windows CRLF checkout preserves the literal LF parent-factory pin without weakening its inverse',async()=>{
 const directory=mkdtempSync(path.join(tmpdir(),'capture-runtime-crlf-')),moduleFile=path.join(directory,'plan-budget-current-ci-lineage.mjs'),companionFile=path.join(directory,'plan-budget-current-ci-reviewed.mjs');
 try{const original=read('scripts/lib/plan-budget-current-ci-lineage.mjs').toString('utf8').replaceAll('\r\n','\n');writeFileSync(moduleFile,original.replaceAll('\n','\r\n'),{flag:'wx'});writeFileSync(companionFile,read('scripts/lib/plan-budget-current-ci-reviewed.mjs'),{flag:'wx'});const crlf=await import(pathToFileURL(moduleFile).href),c=current(),parent=crlf.restoreCaptureRuntimePreviousContract(c);assert.equal(sha(json(parent)),'d5ef59b111dd3e25b8f08854d3e8e4df4838a7913e3e22b76299c1916b9913d2');assert.equal(Object.keys(crlf.createCaptureRuntimeGate(c.planBudgetCurrentRevision).parentGate).length,41);assert.equal(readFileSync(moduleFile).toString('utf8').replaceAll('\r\n','\n'),original);}
 finally{for(const file of [moduleFile,companionFile]){assert.equal(path.dirname(file),directory);try{unlinkSync(file);}catch(error){if(error.code!=='ENOENT')throw error;}}rmdirSync(directory);}
});

test('the actual budget UI collector includes every current source within its unchanged eight MiB text bound',()=>{
 const c=current(),spec=lineage.planBudgetCompiledProof(c),binding=planBudgetUiSourceBinding(read);assert.deepEqual(binding.sourceManifest.map(row=>row.path),spec.sourceFiles);assert.ok(read('scripts/lib/plan-budget-current-ci-reviewed.mjs').length<=8*1024*1024);for(const row of binding.sourceManifest)assert.equal(row.sha256,sha(Buffer.from(read(row.path).toString('utf8').replaceAll('\r\n','\n'))),row.path);
});

test('the current browser binding joins exact39 investment leaves to historical32 and denies stale metadata and a changed unlisted leaf',()=>{
 const c=current();assert.equal(lineage.verifyPlanBudgetCurrentSources(c,read).referenceCount,c.planBudgetCurrentRevision.references.length);const row=c.planBudgetCurrentRevision.captureQualityRuntime.browserSourceAdvances[0],files=weeklyCypInvestmentUiSourceFiles(read),binding=lineage.planBudgetCurrentBrowserBinding(c,{});assert.equal(files.length,39);assert.deepEqual(files,row.currentFiles);assert.equal(binding.investmentSourceCount,39);assert.equal(binding.investmentSourcePathsSha256,sha(JSON.stringify(files)));assert.equal(row.previousFiles.length,32);
 lineage.withCaptureRuntimePreviousSources(c,read,(parent,parentRead)=>{const previous=lineage.planBudgetCurrentBrowserBinding(parent,{});assert.equal(previous.investmentSourceCount,32);assert.deepEqual(weeklyCypInvestmentUiSourceFiles(parentRead),row.previousFiles);assert.equal(previous.investmentSourcePathsSha256,sha(JSON.stringify(row.previousFiles)));});
 const leaf=files.find(file=>!c.planBudgetCurrentRevision.references.some(ref=>ref.path===file));assert.ok(leaf,'One exact browser leaf outside the common reference set is required');denied(()=>lineage.verifyPlanBudgetCurrentSources(c,file=>file===leaf?Buffer.concat([read(file),Buffer.from('\n// controlled browser leaf mutation\n')]):read(file)),'CURRENT_BROWSER_SOURCE_'+leaf);
 const omitted=structuredClone(c);delete omitted.planBudgetCurrentRevision.captureQualityRuntime.browserSourceAdvances;denied(()=>lineage.planBudgetCurrentBrowserBinding(omitted,{}),'IMMUTABLE_COMPANION');const stale=structuredClone(c.planBudgetCurrentRevision),old=stale.captureQualityRuntime.browserSourceAdvances[0];old.currentFiles=[...old.previousFiles];old.additions=[];denied(()=>lineage.createCaptureRuntimeGate(stale),'EXACT_ADDITIVE_BROWSER_SOURCE_SET');
});
