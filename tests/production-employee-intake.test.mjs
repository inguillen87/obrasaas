import test from 'node:test';
import assert from 'node:assert/strict';
import {employeeIntakeFixture} from './fixtures/employee-intake-memory.mjs';
import {employeeIntakeAcceptedPermissions,resolveEmployeeIntakeAuthority,employeeIntakeOutcome,readEmployeeIntake} from '../src/lib/meta-employee-intake.mjs';
import {customerJobTransaction} from '../src/lib/meta-customer-outbound.mjs';
import {createMetaKycOutbound} from '../src/lib/meta-kyc-outbound.mjs';
import {metaCustomerContentDigest} from '../src/lib/meta-customer-callback.mjs';
import {randomUUID} from 'node:crypto';

test('OFF is explicit and an unknown HOLA cannot create a person, actor or send',async()=>{
 const f=employeeIntakeFixture();await assert.rejects(f.execute('HOLA'),{code:'EMPLOYEE_INTAKE_DISABLED'});assert.equal(f.controls.sends,0);assert.equal(f.workers.size,0);assert.equal(f.audits.size,0);
});
test('signed conversation consent is encrypted, retains original envelope and grants no office or field authority',async()=>{
 const f=employeeIntakeFixture();const s=await f.submit();assert.equal(s.status,'WAITING_RESPONSIBLE');assert.equal(s.job,'OWNER');assert.equal(s.consent,true);assert.equal(f.controls.sends,5);assert.equal(f.workers.size,0);
 const anchor=f.events.get(s.applicationId),before={encryptedPayload:anchor.payload.encryptedPayload,encryptedProof:anchor.payload.encryptedProof,payloadDigest:anchor.payload.payloadDigest};
 const text=JSON.stringify([...f.events]);for(const value of ['Persona Sintética','person@example.invalid','15550001001'])assert.equal(text.includes(value),false,value);
 const inbox=await f.read();assert.equal(inbox.records.length,1);assert.equal(inbox.records[0].phone,'+15550001001');assert.equal(inbox.records[0].workerId,null);assert.equal(f.controls.providerCalls,0);
 assert.deepEqual({encryptedPayload:anchor.payload.encryptedPayload,encryptedProof:anchor.payload.encryptedProof,payloadDigest:anchor.payload.payloadDigest},before);
});
test('human admission reuses ADD_PERSON in destination B with canonical receipt, reviewed permissions and no automatic identity',async()=>{
 const f=employeeIntakeFixture(),s=await f.submit(),input=f.command('ADMIT_EMPLOYEE_INTAKE',{applicationId:s.applicationId,expectedRevision:s.revision,job:'WORKER',permissions:{attendance:false,report:true},confirmed:true});
 const saved=await f.store.save(f.session,input);assert.equal(saved.state,'RECORDED');assert.equal(saved.permissionsGranted,false);assert.match(saved.personReceiptId,/^site_/);assert.equal(f.workers.size,1);
 const w=f.workers.get(saved.workerId);assert.equal(w.projectId,f.target.id);assert.equal(w.metadata.siteRegister.job,'WORKER');assert.equal(w.metadata.siteRegister.identityStatus,'UNVERIFIED');assert.equal(w.metadata.participant,undefined);assert.equal(w.metadata.employeeIntakeAdmission.email,'person@example.invalid');
 assert.deepEqual(await employeeIntakeAcceptedPermissions({query:f.query},w,{organizationId:f.member.organizationId,projectId:f.target.id}),{attendance:false,report:true});assert.deepEqual(await f.store.save(f.session,input),saved);assert.equal(f.workers.size,1);assert.equal(f.controls.providerCalls,0);
 assert.equal((await f.store.status(f.session,{projectId:f.target.id,scope:f.scope,operationId:input.operationId})).receiptId,saved.receiptId);
});
test('lost committed admission ACK recovers the exact receipt without another ADD_PERSON or provider call',async()=>{
 const f=employeeIntakeFixture(),s=await f.submit(),input=f.command('ADMIT_EMPLOYEE_INTAKE',{applicationId:s.applicationId,expectedRevision:s.revision,job:'WORKER',permissions:{attendance:false,report:false},confirmed:true});f.controls.loseCommit=true;
 await assert.rejects(f.store.save(f.session,input),/COMMITTED_RESPONSE_LOST/);assert.equal(f.workers.size,1);const recovered=await f.store.status(f.session,{projectId:f.target.id,scope:f.scope,operationId:input.operationId});assert.equal(recovered.state,'RECORDED');assert.equal(f.workers.size,1);assert.equal(f.controls.providerCalls,0);
});
test('same actor exact stale CAS is a durable terminal receipt, not false saved or unresolvable unknown',async()=>{
 const f=employeeIntakeFixture(),s=await f.submit(),input=f.command('ADMIT_EMPLOYEE_INTAKE',{applicationId:s.applicationId,expectedRevision:s.revision-1,job:'WORKER',permissions:{attendance:true,report:true},confirmed:true});
 const r=await f.store.save(f.session,input);assert.equal(r.state,'REJECTED');assert.equal(r.saved,false);assert.equal(r.phase,'PRE_RECORD');assert.equal(r.permissionsGranted,false);assert.equal(f.workers.size,0);assert.deepEqual(await f.store.status(f.session,{projectId:f.target.id,scope:f.scope,operationId:input.operationId}),r);
});
test('deactivated intake denies admission but permits a current administrator to reject its exact durable request',async()=>{
 const f=employeeIntakeFixture(),s=await f.submit();await f.configure(false);
 await assert.rejects(f.store.save(f.session,f.command('ADMIT_EMPLOYEE_INTAKE',{applicationId:s.applicationId,expectedRevision:s.revision,job:'WORKER',permissions:{attendance:true,report:true},confirmed:true})),{code:'EMPLOYEE_INTAKE_DISABLED'});
 const r=await f.store.save(f.session,f.command('REJECT_EMPLOYEE_INTAKE',{applicationId:s.applicationId,expectedRevision:s.revision,reason:'Solicitud revisada y rechazada'}));assert.equal(r.state,'RECORDED');assert.equal(f.state().status,'REJECTED');assert.equal(f.workers.size,0);
});
test('challenge, binding and image messages stay outside guest authority after a request',async()=>{
 const f=employeeIntakeFixture();await f.submit();for(const message of ['IDENTIDAD synthetic-code','VINCULAR synthetic-code',{type:'image',image:{id:'150000011',mime_type:'image/png'}}]){const c=f.receive(message);assert.equal(await customerJobTransaction(f.connect,client=>resolveEmployeeIntakeAuthority(client,c,{environment:f.environment})),null);}assert.equal(f.workers.size,0);
});
test('free text and exact choice require a reply to the confirmed preceding prompt',async()=>{
 const f=employeeIntakeFixture();await f.configure();await f.execute('HOLA');await f.execute('Forged name',{reply:false});assert.equal(f.state().step,'NAME');await f.execute('Persona Sintética');const s=f.state();await f.execute({type:'interactive',interactive:{list_reply:{id:'intake:'+s.nonce+':0'}}},{reply:false});assert.equal(f.state().step,'JOB');assert.equal(f.state().consent,false);
});
test('unconfirmed outbound prompt cannot collect a name and an unknown send is never sent again',async()=>{
 const f=employeeIntakeFixture();await f.configure();f.controls.loseSendAck=true;const {context,result}=await f.execute('HOLA');assert.equal(f.controls.sends,1);const replay=await f.outbound.send(context,result.reply,{purpose:'EMPLOYEE_INTAKE'});assert.equal(replay.state,'SEND_UNKNOWN');assert.equal(f.controls.sends,1);await f.execute('Persona Sintética');assert.equal(f.state().step,'NAME');
});
test('duplicate signed delivery and concurrent HOLA keep one application and one outbound per source receipt',async()=>{
 const f=employeeIntakeFixture();await f.configure();const c=f.receive('HOLA');const results=await Promise.all([f.bridge.execute(c),f.bridge.execute(c)]);assert.deepEqual(results[0],results[1]);assert.equal(f.state().revision,1);await Promise.all(results.map(r=>f.outbound.send(c,r.reply,{purpose:'EMPLOYEE_INTAKE'})));assert.equal(f.controls.sends,1);assert.equal(f.outbounds.size,1);
 const another=f.receive('HOLA');await f.bridge.execute(another);assert.equal([...f.events.values()].filter(e=>e.payload.employeeIntake).length,1);
});
for(const [name,mutate,code] of [
 ['pilot',f=>{f.connection.metadata.developmentPilot={version:1};},'EMPLOYEE_INTAKE_REVOKED'],
 ['suspended corporate mode',f=>{f.controls.mode='SUSPENDED';},'EMPLOYEE_INTAKE_REVOKED'],
 ['assignment revoked',f=>{f.controls.assignment=false;},'EMPLOYEE_INTAKE_REVOKED'],
 ['issuer membership revoked',f=>{f.controls.issuerActive=false;},'EMPLOYEE_INTAKE_REVOKED'],
 ['issuer role changed',f=>{f.controls.issuerRole='DIRECTOR';},'EMPLOYEE_INTAKE_REVOKED'],
 ['issuer role A-B-A with unchanged revision',f=>{f.audits.set('role_change_a',{id:'role_change_a',organizationId:f.project.organizationId,actorId:f.member.actorId,entityType:'TenantMembership',entityId:f.member.membershipId,action:'participant.operation.recorded',metadata:{version:1,kind:'OFFICE_ROLE_CHANGED',before:'ADMIN',after:'DIRECTOR'}});f.audits.set('role_change_b',{id:'role_change_b',organizationId:f.project.organizationId,actorId:f.member.actorId,entityType:'TenantMembership',entityId:f.member.membershipId,action:'participant.operation.recorded',metadata:{version:1,kind:'OFFICE_ROLE_CHANGED',before:'DIRECTOR',after:'ADMIN'}});},'EMPLOYEE_INTAKE_REVOKED'],
 ['grant changed',f=>{f.connection.metadata.customerSignupId='different-synthetic';},'EMPLOYEE_INTAKE_REVOKED'],
 ['channel inactive',f=>{f.connection.enabled=false;},'EMPLOYEE_INTAKE_REVOKED']
])test(name+' denies a fresh inbound and outbound after reservation without provider I/O',async()=>{
 const f=employeeIntakeFixture();await f.configure();const c=f.receive('HOLA'),r=await f.bridge.execute(c);const out=createMetaKycOutbound({connect:f.connect,provider:{sendReply:async()=>{f.controls.sends++;return {messageId:'wamid.SyntheticForbidden'};}},environment:f.environment,afterReserve:async()=>mutate(f)});await assert.rejects(out.send(c,r.reply,{purpose:'EMPLOYEE_INTAKE'}),{code});assert.equal(f.controls.sends,0);await assert.rejects(f.execute('HOLA'),{code});assert.equal(f.workers.size,0);
});
test('lease, signed proof and original routing revisions are checked before a guest state is written',async()=>{
 for(const mutation of ['lease','proof','routing']){const f=employeeIntakeFixture();await f.configure();const c=f.receive('HOLA',{lease:mutation!=='lease',proof:mutation!=='proof'});if(mutation==='routing')f.controls.ownerRevision++;await assert.rejects(f.bridge.execute(c));assert.equal([...f.events.values()].some(e=>e.payload.employeeIntake),false);assert.equal(f.controls.sends,0);}
});
test('cross-tenant, actor, scope, connection and sender references cannot be adopted as authority',async()=>{
 const f=employeeIntakeFixture(),s=await f.submit(),payload={applicationId:s.applicationId,expectedRevision:s.revision,job:'WORKER',permissions:{attendance:false,report:false},confirmed:true};
 await assert.rejects(f.store.save({...f.session,userId:'user_Other'},f.command('ADMIT_EMPLOYEE_INTAKE',payload)),{code:'WORKSPACE_CONTEXT_CHANGED'});
 await assert.rejects(f.store.save(f.session,{...f.command('ADMIT_EMPLOYEE_INTAKE',payload),scope:'b'.repeat(64)}),{code:'WORKSPACE_CONTEXT_CHANGED'});
 await assert.rejects(f.store.save(f.session,f.command('ADMIT_EMPLOYEE_INTAKE',{...payload,connectionId:'other-connection'})),{code:'EMPLOYEE_INTAKE_REVOKED'});
 assert.deepEqual(await customerJobTransaction(f.connect,c=>readEmployeeIntake(c,{...f.member,organizationId:'other-company'},f.target.id,f.environment)),{available:false,records:[],nextCursor:null});
 assert.equal(await customerJobTransaction(f.connect,c=>readEmployeeIntake(c,{...f.member,role:'EMPLOYEE'},f.target.id,f.environment)),null);
 const other=f.receive('ESTADO',{sender:'15550001002'});assert.equal(await f.bridge.execute(other),null);assert.equal(f.workers.size,0);
});
test('conversation expiry is fixed and cancelled intake does not produce an inbox request',async()=>{
 const f=employeeIntakeFixture();await f.configure();await f.execute('HOLA');const expiry=f.state().expiresAt;f.now.setTime(f.now.getTime()+30000);await f.execute('Persona Sintética');assert.equal(f.state().expiresAt,expiry);f.now.setTime(Date.parse(expiry)+1);await assert.rejects(f.execute('ESTADO'),{code:'EMPLOYEE_INTAKE_EXPIRED'});
 const c=employeeIntakeFixture();await c.configure();await c.execute('HOLA');await c.execute('CANCELAR');assert.equal(c.state().consent,false);assert.equal((await c.read()).records.length,0);
});
test('concurrent responsible decisions serialize; the second exact operation is terminal with no second person',async()=>{
 const f=employeeIntakeFixture(),s=await f.submit(),p={applicationId:s.applicationId,expectedRevision:s.revision,job:'WORKER',permissions:{attendance:true,report:false},confirmed:true};const outcomes=await Promise.all([f.store.save(f.session,f.command('ADMIT_EMPLOYEE_INTAKE',p)),f.store.save(f.session,f.command('ADMIT_EMPLOYEE_INTAKE',p))]);assert.deepEqual(outcomes.map(r=>r.state).sort(),['RECORDED','REJECTED']);assert.equal(f.workers.size,1);assert.equal(f.controls.providerCalls,0);
});
test('receipt metadata and reviewed permission corruption fail closed',async()=>{
 const f=employeeIntakeFixture(),s=await f.submit(),input=f.command('ADMIT_EMPLOYEE_INTAKE',{applicationId:s.applicationId,expectedRevision:s.revision,job:'WORKER',permissions:{attendance:false,report:true},confirmed:true}),r=await f.store.save(f.session,input),a=f.audits.get(r.receiptId),w=f.workers.get(r.workerId);
 w.metadata.employeeIntakeAdmission.permissions.attendance=true;await assert.rejects(employeeIntakeAcceptedPermissions({query:f.query},w,{organizationId:f.member.organizationId,projectId:f.target.id}),{code:'EMPLOYEE_INTAKE_INTEGRITY'});
 assert.throws(()=>employeeIntakeOutcome({...a,metadata:{...a.metadata,state:'APPROVED'}},f.scope,input.operationId),{code:'EMPLOYEE_INTAKE_INTEGRITY'});assert.equal(a.metadata.requestDigest,metaCustomerContentDigest(input));
});

