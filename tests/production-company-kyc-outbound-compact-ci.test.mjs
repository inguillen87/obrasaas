import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {COMPANY_KYC_OUTBOUND_COMPACT_PROOF_VERSION,COMPANY_KYC_OUTBOUND_COMPACT_CHECKS,COMPANY_KYC_CONTEXT_OUTBOUND_CHECKS,companyKycOutboundCompactSourceFiles} from '../scripts/verify-company-kyc-outbound-compact-postgres.mjs';
import {validateCompanyKycOutboundCompactCi,companyKycOutboundCompactCiSourceClosure} from '../scripts/verify-company-kyc-outbound-compact-ci.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),sources=Object.create(null),sha=value=>createHash('sha256').update(value).digest('hex');
const readSource=file=>{const filename=path.join(root,file);if(!existsSync(filename))return null;if(!Object.hasOwn(sources,file))sources[file]=readFileSync(filename);return sources[file];};
const closure=companyKycOutboundCompactCiSourceClosure(readSource),head='a'.repeat(40),tree='b'.repeat(40);
function fixture(){
 const scenarios=['native-current','distinct-participant-multiworksite','controlled-current','controlled-source-baseline','after-reserve-fault','source-lease-expired','issuer-revoked','credential-rotated','principal-trailed-ABA','between-KYC-runtime-clock-expired','provider-lost-ACK'].map((name,index)=>({name,providerPosts:index<3||index===10?1:0,replayedPosts:0,state:index<3?'SENT':index===10?'SEND_UNKNOWN':'SEND_STARTED',messageIdPresent:index<3}));
 Object.assign(scenarios[1],{distinctParticipant:true,distinctAnchorTarget:true,fullResolutions:4,compactFences:17,runtimeFences:16});
 scenarios[4].diagnostic={version:1,phase:'AFTER_RESERVE',code:'META_OWN_COMPANY_OWNER_UNCONFIRMED',recordedAt:'2026-10-14T12:00:00.000Z'};scenarios[10].diagnostic={version:1,phase:'REPLY_POST',code:'META_CUSTOMER_PROVIDER_UNCONFIRMED',recordedAt:'2026-10-14T12:00:00.000Z'};
 scenarios.push(...['same-client-new-transaction-before-prepare','same-client-new-transaction-after-prepare'].map(name=>({name,providerPosts:0,graphRequests:0,rejectedCode:'META_KYC_COMPANY_AUTHORITY_CHANGED',sameClient:true,newTransaction:true})));
 const contextFeedbackNative={status:'PASS',kind:'OWN_COMPANY_RUNTIME',postgresExecuted:true,checks:[...COMPANY_KYC_CONTEXT_OUTBOUND_CHECKS],sourcePromptConfirmed:true,sourcePurpose:'KYC_CAPTURE',input:'ESTADO IDENTIDAD',priorPrompt:true,consentChosen:false,identitySubmitted:false,privateMediaCalls:0,workerBytesUnchanged:true,sourcePromptBytesUnchanged:true,workerBeforeSha256:'d'.repeat(64),workerAfterSha256:'d'.repeat(64),sourcePromptBeforeSha256:'e'.repeat(64),sourcePromptAfterSha256:'e'.repeat(64),realProviderCalls:0,productionDataTouched:false,humanAccepted:false,measurement:{kind:'controlled-own-context-feedback',sqlStatements:110,fullResolutions:3,compactFences:12,runtimeFences:10,graphRequests:8,statementDelayMs:225,graphDelayMs:200,sourceLeaseMs:60000,elapsedMs:28000,prePostMs:24000,marginMs:32000,leaseExtended:false,productionLatencyMeasured:false,providerPosts:1,replayedPosts:0,replyState:'SENT',messageIdPresent:true}};
 return {expectedHead:head,head,sourceTree:tree,trackedClean:true,gitSources:{...sources},postgres:{version:COMPANY_KYC_OUTBOUND_COMPACT_PROOF_VERSION,status:'PASS',sourceRevision:head,sourceTree:tree,trackedClean:true,sourceState:'EXACT_CI_SOURCE',checks:[...COMPANY_KYC_OUTBOUND_COMPACT_CHECKS],scenarios,syntheticMessagePostCount:4,totalSyntheticMessagePostCount:5,contextFeedbackNative,provider:'controlled-synthetic-only',operativeDatabaseUsed:false,realProviderUsed:false,municipalOrIdentityAcceptance:false,leaseExtended:false,poolClosed:true,databaseRemoved:true,adminClosed:true,harnessSha256:sha(sources['scripts/verify-company-kyc-outbound-compact-postgres.mjs']),sourceManifest:closure.files.map(file=>({path:file,sha256:sha(sources[file])})),measurements:[{kind:'native-current',sqlStatements:90,fullResolutions:4,compactFences:17,runtimeFences:16,elapsedMs:300,sourceLeaseMs:60000,providerPosts:1,replyState:'SENT',leaseExtended:false},{kind:'controlled-current',sqlStatements:90,fullResolutions:4,compactFences:17,runtimeFences:16,elapsedMs:23000,sourceLeaseMs:60000,providerPosts:1,replyState:'SENT',leaseExtended:false,statementDelayMs:225,graphDelayMs:200,marginMs:37000,productionLatencyMeasured:false},{kind:'controlled-source-baseline',baselineSourceRevision:'b5723d23092bd214b9271582af8e6bcb2c929a66',baselineOutboundSha256:'3f562c8d30280bf9ccce53a94523c9f0dd33278ce744bd72cae3949becc72f7f',sqlStatements:240,fullResolutions:10,compactFences:0,elapsedMs:60500,sourceLeaseMs:60000,replySent:false,providerPosts:0,leaseExtended:false,statementDelayMs:225,graphDelayMs:200,productionLatencyMeasured:false}]}};
}
function rejected(edit){const input=fixture();edit(input);assert.throws(()=>validateCompanyKycOutboundCompactCi(input),{code:'KYC_OUTBOUND_COMPACT_CI_REJECTED'});}

