import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createParticipantHandlers} from '../src/lib/participant-http.mjs';
import {createParticipantStore} from '../src/lib/participant-store.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {scopeStamp} from '../src/lib/workspace-policy.mjs';
import {readEmployeeIntake} from '../src/lib/meta-employee-intake.mjs';
import {encryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {employeeIntakeFixture} from './fixtures/employee-intake-memory.mjs';

// Synthetic SQL adapter. Canonical membership, scope, project policy, cipher,
// admission receipt and DTO code execute; this is not PostgreSQL or delivery.
async function fixture(){
 const f=employeeIntakeFixture(),submitted=await f.submit();
 const receipt=await f.store.save(f.session,f.command('ADMIT_EMPLOYEE_INTAKE',{applicationId:submitted.applicationId,expectedRevision:submitted.revision,job:'WORKER',permissions:{attendance:false,report:true},confirmed:true}));
 const session={...f.session,authenticated:true,verification:'clerk-production-jwt'},member={...f.member,clerkRole:session.organizationRole,clerkUserId:session.userId},queries=[];
 const controls={activeMember:true,activeProject:true,assigned:true,role:'ADMIN',duplicateWorker:false,duplicateIntake:false},rows=value=>({rows:structuredClone(value)});
 const connect=async()=>({release(){},async query(sql,args=[]){
  queries.push({sql,args});assert.ok(/^(SELECT|BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY|SET LOCAL|ROLLBACK)/.test(sql),'Focused GET cannot write or commit');
  if(/^(BEGIN|SET LOCAL|ROLLBACK)/.test(sql))return rows([]);
  if(sql.includes('WHERE u."clerkUserId"=$1'))return rows(controls.activeMember&&args[0]===session.userId&&args[1]===session.organizationId&&args[2]===session.organizationRole?[{...member,role:controls.role}]:[]);
  if(sql.includes('FROM public."ProjectMembership"'))return rows(controls.assigned&&args[0]===f.target.id?[{id:'read-assignment'}]:[]);
  if(sql.includes('FROM public."Project"')&&!sql.includes('public."WhatsAppConnection"'))return rows(controls.activeProject&&args[0]===f.target.id&&args[1]===member.organizationId?[{...f.target,status:'ACTIVE',metadata:{},organizationMetadata:{}}]:[]);
  if(sql.includes('FROM public."TenantMembership"')&&sql.includes('AS "membershipId"')&&sql.includes('u."primaryEmail"'))return rows([]);
  if(sql.includes('FROM public."Worker"')){
   if(sql.includes('WHERE "projectId"=$1 AND ($2::boolean')){
    assert.match(sql,/metadata->'participant'->>'clerkUserId'=\$3/);
    let found=[...f.workers.values()].filter(row=>row.projectId===args[0]&&(args[1]||row.metadata.participant?.clerkUserId===args[2]&&row.metadata.participant?.status==='ACTIVE'&&row.active===true)&&(!args[3]||row.id>args[3]));
    if(args.length===5){assert.match(sql,/AND id=\$5 ORDER BY id LIMIT 2$/);found=found.filter(row=>row.id===args[4]);if(controls.duplicateWorker&&found.length)found.push({...found[0]});}
    else assert.match(sql,/ORDER BY id LIMIT 101$/);
    return rows(found.sort((a,b)=>a.id.localeCompare(b.id)).slice(0,args.length===5?2:101));
   }
   // ADMIN is already admitted. Other office roles are not linked participants.
   return rows([]);
  }
  if(sql.includes('FROM public."WebhookEvent"')&&sql.includes("AND id=$3 AND payload->'employeeIntake'->>'status'='ADMITTED'")){
   assert.match(sql,/"projectId"=\$1 AND provider='meta-customer-v1'/);assert.match(sql,/connectionId'=\$2/);assert.match(sql,/LIMIT 2$/);
   let found=[...f.events.values()].filter(row=>row.projectId===args[0]&&row.provider==='meta-customer-v1'&&row.payload.employeeIntake?.connectionId===args[1]&&row.id===args[2]&&row.payload.employeeIntake?.status==='ADMITTED');
   if(controls.duplicateIntake&&found.length)found.push({...found[0]});return rows(found.slice(0,2));
  }
  if(sql.includes('FROM public."AuditLog"')&&sql.includes("'INVITATION_ACCEPTED'"))return rows([]);
  return f.query(sql,args);
 }});
 const forbidden=()=>assert.fail('Focused read cannot call identity, provider or private storage');
 const store=createParticipantStore({workspace:createWorkspaceStore({connect}),connect:forbidden,identity:{verifyMembership:forbidden,verifiedEmail:forbidden,createInvitation:forbidden,findInvitation:forbidden},upload:forbidden,get:forbidden,environment:f.environment});
 const context=extra=>({projectId:f.target.id,scope:scopeStamp(session,{...member,role:controls.role}),...extra}),focus={workerId:receipt.workerId,intakeId:receipt.applicationId};
 const sealState=(id,state)=>{
  const anchor=f.events.get(id);anchor.payload.employeeIntake={...anchor.payload.employeeIntake,applicationId:id,revision:state.revision,status:state.status,lastEventId:state.lastEventId,encryptedState:encryptCustomerSecret(JSON.stringify(state),{organizationId:f.member.organizationId,projectId:f.project.id,purpose:'employee-intake',resourceId:id},f.environment)};
 };
 return {...f,session,member,queries,readControls:controls,store,connect,context,focus,receipt,sealState};
}

const request=search=>new Request('https://obrasaas.com/api/identity/participants?'+search);
test('HTTP focus is an exact pair, remains private and cannot mix with any other read contract',async()=>{
 const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Owner',organizationId:'org_A',organizationRole:'org:admin'},scope='a'.repeat(64),intakeId='customer_webhook_'+'b'.repeat(64),calls=[];
 const api=createParticipantHandlers({verify:async()=>session,store:{read:async(_session,input)=>{calls.push(input);return {participantFocus:{workerId:input.workerId,intakeId:input.intakeId}};},downloadKyc:async()=>assert.fail('Focus must not reach private images')}});
 const base=new URLSearchParams({projectId:'project-a',scope,workerId:'worker-a',intakeId});
 const response=await api.GET(request(base));assert.equal(response.status,200);assert.deepEqual(calls,[{projectId:'project-a',scope,workerId:'worker-a',intakeId}]);
 assert.deepEqual((await response.json()).participantFocus,{workerId:'worker-a',intakeId});assert.match(response.headers.get('Cache-Control'),/private.*no-store/);assert.match(response.headers.get('Vary'),/Cookie, Authorization/);assert.equal(response.headers.get('X-Robots-Tag'),'noindex, nofollow');
 for(const [key,value] of [['after','worker-b'],['intakeAfter',intakeId],['operationId',randomUUID()],['imageId','document-front'],['detail','existing-accounts'],['detail','private-bank-account'],['action','INVITE'],['query','person'],['afterAccount','cursor'],['accountId','member-a'],['organizationId','company-b']]){
  const bad=new URLSearchParams(base);bad.append(key,value);assert.equal((await api.GET(request(bad))).status,400,key);
 }
 for(const [key,value] of [['workerId',''],['workerId','../worker-a'],['intakeId',''],['intakeId','customer_webhook_'+'B'.repeat(64)],['intakeId','invite_'+'b'.repeat(32)]]){const bad=new URLSearchParams(base);bad.set(key,value);assert.equal((await api.GET(request(bad))).status,400);}
 for(const key of ['workerId','intakeId']){const missing=new URLSearchParams(base);missing.delete(key);assert.equal((await api.GET(request(missing))).status,400);const duplicate=new URLSearchParams(base);duplicate.append(key,base.get(key));assert.equal((await api.GET(request(duplicate))).status,400);}
 assert.equal(calls.length,1);
 const unsigned=createParticipantHandlers({verify:async()=>({authenticated:false}),store:{read:async()=>assert.fail('Unsigned focus reached data')}});assert.equal((await unsigned.GET(request(base))).status,401);
});

test('exact focus finds both records outside page 100 and grants no permissions, invitations or account claims',async()=>{
 const f=await fixture(),state=f.state(),original=f.events.get(f.focus.intakeId),beforeSends=f.controls.sends;
 for(let i=1;i<=103;i++){
  const id='customer_webhook_'+i.toString(16).padStart(64,'0');assert.ok(id<f.focus.intakeId);const next={...structuredClone(state),applicationId:id,status:'WAITING_RESPONSIBLE',step:'WAITING_RESPONSIBLE'};delete next.admission;
  f.events.set(id,{...structuredClone(original),id});f.sealState(id,next);
  const workerId='0-page-worker-'+String(i).padStart(3,'0');assert.ok(workerId<f.focus.workerId);f.workers.set(workerId,{id:workerId,projectId:f.target.id,name:'Synthetic page person',active:true,metadata:{},revision:'2026-10-06T00:00:00.000001'});
 }
 const normal=await f.store.read(f.session,f.context());assert.equal(normal.records.length,100);assert.equal(normal.employeeIntake.records.length,100);assert.ok(normal.nextCursor);assert.ok(normal.employeeIntake.nextCursor);assert.ok(!normal.records.some(row=>row.id===f.focus.workerId));assert.ok(!normal.employeeIntake.records.some(row=>row.id===f.focus.intakeId));assert.equal(normal.participantFocus,undefined);
 const before=JSON.stringify([...f.workers]),focused=await f.store.read(f.session,f.context(f.focus));
 assert.deepEqual(focused.participantFocus,f.focus);assert.deepEqual(focused.records.map(row=>row.id),[f.focus.workerId]);assert.deepEqual(focused.employeeIntake.records.map(row=>row.id),[f.focus.intakeId]);assert.equal(focused.employeeIntake.records[0].destinationProjectId,f.target.id);assert.equal(focused.employeeIntake.records[0].receiptId,f.receipt.receiptId);
 assert.deepEqual(focused.employeeIntake.records[0].permissions,{attendance:false,report:true});assert.deepEqual(focused.records[0].permissions,{attendance:false,report:false});assert.equal(focused.records[0].accountLinked,false);assert.equal(focused.records[0].identityCertified,false);assert.equal(focused.records[0].whatsAppAccessGranted,false);assert.equal(focused.records[0].status,'NOT_INVITED');assert.equal(focused.canInvite,true);
 assert.equal(focused.nextCursor,null);assert.equal(focused.employeeIntake.nextCursor,null);assert.equal(focused.nextAccountCursor,null);assert.deepEqual(focused.existingAccounts,[]);assert.equal(focused.existingAccountsTruncated,false);assert.equal(focused.noAutomaticKycApproval,true);
 assert.equal(JSON.stringify([...f.workers]),before);assert.equal(f.controls.sends,beforeSends);assert.equal(f.controls.providerCalls,0);assert.doesNotMatch(JSON.stringify(focused),/encryptedState|encryptedPayload|encryptedProof|encryptedAccessToken|employeeIntakeAdmission/);
 assert.ok(f.queries.filter(row=>row.sql.startsWith('BEGIN')).every(row=>row.sql.endsWith('READ ONLY')));
});

test('focus remains scoped to current membership, scope, project and company-channel assignment',async()=>{
 const f=await fixture();for(const extra of [{workerId:f.focus.workerId},{intakeId:f.focus.intakeId},{...f.focus,after:null},{...f.focus,intakeAfter:null},{...f.focus,operationId:randomUUID()},{...f.focus,intakeId:42}])await assert.rejects(async()=>f.store.read(f.session,f.context(extra)),{code:'PARTICIPANT_INPUT_INVALID'});
 assert.equal(f.queries.length,0);
 await assert.rejects(f.store.read(f.session,f.context({...f.focus,scope:'b'.repeat(64)})),{code:'WORKSPACE_CONTEXT_CHANGED'});
 await assert.rejects(f.store.read({...f.session,organizationId:'org_Other'},f.context(f.focus)),{code:'WORKSPACE_MEMBERSHIP_REQUIRED'});
 await assert.rejects(f.store.read(f.session,f.context({...f.focus,projectId:'other-project'})),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});
 for(const role of ['DIRECTOR','SITE_MANAGER','FINANCE','AUDITOR']){f.readControls.role=role;await assert.rejects(f.store.read(f.session,f.context(f.focus)),{code:'PARTICIPANT_INVITE_REQUIRED'});}f.readControls.role='ADMIN';
 f.readControls.activeMember=false;await assert.rejects(f.store.read(f.session,f.context(f.focus)),{code:'WORKSPACE_MEMBERSHIP_REQUIRED'});f.readControls.activeMember=true;
 f.readControls.activeProject=false;await assert.rejects(f.store.read(f.session,f.context(f.focus)),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});f.readControls.activeProject=true;
 f.controls.assignment=false;await assert.rejects(f.store.read(f.session,f.context(f.focus)),{code:'PARTICIPANT_INTAKE_UNAVAILABLE',status:404});f.controls.assignment=true;
 f.controls.mode='SUSPENDED';await assert.rejects(f.store.read(f.session,f.context(f.focus)),{code:'PARTICIPANT_INTAKE_UNAVAILABLE',status:404});f.controls.mode='COMPANY';
 assert.equal(f.controls.providerCalls,0);
});