for(const action of ['CONFIGURE_EMPLOYEE_INTAKE','ADMIT_EMPLOYEE_INTAKE','REJECT_EMPLOYEE_INTAKE'])test(action+' replays identical canonical values with reordered JSON keys but rejects a changed value',async()=>{
 const f=employeeIntakeFixture(),s=action==='CONFIGURE_EMPLOYEE_INTAKE'?null:await f.submit();
 const payload=action==='CONFIGURE_EMPLOYEE_INTAKE'?{expectedRevision:0,enabled:true,confirmed:true}:action==='ADMIT_EMPLOYEE_INTAKE'?{applicationId:s.applicationId,expectedRevision:s.revision,job:'WORKER',permissions:{attendance:true,report:false},confirmed:true}:{applicationId:s.applicationId,expectedRevision:s.revision,reason:'Decisión sintética explícita'};
 const input=f.command(action,payload),first=await f.store.save(f.session,input),before={workers:structuredClone([...f.workers]),audits:structuredClone([...f.audits]),events:structuredClone([...f.events]),metadata:structuredClone(f.connection.metadata)};
 const reordered=Object.fromEntries(Object.entries(input).reverse());reordered.payload=Object.fromEntries(Object.entries(input.payload).reverse());if(reordered.payload.permissions)reordered.payload.permissions=Object.fromEntries(Object.entries(reordered.payload.permissions).reverse());
 assert.deepEqual(await f.store.save(f.session,reordered),first);assert.deepEqual({workers:[...f.workers],audits:[...f.audits],events:[...f.events],metadata:f.connection.metadata},before);
 const changed=action==='CONFIGURE_EMPLOYEE_INTAKE'?{...reordered.payload,enabled:false}:action==='ADMIT_EMPLOYEE_INTAKE'?{...reordered.payload,permissions:{attendance:true,report:true}}:{...reordered.payload,reason:'Otro motivo sintético explícito'};
 await assert.rejects(f.store.save(f.session,{...reordered,payload:changed}),{code:'PARTICIPANT_OPERATION_CONFLICT'});assert.deepEqual({workers:[...f.workers],audits:[...f.audits],events:[...f.events],metadata:f.connection.metadata},before);assert.equal(f.controls.providerCalls,0);
});

