import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {WHATSAPP_FEEDBACK_PREVIOUS_SOURCE_COUNTS,validateWhatsappFeedbackPreviousSourceLineage,validateCompanyKycContextNativeProof,validateExtensionProof,currentProducerSourceFiles} from '../.github/scripts/verify-workspace-ci-parallelization.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const contract=JSON.parse(readFileSync(path.join(root,'.github/workspace-acceptance-contract.json'),'utf8'));
const clone=structuredClone;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const readSource=file=>Buffer.from(readFileSync(path.join(root,file),'utf8').replaceAll('\r\n','\n'));
const additions=kind=>kind==='PG_COMPANY_KYC'?['src/lib/field-report-feedback.mjs','src/lib/meta-kyc-context-feedback.mjs','src/lib/meta-kyc-context-outbound.mjs','scripts/lib/kyc-context-feedback-native.mjs']:['src/lib/field-report-feedback.mjs'];
const current=contract.extension.proofs.filter(spec=>Object.hasOwn(WHATSAPP_FEEDBACK_PREVIOUS_SOURCE_COUNTS,spec.kind));

test('current execution graphs add only their real WhatsApp imports and preserve every published PR142 path set',()=>{
 assert.equal(current.length,7);
 for(const spec of current){
  assert.equal(spec.sourceFiles.length,WHATSAPP_FEEDBACK_PREVIOUS_SOURCE_COUNTS[spec.kind]+additions(spec.kind).length);
  assert.doesNotThrow(()=>validateWhatsappFeedbackPreviousSourceLineage(spec));
  assert.deepEqual(currentProducerSourceFiles(spec,root),spec.sourceFiles.toSorted());
 }
});

test('missing duplicate substituted or historical-only current imports cannot retain a source binding',()=>{
 for(const spec of current)for(const file of additions(spec.kind)){
  for(const mutate of [value=>{value.sourceFiles=value.sourceFiles.filter(source=>source!==file);},value=>{value.sourceFiles.push(file);},value=>{value.sourceFiles[value.sourceFiles.indexOf(file)]='src/lib/foreign-whatsapp-feedback.mjs';}]){
   const changed=clone(spec);mutate(changed);assert.throws(()=>validateWhatsappFeedbackPreviousSourceLineage(changed),{code:'WHATSAPP_FEEDBACK_CURRENT_SOURCE_DEPENDENCIES'});
  }
 }
 for(const spec of current){const historical=clone(spec);historical.sourceFiles=historical.sourceFiles.filter(file=>!additions(spec.kind).includes(file));assert.throws(()=>validateWhatsappFeedbackPreviousSourceLineage(historical),{code:'WHATSAPP_FEEDBACK_CURRENT_SOURCE_DEPENDENCIES'});}
});

test('same-count replacement of an older source cannot redefine the frozen PR142 path lineage',()=>{
 for(const spec of current){const changed=clone(spec),index=changed.sourceFiles.findIndex(file=>!additions(spec.kind).includes(file));changed.sourceFiles[index]='src/lib/foreign-historical-source.mjs';assert.equal(changed.sourceFiles.length,spec.sourceFiles.length);assert.throws(()=>validateWhatsappFeedbackPreviousSourceLineage(changed),{code:'WHATSAPP_FEEDBACK_PREVIOUS_SOURCE_LINEAGE'});}
});

test('the original thirteen company KYC groups remain immutable and all five native context groups are required',()=>{
 const spec=current.find(value=>value.kind==='PG_COMPANY_KYC');assert.equal(spec.checkNames.length,18);
 for(const mutate of [value=>{value.checkNames[0]='redefined-original-authority';},value=>{value.checkNames.pop();},value=>{value.checkNames=value.checkNames.slice(0,13);}]){const changed=clone(spec);mutate(changed);assert.throws(()=>validateWhatsappFeedbackPreviousSourceLineage(changed),{code:'WHATSAPP_FEEDBACK_PREVIOUS_CHECK_LINEAGE'});}
 for(const mutate of [value=>{value.checkNames[13]='assumed-current-source';},value=>{value.checkNames[14]=value.checkNames[13];},value=>{value.checkNames.splice(13,5,...value.checkNames.slice(13).reverse());}]){const changed=clone(spec);mutate(changed);assert.throws(()=>validateWhatsappFeedbackPreviousSourceLineage(changed),{code:'WHATSAPP_FEEDBACK_CURRENT_CHECK_NAMES'});}
});