test('missing, unrelated, cross-channel and cross-project focus cannot return a partial row or substitute another worker',async()=>{
 const f=await fixture(),context=()=>f.context(f.focus),original=structuredClone(f.events.get(f.focus.intakeId)),worker=f.workers.get(f.focus.workerId);
 for(const focus of [{...f.focus,intakeId:'customer_webhook_'+'f'.repeat(64)},{...f.focus,workerId:'another-worker'}])await assert.rejects(f.store.read(f.session,f.context(focus)),{code:'PARTICIPANT_INTAKE_UNAVAILABLE',status:404});
 for(const change of [row=>{row.projectId='foreign-anchor';},row=>{row.provider='foreign-provider';},row=>{row.payload.employeeIntake.connectionId='foreign-channel';},row=>{row.payload.employeeIntake.status='WAITING_RESPONSIBLE';}]){change(f.events.get(f.focus.intakeId));await assert.rejects(f.store.read(f.session,context()),{code:'PARTICIPANT_INTAKE_UNAVAILABLE',status:404});f.events.set(f.focus.intakeId,structuredClone(original));}
 const state=f.state();state.admission.projectId='other-project';f.sealState(f.focus.intakeId,state);await assert.rejects(f.store.read(f.session,context()),{code:'PARTICIPANT_INTAKE_UNAVAILABLE',status:404});f.events.set(f.focus.intakeId,structuredClone(original));
 worker.projectId='other-project';await assert.rejects(f.store.read(f.session,context()),{code:'PARTICIPANT_INTAKE_UNAVAILABLE',status:404});worker.projectId=f.target.id;
 const admission=structuredClone(worker.metadata.employeeIntakeAdmission);worker.metadata.employeeIntakeAdmission.applicationId='customer_webhook_'+'e'.repeat(64);await assert.rejects(f.store.read(f.session,context()),{code:'PARTICIPANT_INTAKE_UNAVAILABLE',status:404});worker.metadata.employeeIntakeAdmission=admission;
 f.readControls.duplicateWorker=true;await assert.rejects(f.store.read(f.session,context()),{code:'PARTICIPANT_INTAKE_UNAVAILABLE',status:404});f.readControls.duplicateWorker=false;
 f.readControls.duplicateIntake=true;await assert.rejects(f.store.read(f.session,context()),{code:'PARTICIPANT_INTAKE_UNAVAILABLE',status:404});
 assert.equal(f.controls.providerCalls,0);
});

