import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {employeeIntakeFixture} from './fixtures/employee-intake-memory.mjs';
import {createSiteRegister} from '../src/lib/site-register-store.mjs';
import {customerJobTransaction} from '../src/lib/meta-customer-outbound.mjs';
import {employeeIntakeAcceptedPermissions} from '../src/lib/meta-employee-intake.mjs';
import {participantCommand} from '../src/lib/participant-policy.mjs';
import {employeeIntakeExistingWorkerChoice} from '../src/app/(identity)/cuenta/employee-intake-continuity.mjs';
import {createWorkspaceRecoveryJournal} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';
import {encryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';

async function fixture(){
 const f=employeeIntakeFixture(),state=await f.submit();
 const register=createSiteRegister({workspace:{integrationProject:(_session,_context,_writable,run)=>customerJobTransaction(f.connect,client=>run(client,f.member,f.scope,f.target))}});
 const registered=await register.save(f.session,f.command('ADD_PERSON',{name:'Ficha actual declarada',phone:state.sender,job:state.job}));
 const worker=f.workers.get(registered.person.id),candidate=(await f.read()).records[0].existingWorker;
 assert.ok(candidate);
 const input=f.command('ADMIT_EMPLOYEE_INTAKE',{applicationId:state.applicationId,expectedRevision:state.revision,job:worker.metadata.siteRegister.job,permissions:{attendance:false,report:true},confirmed:true,existingWorker:employeeIntakeExistingWorkerChoice(candidate)});
 return {...f,stateBefore:state,worker,candidate,input,registration:f.audits.get(registered.receiptId)};
}
const projection=f=>structuredClone({workers:[...f.workers],events:[...f.events],outbounds:[...f.outbounds],policy:f.connection.metadata.employeeIntakePolicy});
async function rejectSelection(f){
 const before=projection(f),auditCount=f.audits.size,counts={sends:f.controls.sends,providerCalls:f.controls.providerCalls};
 const result=await f.store.save(f.session,f.input);
 assert.equal(result.state,'REJECTED');assert.equal(result.code,'EMPLOYEE_INTAKE_REVISION_CHANGED');assert.equal(result.workerId,null);assert.equal(result.permissionsGranted,false);
 assert.deepEqual(projection(f),before);assert.equal(f.audits.size,auditCount+1);assert.deepEqual({sends:f.controls.sends,providerCalls:f.controls.providerCalls},counts);
 assert.deepEqual(await f.store.save(f.session,f.input),result);assert.equal(f.audits.size,auditCount+1);
}

test('explicit current-profile selection preserves roster and consent and records only admission provenance',async()=>{
 const f=await fixture(),before=structuredClone(f.worker),state=structuredClone(f.state()),policy=structuredClone(f.connection.metadata.employeeIntakePolicy),counts={workers:f.workers.size,audits:f.audits.size,sends:f.controls.sends,providerCalls:f.controls.providerCalls};
 const result=await f.store.save(f.session,f.input),worker=f.workers.get(result.workerId),admission=worker.metadata.employeeIntakeAdmission;
 assert.equal(result.state,'RECORDED');assert.equal(result.workerId,before.id);assert.equal(result.personReceiptId,f.registration.id);assert.equal(result.permissionsGranted,false);assert.equal(f.workers.size,counts.workers);assert.equal(f.audits.size,counts.audits+1);
 // PostgreSQL advances updatedAt; only the roster fields remain unchanged.
 assert.deepEqual({...worker,metadata:before.metadata,revision:before.revision},before);assert.deepEqual({...worker.metadata,employeeIntakeAdmission:undefined},{...before.metadata,employeeIntakeAdmission:undefined});
 assert.equal(worker.metadata.participant,undefined);assert.equal(worker.metadata.siteRegister.identityStatus,'UNVERIFIED');assert.equal(worker.metadata.siteRegister.channelVerified,false);
 assert.deepEqual(admission.rosterSource,{version:1,kind:'EXISTING',...f.input.payload.existingWorker});assert.deepEqual(f.audits.get(result.receiptId).metadata.rosterSource,admission.rosterSource);
 assert.equal(f.state().status,'ADMITTED');assert.equal(f.state().revision,state.revision+1);assert.equal(f.state().consent,state.consent);assert.equal(f.state().policyDigest,state.policyDigest);assert.equal(f.state().noticeSha256,state.noticeSha256);assert.equal(f.state().applicationId,state.applicationId);assert.deepEqual(f.connection.metadata.employeeIntakePolicy,policy);
 assert.deepEqual(await employeeIntakeAcceptedPermissions({query:f.query},worker,{organizationId:f.member.organizationId,projectId:f.target.id}),{attendance:false,report:true});
 assert.deepEqual({sends:f.controls.sends,providerCalls:f.controls.providerCalls},{sends:counts.sends,providerCalls:counts.providerCalls});assert.deepEqual(await f.store.save(f.session,f.input),result);assert.equal(f.audits.size,counts.audits+1);
});

test('the read exposes an unselected current contact candidate and is read-only',async()=>{
 const f=await fixture(),before=projection(f),audits=structuredClone([...f.audits]);
 const row=(await f.read()).records[0];assert.equal(row.workerId,null);assert.equal(row.existingWorkerConflict,true);assert.equal(row.existingWorker.name,'Ficha actual declarada');assert.notEqual(row.existingWorker.name,row.name);assert.equal(row.existingWorker.workerId,f.worker.id);
 assert.deepEqual(projection(f),before);assert.deepEqual([...f.audits],audits);
 assert.deepEqual(employeeIntakeExistingWorkerChoice({...row.existingWorker,email:'private@example.invalid',permissions:{report:true}}),f.input.payload.existingWorker);
 assert.equal(Object.hasOwn(f.input.payload.existingWorker,'name'),false);assert.equal(Object.hasOwn(f.input.payload.existingWorker,'phone'),false);
});

test('CREATE keeps its historical duplicate denial and never silently adopts the matching profile',async()=>{
 const f=await fixture(),input=structuredClone(f.input);delete input.payload.existingWorker;const before=projection(f),audits=structuredClone([...f.audits]);
 await assert.rejects(f.store.save(f.session,input),{code:'SITE_PHONE_ALREADY_REGISTERED'});assert.deepEqual(projection(f),before);assert.deepEqual([...f.audits],audits);
});

test('historical CREATE still creates a fresh unverified profile when there is no existing contact',async()=>{
 const f=employeeIntakeFixture(),state=await f.submit(),input=f.command('ADMIT_EMPLOYEE_INTAKE',{applicationId:state.applicationId,expectedRevision:state.revision,job:'WORKER',permissions:{attendance:false,report:false},confirmed:true});
 const read=(await f.read()).records[0];assert.equal(read.existingWorker,null);assert.equal(read.existingWorkerConflict,false);
 const result=await f.store.save(f.session,input);assert.equal(result.state,'RECORDED');assert.equal(f.workers.size,1);assert.equal(f.workers.get(result.workerId).metadata.employeeIntakeAdmission.rosterSource,undefined);
});

const changes=[
 ['selected worker',f=>f.input.payload.existingWorker.workerId='worker-other'],
 ['selected revision',f=>f.input.payload.existingWorker.revision='2026-10-07T00:00:00.000001'],
 ['selected receipt',f=>f.input.payload.existingWorker.registrationReceiptId='site_'+'f'.repeat(64)],
 ['selected snapshot',f=>f.input.payload.existingWorker.snapshotDigest='f'.repeat(64)],
 ['requested job',f=>f.input.payload.job='WORKER'],
 ['current revision',f=>f.worker.revision='2026-10-07T00:00:00.000001'],
 ['current name with unchanged revision',f=>f.worker.name='Otro nombre actual'],
 ['current contact',f=>f.worker.phone='+15550009999'],
 ['current role',f=>f.worker.role='Administrador'],
 ['current job',f=>f.worker.metadata.siteRegister.job='WORKER'],
 ['current snapshot metadata',f=>f.worker.metadata.extraCurrentChoice=true],
 ['inactive worker',f=>f.worker.active=false],
 ['other destination',f=>f.worker.projectId=f.project.id],
 ['verified identity marker',f=>f.worker.metadata.siteRegister.identityStatus='VERIFIED'],
 ['verified channel marker',f=>f.worker.metadata.siteRegister.channelVerified=true],
 ['noncanonical roster source',f=>f.worker.metadata.siteRegister.source='imported'],
 ['prior empty participation',f=>f.worker.metadata.participant={}],
 ['prior null participation',f=>f.worker.metadata.participant=null],
 ['prior invitation',f=>f.worker.metadata.participant={invitation:{state:'SENT'}}],
 ['prior account',f=>f.worker.metadata.participant={clerkUserId:'user_Person'}],
 ['prior KYC',f=>f.worker.metadata.kyc={status:'NOT_SUBMITTED'}],
 ['prior admission',f=>f.worker.metadata.employeeIntakeAdmission={}],
 ['missing creation receipt',f=>f.audits.delete(f.registration.id)],
 ['foreign organization receipt',f=>f.registration.organizationId='other-company'],
 ['foreign project receipt',f=>f.registration.metadata.projectId=f.project.id],
 ['foreign worker receipt',f=>f.registration.entityId='worker-other'],
 ['wrong entity type receipt',f=>f.registration.entityType='Worker'],
 ['activation rather than creation receipt',f=>f.registration.metadata.command='SET_PERSON_ACTIVE'],
 ['wrong receipt kind',f=>f.registration.metadata.kind='REPORT'],
 ['wrong receipt metadata entity',f=>f.registration.metadata.entityId='worker-other'],
 ['wrong receipt job',f=>f.registration.metadata.details.job='WORKER'],
 ['receipt grants channel',f=>f.registration.metadata.details.channelVerified=true],
 ['receipt grants login',f=>f.registration.metadata.details.loginAccessGranted=true],
 ['missing receipt commitment',f=>delete f.registration.metadata.requestDigest],
 ['duplicate original receipts',f=>{const other=structuredClone(f.registration);other.id='site_'+'e'.repeat(64);f.audits.set(other.id,other);} ],
 ['duplicate contact profiles',f=>{const other=structuredClone(f.worker);other.id='worker-other';f.workers.set(other.id,other);} ],
];
for(const [name,change] of changes)test(`existing selection rejects ${name} without changing roster, source or consent`,async()=>{const f=await fixture();change(f);await rejectSelection(f);});

const markers=[
 ['participant.invitation.attempted',undefined],
 ...['INVITATION_SENT','INVITATION_ACCEPTED','EXISTING_ACCOUNT_ASSIGNED','FIELD_PERMISSIONS_CHANGED','REVOKE','RESTORE_ACCESS','PREPARE_KYC_CHAT','CANCEL_KYC_CHAT','KYC_SUBMITTED','PROCESS_KYC','REVIEW_KYC','SEND_ONBOARDING_WHATSAPP','PRIVATE_BANK_ACCOUNT','UNKNOWN_PARTICIPANT_KIND',undefined].map(kind=>['participant.operation.recorded',kind]),
 ...['prepared','projected','dispatched','closed','account_bound','adopted'].map(kind=>['participant.kyc_chat.'+kind,undefined]),
 ['worker.channel.identity.recorded',undefined],['participant.onboarding.reactive_handoff',undefined],
];
for(const [action,kind] of markers)test(`canonical ${action}/${kind||'no-kind'} prevents adoption even after metadata is stripped`,async()=>{
 const f=await fixture(),id='marker-'+randomUUID();f.audits.set(id,{id,organizationId:f.member.organizationId,actorId:'another-actor',action,entityType:'Worker',entityId:f.worker.id,metadata:{...(kind?{kind}:{}),projectId:'other-historical-project'}});await rejectSelection(f);
});

test('canonical admission on another application cannot disappear with deleted Worker metadata',async()=>{
 const f=await fixture(),id='prior-admission';f.audits.set(id,{id,organizationId:f.member.organizationId,actorId:'another-actor',action:'participant.operation.recorded',entityType:'WebhookEvent',entityId:'customer_webhook_'+'e'.repeat(64),metadata:{kind:'ADMIT_EMPLOYEE_INTAKE',workerId:f.worker.id}});await rejectSelection(f);
});

test('contact-only history does not invent a participant and current consent metadata is preserved',async()=>{
 const f=await fixture();f.worker.metadata.currentContactPreference={allowed:false};
 for(const [id,action,kind] of [['contact-only','participant.onboarding.contact_authorized',undefined],['contact-revoke','participant.operation.recorded','REVOKE_ONBOARDING_CONTACT']])f.audits.set(id,{id,organizationId:f.member.organizationId,actorId:'another-actor',action,entityType:'Worker',entityId:f.worker.id,metadata:{...(kind?{kind}:{}),projectId:f.target.id}});
 f.input.payload.existingWorker=employeeIntakeExistingWorkerChoice((await f.read()).records[0].existingWorker);
 const result=await f.store.save(f.session,f.input);assert.equal(result.state,'RECORDED');assert.deepEqual(f.workers.get(result.workerId).metadata.currentContactPreference,{allowed:false});assert.equal(f.workers.get(result.workerId).metadata.participant,undefined);
});

test('a creation receipt issued by another responsible actor can prove provenance without proving identity',async()=>{
 const f=await fixture();f.registration.actorId='historical-manager';assert.equal((await f.read()).records[0].existingWorker.workerId,f.worker.id);assert.equal((await f.store.save(f.session,f.input)).state,'RECORDED');
});

test('existing-selection input is strict, complete and never accepted by REJECT',async()=>{
 const f=await fixture();assert.deepEqual(participantCommand(f.input),f.input);
 for(const mutate of [x=>x.payload.existingWorker=null,x=>x.payload.existingWorker=[],x=>delete x.payload.existingWorker.workerId,x=>delete x.payload.existingWorker.snapshotDigest,x=>x.payload.existingWorker.revision='old',x=>x.payload.existingWorker.registrationReceiptId='site_invalid',x=>x.payload.existingWorker.snapshotDigest='bad',x=>x.payload.existingWorker.email='private@example.invalid',x=>x.payload.existingWorker.permissions={report:true},x=>x.payload.confirmed=false]){const input=structuredClone(f.input);mutate(input);assert.throws(()=>participantCommand(input),{code:'PARTICIPANT_INPUT_INVALID'});}
 const rejected={...f.input,action:'REJECT_EMPLOYEE_INTAKE',payload:{connectionId:f.connection.id,applicationId:f.stateBefore.applicationId,expectedRevision:f.stateBefore.revision,reason:'Responsible rejection',existingWorker:f.input.payload.existingWorker}};assert.throws(()=>participantCommand(rejected),{code:'PARTICIPANT_INPUT_INVALID'});
});

test('receipt and snapshot fields reject JSON coercion in both command and UI projection',async()=>{
 const f=await fixture();
 for(const key of ['registrationReceiptId','snapshotDigest'])for(const value of [[f.input.payload.existingWorker[key]],null,1,{value:f.input.payload.existingWorker[key]}]){
  const input=structuredClone(f.input);input.payload.existingWorker[key]=value;
  assert.throws(()=>participantCommand(input),{code:'PARTICIPANT_INPUT_INVALID'});assert.equal(employeeIntakeExistingWorkerChoice(input.payload.existingWorker),null);
 }
});

test('a full waiting page uses three roster queries and preserves exact source candidates',async()=>{
 const f=await fixture(),original=f.events.get(f.stateBefore.applicationId);
 for(let i=0;i<100;i++){
  const id='customer_webhook_'+i.toString(16).padStart(64,'0'),row=structuredClone(original),state={...f.stateBefore,applicationId:id};
  row.id=id;row.payload.employeeIntake.applicationId=id;row.payload.employeeIntake.encryptedState=encryptCustomerSecret(JSON.stringify(state),{organizationId:f.project.organizationId,projectId:f.project.id,purpose:'employee-intake',resourceId:id},f.environment);f.events.set(id,row);
 }
 const before=projection(f);f.controls.sql=[];
 const result=await f.read(),queries=f.controls.sql.filter(({sql})=>sql.includes('current_roster')||sql.includes('roster_receipts')||sql.includes('prior_participation'));
 assert.equal(result.records.length,100);assert.ok(result.nextCursor);assert.equal(queries.length,3);assert.deepEqual(queries[0].args,[f.target.id,[f.stateBefore.sender.slice(1)]]);assert.deepEqual(queries[1].args,[f.member.organizationId,[f.worker.id]]);assert.deepEqual(queries[2].args,queries[1].args);
 for(const row of result.records){assert.equal(row.existingWorkerConflict,true);assert.deepEqual(employeeIntakeExistingWorkerChoice(row.existingWorker),f.input.payload.existingWorker);assert.equal(row.workerId,null);}
 assert.deepEqual(projection(f),before);
});

test('page-wide receipts and history remain isolated by worker and fail closed on duplicates',async()=>{
 const f=await fixture(),register=createSiteRegister({workspace:{integrationProject:(_session,_context,_writable,run)=>customerJobTransaction(f.connect,client=>run(client,f.member,f.scope,f.target))}});
 const created=await register.save(f.session,f.command('ADD_PERSON',{name:'Segunda ficha sintética',phone:'+15550009999',job:'WORKER'})),other=f.workers.get(created.person.id);
 // This encrypted read fixture isolates grouping; it is not callback acceptance.
 const id='customer_webhook_'+'f'.repeat(64),anchor=structuredClone(f.events.get(f.stateBefore.applicationId)),state={...f.stateBefore,applicationId:id,sender:other.phone};
 anchor.id=id;anchor.payload.employeeIntake.applicationId=id;anchor.payload.employeeIntake.encryptedState=encryptCustomerSecret(JSON.stringify(state),{organizationId:f.project.organizationId,projectId:f.project.id,purpose:'employee-intake',resourceId:id},f.environment);f.events.set(id,anchor);
 const marker={id:'unrelated-history',organizationId:f.member.organizationId,actorId:f.member.actorId,action:'participant.invitation.attempted',entityType:'Worker',entityId:other.id,metadata:{}};f.audits.set(marker.id,marker);
 let rows=(await f.read()).records;assert.equal(rows.find(r=>r.id===f.stateBefore.applicationId).existingWorker.workerId,f.worker.id);assert.equal(rows.find(r=>r.id===id).existingWorker,null);
 marker.entityId=f.worker.id;rows=(await f.read()).records;assert.equal(rows.find(r=>r.id===f.stateBefore.applicationId).existingWorker,null);assert.equal(rows.find(r=>r.id===id).existingWorker.workerId,other.id);
 f.audits.delete(marker.id);const duplicate=structuredClone(f.registration);duplicate.id='site_'+'d'.repeat(64);f.audits.set(duplicate.id,duplicate);rows=(await f.read()).records;assert.equal(rows.find(r=>r.id===f.stateBefore.applicationId).existingWorker,null);assert.equal(rows.find(r=>r.id===id).existingWorker.workerId,other.id);
});

test('a crossed Worker admission marker blocks the metadata-linked candidate in both read and mutation',async()=>{
 const f=await fixture(),id='crossed-history';f.audits.set(id,{id,organizationId:f.member.organizationId,actorId:'other-actor',action:'participant.operation.recorded',entityType:'Worker',entityId:'another-worker',metadata:{kind:'ADMIT_EMPLOYEE_INTAKE',workerId:f.worker.id}});
 const row=(await f.read()).records[0];assert.equal(row.existingWorkerConflict,true);assert.equal(row.existingWorker,null);await rejectSelection(f);
});

test('current channel, issuer, policy and administrative authority still gate the explicit selection',async()=>{
 for(const change of [f=>f.connection.enabled=false,f=>f.controls.issuerActive=false,f=>f.controls.targetAssignment=false,f=>f.member.role='DIRECTOR',f=>f.session.organizationRole='org:member']){const f=await fixture();change(f);const before=projection(f);await assert.rejects(f.store.save(f.session,f.input));assert.deepEqual(projection(f),before);}
 const f=await fixture();await f.configure(false);const before=projection(f);await assert.rejects(f.store.save(f.session,f.input),{code:'EMPLOYEE_INTAKE_DISABLED'});assert.deepEqual(projection(f),before);
});

test('audit failure rolls back existing metadata and the exact original intake state',async()=>{
 const f=await fixture(),before=projection(f),audits=structuredClone([...f.audits]);f.controls.failIntakeAudit=true;await assert.rejects(f.store.save(f.session,f.input),/SYNTHETIC_ADMISSION_AUDIT_FAILURE/);assert.deepEqual(projection(f),before);assert.deepEqual([...f.audits],audits);
});

test('lost committed ACK recovers the same admission without another roster write or external action',async()=>{
 const f=await fixture(),workers=f.workers.size,audits=f.audits.size;f.controls.loseCommit=true;await assert.rejects(f.store.save(f.session,f.input),/SYNTHETIC_COMMITTED_RESPONSE_LOST/);
 const result=await f.store.status(f.session,{scope:f.scope,projectId:f.target.id,operationId:f.input.operationId});assert.equal(result.state,'RECORDED');assert.equal(result.workerId,f.worker.id);assert.equal(f.workers.size,workers);assert.equal(f.audits.size,audits+1);assert.deepEqual(await f.store.save(f.session,f.input),result);assert.equal(f.audits.size,audits+1);
 const changed=structuredClone(f.input);changed.payload.existingWorker.snapshotDigest='f'.repeat(64);await assert.rejects(f.store.save(f.session,changed),{code:'PARTICIPANT_OPERATION_CONFLICT'});
});

test('concurrent different admissions cannot overwrite one profile admission',async()=>{
 const f=await fixture(),other={...f.input,operationId:randomUUID()};const results=await Promise.all([f.store.save(f.session,f.input),f.store.save(f.session,other)]);assert.equal(results.filter(x=>x.state==='RECORDED').length,1);assert.equal(results.filter(x=>x.state==='REJECTED').length,1);assert.equal(f.workers.size,1);assert.equal(f.state().revision,f.stateBefore.revision+1);
});

test('selection snapshot and creation receipt lock follow the intake anchor and precede the Worker update',async()=>{
 const f=await fixture();f.controls.sql=[];await f.store.save(f.session,f.input);const statements=f.controls.sql.map(x=>x.sql),anchor=statements.findIndex(x=>x.includes('FROM public."WebhookEvent"')&&x.includes('FOR UPDATE')),worker=statements.findIndex(x=>x.startsWith('SELECT id,"projectId",name,phone,')&&x.includes('FOR UPDATE')),receipt=statements.findIndex(x=>x.includes("metadata->>'command'='ADD_PERSON'")&&x.includes('FOR SHARE')),write=statements.findIndex(x=>x.startsWith('UPDATE public."Worker"'));assert.ok(anchor>=0&&worker>anchor&&receipt>worker&&write>receipt);
});

test('recovery storage contains only the original operation reference and no current roster snapshot',async()=>{
 const f=await fixture(),rows=new Map(),storage={getItem:key=>rows.get(key)||null,setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key)},journal=createWorkspaceRecoveryJournal({getStorage:()=>storage,now:()=>123456});
 const ticket=await journal.prepare('/api/identity/participants',{method:'POST',body:JSON.stringify(f.input)}),stored=JSON.stringify([...rows]);
 for(const value of [f.worker.name,f.worker.phone,f.worker.id,f.registration.id,f.input.payload.existingWorker.snapshotDigest,'existingWorker'])assert.equal(stored.includes(value),false,value);
 assert.equal(ticket.entry.applicationId,f.stateBefore.applicationId);assert.equal(ticket.entry.operationId,f.input.operationId);
});