for(const stage of ['draft','consent'])for(const interval of ['during-dispatch-update','after-dispatch-update'])test('DB-clock lease expiry '+interval+' rolls back '+stage+' and adds no dispatch',async()=>{
 const f=employeeIntakeFixture();await f.configure();let message='HOLA';
 if(stage==='consent'){await f.execute('HOLA');await f.execute('Persona Sintética');await f.choose('WORKER');await f.execute('person@example.invalid');const s=f.state();message={type:'interactive',interactive:{list_reply:{id:'intake:'+s.nonce+':'+s.choices.findIndex(row=>row.value==='CONFIRM')}}};}
 const input=f.receive(message),before={events:structuredClone([...f.events]),audits:structuredClone([...f.audits]),workers:structuredClone([...f.workers]),outbounds:structuredClone([...f.outbounds])},sent=f.controls.sends;
 f.controls[interval==='during-dispatch-update'?'beforeDispatchWrite':'afterDispatchWrite']=async event=>{assert.equal(event.id,input.eventId);f.now.setTime(event.leaseExpiresAt.getTime()+1);};
 await assert.rejects(f.bridge.execute(input),{code:'META_CUSTOMER_INBOX_LEASE_CHANGED'});
 assert.deepEqual({events:[...f.events],audits:[...f.audits],workers:[...f.workers],outbounds:[...f.outbounds]},before);assert.equal(f.controls.sends,sent);assert.equal(f.controls.providerCalls,0);if(stage==='consent'){assert.equal(f.state().status,'CONFIRM');assert.equal(f.state().consent,false);}else assert.equal(f.state(),undefined);
});

