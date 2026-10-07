import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {companyKycMemoryFixture} from './fixtures/company-kyc-memory.mjs';
import {cancelParticipantKycChat,publicParticipantKycChat} from '../src/lib/participant-kyc-chat-closure.mjs';
import {digest} from '../src/lib/workspace-policy.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {prepareMetaKycChallenge} from '../src/lib/meta-kyc-challenge.mjs';
import {createParticipantStore} from '../src/lib/participant-store.mjs';

// Extends the existing signed/planner/Clerk-acceptance fixture only for the new
// SQL statements. These tests do not claim PostgreSQL lock-race validation.
async function fixture(options={}){
 const f=await companyKycMemoryFixture(options),sql=[],control={hook:null,finalClock:null,updates:0};
 // The older in-memory adapter used r1/r2 and omitted the real KYC version.
 // Model the actual SELECT to_char and canonical roster shape explicitly.
 f.worker.metadata.participant.kyc.version=1;
 const revision=value=>/^r\d+$/.test(value)?'2026-10-07T00:00:00.'+value.slice(1).padStart(6,'0'):value;
 const rows=value=>({rows:structuredClone(value),rowCount:value.length});
 const query=async(text,args=[])=>{
  sql.push({text,args:structuredClone(args)});if(control.hook)await control.hook(text,args);
  if(text.startsWith('SELECT w.id,w."projectId",p."organizationId"'))return rows(args[0]===f.worker.id&&args[1]===f.target.id&&args[2]===f.target.organizationId?[{...f.worker,revision:revision(f.worker.revision),organizationId:f.target.organizationId}]:[]);
  if(text.startsWith('SELECT id,status::text AS status FROM public."Project"'))return rows(f.controls.projectActive&&args[1]===f.target.organizationId?[f.anchor,f.target].filter(p=>p.id===args[0]).map(p=>({id:p.id,status:'ACTIVE'})):[]);
  if(text.startsWith('SELECT metadata,clock_timestamp() AS now'))return rows(args[0]===f.worker.id&&args[1]===f.target.id?[{metadata:f.worker.metadata,now:control.finalClock===null?new Date(f.now):control.finalClock}]:[]);
  if(text.startsWith('SELECT')&&text.includes('FROM public."AuditLog"')){
   const all=[...f.audits.values()];let selected;
   if(text.includes("action='participant.kyc_chat.closed'"))selected=all.filter(a=>a.id===args[0]&&a.organizationId===args[1]&&a.action==='participant.kyc_chat.closed');
   else if(text.includes('ORDER BY "createdAt" DESC,id DESC LIMIT 1'))selected=all.filter(a=>a.organizationId===args[0]&&a.entityType==='Worker'&&a.entityId===args[1]&&a.action==='participant.operation.recorded'&&['REVOKE','RESTORE_ACCESS','EXISTING_ACCOUNT_ASSIGNED','INVITATION_ACCEPTED','INVITATION_SENT'].includes(a.metadata.kind)).sort((a,b)=>(b.createdAt?.getTime()||0)-(a.createdAt?.getTime()||0)||b.id.localeCompare(a.id)).slice(0,1);
   else if(text.includes('$4::boolean'))selected=all.filter(a=>a.organizationId===args[0]&&a.entityType==='Worker'&&a.entityId===args[1]&&(a.action==='participant.operation.recorded'&&a.metadata.kind==='KYC_SUBMITTED'&&(a.metadata.channelCapture?.challengeId===args[2]||a.metadata.challengeId===args[2])||args[3]&&['participant.kyc_chat.projected','participant.kyc_chat.dispatched'].includes(a.action)&&a.metadata.challengeId===args[2])).slice(0,1);
   else if(text.includes("metadata->>'kind'='INVITATION_ACCEPTED'"))selected=all.filter(a=>a.organizationId===args[0]&&a.action==='participant.operation.recorded'&&a.entityType==='Worker'&&a.entityId===args[1]&&a.metadata.kind==='INVITATION_ACCEPTED'&&a.metadata.invitationId===args[2]);
   else if(text.includes("metadata->>'kind'='INVITATION_SENT'"))selected=all.filter(a=>a.organizationId===args[0]&&a.action==='participant.operation.recorded'&&a.entityType==='Worker'&&a.entityId===args[1]&&a.metadata.kind==='INVITATION_SENT'&&a.metadata.invitationId===args[2]);
   else if(text.includes("action='participant.kyc_chat.prepared'"))selected=all.filter(a=>a.organizationId===args[0]&&a.actorId===args[1]&&a.entityType==='Worker'&&a.entityId===args[2]&&a.action==='participant.kyc_chat.prepared'&&a.metadata.challengeId===args[3]);
   else if(text.includes("metadata->>'kind'='PREPARE_KYC_CHAT'"))selected=all.filter(a=>a.organizationId===args[0]&&a.actorId===args[1]&&a.entityType==='Worker'&&a.entityId===args[2]&&a.action==='participant.operation.recorded'&&a.metadata.kind==='PREPARE_KYC_CHAT'&&a.metadata.challengeReceiptId===args[3]);
   else if(text.includes("WHERE id=$1")&&text.includes("action='participant.operation.recorded'"))selected=all.filter(a=>a.id===args[0]&&a.organizationId===args[1]&&a.action==='participant.operation.recorded');
   if(selected)return rows(selected);
  }
  if(text.startsWith('INSERT INTO public."AuditLog"')&&text.includes("'participant.kyc_chat.closed'")){
   assert.equal(f.audits.has(args[0]),false);f.audits.set(args[0],{id:args[0],organizationId:args[1],actorId:args[2],action:'participant.kyc_chat.closed',entityType:'Worker',entityId:args[3],metadata:JSON.parse(args[4])});return rows([]);
  }
  if(text.startsWith('UPDATE public."Worker"')&&text.endsWith('RETURNING id')){
   if(args[0]!==f.worker.id||args[1]!==f.target.id)return rows([]);
   f.worker.metadata=JSON.parse(args[2]);f.worker.revision='2026-10-07T00:00:00.'+String(++control.updates).padStart(6,'0');return rows([{id:f.worker.id}]);
  }
  return f.query(text,args);
 };
 const client={query},row=()=>({...f.worker,revision:revision(f.worker.revision),organizationId:f.target.organizationId});
 const input=()=>({operationId:randomUUID(),projectId:f.target.id,scope:'a'.repeat(64),action:'CANCEL_KYC_CHAT',payload:{workerId:f.worker.id,revision:revision(f.worker.revision),challengeId:f.worker.metadata.participant.kycChatChallenge.id,reason:'Cerrar la captura parcial explícitamente'}});
 async function run(command=input(),{member=f.issuer,writeOuter=true,afterOuter=null}={}){
  const snapshot=structuredClone({worker:f.worker,audits:[...f.audits]});
  try{
   await cancelParticipantKycChat.beforeProject(client,member,command);
   const value=await cancelParticipantKycChat(client,member,f.target,{operationId:command.operationId,...command.payload},{environment:f.environment});
   if(writeOuter&&!f.audits.has(value.closureReceiptId))f.audits.set(value.closureReceiptId,{id:value.closureReceiptId,organizationId:member.organizationId,actorId:member.actorId,entityType:'Worker',entityId:f.worker.id,action:'participant.operation.recorded',metadata:{version:1,projectId:f.target.id,requestDigest:digest(command),kind:'CANCEL_KYC_CHAT',closureReceiptId:value.receiptId,challengeId:value.challengeId}});
   if(afterOuter)await afterOuter(value);
   await cancelParticipantKycChat.afterWrite(client,member,command);return value;
  }catch(error){Object.assign(f.worker,snapshot.worker);f.audits.clear();for(const [id,a] of snapshot.audits)f.audits.set(id,a);throw error;}
 }
 const sealState=(value,contextProject=f.anchor.id)=>{
  const c=f.worker.metadata.participant.kycChatChallenge,e=f.worker.metadata.participant.kycChatConversation;
  e.encryptedState=encryptCustomerSecret(JSON.stringify({...value,challengeId:e.challengeId,lastEventId:e.lastEventId,lastMessageTimestamp:e.lastMessageTimestamp,expiresAt:e.expiresAt}),{organizationId:f.target.organizationId,projectId:contextProject,purpose:'kyc-chat-conversation',resourceId:c.id},f.environment);
 };
 const io=()=>[f.control.graph,f.control.cdn,f.controls.sends,f.blob.puts(),f.blob.objects.size];
 return {...f,client,row,input,run,sealState,sql,closureControl:control,io};
}
const projection=f=>publicParticipantKycChat(f.row(),{now:new Date(f.now),member:f.issuer,canManage:true,environment:f.environment});
const archives=f=>[...f.audits.values()].filter(a=>a.action==='participant.kyc_chat.closed');

