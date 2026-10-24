import {PLAN_BUDGET_CURRENT_SECTION,withCaptureRuntimePreviousSources} from './lib/plan-budget-current-ci-lineage.mjs';
import {PLAN_PARTIDA_PREVIEW_CURRENT_SECTION,verifyPlanPartidaPreviewActualClosure} from './lib/plan-partida-preview-current-ci-lineage.mjs';
import {WORKSITE_LIVE_HOURS_CURRENT_SECTION,verifyWorksiteLiveHoursCurrentSources as worksiteSourceCheck0,verifyWorksiteLiveHoursActualClosure as worksiteSourceCheck1} from './lib/worksite-live-hours-current-ci-lineage.mjs';
function checkWorksiteSource(action){try{return action();}catch(error){if(error.code==='WORKSITE_LIVE_HOURS_CURRENT_CI_LINEAGE_REJECTED')requireProof(false,error.message);throw error;}}
const verifyWorksiteLiveHoursCurrentSources=(...args)=>checkWorksiteSource(()=>worksiteSourceCheck0(...args));
const verifyWorksiteLiveHoursActualClosure=(...args)=>checkWorksiteSource(()=>worksiteSourceCheck1(...args));
import {createHash} from 'node:crypto';
import {types as earlyDtoTypes} from 'node:util';
import {restoreWeeklyCypConsumerSourceSet} from './lib/home-decisions-current-ci-lineage.mjs';
import {participantPreanalysisConsumerSourceFiles,preloadParticipantPreanalysisConsumerSources} from './lib/participant-preanalysis-current-ci-lineage.mjs';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from '@babel/parser';
import {ORGANIZATION_USAGE_PG_VERSION,ORGANIZATION_USAGE_PG_CHECKS} from './verify-organization-usage-postgres.mjs';
import {ORGANIZATION_USAGE_UI_VERSION,ORGANIZATION_USAGE_UI_CHECKS,ORGANIZATION_USAGE_UI_WIDTHS} from './verify-organization-usage-ui.mjs';
import {PLAN_MEASUREMENT_CONSUMER_CI_HELPER,PLAN_MEASUREMENT_CONSUMER_SOURCES,validatePlanMeasurementConsumerSourceLineage} from './lib/plan-measurement-consumer-ci-lineage.mjs';

