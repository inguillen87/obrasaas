import test from 'node:test';
import assert from 'node:assert/strict';
import {participantCommand} from '../src/lib/participant-policy.mjs';
import {participantOnboardingNextStep} from '../src/app/(identity)/cuenta/participant-onboarding-next-step.mjs';
import {createParticipantStore} from '../src/lib/participant-store.mjs';
import {fieldTransition} from '../src/lib/field-operations-policy.mjs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const command=()=>({operationId:'11111111-1111-4111-8111-111111111111',projectId:'project-a',scope:'a'.repeat(64),action:'SET_FIELD_PERMISSIONS',payload:{workerId:'worker-a',revision:'2026-10-07T00:00:00.000001',permissions:{attendance:true,report:false},reason:'Jornada autorizada por el responsable'}});
test('field correction accepts an explicit limited permission or consultation-only decision without company role',()=>{
 const input=command();assert.deepEqual(participantCommand(input).payload.permissions,{attendance:true,report:false});input.payload.permissions={attendance:false,report:false};assert.deepEqual(participantCommand(input).payload.permissions,input.payload.permissions);
});
for(const [name,change] of [
 ['hidden role',p=>{p.role='ADMIN';}],['permission promotion',p=>{p.permissions.approve=true;}],['missing report',p=>{delete p.permissions.report;}],['coerced attendance',p=>{p.permissions.attendance='true';}],['missing reason',p=>{p.reason='';}],['stale revision format',p=>{p.revision='2026-10-07';}],
])test('field correction rejects '+name,()=>{const input=command();change(input.payload);assert.throws(()=>participantCommand(input));});
const fixture=()=>({context:{scope:'a'.repeat(64),projectId:'project-a',verified:true,now:Date.now()},snapshot:{scope:'a'.repeat(64),projectId:'project-a',canManage:true,canInvite:true,records:[{id:'worker-a',self:false,active:true,status:'ACTIVE',accountLinked:true,canManageFieldPermissions:true,kycChatChallenge:null,kyc:{status:'APPROVED',images:[{id:'front'},{id:'selfie'}]},permissions:{attendance:false,report:false}}]},workerId:'worker-a'});
test('approved consultation-only person gives the other manager an evident permission review action',()=>{const value=participantOnboardingNextStep(fixture());assert.equal(value.state,'FIELD_PERMISSIONS_REVIEW');assert.equal(value.primary.action,'SET_FIELD_PERMISSIONS');});
test('own consultation-only profile cannot offer its own permission correction',()=>{const input=fixture();input.snapshot.records[0].self=true;input.snapshot.canManage=true;assert.equal(participantOnboardingNextStep(input).state,'WAIT_PERMISSIONS');});
test('an absent current capability, revoked participation or pending identity cannot bypass its existing gate',()=>{
 const input=fixture();input.snapshot.records[0].canManageFieldPermissions=false;assert.notEqual(participantOnboardingNextStep(input).primary.action,'SET_FIELD_PERMISSIONS');input.snapshot.records[0].canManageFieldPermissions=true;input.snapshot.records[0].kyc.status='PENDING_REVIEW';assert.equal(participantOnboardingNextStep(input).primary.action,'REVIEW_KYC');input.snapshot.records[0].status='REVOKED';assert.notEqual(participantOnboardingNextStep(input).primary.action,'SET_FIELD_PERMISSIONS');
});

