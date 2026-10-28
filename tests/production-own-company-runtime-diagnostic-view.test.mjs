import test from 'node:test';
import assert from 'node:assert/strict';
import {ownCompanyRuntimeDiagnostic,ownCompanyRuntimeDiagnosticContext,ownCompanyRuntimeDiagnosticCurrent,ownCompanyRuntimeDiagnosticAvailable,ownCompanyRuntimeDiagnosticExplain,ownCompanyRuntimeDiagnosticLabels} from '../src/app/(identity)/cuenta/own-company-runtime-diagnostic-view.mjs';
import {ownCompanyNumberCanAct,ownCompanyNumberCommand} from '../src/app/(identity)/cuenta/own-company-number-view.mjs';
import {createWorkspaceRequestLifecycle} from '../src/app/(identity)/cuenta/workspace-request-lifecycle.mjs';

const time=Date.parse('2026-10-24T12:00:00.000Z'),scope='a'.repeat(64),expected={scope,projectId:'project-a',organizationId:'org_Test',actorId:'user_AdminA'};
const snapshot=()=>({version:1,kind:'OWN_COMPANY_STORED_RUNTIME',organization:{id:expected.organizationId,name:'Empresa sintética'},actor:{id:expected.actorId,role:'ADMIN'},scope,projectId:expected.projectId,readOnly:true,canManage:false,mode:'OWN_COMPANY',evidenceOrigin:'STORED_CANONICAL_RUNTIME',observedAt:new Date(time).toISOString(),configurationAuthorization:{state:'NOT_CURRENT'},channel:{id:'own-channel',anchorProjectId:expected.projectId,revision:4,mode:'COMPANY',displayPhoneNumber:'+5491100009999',connectionStatus:'CONNECTED',enabled:true},operationalGrant:{version:2,state:'ACTIVE',credentialExpiresAt:new Date(time+3600000).toISOString(),roundTrip:'NOT_VERIFIED',fieldJourney:'NOT_VERIFIED'},accepted:false,roundTrip:'NOT_VERIFIED'});
const result=()=>({version:1,kind:'OWN_COMPANY_RUNTIME_DIAGNOSTIC',readOnly:true,canManage:false,codeVerificationPresent:true,codeVerificationState:'VERIFIED',registered:true,platformState:'CLOUD_API',displayComparable:true,displayMatchesExpected:true,observedAt:new Date(time).toISOString(),checkedAt:new Date(time+1000).toISOString(),inspectionState:'CURRENT',operationalCheck:'PASSED',denialStage:'NONE',accepted:false,roundTrip:'NOT_VERIFIED'});
const context=(patch={})=>ownCompanyRuntimeDiagnosticContext(snapshot(),expected,{sequence:1,now:time,...patch});

test('client accepts a closed diagnostic observation without granting any setup action',()=>{
 const value=result(),projection=ownCompanyRuntimeDiagnostic(value);assert.deepEqual(projection,value);assert.notEqual(projection,value);assert.equal(Object.isFrozen(projection),true);
 for(const action of ['CONNECT_OWN_NUMBER','ACTIVATE_OWN_NUMBER']){assert.equal(ownCompanyNumberCanAct(projection,action,time),false);assert.throws(()=>ownCompanyNumberCommand(projection,{action},expected,{now:time}));}
 assert.equal(snapshot().canManage,false);assert.equal(ownCompanyRuntimeDiagnosticAvailable(snapshot(),expected,time),true);
});

for(const state of ['NOT_VERIFIED','EXPIRED','OTHER','MISSING'])test('client preserves '+state+' as an observed rejected state without implying credential expiry or activation',()=>{
 const value={...result(),codeVerificationPresent:state!=='MISSING',codeVerificationState:state,operationalCheck:'REJECTED',denialStage:'VERIFICATION_STATUS'};
 const projection=ownCompanyRuntimeDiagnostic(value),labels=ownCompanyRuntimeDiagnosticLabels(projection);
 assert.equal(projection.codeVerificationState,state);assert.equal(projection.registered,true);assert.equal(labels.summary,'Meta requiere revisión');assert.doesNotMatch(JSON.stringify(labels),/credencial vencida|autorizado|activado|token|EXPIRED/);
 assert.equal(ownCompanyNumberCanAct(projection,'ACTIVATE_OWN_NUMBER',time),false);
});

