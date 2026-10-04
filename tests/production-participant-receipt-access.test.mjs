import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createParticipantStore} from '../src/lib/participant-store.mjs';
import {participantReceiptId} from '../src/lib/participant-policy.mjs';
import {checkScope,scopeStamp} from '../src/lib/workspace-policy.mjs';

function fixture({role='DIRECTOR',own=false,recorded=true,pending=false,entityType='Worker',kind=null,active=true,status='ACTIVE',assigned=true}={}){
 const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Actor',organizationId:'org_A',organizationRole:'org:member'};
 const member={actorId:'actor-a',membershipId:'member-a',organizationId:'company-a',role};
 const operationId=randomUUID(),projectId='project-a',queries=[];
 const row={id:'worker-a',name:'Synthetic participant',active,revision:'2026-10-01T00:00:00.000001',metadata:{participant:{version:1,status,clerkUserId:own?session.userId:'user_Other',permissions:{attendance:true,report:false},invitation:{id:'invite_'+'a'.repeat(32),state:'UNCERTAIN',email:'private@example.invalid',expiresAt:'2027-01-01T00:00:00.000Z'},kyc:{status:'APPROVED',review:{decision:'APPROVED',reason:'Private identity review reason.',recordedAt:'2026-10-01T00:00:00.000Z'},images:[{id:'selfie',kind:'SELFIE',contentType:'image/png',bytes:12}]}}}};
 const receipt={id:participantReceiptId(member.actorId,projectId,operationId),organizationId:member.organizationId,entityType,entityId:entityType==='Worker'?row.id:'target-member',metadata:{version:1,projectId,kind:kind||(own?'KYC_SUBMITTED':'REVIEW_KYC')}};
 const account={membershipId:'target-member',userId:'target-user',name:'Private account name',email:'account@example.invalid',role:'FINANCE',clerkRole:'org:member',status:'ACTIVE',revision:row.revision};
 const client={query:async(sql,args)=>{queries.push({sql,args});assert.ok(sql.startsWith('SELECT'),'Receipt recovery must stay read-only');
  if(sql.includes('FROM public."AuditLog"')){assert.deepEqual(args,[receipt.id,member.organizationId,member.actorId]);return {rows:recorded?[receipt]:[]};}
  if(sql.includes('FROM public."Worker"')){if(sql.includes('WHERE id=$1')){assert.deepEqual(args,[row.id,projectId]);return {rows:[row]};}assert.deepEqual(args,[projectId,operationId,member.actorId]);return {rows:pending?[row]:[]};}
  if(sql.includes('SELECT m.id')){assert.deepEqual(args,[member.membershipId,member.organizationId,session.userId,projectId]);return {rows:assigned?[{id:member.membershipId}]:[]};}
  if(sql.includes('FROM public."TenantMembership" tm')){assert.deepEqual(args,[receipt.entityId,member.organizationId]);return {rows:[account]};}
  assert.fail('Unexpected receipt query '+sql);
 }};
 const workspace={projectOperation:async(current,context,writable,callback)=>{assert.equal(current,session);assert.equal(writable,false);const scope=scopeStamp(session,member);checkScope(scope,context.scope);return callback(client,member,scope);}};
 const forbidden=()=>assert.fail('Receipt query must not call a provider or storage');
 const store=createParticipantStore({workspace,identity:{createInvitation:forbidden,findInvitation:forbidden,verifiedEmail:forbidden},connect:forbidden,upload:forbidden,get:forbidden});
 const context=()=>({projectId,scope:scopeStamp(session,member),operationId});
 return {store,session,member,row,receipt,queries,context};
}

