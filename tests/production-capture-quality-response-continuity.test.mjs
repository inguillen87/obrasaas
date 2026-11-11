import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {parse} from '@babel/parser';
import {createWorkspaceRecoveryJournal,wasCaptureQualityRejected} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';
import {createWorkspaceRequestLifecycle} from '../src/app/(identity)/cuenta/workspace-request-lifecycle.mjs';
import {PARTICIPANT_OFFICE_ASSIGN_ACTION,participantOfficePrecommitRejected} from '../src/app/(identity)/cuenta/participant-office-account-view.mjs';
import {captureQualityFeedback,captureQualityRejection} from '../src/lib/capture-quality-policy.mjs';
import {PARTICIPANT_AUTO_OCR_NOTICE_VERSION,PARTICIPANT_PRECOMMIT_BIOMETRIC_NOTICE_VERSION,PARTICIPANT_PRECOMMIT_BIOMETRIC_NOTICE} from '../src/lib/participant-analysis-consent.mjs';
import {realUiHelpers,realDeclaration} from './fixtures/participant-facial-consumer-source.mjs';
import {participantDocumentBackNotice} from '../src/app/(identity)/cuenta/participant-onboarding-next-step.mjs';
import {PARTICIPANT_NOTICE,PARTICIPANT_NOTICE_VERSION,PARTICIPANT_DOCUMENT_BACK_NOTICE,PARTICIPANT_DOCUMENT_BACK_NOTICE_VERSION,PARTICIPANT_DOCUMENT_BACK_NOTICE_SHA256} from '../src/lib/participant-policy.mjs';

// Execute the actual hook's request consumer without React/DOM or a server.
// Only its React hook adapter is replaced; the consumer body, transport,
// journal, HTTP-envelope checks and rejection capability remain real source.
const source=readFileSync(new URL('../src/app/(identity)/cuenta/participant-panel.js',import.meta.url),'utf8');
const tree=parse(source,{sourceType:'module',plugins:['jsx']});
const hookNodes=tree.program.body.filter(node=>node.type==='FunctionDeclaration'&&node.id.name==='useParticipantRequest');
assert.equal(hookNodes.length,1);
function expression(name){
 const rows=tree.program.body.filter(node=>node.type==='VariableDeclaration').flatMap(node=>node.declarations).filter(node=>node.id.type==='Identifier'&&node.id.name===name);
 assert.equal(rows.length,1,name);return source.slice(rows[0].init.start,rows[0].init.end);
}
const compile=new Function('useWorkspaceRequest','captureQualityFeedback','captureQualityRejection','wasCaptureQualityRejected','PARTICIPANT_OFFICE_ASSIGN_ACTION','participantOfficePrecommitRejected',
 `const endpoint=${expression('endpoint')};const errors=${expression('errors')};const accessDenied=${expression('accessDenied')};\n${source.slice(hookNodes[0].start,hookNodes[0].end)}\nreturn useParticipantRequest;`);
const endpoint='/api/identity/participants',scope='a'.repeat(64),operationId='01234567-89ab-4cde-8fab-0123456789ab',nextOperationId='01234567-89ab-4cde-8fab-0123456789ac';
const portraitCode='PARTICIPANT_CAPTURE_DOCUMENT_FRONT_DOCUMENT_PORTRAIT_UNCONFIRMED';
const unavailableCode='PARTICIPANT_CAPTURE_SELFIE_QUALITY_SERVICE_UNAVAILABLE';
const options=(extra={})=>({method:'POST',body:JSON.stringify({operationId,projectId:'quality-project',scope,workerId:'quality-worker',revision:'2026-10-22T12:00:00.000001',noticeVersion:'participant-kyc-v1',consent:true,front:'data:image/png;base64,c3ludGhldGljLWZyb250',selfie:'data:image/png;base64,c3ludGhldGljLXNlbGZpZQ==',...extra})});
const response=(code=portraitCode,status=422)=>Response.json({saved:false,identityCertified:false,code},{status});
function storage(){const rows=new Map();return{rows,get length(){return rows.size;},key:index=>[...rows.keys()][index]??null,getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key)};}
function harness({store=storage(),fetchImpl=async()=>response(),afterObservation}={}){
 const journal=createWorkspaceRecoveryJournal({getStorage:()=>store,now:()=>123456});
 const port=afterObservation?{...journal,captureResponse:async(...args)=>{await journal.captureResponse(...args);await afterObservation(args);}}:journal;
 const runtime=createWorkspaceRequestLifecycle(async()=>'synthetic-session',{journal:port,fetchImpl});
 const buildParticipantRequest=compile(()=>runtime.request,captureQualityFeedback,captureQualityRejection,wasCaptureQualityRejected,PARTICIPANT_OFFICE_ASSIGN_ACTION,participantOfficePrecommitRejected);
 return{store,journal,runtime,api:buildParticipantRequest(async()=>'synthetic-session')};
}
async function requestError(h,command){let caught;try{await h.api(null,command);}catch(error){caught=error;}assert.ok(caught,'The actual request consumer must reject this HTTP outcome');return caught;}
function uncertain(error){assert.equal(error.code,'PARTICIPANT_OPERATION_UNCONFIRMED');assert.equal(error.retainAttempt,true);assert.doesNotMatch(error.message,/todavía no se guardó|Revisá el|foto del rostro|Revisá la selfie/);}
async function retained(h,error,command){
 uncertain(error);assert.equal((await h.journal.list(scope)).filter(row=>row.resource==='participants').length,1);
 assert.equal(await wasCaptureQualityRejected(error,endpoint,command),false);
 await assert.rejects(h.journal.prepare(endpoint,options({operationId:nextOperationId})),{code:'WORKSPACE_RECOVERY_REQUIRED'});
 const persisted=JSON.stringify([...h.store.rows]);for(const value of ['quality-worker','front','selfie','c3ludGhldGlj','inputDigest','synthetic-session'])assert.equal(persisted.includes(value),false,value);
}

