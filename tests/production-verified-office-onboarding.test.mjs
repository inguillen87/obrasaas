import test from 'node:test';
import assert from 'node:assert/strict';
import {createParticipantIdentityProvider} from '../src/lib/participant-identity-provider.mjs';
import {createParticipantStore} from '../src/lib/participant-store.mjs';
import {createParticipantHandlers} from '../src/lib/participant-http.mjs';
import {participantCommand,participantReceiptId} from '../src/lib/participant-policy.mjs';
import {participantVerifiedOfficeRequest,participantVerifiedOfficeProof,participantOfficeAssignmentRequestDigest,participantOfficeAssignmentReceipt,assertNewVerifiedOfficeTarget} from '../src/lib/participant-verified-office.mjs';
import {IDENTITY_PUBLIC_KEY,IDENTITY_INSTANCE,IDENTITY_ORIGIN} from '../src/lib/production-identity-config.mjs';

const email='office@example.invalid',userId='user_OfficeFixture',scope='a'.repeat(64),op='10000000-0000-4000-8000-000000000001';
const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Owner',organizationId:'org_A',organizationRole:'org:admin'};
const member={actorId:'owner',membershipId:'owner-member',organizationId:'company-a',role:'ADMIN',clerkRole:'org:admin'};
const context={projectId:'project-a',scope};
const proof={clerkUserId:userId,name:'Synthetic office account',email,primaryEmail:email,clerkRole:'org:member',providerMembershipId:'orgmem_OfficeFixture',providerMembershipUpdatedAt:123,userUpdatedAt:456,emailAddressId:'email_selected',primaryEmailAddressId:'email_selected'};
const command=()=>({...context,operationId:op,action:'ASSIGN_VERIFIED_OFFICE',payload:{email,clerkUserId:userId,expectedProofDigest:participantVerifiedOfficeProof(proof,member,session,context),role:'DIRECTOR',reason:'Reviewed the accepted verified office account.',confirmOfficePermissions:true}});
const environment=()=>({NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:IDENTITY_PUBLIC_KEY,CLERK_SECRET_KEY:'sk_live_'+'A'.repeat(30),CLERK_EXPECTED_INSTANCE_ID:IDENTITY_INSTANCE,NEXT_PUBLIC_APP_URL:IDENTITY_ORIGIN,CLERK_AUTHORIZED_PARTIES:IDENTITY_ORIGIN});

