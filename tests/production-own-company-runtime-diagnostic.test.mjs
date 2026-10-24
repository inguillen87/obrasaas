import test from 'node:test';
import assert from 'node:assert/strict';
import {ownRuntimeDiagnosticFixture,assertDiagnosticNoEffects} from './fixtures/own-runtime-diagnostic.mjs';
import {projectOwnCompanyRuntimeDiagnostic} from '../src/lib/meta-customer-provider.mjs';
import {ownCompanyCapabilityKind,ownCompanyTransportPolicy} from '../src/lib/meta-own-company-policy.mjs';
import {createCompanyChannelHandlers} from '../src/lib/company-channel-http.mjs';
import {createCompanyChannelStore} from '../src/lib/company-channel-store.mjs';
import {WorkspaceError} from '../src/lib/workspace-policy.mjs';

// Additive coverage; existing operational tests and assertions remain unchanged.
const keys=['version','kind','readOnly','canManage','codeVerificationPresent','codeVerificationState','registered','platformState','displayComparable','displayMatchesExpected','observedAt','checkedAt','inspectionState','operationalCheck','denialStage','accepted','roundTrip'].sort();
function assertClosed(result,f){
 assert.deepEqual(Object.keys(result).sort(),keys);
 assert.equal(result.kind,'OWN_COMPANY_RUNTIME_DIAGNOSTIC');assert.equal(result.readOnly,true);assert.equal(result.canManage,false);assert.equal(result.accepted,false);assert.equal(result.roundTrip,'NOT_VERIFIED');
 for(const key of ['codeVerificationPresent','registered','displayComparable','displayMatchesExpected'])assert.equal(typeof result[key],'boolean');
 assert.ok(['VERIFIED','NOT_VERIFIED','EXPIRED','OTHER','MISSING'].includes(result.codeVerificationState));assert.ok(['CLOUD_API','NOT_APPLICABLE','OTHER','MISSING'].includes(result.platformState));
 assert.ok(['PASSED','REJECTED'].includes(result.operationalCheck));assert.ok(['NONE','VERIFICATION_STATUS','DISPLAY_PHONE_MATCH'].includes(result.denialStage));assert.equal(result.inspectionState,'CURRENT');
 for(const key of ['observedAt','checkedAt'])assert.equal(new Date(result[key]).toISOString(),result[key]);
 assert.ok(Object.values(result).every(value=>typeof value!=='function'&&typeof value!=='object'));
 const encoded=JSON.stringify(result);
 for(const privateValue of [f.token,f.connection.encryptedAccessToken,f.policy.phoneNumberId,f.policy.wabaId,f.policy.businessId,f.policy.expectedPhoneE164])assert.ok(!encoded.includes(privateValue));
 assertDiagnosticNoEffects(f);
}

test('diagnostic observes the exact runtime tuple after setup expiry without durable changes or a transport provider',async()=>{
 const f=await ownRuntimeDiagnosticFixture(),before=structuredClone({connection:f.connection,receipt:f.receipt,controls:f.controls});
 for(const key of ['META_OWN_COMPANY_ACCESS_TOKEN','OBRASAAS_META_OWN_COMPANY_POLICY','OBRASAAS_META_OWN_COMPANY_RELEASE'])delete f.environment[key];
 const result=await f.diagnose();assertClosed(result,f);
 assert.equal(result.codeVerificationState,'VERIFIED');assert.equal(result.registered,true);assert.equal(result.platformState,'CLOUD_API');assert.equal(result.displayMatchesExpected,true);assert.equal(result.operationalCheck,'PASSED');assert.equal(result.denialStage,'NONE');
 assert.deepEqual({connection:f.connection,receipt:f.receipt,controls:f.controls},before);
 assert.ok(f.reads.some(({sql})=>/FOR SHARE/.test(sql)));
 assert.equal(result.sendReply,undefined);assert.equal(result.inspect,undefined);assert.equal(result.ownOperationalAuthority,undefined);
});

for(const [name,value,expected] of [['absent',undefined,'MISSING'],['expired literal','EXPIRED','EXPIRED'],['not verified','NOT_VERIFIED','NOT_VERIFIED'],['hostile unknown','provider-private-name-and-token','OTHER']])test('diagnostic safely observes '+name+' while strict runtime remains rejected with zero POST',async t=>{
 t.mock.method(console,'warn',()=>{});
 const f=await ownRuntimeDiagnosticFixture();if(value===undefined)delete f.phone.code_verification_status;else f.phone.code_verification_status=value;
 const result=await f.diagnose();assertClosed(result,f);assert.equal(result.codeVerificationState,expected);assert.equal(result.codeVerificationPresent,value!==undefined);assert.equal(result.operationalCheck,'REJECTED');assert.equal(result.denialStage,'VERIFICATION_STATUS');assert.equal(result.registered,true);
 await assert.rejects(f.provider.forConnection(await f.runtimeInput()),{code:'META_OWN_COMPANY_PHONE_REJECTED'});assertDiagnosticNoEffects(f);
});