test('fresh focused DTO preserves delivery receipts and denies mismatched admission permissions',async()=>{
 const f=await fixture(),worker=f.workers.get(f.focus.workerId),invitationId='invite_'+'a'.repeat(32),outboundId='customer_outbound_'+'b'.repeat(64),consentReceiptId='participant_'+'c'.repeat(64);
 worker.metadata.participant={version:1,status:'INVITED',invitation:{id:invitationId,state:'SENT',email:'person@example.invalid',createdBy:f.member.actorId,expiresAt:new Date(f.now.getTime()+86400000).toISOString()},kyc:{status:'NOT_SUBMITTED'},onboardingConsent:{status:'GRANTED'},onboardingDelivery:{state:'SEND_STARTED',outboundId,anchorProjectId:f.project.id,invitationId,consentReceiptId}};
 f.outbounds.set(outboundId,{id:outboundId,projectId:f.project.id,payload:{participantOnboarding:true,organizationId:f.member.organizationId,targetProjectId:f.target.id,workerId:worker.id,invitationId,consentReceiptId},outcome:{state:'STATUS_OBSERVED',providerStatus:'delivered'}});
 const before=JSON.stringify(worker),page=await f.store.read(f.session,f.context(f.focus));assert.equal(page.records[0].revision,worker.revision);assert.equal(page.records[0].invitation.id,invitationId);assert.equal(page.records[0].onboardingDelivery.state,'STATUS_OBSERVED');assert.equal(page.records[0].onboardingDelivery.deliveryConfirmed,true);assert.equal(page.records[0].onboardingDelivery.automaticResendAllowed,false);assert.equal(JSON.stringify(worker),before);
 worker.metadata.employeeIntakeAdmission.permissions={attendance:true,report:true};await assert.rejects(f.store.read(f.session,f.context(f.focus)),{code:'EMPLOYEE_INTAKE_INTEGRITY'});assert.equal(f.controls.providerCalls,0);
});

