import assert from 'node:assert/strict';
import test from 'node:test';
import {companyUsageView} from '../src/app/(identity)/cuenta/company-usage-view.mjs';
import {participantOcrUsageHeld} from '../src/app/(identity)/cuenta/participant-ocr-usage-view.mjs';
import {createParticipantHandlers} from '../src/lib/participant-http.mjs';
import {createFieldMediaHandlers} from '../src/lib/field-operations-http.mjs';
import {WorkspaceError} from '../src/lib/workspace-policy.mjs';

const scope='a'.repeat(64),projectId='project-synthetic',organizationId='company-synthetic',operationId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Synthetic',organizationId:'org_Synthetic',organizationRole:'org:admin'};
const usage={inputTokens:'24',outputTokens:'6',totalTokens:'30',cachedInputTokens:null,reasoningOutputTokens:null};
const receiptId=letter=>'organization_usage_'+letter.repeat(64);
function mixed(){
 const recent=[
  {receiptId:receiptId('b'),state:'OBSERVED',stage:'FIELD_OPENAI_VISION',model:'gpt-4o',usage:{...usage},measurement:{unit:'TOKENS',audioSeconds:null}},
  {receiptId:receiptId('c'),state:'OBSERVED',stage:'FIELD_OPENAI_TRANSCRIPTION',model:null,usage:null,measurement:{unit:'AUDIO_SECONDS',audioSeconds:'0.000001'}},
  {receiptId:receiptId('d'),state:'UNKNOWN',stage:'IDENTITY_OPENAI_OCR',model:null,usage:null,measurement:{unit:'UNMEASURED',audioSeconds:null}},
  {receiptId:receiptId('e'),state:'UNMEASURED',stage:'FIELD_VIDEO_TRANSCRIPTION',model:null,usage:null,measurement:{unit:'UNMEASURED',audioSeconds:null}}
 ].map(row=>({...row,recordedAt:'2026-10-12T11:00:00.000Z',coverageState:'TRIAL_CURRENT'}));
 return {version:2,scope,organization:{id:organizationId,name:'Empresa sintética'},observedAt:'2026-10-12T12:00:00.000Z',capacity:{state:'CONTRACT_PENDING',cost:null},funding:{state:'UNCONFIRMED'},coverage:{state:'TRIAL_CURRENT',startsAt:null,endsAt:'2026-10-20T12:00:00.000Z'},summary:{total:4,reserved:0,pending:1,observed:2,unmeasured:1,inputTokens:'24',outputTokens:'6',totalTokens:'30',audioSeconds:'0.000001'},recent,truncated:false};
}
const view=value=>companyUsageView(value,{scope,organizationId});
const rejected=mutate=>{const value=mixed();mutate(value);assert.throws(()=>view(value),{code:'COMPANY_USAGE_RESULT_UNCONFIRMED'});};

test('v2 mixed token, billable audio, unknown and unmeasured stages preserve their separate meanings',()=>{
 const value=mixed(),original=JSON.stringify(value),result=view(value);assert.equal(JSON.stringify(value),original);assert.equal(result.summary.totalTokens,'30');assert.equal(result.summary.audioSeconds,'0.000001');assert.equal(result.recent[0].usage.totalTokens,'30');assert.equal(result.recent[1].usage,null);assert.equal(result.recent[1].audioSecondsLabel,'0,000001');assert.equal(result.recent[1].stageLabel,'Nota de audio');assert.equal(result.recent[2].state,'UNKNOWN');assert.equal(result.recent[2].usage,null);assert.equal(result.recent[3].state,'UNMEASURED');assert.equal(result.costLabel,'Costo no determinado');assert.equal(result.capacityLabel,'Límites de uso pendientes de aprobación');assert.equal(result.fundingLabel,'Financiación de proveedores sin confirmar');
});

