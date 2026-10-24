import {whatsappFieldNeutralStepShadowFixture} from '../scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs';
import {hasCaptureRuntime} from '../scripts/lib/capture-runtime-canonical-collectors.mjs';
import {withCaptureRuntimePreviousSources} from '../scripts/lib/plan-budget-current-ci-lineage.mjs';
import {integratedOwnCurrentShadowFixture} from '../scripts/lib/integrated-identity-current-ci-lineage.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {COMPANY_KYC_OUTBOUND_COMPACT_PROOF_VERSION,COMPANY_KYC_OUTBOUND_COMPACT_CHECKS,COMPANY_KYC_CONTEXT_OUTBOUND_CHECKS,COMPANY_KYC_LATEST_EXPIRED_COMPOSITION_CHECKS,companyKycOutboundCompactSourceFiles,companyKycOutboundCompactDisposableUrl} from '../scripts/verify-company-kyc-outbound-compact-postgres.mjs';
import {validateCompanyKycOutboundCompactCi,companyKycOutboundCompactCiSourceClosure} from '../scripts/verify-company-kyc-outbound-compact-ci.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),sources=Object.create(null),sha=value=>createHash('sha256').update(value).digest('hex');
const readSource=file=>{const filename=path.join(root,file);if(!existsSync(filename))return null;if(!Object.hasOwn(sources,file))sources[file]=readFileSync(filename);return sources[file];};
const closure=companyKycOutboundCompactCiSourceClosure(readSource),head='a'.repeat(40),tree='b'.repeat(40);
const preanalysisProducerSources=['scripts/verify-participant-kyc-preanalysis-postgres.mjs',...JSON.parse(readSource('.github/workspace-acceptance-contract.json')).participantPreanalysisCurrentRevision.unitSuites.map(row=>row.file)];
test('separate localhost QA port preserves every historical disposable target restriction',()=>{
 const environment={CUTOVER_TEST_DISPOSABLE:'1',CUTOVER_TEST_DATABASE_URL:'postgresql://cutover_test@127.0.0.1:6550/obrasaas_cutover_ci'};
 for(const port of ['6549','6550'])for(const hostname of ['127.0.0.1','localhost']){const url=new URL(environment.CUTOVER_TEST_DATABASE_URL);url.port=port;url.hostname=hostname;assert.equal(companyKycOutboundCompactDisposableUrl({...environment,CUTOVER_TEST_DATABASE_URL:url.toString()}).toString(),url.toString());}
 for(const [key,value]of [['CUTOVER_TEST_DISPOSABLE','0'],['VERCEL','1'],['VERCEL_ENV','preview'],['VERCEL_TARGET_ENV','production']])assert.throws(()=>companyKycOutboundCompactDisposableUrl({...environment,[key]:value}),{code:'COMPANY_KYC_REJECTION_DISPOSABLE_TARGET_REJECTED'});
 for(const [key,value]of [['port','6551'],['hostname','example.invalid'],['username','postgres'],['password','cutover_test'],['pathname','/operative'],['search','?sslmode=require'],['hash','#unsafe']]){const url=new URL(environment.CUTOVER_TEST_DATABASE_URL);url[key]=value;assert.throws(()=>companyKycOutboundCompactDisposableUrl({...environment,CUTOVER_TEST_DATABASE_URL:url.toString()}),{code:'COMPANY_KYC_REJECTION_DISPOSABLE_TARGET_REJECTED'});}
 assert.throws(()=>companyKycOutboundCompactDisposableUrl({...environment,CUTOVER_TEST_DATABASE_URL:'invalid'}),{code:'COMPANY_KYC_REJECTION_DISPOSABLE_TARGET_REJECTED'});
});
function fixture(){
 const scenarios=['native-current','distinct-participant-multiworksite','controlled-current','controlled-source-baseline','after-reserve-fault','source-lease-expired','issuer-revoked','credential-rotated','principal-trailed-ABA','between-KYC-runtime-clock-expired','provider-lost-ACK'].map((name,index)=>({name,providerPosts:index<3||index===10?1:0,replayedPosts:0,state:index<3?'SENT':index===10?'SEND_UNKNOWN':'SEND_STARTED',messageIdPresent:index<3}));
 Object.assign(scenarios[1],{distinctParticipant:true,distinctAnchorTarget:true,fullResolutions:4,compactFences:17,runtimeFences:16});
 scenarios[4].diagnostic={version:1,phase:'AFTER_RESERVE',code:'META_OWN_COMPANY_OWNER_UNCONFIRMED',recordedAt:'2026-10-14T12:00:00.000Z'};scenarios[10].diagnostic={version:1,phase:'REPLY_POST',code:'META_CUSTOMER_PROVIDER_UNCONFIRMED',recordedAt:'2026-10-14T12:00:00.000Z'};
 scenarios.push(...['same-client-new-transaction-before-prepare','same-client-new-transaction-after-prepare'].map(name=>({name,providerPosts:0,graphRequests:0,rejectedCode:'META_KYC_COMPANY_AUTHORITY_CHANGED',sameClient:true,newTransaction:true})));
 const contextFeedbackNative={status:'PASS',kind:'OWN_COMPANY_RUNTIME',postgresExecuted:true,checks:[...COMPANY_KYC_CONTEXT_OUTBOUND_CHECKS],sourcePromptConfirmed:true,sourcePurpose:'KYC_CAPTURE',input:'ESTADO IDENTIDAD',priorPrompt:true,consentChosen:false,identitySubmitted:false,privateMediaCalls:0,workerBytesUnchanged:true,sourcePromptBytesUnchanged:true,workerBeforeSha256:'d'.repeat(64),workerAfterSha256:'d'.repeat(64),sourcePromptBeforeSha256:'e'.repeat(64),sourcePromptAfterSha256:'e'.repeat(64),realProviderCalls:0,productionDataTouched:false,humanAccepted:false,measurement:{kind:'controlled-own-context-feedback',sqlStatements:110,fullResolutions:3,compactFences:12,runtimeFences:10,graphRequests:8,statementDelayMs:225,graphDelayMs:200,sourceLeaseMs:60000,elapsedMs:28000,prePostMs:24000,marginMs:32000,leaseExtended:false,productionLatencyMeasured:false,providerPosts:1,replayedPosts:0,replyState:'SENT',messageIdPresent:true}};
 const latestExpiredContextNative={...contextFeedbackNative,compositionFactory:'createMetaCustomerProductionProcessor',checks:[...COMPANY_KYC_LATEST_EXPIRED_COMPOSITION_CHECKS],quotedLatestPrompt:true,fixtureConversationExpired:true,challengeStillValid:true,challengeStatus:'CLAIMED',sourceEventBytesUnchanged:true,sourceEventBeforeSha256:'f'.repeat(64),sourceEventAfterSha256:'f'.repeat(64),calls:{rejectionRecovery:1,expiryRecovery:1,contextRecovery:1,contextPredispatch:1,intake:0,capture:0,app:0,company:0,field:0,expiryFallback:0,authorizationDefer:0},measurement:{...contextFeedbackNative.measurement,kind:'controlled-production-latest-expired-neutral',beforeDispatchReads:1,sourceLeaseWrites:1,workerWrites:0}};
 const shadowContract=JSON.parse(sources['.github/workspace-acceptance-contract.json']);
 const currentImageOwnNative=hasCaptureRuntime(shadowContract)?withCaptureRuntimePreviousSources(shadowContract,readSource,parent=>integratedOwnCurrentShadowFixture(parent)):integratedOwnCurrentShadowFixture(shadowContract);
 const input={expectedHead:head,head,sourceTree:tree,trackedClean:true,gitSources:{...sources},postgres:{currentImageOwnNative,...(JSON.parse(sources['.github/workspace-acceptance-contract.json']).whatsappFieldContinuityCurrentRevision?{neutralStepGuidanceNative:whatsappFieldNeutralStepShadowFixture('OWN')}:{}),version:COMPANY_KYC_OUTBOUND_COMPACT_PROOF_VERSION,status:'PASS',sourceRevision:head,sourceTree:tree,trackedClean:true,sourceState:'EXACT_CI_SOURCE',checks:[...COMPANY_KYC_OUTBOUND_COMPACT_CHECKS],scenarios,syntheticMessagePostCount:4,totalSyntheticMessagePostCount:6,contextFeedbackNative,latestExpiredContextNative,provider:'controlled-synthetic-only',operativeDatabaseUsed:false,realProviderUsed:false,municipalOrIdentityAcceptance:false,leaseExtended:false,poolClosed:true,databaseRemoved:true,adminClosed:true,harnessSha256:sha(sources['scripts/verify-company-kyc-outbound-compact-postgres.mjs']),sourceManifest:closure.files.map(file=>({path:file,sha256:sha(sources[file])})),measurements:[{kind:'native-current',sqlStatements:90,fullResolutions:4,compactFences:17,runtimeFences:16,elapsedMs:300,sourceLeaseMs:60000,providerPosts:1,replyState:'SENT',leaseExtended:false},{kind:'controlled-current',sqlStatements:90,fullResolutions:4,compactFences:17,runtimeFences:16,elapsedMs:23000,sourceLeaseMs:60000,providerPosts:1,replyState:'SENT',leaseExtended:false,statementDelayMs:225,graphDelayMs:200,marginMs:37000,productionLatencyMeasured:false},{kind:'controlled-source-baseline',baselineSourceRevision:'b5723d23092bd214b9271582af8e6bcb2c929a66',baselineOutboundSha256:'3f562c8d30280bf9ccce53a94523c9f0dd33278ce744bd72cae3949becc72f7f',sqlStatements:240,fullResolutions:10,compactFences:0,elapsedMs:60500,sourceLeaseMs:60000,replySent:false,providerPosts:0,leaseExtended:false,statementDelayMs:225,graphDelayMs:200,productionLatencyMeasured:false}]}};
 input.readEvidence=file=>file==='.vercel/private/company-kyc-outbound-compact-postgres.json'?Buffer.from(JSON.stringify(input.postgres)):null;return input;
}
function rejected(edit){const input=fixture();edit(input);assert.throws(()=>validateCompanyKycOutboundCompactCi(input),{code:'KYC_OUTBOUND_COMPACT_CI_REJECTED'});}

