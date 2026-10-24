import {types as earlyDtoTypes} from 'node:util';
import {WORKSITE_LIVE_HOURS_CURRENT_SECTION,verifyWorksiteLiveHoursCurrentSources as worksiteSourceCheck0,verifyWorksiteLiveHoursActualClosure as worksiteSourceCheck1} from './lib/worksite-live-hours-current-ci-lineage.mjs';
function checkWorksiteSource(action){try{return action();}catch(error){if(error.code==='WORKSITE_LIVE_HOURS_CURRENT_CI_LINEAGE_REJECTED')reject(false,error.message);throw error;}}
const verifyWorksiteLiveHoursCurrentSources=(...args)=>checkWorksiteSource(()=>worksiteSourceCheck0(...args));
const verifyWorksiteLiveHoursActualClosure=(...args)=>checkWorksiteSource(()=>worksiteSourceCheck1(...args));
import {withCaptureRuntimePreviousSources,planBudgetCurrentSourcePin} from './lib/plan-budget-current-ci-lineage.mjs';
import {WORKSPACE_CONTINUITY_FOCUSED_UI} from './lib/workspace-continuity-current-ci-lineage.mjs';
import {WHATSAPP_FIELD_CONTINUITY_FOCUSED_UI} from './lib/whatsapp-field-continuity-current-ci-lineage.mjs';
import {HOME_DECISIONS_CURRENT_SECTION,HOME_DECISIONS_CURRENT_REVISION as reviewedHomeDecisions,normalizeHomeDecisionsFocusedRaw} from './lib/home-decisions-current-ci-lineage.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {existsSync,lstatSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from '@babel/parser';
import {focusedWorkspaceUiCiOptions,focusedWorkspaceUiSourceClosure,focusedWorkspaceUiSourceFiles,focusedCompanyBootstrapUiSourceClosure,focusedWorkspaceTaskPagingCopy,FOCUSED_WORKSPACE_WIDTHS} from './verify-focused-workspace-ui.mjs';

export const FOCUSED_WORKSPACE_CI_VERSION='focused-workspace-ci-v3';
export const FOCUSED_WORKSPACE_CI_KIND='UI_FOCUSED_WORKSPACE';
export const FOCUSED_WORKSPACE_CI_PROOF_ID='focused-workspace-ui';
export const FOCUSED_WORKSPACE_CI_EVIDENCE='.vercel/private/focused-workspace-ui-evidence/';
const producer='scripts/verify-focused-workspace-ui.mjs',runner='scripts/verify-focused-workspace-ci.mjs';
const contractPath='.github/workspace-acceptance-contract.json';
const previousUnitFiles=Object.freeze(['tests/production-focused-workspace-navigation.test.mjs','tests/production-focused-workspace-ui.test.mjs','tests/production-focused-workspace-ci.test.mjs']);
const continuityUnitFiles=Object.freeze([...previousUnitFiles,'tests/production-focused-workspace-continuity-ui.test.mjs','tests/production-company-bootstrap-receipt.test.mjs']);
const unitFiles=Object.freeze([...continuityUnitFiles,'tests/production-focused-workspace-task-pagination.test.mjs']);
const sha=value=>createHash('sha256').update(value).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const reject=(ok,message)=>{if(!ok)throw Object.assign(new Error(message),{code:'FOCUSED_WORKSPACE_CI_REJECTED'});};
const keys=(value,expected,label)=>reject(plain(value)&&same(Object.keys(value).sort(),[...expected].sort()),'Exact '+label+' keys required');
const safe=value=>typeof value==='string'&&value!==''&&!value.includes('\\')&&!value.includes('\0')&&!path.posix.isAbsolute(value)&&path.posix.normalize(value)===value&&!value.startsWith('../');
const bytes=(reader,file)=>{reject(safe(file),'Unsafe source or evidence path');const value=reader(file);reject(Buffer.isBuffer(value),'Missing actual bytes: '+file);return value;};
const refs=(files,reader)=>files.map(file=>({path:file,sha256:sha(bytes(reader,file))}));
export function focusedHomeDecisionsRaw(raw,{readSource,readEvidence,directory}){
 const contract=JSON.parse(bytes(readSource,contractPath));reject(Object.hasOwn(contract,HOME_DECISIONS_CURRENT_SECTION),'The reviewed current home decisions layer is required');
 try{return normalizeHomeDecisionsFocusedRaw(raw,{contract,readSource,readEvidence,directory});}catch(error){if(error.code==='HOME_DECISIONS_CURRENT_CI_LINEAGE_REJECTED')reject(false,error.message);throw error;}
}

export const FOCUSED_WORKSPACE_CHECK_NAMES=Object.freeze(FOCUSED_WORKSPACE_WIDTHS.flatMap(width=>[
 'hidden-panel-headings-absent-from-accessibility-tree-'+width,
 'one-mounted-visible-overview-and-hidden-panels-'+width,
 'identity-deep-link-history-no-mutation-'+width,
 'legacy-plan-import-fragment-opens-schedule-'+width,
 'nonadmin-cannot-see-billing-or-integration-navigation-'+width,
 'schedule-draft-survives-section-navigation-without-POST-'+width,
 'no-project-hint-keeps-an-explicit-usable-project-picker-'+width,
 'company-plan-and-recovery-without-selected-project-company-without-selection-'+width,
 'company-plan-and-recovery-without-selected-project-empty-company-'+width,
 'three-step-synthetic-identity-explicit-consents-and-unknown-receipt-survive-navigation-'+width
]));
export function normalizeFocusedWorkspaceChecks(checks){
 reject(Array.isArray(checks)&&checks.length===FOCUSED_WORKSPACE_CHECK_NAMES.length,'All original browser observations are required');
 return checks.map((check,index)=>{
  const expected=FOCUSED_WORKSPACE_CHECK_NAMES[index];
  if(expected.startsWith('hidden-panel-headings-')){
   reject(typeof check==='string'&&check.startsWith(expected+':'),'Original accessibility observation required');
   const count=check.slice(expected.length+1);reject(/^[1-9][0-9]*$/.test(count)&&Number.isSafeInteger(Number(count))&&Number(count)>=5,'Hidden headings must be absent from the actual accessibility tree');
  }else reject(check===expected,'Original browser check order or identity changed');
  return expected;
 });
}

