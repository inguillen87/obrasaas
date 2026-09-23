import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { registerHooks } from 'node:module';
import { mkdirSync,writeFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { executionTestConnection } from './lib/execution-test-database.mjs';
const connectionString=executionTestConnection();
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('@/'))return next(new URL('../src/'+specifier.slice(2)+(/\.(js|ts|mjs)$/.test(specifier)?'':specifier.startsWith('@/generated/')?'.ts':'.js'),import.meta.url).href,context);return next(specifier,context);}});
const {getAssignmentReschedule,reviewAssignmentReschedule,commitAssignmentReschedule}=await import('../src/lib/assignment-reschedule.js');
const {rescheduleReceiptMatches}=await import('../src/lib/assignment-reschedule-policy.js');
const names=['replan-ci-a','replan-ci-b'];
const clients=names.map(application_name=>new PrismaClient({adapter:new PrismaPg({connectionString,application_name,max:2})}));
const [db,other]=clients,monitor=new pg.Pool({connectionString,max:2,statement_timeout:10000});
const prefix='replan_'+randomUUID().replaceAll('-',''),id=name=>prefix+'_'+name;
const scope={organizationId:id('org'),projectId:id('project')},actorId=id('actor'),assignmentId=id('assignment'),taskId=id('task'),workerId=id('worker');
const base={scope,assignmentId,actorId},iso=day=>new Date('2026-10-'+String(day).padStart(2,'0')+'T00:00:00.000Z');
const report={status:'RUNNING',environment:'disposable-postgresql-17',cases:[],providerVerified:false,productionDeployed:false};
async function check(name,run){try{await run();report.cases.push({name,status:'PASS'});console.log('PASS '+name);}catch(error){report.cases.push({name,status:'FAIL',code:error.code||error.name});throw error;}}
async function prepare(start,end,client=db){const snapshot=await getAssignmentReschedule(client,base);const raw={expectedRevision:snapshot.assignment.revision,startsOn:start,endsOn:end};const review=await reviewAssignmentReschedule(client,{...base,input:raw});return {snapshot,review,input:{...raw,reviewVersion:review.version,confirmed:true,note:'Se coordina el frente antes de iniciar.'}};}
let originalTask;
try{
 await check('empty loopback database and scoped fixtures',async()=>{
  assert.equal(await db.organization.count(),0);assert.equal((await monitor.query('SHOW server_version_num')).rows[0].server_version_num.slice(0,2),'17');
  await db.platformUser.create({data:{id:actorId,clerkUserId:id('clerk'),primaryEmail:id('mail')+'@invalid.example',fullName:'Actor sintético'}});
  for(const suffix of ['','_other']){
   await db.organization.create({data:{id:scope.organizationId+suffix,name:'Empresa de ensayo',slug:id('slug')+suffix,subscriptionPlan:'ENTERPRISE',subscriptionStatus:'ACTIVE'}});
   await db.project.create({data:{id:scope.projectId+suffix,organizationId:scope.organizationId+suffix,name:'Obra de ensayo',slug:id('work')+suffix,status:'ACTIVE'}});
  }
  await db.worker.create({data:{id:workerId,...scope,name:'Persona de ensayo',active:true}});
  for(const suffix of ['','_other'])await db.task.create({data:{id:taskId+suffix,projectId:scope.projectId,title:'Actividad de ensayo'+suffix,type:'TASK',metadata:{source:'canonical-task-v1'},progress:10,startsAt:iso(1),endsAt:iso(3)}});
  for(const suffix of ['','_other'])await db.taskAssignment.create({data:{id:assignmentId+suffix,projectId:scope.projectId,taskId:taskId+suffix,workerId,status:'PLANNED',startsAt:iso(suffix?6:1),endsAt:iso(suffix?8:3)}});
  originalTask=await db.task.findUniqueOrThrow({where:{id:taskId}});
 });
 await check('read and review exclude the edited assignment without writing',async()=>{
  const value=await prepare('2026-10-02','2026-10-07');
  assert.equal(value.review.overlap.summary.overlaps,1);assert.equal(value.review.overlap.totalFindings,1);
  assert.equal(value.review.overlap.findings[0].assignmentId,assignmentId+'_other');
  assert.equal(await db.auditLog.count(),0);assert.equal((await db.taskAssignment.findUniqueOrThrow({where:{id:assignmentId}})).revision,0);
 });
 await check('date change preserves identity, responsibility, task and audited before/after',async()=>{
  const value=await prepare('2026-10-02','2026-10-07'),saved=await commitAssignmentReschedule(db,{...base,input:value.input});
  assert.equal(saved.assignment.id,assignmentId);assert.equal(saved.assignment.workerId,workerId);assert.equal(saved.assignment.status,'PLANNED');assert.equal(saved.assignment.revision,1);
  assert.equal(saved.lastReschedule.previousStartsAt,iso(1).toISOString());assert.equal(saved.lastReschedule.previousEndsAt,iso(3).toISOString());
  assert.equal(rescheduleReceiptMatches(saved,value.snapshot,value.input,scope),true);
  const recovered=await getAssignmentReschedule(other,base);assert.equal(rescheduleReceiptMatches(recovered,value.snapshot,value.input,scope),true);
  await assert.rejects(commitAssignmentReschedule(other,{...base,input:value.input}),{code:'ASSIGNMENT_REPLAN_STALE'});
  assert.equal(await db.auditLog.count({where:{action:'execution.task.assignment.rescheduled',entityId:assignmentId}}),1);
  assert.deepEqual(await db.task.findUniqueOrThrow({where:{id:taskId}}),originalTask);
 });
 await check('two competing revisions commit only one date change',async()=>{
  const value=await prepare('2026-10-10','2026-10-12');
  const gate=await monitor.connect();await gate.query('BEGIN');await gate.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[scope.projectId]);
  let pending,waiters=0;
  try{
   pending=Promise.allSettled(clients.map(client=>commitAssignmentReschedule(client,{...base,input:value.input})));
   const until=Date.now()+2500;
   while(Date.now()<until){const q=await monitor.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name=ANY($1::text[]) AND wait_event_type='Lock' AND wait_event='advisory'",[names]);waiters=q.rows[0].n;if(waiters===2)break;await pause(25);}
  }finally{await gate.query('ROLLBACK');gate.release();}
  const results=await pending;assert.equal(waiters,2);report.concurrentLockWaiters=waiters;
  assert.equal(results.filter(row=>row.status==='fulfilled').length,1);assert.equal(results.find(row=>row.status==='rejected').reason.code,'ASSIGNMENT_REPLAN_STALE');
  assert.equal((await getAssignmentReschedule(db,base)).assignment.revision,2);
 });
 await check('a changed competing assignment invalidates a previously reviewed proposal',async()=>{
  const value=await prepare('2026-10-06','2026-10-09');
  await other.taskAssignment.update({where:{id:assignmentId+'_other'},data:{revision:{increment:1},status:'CANCELLED'}});
  await assert.rejects(commitAssignmentReschedule(db,{...base,input:value.input}),{code:'ASSIGNMENT_REPLAN_REVIEW_CHANGED'});
  assert.equal((await getAssignmentReschedule(db,base)).assignment.startsAt,iso(10).toISOString());
 });
 await check('audit FK rejection rolls back the date update',async()=>{
  const value=await prepare('2026-10-20','2026-10-22');
  await assert.rejects(commitAssignmentReschedule(db,{...base,actorId:id('missing_actor'),input:value.input}),{code:'P2003'});
  const saved=await getAssignmentReschedule(db,base);assert.equal(saved.assignment.revision,2);assert.equal(saved.assignment.startsAt,iso(10).toISOString());
 });
 await check('another tenant cannot read, review or mutate this assignment',async()=>{
  const alien={organizationId:scope.organizationId+'_other',projectId:scope.projectId+'_other'};
  for(const run of [()=>getAssignmentReschedule(db,{...base,scope:alien}),()=>reviewAssignmentReschedule(db,{...base,scope:alien,input:{expectedRevision:2,startsOn:'2026-10-20',endsOn:'2026-10-22'}})])await assert.rejects(run(),{code:'ASSIGNMENT_NOT_FOUND'});
 });
 await check('no-op, invalid dates and active work cannot be rewritten',async()=>{
  await assert.rejects(reviewAssignmentReschedule(db,{...base,input:{expectedRevision:2,startsOn:'2026-10-10',endsOn:'2026-10-12'}}),{code:'ASSIGNMENT_REPLAN_UNCHANGED'});
  await other.taskAssignment.update({where:{id:assignmentId},data:{status:'ACTIVE',revision:{increment:1}}});
  const saved=await getAssignmentReschedule(db,base);assert.equal(saved.writable,false);
  await assert.rejects(reviewAssignmentReschedule(db,{...base,input:{expectedRevision:3,startsOn:'2026-10-20',endsOn:'2026-10-22'}}),{code:'ASSIGNMENT_REPLAN_UNAVAILABLE'});
  assert.deepEqual(await db.task.findUniqueOrThrow({where:{id:taskId}}),originalTask);
 });
 report.status='PASS';
}catch(error){report.status='FAIL';report.failure={code:error.code||error.name,message:String(error.message).slice(0,1200)};console.error(report.failure);process.exitCode=1;}
finally{const output=path.resolve(process.env.REPLAN_PROOF_PATH||'.vercel/assignment-reschedule-postgres.json');mkdirSync(path.dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2));await Promise.allSettled(clients.map(client=>client.$disconnect()));await monitor.end();console.log(JSON.stringify(report));}