test('complete pure source-bound compact receipt validates without running PostgreSQL or providers',()=>{
 for(const file of preanalysisProducerSources){assert.equal(Buffer.isBuffer(sources[file]),true,'Auxiliary current producer is loaded: '+file);assert.equal(closure.files.includes(file),false,'CI validation leaf cannot be presented as measured native source: '+file);}assert.deepEqual(closure.files,companyKycOutboundCompactSourceFiles(root));const input=fixture(),before=JSON.stringify(input),value=validateCompanyKycOutboundCompactCi(input);assert.equal(JSON.stringify(input),before);assert.equal(value.status,'PASS');assert.equal(value.sourceCount,closure.files.length);assert.deepEqual(value.checks,COMPANY_KYC_OUTBOUND_COMPACT_CHECKS);
 const budgetPath='src/lib/plan-budget-source.mjs';assert.equal(closure.files.includes(budgetPath),true);assert.equal(input.postgres.sourceManifest.filter(row=>row.path===budgetPath).length,1);assert.equal(input.postgres.sourceManifest.find(row=>row.path===budgetPath).sha256,sha(readSource(budgetPath)));rejected(value=>{value.postgres.sourceManifest=value.postgres.sourceManifest.filter(row=>row.path!==budgetPath);});rejected(value=>{value.postgres.sourceManifest.find(row=>row.path===budgetPath).sha256='f'.repeat(64);});rejected(value=>{value.gitSources[budgetPath]=Buffer.concat([value.gitSources[budgetPath],Buffer.from('\n// changed Budget source\n')]);});
});
test('foreign or abbreviated HEAD and stale tree cannot certify the native receipt',()=>{
 rejected(value=>{value.expectedHead=head.slice(0,7);});rejected(value=>{value.head='c'.repeat(40);});rejected(value=>{value.sourceTree='c'.repeat(40);});for(const key of ['sourceRevision','sourceTree'])rejected(value=>{value.postgres[key]='c'.repeat(40);});
});
test('dirty checkout local review records and false success claims cannot certify CI',()=>{
 rejected(value=>{value.trackedClean=false;});for(const [key,bad]of [['trackedClean',false],['sourceState','LOCAL_REVIEW_SOURCE'],['status','FAIL'],['version','prior-version']])rejected(value=>{value.postgres[key]=bad;});
});
test('omitted duplicate foreign and stale source references fail against exact transitive closure',()=>{
 rejected(value=>{value.postgres.sourceManifest.pop();});rejected(value=>{value.postgres.sourceManifest[1]={...value.postgres.sourceManifest[0]};});rejected(value=>{value.postgres.sourceManifest[0].path='src/lib/foreign.mjs';});rejected(value=>{value.postgres.sourceManifest[0].sha256='f'.repeat(64);});rejected(value=>{delete value.gitSources['src/lib/company-channel-kyc.mjs'];});for(const file of preanalysisProducerSources)rejected(value=>{delete value.gitSources[file];});
});
test('an altered producer digest or changed committed source cannot reuse the old receipt',()=>{
 rejected(value=>{value.postgres.harnessSha256='f'.repeat(64);});rejected(value=>{value.gitSources['src/lib/company-channel-kyc.mjs']=Buffer.concat([value.gitSources['src/lib/company-channel-kyc.mjs'],Buffer.from('\n// Changed after the receipt\n')]);});
});
test('omitted reordered substituted and repeated native scenarios fail closed',()=>{
 rejected(value=>{value.postgres.checks.pop();});rejected(value=>{value.postgres.checks.reverse();});rejected(value=>{value.postgres.checks[1]=value.postgres.checks[0];});rejected(value=>{value.postgres.checks[0]='assumed-safe-path';});
});
test('native fence counts provider POST counts and original source lease cannot be forged',()=>{
 for(const [key,bad]of [['fullResolutions',3],['compactFences',16],['runtimeFences',15],['providerPosts',2],['replyState','SEND_UNKNOWN'],['sourceLeaseMs',120000],['leaseExtended',true]])rejected(value=>{value.postgres.measurements[0][key]=bad;});rejected(value=>{value.postgres.measurements.pop();});rejected(value=>{value.postgres.measurements[1].elapsedMs=60000;});rejected(value=>{value.postgres.measurements[1].marginMs=0;});rejected(value=>{value.postgres.measurements[2].providerPosts=1;});
});
test('denials and uncertain POST preserve measured first-call totals with zero replay transfers',()=>{
 rejected(value=>{value.postgres.syntheticMessagePostCount=3;});rejected(value=>{value.postgres.scenarios.pop();});rejected(value=>{value.postgres.scenarios[3].providerPosts=1;});rejected(value=>{value.postgres.scenarios[10].providerPosts=0;});rejected(value=>{value.postgres.scenarios[10].replayedPosts=1;});rejected(value=>{value.postgres.scenarios[10].messageIdPresent=true;});rejected(value=>{value.postgres.scenarios[1].distinctParticipant=false;});rejected(value=>{value.postgres.scenarios[4].diagnostic.code='SECRET_PROVIDER_DETAIL';});
});
test('same-client new-transaction prepare and reuse need observed authority rejection with zero Graph and POST',()=>{
 for(const index of [11,12]){
  for(const [key,bad]of [['providerPosts',1],['graphRequests',1],['rejectedCode','META_CUSTOMER_PROVIDER_REJECTED'],['sameClient',false],['newTransaction',false]])rejected(value=>{value.postgres.scenarios[index][key]=bad;});
  rejected(value=>{delete value.postgres.scenarios[index].graphRequests;});rejected(value=>{value.postgres.scenarios[index].state='SEND_STARTED';});
 }
});
test('changed controlled comparison delays or baseline source cannot certify the performance contrast',()=>{
 for(const index of [1,2])for(const [key,bad]of [['statementDelayMs',0],['graphDelayMs',0],['productionLatencyMeasured',true]])rejected(value=>{value.postgres.measurements[index][key]=bad;});for(const [key,bad]of [['baselineSourceRevision','c'.repeat(40)],['baselineOutboundSha256','f'.repeat(64)],['replySent',true],['compactFences',17],['elapsedMs',59000],['fullResolutions',4],['sqlStatements',50]])rejected(value=>{value.postgres.measurements[2][key]=bad;});
 const fixturePath='tests/fixtures/meta-kyc-outbound-baseline-b572.json';rejected(value=>{const previous=JSON.parse(value.gitSources[fixturePath]);previous.source+='\n// Retagged source\n';value.gitSources[fixturePath]=Buffer.from(JSON.stringify(previous));});
});
test('operative provider acceptance extended leases and incomplete cleanup are rejected',()=>{
 for(const key of ['operativeDatabaseUsed','realProviderUsed','municipalOrIdentityAcceptance','leaseExtended'])rejected(value=>{value.postgres[key]=true;});rejected(value=>{value.postgres.provider='real-provider';});for(const key of ['poolClosed','databaseRemoved','adminClosed']){rejected(value=>{value.postgres[key]=false;});rejected(value=>{delete value.postgres[key];});}
});
test('computed imports remote modules and source traversal fail before any producer execution',()=>{
 const file='scripts/verify-company-kyc-outbound-compact-postgres.mjs';
 for(const addition of ['\nexport const hidden=()=>import(remotePath);','\nimport "https://example.invalid/unbounded.mjs";','\nimport "../../../../outside.mjs";'])assert.throws(()=>companyKycOutboundCompactCiSourceClosure(name=>name===file?Buffer.concat([sources[file],Buffer.from(addition)]):sources[name]||null),{code:'KYC_OUTBOUND_COMPACT_CI_REJECTED'});
});
test('OWN context feedback is additional while all thirteen historical checks and three measurements remain exact',()=>{
 const input=fixture(),proof=validateCompanyKycOutboundCompactCi(input);assert.equal(proof.checks.length,13);assert.equal(proof.scenarios.length,13);assert.equal(proof.measurements.length,3);assert.equal(proof.syntheticMessagePostCount,4);assert.equal(proof.totalSyntheticMessagePostCount,6);assert.deepEqual(proof.contextFeedbackNative.checks,COMPANY_KYC_CONTEXT_OUTBOUND_CHECKS);
});
test('missing or forged OWN feedback lineage cannot reuse the historical proof',()=>{
 rejected(value=>{delete value.postgres.contextFeedbackNative;});for(const [key,bad]of [['status','FAIL'],['kind','PROJECT'],['postgresExecuted',false],['sourcePromptConfirmed',false],['sourcePurpose','FIELD'],['input','HOLA'],['priorPrompt',false],['sourcePromptBytesUnchanged',false],['workerBytesUnchanged',false]])rejected(value=>{value.postgres.contextFeedbackNative[key]=bad;});rejected(value=>{value.postgres.contextFeedbackNative.checks=[];});
});
test('OWN original source lease latency budget and measured fences cannot be forged',()=>{
 for(const [key,bad]of [['fullResolutions',4],['compactFences',0],['runtimeFences',0],['graphRequests',0],['statementDelayMs',0],['graphDelayMs',0],['sourceLeaseMs',120000],['leaseExtended',true],['elapsedMs',60000],['prePostMs',60001],['marginMs',0],['productionLatencyMeasured',true]])rejected(value=>{value.postgres.contextFeedbackNative.measurement[key]=bad;});
});
test('OWN one POST no replay and truthful combined counters are required independently of historical four',()=>{
 for(const [key,bad]of [['providerPosts',0],['providerPosts',2],['replayedPosts',1],['replyState','SEND_UNKNOWN'],['messageIdPresent',false]])rejected(value=>{value.postgres.contextFeedbackNative.measurement[key]=bad;});for(const bad of [4,5,7])rejected(value=>{value.postgres.totalSyntheticMessagePostCount=bad;});rejected(value=>{value.postgres.syntheticMessagePostCount=5;});
});
test('OWN consent capture altered evidence and human acceptance claims remain closed',()=>{
 for(const [key,bad]of [['consentChosen',true],['identitySubmitted',true],['privateMediaCalls',1],['realProviderCalls',1],['productionDataTouched',true],['humanAccepted',true],['workerAfterSha256','f'.repeat(64)],['sourcePromptAfterSha256','f'.repeat(64)]])rejected(value=>{value.postgres.contextFeedbackNative[key]=bad;});
});
test('latest-expired production composition is mandatory in addition to all historical and prior-prompt receipts',()=>{
 const input=fixture(),proof=validateCompanyKycOutboundCompactCi(input);assert.equal(proof.checks.length,13);assert.equal(proof.scenarios.length,13);assert.equal(proof.measurements.length,3);assert.deepEqual(proof.contextFeedbackNative.checks,COMPANY_KYC_CONTEXT_OUTBOUND_CHECKS);assert.deepEqual(proof.latestExpiredContextNative.checks,COMPANY_KYC_LATEST_EXPIRED_COMPOSITION_CHECKS);assert.equal(proof.syntheticMessagePostCount,4);assert.equal(proof.totalSyntheticMessagePostCount,6);
 rejected(value=>{delete value.postgres.latestExpiredContextNative;value.postgres.totalSyntheticMessagePostCount=5;});
 for(const [key,bad]of [['compositionFactory','copied-config'],['quotedLatestPrompt',false],['fixtureConversationExpired',false],['challengeStillValid',false],['challengeStatus','COMPLETED'],['sourceEventBytesUnchanged',false],['sourceEventAfterSha256','d'.repeat(64)]])rejected(value=>{value.postgres.latestExpiredContextNative[key]=bad;});
 rejected(value=>{value.postgres.latestExpiredContextNative.checks=[];});
});
test('composed recovery priority cannot hide intake capture expiry fallback or private writes',()=>{
 for(const key of ['rejectionRecovery','expiryRecovery','contextRecovery','contextPredispatch'])rejected(value=>{value.postgres.latestExpiredContextNative.calls[key]=0;});
 for(const key of ['intake','capture','app','company','field','expiryFallback','authorizationDefer'])rejected(value=>{value.postgres.latestExpiredContextNative.calls[key]=1;});
 for(const [key,bad]of [['beforeDispatchReads',0],['workerWrites',1],['sourceLeaseWrites',2],['fullResolutions',4],['compactFences',0],['runtimeFences',0],['graphRequests',0]])rejected(value=>{value.postgres.latestExpiredContextNative.measurement[key]=bad;});
 rejected(value=>{delete value.gitSources['src/lib/meta-customer-processing-runtime.mjs'];});rejected(value=>{value.postgres.sourceManifest=value.postgres.sourceManifest.filter(ref=>ref.path!=='src/lib/meta-customer-processing-runtime.mjs');});
});
test('composed original60s latency one POST and immutable current source cannot be retagged as provider acceptance',()=>{
 for(const [key,bad]of [['sourceLeaseMs',120000],['leaseExtended',true],['statementDelayMs',0],['graphDelayMs',0],['elapsedMs',60000],['prePostMs',60001],['marginMs',0],['providerPosts',2],['replayedPosts',1],['replyState','SEND_UNKNOWN'],['productionLatencyMeasured',true]])rejected(value=>{value.postgres.latestExpiredContextNative.measurement[key]=bad;});
 for(const [key,bad]of [['consentChosen',true],['identitySubmitted',true],['privateMediaCalls',1],['realProviderCalls',1],['productionDataTouched',true],['humanAccepted',true]])rejected(value=>{value.postgres.latestExpiredContextNative[key]=bad;});
});

