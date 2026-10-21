import test from 'node:test';
import assert from 'node:assert/strict';
import {employeeIntakeFixture} from './fixtures/employee-intake-memory.mjs';

async function registeredParticipant() {
 const f=employeeIntakeFixture(),application=await f.submit();
 const admitted=await f.store.save(f.session,f.command('ADMIT_EMPLOYEE_INTAKE',{applicationId:application.applicationId,expectedRevision:application.revision,job:'WORKER',permissions:{attendance:false,report:false},confirmed:true}));
 const worker=f.workers.get(admitted.workerId);
 await f.store.save(f.session,f.command('ASSIGN_EXISTING',{workerId:worker.id,revision:worker.revision,membershipId:'person-member',reason:'Asignación sintética revisada'}));
 return {f,worker};
}
const choice=(menu,index)=>({type:'interactive',interactive:{list_reply:{id:menu.sections[0].rows[index].id}}});

for(const index of [0,1])test('registered participant chooses guidance '+index+' through the delivered menu without opening identity or granting access',async()=>{
 const {f,worker}=await registeredParticipant(),before=structuredClone(worker),auditBefore=structuredClone([...f.audits]),providers=f.controls.providerCalls;
 const menu=(await f.execute('HOLA')).result.reply;
 assert.equal(menu.type,'interactive');assert.equal(menu.sections[0].rows.length,2);
 const result=(await f.execute(choice(menu,index))).result;
 assert.equal(result.businessApplied,false);assert.equal(result.reply.type,'text');
 if(index===0){assert.match(result.reply.body,/https:\/\/obrasaas\.com\/cuenta\n/);assert.doesNotMatch(result.reply.body,/IDENTIDAD|dni|selfie/i);}
 else {assert.match(result.reply.body,/cuenta\?seccion=identidad#participant-title/);assert.match(result.reply.body,/mensaje IDENTIDAD vigente/);assert.match(result.reply.body,/Esperá las indicaciones antes de enviar documentos/);assert.match(result.reply.body,/no habilita permisos/);}
 assert.doesNotMatch(result.reply.body,/(?:IDENTIDAD|VINCULAR) [A-Za-z0-9_-]{43}/);
 assert.deepEqual(worker,before);assert.deepEqual([...f.audits],auditBefore);assert.equal(f.controls.providerCalls,providers);
 assert.equal(f.state().step,'ADMITTED');assert.equal(f.state().nonce,undefined);assert.equal(f.state().choices,undefined);
});

for(const kind of ['no-context','wrong-context','stale-choice','invalid-choice','plain-text'])test('registered guidance rejects '+kind+' and returns a fresh menu without changing participation',async()=>{
 const {f,worker}=await registeredParticipant(),before=structuredClone(worker),audits=structuredClone([...f.audits]),providers=f.controls.providerCalls;
 const menu=(await f.execute('HOLA')).result.reply;
 let message=choice(menu,1),options;
 if(kind==='no-context')options={reply:false};
 if(kind==='wrong-context')message={...message,context:{id:'wamid.UnrelatedPrompt'}};
 if(kind==='stale-choice')await f.execute('AYUDA');
 if(kind==='invalid-choice')message.interactive.list_reply.id=message.interactive.list_reply.id.replace(/:1$/,':99');
 if(kind==='plain-text')message='Consultar identidad';
 const result=(await f.execute(message,options)).result;
 assert.equal(result.businessApplied,false);assert.equal(result.reply.type,'interactive');assert.equal(result.reply.sections[0].rows.length,2);
 assert.notEqual(result.reply.sections[0].rows[0].id,menu.sections[0].rows[0].id);
 assert.deepEqual(worker,before);assert.deepEqual([...f.audits],audits);assert.equal(f.controls.providerCalls,providers);
 assert.equal(f.state().step,'ADMITTED');
});
