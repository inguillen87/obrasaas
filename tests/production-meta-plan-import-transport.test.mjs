import test from 'node:test';
import assert from 'node:assert/strict';
import {metaPlanImportTransportFixture} from './fixtures/meta-plan-import-transport-synthetic.mjs';
import {createHash} from 'node:crypto';
import {ownCompanyRuntimeFixture} from './fixtures/own-company-runtime.mjs';
import {metaPreparedPlanRecovery} from '../src/lib/meta-plan-import-recovery.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {digest} from '../src/lib/workspace-policy.mjs';
import {planMetaFieldConversation} from '../src/lib/meta-field-conversation.mjs';
import {metaPlanImportAuthorizationValid} from '../src/lib/meta-plan-import-conversation.mjs';

const counts=f=>Object.fromEntries(['graph','attachment','get','put','analyze','taskWrites'].map(key=>[key,f.calls[key]]));
const noExternal=f=>assert.deepEqual(counts(f),{graph:0,attachment:0,get:0,put:0,analyze:0,taskWrites:0});
const noReady=f=>{assert.ok(f.planDrafts().every(row=>row.metadata.status!=='READY'));assert.equal(f.calls.records,0);assert.equal(f.calls.taskWrites,0);};
const preparedRow=f=>[...f.audits().values()].find(row=>row.action==='meta.field.plan.prepared');
const recoveryProof=f=>metaPreparedPlanRecovery(f.client,f.context,{environment:f.environment});
function resealPrepared(f,edit){
 const row=preparedRow(f),context={organizationId:f.r.member.organizationId,projectId:row.metadata.projectId,purpose:'field-plan-prepared',resourceId:row.id};
 const input=JSON.parse(decryptCustomerSecret(row.metadata.encryptedInput,context,f.environment));edit(input);
 row.metadata.inputDigest=digest(input);row.metadata.encryptedInput=encryptCustomerSecret(JSON.stringify(input),context,f.environment);
}