test('client permits an observed display mismatch while keeping the actual display absent',()=>{
 const projection=ownCompanyRuntimeDiagnostic({...result(),displayMatchesExpected:false,operationalCheck:'REJECTED',denialStage:'DISPLAY_PHONE_MATCH'});
 assert.equal(ownCompanyRuntimeDiagnosticLabels(projection).number,'No se pudo confirmar la coincidencia');assert.equal(Object.hasOwn(projection,'displayPhoneNumber'),false);
});

test('client reports an expired ownership code and completed registered transport check without authorizing setup or claiming delivery',()=>{
 const projection=ownCompanyRuntimeDiagnostic({...result(),codeVerificationState:'EXPIRED'}),labels=ownCompanyRuntimeDiagnosticLabels(projection);
 assert.equal(labels.verification,'Código de verificación vencido');assert.equal(labels.registration,'Registro informado por Meta');assert.equal(labels.summary,'Consulta completada');assert.equal(projection.accepted,false);assert.equal(projection.roundTrip,'NOT_VERIFIED');assert.equal(projection.canManage,false);
 assert.doesNotMatch(JSON.stringify(labels),/credencial vencida|autorizado|activado|entregado|EXPIRED/);
 for(const action of ['CONNECT_OWN_NUMBER','ACTIVATE_OWN_NUMBER']){assert.equal(ownCompanyNumberCanAct(projection,action,time),false);assert.throws(()=>ownCompanyNumberCommand(projection,{action},expected,{now:time}));}
 for(const patch of [{registered:false},{platformState:'NOT_APPLICABLE'},{displayMatchesExpected:false},{codeVerificationPresent:false},{codeVerificationState:'NOT_VERIFIED'},{codeVerificationState:'OTHER'},{codeVerificationState:'MISSING',codeVerificationPresent:false}])assert.throws(()=>ownCompanyRuntimeDiagnostic({...result(),codeVerificationState:'EXPIRED',...patch}));
});

test('client preserves a rejected expired display mismatch only for the observed registered Cloud tuple',()=>{
 const value={...result(),codeVerificationState:'EXPIRED',operationalCheck:'REJECTED',denialStage:'DISPLAY_PHONE_MATCH',displayMatchesExpected:false};
 assert.equal(ownCompanyRuntimeDiagnostic(value).displayMatchesExpected,false);
 for(const patch of [{registered:false},{platformState:'NOT_APPLICABLE'},{displayMatchesExpected:true}])assert.throws(()=>ownCompanyRuntimeDiagnostic({...value,...patch}));
});

test('client rejects unknown, private, writable, accepted or internally contradictory diagnostic fields',()=>{
 for(const patch of [{token:'private'},{displayPhoneNumber:'+5491100000001'},{phoneNumberId:'220000001'},{rawError:{stage:'VERIFICATION_STATUS'}},{grantDigest:'b'.repeat(64)},{canManage:true},{readOnly:false},{accepted:true},{roundTrip:'VERIFIED'},{inspectionState:'STALE'},{denialStage:'INSPECTION_SUPERSEDED'},{codeVerificationState:'NEW_PROVIDER_VALUE'},{platformState:'NEW_PLATFORM'},{registered:'true'},{codeVerificationPresent:false},{displayComparable:false},{platformState:'MISSING'},{operationalCheck:'REJECTED'},{denialStage:'VERIFICATION_STATUS'}])assert.throws(()=>ownCompanyRuntimeDiagnostic({...result(),...patch}),{code:'META_OWN_COMPANY_DIAGNOSTIC_UNCONFIRMED'});
 assert.throws(()=>ownCompanyRuntimeDiagnostic({...result(),codeVerificationPresent:false,codeVerificationState:'MISSING',operationalCheck:'REJECTED',denialStage:'DISPLAY_PHONE_MATCH',displayMatchesExpected:false}));
});

