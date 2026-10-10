import test from 'node:test';
import assert from 'node:assert/strict';
import {ownCompanyNumberSnapshot,ownCompanyNumberCanAct,ownCompanyNumberFresh,ownCompanyNumberCommand} from '../src/app/(identity)/cuenta/own-company-number-view.mjs';
const time=Date.parse('2026-10-09T12:00:00.000Z'),expected={scope:'a'.repeat(64),projectId:'project-a',organizationId:'org_Test',actorId:'user_AdminA'};
const snapshot=()=>({organization:{id:expected.organizationId,name:'Empresa sintética'},actor:{id:expected.actorId,role:'ADMIN'},scope:expected.scope,projectId:expected.projectId,readOnly:true,canManage:true,mode:'OWN_COMPANY',companyPhoneRevision:1,wabaId:'230000001',phoneNumberId:'220000001',displayPhoneNumber:'+5491100009999',verifiedBusinessName:'Empresa sintética',registered:true,subscribed:true,expiresAt:new Date(time+3600000).toISOString(),channel:{id:'own-channel',anchorProjectId:expected.projectId,revision:4,mode:'COMPANY',displayPhoneNumber:'+5491100009999',connectionStatus:'CONNECTED',enabled:true},connectionMatchesAssets:true,connectionOwnVerified:true,operationalGrant:{version:2,state:'ACTIVE',credentialExpiresAt:new Date(time+24*3600000).toISOString(),roundTrip:'NOT_VERIFIED',fieldJourney:'NOT_VERIFIED'},accepted:false,roundTrip:'NOT_VERIFIED'});
test('snapshot distinguishes finite operational credential from a setup window without granting a new configuration after expiry',()=>{
 const value=ownCompanyNumberSnapshot(snapshot(),expected);assert.notEqual(value.expiresAt,value.operationalGrant.credentialExpiresAt);assert.equal(ownCompanyNumberFresh(value,time+5*3600000),false);assert.equal(ownCompanyNumberCanAct(value,'ACTIVATE_OWN_NUMBER',time+5*3600000),false);assert.equal(value.operationalGrant.roundTrip,'NOT_VERIFIED');assert.equal(value.operationalGrant.fieldJourney,'NOT_VERIFIED');
});
test('operational snapshot excludes private proofs and refuses claims of acceptance, missing credential expiry or contradictory activation',()=>{
 const value=snapshot();for(const grant of [{...value.operationalGrant,token:'private'},{...value.operationalGrant,grantDigest:'a'.repeat(64)},{...value.operationalGrant,state:'READY'},{...value.operationalGrant,credentialExpiresAt:null},{...value.operationalGrant,credentialExpiresAt:'never'},{...value.operationalGrant,roundTrip:'VERIFIED'},{...value.operationalGrant,fieldJourney:'VERIFIED'}])assert.throws(()=>ownCompanyNumberSnapshot({...value,operationalGrant:grant},expected));
 for(const patch of [{connectionOwnVerified:false},{channel:{...value.channel,enabled:false}},{registered:false},{subscribed:false}])assert.throws(()=>ownCompanyNumberSnapshot({...value,...patch},expected));
});
test('revoked or expired operational states stay visible without authorizing runtime or bypassing a new setup review',()=>{
 const value=snapshot();for(const state of ['REVOKED','EXPIRED','UNAVAILABLE']){const next={...value,connectionOwnVerified:false,channel:{...value.channel,mode:'SUSPENDED',enabled:false},operationalGrant:{...value.operationalGrant,state}};assert.equal(ownCompanyNumberSnapshot(next,expected).operationalGrant.state,state);assert.equal(ownCompanyNumberCanAct(next,'ACTIVATE_OWN_NUMBER',time),false);}
});