for(const role of ['ADMIN','DIRECTOR'])test('real import store creates one revisable READY draft and zero tasks for '+role,async()=>{
 const f=metaPlanImportTransportFixture({role}),prepared=await f.prepare();
 noExternal(f);const result=await f.transport.execute(f.context,prepared),drafts=f.planDrafts();
 assert.equal(result.kind,'PLAN_IMPORT_DRAFT');assert.equal(drafts.length,1);assert.equal(drafts[0].metadata.status,'READY');assert.equal(drafts[0].metadata.analysis.reviewed,false);
 assert.deepEqual(drafts[0].metadata.rows,[{title:'Partida sintética',startsOn:null,endsOn:null,evidence:'Fila sintética 1',uncertainty:'Revisar fechas con la fuente'}]);
 assert.equal(result.receiptId,drafts[0].id);assert.match(result.reply.body,/Abrilo para revisar la fuente.*completar las fechas.*resolver las dudas/);assert.deepEqual(result.reply.body.match(/https:\/\/\S+/g),[`https://obrasaas.com/cuenta?obra=project-plan-synthetic&plan=${drafts[0].id}#plan-import-title`]);
 assert.deepEqual(counts(f),{graph:1,attachment:1,get:2,put:1,analyze:1,taskWrites:0});
 assert.equal(f.calls.sql.some(sql=>sql.startsWith('INSERT INTO public."Task"')),false);
});
test('Company projection keeps anchor credentials and the independently confirmed target',async()=>{
 const f=metaPlanImportTransportFixture({corporate:true}),prepared=await f.prepare();assert.notEqual(f.r.connection.projectId,f.r.project.id);
 const result=await f.transport.execute(f.context,prepared);assert.equal(result.kind,'PLAN_IMPORT_DRAFT');assert.equal(f.planDrafts()[0].metadata.projectId,f.r.project.id);assert.equal(f.calls.graph,1);assert.equal(f.calls.taskWrites,0);
});
test('same signed event replay reads the canonical draft without repeating download, Blob or analysis',async()=>{
 const f=metaPlanImportTransportFixture(),prepared=await f.prepare(),first=await f.transport.execute(f.context,prepared),before=counts(f);
 const recovered=await f.recover();assert.equal(recovered.operationId,prepared.operationId);const second=await f.transport.execute(f.context,recovered);
 assert.deepEqual(second,first);assert.deepEqual(counts(f),before);assert.equal(f.planDrafts().length,1);
});
test('lost final response after READY recovers the same operation without recapture or reanalysis',async()=>{
 const f=metaPlanImportTransportFixture(),prepared=await f.prepare();f.controls.failRecordOnce=true;
 await assert.rejects(f.transport.execute(f.context,prepared),/Synthetic final response loss/);assert.equal(f.planDrafts()[0].metadata.status,'READY');const before=counts(f);
 const recovered=await f.recover();assert.equal(recovered.operationId,prepared.operationId);const result=await f.transport.execute(f.context,recovered);
 assert.equal(result.receiptId,f.planDrafts()[0].id);assert.deepEqual(counts(f),before);assert.equal(f.planDrafts().length,1);
});
for(const [status,expired] of [['UPLOADING',false],['PROCESSING',false],['PROCESSING',true],['FAILED',false]])test('observed '+status+(expired?' expired':'')+' reservation does not repeat external work',async()=>{
 const f=metaPlanImportTransportFixture(),prepared=await f.prepare(),id=f.seedPending(prepared,{status,expired});
 const result=await f.transport.execute(f.context,prepared);assert.equal(result.receiptId,id);noExternal(f);assert.equal(f.planDrafts().length,1);
 assert.match(result.reply.body,status==='FAILED'?/no quedó confirmada/:/no repetimos/);
});
test('expired source reference can observe an exact previous READY reservation without any new external call',async()=>{
 const f=metaPlanImportTransportFixture(),prepared=await f.prepare();f.controls.failRecordOnce=true;await assert.rejects(f.transport.execute(f.context,prepared));const before=counts(f);
 f.controls.clockOffset=16*60000;f.r.event.leaseExpiresAt=new Date(Date.now()+f.controls.clockOffset+60000).toISOString();
 const recovered=await f.recover(),result=await f.transport.execute(f.context,recovered);
 assert.equal(result.receiptId,f.planDrafts()[0].id);assert.equal(f.planDrafts()[0].metadata.status,'READY');assert.deepEqual(counts(f),before);
});
test('an expired source reference without a canonical plan reservation authorizes zero external calls',async()=>{
 const f=metaPlanImportTransportFixture();f.controls.clockOffset=16*60000;f.r.event.leaseExpiresAt=new Date(Date.now()+f.controls.clockOffset+60000).toISOString();
 await assert.rejects(f.prepare());noExternal(f);assert.equal(f.planDrafts().length,0);
});
test('a sealed transport preparation alone cannot extend an expired reference into a new download',async()=>{
 const f=metaPlanImportTransportFixture();await f.prepare();f.controls.clockOffset=16*60000;f.r.event.leaseExpiresAt=new Date(Date.now()+f.controls.clockOffset+60000).toISOString();
 const recovered=await f.recover(),closed=await f.transport.execute(f.context,recovered);assert.equal(closed.kind,'PLAN_IMPORT_REFERENCE_EXPIRED');assert.equal(closed.code,'META_PLAN_IMPORT_REFERENCE_EXPIRED');assert.equal(closed.businessApplied,false);noExternal(f);assert.equal(f.planDrafts().length,0);
});
for(const [name,edit] of [
 ['current role',f=>{f.r.member.role='FINANCE';}],
 ['current assignment',f=>{f.controls.assignment=false;}],
 ['original signed proof',f=>{f.fileEvent.payload.encryptedProof='v2.forged';}],
 ['original delivered prompt',f=>{f.events.get(f.outboundId).outcome.state='SEND_UNKNOWN';}],
])test('historical READY recovery still denies changed '+name+' with zero additional external calls',async()=>{
 const f=metaPlanImportTransportFixture(),prepared=await f.prepare();f.controls.failRecordOnce=true;await assert.rejects(f.transport.execute(f.context,prepared));const before=counts(f);
 f.controls.clockOffset=16*60000;f.r.event.leaseExpiresAt=new Date(Date.now()+f.controls.clockOffset+60000).toISOString();edit(f);
 await assert.rejects(f.recover());assert.deepEqual(counts(f),before);assert.equal(f.calls.records,0);
});