test('lost untouched PENDING code is explicitly closed without renewing, deleting metadata or delivering anything',async()=>{
 const f=await fixture(),before=structuredClone(f.worker.metadata),prior=structuredClone([...f.audits]),calls=f.io();
 assert.equal(projection(f).canCancel,true);assert.equal(projection(f).canPrepare,false);
 const result=await f.run(),c=f.worker.metadata.participant.kycChatChallenge;
 assert.equal(result.kind,'CANCEL_KYC_CHAT');assert.equal(c.status,'CANCELLED');assert.equal(c.closureReceiptId,result.closureReceiptId);assert.equal(f.worker.metadata.participant.kycChatConversation,null);
 const restored={...c};for(const key of ['cancelledAt','cancelledBy','closureReceiptId'])delete restored[key];restored.status='PENDING';assert.deepEqual(restored,before.participant.kycChatChallenge);
 assert.deepEqual({...f.worker.metadata,participant:before.participant},before);assert.deepEqual(archives(f)[0].metadata.challenge,before.participant.kycChatChallenge);assert.equal(archives(f)[0].metadata.conversation,null);
 for(const [id,a] of prior)assert.deepEqual(f.audits.get(id),a);assert.deepEqual(f.io(),calls);assert.equal(projection(f).canPrepare,true);
 await assert.rejects(f.bridge.execute(f.receive(f.code)),error=>['META_KYC_CHALLENGE_REJECTED','META_KYC_NOT_APPLICABLE'].includes(error.code));assert.deepEqual(f.io(),calls);
});