// The v1 normalizer above remains an explicit historical 20-check API. Current
// evidence requires a separately frozen matrix and the complete additive suffix.
function currentFocusedMetadata(){
 const value=WHATSAPP_FIELD_CONTINUITY_FOCUSED_UI,previous=WORKSPACE_CONTINUITY_FOCUSED_UI;
 reject(value?.status==='REVIEWED_FROZEN_CURRENT_SOURCE'&&value.ciVersion===FOCUSED_WORKSPACE_CI_VERSION&&Number.isSafeInteger(value.rawVersion)&&value.rawVersion>previous.rawVersion&&value.previousRawVersion===previous.rawVersion&&value.previousCheckCount===20&&value.previousTotalCheckCount===previous.checkNames.length,'Frozen full current and separate previous45 browser evidence are required');
 reject(same(value.previousCheckNames,previous.checkNames)&&same(value.widths,FOCUSED_WORKSPACE_WIDTHS)&&same(value.continuityWidths,previous.continuityWidths)&&same(value.continuityCheckNames,previous.continuityCheckNames)&&same(value.taskPagingWidths,[320,390,1440])&&same(value.previousUnitFiles,previousUnitFiles)&&same(value.continuityUnitFiles,continuityUnitFiles)&&same(value.unitFiles,unitFiles),'Historical20/45 matrices and separate current task-page sources required');
 reject(Array.isArray(value.taskPagingCheckNames)&&value.taskPagingCheckNames.length>0&&Array.isArray(value.checkNames)&&new Set(value.checkNames).size===value.checkNames.length&&same(value.checkNames,[...previous.checkNames,...value.taskPagingCheckNames]),'Complete frozen current task-page browser matrix required');
 reject(Array.isArray(value.requestMatrix)&&value.requestMatrix.length>previous.requestMatrix.length&&same(value.requestMatrix.slice(0,previous.requestMatrix.length),previous.requestMatrix)&&value.requestMatrix.slice(previous.requestMatrix.length).every(row=>row.method==='GET')&&Array.isArray(value.screenshotNames)&&same(value.screenshotNames.slice(0,previous.screenshotNames.length),previous.screenshotNames)&&new Set(value.screenshotNames).size===value.screenshotNames.length&&same(value.requestProjectionFieldsOmitted,previous.requestProjectionFieldsOmitted),'All original request/screenshot facts and GET-only task-page additions required');
 return value;
}
export function normalizeFocusedWorkspaceCurrentChecks(checks){
 const value=currentFocusedMetadata();reject(Array.isArray(checks)&&checks.length===value.checkNames.length,'All current browser observations required');
 const previous=normalizeFocusedWorkspaceChecks(checks.slice(0,value.previousCheckCount));reject(same(checks.slice(value.previousCheckCount,value.previousTotalCheckCount),value.continuityCheckNames)&&same(checks.slice(value.previousTotalCheckCount),value.taskPagingCheckNames),'Every historical45 and additive task-page observation required in order');return [...previous,...checks.slice(value.previousCheckCount)];
}
function validateFocusedCurrentRequests(requests,value){
 reject(Array.isArray(requests)&&requests.length===value.requestMatrix.length,'Every original controlled request must remain in the current matrix');
 const operations=[],references=[];
 const projected=requests.map((row,index)=>{
  reject(plain(row),'Actual request facts must be objects');const expected=value.requestMatrix[index],wizard=row.mode==='wizard'&&row.method==='POST',dynamic=wizard?value.requestProjectionFieldsOmitted:[];
  keys(row,[...Object.keys(expected),...dynamic],'current original request');
  if(wizard){reject(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(row.operationId)&&/^[a-f0-9]{64}$/.test(row.recoveryReferenceSha256)&&Array.isArray(row.syntheticImageSha256)&&row.syntheticImageSha256.length===3&&new Set(row.syntheticImageSha256).size===3&&row.syntheticImageSha256.every(hash=>typeof hash==='string'&&/^[a-f0-9]{64}$/.test(hash))&&row.explicitFinalStep===true&&row.actualRecoveryJournalReferencePreserved===true,'The explicit wizard UUID, synthetic images and retained unknown receipt are required');operations.push(row.operationId);references.push(row.recoveryReferenceSha256);}
  return Object.fromEntries(Object.entries(row).filter(([key])=>!dynamic.includes(key)));
 });
 reject(same(projected,value.requestMatrix)&&operations.length===2&&new Set(operations).size===2&&new Set(references).size===2,'Exact current request facts and separate unknown operation references required');
}
function validateFocusedTaskPaging(raw,current,readSource){
 reject(raw.previousTotalCheckCount===current.previousTotalCheckCount&&same(raw.taskPagingWidths,current.taskPagingWidths)&&same(raw.taskPagingCheckLedger,current.taskPagingCheckNames),'Exact previous45 and complete current task-page matrix required');
 const fixture=raw.taskPagingFixture;keys(fixture,['version','route','actualParentAndPagerCopies','copiedSources','overrides','pageSha256','consumerAuthority','original45TreeUnmodified'],'actual parent task-page fixture');
 const actual=focusedWorkspaceTaskPagingCopy(readSource),expected=current.taskPagingFixture;
 reject(fixture.version===1&&fixture.route==='/task-pages'&&fixture.actualParentAndPagerCopies===true&&fixture.original45TreeUnmodified===true&&fixture.pageSha256===expected.pageSha256&&fixture.consumerAuthority===expected.consumerAuthority,'The exact second tree and controlled-consumer boundary must remain explicit');
 reject(same(fixture.copiedSources,actual.files.map(row=>({path:row.path,sha256:sha(row.bytes)}))),'Every original parent and pager RAW copy must equal current source');
 const overrides=actual.overrides.map(row=>({path:row.path,exportName:row.exportName,originalSha256:sha(bytes(readSource,row.path)),controlledConsumerSha256:sha(row.source)}));reject(overrides.length===2&&same(fixture.overrides,overrides),'Exactly the two reviewed controlled consumers and their original RAW sources are permitted');
}
function validateFocusedCurrentCleanup(cleanup){
 reject(cleanup?.browserClosed===true&&cleanup.serverClosed===true&&cleanup.gracefulCloseAcknowledged===true&&cleanup.fixtureRemoved===true&&cleanup.fixtureCleanupProof?.fixtureRemoved===true,'Positive owned fixture cleanup required');
 const proof=cleanup.fixtureCleanupProof;reject(proof.postcondition?.absent===true&&Array.isArray(proof.attempts)&&proof.attempts.length>=1&&proof.attempts.length<=3,'Current bounded owned fixture absence required');
 for(const[index,row]of proof.attempts.entries()){keys(row,['attempt','phase','postcondition','removalAttempted','retryScheduled','rmCompleted'],'owned cleanup attempt');reject(row.attempt===index+1&&typeof row.removalAttempted==='boolean'&&typeof row.rmCompleted==='boolean'&&typeof row.retryScheduled==='boolean','Sequential actual owned cleanup attempts required');if(index===proof.attempts.length-1)reject(row.postcondition==='ABSENT'&&row.retryScheduled===false&&(row.phase==='POSTCONDITION'&&row.removalAttempted&&row.rmCompleted||row.phase==='GUARD'&&!row.removalAttempted&&!row.rmCompleted),'Final owned fixture absent postcondition required');else reject(row.phase==='DELAY'&&row.postcondition==='PRESENT'&&row.removalAttempted&&row.rmCompleted&&row.retryScheduled,'Every bounded retry follows guarded successful removal');}
}