for(const [name,edit] of [
 ['forged origin proof',f=>{f.fileEvent.payload.encryptedProof='v2.forged';}],
 ['unrelated file payload',f=>{f.fileEvent.payload.payloadDigest='f'.repeat(64);}],
 ['other source worksite',f=>{f.fileEvent.projectId='other-project';}],
 ['changed nonce',f=>{f.authorized.state.nonce='e'.repeat(20);}],
 ['other authorization step',f=>{f.authorized.state.mediaAuthorizationStep='MEDIA_TYPED_NOTICE';}],
 ['unrelated pending document',f=>{f.authorized.state.pendingFile.mediaId='280000099';}],
 ['unapproved office role',f=>{f.r.member.role='FINANCE';}],
 ['auditor role',f=>{f.r.member.role='AUDITOR';}],
 ['Development Pilot',f=>{f.r.connection.metadata.developmentPilot={version:1};}],
 ['changed binding',f=>{f.r.channelBinding.id='other-binding';}],
 ['source dispatch not observed',f=>{f.audits().delete(f.observedId);}],
 ['source dispatch says business applied',f=>{f.audits().get(f.observedId).metadata.businessApplied=true;}],
])test(name+' rejects before plan reservation, download or extraction',async()=>{
 const f=metaPlanImportTransportFixture();edit(f);await assert.rejects(f.prepare());noExternal(f);assert.equal(f.planDrafts().length,0);
});
for(const [name,edit] of [
 ['SEND_STARTED',f=>{f.events.get(f.outboundId).outcome.state='SEND_STARTED';}],
 ['SEND_UNKNOWN',f=>{f.events.get(f.outboundId).outcome.state='SEND_UNKNOWN';}],
 ['failed delivery',f=>{f.events.get(f.outboundId).outcome.providerStatus='failed';}],
 ['deleted message',f=>{f.events.get(f.outboundId).outcome.providerStatus='deleted';}],
 ['other recipient',f=>{f.sent.to='5491100009999';f.sealOutbound();}],
 ['other source digest',f=>{f.sent.payloadDigest='f'.repeat(64);f.sealOutbound();}],
 ['other reply source',f=>{f.sent.replyTo='wamid.UnrelatedSource';f.sealOutbound();}],
])test('sealed prompt '+name+' does not authorize the file',async()=>{
 const f=metaPlanImportTransportFixture();edit(f);await assert.rejects(f.prepare());noExternal(f);assert.equal(f.planDrafts().length,0);
});
for(const field of ['projectId','workerId','actorId','membershipId','assignmentRevision','bindingId','routeEpoch','payloadDigest'])test('Company stale original '+field+' cannot borrow the current route',async()=>{
 const f=metaPlanImportTransportFixture({corporate:true}),origin=f.routes.get(f.fileEvent.id);origin[field]=typeof origin[field]==='number'?origin[field]+1:'other-'+field;
 await assert.rejects(f.prepare());noExternal(f);assert.equal(f.planDrafts().length,0);
});
for(const reason of ['role','assignment','lease'])for(const stage of ['graph','get','put','analyzer'])test(reason+' revoked during '+stage+' fences later phases and never reports READY',async()=>{
 const f=metaPlanImportTransportFixture(),prepared=await f.prepare();
 f.controls.hooks[stage]=()=>{if(reason==='role')f.r.member.role='FINANCE';else if(reason==='assignment')f.controls.assignment=false;else f.r.event.leaseExpiresAt=new Date(Date.now()-1).toISOString();};
 await assert.rejects(f.transport.execute(f.context,prepared));noReady(f);
 if(stage==='graph'){assert.equal(f.calls.attachment,0);assert.equal(f.calls.put,0);assert.equal(f.calls.analyze,0);}
 if(stage==='get')assert.equal(f.calls.put,0);
 if(stage==='put')assert.equal(f.calls.analyze,0);
});
for(const [name,configure] of [
 ['bad Graph MIME',f=>{f.controls.graphPatch.mime_type='audio/ogg';}],
 ['bad Graph hash',f=>{f.controls.graphPatch.sha256='f'.repeat(64);}],
 ['oversized Graph file',f=>{f.controls.graphPatch.file_size=3*1024*1024+1;}],
 ['response MIME differs from source reference',f=>{f.controls.graphPatch.mime_type='image/png';}],
 ['declared adapter hash differs from bytes',f=>{f.controls.providerOverride=async()=>({bytes:f.bytes,contentType:'application/pdf',sha256:createHash('sha256').update('other-source').digest('hex')});}],
])test(name+' returns a review result with zero canonical plan drafts',async()=>{
 const f=metaPlanImportTransportFixture(),prepared=await f.prepare();configure(f);const result=await f.transport.execute(f.context,prepared);
 assert.equal(result.kind,'PLAN_IMPORT_SOURCE_REVIEW');assert.equal(result.businessApplied,false);assert.equal(f.planDrafts().length,0);assert.equal(f.calls.put,0);assert.equal(f.calls.analyze,0);assert.equal(f.calls.taskWrites,0);
});
test('real OWN runtime grant and provider fences can create only a revisable draft',async t=>{
 const own=await ownCompanyRuntimeFixture();t.mock.timers.enable({apis:['Date'],now:own.time});
 const f=metaPlanImportTransportFixture({ownAuthority:own,ownCapability:await own.capability()}),prepared=await f.prepare(),value=await f.transport.execute(f.context,prepared);
 assert.equal(value.kind,'PLAN_IMPORT_DRAFT');assert.equal(f.planDrafts()[0].metadata.status,'READY');assert.equal(f.calls.taskWrites,0);assert.equal(f.calls.graph,1);assert.equal(own.calls.filter(call=>call.method==='POST').length,0);
});
for(const field of ['grantDigest','origin'])for(const stage of ['graph','analyzer'])test('OWN captured '+field+' mutation during '+stage+' invalidates the same-token attempt',async t=>{
 const own=await ownCompanyRuntimeFixture();t.mock.timers.enable({apis:['Date'],now:own.time});
 const f=metaPlanImportTransportFixture({ownAuthority:own,ownCapability:await own.capability()}),prepared=await f.prepare(),cipher=f.r.connection.encryptedAccessToken;
 f.controls.hooks[stage]=()=>{const grant=f.r.connection.metadata.ownCompanyRuntime;if(field==='grantDigest')grant.grantDigest='f'.repeat(64);else grant.origin.sourceHead='e'.repeat(40);};
 await assert.rejects(f.transport.execute(f.context,prepared),{code:'META_PLAN_IMPORT_SOURCE_CONTEXT_CHANGED'});assert.equal(f.r.connection.encryptedAccessToken,cipher);noReady(f);
 if(stage==='graph'){assert.equal(f.calls.attachment,0);assert.equal(f.calls.put,0);assert.equal(f.calls.analyze,0);}
});

