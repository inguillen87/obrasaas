import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {companyKycMemoryFixture} from './fixtures/company-kyc-memory.mjs';
import {createParticipantStore} from '../src/lib/participant-store.mjs';
import {prepareMetaKycChallenge} from '../src/lib/meta-kyc-challenge.mjs';
import {publicParticipantKycChat} from '../src/lib/participant-kyc-chat-closure.mjs';
import {participantKycChatCapabilities,participantOnboardingNextStep} from '../src/app/(identity)/cuenta/participant-onboarding-next-step.mjs';

// Canonical store/bridge commands with signed synthetic events, private synthetic
// storage and in-memory SQL. This does not prove PostgreSQL locks or live delivery.
async function retryFixture(){
 const f=await companyKycMemoryFixture({captureImageSetVersion:2,historicalChallengeVersion:2});await f.join();
 const scope='a'.repeat(64),rows=value=>({rows:structuredClone(value),rowCount:value.length});let writes=0;
 const revision=()=>/^r\d+$/.test(f.worker.revision)?'2026-10-07T00:00:00.'+f.worker.revision.slice(1).padStart(6,'0'):f.worker.revision;
 const client={query:async(sql,args=[])=>{
  if(sql.startsWith('SELECT')&&sql.includes('FROM public."Worker" WHERE id=$1'))return rows(args[0]===f.worker.id&&args[1]===f.target.id?[{...f.worker,name:'Synthetic retry participant',revision:revision()}]:[]);
  if(sql.startsWith('SELECT metadata')&&sql.includes("metadata->>'kind'='KYC_SUBMITTED'"))return rows([...f.audits.values()].filter(a=>a.organizationId===args[0]&&a.entityId===args[1]&&a.action==='participant.operation.recorded'&&a.metadata.kind==='KYC_SUBMITTED'&&a.metadata.submissionId===args[2]).map(a=>({metadata:a.metadata})));
  if(sql.startsWith('UPDATE public."Worker"')){assert.equal(args[0],f.worker.id);assert.equal(args[1],f.target.id);f.worker.metadata=JSON.parse(args[2]);f.worker.revision='2026-10-07T01:00:00.'+String(++writes).padStart(6,'0');return rows([]);}
  return f.query(sql,args);
 }};
 let currentMember=f.issuer;
 const workspace={projectOperation:async(_session,context,_write,callback,beforeProject)=>{assert.equal(context.projectId,f.target.id);assert.equal(context.scope,scope);if(beforeProject)await beforeProject(client,currentMember,scope);return callback(client,currentMember,scope,f.target);}};
 const store=createParticipantStore({workspace,connect:f.connect,environment:f.environment,prepareKycChat:prepareMetaKycChallenge});
 const session={authenticated:true,verification:'clerk-production-jwt',userId:f.issuer.clerkUserId,organizationId:'org_Synthetic',organizationRole:'org:admin'};
 const command=(action,payload={})=>({operationId:randomUUID(),projectId:f.target.id,scope,action,payload:{workerId:f.worker.id,revision:revision(),...payload}});
 const capture=async code=>{const initial=await f.execute(code);await f.choose('Autorizar imágenes');await f.choose('Autorizar dorso');await f.choose('Sin lectura asistida');await f.choose(f.state().biometricNoticeVersion==='participant-private-biometric-v3'?'Revisión manual':'Sin comparación facial');await f.image();await f.image();await f.image();const final=await f.choose(f.state().biometricNoticeVersion==='participant-private-biometric-v3'?'Presentar identidad':'Guardar identidad');return{initial,final};};
 const io=()=>[f.control.graph,f.control.cdn,f.controls.sends,f.blob.puts(),f.blob.objects.size];
 const projection=()=>publicParticipantKycChat({...f.worker,organizationId:f.target.organizationId},{now:new Date(f.now),member:currentMember,canManage:currentMember.identityOnly!==true&&['ADMIN','DIRECTOR'].includes(currentMember.role),environment:f.environment});
 return{...f,client,store,session,scope,command,capture,io,projection,member:value=>currentMember=value,writes:()=>writes};
}