test('signed CLAIMED capture then actual canonical Clerk acceptance can be stopped without rewriting its old authority',async()=>{
 const f=await fixture();await f.execute(f.code);await f.choose('Autorizar imágenes');await f.join();
 const before=structuredClone(f.worker.metadata),audits=structuredClone([...f.audits]),calls=f.io(),envelope=before.participant.kycChatConversation;
 await assert.rejects(f.bridge.execute(f.receive(f.code)),{code:'META_KYC_CHALLENGE_REVOKED'});
 assert.equal(projection(f).step,'OCR');assert.equal(projection(f).canCancel,true);
 const result=await f.run(),archive=archives(f)[0].metadata;
 assert.equal(result.saved,true);assert.deepEqual(archive.challenge,before.participant.kycChatChallenge);assert.deepEqual(archive.conversation,envelope);assert.equal(archive.step,'OCR');
 assert.deepEqual(f.worker.metadata.participant.kyc,before.participant.kyc);assert.deepEqual(f.worker.metadata.participant.permissions,before.participant.permissions);assert.equal(f.worker.metadata.participant.clerkUserId,before.participant.clerkUserId);assert.equal(f.worker.metadata.participant.kycChatChallenge.participantClerkUserId,null);
 for(const [id,a] of audits)assert.deepEqual(f.audits.get(id),a);assert.deepEqual(f.io(),calls);
 const state=JSON.parse(decryptCustomerSecret(archive.conversation.encryptedState,{organizationId:f.target.organizationId,projectId:f.anchor.id,purpose:'kyc-chat-conversation',resourceId:archive.challenge.id},f.environment));assert.equal(state.step,'OCR');
 assert.throws(()=>decryptCustomerSecret(archive.conversation.encryptedState,{organizationId:f.target.organizationId,projectId:f.target.id,purpose:'kyc-chat-conversation',resourceId:archive.challenge.id},f.environment));
 await assert.rejects(f.bridge.execute(f.receive('CANCELAR')),{code:'META_KYC_CHALLENGE_REVOKED'});assert.deepEqual(f.io(),calls);
});

test('account-bound PENDING acceptance may be cancelled, while its original JOIN and authority transition stay immutable',async()=>{
 const f=await fixture();await f.join();const before=structuredClone(f.worker.metadata.participant.kycChatChallenge),transition=structuredClone([...f.audits.values()].find(a=>a.action==='participant.kyc_chat.account_bound'));
 await f.run();assert.deepEqual(archives(f)[0].metadata.challenge,before);assert.deepEqual(f.audits.get(transition.id),transition);assert.equal(f.worker.metadata.participant.kycChatChallenge.participantClerkUserId,f.member.clerkUserId);assert.equal(f.worker.metadata.participant.kyc.status,'NOT_SUBMITTED');
});

test('same closure UUID replays the immutable extra receipt once; changed reason conflicts and a second UUID cannot close twice',async()=>{
 const f=await fixture(),command=f.input(),first=await f.run(command),before=structuredClone(f.worker.metadata),audits=structuredClone([...f.audits]);
 const replay=await f.run(command);assert.equal(replay.replayed,true);assert.equal(replay.receiptId,first.receiptId);assert.deepEqual(f.worker.metadata,before);assert.deepEqual([...f.audits],audits);assert.equal(archives(f).length,1);
 await assert.rejects(f.run({...command,payload:{...command.payload,reason:'Otro motivo de cierre explícito'}}),{code:'PARTICIPANT_OPERATION_CONFLICT'});
 await assert.rejects(f.run(),{code:'PARTICIPANT_KYC_CHAT_NOT_CANCELLABLE'});assert.deepEqual(f.worker.metadata,before);assert.deepEqual([...f.audits],audits);
});

