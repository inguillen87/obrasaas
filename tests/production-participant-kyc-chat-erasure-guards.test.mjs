import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {companyKycMemoryFixture} from './fixtures/company-kyc-memory.mjs';
import {createParticipantStore} from '../src/lib/participant-store.mjs';

for(const action of ['INVITE','ASSIGN_EXISTING'])for(const status of ['PENDING','CLAIMED'])for(const lifecycle of ['expired','revoked'])test(action+' '+lifecycle+' cannot erase '+status+' before identity provider or Worker UPDATE',async()=>{
 const f=await companyKycMemoryFixture();f.worker.metadata.participant.kyc.version=1;
 if(status==='CLAIMED')await f.execute(f.code);
 f.worker.revision='2026-10-07T00:00:00.000001';const p=f.worker.metadata.participant;
 if(lifecycle==='expired')p.invitation.expiresAt=new Date(f.now.getTime()-1000).toISOString();
 else {p.status='REVOKED';p.invitation.state='REVOKED';p.permissions={attendance:false,report:false};}
 const before=structuredClone(f.worker.metadata),audits=structuredClone([...f.audits]),io=[f.control.graph,f.control.cdn,f.controls.sends,f.blob.puts()],calls={createInvitation:0,verifyMembership:0,verifiedEmail:0,updates:0,inserts:0},rows=values=>({rows:structuredClone(values),rowCount:values.length});
 const client={query:async(sql,args=[])=>{
  if(sql.startsWith('SELECT')&&sql.includes('FROM public."Worker" WHERE id=$1'))return rows(args[0]===f.worker.id&&args[1]===f.target.id?[{...f.worker,name:'Synthetic partial participant'}]:[]);
  if(sql.startsWith('SELECT')&&sql.includes('FROM public."AuditLog" WHERE id=$1'))return rows([...f.audits.values()].filter(a=>a.id===args[0]&&a.organizationId===args[1]&&a.actorId===args[2]));
  if(sql.startsWith('SELECT tm.id,')&&sql.includes('FROM public."TenantMembership"'))return rows(args[0]===f.member.membershipId&&args[1]===f.target.organizationId?[{id:f.member.membershipId,clerkUserId:f.member.clerkUserId,primaryEmail:'synthetic-acceptance@example.invalid',clerkRole:'org:member'}]:[]);
  if(sql.startsWith('UPDATE public."Worker"'))calls.updates++;
  if(sql.startsWith('INSERT'))calls.inserts++;
  return f.query(sql,args);
 }};
 const workspace={projectOperation:async(_session,context,_write,callback,beforeProject)=>{
  assert.equal(context.projectId,f.target.id);assert.equal(context.scope,'a'.repeat(64));
  if(beforeProject)await beforeProject(client,f.issuer,context.scope);
  return callback(client,f.issuer,context.scope,f.target);
 }};
 const identity={
  createInvitation:async()=>{calls.createInvitation++;throw new Error('SYNTHETIC_PROVIDER_MUST_NOT_BE_CALLED');},
  verifyMembership:async()=>{calls.verifyMembership++;return {role:'org:member'};},
  verifiedEmail:async()=>{calls.verifiedEmail++;return 'synthetic-acceptance@example.invalid';}
 };
 const store=createParticipantStore({workspace,connect:f.connect,identity,environment:f.environment}),session={authenticated:true,verification:'clerk-production-jwt',userId:f.issuer.clerkUserId,organizationId:'org_Synthetic',organizationRole:'org:admin'};
 const payload=action==='INVITE'?{workerId:f.worker.id,revision:f.worker.revision,email:'another-synthetic@example.invalid'}:{workerId:f.worker.id,revision:f.worker.revision,membershipId:f.member.membershipId,reason:'Asignación explícita de la cuenta'};
 await assert.rejects(store.save(session,{operationId:randomUUID(),projectId:f.target.id,scope:'a'.repeat(64),action,payload}),{code:'PARTICIPANT_KYC_CHAT_CLOSURE_REQUIRED'});
 assert.deepEqual(calls,{createInvitation:0,verifyMembership:0,verifiedEmail:0,updates:0,inserts:0});assert.deepEqual(f.worker.metadata,before);assert.deepEqual([...f.audits],audits);assert.deepEqual([f.control.graph,f.control.cdn,f.controls.sends,f.blob.puts()],io);
});
