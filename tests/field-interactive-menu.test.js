import assert from 'node:assert/strict';
import test from 'node:test';
import { fieldMenuRows, resolveFieldMenuSelection, buildFieldMenuPayload, assertFieldMenuPayload, normalizeFieldMenuDescriptor } from '../src/lib/whatsapp/field-interactive-menu.js';
import { materializeFieldMenuDelivery } from '../src/lib/whatsapp/field-menu-delivery.js';
import { createMessageWebhookOutcome, readAppliedMessageWebhookOutcome } from '../src/lib/webhook-queue.js';
const scope={organizationId:'company-a',projectId:'worksite-a',workerId:'worker-a',phoneNumberId:'123456789012345'};
const descriptor={version:1,section:'MAIN',...scope};
const eventFor=id=>({provider:'meta',kind:'interactive',text:'untrusted display label',phoneNumberId:scope.phoneNumberId,interactive:{type:'list',id,title:'untrusted display label'}});
const key=row=>row.id.split(':').at(-1);
for(const role of ['WORKER','FOREMAN','SITE_MANAGER','SAFETY'])test('native menu payload is bounded, versioned and role-specific: '+role,()=>{
  const payload=buildFieldMenuPayload({to:'+15551230001',scope,role,projectName:'Obra Norte'});
  assert.equal(assertFieldMenuPayload(payload,'15551230001'),payload);
  const rows=payload.interactive.action.sections[0].rows;assert.ok(rows.length>0&&rows.length<=10);
  assert.ok(rows.every(row=>resolveFieldMenuSelection(eventFor(row.id),{scope,role}).allowed));
  assert.equal(new Set(rows.map(row=>row.id)).size,rows.length);
  assert.equal(payload.to,'15551230001');assert.ok(!JSON.stringify(payload).includes('worker-a'));
});
test('native list does not advertise authority absent from the role',()=>{
  assert.ok(!fieldMenuRows({scope,role:'SAFETY'}).some(row=>key(row)==='PROGRESS'));
  assert.ok(!fieldMenuRows({scope,role:'WORKER'}).some(row=>key(row)==='DELAY'));
  assert.ok(fieldMenuRows({scope,role:'FOREMAN'}).some(row=>key(row)==='DELAY'));
});
for(const role of ['ADMIN','ROOT','UNKNOWN',null])test('unknown role has no fallback interactive authority: '+role,()=>{
  assert.throws(()=>fieldMenuRows({scope,role}));
});
for(const field of ['organizationId','projectId','workerId','phoneNumberId'])test('selection copied from another context cannot execute: '+field,()=>{
  const row=fieldMenuRows({scope,role:'FOREMAN',section:'JOURNEY'})[0];
  const result=resolveFieldMenuSelection(eventFor(row.id),{scope:{...scope,[field]:'other'},role:'FOREMAN'});
  assert.equal(result.allowed,false);
});
test('the stable option ID wins over a forged label; it is not a permission grant',()=>{
  const row=fieldMenuRows({scope,role:'WORKER',section:'JOURNEY'}).find(row=>key(row)==='CHECK_IN');
  const event={...eventFor(row.id),text:'avance 100% tarea 1'};event.interactive.title=event.text;
  assert.equal(resolveFieldMenuSelection(event,{scope,role:'WORKER'}).command,'fichar');
  const forbidden=fieldMenuRows({scope,role:'FOREMAN'}).find(row=>key(row)==='DELAY');
  assert.equal(resolveFieldMenuSelection(eventFor(forbidden.id),{scope,role:'WORKER'}).allowed,false);
});
for(const patch of [{provider:'internal'},{kind:'image'},{location:{latitude:0,longitude:0}},{media:{}},{attendanceAction:'CHECK_IN'},{transcription:{text:'fichar'}}])test('mixed or non-Meta selection rejected: '+Object.keys(patch)[0],()=>{
  const row=fieldMenuRows({scope,role:'WORKER'})[0];assert.equal(resolveFieldMenuSelection({...eventFor(row.id),...patch},{scope,role:'WORKER'}).allowed,false);
});
test('unknown list IDs do not become text commands; existing non-menu buttons keep their domain',()=>{
  assert.equal(resolveFieldMenuSelection(eventFor('unknown-list'),{scope,role:'WORKER'}).allowed,false);
  assert.equal(resolveFieldMenuSelection({interactive:{type:'button',id:'other-domain-confirmation'}},{scope,role:'WORKER'}),null);
  assert.equal(resolveFieldMenuSelection({provider:'meta',kind:'text',text:'fichar'},{scope,role:'WORKER'}),null);
});
for(const invalid of [{...descriptor,token:'secret'},{...descriptor,section:'PAYMENTS'},{...descriptor,version:2},{...descriptor,workerId:[]},{...descriptor,projectId:'../other'}])test('durable descriptor rejects unsupported fields: '+JSON.stringify(invalid),()=>{
  assert.throws(()=>normalizeFieldMenuDescriptor(invalid));
});
test('durable replay preserves only the descriptor and rejects crossing its worksite',()=>{
  const outcome=createMessageWebhookOutcome({reply:'Menú de la obra',fieldMenu:descriptor});
  assert.deepEqual(outcome.fieldMenu,descriptor);
  assert.deepEqual(readAppliedMessageWebhookOutcome({projectId:scope.projectId,appliedAt:new Date(),outcome}).fieldMenu,descriptor);
  assert.throws(()=>readAppliedMessageWebhookOutcome({projectId:'another-worksite',appliedAt:new Date(),outcome}),{code:'WEBHOOK_OUTCOME_INVALID'});
  assert.throws(()=>createMessageWebhookOutcome({reply:'Menú',fieldMenu:descriptor,flowPrompt:'shift-check-in'}),{code:'WEBHOOK_OUTCOME_INVALID'});
  assert.equal(createMessageWebhookOutcome({reply:'Legacy text'}).fieldMenu,undefined);
});
function deliveryFixture({role='WORKER',revoked=false,project=true}={}) {
  const calls=[];
  const prisma={project:{findFirst:async query=>{calls.push(query);return project?{id:scope.projectId,name:'Obra Norte',organizationId:scope.organizationId,whatsapp:{phoneNumberId:scope.phoneNumberId,enabled:true,connectionStatus:'CONNECTED'}}:null;}}};
  const resolveWorker=async(db,workerScope,phone)=>{assert.deepEqual(workerScope,{organizationId:scope.organizationId,projectId:scope.projectId});assert.equal(phone,'15551230001');return{status:revoked?'CANONICAL_BLOCKED':'RESOLVED',worker:revoked?null:{id:scope.workerId,projectId:scope.projectId,active:true,metadata:{whatsappRole:role}}};};
  return{calls,run:(value=descriptor,context=scope)=>materializeFieldMenuDelivery(prisma,{descriptor:value,scope:context,recipientPhone:'15551230001',replyToMessageId:'wamid.original'},{resolveWorker})};
}
test('materialization recomputes current role instead of trusting prepared menu rows',async()=>{
  const f=deliveryFixture({role:'SAFETY'}),message=await f.run();
  assert.ok(!message.interactive.action.sections[0].rows.some(row=>key(row)==='PROGRESS'));
  assert.deepEqual(f.calls[0].where,{id:scope.projectId,organizationId:scope.organizationId,status:'ACTIVE'});
  assert.equal(message.context.message_id,'wamid.original');
});
test('revoked participant cannot receive a newly materialized menu',async()=>{
  await assert.rejects(deliveryFixture({revoked:true}).run(),{code:'WHATSAPP_FIELD_MENU_PARTICIPANT_REVOKED'});
});
test('disabled or unavailable worksite cannot be replaced by another worksite',async()=>{
  await assert.rejects(deliveryFixture({project:false}).run(),{code:'WHATSAPP_FIELD_MENU_SCOPE'});
});
test('delivery scope mismatch is rejected before querying a project',async()=>{
  const f=deliveryFixture();await assert.rejects(f.run(descriptor,{...scope,organizationId:'foreign'}),{code:'WHATSAPP_FIELD_MENU_SCOPE'});assert.equal(f.calls.length,0);
});
test('malformed or duplicated provider rows never reach the send function',()=>{
  const message=buildFieldMenuPayload({to:'15551230001',scope,role:'WORKER'});
  const duplicate=structuredClone(message);duplicate.interactive.action.sections[0].rows.push(duplicate.interactive.action.sections[0].rows[0]);
  assert.throws(()=>assertFieldMenuPayload(duplicate,'15551230001'));
  const tooLong=structuredClone(message);tooLong.interactive.action.sections[0].rows[0].title='x'.repeat(25);assert.throws(()=>assertFieldMenuPayload(tooLong,'15551230001'));
  assert.throws(()=>assertFieldMenuPayload(message,'15551230002'));
});