test('old exact closure replay after a fresh real PREPARE returns its own receipt without touching the new code, TTL, issuer or draft',async()=>{
 const f=await fixture(),command=f.input(),closed=await f.run(command),prepareClient={query:f.query};
 await prepareMetaKycChallenge.beforeProject(prepareClient,f.issuer,{projectId:f.target.id});
 const next=await prepareMetaKycChallenge(prepareClient,f.issuer,f.target,{operationId:randomUUID(),workerId:f.worker.id,revision:f.worker.revision}),fresh=structuredClone(f.worker.metadata),audits=structuredClone([...f.audits]),calls=f.io();
 assert.notEqual(fresh.participant.kycChatChallenge.id,command.payload.challengeId);assert.equal(next.saved,true);
 const replay=await f.run(command);assert.equal(replay.replayed,true);assert.equal(replay.receiptId,closed.receiptId);assert.deepEqual(f.worker.metadata,fresh);assert.deepEqual([...f.audits],audits);assert.deepEqual(f.io(),calls);
 await assert.rejects(f.run({...command,payload:{...command.payload,reason:'Un motivo distinto para el mismo UUID'}}),{code:'PARTICIPANT_OPERATION_CONFLICT'});assert.deepEqual(f.worker.metadata,fresh);
 f.controls.issuerActive=false;await assert.rejects(f.run(command),{code:'PARTICIPANT_ACCESS_REQUIRED'});assert.deepEqual(f.worker.metadata,fresh);
});
test('old exact closure replays after actual canonical reINVITE removed the current challenge, without changing the fresh invitation',async()=>{
 const f=await fixture(),command=f.input(),closed=await f.run(command),rows=value=>({rows:structuredClone(value),rowCount:value.length});let invited=0;
 f.worker.metadata.participant.invitation.expiresAt=new Date(Date.now()-1000).toISOString();
 const client={query:async(sql,args=[])=>{
  if(sql.startsWith('SELECT')&&sql.includes('FROM public."Worker" WHERE id=$1'))return rows(args[0]===f.worker.id&&args[1]===f.target.id?[{...f.row(),name:'Synthetic invited participant'}]:[]);
  if(sql.startsWith('SELECT id FROM public."Worker" WHERE "projectId"=$1 AND id<>$3'))return rows([]);
  if(sql.startsWith('UPDATE public."Worker"')&&!sql.endsWith('RETURNING id')){f.worker.metadata=JSON.parse(args[2]);f.worker.revision='2026-10-07T00:00:00.'+String(++f.closureControl.updates).padStart(6,'0');return rows([]);}
  if(sql.startsWith('INSERT INTO public."AuditLog"')&&sql.includes("'participant.invitation.attempted'")){f.audits.set(args[0],{id:args[0],organizationId:args[1],actorId:args[2],action:'participant.invitation.attempted',entityType:'Worker',entityId:args[3],metadata:JSON.parse(args[4])});return rows([]);}
  return f.client.query(sql,args);
 }};
 const workspace={projectOperation:async(_session,context,_write,callback)=>callback(client,f.issuer,context.scope,f.target)},identity={createInvitation:async value=>{invited++;return {invitationId:value.invitationId,email:value.email,id:'orginv_Reinvited',role:'org:member',state:'pending',expiresAt:new Date(Date.now()+86400000).toISOString()};}},session={authenticated:true,verification:'clerk-production-jwt',userId:f.issuer.clerkUserId,organizationId:'org_Synthetic',organizationRole:'org:admin'};
 const store=createParticipantStore({workspace,connect:f.connect,identity,environment:f.environment});
 const result=await store.save(session,{operationId:randomUUID(),projectId:f.target.id,scope:command.scope,action:'INVITE',payload:{workerId:f.worker.id,revision:f.row().revision,email:'reinvited-synthetic@example.invalid'}});
 assert.equal(result.saved,true);assert.equal(invited,1);assert.equal(f.worker.metadata.participant.invitation.state,'SENT');assert.equal(f.worker.metadata.participant.kycChatChallenge,undefined);
 const fresh=structuredClone(f.worker.metadata),audits=structuredClone([...f.audits]),calls=f.io(),writes=f.closureControl.updates;
 const replay=await f.run(command);assert.equal(replay.replayed,true);assert.equal(replay.receiptId,closed.receiptId);assert.deepEqual(f.worker.metadata,fresh);assert.deepEqual([...f.audits],audits);assert.deepEqual(f.io(),calls);assert.equal(f.closureControl.updates,writes);
 await assert.rejects(f.run({...command,payload:{...command.payload,reason:'Un motivo distinto tras nueva invitación'}}),{code:'PARTICIPANT_OPERATION_CONFLICT'});assert.deepEqual(f.worker.metadata,fresh);
 f.controls.issuerActive=false;await assert.rejects(f.run(command),{code:'PARTICIPANT_ACCESS_REQUIRED'});assert.deepEqual(f.worker.metadata,fresh);
});
test('an orphan archived audit cannot fabricate the missing exterior receipt or silently repair cancellation history',async()=>{
 const f=await fixture(),command=f.input(),closed=await f.run(command);f.audits.delete(closed.closureReceiptId);const before=structuredClone(f.worker.metadata),audits=structuredClone([...f.audits]);
 await assert.rejects(f.run(command),{code:'PARTICIPANT_RECEIPT_INVALID'});assert.deepEqual(f.worker.metadata,before);assert.deepEqual([...f.audits],audits);
});
test('immutable receipt replay does not excuse an invalid present challenge or an inactive current Worker',async()=>{
 const f=await fixture(),command=f.input();await f.run(command);f.worker.metadata.participant.kycChatChallenge.projectId=f.anchor.id;
 const metadata=structuredClone(f.worker.metadata),audits=structuredClone([...f.audits]);await assert.rejects(f.run(command),{code:'PARTICIPANT_KYC_CHAT_INTEGRITY'});assert.deepEqual(f.worker.metadata,metadata);assert.deepEqual([...f.audits],audits);
 delete f.worker.metadata.participant.kycChatChallenge;f.worker.active=false;await assert.rejects(f.run(command),{code:'PARTICIPANT_KYC_CHAT_INTEGRITY'});assert.deepEqual([...f.audits],audits);
});

