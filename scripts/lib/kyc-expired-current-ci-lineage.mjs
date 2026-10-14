import {createHash} from 'node:crypto';
import path from 'node:path';
import {parse} from '@babel/parser';

export const KYC_EXPIRED_CURRENT_CONTRACT_PATH='.github/workspace-acceptance-contract.json';
export const KYC_EXPIRED_CURRENT_VALIDATOR_PATH='scripts/verify-company-kyc-outbound-compact-ci.mjs';
export const KYC_EXPIRED_CURRENT_HELPER_PATH='scripts/lib/kyc-expired-current-ci-lineage.mjs';
export const KYC_EXPIRED_CURRENT_TEST_PATH='tests/production-kyc-reply-feedback-current-lineage.test.mjs';
export const KYC_EXPIRED_CURRENT_VALIDATION_SOURCES=Object.freeze([KYC_EXPIRED_CURRENT_HELPER_PATH,KYC_EXPIRED_CURRENT_VALIDATOR_PATH,KYC_EXPIRED_CURRENT_TEST_PATH].sort());
export const KYC_EXPIRED_CURRENT_NATIVE_PRODUCER='scripts/verify-company-kyc-outbound-compact-postgres.mjs';
export const KYC_EXPIRED_CURRENT_ADDITIONS=Object.freeze([
 'src/lib/meta-customer-processing-runtime.mjs','src/lib/meta-kyc-expiry-feedback.mjs','src/lib/meta-plan-import-recovery.mjs','src/lib/organization-resource-usage-store.mjs',
 'src/lib/organization-usage-runtime.mjs','src/lib/organization-usage-store.mjs','src/lib/plan-import-analyzer.mjs','src/lib/workspace-runtime.mjs',
]);
export const KYC_EXPIRED_CURRENT_SCENARIOS=Object.freeze(['native-current','distinct-participant-multiworksite','controlled-current','controlled-source-baseline','after-reserve-fault','source-lease-expired','issuer-revoked','credential-rotated','principal-trailed-ABA','between-KYC-runtime-clock-expired','provider-lost-ACK','same-client-new-transaction-before-prepare','same-client-new-transaction-after-prepare']);
export const KYC_EXPIRED_CURRENT_MEASUREMENTS=Object.freeze(['native-current','controlled-current','controlled-source-baseline']);
export const KYC_EXPIRED_CURRENT_PRIOR_CHECKS=Object.freeze(['native-OWN-RUNTIME-context-feedback-prior-SENT-prompt-original-60s-lease-225ms-SQL-200ms-Graph-one-POST-no-consent-no-capture-no-replay']);
export const KYC_EXPIRED_CURRENT_COMPOSED_CHECKS=Object.freeze(['native-OWN-RUNTIME-production-composition-latest-expired-neutral-current-CLAIMED-valid-challenge-60s-225ms-SQL-200ms-Graph-one-POST-no-intake-capture-expiry-fallback-or-replay']);
// Reviewed LF source pins are independent of the producer's mutable import walk.
// Historical native source and counts remain distinct from the current receipt.
export const KYC_EXPIRED_CURRENT_REVIEWED_SOURCES=Object.freeze([
 {path:'scripts/verify-company-kyc-outbound-compact-postgres.mjs',sha256:'d3ebc8f96007213b5fe25f9c4853178ddc9b79408076ffe3f83f9fa29dea64c4'},
 {path:'src/lib/meta-customer-processing-runtime.mjs',sha256:'a866e8af6c142feea9ccb2594ee4a066b26ff13f89bb51b3e5982fb3994e4a52'},
 {path:'src/lib/meta-customer-processing.mjs',sha256:'f2bb4443d149895e9c69beac5b148f7733a9951a292289c4f2ac2a420e5d54c2'},
 {path:'src/lib/meta-kyc-context-feedback.mjs',sha256:'dfd5b4cb18a379cffdecb437b2f89ab0aaa6d32660840b0cc76b81bf018758eb'},
 {path:'src/lib/meta-kyc-identity.mjs',sha256:'5b65901dc449288516535312569fd69198d6699c98204e3c0146d13fcd26d160'},
 {path:'tests/production-company-kyc-outbound-compact-ci.test.mjs',sha256:'c561cdb41002ec2717af76351b9dcb0758c4faa7c0ec2318e4b489c59bb37ee3'},
 {path:'tests/production-meta-customer-composition.test.mjs',sha256:'c0425600caa47d4ccdc86798aa01c18456f19cc85e8411487f5c990b67c91717'},
 {path:'tests/production-meta-kyc-context-feedback.test.mjs',sha256:'88cd204a372ced92532b57768e432a65abd2738fb8c95a0142026f04d77dfd5d'},
].map(ref=>Object.freeze(ref)));
export const KYC_EXPIRED_CURRENT_LINEAGE=Object.freeze({
 version:1,baseHead:'a29281a72dcce887ff57f509f831b4254fc31930',nativeProducer:KYC_EXPIRED_CURRENT_NATIVE_PRODUCER,previousContractSha256:'fa8a57d8dd6c69650d835b5e741e93e467245ec5bd0456d8a9181df260bf7a6c',
 previousSourceCount:117,previousSourcePathsSha256:'92174530d96258515bb501e75c27f64a338af05f919a6f6c8226980f948d1fd8',
 previousProducerSha256:'d3157b805e37a7d67ffe19b70ca7f40adb0debf733b36c1ed45dc6735068356b',previousValidatorSha256:'601989719625105e309916333692157e628d94e0403946395f19306d427e9e04',
 sourceCount:125,sourcePathsSha256:'c2c70c698ccdad8212b9eb4e9fc67f7956fe087a5f853f45a22bcea30586c28f',
 historicalCheckCount:13,historicalChecksSha256:'313c1d15fcf997f1fb33a4d7f86bc6daad4b7180b01a61678fef6c20007e3439',
 historicalScenarioCount:13,historicalMeasurementCount:3,historicalPostCount:4,priorContextPostCount:1,composedCurrentPostCount:1,totalPostCount:6,
 compositionFactory:'createMetaCustomerProductionProcessor',sourceLeaseMs:60000,statementDelayMs:225,graphDelayMs:200,
});
const sha=value=>createHash('sha256').update(value).digest('hex');
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function deny(message,reason=null){throw Object.assign(new Error(message),{code:'KYC_EXPIRED_CURRENT_LINEAGE_REJECTED',...(reason?{reason}:{})});}
function requireLineage(condition,message){if(!condition)deny(message);}
function same(actual,expected,message){requireLineage(JSON.stringify(actual)===JSON.stringify(expected),message);}
function exactKeys(value,keys,message){requireLineage(plain(value),message);same(Object.keys(value).sort(),[...keys].sort(),message);}
function sourceBytes(readSource,file){requireLineage(typeof readSource==='function','Committed source resolver required');const bytes=readSource(file);requireLineage(Buffer.isBuffer(bytes),'Missing committed source: '+file);return bytes;}
function sourceText(readSource,file){const bytes=sourceBytes(readSource,file),text=bytes.toString('utf8');requireLineage(bytes.equals(Buffer.from(text)),'Invalid source encoding: '+file);return text;}
function textSha256(readSource,file){return sha(sourceText(readSource,file).replaceAll('\r\n','\n'));}
const safeSource=file=>typeof file==='string'&&!file.includes('\\')&&!file.includes('\0')&&!path.posix.isAbsolute(file)&&path.posix.normalize(file)===file&&!file.startsWith('../')&&/^(?:src|scripts|tests)\//.test(file);
function baselineImport(node){
 const expression=node.source||node.arguments?.[0],call=expression?.right;
 return expression?.type==='BinaryExpression'&&expression.operator==='+'&&expression.left?.type==='StringLiteral'&&expression.left.value==='data:text/javascript;base64,'&&call?.type==='CallExpression'&&call.arguments.length===1&&call.arguments[0]?.value==='base64'&&call.callee?.type==='MemberExpression'&&!call.callee.computed&&call.callee.property?.name==='toString'&&call.callee.object?.type==='CallExpression'&&call.callee.object.arguments.length===1&&call.callee.object.arguments[0]?.name==='baselineModule'&&call.callee.object.callee?.type==='MemberExpression'&&!call.callee.object.callee.computed&&call.callee.object.callee.object?.name==='Buffer'&&call.callee.object.callee.property?.name==='from';
}
// This independent walk reads the actual production runtime as well as the
// measured producer; it never imports or executes either module.
export function kycExpiredCurrentSourceFiles(readSource){
 const baselinePath='tests/fixtures/meta-kyc-outbound-baseline-b572.json',files=new Set(['package.json','package-lock.json',baselinePath]);let computedImports=0;
 for(const file of files)sourceBytes(readSource,file);
 function imports(text,file){
  let tree;try{tree=parse(text,{sourceType:'module',plugins:['jsx'],createImportExpressions:true});}catch{deny('Unparseable committed source: '+file);}
  const references=[];
  function walk(node){
   if(!node||typeof node!=='object')return;
   const dynamic=node.type==='ImportExpression'||node.type==='CallExpression'&&node.callee?.type==='Import';
   const ref=['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration','ImportExpression'].includes(node.type)?node.source:dynamic?node.arguments[0]:null;
   if(ref){if(ref.type==='StringLiteral')references.push(ref.value);else {requireLineage(dynamic&&file===KYC_EXPIRED_CURRENT_NATIVE_PRODUCER&&baselineImport(node),'Unbounded computed source import: '+file);computedImports++;}}
   for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);
  }
  walk(tree);return references;
 }
 function visit(file){
  requireLineage(safeSource(file),'Unsafe source dependency: '+file);if(files.has(file))return;const text=sourceText(readSource,file);files.add(file);
  for(const specifier of imports(text,file)){
   if(!specifier.startsWith('.')){requireLineage(!/^(?:https?:|file:|data:)/.test(specifier),'External source dependency: '+file);continue;}
   visit(path.posix.normalize(path.posix.join(path.posix.dirname(file),specifier)));
  }
 }
 visit(KYC_EXPIRED_CURRENT_NATIVE_PRODUCER);visit('src/lib/meta-customer-processing-runtime.mjs');
 let baseline;try{baseline=JSON.parse(sourceText(readSource,baselinePath));}catch{deny('Missing immutable source baseline');}
 requireLineage(baseline?.version===1&&baseline.sourceRevision==='b5723d23092bd214b9271582af8e6bcb2c929a66'&&baseline.sourcePath==='src/lib/meta-kyc-outbound.mjs'&&baseline.sourceSha256==='3f562c8d30280bf9ccce53a94523c9f0dd33278ce744bd72cae3949becc72f7f'&&sha(baseline.source)===baseline.sourceSha256,'Immutable source baseline changed');
 for(const specifier of imports(baseline.source,baseline.sourcePath)){requireLineage(specifier.startsWith('.'),'Baseline external import changed');visit(path.posix.normalize(path.posix.join(path.posix.dirname(baseline.sourcePath),specifier)));}
 requireLineage(computedImports===1,'One bounded immutable baseline import required');return [...files].sort();
}
export function validateKycExpiredCurrentSourceLineage(files){
 requireLineage(Array.isArray(files)&&files.every(file=>typeof file==='string')&&new Set(files).size===files.length,'Unique current source paths required');
 same(files,[...files].sort(),'Current source paths must be ordered');requireLineage(files.length===KYC_EXPIRED_CURRENT_LINEAGE.sourceCount&&sha(JSON.stringify(files))===KYC_EXPIRED_CURRENT_LINEAGE.sourcePathsSha256,'Current source set must equal the reviewed 125-source closure');
 for(const file of KYC_EXPIRED_CURRENT_ADDITIONS)requireLineage(files.includes(file),'Current runtime extension omitted: '+file);
 const previous=files.filter(file=>!KYC_EXPIRED_CURRENT_ADDITIONS.includes(file));requireLineage(previous.length===KYC_EXPIRED_CURRENT_LINEAGE.previousSourceCount&&sha(JSON.stringify(previous))===KYC_EXPIRED_CURRENT_LINEAGE.previousSourcePathsSha256,'The unchanged 117-source historical set must precede the eight runtime extensions');
 return files;
}
export function validateKycExpiredCurrentContract(section){
 exactKeys(section,[...Object.keys(KYC_EXPIRED_CURRENT_LINEAGE),'sourceAdditions','historicalScenarios','historicalMeasurements','priorContextChecks','composedCurrentChecks','sourceFiles','reviewedSources','validationSources'],'Current KYC composition contract required');
 for(const [key,value]of Object.entries(KYC_EXPIRED_CURRENT_LINEAGE))same(section[key],value,'Current KYC lineage changed: '+key);
 same(section.sourceAdditions,KYC_EXPIRED_CURRENT_ADDITIONS,'Exactly eight additive runtime dependencies required');same(section.historicalScenarios,KYC_EXPIRED_CURRENT_SCENARIOS,'Thirteen historical native scenarios must remain ordered');same(section.historicalMeasurements,KYC_EXPIRED_CURRENT_MEASUREMENTS,'Three historical measurements must remain ordered');
 same(section.priorContextChecks,KYC_EXPIRED_CURRENT_PRIOR_CHECKS,'Prior OWN context check remains separate');same(section.composedCurrentChecks,KYC_EXPIRED_CURRENT_COMPOSED_CHECKS,'Current production composition check required');validateKycExpiredCurrentSourceLineage(section.sourceFiles);same(section.reviewedSources,KYC_EXPIRED_CURRENT_REVIEWED_SOURCES,'Frozen reviewed source pins cannot be replaced');
 requireLineage(Array.isArray(section.validationSources),'Validator and helper source pins required');same(section.validationSources.map(ref=>ref?.path),KYC_EXPIRED_CURRENT_VALIDATION_SOURCES,'Exact current validation source set required');
 for(const ref of section.validationSources){exactKeys(ref,['path','sha256'],'Invalid validation source pin');requireLineage(hash(ref.sha256),'Invalid validation source digest');}
 requireLineage(section.validationSources.find(ref=>ref.path===KYC_EXPIRED_CURRENT_VALIDATOR_PATH).sha256!==section.previousValidatorSha256,'Prior validator cannot certify current composition');return section;
}
export function verifyKycExpiredCurrentSources(section,readSource){
 validateKycExpiredCurrentContract(section);same(validateKycExpiredCurrentSourceLineage(kycExpiredCurrentSourceFiles(readSource)),section.sourceFiles,'Native and runtime dependency graph must match current contract');
 for(const ref of [...section.reviewedSources,...section.validationSources])requireLineage(textSha256(readSource,ref.path)===ref.sha256,'Stale reviewed source pin: '+ref.path);
 return {version:1,sourceCount:section.sourceCount,sourcePathsSha256:section.sourcePathsSha256,previousSourceCount:section.previousSourceCount,previousSourcePathsSha256:section.previousSourcePathsSha256,sourceAdditions:[...section.sourceAdditions]};
}
export function validateKycExpiredCurrentWorkspaceContract(contract){
 requireLineage(plain(contract),'Current workspace contract required');const section=validateKycExpiredCurrentContract(contract.kycExpiredCurrentComposition),previous={...contract};delete previous.kycExpiredCurrentComposition;
 if(sha(JSON.stringify(previous,null,2)+'\n')!==section.previousContractSha256)deny('Every previously published workspace contract field must remain unchanged','PUBLISHED_CONTRACT_CHANGED');return section;
}
export function validateKycExpiredCurrentReceipt(proof,section,readSource){
 const lineage=verifyKycExpiredCurrentSources(section,readSource);
 requireLineage(proof?.checks?.length===section.historicalCheckCount&&sha(JSON.stringify(proof.checks))===section.historicalChecksSha256,'Every unchanged historical native check required');
 same(proof.scenarios?.map(row=>row?.name),section.historicalScenarios,'Every unchanged historical native scenario required');same(proof.measurements?.map(row=>row?.kind),section.historicalMeasurements,'Every unchanged historical measurement required');
 same(proof.scenarios.map(row=>row.providerPosts),[1,1,1,0,0,0,0,0,0,0,1,0,0],'Historical four POSTs need the original per-scenario counters');requireLineage(proof.syntheticMessagePostCount===4&&proof.scenarios.every(row=>row.replayedPosts===undefined&&row.providerPosts===0||row.replayedPosts===0),'Historical uncertain and rejected scenarios cannot be replayed');
 const prior=proof.contextFeedbackNative,current=proof.latestExpiredContextNative;
 same(prior?.checks,section.priorContextChecks,'Prior context proof cannot replace current composition');same(current?.checks,section.composedCurrentChecks,'Current composition proof must remain distinct');
 for(const context of [prior,current])requireLineage(context?.measurement?.providerPosts===1&&context.measurement.replayedPosts===0&&context.measurement.sourceLeaseMs===60000&&context.measurement.leaseExtended===false&&context.measurement.statementDelayMs===225&&context.measurement.graphDelayMs===200&&context.consentChosen===false&&context.identitySubmitted===false&&context.privateMediaCalls===0&&context.realProviderCalls===0&&context.productionDataTouched===false&&context.humanAccepted===false,'Each separate feedback proof needs one synthetic POST under the original lease without private acceptance');
 requireLineage(current.compositionFactory===section.compositionFactory&&current.quotedLatestPrompt===true&&current.fixtureConversationExpired===true&&current.challengeStillValid===true&&current.challengeStatus==='CLAIMED'&&current.measurement.beforeDispatchReads===1&&current.measurement.sourceLeaseWrites===1&&current.measurement.workerWrites===0,'Current feedback must exercise actual production composition with one claim and zero Worker writes');
 same(current.calls,{rejectionRecovery:1,expiryRecovery:1,contextRecovery:1,contextPredispatch:1,intake:0,capture:0,app:0,company:0,field:0,expiryFallback:0,authorizationDefer:0},'The current production path needs exact recovery calls before compact feedback');
 requireLineage(proof.totalSyntheticMessagePostCount===6&&proof.syntheticMessagePostCount+prior.measurement.providerPosts+current.measurement.providerPosts===6,'Thirteen historical checks plus two distinct contexts need truthful six-POST accounting');
 const manifest=proof.sourceManifest;requireLineage(Array.isArray(manifest)&&manifest.length===125,'Complete current native source manifest required');same(manifest.map(ref=>ref?.path).sort(),section.sourceFiles,'Old 117-source receipts cannot certify current composition');
 for(const ref of manifest){exactKeys(ref,['path','sha256'],'Invalid current native source reference');requireLineage(hash(ref.sha256)&&sha(sourceBytes(readSource,ref.path))===ref.sha256,'Current native manifest must match committed bytes: '+ref.path);}
 return {...lineage,historicalChecksSha256:section.historicalChecksSha256,historicalPostCount:4,priorContextPostCount:1,composedCurrentPostCount:1,totalPostCount:6,nativeManifestSha256:sha(JSON.stringify(manifest)),validationSourceManifest:[KYC_EXPIRED_CURRENT_CONTRACT_PATH,...KYC_EXPIRED_CURRENT_VALIDATION_SOURCES].map(file=>({path:file,sha256:sha(sourceBytes(readSource,file))}))};
}
