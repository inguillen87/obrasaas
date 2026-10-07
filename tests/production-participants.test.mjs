import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {participantCommand,participantKycInput,PARTICIPANT_NOTICE_VERSION,assertOwnParticipant,assertFieldParticipant} from '../src/lib/participant-policy.mjs';
import {createParticipantHandlers} from '../src/lib/participant-http.mjs';
import {createParticipantIdentityProvider} from '../src/lib/participant-identity-provider.mjs';
import {IDENTITY_PUBLIC_KEY,IDENTITY_INSTANCE,IDENTITY_ORIGIN} from '../src/lib/production-identity-config.mjs';
const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Owner',organizationId:'org_A',organizationRole:'org:admin'};
const command={operationId:randomUUID(),projectId:'project-a',scope:'a'.repeat(64),action:'INVITE',payload:{workerId:'worker-a',revision:'2026-10-01T00:00:00.000001',email:' Worker@example.invalid '}};
const picture='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==';
const request=(method='GET',search='',body=null,extra={})=>new Request('https://obrasaas.com/api/identity/participants'+search,{method,headers:{'Content-Type':'application/json',Origin:'https://obrasaas.com',...extra},...(body?{body:JSON.stringify(body)}:{})});
test('participant commands reject unknown fields, roles and forged review payloads',()=>{
 assert.equal(participantCommand(command).payload.email,'worker@example.invalid');
 for(const value of [{...command,role:'ADMIN'},{...command,payload:{...command.payload,tenantRole:'ADMIN'}},{...command,operationId:'bad'},{...command,scope:'b'},{...command,payload:{...command.payload,email:'bad'}},{...command,action:'REVIEW_KYC',payload:{workerId:'worker-a',revision:command.payload.revision,submissionId:'kyc-a',decision:'AUTO_APPROVE',reason:'some review'}}])assert.throws(()=>participantCommand(value),{code:'PARTICIPANT_INPUT_INVALID'});
});