test('complete pure source-bound compact receipt validates without running PostgreSQL or providers',()=>{
 assert.deepEqual(closure.files,companyKycOutboundCompactSourceFiles(root));const input=fixture(),before=JSON.stringify(input),value=validateCompanyKycOutboundCompactCi(input);assert.equal(JSON.stringify(input),before);assert.equal(value.status,'PASS');assert.equal(value.sourceCount,closure.files.length);assert.deepEqual(value.checks,COMPANY_KYC_OUTBOUND_COMPACT_CHECKS);
});
test('foreign or abbreviated HEAD and stale tree cannot certify the native receipt',()=>{
 rejected(value=>{value.expectedHead=head.slice(0,7);});rejected(value=>{value.head='c'.repeat(40);});rejected(value=>{value.sourceTree='c'.repeat(40);});for(const key of ['sourceRevision','sourceTree'])rejected(value=>{value.postgres[key]='c'.repeat(40);});
});
test('dirty checkout local review records and false success claims cannot certify CI',()=>{
 rejected(value=>{value.trackedClean=false;});for(const [key,bad]of [['trackedClean',false],['sourceState','LOCAL_REVIEW_SOURCE'],['status','FAIL'],['version','prior-version']])rejected(value=>{value.postgres[key]=bad;});
});
test('omitted duplicate foreign and stale source references fail against exact transitive closure',()=>{
 rejected(value=>{value.postgres.sourceManifest.pop();});rejected(value=>{value.postgres.sourceManifest[1]={...value.postgres.sourceManifest[0]};});rejected(value=>{value.postgres.sourceManifest[0].path='src/lib/foreign.mjs';});rejected(value=>{value.postgres.sourceManifest[0].sha256='f'.repeat(64);});rejected(value=>{delete value.gitSources['src/lib/company-channel-kyc.mjs'];});
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
 const input=fixture(),proof=validateCompanyKycOutboundCompactCi(input);assert.equal(proof.checks.length,13);assert.equal(proof.scenarios.length,13);assert.equal(proof.measurements.length,3);assert.equal(proof.syntheticMessagePostCount,4);assert.equal(proof.totalSyntheticMessagePostCount,5);assert.deepEqual(proof.contextFeedbackNative.checks,COMPANY_KYC_CONTEXT_OUTBOUND_CHECKS);
});
test('missing or forged OWN feedback lineage cannot reuse the historical proof',()=>{
 rejected(value=>{delete value.postgres.contextFeedbackNative;});for(const [key,bad]of [['status','FAIL'],['kind','PROJECT'],['postgresExecuted',false],['sourcePromptConfirmed',false],['sourcePurpose','FIELD'],['input','HOLA'],['priorPrompt',false],['sourcePromptBytesUnchanged',false],['workerBytesUnchanged',false]])rejected(value=>{value.postgres.contextFeedbackNative[key]=bad;});rejected(value=>{value.postgres.contextFeedbackNative.checks=[];});
});
test('OWN original source lease latency budget and measured fences cannot be forged',()=>{
 for(const [key,bad]of [['fullResolutions',4],['compactFences',0],['runtimeFences',0],['graphRequests',0],['statementDelayMs',0],['graphDelayMs',0],['sourceLeaseMs',120000],['leaseExtended',true],['elapsedMs',60000],['prePostMs',60001],['marginMs',0],['productionLatencyMeasured',true]])rejected(value=>{value.postgres.contextFeedbackNative.measurement[key]=bad;});
});
test('OWN one POST no replay and truthful combined counters are required independently of historical four',()=>{
 for(const [key,bad]of [['providerPosts',0],['providerPosts',2],['replayedPosts',1],['replyState','SEND_UNKNOWN'],['messageIdPresent',false]])rejected(value=>{value.postgres.contextFeedbackNative.measurement[key]=bad;});for(const bad of [4,6])rejected(value=>{value.postgres.totalSyntheticMessagePostCount=bad;});rejected(value=>{value.postgres.syntheticMessagePostCount=5;});
});
test('OWN consent capture altered evidence and human acceptance claims remain closed',()=>{
 for(const [key,bad]of [['consentChosen',true],['identitySubmitted',true],['privateMediaCalls',1],['realProviderCalls',1],['productionDataTouched',true],['humanAccepted',true],['workerAfterSha256','f'.repeat(64)],['sourcePromptAfterSha256','f'.repeat(64)]])rejected(value=>{value.postgres.contextFeedbackNative[key]=bad;});
});