test('current neutral OWN add-on remains separate from every original compact and CURRENT image case',()=>{
 const input=fixture(),before=JSON.stringify(input),result=validateCompanyKycOutboundCompactCi(input);assert.equal(result.currentNeutralStepGuidance.currentCases,12);assert.equal(result.currentNeutralStepGuidance.historicalCasesPreserved,4);assert.equal(result.currentNeutralStepGuidance.sourceLeaseExtended,false);assert.equal(result.currentNeutralStepGuidance.identityOrProviderAccepted,false);assert.deepEqual(result.neutralStepGuidanceNative,input.postgres.neutralStepGuidanceNative);assert.equal(JSON.stringify(input),before);assert.deepEqual(result.checks,COMPANY_KYC_OUTBOUND_COMPACT_CHECKS);
});

test('neutral OWN omitted foreign and reclassified observations cannot reuse a historical current receipt',()=>{
 rejected(value=>{delete value.postgres.neutralStepGuidanceNative;});for(const edit of [dto=>{dto.kind='COMPANY';},dto=>{dto.cases.pop();},dto=>{dto.cases[0].name='foreign-case';},dto=>{dto.cases[0].commands=['MENU'];},dto=>{dto.cases[0].workerBytesUnchanged=false;},dto=>{dto.originalGrantUnchanged=false;},dto=>{dto.originalV2ActivationReceipt='';},dto=>{dto.privateIo=1;},dto=>{dto.humanAccepted=true;},dto=>{dto.sourceState='EXACT_CI_SOURCE';}])rejected(value=>{edit(value.postgres.neutralStepGuidanceNative);});
 for(const file of ['scripts/lib/kyc-neutral-step-guidance-native.mjs','scripts/lib/kyc-neutral-step-guidance-own-native.mjs'])rejected(value=>{delete value.gitSources[file];});
});