const storedSnapshot=()=>({version:1,kind:'OWN_COMPANY_STORED_RUNTIME',organization:{id:expected.organizationId,name:'Empresa sintética'},actor:{id:expected.actorId,role:'ADMIN'},scope:expected.scope,projectId:expected.projectId,readOnly:true,canManage:false,mode:'OWN_COMPANY',evidenceOrigin:'STORED_CANONICAL_RUNTIME',observedAt:new Date(time).toISOString(),configurationAuthorization:{state:'NOT_CURRENT'},channel:{id:'own-channel',anchorProjectId:expected.projectId,revision:4,mode:'COMPANY',displayPhoneNumber:'+5491100009999',connectionStatus:'CONNECTED',enabled:true},operationalGrant:{version:2,state:'ACTIVE',credentialExpiresAt:new Date(time+18*3600000).toISOString(),roundTrip:'NOT_VERIFIED',fieldJourney:'NOT_VERIFIED'},accepted:false,roundTrip:'NOT_VERIFIED'});

test('stored runtime is an explicit read-only snapshot with no live setup fields or acceptance claim',()=>{
 const value=storedSnapshot();assert.deepEqual(ownCompanyNumberSnapshot(value,expected),value);
 for(const key of ['expiresAt','wabaId','phoneNumberId','companyPhoneRevision','verifiedBusinessName','registered','subscribed','connectionOwnVerified'])assert.equal(Object.hasOwn(value,key),false);
 assert.equal(value.evidenceOrigin,'STORED_CANONICAL_RUNTIME');assert.equal(value.configurationAuthorization.state,'NOT_CURRENT');assert.equal(value.accepted,false);
});

test('stored runtime never enables configuration, including a clock moved before its observation or credential expiry',()=>{
 const value=ownCompanyNumberSnapshot(storedSnapshot(),expected);
 for(const clock of [0,time-1,time,time+1,Date.parse(value.operationalGrant.credentialExpiresAt),time+30*3600000]){
  assert.equal(ownCompanyNumberFresh(value,clock),false);
  for(const action of ['CONNECT_OWN_NUMBER','ACTIVATE_OWN_NUMBER']){
   assert.equal(ownCompanyNumberCanAct(value,action,clock),false);
   assert.throws(()=>ownCompanyNumberCommand(value,{action,connectionId:value.channel.id,revision:value.channel.revision,companyPhoneRevision:1,confirmOwnBusiness:true,confirmReplacement:false},expected,{now:clock}),error=>error.code==='META_OWN_COMPANY_REVISION_CHANGED'&&error.requestDispatched===false);
  }
 }
});

test('stored kind remains non-actionable if a caller bypasses validation and mixes in setup authority',()=>{
 const stored=storedSnapshot(),forged={...snapshot(),...stored,canManage:true,expiresAt:new Date(time+100*3600000).toISOString(),registered:true,subscribed:true,connectionMatchesAssets:true,connectionOwnVerified:true,channel:{...stored.channel,mode:'PREPARED',enabled:false,connectionStatus:'PENDING'}};
 assert.equal(ownCompanyNumberFresh(forged,time-1),false);assert.equal(ownCompanyNumberCanAct(forged,'ACTIVATE_OWN_NUMBER',time-1),false);assert.equal(ownCompanyNumberCanAct(forged,'CONNECT_OWN_NUMBER',time-1),false);
 assert.throws(()=>ownCompanyNumberCommand(forged,{action:'ACTIVATE_OWN_NUMBER'},expected,{now:time-1}));
});

for(const [name,mutate] of [
 ['top-level token',value=>value.token='private'],
 ['ciphertext',value=>value.encryptedAccessToken='v2.private'],
 ['policy proof',value=>value.policyDigest='a'.repeat(64)],
 ['deployment SHA',value=>value.sourceHead='a'.repeat(40)],
 ['provider inspection',value=>value.customerVerification={registered:true}],
 ['setup authorization window',value=>value.expiresAt=new Date(time+3600000).toISOString()],
 ['organization secret',value=>value.organization.token='private'],
 ['actor role alias',value=>value.actor.canonicalRole='ADMIN'],
 ['channel metadata',value=>value.channel.metadata={ownCompanyRuntime:{}}],
 ['runtime digest',value=>value.operationalGrant.grantDigest='a'.repeat(64)],
 ['runtime token',value=>value.operationalGrant.token='private'],
 ['configuration policy',value=>value.configurationAuthorization.policyDigest='a'.repeat(64)],
])test('stored runtime snapshot rejects extra '+name,()=>{
 const value=storedSnapshot();mutate(value);assert.throws(()=>ownCompanyNumberSnapshot(value,expected),{code:'META_OWN_COMPANY_RESULT_UNCONFIRMED'});
});