for(const seconds of ['0.000001','999999999999999.999999'])test('audio decimal '+seconds+' remains an exact provider quantity without deriving tokens or cost',()=>{
 const value=mixed();value.summary.audioSeconds=seconds;value.recent[1].measurement.audioSeconds=seconds;const result=view(value);assert.equal(result.summary.audioSeconds,seconds);assert.equal(result.recent[1].measurement.audioSeconds,seconds);assert.equal(result.recent[1].usage,null);assert.equal(result.summary.totalTokens,'30');assert.equal(result.costLabel,'Costo no determinado');assert.equal(result.summary.audioSecondsLabel.replaceAll('.','').replace(',','.'),seconds);
});

test('legacy v1 read remains compatible without invented audio seconds',()=>{
 const value=mixed();value.version=1;delete value.summary.audioSeconds;Object.assign(value.summary,{total:1,pending:0,observed:1,unmeasured:0});value.recent=value.recent.slice(0,1).map(({stage,measurement,...row})=>row);const result=view(value);assert.equal(result.recent[0].stageLabel,'Cronograma');assert.equal(result.summary.audioSecondsLabel,null);assert.equal(result.recent[0].audioSecondsLabel,null);assert.equal(result.summary.totalTokens,'30');
});

test('audio quantities reject coercion, exponent notation, noncanonical decimals and precision overflow',()=>{
 for(const seconds of [1,'01','0.0000001','1e3','1.0','-1','NaN','9'.repeat(16)])rejected(value=>{value.summary.audioSeconds=seconds;});
});

test('forged state, measurement and audio-on-vision variants fail closed',()=>{
 for(const state of ['toString','constructor','CERTIFIED'])rejected(value=>{value.recent[0].state=state;});
 rejected(value=>{value.recent[1].stage='FIELD_OPENAI_VISION';});rejected(value=>{value.recent[1].usage={...usage};});rejected(value=>{value.recent[0].measurement.audioSeconds='1';});rejected(value=>{value.recent[2].measurement={unit:'TOKENS',audioSeconds:null};});rejected(value=>{value.recent[1].measurement.unit='SECONDS_FROM_FILE';});rejected(value=>{value.recent[1].measurement.durationSeconds=1;});
});

test('private extras, prototype stages and commercial claims cannot enter the company read view',()=>{
 for(const stage of ['toString','constructor','__proto__'])rejected(value=>{value.recent[0].stage=stage;});
 rejected(value=>{value.recent[0].prompt='PRIVATE_SOURCE';});rejected(value=>{value.recent[1].transcript='PRIVATE_SOURCE';});rejected(value=>{value.privateMediaUrl='https://private.invalid';});rejected(value=>{value.capacity.cost=0;});rejected(value=>{value.capacity.limit=100;});rejected(value=>{value.funding.state='CONFIRMED';});
});

function command(){return {scope,projectId,operationId,action:'PROCESS_KYC',payload:{workerId:'worker-synthetic',submissionId:'submission-synthetic',revision:'b'.repeat(64)}};}
function held(){return {scope,projectId,operationId,action:'PROCESS_KYC',state:'USAGE_HELD',saved:false,definitive:false,code:'ORGANIZATION_USAGE_RESULT_PENDING',workerId:'worker-synthetic',submissionId:'submission-synthetic',retryAfterExpiration:false,usage:{version:2,receiptId:receiptId('b'),state:'UNKNOWN',coverageState:'TRIAL_CURRENT'}};}
const accepted=(value=held(),operation=command(),context={scope,projectId})=>participantOcrUsageHeld(value,operation,context);

test('current same-operation OCR held state remains unknown and grants no completed receipt or retry',()=>{
 const value=held(),operation=command();assert.equal(accepted(value,operation),true);assert.equal(value.usage.state,'UNKNOWN');assert.equal(value.saved,false);assert.equal(value.definitive,false);assert.equal(value.retryAfterExpiration,false);assert.equal(value.receiptId,undefined);assert.equal(value.identityCertified,undefined);assert.equal(value.participant,undefined);
});

