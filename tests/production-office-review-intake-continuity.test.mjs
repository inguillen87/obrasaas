import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createOfficeReviewStore} from '../src/lib/office-review-store.mjs';
import {WorkspaceError,digest} from '../src/lib/workspace-policy.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {customerOutboundId} from '../src/lib/meta-customer-outbound.mjs';
import {employeeIntakeFixture} from './fixtures/employee-intake-memory.mjs';

const active=projectId=>({projectId,status:'ACTIVE',revision:1});
function additiveHistory(f){
 const rows=[
  ['ACTIVATE',1,[active(f.project.id),active(f.target.id)]],
  ['ASSIGN',2,[active(f.project.id),active(f.target.id),active('project-c')]],
 ].map(([action,revision,assignments])=>{
  const operationId=randomUUID(),organizationId=f.project.organizationId,actorId=f.member.actorId,projectId=f.project.id;
  return {id:'company_channel_'+digest([organizationId,actorId,projectId,operationId]),organizationId,actorId,action:'company.channel.recorded',entityType:'WhatsAppConnection',entityId:f.connection.id,metadata:{version:1,action,projectId,operationId,state:'RECORDED',code:null,requestDigest:digest(['synthetic-office-addition',operationId]),channel:{id:f.connection.id,anchorProjectId:projectId,mode:'COMPANY',revision,assignments}}};
 });
 for(const row of rows)f.audits.set(row.id,row);
 f.controls.ownerRevision=2;
 return rows;
}