test('real participant request releases observed 422/503 captures and retains the prior 400 validation behavior',async()=>{
 for(const [status,code]of [[422,portraitCode],[503,unavailableCode]]){
  const h=harness({fetchImpl:async()=>response(code,status)}),command=options(),before=command.body;
  const history=await h.journal.prepare('/api/identity/field-media',{method:'POST',body:JSON.stringify({operationId:nextOperationId,scope,projectId:'history-project'})});
  try{
   const error=await requestError(h,command);assert.equal(error.status,status);assert.equal(error.code,code);assert.notEqual(error.retainAttempt,true);assert.equal(error.message,captureQualityFeedback(code).message);
   assert.equal(await wasCaptureQualityRejected(error,endpoint,command),true);assert.equal(await wasCaptureQualityRejected({...error},endpoint,command),false);assert.equal(await wasCaptureQualityRejected(error,endpoint,options({front:'different-current-image'})),false);
   assert.deepEqual(await h.journal.list(scope),[history.entry]);assert.equal(command.body,before);
   const corrected=await h.journal.prepare(endpoint,options({operationId:nextOperationId,front:'corrected-local-image'}));assert.equal(corrected.existed,false);
  }finally{h.runtime.abort();}
 }
 const h=harness({fetchImpl:async()=>Response.json({code:'PARTICIPANT_PRIVACY_REQUIRED'},{status:400})}),command=options();
 try{const error=await requestError(h,command);assert.equal(error.status,400);assert.equal(error.code,'PARTICIPANT_PRIVACY_REQUIRED');assert.notEqual(error.retainAttempt,true);assert.equal(await wasCaptureQualityRejected(error,endpoint,command),false);assert.equal((await h.journal.list(scope)).length,0);}finally{h.runtime.abort();}
});

test('real consumer retains RAM and durable recovery for MIME size kind or envelope failures without false unsaved copy',async()=>{
 for(const mode of ['wrong-mime','oversized','foreign-kind','unknown-reason','code-only','extra-field','saved-true','wrong-status','empty-json','null-json','malformed-json','html','unrelated-code']){
  const code=mode==='foreign-kind'?'PARTICIPANT_CAPTURE_DOCUMENT_BACK_DOCUMENT_PORTRAIT_UNCONFIRMED':mode==='unknown-reason'?'PARTICIPANT_CAPTURE_DOCUMENT_FRONT_UNKNOWN_REASON':mode==='unrelated-code'?'UNRECOGNIZED_DENIAL':portraitCode;
  const body=mode==='empty-json'?{}:mode==='null-json'?null:mode==='code-only'?{code}:{saved:mode==='saved-true',identityCertified:false,code,...(mode==='extra-field'?{receiptId:'not-a-precommit-envelope'}:{})};
  const bytes=mode==='malformed-json'?'{"saved":':mode==='html'?'<html>Unconfirmed response</html>':(mode==='oversized'?' '.repeat(4097):'')+JSON.stringify(body);
  const h=harness({fetchImpl:async()=>new Response(bytes,{status:mode==='wrong-status'?409:422,headers:{'content-type':['wrong-mime','html'].includes(mode)?'text/html':'application/json'}})}),command=options();
  try{await retained(h,await requestError(h,command),command);}finally{h.runtime.abort();}
 }
});