for(const [name,patch] of [
 ['wrong version',{version:2}],['wrong kind',{kind:'OWN_COMPANY_PROVIDER_RUNTIME'}],['writable projection',{readOnly:false}],['configuration permission',{canManage:true}],['foreign mode',{mode:'DEVELOPMENT_PILOT'}],['live-provider origin',{evidenceOrigin:'PROVIDER'}],['accepted channel',{accepted:true}],['verified conversation',{roundTrip:'VERIFIED'}],['invalid observation',{observedAt:'never'}],['non-canonical observation',{observedAt:'2026-10-09T12:00:00Z'}],['missing channel',{channel:null}],['current configuration authorization',{configurationAuthorization:{state:'CURRENT'}}],
])test('stored runtime snapshot rejects '+name,()=>{
 assert.throws(()=>ownCompanyNumberSnapshot({...storedSnapshot(),...patch},expected),{code:'META_OWN_COMPANY_RESULT_UNCONFIRMED'});
});

for(const [name,patch] of [
 ['disabled channel',{enabled:false}],['pending connection',{connectionStatus:'PENDING'}],['suspended channel',{mode:'SUSPENDED'}],['prepared channel',{mode:'PREPARED'}],['missing phone',{displayPhoneNumber:null}],
])test('stored runtime snapshot rejects contradictory '+name,()=>{
 const value=storedSnapshot();assert.throws(()=>ownCompanyNumberSnapshot({...value,channel:{...value.channel,...patch}},expected),{code:'META_OWN_COMPANY_RESULT_UNCONFIRMED'});
});

for(const [name,patch] of [
 ['legacy grant',{version:1}],['revoked grant',{state:'REVOKED'}],['expired grant',{state:'EXPIRED'}],['unavailable grant',{state:'UNAVAILABLE'}],['indefinite credential',{credentialExpiresAt:null}],['malformed expiry',{credentialExpiresAt:'never'}],['non-canonical expiry',{credentialExpiresAt:'2026-10-10T06:00:00Z'}],['expiry at observation',{credentialExpiresAt:new Date(time).toISOString()}],['expiry before observation',{credentialExpiresAt:new Date(time-1).toISOString()}],['verified round trip',{roundTrip:'VERIFIED'}],['verified field journey',{fieldJourney:'VERIFIED'}],
])test('stored runtime snapshot rejects '+name,()=>{
 const value=storedSnapshot();assert.throws(()=>ownCompanyNumberSnapshot({...value,operationalGrant:{...value.operationalGrant,...patch}},expected),{code:'META_OWN_COMPANY_RESULT_UNCONFIRMED'});
});

test('stored runtime snapshot rejects other scope, project, organization, actor and channel anchors',()=>{
 const value=storedSnapshot();
 for(const patch of [{scope:'b'.repeat(64)},{projectId:'project-b'},{organization:{...value.organization,id:'org_Other'}},{actor:{...value.actor,id:'user_Other'}}])assert.throws(()=>ownCompanyNumberSnapshot({...value,...patch},expected),{code:'WORKSPACE_CONTEXT_CHANGED'});
 assert.throws(()=>ownCompanyNumberSnapshot({...value,actor:{...value.actor,role:'DIRECTOR'}},expected),{code:'META_OWN_COMPANY_RESULT_UNCONFIRMED'});
 assert.throws(()=>ownCompanyNumberSnapshot({...value,channel:{...value.channel,anchorProjectId:'project-b'}},expected),{code:'META_OWN_COMPANY_RESULT_UNCONFIRMED'});
 assert.throws(()=>ownCompanyNumberSnapshot(value,{...expected,connectionId:'another-channel'}),{code:'META_OWN_COMPANY_RESULT_UNCONFIRMED'});
});