async function fixture({submitted=true,additionBeforeGreeting=false,additionAfterGreeting=false}={}){
 const f=employeeIntakeFixture();
 if(submitted)await f.submit();else {await f.configure();await f.execute('HOLA');}
 const applicationId=f.state().applicationId;
 let history;
 if(additionBeforeGreeting)history=additiveHistory(f);
 const greeting=await f.execute('HOLA'),source=f.events.get(greeting.context.eventId),outbox=f.outbounds.get(customerOutboundId(source.id));
 source.status='PROCESSED';source.leaseToken=null;source.leaseExpiresAt=new Date(0);
 outbox.outcome={...outbox.outcome,state:'STATUS_OBSERVED',providerStatus:'read'};
 if(additionAfterGreeting)history=additiveHistory(f);
 const reviewer={authenticated:true,verification:'clerk-production-jwt',userId:'user_OfficeReviewer',organizationId:f.session.organizationId,organizationRole:'org:member'};
 const member={actorId:'office-reviewer',membershipId:'office-review-member',organizationId:f.project.organizationId,clerkUserId:reviewer.userId,clerkRole:'org:member',role:'AUDITOR'};
 const context={scope:f.scope,projectId:f.target.id},invitationId='office_invite_'+'b'.repeat(32),originId='office_origin',expiresAt=new Date(f.now.getTime()+86400000).toISOString();
 const grant={version:1,kind:'OFFICE_AUDITOR_INVITATION_ACCEPTED',invitationId,membershipId:member.membershipId,projectId:f.target.id,organizationId:member.organizationId,clerkUserId:reviewer.userId,connectionId:f.connection.id,channelRevision:f.controls.ownerRevision,assignmentRevision:1,issuerId:f.member.actorId,expiresAt,originReceiptId:originId};
 const invitation={id:originId,actorId:f.member.actorId,projectId:f.target.id,organizationId:member.organizationId,metadata:{version:1,action:'INVITE_AUDITOR',projectId:f.target.id,invitationId,connectionId:f.connection.id,expiresAt,state:'SENT'}};
 const selection={connectionId:f.connection.id,channelRevision:f.controls.ownerRevision,assignmentRevision:1,eventId:source.id,payloadDigest:source.payload.payloadDigest};
 const queries=[],controls={revoked:false},row=rows=>({rows:structuredClone(rows),rowCount:rows.length});
 const query=async(sql,args=[])=>{
  queries.push({sql,args});
  if(sql.includes('FROM public."AuditLog" a JOIN public."Project"'))return row([invitation]);
  if(sql.includes("action='office.review.revoked'"))return row(controls.revoked?[{id:'office_revocation'}]:[]);
  if(sql.includes("action='office.review.event.selected'"))return row([{metadata:selection}]);
  if(sql.includes('action=$1')&&args[0]==='office.review.accepted')return row([{id:'office_accept',metadata:grant}]);
  if(sql.startsWith('SELECT tm.id FROM public."TenantMembership"'))return row(f.controls.issuerActive&&f.controls.issuerRole==='ADMIN'?[{id:f.member.membershipId}]:[]);
  if(sql.startsWith('SELECT c.id,c."projectId"'))return row(f.controls.active&&f.controls.mode==='COMPANY'&&f.controls.targetAssignment?[{...f.connection,channelRevision:f.controls.ownerRevision,assignmentRevision:1}]:[]);
  if(sql.includes("provider='meta-customer-outbound-v1'")&&sql.includes("payload->>'eventId'=$3"))return row([...f.outbounds.values()].filter(r=>r.projectId===args[0]&&r.payload.channelId===args[1]&&r.payload.eventId===args[2]));
  return f.query(sql,args);
 };
 const workspace={async officeReviewRead(session,input,run){if(session.userId!==reviewer.userId||input.scope!==f.scope||input.projectId!==f.target.id)throw new WorkspaceError('WORKSPACE_CONTEXT_CHANGED',403);return run({query},member,f.scope,f.target);}};
 const store=createOfficeReviewStore({workspace,connect:f.connect,identity:{},environment:f.environment});
 const review=()=>store.review(reviewer,context);
 const aad=(purpose,id)=>({organizationId:f.project.organizationId,projectId:f.project.id,purpose,resourceId:id});
 const decrypt=(value,purpose,id)=>JSON.parse(decryptCustomerSecret(value,aad(purpose,id),f.environment));
 const encrypt=(value,purpose,id)=>encryptCustomerSecret(JSON.stringify(value),aad(purpose,id),f.environment);
 const changeRequest=change=>{const request=decrypt(outbox.payload.encryptedPayload,'outbound',outbox.id);change(request);outbox.payload.encryptedPayload=encrypt(request,'outbound',outbox.id);outbox.payload.requestDigest=digest(request);};
 const changeState=change=>{const anchor=f.events.get(applicationId),state=f.state();change(state);anchor.payload.employeeIntake.encryptedState=encrypt(state,'employee-intake',applicationId);};
 const changeRouting=(event,revision)=>{const proof=decrypt(event.payload.encryptedProof,'webhook-proof',event.id);proof.companyRouting.revision=revision;event.payload.companyRouting=proof.companyRouting;event.payload.encryptedProof=encrypt(proof,'webhook-proof',event.id);};
 return {...f,applicationId,source,outbox,history,queries,officeControls:controls,grant,selection,review,encrypt,decrypt,changeRequest,changeState,changeRouting};
}

test('canonical continuing HOLA exposes only the stored read observation, preserving the WAITING application and policy',async()=>{
 const f=await fixture({additionBeforeGreeting:true}),before=structuredClone([...f.events]),policy=structuredClone(f.connection.metadata.employeeIntakePolicy),sends=f.controls.sends;
 assert.notEqual(f.source.id,f.applicationId);assert.equal(f.state().status,'WAITING_RESPONSIBLE');assert.equal(f.state().revision,6);
 const data=await f.review();
 assert.equal(data.items.length,1);assert.equal(data.items[0].id,f.source.id);assert.equal(data.items[0].replyState,'STATUS_OBSERVED');assert.equal(data.items[0].deliveryStatus,'read');
 assert.equal(data.readOnly,true);assert.equal(data.canSend,false);assert.equal(data.canManage,false);
 assert.doesNotMatch(JSON.stringify(data),/Persona|15550001001|person@example|applicationId|workerId|encrypted|cipher|wamid|HOLA/);
 assert.deepEqual([...f.events],before);assert.deepEqual(f.connection.metadata.employeeIntakePolicy,policy);assert.equal(f.controls.sends,sends);assert.equal(f.controls.providerCalls,0);assert.equal(f.workers.size,0);
 assert.ok(f.queries.every(q=>q.sql.startsWith('SELECT')&&!/FOR (SHARE|UPDATE)|pg_advisory/.test(q.sql)));
});

