import test from 'node:test';
import assert from 'node:assert/strict';
import {OWN_COMPANY_ACTIONS,ownCompanyNumberSnapshot,ownCompanyNumberOutcome,ownCompanyNumberCommand,ownCompanyNumberCanAct,ownCompanyNumberFresh,ownCompanyNumberExplain,ownCompanyNumberAccessDenied} from '../src/app/(identity)/cuenta/own-company-number-view.mjs';
const time=Date.parse('2026-10-09T12:00:00.000Z');
const expected={scope:'a'.repeat(64),projectId:'project-a',operationId:'11111111-1111-4111-8111-111111111111',action:'CONNECT_OWN_NUMBER',connectionId:null,organizationId:'org_Test',actorId:'user_AdminA'};
const identity=()=>({organization:{id:'org_Test',name:'Empresa de ensayo'},actor:{id:'user_AdminA',role:'ADMIN'}});
const channel=()=>({id:'connection-a',anchorProjectId:'project-a',revision:2,mode:'PREPARED',displayPhoneNumber:'+54 911 0000 9999',connectionStatus:'PENDING',enabled:false});
const snapshot=()=>({...identity(),scope:expected.scope,projectId:expected.projectId,readOnly:true,canManage:true,mode:'OWN_COMPANY',companyPhoneRevision:1,wabaId:'230000001',phoneNumberId:'220000001',displayPhoneNumber:'+54 911 0000 9999',verifiedBusinessName:'Empresa de ensayo',registered:true,subscribed:false,expiresAt:new Date(time+3600000).toISOString(),channel:null,connectionMatchesAssets:false,connectionOwnVerified:false,accepted:false,roundTrip:'NOT_VERIFIED'});
const draft=(base,action='CONNECT_OWN_NUMBER',patch={})=>({action,connectionId:base.channel?.id||null,revision:base.channel?.revision||0,companyPhoneRevision:base.companyPhoneRevision,confirmOwnBusiness:true,confirmReplacement:false,...patch});
const outcome=()=>({...identity(),scope:expected.scope,projectId:expected.projectId,operationId:expected.operationId,action:expected.action,state:'RECORDED',saved:true,definitive:true,receiptId:'company_own_'+'b'.repeat(64),replayed:false,channel:channel(),accepted:false,roundTrip:'NOT_VERIFIED'});
test('own discovery is read-only and bound to the selected scope, project, organization and current admin',()=>{
 assert.equal(ownCompanyNumberSnapshot(snapshot(),expected).canManage,true);
 for(const patch of [{scope:'c'.repeat(64)},{projectId:'project-b'},{organization:{id:'org_Foreign',name:'Otra empresa'}},{actor:{id:'user_Other',role:'ADMIN'}},{actor:{id:'user_AdminA',role:'DIRECTOR'}},{readOnly:false},{canManage:false},{mode:'CUSTOMER_SELF_SERVICE'},{accepted:true},{roundTrip:'VERIFIED'}])assert.throws(()=>ownCompanyNumberSnapshot({...snapshot(),...patch},expected));
});
test('discovery rejects malformed assets, capability dates, private fields and channels from another project',()=>{
 for(const patch of [{companyPhoneRevision:0},{wabaId:'wrong'},{phoneNumberId:'wrong'},{displayPhoneNumber:''},{registered:'true'},{subscribed:null},{expiresAt:'tomorrow'},{channel:{...channel(),anchorProjectId:'project-b'}},{channel:{...channel(),metadata:{token:'private'}}},{channel:{...channel(),enabled:'true'}},{connectionMatchesAssets:true},{connectionOwnVerified:true},{connectionOwnVerified:'true'},{accessToken:'private'}])assert.throws(()=>ownCompanyNumberSnapshot({...snapshot(),...patch},expected));
 const own={...snapshot(),channel:channel(),connectionMatchesAssets:true};assert.equal(ownCompanyNumberSnapshot(own,expected).channel.id,'connection-a');
});
test('a scoped discovery can remain visible after expiry but cannot authorize a command',()=>{
 const base=snapshot();assert.equal(ownCompanyNumberFresh(base,time),true);assert.equal(ownCompanyNumberFresh(base,time+3600000),false);assert.equal(ownCompanyNumberCanAct(base,'CONNECT_OWN_NUMBER',time+3600000),false);
 assert.throws(()=>ownCompanyNumberCommand(base,draft(base),expected,{now:time+3600000}));
});
test('initial connect carries consulted references with explicit ownership and no secret or profile payload',()=>{
 const base=snapshot(),command=ownCompanyNumberCommand(base,draft(base),expected,{now:time});
 assert.deepEqual(command,{scope:expected.scope,projectId:expected.projectId,action:'CONNECT_OWN_NUMBER',payload:{connectionId:null,revision:0,companyPhoneRevision:1,wabaId:'230000001',phoneNumberId:'220000001',confirmOwnBusiness:true,confirmReplacement:false}});
 for(const patch of [{confirmOwnBusiness:false},{confirmReplacement:true},{connectionId:'other'},{revision:1},{companyPhoneRevision:2}])assert.throws(()=>ownCompanyNumberCommand(base,draft(base,'CONNECT_OWN_NUMBER',patch),expected,{now:time}));
});
test('server asset matching, suspension and reviewed replacement protect an existing channel',()=>{
 const base={...snapshot(),channel:channel()};
 for(const mode of ['PROJECT_ONLY','PREPARED','COMPANY']){const current={...base,channel:{...base.channel,mode}};assert.equal(ownCompanyNumberCanAct(current,'CONNECT_OWN_NUMBER',time),false);assert.throws(()=>ownCompanyNumberCommand(current,draft(current,'CONNECT_OWN_NUMBER',{confirmReplacement:true}),expected,{now:time}));}
 const suspended={...base,channel:{...base.channel,mode:'SUSPENDED'}};assert.equal(ownCompanyNumberCanAct(suspended,'CONNECT_OWN_NUMBER',time),true);assert.throws(()=>ownCompanyNumberCommand(suspended,draft(suspended),expected,{now:time}));
 assert.equal(ownCompanyNumberCommand(suspended,draft(suspended,'CONNECT_OWN_NUMBER',{confirmReplacement:true}),expected,{now:time}).payload.confirmReplacement,true);
 const matching={...base,connectionMatchesAssets:true};assert.equal(ownCompanyNumberCommand(matching,draft(matching),expected,{now:time}).payload.confirmReplacement,false);assert.throws(()=>ownCompanyNumberCommand(matching,draft(matching,'CONNECT_OWN_NUMBER',{confirmReplacement:true}),expected,{now:time}));
 assert.equal(ownCompanyNumberCanAct({...matching,channel:{...matching.channel,enabled:true}},'CONNECT_OWN_NUMBER',time),false);
 assert.equal(ownCompanyNumberCanAct({...matching,channel:{...matching.channel,mode:'COMPANY'}},'CONNECT_OWN_NUMBER',time),false);
 assert.equal(ownCompanyNumberCanAct(matching,'ACTIVATE_OWN_NUMBER',time),false);assert.equal(ownCompanyNumberCanAct({...matching,connectionOwnVerified:true},'CONNECT_OWN_NUMBER',time),false);
});
test('activation of a pending registered own number never invents registration consent or a PIN',()=>{
 const base={...snapshot(),channel:channel(),connectionMatchesAssets:true,connectionOwnVerified:true};assert.equal(ownCompanyNumberCanAct(base,'ACTIVATE_OWN_NUMBER',time),true);
 const command=ownCompanyNumberCommand(base,draft(base,'ACTIVATE_OWN_NUMBER'),expected,{now:time});assert.equal(command.payload.confirmRegistration,false);assert.equal(command.payload.securityPin,null);assert.equal(command.payload.confirmReplacement,false);
 for(const patch of [{registered:false},{connectionMatchesAssets:false},{connectionOwnVerified:false},{channel:{...base.channel,enabled:true}},{channel:{...base.channel,connectionStatus:'ERROR'}},{channel:{...base.channel,mode:'COMPANY'}},{channel:{...base.channel,revision:2147483646}}]){const current={...base,...patch};assert.equal(ownCompanyNumberCanAct(current,'ACTIVATE_OWN_NUMBER',time),false);assert.throws(()=>ownCompanyNumberCommand(current,draft(current,'ACTIVATE_OWN_NUMBER'),expected,{now:time}));}
});
test('only the exact scoped own receipt can settle a recorded decision',()=>{
 assert.equal(ownCompanyNumberOutcome(outcome(),expected,{post:true}).state,'RECORDED');
 for(const patch of [{scope:'b'.repeat(64)},{projectId:'project-b'},{operationId:'22222222-2222-4222-8222-222222222222'},{action:'ACTIVATE_OWN_NUMBER'},{receiptId:null},{replayed:'true'},{saved:false},{definitive:false},{organization:{id:'org_Other',name:'Otra empresa'}},{actor:{id:'user_Other',role:'ADMIN'}},{channel:{...channel(),anchorProjectId:'project-b'}},{accepted:true},{roundTrip:'VERIFIED'},{rawProviderResponse:{token:'private'}}])assert.throws(()=>ownCompanyNumberOutcome({...outcome(),...patch},expected,{post:true}));
 assert.throws(()=>ownCompanyNumberOutcome(outcome(),{...expected,connectionId:'connection-other'}));
});
test('a durable rejection is terminal while HTTP-like or uncorrelated errors preserve uncertainty',()=>{
 const rejected={...outcome(),state:'REJECTED',saved:false,code:'META_OWN_COMPANY_REVISION_CHANGED',channel:null};assert.equal(ownCompanyNumberOutcome(rejected,expected).definitive,true);
 for(const patch of [{saved:true},{definitive:false},{code:null},{code:'provider said token abc'},{receiptId:null},{operationId:'22222222-2222-4222-8222-222222222222'}])assert.throws(()=>ownCompanyNumberOutcome({...rejected,...patch},expected));
 assert.throws(()=>ownCompanyNumberOutcome({code:'META_OWN_COMPANY_REVISION_CHANGED',status:409},expected));
});
test('provider started, verifying and unknown outcomes retain the reference without claiming activation',()=>{
 for(const state of ['VERIFYING','PROVIDER_STARTED','PROVIDER_UNKNOWN']){
  const pending={...outcome(),state,saved:false,definitive:false};assert.equal(ownCompanyNumberOutcome(pending,expected,{post:true}).definitive,false);
  for(const patch of [{saved:true},{definitive:true},{receiptId:null}])assert.throws(()=>ownCompanyNumberOutcome({...pending,...patch},expected));
  if(state==='VERIFYING'){assert.equal(ownCompanyNumberOutcome({...pending,channel:null},expected).channel,null);assert.throws(()=>ownCompanyNumberOutcome({...pending,channel:null},{...expected,connectionId:'connection-a'}));assert.throws(()=>ownCompanyNumberOutcome({...pending,action:'ACTIVATE_OWN_NUMBER',channel:null},{...expected,action:'ACTIVATE_OWN_NUMBER',connectionId:'connection-a'}));}else assert.throws(()=>ownCompanyNumberOutcome({...pending,channel:null},expected));
  const observed={...pending,providerObservation:{registered:true,subscribed:true,readOnly:true},recovery:'EXPLICIT_REVIEW_REQUIRED'};assert.equal(ownCompanyNumberOutcome(observed,expected).state,state);assert.throws(()=>ownCompanyNumberOutcome(observed,expected,{post:true}));assert.throws(()=>ownCompanyNumberOutcome({...observed,providerObservation:{...observed.providerObservation,readOnly:false}},expected));
 }
 assert.throws(()=>ownCompanyNumberOutcome({...outcome(),providerObservation:{registered:true,subscribed:true,readOnly:true}},expected));
});
test('legacy absence is a bounded GET observation and never permits automatic resubmission',()=>{
 const absent={...identity(),scope:expected.scope,projectId:expected.projectId,operationId:expected.operationId,state:'NOT_OBSERVED',saved:false,definitive:false};assert.equal(ownCompanyNumberOutcome(absent,expected).state,'NOT_OBSERVED');assert.throws(()=>ownCompanyNumberOutcome(absent,expected,{post:true}));
 for(const patch of [{definitive:true},{saved:true},{action:'CONNECT_OWN_NUMBER'},{organization:{id:'org_Other',name:'Otra empresa'}}])assert.throws(()=>ownCompanyNumberOutcome({...absent,...patch},expected));
});
test('public errors stay actionable without exposing provider detail; denied views must be cleared',()=>{
 assert.deepEqual(OWN_COMPANY_ACTIONS,['CONNECT_OWN_NUMBER','ACTIVATE_OWN_NUMBER']);assert.match(ownCompanyNumberExplain('META_OWN_COMPANY_SECURITY_PIN_REQUIRED'),/Meta/);assert.doesNotMatch(ownCompanyNumberExplain('token=private'),/token=private/);
 for(const error of [{status:401},{status:403},{code:'META_OWN_COMPANY_CONTEXT_CHANGED'},{code:'WORKSPACE_CONTEXT_CHANGED'}])assert.equal(ownCompanyNumberAccessDenied(error),true);assert.equal(ownCompanyNumberAccessDenied({status:503}),false);
});
