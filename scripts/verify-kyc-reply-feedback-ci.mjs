import {isProxy as preflightIsProxy,isSharedArrayBuffer as preflightIsSharedArrayBuffer} from 'node:util/types';
import {WORKSITE_LIVE_HOURS_CURRENT_SECTION,verifyWorksiteLiveHoursCurrentSources as worksiteSourceCheck0,verifyWorksiteLiveHoursActualClosure as worksiteSourceCheck1} from './lib/worksite-live-hours-current-ci-lineage.mjs';
function checkWorksiteSource(action){try{return action();}catch(error){if(error.code==='WORKSITE_LIVE_HOURS_CURRENT_CI_LINEAGE_REJECTED')requireProof(false,error.message);throw error;}}
const verifyWorksiteLiveHoursCurrentSources=(...args)=>checkWorksiteSource(()=>worksiteSourceCheck0(...args));
const verifyWorksiteLiveHoursActualClosure=(...args)=>checkWorksiteSource(()=>worksiteSourceCheck1(...args));
import {createHash} from 'node:crypto';
import {participantPreanalysisConsumerSourceFiles,preloadParticipantPreanalysisConsumerSources} from './lib/participant-preanalysis-current-ci-lineage.mjs';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from '@babel/parser';
import {PLAN_MEASUREMENT_CONSUMER_CI_HELPER,PLAN_MEASUREMENT_CONSUMER_SOURCES,validatePlanMeasurementConsumerSourceLineage} from './lib/plan-measurement-consumer-ci-lineage.mjs';
import {COMPANY_KYC_REJECTION_FEEDBACK_PROOF_VERSION,COMPANY_KYC_REJECTION_FEEDBACK_CHECKS,COMPANY_KYC_REJECTION_SYNTHETIC_REPLY_COUNT} from './verify-company-kyc-rejection-feedback-postgres.mjs';
import {KYC_REPLY_FEEDBACK_UI_VERSION,KYC_REPLY_FEEDBACK_UI_WIDTHS,KYC_REPLY_FEEDBACK_UI_STATES,KYC_REPLY_FEEDBACK_UI_CHECKS} from './verify-kyc-reply-feedback-ui.mjs';