const controlledBootstrapFixture='tests/production-company-bootstrap-receipt.test.mjs';
const controlledBootstrapPanel='src/app/(identity)/cuenta/company-bootstrap-panel.js';
const controlledBootstrapCompiler='next/dist/build/swc/index.js';
// This exact AST prefix authenticates the single source-to-SWC-to-data-module
// chain. The complete original unit and lock bytes are separately pinned.
const controlledBootstrapTransformPrefix="import assert from 'node:assert/strict';\nimport {readFileSync} from 'node:fs';\nimport test from 'node:test';\nimport React from 'react';\nimport {renderToStaticMarkup} from 'react-dom/server';\nimport {parse} from '@babel/parser';\nimport {loadBindings,transform} from 'next/dist/build/swc/index.js';\n\nconst source=readFileSync(new URL('../src/app/(identity)/cuenta/company-bootstrap-panel.js',import.meta.url),'utf8');\nconst tree=parse(source,{sourceType:'module',plugins:['jsx']});\nconst component=tree.program.body.find(node=>node.type==='ExportNamedDeclaration'&&node.declaration?.id?.name==='CompanyBootstrapPanel').declaration;\nconst ready=component.body.body.find(node=>node.type==='IfStatement'&&node.test.type==='BinaryExpression'&&node.test.operator==='==='&&node.test.left.name==='stage'&&node.test.right.value==='ready');\nassert.equal(ready.consequent.type,'ReturnStatement');\nconst readyJsx=source.slice(ready.consequent.argument.start,ready.consequent.argument.end);\n// Render the exact ready-branch JSX with real React, including the actual trial\n// component. No hooks are replaced and the onboarding transport is never run.\n// SSR verifies native disclosure markup, not browser layout or keyboard behavior.\nawait loadBindings();\nconst compiled=await transform(`import React,{useCallback,useEffect,useRef,useState} from ${JSON.stringify(import.meta.resolve('react'))};\nconst styles={created:'created',caption:'caption'};\n${source.replace(/^import .*;\\r?\\n/gm,'')}\nexport const renderReady=({receipt,currentCompany,children})=>${readyJsx};`,{filename:'actual-company-ready-receipt.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}});\nconst {renderReady,CompanyTrialExpiry}=await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64'));\n";
const syntaxShape=value=>Array.isArray(value)?value.map(syntaxShape):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>!['start','end','loc','extra','leadingComments','innerComments','trailingComments'].includes(key)).map(([key,item])=>[key,syntaxShape(item)])):value;
function controlledBootstrapDependency(value,file,tree,node,readSource){
 if(file!==controlledBootstrapFixture||node.type!=='ImportExpression')return false;
 const rows=WORKSPACE_CONTINUITY_FOCUSED_UI.controlledSourceTransforms;reject(Array.isArray(rows)&&rows.length===1,'One reviewed source transform declaration required');const declaration=rows[0];keys(declaration,['file','sourceLfSha256','kind','source','compiler','packageLockSha256'],'controlled source transform');
 reject(declaration.file===controlledBootstrapFixture&&declaration.kind==='SWC_READY_BRANCH_DATA_MODULE'&&declaration.source===controlledBootstrapPanel&&declaration.compiler===controlledBootstrapCompiler&&typeof readSource==='function','Only the exact original bootstrap source transform is permitted');
 const canonicalHash=raw=>sha(Buffer.from(raw.toString('utf8').replaceAll('\r\n','\n')));
 const lockBytes=bytes(readSource,'package-lock.json'),contractBytes=readSource(contractPath);
 const compilerContract=Buffer.isBuffer(contractBytes)?JSON.parse(contractBytes):null;
 const dependencyLockHistory=compilerContract?.planBudgetCurrentRevision?.captureQualityRuntime?.sourceHistory?.find(row=>row.path==='package-lock.json');
 let compilerLockMatches=canonicalHash(lockBytes)===declaration.packageLockSha256;
 if(dependencyLockHistory){
  try{
  compilerLockMatches=withCaptureRuntimePreviousSources(compilerContract,readSource,(parent,parentRead)=>{
   const currentPin=planBudgetCurrentSourcePin(compilerContract,{path:'package-lock.json',sha256:declaration.packageLockSha256});
   reject(compilerContract.packageLockSha256===currentPin&&canonicalHash(lockBytes)===currentPin,'The actual current compiler lock must match its authenticated dependency advance');
   reject(parent.packageLockSha256===declaration.packageLockSha256&&canonicalHash(bytes(parentRead,'package-lock.json'))===declaration.packageLockSha256,'The controlled compiler transform must restore its exact literal731 lock');
   return true;
  });
  }catch(error){if(error?.code==='PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED')reject(false,error.message);throw error;}
 }
 reject(canonicalHash(value)===declaration.sourceLfSha256&&compilerLockMatches,'Controlled unit and compiler lock must equal their reviewed source bytes');
 const expected=parse(controlledBootstrapTransformPrefix,{sourceType:'module',plugins:['jsx'],createImportExpressions:true}).program.body,actual=tree.program.body.slice(0,expected.length),last=actual.at(-1);
 reject(same(syntaxShape(actual),syntaxShape(expected))&&last?.type==='VariableDeclaration'&&last.kind==='const'&&last.declarations.length===1&&last.declarations[0].init?.type==='AwaitExpression'&&last.declarations[0].init.argument===node,'Only the exact local panel, resolved React, SWC JSX transform and compiled.code base64 module shape is permitted');
 bytes(readSource,controlledBootstrapPanel);return true;
}
export function focusedWorkspaceCiLocalImports(value,file,readSource){
 if(file.endsWith('.css')||file.endsWith('.json'))return[];
 const found=[],ast=parse(value.toString('utf8'),{sourceType:'module',plugins:['jsx'],createImportExpressions:true});
 function walk(node){if(!node||typeof node!=='object')return;
  if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration','ImportExpression'].includes(node.type)&&node.source){if(node.source.type==='StringLiteral')found.push(node.source.value);else{reject(controlledBootstrapDependency(value,file,ast,node,readSource),'Computed CI import is not bounded');found.push('../'+controlledBootstrapPanel);}}
  for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);
 }walk(ast.program);return found;
}
export function focusedWorkspaceCiSourceClosure(readSource){
 const ui=focusedWorkspaceUiSourceClosure(readSource),files=new Set(ui.files),external=new Set(ui.externalImports);
 function visit(file){reject(safe(file),'Unsafe CI dependency');if(files.has(file))return;const value=bytes(readSource,file);files.add(file);
  for(const ref of focusedWorkspaceCiLocalImports(value,file,readSource)){
   if(!ref.startsWith('.')&&!ref.startsWith('@/')){reject(!/^(https?:|data:|file:)/.test(ref),'Remote CI executable import');external.add(ref);continue;}
   const base=ref.startsWith('@/')?'src/'+ref.slice(2):path.posix.normalize(path.posix.join(path.posix.dirname(file),ref));
   const resolved=[base,base+'.js',base+'.mjs',base+'.css'].find(candidate=>readSource(candidate)!==null);reject(Boolean(resolved),'Missing actual CI import: '+ref);visit(resolved);
  }
 }
 for(const file of [producer,runner,...unitFiles,'scripts/lib/integrated-identity-current-ci-lineage.mjs','tests/production-integrated-identity-current-ci-lineage.test.mjs','src/app/(identity)/cuenta/page.js','src/app/(identity)/cuenta/workspace-identity.js','src/app/(identity)/cuenta/onboarding-guide.js','src/lib/identity-return-path.mjs','src/lib/participant-analysis-consent.mjs','src/lib/participant-kyc-image-set.mjs','src/lib/participant-policy.mjs','src/lib/workspace-policy.mjs','package.json','package-lock.json'])visit(file);
 const sorted=[...files].sort(),rawContract=readSource(contractPath);
 if(Buffer.isBuffer(rawContract)){const contract=JSON.parse(rawContract);if(contract[WORKSITE_LIVE_HOURS_CURRENT_SECTION])verifyWorksiteLiveHoursActualClosure(contract,FOCUSED_WORKSPACE_CI_KIND,{files:sorted,externalImports:[...external].sort()},readSource);}
 return sorted;
}
export function parseFocusedWorkspaceTap(input){
 const text=Buffer.isBuffer(input)?input.toString('utf8'):String(input),value={};
 for(const field of ['tests','pass','fail','cancelled','skipped','todo']){const found=[...text.matchAll(new RegExp('^# '+field+' (\\d+)\\r?$','gm'))];reject(found.length===1,'Complete unambiguous TAP summary required');value[field]=Number(found[0][1]);}
 reject(value.tests>0&&value.pass===value.tests&&['fail','cancelled','skipped','todo'].every(key=>value[key]===0)&&!/^not ok /m.test(text),'Every declared unit must pass without a skip');
 const cases=text.split(/\r?\n/).filter(line=>/^ok [0-9]+ - /.test(line)).map(line=>line.replace(/^ok [0-9]+ - /,''));reject(cases.length===value.tests&&new Set(cases).size===cases.length,'Complete distinct TAP cases required');
 return{...value,cases};
}
export function focusedWorkspaceUnitCases(readSource,file){
 const ast=parse(bytes(readSource,file).toString('utf8'),{sourceType:'module'}),cases=[];
 function walk(node){if(!node||typeof node!=='object')return;if(node.type==='CallExpression'&&node.callee?.type==='Identifier'&&node.callee.name==='test'){reject(node.arguments[0]?.type==='StringLiteral','Every focused unit needs a declared literal case name');cases.push(node.arguments[0].value);}for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}
 walk(ast.program);reject(cases.length>0&&new Set(cases).size===cases.length,'Distinct actual unit cases required');return cases;
}

