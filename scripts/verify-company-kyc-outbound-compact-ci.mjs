import {isProxy as preflightIsProxy,isSharedArrayBuffer as preflightIsSharedArrayBuffer} from 'node:util/types';
import {validateWhatsappFieldNeutralStepNative,WHATSAPP_FIELD_CONTINUITY_NATIVE,WHATSAPP_FIELD_CONTINUITY_SECTION} from './lib/whatsapp-field-continuity-current-ci-lineage.mjs';
import {participantPreanalysisConsumerValidationFiles} from './lib/participant-preanalysis-current-ci-lineage.mjs';
import {createHash} from 'node:crypto';
import {validateIntegratedOwnCurrentNative} from './lib/integrated-identity-current-ci-lineage.mjs';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from '@babel/parser';
import {COMPANY_KYC_OUTBOUND_COMPACT_PROOF_VERSION,COMPANY_KYC_OUTBOUND_COMPACT_CHECKS,COMPANY_KYC_CONTEXT_OUTBOUND_CHECKS,COMPANY_KYC_LATEST_EXPIRED_COMPOSITION_CHECKS} from './verify-company-kyc-outbound-compact-postgres.mjs';
import {readCustomerOutboundDiagnostic} from '../src/lib/meta-customer-outbound.mjs';
import {KYC_EXPIRED_CURRENT_CONTRACT_PATH,KYC_EXPIRED_CURRENT_VALIDATION_SOURCES,KYC_EXPIRED_CURRENT_REVIEWED_SOURCES,validateKycExpiredCurrentWorkspaceContract,validateKycExpiredCurrentReceipt} from './lib/kyc-expired-current-ci-lineage.mjs';
import {validatePlanMeasurementCurrentCompactReceipt} from './lib/plan-measurement-current-ci-lineage.mjs';

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

// Additional eligibility only; no active global accessor is read by this gate.
const preflightGlobalObject=globalThis,preflightDateConstructor=Date,preflightSetConstructor=Set,preflightErrorConstructor=Error,preflightBooleanConstructor=Boolean,preflightMapConstructor=Map,preflightStringConstructor=String;
const preflightGlobalKeys=['Object','Array','Buffer','Number','WeakSet','Reflect','JSON','Date','Set','Error','Boolean','Map','String','structuredClone'],preflightGlobalDescriptors=preflightGlobalKeys.map(key=>preflightDescriptor(preflightGlobalObject,key));
const preflightDatePrototype=preflightDateConstructor.prototype,preflightSetPrototype=preflightSetConstructor.prototype,preflightErrorPrototype=preflightErrorConstructor.prototype,preflightBooleanPrototype=preflightBooleanConstructor.prototype,preflightMapPrototype=preflightMapConstructor.prototype,preflightStringPrototype=preflightStringConstructor.prototype;
const preflightArrayIteratorPrototype=preflightGetPrototype(preflightApply(preflightArrayPrototype.values,[],[])),preflightIteratorPrototype=preflightGetPrototype(preflightArrayIteratorPrototype),preflightMapIteratorPrototype=preflightGetPrototype(preflightApply(preflightMapPrototype.entries,new preflightMapConstructor(),[])),preflightSetIteratorPrototype=preflightGetPrototype(preflightApply(preflightSetPrototype.values,new preflightSetConstructor(),[]));
const preflightAdditionalPrototypes=[preflightDateConstructor,preflightDatePrototype,preflightSetConstructor,preflightSetPrototype,preflightErrorConstructor,preflightErrorPrototype,preflightBooleanConstructor,preflightBooleanPrototype,preflightMapConstructor,preflightMapPrototype,preflightStringConstructor,preflightStringPrototype,preflightArrayIteratorPrototype,preflightIteratorPrototype,preflightMapIteratorPrototype,preflightSetIteratorPrototype],preflightAdditionalDescriptors=preflightAdditionalPrototypes.map(value=>preflightDescriptors(value)),preflightAdditionalParents=preflightAdditionalPrototypes.map(value=>preflightGetPrototype(value));
function preflightAdditionalIntrinsicsStable(){
 try{
  for(let i=0;i<preflightGlobalKeys.length;i++)if(!preflightSameDescriptor(preflightGlobalDescriptors[i],preflightDescriptor(preflightGlobalObject,preflightGlobalKeys[i])))return false;
  for(let i=0;i<preflightAdditionalPrototypes.length;i++){
   const value=preflightAdditionalPrototypes[i];if(preflightGetPrototype(value)!==preflightAdditionalParents[i])return false;
   const before=preflightAdditionalDescriptors[i],after=preflightDescriptors(value),keys=preflightKeys(before),current=preflightKeys(after);if(keys.length!==current.length)return false;
   for(let j=0;j<keys.length;j++)if(keys[j]!==current[j]||!preflightSameDescriptor(before[keys[j]],after[current[j]]))return false;
  }
  return true;
 }catch{return false;}
}