test('neutral OWN actual lock transaction and original22520060000 budget observations stay mandatory',()=>{
 for(const edit of [dto=>{dto.cases.find(row=>row.blockedPid).blockingPids=[];},dto=>{const row=dto.cases.find(row=>row.blockedPid);row.blockingPids=[row.blockedPid];},dto=>{dto.cases.find(row=>row.mutationTransaction).mutationTransaction='';},dto=>{dto.cases.find(row=>Object.hasOwn(row,'elapsedMs')).elapsedMs=60000;},dto=>{dto.cases.find(row=>Object.hasOwn(row,'elapsedMs')).statementDelayMs=0;},dto=>{dto.cases.find(row=>Object.hasOwn(row,'elapsedMs')).sourceLeaseMs=120000;},dto=>{dto.cases.find(row=>Object.hasOwn(row,'elapsedMs')).marginMs=1;},dto=>{dto.cases.find(row=>Object.hasOwn(row,'elapsedMs')).leaseExtended=true;}])rejected(value=>{edit(value.postgres.neutralStepGuidanceNative);});
 for(const edit of [dto=>{delete dto.setupChronology;},dto=>{dto.setupChronology.canonicalGrantIssuedAt='2026-01-01T00:02:00.000Z';},dto=>{dto.setupChronology.canonicalGrantIssuedAt='2026-01-01T00:00:00Z';},dto=>{dto.setupChronology.earliestCanonicalClaimedAt='not-a-date';},dto=>{dto.setupChronology.grantPrecedesClaim=false;},dto=>{dto.setupChronology.grantAndOriginReceiptUnchanged=false;},dto=>{dto.setupChronology.continuationClock='controlled-clock';},dto=>{dto.setupChronology.unreviewedChronology=true;}])rejected(value=>{edit(value.postgres.neutralStepGuidanceNative);});
 for(const edit of [dto=>{delete dto.syntheticIssuanceClock;},dto=>{dto.syntheticIssuanceClock.windows=0;},dto=>{dto.syntheticIssuanceClock.windows=2;},dto=>{dto.syntheticIssuanceClock.windows='1';},dto=>{dto.syntheticIssuanceClock.dateNowDescriptorRestored=false;},dto=>{dto.syntheticIssuanceClock.dateNowFunctionRestored=false;},dto=>{dto.syntheticIssuanceClock.continuationClock='controlled-clock';},dto=>{dto.syntheticIssuanceClock.extraWindow=true;}])rejected(value=>{edit(value.postgres.neutralStepGuidanceNative);});
});