test('held OCR rejects every changed response target and current context',()=>{
 for(const key of ['scope','projectId','operationId','workerId','submissionId','action']){const value=held();value[key]=key==='scope'?'c'.repeat(64):key==='operationId'?'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb':'other-synthetic';assert.equal(accepted(value),false,key);}
 assert.equal(accepted(held(),command(),{scope:'c'.repeat(64),projectId}),false);assert.equal(accepted(held(),command(),{scope,projectId:'other-synthetic'}),false);
});

test('held OCR rejects changed command context, operation, worker, submission and action',()=>{
 for(const key of ['scope','projectId','operationId','action']){const operation=command();operation[key]=key==='scope'?'c'.repeat(64):key==='operationId'?'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb':'other-synthetic';assert.equal(accepted(held(),operation),false,key);}
 for(const key of ['workerId','submissionId']){const operation=command();operation.payload[key]='other-synthetic';assert.equal(accepted(held(),operation),false,key);}
});

test('held OCR cannot accept approval, private output, completed receipts, replay or automatic retry',()=>{
 for(const [key,value] of [['identityCertified',true],['participant',{dni:'PRIVATE'}],['receiptId','participant-receipt'],['receipt',{}],['fields',{dni:'PRIVATE'}],['replayed',true],['retryAfterExpiration',true],['saved',true],['definitive',true],['state','RECORDED'],['code','APPROVED']]){const record=held();record[key]=value;assert.equal(accepted(record),false,key);}
 for(const patch of [{state:'CERTIFIED'},{version:1},{receiptId:'forged'},{coverageState:'READY'},{sourceSha256:'b'.repeat(64)}])assert.equal(accepted({...held(),usage:{...held().usage,...patch}}),false);
});

const participantParams=()=>new URLSearchParams({projectId,scope,detail:'ocr-usage',workerId:'worker-synthetic',submissionId:'submission-synthetic',operationId});
const fieldParams=()=>new URLSearchParams({projectId,scope,operationId,evidenceId:'evidence-synthetic'});
const request=(path,params,options={})=>new Request('https://obrasaas.com/api/identity/'+path+'?'+params.toString(),options);
function participantHttp({verified=session,failStatus=false}={}){
 const calls={verify:0,status:[],other:0},forbidden=async()=>{calls.other++;throw Error('Unexpected mutation or private read');};
 const handlers=createParticipantHandlers({verify:async()=>{calls.verify++;return verified;},store:{status:async(s,input)=>{calls.status.push({session:s,input});if(failStatus)throw new WorkspaceError('WORKSPACE_MEMBERSHIP_REQUIRED',403);return {scope:input.scope,state:'USAGE_HELD'};},read:forbidden,save:forbidden,submitKyc:forbidden,downloadKyc:forbidden,privateBankRead:forbidden,kycChatAttempt:forbidden}});return {handlers,calls};
}

test('dedicated six-parameter OCR GET verifies identity and routes canonical correlation to status once',async()=>{
 const f=participantHttp(),params=participantParams();params.set('operationId',operationId.toUpperCase());const result=await f.handlers.GET(request('participants',params));assert.equal(result.status,200);assert.equal(f.calls.verify,1);assert.equal(f.calls.status.length,1);assert.equal(f.calls.other,0);assert.equal(f.calls.status[0].session,session);assert.deepEqual(f.calls.status[0].input,{projectId,scope,workerId:'worker-synthetic',submissionId:'submission-synthetic',operationId});assert.match(result.headers.get('cache-control'),/private, no-store/);assert.equal(result.headers.get('content-disposition'),null);
});

test('OCR GET rejects duplicate, invalid, unrelated and extra query fields before store access',async()=>{
 const mutations=[p=>p.append('operationId',operationId),p=>p.append('scope',scope),p=>p.set('operationId','invalid'),p=>p.set('workerId','../private'),p=>p.set('submissionId',''),p=>p.delete('workerId'),p=>p.set('detail','existing-accounts'),p=>p.set('detail','private-bank-account'),p=>p.delete('detail'),p=>p.set('imageId','document-front'),p=>p.set('organizationId','other-synthetic'),p=>p.set('after','other-synthetic')];
 for(const mutate of mutations){const f=participantHttp(),params=participantParams();mutate(params);const result=await f.handlers.GET(request('participants',params));assert.equal(result.status,400);assert.equal(f.calls.status.length,0);assert.equal(f.calls.other,0);}
});

