import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareTaskAssignment,planTaskAssignment,getTaskAssignment,decideTaskAssignment } from '../src/lib/task-assignments.js';
import { normalizeAssignmentPlan,normalizeAssignmentDecision,confirmAssignmentPlan } from '../src/lib/task-assignment-policy.js';
import { createExecutionRecord } from '../src/lib/project-execution.js';
const scope={organizationId:'org-a',projectId:'project-a'},actorId='manager-a';
const input={taskId:'task-a',expectedTaskRevision:3,ownerKind:'WORKER',ownerId:'worker-a',startsOn:'2026-09-21',endsOn:'2026-09-25'};
function database(){
  const state={projectStatus:'ACTIVE',organization:{id:'org-a',subscriptionPlan:'ENTERPRISE',subscriptionStatus:'ACTIVE'},task:{id:'task-a',title:'Mampostería',revision:3,type:'TASK'},owner:true,team:true,rows:[],audits:[],failAudit:false,workerCount:1};
  const comparable=value=>value instanceof Date?value.toISOString():value;
  const match=(row,where)=>Object.entries(where).every(([key,value])=>key==='metadata'?row.metadata?.[value.path[0]]===value.equals:value&&typeof value==='object'&&value.in?value.in.includes(row[key]):comparable(row[key])===comparable(value));
  const tx={
    $executeRawUnsafe:async()=>1,
    project:{findFirst:async({where})=>where.id===scope.projectId&&where.organizationId===scope.organizationId?{id:scope.projectId,status:state.projectStatus,organization:state.organization}:null},
    task:{findFirst:async({where})=>state.task&&where.id==='task-a'&&where.projectId===scope.projectId&&where.metadata.equals==='canonical-task-v1'&&(!where.type||where.type===state.task.type)?structuredClone(state.task):null},
    worker:{findFirst:async({where})=>state.owner&&where.id==='worker-a'&&where.projectId===scope.projectId&&where.active?{id:'worker-a'}:null,
      findMany:async options=>{assert.equal(options.where.projectId,scope.projectId);assert.equal(options.take,101);return Array.from({length:state.workerCount},(_,i)=>({id:i?'worker-'+i:'worker-a',name:'Persona '+i}));}},
    workTeam:{findFirst:async({where})=>state.team&&where.id==='team-a'&&where.projectId===scope.projectId&&where.status==='ACTIVE'?{id:'team-a'}:null,
      findMany:async options=>{assert.equal(options.where.projectId,scope.projectId);assert.equal(options.take,101);return state.team?[{id:'team-a',name:'Cuadrilla Norte'}]:[];}},
    taskAssignment:{findFirst:async({where})=>structuredClone(state.rows.find(row=>match(row,where))||null),
      create:async({data})=>{const row={...data,id:data.id||'legacy-id',revision:0};assert.ok(!state.rows.some(item=>item.id===row.id));state.rows.push(row);return structuredClone(row);},
      updateMany:async({where,data})=>{const row=state.rows.find(item=>match(item,where));if(!row)return{count:0};Object.assign(row,{...data,revision:row.revision+1});return{count:1};}},
    auditLog:{findFirst:async({where})=>structuredClone([...state.audits].reverse().find(row=>match(row,where))||null),
      create:async({data})=>{if(state.failAudit)throw new Error('AUDIT_FAILURE');const row={...data,createdAt:new Date()};state.audits.push(row);return row;}},
  };
  return {state,prisma:{...tx,$transaction:async callback=>{const before=structuredClone(state);try{return await callback(tx);}catch(error){Object.assign(state,before);throw error;}}}};
}
const plan=(extra={})=>({scope,actorId,operationKey:'assignment-request-0001',input,...extra});
test('preparation reads current task revision and bounded owners without creating records',async()=>{
  const {prisma,state}=database();state.workerCount=101;const result=await prepareTaskAssignment(prisma,{scope,taskId:'task-a'});
  assert.equal(result.task.revision,3);assert.equal(result.owners.workers.length,100);assert.equal(result.owners.truncated,true);assert.equal(result.canCreate,true);assert.equal(state.rows.length,0);assert.equal(state.audits.length,0);
});
test('planning creates one real-domain record, dates and one atomic audit',async()=>{
  const {prisma,state}=database();const before=structuredClone(state.task);const result=await planTaskAssignment(prisma,plan());
  assert.match(result.assignment.id,/^assignment_[a-f0-9]{64}$/);assert.equal(result.assignment.status,'PLANNED');assert.equal(result.assignment.revision,0);
  assert.equal(result.assignment.workerId,'worker-a');assert.equal(result.assignment.teamId,null);assert.equal(result.assignment.startsAt,'2026-09-21T00:00:00.000Z');
  assert.equal(state.audits.length,1);assert.equal(state.audits[0].action,'execution.task.assignment.created');assert.equal(state.audits[0].metadata.taskRevision,3);assert.deepEqual(state.task,before);
});
test('crew assignment does not create employee records or select a person implicitly',async()=>{
  const {prisma,state}=database();const result=await planTaskAssignment(prisma,plan({input:{...input,ownerKind:'TEAM',ownerId:'team-a'}}));
  assert.equal(result.assignment.teamId,'team-a');assert.equal(result.assignment.workerId,null);assert.equal(state.rows.length,1);
});
test('same attempt returns the same record even after it advanced in its lifecycle',async()=>{
  const {prisma,state}=database();const first=await planTaskAssignment(prisma,plan());
  state.rows[0].status='ENDED';state.rows[0].revision=2;state.task.revision=4;
  const again=await planTaskAssignment(prisma,plan());assert.equal(again.replayed,true);assert.equal(again.assignment.id,first.assignment.id);assert.equal(again.assignment.status,'ENDED');assert.equal(state.rows.length,1);assert.equal(state.audits.length,1);
});
test('same idempotency key cannot change its body',async()=>{
  const {prisma}=database();await planTaskAssignment(prisma,plan());await assert.rejects(planTaskAssignment(prisma,plan({input:{...input,endsOn:'2026-09-26'}})),{code:'ASSIGNMENT_ATTEMPT_CONFLICT'});
});
test('another operator cannot duplicate an existing unfinished assignment with the same period',async()=>{
  const {prisma,state}=database();await planTaskAssignment(prisma,plan());await assert.rejects(planTaskAssignment(prisma,plan({actorId:'manager-b',operationKey:'different-request-002'})),{code:'ASSIGNMENT_DUPLICATE'});assert.equal(state.rows.length,1);
});
test('finished history does not prevent a separate new plan with explicit new intent',async()=>{
  const {prisma,state}=database();await planTaskAssignment(prisma,plan());state.rows[0].status='ENDED';const second=await planTaskAssignment(prisma,plan({operationKey:'different-request-002'}));assert.equal(second.replayed,false);assert.equal(state.rows.length,2);
});
test('planned to active to ended is versioned, explained and leaves the task unchanged',async()=>{
  const {prisma,state}=database();const before=structuredClone(state.task);const {assignment}=await planTaskAssignment(prisma,plan());
  const active=await decideTaskAssignment(prisma,{scope,actorId,assignmentId:assignment.id,input:{expectedRevision:0,status:'ACTIVE',note:'Responsable disponible para iniciar.'}});
  assert.equal(active.assignment.status,'ACTIVE');assert.equal(active.assignment.revision,1);assert.equal(active.assignment.lastDecision.note,'Responsable disponible para iniciar.');
  const ended=await decideTaskAssignment(prisma,{scope,actorId,assignmentId:assignment.id,input:{expectedRevision:1,status:'ENDED',note:'Asignación finalizada; el avance se revisa por separado.'}});
  assert.equal(ended.assignment.status,'ENDED');assert.equal(ended.assignment.revision,2);assert.equal(ended.assignment.startsAt,assignment.startsAt);assert.deepEqual(state.task,before);assert.equal(state.audits.length,3);
  const read=await getTaskAssignment(prisma,{scope,assignmentId:assignment.id});assert.equal(read.assignment.lastDecision.status,'ENDED');
});
test('a lost decision response is recovered by reading without applying another update',async()=>{
  const {prisma,state}=database();const {assignment}=await planTaskAssignment(prisma,plan());const input={expectedRevision:0,status:'CANCELLED',note:'Se reorganiza el frente de trabajo.'};
  await decideTaskAssignment(prisma,{scope,actorId,assignmentId:assignment.id,input});
  const found=await getTaskAssignment(prisma,{scope,assignmentId:assignment.id});assert.equal(found.assignment.lastDecision.note,input.note);
  await assert.rejects(decideTaskAssignment(prisma,{scope,actorId,assignmentId:assignment.id,input}),{code:'ASSIGNMENT_REVISION_CONFLICT'});assert.equal(state.audits.length,2);
});
for(const status of ['ENDED','CANCELLED'])test('terminal assignment cannot be reopened: '+status,async()=>{
  const {prisma,state}=database();const {assignment}=await planTaskAssignment(prisma,plan());state.rows[0].status=status;
  await assert.rejects(decideTaskAssignment(prisma,{scope,actorId,assignmentId:assignment.id,input:{expectedRevision:0,status:'ACTIVE',note:'Intento de reapertura'}}),{code:'ASSIGNMENT_TRANSITION_INVALID'});
});
test('inactive responsible prevents starting, but cancellation remains available',async()=>{
  const {prisma,state}=database();const {assignment}=await planTaskAssignment(prisma,plan());state.owner=false;
  await assert.rejects(decideTaskAssignment(prisma,{scope,actorId,assignmentId:assignment.id,input:{expectedRevision:0,status:'ACTIVE',note:'Inicio'}}),{code:'ASSIGNMENT_OWNER_UNAVAILABLE'});
  const result=await decideTaskAssignment(prisma,{scope,actorId,assignmentId:assignment.id,input:{expectedRevision:0,status:'CANCELLED',note:'La persona ya no está asignada a la obra.'}});assert.equal(result.assignment.status,'CANCELLED');
});
test('stale task revision and a summary task cannot create assignments',async()=>{
  const {prisma,state}=database();state.task.revision=4;await assert.rejects(planTaskAssignment(prisma,plan()),{code:'ASSIGNMENT_TASK_CHANGED'});
  state.task.type='PHASE';await assert.rejects(planTaskAssignment(prisma,plan()),{code:'ASSIGNMENT_TASK_MISSING'});assert.equal(state.rows.length,0);
});
for(const target of [{...scope,projectId:'project-b'},{...scope,organizationId:'org-b'}])test('foreign scope cannot read or plan '+JSON.stringify(target),async()=>{
  const {prisma,state}=database();await assert.rejects(prepareTaskAssignment(prisma,{scope:target,taskId:'task-a'}),{status:404});
  await assert.rejects(planTaskAssignment(prisma,plan({scope:target})),{code:'PROJECT_WRITE_SCOPE_INVALID'});assert.equal(state.rows.length,0);
});
for(const field of ['owner','team'])test('inactive '+field+' is rejected at write time',async()=>{
  const {prisma,state}=database();state[field]=false;const request=field==='owner'?input:{...input,ownerKind:'TEAM',ownerId:'team-a'};
  await assert.rejects(planTaskAssignment(prisma,plan({input:request})),{code:'ASSIGNMENT_OWNER_UNAVAILABLE'});
});
test('archived project and inactive subscription stay read-only',async()=>{
  const {prisma,state}=database();state.projectStatus='ARCHIVED';assert.equal((await prepareTaskAssignment(prisma,{scope,taskId:'task-a'})).canCreate,false);
  await assert.rejects(planTaskAssignment(prisma,plan()),{code:'PROJECT_READ_ONLY'});state.projectStatus='ACTIVE';state.organization.subscriptionStatus='CANCELED';
  await assert.rejects(planTaskAssignment(prisma,plan()),{code:'ASSIGNMENT_READ_ONLY'});
});
test('audit failure rolls back both plan and lifecycle updates',async()=>{
  const {prisma,state}=database();state.failAudit=true;await assert.rejects(planTaskAssignment(prisma,plan()),/AUDIT_FAILURE/);assert.equal(state.rows.length,0);
  state.failAudit=false;const {assignment}=await planTaskAssignment(prisma,plan());state.failAudit=true;
  await assert.rejects(decideTaskAssignment(prisma,{scope,actorId,assignmentId:assignment.id,input:{expectedRevision:0,status:'ACTIVE',note:'Inicio verificado'}}),/AUDIT_FAILURE/);assert.equal(state.rows[0].status,'PLANNED');assert.equal(state.rows[0].revision,0);
});
test('deleted record or missing receipt cannot silently create a replacement',async()=>{
  const {prisma,state}=database();await planTaskAssignment(prisma,plan());state.rows=[];await assert.rejects(planTaskAssignment(prisma,plan()),{code:'ASSIGNMENT_GONE'});
  const second=database();await planTaskAssignment(second.prisma,plan());second.state.audits=[];await assert.rejects(planTaskAssignment(second.prisma,plan()),{code:'ASSIGNMENT_ATTEMPT_CONFLICT'});
});
test('preexisting execution API uses the same creation helper',async()=>{
  const {prisma,state}=database();const result=await createExecutionRecord(prisma,{scope,actorId,input:{kind:'ASSIGNMENT',taskId:'task-a',workerId:'worker-a'}});
  assert.equal(result.kind,'ASSIGNMENT');assert.equal(result.assignment.status,'PLANNED');assert.equal(state.audits[0].action,'execution.task.assignment.created');
});
for(const change of [{actorId:'other'},{status:'ACTIVE'},{ownerKind:'ANY'},{ownerId:'../other'},{expectedTaskRevision:'3'},{startsOn:'2026-02-30'},{startsOn:'2026-10-01',endsOn:'2026-09-25'},{startsOn:'',endsOn:'2026-09-25'}])test('invalid or authority-bearing plan denied: '+JSON.stringify(change),()=>assert.throws(()=>normalizeAssignmentPlan({...input,...change})));
test('dates remain calendar days and a plan can omit both',()=>{
  const result=normalizeAssignmentPlan({...input,startsOn:'',endsOn:''});assert.equal(result.startsAt,null);assert.equal(result.endsAt,null);
  assert.equal(normalizeAssignmentPlan(input).startsAt,'2026-09-21T00:00:00.000Z');
});
test('decisions require explicit note and version, not fields for changing responsibility',()=>{
  for(const change of [{note:''},{expectedRevision:'0'},{note:'a'.repeat(1001)},{status:'PLANNED'},{workerId:'other'}])assert.throws(()=>normalizeAssignmentDecision({expectedRevision:0,status:'ACTIVE',note:'Validado',...change}));
});
test('incomplete, foreign or changed acknowledgement cannot clear a reviewed plan',async()=>{
  const {prisma}=database();const result=await planTaskAssignment(prisma,plan()),normalized=normalizeAssignmentPlan(input);
  assert.equal(confirmAssignmentPlan(result,normalized,scope).id,result.assignment.id);
  for(const payload of [{},{...result,context:{...scope,organizationId:'other'}},{...result,assignment:{...result.assignment,workerId:'other'}},{...result,assignment:{...result.assignment,startsAt:null}},{...result,assignment:{...result.assignment,status:'ACTIVE'}}])assert.throws(()=>confirmAssignmentPlan(payload,normalized,scope),{code:'ASSIGNMENT_UNCONFIRMED'});
});
