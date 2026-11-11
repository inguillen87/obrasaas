import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

// Private proposal runs may point at their reviewed source copy; CI always reads its checkout.
assert.ok(!process.env.CI||!process.env.KYC_COMPACT_SOURCE_ROOT&&!process.env.KYC_COMPACT_DEPENDENCY_ROOT);
const dependencyRoot=process.env.KYC_COMPACT_DEPENDENCY_ROOT||fileURLToPath(new URL('../',import.meta.url));
const sourceRoot=process.env.KYC_COMPACT_SOURCE_ROOT||fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(path.join(dependencyRoot,'package.json')),{parse}=require('@babel/parser');
const read=relative=>readFileSync(path.join(sourceRoot,relative),'utf8');
const captureSource=read('src/app/(identity)/cuenta/participant-kyc-capture.js'),panelSource=read('src/app/(identity)/cuenta/participant-panel.js');
const captureAst=parse(captureSource,{sourceType:'module',plugins:['jsx']}),panelAst=parse(panelSource,{sourceType:'module',plugins:['jsx']});
function walk(node,visit){if(!node||typeof node!=='object')return;visit(node);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(item=>walk(item,visit));else if(value&&typeof value==='object')walk(value,visit);}
const wanted=new Set(['precommitFacialNotice','participantFacialModeValid','participantKycSubmitIntent']),parts=[];
for(const row of captureAst.program.body){const node=row.type==='ExportNamedDeclaration'?row.declaration:row;if(node?.type==='FunctionDeclaration'&&wanted.has(node.id.name)||node?.type==='VariableDeclaration'&&node.declarations.some(value=>wanted.has(value.id.name)))parts.push(captureSource.slice(node.start,node.end));}
const helpers=Function(parts.join('\n')+'\nreturn {participantFacialModeValid,participantKycSubmitIntent};')();
let saveNode,confirmNode,nativeSubmit;
walk(panelAst,node=>{if(node.type==='FunctionDeclaration'&&node.id?.name==='save')saveNode=node;if(node.type==='FunctionDeclaration'&&node.id?.name==='confirm')confirmNode=node;if(node.type==='JSXAttribute'&&node.name.name==='onSubmit'&&panelSource.slice(node.start,node.end).includes("draft.action==='SUBMIT_KYC'"))nativeSubmit=node.value.expression;});
assert.ok(saveNode&&nativeSubmit);
const clickNode=label=>{let result;walk(captureAst,node=>{if(node.type!=='JSXElement'||node.openingElement.name.name!=='button'||!node.children.some(child=>child.type==='JSXText'&&child.value.trim()===label))return;const type=node.openingElement.attributes.find(row=>row.name?.name==='type');assert.equal(type?.value?.value,'button');result=node.openingElement.attributes.find(row=>row.name?.name==='onClick')?.value?.expression;});assert.ok(result,label);return result;};
const event=()=>({prevented:false,preventDefault(){this.prevented=true;}});
const notices=()=>({privacyNotice:{version:'participant-kyc-v1',text:'Synthetic private presentation notice'},privateBiometricNotice:{version:'participant-private-biometric-v3',text:'Synthetic optional precommit comparison notice'},externalOcrNotice:{version:'participant-external-ocr-v2',text:'Synthetic independent OCR notice'}});
const payload=()=>({workerId:'worker_fixture',revision:'2026-10-28T12:00:00.000001',noticeVersion:'participant-kyc-v1',consent:false,front:'synthetic-front',selfie:'synthetic-selfie',biometricNoticeVersion:'participant-private-biometric-v3',biometricMode:null,biometricConsent:false,ocrConsent:false,ocrNoticeVersion:'participant-external-ocr-v2'});
function fixture({value=payload(),snapshot=notices(),overrides={},dispatch=async()=>({saved:true})}={}){
 const calls=[],attempts=[],messages=[],captureSubmitting={current:false};let uuidCalls=0;
 const ports={busy:false,accountRequest:{current:{controller:null}},attempt:null,durableReference:null,recoveryReady:true,draft:{action:'SUBMIT_KYC',payload:value},revisionReview:null,accessBlocked:false,hasBankPending:false,intakePending:false,captureSubmitting,captureStep:2,data:snapshot,...helpers,PARTICIPANT_OFFICE_ASSIGN_ACTION:'ASSIGN_OFFICE_ACCOUNT',participantDocumentBackNotice:value=>value,crypto:{randomUUID:()=>{uuidCalls++;return 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';}},projectId:'project_fixture',scope:'a'.repeat(64),setAttempt:value=>attempts.push(value),setRetryAllowed:()=>{},setBusy:()=>{},setNotice:value=>messages.push(value),setReceipt:()=>{},endpoint:'/api/identity/participants',api:async(_query,options)=>{const command=JSON.parse(options.body);calls.push(command);return dispatch(command);},operationResult:value=>value,alive:{current:true},acceptResult:async()=>{},hideDenied:()=>false,captureQualityFeedback:()=>null,participantOfficePrecommitRejected:()=>false,retakeCapture:()=>{},setOfficeSelection:()=>{},setRevisionReview:()=>{},setAccountSelection:()=>{},...overrides};
 const save=Function(...Object.keys(ports),'return ('+panelSource.slice(saveNode.start,saveNode.end)+');')(...Object.values(ports));
 const click=label=>Function('onSubmitChoice','return ('+captureSource.slice(clickNode(label).start,clickNode(label).end)+');')(save)(event());
 return{save,click,calls,attempts,messages,captureSubmitting,value,snapshot,uuidCalls:()=>uuidCalls};
}

test('native form submission and an absent final choice never authorize or dispatch identity',async()=>{
 let saves=0;const messages=[],input=payload(),before=structuredClone(input),native=Function('draft','setNotice','save','return ('+panelSource.slice(nativeSubmit.start,nativeSubmit.end)+');')({action:'SUBMIT_KYC'},value=>messages.push(value),()=>{saves++;}),enter=event();native(enter);
 assert.equal(enter.prevented,true);assert.equal(saves,0);assert.equal(messages.length,1);
 for(const mode of [undefined,null,'AUTO']){const f=fixture({value:input});await f.save(event(),mode);assert.equal(f.calls.length,0);assert.equal(f.uuidCalls(),0);assert.deepEqual(input,before);}
});

test('the visible primary click authorizes only this presentation and its optional facial comparison',async()=>{
 const f=fixture(),before=structuredClone(f.value);await f.click('Enviar para verificar');assert.equal(f.calls.length,1);const body=f.calls[0];assert.equal(body.consent,true);assert.equal(body.biometricMode,'ASSISTED');assert.equal(body.biometricConsent,true);assert.equal(body.ocrConsent,false);assert.equal(body.ocrNoticeVersion,before.ocrNoticeVersion);assert.equal(body.noticeVersion,before.noticeVersion);assert.equal(body.biometricNoticeVersion,before.biometricNoticeVersion);assert.equal(body.front,before.front);assert.equal(body.selfie,before.selfie);assert.deepEqual(f.value,before);assert.equal(f.attempts.length,1);
});

test('the visible secondary click explicitly requests manual review without facial authorization',async()=>{
 const f=fixture({value:{...payload(),biometricConsent:true,biometricMode:'ASSISTED'}});await f.click('Solicitar revisión sin comparación facial');assert.equal(f.calls.length,1);assert.equal(f.calls[0].consent,true);assert.equal(f.calls[0].biometricMode,'MANUAL');assert.equal(f.calls[0].biometricConsent,false);assert.equal(f.calls[0].ocrConsent,false);
});

test('OCR and the optional document back keep their independent choices and exact notices',async()=>{
 const value={...payload(),ocrConsent:true,backConsent:true,back:'synthetic-back',backNoticeVersion:'document-back-fixture',backNoticeSha256:'b'.repeat(64)},snapshot={...notices(),documentBackNotice:{version:'document-back-fixture',sha256:'b'.repeat(64)}},f=fixture({value,snapshot});await f.click('Solicitar revisión sin comparación facial');assert.equal(f.calls.length,1);assert.equal(f.calls[0].ocrConsent,true);assert.equal(f.calls[0].biometricConsent,false);for(const key of ['back','backConsent','backNoticeVersion','backNoticeSha256','ocrNoticeVersion'])assert.equal(f.calls[0][key],value[key]);
 const mismatch=fixture({value,snapshot:{...snapshot,externalOcrNotice:{version:'older-ocr',text:'Old independent notice'}}});await mismatch.click('Enviar para verificar');assert.equal(mismatch.calls.length,0);assert.equal(mismatch.uuidCalls(),0);
});

test('legacy v1 or v2 and current notice mismatches cannot silently create a v3 authorization',async()=>{
 for(const version of ['participant-private-biometric-v1','participant-private-biometric-v2'])for(const mode of ['MANUAL','ASSISTED']){const value={...payload(),biometricNoticeVersion:version},snapshot={...notices(),privateBiometricNotice:{version,text:'Synthetic old notice'}},f=fixture({value,snapshot}),before=structuredClone(value);await f.save(event(),mode);assert.equal(f.calls.length,0);assert.equal(f.uuidCalls(),0);assert.deepEqual(value,before);}
 for(const snapshot of [{...notices(),privateBiometricNotice:{version:'participant-private-biometric-v2',text:'Old notice'}},{...notices(),privacyNotice:{version:'foreign-presentation',text:'Foreign notice'}},{...notices(),privateBiometricNotice:{version:'participant-private-biometric-v3',text:''}}]){const f=fixture({snapshot});await f.save(event(),'ASSISTED');assert.equal(f.calls.length,0);}
});

test('unfinished capture, pending references, stale revision and denied access cannot create a new operation',async()=>{
 for(const overrides of [{captureStep:0},{captureStep:1},{busy:true},{attempt:{operationId:'old'}},{durableReference:{operationId:'old'}},{recoveryReady:false},{revisionReview:{state:'STALE'}},{accessBlocked:true},{hasBankPending:true},{intakePending:true}]){const f=fixture({overrides});await f.save(event(),'ASSISTED');assert.equal(f.calls.length,0);assert.equal(f.uuidCalls(),0);}
 for(const value of [{...payload(),front:''},{...payload(),selfie:''},{...payload(),backConsent:true,back:''}]){const f=fixture({value});await f.save(event(),'ASSISTED');assert.equal(f.calls.length,0);}
});

test('double clicks and an uncertain dispatched result retain the synchronous lock and original command',async()=>{
 let reject;const pending=new Promise((_resolve,rejectValue)=>{reject=rejectValue;}),f=fixture({dispatch:()=>pending}),first=f.click('Enviar para verificar');await f.click('Solicitar revisión sin comparación facial');assert.equal(f.calls.length,1);assert.equal(f.uuidCalls(),1);assert.equal(f.captureSubmitting.current,true);
 reject(Object.assign(new Error('Synthetic uncertain dispatch'),{retainAttempt:true,status:409,requestDispatched:true}));await first;assert.equal(f.captureSubmitting.current,true);await f.click('Enviar para verificar');assert.equal(f.calls.length,1);assert.equal(f.attempts.length,1);assert.equal(f.attempts[0].biometricMode,'ASSISTED');
});

test('a definitive pre-dispatch rejection may unlock the presentation, and presentation choices replace radios',async()=>{
 const f=fixture({dispatch:async()=>{throw Object.assign(new Error('Synthetic definite input rejection'),{status:400,requestDispatched:false});}});await f.click('Enviar para verificar');assert.equal(f.captureSubmitting.current,false);assert.equal(f.attempts.at(-1),null);
 let radios=0,ocr=0,presentationChecks=0;walk(captureAst,node=>{if(node.type!=='JSXOpeningElement'||node.name.name!=='input')return;const type=node.attributes.find(row=>row.name?.name==='type')?.value?.value;if(type==='radio')radios++;const checked=node.attributes.find(row=>row.name?.name==='checked')?.value?.expression;if(checked){const text=captureSource.slice(checked.start,checked.end);if(text.includes('ocrConsent'))ocr++;if(text==='value.consent')presentationChecks++;}});assert.equal(radios,0);assert.equal(presentationChecks,0);assert.equal(ocr,1);
});

test('a confirmed receipt unlocks only after the required prior manual closure is confirmed',async()=>{
 for(const manualClosed of [false,true]){
  const captureSubmitting={current:true},ports={outcome:()=>{},closeFacialManualReference:async()=>manualClosed,setReceipt:()=>{},setRetryAllowed:()=>{},setNotice:()=>{},captureSubmitting,setFacialRecovery:()=>{},sequence:{current:1},PARTICIPANT_OFFICE_ASSIGN_ACTION:'ASSIGN_OFFICE_ACCOUNT',invalidateAccountSelection:()=>{},setAccessBlocked:()=>{},setAttempt:()=>{},setRecoveryRecord:()=>{},setDraft:()=>{},setData:()=>{},setChatChallenge:()=>{},setAccountGeneration:()=>{},projectId:'project_fixture',scope:'a'.repeat(64),data:null,api:async()=>({scope:'a'.repeat(64),records:[]}),scoped:value=>value,alive:{current:true},hideUnavailableFocus:()=>false,hideDenied:()=>false};
  const confirm=Function(...Object.keys(ports),'return ('+panelSource.slice(confirmNode.start,confirmNode.end)+');')(...Object.values(ports));await confirm({receiptId:'synthetic-confirmed-receipt'},{front:'synthetic-front',selfie:'synthetic-selfie',biometricManualFromOperationId:'old-operation'});assert.equal(captureSubmitting.current,!manualClosed);
 }
});