export const ORGANIZATION_USAGE_CI_VERSION='organization-usage-ci-v2';
const pgHarness='scripts/verify-organization-usage-postgres.mjs',uiHarness='scripts/verify-organization-usage-ui.mjs',cleanupHelper='scripts/lib/owned-fixture-cleanup.mjs';
const dependencies=['package-lock.json','package.json'];
const uiRoots=['src/app/(identity)/cuenta/company-subscription-panel.js','src/app/(identity)/cuenta/plan-import-panel.js'];
const fieldReportSource='src/lib/field-report-feedback.mjs';
// Frozen 0e22 CURRENT native paths. The new reader is an additive dependency;
// it never substitutes a prior source or makes its 112-source receipt current.
const previousNativePathsSha256='ec9178af9cf5b41217a5af28198bbef3c5179b50f7b6355773eb105a15b46e54';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const revision=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
const requireProof=(condition,message)=>{if(!condition)throw Object.assign(new Error(message),{code:'ORGANIZATION_USAGE_CI_REJECTED'});};
const same=(a,b,message)=>requireProof(JSON.stringify(a)===JSON.stringify(b),message);
const safePath=value=>typeof value==='string'&&!value.includes('\\')&&!value.includes('\0')&&!path.posix.isAbsolute(value)&&path.posix.normalize(value)===value&&!value.startsWith('../')&&/^(src|scripts|tests)\//.test(value);
function imports(bytes,file){
 if(file.endsWith('.css')){requireProof(!/@import\s|url\(\s*['"]?(?!data:|#)/i.test(bytes.toString()),'External CSS dependency');return [];}
 const ast=parse(bytes.toString(),{sourceType:'module',plugins:['jsx'],createImportExpressions:true}),found=[];
 function visit(node){if(!node||typeof node!=='object')return;
  if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)&&node.source)found.push(node.source.value);
  if(node.type==='ImportExpression'){requireProof(node.source.type==='StringLiteral','Hidden nonliteral source import');found.push(node.source.value);}
  for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);
 }visit(ast.program);return found;
}
export function organizationUsageCiSourceClosure(readSource,{ui=false,fixture=false}={}){
 requireProof(!(ui&&fixture),'Distinct browser and Node fixture closures');
 const files=new Set(ui||fixture?[]:dependencies),external=new Set();
 for(const file of files)requireProof(readSource(file)!=null,'Missing package dependency: '+file);
 function visit(file){requireProof(safePath(file),'Unsafe source path');if(files.has(file))return;const bytes=readSource(file);requireProof(bytes!=null,'Missing source: '+file);files.add(file);
  for(const specifier of imports(bytes,file)){if(!specifier.startsWith('.')){external.add(specifier);continue;}const relative=path.posix.normalize(path.posix.join(path.posix.dirname(file),specifier)),dependency=[relative,relative+'.js',relative+'.mjs',relative+'.css',relative+'/index.js'].find(value=>safePath(value)&&readSource(value)!=null);requireProof(Boolean(dependency),'Unresolved source import: '+file);visit(dependency);}
 }(fixture?['scripts/lib/company-subscription-ui-fixture.mjs']:ui?uiRoots:[pgHarness]).forEach(visit);return {files:[...files].sort(),externalImports:[...external].sort()};
}
function manifest(records,files,readSource,label){
 requireProof(Array.isArray(records)&&records.length===files.length,label+' source count');const map=new Map();
 for(const record of records){requireProof(exact(record,['path','sha256'])&&hash(record.sha256)&&!map.has(record.path),label+' source shape');map.set(record.path,record.sha256);}
 same([...map.keys()].sort(),files,label+' source closure');for(const file of files)requireProof(map.get(file)===sha(readSource(file)),label+' source hash: '+file);
}
function provenance(proof,head,tree,label){
 requireProof(proof?.status==='PASS'&&proof.sourceRevision===head&&proof.sourceTree===tree&&proof.sourceState==='EXACT_CI_SOURCE'&&proof.trackedClean===true,label+' exact CI provenance');
 requireProof(proof.productionDataWritten===false,label+' production boundary');
}
// Only this source-lineage seam sees authenticated parent metadata. Business
// DTOs and their CURRENT RAW manifests never enter a historical validator.
function organizationHistoricalNativeLineage(contract,native,readSource,postgres,ui,verifyInputs){
 if(!contract?.[PLAN_BUDGET_CURRENT_SECTION]?.captureQualityRuntime)return {historicalNativeFiles:participantPreanalysisConsumerSourceFiles('ORGANIZATION_USAGE',native.files,readSource),sourceLineage:validatePlanMeasurementConsumerSourceLineage({family:'ORGANIZATION_USAGE',files:native.files,readSource})};
 const before={contract:JSON.stringify(contract),native:JSON.stringify(native),postgres:JSON.stringify(postgres),ui:JSON.stringify(ui)};
 const verify=()=>{
  if(verifyInputs)verifyInputs();
  requireProof(JSON.stringify(contract)===before.contract&&JSON.stringify(native)===before.native&&JSON.stringify(postgres)===before.postgres&&JSON.stringify(ui)===before.ui,'Caller contract, closure and business DTOs changed during historical source validation');
  verifyWorksiteLiveHoursCurrentSources(contract,readSource);verifyWorksiteLiveHoursActualClosure(contract,'ORGANIZATION_USAGE',native,readSource);
  manifest(postgres.sourceManifest,native.files,readSource,'PostgreSQL');requireProof(postgres.harnessSha256===sha(readSource(pgHarness)),'Native producer Git bytes');
 };
 verify();
 try{return withCaptureRuntimePreviousSources(contract,readSource,(parent,parentRead)=>{
  const family=parent[PLAN_BUDGET_CURRENT_SECTION].sourceFamilies.find(row=>row.family==='ORGANIZATION_USAGE');requireProof(family&&Array.isArray(family.currentFiles),'Authenticated historical organization family required');
  const files=[...family.currentFiles],historicalNativeFiles=participantPreanalysisConsumerSourceFiles('ORGANIZATION_USAGE',files,parentRead),legacy=validatePlanMeasurementConsumerSourceLineage({family:'ORGANIZATION_USAGE',files,readSource:parentRead});
  requireProof(legacy.sourceCount===files.length,'Historical source result must retain its own parent count');
  return {historicalNativeFiles,sourceLineage:{...legacy,sourceBasis:'AUTHENTICATED_PRE_CAPTURE_PARENT',currentSourceCount:native.files.length,historicalSourceCount:files.length,currentSourcePathsSha256:sha(JSON.stringify(native.files)),sourceOnlyProjection:true,callerDtosUnchanged:true}};
 });}finally{verify();}
}
// Rejection-only UI preflight; no source authority, DTO or reader is cached.
// Proxies/accessors/non-JSON retain the existing snapshot and source-check order.
function ordinaryJsonDto(value,ancestors=new Set()){
 if(value===null||typeof value==='string'||typeof value==='boolean')return true;
 if(typeof value==='number')return Number.isFinite(value);
 if(typeof value!=='object'||earlyDtoTypes.isProxy(value)||ancestors.has(value))return false;
 const array=Array.isArray(value),prototype=Object.getPrototypeOf(value);
 if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)return false;
 const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);
 if(keys.some(key=>typeof key!=='string'))return false;
 if(array&&(!Object.hasOwn(descriptors,'length')||!Number.isSafeInteger(descriptors.length.value)||descriptors.length.value<0||keys.length!==descriptors.length.value+1))return false;
 ancestors.add(value);try{for(const key of keys){if(array&&key==='length')continue;const row=descriptors[key];if(!Object.hasOwn(row,'value')||row.enumerable!==true||array&&!/^(?:0|[1-9][0-9]*)$/.test(key)||!ordinaryJsonDto(row.value,ancestors))return false;}return true;}finally{ancestors.delete(value);}
}

