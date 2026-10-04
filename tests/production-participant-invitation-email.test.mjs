import test from 'node:test';
import assert from 'node:assert/strict';
import {createParticipantIdentityProvider} from '../src/lib/participant-identity-provider.mjs';
import {createParticipantStore} from '../src/lib/participant-store.mjs';
import {IDENTITY_PUBLIC_KEY,IDENTITY_INSTANCE,IDENTITY_ORIGIN} from '../src/lib/production-identity-config.mjs';

const userId='user_EmailFixture',primary='primary@example.invalid',secondary='secondary@example.invalid';
const invitationId='invite_'+'a'.repeat(32);
const environment=()=>({NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:IDENTITY_PUBLIC_KEY,CLERK_SECRET_KEY:'sk_live_'+'A'.repeat(30),CLERK_EXPECTED_INSTANCE_ID:IDENTITY_INSTANCE,NEXT_PUBLIC_APP_URL:IDENTITY_ORIGIN,CLERK_AUTHORIZED_PARTIES:IDENTITY_ORIGIN});
const profile=()=>({id:userId,primaryEmailAddressId:'email_primary',emailAddresses:[{id:'email_primary',emailAddress:primary,verification:{status:'verified'}},{id:'email_secondary',emailAddress:secondary,verification:{status:'verified'}}],unsafeMetadata:{email:'foreign@example.invalid',emailVerified:true}});
function fixture(change=value=>value,config=environment){
 let calls=0;
 const adapter=createParticipantIdentityProvider({environment:config,client:async()=>({users:{getUser:async id=>{calls++;assert.equal(id,userId);return change(profile());}}})});
 return {adapter,calls:()=>calls};
}

test('email adapter without selector preserves the verified primary contract',async()=>{
 const f=fixture();assert.equal(await f.adapter.verifiedEmail(userId),primary);assert.equal(f.calls(),1);
 const unverified=fixture(value=>{value.emailAddresses[0].verification.status='unverified';return value;});
 await assert.rejects(unverified.adapter.verifiedEmail(userId),{code:'PARTICIPANT_VERIFIED_EMAIL_REQUIRED'});
});
test('email selector accepts only the exact verified primary or secondary address',async()=>{
 const f=fixture();assert.equal(await f.adapter.verifiedEmail(userId,primary),primary);assert.equal(await f.adapter.verifiedEmail(userId,secondary),secondary);
 assert.equal(await f.adapter.verifiedEmail(userId,secondary.toUpperCase()),secondary);
});
test('email selector rejects unverified owned addresses and unrelated addresses',async()=>{
 const f=fixture(value=>{value.emailAddresses[1].verification.status='unverified';return value;});
 await assert.rejects(f.adapter.verifiedEmail(userId,secondary),{code:'PARTICIPANT_VERIFIED_EMAIL_REQUIRED'});
 for(const address of ['foreign@example.invalid','unrelated@example.invalid','primary+invite@example.invalid','pri.mary@example.invalid'])await assert.rejects(f.adapter.verifiedEmail(userId,address),{code:'PARTICIPANT_EMAIL_MISMATCH'});
});
test('email selector rejects ambiguous provider addresses and wrong user ownership',async()=>{
 const ambiguous=fixture(value=>{value.emailAddresses.push({...value.emailAddresses[1],id:'email_duplicate'});return value;});
 await assert.rejects(ambiguous.adapter.verifiedEmail(userId,secondary),{code:'PARTICIPANT_IDENTITY_PROVIDER_UNAVAILABLE'});
 const foreign=fixture(value=>({...value,id:'user_Foreign'}));await assert.rejects(foreign.adapter.verifiedEmail(userId,secondary),{code:'PARTICIPANT_IDENTITY_PROVIDER_UNAVAILABLE'});
});
test('email selector never folds Gmail dots or plus aliases or trusts unsafeMetadata',async()=>{
 const f=fixture(value=>{value.emailAddresses[1].emailAddress='field.person+site@gmail.com';return value;});
 assert.equal(await f.adapter.verifiedEmail(userId,'field.person+site@gmail.com'),'field.person+site@gmail.com');
 for(const address of ['fieldperson+site@gmail.com','field.person@gmail.com','foreign@example.invalid'])await assert.rejects(f.adapter.verifiedEmail(userId,address),{code:'PARTICIPANT_EMAIL_MISMATCH'});
});
test('email selector fails closed for invalid selectors and a wrong configured instance',async()=>{
 const f=fixture();for(const value of ['',null,{},' bad@example.invalid','a'.repeat(255)])await assert.rejects(f.adapter.verifiedEmail(userId,value),{code:'PARTICIPANT_EMAIL_MISMATCH'});
 const wrong=fixture(value=>value,()=>({...environment(),CLERK_EXPECTED_INSTANCE_ID:'wrong'}));
 await assert.rejects(wrong.adapter.verifiedEmail(userId,secondary),{code:'PARTICIPANT_IDENTITY_PROVIDER_UNAVAILABLE'});assert.equal(wrong.calls(),0);
});
test('primary email lookup rejects ambiguous primary IDs and malformed trusted profiles',async()=>{
 const ambiguous=fixture(value=>{value.emailAddresses.push({...value.emailAddresses[0]});return value;});
 await assert.rejects(ambiguous.adapter.verifiedEmail(userId),{code:'PARTICIPANT_IDENTITY_PROVIDER_UNAVAILABLE'});
 const malformed=fixture(value=>({...value,emailAddresses:null}));await assert.rejects(malformed.adapter.verifiedEmail(userId,secondary),{code:'PARTICIPANT_IDENTITY_PROVIDER_UNAVAILABLE'});
});

