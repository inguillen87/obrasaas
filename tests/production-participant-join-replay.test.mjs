import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createParticipantStore} from '../src/lib/participant-store.mjs';
import {participantReceiptId} from '../src/lib/participant-policy.mjs';

const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Actor',organizationId:'org_A',organizationRole:'org:member'};
const invitationId='invite_'+'a'.repeat(32);
function fixture({canonicalRole='org:member',tenantActive=true,projectAssigned=true,receiptExists=true,receiptPatch={},metadataPatch={}}={}){
 const receiptId=participantReceiptId('actor-a','project-a',randomUUID());
 const row={id:'worker-a',name:'Synthetic participant',active:true,projectId:'project-a',organizationId:'company-a',projectName:'Synthetic worksite',organizationName:'Synthetic company',revision:'2026-10-01T00:00:00.000001',metadata:{participant:{version:1,status:'ACTIVE',clerkUserId:session.userId,permissions:{attendance:true,report:true},invitation:{id:invitationId,state:'ACCEPTED',email:'actor@example.invalid',providerId:'orginv_A',expiresAt:'2099-01-01T00:00:00.000Z'},acceptanceReceiptId:receiptId}}};
 const receipt={id:receiptId,organizationId:'company-a',actorId:'actor-a',action:'participant.operation.recorded',entityType:'Worker',entityId:row.id,...receiptPatch,metadata:{version:1,projectId:row.projectId,kind:'INVITATION_ACCEPTED',invitationId,...metadataPatch}};
 const queries=[],providerCalls=[];
 const query=async(sql,args=[])=>{
  queries.push({sql,args});
  if(/^(BEGIN|ROLLBACK|COMMIT|SET LOCAL)/.test(sql)||sql.includes('pg_advisory_xact_lock'))return {rows:[]};
  assert.ok(sql.startsWith('SELECT'),'Acceptance replay must not alter business records');
  if(sql.includes('FROM public."Worker" w JOIN')){assert.deepEqual(args,[session.organizationId,invitationId]);return {rows:[structuredClone(row)]};}
  if(sql.includes('FROM public."Worker" WHERE id=$1')){assert.deepEqual(args,[row.id,row.projectId]);return {rows:[structuredClone(row)]};}
  if(sql.includes('SELECT tm.id AS "membershipId"')){assert.deepEqual(args,[row.organizationId,session.userId,session.organizationRole]);return {rows:tenantActive&&canonicalRole===args[2]?[{membershipId:'member-a',actorId:'actor-a'}]:[]};}
  if(sql.includes('SELECT m.id FROM public."TenantMembership" m JOIN public."PlatformUser" u ON u.id=m."userId" JOIN public."ProjectMembership"')){assert.deepEqual(args,['member-a',row.organizationId,session.userId,row.projectId]);return {rows:tenantActive&&projectAssigned?[{id:'member-a'}]:[]};}
  if(sql.includes('FROM public."AuditLog"')){assert.deepEqual(args,[receiptId,row.organizationId,'actor-a']);return {rows:receiptExists&&receipt.id===args[0]&&receipt.organizationId===args[1]&&receipt.actorId===args[2]&&receipt.action==='participant.operation.recorded'?[receipt]:[]};}
  if(sql.includes('SELECT id FROM public."Project"')){assert.deepEqual(args,[row.projectId,row.organizationId]);return {rows:[{id:row.projectId}]};}
  if(sql.includes('SELECT id FROM public."Worker"')){assert.deepEqual(args,[row.id,row.projectId]);return {rows:[{id:row.id}]};}
  if(sql.includes('SELECT id FROM public."PlatformUser"')){assert.deepEqual(args,[session.userId]);return {rows:[{id:'actor-a'}]};}
  if(sql.includes('SELECT m.id FROM public."TenantMembership"')){assert.deepEqual(args,[session.userId,session.organizationId]);return {rows:[{id:'member-a'}]};}
  assert.fail('Unexpected acceptance replay query '+sql);
 };
 const connect=async()=>({query,release(){}});
 const identity={
  verifiedEmail:async()=>{providerCalls.push('email');return 'actor@example.invalid';},
  findInvitation:async()=>{providerCalls.push('invitation');return {id:'orginv_A',invitationId,email:'actor@example.invalid',role:'org:member',state:'accepted',expiresAt:'2099-01-01T00:00:00.000Z'};},
  verifyMembership:async()=>{providerCalls.push('membership');return {userId:session.userId,organizationId:session.organizationId,role:'org:member'};}
 };
 const store=createParticipantStore({connect,identity,workspace:{}});
 return {store,row,receipt,queries,providerCalls,replay:()=>store.join(session,{invitationId,operationId:randomUUID()},{accept:true})};
}