for(const step of ['CONSENT','OCR','BIOMETRIC','FRONT','SELFIE','CONFIRM'])test('authenticated partial '+step+' may be closed even after its unchanged conversation TTL',async()=>{
 const f=await fixture();await f.execute(f.code);f.sealState({...f.state(),version:1,step});f.now.setTime(Date.parse(f.worker.metadata.participant.kycChatConversation.expiresAt)+1);
 assert.equal(projection(f).expired,true);assert.equal(projection(f).canPrepare,false);assert.equal(projection(f).canCancel,true);await f.run();assert.equal(archives(f)[0].metadata.step,step);
});

for(const kind of ['step','confirmation'])test('confirmed '+kind+' cannot be cancelled or replaced, even expired and without a visible submission receipt',async()=>{
 const f=await fixture();await f.execute(f.code);const original=f.state();f.sealState({...original,step:kind==='step'?'FINALIZING':'CONFIRM',confirmationEventId:kind==='confirmation'?'customer_webhook_'+'f'.repeat(64):null});f.now.setTime(Date.parse(f.worker.metadata.participant.kycChatChallenge.expiresAt)+1);
 const before=structuredClone(f.worker.metadata),audits=structuredClone([...f.audits]);assert.equal(projection(f).canCancel,false);assert.equal(projection(f).canPrepare,false);assert.equal(projection(f).recoveryRequired,true);assert.equal(projection(f).blockedCode,'PARTICIPANT_KYC_CHAT_CONFIRMATION_PENDING');
 await assert.rejects(f.run(),{code:'PARTICIPANT_KYC_CHAT_CONFIRMATION_PENDING'});assert.deepEqual(f.worker.metadata,before);assert.deepEqual([...f.audits],audits);
});

for(const type of ['projected','dispatched','capture'])test('PENDING cannot hide a durable '+type+' source behind empty metadata',async()=>{
 const f=await fixture(),c=f.worker.metadata.participant.kycChatChallenge;f.audits.set('hidden',{id:'hidden',organizationId:f.target.organizationId,entityType:'Worker',entityId:f.worker.id,actorId:f.issuer.actorId,action:type==='capture'?'participant.operation.recorded':'participant.kyc_chat.'+type,metadata:{challengeId:c.id,kind:type==='capture'?'KYC_SUBMITTED':null,channelCapture:{challengeId:c.id}}});
 const before=structuredClone(f.worker.metadata);await assert.rejects(f.run(),{code:'PARTICIPANT_KYC_CHAT_CONFIRMATION_PENDING'});assert.deepEqual(f.worker.metadata,before);assert.equal(archives(f).length,0);
});
test('CLAIMED cannot hide a committed KYC_SUBMITTED receipt if current participant metadata still says NOT_SUBMITTED',async()=>{
 const f=await fixture();await f.execute(f.code);const c=f.worker.metadata.participant.kycChatChallenge;f.audits.set('hidden_capture',{id:'hidden_capture',organizationId:f.target.organizationId,entityType:'Worker',entityId:f.worker.id,actorId:f.issuer.actorId,action:'participant.operation.recorded',metadata:{kind:'KYC_SUBMITTED',channelCapture:{challengeId:c.id}}});await assert.rejects(f.run(),{code:'PARTICIPANT_KYC_CHAT_CONFIRMATION_PENDING'});assert.equal(archives(f).length,0);
});