for(const deadline of ['policy-grant','reply-window'])test('fresh DB-clock '+deadline+' expiry after final dispatch write rolls back private state and dispatch',async()=>{
 const f=employeeIntakeFixture();if(deadline==='policy-grant')f.connection.metadata.customerVerification.expiresAt=new Date(f.now.getTime()+61000).toISOString();await f.configure();
 const input=f.receive('HOLA',deadline==='reply-window'?{timestamp:Math.floor((f.now.getTime()-24*60*60*1000+1500)/1000)}:{}),before={events:structuredClone([...f.events]),audits:structuredClone([...f.audits]),workers:structuredClone([...f.workers]),outbounds:structuredClone([...f.outbounds])};
 f.controls.afterDispatchWrite=async event=>{assert.equal(event.id,input.eventId);f.now.setTime(f.now.getTime()+2000);};
 await assert.rejects(f.bridge.execute(input),{code:deadline==='policy-grant'?'EMPLOYEE_INTAKE_REVOKED':'META_CUSTOMER_REPLY_WINDOW_CLOSED'});
 assert.deepEqual({events:[...f.events],audits:[...f.audits],workers:[...f.workers],outbounds:[...f.outbounds]},before);assert.equal(f.state(),undefined);assert.equal(f.controls.sends,0);assert.equal(f.controls.providerCalls,0);
});

