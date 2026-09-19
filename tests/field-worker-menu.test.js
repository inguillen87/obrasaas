import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildFieldWorkerMenu, fieldWorkerMenuOptions } from '../src/lib/whatsapp/field-worker-menu.js';
import { FIELD_WORKER_WHATSAPP_ROLES, canFieldWorkerHandleIntent } from '../src/lib/field-workers.js';
for(const role of FIELD_WORKER_WHATSAPP_ROLES)test('menu only advertises intents allowed for '+role,()=>{
  const options=fieldWorkerMenuOptions(role);assert.ok(options.length>0);
  assert.ok(options.every(item=>canFieldWorkerHandleIntent(role,item.intent)));
  const reply=buildFieldWorkerMenu({role,projectName:'Obra Norte'});assert.ok(reply.startsWith('Obra: Obra Norte'));
  assert.ok(!reply.includes('Transferir dinero'));assert.ok(!reply.includes('Adjudicar'));
});
test('safety role does not see a progress command and worker does not see foreman delay controls',()=>{
  assert.ok(!fieldWorkerMenuOptions('SAFETY').some(item=>item.key==='PROGRESS'));
  assert.ok(!fieldWorkerMenuOptions('WORKER').some(item=>item.key==='DELAY'));
  assert.ok(fieldWorkerMenuOptions('FOREMAN').some(item=>item.key==='DELAY'));
});
test('unknown roles do not get a fallback administrative menu',()=>{
  for(const role of ['ADMIN','ROOT','UNKNOWN',null,undefined]){
    assert.deepEqual(fieldWorkerMenuOptions(role),[]);
    assert.match(buildFieldWorkerMenu({role,projectName:'Obra secreta'}),/necesita autorización/);
    assert.ok(!buildFieldWorkerMenu({role,projectName:'Obra secreta'}).includes('Obra secreta'));
  }
});
test('worksite label is bounded plain text and does not copy worker telephone or personal attributes',()=>{
  const reply=buildFieldWorkerMenu({role:'WORKER',projectName:'*Norte*\n\r__Sitio__',phone:'private-phone',personId:'private-person'});
  assert.ok(reply.startsWith('Obra: Norte'));assert.ok(!reply.includes('private-'));
  const long=buildFieldWorkerMenu({role:'WORKER',projectName:'x'.repeat(8000)});assert.ok(long.length<2000);
});
test('engine HELP reply uses this menu after its existing worker and intent authorization',()=>{
  const source=readFileSync(new URL('../src/lib/whatsapp/obra-engine.js',import.meta.url),'utf8');
  const point=source.indexOf('reply = buildFieldWorkerMenu(');
  assert.ok(point>source.indexOf('const worker = trustedWorker'));
  assert.ok(point>source.indexOf('canFieldWorkerHandleIntent(worker.whatsappRole, intent)'));
});
test('real message engine answers help in each worksite without applying a business mutation',async()=>{
  const {tsImport}=await import('tsx/esm/api');
  const {processIncomingObraMessage}=await tsImport('../src/lib/whatsapp/obra-engine.js',{parentURL:import.meta.url,tsconfig:'./jsconfig.json'});
  const outcomes=[];
  for(const [projectId,role] of [['worksite-a','WORKER'],['worksite-b','SAFETY'],['worksite-c','FOREMAN']]){
    const state={attendance:{},incidents:[],tasks:{},alertsCount:0,operariosCount:0};
    const result=await processIncomingObraMessage({provider:'meta',externalId:'help-'+projectId,from:'+5491112345678',kind:'text',text:'menú',timestamp:new Date('2026-09-19T12:00:00Z')},
      {organizationId:'org-'+projectId,projectId},{persist:false,state,projectSettings:{id:projectId,organizationId:'org-'+projectId,name:projectId,timezone:'America/Argentina/Buenos_Aires'},
        worker:{id:'worker-'+projectId,projectId,name:'Participante de ensayo',active:true,metadata:{whatsappRole:role}}});
    assert.equal(result.intent,'HELP');assert.equal(result.stateChanged,false);assert.equal(result.reply,buildFieldWorkerMenu({role,projectName:projectId}));
    assert.equal(result.newMessages[1].text,result.reply);assert.deepEqual(state.attendance,{});assert.deepEqual(state.incidents,[]);outcomes.push(result.reply);
  }
  assert.ok(outcomes[0].includes('Informar avance'));assert.ok(!outcomes[1].includes('Informar avance'));assert.ok(outcomes[2].includes('Informar una demora'));
});