// Denial-only checks apply to inert JSON data. Accessors, proxies, custom
// prototypes, cycles and non-JSON values retain the original source-first order.
function ordinaryJsonDto(value,ancestors=new Set()){
 if(value===null||typeof value==='string'||typeof value==='boolean')return true;
 if(typeof value==='number')return Number.isFinite(value);
 if(typeof value!=='object'||earlyDtoTypes.isProxy(value)||ancestors.has(value))return false;
 const array=Array.isArray(value),prototype=Object.getPrototypeOf(value);if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)return false;
 const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);if(keys.some(key=>typeof key!=='string'))return false;
 if(array&&(!Object.hasOwn(descriptors,'length')||!Number.isSafeInteger(descriptors.length.value)||descriptors.length.value<0||keys.length!==descriptors.length.value+1))return false;
 ancestors.add(value);try{for(const key of keys){if(array&&key==='length')continue;const row=descriptors[key];if(!Object.hasOwn(row,'value')||row.enumerable!==true||array&&!/^(?:0|[1-9][0-9]*)$/.test(key)||!ordinaryJsonDto(row.value,ancestors))return false;}return true;}finally{ancestors.delete(value);}
}

// These copies are denial-only DTO predicates. The original complete late
// predicates, source/SWC guards and evidence byte reads remain unchanged.
function validateFocusedEnvelopeDto(proof,options,current){
 const {expectedHead,expectedTree,spec,runId,runAttempt}=options;
 keys(proof,['version','status','sourceRevision','sourceTree','sourceState','trackedClean','ciRun','harnessSha256','sourceManifest','checks','historicalCheckCount','continuityCheckLedger','historicalUnitSuiteCount','previousTotalCheckCount','taskPagingCheckLedger','rawBrowser','unitSuites','providerCalls','realClerkOrSsrVerified','productionDataTouched','humanAccepted'],'CI envelope');
 reject(proof.version===FOCUSED_WORKSPACE_CI_VERSION&&proof.status==='PASS'&&proof.sourceRevision===expectedHead&&proof.sourceTree===expectedTree&&proof.sourceState==='EXACT_CI_SOURCE'&&proof.trackedClean===true,'Current exact CI source required');
 keys(proof.ciRun,['repository','workflow','runId','runAttempt','event','job'],'CI identity');
 reject(proof.ciRun.repository==='inguillen87/obrasaas'&&proof.ciRun.workflow==='.github/workflows/workspace-acceptance.yml'&&proof.ciRun.job==='workspace-ui'&&['push','workflow_dispatch'].includes(proof.ciRun.event)&&proof.ciRun.runId===Number(runId)&&proof.ciRun.runAttempt===Number(runAttempt)&&Number.isSafeInteger(proof.ciRun.runId)&&proof.ciRun.runId>0&&Number.isSafeInteger(proof.ciRun.runAttempt)&&proof.ciRun.runAttempt>0,'Original current workflow run and attempt required');
 reject(spec?.id===FOCUSED_WORKSPACE_CI_PROOF_ID&&spec.kind===FOCUSED_WORKSPACE_CI_KIND&&spec.producer===runner&&spec.path===FOCUSED_WORKSPACE_CI_EVIDENCE+'current-ci.json'&&spec.lane==='workspace-ui'&&spec.blockId===64,'Original focused proof binding required');
 reject(proof.harnessSha256===spec.producerSha256&&same(spec.checkNames,current.checkNames)&&same(proof.checks,spec.checkNames)&&proof.historicalCheckCount===current.previousCheckCount&&same(proof.continuityCheckLedger,current.continuityCheckNames)&&proof.historicalUnitSuiteCount===current.previousUnitFiles.length&&proof.previousTotalCheckCount===current.previousTotalCheckCount&&same(proof.taskPagingCheckLedger,current.taskPagingCheckNames),'Current runner and browser check matrix required');
 reject(Array.isArray(proof.unitSuites)&&same(proof.unitSuites.map(row=>row?.file),unitFiles),'Every focused unit suite required');
 reject(proof.providerCalls===0&&proof.realClerkOrSsrVerified===false&&proof.productionDataTouched===false&&proof.humanAccepted===false,'No real session or customer acceptance can be asserted');
 keys(proof.rawBrowser,['path','bytes','sha256'],'original browser proof');reject(proof.rawBrowser.path.startsWith(FOCUSED_WORKSPACE_CI_EVIDENCE+'run-')&&proof.rawBrowser.path.endsWith('/browser.json'),'Owned original browser evidence required');
}
// The actual producer emits Home77. Only a throwaway DTO projection is used
// here; it never replaces RAW evidence or the real authenticated normalizer.
function focusedHomeDtoForDenial(raw){
 const current=reviewedHomeDecisions.focusedUi;
 reject(plain(raw)&&raw.totalCheckCount===current.currentCheckNames.length&&raw.expectedTotalCheckCount===current.currentCheckNames.length&&Array.isArray(raw.checks)&&raw.checks.length===current.currentCheckNames.length,'All77 current home decisions browser observations required');
 reject(same(raw.checks.slice(current.previousCheckNames.length),current.addedCheckNames)&&same(raw.homeDecisionsWidths,current.widths)&&same(raw.homeDecisionsCheckLedger,current.addedCheckNames),'Exact18 additional home decisions observations and widths required');
 reject(Array.isArray(raw.requests)&&raw.requests.length===current.currentRequestCount,'Complete current home decisions request matrix required');
 const requests=raw.requests.map(row=>{reject(plain(row),'Actual current home decisions request facts required');const dynamic=row.mode==='wizard'&&row.method==='POST'?current.requestProjectionFieldsOmitted:[];reject(dynamic.every(key=>Object.hasOwn(row,key)),'Every original wizard correlation field is required');return Object.fromEntries(Object.entries(row).filter(([key])=>!dynamic.includes(key)));});
 reject(sha(JSON.stringify(requests))===current.currentRequestMatrixSha256,'Current home decisions request facts changed');
 reject(Array.isArray(raw.screenshots)&&same(raw.screenshots.map(row=>row?.path),current.screenshotNames),'Every inherited and home decisions screenshot required');
 for(const row of raw.screenshots.slice(current.previousScreenshotNames.length)){
  keys(row,['path','sha256','geometry'],'home decisions screenshot');keys(row.geometry,['width','height','scrollWidth','identityActionTop'],'home decisions viewport');
  const width=Number(/^home-pending-decisions-(320|390|768|1440)\.png$/.exec(row.path)?.[1]);reject(current.widths.includes(width)&&row.geometry.width===width&&row.geometry.height===1000&&Number.isSafeInteger(row.geometry.scrollWidth)&&row.geometry.scrollWidth>0&&row.geometry.scrollWidth<=width+1&&(row.geometry.identityActionTop===null||Number.isFinite(row.geometry.identityActionTop)),'Home decisions must fit every measured viewport');
 }
 const previous={...raw,checks:raw.checks.slice(0,current.previousCheckNames.length),totalCheckCount:current.previousCheckNames.length,expectedTotalCheckCount:current.previousCheckNames.length,requests:current.previousRequestIndices.map(index=>raw.requests[index]),screenshots:raw.screenshots.slice(0,current.previousScreenshotNames.length)};
 delete previous.homeDecisionsWidths;delete previous.homeDecisionsCheckLedger;return previous;
}
function validateFocusedBrowserDto(raw,proof,current,expectedHead,expectedTree){
 keys(raw,['version','status','sourceState','ciRun','sourceRevision','sourceTree','trackedClean','checkedAt','widths','continuityWidths','historicalCheckCount','continuityCheckLedger','previousTotalCheckCount','taskPagingWidths','taskPagingCheckLedger','taskPagingFixture','expectedTotalCheckCount','bootstrapSourceManifest','bootstrapExternalImports','checks','totalCheckCount','sourceManifest','sourceBytesUnchanged','externalImports','requests','errors','screenshots','providerCalls','businessPosts','navigationPosts','productionDataTouched','actualAccountWorkspaceMounted','actualClerkOrSSRVerified','syntheticPixelsOnly','transport','cleanup'],'original browser');
 reject(raw.version===current.rawVersion&&raw.status==='PASS'&&raw.sourceState==='EXACT_CI_SOURCE'&&raw.sourceRevision===expectedHead&&raw.sourceTree===expectedTree&&raw.trackedClean===true&&same(raw.ciRun,proof.ciRun),'Browser must execute on this actual CI source and identity');
 reject(typeof raw.checkedAt==='string'&&Number.isFinite(Date.parse(raw.checkedAt))&&new Date(raw.checkedAt).toISOString()===raw.checkedAt,'Original browser completion timestamp required');
 reject(same(raw.widths,FOCUSED_WORKSPACE_WIDTHS)&&same(raw.continuityWidths,current.continuityWidths)&&raw.historicalCheckCount===current.previousCheckCount&&raw.expectedTotalCheckCount===current.checkNames.length&&same(raw.continuityCheckLedger,current.continuityCheckNames)&&raw.totalCheckCount===current.checkNames.length&&same(normalizeFocusedWorkspaceCurrentChecks(raw.checks),proof.checks),'Both original widths and every current continuity observation required');
 const fixture=raw.taskPagingFixture;keys(fixture,['version','route','actualParentAndPagerCopies','copiedSources','overrides','pageSha256','consumerAuthority','original45TreeUnmodified'],'actual parent task-page fixture');const expected=current.taskPagingFixture;
 reject(fixture.version===1&&fixture.route==='/task-pages'&&fixture.actualParentAndPagerCopies===true&&fixture.original45TreeUnmodified===true&&fixture.pageSha256===expected.pageSha256&&fixture.consumerAuthority===expected.consumerAuthority,'The exact second tree and controlled-consumer boundary must remain explicit');
 reject(raw.sourceBytesUnchanged===true&&raw.providerCalls===0&&raw.productionDataTouched===false&&raw.actualAccountWorkspaceMounted===true&&raw.actualClerkOrSSRVerified===false&&raw.syntheticPixelsOnly===true&&raw.navigationPosts===0&&raw.businessPosts===2&&same(raw.errors,[]),'Actual synthetic browser isolation required');
 validateFocusedCurrentCleanup(raw.cleanup);
 reject(Array.isArray(raw.requests)&&raw.requests.length>0&&raw.requests.every(row=>plain(row))&&raw.requests.filter(row=>row.method==='POST').length===2&&raw.requests.every(row=>row.method==='GET'||row.mode==='wizard'&&row.method==='POST'),'Only the two controlled final wizard requests are allowed');
 validateFocusedCurrentRequests(raw.requests,current);
 reject(Array.isArray(raw.screenshots)&&raw.screenshots.length>=26&&same(raw.screenshots.map(row=>row?.path),current.screenshotNames),'Every original and additive browser screenshot required');
 for(const row of raw.screenshots){keys(row,['path','sha256','geometry'],'original screenshot');keys(row.geometry,['width','height','scrollWidth','identityActionTop'],'screenshot geometry');const width=Number(/-(320|390|1440)\.png$/.exec(row.path)?.[1]);reject(current.continuityWidths.includes(width)&&row.geometry.width===width&&row.geometry.height===1000&&Number.isSafeInteger(row.geometry.scrollWidth)&&row.geometry.scrollWidth>0&&(row.geometry.identityActionTop===null||Number.isFinite(row.geometry.identityActionTop)),'Actual screenshot viewport geometry required');if(row.path.startsWith('bootstrap-ready-'))reject(row.geometry.scrollWidth<=width+1,'The compact and disclosed bootstrap receipt must fit its measured viewport');reject(safe(row.path)&&path.posix.basename(row.path)===row.path,'Owned screenshot filename required');}
}