for(const [name,mutate,code] of [
 ['another issuer',f=>{f.worker.metadata.participant.kycChatChallenge.issuerActorId='another-manager';},'PARTICIPANT_KYC_CHAT_ISSUER_REQUIRED'],
 ['another membership',f=>{f.worker.metadata.participant.kycChatChallenge.issuerMembershipId='other-member';},'PARTICIPANT_KYC_CHAT_ISSUER_REQUIRED'],
 ['issuer demoted',f=>{f.issuer.role='SITE_MANAGER';},'PARTICIPANT_MANAGE_REQUIRED'],
 ['issuer revoked',f=>{f.controls.issuerActive=false;},'PARTICIPANT_ACCESS_REQUIRED'],
 ['participant revoked without receipt',f=>{f.worker.metadata.participant.status='REVOKED';},'PARTICIPANT_KYC_CHAT_INTEGRITY'],
 ['phone changed',f=>{f.worker.phone='+19999999999';},'PARTICIPANT_KYC_CHAT_INTEGRITY'],
 ['foreign target',f=>{f.worker.metadata.participant.kycChatChallenge.projectId=f.anchor.id;},'PARTICIPANT_KYC_CHAT_INTEGRITY'],
 ['foreign organization',f=>{f.worker.metadata.participant.kycChatChallenge.organizationId='another-org';},'PARTICIPANT_KYC_CHAT_INTEGRITY'],
 ['prepared receipt missing',f=>{for(const [id,a] of f.audits)if(a.action==='participant.kyc_chat.prepared')f.audits.delete(id);},'PARTICIPANT_KYC_CHAT_INTEGRITY'],
 ['prepared outer receipt missing',f=>{for(const [id,a] of f.audits)if(a.metadata.kind==='PREPARE_KYC_CHAT')f.audits.delete(id);},'PARTICIPANT_KYC_CHAT_INTEGRITY'],
 ['invitation receipt missing',f=>{f.audits.delete('invite_receipt');},'PARTICIPANT_KYC_CHAT_INTEGRITY'],
 ['credential organization changed',f=>{f.connection.metadata.credentialOrganizationId='other-org';},'PARTICIPANT_KYC_CHAT_INTEGRITY'],
 ['asset changed',f=>{f.connection.phoneNumberId='999999999';},'PARTICIPANT_KYC_CHAT_INTEGRITY']
])test(name+' rejects cancellation without writing a receipt or evidence',async()=>{
 const f=await fixture();mutate(f);const before=structuredClone(f.worker.metadata),audits=structuredClone([...f.audits]),calls=f.io();await assert.rejects(f.run(),{code});assert.deepEqual(f.worker.metadata,before);assert.deepEqual([...f.audits],audits);assert.deepEqual(f.io(),calls);
});

for(const kind of ['missing','wrong-actor','wrong-digest','duplicate','own-revoked','own-pm-revoked'])test('partial acceptance '+kind+' must not stand in for the exact canonical own JOIN',async()=>{
 const f=await fixture();await f.execute(f.code);await f.join();const id=f.worker.metadata.participant.acceptanceReceiptId,a=f.audits.get(id);
 if(kind==='missing')f.audits.delete(id);if(kind==='wrong-actor')a.actorId=f.issuer.actorId;if(kind==='wrong-digest')a.metadata.requestDigest='f'.repeat(64);if(kind==='duplicate')f.audits.set('duplicate_accept',{...structuredClone(a),id:'duplicate_accept'});if(kind==='own-revoked')f.controls.workerMembershipActive=false;if(kind==='own-pm-revoked')f.controls.projectAssignmentActive=false;
 const before=structuredClone(f.worker.metadata);await assert.rejects(f.run(),error=>['PARTICIPANT_KYC_CHAT_INTEGRITY','PARTICIPANT_ACCESS_REQUIRED'].includes(error.code));assert.deepEqual(f.worker.metadata,before);assert.equal(archives(f).length,0);
});