test('JSONB permission key order differs from sealed JSON without changing the exact reviewed contract',async()=>{
 const f=await fixture(),worker=f.workers.get(f.focus.workerId);worker.metadata.employeeIntakeAdmission.permissions={report:true,attendance:false};
 const page=await f.store.read(f.session,f.context(f.focus));assert.deepEqual(page.employeeIntake.records[0].permissions,{attendance:false,report:true});assert.deepEqual(page.records[0].permissions,{attendance:false,report:false});
 const state=f.state();state.admission.permissions={...state.admission.permissions,extra:true};f.sealState(f.focus.intakeId,state);await assert.rejects(f.store.read(f.session,f.context(f.focus)),{code:'EMPLOYEE_INTAKE_INTEGRITY'});
});

test('focused intake helper validates before SQL and preserves legacy unprivileged read behavior',async()=>{
 const f=await fixture(),client={query:()=>assert.fail('Invalid focus reached SQL')};
 for(const focus of [{intakeId:f.focus.intakeId},{workerId:f.focus.workerId},{...f.focus,extra:true},[],null]){if(focus===null)continue;await assert.rejects(readEmployeeIntake(client,f.member,f.target.id,f.environment,null,focus),{code:'PARTICIPANT_INPUT_INVALID'});}
 await assert.rejects(readEmployeeIntake(client,f.member,f.target.id,f.environment,f.focus.intakeId,f.focus),{code:'PARTICIPANT_INPUT_INVALID'});
 assert.equal(await readEmployeeIntake(client,{...f.member,role:'AUDITOR'},f.target.id,f.environment),null);await assert.rejects(readEmployeeIntake(client,{...f.member,role:'AUDITOR'},f.target.id,f.environment,null,f.focus),{code:'PARTICIPANT_INVITE_REQUIRED'});
});