test('an observed rejection cannot release a changed command or claim cleanup when durable removal fails',async()=>{
 for(const mode of ['operation-id','image-bytes','consent','remove-failed']){
  const h=harness({afterObservation:async args=>{
   if(mode==='remove-failed'){h.store.removeItem=()=>{throw Error('Controlled durable cleanup failure');};return;}
   const command=JSON.parse(args[2].body);if(mode==='operation-id')command.operationId=nextOperationId;if(mode==='image-bytes')command.front='changed-after-observed-response';if(mode==='consent')command.consent=false;args[2].body=JSON.stringify(command);
  }}),command=options();
  try{await retained(h,await requestError(h,command),command);}finally{h.runtime.abort();}
 }
});

test('a prior lost response survives a later valid retake in the same journal and after reload',async()=>{
 for(const reload of [false,true]){
  let loseResponse=true;
  let h=harness({fetchImpl:async()=>{if(loseResponse)throw new TypeError('Controlled lost HTTP confirmation');return response();}});
  const command=options();
  try{
   const first=await requestError(h,command);assert.ok(first instanceof TypeError);assert.equal((await h.journal.list(scope)).length,1);loseResponse=false;
   if(reload){const store=h.store;h.runtime.abort();h=harness({store,fetchImpl:async()=>response()});}
   await retained(h,await requestError(h,command),command);
  }finally{h.runtime.abort();}
 }
});