test('OCR GET keeps verified-session, current authorization, same-site and method checks',async()=>{
 for(const verified of [{authenticated:false},{...session,verification:'decoded-only'}]){const f=participantHttp({verified}),result=await f.handlers.GET(request('participants',participantParams()));assert.equal(result.status,401);assert.equal(f.calls.status.length,0);}
 const revoked=participantHttp({failStatus:true}),denied=await revoked.handlers.GET(request('participants',participantParams()));assert.equal(denied.status,403);assert.equal((await denied.json()).identityCertified,false);
 const cross=participantHttp(),crossResult=await cross.handlers.GET(request('participants',participantParams(),{headers:{'sec-fetch-site':'cross-site'}}));assert.equal(crossResult.status,403);assert.equal(cross.calls.status.length,0);
 const method=participantHttp(),unsupported=await method.handlers.GET(request('participants',participantParams(),{method:'PUT'}));assert.equal(unsupported.status,405);assert.equal(method.calls.status.length,0);assert.equal(method.calls.other,0);
});

function fieldHttp({verified=session}={}){
 const calls={verify:0,status:[],download:0,mutation:0};const handlers=createFieldMediaHandlers({verify:async()=>{calls.verify++;return verified;},media:{status:async(s,input)=>{calls.status.push({session:s,input});return {scope:input.scope,state:'PROVIDER_PENDING'};},download:async()=>{calls.download++;throw Error('Unexpected private download');},process:async()=>{calls.mutation++;throw Error('Unexpected process');},attach:async()=>{calls.mutation++;throw Error('Unexpected attach');}}});return {handlers,calls};
}

test('combined field-media GET reads correlated status once without download or provider processing',async()=>{
 const f=fieldHttp(),result=await f.handlers.GET(request('field-media',fieldParams()));assert.equal(result.status,200);assert.equal(f.calls.verify,1);assert.equal(f.calls.status.length,1);assert.deepEqual(f.calls.status[0].input,{projectId,scope,operationId,evidenceId:'evidence-synthetic'});assert.equal(f.calls.status[0].session,session);assert.equal(f.calls.download,0);assert.equal(f.calls.mutation,0);assert.match(result.headers.get('cache-control'),/no-store/);assert.equal(result.headers.get('content-disposition'),null);
});

test('combined field-media GET rejects invalid correlation and extra/duplicate parameters before ports',async()=>{
 for(const mutate of [p=>p.set('operationId','invalid'),p=>p.set('evidenceId','../private'),p=>p.set('evidenceId',''),p=>p.append('evidenceId','other-synthetic'),p=>p.append('operationId',operationId),p=>p.set('download','1'),p=>p.set('action','PROCESS_EVIDENCE')]){const f=fieldHttp(),params=fieldParams();mutate(params);const result=await f.handlers.GET(request('field-media',params));assert.equal(result.status,400);assert.equal(f.calls.status.length,0);assert.equal(f.calls.download,0);assert.equal(f.calls.mutation,0);}
});

test('combined field status preserves authentication, cross-site and read-only method boundaries',async()=>{
 const unauth=fieldHttp({verified:{authenticated:false}}),denied=await unauth.handlers.GET(request('field-media',fieldParams()));assert.equal(denied.status,401);assert.equal(unauth.calls.status.length,0);
 const cross=fieldHttp(),crossResult=await cross.handlers.GET(request('field-media',fieldParams(),{headers:{'sec-fetch-site':'cross-site'}}));assert.equal(crossResult.status,403);assert.equal(cross.calls.status.length,0);
 const method=fieldHttp(),unsupported=await method.handlers.GET(request('field-media',fieldParams(),{method:'PUT'}));assert.equal(unsupported.status,405);assert.equal(method.calls.status.length,0);assert.equal(method.calls.download,0);assert.equal(method.calls.mutation,0);
});
