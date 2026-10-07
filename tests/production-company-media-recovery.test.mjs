import test from 'node:test';
import assert from 'node:assert/strict';
import {WorkspaceError} from '../src/lib/workspace-policy.mjs';
import {createMetaCustomerProcessor,META_CUSTOMER_PREPARED_MEDIA_RECOVERY_CODE} from '../src/lib/meta-customer-processing.mjs';
import {companyPreparedMediaRecovery,companyPreparedMediaRecoveryAuthorized} from '../src/lib/company-channel-routing.mjs';
import {readMetaCustomerInboxReceipt} from '../src/lib/meta-customer-inbox-review.mjs';
import {companyMediaRecoveryMemory} from './fixtures/company-media-recovery-memory.mjs';

const validate=f=>companyPreparedMediaRecovery(f.client,f.claim(),{environment:f.environment});
function processor(f,options={}){return createMetaCustomerProcessor({connect:f.connect,environment:f.environment,now:()=>f.clock,lockChannel:async()=>f.connection,deferAuthorization:(client,context)=>companyPreparedMediaRecovery(client,context,{environment:f.environment}),dispatch:async()=>{assert.equal(f.open,0);throw new WorkspaceError('WORKER_CHANNEL_PARTICIPANT_REQUIRED',403);},...options});}

test('real signed A source, immutable FIELD B projection and planner-produced encrypted reservation validate without granting revoked PM access',async()=>{
 const f=companyMediaRecoveryMemory();f.worker.active=false;f.worker.metadata.participant.permissions.report=false;
 assert.equal(await validate(f),true);assert.equal(f.open,0);assert.equal(f.trace.some(q=>/^(INSERT|UPDATE|DELETE)/.test(q)),false);
 assert.equal(f.projection.projectId,'project-b');assert.equal(f.event.projectId,'project-a');
});

const changes=[
 ['missing reservation',f=>{f.prepared=null;}],
 ['wrong source project',f=>{f.event.projectId='project-other';}],
 ['tampered signed digest',f=>{f.event.payload.payloadDigest='b'.repeat(64);} ],
 ['tampered signing proof',f=>{f.event.payload.encryptedProof=f.event.payload.encryptedProof.slice(0,-3)+'bad';}],
 ['unsigned company mode',f=>{f.event.payload.companyRouting={...f.event.payload.companyRouting,revision:9};}],
 ['tenant projection',f=>{f.projection.organizationId='org-other';}],
 ['worker projection',f=>{f.projection.workerId='worker-other';}],
 ['actor projection',f=>{f.projection.actorId='person-other';}],
 ['binding projection',f=>{f.projection.bindingId='binding-other';}],
 ['missing assignment',f=>{f.assignmentPresent=false;}],
 ['missing canonical membership',f=>{f.membershipPresent=false;}],
 ['revoked binding',f=>{f.binding.status='REVOKED';}],
 ['wrong reserved destination',f=>{f.prepared.projectId='project-a';}],
 ['source digest in reservation',f=>{f.prepared.payloadDigest='c'.repeat(64);}],
 ['wrong media',f=>{f.sealPrepared({media:{...f.planned.media,mediaId:'987654321'},state:f.planned.state});}],
 ['wrong consent',f=>{f.sealPrepared({media:{...f.planned.media,analysisConsent:{...f.planned.media.analysisConsent,allowed:true}},state:f.planned.state});}],
 ['prior prompt epoch',f=>{f.promptProjection.routeEpoch++;}],
 ['unconfirmed prompt',f=>{f.outbound.outcome.state='SEND_UNKNOWN';}],
 ['failed confirmed prompt',f=>{f.outbound.outcome.providerStatus='failed';}],
 ['wrong prompt context',f=>{f.outbound.outcome.messageId='wamid.OtherPrompt';}],
 ['outbound digest tamper',f=>{f.outbound.payload.requestDigest='d'.repeat(64);}],
 ['pilot media closed',f=>{f.connection.metadata.developmentPilot={version:1};}],
 ['schema unavailable',f=>{f.schemaReady=false;}],
];
for(const [name,change] of changes)test('reservation validation fails closed: '+name,async()=>{const f=companyMediaRecoveryMemory();change(f);assert.equal(await validate(f),false);});

