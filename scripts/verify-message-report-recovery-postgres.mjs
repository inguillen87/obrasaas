import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { executionTestConnection } from './lib/execution-test-database.mjs';
import { prepareWhatsAppProgressReport, createWhatsAppProgressReport } from '../src/lib/whatsapp/progress-report.js';
import { messageReportSourceId, messageReportFingerprint, messageReportPreparationMatches, confirmedMessageReport } from '../src/lib/whatsapp/progress-report-policy.js';
const db=new PrismaClient({adapter:new PrismaPg({connectionString:executionTestConnection()})});
const scope={organizationId:'report-org-a',projectId:'report-project-a'};
const context={scope,actorId:'report-actor-a',conversationId:'report-conversation-a',messageId:'report-message-a'};
const report={status:'RUNNING',environment:'loopback-disposable-postgresql',cases:[],providerCalls:0};
const read=(c=context)=>prepareWhatsAppProgressReport(db,c);
const snapshot=async()=>JSON.stringify({logs:await db.dailyLog.findMany({orderBy:{id:'asc'}}),audits:await db.auditLog.findMany({orderBy:{id:'asc'}}),messages:await db.message.findMany({orderBy:{id:'asc'}}),tasks:await db.task.findMany({orderBy:{id:'asc'}})});
async function check(name,fn){await fn();report.cases.push({name,status:'PASS'});console.log('PASS '+name);}
async function prepared(c=context){const p=await read(c);const input={taskId:'report-task-a',title:'Material pendiente',summary:'Verificar material antes de continuar.',sourceVersion:p.source.version};return{...c,input,operationKey:'report-sql-operation-00001',expected:{...c.scope,conversationId:c.conversationId,messageId:c.messageId,reportId:await messageReportSourceId({...c.scope,conversationId:c.conversationId,messageId:c.messageId}),taskId:input.taskId,sourceVersion:input.sourceVersion,requestFingerprint:await messageReportFingerprint(input)}};}
let request,created;
try{
 await check('guarded empty database and exact synthetic source',async()=>{
  assert.equal(await db.organization.count(),0);
  for(const suffix of ['a','b']){
   await db.organization.create({data:{id:'report-org-'+suffix,name:'Empresa de ensayo',slug:'report-org-'+suffix,timezone:'America/Argentina/Buenos_Aires',subscriptionPlan:'ENTERPRISE',subscriptionStatus:'ACTIVE'}});
   await db.project.create({data:{id:'report-project-'+suffix,organizationId:'report-org-'+suffix,name:'Obra de ensayo',slug:'report-project-'+suffix,status:'ACTIVE'}});
   await db.platformUser.create({data:{id:'report-actor-'+suffix,clerkUserId:'synthetic_report_actor_'+suffix,primaryEmail:'report-'+suffix+'@example.invalid'}});
  }
  await db.worker.create({data:{id:'report-worker-a',...scope,name:'Trabajador de ensayo',active:true}});
  await db.task.create({data:{id:'report-task-a',projectId:scope.projectId,title:'Mampostería',type:'TASK',metadata:{source:'canonical-task-v1'}}});
  await db.conversation.create({data:{id:context.conversationId,projectId:scope.projectId,channel:'whatsapp',externalId:'meta:5491111111111',displayName:'Contacto sintético'}});
  await db.message.create({data:{id:context.messageId,conversationId:context.conversationId,externalId:'wamid.report.source.synthetic',direction:'INBOUND',kind:'TEXT',body:'Falta material en el sector norte.',sentAt:new Date('2026-09-24T12:00:00Z'),metadata:{provider:'meta',authorized:true,workerId:'report-worker-a'}}});
 });
 await check('prepare has deterministic identity and zero writes',async()=>{const before=await snapshot();request=await prepared();const p=await read();assert.equal(messageReportPreparationMatches(p,request.expected),true);assert.equal(p.existing,null);assert.equal(await snapshot(),before);});
 await check('commit binds actual record, source version and normalized fingerprint',async()=>{created=await createWhatsAppProgressReport(db,request);assert.equal(confirmedMessageReport(created,request.expected).id,request.expected.reportId);assert.equal(created.report.status,'DRAFT');assert.equal(await db.dailyLog.count(),1);assert.equal(await db.auditLog.count(),1);});
 await check('lost result recovers only by read of persisted audit without writes',async()=>{const before=await snapshot(),p=await read();const recovered=confirmedMessageReport({context:p.context,...p.existingReceipt,report:p.existing,replayed:true},request.expected);assert.equal(recovered.id,created.report.id);assert.equal(await snapshot(),before);});
 await check('identical replay by another operator preserves one record and one audit',async()=>{const before=await snapshot(),result=await createWhatsAppProgressReport(db,{...request,actorId:'report-actor-b',operationKey:'another-operator-key-0001'});assert.equal(result.replayed,true);assert.equal(result.report.id,created.report.id);assert.equal(await snapshot(),before);});
 await check('two parallel requests create exactly one report and one source audit',async()=>{
  const original=await db.message.findUniqueOrThrow({where:{id:context.messageId}});const id='report-message-concurrent';await db.message.create({data:{...original,id,externalId:'wamid.report.concurrent.synthetic'}});const c=await prepared({...context,messageId:id});const before=await db.auditLog.count();
  const results=await Promise.all([createWhatsAppProgressReport(db,{...c,operationKey:'concurrent-first-000001'}),createWhatsAppProgressReport(db,{...c,actorId:'report-actor-b',operationKey:'concurrent-second-000001'})]);
  assert.equal(new Set(results.map(r=>r.report.id)).size,1);assert.equal(results.filter(r=>!r.replayed).length,1);assert.equal(await db.auditLog.count(),before+1);
 });
 await check('changed normalized content cannot replace existing report',async()=>{const before=await snapshot();await assert.rejects(createWhatsAppProgressReport(db,{...request,input:{...request.input,summary:'Otro contenido'}}),{code:'WHATSAPP_REPORT_ALREADY_USED'});assert.equal(await snapshot(),before);});
 await check('foreign tenant project message and conversation denied without writes',async()=>{
  const before=await snapshot();for(const patch of [{scope:{...scope,organizationId:'report-org-b'}},{scope:{...scope,projectId:'report-project-b'}},{conversationId:'missing'},{messageId:'missing'}])await assert.rejects(read({...context,...patch}),{code:'WHATSAPP_REPORT_NOT_FOUND'});assert.equal(await snapshot(),before);
 });
 await check('source change preserves original read receipt and rejects stale writes',async()=>{
  await db.message.update({where:{id:context.messageId},data:{body:'Nuevo texto operativo que requiere revisión.'}});const before=await snapshot(),p=await read();assert.notEqual(p.source.version,request.input.sourceVersion);assert.equal(p.existingReceipt.sourceVersion,request.input.sourceVersion);
  assert.equal(confirmedMessageReport({context:p.context,...p.existingReceipt,report:p.existing,replayed:true},request.expected).id,created.report.id);
  await assert.rejects(createWhatsAppProgressReport(db,request),{code:'WHATSAPP_REPORT_SOURCE_CHANGED'});assert.equal(await snapshot(),before);
 });
 await check('audit failure rolls back report creation atomically',async()=>{
  const original=await db.message.findUniqueOrThrow({where:{id:context.messageId}});const id='report-message-rollback';await db.message.create({data:{...original,id,externalId:'wamid.report.rollback.synthetic'}});const c=await prepared({...context,messageId:id});const before=await snapshot();
  await assert.rejects(createWhatsAppProgressReport(db,{...c,actorId:'missing-actor'}),e=>['P2003','23503'].includes(e.code));assert.equal(await snapshot(),before);assert.equal(await db.dailyLog.count({where:{id:c.expected.reportId}}),0);
 });
 await check('orphan record fails closed and does not acquire an inferred audit',async()=>{
  const original=await db.message.findUniqueOrThrow({where:{id:context.messageId}});const id='report-message-orphan';await db.message.create({data:{...original,id,externalId:'wamid.report.orphan.synthetic'}});const c=await prepared({...context,messageId:id});
  await db.dailyLog.create({data:{id:c.expected.reportId,projectId:scope.projectId,taskId:'report-task-a',authorWorkerId:'report-worker-a',workDate:new Date('2026-09-24'),title:'Parte sin recibo de ensayo',summary:'No debe vincularse automáticamente.'}});
  const before=await snapshot();await assert.rejects(read({...context,messageId:id}),{code:'WHATSAPP_REPORT_INTEGRITY'});assert.equal(await snapshot(),before);
 });
 await check('no messaging channel or provider required for report workflow',async()=>{assert.equal(await db.whatsAppConnection.count(),0);assert.equal((await db.task.findUniqueOrThrow({where:{id:'report-task-a'}})).revision,0);});
 report.status='PASS';
}catch(error){report.status='FAIL';report.error={code:error.code||error.name,message:String(error.message).slice(0,1600)};process.exitCode=1;}
finally{mkdirSync('evidence',{recursive:true});writeFileSync('evidence/message-report-recovery-postgres.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await db.$disconnect();}