test('display equality uses the current exact normalizer without returning the foreign display',async t=>{
 t.mock.method(console,'warn',()=>{});const f=await ownRuntimeDiagnosticFixture();f.phone.display_phone_number='+5491100000001';
 const result=await f.diagnose();assertClosed(result,f);assert.equal(result.displayComparable,true);assert.equal(result.displayMatchesExpected,false);assert.equal(result.denialStage,'DISPLAY_PHONE_MATCH');assert.ok(!JSON.stringify(result).includes(f.phone.display_phone_number));
 await assert.rejects(f.provider.forConnection(await f.runtimeInput()),{code:'META_OWN_COMPANY_PHONE_REJECTED'});assertDiagnosticNoEffects(f);
});

test('a provider error never becomes a private diagnostic witness',async()=>{
 const f=await ownRuntimeDiagnosticFixture();f.state.failRead=f.policy.wabaId+'/phone_numbers';
 await assert.rejects(f.diagnose(),{code:'META_CUSTOMER_PROVIDER_REJECTED'});assertDiagnosticNoEffects(f);
});

test('foreign adapter DTO and staged error cannot substitute for an internal inspection witness',async()=>{
 const f=await ownRuntimeDiagnosticFixture();
 for(const adapter of [{async diagnoseOwnConnection(){return {codeVerificationState:'VERIFIED',registered:true,denialStage:'NONE'};}},{async diagnoseOwnConnection(){throw Object.assign(new WorkspaceError('META_OWN_COMPANY_PHONE_REJECTED',403),{stage:'VERIFICATION_STATUS',projection:{registered:true},raw:'private'});}}]){
  const service=f.makeService(adapter);await assert.rejects(service.diagnoseRuntime(f.session,f.request));
 }
 assert.equal(f.calls.length,0);assertDiagnosticNoEffects(f);
});

for(const [name,revoke] of [['issuer',f=>{f.controls.issuerActive=false;}],['receipt',f=>{f.controls.receiptPresent=false;}],['channel',f=>{f.channelState.mode='SUSPENDED';}],['ciphertext',f=>{f.controls.current={...f.connection,encryptedAccessToken:f.connection.encryptedAccessToken+'x'};}],['session',f=>{f.session.expiresAt=Math.floor(f.time/1000);}]] )test('authority loss after the last provider GET dominates the valid witness: '+name,async()=>{
 const f=await ownRuntimeDiagnosticFixture(),adapter={async diagnoseOwnConnection(input){const witness=await f.provider.diagnoseOwnConnection(input);revoke(f);return witness;}};
 const service=f.makeService(adapter);await assert.rejects(service.diagnoseRuntime(f.session,f.request),{code:'META_OWN_COMPANY_UNAVAILABLE'});assert.ok(f.calls.length>0);assertDiagnosticNoEffects(f);
});

test('authority loss dominates a simultaneous provider error and never returns a partial projection',async()=>{
 const f=await ownRuntimeDiagnosticFixture();f.state.failRead=f.policy.wabaId+'/phone_numbers';
 const service=f.makeService({async diagnoseOwnConnection(input){try{return await f.provider.diagnoseOwnConnection(input);}finally{f.controls.issuerActive=false;}}});
 await assert.rejects(service.diagnoseRuntime(f.session,f.request),{code:'META_OWN_COMPANY_UNAVAILABLE'});assertDiagnosticNoEffects(f);
});

for(const key of ['META_APP_SECRET','META_CUSTOMER_CREDENTIALS_KEY'])test('missing configuration '+key+' produces no observation and no provider GET',async()=>{
 const f=await ownRuntimeDiagnosticFixture();delete f.environment[key];await assert.rejects(f.diagnose());assert.equal(f.calls.length,0);assertDiagnosticNoEffects(f);
});

test('current role, original issuer, anchor, scope and session expiry are required before any provider GET',async()=>{
 for(const mutate of [f=>{f.member.role='DIRECTOR';},f=>{f.member.actorId='another-admin';},f=>{f.session.userId='user_Other';},f=>{f.request.projectId='another-project';},f=>{f.request.scope='b'.repeat(64);},f=>{f.session.expiresAt=Math.floor(f.time/1000);}]){
  const f=await ownRuntimeDiagnosticFixture();mutate(f);await assert.rejects(f.diagnose());assert.equal(f.calls.length,0);assertDiagnosticNoEffects(f);
 }
});

