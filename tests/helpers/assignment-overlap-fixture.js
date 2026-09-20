import assert from 'node:assert/strict';
export const scope={organizationId:'org-a',projectId:'project-a'},actorId='manager-a';
export const input={taskId:'task-a',expectedTaskRevision:3,ownerKind:'WORKER',ownerId:'worker-a',startsOn:'2026-09-21',endsOn:'2026-09-25'};
export function database(){
  const state={projectStatus:'ACTIVE',organization:{id:'org-a',subscriptionPlan:'ENTERPRISE',subscriptionStatus:'ACTIVE'},task:{id:'task-a',title:'Mampostería',revision:3,type:'TASK'},owner:true,team:true,rows:[],members:[],audits:[],failAudit:false,workerCount:1};
  const comparable=value=>value instanceof Date?value.toISOString():value;
  const match=(row,where)=>Object.entries(where).every(([key,value])=>{
    if(key==='AND')return value.every(part=>match(row,part));
    if(key==='OR')return value.some(part=>match(row,part));
    if(key==='project')return value.organizationId===scope.organizationId;
    if(key==='metadata')return row.metadata?.[value.path[0]]===value.equals;
    if(value&&typeof value==='object'&&!(value instanceof Date))return Object.entries(value).every(([op,v])=>op==='in'?v.includes(row[key]):row[key]!=null&&(op==='lt'?comparable(row[key])<comparable(v):op==='gt'?comparable(row[key])>comparable(v):op==='gte'?comparable(row[key])>=comparable(v):false));
    return comparable(row[key])===comparable(value);
  });
  const tx={
    $executeRawUnsafe:async()=>1,
    project:{findFirst:async({where})=>where.id===scope.projectId&&where.organizationId===scope.organizationId?{id:scope.projectId,status:state.projectStatus,organization:state.organization}:null},
    task:{findFirst:async({where})=>state.task&&where.id==='task-a'&&where.projectId===scope.projectId&&where.metadata.equals==='canonical-task-v1'&&(!where.type||where.type===state.task.type)?structuredClone(state.task):null},
    worker:{findFirst:async({where})=>state.owner&&where.id==='worker-a'&&where.projectId===scope.projectId&&where.active?{id:'worker-a'}:null,
      findMany:async options=>{assert.equal(options.where.projectId,scope.projectId);assert.equal(options.take,101);return Array.from({length:state.workerCount},(_,i)=>({id:i?'worker-'+i:'worker-a',name:'Persona '+i}));}},
    workTeam:{findFirst:async({where})=>state.team&&where.id==='team-a'&&where.projectId===scope.projectId&&where.status==='ACTIVE'?{id:'team-a'}:null,
      findMany:async options=>{assert.equal(options.where.projectId,scope.projectId);assert.equal(options.take,101);return state.team?[{id:'team-a',name:'Cuadrilla Norte'}]:[];}},
    workTeamMember:{findMany:async options=>{assert.equal(options.where.projectId,scope.projectId);assert.equal(options.take,3001);return structuredClone(state.members.filter(row=>match(row,options.where)).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,options.take));}},
    taskAssignment:{findMany:async options=>{assert.equal(options.where.projectId,scope.projectId);assert.equal(options.where.project.organizationId,scope.organizationId);assert.equal(options.take,1001);return structuredClone(state.rows.filter(row=>match(row,options.where)).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,options.take).map(row=>({...row,task:{title:'Actividad '+row.taskId},worker:row.workerId?{name:'Persona de ensayo'}:null,team:row.teamId?{name:'Cuadrilla de ensayo'}:null})));},findFirst:async({where})=>structuredClone(state.rows.find(row=>match(row,where))||null),
      create:async({data})=>{const row={...data,id:data.id||'legacy-id',revision:0};assert.ok(!state.rows.some(item=>item.id===row.id));state.rows.push(row);return structuredClone(row);},
      updateMany:async({where,data})=>{const row=state.rows.find(item=>match(item,where));if(!row)return{count:0};Object.assign(row,{...data,revision:row.revision+1});return{count:1};}},
    auditLog:{findFirst:async({where})=>structuredClone([...state.audits].reverse().find(row=>match(row,where))||null),
      create:async({data})=>{if(state.failAudit)throw new Error('AUDIT_FAILURE');const row={...data,createdAt:new Date()};state.audits.push(row);return row;}},
  };
  return {state,prisma:{...tx,$transaction:async callback=>{const before=structuredClone(state);try{return await callback(tx);}catch(error){Object.assign(state,before);throw error;}}}};
}