export const COMPANY_KYC_OUTBOUND_COMPACT_CI_VERSION='company-kyc-outbound-compact-ci-v1';
const producer='scripts/verify-company-kyc-outbound-compact-postgres.mjs';
const validator='scripts/verify-company-kyc-outbound-compact-ci.mjs';
const baselineFixture='tests/fixtures/meta-kyc-outbound-baseline-b572.json';
const baselineRevision='b5723d23092bd214b9271582af8e6bcb2c929a66';
const baselineSourceHash='3f562c8d30280bf9ccce53a94523c9f0dd33278ce744bd72cae3949becc72f7f';
const proofPath='.vercel/private/company-kyc-outbound-compact-postgres.json';
const outputPath='.vercel/private/company-kyc-outbound-compact-ci.json';
const lineageAuditSources=[KYC_EXPIRED_CURRENT_CONTRACT_PATH,...KYC_EXPIRED_CURRENT_VALIDATION_SOURCES,...KYC_EXPIRED_CURRENT_REVIEWED_SOURCES.map(ref=>ref.path)];
const preanalysisProducerSources=contract=>contract.participantPreanalysisCurrentRevision?['scripts/verify-participant-kyc-preanalysis-postgres.mjs',...contract.participantPreanalysisCurrentRevision.unitSuites.map(row=>row.file)]:[];
const sha=value=>createHash('sha256').update(value).digest('hex');
const revision=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const safeSource=value=>typeof value==='string'&&!value.includes('\\')&&!value.includes('\0')&&!path.posix.isAbsolute(value)&&path.posix.normalize(value)===value&&!value.startsWith('../')&&/^(?:src|scripts|tests)\//.test(value);
function requireProof(condition,message){if(!condition)throw Object.assign(new Error(message),{code:'KYC_OUTBOUND_COMPACT_CI_REJECTED'});}
function same(actual,expected,message){requireProof(JSON.stringify(actual)===JSON.stringify(expected),message);}
function sourceBytes(readSource,file){const bytes=readSource(file);requireProof(Buffer.isBuffer(bytes),'Missing committed source: '+file);return bytes;}
function baseline(readSource){
 const value=JSON.parse(sourceBytes(readSource,baselineFixture));
 same(Object.keys(value).sort(),['source','sourcePath','sourceRevision','sourceSha256','version'],'Immutable baseline shape changed');
 requireProof(value.version===1&&value.sourceRevision===baselineRevision&&value.sourcePath==='src/lib/meta-kyc-outbound.mjs'&&value.sourceSha256===baselineSourceHash&&sha(value.source)===baselineSourceHash,'Immutable source baseline changed');
 return value;
}
function baselineImport(node){
 const expression=node.source||node.arguments?.[0],call=expression?.right;
 return expression?.type==='BinaryExpression'&&expression.operator==='+'&&expression.left?.type==='StringLiteral'&&expression.left.value==='data:text/javascript;base64,'&&call?.type==='CallExpression'&&call.arguments.length===1&&call.arguments[0]?.value==='base64'&&call.callee?.type==='MemberExpression'&&!call.callee.computed&&call.callee.property?.name==='toString'&&call.callee.object?.type==='CallExpression'&&call.callee.object.arguments.length===1&&call.callee.object.arguments[0]?.name==='baselineModule'&&call.callee.object.callee?.type==='MemberExpression'&&!call.callee.object.callee.computed&&call.callee.object.callee.object?.name==='Buffer'&&call.callee.object.callee.property?.name==='from';
}
// Reads the complete committed import graph; it never executes the producer.
export function companyKycOutboundCompactCiSourceClosure(readSource){
 const files=new Set(['package.json','package-lock.json',baselineFixture]),external=new Set();let computedImports=0;
 // Validation sources bind the CI receipt separately; the measured native
 // producer and runtime closure remains exactly 125 sources.
 for(const file of lineageAuditSources)sourceBytes(readSource,file);
 const sourceContract=JSON.parse(sourceBytes(readSource,KYC_EXPIRED_CURRENT_CONTRACT_PATH));for(const ref of sourceContract.planMeasurementCurrentLineage?.currentValidationSources||[])sourceBytes(readSource,ref.path);for(const delta of sourceContract.planMeasurementCurrentLineage?.currentProofChanges||[])sourceBytes(readSource,sourceContract.extension.proofs.find(spec=>spec.id===delta.id)?.producer);
 for(const ref of sourceContract.fieldOutboundCurrentRevision?.validationSources||[])sourceBytes(readSource,ref.path);
 for(const ref of sourceContract.ooxmlAccountingCurrentRevision?.validationSources||[])sourceBytes(readSource,ref.path);
 for(const ref of sourceContract.participantPreanalysisCurrentRevision?.validationSources||[])sourceBytes(readSource,ref.path);
 for(const ref of sourceContract.integratedIdentityCurrentRevision?.validationSources||[])sourceBytes(readSource,ref.path);
 for(const file of preanalysisProducerSources(sourceContract))sourceBytes(readSource,file);
 for(const file of participantPreanalysisConsumerValidationFiles(sourceContract))sourceBytes(readSource,file);
 for(const file of files)sourceBytes(readSource,file);
 function imports(bytes,file){
  const tree=parse(bytes.toString('utf8'),{sourceType:'module',plugins:['jsx'],createImportExpressions:true}),references=[];
  function walk(node){
   if(!node||typeof node!=='object')return;
   const dynamic=node.type==='ImportExpression'||node.type==='CallExpression'&&node.callee?.type==='Import';
   const ref=['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration','ImportExpression'].includes(node.type)?node.source:dynamic?node.arguments[0]:null;
   if(ref){
    if(ref.type==='StringLiteral')references.push(ref.value);
    else {requireProof(dynamic&&file===producer&&baselineImport(node),'Unbounded computed source import: '+file);computedImports++;}
   }
   for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);
  }
  walk(tree);return references;
 }
 function visit(file){
  requireProof(safeSource(file),'Unsafe source dependency: '+file);if(files.has(file))return;
  const bytes=sourceBytes(readSource,file);files.add(file);
  for(const specifier of imports(bytes,file)){
   if(!specifier.startsWith('.')){requireProof(!/^(?:https?:|file:|data:)/.test(specifier),'External source dependency: '+file);external.add(specifier);continue;}
   const dependency=path.posix.normalize(path.posix.join(path.posix.dirname(file),specifier));requireProof(safeSource(dependency),'Unsafe relative dependency: '+file);visit(dependency);
  }
 }
 visit(producer);
 visit('src/lib/meta-customer-processing-runtime.mjs');
 const previous=baseline(readSource);
 for(const specifier of imports(Buffer.from(previous.source),previous.sourcePath)){requireProof(specifier.startsWith('.'),'Baseline external import changed');visit(path.posix.normalize(path.posix.join(path.posix.dirname(previous.sourcePath),specifier)));}
 requireProof(computedImports===1,'Expected one bounded immutable baseline import');
 return {files:[...files].sort(),externalImports:[...external].sort()};
}
function validateManifest(proof,files,readSource){
 requireProof(Array.isArray(proof.sourceManifest)&&proof.sourceManifest.length===files.length,'Incomplete native source closure');
 const found=new Map();for(const ref of proof.sourceManifest){requireProof(ref&&typeof ref.path==='string'&&hash(ref.sha256)&&!found.has(ref.path),'Duplicate or malformed native source');found.set(ref.path,ref.sha256);}
 same([...found.keys()].sort(),files,'Native manifest must equal committed transitive source closure');
 for(const file of files)requireProof(found.get(file)===sha(sourceBytes(readSource,file)),'Stale committed native source: '+file);
 requireProof(proof.harnessSha256===sha(sourceBytes(readSource,producer)),'Native producer differs from committed Git bytes');
}
function validateMeasurements(proof){
 requireProof(Array.isArray(proof.measurements)&&proof.measurements.length===3,'All current, delayed and baseline measurements required');
 same(proof.measurements.map(row=>row?.kind),['native-current','controlled-current','controlled-source-baseline'],'Measurement scenarios changed');
 for(const row of proof.measurements)requireProof(Number.isSafeInteger(row.sqlStatements)&&row.sqlStatements>0&&Number.isSafeInteger(row.fullResolutions)&&row.fullResolutions>0&&Number.isSafeInteger(row.compactFences)&&row.compactFences>=0&&Number.isFinite(row.elapsedMs)&&row.elapsedMs>=0&&row.sourceLeaseMs===60000&&row.leaseExtended===false,'Invalid native timing or source lease measurement');
 for(const row of proof.measurements.slice(0,2))requireProof(row.fullResolutions===4&&row.compactFences===17&&row.runtimeFences===16&&row.providerPosts===1&&row.replyState==='SENT','Current measured fences and one POST must match native assertions');
 const delayed=proof.measurements[1],previous=proof.measurements[2];
 for(const row of [delayed,previous])requireProof(row.statementDelayMs===225&&row.graphDelayMs===200&&row.productionLatencyMeasured===false,'Comparison must use the same controlled SQL and Graph delays');
 requireProof(delayed.elapsedMs<60000&&delayed.marginMs===60000-delayed.elapsedMs&&delayed.marginMs>0,'Controlled current path must retain the original source lease');
 requireProof(previous.baselineSourceRevision===baselineRevision&&previous.baselineOutboundSha256===baselineSourceHash&&previous.replySent===false&&previous.providerPosts===0&&previous.compactFences===0,'Source baseline must expire before its first POST');
 requireProof(previous.elapsedMs>=previous.sourceLeaseMs&&previous.fullResolutions>delayed.fullResolutions&&previous.sqlStatements>delayed.sqlStatements,'Original source must demonstrate repeated discovery and expired original lease under the same delays');
}
function validateScenarios(proof){
 const names=['native-current','distinct-participant-multiworksite','controlled-current','controlled-source-baseline','after-reserve-fault','source-lease-expired','issuer-revoked','credential-rotated','principal-trailed-ABA','between-KYC-runtime-clock-expired','provider-lost-ACK','same-client-new-transaction-before-prepare','same-client-new-transaction-after-prepare'];
 requireProof(Array.isArray(proof.scenarios),'Measured native scenario receipts required');same(proof.scenarios.map(row=>row?.name),names,'Every observed denial, uncertain send and replay scenario required');
 for(const [index,row] of proof.scenarios.slice(0,11).entries()){
  const sent=index<3,unknown=row.name==='provider-lost-ACK';
  requireProof(row.providerPosts===(sent||unknown?1:0)&&row.replayedPosts===0&&row.state===(sent?'SENT':unknown?'SEND_UNKNOWN':'SEND_STARTED')&&row.messageIdPresent===sent,'Native scenario state and measured provider/replay POST counts changed');
  if(row.diagnostic!=null){const diagnostic=readCustomerOutboundDiagnostic(row.diagnostic);requireProof(diagnostic!==null,'Only bounded private diagnostic fields allowed');same(row.diagnostic,diagnostic,'Unexpected private diagnostic fields');}
 }
 const different=proof.scenarios[1];requireProof(different.distinctParticipant===true&&different.distinctAnchorTarget===true&&different.fullResolutions===4&&different.compactFences===17&&different.runtimeFences===16,'Distinct participant and worksite authority must retain measured fences');
 const fault=proof.scenarios[4].diagnostic;requireProof(fault?.phase==='AFTER_RESERVE'&&fault.code==='META_OWN_COMPANY_OWNER_UNCONFIRMED','After-reservation first private cause must be retained');
 requireProof(proof.scenarios[10].diagnostic?.phase==='REPLY_POST','Uncertain provider POST must retain its private phase');
 for(const row of proof.scenarios.slice(11)){
  same(Object.keys(row).sort(),['graphRequests','name','newTransaction','providerPosts','rejectedCode','sameClient'],'Transaction authority checks must report measured authorization rejection without a delivery attempt');
  requireProof(row.providerPosts===0&&row.graphRequests===0&&row.rejectedCode==='META_KYC_COMPANY_AUTHORITY_CHANGED'&&row.sameClient===true&&row.newTransaction===true,'Prior transaction authority must reject prepare and reuse on the same client before Graph or POST');
 }
 requireProof(proof.syntheticMessagePostCount===4&&proof.scenarios.reduce((count,row)=>count+row.providerPosts,0)===proof.syntheticMessagePostCount,'Observed native synthetic POST total must equal scenario counters');
}
function validateContextFeedback(proof){
 const context=proof.contextFeedbackNative,row=context?.measurement;
 requireProof(context?.status==='PASS'&&context.kind==='OWN_COMPANY_RUNTIME'&&context.postgresExecuted===true&&context.sourcePromptConfirmed===true&&context.sourcePurpose==='KYC_CAPTURE'&&context.input==='ESTADO IDENTIDAD'&&context.priorPrompt===true,'OWN runtime feedback requires the exact confirmed prior KYC prompt and neutral input');
 same(context.checks,COMPANY_KYC_CONTEXT_OUTBOUND_CHECKS,'Every separate OWN context check required');
 requireProof(context.consentChosen===false&&context.identitySubmitted===false&&context.privateMediaCalls===0&&context.workerBytesUnchanged===true&&context.sourcePromptBytesUnchanged===true,'Context feedback cannot certify consent, capture or rewritten private/source state');
 requireProof(hash(context.workerBeforeSha256)&&context.workerBeforeSha256===context.workerAfterSha256&&hash(context.sourcePromptBeforeSha256)&&context.sourcePromptBeforeSha256===context.sourcePromptAfterSha256,'Before/after hashes must prove the original Worker and sent prompt are unchanged');
 requireProof(row&&row.kind==='controlled-own-context-feedback'&&row.fullResolutions===3&&Number.isSafeInteger(row.sqlStatements)&&row.sqlStatements>0&&Number.isSafeInteger(row.compactFences)&&row.compactFences>0&&Number.isSafeInteger(row.runtimeFences)&&row.runtimeFences>0&&Number.isSafeInteger(row.graphRequests)&&row.graphRequests>0,'Actual OWN feedback must report full resolutions, compact fences and Graph calls');
 requireProof(row.statementDelayMs===225&&row.graphDelayMs===200&&row.sourceLeaseMs===60000&&row.leaseExtended===false&&row.productionLatencyMeasured===false,'OWN controlled latency and original lease cannot be substituted');
 requireProof(Number.isFinite(row.elapsedMs)&&row.elapsedMs>0&&row.elapsedMs<60000&&Number.isFinite(row.prePostMs)&&row.prePostMs>0&&row.prePostMs<=row.elapsedMs&&row.marginMs===60000-row.elapsedMs&&row.marginMs>0,'OWN feedback must reach POST and completion inside the original lease');
 requireProof(row.providerPosts===1&&row.replayedPosts===0&&row.replyState==='SENT'&&row.messageIdPresent===true&&context.realProviderCalls===0&&context.productionDataTouched===false&&context.humanAccepted===false,'OWN feedback needs one synthetic POST with no replay or human acceptance claim');
 requireProof(proof.syntheticMessagePostCount+row.providerPosts===5,'The historical four POSTs and one prior-context POST need their unchanged separate subtotal');
}
function validateLatestExpiredComposition(proof){
 const context=proof.latestExpiredContextNative,row=context?.measurement;
 requireProof(context?.status==='PASS'&&context.kind==='OWN_COMPANY_RUNTIME'&&context.postgresExecuted===true&&context.compositionFactory==='createMetaCustomerProductionProcessor'&&context.input==='ESTADO IDENTIDAD'&&context.sourcePurpose==='KYC_CAPTURE'&&context.sourcePromptConfirmed===true&&context.quotedLatestPrompt===true&&context.fixtureConversationExpired===true&&context.challengeStillValid===true&&context.challengeStatus==='CLAIMED','Full production composition needs the same current confirmed prompt and expired conversation within a live CLAIMED challenge');
 same(context.checks,COMPANY_KYC_LATEST_EXPIRED_COMPOSITION_CHECKS,'Every separate latest-expired composition check required');
 same(context.calls,{rejectionRecovery:1,expiryRecovery:1,contextRecovery:1,contextPredispatch:1,intake:0,capture:0,app:0,company:0,field:0,expiryFallback:0,authorizationDefer:0},'Real recovery adapters must run before compact interception with no intake/capture/expiry fallback');
 requireProof(context.consentChosen===false&&context.identitySubmitted===false&&context.privateMediaCalls===0&&context.workerBytesUnchanged===true&&context.sourcePromptBytesUnchanged===true&&context.sourceEventBytesUnchanged===true&&context.realProviderCalls===0&&context.productionDataTouched===false&&context.humanAccepted===false,'Latest-expired composition cannot assert consent, private effects or real acceptance');
 for(const [before,after]of [['workerBeforeSha256','workerAfterSha256'],['sourcePromptBeforeSha256','sourcePromptAfterSha256'],['sourceEventBeforeSha256','sourceEventAfterSha256']])requireProof(hash(context[before])&&context[before]===context[after],'Latest-expired original private/source evidence changed');
 requireProof(row?.kind==='controlled-production-latest-expired-neutral'&&Number.isSafeInteger(row.sqlStatements)&&row.sqlStatements>0&&row.fullResolutions===3&&Number.isSafeInteger(row.compactFences)&&row.compactFences>0&&Number.isSafeInteger(row.runtimeFences)&&row.runtimeFences>0&&row.beforeDispatchReads===1&&Number.isSafeInteger(row.graphRequests)&&row.graphRequests>0,'Full composition must report actual before-dispatch, signed resolutions and Graph fences');
 requireProof(row.statementDelayMs===225&&row.graphDelayMs===200&&row.sourceLeaseMs===60000&&row.sourceLeaseWrites===1&&row.leaseExtended===false&&row.productionLatencyMeasured===false,'Latest-expired original source lease and controlled delays cannot be substituted');
 requireProof(Number.isFinite(row.elapsedMs)&&row.elapsedMs>0&&row.elapsedMs<60000&&Number.isFinite(row.prePostMs)&&row.prePostMs>0&&row.prePostMs<=row.elapsedMs&&row.marginMs===60000-row.elapsedMs&&row.marginMs>0,'Full production composition must reach POST and completion within the original lease');
 requireProof(row.providerPosts===1&&row.replayedPosts===0&&row.replyState==='SENT'&&row.messageIdPresent===true&&row.workerWrites===0,'Latest-expired composition needs one synthetic POST, no replay and zero Worker writes');
 requireProof(proof.totalSyntheticMessagePostCount===proof.syntheticMessagePostCount+proof.contextFeedbackNative.measurement.providerPosts+row.providerPosts&&proof.totalSyntheticMessagePostCount===6,'Historical four, prior-context one and composed-current one need truthful independent counters');
}
// DENY-only duplicate of the existing frozen OWN DTO predicates. Passing this
// helper never accepts a receipt; all original source/metadata checks still run.
function preflightNeutralOwnReceipt(proof,gitSources){
 const bytes=gitSources['.github/workspace-acceptance-contract.json'];if(!Buffer.isBuffer(bytes))return;
 let contract;try{contract=JSON.parse(bytes.toString('utf8'));}catch{return;}
 if(!preflightPassiveJson(contract,new preflightWeakSetConstructor())||!contract||typeof contract!=='object'||Array.isArray(contract)||!Object.hasOwn(contract,WHATSAPP_FIELD_CONTINUITY_SECTION))return;
 const familyName='OWN',requireLineage=(ok,message)=>requireProof(ok,message),plain=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const exactKeys=(value,keys,label)=>requireLineage(plain(value)&&same(Object.keys(value).sort(),[...keys].sort()),label);
 // Presence only. Digest, historical/current producer joins and complete source
 // validation retain their original mandatory late path.
 const required=['scripts/lib/kyc-neutral-step-guidance-native.mjs','scripts/lib/kyc-neutral-step-guidance-own-native.mjs'];
 if(WHATSAPP_FIELD_CONTINUITY_NATIVE.status!=='REVIEWED_FROZEN_CURRENT_SOURCE'||!WHATSAPP_FIELD_CONTINUITY_NATIVE.families.OWN||!required.every(file=>WHATSAPP_FIELD_CONTINUITY_NATIVE.families.OWN.sourceFiles.includes(file)))return;
 for(const file of required)requireLineage(Buffer.isBuffer(gitSources[file]),'Missing current WA/field source: '+file);
 const family=WHATSAPP_FIELD_CONTINUITY_NATIVE.families[familyName],dto=proof?.[family.dtoField];
 exactKeys(dto,['version','status','kind','postgresExecuted','compositionFactory','checks','cases','syntheticOnly','realProviderCalls','privateIo','identityCertified','permissionsGranted','humanAccepted','sourceState',...family.extraKeys],'current neutral-guidance native DTO');
 requireLineage(dto.version===1&&dto.status==='PASS'&&dto.kind===family.kind&&dto.postgresExecuted===true&&dto.compositionFactory==='createMetaCustomerProductionProcessor'&&same(dto.checks,family.checkNames)&&dto.syntheticOnly===true&&dto.realProviderCalls===0&&dto.privateIo===0&&dto.identityCertified===false&&dto.permissionsGranted===false&&dto.humanAccepted===false&&dto.sourceState==='ADDITIVE_NATIVE_GROUP_HISTORICAL_17_AND_4_UNCHANGED','All actual native execution, isolation and non-acceptance facts required');
 if(familyName==='OWN'){
  requireLineage(dto.originalGrantUnchanged===true&&typeof dto.originalV2ActivationReceipt==='string'&&dto.originalV2ActivationReceipt.length>0&&dto.originalV2ActivationReceipt.length<=256&&!/[\x00-\x1f]/.test(dto.originalV2ActivationReceipt),'The original v2 activation receipt must remain explicit and unchanged');
  exactKeys(dto.setupChronology,['canonicalGrantIssuedAt','earliestCanonicalClaimedAt','grantPrecedesClaim','grantAndOriginReceiptUnchanged','continuationClock'],'Exact original OWN setup chronology required');
  const chronology=dto.setupChronology,canonicalInstant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
  requireLineage(canonicalInstant(chronology.canonicalGrantIssuedAt)&&canonicalInstant(chronology.earliestCanonicalClaimedAt)&&Date.parse(chronology.canonicalGrantIssuedAt)<=Date.parse(chronology.earliestCanonicalClaimedAt)&&chronology.grantPrecedesClaim===true&&chronology.grantAndOriginReceiptUnchanged===true&&chronology.continuationClock==='actual-PostgreSQL-clock','Original canonical OWN grant must precede its earliest canonical claim under the actual continuation clock');
  exactKeys(dto.syntheticIssuanceClock,['windows','dateNowDescriptorRestored','dateNowFunctionRestored','continuationClock'],'Exact OWN synthetic issuance clock restoration evidence required');
  const issuance=dto.syntheticIssuanceClock;
  requireLineage(issuance.windows===1&&issuance.dateNowDescriptorRestored===true&&issuance.dateNowFunctionRestored===true&&issuance.continuationClock==='actual-PostgreSQL-clock','Exactly one synthetic issuance window must restore the Date.now descriptor and function before actual-clock continuation');
 }
 requireLineage(Array.isArray(dto.cases)&&same(dto.cases.map(row=>row?.name),family.caseNames),'Every current native case is required in order');
 const projected=dto.cases.map(row=>{
  const omit=[];
  if(row.name==='actual-PG-concurrent-guidance-receipt-single-outbox-and-HTTP'){
   requireLineage(Number.isSafeInteger(row.blockedPid)&&row.blockedPid>0&&Array.isArray(row.blockingPids)&&row.blockingPids.length>0&&new Set(row.blockingPids).size===row.blockingPids.length&&row.blockingPids.every(pid=>Number.isSafeInteger(pid)&&pid>0&&pid!==row.blockedPid),'Actual PG blocker observations required without inferring an exclusive source-row lock');omit.push('blockedPid','blockingPids');
  }
  if(row.name==='original-SENT-prompt-failed-in-same-locked-transaction-after-snapshot-no-first-POST'){
   requireLineage(typeof row.mutationTransaction==='string'&&/^[1-9]\d*$/.test(row.mutationTransaction),'Actual locked mutation transaction required');omit.push('mutationTransaction');
  }
  if(row.name==='OWN-neutral-full-composition-original-60s-lease-controlled-225ms-SQL-200ms-Graph'){
   requireLineage(Number.isFinite(row.elapsedMs)&&row.elapsedMs>0&&row.elapsedMs<60000&&Number.isFinite(row.marginMs)&&row.marginMs===60000-row.elapsedMs&&row.marginMs>0&&row.statementDelayMs===225&&row.graphDelayMs===200&&row.sourceLeaseMs===60000&&row.leaseExtended===false&&row.productionLatencyMeasured===false,'The unchanged controlled225/200 budget must fit its original60000ms source lease');omit.push('elapsedMs','marginMs');
  }
  return Object.fromEntries(Object.entries(row).filter(([key])=>!omit.includes(key)));
 });
 requireLineage(same(projected,family.caseMatrix),'Every fixed current native observation must equal its reviewed matrix');
}

