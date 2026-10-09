import test from 'node:test';
import assert from 'node:assert/strict';
import {customerWhatsAppAccessDenied,customerWhatsAppNextStep,customerWhatsAppNumberModeGuidance,customerWhatsAppPersonalAppGuidance,customerWhatsAppResult} from '../src/app/(identity)/cuenta/customer-whatsapp-view.mjs';
import {WORKSPACE_NUMBER_MODES,WORKSPACE_USE_CASES,tenantWorkspaceFromMetadata} from '../src/lib/whatsapp/tenant-workspace-policy.js';
import {customerWhatsAppReadiness} from '../src/lib/customer-whatsapp-setup.mjs';
import {createWorkspaceRequestLifecycle} from '../src/app/(identity)/cuenta/workspace-request-lifecycle.mjs';
import {createWorkspaceRecoveryJournal,recoveryQuery} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';
const context={scope:'a'.repeat(64),projectId:'project-a'},operationId='01234567-89ab-4cde-8fab-0123456789ab';
const command={...context,operationId,profile:{assistantName:'Asistente privado de ensayo',numberMode:'DEDICATED',initialProjectId:context.projectId,useCases:['FIELD_REPORTS'],expectedRevision:0,confirmOwnership:true}};
const profile=()=>({configured:true,revision:1,assistantName:command.profile.assistantName,numberMode:'DEDICATED',initialProjectId:context.projectId,useCases:['FIELD_REPORTS'],mode:'REVIEW_REQUIRED',ownership:'CUSTOMER',updatedAt:'2026-10-02T00:00:00Z'});
const snapshot=(p=profile(),connection=null)=>({...context,companyName:'Empresa de ensayo',projectName:'Obra de ensayo',profile:p,profileSource:p.configured?'PROJECT':'NONE',connection,options:{numberModes:WORKSPACE_NUMBER_MODES,useCases:WORKSPACE_USE_CASES},readiness:customerWhatsAppReadiness(p,connection)});
const recorded=()=>({...snapshot(),state:'RECORDED',saved:true,savedProfileIsCurrent:true,receipt:{id:'wa_preparation_'+'b'.repeat(64),savedRevision:1}});
const invalid=error=>error.code==='WHATSAPP_PREPARATION_RESPONSE_INVALID'&&error.status===undefined;
test('accepts the actual canonical empty/prepared DTO, without certifying a stored connected record',()=>{
 assert.equal(customerWhatsAppResult(snapshot(tenantWorkspaceFromMetadata(null)),context).profile.configured,false);
 const result=customerWhatsAppResult(snapshot(profile(),{recordPresent:true,displayNumber:null,storedStatus:'CONNECTED',enabled:true}),context);
 assert.equal(result.readiness.operational,false);assert.equal(result.readiness.canLaunchMeta,false);
});
test('rejects a wrong project/scope, foreign prepared profile and incomplete options before acknowledgment',()=>{
 for(const result of [{...snapshot(),scope:'b'.repeat(64)},{...snapshot(),projectId:'other'}])assert.throws(()=>customerWhatsAppResult(result,context),{code:'WORKSPACE_CONTEXT_CHANGED',status:409});
 for(const result of [{...snapshot(),profile:{...profile(),initialProjectId:'other'}},{...snapshot(),options:{}}])assert.throws(()=>customerWhatsAppResult(result,context),invalid);
});
test('rejects forged preparation readiness and malformed revisions',()=>{
 for(const result of [{...snapshot(),readiness:{...snapshot().readiness,operational:true}},{...snapshot(),readiness:{...snapshot().readiness,canLaunchMeta:true}},{...snapshot(),profile:{...profile(),revision:'1'}},{...snapshot(),profile:{...profile(),configured:false}}])assert.throws(()=>customerWhatsAppResult(result,context),invalid);
 const invented=snapshot();invented.readiness.steps.at(-1).state='SAVED';assert.throws(()=>customerWhatsAppResult(invented,context),invalid);
});
test('requires the canonical receipt and exact saved revision for save and recorded status',()=>{
 assert.equal(customerWhatsAppResult(recorded(),context,{kind:'save',command}).receipt.savedRevision,1);
 for(const receipt of [undefined,{id:'arbitrary',savedRevision:1},{id:recorded().receipt.id,savedRevision:0},{id:recorded().receipt.id,savedRevision:2}])assert.throws(()=>customerWhatsAppResult({...recorded(),receipt},context,{kind:'status'}),invalid);
 assert.throws(()=>customerWhatsAppResult({...recorded(),profile:{...profile(),assistantName:'Another preparation'}},context,{kind:'save',command}),invalid);
});
test('a recovered receipt may refer to an older preparation, and never claims it is current',()=>{
 const result={...recorded(),profile:{...profile(),revision:2,assistantName:'New preparation'},savedProfileIsCurrent:false};
 assert.equal(customerWhatsAppResult(result,context,{kind:'status'}).savedProfileIsCurrent,false);
 assert.equal(customerWhatsAppResult(result,context,{kind:'save',command}).profile.revision,2);
 assert.throws(()=>customerWhatsAppResult({...result,savedProfileIsCurrent:true},context,{kind:'status'}),invalid);
});
test('NOT_OBSERVED remains nondefinitive and cannot smuggle a successful receipt',()=>{
 const absent={...snapshot(tenantWorkspaceFromMetadata(null)),state:'NOT_OBSERVED',definitive:false};
 assert.equal(customerWhatsAppResult(absent,context,{kind:'status'}).definitive,false);
 for(const extra of [{definitive:true},{saved:true},{receipt:recorded().receipt},{state:'CONNECTED'}])assert.throws(()=>customerWhatsAppResult({...absent,...extra},context,{kind:'status'}),invalid);
});
test('a malformed dispatched POST and malformed recovery GET preserve the exact reference; valid GET clears without another POST',async()=>{
 const rows=new Map(),storage={get length(){return rows.size;},key:i=>[...rows.keys()][i]??null,getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key)};
 const journal=createWorkspaceRecoveryJournal({getStorage:()=>storage});let posts=0,gets=0,response={...recorded(),projectId:'foreign'};
 const lifecycle=createWorkspaceRequestLifecycle(async()=>'controlled-token',{journal,fetchImpl:async(_url,options)=>{options.method==='POST'?posts++:gets++;return Response.json(response);}});
 const consume=kind=>async result=>customerWhatsAppResult(await result.json(),context,{kind,command});
 let retainedError;
 await lifecycle.request('/api/identity/whatsapp-setup',{method:'POST',body:JSON.stringify(command)},async result=>{try{return customerWhatsAppResult(await result.json(),context,{kind:'save',command});}catch(error){retainedError=error;return undefined;}});
 assert.equal(retainedError.code,'WORKSPACE_CONTEXT_CHANGED');assert.equal(retainedError.status,409);
 const entries=await journal.list(context.scope);assert.equal(entries.length,1);assert.equal(entries[0].operationId,operationId);assert.equal(JSON.stringify([...rows]).includes(command.profile.assistantName),false);assert.equal(JSON.stringify([...rows]).includes('controlled-token'),false);
 response={...recorded(),receipt:{id:'invalid',savedRevision:1}};
 await assert.rejects(lifecycle.request(recoveryQuery(entries[0]),{},consume('status')),invalid);assert.equal((await journal.list(context.scope)).length,1);
 response=recorded();await lifecycle.request(recoveryQuery(entries[0]),{},consume('status'));assert.equal((await journal.list(context.scope)).length,0);assert.equal(posts,1);assert.equal(gets,2);lifecycle.abort();
});
test('next-step copy preserves dedicated, coexistence and existing-provider review without launch approval',()=>{
 const empty=customerWhatsAppNextStep(tenantWorkspaceFromMetadata(null),context.projectId);assert.equal(empty.canConsultMeta,false);
 const dedicated=customerWhatsAppNextStep(profile(),context.projectId);assert.equal(dedicated.canConsultMeta,true);assert.match(dedicated.message,/comprobar la autorización vigente/);assert.doesNotMatch(dedicated.message,/Falta autorizar/);
 const business=customerWhatsAppNextStep({...profile(),numberMode:'BUSINESS_APP'},context.projectId);assert.equal(business.requiresAssistance,false);assert.equal(business.canConsultMeta,true);assert.match(business.message,/Consultá la disponibilidad de coexistencia.*elegibilidad.*conservando tu app/);assert.doesNotMatch(business.message,/coexistencia (disponible|habilitada|rechazada)|necesita (ayuda|asistencia)/);
 const provider=customerWhatsAppNextStep({...profile(),numberMode:'EXISTING_API'},context.projectId);assert.equal(provider.requiresAssistance,true);assert.equal(provider.canConsultMeta,true);assert.match(provider.message,/autorización adicional necesita un plan/);assert.match(provider.message,/no transferimos ni desconectamos tu proveedor actual/);
});