for(const status of ['PENDING_ACCOUNT_CLAIM','PENDING_REVIEW','APPROVED'])test('current '+status+' KYC never becomes a cancellable draft',async()=>{
 const f=await fixture();f.worker.metadata.participant.kyc.status=status;assert.equal(projection(f).canCancel,false);assert.equal(projection(f).canPrepare,false);await assert.rejects(f.run(),{code:'PARTICIPANT_KYC_ALREADY_SUBMITTED'});
});
for(const corruption of ['wrong-aad','invalid-cipher','wrong-envelope','unknown-step'])test(corruption+' keeps encrypted uncertainty and never enables cancellation',async()=>{
 const f=await fixture();await f.execute(f.code);if(corruption==='wrong-aad')f.sealState(f.state(),f.target.id);if(corruption==='invalid-cipher')f.worker.metadata.participant.kycChatConversation.encryptedState='v2.invalid';if(corruption==='wrong-envelope')f.worker.metadata.participant.kycChatConversation.lastEventId='customer_webhook_'+'f'.repeat(64);if(corruption==='unknown-step')f.sealState({...f.state(),step:'UNEXPECTED'});
 const before=structuredClone(f.worker.metadata);assert.equal(projection(f).canCancel,false);assert.equal(projection(f).recoveryRequired,true);await assert.rejects(f.run(),{code:'PARTICIPANT_KYC_CHAT_INTEGRITY'});assert.deepEqual(f.worker.metadata,before);
});

test('expired challenge and revoked transport grant still allow an explicit local stop without touching the grant',async()=>{
 const f=await fixture();f.now.setTime(Date.parse(f.worker.metadata.participant.kycChatChallenge.expiresAt)+1);f.connection.enabled=false;f.connection.metadata.customerVerification.expiresAt=new Date(f.now.getTime()-1000).toISOString();const connection=structuredClone(f.connection);await f.run();assert.deepEqual(f.connection,connection);assert.equal(f.worker.metadata.participant.kycChatChallenge.status,'CANCELLED');
});
test('beforeProject obtains own principal and journey before sorted A/B project locks, never using the selected B as cipher AAD',async()=>{
 const f=await fixture();await f.execute(f.code);await f.join();await f.run();const locks=f.sql.filter(r=>r.text.includes('FOR UPDATE')&&r.text.includes('FROM public."Project"'));
 assert.deepEqual(locks.map(r=>r.args[0]),[f.anchor.id,f.target.id]);const firstProject=f.sql.indexOf(locks[0]),ownLock=f.sql.findIndex(r=>r.text.includes('FROM public."PlatformUser"')&&r.text.includes('FOR SHARE')&&r.args[0]===f.member.actorId),journey=f.sql.findIndex(r=>r.args[0]?.startsWith?.('person-worksite-journey-v1:'));assert.ok(ownLock>=0&&ownLock<firstProject);assert.ok(journey>=0&&journey<firstProject);
});
test('missing beforeProject cannot perform a cancellation even if caller supplies a manager and exact UUID',async()=>{
 const f=await fixture(),input=f.input();await assert.rejects(cancelParticipantKycChat(f.client,f.issuer,f.target,{operationId:input.operationId,...input.payload},{environment:f.environment}),{code:'WORKSPACE_CONTEXT_CHANGED'});assert.equal(archives(f).length,0);
});
for(const issue of ['outer-missing','outer-wrong-worker','final-clock','late-worker-change'])test(issue+' rolls back archive, cancellation and exterior receipt after writes',async()=>{
 const f=await fixture(),before=structuredClone(f.worker.metadata),audits=structuredClone([...f.audits]);
 await assert.rejects(f.run(f.input(),{writeOuter:issue!=='outer-missing',afterOuter:async value=>{if(issue==='outer-wrong-worker')f.audits.get(value.closureReceiptId).entityId='other-worker';if(issue==='final-clock')f.closureControl.finalClock=new Date(NaN);if(issue==='late-worker-change')f.worker.metadata.participant.kycChatChallenge.codeDigest='f'.repeat(64);}}),error=>['PARTICIPANT_RECEIPT_INVALID','PARTICIPANT_KYC_CHAT_INTEGRITY'].includes(error.code));
 assert.deepEqual(f.worker.metadata,before);assert.deepEqual([...f.audits],audits);assert.equal(archives(f).length,0);
});
test('projection is null only for no challenge, INVALID for malformed metadata and never exports private fields',async()=>{
 const f=await fixture();const view=projection(f);assert.deepEqual(Object.keys(view).sort(),['id','status','expiresAt','conversationExpiresAt','expired','canPrepare','canCancel','blockedCode','step','recoveryRequired','claimedAt','closedAt'].sort());
 for(const secret of [f.worker.phone,f.worker.metadata.participant.kycChatChallenge.codeDigest,f.issuer.actorId])assert.equal(JSON.stringify(view).includes(secret),false);
 const another=publicParticipantKycChat(f.row(),{now:f.now,member:{...f.issuer,actorId:'another-manager'},canManage:true,environment:f.environment});assert.equal(another.canCancel,false);assert.equal(another.blockedCode,'PARTICIPANT_KYC_CHAT_ISSUER_REQUIRED');
 f.worker.metadata.participant.kycChatChallenge={status:'CLAIMED'};const malformed=projection(f);assert.equal(malformed.status,'INVALID');assert.equal(malformed.canCancel,false);assert.equal(malformed.canPrepare,false);assert.equal(malformed.recoveryRequired,true);assert.equal(malformed.blockedCode,'PARTICIPANT_KYC_CHAT_INTEGRITY');
 delete f.worker.metadata.participant.kycChatChallenge;assert.equal(projection(f),null);
});