export function validateCompanyKycOutboundCompactCi({expectedHead,head,sourceTree,trackedClean,gitSources,postgres}){
 requireProof(revision(expectedHead)&&head===expectedHead&&revision(sourceTree)&&trackedClean===true,'Exact clean Git HEAD and tree required');
 requireProof(gitSources&&typeof gitSources==='object'&&!Array.isArray(gitSources),'Committed Git sources required');
 const readSource=file=>Object.hasOwn(gitSources,file)?gitSources[file]:null;
 requireProof(postgres&&postgres.version===COMPANY_KYC_OUTBOUND_COMPACT_PROOF_VERSION&&postgres.status==='PASS'&&postgres.sourceRevision===expectedHead&&postgres.sourceTree===sourceTree&&postgres.trackedClean===true&&postgres.sourceState==='EXACT_CI_SOURCE','Native proof requires the exact clean expected commit and tree');
 requireProof(postgres.provider==='controlled-synthetic-only'&&postgres.operativeDatabaseUsed===false&&postgres.realProviderUsed===false&&postgres.municipalOrIdentityAcceptance===false&&postgres.leaseExtended===false,'Native proof cannot certify operative data, providers, identity or an extended lease');
 requireProof(postgres.poolClosed===true&&postgres.databaseRemoved===true&&postgres.adminClosed===true,'Native pool, child database and administration connection cleanup required');
 same(postgres.checks,COMPANY_KYC_OUTBOUND_COMPACT_CHECKS,'Every native lease, revocation, seal and uncertain reply scenario required');
 // Passive DENY only; every original source, receipt and Current check remains below.
 if(preflightAdditionalIntrinsicsStable()&&preflightPassiveInput(gitSources,postgres,null)){try{
  validateMeasurements(postgres);validateScenarios(postgres);validateContextFeedback(postgres);validateLatestExpiredComposition(postgres);preflightNeutralOwnReceipt(postgres,gitSources);
 }catch(error){if(preflightIsRejection(error,'KYC_OUTBOUND_COMPACT_CI_REJECTED'))throw error;}}
 const closure=companyKycOutboundCompactCiSourceClosure(readSource);validateManifest(postgres,closure.files,readSource);validateMeasurements(postgres);validateScenarios(postgres);validateContextFeedback(postgres);validateLatestExpiredComposition(postgres);
 let currentCompositionLineage,currentNeutralStepGuidance;
 try{const contract=JSON.parse(sourceBytes(readSource,KYC_EXPIRED_CURRENT_CONTRACT_PATH));currentCompositionLineage=contract.planMeasurementCurrentLineage?validatePlanMeasurementCurrentCompactReceipt(postgres,contract,readSource):validateKycExpiredCurrentReceipt(postgres,validateKycExpiredCurrentWorkspaceContract(contract),readSource);const current=validateIntegratedOwnCurrentNative(postgres,contract,readSource);if(current)currentCompositionLineage={...currentCompositionLineage,integratedCurrentImage:current};currentNeutralStepGuidance=validateWhatsappFieldNeutralStepNative(postgres,'OWN',contract,readSource);}catch(error){requireProof(false,['KYC_EXPIRED_CURRENT_LINEAGE_REJECTED','PLAN_MEASUREMENT_CURRENT_CI_LINEAGE_REJECTED','INTEGRATED_IDENTITY_CURRENT_CI_LINEAGE_REJECTED','WHATSAPP_FIELD_CONTINUITY_CURRENT_CI_LINEAGE_REJECTED'].includes(error.code)?error.message:'Current KYC composition source contract could not be confirmed');}
 return {version:COMPANY_KYC_OUTBOUND_COMPACT_CI_VERSION,status:'PASS',sourceRevision:expectedHead,sourceTree,trackedClean:true,sourceState:'EXACT_CI_SOURCE',nativeVersion:postgres.version,checks:[...postgres.checks],sourceCount:closure.files.length,harnessSha256:postgres.harnessSha256,measurements:postgres.measurements,scenarios:postgres.scenarios,syntheticMessagePostCount:postgres.syntheticMessagePostCount,contextFeedbackNative:postgres.contextFeedbackNative,latestExpiredContextNative:postgres.latestExpiredContextNative,totalSyntheticMessagePostCount:postgres.totalSyntheticMessagePostCount,currentCompositionLineage,...(currentNeutralStepGuidance?{neutralStepGuidanceNative:postgres.neutralStepGuidanceNative,currentNeutralStepGuidance}:{}),operativeDatabaseUsed:false,realProviderUsed:false,municipalOrIdentityAcceptance:false,leaseExtended:false,poolClosed:true,databaseRemoved:true,adminClosed:true};
}
function main(){
 const args=process.argv.slice(2);requireProof(args.length===2&&args[0]==='--expected-head'&&revision(args[1]),'Usage: --expected-head <full Git SHA>');
 const root=process.cwd(),expectedHead=args[1],git=(...values)=>execFileSync('git',values,{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024,windowsHide:true}).trim();
 if(process.env.GITHUB_SHA||process.env.CI==='true')requireProof(process.env.GITHUB_SHA===expectedHead,'Expected source must equal the CI event');
 const head=git('rev-parse','HEAD'),sourceTree=git('rev-parse','HEAD^{tree}'),trackedClean=git('status','--porcelain','--untracked-files=no')==='';requireProof(head===expectedHead&&trackedClean,'Exact clean expected checkout required');
 const committed=new Set(git('ls-tree','-r','--name-only',expectedHead).split('\n')),gitSources=Object.create(null);
 const readSource=file=>{if(!committed.has(file))return null;if(!Object.hasOwn(gitSources,file))gitSources[file]=execFileSync('git',['show',expectedHead+':'+file],{cwd:root,maxBuffer:16*1024*1024,windowsHide:true});return gitSources[file];};
 const closure=companyKycOutboundCompactCiSourceClosure(readSource);
 const contract=JSON.parse(sourceBytes(readSource,KYC_EXPIRED_CURRENT_CONTRACT_PATH)),currentGuardSources=[...(contract.planMeasurementCurrentLineage?.currentValidationSources||[]).map(ref=>ref.path),...(contract.planMeasurementCurrentLineage?.currentProofChanges||[]).map(delta=>contract.extension.proofs.find(spec=>spec.id===delta.id)?.producer),...(contract.fieldOutboundCurrentRevision?.validationSources||[]).map(ref=>ref.path),...(contract.ooxmlAccountingCurrentRevision?.validationSources||[]).map(ref=>ref.path),...(contract.participantPreanalysisCurrentRevision?.validationSources||[]).map(ref=>ref.path),...(contract.integratedIdentityCurrentRevision?.validationSources||[]).map(ref=>ref.path),...preanalysisProducerSources(contract),...participantPreanalysisConsumerValidationFiles(contract)];
 for(const file of [...lineageAuditSources,...currentGuardSources,...closure.files])requireProof(readSource(file)!==null&&sha(readFileSync(path.join(root,file)))===sha(readSource(file)),'Checkout differs from committed expected Git bytes: '+file);
 const inputBytes=readFileSync(path.join(root,proofPath)),proof=validateCompanyKycOutboundCompactCi({expectedHead,head,sourceTree,trackedClean,gitSources,postgres:JSON.parse(inputBytes)});
 requireProof(git('rev-parse','HEAD')===head&&git('rev-parse','HEAD^{tree}')===sourceTree&&git('status','--porcelain','--untracked-files=no')==='','Source changed during native proof validation');
 for(const file of [...lineageAuditSources,...currentGuardSources,...closure.files])requireProof(sha(readFileSync(path.join(root,file)))===sha(readSource(file)),'Source changed during validation: '+file);
 const output=path.join(root,outputPath);requireProof(!existsSync(output),'A previous compact CI proof must not be overwritten');mkdirSync(path.dirname(output),{recursive:true});
 writeFileSync(output,JSON.stringify({...proof,checkedAt:new Date().toISOString(),validatorSha256:sha(readSource(validator)),inputProof:{path:proofPath,sha256:sha(inputBytes)}},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:proof.status,sourceRevision:head,output:outputPath,nativeChecks:proof.checks.length,sourceCount:proof.sourceCount}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{main();}catch(error){console.error(JSON.stringify({status:'FAIL',code:error.code==='KYC_OUTBOUND_COMPACT_CI_REJECTED'?error.code:'KYC_OUTBOUND_COMPACT_CI_UNCONFIRMED',reason:error.code==='KYC_OUTBOUND_COMPACT_CI_REJECTED'?error.message:'Native proof verification could not be confirmed'}));process.exitCode=1;}}