test('number intake keeps personal WhatsApp out of saved modes and protects an existing app or provider',()=>{
 assert.deepEqual(WORKSPACE_NUMBER_MODES.map(mode=>mode.key),['DEDICATED','BUSINESS_APP','EXISTING_API']);
 for(const unknown of ['PERSONAL_APP','',null,'toString'])assert.equal(customerWhatsAppNumberModeGuidance(unknown),null);
 assert.match(customerWhatsAppPersonalAppGuidance,/WhatsApp personal no admite coexistencia/);
 assert.match(customerWhatsAppPersonalAppGuidance,/traslado oficial a WhatsApp Business App.*copia de seguridad/);
 assert.match(customerWhatsAppPersonalAppGuidance,/No desinstales.*ni elimines tu cuenta/);
 const dedicated=customerWhatsAppNumberModeGuidance('DEDICATED');assert.match(dedicated.detail,/Todavía no usa WhatsApp ni un proveedor API/);assert.match(dedicated.detail,/SMS o una llamada/);assert.match(dedicated.next,/sólo para una línea libre/);
 const business=customerWhatsAppNumberModeGuidance('BUSINESS_APP');assert.match(business.detail,/Conservá la app y el número/);assert.match(business.detail,/QR desde la app/);assert.match(business.next,/Meta decide la elegibilidad/);assert.match(business.next,/instalarlo no garantiza/);assert.match(business.next,/SMS para alta dedicada, detenelo/);assert.doesNotMatch(business.next,/\b(7|14|30) días\b/);
 const provider=customerWhatsAppNumberModeGuidance('EXISTING_API');assert.match(provider.next,/Todavía no ejecuta una migración ni una autorización adicional/);assert.match(provider.next,/La conexión actual se conserva/);
});
test('only authentication/authorization/context failures require hiding the private current view',()=>{
 for(const error of [{status:401},{status:403},{code:'WORKSPACE_CONTEXT_CHANGED'},{status:404,code:'WORKSPACE_PROJECT_UNAVAILABLE'},{code:'WORKSPACE_MEMBERSHIP_REQUIRED'}])assert.equal(customerWhatsAppAccessDenied(error),true);
 for(const error of [{status:409,code:'WORKSPACE_CONFLICT'},{status:404,code:'META_CUSTOMER_INBOX_UNAVAILABLE'},{status:503},new Error('Network')])assert.equal(customerWhatsAppAccessDenied(error),false);
});
