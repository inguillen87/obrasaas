import test from 'node:test';
import assert from 'node:assert/strict';
import {companyChannelSnapshot,companyChannelOutcome,companyChannelCommand,companyChannelCanAct} from '../src/app/(identity)/cuenta/company-channel-view.mjs';
const expected={scope:'a'.repeat(64),projectId:'project-a',operationId:'11111111-1111-4111-8111-111111111111',action:'PREPARE',connectionId:'connection-a',organizationId:'org_Test',actorId:'user_AdminA'};
const support=(active=false)=>({attendance:active,kyc:active,media:active,flows:false,templates:false});
const channel=()=>({id:'connection-a',anchorProjectId:'project-a',anchorName:'Obra A',displayPhoneNumber:null,mode:'PROJECT_ONLY',revision:1,assignments:[],activationRequirement:null,capabilities:support()});
const identity=()=>({organization:{id:'org_Test',name:'Empresa de ensayo'},actor:{id:'user_AdminA',role:'ADMIN'}});
const snapshot=()=>({...identity(),scope:expected.scope,projectId:expected.projectId,schemaReady:true,canManage:true,channels:[channel()],projects:[{id:'project-a',name:'Obra A'},{id:'project-b',name:'Obra B'}],truncated:false,accepted:false,capabilities:support()});
const absent=()=>({...identity(),scope:expected.scope,projectId:expected.projectId,operationId:expected.operationId,state:'NOT_OBSERVED',saved:false,definitive:false});
const recorded=()=>({...identity(),scope:expected.scope,projectId:expected.projectId,operationId:expected.operationId,action:'PREPARE',state:'RECORDED',saved:true,definitive:true,receiptId:'company_channel_'+'b'.repeat(64),replayed:false,channel:{...channel(),mode:'PREPARED',revision:2}});
test('fresh OWN activation prerequisite blocks a command while ready and ordinary channels retain organization management',()=>{
 const base=snapshot(),ready={...channel(),mode:'PREPARED',activationRequirement:null};base.channels=[ready];
 assert.equal(companyChannelSnapshot(base,expected).channels[0].activationRequirement,null);
 assert.equal(companyChannelCanAct(base,ready,'ACTIVATE'),true);
 const elsewhere={...ready,anchorProjectId:'project-b',anchorName:'Obra B'};assert.equal(companyChannelCanAct(base,elsewhere,'ACTIVATE'),true);
 for(const mode of ['PREPARED','SUSPENDED']){
  const blocked={...ready,mode,activationRequirement:'OWN_NUMBER'},current={...base,channels:[blocked]};
  assert.equal(companyChannelSnapshot(current,expected).channels[0].activationRequirement,'OWN_NUMBER');
  assert.equal(companyChannelCanAct(current,blocked,'ACTIVATE'),false);
  assert.equal(companyChannelCanAct(current,blocked,'ASSIGN'),true);
  assert.throws(()=>companyChannelCommand(current,{action:'ACTIVATE',connectionId:blocked.id,revision:blocked.revision},expected));
 }
 for(const activationRequirement of [undefined,true,false,'RUNTIME','OWN_ORIGIN',{}])assert.throws(()=>companyChannelSnapshot({...base,channels:[{...ready,activationRequirement}]},expected));
 const historical=recorded();delete historical.channel.activationRequirement;assert.equal(companyChannelOutcome(historical,expected).state,'RECORDED');
 assert.throws(()=>companyChannelSnapshot({...base,channels:[historical.channel]},expected));
 assert.equal(companyChannelCanAct(base,historical.channel,'ACTIVATE'),false);
});