import {normalizeCaptureOwnNeutralNativeProof} from '../scripts/lib/capture-runtime-canonical-collectors.mjs';
import {validateWhatsappFieldNeutralStepNative} from '../scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs';
function ownNeutralComponent(){
 const input=fixture();input.postgres.sourceState='LOCAL_REVIEW_SOURCE';let raw=Buffer.from(JSON.stringify(input.postgres));const initialRaw=Buffer.from(raw),contract=JSON.parse(sources['.github/workspace-acceptance-contract.json']);let calls=0;
 const options={contract,proof:input.postgres,readSource:file=>Object.hasOwn(input.gitSources,file)?input.gitSources[file]:null,readEvidence:file=>file==='.vercel/private/company-kyc-outbound-compact-postgres.json'?Buffer.from(raw):null,normalizeLegacy:(projected,parent,parentRead)=>{calls++;assert.equal(projected.sourceState,'LOCAL_REVIEW_SOURCE');assert.equal(projected.sourceRevision,input.postgres.sourceRevision);assert.equal(projected.sourceTree,input.postgres.sourceTree);assert.equal(projected.sourceManifest.length,144);return validateWhatsappFieldNeutralStepNative(projected,'OWN',parent,parentRead);}};
 return{input,options,initialRaw,get calls(){return calls;},replaceRaw:value=>{raw=Buffer.from(value);},run:()=>normalizeCaptureOwnNeutralNativeProof(options)};
}
const ownAdapterDenied=run=>assert.throws(run,error=>['CAPTURE_QUALITY_COLLECTOR_REJECTED','PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED'].includes(error.code));
test('current OWN adapter preserves original LOCAL RAW and all execution facts across the exact155-to144 source-only boundary',()=>{
 const h=ownNeutralComponent(),before=JSON.stringify(h.input),contractBefore=JSON.stringify(h.options.contract),result=h.run();assert.equal(h.calls,1);assert.equal(result.status,'PASS');assert.equal(result.currentNativeSourceCount,155);assert.equal(result.historicalNativeSourceCount,144);assert.equal(result.currentCases,12);assert.equal(result.sourceState,'LOCAL_REVIEW_SOURCE');assert.equal(result.rawProofTransformed,false);assert.equal(result.sourceOnlyProjection,true);assert.equal(result.identityOrProviderAccepted,false);assert.equal(JSON.stringify(h.input),before);assert.equal(JSON.stringify(h.options.contract),contractBefore);assert.ok(h.options.readEvidence('.vercel/private/company-kyc-outbound-compact-postgres.json').equals(h.initialRaw));
});
test('current OWN adapter rejects omitted duplicate stale foreign and forged-harness current source metadata',()=>{
 for(const mode of ['omitted','duplicate','stale','foreign','harness']){const h=ownNeutralComponent();if(mode==='omitted')h.input.postgres.sourceManifest=h.input.postgres.sourceManifest.filter(row=>row.path!=='src/lib/participant-facial-precommit.mjs');if(mode==='duplicate')h.input.postgres.sourceManifest[1]={...h.input.postgres.sourceManifest[0]};if(mode==='stale')h.input.postgres.sourceManifest[0].sha256='f'.repeat(64);if(mode==='foreign')h.input.postgres.sourceManifest[0].path='src/lib/foreign.mjs';if(mode==='harness')h.input.postgres.harnessSha256='f'.repeat(64);h.replaceRaw(JSON.stringify(h.input.postgres));ownAdapterDenied(h.run);assert.equal(h.calls,0);}
});
test('current OWN adapter binds RAW byte equality even when changed whitespace preserves parsed JSON',()=>{
 for(const moment of ['before-oracle','after-oracle']){const h=ownNeutralComponent(),oracle=h.options.normalizeLegacy;let reads=0;if(moment==='before-oracle')h.options.readEvidence=()=>Buffer.from(++reads===1?h.initialRaw:Buffer.concat([h.initialRaw,Buffer.from('\n')]));else h.options.normalizeLegacy=(...args)=>{const value=oracle(...args);h.replaceRaw(Buffer.concat([h.initialRaw,Buffer.from('\n')]));return value;};ownAdapterDenied(h.run);assert.equal(h.calls,moment==='before-oracle'?0:1);}
 const mismatch=ownNeutralComponent();mismatch.replaceRaw(JSON.stringify({...mismatch.input.postgres,status:'FAIL'}));ownAdapterDenied(mismatch.run);assert.equal(mismatch.calls,0);
});
test('current OWN adapter rejects callback mutation and asynchronous return without changing original facts or elevating provenance',()=>{
 for(const mode of ['projected-business','projected-source','thenable','caller-and-RAW']){const h=ownNeutralComponent(),oracle=h.options.normalizeLegacy;h.options.normalizeLegacy=(...args)=>{const value=oracle(...args);if(mode==='projected-business')args[0].sourceState='EXACT_CI_SOURCE';if(mode==='projected-source')args[0].sourceManifest.pop();if(mode==='caller-and-RAW'){h.input.postgres.totalSyntheticMessagePostCount=7;h.replaceRaw(JSON.stringify(h.input.postgres));}return mode==='thenable'?Promise.resolve(value):value;};ownAdapterDenied(h.run);assert.equal(h.calls,1);if(mode!=='caller-and-RAW')assert.equal(h.input.postgres.sourceState,'LOCAL_REVIEW_SOURCE');}
});
test('current OWN adapter rereads current sources and contract after the historical callback',()=>{
 for(const mode of ['source','contract']){const h=ownNeutralComponent(),oracle=h.options.normalizeLegacy;let changed=false;const original=h.options.readSource;h.options.readSource=file=>changed&&file==='src/lib/participant-facial-policy.mjs'?Buffer.concat([original(file),Buffer.from('\n')]):original(file);h.options.normalizeLegacy=(...args)=>{const value=oracle(...args);if(mode==='source')changed=true;else h.options.contract.planBudgetCurrentRevision.captureQualityRuntime.familyAdvances.find(row=>row.family==='COMPACT').currentCount=156;return value;};ownAdapterDenied(h.run);assert.equal(h.calls,1);}
});
test('the full current CI entry still requires EXACT_CI before its RAW port and rejects missing current RAW authority',()=>{
 const local=fixture();local.postgres.sourceState='LOCAL_REVIEW_SOURCE';let reads=0;local.readEvidence=()=>{reads++;throw Error('LOCAL_CANNOT_REACH_CI_RAW_PORT');};assert.throws(()=>validateCompanyKycOutboundCompactCi(local),{code:'KYC_OUTBOUND_COMPACT_CI_REJECTED'});assert.equal(reads,0);const missing=fixture();delete missing.readEvidence;assert.throws(()=>validateCompanyKycOutboundCompactCi(missing),{code:'KYC_OUTBOUND_COMPACT_CI_REJECTED'});const missingLeaf=fixture();delete missingLeaf.gitSources['src/lib/plan-baseline-http.mjs'];assert.throws(()=>validateCompanyKycOutboundCompactCi(missingLeaf),error=>error.code==='KYC_OUTBOUND_COMPACT_CI_REJECTED'&&error.message==='Missing committed source: src/lib/plan-baseline-http.mjs');
});