test('canonical rejection reopens only a fresh code: old signed codes/confirmation stay invalid, UUID replay is secretless, and new evidence still needs independent review',async()=>{
 const f=await retryFixture(),permissions=structuredClone(f.worker.metadata.participant.permissions),first=await f.capture(f.code),s1=f.worker.metadata.participant.kyc.submissionId;
 assert.deepEqual(f.worker.metadata.participant.permissions,permissions);assert.equal(f.worker.metadata.participant.kyc.status,'PENDING_REVIEW');assert.equal(f.projection().canPrepare,false);
 const rejection=await f.store.save(f.session,f.command('REVIEW_KYC',{submissionId:s1,decision:'REJECTED',reason:'Synthetic independent request for clearer images'}));
 assert.equal(rejection.saved,true);assert.equal(f.worker.metadata.participant.kyc.review.actorId,f.issuer.actorId);assert.notEqual(f.worker.metadata.participant.clerkUserId,f.session.userId);
 assert.equal(f.projection().canPrepare,true);assert.equal(f.projection().canCancel,false);
 const dto={...rejection.participant,kycChatChallenge:f.projection()},input={context:{verified:true,scope:f.scope,projectId:f.target.id,now:f.now.getTime()},snapshot:{scope:f.scope,projectId:f.target.id,canManage:true,canInvite:true,records:[dto]},workerId:f.worker.id};
 assert.equal(participantKycChatCapabilities(dto,true,f.now.getTime()).canPrepare,true);assert.equal(participantOnboardingNextStep(input).primary.action,'PREPARE_KYC_CHAT');
 const beforeReplay=structuredClone(f.worker.metadata),beforeIo=f.io(),beforeAudit=structuredClone([...f.audits]);
 assert.deepEqual(await f.bridge.execute(first.initial.context),first.initial.result);assert.deepEqual(await f.bridge.execute(first.final.context),first.final.result);
 assert.deepEqual(f.worker.metadata,beforeReplay);assert.deepEqual([...f.audits],beforeAudit);assert.deepEqual(f.io(),beforeIo);
 await assert.rejects(f.bridge.execute(f.receive(f.code)),{code:'META_KYC_CHALLENGE_REJECTED'});assert.deepEqual(f.io(),beforeIo);
 const originalChallenge=structuredClone(f.worker.metadata.participant.kycChatChallenge),rejected=structuredClone(f.worker.metadata.participant.kyc),audits=structuredClone([...f.audits]),prepare=f.command('PREPARE_KYC_CHAT');
 const fresh=await f.store.save(f.session,prepare),current=f.worker.metadata.participant.kycChatChallenge;
 assert.equal(fresh.codeUnavailable,false);assert.match(fresh.code,/^IDENTIDAD [A-Za-z0-9_-]{43}$/);assert.notEqual(current.id,originalChallenge.id);assert.notEqual(current.codeDigest,originalChallenge.codeDigest);assert.equal(current.status,'PENDING');assert.equal(f.worker.metadata.participant.kycChatConversation,null);
 assert.deepEqual(f.worker.metadata.participant.kyc,rejected);assert.deepEqual(f.worker.metadata.participant.permissions,permissions);assert.deepEqual(f.io(),beforeIo);for(const[id,a]of audits)assert.deepEqual(f.audits.get(id),a);
 const freshMetadata=structuredClone(f.worker.metadata),freshAudits=structuredClone([...f.audits]),writes=f.writes();
 const replay=await f.store.save(f.session,prepare);assert.equal(replay.replayed,true);assert.equal(replay.codeUnavailable,true);assert.equal(Object.hasOwn(replay,'code'),false);assert.equal(replay.receiptId,fresh.receiptId);assert.deepEqual(f.worker.metadata,freshMetadata);assert.deepEqual([...f.audits],freshAudits);assert.equal(f.writes(),writes);assert.deepEqual(f.io(),beforeIo);
 for(const event of [f.receive(f.code),first.initial.context,first.final.context])await assert.rejects(f.bridge.execute(event),{code:'META_KYC_CHALLENGE_REJECTED'});
 assert.deepEqual(f.worker.metadata,freshMetadata);assert.deepEqual([...f.audits],freshAudits);assert.deepEqual(f.io(),beforeIo);
 await f.capture(fresh.code);const k=f.worker.metadata.participant.kyc,s2=k.submissionId;
 assert.notEqual(s2,s1);assert.equal(k.status,'PENDING_REVIEW');assert.equal(k.review,undefined);assert.equal(k.images.length,3);assert.equal(k.channelCapture.challengeId,current.id);assert.equal(k.documentBackConsent.allowed,true);assert.equal(k.ocrConsent.allowed,false);assert.equal(k.biometricConsent.allowed,false);assert.deepEqual(f.worker.metadata.participant.permissions,permissions);assert.equal(f.projection().canPrepare,false);
 const submitted=[...f.audits.values()].filter(a=>a.metadata.kind==='KYC_SUBMITTED');assert.equal(submitted.length,2);for(const id of [s1,s2])assert.equal(submitted.filter(a=>a.metadata.submissionId===id).length,1);
 const ownSession={...f.session,userId:f.worker.metadata.participant.clerkUserId},pending=structuredClone(f.worker.metadata),pendingAudits=structuredClone([...f.audits]);
 await assert.rejects(f.store.save(ownSession,f.command('REVIEW_KYC',{submissionId:s2,decision:'APPROVED',reason:'Synthetic self review must be denied'})),{code:'PARTICIPANT_SELF_REVIEW_REJECTED'});assert.deepEqual(f.worker.metadata,pending);assert.deepEqual([...f.audits],pendingAudits);
 await assert.rejects(f.store.save(f.session,f.command('REVIEW_KYC',{submissionId:s1,decision:'APPROVED',reason:'Synthetic stale review must be denied'})),{code:'PARTICIPANT_KYC_NOT_PENDING'});
 const approved=await f.store.save(f.session,f.command('REVIEW_KYC',{submissionId:s2,decision:'APPROVED',reason:'Synthetic independent review of fresh evidence'}));assert.equal(approved.saved,true);assert.equal(f.worker.metadata.participant.kyc.status,'APPROVED');assert.deepEqual(f.worker.metadata.participant.permissions,permissions);assert.equal(f.projection().canPrepare,false);
});

