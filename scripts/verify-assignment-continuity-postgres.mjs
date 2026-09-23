import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { registerHooks } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { executionTestConnection } from './lib/execution-test-database.mjs';
const connectionString=executionTestConnection();
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('@/'))return next(new URL('../src/'+specifier.slice(2)+(/\.(js|ts|mjs)$/.test(specifier)?'':specifier.startsWith('@/generated/')?'.ts':'.js'),import.meta.url).href,context);return next(specifier,context);}});
const {getAssignmentReschedule,reviewAssignmentReschedule,commitAssignmentReschedule}=await import('../src/lib/assignment-reschedule.js');
const {reviewTaskAssignment,planReviewedTaskAssignment}=await import('../src/lib/assignment-overlap-review.js');
const {decideTaskAssignment}=await import('../src/lib/task-assignments.js');
const {confirmAssignmentPlan,normalizeAssignmentPlan}=await import('../src/lib/task-assignment-policy.js');
const names=['continuity-ci-a','continuity-ci-b'];
const clients=names.map(application_name=>new PrismaClient({adapter:new PrismaPg({connectionString,application_name,max:2})}));
const [db,other]=clients,monitor=new pg.Pool({connectionString,max:2,statement_timeout:10000});
const prefix='continuity_'+randomUUID().replaceAll('-',''),id=name=>prefix+'_'+name;
const scope={organizationId:id('org'),projectId:id('project')},actorId=id('actor'),taskId=id('task'),workerId=id('worker');
const report={status:'RUNNING',environment:'disposable-postgresql-17',cases:[],providerVerified:false,productionDeployed:false};
const date=day=>new Date(day+'T00:00:00.000Z');
let originalTask,originalRequest,originalId,peerId;
async function check(name,run){try{await run();report.cases.push({name,status:'PASS'});console.log('PASS '+name);}catch(error){report.cases.push({name,status:'FAIL',code:error.code||error.name});throw error;}}
async function planInput(startsOn,endsOn,key,ownerKind='WORKER'){
 const raw={taskId,expectedTaskRevision:0,ownerKind,ownerId:ownerKind==='WORKER'?workerId:id('team'),startsOn,endsOn};
 const review=await reviewTaskAssignment(db,{scope,input:raw});
 return {scope,actorId,operationKey:key,input:{...raw,review:{version:review.version,acknowledged:true,reason:review.warnings?'Coordinación explícita del ensayo PostgreSQL.':''}}};
}
async function replanInput(assignmentId,startsOn,endsOn){
 const base={scope,actorId,assignmentId},snapshot=await getAssignmentReschedule(db,base);
 const raw={expectedRevision:snapshot.assignment.revision,startsOn,endsOn},review=await reviewAssignmentReschedule(db,{...base,input:raw});
 return {...base,input:{...raw,reviewVersion:review.version,confirmed:true,note:'Reprogramación coordinada de la prueba SQL.'}};
}
async function contend(operations){
 const gate=await monitor.connect();await gate.query('BEGIN');await gate.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[scope.projectId]);
 let pending,waiters=0;
 try{
  pending=Promise.allSettled(operations.map((operation,index)=>operation(clients[index])));
  const until=Date.now()+2500;
  while(Date.now()<until){const q=await monitor.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name=ANY($1::text[]) AND wait_event_type='Lock' AND wait_event='advisory'",[names]);waiters=q.rows[0].n;if(waiters===2)break;await pause(25);}
 }finally{await gate.query('ROLLBACK');gate.release();}
 const results=await pending;assert.equal(waiters,2);assert.equal(results.filter(row=>row.status==='fulfilled').length,1);
 assert.equal(results.find(row=>row.status==='rejected').reason.code,'ASSIGNMENT_DUPLICATE');
 report.concurrentLockWaiters=waiters;return results;
}
try{
 await check('empty named loopback database and synthetic scoped records',async()=>{
  assert.equal(await db.organization.count(),0);assert.equal((await monitor.query('SHOW server_version_num')).rows[0].server_version_num.slice(0,2),'17');
  await db.platformUser.create({data:{id:actorId,clerkUserId:id('clerk'),primaryEmail:id('mail')+'@invalid.example',fullName:'Actor sintético SQL'}});
  for(const suffix of ['','_other']){
   await db.organization.create({data:{id:scope.organizationId+suffix,name:'Empresa de ensayo',slug:id('slug')+suffix,subscriptionPlan:'ENTERPRISE',subscriptionStatus:'ACTIVE'}});
   await db.project.create({data:{id:scope.projectId+suffix,organizationId:scope.organizationId+suffix,name:'Obra de ensayo',slug:id('work')+suffix,status:'ACTIVE'}});
  }
  await db.worker.create({data:{id:workerId,...scope,name:'Persona de ensayo',active:true}});
  await db.workTeam.create({data:{id:id('team'),projectId:scope.projectId,name:'Cuadrilla de ensayo',status:'ACTIVE'}});
  await db.task.create({data:{id:taskId,projectId:scope.projectId,title:'Actividad de ensayo',type:'TASK',metadata:{source:'canonical-task-v1'},progress:10,startsAt:date('2026-11-01'),endsAt:date('2026-11-03')}});
  originalTask=await db.task.findUniqueOrThrow({where:{id:taskId}});
 });
 await check('reviewed creation replay survives a committed date change without restoring old dates',async()=>{
  originalRequest=await planInput('2026-11-01','2026-11-03','continuity-sql-original');
  originalId=(await planReviewedTaskAssignment(db,originalRequest)).assignment.id;
  await commitAssignmentReschedule(db,await replanInput(originalId,'2026-11-10','2026-11-12'));
  const replay=await planReviewedTaskAssignment(other,originalRequest),{review:_review,...raw}=originalRequest.input;
  const confirmed=confirmAssignmentPlan(replay,normalizeAssignmentPlan(raw),scope);
  assert.equal(confirmed.id,originalId);assert.equal(confirmed.startsAt,date('2026-11-10').toISOString());assert.equal(confirmed.revision,1);
  assert.equal(await db.taskAssignment.count(),1);assert.equal(await db.auditLog.count(),2);
 });
 await check('an exact unfinished duplicate is rejected by the review endpoint',async()=>{
  peerId=(await planReviewedTaskAssignment(db,await planInput('2026-11-15','2026-11-17','continuity-sql-peer'))).assignment.id;
  await assert.rejects(replanInput(originalId,'2026-11-15','2026-11-17'),{code:'ASSIGNMENT_DUPLICATE'});
  assert.equal((await getAssignmentReschedule(db,{scope,assignmentId:originalId})).assignment.revision,1);
 });
 await check('an exact duplicate appearing after review rejects commit with no date or audit update',async()=>{
  const command=await replanInput(originalId,'2026-11-20','2026-11-22');
  await planReviewedTaskAssignment(other,await planInput('2026-11-20','2026-11-22','continuity-sql-later'));
  const before=await db.auditLog.count();await assert.rejects(commitAssignmentReschedule(db,command),{code:'ASSIGNMENT_DUPLICATE'});
  assert.equal(await db.auditLog.count(),before);assert.equal((await getAssignmentReschedule(db,{scope,assignmentId:originalId})).assignment.revision,1);
 });
 await check('creation and reprogramming contend for the same period and only one wins',async()=>{
  const create=await planInput('2026-12-10','2026-12-12','continuity-sql-race'),change=await replanInput(originalId,'2026-12-10','2026-12-12');
  const audits=await db.auditLog.count();await contend([client=>planReviewedTaskAssignment(client,create),client=>commitAssignmentReschedule(client,change)]);
  assert.equal(await db.taskAssignment.count({where:{projectId:scope.projectId,taskId,workerId,startsAt:date('2026-12-10'),endsAt:date('2026-12-12'),status:{in:['PLANNED','ACTIVE']}}}),1);
  assert.equal(await db.auditLog.count(),audits+1);
 });
 await check('two different assignments cannot concurrently move into an identical period',async()=>{
  const commands=await Promise.all([replanInput(originalId,'2027-01-05','2027-01-07'),replanInput(peerId,'2027-01-05','2027-01-07')]);
  const rows=await db.taskAssignment.count(),audits=await db.auditLog.count();
  await contend(commands.map(command=>client=>commitAssignmentReschedule(client,command)));
  assert.equal(await db.taskAssignment.count(),rows);assert.equal(await db.auditLog.count(),audits+1);
  assert.equal(await db.taskAssignment.count({where:{projectId:scope.projectId,taskId,workerId,startsAt:date('2027-01-05'),endsAt:date('2027-01-07'),status:{in:['PLANNED','ACTIVE']}}}),1);
 });
 await check('audit rejection rolls back a unique date change',async()=>{
  const command=await replanInput(originalId,'2027-02-01','2027-02-03'),before=await db.taskAssignment.findUniqueOrThrow({where:{id:originalId}});
  await assert.rejects(commitAssignmentReschedule(db,{...command,actorId:id('missing_actor')}),{code:'P2003'});
  assert.deepEqual(await db.taskAssignment.findUniqueOrThrow({where:{id:originalId}}),before);
 });
 await check('another tenant cannot read or reprogram the protected assignment',async()=>{
  const alien={organizationId:scope.organizationId+'_other',projectId:scope.projectId+'_other'},base={scope:alien,actorId,assignmentId:originalId};
  await assert.rejects(getAssignmentReschedule(db,base),{code:'ASSIGNMENT_NOT_FOUND'});
  await assert.rejects(reviewAssignmentReschedule(db,{...base,input:{expectedRevision:0,startsOn:'2027-03-01',endsOn:'2027-03-03'}}),{code:'ASSIGNMENT_NOT_FOUND'});
  const command=await replanInput(originalId,'2027-03-01','2027-03-03');
  await assert.rejects(commitAssignmentReschedule(db,{...command,scope:alien}),{code:'ASSIGNMENT_NOT_FOUND'});
 });
 await check('historical cancelled work does not block an explicit new period',async()=>{
  const winner=await db.taskAssignment.findFirstOrThrow({where:{projectId:scope.projectId,startsAt:date('2027-01-05')}});
  await decideTaskAssignment(db,{scope,actorId,assignmentId:winner.id,input:{expectedRevision:winner.revision,status:'CANCELLED',note:'Final de la comparación de períodos del ensayo.'}});
  const target=winner.id===originalId?peerId:originalId;
  const saved=await commitAssignmentReschedule(db,await replanInput(target,'2027-01-05','2027-01-07'));
  assert.equal(saved.assignment.status,'PLANNED');assert.equal(saved.assignment.startsAt,date('2027-01-05').toISOString());
 });
 await check('team assignments with null periods use the same rule without touching task progress',async()=>{
  const a=await planReviewedTaskAssignment(db,await planInput('2027-04-01','2027-04-03','continuity-team-dated','TEAM'));
  await planReviewedTaskAssignment(db,await planInput('','','continuity-team-undated','TEAM'));
  await assert.rejects(replanInput(a.assignment.id,'',''),{code:'ASSIGNMENT_DUPLICATE'});
  assert.deepEqual(await db.task.findUniqueOrThrow({where:{id:taskId}}),originalTask);
 });
 report.status='PASS';
}catch(error){report.status='FAIL';report.failure={code:error.code||error.name,message:String(error.message).slice(0,1000)};console.error(report.failure);process.exitCode=1;}
finally{const output=path.resolve(process.env.CONTINUITY_PROOF_PATH||'evidence/assignment-continuity-postgres.json');mkdirSync(path.dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2));await Promise.allSettled(clients.map(client=>client.$disconnect()));await monitor.end();console.log(JSON.stringify(report));}