test('a tampered preserved roster provenance cannot authorize later field permissions',async()=>{
 const f=await fixture(),saved=await f.store.save(f.session,f.input),worker=f.workers.get(saved.workerId);worker.metadata.employeeIntakeAdmission.rosterSource.snapshotDigest='f'.repeat(64);
 await assert.rejects(employeeIntakeAcceptedPermissions({query:f.query},worker,{organizationId:f.member.organizationId,projectId:f.target.id}),{code:'EMPLOYEE_INTAKE_INTEGRITY'});
});

test('identically malformed admission provenance is rejected even if both stored copies agree',async()=>{
 for(const corrupt of [()=>null,s=>({...s,version:2}),s=>({...s,kind:'IDENTITY_VERIFIED'}),s=>({...s,workerId:'other-worker'}),s=>({...s,registrationReceiptId:'site_'+'e'.repeat(64)}),s=>({...s,revision:['2026-10-06T00:00:00.000001']}),s=>({...s,snapshotDigest:[s.snapshotDigest]}),s=>({...s,extra:true})]){
  const f=await fixture(),saved=await f.store.save(f.session,f.input),worker=f.workers.get(saved.workerId),value=corrupt(worker.metadata.employeeIntakeAdmission.rosterSource);
  worker.metadata.employeeIntakeAdmission.rosterSource=structuredClone(value);f.audits.get(saved.receiptId).metadata.rosterSource=structuredClone(value);
  await assert.rejects(employeeIntakeAcceptedPermissions({query:f.query},worker,{organizationId:f.member.organizationId,projectId:f.target.id}),{code:'EMPLOYEE_INTAKE_INTEGRITY'});
 }
});