for(const restricted of [true,undefined])test('canonical reviewer restriction '+String(restricted)+' denies a corrupt ADMIN role before all effects',async()=>{
 const f=metaPlanImportTransportFixture();f.controls.restricted=restricted;
 await assert.rejects(f.prepare(),{code:'PLAN_IMPORT_PERMISSION_REQUIRED'});noExternal(f);assert.equal(preparedRow(f),undefined);
});
for(const stage of ['graph','analyzer'])test('canonical reviewer restriction introduced during '+stage+' fences the attempt',async()=>{
 const f=metaPlanImportTransportFixture(),prepared=await f.prepare();f.controls.hooks[stage]=()=>{f.controls.restricted=true;};
 await assert.rejects(f.transport.execute(f.context,prepared),{code:'PLAN_IMPORT_PERMISSION_REQUIRED'});noReady(f);
 if(stage==='graph'){assert.equal(f.calls.attachment,0);assert.equal(f.calls.put,0);assert.equal(f.calls.analyze,0);}
});
test('proof-only recovery rejects an event without an actual sealed preparation',async()=>{
 const f=metaPlanImportTransportFixture();assert.equal(await recoveryProof(f),false);noExternal(f);
});
for(const corporate of [false,true])test('proof-only recovery validates the complete sealed '+(corporate?'Company':'project')+' source without external calls',async()=>{
 const f=metaPlanImportTransportFixture({corporate});await f.prepare();assert.equal(await recoveryProof(f),true);noExternal(f);
 assert.equal(f.calls.records,0);assert.equal(f.planDrafts().length,0);
});
for(const [name,edit] of [
 ['role',f=>{f.r.member.role='FINANCE';}],
 ['assignment',f=>{f.controls.assignment=false;}],
 ['reviewer restriction',f=>{f.controls.restricted=true;}],
])test('proof-only recovery preserves a reservation after '+name+' revocation but cannot authorize transport retry',async()=>{
 const f=metaPlanImportTransportFixture();await f.prepare();edit(f);
 assert.equal(await recoveryProof(f),true);await assert.rejects(f.recover());noExternal(f);assert.equal(f.calls.records,0);assert.equal(f.planDrafts().length,0);
});
test('proof-only recovery retains an expired reference without renewing its source or authorizing a download',async()=>{
 const f=metaPlanImportTransportFixture();await f.prepare();const original=structuredClone(f.authorized.state.pendingFile);
 f.controls.clockOffset=16*60000;f.r.event.leaseExpiresAt=new Date(Date.now()+f.controls.clockOffset+60000).toISOString();
 assert.equal(await recoveryProof(f),true);assert.deepEqual(f.authorized.state.pendingFile,original);
 const closed=await f.transport.execute(f.context,await f.recover());assert.equal(closed.kind,'PLAN_IMPORT_REFERENCE_EXPIRED');assert.equal(closed.businessApplied,false);noExternal(f);assert.equal(f.planDrafts().length,0);
});
for(const [name,edit] of [
 ['current lease token',f=>{f.context.leaseToken='other-lease';}],
 ['current event digest',f=>{f.context.payloadDigest='e'.repeat(64);}],
 ['prepared operation id',f=>{preparedRow(f).metadata.operationId='unrelated-operation';}],
 ['sealed ciphertext',f=>{preparedRow(f).metadata.encryptedInput='v2.forged';}],
 ['input digest',f=>{preparedRow(f).metadata.inputDigest='e'.repeat(64);}],
 ['sealed binding',f=>{resealPrepared(f,input=>{input.state.bindingId='other-binding';});}],
 ['original notice nonce',f=>{resealPrepared(f,input=>{input.state.nonce='e'.repeat(20);});}],
 ['original signed file',f=>{f.fileEvent.payload.encryptedProof='v2.forged';}],
 ['missing original file',f=>{f.events.delete(f.fileEvent.id);}],
 ['unobserved original capture',f=>{f.audits().delete(f.observedId);}],
 ['unknown prompt delivery',f=>{f.events.get(f.outboundId).outcome.state='SEND_UNKNOWN';}],
 ['other sealed prompt recipient',f=>{f.sent.to='5491100009999';f.sealOutbound();}],
 ['Development Pilot',f=>{f.r.connection.metadata.developmentPilot={version:1};}],
])test('proof-only recovery rejects altered '+name+' and performs zero external work',async()=>{
 const f=metaPlanImportTransportFixture();await f.prepare();edit(f);assert.equal(await recoveryProof(f),false);noExternal(f);assert.equal(f.calls.records,0);assert.equal(f.planDrafts().length,0);
});
for(const field of ['projectId','workerId','actorId','membershipId','assignmentRevision','bindingId','routeEpoch','payloadDigest'])test('proof-only Company recovery rejects a stale original '+field,async()=>{
 const f=metaPlanImportTransportFixture({corporate:true});await f.prepare();const source=f.routes.get(f.fileEvent.id);source[field]=typeof source[field]==='number'?source[field]+1:'other-'+field;
 assert.equal(await recoveryProof(f),false);noExternal(f);assert.equal(f.calls.records,0);
});