test('diagnostic observation dates are canonical, ordered and bounded independently of device timezone',()=>{
 for(const patch of [{observedAt:'2026-10-24T12:00:00Z'},{checkedAt:'never'},{checkedAt:new Date(time-1).toISOString()},{checkedAt:new Date(time+60000).toISOString()}])assert.throws(()=>ownCompanyRuntimeDiagnostic({...result(),...patch}));
 assert.equal(ownCompanyRuntimeDiagnostic(result()).observedAt,new Date(time).toISOString());
});

test('read context requires the current administrator, exact scope/project and active company grant',()=>{
 for(const patch of [{actor:{id:expected.actorId,role:'DIRECTOR'}},{scope:'b'.repeat(64)},{projectId:'project-b'},{channel:{...snapshot().channel,mode:'SUSPENDED'}},{channel:{...snapshot().channel,enabled:false}},{operationalGrant:{...snapshot().operationalGrant,state:'REVOKED'}}])assert.equal(ownCompanyRuntimeDiagnosticAvailable({...snapshot(),...patch},expected,time),false);
 assert.equal(ownCompanyRuntimeDiagnosticAvailable(snapshot(),expected,time+3600000),false);
 assert.throws(()=>ownCompanyRuntimeDiagnosticContext(snapshot(),expected,{sequence:0,now:time}));
});

test('late diagnostic response is rejected after actor, organization, worksite, channel, reference or sequence changes',()=>{
 const captured=context();assert.equal(ownCompanyRuntimeDiagnosticCurrent(captured,context()),true);
 for(const patch of [{scope:'b'.repeat(64)},{projectId:'project-b'},{organizationId:'org_Other'},{actorId:'user_Other'},{connectionId:'other-channel'},{channelRevision:5},{credentialExpiresAt:new Date(time+7200000).toISOString()},{sequence:2},{reference:'a-new-reference'}])assert.equal(ownCompanyRuntimeDiagnosticCurrent(captured,{...captured,...patch}),false);
 assert.equal(ownCompanyRuntimeDiagnosticCurrent(captured,null),false);
 const reference={version:1,resource:'company-channel',scope,projectId:expected.projectId,operationId:'11111111-1111-4111-8111-111111111111',action:'ACTIVATE_OWN_NUMBER',connectionId:'own-channel',createdAt:time};
 assert.equal(ownCompanyRuntimeDiagnosticCurrent(context({reference}),context({reference:{...reference,createdAt:time+1}})),false);
});

test('actual Clerk transport performs one explicit GET and a late body cannot cross the captured context',async()=>{
 let release,dispatched;const started=new Promise(resolve=>{dispatched=resolve;});
 const captured=context(),url='/api/identity/company-channel?'+new URLSearchParams({scope,projectId:expected.projectId,discovery:'OWN_RUNTIME_DIAGNOSTIC'}),calls=[];
 const lifecycle=createWorkspaceRequestLifecycle(async()=>'synthetic-current-clerk-token',{fetchImpl:async(request,options)=>{
  calls.push({request,method:options.method,authorization:options.headers.get('Authorization'),cache:options.cache});dispatched();
  await new Promise(resolve=>{release=resolve;});return Response.json(result());
 }});
 let current=context();const pending=lifecycle.request(url,{method:'GET',requestTimeoutMs:1000},async response=>ownCompanyRuntimeDiagnostic(await response.json())).then(value=>ownCompanyRuntimeDiagnosticCurrent(captured,current)?value:null);
 await started;current={...current,actorId:'user_Other',sequence:2};release();assert.equal(await pending,null);
 assert.deepEqual(calls,[{request:url,method:'GET',authorization:'Bearer synthetic-current-clerk-token',cache:'no-store'}]);lifecycle.abort();
});

test('diagnostic errors use fixed actionable copy and never interpolate raw errors or stage labels',()=>{
 for(const error of [{code:'private-token-and-provider-payload'},{message:'private',stage:'VERIFICATION_STATUS'},{code:'META_OWN_COMPANY_UNAVAILABLE',status:403},{code:'META_OWN_COMPANY_CONFIGURATION_PENDING'},{name:'AbortError'}])assert.doesNotMatch(ownCompanyRuntimeDiagnosticExplain(error),/private|VERIFICATION_STATUS|token|autorización de configuración/);
 assert.match(ownCompanyRuntimeDiagnosticExplain({status:401}),/sesión/);
});