for(const role of ['AUDITOR','SITE_MANAGER','FINANCE'])test(`receipt actor correlation cannot preserve other-worker KYC access after downgrade to ${role}`,async()=>{
 const f=fixture(),initial=f.context();assert.equal((await f.store.status(f.session,initial)).participant.kyc.review.reason,'Private identity review reason.');f.member.role=role;assert.notEqual(f.context().scope,initial.scope);await assert.rejects(f.store.status(f.session,f.context()),{code:'PARTICIPANT_ACCESS_REQUIRED'});
});
for(const role of ['ADMIN','DIRECTOR'])test(`current ${role} can recover a recorded other-worker outcome read-only`,async()=>{
 const f=fixture({role}),before=JSON.stringify(f.row);const result=await f.store.status(f.session,f.context());assert.equal(result.state,'RECORDED');assert.equal(result.saved,true);assert.equal(result.replayed,true);assert.equal(result.participant.id,f.row.id);assert.equal(JSON.stringify(f.row),before);
});
test('own active participant recovers own KYC without report permission or manager role',async()=>{
 const f=fixture({role:'AUDITOR',own:true}),before=JSON.stringify(f.row);const result=await f.store.status(f.session,f.context());assert.equal(result.state,'RECORDED');assert.equal(result.participant.kyc.status,'APPROVED');assert.equal(result.participant.permissions.report,false);assert.equal(JSON.stringify(f.row),before);
});
for(const change of ['revoked','inactive','unassigned'])test(`own receipt requires current active participant and assignment: ${change}`,async()=>{
 const f=fixture({role:'AUDITOR',own:true,status:change==='revoked'?'REVOKED':'ACTIVE',active:change!=='inactive',assigned:change!=='unassigned'});await assert.rejects(f.store.status(f.session,f.context()),{code:'PARTICIPANT_ACCESS_REQUIRED'});
});
for(const role of ['DIRECTOR','SITE_MANAGER','AUDITOR'])test(`office role receipt requires current ADMIN even when its actor is unchanged: ${role}`,async()=>{
 const f=fixture({role,entityType:'TenantMembership',kind:'OFFICE_ROLE_CHANGED'});await assert.rejects(f.store.status(f.session,f.context()),{code:'WORKSPACE_ORGANIZATION_PERMISSION_REQUIRED'});assert.equal(f.queries.some(query=>query.sql.includes('FROM public."TenantMembership" tm')),false,'No account metadata is read before authorization');
});
test('current ADMIN can recover office role receipt with no provider or write',async()=>{
 const f=fixture({role:'ADMIN',entityType:'TenantMembership',kind:'OFFICE_ROLE_CHANGED'});const result=await f.store.status(f.session,f.context());assert.equal(result.state,'RECORDED');assert.equal(result.account.membershipId,'target-member');assert.equal(result.participant,undefined);
});
test('uncertain invitation also rejects a former manager who no longer owns the participant',async()=>{
 const f=fixture({role:'SITE_MANAGER',recorded:false,pending:true,status:'INVITED'});await assert.rejects(f.store.status(f.session,f.context()),{code:'PARTICIPANT_ACCESS_REQUIRED'});
});
test('current manager and own active participant can still consult uncertain invitation metadata',async()=>{
 for(const options of [{role:'DIRECTOR'},{role:'AUDITOR',own:true}]){const f=fixture({...options,recorded:false,pending:true});const before=JSON.stringify(f.row),result=await f.store.status(f.session,f.context());assert.equal(result.state,'INVITATION_UNCONFIRMED');assert.equal(result.definitive,false);assert.equal(result.participant.id,f.row.id);assert.equal(JSON.stringify(f.row),before);}
});
test('no correlated receipt remains NOT_OBSERVED with no participant metadata',async()=>{
 const f=fixture({role:'AUDITOR',recorded:false}),result=await f.store.status(f.session,f.context());assert.deepEqual(result,{scope:f.context().scope,state:'NOT_OBSERVED',definitive:false});
});
test('old scope cannot bypass the current-role check',async()=>{
 const f=fixture(),old=f.context();f.member.role='AUDITOR';await assert.rejects(f.store.status(f.session,old),{code:'WORKSPACE_CONTEXT_CHANGED'});assert.equal(f.queries.length,0);
});
test('unknown receipt entity and wrong office kind never fall through to Worker or account serialization',async()=>{
 for(const options of [{entityType:'Project'},{entityType:'TenantMembership',kind:'REVIEW_KYC'}]){const f=fixture({role:'ADMIN',...options});await assert.rejects(f.store.status(f.session,f.context()),{code:'PARTICIPANT_RECEIPT_INVALID'});assert.equal(f.queries.length,1);}
});