test('attendance withdrawal preserves revision and permissions until the canonical journey has closed',async()=>{
 const session={userId:'user_Owner'},member={actorId:'owner',organizationId:'organization-a',role:'ADMIN'},target={actorId:'person',clerkUserId:'user_Person',membershipId:'membership-a'},audits=new Map(),events=[],calls=[];
 const row={id:'worker-a',projectId:'project-a',name:'Persona de ensayo',active:true,revision:command().payload.revision,metadata:{participant:{version:1,status:'ACTIVE',clerkUserId:target.clerkUserId,permissions:{attendance:true,report:true},kyc:{status:'APPROVED'}}}},rows=values=>({rows:structuredClone(values),rowCount:values.length});
 const client={query:async(sql,args=[])=>{
  calls.push(sql);
  if(sql.includes('pg_advisory_xact_lock'))return rows([]);
  if(sql.startsWith('SELECT')&&sql.includes('FROM public."Worker" WHERE id=$1'))return rows([row]);
  if(sql.startsWith('SELECT u.id AS "actorId"'))return rows([target]);
  if(sql.startsWith('SELECT id FROM public."ProjectMembership"'))return rows([{id:'assignment-a'}]);
  if(sql.startsWith('SELECT id,"organizationId","entityType","entityId",metadata FROM public."AuditLog"'))return rows(audits.has(args[0])?[audits.get(args[0])]:[]);
  if(sql.startsWith('SELECT id,"projectId","workerId",metadata FROM (')){
   assert.equal(args[1],target.actorId);const latest=events.at(-1);
   return rows(latest&&latest.metadata.fieldOperations.recordedBy===args[1]&&latest.metadata.fieldOperations.eventType!=='CHECK_OUT'?[latest]:[]);
  }
  if(sql.startsWith('UPDATE public."Worker"')){row.metadata=JSON.parse(args[2]);row.revision='2026-10-07T00:00:00.000002';return rows([row]);}
  if(sql.startsWith('INSERT INTO public."AuditLog"')){audits.set(args[0],{id:args[0],organizationId:args[1],entityType:args[3],entityId:args[4],metadata:JSON.parse(args[5])});return rows([]);}
  assert.fail('Unexpected permission query: '+sql);
 }};
 const workspace={projectOperation:async(_session,input,_write,callback,beforeProject)=>{await beforeProject(client,member);calls.push('PROJECT_LOCK');return callback(client,member,input.scope);}},store=createParticipantStore({workspace});
 const attendance=eventType=>{const previous=events.at(-1)?.metadata.fieldOperations,transition=fieldTransition(eventType,previous);events.push({id:'attendance-'+events.length,projectId:row.projectId,workerId:row.id,metadata:{fieldOperations:{version:1,eventType,phase:transition.phase,sequence:events.length+1,recordedBy:target.actorId}}});};
 attendance('CHECK_IN');const input=command();input.payload.permissions={attendance:false,report:true};const before=structuredClone(row);
 await assert.rejects(store.save(session,input),{code:'ATTENDANCE_PERSON_JOURNEY_OPEN'});assert.deepEqual(row,before);assert.equal(audits.size,0);
 assert.ok(calls.findIndex(sql=>sql.includes('pg_advisory_xact_lock'))<calls.indexOf('PROJECT_LOCK'));assert.ok(calls.indexOf('PROJECT_LOCK')<calls.findIndex(sql=>sql.startsWith('SELECT id,"projectId","workerId",metadata FROM (')));
 attendance('CHECK_OUT');events.at(-1).metadata.fieldOperations.recordedBy='other-closer';
 const allowed=await store.save(session,input);assert.equal(allowed.saved,true);assert.deepEqual(row.metadata.participant.permissions,{attendance:false,report:true});assert.notEqual(row.revision,before.revision);assert.equal(audits.size,1);assert.equal(events.length,2);
});

const pgHarness=fileURLToPath(new URL('../scripts/verify-participant-field-permissions-postgres.mjs',import.meta.url));
const disposableEnvironment={...process.env,CI:'false',VERCEL:'',VERCEL_ENV:'',VERCEL_TARGET_ENV:'',TARGET:'',CUTOVER_TEST_DISPOSABLE:'1',CUTOVER_TEST_DATABASE_DISPOSABLE:'',CUTOVER_TEST_DATABASE_URL:'postgresql://cutover_test@127.0.0.1:6549/obrasaas_cutover_ci'};
for(const [name,environment,code] of [
 ['legacy marker alone',{CUTOVER_TEST_DISPOSABLE:'',CUTOVER_TEST_DATABASE_DISPOSABLE:'1'},'LIFECYCLE_DISPOSABLE_MARKER_REQUIRED'],
 ['unexpected local port',{CUTOVER_TEST_DATABASE_URL:'postgresql://cutover_test@127.0.0.1:6548/obrasaas_cutover_ci'},'PARTICIPANT_FIELD_DISPOSABLE_PORT_REQUIRED'],
 ['non-disposable role',{CUTOVER_TEST_DATABASE_URL:'postgresql://postgres@127.0.0.1:6549/obrasaas_cutover_ci'},'PARTICIPANT_FIELD_DISPOSABLE_ROLE_REQUIRED'],
 ['unexpected local credential',{CUTOVER_TEST_DATABASE_URL:'postgresql://cutover_test:cutover_test@127.0.0.1:6549/obrasaas_cutover_ci'},'PARTICIPANT_FIELD_DISPOSABLE_PASSWORD_REQUIRED'],
 ['production target marker',{VERCEL_TARGET_ENV:'production'},'PARTICIPANT_FIELD_PRODUCTION_TARGET_REJECTED'],
 ['valid CI service with mismatched Git source',{CI:'true',GITHUB_SHA:'0'.repeat(40),CUTOVER_TEST_DATABASE_URL:'postgresql://cutover_test:cutover_test@127.0.0.1:5432/obrasaas_cutover_ci'},'PARTICIPANT_FIELD_CI_SOURCE_REVISION_REQUIRED'],
])test('permission PG harness rejects '+name+' before connecting or creating its schema',()=>{
 const child=spawnSync(process.execPath,[pgHarness],{env:{...disposableEnvironment,...environment},encoding:'utf8',timeout:15000,windowsHide:true});assert.equal(child.error,undefined);assert.notEqual(child.status,0);assert.ok(child.stderr.includes(code),child.stderr);
});