function providerFixture(){
 const calls=[],user={id:userId,firstName:'Synthetic',lastName:'Office',updatedAt:456,banned:false,locked:false,primaryEmailAddressId:'email_selected',emailAddresses:[{id:'email_selected',emailAddress:email,verification:{status:'verified'}}],unsafeMetadata:{role:'org:member',emailVerified:true}},membership={id:proof.providerMembershipId,updatedAt:123,role:'org:member',organization:{id:'org_A'},publicUserData:{userId}};
 const state={users:{data:[{id:userId}],totalCount:1},members:{data:[membership],totalCount:1},user,membership};
 const api={users:{getUserList:async input=>{calls.push(['list',input]);return state.users;},getUser:async id=>{calls.push(['user',id]);return state.user;}},organizations:{getOrganizationMembershipList:async input=>{calls.push(['membership',input]);return state.members;}}};
 return {state,calls,provider:createParticipantIdentityProvider({environment,client:async()=>api})};
}
test('office discovery uses bounded exact organization/email filters and an independent accepted membership',async()=>{
 const f=providerFixture(),value=await f.provider.findVerifiedOfficeAccount({organizationId:'org_A',email:' OFFICE@example.invalid '});
 assert.equal(value.state,'READY');assert.equal(value.account.clerkUserId,userId);assert.equal(value.account.email,email);assert.equal(value.account.clerkRole,'org:member');
 assert.deepEqual(f.calls,[['list',{emailAddress:[email],organizationId:['org_A'],limit:2,offset:0}],['user',userId],['membership',{organizationId:'org_A',userId:[userId],limit:2,offset:0}]]);
 assert.equal(JSON.stringify(value).includes('unsafeMetadata'),false);
});
for(const target of ['users','members'])test(`a pending invitation or absent ${target} cannot bootstrap an office account`,async()=>{
 const f=providerFixture();f.state[target]={data:[],totalCount:0};const value=await f.provider.findVerifiedOfficeAccount({organizationId:'org_A',email});
 assert.deepEqual(value,{state:'NOT_READY',code:'PARTICIPANT_PROVIDER_MEMBERSHIP_REQUIRED',account:null});
});
for(const property of ['banned','locked'])test(`a ${property} Clerk identity cannot obtain office permission`,async()=>{
 const f=providerFixture();f.state.user[property]=true;assert.equal((await f.provider.findVerifiedOfficeAccount({organizationId:'org_A',email})).code,'PARTICIPANT_OFFICE_TARGET_PROTECTED');
});
test('client metadata, a partial email match and unverified primary/selected addresses never prove identity',async()=>{
 for(const change of [user=>{user.emailAddresses[0].verification.status='unverified';},user=>{user.emailAddresses[0].emailAddress='not-'+email;},user=>{user.primaryEmailAddressId='missing';},user=>{user.emailAddresses.push({...user.emailAddresses[0]});}]){
  const f=providerFixture();change(f.state.user);const value=await f.provider.findVerifiedOfficeAccount({organizationId:'org_A',email});assert.notEqual(value.state,'READY');assert.equal(value.account,null);
 }
});
test('a verified secondary invitation address remains bound to the same verified primary subject',async()=>{
 const f=providerFixture();f.state.user.primaryEmailAddressId='email_primary';f.state.user.emailAddresses.push({id:'email_primary',emailAddress:'primary@example.invalid',verification:{status:'verified'}});
 const value=await f.provider.findVerifiedOfficeAccount({organizationId:'org_A',email});assert.equal(value.state,'READY');assert.equal(value.account.primaryEmail,'primary@example.invalid');assert.equal(value.account.emailAddressId,'email_selected');
});
test('ambiguous users, protected provider roles and malformed cross-organization memberships fail closed',async()=>{
 const duplicate=providerFixture();duplicate.state.users={data:[{id:userId},{id:'user_Other'}],totalCount:2};assert.equal((await duplicate.provider.findVerifiedOfficeAccount({organizationId:'org_A',email})).code,'PARTICIPANT_OFFICE_ACCOUNT_AMBIGUOUS');
 const admin=providerFixture();admin.state.membership.role='org:admin';assert.equal((await admin.provider.findVerifiedOfficeAccount({organizationId:'org_A',email})).code,'PARTICIPANT_OFFICE_TARGET_PROTECTED');
 for(const change of [row=>{row.organization.id='org_B';},row=>{row.publicUserData.userId='user_Other';},row=>{row.id='malformed';},row=>{row.updatedAt='123';}]){const f=providerFixture();change(f.state.membership);await assert.rejects(f.provider.findVerifiedOfficeAccount({organizationId:'org_A',email}),{code:'PARTICIPANT_IDENTITY_PROVIDER_UNAVAILABLE'});}
});
test('office command is explicit, exact and cannot widen a provider/admin role or accept browser proof metadata',()=>{
 assert.equal(participantCommand(command()).payload.role,'DIRECTOR');
 for(const role of ['SITE_MANAGER','FINANCE','AUDITOR'])assert.equal(participantCommand({...command(),payload:{...command().payload,role}}).payload.role,role);
 for(const extra of [{role:'ADMIN'},{role:'org:admin'},{confirmOfficePermissions:false},{expectedProofDigest:'bad'},{providerMembershipId:'orgmem_Forged'},{workerId:'worker-fabricated'}])assert.throws(()=>participantCommand({...command(),payload:{...command().payload,...extra}}),{code:'PARTICIPANT_INPUT_INVALID'});
 for(const emailValue of ['x'.repeat(255),'bad\n@example.invalid','bad',null])assert.throws(()=>participantVerifiedOfficeRequest({...context,email:emailValue}),{code:'PARTICIPANT_INPUT_INVALID'});
});
test('proof is specific to issuer, membership, organization, scope, project and current provider identity',()=>{
 const expected=participantVerifiedOfficeProof(proof,member,session,context);
 for(const [selected,m,s,c] of [[{...proof,providerMembershipUpdatedAt:124},member,session,context],[{...proof,emailAddressId:'different'},member,session,context],[proof,{...member,actorId:'other'},session,context],[proof,{...member,membershipId:'other'},session,context],[proof,{...member,organizationId:'other'},session,context],[proof,member,{...session,organizationId:'org_B'},context],[proof,member,session,{...context,scope:'b'.repeat(64)}],[proof,member,session,{...context,projectId:'other'}]])assert.notEqual(participantVerifiedOfficeProof(selected,m,s,c),expected);
});