// This extra pass is confined to passive JSON receipts and ordinary source
// bytes. Active/exotic inputs retain the complete original validation path.
const preflightGetPrototype=Object.getPrototypeOf,preflightDescriptor=Object.getOwnPropertyDescriptor,preflightDescriptors=Object.getOwnPropertyDescriptors,preflightKeys=Reflect.ownKeys,preflightApply=Reflect.apply,preflightHas=Object.hasOwn,preflightObjectPrototype=Object.prototype,preflightArrayPrototype=Array.prototype,preflightBufferPrototype=Buffer.prototype,preflightUint8Prototype=Uint8Array.prototype;
const preflightObjectConstructor=Object,preflightArrayConstructor=Array,preflightBufferConstructor=Buffer,preflightNumberConstructor=Number,preflightWeakSetConstructor=WeakSet,preflightReflectObject=Reflect,preflightJsonObject=JSON,preflightArrayIsArray=Array.isArray,preflightBufferIsBuffer=Buffer.isBuffer,preflightIsFinite=Number.isFinite,preflightSeenHas=WeakSet.prototype.has,preflightSeenAdd=WeakSet.prototype.add;
const preflightTypedPrototype=preflightGetPrototype(preflightUint8Prototype),preflightBackingGetter=preflightDescriptor(preflightTypedPrototype,'buffer').get,preflightFunctionText=Function.prototype.toString,preflightSameValue=Object.is;
const preflightPrototypes=[preflightObjectPrototype,preflightArrayPrototype,preflightBufferPrototype,preflightUint8Prototype,preflightTypedPrototype,Function.prototype,String.prototype,RegExp.prototype,preflightObjectConstructor,preflightArrayConstructor,preflightBufferConstructor,preflightNumberConstructor,preflightWeakSetConstructor,WeakSet.prototype,preflightReflectObject,preflightJsonObject],preflightPrototypeDescriptors=preflightPrototypes.map(value=>preflightDescriptors(value)),preflightPrototypeParents=preflightPrototypes.map(value=>preflightGetPrototype(value));
const preflightBufferOwnHooks=['toString','valueOf','slice','subarray','equals','toJSON','length','byteLength','byteOffset','buffer','constructor','parent','offset','utf8Slice',Symbol.toPrimitive,Symbol.iterator];
function preflightSameDescriptor(a,b){if(a===undefined||b===undefined)return a===b;const fields=['value','get','set','writable','enumerable','configurable'];for(let i=0;i<fields.length;i++){const key=fields[i],left=preflightHas(a,key),right=preflightHas(b,key);if(left!==right||left&&!preflightSameValue(a[key],b[key]))return false;}return true;}
function preflightStablePrototypes(){for(let i=0;i<preflightPrototypes.length;i++){if(preflightGetPrototype(preflightPrototypes[i])!==preflightPrototypeParents[i])return false;const before=preflightPrototypeDescriptors[i],after=preflightDescriptors(preflightPrototypes[i]),keys=preflightKeys(before),current=preflightKeys(after);if(keys.length!==current.length)return false;for(let j=0;j<keys.length;j++)if(keys[j]!==current[j]||!preflightSameDescriptor(before[keys[j]],after[current[j]]))return false;}return true;}
function preflightPassiveJson(value,seen){
 if(value===null||typeof value==='string'||typeof value==='boolean')return true;
 if(typeof value==='number')return preflightIsFinite(value);
 if(typeof value!=='object'||preflightIsProxy(value)||preflightApply(preflightSeenHas,seen,[value]))return false;
 const prototype=preflightGetPrototype(value),array=preflightArrayIsArray(value);if(array?prototype!==preflightArrayPrototype:prototype!==preflightObjectPrototype&&prototype!==null)return false;
 preflightApply(preflightSeenAdd,seen,[value]);const descriptors=preflightDescriptors(value),keys=preflightKeys(descriptors);let count=0;
 for(let i=0;i<keys.length;i++){const key=keys[i],descriptor=descriptors[key];if(array&&key==='length')continue;if(typeof key!=='string'||!preflightHas(descriptor,'value')||descriptor.enumerable!==true)return false;if(array&&key!==''+count++)return false;if(!preflightPassiveJson(descriptor.value,seen))return false;}
 return !array||count===descriptors.length.value;
}
function preflightOrdinarySources(sources){
 if(!sources||typeof sources!=='object'||preflightIsProxy(sources))return false;const prototype=preflightGetPrototype(sources);if(prototype!==preflightObjectPrototype&&prototype!==null)return false;
 const descriptors=preflightDescriptors(sources),keys=preflightKeys(descriptors);
 for(let i=0;i<keys.length;i++){const key=keys[i],descriptor=descriptors[key];if(typeof key!=='string'||!preflightHas(descriptor,'value')||descriptor.enumerable!==true)return false;const value=descriptor.value;if(value===null||typeof value==='string')continue;if(!value||typeof value!=='object'||preflightIsProxy(value)||!preflightBufferIsBuffer(value)||preflightGetPrototype(value)!==preflightBufferPrototype)return false;for(let j=0;j<preflightBufferOwnHooks.length;j++)if(preflightDescriptor(value,preflightBufferOwnHooks[j])!==undefined)return false;if(preflightIsSharedArrayBuffer(preflightApply(preflightBackingGetter,value,[])))return false;}
 return true;
}
function preflightPassiveInput(sources,postgres,ui){
 try{
  if(Object!==preflightObjectConstructor||Array!==preflightArrayConstructor||Buffer!==preflightBufferConstructor||Number!==preflightNumberConstructor||WeakSet!==preflightWeakSetConstructor||Reflect!==preflightReflectObject||JSON!==preflightJsonObject)return false;
  if(!preflightStablePrototypes()||preflightDescriptor(preflightObjectPrototype,'toJSON')!==undefined||preflightDescriptor(preflightArrayPrototype,'toJSON')!==undefined||preflightGetPrototype(preflightArrayPrototype)!==preflightObjectPrototype||preflightGetPrototype(preflightBufferPrototype)!==preflightUint8Prototype||preflightGetPrototype(preflightUint8Prototype)!==preflightTypedPrototype||preflightGetPrototype(preflightTypedPrototype)!==preflightObjectPrototype)return false;
  if(preflightIsProxy(JSON))return false;const stringify=preflightDescriptor(JSON,'stringify');if(!stringify||!preflightHas(stringify,'value')||typeof stringify.value!=='function'||preflightIsProxy(stringify.value)||preflightApply(preflightFunctionText,stringify.value,[])!=='function stringify() { [native code] }')return false;
  if(!preflightSameDescriptor({get:preflightBackingGetter,set:undefined,enumerable:false,configurable:true},preflightDescriptor(preflightTypedPrototype,'buffer')))return false;
  return preflightPassiveJson(postgres,new preflightWeakSetConstructor())&&preflightPassiveJson(ui,new preflightWeakSetConstructor())&&preflightOrdinarySources(sources);
 }catch{return false;}
}
function preflightIsRejection(error,code){if(!error||typeof error!=='object'||preflightIsProxy(error))return false;const descriptor=preflightDescriptor(error,'code');return Boolean(descriptor&&preflightHas(descriptor,'value')&&descriptor.value===code);}