test('valid acceptance replay reuses the exact original audit and current access without mutations',async()=>{
 const f=fixture(),before=JSON.stringify([f.row,f.receipt]);
 const recovered=await f.store.join(session,{invitationId});
 assert.deepEqual(f.providerCalls,[],'Canonical GET recovery does not consult identity');
 const replayed=await f.replay();
 assert.deepEqual(replayed,recovered);
 assert.equal(replayed.receiptId,f.receipt.id);assert.equal(replayed.replayed,true);
 assert.equal(replayed.state,'ACTIVE');assert.equal(replayed.canAccept,false);
 assert.equal(replayed.joined,true);assert.equal(replayed.saved,true);
 assert.deepEqual(f.providerCalls,['email','invitation','membership']);
 assert.equal(f.queries.filter(query=>query.sql.includes('FROM public."AuditLog"')).length,2);
 assert.equal(JSON.stringify([f.row,f.receipt]),before);
});

for(const [name,options] of [
 ['official role changed',{canonicalRole:'org:admin'}],
 ['tenant membership disabled',{tenantActive:false}],
 ['project assignment disabled',{projectAssigned:false}]
])test('acceptance POST replay requires the same current access as GET: '+name,async()=>{
 const f=fixture(options),before=JSON.stringify([f.row,f.receipt]);
 await assert.rejects(f.store.join(session,{invitationId}),{code:'PARTICIPANT_ACCESS_REQUIRED'});
 await assert.rejects(f.replay(),{code:'PARTICIPANT_ACCESS_REQUIRED'});
 assert.equal(f.queries.some(query=>query.sql.includes('FROM public."AuditLog"')),false,'Private receipt is not read before authorization');
 assert.equal(JSON.stringify([f.row,f.receipt]),before);
});

for(const [name,options] of [
 ['missing audit',{receiptExists:false}],
 ['foreign actor',{receiptPatch:{actorId:'another-actor'}}],
 ['foreign company',{receiptPatch:{organizationId:'company-b'}}],
 ['wrong operation action',{receiptPatch:{action:'another.operation'}}],
 ['wrong entity type',{receiptPatch:{entityType:'TenantMembership'}}],
 ['wrong worker',{receiptPatch:{entityId:'worker-b'}}],
 ['unknown audit version',{metadataPatch:{version:2}}],
 ['wrong operation kind',{metadataPatch:{kind:'KYC_SUBMITTED'}}],
 ['foreign project',{metadataPatch:{projectId:'project-b'}}],
 ['another invitation',{metadataPatch:{invitationId:'invite_'+'f'.repeat(32)}}]
])test('acceptance POST replay requires the exact own acceptance audit: '+name,async()=>{
 const f=fixture(options),before=JSON.stringify([f.row,f.receipt]);
 await assert.rejects(f.store.join(session,{invitationId}),{code:'PARTICIPANT_RECEIPT_INVALID'});
 await assert.rejects(f.replay(),{code:'PARTICIPANT_RECEIPT_INVALID'});
 assert.equal(JSON.stringify([f.row,f.receipt]),before);
});

test('acceptance POST replay preserves explicit conflict for another worker account',async()=>{
 const f=fixture();f.row.metadata.participant.clerkUserId='user_Other';
 await assert.rejects(f.replay(),{code:'PARTICIPANT_IDENTITY_CONFLICT'});
 assert.equal(f.queries.some(query=>query.sql.includes('FROM public."AuditLog"')),false);
});