export function validateFocusedWorkspaceCi(proof,{expectedHead,expectedTree,readSource,readEvidence,spec,runId,runAttempt}){
 const current=currentFocusedMetadata();
 reject(/^[a-f0-9]{40}$/.test(expectedHead)&&/^[a-f0-9]{40}$/.test(expectedTree)&&typeof readSource==='function'&&typeof readEvidence==='function','Immutable source identity and original evidence readers required');
 // No accepted envelope, RAW DTO or source result is cached across this block.
 if(ordinaryJsonDto(proof)&&ordinaryJsonDto(spec)){
  const dtoBefore={proof:JSON.stringify(proof),spec:JSON.stringify(spec)};
  try{
   validateFocusedEnvelopeDto(proof,{expectedHead,expectedTree,spec,runId,runAttempt},current);
   const earlyRawBytes=bytes(readEvidence,proof.rawBrowser.path);reject(earlyRawBytes.length===proof.rawBrowser.bytes&&sha(earlyRawBytes)===proof.rawBrowser.sha256,'Original browser bytes changed');let earlyRaw;try{earlyRaw=JSON.parse(earlyRawBytes);}catch{reject(false,'Original browser JSON must parse');}
   validateFocusedBrowserDto(focusedHomeDtoForDenial(earlyRaw),proof,current,expectedHead,expectedTree);
  }finally{reject(JSON.stringify(proof)===dtoBefore.proof&&JSON.stringify(spec)===dtoBefore.spec,'Caller proof or specification changed during DTO preflight');}
 }
 const sourceContract=JSON.parse(bytes(readSource,contractPath));if(sourceContract[WORKSITE_LIVE_HOURS_CURRENT_SECTION])verifyWorksiteLiveHoursCurrentSources(sourceContract,readSource);
 keys(proof,['version','status','sourceRevision','sourceTree','sourceState','trackedClean','ciRun','harnessSha256','sourceManifest','checks','historicalCheckCount','continuityCheckLedger','historicalUnitSuiteCount','previousTotalCheckCount','taskPagingCheckLedger','rawBrowser','unitSuites','providerCalls','realClerkOrSsrVerified','productionDataTouched','humanAccepted'],'CI envelope');
 reject(proof.version===FOCUSED_WORKSPACE_CI_VERSION&&proof.status==='PASS'&&proof.sourceRevision===expectedHead&&proof.sourceTree===expectedTree&&proof.sourceState==='EXACT_CI_SOURCE'&&proof.trackedClean===true,'Current exact CI source required');
 keys(proof.ciRun,['repository','workflow','runId','runAttempt','event','job'],'CI identity');
 reject(proof.ciRun.repository==='inguillen87/obrasaas'&&proof.ciRun.workflow==='.github/workflows/workspace-acceptance.yml'&&proof.ciRun.job==='workspace-ui'&&['push','workflow_dispatch'].includes(proof.ciRun.event)&&proof.ciRun.runId===Number(runId)&&proof.ciRun.runAttempt===Number(runAttempt)&&Number.isSafeInteger(proof.ciRun.runId)&&proof.ciRun.runId>0&&Number.isSafeInteger(proof.ciRun.runAttempt)&&proof.ciRun.runAttempt>0,'Original current workflow run and attempt required');
 reject(spec?.id===FOCUSED_WORKSPACE_CI_PROOF_ID&&spec.kind===FOCUSED_WORKSPACE_CI_KIND&&spec.producer===runner&&spec.path===FOCUSED_WORKSPACE_CI_EVIDENCE+'current-ci.json'&&spec.lane==='workspace-ui'&&spec.blockId===64,'Original focused proof binding required');
 reject(proof.harnessSha256===spec.producerSha256&&proof.harnessSha256===sha(bytes(readSource,runner))&&same(spec.checkNames,current.checkNames)&&same(proof.checks,spec.checkNames)&&proof.historicalCheckCount===current.previousCheckCount&&same(proof.continuityCheckLedger,current.continuityCheckNames)&&proof.historicalUnitSuiteCount===current.previousUnitFiles.length&&proof.previousTotalCheckCount===current.previousTotalCheckCount&&same(proof.taskPagingCheckLedger,current.taskPagingCheckNames),'Current runner and browser check matrix required');
 reject(same(spec.sourceFiles,focusedWorkspaceCiSourceClosure(readSource))&&same(proof.sourceManifest,refs(spec.sourceFiles,readSource)),'Complete current AST closure and every RAW source required');
 keys(proof.rawBrowser,['path','bytes','sha256'],'original browser proof');reject(proof.rawBrowser.path.startsWith(FOCUSED_WORKSPACE_CI_EVIDENCE+'run-')&&proof.rawBrowser.path.endsWith('/browser.json'),'Owned original browser evidence required');
 const rawBytes=bytes(readEvidence,proof.rawBrowser.path);reject(rawBytes.length===proof.rawBrowser.bytes&&sha(rawBytes)===proof.rawBrowser.sha256,'Original browser bytes changed');let raw;try{raw=JSON.parse(rawBytes);}catch{reject(false,'Original browser JSON must parse');}
 raw=focusedHomeDecisionsRaw(raw,{readSource,readEvidence,directory:path.posix.dirname(proof.rawBrowser.path)});
 keys(raw,['version','status','sourceState','ciRun','sourceRevision','sourceTree','trackedClean','checkedAt','widths','continuityWidths','historicalCheckCount','continuityCheckLedger','previousTotalCheckCount','taskPagingWidths','taskPagingCheckLedger','taskPagingFixture','expectedTotalCheckCount','bootstrapSourceManifest','bootstrapExternalImports','checks','totalCheckCount','sourceManifest','sourceBytesUnchanged','externalImports','requests','errors','screenshots','providerCalls','businessPosts','navigationPosts','productionDataTouched','actualAccountWorkspaceMounted','actualClerkOrSSRVerified','syntheticPixelsOnly','transport','cleanup'],'original browser');
 reject(raw.version===current.rawVersion&&raw.status==='PASS'&&raw.sourceState==='EXACT_CI_SOURCE'&&raw.sourceRevision===expectedHead&&raw.sourceTree===expectedTree&&raw.trackedClean===true&&same(raw.ciRun,proof.ciRun),'Browser must execute on this actual CI source and identity');
 reject(typeof raw.checkedAt==='string'&&Number.isFinite(Date.parse(raw.checkedAt))&&new Date(raw.checkedAt).toISOString()===raw.checkedAt,'Original browser completion timestamp required');
 reject(same(raw.widths,FOCUSED_WORKSPACE_WIDTHS)&&same(raw.continuityWidths,current.continuityWidths)&&raw.historicalCheckCount===current.previousCheckCount&&raw.expectedTotalCheckCount===current.checkNames.length&&same(raw.continuityCheckLedger,current.continuityCheckNames)&&raw.totalCheckCount===current.checkNames.length&&same(normalizeFocusedWorkspaceCurrentChecks(raw.checks),proof.checks),'Both original widths and every current continuity observation required');
 validateFocusedTaskPaging(raw,current,readSource);
 const workspaceClosure=focusedWorkspaceUiSourceClosure(readSource),bootstrapClosure=focusedCompanyBootstrapUiSourceClosure(readSource);reject(same(raw.externalImports,workspaceClosure.externalImports)&&same(raw.bootstrapExternalImports,bootstrapClosure.externalImports)&&same(raw.bootstrapSourceManifest,refs(bootstrapClosure.files,readSource)),'Independent current bootstrap and workspace AST source facts required');
 reject(same(raw.sourceManifest,refs(focusedWorkspaceUiSourceFiles(readSource),readSource)),'Original independent complete browser source manifest required');
 for(const row of raw.sourceManifest){keys(row,['path','sha256'],'browser source');reject(spec.sourceFiles.includes(row.path)&&sha(bytes(readSource,row.path))===row.sha256,'Browser RAW source differs: '+row.path);}
 reject(raw.sourceBytesUnchanged===true&&raw.providerCalls===0&&raw.productionDataTouched===false&&raw.actualAccountWorkspaceMounted===true&&raw.actualClerkOrSSRVerified===false&&raw.syntheticPixelsOnly===true&&raw.navigationPosts===0&&raw.businessPosts===2&&same(raw.errors,[]),'Actual synthetic browser isolation required');
 validateFocusedCurrentCleanup(raw.cleanup);
 reject(Array.isArray(raw.requests)&&raw.requests.length>0&&raw.requests.every(row=>plain(row))&&raw.requests.filter(row=>row.method==='POST').length===2&&raw.requests.every(row=>row.method==='GET'||row.mode==='wizard'&&row.method==='POST'),'Only the two controlled final wizard requests are allowed');
 validateFocusedCurrentRequests(raw.requests,current);
 reject(Array.isArray(raw.screenshots)&&raw.screenshots.length>=26&&same(raw.screenshots.map(row=>row?.path),current.screenshotNames),'Every original and additive browser screenshot required');
 const directory=path.posix.dirname(proof.rawBrowser.path);for(const row of raw.screenshots){keys(row,['path','sha256','geometry'],'original screenshot');keys(row.geometry,['width','height','scrollWidth','identityActionTop'],'screenshot geometry');const width=Number(/-(320|390|1440)\.png$/.exec(row.path)?.[1]);reject(current.continuityWidths.includes(width)&&row.geometry.width===width&&row.geometry.height===1000&&Number.isSafeInteger(row.geometry.scrollWidth)&&row.geometry.scrollWidth>0&&(row.geometry.identityActionTop===null||Number.isFinite(row.geometry.identityActionTop)),'Actual screenshot viewport geometry required');if(row.path.startsWith('bootstrap-ready-'))reject(row.geometry.scrollWidth<=width+1,'The compact and disclosed bootstrap receipt must fit its measured viewport');reject(safe(row.path)&&path.posix.basename(row.path)===row.path,'Owned screenshot filename required');reject(sha(bytes(readEvidence,directory+'/'+row.path))===row.sha256,'Original screenshot changed');}
 reject(Array.isArray(proof.unitSuites)&&same(proof.unitSuites.map(row=>row?.file),unitFiles),'Every focused unit suite required');
 let unitTests=0;for(const row of proof.unitSuites){keys(row,['file','sourceSha256','exitCode','tap','result'],'unit suite');keys(row.tap,['path','bytes','sha256'],'unit TAP');reject(row.sourceSha256===sha(bytes(readSource,row.file))&&row.exitCode===0&&row.tap.path.startsWith(FOCUSED_WORKSPACE_CI_EVIDENCE+'unit-'),'Exact executed unit source required');const tap=bytes(readEvidence,row.tap.path);reject(tap.length===row.tap.bytes&&sha(tap)===row.tap.sha256,'Unit TAP changed');const parsed=parseFocusedWorkspaceTap(tap);reject(same(parsed,row.result)&&same(parsed.cases,focusedWorkspaceUnitCases(readSource,row.file)),'Original complete unit summary and every declared case required');unitTests+=parsed.tests;}
 reject(proof.providerCalls===0&&proof.realClerkOrSsrVerified===false&&proof.productionDataTouched===false&&proof.humanAccepted===false,'No real session or customer acceptance can be asserted');
 return{version:3,status:'PASS',checks:current.checkNames.length,previousTotalChecks:current.previousTotalCheckCount,taskPagingChecks:current.taskPagingCheckNames.length,historicalChecks:current.previousCheckCount,continuityChecks:current.continuityCheckNames.length,unitSuites:unitFiles.length,historicalUnitSuites:previousUnitFiles.length,widths:FOCUSED_WORKSPACE_WIDTHS,continuityWidths:current.continuityWidths,sourceReferences:proof.sourceManifest.length,unitTests,rawBrowserSha256:proof.rawBrowser.sha256,originalBrowserRewritten:false,realSessionOrIdentityAccepted:false};
}

