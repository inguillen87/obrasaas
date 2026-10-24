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

// Dependency-source controls use current physical bytes and the public gate.
// They do not run a provider, browser, compiler transform or CI lane.
const dependencyLockFile='package-lock.json',dependencyLockRoot='/packageLockSha256',dependencyLiteral731='dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449';
function dependencyLockMutation(edit){const value=current();edit(value);const gate=lineage.createCaptureRuntimeGate(value.planBudgetCurrentRevision);return gate.restoreParentContract(value);}
test('dependency lock CURRENT authenticates before its exact owned literal731 parent',()=>{
 const value=current(),raw=read(dependencyLockFile),before=json(value),pin=lineage.planBudgetCurrentSourcePin(value,{path:dependencyLockFile,sha256:dependencyLiteral731});
 assert.notEqual(pin,dependencyLiteral731);assert.equal(sha(raw.toString('utf8').replaceAll('\r\n','\n')),pin);assert.equal(value.packageLockSha256,pin);
 lineage.withCaptureRuntimePreviousSources(value,read,(parent,parentRead)=>{assert.equal(parent.packageLockSha256,dependencyLiteral731);assert.equal(sha(parentRead(dependencyLockFile)),dependencyLiteral731);assert.equal(sha(json(parent)),'d5ef59b111dd3e25b8f08854d3e8e4df4838a7913e3e22b76299c1916b9913d2');});
 assert.equal(json(value),before);assert.deepEqual(read(dependencyLockFile),raw);
});
test('dependency lock advance rejects an arbitrary extra root pointer',()=>{
 denied(()=>dependencyLockMutation(value=>{value.unreviewedDependency='changed';value.planBudgetCurrentRevision.captureQualityRuntime.contractPatches.push({pointer:'/unreviewedDependency',previous:'old',current:'changed'});}),'PATCH_POINTER');
});
test('dependency lock advance cannot authorize the requirements root',()=>{
 denied(()=>dependencyLockMutation(value=>{const previous=value.requirementsSha256;value.requirementsSha256='f'.repeat(64);value.planBudgetCurrentRevision.captureQualityRuntime.contractPatches.push({pointer:'/requirementsSha256',previous,current:value.requirementsSha256});}),'PATCH_POINTER');
});
test('dependency lock advance rejects a duplicate lock-root patch',()=>{
 denied(()=>dependencyLockMutation(value=>{const patches=value.planBudgetCurrentRevision.captureQualityRuntime.contractPatches;patches.push(structuredClone(patches.find(row=>row.pointer===dependencyLockRoot)));}),'DEPENDENCY_LOCK_EXACT_CURRENT_PATCH');
});
test('dependency lock advance rejects a current root hash inconsistent with its history',()=>{
 denied(()=>dependencyLockMutation(value=>{const patch=value.planBudgetCurrentRevision.captureQualityRuntime.contractPatches.find(row=>row.pointer===dependencyLockRoot);patch.current='f'.repeat(64);value.packageLockSha256=patch.current;}),'DEPENDENCY_LOCK_EXACT_CURRENT_PATCH');
});
test('dependency lock advance requires its MODIFIED source history',()=>{
 denied(()=>dependencyLockMutation(value=>{const runtime=value.planBudgetCurrentRevision.captureQualityRuntime;runtime.sourceHistory=runtime.sourceHistory.filter(row=>row.path!==dependencyLockFile);}),'DEPENDENCY_LOCK_HISTORY_REQUIRED');
});
test('dependency lock reader mutation after an owned callback is rejected on the final reread',()=>{
 const value=current(),raw=read(dependencyLockFile);let changed=false,called=false;
 const reader=file=>file===dependencyLockFile&&changed?Buffer.concat([raw,Buffer.from(' ') ]):read(file);
 denied(()=>lineage.withCaptureRuntimePreviousSources(value,reader,()=>{called=true;changed=true;}));assert.equal(called,true);assert.deepEqual(read(dependencyLockFile),raw);
});