export const KYC_REPLY_FEEDBACK_CI_VERSION='kyc-reply-feedback-ci-v1';
const pgHarness='scripts/verify-company-kyc-rejection-feedback-postgres.mjs';
const uiHarness='scripts/verify-kyc-reply-feedback-ui.mjs';
const cleanupHelper='scripts/lib/owned-fixture-cleanup.mjs';
const uiEntry='src/app/(identity)/cuenta/participant-kyc-chat-attempt-panel.js';
const dependencies=['package.json','package-lock.json'];
// CURRENT gains the read-only report reader through field-operations-store.
// The previous 108-path corpus stays immutable and cannot certify this graph.
const previousNativeSourceCount=108;
const previousNativeSourcePathsSha256='22aad1acbef9973d5061779979de33b77428af23eb013ee0367c151bdd8e9bcd';
const currentOwnReportSource='src/lib/field-report-feedback.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const revision=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
const own=(value,key)=>Object.hasOwn(value,key);
function requireProof(condition,message){if(!condition)throw Object.assign(new Error(message),{code:'KYC_REPLY_FEEDBACK_CI_REJECTED'});}
function same(actual,expected,message){requireProof(JSON.stringify(actual)===JSON.stringify(expected),message);}
const sourcePath=value=>typeof value==='string'&&!value.includes('\\')&&!value.includes('\0')&&!path.posix.isAbsolute(value)&&path.posix.normalize(value)===value&&!value.startsWith('../')&&/^(?:src|scripts)\//.test(value);
function importPaths(bytes,filename){
 if(filename.endsWith('.css')){requireProof(!/@import\s|url\(\s*['"]?(?!data:|#)/i.test(bytes.toString()),'External stylesheet dependency: '+filename);return [];}
 const ast=parse(bytes.toString(),{sourceType:'module',plugins:['jsx'],createImportExpressions:true}),imports=[];
 function visit(node){
  if(!node||typeof node!=='object')return;
  if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)&&node.source)imports.push(node.source.value);
  if(node.type==='ImportExpression'){requireProof(node.source.type==='StringLiteral','Nonliteral import: '+filename);imports.push(node.source.value);}
  if(node.type==='CallExpression'&&node.callee?.type==='Import'){requireProof(node.arguments[0]?.type==='StringLiteral','Nonliteral import: '+filename);imports.push(node.arguments[0].value);}
  for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);
 }
 visit(ast.program);return imports;
}
// Production producers never execute here. The CLI reads exact committed Git
// blobs; tests supply isolated bytes to challenge the same verifier.
export function kycReplyFeedbackSourceClosure(readSource,{ui=false}={}){
 const files=new Set(ui?[]:dependencies),external=new Set();
 for(const file of files)requireProof(readSource(file)!==null,'Missing committed dependency: '+file);
 function visit(file){
  requireProof(sourcePath(file),'Unsafe relative source dependency: '+file);if(files.has(file))return;
  const bytes=readSource(file);requireProof(bytes!==null,'Missing committed dependency: '+file);files.add(file);
  for(const specifier of importPaths(bytes,file)){
   if(!specifier.startsWith('.')){external.add(specifier);continue;}
   const absolute=path.posix.normalize(path.posix.join(path.posix.dirname(file),specifier));
   const dependency=[absolute,absolute+'.js',absolute+'.mjs',absolute+'.css',path.posix.join(absolute,'index.js')].find(candidate=>sourcePath(candidate)&&readSource(candidate)!==null);
   requireProof(Boolean(dependency),'Missing relative dependency '+specifier+' from '+file);visit(dependency);
  }
 }
 visit(ui?uiEntry:pgHarness);return {files:[...files].sort(),externalImports:[...external].sort()};
}
function manifest(records,files,readSource,label){
 requireProof(Array.isArray(records)&&records.length===files.length,label+' source manifest is incomplete');
 const found=new Map();for(const record of records){requireProof(record&&typeof record==='object'&&typeof record.path==='string'&&hash(record.sha256)&&!found.has(record.path),label+' duplicate or malformed source');found.set(record.path,record.sha256);}
 same([...found.keys()].sort(),[...files].sort(),label+' manifest must equal the committed AST dependency closure');
 for(const file of files)requireProof(found.get(file)===sha(readSource(file)),label+' stale committed source hash: '+file);
}
function provenance(proof,{expectedHead,sourceTree},label){
 requireProof(proof&&proof.status==='PASS'&&proof.sourceRevision===expectedHead&&proof.sourceTree===sourceTree&&proof.trackedClean===true&&proof.sourceState==='EXACT_CI_SOURCE',label+' requires exact clean CI commit/tree provenance');
 requireProof(proof.productionDataWritten===false&&proof.realIdentityDocuments===false,label+' cannot certify production or real identity documents');
}
function uiChecks(proof){
 same(proof.widths,KYC_REPLY_FEEDBACK_UI_WIDTHS,'UI viewport matrix must be complete');
 requireProof(proof.totalCheckCount===22&&Array.isArray(proof.checks)&&proof.checks.length===22,'UI needs all 22 checks');
 const names=proof.checks.map(check=>{if(!check||typeof check!=='object')return null;const suffix=check.check==='responsive-keyboard-api-accepted-never-means-delivered'?check.width:check.check==='late-private-response-never-enters-new-context'?check.changed:check.check==='authorization-denial-clears-loaded-private-diagnostic'?check.status:check.state;return check.check+':'+suffix;});
 same(names,KYC_REPLY_FEEDBACK_UI_CHECKS,'UI must preserve every named scope, denial and delivery scenario');
 for(const [index,check]of proof.checks.slice(0,4).entries()){
  requireProof(check.width===KYC_REPLY_FEEDBACK_UI_WIDTHS[index]&&Number.isSafeInteger(check.documentWidth)&&check.documentWidth>0&&check.documentWidth<=check.width&&check.steps===3,'UI three-step timeline must fit the viewport');
  requireProof(Array.isArray(check.targets)&&check.targets.length>=2&&check.targets.every(target=>Number.isFinite(target?.height)&&target.height>=44&&Number.isFinite(target.width)&&target.width>=44),'UI requires measured keyboard and touch targets');
  requireProof(typeof check.delivery==='string'&&check.delivery.includes('Entrega sin comprobar')&&!check.delivery.includes('Entrega comprobada'),'API acceptance cannot certify delivery');
 }
 for(const [index,state]of KYC_REPLY_FEEDBACK_UI_STATES.entries()){
  const check=proof.checks[4+index];requireProof(check.response===(state==='LEGACY'?'NOT_OBSERVED':state),'UI state must remain truthful');
  same(check.times,['NOT_OBSERVED','UNAVAILABLE','WINDOW_CLOSED','LEGACY'].includes(state)?['2026-10-12T12:00:00.000Z']:['2026-10-12T12:00:00.000Z','2026-10-12T12:00:03.000Z'],'UI dates must preserve actual observed and reply instants');
 }
 requireProof(proof.checks[20].status===401&&proof.checks[21].status===403,'UI denial statuses must match the numeric HTTP contract');
 // Each scenario starts at A/A. Late scope/challenge changes happen after
 // the original GET; no second query is authorized by that held response.
 requireProof(proof.automaticPostCount===0&&Array.isArray(proof.apiRequests)&&proof.apiRequests.length===28&&proof.apiRequests.every(request=>request&&typeof request==='object'&&!Array.isArray(request)&&Object.keys(request).sort().join('|')==='challengeId|method|scope'&&request.method==='GET'&&request.scope==='a'.repeat(64)&&request.challengeId==='kyc_chat_'+'a'.repeat(32)),'UI diagnostics must use exactly the bounded original A/A readonly GET matrix');
}
export function validateKycReplyFeedbackCi({expectedHead,head,sourceTree,trackedClean,gitSources,postgres,ui}){
 requireProof(revision(expectedHead)&&head===expectedHead&&revision(sourceTree)&&trackedClean===true,'Expected Git HEAD/tree and tracked source must be exact and clean');
 requireProof(gitSources&&typeof gitSources==='object'&&!Array.isArray(gitSources),'Committed Git blob map required');
 const readSource=file=>own(gitSources,file)?gitSources[file]:null;
 for(const file of [pgHarness,uiHarness,cleanupHelper,...dependencies])requireProof(readSource(file)!==null,'Missing committed producer/dependency: '+file);
 provenance(postgres,{expectedHead,sourceTree},'PostgreSQL');provenance(ui,{expectedHead,sourceTree},'UI');
 requireProof(postgres.version===COMPANY_KYC_REJECTION_FEEDBACK_PROOF_VERSION&&postgres.environment==='local-disposable-postgresql'&&postgres.postgresExecuted===true,'PostgreSQL must use the native disposable producer');
 requireProof(postgres.providerCalls===0&&postgres.mediaCalls===0&&postgres.depositCalls===0&&postgres.identityCertified===false&&postgres.permissionsGranted===false&&postgres.syntheticReplyCalls===COMPANY_KYC_REJECTION_SYNTHETIC_REPLY_COUNT,'Native callback/reply counters and identity boundary must match the closed fixture');
 requireProof(postgres.poolClosed===true&&postgres.databaseRemoved===true,'PostgreSQL pool and owned database cleanup must be confirmed');
 requireProof(postgres.totalCheckCount===8&&Array.isArray(postgres.checks),'PostgreSQL needs all eight native groups');same(postgres.checks,COMPANY_KYC_REJECTION_FEEDBACK_CHECKS,'Native signed-callback, limits and revocation checks must match the complete exported contract');
  // Reject passive receipt/source defects early; keep every original late check below.
  if(preflightPassiveInput(gitSources,postgres,ui)){try{

   const earlyPg=kycReplyFeedbackSourceClosure(readSource);
   manifest(postgres.sourceManifest,earlyPg.files,readSource,'PostgreSQL');requireProof(postgres.harnessSha256===sha(readSource(pgHarness)),'Native producer must match committed Git bytes');
   requireProof(ui.version===KYC_REPLY_FEEDBACK_UI_VERSION&&ui.environment==='isolated-localhost-next-exact-jsx-readonly-synthetic-api'&&ui.providerRequests===0&&ui.productionLoginVerified===false&&ui.physicalDeviceAccepted===false,'UI requires synthetic authentication, APIs and zero providers');
   for(const key of ['pageErrors','interceptErrors','externalRequests'])requireProof(Array.isArray(ui[key])&&ui[key].length===0,'UI '+key+' must be empty');
   const earlyCleanup=ui.cleanup;requireProof(earlyCleanup&&earlyCleanup.browserClosed===true&&earlyCleanup.serverClosed===true&&earlyCleanup.gracefulCloseAcknowledged===true&&earlyCleanup.fixtureRemoved===true&&earlyCleanup.fixtureCleanupProof?.fixtureRemoved===true&&earlyCleanup.fixtureCleanupProof?.postcondition?.absent===true,'Owned browser/server/fixture cleanup must be confirmed');
   uiChecks(ui);const earlyBrowser=kycReplyFeedbackSourceClosure(readSource,{ui:true});requireProof(earlyBrowser.files.length===3,'UI closure must contain all three production sources');manifest(ui.sourceManifest,earlyBrowser.files,readSource,'UI');manifest(ui.dependencyManifest,dependencies,readSource,'UI dependencies');same(ui.externalImports,earlyBrowser.externalImports,'UI imports must match the committed JSX graph');same(ui.externalImports,['react'],'UI package dependency boundary changed');
   requireProof(ui.harnessSha256===sha(readSource(uiHarness))&&ui.cleanupHelperSha256===sha(readSource(cleanupHelper)),'UI producer and owned cleanup helper must match committed Git bytes');
  }catch(error){if(preflightIsRejection(error,'KYC_REPLY_FEEDBACK_CI_REJECTED'))throw error;}}
 const pg=kycReplyFeedbackSourceClosure(readSource),currentSourceContract=JSON.parse(readSource('.github/workspace-acceptance-contract.json'));if(currentSourceContract[WORKSITE_LIVE_HOURS_CURRENT_SECTION]){verifyWorksiteLiveHoursCurrentSources(currentSourceContract,readSource);verifyWorksiteLiveHoursActualClosure(currentSourceContract,'KYC_REPLY_FEEDBACK',pg,readSource);}let historicalNativeFiles,sourceLineage;try{historicalNativeFiles=participantPreanalysisConsumerSourceFiles('KYC_REPLY_FEEDBACK',pg.files,readSource);sourceLineage=validatePlanMeasurementConsumerSourceLineage({family:'KYC_REPLY_FEEDBACK',files:pg.files,readSource});}catch(error){requireProof(false,error.message);}requireProof(historicalNativeFiles.length===previousNativeSourceCount+1+PLAN_MEASUREMENT_CONSUMER_SOURCES.length&&pg.files.filter(file=>file===currentOwnReportSource).length===1,'Native CURRENT closure requires the original 108 sources, its exact own-report reader and two source import dependencies');
 const previous=historicalNativeFiles.filter(file=>file!==currentOwnReportSource&&!PLAN_MEASUREMENT_CONSUMER_SOURCES.includes(file));requireProof(previous.length===previousNativeSourceCount&&sha(JSON.stringify(previous))===previousNativeSourcePathsSha256,'Native previous 108-path lineage must remain immutable');
 manifest(postgres.sourceManifest,pg.files,readSource,'PostgreSQL');requireProof(postgres.harnessSha256===sha(readSource(pgHarness)),'Native producer must match committed Git bytes');
 requireProof(['src/lib/plan-baseline-policy.mjs','src/lib/plan-import-document-curve.mjs'].every(file=>pg.files.includes(file)),'Current native document curve dependency lineage');
 requireProof(['src/lib/participant-civil-store.mjs','src/lib/participant-civil-policy.mjs','src/lib/bindx-civil-data-client.mjs'].every(file=>pg.files.includes(file)),'The current native lineage requires every durable civil source');
 requireProof(ui.version===KYC_REPLY_FEEDBACK_UI_VERSION&&ui.environment==='isolated-localhost-next-exact-jsx-readonly-synthetic-api'&&ui.providerRequests===0&&ui.productionLoginVerified===false&&ui.physicalDeviceAccepted===false,'UI requires synthetic authentication, APIs and zero providers');
 for(const key of ['pageErrors','interceptErrors','externalRequests'])requireProof(Array.isArray(ui[key])&&ui[key].length===0,'UI '+key+' must be empty');
 const cleanup=ui.cleanup;requireProof(cleanup&&cleanup.browserClosed===true&&cleanup.serverClosed===true&&cleanup.gracefulCloseAcknowledged===true&&cleanup.fixtureRemoved===true&&cleanup.fixtureCleanupProof?.fixtureRemoved===true&&cleanup.fixtureCleanupProof?.postcondition?.absent===true,'Owned browser/server/fixture cleanup must be confirmed');
 uiChecks(ui);const browser=kycReplyFeedbackSourceClosure(readSource,{ui:true});requireProof(browser.files.length===3,'UI closure must contain all three production sources');manifest(ui.sourceManifest,browser.files,readSource,'UI');manifest(ui.dependencyManifest,dependencies,readSource,'UI dependencies');same(ui.externalImports,browser.externalImports,'UI imports must match the committed JSX graph');same(ui.externalImports,['react'],'UI package dependency boundary changed');
 requireProof(ui.harnessSha256===sha(readSource(uiHarness))&&ui.cleanupHelperSha256===sha(readSource(cleanupHelper)),'UI producer and owned cleanup helper must match committed Git bytes');
 return {version:KYC_REPLY_FEEDBACK_CI_VERSION,status:'PASS',sourceRevision:expectedHead,sourceTree,sourceState:'EXACT_CI_SOURCE',trackedClean:true,postgres:{version:postgres.version,totalCheckCount:8,sourceCount:pg.files.length,syntheticReplyCalls:postgres.syntheticReplyCalls,harnessSha256:postgres.harnessSha256,sourceLineage},ui:{version:ui.version,totalCheckCount:22,sourceCount:3,dependencyCount:2,widths:[...KYC_REPLY_FEEDBACK_UI_WIDTHS],automaticPostCount:0,apiRequestCount:28,harnessSha256:ui.harnessSha256,cleanupHelperSha256:ui.cleanupHelperSha256},providerCalls:0,productionDataWritten:false,realIdentityDocuments:false,identityCertified:false,permissionsGranted:false,productionLoginVerified:false,physicalDeviceAccepted:false};
}
function main(){
 const args=process.argv.slice(2);requireProof(args.length===2&&args[0]==='--expected-head'&&revision(args[1]),'Usage: --expected-head <full Git SHA>');
 const root=process.cwd(),expectedHead=args[1],git=(...values)=>execFileSync('git',values,{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024,windowsHide:true}).trim();
 if(process.env.GITHUB_SHA)requireProof(process.env.GITHUB_SHA===expectedHead,'Expected HEAD must match the CI event');
 if(process.env.CI==='true')requireProof(process.env.GITHUB_SHA===expectedHead,'CI needs its exact event SHA');
 const head=git('rev-parse','HEAD'),sourceTree=git('rev-parse','HEAD^{tree}'),trackedClean=git('status','--porcelain','--untracked-files=no')==='';requireProof(head===expectedHead&&trackedClean,'CLI needs the exact clean expected checkout');
 const committed=new Set(git('ls-tree','-r','--name-only',expectedHead).split('\n')),gitSources=Object.create(null),readSource=file=>{if(!committed.has(file))return null;if(!own(gitSources,file))gitSources[file]=execFileSync('git',['show',expectedHead+':'+file],{cwd:root,maxBuffer:16*1024*1024,windowsHide:true});return gitSources[file];};
 const validatorPath='scripts/verify-kyc-reply-feedback-ci.mjs',validatorBytes=readFileSync(fileURLToPath(import.meta.url)),pg=kycReplyFeedbackSourceClosure(readSource),ui=kycReplyFeedbackSourceClosure(readSource,{ui:true});
 for(const file of new Set([validatorPath,PLAN_MEASUREMENT_CONSUMER_CI_HELPER,...pg.files,...ui.files,uiHarness,cleanupHelper,...dependencies]))requireProof(readSource(file)!==null&&sha(readFileSync(path.join(root,file)))===sha(readSource(file)),'Current source must equal committed expected Git bytes: '+file);
 const pgPath='.vercel/private/company-kyc-rejection-feedback-postgres.json',uiPath='.vercel/private/kyc-reply-feedback-evidence/browser.json',pgBytes=readFileSync(path.join(root,pgPath)),uiBytes=readFileSync(path.join(root,uiPath));
 preloadParticipantPreanalysisConsumerSources({readSource,readCheckout:file=>readFileSync(path.join(root,file))});
 const result=validateKycReplyFeedbackCi({expectedHead,head,sourceTree,trackedClean,gitSources,postgres:JSON.parse(pgBytes),ui:JSON.parse(uiBytes)});
 preloadParticipantPreanalysisConsumerSources({readSource,readCheckout:file=>readFileSync(path.join(root,file))});requireProof(git('rev-parse','HEAD')===head&&git('rev-parse','HEAD^{tree}')===sourceTree&&git('status','--porcelain','--untracked-files=no')==='','Source changed during proof validation');requireProof(sha(readFileSync(path.join(root,PLAN_MEASUREMENT_CONSUMER_CI_HELPER)))===sha(readSource(PLAN_MEASUREMENT_CONSUMER_CI_HELPER)),'Consumer lineage helper changed during validation');
 const output=path.join(root,'.vercel/private/kyc-reply-feedback-ci.json'),xml=output.replace(/\.json$/,'.xml');requireProof(!existsSync(output)&&!existsSync(xml),'A prior aggregate CI proof must not be overwritten');mkdirSync(path.dirname(output),{recursive:true});
 const proof={...result,checkedAt:new Date().toISOString(),validatorSha256:sha(validatorBytes),inputProofs:[{path:pgPath,sha256:sha(pgBytes)},{path:uiPath,sha256:sha(uiBytes)}]};
 writeFileSync(xml,'<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="kyc-reply-feedback-proof-validation" tests="2" failures="0"><testcase name="exact-native-eight-group-proof"/><testcase name="exact-dom-twenty-two-case-proof"/></testsuite>\n',{flag:'wx'});writeFileSync(output,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:proof.status,sourceRevision:head,output:path.relative(root,output).split(path.sep).join('/'),nativeChecks:8,uiChecks:22}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{main();}catch(error){console.error(JSON.stringify({status:'FAIL',code:error.code==='KYC_REPLY_FEEDBACK_CI_REJECTED'?error.code:'KYC_REPLY_FEEDBACK_CI_UNCONFIRMED',reason:error.code==='KYC_REPLY_FEEDBACK_CI_REJECTED'?error.message:'Proof verification could not be confirmed'}));process.exitCode=1;}}