test('processor defers valid prepared media in its own transaction, releases exact lease, excludes cron, and requires an explicit fully authorized retry',async()=>{
 const f=companyMediaRecoveryMemory();let authorized=false,io=0,dispatches=0;
 const p=processor(f,{dispatch:async()=>{assert.equal(f.open,0);dispatches++;if(!authorized)throw new WorkspaceError('WORKER_CHANNEL_PERMISSION_REQUIRED',403);io++;return {kind:'EVIDENCE',businessApplied:true,receiptId:'canonical-evidence-receipt',reviewState:'RECORDED'};}});
 const denied=await p.process(f.event.id);assert.equal(denied.processed,false);assert.equal(denied.recoveryPending,true);assert.equal(denied.code,'WORKER_CHANNEL_PERMISSION_REQUIRED');assert.equal(denied.businessApplied,false);assert.equal(io,0);
 assert.equal(f.event.status,'PENDING');assert.equal(f.event.lastError,META_CUSTOMER_PREPARED_MEDIA_RECOVERY_CODE);assert.equal(f.event.leaseToken,null);assert.equal(f.event.leaseExpiresAt,null);
 assert.equal((await p.recover()).checked,0);assert.equal(dispatches,1);assert.equal(io,0);
 const stillDenied=await p.recover({eventIds:[f.event.id]});assert.equal(stillDenied.results[0].recoveryPending,true);assert.equal(io,0);
 authorized=true;const recovered=await p.recover({eventIds:[f.event.id]});assert.equal(recovered.results[0].kind,'EVIDENCE');assert.equal(io,1);assert.equal(f.event.status,'PROCESSED');assert.equal(f.event.lastError,null);
 assert.equal((await p.process(f.event.id)).done,true);assert.equal(io,1);assert.equal(f.projection.projectId,'project-b');
});

test('ordinary authorization observations and a missing reservation remain terminal, with no callback-derived permission or fallback',async()=>{
 for(const options of [{deferAuthorization:undefined},{deferAuthorization:async()=>false}]){const f=companyMediaRecoveryMemory(),p=processor(f,options);const result=await p.process(f.event.id);assert.equal(result.processed,true);assert.equal(result.businessApplied,false);assert.equal(result.code,'WORKER_CHANNEL_PARTICIPANT_REQUIRED');assert.equal(f.event.status,'PROCESSED');assert.equal((await p.process(f.event.id)).done,true);}
 const f=companyMediaRecoveryMemory();f.prepared=null;assert.equal((await processor(f).process(f.event.id)).processed,true);
});

test('forged callback truthy values do not defer and proof errors never invoke the callback',async()=>{
 const f=companyMediaRecoveryMemory();assert.equal((await processor(f,{deferAuthorization:async()=>({ready:true})}).process(f.event.id)).processed,true);
 const g=companyMediaRecoveryMemory();let calls=0;const p=processor(g,{deferAuthorization:async()=>{calls++;return true;},dispatch:async()=>{throw new WorkspaceError('WORKER_CHANNEL_PROOF_INTEGRITY',409);}});
 await assert.rejects(p.process(g.event.id),{code:'WORKER_CHANNEL_PROOF_INTEGRITY'});assert.equal(calls,0);assert.equal(g.event.status,'PENDING');
});

test('lease expiry during the reservation check fails CAS and rolls back deferral instead of advertising recovery success',async()=>{
 const f=companyMediaRecoveryMemory();const p=processor(f,{deferAuthorization:async(client,context)=>{assert.equal(f.open,1);const valid=await companyPreparedMediaRecovery(client,context,{environment:f.environment});f.clock+=60001;return valid;}});
 await assert.rejects(p.process(f.event.id),{code:'META_CUSTOMER_INBOX_LEASE_CHANGED'});assert.equal(f.event.status,'PENDING');assert.equal(f.event.outcome,undefined);assert.equal(f.event.lastError,'META_CUSTOMER_INBOX_LEASE_CHANGED');assert.equal(f.event.leaseToken,null);
});

test('prepared media with a committed receipt preserves businessApplied when later outbound authorization fails; retry still uses outbound once-only state',async()=>{
 const f=companyMediaRecoveryMemory();let sends=0;const p=processor(f,{dispatch:async()=>({kind:'EVIDENCE',businessApplied:true,receiptId:'canonical-evidence-receipt',reply:{type:'text',body:'Controlled receipt'}}),outbound:{send:async()=>{sends++;throw new WorkspaceError('WORKER_CHANNEL_PERMISSION_REQUIRED',403);}}});
 const result=await p.process(f.event.id);assert.equal(result.recoveryPending,true);assert.equal(result.businessApplied,true);assert.equal(result.receiptId,'canonical-evidence-receipt');assert.equal(result.replySent,false);assert.equal(sends,1);assert.equal(f.event.status,'PENDING');
});