function revoke(f){
 const p=f.worker.metadata.participant;p.status='REVOKED';p.permissions={attendance:false,report:false};p.invitation.state='REVOKED';f.controls.projectAssignmentActive=false;
 f.audits.set('canonical_revoke',{id:'canonical_revoke',organizationId:f.target.organizationId,actorId:f.issuer.actorId,action:'participant.operation.recorded',entityType:'Worker',entityId:f.worker.id,createdAt:new Date(f.now.getTime()+1000),metadata:{version:1,projectId:f.target.id,kind:'REVOKE',requestDigest:digest(['synthetic canonical REVOKE',f.worker.id]),reason:'Revocación explícita de esta participación'}});
}
for(const own of [false,true])test('canonical REVOKE '+(own?'after own JOIN with disabled PM':'of the unaccepted invitation')+' permits only local closure and preserves revoked identity and permissions',async()=>{
 const f=await fixture();await f.execute(f.code);if(own)await f.join();revoke(f);const before=structuredClone(f.worker.metadata.participant),audits=structuredClone([...f.audits]),calls=f.io();
 assert.equal(projection(f).canCancel,true);await f.run();const p=f.worker.metadata.participant;assert.equal(p.status,'REVOKED');assert.equal(p.invitation.state,'REVOKED');assert.equal(p.clerkUserId,before.clerkUserId);assert.deepEqual(p.permissions,{attendance:false,report:false});assert.equal(p.kycChatChallenge.status,'CANCELLED');assert.equal(projection(f).canPrepare,false);assert.equal(f.controls.projectAssignmentActive,false);assert.deepEqual(f.io(),calls);for(const [id,a]of audits)assert.deepEqual(f.audits.get(id),a);
});
for(const cause of ['missing','foreign-project','foreign-worker','wrong-digest','later-restore','later-accept','own-membership-disabled','finalizing'])test('revoked closure '+cause+' cannot be authorized by a stale or unrelated revocation',async()=>{
 const f=await fixture();await f.execute(f.code);await f.join();revoke(f);const a=f.audits.get('canonical_revoke');
 if(cause==='missing')f.audits.delete(a.id);if(cause==='foreign-project')a.metadata.projectId=f.anchor.id;if(cause==='foreign-worker')a.entityId='worker_other';if(cause==='wrong-digest')a.metadata.requestDigest='bad';if(cause==='later-restore'||cause==='later-accept')f.audits.set('later_lifecycle',{...structuredClone(a),id:'later_lifecycle',createdAt:new Date(a.createdAt.getTime()+1000),metadata:{...a.metadata,kind:cause==='later-restore'?'RESTORE_ACCESS':'INVITATION_ACCEPTED'}});if(cause==='own-membership-disabled')f.controls.workerMembershipActive=false;if(cause==='finalizing')f.sealState({...f.state(),step:'FINALIZING',confirmationEventId:'customer_webhook_'+'a'.repeat(64)});
 const before=structuredClone(f.worker.metadata),audits=structuredClone([...f.audits]);await assert.rejects(f.run(),error=>['PARTICIPANT_KYC_CHAT_INTEGRITY','PARTICIPANT_ACCESS_REQUIRED','PARTICIPANT_KYC_CHAT_CONFIRMATION_PENDING'].includes(error.code));assert.deepEqual(f.worker.metadata,before);assert.deepEqual([...f.audits],audits);
});
