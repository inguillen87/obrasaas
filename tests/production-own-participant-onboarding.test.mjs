import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {ownParticipantOnboardingFixture} from './fixtures/own-participant-onboarding-memory.mjs';
import {readOwnParticipantOnboardingAuthority} from '../src/lib/participant-onboarding-authority.mjs';
import {metaCustomerTransportReady} from '../src/lib/meta-customer-provider.mjs';
import {participantOnboardingIntent,participantOnboardingPhaseOutboundId,participantOnboardingOutboundId} from '../src/lib/participant-onboarding-policy.mjs';
import {decryptCustomerSecret,encryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {digest} from '../src/lib/workspace-policy.mjs';

const envelope=(f,row)=>JSON.parse(decryptCustomerSecret(row.payload.encryptedPayload,{organizationId:f.organization.id,projectId:f.anchor.id,purpose:'outbound',resourceId:row.id},f.environment));
const noMessage=f=>assert.equal(f.sent.length,0);
const phaseOf=f=>f.worker.metadata.participant.onboardingDelivery;
const posts=f=>f.calls.filter(row=>row.method==='POST');

test('never-prepared Own legacy intent adopts invitation-only phases and refreshes its witness',async()=>{
 const f=await ownParticipantOnboardingFixture(),d=phaseOf(f);delete d.deliveryVersion;delete d.phase;delete d.phases;
 const result=await f.service.process(f.reference);assert.equal(result.state,'SENT');assert.equal(result.phase,'ACCOUNT_INVITATION');assert.equal(f.sent.length,1);assert.equal(f.prepares,0);assert.equal(envelope(f,[...f.events.values()][0]).version,3);
});

test('Own legacy intent with a prior uncertain marker is preserved without retagging or another send',async()=>{
 const f=await ownParticipantOnboardingFixture(),d=phaseOf(f);delete d.deliveryVersion;delete d.phase;delete d.phases;
 const id=participantOnboardingOutboundId(participantOnboardingIntent(d)),old={id,projectId:'former-anchor',payload:{participantOnboarding:true},outcome:{state:'SEND_UNKNOWN'},leaseToken:null};f.events.set(id,structuredClone(old));
 await f.service.process(f.reference);noMessage(f);assert.equal(phaseOf(f).deliveryVersion,undefined);assert.deepEqual(f.events.get(id),old);assert.equal(f.prepares,0);
});

test('Own canonical authority sends invitation then identity through separate durable phases with Customer transport closed',async()=>{
 const f=await ownParticipantOnboardingFixture();assert.equal(metaCustomerTransportReady(f.provider.readiness()),false);assert.equal(f.connection.metadata.customerTemplateDrafts,undefined);
 const invitation=await f.service.process(f.reference);assert.equal(invitation.state,'SENT');assert.equal(invitation.phase,'ACCOUNT_INVITATION');assert.equal(f.prepares,0);assert.equal(f.sent.length,1);assert.equal(f.sent[0].template.components[0].parameters.length,1);assert.equal(f.worker.metadata.participant.kycChatChallenge,undefined);
 const first=[...f.events.values()][0],firstBytes=JSON.stringify(first),request=envelope(f,first);assert.equal(request.version,3);assert.equal(request.ownOnboarding.catalog,'OWN_COMPANY');assert.equal(request.ownOnboarding.phase,'ACCOUNT_INVITATION');assert.equal(request.ownOnboarding.anchorProjectId,f.anchor.id);assert.equal(request.ownOnboarding.targetProjectId,f.project.id);assert.equal(request.ownOnboarding.grantDigest,f.connection.metadata.ownCompanyRuntime.grantDigest);assert.equal(first.payload.ownOnboardingDigest,digest(request.ownOnboarding));assert.equal(Object.hasOwn(request,'challengeId'),false);
 assert.equal(f.accept(),true);const identity=await f.service.process(f.reference);assert.equal(identity.state,'SENT');assert.equal(identity.phase,'IDENTITY_START');assert.equal(f.prepares,1);assert.equal(f.sent.length,2);assert.equal(f.sent[1].template.components[0].parameters.length,3);assert.equal(JSON.stringify(first),firstBytes);
 const second=[...f.events.values()].find(row=>row.payload.onboardingPhase==='IDENTITY_START'),next=envelope(f,second);assert.notEqual(first.id,second.id);assert.equal(next.version,3);assert.equal(next.ownOnboarding.phase,'IDENTITY_START');assert.equal(next.participantClerkUserId,f.own.clerkUserId);assert.equal(next.acceptanceReceiptId,'acceptance_original');assert.equal(f.connection.metadata.customerTemplateDrafts,undefined);
 for(const row of [first,second])assert.equal(f.sent.filter(body=>body.biz_opaque_callback_data===row.id).length,1);assert.equal(posts(f).length,2);
});

test('Own witness is not serializable and rejects a different phase before provider I/O',async()=>{
 const f=await ownParticipantOnboardingFixture(),r=await f.resolve();
 for(const authority of [{...r},JSON.parse(JSON.stringify(r)),{}])await assert.rejects(f.provider.forOwnParticipantOnboarding({authority,phase:'ACCOUNT_INVITATION',token:f.token,beforeExternal:()=>f.resolve()}));
 await assert.rejects(f.provider.forOwnParticipantOnboarding({authority:r,phase:'IDENTITY_START',token:f.token,beforeExternal:()=>f.resolve()}));assert.equal(f.calls.length,0);
 const read=readOwnParticipantOnboardingAuthority(r,'ACCOUNT_INVITATION',{environment:f.environment,now:f.now.getTime()});assert.equal(read.catalog,'OWN_COMPANY');assert.equal(read.binding.connectionId,f.connection.id);
 r.worker.phone='+5492212999999';assert.throws(()=>readOwnParticipantOnboardingAuthority(r,'ACCOUNT_INVITATION',{environment:f.environment,now:f.now.getTime()}));
});

test('Own adapter cannot borrow another blueprint, send from read-only scope, create, OAuth or generic-send',async()=>{
 const f=await ownParticipantOnboardingFixture(),r=await f.resolve(),own=readOwnParticipantOnboardingAuthority(r,'ACCOUNT_INVITATION',{environment:f.environment,now:f.now.getTime()});
 const scoped=await f.provider.forOwnParticipantOnboarding({authority:r,phase:'ACCOUNT_INVITATION',token:f.token,beforeExternal:()=>f.resolve()});f.calls.length=0;
 await assert.rejects(scoped.findTemplate({token:f.token,wabaId:f.connection.whatsappBusinessId,name:f.connection.metadata.ownCompanyTemplateDrafts.participant_onboarding_v1.definition.name}));
 await assert.rejects(scoped.sendTemplate({token:f.token,phoneNumberId:f.connection.phoneNumberId,to:f.worker.phone.slice(1),message:{},correlationId:own.correlationId}));assert.equal(scoped.createTemplate,undefined);assert.equal(scoped.exchange,undefined);assert.equal(f.calls.length,0);
 const generic=await f.provider.forConnection({capability:own.capability,connection:r.connection,token:f.token,beforeExternal:()=>f.resolve()});f.calls.length=0;
 await assert.rejects(generic.sendTemplate({token:f.token,phoneNumberId:f.connection.phoneNumberId,to:f.worker.phone.slice(1),message:{},correlationId:own.correlationId}),{code:'META_OWN_COMPANY_ADAPTER_UNAVAILABLE'});assert.equal(f.calls.length,0);
});

test('a fence must return freshly resolved authority, not a caller DTO',async()=>{
 const f=await ownParticipantOnboardingFixture(),r=await f.resolve();
 await assert.rejects(f.provider.forOwnParticipantOnboarding({authority:r,phase:'ACCOUNT_INVITATION',token:f.token,beforeExternal:()=>({...r})}));assert.equal(f.calls.length,0);
});

test('Own frontier rejects the initial witness and reuse of a second canonical witness',async()=>{
 const first=await ownParticipantOnboardingFixture(),authority=await first.resolve();
 await assert.rejects(first.provider.forOwnParticipantOnboarding({authority,phase:'ACCOUNT_INVITATION',token:first.token,beforeExternal:()=>authority}));assert.equal(first.calls.length,0);
 const second=await ownParticipantOnboardingFixture(),initial=await second.resolve(),next=await second.resolve();
 await assert.rejects(second.provider.forOwnParticipantOnboarding({authority:initial,phase:'ACCOUNT_INVITATION',token:second.token,beforeExternal:()=>next}));assert.equal(second.calls.length,1);assert.equal(second.calls[0].path,'debug_token');noMessage(second);
});

for(const [name,change]of [
 ['missing own draft',f=>{f.connection.metadata.customerTemplateDrafts=structuredClone(f.connection.metadata.ownCompanyTemplateDrafts);delete f.connection.metadata.ownCompanyTemplateDrafts.participant_invitation;}],
 ['wrong Own grant on draft',f=>{f.connection.metadata.ownCompanyTemplateDrafts.participant_invitation.grantDigest='a'.repeat(64);}],
 ['invalid Own runtime despite valid Customer draft',f=>{f.connection.metadata.customerTemplateDrafts=structuredClone(f.connection.metadata.ownCompanyTemplateDrafts);f.connection.metadata.ownCompanyRuntime=null;}],
 ['missing activation receipt',f=>{f.runtimeReceiptPresent=false;}],
])test(name+' fails closed without catalog fallback or a challenge',async()=>{
 const f=await ownParticipantOnboardingFixture();change(f);const result=await f.service.process(f.reference);assert.equal(result.state,'BLOCKED');noMessage(f);assert.equal(f.prepares,0);assert.equal(posts(f).length,0);
});

for(const [name,change]of [
 ['PENDING',remote=>{remote.status='PENDING';}],['wrong category',remote=>{remote.category='MARKETING';}],['wrong language',remote=>{remote.language='en_US';}],['wrong ID',remote=>{remote.id='399999999';}],['changed body',remote=>{remote.components[0].text+=' Altered';}],
])test('remote '+name+' blocks Own before a message or challenge',async()=>{
 const f=await ownParticipantOnboardingFixture(),remote=f.remote.get(f.connection.metadata.ownCompanyTemplateDrafts.participant_invitation.definition.name);change(remote);
 const result=await f.service.process(f.reference);assert.equal(result.state,'BLOCKED');assert.equal(result.code,'PARTICIPANT_ONBOARDING_TEMPLATE_APPROVAL_REQUIRED');noMessage(f);assert.equal(f.prepares,0);
});

test('issuer revocation during remote template lookup is fenced before queuing or POST',async()=>{
 const f=await ownParticipantOnboardingFixture();f.afterLookup=()=>{f.controls.issuerActive=false;};const result=await f.service.process(f.reference);assert.equal(result.state,'BLOCKED');noMessage(f);assert.equal(f.prepares,0);assert.equal(f.events.size,0);
});

test('removing all Own markers cannot downgrade a reserved v3 envelope to Customer after reload',async()=>{
 let f;f=await ownParticipantOnboardingFixture({afterPrepare:async()=>{f.connection.metadata.customerTemplateDrafts=structuredClone(f.connection.metadata.ownCompanyTemplateDrafts);delete f.connection.metadata.ownCompany;delete f.connection.metadata.ownCompanyRuntime;}});
 const result=await f.service.process(f.reference);assert.equal(result.state,'BLOCKED');noMessage(f);assert.equal(f.events.size,1);const row=[...f.events.values()][0],before=JSON.stringify(row),request=envelope(f,row);assert.equal(request.version,3);assert.equal(row.payload.onboardingCatalog,'OWN_COMPANY');
 await f.service.process(f.reference);noMessage(f);assert.equal(JSON.stringify(row),before);assert.equal(f.prepares,0);
});

for(const field of ['catalog','phase','connectionId','grantDigest','ownerRevision'])test('durable Own binding rejects changed '+field+' even with a recomputed encrypted request digest',async()=>{
 let f;f=await ownParticipantOnboardingFixture({afterPrepare:async()=>{
  const row=[...f.events.values()][0],request=envelope(f,row);request.ownOnboarding[field]=field==='ownerRevision'?999:'foreign';row.payload.ownOnboardingDigest=digest(request.ownOnboarding);row.payload.requestDigest=digest(request);row.payload.encryptedPayload=encryptCustomerSecret(JSON.stringify(request),{organizationId:f.organization.id,projectId:f.anchor.id,purpose:'outbound',resourceId:row.id},f.environment);
 }});const result=await f.service.process(f.reference);assert.equal(result.state,'BLOCKED');noMessage(f);assert.equal(f.prepares,0);
});

test('Own uncertain POST retains exact outbox and never resends or infers delivery from template existence',async()=>{
 const f=await ownParticipantOnboardingFixture();f.providerMode='timeout';const result=await f.service.process(f.reference);assert.equal(result.state,'SEND_UNKNOWN');assert.equal(f.sent.length,1);const row=[...f.events.values()][0],before=JSON.stringify(row);assert.equal(row.outcome.state,'SEND_UNKNOWN');
 f.providerMode='success';await f.service.process(f.reference);assert.equal(f.sent.length,1);assert.equal(JSON.stringify(row),before);assert.equal(f.prepares,0);
});

test('revocation after SEND_STARTED preserves its marker and prevents every replay',async()=>{
 let f;f=await ownParticipantOnboardingFixture({afterDispatchMarker:async()=>{f.controls.issuerActive=false;}});const result=await f.service.process(f.reference);assert.equal(result.state,'SEND_STARTED');noMessage(f);const row=[...f.events.values()][0],before=JSON.stringify(row);
 f.controls.issuerActive=true;await f.service.process(f.reference);noMessage(f);assert.equal(JSON.stringify(row),before);
});

test('Own repeats remote approval after the durable marker immediately before POST',async()=>{
 let f;f=await ownParticipantOnboardingFixture({afterDispatchMarker:async()=>{
  f.remote.get(f.connection.metadata.ownCompanyTemplateDrafts.participant_invitation.definition.name).status='PENDING';
 }});const result=await f.service.process(f.reference);assert.equal(result.state,'SEND_UNKNOWN');noMessage(f);const row=[...f.events.values()][0];assert.equal(row.outcome.state,'SEND_UNKNOWN');
 f.remote.get(f.connection.metadata.ownCompanyTemplateDrafts.participant_invitation.definition.name).status='APPROVED';await f.service.process(f.reference);noMessage(f);
});

test('identity approval is independent and cannot be replaced by the active invitation',async()=>{
 const f=await ownParticipantOnboardingFixture();await f.service.process(f.reference);assert.equal(f.accept(),true);delete f.connection.metadata.ownCompanyTemplateDrafts.participant_onboarding_v1;
 const result=await f.service.process(f.reference);assert.equal(result.state,'BLOCKED');assert.equal(result.phase,'IDENTITY_START');assert.equal(f.sent.length,1);assert.equal(f.prepares,0);assert.equal(f.worker.metadata.participant.kycChatChallenge,undefined);
});

test('purpose adapter checks exact recipient, correlation and one-shot send independently of generic transport',async()=>{
 let f;f=await ownParticipantOnboardingFixture({afterDispatchMarker:async()=>{throw new Error('Synthetic pause after durable marker');}});assert.equal((await f.service.process(f.reference)).state,'SEND_STARTED');
 const r=await f.resolve(),row=[...f.events.values()][0],request=envelope(f,row),scoped=await f.provider.forOwnParticipantOnboarding({authority:r,phase:'ACCOUNT_INVITATION',token:f.token,beforeExternal:()=>f.resolve(),envelope:request});f.calls.length=0;
 const input={token:f.token,phoneNumberId:f.connection.phoneNumberId,to:request.to,message:request.message,correlationId:row.id};
 for(const patch of [{to:'5492212999999'},{correlationId:'customer_outbound_'+'f'.repeat(64)},{message:{...request.message,bodyParameters:['Foreign company']}}])await assert.rejects(scoped.sendTemplate({...input,...patch}));noMessage(f);assert.equal(f.calls.length,0);
 await scoped.sendTemplate(input);assert.equal(f.sent.length,1);await assert.rejects(scoped.sendTemplate(input));assert.equal(f.sent.length,1);assert.equal(row.id,participantOnboardingPhaseOutboundId(participantOnboardingIntent(phaseOf(f)),'ACCOUNT_INVITATION'));
});

test('a canonical Own invitation tolerates SQL one millisecond ahead of the provider clock',async()=>{
 const f=await ownParticipantOnboardingFixture(),query=f.client.query.bind(f.client);
 f.client.query=async(sql,args=[])=>sql==='SELECT clock_timestamp() AS now'?{rows:[{now:new Date(f.controls.clock.getTime()+1)}]}:query(sql,args);
 const result=await f.service.process(f.reference);
 assert.equal(result.state,'SENT');assert.equal(posts(f).length,1);assert.equal(f.sent.length,1);assert.equal(f.prepares,0);
 assert.equal(f.worker.metadata.participant.kycChatChallenge,undefined);
 assert.deepEqual(f.worker.metadata.participant.permissions,{attendance:false,report:false});
});

test('an Own witness expires after sixty seconds of process time with its wall clock unchanged',async t=>{
 let monotonic=1000;t.mock.method(performance,'now',()=>monotonic);
 const f=await ownParticipantOnboardingFixture(),authority=await f.resolve();
 monotonic=60999;
 assert.equal(readOwnParticipantOnboardingAuthority(authority,'ACCOUNT_INVITATION',{environment:f.environment,now:f.controls.clock.getTime()}).catalog,'OWN_COMPANY');
 monotonic=61000;
 assert.throws(()=>readOwnParticipantOnboardingAuthority(authority,'ACCOUNT_INVITATION',{environment:f.environment,now:f.controls.clock.getTime()}),{code:'PARTICIPANT_ONBOARDING_AUTHORITY_CHANGED'});
 await assert.rejects(f.provider.forOwnParticipantOnboarding({authority,phase:'ACCOUNT_INVITATION',token:f.token,beforeExternal:()=>f.resolve()}),{code:'PARTICIPANT_ONBOARDING_AUTHORITY_CHANGED'});
 noMessage(f);assert.equal(f.calls.length,0);
});