test('closing a private chat draft requires its exact challenge, revision and human reason',()=>{
 const closure={...command,action:'CANCEL_KYC_CHAT',payload:{workerId:'worker-a',revision:command.payload.revision,challengeId:'kyc_chat_'+'a'.repeat(32),reason:'The original issuer reviewed this incomplete capture.'}};
 assert.deepEqual(participantCommand(closure).payload,closure.payload);
 for(const payload of [{...closure.payload,challengeId:'invite_'+'a'.repeat(32)},{...closure.payload,revision:'2026-10-01'},{...closure.payload,issuerActorId:'forged'},{...closure.payload,force:true},{...closure.payload,code:'IDENTIDAD '+'b'.repeat(43)}])assert.throws(()=>participantCommand({...closure,payload}),{code:'PARTICIPANT_INPUT_INVALID'});
 assert.throws(()=>participantCommand({...closure,payload:{...closure.payload,reason:'short'}}),{code:'PARTICIPANT_REASON_REQUIRED'});
});
test('KYC requires pinned privacy choice, two real image signatures and revision',()=>{
 const body={operationId:randomUUID(),projectId:'project-a',scope:'a'.repeat(64),workerId:'worker-a',revision:command.payload.revision,noticeVersion:PARTICIPANT_NOTICE_VERSION,consent:true,front:picture,selfie:picture};
 assert.equal(participantKycInput(body).front.contentType,'image/png');
 assert.throws(()=>participantKycInput({...body,consent:false}),{code:'PARTICIPANT_PRIVACY_REQUIRED'});
 assert.throws(()=>participantKycInput({...body,noticeVersion:'client-selected'}),{code:'PARTICIPANT_PRIVACY_REQUIRED'});
 assert.throws(()=>participantKycInput({...body,selfie:Buffer.from('not an image').toString('base64')}),{code:'PRIVATE_IMAGE_TYPE_MISMATCH'});
});
function personalParticipantFixture(change=()=>{},memberships=[{id:'member-a'}]){
 const ownSession={...session,userId:'user_Worker',organizationRole:'org:member'},member={membershipId:'member-a',organizationId:'company-a'};
 const row={id:'worker-a',active:true,metadata:{participant:{version:1,status:'ACTIVE',clerkUserId:ownSession.userId,permissions:{attendance:true,report:false},kyc:{status:'NOT_SUBMITTED'}}}};change(row);
 const client={query:async(sql,args)=>{if(sql.includes('FROM public."Worker"')){assert.deepEqual(args,['worker-a','project-a']);return {rows:[row]};}assert.deepEqual(args,[member.membershipId,member.organizationId,ownSession.userId,'project-a']);return {rows:memberships};}};
 return {client,member,ownSession,row};
}
test('personal identity presentation reuses canonical ownership and does not require report permission',async()=>{
 const f=personalParticipantFixture(),before=structuredClone(f.row);
 assert.equal(await assertOwnParticipant(f.client,f.member,f.ownSession,'project-a','worker-a'),f.row);assert.deepEqual(f.row,before);
 await assert.rejects(assertFieldParticipant(f.client,f.member,f.ownSession,'project-a','worker-a',{permission:'report'}),{code:'PARTICIPANT_ACCESS_REQUIRED'});
 await assert.rejects(assertFieldParticipant(f.client,f.member,f.ownSession,'project-a','worker-a',{permission:'attendance',requireKyc:true}),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});
 f.row.metadata.participant.kyc.status='APPROVED';assert.equal(await assertFieldParticipant(f.client,f.member,f.ownSession,'project-a','worker-a',{permission:'attendance',requireKyc:true}),f.row);
 await assert.rejects(assertFieldParticipant(f.client,f.member,f.ownSession,'project-a','worker-a',{permission:'report',requireKyc:true}),{code:'PARTICIPANT_ACCESS_REQUIRED'});
});
test('personal identity ownership rejects revoked, inactive, foreign and unconfirmed canonical memberships',async()=>{
 for(const change of [row=>{row.active=false;},row=>{row.metadata.participant.status='REVOKED';},row=>{row.metadata.participant.clerkUserId='user_Other';},row=>{row.metadata.participant.version=0;}]){const f=personalParticipantFixture(change);await assert.rejects(assertOwnParticipant(f.client,f.member,f.ownSession,'project-a','worker-a'),{code:'PARTICIPANT_ACCESS_REQUIRED'});}
 for(const memberships of [[],[{id:'one'},{id:'ambiguous'}]]){const f=personalParticipantFixture(()=>{},memberships);await assert.rejects(assertOwnParticipant(f.client,f.member,f.ownSession,'project-a','worker-a'),{code:'PARTICIPANT_ACCESS_REQUIRED'});}
});
test('company role command permits only explicit non-administrator roles with exact membership revision',()=>{
 const office={...command,action:'SET_OFFICE_ROLE',payload:{membershipId:'member-a',revision:command.payload.revision,role:'DIRECTOR',reason:'The administrator reviewed this verified account.'}};
 for(const role of ['DIRECTOR','SITE_MANAGER','FINANCE','AUDITOR'])assert.equal(participantCommand({...office,payload:{...office.payload,role}}).payload.role,role);
 for(const payload of [{...office.payload,role:'ADMIN'},{...office.payload,role:'org:admin'},{...office.payload,revision:'2026-10-01'},{...office.payload,userId:'user_forged'}])assert.throws(()=>participantCommand({...office,payload}),{code:'PARTICIPANT_INPUT_INVALID'});
 assert.throws(()=>participantCommand({...office,payload:{...office.payload,reason:'short'}}),{code:'PARTICIPANT_REASON_REQUIRED'});
});
test('HTTP independently requires signed identity, canonical origin and exclusive queries',async()=>{
 let calls=0;const handlers=createParticipantHandlers({verify:async()=>session,store:{read:async()=>{calls++;return {records:[]};},save:async()=>{calls++;return {saved:true};}}});
 const read=await handlers.GET(request('GET','?projectId=project-a&scope='+'a'.repeat(64)));assert.equal(read.status,200);assert.match(read.headers.get('Cache-Control'),/no-store/);
 for(const bad of [request('POST','',command,{Origin:'https://other.invalid'}),request('GET','?projectId=project-a&projectId=project-b&scope='+'a'.repeat(64)),request('GET','?projectId=project-a&scope='+'a'.repeat(64)+'&operationId='+randomUUID()+'&after=other'),request('POST','?scope=bad',command),request('POST','',command,{'Content-Encoding':'gzip'})])assert.ok((await handlers[bad.method](bad)).status>=400);
 assert.equal(calls,1);
 const unsigned=createParticipantHandlers({verify:async()=>({authenticated:false}),store:{read:async()=>assert.fail('unsigned identity reached data')}});assert.equal((await unsigned.GET(request())).status,401);
});
test('acceptance recovery GET delegates the invitation alone and cannot submit or select another actor',async()=>{
 const invitationId='invite_'+'a'.repeat(32),calls=[],api=createParticipantHandlers({verify:async()=>({...session,organizationRole:'org:member'}),join:true,store:{join:async(...args)=>{calls.push(args);return {state:'ACTIVE',saved:true,joined:true,receiptId:'participant_original'};}}});
 const result=await api.GET(request('GET','?invitationId='+invitationId));assert.equal(result.status,200);assert.equal(calls.length,1);assert.deepEqual(calls[0][1],{invitationId});assert.equal(calls[0].length,2);assert.match(result.headers.get('Cache-Control'),/no-store/);
 for(const suffix of ['&operationId='+randomUUID(),'&userId=user_Other','&invitationId='+invitationId])assert.equal((await api.GET(request('GET','?invitationId='+invitationId+suffix))).status,400);assert.equal(calls.length,1);
});
const environment=()=>({NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:IDENTITY_PUBLIC_KEY,CLERK_SECRET_KEY:'sk_live_'+'A'.repeat(30),CLERK_EXPECTED_INSTANCE_ID:IDENTITY_INSTANCE,NEXT_PUBLIC_APP_URL:IDENTITY_ORIGIN,CLERK_AUTHORIZED_PARTIES:IDENTITY_ORIGIN});
test('Clerk adapter correlates exact metadata across pages and never trusts unsafe profile fields',async()=>{
 const expected={id:'orginv_Exact',organizationId:'org_A',emailAddress:'worker@example.invalid',role:'org:member',expiresAt:Date.now()+60000,status:'accepted',publicMetadata:{obrasaasInvitationId:'invite_'+'a'.repeat(32)}};let options;
 const api={organizations:{getOrganizationInvitationList:async({offset})=>({data:offset===0?Array.from({length:100},(_,i)=>({...expected,id:'orginv_'+i,publicMetadata:{obrasaasInvitationId:'unrelated'}})):[expected],totalCount:101}),createOrganizationInvitation:async input=>{options=input;return expected;}},users:{getUser:async()=>({id:'user_Worker',primaryEmailAddressId:'email_1',emailAddresses:[{id:'email_1',emailAddress:'worker@example.invalid',verification:{status:'verified'}}],unsafeMetadata:{role:'ADMIN'}})}};
 const adapter=createParticipantIdentityProvider({client:async()=>api,environment});const result=await adapter.findInvitation({organizationId:'org_A',invitationId:expected.publicMetadata.obrasaasInvitationId});assert.equal(result.id,expected.id);assert.equal(await adapter.verifiedEmail('user_Worker'),'worker@example.invalid');
 await adapter.createInvitation({organizationId:'org_A',inviterUserId:'user_Owner',email:expected.emailAddress,invitationId:result.invitationId});assert.equal(options.role,'org:member');assert.equal(options.expiresInDays,7);assert.equal(options.redirectUrl,'https://obrasaas.com/cuenta?participar='+result.invitationId);assert.deepEqual(options.publicMetadata,{obrasaasInvitationId:result.invitationId});
 const unverified=createParticipantIdentityProvider({client:async()=>({...api,users:{getUser:async()=>({id:'user_Worker',primaryEmailAddressId:'email_1',emailAddresses:[{id:'email_1',emailAddress:'worker@example.invalid',verification:{status:'unverified'}}]})}}),environment});await assert.rejects(unverified.verifiedEmail('user_Worker'),{code:'PARTICIPANT_VERIFIED_EMAIL_REQUIRED'});
});
test('Clerk adapter fails closed when configured instance or invitation correlation is ambiguous',async()=>{
 const adapter=createParticipantIdentityProvider({client:async()=>assert.fail('wrong production identity reached provider'),environment:()=>({...environment(),CLERK_EXPECTED_INSTANCE_ID:'wrong'})});await assert.rejects(adapter.verifiedEmail('user_Worker'),{code:'PARTICIPANT_IDENTITY_PROVIDER_UNAVAILABLE'});
 const row={publicMetadata:{obrasaasInvitationId:'invite_'+'a'.repeat(32)}};const duplicate=createParticipantIdentityProvider({environment,client:async()=>({organizations:{getOrganizationInvitationList:async()=>({data:[row,row],totalCount:2})}})});await assert.rejects(duplicate.findInvitation({organizationId:'org_A',invitationId:row.publicMetadata.obrasaasInvitationId}),{code:'PARTICIPANT_INVITATION_AMBIGUOUS'});
});
test('current Clerk membership must match account, organization, official role and invitation metadata',async()=>{
 const invitationId='invite_'+'a'.repeat(32),value={role:'org:member',organization:{id:'org_A'},publicUserData:{userId:'user_Worker'},publicMetadata:{obrasaasInvitationId:invitationId}};let membership=value;
 const adapter=createParticipantIdentityProvider({environment,client:async()=>({organizations:{getOrganizationMembershipList:async input=>{assert.deepEqual(input.userId,['user_Worker']);return {data:[membership],totalCount:1};}}})});
 assert.equal((await adapter.verifyMembership({userId:'user_Worker',organizationId:'org_A',invitationId})).role,'org:member');
 for(const altered of [{...value,organization:{id:'org_B'}},{...value,publicUserData:{userId:'user_Other'}},{...value,role:'unsigned-admin'},{...value,publicMetadata:{obrasaasInvitationId:'different'}}]){membership=altered;await assert.rejects(adapter.verifyMembership({userId:'user_Worker',organizationId:'org_A',invitationId}),{code:'PARTICIPANT_PROVIDER_MEMBERSHIP_REQUIRED'});}
});