for(const role of ['EMPLOYEE','AUDITOR'])test('new preparation after rejection still requires an operational manager: '+role,async()=>{
 const f=await retryFixture();await f.capture(f.code);await f.store.save(f.session,f.command('REVIEW_KYC',{submissionId:f.worker.metadata.participant.kyc.submissionId,decision:'REJECTED',reason:'Synthetic independent rejection before role test'}));
 f.member({...f.issuer,role});const before=structuredClone(f.worker.metadata),audits=structuredClone([...f.audits]),calls=f.io();await assert.rejects(f.store.save(f.session,f.command('PREPARE_KYC_CHAT')),error=>['PARTICIPANT_MANAGE_REQUIRED','META_KYC_COMPANY_PROJECTION_REJECTED'].includes(error.code));assert.deepEqual(f.worker.metadata,before);assert.deepEqual([...f.audits],audits);assert.deepEqual(f.io(),calls);assert.equal(f.projection().canPrepare,false);
});


for(const [name,mutate,code]of [
 ['identity admission pending',f=>f.member({...f.issuer,identityOnly:true}),'PARTICIPANT_KYC_REVIEW_REQUIRED'],
 ['foreign tenant',f=>f.member({...f.issuer,organizationId:'company-other'}),'META_KYC_CHALLENGE_REVOKED'],
 ['revoked participation',f=>f.worker.metadata.participant.status='REVOKED','PARTICIPANT_ACCESS_REQUIRED'],
 ...['PENDING_ACCOUNT_CLAIM','PENDING_REVIEW','APPROVED'].map(status=>[status,f=>f.worker.metadata.participant.kyc.status=status,'PARTICIPANT_KYC_ALREADY_SUBMITTED']),
])test('rejected retry does not bypass the canonical '+name+' gate',async()=>{
 const f=await retryFixture();await f.capture(f.code);await f.store.save(f.session,f.command('REVIEW_KYC',{submissionId:f.worker.metadata.participant.kyc.submissionId,decision:'REJECTED',reason:'Synthetic independent rejection for boundary validation'}));mutate(f);
 const before=structuredClone(f.worker.metadata),audits=structuredClone([...f.audits]),calls=f.io();await assert.rejects(f.store.save(f.session,f.command('PREPARE_KYC_CHAT')),{code});assert.deepEqual(f.worker.metadata,before);assert.deepEqual([...f.audits],audits);assert.deepEqual(f.io(),calls);
});

for(const stage of ['PENDING','CLAIMED','CONFIRM'])for(const expired of [false,true])test('fresh UUID cannot overwrite open '+stage+' capture'+(expired?' after its expiry':''),async()=>{
 const f=await retryFixture();if(stage==='CLAIMED')await f.execute(f.code);if(stage==='CONFIRM')await f.toConfirmation();if(expired)f.now.setTime(Date.parse(f.worker.metadata.participant.kycChatChallenge.expiresAt)+1);
 const before=structuredClone(f.worker.metadata),audits=structuredClone([...f.audits]),calls=f.io();assert.equal(f.projection().canPrepare,false);await assert.rejects(f.store.save(f.session,f.command('PREPARE_KYC_CHAT')),{code:'PARTICIPANT_KYC_CHAT_CLOSURE_REQUIRED'});assert.deepEqual(f.worker.metadata,before);assert.deepEqual([...f.audits],audits);assert.deepEqual(f.io(),calls);
});