test('canonical context and current actor are required before presenting an actionable snapshot',()=>{assert.equal(companyChannelSnapshot(snapshot(),expected).canManage,true);for(const change of [{scope:'c'.repeat(64)},{projectId:'project-b'},{organization:{id:'org_Foreign',name:'Otra empresa'}},{actor:{id:'user_Other',role:'ADMIN'}},{actor:{id:'user_AdminA',role:'DIRECTOR'},canManage:true}])assert.throws(()=>companyChannelSnapshot({...snapshot(),...change},expected));assert.equal(companyChannelSnapshot({...snapshot(),canManage:false,actor:{id:'user_AdminA',role:'DIRECTOR'}},expected).canManage,false);});
test('schema, capability and catalog bounds fail closed without claiming acceptance',()=>{const base=snapshot();for(const change of [{schemaReady:false},{accepted:true},{capabilities:{...base.capabilities,media:true}},{channels:Array.from({length:101},(_,i)=>({...channel(),id:'channel-'+i}))},{projects:[...base.projects,base.projects[0]]}])assert.throws(()=>companyChannelSnapshot({...base,...change},expected));const missing={...base,schemaReady:false,channels:[{...channel(),revision:0}],capabilities:{...base.capabilities,attendance:false}};assert.equal(companyChannelSnapshot(missing,expected).schemaReady,false);assert.equal(companyChannelCanAct(missing,missing.channels[0],'PREPARE'),false);assert.throws(()=>companyChannelSnapshot({...missing,channels:[{...missing.channels[0],mode:'COMPANY'}]},expected));});
test('truncation blocks assignment and activation while explicit suspension remains available',()=>{const base={...snapshot(),truncated:true},item={...channel(),mode:'PREPARED'};assert.equal(companyChannelCanAct(base,item,'ASSIGN'),false);assert.equal(companyChannelCanAct(base,item,'ACTIVATE'),false);assert.equal(companyChannelCanAct(base,{...item,mode:'COMPANY'},'SUSPEND'),true);});
test('decision carries the stable channel identity and consulted revision with an explicit authorized target',()=>{const base=snapshot();base.channels[0].mode='PREPARED';const draft={connectionId:'connection-a',revision:1,action:'ASSIGN',targetProjectId:'project-b'};assert.deepEqual(companyChannelCommand(base,draft,expected),{scope:expected.scope,projectId:expected.projectId,action:'ASSIGN',payload:{connectionId:'connection-a',revision:1,targetProjectId:'project-b'}});for(const change of [{targetProjectId:''},{targetProjectId:'project-foreign'},{connectionId:'other'},{revision:0}])assert.throws(()=>companyChannelCommand(base,{...draft,...change},expected));base.channels[0].assignments=[{projectId:'project-b',projectName:'Obra B',status:'ACTIVE',revision:1}];assert.throws(()=>companyChannelCommand(base,draft,expected));assert.equal(companyChannelCommand(base,{...draft,action:'REVOKE'},expected).payload.targetProjectId,'project-b');});
test('maximal channel revision and inactive revocation cannot produce a command',()=>{const base=snapshot(),item=base.channels[0];item.mode='COMPANY';item.revision=2147483647;assert.equal(companyChannelCanAct(base,item,'SUSPEND'),false);item.revision=1;assert.throws(()=>companyChannelCommand(base,{connectionId:item.id,revision:1,action:'REVOKE',targetProjectId:'project-b'},expected));assert.equal(companyChannelCommand(base,{connectionId:item.id,revision:1,action:'SUSPEND',targetProjectId:'ignored'},expected).payload.targetProjectId,null);});
test('NOT_OBSERVED is an exact nonterminal GET and never a mutation acknowledgement',()=>{assert.equal(companyChannelOutcome(absent(),expected).definitive,false);assert.throws(()=>companyChannelOutcome(absent(),expected,{post:true}));for(const change of [{definitive:true},{saved:true},{extra:'untrusted'},{operationId:'22222222-2222-4222-8222-222222222222'},{scope:'b'.repeat(64)},{projectId:'project-b'},{actor:{id:'user_Foreign',role:'ADMIN'}}])assert.throws(()=>companyChannelOutcome({...absent(),...change},expected));});
test('recorded receipt must match operation, action, actor, organization and channel before settling',()=>{assert.equal(companyChannelOutcome(recorded(),expected,{post:true}).state,'RECORDED');for(const change of [{action:'ACTIVATE'},{receiptId:null},{saved:false},{definitive:false},{replayed:'true'},{channel:{...channel(),id:'connection-other'}},{organization:{id:'org_Other',name:'Otra empresa'}}])assert.throws(()=>companyChannelOutcome({...recorded(),...change},expected,{post:true}));});
test('only a durable scoped rejection is terminal; status-like or malformed error objects retain uncertainty',()=>{const rejection={...recorded(),state:'REJECTED',saved:false,code:'COMPANY_CHANNEL_REVISION_CHANGED'};assert.equal(companyChannelOutcome(rejection,expected).state,'REJECTED');for(const change of [{receiptId:null},{definitive:false},{saved:true},{code:'WORKSPACE_MEMBERSHIP_REQUIRED'},{operationId:'22222222-2222-4222-8222-222222222222'}])assert.throws(()=>companyChannelOutcome({...rejection,...change},expected));assert.throws(()=>companyChannelOutcome({saved:false,code:'COMPANY_CHANNEL_REVISION_CHANGED'},expected));});
test('full support is per active COMPANY channel and its exact summary never grants individual permissions',()=>{
 const base=snapshot(),active={...channel(),mode:'COMPANY',capabilities:support(true)};base.channels.push({...active,id:'connection-b'});base.capabilities=support(true);
 assert.equal(companyChannelSnapshot(base,expected).channels[1].capabilities.media,true);
 for(const mode of ['PROJECT_ONLY','PREPARED','SUSPENDED'])assert.throws(()=>companyChannelSnapshot({...base,channels:[{...active,mode}]},expected));
 assert.throws(()=>companyChannelSnapshot({...base,schemaReady:false},expected));
 assert.throws(()=>companyChannelSnapshot({...base,capabilities:support()},expected));
 assert.throws(()=>companyChannelSnapshot({...snapshot(),capabilities:support(true)},expected));
 const inactive={...active,capabilities:support()};assert.equal(companyChannelSnapshot({...snapshot(),channels:[inactive]},expected).capabilities.media,false);
 for(const change of [{attendance:false},{media:false},{kyc:false},{flows:true},{templates:true},{stock:true},{media:'true'}])assert.throws(()=>companyChannelSnapshot({...base,channels:[{...active,capabilities:{...active.capabilities,...change}}]},expected));
 for(const key of ['metadata','encryptedAccessToken','actorId','phone'])assert.throws(()=>companyChannelSnapshot({...base,channels:[{...active,[key]:'private'}]},expected));
 const missing={...active};delete missing.capabilities;assert.throws(()=>companyChannelSnapshot({...base,channels:[missing]},expected));
});
test('a historical receipt without support still resolves its exact operation but cannot become an actionable snapshot',()=>{
 const old=recorded();delete old.channel.capabilities;assert.equal(companyChannelOutcome(old,expected).state,'RECORDED');
 assert.throws(()=>companyChannelSnapshot({...snapshot(),channels:[old.channel]},expected));
 assert.throws(()=>companyChannelOutcome({...old,channel:{...old.channel,capabilities:{...support(),templates:true}}},expected));
});