test('an unlinked historical field assignment blocks admission without attributing that origin to the selected account',async()=>{
 for(const [origin,expected] of [['orphan','PARTICIPANT_OFFICE_HISTORY_UNCONFIRMED'],['field','PARTICIPANT_OFFICE_ACCOUNT_FIELD_BOUND'],['none',null]]){
  const queries=[],client={query:async(sql,params)=>{queries.push(sql);assert.ok(sql.startsWith('SELECT'));if(sql.includes('public."Worker"')){assert.deepEqual(params,[member.organizationId,userId]);return {rows:origin==='field'?[{id:'synthetic-worker'}]:[]};}if(sql.startsWith('SELECT a.id FROM public."AuditLog"')){assert.deepEqual(params,[member.organizationId]);assert.match(sql,/NOT EXISTS/);return {rows:origin==='orphan'?[{id:'synthetic-orphan-origin'}]:[]};}return {rows:[]};}};
  if(expected)await assert.rejects(assertNewVerifiedOfficeTarget(client,member,session,proof),{code:expected,status:409});
  else assert.equal(await assertNewVerifiedOfficeTarget(client,member,session,proof),null);
  assert.equal(queries.some(sql=>/INSERT|UPDATE|DELETE/.test(sql)),false);
 }
});

test('lookup projects an unlinked field origin as BLOCKED without selecting an account or mutating history',async()=>{
 const queries=[],client={query:async(sql,params)=>{queries.push(sql);assert.ok(sql.startsWith('SELECT'));if(sql.startsWith('SELECT a.id FROM public."AuditLog"')){assert.deepEqual(params,[member.organizationId]);return {rows:[{id:'synthetic-orphan-origin'}]};}return {rows:[]};}};
 const workspace={organizationOperation:async(_session,_input,writable,callback)=>{assert.equal(writable,false);return callback(client,member,scope);}};
 const store=createParticipantStore({workspace,identity:{findVerifiedOfficeAccount:async()=>({state:'READY',code:null,account:proof})}});
 assert.deepEqual(await store.verifiedOfficeAccount(session,{...context,email}),{scope,projectId:context.projectId,verifiedOfficeAccount:{version:1,email,state:'BLOCKED',code:'PARTICIPANT_OFFICE_HISTORY_UNCONFIRMED',account:null}});
 assert.equal(queries.some(sql=>/INSERT|UPDATE|DELETE/.test(sql)),false);
});

