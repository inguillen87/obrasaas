import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {kycMemoryFixture} from './fixtures/meta-kyc-chat-memory.mjs';
import {createParticipantStore} from '../src/lib/participant-store.mjs';
import {digest} from '../src/lib/workspace-policy.mjs';

function fixture({publicId=true}={}){
 const f=kycMemoryFixture({active:true,captureImageSetVersion:2}),scope='a'.repeat(64),challengeId='kyc_chat_'+'a'.repeat(32),replacementId='kyc_chat_'+'b'.repeat(32),revision='2026-10-11T12:00:00.000001';f.worker.revision=revision;
 const client={async query(sql,args=[]){if(sql.startsWith('INSERT INTO public."AuditLog"')&&args.length===6){f.audits.set(args[0],{id:args[0],organizationId:args[1],actorId:args[2],entityType:args[3],entityId:args[4],action:'participant.operation.recorded',metadata:JSON.parse(args[5])});return {rows:[],rowCount:1};}return f.query(sql,args);}};
 const workspace={async projectOperation(_session,context,_writable,callback){assert.equal(context.projectId,f.project.id);assert.equal(context.scope,scope);return callback(client,f.issuer,scope,f.project);}};
 const prepareKycChat=async(_client,member,project,input)=>{
  const receiptId='meta_kyc_challenge_'+digest([member.actorId,project.id,input.operationId]),c=f.worker.metadata.participant.kycChatChallenge;c.id=challengeId;
  f.audits.set(receiptId,{id:receiptId,organizationId:member.organizationId,actorId:member.actorId,entityType:'Worker',entityId:f.worker.id,action:'participant.kyc_chat.prepared',metadata:{version:1,projectId:project.id,challengeId,expiresAt:c.expiresAt,captureImageSetVersion:2,requestDigest:digest(['synthetic-request',input])}});
  return {saved:true,kind:'PREPARE_KYC_CHAT',receiptId,code:f.code,codeUnavailable:false,expiresAt:c.expiresAt,...(publicId?{challengeId}:{})};
 };
 const store=createParticipantStore({workspace,connect:f.connect,prepareKycChat,environment:f.environment}),session={authenticated:true,verification:'clerk-production-jwt',userId:'user_ManagerA',organizationId:'org_Synthetic',organizationRole:'org:admin'},command={operationId:randomUUID(),projectId:f.project.id,scope,action:'PREPARE_KYC_CHAT',payload:{workerId:f.worker.id,revision}};
 return {...f,store,session,command,scope,challengeId,replacementId};
}

test('fresh response pins one-time code to its public challenge; replay and receipt status retain original A after current B',async()=>{
 const f=fixture(),fresh=await f.store.save(f.session,f.command);assert.equal(fresh.challengeId,f.challengeId);assert.equal(fresh.code,f.code);assert.equal(fresh.codeUnavailable,false);
 const operation=f.audits.get(fresh.receiptId);assert.equal(operation.metadata.challengeId,f.challengeId);assert.equal(JSON.stringify([...f.audits.values()]).includes(f.code),false);
 f.worker.metadata.participant.kycChatChallenge.id=f.replacementId;const before=JSON.stringify(f.worker),audits=f.audits.size;
 const replay=await f.store.save(f.session,f.command),status=await f.store.status(f.session,{projectId:f.project.id,scope:f.scope,operationId:f.command.operationId});
 for(const value of [replay,status]){assert.equal(value.challengeId,f.challengeId);assert.notEqual(value.challengeId,f.replacementId);assert.equal(value.codeUnavailable,true);assert.equal(Object.hasOwn(value,'code'),false);assert.equal(value.receiptId,fresh.receiptId);}
 assert.equal(JSON.stringify(f.worker),before);assert.equal(f.audits.size,audits);assert.equal(f.controls.sends,0);assert.equal(f.controls.downloads,0);assert.equal(f.blob.puts(),0);
});
for(const [label,change]of[
 ['missing original ID',(f,a)=>{delete f.audits.get(a.metadata.challengeReceiptId).metadata.challengeId;}],
 ['missing preparation receipt',(f,a)=>{f.audits.delete(a.metadata.challengeReceiptId);}],
 ['mismatched receipt ID',(f,a)=>{a.metadata.challengeId=f.replacementId;}],
 ['wrong preparation project',(f,a)=>{f.audits.get(a.metadata.challengeReceiptId).metadata.projectId='foreign-project';}],
 ['wrong preparation expiration',(f,a)=>{f.audits.get(a.metadata.challengeReceiptId).metadata.expiresAt='2026-10-12T00:00:00.000Z';}],
])test(label+' preserves the operation receipt without reconstructing code or borrowing current challenge B',async()=>{
 const f=fixture(),fresh=await f.store.save(f.session,f.command),audit=f.audits.get(fresh.receiptId);f.worker.metadata.participant.kycChatChallenge.id=f.replacementId;change(f,audit);
 const value=await f.store.status(f.session,{projectId:f.project.id,scope:f.scope,operationId:f.command.operationId});assert.equal(value.receiptId,fresh.receiptId);assert.equal(value.codeUnavailable,true);assert.equal(value.challengeId,undefined);assert.equal(Object.hasOwn(value,'code'),false);
});
test('an adapter without a proven public challenge ID never releases its one-time secret',async()=>{
 const f=fixture({publicId:false}),value=await f.store.save(f.session,f.command);assert.equal(value.saved,true);assert.equal(value.codeUnavailable,true);assert.equal(value.challengeId,undefined);assert.equal(Object.hasOwn(value,'code'),false);assert.ok(value.receiptId);
});