const mobileValidationRoot='/integratedIdentityCurrentRevision/validationDeltas/25/currentSha256';
test('mobile review advance cannot authorize another validation index',()=>{
 denied(()=>dependencyLockMutation(value=>{value.planBudgetCurrentRevision.captureQualityRuntime.contractPatches.find(row=>row.pointer===mobileValidationRoot).pointer='/integratedIdentityCurrentRevision/validationDeltas/24/currentSha256';}),'MOBILE_REVIEW_PATCH_REQUIRED');
});
test('mobile review advance requires the exact current validation path',()=>{
 denied(()=>dependencyLockMutation(value=>{value.integratedIdentityCurrentRevision.validationDeltas[25].path='scripts/foreign-mobile-review.mjs';}),'MOBILE_REVIEW_EXACT_VALIDATION_PATH_AND_CURRENT');
});
test('mobile review advance rejects a validation current hash inconsistent with the frozen current source',()=>{
 denied(()=>dependencyLockMutation(value=>{value.integratedIdentityCurrentRevision.validationDeltas[25].currentSha256='f'.repeat(64);}),'MOBILE_REVIEW_EXACT_VALIDATION_PATH_AND_CURRENT');
});

const identityEvidenceAdvance='/evidenceProducers/68/producerSha256',identityBrowserAdvance='/identityDestinationUxCurrentRevision/browser/producerDelta/currentProducerSha256';
test('identity-only evidence advance cannot authorize another evidence index',()=>{
 denied(()=>dependencyLockMutation(value=>{value.planBudgetCurrentRevision.captureQualityRuntime.contractPatches.find(row=>row.pointer===identityEvidenceAdvance).pointer='/evidenceProducers/67/producerSha256';}),'IDENTITY_ONLY_EXACT_CURRENT_PATCHES');
});
test('identity-only evidence advance requires its exact producer path',()=>{
 denied(()=>dependencyLockMutation(value=>{value.evidenceProducers[68].producer='scripts/foreign-identity-producer.mjs';}),'IDENTITY_ONLY_EXACT_EVIDENCE_AND_CURRENT');
});
test('identity-only evidence advance rejects an inconsistent current source hash',()=>{
 denied(()=>dependencyLockMutation(value=>{value.evidenceProducers[68].producerSha256='f'.repeat(64);}),'IDENTITY_ONLY_EXACT_EVIDENCE_AND_CURRENT');
});
test('identity-only browser advance cannot authorize a nested alternate index',()=>{
 denied(()=>dependencyLockMutation(value=>{value.planBudgetCurrentRevision.captureQualityRuntime.contractPatches.find(row=>row.pointer===identityBrowserAdvance).pointer='/identityDestinationUxCurrentRevision/browser/producerDelta/0/currentProducerSha256';}),'IDENTITY_ONLY_EXACT_CURRENT_PATCHES');
});
test('identity-only browser advance requires its exact producer path',()=>{
 denied(()=>dependencyLockMutation(value=>{value.identityDestinationUxCurrentRevision.browser.producerDelta.producer='scripts/foreign-identity-producer.mjs';}),'IDENTITY_ONLY_EXACT_BROWSER_DELTA_AND_CURRENT');
});
test('identity-only browser advance rejects an inconsistent current source hash',()=>{
 denied(()=>dependencyLockMutation(value=>{value.identityDestinationUxCurrentRevision.browser.producerDelta.currentProducerSha256='f'.repeat(64);}),'IDENTITY_ONLY_EXACT_BROWSER_DELTA_AND_CURRENT');
});

// The private Main selftest helper is compiled from its exact authenticated AST
// for these unit controls. It has no export, source-reader cache or new loader.
// Actual source authority and screenshots still use the public C8/Home methods.
import {parse as parseIdentityFactsMain} from '@babel/parser';
import {IDENTITY_ONLY_CHECKS as publicIdentityFactChecks,validateExtensionProof as validatePublicIdentityFactProof} from '../.github/scripts/verify-workspace-ci-parallelization.mjs';
import {identityDestinationUxBrowserShadow as identityFactDestinationShadow,validateIdentityDestinationUxBrowserSupplement as validateIdentityFactSupplement} from '../scripts/lib/home-decisions-current-ci-lineage.mjs';