test('the outer proof rejects omitted foreign and wrong-hash additions before any native or provider declaration',()=>{
 const spec=current.find(value=>value.kind==='PG_COMPANY_KYC'),proof={status:'PASS',productionDataTouched:false,harnessSha256:sha(readSource(spec.producer)),sourceManifest:spec.sourceFiles.map(file=>({path:file,sha256:sha(readSource(file))}))};
 for(const file of additions(spec.kind))for(const [code,mutate]of [['PROOF_SOURCE_MANIFEST',value=>{value.sourceManifest=value.sourceManifest.filter(ref=>ref.path!==file);}],['PROOF_SOURCE_MANIFEST',value=>{value.sourceManifest.find(ref=>ref.path===file).path='src/lib/foreign-whatsapp-feedback.mjs';}],['PROOF_SOURCE_HASH',value=>{value.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);}]]){const changed=clone(proof);mutate(changed);assert.throws(()=>validateExtensionProof(spec,Buffer.from(JSON.stringify(changed)),{expectedHead:'a'.repeat(40),readSource}),{code});}
});

// This fixture validates the evidence contract; it never runs PostgreSQL or
// produces a file that could be mistaken for a native execution receipt.
function nativeShadow(){return {contextFeedbackNative:{kind:'COMPANY',postgresExecuted:true,provider:'actual-adapter-controlled-Graph-fetch',realProviderCalls:0,humanAccepted:false,identityCertified:false,permissionsGranted:false,cases:[
 {name:'native-prior-prompt-concurrent-receipt-one-HTTP-private-state-unchanged',receiptCount:1,outboxCount:1,httpTransfers:1,workerBytesUnchanged:true,mediaDelta:0},
 {name:'native-neutral-status-exact-expired-source-without-consent-choice',receiptCount:1,outboxCount:1,httpTransfers:1,consentChosen:false,workerBytesUnchanged:true,mediaDelta:0},
 {name:'native-current-issuer-revoked-after-reservation-no-HTTP',receiptCount:1,outboxCount:1,httpTransfers:0,workerBytesUnchanged:true,mediaDelta:0},
 {name:'native-processor-intercepts-before-capture-without-replay-dispatch',captureDispatches:0,httpTransfers:1,workerBytesUnchanged:true,mediaDelta:0},
 {name:'native-original-60s-lease-controlled-225ms-SQL-200ms-Graph',sqlStatements:140,compactFences:8,fullResolutions:8,elapsedMs:35000,prePostMs:33000,statementDelayMs:225,graphDelayMs:200,sourceLeaseMs:60000,marginMs:25000,leaseExtended:false,httpTransfers:1,workerBytesUnchanged:true,mediaDelta:0,productionLatencyMeasured:false},
]}};}
function rejected(mutate){const value=nativeShadow();mutate(value.contextFeedbackNative,value);assert.throws(()=>validateCompanyKycContextNativeProof(value),{code:'PROOF_KYC_CONTEXT_NATIVE'});}

test('five native context cases require read-only receipts with one HTTP and unchanged private state',()=>{
 assert.doesNotThrow(()=>validateCompanyKycContextNativeProof(nativeShadow()));
 for(const mutate of [(_e,value)=>{delete value.contextFeedbackNative;},e=>{e.cases.pop();},e=>{e.cases[1]=clone(e.cases[0]);},e=>{e.cases.reverse();},e=>{e.cases[0].receiptCount=2;},e=>{e.cases[0].outboxCount=0;},e=>{e.cases[0].httpTransfers=2;},e=>{e.cases[1].consentChosen=true;},e=>{e.cases[2].httpTransfers=1;},e=>{e.cases[3].captureDispatches=1;}])rejected(mutate);
 for(const index of [0,1,2,3,4]){rejected(e=>{e.cases[index].workerBytesUnchanged=false;});rejected(e=>{e.cases[index].mediaDelta=1;});rejected(e=>{e.cases[index].secret='unbounded diagnostic';});}
});

test('the controlled measurement needs the original sixty-second lease and the declared SQL and Graph delays',()=>{
 for(const [key,value]of [['elapsedMs',60000],['prePostMs',60000],['prePostMs',-1],['marginMs',60000],['sourceLeaseMs',180000],['leaseExtended',true],['statementDelayMs',0],['graphDelayMs',0],['productionLatencyMeasured',true],['compactFences',0],['fullResolutions',0],['sqlStatements',0]])rejected(e=>{e.cases[4][key]=value;});
 rejected(e=>{delete e.cases[4].prePostMs;});rejected(e=>{delete e.cases[4].leaseExtended;});
});

test('real provider human identity permission and nonnative claims cannot certify the technical controls',()=>{
 for(const [key,value]of [['realProviderCalls',1],['humanAccepted',true],['identityCertified',true],['permissionsGranted',true],['postgresExecuted',false],['kind','PROJECT'],['provider','real-provider']])rejected(e=>{e[key]=value;});
 for(const key of ['realProviderCalls','humanAccepted','identityCertified','permissionsGranted','postgresExecuted'])rejected(e=>{delete e[key];});
});