function validateOrganizationUsageUiDto(ui){
 requireProof(ui.version===ORGANIZATION_USAGE_UI_VERSION&&ui.environment==='isolated-localhost-next-exact-jsx-synthetic-api','Controlled real JSX fixture');
 for(const key of ['productionLoginVerified','realIdentityDocuments','realPlanDocuments','physicalDeviceAccepted'])requireProof(ui[key]===false,'No real acceptance claim: '+key);
 requireProof(ui.providerRequests===0&&ui.automaticPostCount===0&&ui.explicitSyntheticUploadCount===6,'Only six explicitly requested synthetic uploads');
 for(const key of ['pageErrors','interceptErrors','externalRequests'])requireProof(Array.isArray(ui[key])&&ui[key].length===0,'Empty browser errors/foreign calls: '+key);
 same(ui.widths,[...ORGANIZATION_USAGE_UI_WIDTHS],'Complete viewport matrix');requireProof(ui.totalCheckCount===14&&Array.isArray(ui.checks)&&ui.checks.length===14,'Complete fourteen DOM groups');same(ui.checks.map(item=>item.check),[...ORGANIZATION_USAGE_UI_CHECKS],'Exact ordered DOM group names');
 for(const [index,record] of ui.checks.entries()){
  if(index<4){requireProof(record.width===ORGANIZATION_USAGE_UI_WIDTHS[index]&&record.documentWidth<=record.width&&Array.isArray(record.targets)&&record.targets.length>3&&record.targets.every(target=>Number.isFinite(target.height)&&target.height>=44&&Number.isFinite(target.width)&&target.width>=44)&&record.targets.filter(target=>target.tag==='LABEL'&&target.label==='radio').length===2&&record.postCount===0,'Responsive real targets and zero automatic upload');same(record.commercial,{prices:['USD 149,00','USD 349,00'],termsPending:true,acceptanceEnabled:false,checkoutPresent:false,receiptPresent:false},'Displayed current references with closed terms and payment');}
  else if(index<8)requireProof(record.postCount===0,'Read cancel/denial/context boundary');
  else requireProof(record.postCount===1&&uuid(record.operationId)&&Array.isArray(record.recoveryOperationIds)&&record.recoveryOperationIds.every(value=>value===record.operationId),'Exact source recovery without repeated POST');
 }
 const operations=new Map(ui.checks.slice(8).map(record=>[record.check,record.operationId]));requireProof(new Set(operations.values()).size===6,'Six distinct explicit source attempts');
 const labels=ui.checks.map((record,index)=>index<4?'viewport-'+record.width:record.check),requestCounts=[3,3,3,3,2,3,3,3,5,10,7,5,6,4],counts=new Map(labels.map(label=>[label,0])),posts=new Map(labels.map(label=>[label,0]));
 requireProof(Array.isArray(ui.apiRequests)&&ui.apiRequests.length===60,'All sixty controlled API calls');let uploads=0;
 for(const record of ui.apiRequests){requireProof(record&&Object.keys(record).every(key=>['label','path','method','scope','operationId'].includes(key))&&counts.has(record.label)&&['/api/identity/company-subscription','/api/identity/company-usage','/api/identity/plan-import'].includes(record.path)&&['GET','POST'].includes(record.method)&&['a'.repeat(64),'b'.repeat(64)].includes(record.scope),'Finite read API scope and metadata');counts.set(record.label,counts.get(record.label)+1);if(Object.hasOwn(record,'operationId'))requireProof(record.path==='/api/identity/plan-import'&&uuid(record.operationId)&&record.operationId===operations.get(record.label),'The HTTP and recovery receipt must identify the same case and attempt');if(record.method==='POST'){uploads++;posts.set(record.label,posts.get(record.label)+1);requireProof(record.path==='/api/identity/plan-import'&&uuid(record.operationId)&&record.operationId===operations.get(record.label),'Only the explicit synthetic source attempt for this case');}}
 requireProof(uploads===6,'Exact observed synthetic upload count');
 for(const [index,label] of labels.entries())requireProof(counts.get(label)===requestCounts[index]&&posts.get(label)===(index>=8?1:0),'Complete bounded request observations for '+label);
}