// Each substitution receives its own fresh witness.
for(const [name,alter] of [
 ['copied opaque handle',async(f,input,witness)=>({value:{...witness},context:input})],
 ['different capability object',async(f,input,witness)=>({value:witness,context:{...input,capability:await f.capability()}})],
 ['different token',async(f,input,witness)=>({value:witness,context:{...input,token:'synthetic-different-token-for-negative-only'}})],
 ['copied connection object',async(f,input,witness)=>({value:witness,context:{...input,connection:{...input.connection}}})],
])test('private diagnostic witness rejects '+name+' independently',async()=>{
 const f=await ownRuntimeDiagnosticFixture(),input=await f.runtimeInput(),witness=await f.provider.diagnoseOwnConnection(input);
 const changed=await alter(f,input,witness);
 assert.throws(()=>projectOwnCompanyRuntimeDiagnostic(changed.value,{...changed.context,environment:f.environment,now:f.time}),{code:'META_OWN_COMPANY_UNAVAILABLE'});
 assertDiagnosticNoEffects(f);
});

test('a fresh private diagnostic witness projects a closed DTO once and then rejects replay',async()=>{
 const f=await ownRuntimeDiagnosticFixture(),input=await f.runtimeInput(),witness=await f.provider.diagnoseOwnConnection(input);
 assert.deepEqual(witness,{});assert.equal(Object.getPrototypeOf(witness),Object.prototype);
 const result=projectOwnCompanyRuntimeDiagnostic(witness,{...input,environment:f.environment,now:f.time});
 assertClosed(result,f);assert.equal(result.codeVerificationState,'VERIFIED');assert.equal(result.operationalCheck,'PASSED');
 assert.throws(()=>projectOwnCompanyRuntimeDiagnostic(witness,{...input,environment:f.environment,now:f.time}),{code:'META_OWN_COMPANY_UNAVAILABLE'});
 assertDiagnosticNoEffects(f);
});

test('revocation after the first fake Graph GET prevents every later GET and POST without durable DB writes',async()=>{
 const f=await ownRuntimeDiagnosticFixture();
 f.state.afterRead=path=>{if(f.calls.length===1){assert.equal(path,'debug_token');f.controls.issuerActive=false;}};
 await assert.rejects(f.diagnose(),{code:'META_OWN_COMPANY_UNAVAILABLE'});
 assert.deepEqual(f.calls,[{path:'debug_token',method:'GET'}]);
 assertDiagnosticNoEffects(f);
});

test('expiry of the original 60-second lease between result and final fence cannot be renewed by a new capability',async()=>{
 const f=await ownRuntimeDiagnosticFixture();let originalCapability,newCapability;
 const service=f.makeService({async diagnoseOwnConnection(input){
  originalCapability=input.capability;
  const witness=await f.provider.diagnoseOwnConnection(input);
  f.time+=60001;
  // A fresh canonical resolver can still mint its own bounded request lease.
  // It must not substitute for the captured lease of the in-flight request.
  newCapability=await f.capability();
  return witness;
 }});
 await assert.rejects(service.diagnoseRuntime(f.session,f.request),{code:'META_OWN_COMPANY_UNAVAILABLE'});
 assert.equal(ownCompanyCapabilityKind(newCapability),'RUNTIME');
 assert.notEqual(newCapability,originalCapability);
 assert.doesNotThrow(()=>ownCompanyTransportPolicy(newCapability,f.environment,f.time));
 assert.throws(()=>ownCompanyTransportPolicy(originalCapability,f.environment,f.time),{code:'META_OWN_COMPANY_UNAVAILABLE'});
 assertDiagnosticNoEffects(f);
});

test('non-phone provider denials are not silently upgraded to diagnostic success',async()=>{
 const f=await ownRuntimeDiagnosticFixture();f.state.subscribed=false;
 await assert.rejects(f.diagnose(),{code:'META_OWN_COMPANY_OWNER_UNVERIFIED'});assertDiagnosticNoEffects(f);
});

test('the existing GET exposes only narrow discovery with sanitized failures, no-store and unchanged cross-site rejection',async()=>{
 const f=await ownRuntimeDiagnosticFixture(),store=createCompanyChannelStore({workspace:{},ownConnection:f.service,environment:f.environment}),handlers=createCompanyChannelHandlers({verify:async()=>f.session,store});
 const base='https://obrasaas.com/api/identity/company-channel?'+new URLSearchParams({...f.request,discovery:'OWN_RUNTIME_DIAGNOSTIC'});
 const success=await handlers.GET(new Request(base));assert.equal(success.status,200);assert.match(success.headers.get('cache-control'),/private, no-store/);assertClosed(await success.json(),f);
 for(const url of [base+'&discovery=OWN_RUNTIME_DIAGNOSTIC',base+'&operationId=11111111-1111-4111-8111-111111111111',base+'&stage=VERIFICATION_STATUS'])assert.equal((await handlers.GET(new Request(url))).status,400);
 assert.equal((await handlers.GET(new Request(base,{headers:{'sec-fetch-site':'cross-site'}}))).status,403);
 f.state.failRead='debug_token';const denied=await handlers.GET(new Request(base));assert.notEqual(denied.status,200);assert.deepEqual(Object.keys(await denied.json()).sort(),['code','saved']);assertDiagnosticNoEffects(f);
});