function joinFixture(email=secondary,{profileChange=value=>value,afterMembership=()=>{},providerState='accepted',memberRole='org:member'}={}){
 const f=fixture(profileChange),queries=[];
 const row={id:'worker-email',active:true,projectId:'project-email',organizationId:'company-email',projectName:'Synthetic worksite',organizationName:'Synthetic company',name:'Synthetic participant',metadata:{participant:{version:1,status:'INVITED',invitation:{id:invitationId,email,providerId:'orginv_EmailFixture',state:'SENT',expiresAt:new Date(Date.now()+60000).toISOString()}}}};
 const connect=async()=>({release(){},query:async(sql,args)=>{queries.push({sql,args});if(sql.startsWith('SELECT w.id'))return {rows:[structuredClone(row)]};assert.match(sql,/^(BEGIN|SET LOCAL|ROLLBACK)/);return {rows:[]};}});
 const identity={verifiedEmail:(...args)=>f.adapter.verifiedEmail(...args),findInvitation:async()=>({id:'orginv_EmailFixture',email,role:'org:member',state:providerState,expiresAt:new Date(Date.now()+60000).toISOString(),invitationId}),verifyMembership:async()=>{await afterMembership(row);return {userId,organizationId:'org_EmailFixture',role:memberRole};}};
 const store=createParticipantStore({workspace:{},connect,identity});
 const session={authenticated:true,verification:'clerk-production-jwt',userId,organizationId:'org_EmailFixture',organizationRole:'org:member'};
 return {store,session,queries,calls:f.calls,row};
}
test('join reads its email selector from the canonical invitation and allows verified secondary',async()=>{
 const f=joinFixture();const result=await f.store.join(f.session,{invitationId});assert.equal(result.canAccept,true);assert.equal(result.invitationId,invitationId);assert.equal(f.calls(),2);
 assert.ok(f.queries.every(({sql})=>!/^(INSERT|UPDATE|DELETE|COMMIT)/.test(sql)));
 await assert.rejects(f.store.join(f.session,{invitationId,email:primary}),{code:'PARTICIPANT_INPUT_INVALID'});
});
test('primary invitation acceptance check needs only one profile read',async()=>{
 const f=joinFixture(primary);assert.equal((await f.store.join(f.session,{invitationId})).canAccept,true);assert.equal(f.calls(),1);
});
test('join rejects unverified secondary and cannot fall back to another verified address',async()=>{
 const f=joinFixture(secondary,{profileChange:value=>{value.emailAddresses[1].verification.status='unverified';return value;}});
 await assert.rejects(f.store.join(f.session,{invitationId}),{code:'PARTICIPANT_VERIFIED_EMAIL_REQUIRED'});
 const unrelated=joinFixture('unrelated@example.invalid');await assert.rejects(unrelated.store.join(unrelated.session,{invitationId}),{code:'PARTICIPANT_EMAIL_MISMATCH'});
});
test('secondary acceptance rechecks changed or revoked canonical invitation after provider I/O',async()=>{
 const changed=joinFixture(secondary,{afterMembership:row=>{row.metadata.participant.invitation.email=primary;}});
 await assert.rejects(changed.store.join(changed.session,{invitationId}),{code:'PARTICIPANT_EMAIL_MISMATCH'});
 const revoked=joinFixture(secondary,{afterMembership:row=>{row.metadata.participant.status='REVOKED';row.metadata.participant.invitation.state='REVOKED';}});
 await assert.rejects(revoked.store.join(revoked.session,{invitationId}),{code:'PARTICIPANT_INVITATION_REVOKED'});
});
test('secondary selection does not bypass accepted-provider or participant-role gates',async()=>{
 const pending=joinFixture(secondary,{providerState:'pending'});await assert.rejects(pending.store.join(pending.session,{invitationId}),{code:'PARTICIPANT_PROVIDER_ACCEPTANCE_REQUIRED'});
 const role=joinFixture(secondary,{memberRole:'org:admin'});await assert.rejects(role.store.join(role.session,{invitationId}),{code:'PARTICIPANT_MEMBER_SESSION_REQUIRED'});
 const f=joinFixture();await assert.rejects(f.store.join({...f.session,organizationRole:'org:admin'},{invitationId}),{code:'PARTICIPANT_MEMBER_SESSION_REQUIRED'});
});