const admin={role:'ADMIN',organizationId:'org-a',actorId:'admin-a'};
async function pending(f){await processor(f).process(f.event.id);return f;}
test('the existing web action is observable only for current ADMIN of B with approved individual identity, report permission, binding, assignment and active owner',async()=>{
 const f=await pending(companyMediaRecoveryMemory());assert.equal(await companyPreparedMediaRecoveryAuthorized(f.client,admin,{eventId:f.event.id,projectId:'project-b',environment:f.environment}),true);
 assert.equal(f.trace.some(q=>/FOR (UPDATE|SHARE)/.test(q)&&q.includes('"Worker"')),false,'The affordance is a read-only snapshot');
 for(const identity of [{...admin,role:'DIRECTOR'},{...admin,organizationId:'org-other'}])assert.equal(await companyPreparedMediaRecoveryAuthorized(f.client,identity,{eventId:f.event.id,projectId:'project-b',environment:f.environment}),false);
 assert.equal(await companyPreparedMediaRecoveryAuthorized(f.client,admin,{eventId:f.event.id,projectId:'project-a',environment:f.environment}),false);
});
for(const [name,change] of [
 ['PM revoked',f=>{f.projectMembershipActive=false;}],['TM revoked',f=>{f.tenantActive=false;}],
 ['report permission revoked',f=>{f.worker.metadata.participant.permissions.report=false;}],
 ['KYC no longer approved',f=>{f.worker.metadata.participant.kyc.status='REJECTED';}],
 ['binding revoked',f=>{f.binding.status='REVOKED';}],['owner suspended',f=>{f.owner.mode='SUSPENDED';}],
 ['assignment revoked',f=>{f.assignmentPresent=false;}],['assignment revision changed',f=>{f.owner.assignmentRevision++;}],
 ['project archived',f=>{f.projectActive=false;}],['grant expired',f=>{f.connection.metadata.customerVerification.expiresAt=new Date(f.clock-1).toISOString();}],
 ['generic pending error',f=>{f.event.lastError='META_CUSTOMER_PROCESSING_UNCONFIRMED';}],
 ['active lease',f=>{f.event.leaseToken='other-lease';f.event.leaseExpiresAt=new Date(f.clock+60000);}],
 ['malformed lease',f=>{f.event.leaseToken='other-lease';f.event.leaseExpiresAt='invalid';}],
])test('web recovery remains closed for '+name,async()=>{const f=await pending(companyMediaRecoveryMemory());change(f);assert.equal(await companyPreparedMediaRecoveryAuthorized(f.client,admin,{eventId:f.event.id,projectId:'project-b',environment:f.environment}),false);assert.equal(f.event.status,'PENDING');});

test('exact company operation GET reads A under immutable target B and reports only event state, never an invented saved/actor receipt',async()=>{
 const f=await pending(companyMediaRecoveryMemory()),connection={...f.connection,company:{mode:'COMPANY',targetProjectId:'project-b'}},request={operationId:'01234567-89ab-4cde-8fab-0123456789ab',eventId:f.event.id,action:'process_inbox'};
 const read=()=>readMetaCustomerInboxReceipt(f.client,admin,{id:'project-b'},connection,f.environment,request);
 const initial=await read();assert.equal(initial.state,'NOT_OBSERVED');assert.equal(initial.actorOperationVerified,false);assert.equal(initial.eventStatus,'PENDING');assert.equal(Object.hasOwn(initial,'saved'),false);assert.equal(Object.hasOwn(initial,'receiptId'),false);
 f.event.status='PROCESSED';f.event.outcome={version:1,businessApplied:true,receiptId:'canonical-evidence-receipt'};const result=await read();assert.equal(result.state,'EVENT_PROCESSED');assert.equal(result.actorOperationVerified,false);assert.equal(result.definitive,false);assert.equal(result.businessReceiptId,'canonical-evidence-receipt');assert.equal(Object.hasOwn(result,'saved'),false);
 for(const project of [{id:'project-a'},{id:'project-other'}])await assert.rejects(readMetaCustomerInboxReceipt(f.client,admin,project,connection,f.environment,request),{code:'META_CUSTOMER_INBOX_UNAVAILABLE'});
 await assert.rejects(readMetaCustomerInboxReceipt(f.client,{...admin,organizationId:'org-other'},{id:'project-b'},connection,f.environment,request),{code:'META_CUSTOMER_INBOX_UNAVAILABLE'});
 await assert.rejects(readMetaCustomerInboxReceipt(f.client,admin,{id:'project-b'},connection,f.environment,{...request,action:'review_inbox'}),{code:'META_CUSTOMER_INBOX_UNAVAILABLE'});
});
for(const state of ['SEND_STARTED','SEND_UNKNOWN',null])test('uncertain durable outbound blocks the web recovery affordance: '+state,async()=>{
 const f=await pending(companyMediaRecoveryMemory());f.currentOutbound={id:(await import('../src/lib/meta-customer-outbound.mjs')).customerOutboundId(f.event.id),payload:{},outcome:{state}};
 assert.equal(await companyPreparedMediaRecoveryAuthorized(f.client,admin,{eventId:f.event.id,projectId:'project-b',environment:f.environment}),false);assert.equal(f.event.status,'PENDING');
});