for(const stage of ['draft','consent'])for(const deadline of ['policy-grant','reply-window'])test(deadline+' expiry during final issuer-policy read rolls back '+stage+' and dispatch',async()=>{
 const f=employeeIntakeFixture();if(deadline==='policy-grant')f.connection.metadata.customerVerification.expiresAt=new Date(f.now.getTime()+61000).toISOString();await f.configure();
 const options=deadline==='reply-window'?{timestamp:Math.floor((f.now.getTime()-24*60*60*1000+1500)/1000)}:{};let message='HOLA';
 if(stage==='consent'){await f.execute('HOLA',options);await f.execute('Synthetic applicant',options);let s=f.state();await f.execute({type:'interactive',interactive:{list_reply:{id:'intake:'+s.nonce+':'+s.choices.findIndex(row=>row.value==='WORKER')}}},options);await f.execute('person@example.invalid',options);s=f.state();message={type:'interactive',interactive:{list_reply:{id:'intake:'+s.nonce+':'+s.choices.findIndex(row=>row.value==='CONFIRM')}}};}
 const input=f.receive(message,options),before={events:structuredClone([...f.events]),audits:structuredClone([...f.audits]),workers:structuredClone([...f.workers]),outbounds:structuredClone([...f.outbounds])},sent=f.controls.sends;let barriers=0;
 f.controls.afterDispatchWrite=async event=>{assert.equal(event.id,input.eventId);assert.ok(event.payload.employeeIntakeDispatch);assert.equal(f.state().consent,stage==='consent');f.controls.beforeIssuerTrail=async()=>{barriers++;f.controls.beforeIssuerTrail=null;f.now.setTime(f.now.getTime()+2000);};};
 await assert.rejects(f.bridge.execute(input),{code:deadline==='policy-grant'?'EMPLOYEE_INTAKE_REVOKED':'META_CUSTOMER_REPLY_WINDOW_CLOSED'});assert.equal(barriers,1);
 assert.deepEqual({events:[...f.events],audits:[...f.audits],workers:[...f.workers],outbounds:[...f.outbounds]},before);assert.equal(f.controls.sends,sent);assert.equal(f.controls.providerCalls,0);if(stage==='consent'){assert.equal(f.state().status,'CONFIRM');assert.equal(f.state().consent,false);}else assert.equal(f.state(),undefined);
});
test('the final issuer-policy read may advance DB time while valid deadlines still commit exactly one dispatch',async()=>{
 const f=employeeIntakeFixture();f.connection.metadata.customerVerification.expiresAt=new Date(f.now.getTime()+65000).toISOString();await f.configure();const input=f.receive('HOLA');let barriers=0;
 f.controls.afterDispatchWrite=async()=>{f.controls.beforeIssuerTrail=async()=>{barriers++;f.controls.beforeIssuerTrail=null;f.now.setTime(f.now.getTime()+2000);};};
 const result=await f.bridge.execute(input);assert.equal(barriers,1);assert.equal(result.kind,'EMPLOYEE_INTAKE');assert.equal(f.state().revision,1);assert.equal(f.events.get(input.eventId).payload.employeeIntakeDispatch.applicationId,input.eventId);assert.equal(f.outbounds.size,0);assert.equal(f.controls.sends,0);assert.equal(f.controls.providerCalls,0);
});