// These are the actual panel handlers and shared local updater, with React
// setters replaced by synchronous state ports. POST still traverses the real
// hook, HTTP consumer, lifecycle and rejection proof used above.
const uiHelpers={...realUiHelpers(),participantKycSubmitIntent:Function('precommitFacialNotice',realDeclaration('src/app/(identity)/cuenta/participant-kyc-capture.js','participantKycSubmitIntent')+';return participantKycSubmitIntent;')(PARTICIPANT_PRECOMMIT_BIOMETRIC_NOTICE_VERSION)};
function panelHandlerHarness({manual=false,fetchImpl}={}){
 const transport=harness({fetchImpl}),backNotice={version:PARTICIPANT_DOCUMENT_BACK_NOTICE_VERSION,text:PARTICIPANT_DOCUMENT_BACK_NOTICE,sha256:PARTICIPANT_DOCUMENT_BACK_NOTICE_SHA256};
 const payload={...JSON.parse(options().body),back:'data:image/png;base64,c3ludGhldGljLWJhY2s=',backConsent:true,backNoticeVersion:backNotice.version,backNoticeSha256:backNotice.sha256,ocrConsent:false,ocrNoticeVersion:PARTICIPANT_AUTO_OCR_NOTICE_VERSION,biometricNoticeVersion:'participant-private-biometric-v3',biometricMode:'ASSISTED',biometricConsent:true};
 for(const key of ['operationId','projectId','scope'])delete payload[key];
 const original={operationId,projectId:'quality-project',scope,...payload},status={scope,projectId:'quality-project',operationId,state:'FACIAL_PRECOMMIT',saved:false,definitive:false,facial:{phase:'MODEL_UNKNOWN',canContinueManual:true,privateObjectsMayExist:false}};
 const state={draft:{action:'SUBMIT_KYC',captureRetakes:{front:2,back:3,selfie:4},payload:structuredClone(payload)},attempt:manual?original:null,step:2,posts:[],closedReferences:0,successes:0,busy:false};
 const ports={busy:false,accountRequest:{current:{controller:null}},attempt:state.attempt,durableReference:null,recoveryReady:true,draft:state.draft,revisionReview:null,accessBlocked:false,hasBankPending:false,intakePending:null,projectId:'quality-project',scope,endpoint,captureStep:2,captureSubmitting:{current:manual},data:{documentBackNotice:backNotice,privacyNotice:{version:PARTICIPANT_NOTICE_VERSION,text:PARTICIPANT_NOTICE},privateBiometricNotice:{version:PARTICIPANT_PRECOMMIT_BIOMETRIC_NOTICE_VERSION,text:PARTICIPANT_PRECOMMIT_BIOMETRIC_NOTICE}},alive:{current:true},sequence:{current:1},facialRecovery:status,PARTICIPANT_OFFICE_ASSIGN_ACTION,participantOfficePrecommitRejected,captureQualityFeedback,participantDocumentBackNotice,...uiHelpers,crypto:{randomUUID:()=>nextOperationId},setAttempt:value=>{state.attempt=value;},setRetryAllowed:()=>{},setBusy:value=>{state.busy=value;},setNotice:value=>{state.notice=value;},setReceipt:()=>{},setFacialRecovery:()=>{},setDraft:update=>{state.draft=typeof update==='function'?update(state.draft):update;},setCaptureStep:value=>{state.step=value;},hideDenied:()=>false,changedContext:()=>Error('Unexpected context change'),closeFacialManualReference:async()=>{state.closedReferences++;return true;},acceptResult:async()=>{state.successes++;throw Error('A rejected capture cannot succeed');},operationResult:()=>{throw Error('A rejected response cannot be a receipt');},scoped:value=>value,recovered:value=>value,
  api:async(context,request,...rest)=>{if(request?.method==='POST'){state.posts.push(JSON.parse(request.body));return transport.api(context,request,...rest);}return context?.operationId?status:{records:[{id:payload.workerId,revision:payload.revision}]};}};
 const bodies=['retakeCapture','save','continueFacialManual'].map(name=>realDeclaration('src/app/(identity)/cuenta/participant-panel.js',name)).join('\n');
 const handlers=new Function(...Object.keys(ports),bodies+'\nreturn {save,continueFacialManual};')(...Object.values(ports));
 return{state,transport,initial:structuredClone(state.draft),run:()=>manual?handlers.continueFacialManual():handlers.save({preventDefault(){}},'ASSISTED')};
}
for(const manual of [false,true])for(const [kind,field,step]of [['DOCUMENT_FRONT','front',0],['DOCUMENT_BACK','back',1],['SELFIE','selfie',2]])test('real '+(manual?'manual-successor':'save')+' handler invalidates only the observed rejected '+kind+' and keeps reset metadata outside its command',async()=>{
 const h=panelHandlerHarness({manual,fetchImpl:async()=>response('PARTICIPANT_CAPTURE_'+kind+'_IMAGE_BLURRED',422)});
 try{await h.run();assert.equal(h.state.posts.length,1);const command=h.state.posts[0],expected={...command};for(const key of ['operationId','projectId','scope','biometricManualFromOperationId'])delete expected[key];expected[field]='';assert.deepEqual(h.state.draft.payload,expected);assert.deepEqual(h.state.draft.captureRetakes,{...h.initial.captureRetakes,[field]:h.initial.captureRetakes[field]+1});assert.equal(h.state.step,step);assert.equal(h.state.attempt,null);assert.equal(h.state.busy,false);assert.equal(h.state.successes,0);assert.equal(h.state.closedReferences,manual?1:0);assert.equal(Object.hasOwn(command,'captureRetakes'),false);assert.equal(JSON.stringify(command).includes('captureRetakes'),false);for(const other of ['front','back','selfie'].filter(value=>value!==field))assert.equal(h.state.draft.payload[other],h.initial.payload[other]);for(const key of ['consent','backConsent','backNoticeVersion','backNoticeSha256','ocrConsent','biometricNoticeVersion'])assert.equal(h.state.draft.payload[key],h.initial.payload[key]);assert.equal((await h.transport.journal.list(scope)).length,0);}finally{h.transport.runtime.abort();}
});
for(const manual of [false,true])test('real '+(manual?'manual-successor':'save')+' handler keeps every image and preparation key for unavailable unconfirmed or unproven responses',async()=>{
 for(const mode of ['unavailable','unknown','malformed']){const h=panelHandlerHarness({manual,fetchImpl:async()=>mode==='unavailable'?response(unavailableCode,503):mode==='unknown'?Response.json({code:'PARTICIPANT_FACIAL_RESULT_UNCONFIRMED'},{status:503}):Response.json({},{status:422})});try{await h.run();assert.equal(h.state.posts.length,1);assert.equal(h.state.successes,0);assert.deepEqual(h.state.draft.captureRetakes,h.initial.captureRetakes);assert.equal(h.state.step,2);for(const field of ['front','back','selfie'])assert.equal(h.state.draft.payload[field],h.initial.payload[field]);if(mode==='unavailable'){assert.equal(h.state.attempt,null);assert.equal((await h.transport.journal.list(scope)).length,0);}else{assert.ok(h.state.attempt);assert.equal((await h.transport.journal.list(scope)).length,1);assert.equal(h.state.closedReferences,0);}}finally{h.transport.runtime.abort();}}
});