async function main(){
 const [mode,...args]=process.argv.slice(2);reject(['browser','verify'].includes(mode)&&args.length===2&&args[0]==='--expected-head','Explicit browser or verification mode required');
 const root=process.cwd(),options=focusedWorkspaceUiCiOptions(['--ci',...args],{repoRoot:root,environment:process.env}),current=currentFocusedMetadata();
 const git=argv=>execFileSync('git',argv,{cwd:root,maxBuffer:32*1024*1024,windowsHide:true}),head=git(['rev-parse','HEAD']).toString().trim(),tree=git(['rev-parse','HEAD^{tree}']).toString().trim();
 reject(head===options.expectedHead&&git(['status','--porcelain','--untracked-files=no']).toString()==='','Clean current CI checkout required');
 const readSource=file=>{try{return git(['show',head+':'+file]);}catch{return null;}},readEvidence=file=>{if(!safe(file))return null;const absolute=path.join(root,file);return existsSync(absolute)&&lstatSync(absolute).isFile()?readFileSync(absolute):null;};
 const contract=JSON.parse(bytes(readSource,contractPath)),{verifyIntegratedIdentityCurrentSources}=await import('./lib/integrated-identity-current-ci-lineage.mjs');verifyIntegratedIdentityCurrentSources(contract,readSource);if(contract[WORKSITE_LIVE_HOURS_CURRENT_SECTION])verifyWorksiteLiveHoursCurrentSources(contract,readSource);
 const spec=contract.extension.proofs.find(row=>row.id===FOCUSED_WORKSPACE_CI_PROOF_ID),output=FOCUSED_WORKSPACE_CI_EVIDENCE+'current-ci.json';
 reject(same(spec?.sourceFiles,focusedWorkspaceCiSourceClosure(readSource)),'Reviewed current source closure required');
 const before=refs(spec.sourceFiles,readSource);
 if(mode==='browser'){
  reject(!existsSync(path.join(root,output)),'A new CI browser proof is required');mkdirSync(path.join(root,FOCUSED_WORKSPACE_CI_EVIDENCE),{recursive:true});
  const environment=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(SystemRoot|WINDIR|SystemDrive|ComSpec|Path|PATHEXT|TEMP|TMP|CI|GITHUB_ACTIONS|GITHUB_REPOSITORY|GITHUB_SHA|GITHUB_WORKFLOW|GITHUB_JOB|GITHUB_EVENT_NAME|GITHUB_RUN_ID|GITHUB_RUN_ATTEMPT|GITHUB_REF|GITHUB_WORKFLOW_REF)$/i.test(key)));environment.NEXT_TELEMETRY_DISABLED='1';
  const unitSuites=[];
  for(const [index,file]of unitFiles.entries()){const result=spawnSync(process.execPath,['--test','--test-reporter=tap',file],{cwd:root,env:environment,encoding:'utf8',maxBuffer:16*1024*1024,windowsHide:true});const tap=Buffer.from(result.stdout||''),tapPath=FOCUSED_WORKSPACE_CI_EVIDENCE+'unit-'+index+'.tap';writeFileSync(path.join(root,tapPath),tap,{flag:'wx'});writeFileSync(path.join(root,tapPath+'.stderr.log'),result.stderr||'',{flag:'wx'});reject(result.status===0,'Current unit suite failed: '+file);unitSuites.push({file,sourceSha256:sha(bytes(readSource,file)),exitCode:result.status,tap:{path:tapPath,bytes:tap.length,sha256:sha(tap)},result:parseFocusedWorkspaceTap(tap)});}
  const run=spawnSync(process.execPath,[producer,'--ci',...args],{cwd:root,env:environment,encoding:'utf8',maxBuffer:32*1024*1024,windowsHide:true});writeFileSync(path.join(root,FOCUSED_WORKSPACE_CI_EVIDENCE+'browser.stdout.log'),run.stdout||'',{flag:'wx'});writeFileSync(path.join(root,FOCUSED_WORKSPACE_CI_EVIDENCE+'browser.stderr.log'),run.stderr||'',{flag:'wx'});reject(run.status===0,'Original browser producer failed');
  const lines=run.stdout.trim().split(/\r?\n/),emitted=JSON.parse(lines.at(-1)),relative=path.relative(root,emitted.target).split(path.sep).join('/');reject(safe(relative),'Owned browser output required');const raw=bytes(readEvidence,relative),rawProof=focusedHomeDecisionsRaw(JSON.parse(raw),{readSource,readEvidence,directory:path.posix.dirname(relative)});
  const proof={version:FOCUSED_WORKSPACE_CI_VERSION,status:'PASS',sourceRevision:head,sourceTree:tree,sourceState:'EXACT_CI_SOURCE',trackedClean:true,ciRun:options.ciRun,harnessSha256:sha(bytes(readSource,runner)),sourceManifest:before,checks:normalizeFocusedWorkspaceCurrentChecks(rawProof.checks),historicalCheckCount:current.previousCheckCount,continuityCheckLedger:[...current.continuityCheckNames],historicalUnitSuiteCount:previousUnitFiles.length,previousTotalCheckCount:current.previousTotalCheckCount,taskPagingCheckLedger:[...current.taskPagingCheckNames],rawBrowser:{path:relative,bytes:raw.length,sha256:sha(raw)},unitSuites,providerCalls:0,realClerkOrSsrVerified:false,productionDataTouched:false,humanAccepted:false};
  validateFocusedWorkspaceCi(proof,{expectedHead:head,expectedTree:tree,readSource,readEvidence,spec,runId:options.ciRun.runId,runAttempt:options.ciRun.runAttempt});writeFileSync(path.join(root,output),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
 }
 const result=validateFocusedWorkspaceCi(JSON.parse(bytes(readEvidence,output)),{expectedHead:head,expectedTree:tree,readSource,readEvidence,spec,runId:options.ciRun.runId,runAttempt:options.ciRun.runAttempt});
 reject(git(['rev-parse','HEAD']).toString().trim()===head&&git(['rev-parse','HEAD^{tree}']).toString().trim()===tree&&git(['status','--porcelain','--untracked-files=no']).toString()===''&&same(before,refs(spec.sourceFiles,readSource)),'Source must remain unchanged');
 assert.equal(result.status,'PASS');console.log(JSON.stringify({...result,sourceRevision:head,sourceTree:tree,ciRun:options.ciRun}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