const identityFactsMainPath='.github/scripts/verify-workspace-ci-parallelization.mjs';
function identityFactsRead(file){const value=read(file);return Buffer.isBuffer(value)?Buffer.from(value.toString('utf8').replaceAll('\r\n','\n')):value;}
function identityFactsFixture(){
 const contract=current(),before=json(contract);lineage.verifyPlanBudgetCurrentSources(contract,identityFactsRead);
 const source=identityFactsRead(identityFactsMainPath).toString('utf8'),tree=parseIdentityFactsMain(source,{sourceType:'module'}),declarations=new Map(),functions=new Map();
 for(const top of tree.program.body){const n=top.type==='ExportNamedDeclaration'?top.declaration:top;if(n?.type==='VariableDeclaration')for(const d of n.declarations){if(d.id.type==='Identifier')declarations.set(d.id.name,'const '+source.slice(d.start,d.end)+';');}else if(n?.type==='FunctionDeclaration')functions.set(n.id.name,source.slice(n.start,n.end));}
 const names=['IDENTITY_ARTIFACTS','IDENTITY_ONLY_CHECK_COUNT','identityPrivacyChecks','identityScreenshotNames','IDENTITY_ONLY_CHECKS','canonical','clone','deny','equal','exactKeys'],parts=names.map(name=>{assert.ok(declarations.has(name),name);return declarations.get(name);});
 for(const name of ['validateIdentityProof','withIdentityScenarioFacts']){assert.ok(functions.has(name),name);parts.push(functions.get(name));}
 parts.push('return {run:withIdentityScenarioFacts,checks:IDENTITY_ONLY_CHECKS,screenshots:identityScreenshotNames.map(name=>IDENTITY_ARTIFACTS[0]+name)};');
 const tools=Function('assert','captureBudget','validateIdentityDestinationUxBrowserSupplement','"use strict";\n'+parts.join('\n'))(assert,lineage,validateIdentityFactSupplement);
 assert.deepEqual(tools.checks,publicIdentityFactChecks);assert.equal(tools.checks.length,103);assert.equal(json(contract),before);
 const spec=contract.extension.proofs.find(row=>row.kind==='UI_IDENTITY_ONLY'),expectedHead=contract.extension.baseHead,shadow=identityFactDestinationShadow(contract);
 const proof={status:'PASS',environment:'isolated-browser-real-components-with-controlled-session-and-http',sourceRevision:expectedHead,sourceState:'EXACT_CI_SOURCE',trackedClean:true,dirtyTrackedPaths:[],widths:[320,390,768,1280],totalCheckCount:103,checks:structuredClone(tools.checks),sourceManifest:spec.sourceFiles.map(path=>({path,sha256:sha(identityFactsRead(path))})),harnessSha256:spec.producerSha256,pageErrors:[],requestErrors:[],screenshots:tools.screenshots,actualPageReloadTested:true,nativeIndexedDbReceiptReferencesTested:true,automaticRecoveryPostCount:0,postgresExecuted:false,realClerkLogin:false,realEmailDelivery:false,productionDataWritten:false,realProviderCalls:0,physicalWhatsAppVerified:false,fixtureRemoved:true,browserClosed:true,serverStopped:true,...shadow.fields};
 const readEvidence=file=>shadow.evidence.get(file)||null;
 const invoke=(callback,ports={})=>tools.run({contract,spec,proof,expectedHead,readSource:ports.readSource||identityFactsRead,readEvidence:ports.readEvidence||readEvidence},callback);
 lineage.verifyPlanBudgetCurrentSources(contract,identityFactsRead);assert.equal(identityFactsRead(identityFactsMainPath).toString('utf8'),source);
 return{contract,spec,proof,expectedHead,shadow,readEvidence,invoke};
}
const identityFactScopeDenied=(run,reason)=>assert.throws(run,error=>error.code==='SELFTEST_IDENTITY_FACT_SCOPE_REJECTED'&&error.reason===reason);