// Denial only: LF pins establish eligibility; RAW copies never become authority.
// An exotic source map keeps every existing caller read and late check in order.
function earlySourceDescriptors(gitSources){
 if(earlyDtoTypes.isProxy(gitSources))return null;
 const prototype=Object.getPrototypeOf(gitSources);if(prototype!==Object.prototype&&prototype!==null)return null;
 const descriptors=Object.getOwnPropertyDescriptors(gitSources),keys=Reflect.ownKeys(descriptors),bufferReadKeys=['toString','valueOf','length','byteLength','byteOffset','buffer','parent','offset','constructor','toJSON','slice','subarray','copy','equals',Symbol.toPrimitive,Symbol.iterator];
 for(const key of keys){if(typeof key!=='string')return null;const row=descriptors[key];if(!Object.hasOwn(row,'value')||row.enumerable!==true||row.configurable!==true||row.writable!==true||earlyDtoTypes.isProxy(row.value)||!Buffer.isBuffer(row.value)||Object.getPrototypeOf(row.value)!==Buffer.prototype||bufferReadKeys.some(name=>Object.hasOwn(row.value,name)))return null;}
 return descriptors;
}
function earlySourceCopy(buffer){
 const length=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'length').get.call(buffer),copy=Buffer.alloc(length);
 Uint8Array.prototype.set.call(copy,buffer);return copy;
}
function earlySourceText(copy){const text=copy.toString('utf8');return Buffer.from(text).equals(copy)?text:null;}
function earlyCurrentFamily(contract,family){
 const section=contract?.planBudgetCurrentRevision;if(!section?.captureQualityRuntime||!Array.isArray(section.sourceFamilies))return null;
 const matches=section.sourceFamilies.filter(row=>row?.family===family);if(matches.length!==1)return null;
 const {currentFiles:files,currentManifest:pins}=matches[0];if(!Array.isArray(files)||files.length===0||!Array.isArray(pins)||pins.length!==files.length)return null;
 for(let index=0;index<files.length;index++){const file=files[index],pin=pins[index];if(typeof file!=='string'||!(dependencies.includes(file)||safePath(file))||index>0&&files[index-1]>=file||!pin||Object.keys(pin).sort().join('|')!=='path|sha256'||pin.path!==file||!hash(pin.sha256))return null;}
 return {files,pins};
}
function earlyFamilyCopies(descriptors,families){
 const pins=new Map();for(const family of families)for(const pin of family.pins){if(pins.has(pin.path)&&pins.get(pin.path)!==pin.sha256)return null;pins.set(pin.path,pin.sha256);}
 const copies=new Map();try{for(const [file,pin]of pins){if(!Object.hasOwn(descriptors,file))return null;const copy=earlySourceCopy(descriptors[file].value),text=earlySourceText(copy);if(text===null||sha(Buffer.from(text.replaceAll('\r\n','\n')))!==pin)return null;copies.set(file,copy);}}catch{return null;}
 return copies;
}
function preflightOrganizationUsageManifests(gitSources,postgres,ui,businessInputsBefore){
 if(!ordinaryJsonDto(postgres)||!ordinaryJsonDto(ui))return;
 const descriptors=earlySourceDescriptors(gitSources),contractPath='.github/workspace-acceptance-contract.json';if(!descriptors||!Object.hasOwn(descriptors,contractPath))return;
 let contract;try{const text=earlySourceText(earlySourceCopy(descriptors[contractPath].value));if(text===null)return;contract=JSON.parse(text);}catch{return;}
 const native=earlyCurrentFamily(contract,'ORGANIZATION_USAGE'),browser=earlyCurrentFamily(contract,'ORGANIZATION_USAGE_UI');if(!native||!browser)return;
 const copies=earlyFamilyCopies(descriptors,[native,browser]);if(!copies||dependencies.some(file=>!copies.has(file)))return;
 const ownedPostgres=JSON.parse(businessInputsBefore.postgres),ownedUi=JSON.parse(businessInputsBefore.ui),readPrivate=file=>copies.get(file);
 manifest(ownedPostgres.sourceManifest,native.files,readPrivate,'PostgreSQL');manifest(ownedUi.sourceManifest,browser.files,readPrivate,'UI');manifest(ownedUi.dependencyManifest,dependencies,readPrivate,'UI dependencies');
}