function recorded(){
 const input=command(),metadata={version:1,projectId:context.projectId,scope,operationId:op,kind:'VERIFIED_OFFICE_ASSIGNED',targetClerkUserId:userId,email,role:'DIRECTOR',assignedProjectId:null,recordedAt:'2026-10-10T12:00:00.000Z',proofDigest:input.payload.expectedProofDigest,reason:input.payload.reason,identityCertified:false,fieldPermissionsGranted:false,requestDigest:participantOfficeAssignmentRequestDigest(input)};
 return {id:participantReceiptId(member.actorId,context.projectId,op),organizationId:member.organizationId,entityType:'TenantMembership',entityId:'new-member',metadata};
}
test('immutable assignment receipt cannot become a worker receipt or certify later role changes',()=>{
 const found=recorded(),value=participantOfficeAssignmentReceipt(found,{...context,operationId:op});assert.equal(value.role,'DIRECTOR');assert.equal(value.assignedProjectId,null);assert.equal(value.fieldPermissionsGranted,false);
 assert.deepEqual(Object.keys(value).sort(),['version','operationId','action','projectId','scope','receiptId','membershipId','clerkUserId','email','role','assignedProjectId','recordedAt','proofDigest','identityCertified','fieldPermissionsGranted'].sort());
 for(const extra of [{role:'ADMIN'},{role:'FINANCE'},{scope:'b'.repeat(64)},{targetClerkUserId:'user_Other'},{email:'other@example.invalid'},{proofDigest:'b'.repeat(64)},{identityCertified:true},{fieldPermissionsGranted:true},{recordedAt:'yesterday'},{recordedAt:'2026-02-31T12:00:00.000Z'}])assert.throws(()=>participantOfficeAssignmentReceipt({...found,metadata:{...found.metadata,...extra}},{...context,operationId:op}),{code:'PARTICIPANT_OFFICE_RECEIPT_INVALID'});
 assert.throws(()=>participantOfficeAssignmentReceipt({...found,entityType:'Worker'},{...context,operationId:op}),{code:'PARTICIPANT_OFFICE_RECEIPT_INVALID'});
});
test('exact replay and GET recovery read only the canonical receipt and current account, without provider or writes',async()=>{
 const found=recorded(),queries=[];
 const client={query:async(sql)=>{queries.push(sql);assert.ok(sql.startsWith('SELECT'));return {rows:sql.includes('public."AuditLog"')?[found]:[{membershipId:'new-member',userId:'new-user',clerkUserId:userId,name:'Current account',email,role:'FINANCE',clerkRole:'org:member',status:'DISABLED',revision:'2026-10-10T12:00:01.000001'}]};}};
 const workspace={organizationOperation:async(_session,_input,writable,callback)=>{assert.equal(writable,false);return callback(client,member,scope);}};
 const store=createParticipantStore({workspace,identity:{findVerifiedOfficeAccount:()=>assert.fail('Replay cannot call Clerk')}});
 const saved=await store.save(session,command());assert.equal(saved.replayed,true);assert.equal(saved.account.role,'FINANCE');assert.equal(saved.account.status,'DISABLED');assert.equal(saved.officeAssignmentReceipt.role,'DIRECTOR');
 const status=await store.officeAssignmentStatus(session,{...context,operationId:op,action:'ASSIGN_VERIFIED_OFFICE'});assert.equal(status.state,'RECORDED');assert.deepEqual(status.officeAssignmentReceipt,saved.officeAssignmentReceipt);
 await assert.rejects(store.save(session,{...command(),payload:{...command().payload,role:'FINANCE'}}),{code:'PARTICIPANT_OPERATION_CONFLICT'});
 assert.equal(queries.some(sql=>sql.includes('Worker')),false);
});
test('lookup and commit proof cannot survive loss of current issuer authority during the provider read',async()=>{
 let current={...member},transactions=0,providerCalls=0;
 const workspace={organizationOperation:async(_session,_input,_writable,callback)=>{transactions++;return callback({query:async()=>({rows:[]})},current,scope);}};
 const identity={findVerifiedOfficeAccount:async()=>{providerCalls++;current={...member,role:'DIRECTOR'};return {state:'READY',code:null,account:proof};}};
 const store=createParticipantStore({workspace,identity});
 await assert.rejects(store.verifiedOfficeAccount(session,{...context,email}),{code:'WORKSPACE_ORGANIZATION_PERMISSION_REQUIRED'});assert.equal(providerCalls,1);assert.equal(transactions,2);
 current={...member};await assert.rejects(store.save(session,command()),{code:'WORKSPACE_ORGANIZATION_PERMISSION_REQUIRED'});assert.equal(providerCalls,2);
});
test('HTTP lookup and receipt recovery accept only their own exclusive query contracts',async()=>{
 const calls=[],store={verifiedOfficeAccount:async(_s,input)=>{calls.push(['lookup',input]);return {scope};},officeAssignmentStatus:async(_s,input)=>{calls.push(['status',input]);return {scope};},read:()=>assert.fail('A new query cannot fall into participant read')};
 const api=createParticipantHandlers({verify:async()=>session,store}),prefix='https://obrasaas.com/api/identity/participants?projectId=project-a&scope='+scope;
 for(const query of ['&detail=verified-office-account&email='+email,'&operationId='+op+'&action=ASSIGN_VERIFIED_OFFICE']){const response=await api.GET(new Request(prefix+query));assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control'),/no-store/);}
 for(const query of ['&email='+email,'&detail=verified-office-account&email='+email+'&accountId=x','&detail=verified-office-account&email='+email+'&email=another@example.invalid','&operationId='+op+'&action=ASSIGN_VERIFIED_OFFICE&detail=verified-office-account','&operationId='+op+'&action=ASSIGN_VERIFIED_OFFICE&workerId=x'])assert.equal((await api.GET(new Request(prefix+query))).status,400);
 assert.equal(calls.length,2);assert.deepEqual(calls[1][1],{...context,operationId:op,action:'ASSIGN_VERIFIED_OFFICE'});
});