test('an original sealed dispatch can replay only under its current source lease, without another send',async()=>{
 const f=employeeIntakeFixture();await f.configure();const {context}=await f.execute('HOLA'),event=f.events.get(context.eventId),payload=structuredClone(event.payload),sent=f.controls.sends;
 f.now.setTime(event.leaseExpiresAt.getTime()+1);await assert.rejects(f.bridge.execute(context),{code:'META_CUSTOMER_INBOX_LEASE_CHANGED'});assert.deepEqual(f.events.get(context.eventId).payload,payload);assert.equal(f.controls.sends,sent);assert.equal(f.controls.providerCalls,0);
});
test('only a new human HOLA restarts an expired incomplete draft, preserving its original signed event',async()=>{
 const f=employeeIntakeFixture();await f.configure();await f.execute('HOLA');const s=f.state(),original=structuredClone(f.events.get(s.applicationId).payload);f.now.setTime(Date.parse(s.expiresAt)+1);await assert.rejects(f.execute('Persona Sintética'),{code:'EMPLOYEE_INTAKE_EXPIRED'});const next=await f.execute('HOLA');assert.equal(next.result.kind,'EMPLOYEE_INTAKE');const old=f.events.get(s.applicationId);assert.equal(old.payload.employeeIntake.status,'CANCELLED');for(const key of ['encryptedPayload','encryptedProof','payloadDigest'])assert.equal(old.payload[key],original[key]);const current=f.events.get(next.context.eventId);assert.equal(current.payload.employeeIntake.status,'NAME');assert.notEqual(current.payload.employeeIntake.applicationId,s.applicationId);assert.equal((await f.read()).records.length,0);
});
test('current policy may restart only an incomplete draft, never an already consented pending request',async()=>{
 const f=employeeIntakeFixture();await f.configure();await f.execute('HOLA');const s=f.state();await f.configure();const next=await f.execute('HOLA');assert.equal(f.events.get(s.applicationId).payload.employeeIntake.status,'CANCELLED');assert.equal(f.events.get(next.context.eventId).payload.employeeIntake.status,'NAME');
 const pending=employeeIntakeFixture(),submitted=await pending.submit();await pending.configure();await assert.rejects(pending.execute('HOLA'),{code:'EMPLOYEE_INTAKE_REVOKED'});assert.equal(pending.state().applicationId,submitted.applicationId);assert.equal(pending.state().consent,true);
});
test('revocation or lease expiry during a provider await cannot commit a callback or resend the reserved reply',async()=>{
 for(const change of ['issuer','lease']){const f=employeeIntakeFixture();await f.configure();const c=f.receive('HOLA'),r=await f.bridge.execute(c),provider={async sendReply(){f.controls.sends++;if(change==='issuer')f.controls.issuerActive=false;else f.now.setTime(f.events.get(c.eventId).leaseExpiresAt.getTime()+1);return {messageId:'wamid.SyntheticSuspendedReply'};}};const outbound=createMetaKycOutbound({connect:f.connect,provider,environment:f.environment});await assert.rejects(outbound.send(c,r.reply,{purpose:'EMPLOYEE_INTAKE'}));assert.equal(f.controls.sends,1);assert.equal([...f.outbounds.values()][0].outcome.state,'SEND_STARTED');await assert.rejects(outbound.send(c,r.reply,{purpose:'EMPLOYEE_INTAKE'}));assert.equal(f.controls.sends,1);}
});
test('ADMITTED plus verified binding cedes every new operational message even after intake OFF, without granting FIELD authority',async()=>{
 const f=employeeIntakeFixture(),s=await f.submit(),input=f.command('ADMIT_EMPLOYEE_INTAKE',{applicationId:s.applicationId,expectedRevision:s.revision,job:'WORKER',permissions:{attendance:false,report:true},confirmed:true});await f.store.save(f.session,input);f.controls.bound=true;await f.configure(false);const sent=f.controls.sends;
 for(const message of ['HOLA','MENU','ENTRADA',{type:'interactive',interactive:{button_reply:{id:'field:entry'}}},{type:'audio',audio:{id:'150000011',mime_type:'audio/ogg'}}]){const c=f.receive(message);assert.equal(await f.bridge.execute(c),null);}
 assert.equal(f.state().status,'ADMITTED');assert.equal(f.workers.size,1);assert.equal(f.controls.sends,sent);assert.equal(f.controls.providerCalls,0);
 const original=f.events.get(s.lastEventId),context={eventId:original.id,projectId:original.projectId,channelId:f.connection.id,payloadDigest:original.payload.payloadDigest,leaseToken:original.leaseToken};await assert.rejects(f.bridge.execute(context),{code:'EMPLOYEE_INTAKE_DISABLED'});assert.equal(f.controls.sends,sent);
});
test('binding never converts an original sealed intake dispatch into an operational message or another send',async()=>{
 const f=employeeIntakeFixture();await f.configure();const {context,result}=await f.execute('HOLA');f.controls.bound=true;assert.deepEqual(await f.bridge.execute(context),result);const replay=await f.outbound.send(context,result.reply,{purpose:'EMPLOYEE_INTAKE'});assert.equal(replay.replayed,true);assert.equal(f.controls.sends,1);assert.equal(f.workers.size,0);
});
test('same-second Meta timestamps advance only through the exact delivered prompt; an earlier timestamp is denied',async()=>{
 const f=employeeIntakeFixture();await f.configure();const timestamp=Math.floor(f.now.getTime()/1000);await f.execute('HOLA',{timestamp});await f.execute('Persona Sintética',{timestamp});assert.equal(f.state().step,'JOB');const s=f.state();await f.execute({type:'interactive',interactive:{list_reply:{id:'intake:'+s.nonce+':0'}}},{timestamp});assert.equal(f.state().step,'EMAIL');await assert.rejects(f.execute('person@example.invalid',{timestamp:timestamp-1}),{code:'EMPLOYEE_INTAKE_MESSAGE_OUT_OF_ORDER'});assert.equal(f.state().step,'EMAIL');
});
for(const permissions of [{attendance:true,report:false},{attendance:false,report:true},{attendance:false,report:false}])test('canonical ASSIGN_EXISTING and RESTORE_ACCESS preserve human reviewed intake permissions '+JSON.stringify(permissions),async()=>{
 const f=employeeIntakeFixture(),s=await f.submit(),admitted=await f.store.save(f.session,f.command('ADMIT_EMPLOYEE_INTAKE',{applicationId:s.applicationId,expectedRevision:s.revision,job:'WORKER',permissions,confirmed:true})),w=f.workers.get(admitted.workerId);
 const assigned=await f.store.save(f.session,f.command('ASSIGN_EXISTING',{workerId:w.id,revision:w.revision,membershipId:'person-member',reason:'Asignación sintética revisada'}));assert.deepEqual(assigned.participant.permissions,permissions);assert.equal(w.metadata.participant.kyc.status,'NOT_SUBMITTED');
 await f.store.save(f.session,f.command('REVOKE',{workerId:w.id,revision:w.revision,reason:'Revocación sintética explícita'}));assert.deepEqual(w.metadata.participant.permissions,{attendance:false,report:false});
 const restored=await f.store.save(f.session,f.command('RESTORE_ACCESS',{workerId:w.id,revision:w.revision,reason:'Restitución sintética revisada'}));assert.deepEqual(restored.participant.permissions,permissions);assert.equal(restored.participant.kyc.status,'NOT_SUBMITTED');
});
for(const path of ['ASSIGN_EXISTING','RESTORE_ACCESS'])for(const mutation of ['snapshot','actor','tenant','receipt','entityType','entityId','action'])test(path+' rejects corrupted or crossed intake authorization before participant write: '+mutation,async()=>{
 const f=employeeIntakeFixture(),s=await f.submit(),admitted=await f.store.save(f.session,f.command('ADMIT_EMPLOYEE_INTAKE',{applicationId:s.applicationId,expectedRevision:s.revision,job:'WORKER',permissions:{attendance:true,report:false},confirmed:true})),w=f.workers.get(admitted.workerId);
 if(path==='RESTORE_ACCESS')w.metadata.participant={version:1,status:'REVOKED',clerkUserId:'user_Person',permissions:{attendance:false,report:false},kyc:{version:1,status:'NOT_SUBMITTED'}};
 const a=f.audits.get(admitted.receiptId);if(mutation==='snapshot')w.metadata.employeeIntakeAdmission.permissions.report=true;if(mutation==='actor')a.actorId='other-actor';if(mutation==='tenant')a.organizationId='other-company';if(mutation==='receipt')a.metadata.personReceiptId='site_crossed';if(mutation==='entityType')a.entityType='Worker';if(mutation==='entityId')a.entityId='customer_webhook_'+'e'.repeat(64);if(mutation==='action')a.action='unrelated.operation';const before=structuredClone(w.metadata);
 const payload={workerId:w.id,revision:w.revision,reason:'Control sintético de autorización',...(path==='ASSIGN_EXISTING'?{membershipId:'person-member'}:{})};await assert.rejects(f.store.save(f.session,f.command(path,payload)),{code:'EMPLOYEE_INTAKE_INTEGRITY'});assert.deepEqual(f.workers.get(w.id).metadata,before);
});

