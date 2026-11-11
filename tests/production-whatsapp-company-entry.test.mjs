import test from 'node:test';
import assert from 'node:assert/strict';
import {employeeIntakeFixture} from './fixtures/employee-intake-memory.mjs';
import {beginEmployeeIntakeConversation,planEmployeeIntakeConversation} from '../src/lib/meta-kyc-conversation.mjs';
import {customerOutboundId} from '../src/lib/meta-customer-outbound.mjs';

const text=body=>({type:'text',text:{body}});
const entryTitles=['Crear mi empresa','Sumarme a una obra','Ya tengo cuenta'];
function assertUnprivileged(f,before){
 assert.equal(f.workers.size,0);assert.deepEqual([...f.audits],before.audits);assert.equal(f.controls.providerCalls,before.providerCalls);
 assert.equal(f.state().consent,false);assert.equal(f.state().name,null);assert.equal(f.state().job,null);assert.equal(f.state().email,null);
}
async function started(){const f=employeeIntakeFixture();await f.configure();const before={audits:structuredClone([...f.audits]),providerCalls:f.controls.providerCalls};const greeting=await f.execute('HOLA');return {f,before,greeting};}

test('first signed HOLA offers company creation, worksite intake and an existing account without creating a person or account',async()=>{
 const {f,before,greeting}=await started();assert.equal(greeting.result.businessApplied,false);assert.equal(greeting.result.identityStatus,'LIMITED_PARTICIPANT_INTAKE');
 assert.equal(greeting.result.reply.type,'interactive');assert.deepEqual(greeting.result.reply.sections[0].rows.map(row=>row.title),entryTitles);assert.equal(f.state().entryChoicePending,true);
 assertUnprivileged(f,before);assert.equal((await f.read()).records.length,0);assert.equal(f.controls.sends,1);
});

test('a plain name, role, email or command cannot silently select employee registration',async()=>{
 const {f,before}=await started();for(const body of ['Persona Sintética','director','person@example.invalid','Crear mi empresa','Sumarme a una obra','MENU']){
  const {result}=await f.execute(body);assert.equal(result.reply.type,'interactive');assert.deepEqual(result.reply.sections[0].rows.map(row=>row.title),entryTitles);assert.equal(f.state().entryChoicePending,true);assertUnprivileged(f,before);
 }
});

for(const [value,url] of [['CREATE_COMPANY','https://obrasaas.com/sign-up'],['ACCOUNT','https://obrasaas.com/cuenta']])test(value+' only opens the canonical verified web route, without granting a role or starting employee intake',async()=>{
 const {f,before}=await started();const {result}=await f.choose(value);assert.equal(result.businessApplied,false);assert.equal(result.reply.type,'text');assert.ok(result.reply.body.includes(url));
 assert.doesNotMatch(result.reply.body,/(?:IDENTIDAD|VINCULAR) [A-Za-z0-9_-]{43}|token=|org_|worker_|role=/);if(value==='CREATE_COMPANY'){assert.match(result.reply.body,/verificá tu correo/);assert.match(result.reply.body,/No conecta WhatsApp ni concede permisos/);}
 assert.equal(f.state().entryChoicePending,true);assertUnprivileged(f,before);
 const {result:again}=await f.execute('HOLA');assert.deepEqual(again.reply.sections[0].rows.map(row=>row.title),entryTitles);assertUnprivileged(f,before);
});

test('the explicit worksite choice resumes the existing privacy-confirmed request and still needs administrator admission',async()=>{
 const {f,before}=await started();const {result}=await f.choose('JOIN_WORKSITE');assert.equal(result.reply.type,'text');assert.match(result.reply.body,/nombre y apellido/);assert.equal(f.state().entryChoicePending,undefined);assertUnprivileged(f,before);
 await f.execute('Persona Sintética');assert.equal(f.state().step,'JOB');await f.choose('WORKER');await f.execute('person@example.invalid');assert.equal(f.state().step,'CONFIRM');assert.equal(f.state().consent,false);assert.equal(f.workers.size,0);
 await f.choose('CONFIRM');assert.equal(f.state().step,'WAITING_RESPONSIBLE');assert.equal(f.state().consent,true);assert.equal(f.workers.size,0);assert.equal((await f.read()).records.length,1);assert.equal(f.controls.providerCalls,0);
});

for(const kind of ['no-context','wrong-context','stale-choice','invalid-index'])test('entry refuses '+kind+' and shows a fresh choice without inferring a role from the phone',async()=>{
 const {f,before,greeting}=await started();const id=greeting.result.reply.sections[0].rows[0].id;let message={type:'interactive',interactive:{list_reply:{id}}},options;
 if(kind==='no-context')options={reply:false};if(kind==='wrong-context')message.context={id:'wamid.UnrelatedPrompt'};if(kind==='stale-choice')await f.execute('HOLA');if(kind==='invalid-index')message.interactive.list_reply.id=id.replace(/:0$/,':99');
 const {result}=await f.execute(message,options);assert.equal(result.reply.type,'interactive');assert.deepEqual(result.reply.sections[0].rows.map(row=>row.title),entryTitles);assert.equal(f.state().entryChoicePending,true);assertUnprivileged(f,before);
});