export function validateOrganizationUsageCi({expectedHead,head,sourceTree,trackedClean,gitSources,postgres,ui}){
 requireProof(revision(expectedHead)&&head===expectedHead&&revision(sourceTree)&&trackedClean===true,'Exact clean expected Git HEAD/tree');requireProof(gitSources&&typeof gitSources==='object'&&!Array.isArray(gitSources),'Committed source map');
 const businessInputsBefore={postgres:JSON.stringify(postgres),ui:JSON.stringify(ui)},verifyBusinessInputs=()=>requireProof(JSON.stringify(postgres)===businessInputsBefore.postgres&&JSON.stringify(ui)===businessInputsBefore.ui,'Business DTOs changed during source validation');
 const readSource=file=>Object.hasOwn(gitSources,file)?gitSources[file]:null;
 for(const file of [pgHarness,uiHarness,cleanupHelper,...dependencies])requireProof(readSource(file)!=null,'Missing producer/helper/package: '+file);
 provenance(postgres,expectedHead,sourceTree,'PostgreSQL');provenance(ui,expectedHead,sourceTree,'UI');
 requireProof(postgres.version===ORGANIZATION_USAGE_PG_VERSION&&postgres.syntheticOnly===true&&postgres.postgresExecuted===true,'Native disposable execution');
 requireProof(ORGANIZATION_USAGE_PG_CHECKS.length===16&&postgres.totalCheckCount===16,'Complete sixteen native groups');same(postgres.checks,[...ORGANIZATION_USAGE_PG_CHECKS],'Exact ordered native group names');
 requireProof(postgres.providerRequests===0&&postgres.syntheticOpenAiRequests===11&&Number.isSafeInteger(postgres.syntheticReplyRequests)&&postgres.syntheticReplyRequests>=1,'Closed provider counters');
 requireProof(postgres.paymentAttempted===false&&postgres.paymentVerified===false&&postgres.capacityContractPending===true&&postgres.cost===null,'No merchant acceptance, approved capacity or invented price');
 requireProof(postgres.poolClosed===true&&postgres.databaseRemoved===true&&postgres.cleanup?.poolClosed===true&&postgres.cleanup.databaseRemoved===true,'Owned PostgreSQL cleanup');
 requireProof(Array.isArray(postgres.nativeLockObservations)&&postgres.nativeLockObservations.length===2,'Two native lock races');
 for(const [index,record] of postgres.nativeLockObservations.entries())requireProof(exact(record,['firstTransport','secondTransport','sameOrganization','differentProjects','waitingCount','waitingBeforeProject','bothCompleted'])&&record.firstTransport===['WEB','WHATSAPP'][index]&&record.secondTransport===['WHATSAPP','WEB'][index]&&record.sameOrganization===true&&record.differentProjects===true&&Number.isSafeInteger(record.waitingCount)&&record.waitingCount>=1&&record.waitingBeforeProject===true&&record.bothCompleted===true,'Native advisory-before-project ordering');
 // All native DTO guards above keep their original priority. The same UI helper runs again below.
 if(ordinaryJsonDto(ui))validateOrganizationUsageUiDto(ui);
 preflightOrganizationUsageManifests(gitSources,postgres,ui,businessInputsBefore);
 const native=organizationUsageCiSourceClosure(readSource),currentSourceContract=JSON.parse(readSource('.github/workspace-acceptance-contract.json'));if(currentSourceContract[WORKSITE_LIVE_HOURS_CURRENT_SECTION]){verifyWorksiteLiveHoursCurrentSources(currentSourceContract,readSource);verifyWorksiteLiveHoursActualClosure(currentSourceContract,'ORGANIZATION_USAGE',native,readSource);}let historicalNativeFiles,sourceLineage;try{({historicalNativeFiles,sourceLineage}=organizationHistoricalNativeLineage(currentSourceContract,native,readSource,postgres,ui,verifyBusinessInputs));}catch(error){requireProof(false,error.message);}
 requireProof(historicalNativeFiles.length===115&&native.files.filter(file=>file===fieldReportSource).length===1,'Complete 115-source native closure with the own field report reader and source import');
 const previousNative=historicalNativeFiles.filter(file=>file!==fieldReportSource&&!PLAN_MEASUREMENT_CONSUMER_SOURCES.includes(file));requireProof(previousNative.length===112&&sha(JSON.stringify(previousNative))===previousNativePathsSha256,'Preserved exact previous 112-source native lineage');
 manifest(postgres.sourceManifest,native.files,readSource,'PostgreSQL');requireProof(postgres.harnessSha256===sha(readSource(pgHarness)),'Native producer Git bytes');
 requireProof(['src/lib/plan-baseline-policy.mjs','src/lib/plan-import-document-curve.mjs'].every(file=>native.files.includes(file)),'Current native document curve dependency lineage');
 requireProof(['src/lib/participant-civil-store.mjs','src/lib/participant-civil-policy.mjs','src/lib/bindx-civil-data-client.mjs'].every(file=>native.files.includes(file)),'The current native lineage requires every durable civil source');
 validateOrganizationUsageUiDto(ui);
 const browser=organizationUsageCiSourceClosure(readSource,{ui:true}),contract=JSON.parse(readSource('.github/workspace-acceptance-contract.json'));let publishedUiFiles;
 try{if(Object.hasOwn(contract,PLAN_PARTIDA_PREVIEW_CURRENT_SECTION))verifyPlanPartidaPreviewActualClosure(contract,'ORGANIZATION_USAGE_UI',browser,readSource);publishedUiFiles=restoreWeeklyCypConsumerSourceSet('ORGANIZATION_USAGE_UI',browser.files,contract);}catch(error){requireProof(false,error.message);}
 requireProof(publishedUiFiles.length===26,'Complete published 26-source UI graph');manifest(ui.sourceManifest,browser.files,readSource,'UI');manifest(ui.dependencyManifest,dependencies,readSource,'UI dependencies');same(ui.externalImports,browser.externalImports,'Browser packages match actual JSX');
 const fixture=organizationUsageCiSourceClosure(readSource,{fixture:true});same(fixture.files,['scripts/lib/company-subscription-ui-fixture.mjs','src/lib/company-subscription-catalog.mjs','src/lib/workspace-policy.mjs'],'Complete current three-source Node fixture graph');manifest(ui.fixtureSourceManifest,fixture.files,readSource,'UI fixture');
 requireProof(ui.harnessSha256===sha(readSource(uiHarness))&&ui.cleanupHelperSha256===sha(readSource(cleanupHelper)),'UI and cleanup producer Git bytes');
 const cleanup=ui.cleanup;requireProof(cleanup?.browserClosed===true&&cleanup.serverClosed===true&&cleanup.gracefulCloseAcknowledged===true&&cleanup.fixtureRemoved===true&&cleanup.fixtureCleanupProof?.fixtureRemoved===true&&cleanup.fixtureCleanupProof.postcondition?.absent===true,'Owned browser/server/fixture cleanup');
 verifyBusinessInputs();
 return {version:ORGANIZATION_USAGE_CI_VERSION,status:'PASS',sourceRevision:expectedHead,sourceTree,sourceState:'EXACT_CI_SOURCE',trackedClean:true,postgres:{totalCheckCount:16,sourceCount:native.files.length,syntheticOpenAiRequests:11,nativeLockRaceCount:2,harnessSha256:postgres.harnessSha256,sourceLineage},ui:{totalCheckCount:14,sourceCount:browser.files.length,fixtureSourceCount:fixture.files.length,dependencyCount:2,widths:[...ORGANIZATION_USAGE_UI_WIDTHS],explicitSyntheticUploadCount:6,harnessSha256:ui.harnessSha256},providerRequests:0,productionDataWritten:false,paymentVerified:false,capacityContractPending:true,cost:null,productionLoginVerified:false,physicalDeviceAccepted:false};
}
function main(){
 const args=process.argv.slice(2);requireProof(args.length===2&&args[0]==='--expected-head'&&revision(args[1]),'Usage --expected-head <full SHA>');const expectedHead=args[1],root=process.cwd(),git=(...values)=>execFileSync('git',values,{cwd:root,encoding:'utf8'}).trim();
 const head=git('rev-parse','HEAD'),sourceTree=git('rev-parse','HEAD^{tree}'),trackedClean=git('status','--porcelain','--untracked-files=no')==='';requireProof(head===expectedHead&&trackedClean,'Exact clean source');
 const gitSources=Object.create(null),readSource=file=>{if(!Object.hasOwn(gitSources,file)){try{gitSources[file]=execFileSync('git',['show',head+':'+file],{cwd:root,stdio:['ignore','pipe','ignore'],maxBuffer:4*1024*1024});}catch{return null;}}return gitSources[file];};
 organizationUsageCiSourceClosure(readSource);organizationUsageCiSourceClosure(readSource,{ui:true});organizationUsageCiSourceClosure(readSource,{fixture:true});[uiHarness,cleanupHelper,PLAN_MEASUREMENT_CONSUMER_CI_HELPER,...dependencies].forEach(readSource);
 requireProof(sha(readFileSync(path.join(root,PLAN_MEASUREMENT_CONSUMER_CI_HELPER)))===sha(readSource(PLAN_MEASUREMENT_CONSUMER_CI_HELPER)),'Consumer lineage helper must equal committed Git bytes');
 const postgres=JSON.parse(readFileSync(path.join(root,'.vercel/private/organization-usage-postgres.json'),'utf8')),ui=JSON.parse(readFileSync(path.join(root,'.vercel/private/organization-usage-evidence/browser.json'),'utf8'));
 preloadParticipantPreanalysisConsumerSources({readSource,readCheckout:file=>readFileSync(path.join(root,file))});
 const result=validateOrganizationUsageCi({expectedHead,head,sourceTree,trackedClean,gitSources,postgres,ui}),output=path.join(root,'.vercel/private/organization-usage-ci.json');preloadParticipantPreanalysisConsumerSources({readSource,readCheckout:file=>readFileSync(path.join(root,file))});requireProof(git('rev-parse','HEAD')===head&&git('rev-parse','HEAD^{tree}')===sourceTree&&git('status','--porcelain','--untracked-files=no')==='','Source changed during CI proof validation');requireProof(sha(readFileSync(path.join(root,PLAN_MEASUREMENT_CONSUMER_CI_HELPER)))===sha(readSource(PLAN_MEASUREMENT_CONSUMER_CI_HELPER)),'Consumer lineage helper changed during validation');mkdirSync(path.dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:result.status,nativeGroups:16,uiGroups:14,providerRequests:0}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