test('a selected signed greeting before a canonical additive assignment remains observable under the current office grant',async()=>{
 const f=await fixture({additionAfterGreeting:true});assert.equal(f.source.payload.companyRouting.revision,1);assert.equal(f.grant.channelRevision,2);
 assert.equal((await f.review()).items[0].replyState,'STATUS_OBSERVED');
});

test('later canonical messages can advance the same application without erasing the earlier greeting observation',async()=>{
 const f=await fixture({submitted:false});await f.execute('Persona Sintética');
 assert.notEqual(f.state().lastEventId,f.source.id);assert.equal(f.state().applicationId,f.applicationId);
 assert.equal((await f.review()).items[0].replyState,'STATUS_OBSERVED');
});

for(const [name,change] of [
 ['source dispatch absent',f=>delete f.source.payload.employeeIntakeDispatch],
 ['source dispatch wrong application',f=>f.source.payload.employeeIntakeDispatch.applicationId='customer_webhook_'+'f'.repeat(64)],
 ['source dispatch wrong payload',f=>f.source.payload.employeeIntakeDispatch.payloadDigest='f'.repeat(64)],
 ['source dispatch wrong policy',f=>f.source.payload.employeeIntakeDispatch.policyDigest='f'.repeat(64)],
 ['source dispatch transplanted ciphertext',f=>f.source.payload.employeeIntakeDispatch.encryptedResult=f.events.get(f.applicationId).payload.employeeIntakeDispatch.encryptedResult],
 ['outbox deterministic ID changed',f=>{f.outbox.id='customer_outbound_'+'f'.repeat(64);}],
 ['outbox intake marker absent',f=>delete f.outbox.payload.employeeIntake],
 ['outbox public application crossed',f=>f.outbox.payload.applicationId=f.source.id],
 ['outbox request application reset to selected event',f=>f.changeRequest(r=>r.applicationId=f.source.id)],
 ['outbox request unrelated application',f=>f.changeRequest(r=>r.applicationId='customer_webhook_'+'f'.repeat(64))],
 ['outbox request reply changed',f=>f.changeRequest(r=>r.message={type:'text',text:'Synthetic unrelated reply'})],
 ['outbox request recipient changed',f=>f.changeRequest(r=>r.to='15550001002')],
 ['outbox request source changed',f=>f.changeRequest(r=>r.eventId=f.applicationId)],
 ['outbox request channel crossed',f=>f.changeRequest(r=>r.channelId='connection-other')],
 ['outbox request organization crossed',f=>f.changeRequest(r=>r.organizationId='company-other')],
 ['outbox KYC purpose',f=>f.changeRequest(r=>r.channelPurpose='KYC_CAPTURE')],
 ['original application absent',f=>f.events.delete(f.applicationId)],
 ['original signed proof absent',f=>delete f.events.get(f.applicationId).payload.encryptedProof],
 ['original signed proof transplanted',f=>f.events.get(f.applicationId).payload.encryptedProof=f.source.payload.encryptedProof],
 ['original dispatch absent',f=>delete f.events.get(f.applicationId).payload.employeeIntakeDispatch],
 ['original encrypted state absent',f=>delete f.events.get(f.applicationId).payload.employeeIntake.encryptedState],
 ['original provider crossed',f=>f.events.get(f.applicationId).provider='meta-customer-outbound-v1'],
 ['original state sender crossed',f=>f.changeState(s=>s.sender='+15550001002')],
 ['original state policy crossed',f=>f.changeState(s=>s.policyDigest='f'.repeat(64))],
 ['original state envelope revision crossed',f=>f.events.get(f.applicationId).payload.employeeIntake.revision++],
 ['original state lastEventId crossed',f=>f.changeState(s=>s.lastEventId=f.applicationId)],
 ['source unsigned company routing changed',f=>f.source.payload.companyRouting.revision=2],
 ['source company routing absent',f=>delete f.source.payload.companyRouting],
 ['source signed routing above current revision',f=>f.changeRouting(f.source,2)],
 ['original signed routing below policy checkpoint',f=>f.changeRouting(f.events.get(f.applicationId),0)],
])test(name+' denies the continuing greeting projection',async()=>{
 const f=await fixture();change(f);await assert.rejects(f.review(),{code:'OFFICE_REVIEW_SOURCE_CHANGED'});
});

