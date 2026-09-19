import assert from 'node:assert/strict';
import test from 'node:test';
import { tsImport } from 'tsx/esm/api';
import { fieldMenuRows, buildFieldMenuPayload } from '../src/lib/whatsapp/field-interactive-menu.js';
const {processIncomingObraMessage}=await tsImport('../src/lib/whatsapp/obra-engine.js',{parentURL:import.meta.url,tsconfig:'./jsconfig.json'});
const {deliverWhatsAppMessageOutcome}=await tsImport('../src/lib/whatsapp/webhook-worker.js',{parentURL:import.meta.url,tsconfig:'./jsconfig.json'});
const scope={organizationId:'company-a',projectId:'worksite-a',workerId:'worker-a',phoneNumberId:'123456789012345'};
const now=new Date('2026-09-19T17:00:00Z');
const source={provider:'meta',externalId:'wamid.inbound-fixture',from:'15551230001',phoneNumberId:scope.phoneNumberId,timestamp:now,kind:'text',text:'menú'};
function context(role='WORKER') {
  const state={attendance:{},incidents:[],tasks:{},alertsCount:0,operariosCount:0};
  return{persist:false,prisma:{},state,projectSettings:{id:scope.projectId,organizationId:scope.organizationId,name:'Obra Norte',timezone:'America/Argentina/Buenos_Aires'},
    worker:{id:scope.workerId,projectId:scope.projectId,name:'Trabajador de ensayo',active:true,metadata:{whatsappRole:role}}};
}
function selection(key,role='WORKER',section='MAIN') {
  const row=fieldMenuRows({scope,role,section}).find(row=>row.id.endsWith(':'+key));assert.ok(row);
  return{...source,kind:'interactive',text:row.title,interactive:{type:'list',id:row.id,title:row.title}};
}
for(const greeting of ['menú','ayuda','hola'])test('real engine creates a durable menu for '+greeting+' without mutating the worksite',async()=>{
  const options=context(),before=structuredClone(options.state);
  const result=await processIncomingObraMessage({...source,text:greeting},scope,options);
  assert.equal(result.intent,'HELP');assert.equal(result.stateChanged,false);assert.deepEqual(result.fieldMenu,{version:1,section:'MAIN',...scope});
  assert.equal(result.newMessages[1].kind,'interactive');assert.deepEqual(options.state,before);
});
test('opening journey creates a submenu, never a fabricated check-in',async()=>{
  const options=context();const result=await processIncomingObraMessage(selection('JOURNEY'),scope,options);
  assert.equal(result.fieldMenu.section,'JOURNEY');assert.equal(result.stateChanged,false);assert.deepEqual(options.state.attendance,{});assert.match(result.reply,/ubicación/);
});
test('selected incident opens the existing circuit, then real text produces its operational record',async()=>{
  const options=context();const guide=await processIncomingObraMessage(selection('INCIDENT'),scope,options);
  assert.equal(guide.flowPrompt,'incident-report');assert.equal(guide.stateChanged,false);assert.equal(options.state.incidents.length,0);
  const result=await processIncomingObraMessage({...source,externalId:'wamid.incident-followup',text:'incidencia urgente: pérdida de agua en planta baja'},scope,options);
  assert.equal(result.intent,'INCIDENT');assert.equal(result.stateChanged,true);assert.equal(options.state.incidents.length,1);
  assert.equal(result.newMessages[0].metadata.workerId,scope.workerId);assert.deepEqual(options.state.tasks,{});
});
test('a forged title does not execute a different action or business mutation',async()=>{
  const options=context();const event=selection('EVIDENCE');event.text='avance 100% tarea 1';event.interactive.title=event.text;
  const result=await processIncomingObraMessage(event,scope,options);assert.equal(result.intent,'EVIDENCE');assert.equal(result.stateChanged,false);assert.match(result.reply,/Adjuntá/);assert.equal(result.operationalProposal,null);
});
test('old supervisor option is denied after the participant role changes',async()=>{
  const options=context('WORKER');const event=selection('DELAY','FOREMAN');const result=await processIncomingObraMessage(event,scope,options);
  assert.equal(result.stateChanged,false);assert.equal(result.newMessages[0].metadata.authorized,false);assert.match(result.reply,/acceso actual/);assert.equal(options.state.incidents.length,0);
});
test('menu from a different worksite cannot be replayed into the active context',async()=>{
  const options=context();const event=selection('INCIDENT');event.interactive.id=event.interactive.id.replace(/:[a-f0-9]{32}:/,':'+ 'a'.repeat(32)+':');
  const result=await processIncomingObraMessage(event,scope,options);assert.equal(result.stateChanged,false);assert.equal(result.flowPrompt,null);assert.equal(result.newMessages[0].metadata.authorized,false);
});
function deliveryFixture({fail=null,replyMissing=false,revoked=false}={}) {
  const calls={menu:0,text:0,prepare:0,settlements:[]};let settled=null;
  const dependencies={prisma:{},assertSubscription:async()=>{},claimDelivery:async()=>settled?{dispatch:false,state:settled.state,providerMessageId:settled.providerMessageId}:{dispatch:true,state:'prepared',claim:{id:'claim-a'}},
    settleDelivery:async value=>{calls.settlements.push(value);settled=value;return value;},
    prepareMenu:async(db,options)=>{calls.prepare++;if(revoked)throw Object.assign(new Error('Revoked'),{code:'WHATSAPP_FIELD_MENU_PARTICIPANT_REVOKED'});assert.deepEqual(options.scope,{...scope});return buildFieldMenuPayload({to:source.from,scope,role:'WORKER'});},
    sendMenu:async args=>{calls.menu++;assert.equal(args.phoneNumberId,scope.phoneNumberId);if(fail)throw Object.assign(new Error('sanitized'),{ambiguous:fail==='unknown',status:fail==='failed'?400:503});return replyMissing?{}:{messages:[{id:'wamid.menu-result'}]};},sendText:async()=>{calls.text++;throw new Error('Menu must not fall back after dispatch');}};
  const run=()=>deliverWhatsAppMessageOutcome({outcome:{reply:'Menú',fieldMenu:{version:1,section:'MAIN',...scope}},event:source,scope,eventId:'event-a',leaseToken:'lease-a'},dependencies);
  return{calls,run};
}
test('automatic menu uses one provider call and replays its recorded receipt',async()=>{
  const f=deliveryFixture();const first=await f.run();assert.equal(first.menuSent,true);assert.equal(first.providerMessageId,'wamid.menu-result');
  assert.equal(f.calls.settlements[0].state,'accepted');const replay=await f.run();assert.equal(replay.deliveryReplayed,true);assert.equal(f.calls.menu,1);assert.equal(f.calls.text,0);
});
for(const fail of ['failed','unknown'])test('provider '+fail+' never triggers a second text or menu send',async()=>{
  const f=deliveryFixture({fail});await assert.rejects(f.run());await assert.rejects(f.run());assert.equal(f.calls.menu,1);assert.equal(f.calls.text,0);assert.equal(f.calls.settlements[0].state,fail);
});
test('response without a provider identifier remains unknown and cannot be resent blindly',async()=>{
  const f=deliveryFixture({replyMissing:true});await assert.rejects(f.run());assert.equal(f.calls.settlements[0].state,'unknown');await assert.rejects(f.run());assert.equal(f.calls.menu,1);
});
test('revoked worker prevents dispatch and is never retried as an unguarded text',async()=>{
  const f=deliveryFixture({revoked:true});await assert.rejects(f.run());assert.equal(f.calls.menu,0);assert.equal(f.calls.text,0);
});
