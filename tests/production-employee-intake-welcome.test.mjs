import test from 'node:test';
import assert from 'node:assert/strict';
import {employeeIntakeFixture} from './fixtures/employee-intake-memory.mjs';
import {customerOutboundId} from '../src/lib/meta-customer-outbound.mjs';
import {customerReplyMessage} from '../src/lib/meta-customer-provider.mjs';
import {decryptCustomerSecret,encryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';

const route=(state,value)=>({type:'interactive',interactive:{list_reply:{id:'intake:'+state.nonce+':'+state.choices.findIndex(choice=>choice.value===value)}}});
const assertWelcome=reply=>{
 assert.equal(reply.type,'interactive');
 assert.deepEqual(reply.sections.flatMap(section=>section.rows.map(row=>row.title)),['Solicitar ingreso a obra','Ya tengo cuenta']);
 assert.doesNotMatch(reply.body,/nombre y apellido|oficio solicitado|administrador|director|IDENTIDAD [A-Za-z0-9_-]{43}/i);
 assert.equal(customerReplyMessage(reply).interactive.type,'list');
};
const savedState=(f,anchor)=>JSON.parse(decryptCustomerSecret(anchor.payload.employeeIntake.encryptedState,{organizationId:f.project.organizationId,projectId:f.project.id,purpose:'employee-intake',resourceId:anchor.id},f.environment));
const admitted=async()=>{
 const f=employeeIntakeFixture(),state=await f.submit();
 const saved=await f.store.save(f.session,f.command('ADMIT_EMPLOYEE_INTAKE',{applicationId:state.applicationId,expectedRevision:state.revision,job:'WORKER',permissions:{attendance:false,report:false},confirmed:true}));
 const worker=f.workers.get(saved.workerId);
 await f.store.save(f.session,f.command('ASSIGN_EXISTING',{workerId:worker.id,revision:worker.revision,membershipId:'person-member',reason:'Asignación sintética revisada'}));
 worker.metadata.participant.kycChatChallenge={version:1,id:'kyc_chat_'+'1'.repeat(32),status:'CANCELLED'};
 return {f,worker};
};

test('unlinked signed greeting offers two professional routes before collecting a name or requested trade',async()=>{
 const f=employeeIntakeFixture();await f.configure();const {result}=await f.execute('HOLA');
 assertWelcome(result.reply);assert.equal(f.state().step,'WELCOME');assert.equal(f.state().resumeStep,'NAME');
 for(const key of ['name','job','email'])assert.equal(f.state()[key],null);
 assert.equal(f.state().consent,false);assert.equal(f.workers.size,0);assert.equal((await f.read()).records.length,0);assert.equal(f.controls.providerCalls,0);
 assert.equal(result.businessApplied,false);assert.equal(result.identityStatus,'LIMITED_PARTICIPANT_INTAKE');
});

test('request route advances only after the delivered choice and retains explicit legal confirmation and human admission',async()=>{
 const f=employeeIntakeFixture();await f.configure();await f.execute('HOLA');
 await f.execute('Persona Sintética');assert.equal(f.state().step,'WELCOME');assert.equal(f.state().name,null);
 const before=f.state();await f.choose('REQUEST_ACCESS');assert.equal(f.state().step,'NAME');assert.equal(f.state().resumeStep,undefined);
 assert.equal(f.state().noticeVersion,before.noticeVersion);assert.equal(f.state().noticeSha256,before.noticeSha256);
 await f.execute('Persona Sintética');await f.choose('WORKER');await f.execute('person@example.invalid');
 assert.equal(f.state().step,'CONFIRM');assert.equal(f.state().consent,false);assert.equal((await f.read()).records.length,0);
 await f.choose('CONFIRM');assert.equal(f.state().step,'WAITING_RESPONSIBLE');assert.equal(f.state().consent,true);
 assert.equal(f.workers.size,0);assert.equal(f.controls.providerCalls,0);
});

test('existing account route sends only the fixed authenticated account URL without linking phone or discovering office roles',async()=>{
 const f=employeeIntakeFixture();await f.configure();await f.execute('HOLA');
 const before={audits:structuredClone([...f.audits]),connection:structuredClone(f.connection),workers:structuredClone([...f.workers])},state=f.state();
 const {context,result}=await f.choose('ACCOUNT');
 assert.equal(result.reply.type,'text');assert.deepEqual(result.reply.body.match(/https:\/\/\S+/g),['https://obrasaas.com/cuenta']);
 assert.match(result.reply.body,/iniciá sesión/);assert.match(result.reply.body,/no vincula tu teléfono ni modifica accesos/);
 assert.equal(f.state().step,'WELCOME');assert.equal(f.state().resumeStep,'NAME');assert.equal(f.state().nonce,undefined);assert.equal(f.state().choices,undefined);
 assert.equal(f.state().expiresAt,state.expiresAt);assert.equal(f.state().consent,false);
 assert.deepEqual([...f.audits],before.audits);assert.deepEqual(f.connection,before.connection);assert.deepEqual([...f.workers],before.workers);assert.equal(f.controls.providerCalls,0);
 const sends=f.controls.sends;assert.deepEqual(await f.bridge.execute(context),result);
 assert.equal((await f.outbound.send(context,result.reply,{purpose:'EMPLOYEE_INTAKE'})).replayed,true);assert.equal(f.controls.sends,sends);
 assertWelcome((await f.execute('HOLA')).result.reply);assert.equal((await f.read()).records.length,0);
});

test('welcome choice rejects absent or crossed reply context, stale nonce, out-of-range choice and plain-text shortcuts',async()=>{
 for(const kind of ['absent','foreign','stale','range','text']){
  const f=employeeIntakeFixture();await f.configure();await f.execute('HOLA');const before=f.state();let message=route(before,'ACCOUNT'),options={};
  if(kind==='absent')options.reply=false;
  if(kind==='foreign')message.context={id:'wamid.ForeignPrompt'};
  if(kind==='stale')await f.execute('HOLA');
  if(kind==='range')message.interactive.list_reply.id='intake:'+before.nonce+':9';
  if(kind==='text'){message='Ya tengo cuenta';options={reply:false,timestamp:before.lastMessageTimestamp+10};}
  const {result}=await f.execute(message,options);assertWelcome(result.reply);assert.equal(f.state().step,'WELCOME');assert.equal(f.state().name,null);assert.equal(f.state().consent,false);
  assert.equal(f.workers.size,0);assert.equal(f.controls.providerCalls,0);
 }
});

test('unknown welcome send cannot authorize a route or resend its original reserved message',async()=>{
 const f=employeeIntakeFixture();await f.configure();f.controls.loseSendAck=true;
 const {context,result}=await f.execute('HOLA');assert.equal(f.controls.sends,1);
 const out=structuredClone(f.outbounds.get(customerOutboundId(context.eventId)));
 assert.equal((await f.outbound.send(context,result.reply,{purpose:'EMPLOYEE_INTAKE'})).state,'SEND_UNKNOWN');
 assert.equal(f.controls.sends,1);assert.deepEqual(f.outbounds.get(customerOutboundId(context.eventId)),out);
 f.controls.loseSendAck=false;assertWelcome((await f.choose('REQUEST_ACCESS')).result.reply);assert.equal(f.state().step,'WELCOME');assert.equal(f.state().consent,false);
});

test('unknown account-link send retains the exact reservation and never gains a second external attempt on replay',async()=>{
 const f=employeeIntakeFixture();await f.configure();await f.execute('HOLA');f.controls.loseSendAck=true;
 const {context,result}=await f.choose('ACCOUNT'),sends=f.controls.sends,out=structuredClone(f.outbounds.get(customerOutboundId(context.eventId))),state=f.state();
 assert.equal(out.outcome.state,'SEND_UNKNOWN');f.controls.loseSendAck=false;
 assert.deepEqual(await f.bridge.execute(context),result);assert.equal((await f.outbound.send(context,result.reply,{purpose:'EMPLOYEE_INTAKE'})).state,'SEND_UNKNOWN');
 assert.equal(f.controls.sends,sends);assert.deepEqual(f.outbounds.get(customerOutboundId(context.eventId)),out);assert.deepEqual(f.state(),state);assert.equal(f.workers.size,0);
});

test('welcome navigation and account handoff preserve each incomplete draft and its original fixed expiry',async()=>{
 for(const step of ['NAME','JOB','EMAIL','CONFIRM']){
  const f=employeeIntakeFixture();await f.configure();await f.startRequest();
  if(step!=='NAME')await f.execute('Persona Sintética');
  if(['EMAIL','CONFIRM'].includes(step))await f.choose('WORKER');
  if(step==='CONFIRM')await f.execute('person@example.invalid');
  const before=f.state();assert.equal(before.step,step);assert.equal(before.resumeStep,undefined);
  f.now.setTime(f.now.getTime()+1000);assertWelcome((await f.execute('MENU')).result.reply);
  assert.equal(f.state().resumeStep,step);await f.choose('ACCOUNT');
  for(const key of ['name','job','email','applicationId','createdAt','expiresAt','noticeVersion','noticeSha256'])assert.equal(f.state()[key],before[key],step+': '+key);
  assert.equal(f.state().consent,false);assertWelcome((await f.execute('HOLA')).result.reply);await f.choose('REQUEST_ACCESS');
  assert.equal(f.state().step,step);assert.equal(f.state().resumeStep,undefined);assert.equal(f.state().expiresAt,before.expiresAt);
  for(const key of ['name','job','email'])assert.equal(f.state()[key],before[key],step+': '+key);
  assert.equal(f.workers.size,0);assert.equal((await f.read()).records.length,0);
 }
});

test('expired welcome can restart only on a new signed greeting while preserving the original encrypted source',async()=>{
 const f=employeeIntakeFixture();await f.configure();await f.execute('HOLA');const state=f.state(),old=f.events.get(state.applicationId),source=structuredClone(old.payload);
 f.now.setTime(Date.parse(state.expiresAt)+1);await assert.rejects(f.choose('ACCOUNT'),{code:'EMPLOYEE_INTAKE_EXPIRED'});
 const next=await f.execute('HOLA'),cancelled=f.events.get(state.applicationId);assertWelcome(next.result.reply);assert.equal(cancelled.payload.employeeIntake.status,'CANCELLED');
 const cancelledState=savedState(f,cancelled);assert.equal(cancelledState.step,'CANCELLED');assert.equal(cancelledState.status,'CANCELLED');assert.equal(cancelledState.cancelReason,'EXPIRED');assert.equal(cancelledState.revision,state.revision+1);
 for(const key of ['encryptedPayload','encryptedProof','payloadDigest'])assert.equal(cancelled.payload[key],source[key]);
 const newAnchor=f.events.get(next.context.eventId);assert.equal(newAnchor.payload.employeeIntake.status,'WELCOME');assert.notEqual(newAnchor.id,old.id);assert.equal(f.workers.size,0);
});

test('cancelling welcome withdraws only the private draft and never grants or revokes separate channel consent',async()=>{
 const f=employeeIntakeFixture();await f.configure();await f.execute('HOLA');const before=structuredClone(f.connection.metadata),audits=structuredClone([...f.audits]);
 await f.execute('CANCELAR');assert.equal(f.state().step,'CANCELLED');assert.equal(f.state().consent,false);assert.equal((await f.read()).records.length,0);
 assert.deepEqual(f.connection.metadata,before);assert.deepEqual([...f.audits],audits);assert.equal(f.workers.size,0);assert.equal(f.controls.providerCalls,0);
});

test('sealed welcome with missing or privileged resume step or consent already asserted fails before another send',async()=>{
 for(const change of [s=>delete s.resumeStep,s=>{s.resumeStep='ADMITTED';},s=>{s.consent=true;}]){
  const f=employeeIntakeFixture();await f.configure();await f.execute('HOLA');const anchor=f.events.get(f.state().applicationId),state=savedState(f,anchor);change(state);
  anchor.payload.employeeIntake.encryptedState=encryptCustomerSecret(JSON.stringify(state),{organizationId:f.project.organizationId,projectId:f.project.id,purpose:'employee-intake',resourceId:anchor.id},f.environment);
  const sends=f.controls.sends;await assert.rejects(f.execute('HOLA'),{code:'EMPLOYEE_INTAKE_INTEGRITY'});assert.equal(f.controls.sends,sends);assert.equal(f.workers.size,0);
 }
});

test('new messages from a verified linked sender bypass welcome even when intake is disabled and never gain field authority here',async()=>{
 const f=employeeIntakeFixture();await f.configure();await f.execute('HOLA');const choice=route(f.state(),'ACCOUNT'),before=f.state(),sends=f.controls.sends;f.controls.bound=true;await f.configure(false);
 for(const message of ['HOLA','MENU',choice,'IDENTIDAD synthetic-code',{type:'image',image:{id:'150000011',mime_type:'image/png'}}]){
  assert.equal(await f.bridge.execute(f.receive(message)),null);
 }
 assert.deepEqual(f.state(),before);assert.equal(f.controls.sends,sends);assert.equal(f.workers.size,0);
});

test('admitted unlinked participation offers a concise contextual menu and both choices leave identity and permissions unchanged',async()=>{
 const {f,worker}=await admitted(),before={worker:structuredClone(worker),audits:structuredClone([...f.audits]),connection:structuredClone(f.connection)};
 const menu=await f.execute('HOLA');assert.equal(menu.result.reply.type,'interactive');
 assert.deepEqual(menu.result.reply.sections.flatMap(section=>section.rows.map(row=>row.title)),['Abrir mi cuenta','Presentar identidad']);
 assert.ok(menu.result.reply.body.length<180);assert.doesNotMatch(menu.result.reply.body,/https:|IDENTIDAD [A-Za-z0-9_-]{43}|nombre y apellido/);
 const account=await f.choose('ACCOUNT');assert.deepEqual(account.result.reply.body.match(/https:\/\/\S+/g),['https://obrasaas.com/cuenta']);
 assert.equal(f.state().step,'ADMITTED');await f.execute('MENU');const identity=await f.choose('IDENTITY_GUIDANCE');
 assert.match(identity.result.reply.body,/https:\/\/obrasaas\.com\/cuenta\?seccion=identidad#participant-title/);assert.match(identity.result.reply.body,/mensaje IDENTIDAD vigente/);
 assert.match(identity.result.reply.body,/esperá las indicaciones antes de enviar documentos/);assert.doesNotMatch(identity.result.reply.body,/IDENTIDAD [A-Za-z0-9_-]{43}/);
 assert.equal(f.state().step,'ADMITTED');assert.deepEqual(f.workers.get(worker.id),before.worker);assert.deepEqual([...f.audits],before.audits);assert.deepEqual(f.connection,before.connection);
});

test('admitted menu choices require the exact delivered prompt and cannot interpret a stale nonce as identity consent',async()=>{
 const {f,worker}=await admitted(),before=structuredClone(worker);await f.execute('HOLA');const old=route(f.state(),'IDENTITY_GUIDANCE');
 await f.execute('HOLA');const stale=await f.execute(old);assert.equal(stale.result.reply.type,'interactive');
 const valid=route(f.state(),'IDENTITY_GUIDANCE');const crossed=await f.execute(valid,{reply:false});assert.equal(crossed.result.reply.type,'interactive');
 assert.equal(f.state().step,'ADMITTED');assert.deepEqual(f.workers.get(worker.id),before);
 assert.equal(f.workers.get(worker.id).metadata.participant.kycChatChallenge.status,'CANCELLED');
});