test('failed canonical admission audit rolls back person, site receipt and encrypted consent state atomically',async()=>{
 const f=employeeIntakeFixture(),s=await f.submit(),before=structuredClone(f.events.get(s.applicationId).payload),auditIds=[...f.audits.keys()];f.controls.failIntakeAudit=true;
 await assert.rejects(f.store.save(f.session,f.command('ADMIT_EMPLOYEE_INTAKE',{applicationId:s.applicationId,expectedRevision:s.revision,job:'WORKER',permissions:{attendance:true,report:false},confirmed:true})),/SYNTHETIC_ADMISSION_AUDIT_FAILURE/);
 assert.equal(f.workers.size,0);assert.deepEqual([...f.audits.keys()],auditIds);assert.deepEqual(f.events.get(s.applicationId).payload,before);assert.equal(f.state().status,'WAITING_RESPONSIBLE');assert.equal(f.controls.providerCalls,0);
});
for(const permissions of [{attendance:true,report:false},{attendance:false,report:true},{attendance:false,report:false}])test('canonical accepted Clerk invitation preserves reviewed intake permissions '+JSON.stringify(permissions),async()=>{
 const f=employeeIntakeFixture(),s=await f.submit(),admitted=await f.store.save(f.session,f.command('ADMIT_EMPLOYEE_INTAKE',{applicationId:s.applicationId,expectedRevision:s.revision,job:'WORKER',permissions,confirmed:true})),w=f.workers.get(admitted.workerId),invitationId='invite_'+'a'.repeat(32);
 w.metadata.participant={version:1,status:'INVITED',clerkUserId:null,permissions:{attendance:false,report:false},invitation:{id:invitationId,email:'person@example.invalid',state:'SENT',providerId:'orginv_IntakeSynthetic',expiresAt:new Date(f.now.getTime()+86400000).toISOString()},kyc:{version:1,status:'NOT_SUBMITTED'}};
 const human={authenticated:true,verification:'clerk-production-jwt',userId:'user_Person',organizationId:f.session.organizationId,organizationRole:'org:member'};const accepted=await f.store.join(human,{invitationId,operationId:randomUUID()},{accept:true});assert.equal(accepted.joined,true);assert.deepEqual(f.workers.get(w.id).metadata.participant.permissions,permissions);assert.equal(f.workers.get(w.id).metadata.participant.kyc.status,'NOT_SUBMITTED');
});