test('a separately signed application from another sender cannot substitute for the original application',async()=>{
 const f=await fixture(),other=await f.execute('HOLA',{sender:'15550001002',reply:false});
 f.source.payload.employeeIntakeDispatch.applicationId=other.context.eventId;f.outbox.payload.applicationId=other.context.eventId;f.changeRequest(r=>r.applicationId=other.context.eventId);
 await assert.rejects(f.review(),{code:'OFFICE_REVIEW_SOURCE_CHANGED'});
});

for(const [name,change] of [
 ['disabled intake policy',async f=>{await f.configure(false);}],
 ['reissued intake policy',async f=>{await f.configure();}],
 ['missing policy receipt',f=>f.audits.delete(f.connection.metadata.employeeIntakePolicy.receiptId)],
 ['changed issuer revision',f=>f.member.revision='2026-10-06T00:00:00.000002'],
 ['issuer membership A-B-A audit',f=>f.audits.set('membership-change',{id:'membership-change',organizationId:f.project.organizationId,actorId:f.member.actorId,action:'participant.operation.recorded',entityType:'TenantMembership',entityId:f.member.membershipId,metadata:{kind:'DISABLE_MEMBERSHIP'}})],
 ['changed channel credentials',f=>f.connection.encryptedAccessToken+='changed'],
 ['unconfirmed own-company runtime',f=>f.connection.metadata.ownCompanyRuntime={version:1}],
 ['revoked anchor assignment',f=>f.controls.anchorAssignment=false],
])test(name+' revokes historical continuation observation',async()=>{
 const f=await fixture();await change(f);await assert.rejects(f.review(),{code:'OFFICE_REVIEW_SOURCE_CHANGED'});
});

for(const [name,change] of [
 ['missing additive history',f=>f.audits.delete(f.history[0].id)],
 ['duplicate additive revision',f=>{const copy=structuredClone(f.history[1]),operationId=randomUUID();copy.id='company_channel_'+digest([copy.organizationId,copy.actorId,copy.metadata.projectId,operationId]);copy.metadata.operationId=operationId;f.audits.set(copy.id,copy);}],
 ['SUSPEND then apparent active state',f=>f.history[1].metadata.action='SUSPEND'],
 ['REVOKE then apparent assigned state',f=>f.history[1].metadata.action='REVOKE'],
])test(name+' cannot stand in for a canonical continuing policy',async()=>{
 const f=await fixture({additionBeforeGreeting:true});change(f);await assert.rejects(f.review(),{code:'OFFICE_REVIEW_SOURCE_CHANGED'});
});

test('office revocation still denies access before reading the intake chain',async()=>{
 const f=await fixture();f.officeControls.revoked=true;
 await assert.rejects(f.review(),{code:'OFFICE_REVIEW_ACCESS_REQUIRED'});
 assert.equal(f.queries.some(q=>q.sql.includes('WhatsAppCompanySchema')),false);
});