test('identity fact scope rejects an omitted actual source before entering its pure callback',()=>{
 const f=identityFactsFixture(),file=f.contract.planBudgetCurrentRevision.references[0].path;let entered=false;
 assert.throws(()=>f.invoke(()=>{entered=true;},{readSource:p=>p===file?null:identityFactsRead(p)}),{code:'PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED'});assert.equal(entered,false);
});
test('identity fact scope rejects changed actual source bytes before entering its pure callback',()=>{
 const f=identityFactsFixture(),file=f.contract.planBudgetCurrentRevision.references[0].path;let entered=false;
 assert.throws(()=>f.invoke(()=>{entered=true;},{readSource:p=>p===file?Buffer.concat([identityFactsRead(p),Buffer.from(' ') ]):identityFactsRead(p)}),{code:'PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED'});assert.equal(entered,false);
});
test('identity fact scope requires actual screenshot RAW before any pure callback',()=>{
 for(const replacement of [null,Buffer.from('foreign screenshot')]){const f=identityFactsFixture();let entered=false;assert.throws(()=>f.invoke(()=>{entered=true;},{readEvidence:()=>replacement}),{code:'IDENTITY_DESTINATION_UX_PROOF_REJECTED',reason:'SCREENSHOT_BYTES'});assert.equal(entered,false);}
});
test('identity fact scope final source authority still executes when its pure callback throws',()=>{
 const f=identityFactsFixture(),file=f.contract.planBudgetCurrentRevision.references[0].path;let changed=false,entered=false;
 const actual=p=>p===file&&changed?Buffer.concat([identityFactsRead(p),Buffer.from(' ') ]):identityFactsRead(p);
 assert.throws(()=>f.invoke(()=>{entered=true;changed=true;throw new Error('controlled callback failure');},{readSource:actual}),{code:'PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED',reason:'CURRENT_REFERENCE_'+file});assert.equal(entered,true);
});
test('identity fact scope rereads screenshot RAW after pure callbacks instead of reusing acceptance',()=>{
 const f=identityFactsFixture();let changed=false,lateReads=0;
 const evidence=p=>{const raw=f.readEvidence(p);if(changed){lateReads++;return Buffer.concat([raw,Buffer.from(' ') ]);}return raw;};
 assert.throws(()=>f.invoke(()=>{changed=true;},{readEvidence:evidence}),{code:'IDENTITY_DESTINATION_UX_PROOF_REJECTED',reason:'SCREENSHOT_BYTES'});assert.ok(lateReads>0);
});
test('identity fact scope propagates a genuine final source reader error',()=>{
 const f=identityFactsFixture(),file=f.contract.planBudgetCurrentRevision.references[0].path,sentinel=Object.assign(new Error('controlled final source I/O'),{code:'CONTROLLED_IDENTITY_FACT_EIO'});let changed=false;
 assert.throws(()=>f.invoke(()=>{changed=true;},{readSource:p=>{if(changed&&p===file)throw sentinel;return identityFactsRead(p);}}),error=>error===sentinel);
});
test('identity fact decoder and clone closure reject use after successful scope closure',()=>{
 const f=identityFactsFixture();let escaped,copy;assert.equal(f.invoke(facts=>{escaped=facts;copy=facts.cloneProof();facts.validateFacts(copy);}),undefined);
 identityFactScopeDenied(()=>escaped.cloneProof(),'CLOSED_SCOPE');identityFactScopeDenied(()=>escaped.validateFacts(copy),'CLOSED_SCOPE');
});
test('identity fact decoder and clone closure reject use after failed scope closure',()=>{
 const f=identityFactsFixture(),sentinel=new Error('controlled pure callback failure');let escaped,copy;
 assert.throws(()=>f.invoke(facts=>{escaped=facts;copy=facts.cloneProof();throw sentinel;}),error=>error===sentinel);
 identityFactScopeDenied(()=>escaped.cloneProof(),'CLOSED_SCOPE');identityFactScopeDenied(()=>escaped.validateFacts(copy),'CLOSED_SCOPE');
});
test('identity fact scope rejects async callbacks and thenable returns without invoking a continuation',()=>{
 const f=identityFactsFixture();let entered=false,thenCalls=0,escaped;
 identityFactScopeDenied(()=>f.invoke(async()=>{entered=true;}),'ASYNC_CALLBACK');assert.equal(entered,false);
 identityFactScopeDenied(()=>f.invoke(facts=>{escaped=facts;return{then(){thenCalls++;}};}),'SYNCHRONOUS_VOID_CALLBACK_REQUIRED');assert.equal(thenCalls,0);identityFactScopeDenied(()=>escaped.cloneProof(),'CLOSED_SCOPE');
});
test('identity fact scope keeps original119 and contract immutable and limits edits to checks',()=>{
 const f=identityFactsFixture();identityFactScopeDenied(()=>f.invoke(facts=>{const changed=facts.cloneProof();changed.harnessSha256='f'.repeat(64);facts.validateFacts(changed);}),'ONLY_CHECKS_MUTABLE');
 identityFactScopeDenied(()=>f.invoke(()=>{f.proof.harnessSha256='f'.repeat(64);}),'OBSERVED119_UNCHANGED');
 const g=identityFactsFixture();assert.throws(()=>g.invoke(()=>{g.contract.sourceCommit='f'.repeat(40);}),{code:'PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED',reason:'CONTRACT_AND_PARENT_UNCHANGED'});
});
test('identity fact scope preserves all206 omitted and altered scenario oracles on isolated clones',()=>{
 const f=identityFactsFixture(),before=json(f.proof),names=[];
 f.invoke(facts=>{for(const[index,row]of publicIdentityFactChecks.entries()){
  const omitted=facts.cloneProof();omitted.checks.splice(index,1);assert.throws(()=>facts.validateFacts(omitted),{code:'PROOF_IDENTITY_CHECKS'});names.push('scenario-'+index+'-omitted');
  const altered=facts.cloneProof();altered.checks[index]={...row,width:321};assert.throws(()=>facts.validateFacts(altered),{code:'PROOF_IDENTITY_CHECKS'});names.push('scenario-'+index+'-altered');
 }});assert.equal(names.length,206);assert.equal(new Set(names).size,206);assert.equal(json(f.proof),before);
});
test('identity public validators still accept complete103 and reject first omitted and last altered scenarios',()=>{
 const f=identityFactsFixture(),validate=proof=>validatePublicIdentityFactProof(f.spec,Buffer.from(JSON.stringify(proof)),{expectedHead:f.expectedHead,readSource:identityFactsRead,readEvidence:f.readEvidence});assert.equal(validate(f.proof).checks,103);
 const omitted=structuredClone(f.proof);omitted.checks.splice(0,1);assert.throws(()=>validate(omitted),{code:'PROOF_IDENTITY_CHECKS'});
 const altered=structuredClone(f.proof);altered.checks[altered.checks.length-1]={...altered.checks.at(-1),width:321};assert.throws(()=>validate(altered),{code:'PROOF_IDENTITY_CHECKS'});
});