test('replaying the current greeting or company choice does not repeat a delivered reply; advancing keeps older replies fenced',async()=>{
 const {f,before,greeting}=await started();async function replay(exchange){
  const sends=f.controls.sends,stored=structuredClone(f.outbounds.get(customerOutboundId(exchange.context.eventId)));assert.deepEqual(await f.bridge.execute(exchange.context),exchange.result);
  assert.equal((await f.outbound.send(exchange.context,exchange.result.reply,{purpose:'EMPLOYEE_INTAKE'})).replayed,true);assert.equal(f.controls.sends,sends);assert.deepEqual(f.outbounds.get(customerOutboundId(exchange.context.eventId)),stored);
 }
 await replay(greeting);const company=await f.choose('CREATE_COMPANY');await replay(company);const sends=f.controls.sends;await assert.rejects(f.outbound.send(greeting.context,greeting.result.reply,{purpose:'EMPLOYEE_INTAKE'}),{code:'EMPLOYEE_INTAKE_CONTEXT_REQUIRED'});assert.equal(f.controls.sends,sends);
 assertUnprivileged(f,before);
});

test('a lost entry reply stays uncertain and cannot authorize a following selection',async()=>{
 const f=employeeIntakeFixture();await f.configure();f.controls.loseSendAck=true;const {context,result}=await f.execute('HOLA');const sends=f.controls.sends;assert.equal(f.outbounds.get(customerOutboundId(context.eventId)).outcome.state,'SEND_UNKNOWN');
 assert.equal((await f.outbound.send(context,result.reply,{purpose:'EMPLOYEE_INTAKE'})).replayed,true);assert.equal(f.controls.sends,sends);f.controls.loseSendAck=false;await f.choose('JOIN_WORKSITE');assert.equal(f.state().entryChoicePending,true);assert.equal(f.state().name,null);assert.equal(f.workers.size,0);
});

for(const patch of [{projectId:'other-project'},{channelId:'other-channel'},{payloadDigest:'b'.repeat(64)},{leaseToken:'another-lease'}])test('entry remains scoped to the signed channel and current source '+Object.keys(patch)[0],async()=>{
 const f=employeeIntakeFixture();await f.configure();const context=f.receive('HOLA'),before=structuredClone([...f.events]);await assert.rejects(f.bridge.execute({...context,...patch}));assert.deepEqual([...f.events],before);assert.equal(f.workers.size,0);assert.equal(f.controls.sends,0);
});

test('an expired unselected welcome can restart from a new HOLA while preserving the original encrypted envelope',async()=>{
 const {f,greeting}=await started(),old=structuredClone(f.events.get(greeting.context.eventId).payload);f.now.setTime(Date.parse(f.state().expiresAt)+1);const newer=await f.execute('HOLA');assert.equal(f.events.get(greeting.context.eventId).payload.employeeIntake.status,'CANCELLED');
 for(const field of ['encryptedPayload','encryptedProof','payloadDigest'])assert.equal(f.events.get(greeting.context.eventId).payload[field],old[field]);assert.deepEqual(newer.result.reply.sections[0].rows.map(row=>row.title),entryTitles);assert.equal(f.workers.size,0);
});

test('legacy name, job, email and admitted states without the new marker keep their existing paths',()=>{
 const initial=beginEmployeeIntakeConversation('synthetic-event-a').state,legacy={...initial};delete legacy.entryChoicePending;delete legacy.nonce;delete legacy.choices;
 let plan=planEmployeeIntakeConversation({state:legacy,message:text('Persona Sintética'),eventId:'synthetic-event-b',promptConfirmed:true});assert.equal(plan.state.step,'JOB');assert.equal(plan.state.entryChoicePending,undefined);
 const choose=value=>{const index=plan.state.choices.findIndex(row=>row.value===value);return {type:'interactive',interactive:{list_reply:{id:'intake:'+plan.state.nonce+':'+index}}};};
 plan=planEmployeeIntakeConversation({state:plan.state,message:choose('WORKER'),eventId:'synthetic-event-c',promptConfirmed:true});assert.equal(plan.state.step,'EMAIL');
 plan=planEmployeeIntakeConversation({state:plan.state,message:text('person@example.invalid'),eventId:'synthetic-event-d',promptConfirmed:true});assert.equal(plan.state.step,'CONFIRM');
 const admitted=planEmployeeIntakeConversation({state:{...plan.state,step:'ADMITTED'},message:text('HOLA'),eventId:'synthetic-event-e',promptConfirmed:true});assert.deepEqual(admitted.reply.sections[0].rows.map(row=>row.title),['Abrir mi cuenta','Consultar identidad']);assert.equal(admitted.state.entryChoicePending,undefined);
});

test('the welcome never intercepts the existing field binding or private identity commands',async()=>{
 for(const body of ['IDENTIDAD '+'a'.repeat(43),'VINCULAR '+'a'.repeat(43)]){const f=employeeIntakeFixture();await f.configure();assert.equal((await f.execute(body)).result,null);assert.equal(f.workers.size,0);assert.equal(f.controls.sends,0);}
 const f=employeeIntakeFixture();await f.configure();f.controls.bound=true;assert.equal((await f.execute('HOLA')).result,null);assert.equal(f.controls.sends,0);
});