// These exercise the real field caller, not a replacement planner. Only the
// verified host event facts and persisted conversation metadata are synthetic.
function fieldPlanCaller(role){
 if(arguments.length===0)role='ADMIN';
 const now=new Date('2026-10-12T04:00:00.000Z');let sequence=0;
 const base={projectName:'Obra sintética',workerId:'worker-plan-caller',permissions:{attendance:true,report:true},sectors:[],tasks:[],evidence:[],proposals:[],latest:null,inventory:{materials:[{id:'material-plan-caller',active:true}]},planImportRole:role};
 function run(message,state=null,changes={}){
  const eventId='synthetic_field_plan_'+(++sequence),facts={...base,...changes,planImportReferenceContext:{eventId,payloadDigest:digest(['synthetic-field-message',eventId]),contextDigest:digest(['synthetic-field-context',role]),sourceProjectId:'project-plan-caller'}},timestamp=String(Math.floor(now.getTime()/1000));
  const value=planMetaFieldConversation({message:{timestamp,...message},state,eventId,facts,now});
  // Persisted host metadata supplies v1/expiry for MENU and binds each new
  // prompt to its event. Preserved drafts and an emitted intent stay exact.
  if(value.state&&!value.preserveConversation&&!value.planImport)value.state={...value.state,version:1,lastEventId:eventId,lastMessageTimestamp:timestamp,lastReceivedAt:now.toISOString(),expiresAt:new Date(now.getTime()+900000).toISOString(),bindingId:'binding-plan-caller'};
  return {...value,eventId,facts,now,input:{timestamp,...message}};
 }
 const say=(body,state,changes)=>run({type:'text',text:{body}},state,changes);
 function select(plan,choice){const index=plan.state.choices.findIndex(row=>row.value===choice);assert.ok(index>=0,'Field caller choice '+choice);return run({type:'interactive',interactive:{type:'list_reply',list_reply:{id:plan.reply.sections[0].rows[index].id}}},plan.state);}
 function notice(){const menu=say('MENU'),format=select(menu,'PLAN_IMPORT'),file=select(format,'DOCUMENT'),pending=run({type:'document',document:{id:'290000001',mime_type:'application/pdf'}},file.state);return {menu,format,file,pending};}
 return {run,say,select,notice,now};
}
const callerNoIntent=value=>{assert.equal(value.planImport,undefined);assert.equal(value.command,undefined);assert.equal(value.media,undefined);};
for(const role of ['ADMIN','DIRECTOR','SITE_MANAGER'])test('real field caller '+role+' traverses MENU, format, file and notice into only a bound import intent',()=>{
 const f=fieldPlanCaller(role),{menu,format,file,pending}=f.notice();
 for(const value of [menu,format,file,pending])callerNoIntent(value);
 assert.equal(format.state.step,'PLAN_IMPORT_FORMAT');assert.equal(file.state.step,'PLAN_IMPORT_FILE');assert.equal(pending.state.step,'PLAN_IMPORT_NOTICE');
 assert.equal(Date.parse(format.state.expiresAt)-format.now.getTime(),900000);assert.equal(pending.state.pendingFile.receivedAt,pending.now.toISOString());
 assert.equal(pending.state.pendingFile.eventId,pending.eventId);assert.equal(pending.state.pendingFile.payloadDigest,pending.facts.planImportReferenceContext.payloadDigest);assert.equal(pending.state.lastMessageTimestamp,pending.input.timestamp);
 const value=f.select(pending,'EXTRACT');assert.equal(value.state.step,'PLAN_IMPORT_AUTHORIZED');assert.equal(value.command,undefined);assert.equal(value.media,undefined);
 assert.equal(value.planImport.analysisConsentEventId,value.eventId);assert.notEqual(value.eventId,pending.eventId);assert.deepEqual(value.planImport.sourceOrigin,pending.state.pendingFile);
 assert.equal(value.state.lastEventId,pending.eventId);assert.equal(value.state.nonce,pending.state.nonce);assert.equal(value.state.bindingId,'binding-plan-caller');
 assert.equal(metaPlanImportAuthorizationValid(value.input,value.planImport,value.state,{facts:value.facts,now:value.now,eventId:value.eventId}),true);
});
test('real field caller exposes no import menu or intent without a canonical import role',()=>{
 for(const role of [null,undefined,'AUDITOR','FINANCE','WORKER','admin']){
  const f=fieldPlanCaller(role),menu=f.say('MENU');callerNoIntent(menu);assert.ok(!menu.state.choices.some(row=>row.value==='PLAN_IMPORT'));
   for(const body of ['IMPORTAR CRONOGRAMA','IMPORTAR PLAN']){const denied=f.say(body,menu.state);callerNoIntent(denied);assert.equal(denied.state,null);}
   for(const body of ['CRONOGRAMA','GANTT']){const read=f.say(body,menu.state,{tasks:[{id:'task-read',title:'Tarea registrada',status:'IN_PROGRESS',progress:30,startsOn:'2026-10-12',endsOn:'2026-10-20'}]});callerNoIntent(read);assert.equal(read.state.purpose,'TASKS');assert.match(read.reply.body,/2026-10-12 → 2026-10-20/);assert.match(read.reply.body,/30%/);}
 }
});
test('real field menu stays within ten WhatsApp rows in every journey and permission state',()=>{
 const journeys=[null,{eventType:'CHECK_OUT',phase:'WORKING'},{eventType:'CHECK_IN',phase:'WORKING'},{eventType:'BREAK_START',phase:'ON_BREAK'}];
 for(const role of ['ADMIN','DIRECTOR','SITE_MANAGER',null])for(const latest of journeys)for(const attendance of [true,false])for(const report of [true,false]){
  const f=fieldPlanCaller(role),menu=f.say('MENU',null,{latest,permissions:{attendance,report}});callerNoIntent(menu);
  const rows=menu.reply.sections.flatMap(section=>section.rows);assert.ok(rows.length<=10);assert.equal(rows.length,menu.state.choices.length);assert.equal(new Set(rows.map(row=>row.id)).size,rows.length);
  assert.equal(menu.state.choices.some(row=>row.value==='PLAN_IMPORT'),role!==null);
 }
});
test('real field caller preserves exact plan reference and nonce on greetings, status and other commands',()=>{
 const f=fieldPlanCaller(),{format,file,pending}=f.notice();
 for(const plan of [format,file,pending])for(const body of ['HOLA','ESTADO','MENU','ENTRADA','MATERIALES']){
  const before=structuredClone(plan.state),value=f.say(body,plan.state);callerNoIntent(value);
  assert.equal(value.state,plan.state);assert.equal(value.preserveConversation,true);assert.deepEqual(plan.state,before);
  assert.equal(value.state.nonce,before.nonce);assert.deepEqual(value.state.pendingFile,before.pendingFile);assert.equal(value.state.expiresAt,before.expiresAt);
 }
});
test('real field caller explicitly cancels an unconfirmed plan notice back to MENU without an intent',()=>{
 const f=fieldPlanCaller(),{pending}=f.notice(),before=structuredClone(pending.state),value=f.say('CANCELAR',pending.state);
 callerNoIntent(value);assert.equal(value.state.purpose,'MENU');assert.equal(value.state.step,'MENU');assert.equal(value.state.pendingFile,undefined);assert.notEqual(value.state.nonce,pending.state.nonce);assert.deepEqual(pending.state,before);
});
test('real field caller rejects an old MENU nonce while the exact plan notice remains pending',()=>{
 const f=fieldPlanCaller(),{menu,pending}=f.notice(),index=menu.state.choices.findIndex(row=>row.value==='PLAN_IMPORT');
 const value=f.run({type:'interactive',interactive:{type:'list_reply',list_reply:{id:menu.reply.sections[0].rows[index].id}}},pending.state);
 callerNoIntent(value);assert.equal(value.state,pending.state);assert.equal(value.state.step,'PLAN_IMPORT_NOTICE');assert.equal(value.state.nonce,pending.state.nonce);assert.equal(value.preserveConversation,true);
});
test('real field caller never treats plain Extraer or EXTRACT as interactive authorization',()=>{
 const f=fieldPlanCaller(),{pending}=f.notice();
 for(const body of ['Extraer','EXTRACT','sí']){const value=f.say(body,pending.state);callerNoIntent(value);assert.equal(value.state,pending.state);assert.equal(value.preserveConversation,true);}
});
for(const body of ['CANCELAR','MENU','HOLA','AYUDA','ENTRADA','CRONOGRAMA','ESTADO'])test('real field caller '+body+' cannot discard or reauthorize an uncertain AUTHORIZED plan reservation',()=>{
 const f=fieldPlanCaller(),{pending}=f.notice(),authorized=f.select(pending,'EXTRACT'),before=structuredClone(authorized.state);
 assert.equal(authorized.state.step,'PLAN_IMPORT_AUTHORIZED');assert.ok(authorized.planImport);
 const value=f.say(body,authorized.state);callerNoIntent(value);assert.equal(value.state,authorized.state);assert.equal(value.preserveConversation,true);assert.deepEqual(value.state,before);
 assert.equal(value.state.nonce,pending.state.nonce);assert.deepEqual(value.state.pendingFile,authorized.planImport.sourceOrigin);assert.equal(value.state.lastEventId,pending.eventId);assert.equal(value.state.analysisConsentEventId,authorized.eventId);assert.equal(value.state.consent,authorized.planImport.consent);
  if(body==='ESTADO')assert.match(value.reply.body,/Obra: Obra sintética\nJornada: cerrada/);
  else if(body==='CRONOGRAMA')assert.match(value.reply.body,/Conservamos el borrador.*comprobá el mismo intento/);
 else assert.match(value.reply.body,/ya fue autorizada.*mismo intento/);
});
test('explicit import commands retain every permitted format while schedule aliases remain reads',()=>{
 for(const role of ['ADMIN','DIRECTOR','SITE_MANAGER'])for(const body of ['IMPORTAR CRONOGRAMA','IMPORTAR PLAN']){
  const f=fieldPlanCaller(role),started=f.say(body);callerNoIntent(started);assert.equal(started.state.purpose,'PLAN_IMPORT');assert.equal(started.state.step,'PLAN_IMPORT_FORMAT');assert.ok(started.state.choices.some(row=>row.value==='DOCUMENT'));
  const current=f.say('GANTT',null,{tasks:[{id:'task-read',title:'Tarea vigente',status:'BACKLOG',progress:0,startsOn:null,endsOn:null}]});callerNoIntent(current);assert.equal(current.state.purpose,'TASKS');assert.match(current.reply.body,/Sin fechas previstas/);
 }
});