// Exact eighteen protocol controls supplied by Field; only their import/root
// entry is ported to this existing test file. No business oracle is changed.
{
 const home=Object.freeze({identityDestinationUxBrowserShadow:identityFactDestinationShadow,validateIdentityDestinationUxBrowserSupplement:validateIdentityFactSupplement});
 const contract=JSON.parse(read(contractPath));
const producer='scripts/verify-workspace-identity-only-ui.mjs',parentSha='9e236a07c14417f23209a889de850820810f2ea978c1d44a4fe94688869ff3d8';
const history=contract.planBudgetCurrentRevision?.captureQualityRuntime?.sourceHistory?.filter(row=>row.path===producer)||[];
assert.equal(history.length,1,'HOLD: final CURRENT producer history is not installed');assert.equal(history[0].status,'MODIFIED');assert.equal(history[0].previousSha256,parentSha);assert.equal(history[0].previousBytes,77713);
function fixture(c=contract,reader=read){const shadow=home.identityDestinationUxBrowserShadow(c),spec=c.extension.proofs.find(row=>row.id==='identity-only-ui');assert.ok(spec);const proof={checks:[...spec.checkNames],totalCheckCount:spec.checkNames.length,harnessSha256:sha(reader(spec.producer)),sourceManifest:spec.sourceFiles.map(path=>({path,sha256:sha(reader(path))})),...shadow.fields};return{c,proof,evidence:shadow.evidence,reader,readEvidence:file=>shadow.evidence.get(file)||null};}
const validate=f=>home.validateIdentityDestinationUxBrowserSupplement(f.proof,f.c,{readSource:f.reader,readEvidence:f.readEvidence});
const denied=(f,reason)=>assert.throws(()=>validate(f),error=>error.code==='IDENTITY_DESTINATION_UX_PROOF_REJECTED'&&error.reason===reason);
const current=(edit,reason)=>{const f=fixture();edit(f);denied(f,reason);};
const row=f=>f.proof.destinationNavigation.checks[1],allGuideRows=f=>f.proof.destinationNavigation.checks.filter((_,index)=>index%4===1);
const four=[null,null,'t-p-a',null].map(afterTask=>({actor:'A',projectId:'p-a',afterTask}));
const two=[null,'t-p-a'].map(afterTask=>({actor:'A',projectId:'p-a',afterTask}));
test('protocol2 exact four reads and seven network rows retain the observed input',()=>{const f=fixture(),before=JSON.stringify(f.proof);for(const r of allGuideRows(f)){assert.deepEqual(r.append.projectReads,four);assert.equal(r.apiSequence.length,7);assert.equal(r.workspaceGets,6);assert.equal(r.participantGets,1);assert.equal(r.totalPosts,0);}const result=validate(f);assert.equal(JSON.stringify(f.proof),before);assert.deepEqual(result.checks,f.proof.checks);assert.equal(result.totalCheckCount,103);assert.equal(Object.hasOwn(result,'destinationNavigation'),false);});
test('protocol2 omitted project read is denied',()=>current(f=>row(f).append.projectReads.pop(),'ACTUAL_APPEND_CURSOR'));
test('protocol2 reordered nonidentical cursor read is denied',()=>current(f=>{const a=row(f).append.projectReads;[a[1],a[2]]=[a[2],a[1]];},'ACTUAL_APPEND_CURSOR'));
test('protocol2 additional project read is denied',()=>current(f=>row(f).append.projectReads.push(structuredClone(four[0])),'ACTUAL_APPEND_CURSOR'));
test('protocol2 duplicate base cannot replace the append cursor',()=>current(f=>{row(f).append.projectReads[2]=structuredClone(four[0]);},'ACTUAL_APPEND_CURSOR'));
test('protocol2 cannot reuse the historical two-read oracle',()=>current(f=>{row(f).append.projectReads=structuredClone(two);},'ACTUAL_APPEND_CURSOR'));
test('protocol2 cannot reuse the historical five-row network oracle',()=>current(f=>{const r=row(f);r.apiSequence.splice(4,1);r.apiSequence.splice(5,1);r.workspaceGets-=2;},'API_SEQUENCE'));
test('protocol2 extra network GET is denied',()=>current(f=>{const r=row(f);r.apiSequence.push(structuredClone(r.apiSequence[3]));r.workspaceGets++;},'API_SEQUENCE'));
test('protocol2 network POST is denied',()=>current(f=>{const r=row(f);r.apiSequence[3].method='POST';r.totalPosts=1;},'API_SEQUENCE'));
test('protocol2 foreign project in cursor facts is denied',()=>current(f=>{row(f).append.projectReads[2].projectId='p-b';},'ACTUAL_APPEND_CURSOR'));
test('protocol2 changed observed harness hash is denied',()=>current(f=>{f.proof.harnessSha256='f'.repeat(64);},'ACTUAL_CURRENT_HARNESS'));
test('protocol2 source history requires the exact producer predecessor',()=>{const f=fixture();f.c=structuredClone(f.c);f.c.planBudgetCurrentRevision.captureQualityRuntime.sourceHistory.find(row=>row.path===producer).previousSha256='f'.repeat(64);denied(f,'CURRENT_LIVE_SOURCE_HISTORY');});
test('protocol2 changed current metadata pin cannot reduce authority',()=>{const f=fixture();f.c=structuredClone(f.c);f.c.planBudgetCurrentRevision.references.find(row=>row.path===producer).currentSha256='f'.repeat(64);denied(f,'CURRENT_LIVE_SOURCE_JOIN');});
test('protocol2 changed source reader is denied before observations qualify',()=>{const f=fixture();f.reader=file=>file===producer?Buffer.concat([read(file),Buffer.from(' ')]):read(file);assert.throws(()=>validate(f),{code:'PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED'});});
test('protocol2 source drift after evidence is denied by the final fresh reread',()=>{const f=fixture();let changed=false;f.reader=file=>file===producer&&changed?Buffer.concat([read(file),Buffer.from(' ')]):read(file);f.readEvidence=file=>{changed=true;return f.evidence.get(file)||null;};assert.throws(()=>validate(f),{code:'PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED'});assert.equal(changed,true);});
test('protocol2 evidence callbacks cannot mutate the observed proof',()=>{const f=fixture();f.readEvidence=file=>{f.proof.unobservedExtra=true;return f.evidence.get(file)||null;};denied(f,'OBSERVED_PROOF_UNCHANGED');});
test('owned historical protocol1 retains exactly two reads and five network rows',()=>lineage.withCaptureRuntimePreviousSources(contract,read,(parent,parentRead)=>{const f=fixture(parent,parentRead),before=JSON.stringify(f.proof);for(const r of allGuideRows(f)){assert.deepEqual(r.append.projectReads,two);assert.equal(r.apiSequence.length,5);}const result=validate(f);assert.deepEqual(result.checks,f.proof.checks);assert.equal(JSON.stringify(f.proof),before);}));
test('owned historical protocol1 cannot accept current four-read facts',()=>lineage.withCaptureRuntimePreviousSources(contract,read,(parent,parentRead)=>{const f=fixture(parent,parentRead);row(f).append.projectReads=structuredClone(four);denied(f,'ACTUAL_APPEND_CURSOR');}));
// Schema2 controls are additional; all eighteen preceding test nodes are exact.
const delayedRows=f=>f.proof.destinationNavigation.checks.filter((_,index)=>index%4===0);
const delayed=f=>f.proof.destinationNavigation.checks[0].profileRead;
const currentProfileNavigation=[{hash:'#worker-channel-title',identityHidden:true,whatsappHidden:false,participantGets:0,heldProfileGets:0},{hash:'#participant-title',identityHidden:false,whatsappHidden:true,participantGets:1,heldProfileGets:1},{hash:'#worker-channel-title',identityHidden:true,whatsappHidden:false,participantGets:1,heldProfileGets:1}];
test('protocol2 explicitly observes identity navigation with one held profile GET',()=>{const f=fixture();assert.equal(f.proof.destinationNavigation.version,2);for(const r of delayedRows(f)){assert.deepEqual(Object.keys(r.profileRead).sort(),['activation','noHiddenProfileReadBeforeNavigation','navigation','heldBeforeNavigation','releasedAfterNavigation','beforeGeometry','afterGeometry'].sort());assert.equal(r.profileRead.activation,'EXPLICIT_IDENTITY_NAVIGATION');assert.equal(r.profileRead.noHiddenProfileReadBeforeNavigation,true);assert.deepEqual(r.profileRead.navigation,currentProfileNavigation);assert.equal(r.participantGets,1);assert.equal(r.totalPosts,0);}const before=JSON.stringify(f.proof);validate(f);assert.equal(JSON.stringify(f.proof),before);});
test('protocol2 cannot relabel its current observations as version1',()=>current(f=>{f.proof.destinationNavigation.version=1;},'SUPPLEMENT_MATRIX'));
test('protocol2 cannot reuse the historical four-key delayed profile',()=>current(f=>{delete delayed(f).activation;delete delayed(f).noHiddenProfileReadBeforeNavigation;delete delayed(f).navigation;},'DELAYED_PROFILE_SHAPE'));
test('protocol2 rejects profile activation without explicit identity navigation',()=>current(f=>{delayed(f).activation='HIDDEN_AUTOMATIC_READ';},'DELAYED_PROFILE_EXPLICIT_ACTIVATION'));
test('protocol2 rejects a hidden profile read before navigation',()=>current(f=>{delayed(f).noHiddenProfileReadBeforeNavigation=false;},'DELAYED_PROFILE_EXPLICIT_ACTIVATION'));
test('protocol2 requires the observed navigation array',()=>current(f=>{delayed(f).navigation=null;},'DELAYED_PROFILE_NAVIGATION'));
test('protocol2 cannot omit a navigation snapshot',()=>current(f=>{delayed(f).navigation.splice(1,1);},'DELAYED_PROFILE_NAVIGATION'));
test('protocol2 cannot reorder identity activation and return snapshots',()=>current(f=>{const a=delayed(f).navigation;[a[1],a[2]]=[a[2],a[1]];},'DELAYED_PROFILE_NAVIGATION'));
test('protocol2 cannot append an unobserved navigation snapshot',()=>current(f=>{delayed(f).navigation.push(structuredClone(currentProfileNavigation[2]));},'DELAYED_PROFILE_NAVIGATION'));
test('protocol2 navigation snapshots reject additional fields',()=>current(f=>{delayed(f).navigation[0].unobserved=true;},'DELAYED_PROFILE_NAVIGATION_ROW'));
test('protocol2 requires zero participant GETs before identity activation',()=>current(f=>{delayed(f).navigation[0].participantGets=1;},'DELAYED_PROFILE_NAVIGATION'));
test('protocol2 requires identity to remain hidden before activation',()=>current(f=>{delayed(f).navigation[0].identityHidden=false;},'DELAYED_PROFILE_NAVIGATION'));
test('protocol2 requires a real held GET during the visible identity snapshot',()=>current(f=>{delayed(f).navigation[1].heldProfileGets=0;},'DELAYED_PROFILE_NAVIGATION'));
test('protocol2 requires return to WhatsApp before profile release',()=>current(f=>{delayed(f).navigation[2].hash='#participant-title';},'DELAYED_PROFILE_NAVIGATION'));
test('protocol2 preserves the original final geometry and focus guard',()=>current(f=>{delayed(f).afterGeometry.focused=false;},'VISIBLE_FOCUSED_DESTINATION'));
test('owned historical protocol1 cannot relabel its observations as version2',()=>lineage.withCaptureRuntimePreviousSources(contract,read,(parent,parentRead)=>{const f=fixture(parent,parentRead);f.proof.destinationNavigation.version=2;denied(f,'SUPPLEMENT_MATRIX');}));
test('owned historical protocol1 rejects the expanded current profile shape',()=>lineage.withCaptureRuntimePreviousSources(contract,read,(parent,parentRead)=>{const f=fixture(parent,parentRead);assert.equal(f.proof.destinationNavigation.version,1);assert.deepEqual(Object.keys(delayed(f)).sort(),['heldBeforeNavigation','releasedAfterNavigation','beforeGeometry','afterGeometry'].sort());Object.assign(delayed(f),{activation:'EXPLICIT_IDENTITY_NAVIGATION',noHiddenProfileReadBeforeNavigation:true,navigation:structuredClone(currentProfileNavigation)});denied(f,'DELAYED_PROFILE_SHAPE');}));

}
