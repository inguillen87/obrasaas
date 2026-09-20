import assert from 'node:assert/strict';
import test from 'node:test';
import { readCrewRoster,addCrewMember,getCrewMember,decideCrewMember } from '../src/lib/crew-memberships.js';
import { normalizeCrewAddition,normalizeCrewDecision,crewMembershipState,crewQuery,crewMemberMatches,crewRosterMatches } from '../src/lib/crew-membership-policy.js';
import { createExecutionRecord } from '../src/lib/project-execution.js';
const scope={organizationId:'org-a',projectId:'project-a'},actorId='manager-a',teamId='team-a';
const NOW=new Date('2026-09-20T10:00:00.000Z');
const input={workerId:'worker-a',role:'MEMBER',expectedTeamRevision:2};
const options=(extra={})=>({scope,actorId,teamId,operationKey:'crew-test-request-0001',input,clock:()=>NOW,...extra});
function database(){
  const state={projectStatus:'ACTIVE',organization:{subscriptionPlan:'ENTERPRISE',subscriptionStatus:'ACTIVE'},team:{id:teamId,name:'Cuadrilla de ensayo',status:'ACTIVE',revision:2},worker:{id:'worker-a',name:'Persona de ensayo',active:true},rows:[],audits:[],failAudit:false,workers:1};
  const calls=[];
  const comparable=value=>value instanceof Date?value.getTime():value;
  function match(row,where){return Object.entries(where).every(([key,value])=>{
    if(key==='OR')return value.some(item=>match(row,item));
    if(key==='metadata')return row.metadata?.[value.path[0]]===value.equals;
    if(value&&typeof value==='object'&&!(value instanceof Date))return Object.entries(value).every(([op,n])=>row[key]!=null&&(op==='gt'?comparable(row[key])>comparable(n):op==='lte'?comparable(row[key])<=comparable(n):false));
    return comparable(row[key])===comparable(value);
  });}
  const decorate=row=>row?structuredClone({...row,worker:{name:state.worker.name,active:state.worker.active}}):null;
  const tx={
    $executeRawUnsafe:async()=>1,
    project:{findFirst:async({where})=>where.id===scope.projectId&&where.organizationId===scope.organizationId?{id:scope.projectId,status:state.projectStatus,organization:state.organization}:null},
    workTeam:{findFirst:async({where})=>where.id===teamId&&where.projectId===scope.projectId&&(!where.status||where.status===state.team.status)?structuredClone(state.team):null},
    worker:{findFirst:async({where})=>where.id===state.worker.id&&where.projectId===scope.projectId&&state.worker.active?structuredClone(state.worker):null,
      findMany:async args=>{calls.push(args);assert.equal(args.where.projectId,scope.projectId);return Array.from({length:Math.min(state.workers,args.take)},(_,i)=>({id:i?'worker-'+i:'worker-a',name:'Persona '+i}));}},
    workTeamMember:{findFirst:async({where})=>decorate(state.rows.find(row=>match(row,where))),
      findMany:async args=>{calls.push(args);assert.equal(args.where.projectId,scope.projectId);assert.equal(args.where.teamId,teamId);return state.rows.filter(row=>match(row,args.where)).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,args.take).map(decorate);},
      count:async({where})=>state.rows.filter(row=>match(row,where)).length,
      create:async({data})=>{const row={...data,id:data.id||'legacy-member',revision:0};assert.ok(!state.rows.some(x=>x.id===row.id));state.rows.push(row);return decorate(row);},
      updateMany:async({where,data})=>{const row=state.rows.find(x=>match(x,where));if(!row)return{count:0};Object.assign(row,{...data,revision:row.revision+1});return{count:1};}},
    auditLog:{findFirst:async({where})=>structuredClone([...state.audits].reverse().find(row=>match(row,where))||null),
      create:async({data})=>{if(state.failAudit)throw new Error('AUDIT_FAILURE');const row={...data,createdAt:NOW};state.audits.push(row);return row;}},
  };
  return {state,calls,prisma:{...tx,$transaction:async callback=>{const before=structuredClone(state);try{return await callback(tx);}catch(error){Object.assign(state,before);throw error;}}}};
}
const row=(id='member-a',extra={})=>({id,projectId:scope.projectId,teamId,workerId:'worker-a',role:'MEMBER',revision:0,startsAt:new Date('2026-09-19T10:00:00Z'),endsAt:null,...extra});
test('roster is a bounded read without modifications and distinguishes periods',async()=>{
  const {prisma,state,calls}=database();state.rows=[row(),row('past',{endsAt:new Date('2026-09-19T11:00:00Z')}),row('future',{startsAt:new Date('2026-09-22')})];state.workers=101;
  const before=structuredClone(state.rows),data=await readCrewRoster(prisma,options());
  assert.deepEqual(data.summary,{current:1,past:1,scheduled:1});assert.equal(data.members.length,1);assert.equal(data.members[0].state,'CURRENT');assert.equal(data.workers.length,100);assert.equal(data.workersTruncated,true);
  assert.ok(calls.some(call=>call.take===51));assert.deepEqual(state.rows,before);assert.equal(state.audits.length,0);
});
test('cursor paginates only records of the requested crew without claiming page count as total',async()=>{
  const {prisma,state}=database();state.rows=Array.from({length:60},(_,i)=>row('member-'+String(i).padStart(3,'0')));
  const first=await readCrewRoster(prisma,options());assert.equal(first.members.length,50);assert.equal(first.summary.current,60);assert.equal(first.page.hasMore,true);
  const second=await readCrewRoster(prisma,options({query:{view:'current',after:first.page.nextAfter}}));assert.equal(second.members.length,10);assert.equal(second.page.hasMore,false);
});
test('addition reuses the domain creator, server timestamp and atomic audit',async()=>{
  const {prisma,state}=database();const person=structuredClone(state.worker);const result=await addCrewMember(prisma,options());
  assert.equal(result.member.role,'MEMBER');assert.equal(result.member.state,'CURRENT');assert.equal(result.member.startsAt,NOW.toISOString());assert.equal(result.member.endsAt,null);assert.equal(result.member.revision,0);
  assert.equal(state.audits.length,1);assert.equal(state.audits[0].action,'execution.team.member.added');assert.deepEqual(state.worker,person);
});
test('repeating the exact attempt recovers the same membership even after it ended',async()=>{
  const {prisma,state}=database();const first=await addCrewMember(prisma,options());state.rows[0].endsAt=NOW;state.rows[0].revision=1;
  const again=await addCrewMember(prisma,options());assert.equal(again.member.id,first.member.id);assert.equal(again.replayed,true);assert.equal(again.member.state,'ENDED');assert.equal(state.rows.length,1);assert.equal(state.audits.length,1);
});
test('same key with different role is rejected',async()=>{
  const {prisma}=database();await addCrewMember(prisma,options());await assert.rejects(addCrewMember(prisma,options({input:{...input,role:'LEAD'}})),{code:'CREW_ATTEMPT_CONFLICT'});
});
for(const future of [false,true])test('second operator cannot duplicate current or scheduled participation '+future,async()=>{
  const {prisma,state}=database();state.rows=[row('existing',{startsAt:future?new Date('2026-09-25'):NOW})];
  await assert.rejects(addCrewMember(prisma,options({actorId:'manager-b'})),{code:'CREW_MEMBER_DUPLICATE'});assert.equal(state.rows.length,1);
});
test('finalized participation stays intact when a later independent participation begins',async()=>{
  const {prisma,state}=database();state.rows=[row('past',{endsAt:NOW})];const before=structuredClone(state.rows[0]);
  const result=await addCrewMember(prisma,options());assert.equal(result.replayed,false);assert.equal(state.rows.length,2);assert.deepEqual(state.rows[0],before);
});
test('internal role changes and departure are versioned without changing employee or team assignments',async()=>{
  const {prisma,state}=database();const worker=structuredClone(state.worker);const {member}=await addCrewMember(prisma,options());
  const changed=await decideCrewMember(prisma,options({memberId:member.id,input:{expectedRevision:0,operation:'CHANGE_ROLE',role:'LEAD',note:'Coordina el frente norte.'}}));
  assert.equal(changed.member.role,'LEAD');assert.equal(changed.member.revision,1);assert.equal(changed.member.lastDecision.note,'Coordina el frente norte.');
  const ended=await decideCrewMember(prisma,options({memberId:member.id,input:{expectedRevision:1,operation:'END',note:'Se reorganiza la cuadrilla.'}}));
  assert.equal(ended.member.state,'ENDED');assert.equal(ended.member.endsAt,NOW.toISOString());assert.equal(ended.member.startsAt,member.startsAt);assert.deepEqual(state.worker,worker);assert.equal(state.audits.length,3);
});
test('lost update is recovered by GET; another PATCH with its old revision is rejected',async()=>{
  const {prisma,state}=database();const {member}=await addCrewMember(prisma,options());const change={expectedRevision:0,operation:'END',note:'Trabajo de esta cuadrilla finalizado.'};
  await decideCrewMember(prisma,options({memberId:member.id,input:change}));const recovered=await getCrewMember(prisma,options({memberId:member.id}));assert.equal(recovered.member.lastDecision.note,change.note);
  await assert.rejects(decideCrewMember(prisma,options({memberId:member.id,input:change})),{code:'CREW_MEMBER_STALE'});assert.equal(state.audits.length,2);
});
for(const memberState of ['ENDED','SCHEDULED'])test('history and future participation do not reopen '+memberState,async()=>{
  const {prisma,state}=database();state.rows=[row('existing',memberState==='ENDED'?{endsAt:NOW}:{startsAt:new Date('2026-09-25')})];
  await assert.rejects(decideCrewMember(prisma,options({memberId:'existing',input:{expectedRevision:0,operation:'END',note:'No modificar registro no vigente'}})),{code:'CREW_MEMBER_NOT_CURRENT'});
});
test('inactive employee cannot be added or promoted but a current participation can be ended',async()=>{
  const {prisma,state}=database();state.worker.active=false;await assert.rejects(addCrewMember(prisma,options()));state.rows=[row()];
  await assert.rejects(decideCrewMember(prisma,options({memberId:'member-a',input:{expectedRevision:0,operation:'CHANGE_ROLE',role:'LEAD',note:'Intento no permitido'}})),{code:'CREW_ROLE_UNAVAILABLE'});
  assert.equal((await decideCrewMember(prisma,options({memberId:'member-a',input:{expectedRevision:0,operation:'END',note:'Registro inactivo revisado'}}))).member.state,'ENDED');
});
test('foreign company, project or crew cannot read or modify roster',async()=>{
  for(const change of [{scope:{...scope,organizationId:'other'}},{scope:{...scope,projectId:'other'}},{teamId:'other'}]){
    const {prisma,state}=database();await assert.rejects(readCrewRoster(prisma,options(change)));await assert.rejects(addCrewMember(prisma,options(change)));assert.equal(state.rows.length,0);
  }
});
test('team revision, archived project and expired subscription are checked again at write',async()=>{
  const {prisma,state}=database();state.team.revision=3;await assert.rejects(addCrewMember(prisma,options()),{code:'CREW_TEAM_CHANGED'});
  state.team.revision=2;state.projectStatus='ARCHIVED';assert.equal((await readCrewRoster(prisma,options())).writable,false);await assert.rejects(addCrewMember(prisma,options()),{code:'PROJECT_READ_ONLY'});
  state.projectStatus='ACTIVE';state.organization.subscriptionStatus='CANCELED';await assert.rejects(addCrewMember(prisma,options()),{code:'CREW_READ_ONLY'});
});
test('audit failure rolls back addition and role changes',async()=>{
  const {prisma,state}=database();state.failAudit=true;await assert.rejects(addCrewMember(prisma,options()),/AUDIT_FAILURE/);assert.equal(state.rows.length,0);
  state.failAudit=false;const {member}=await addCrewMember(prisma,options());state.failAudit=true;
  await assert.rejects(decideCrewMember(prisma,options({memberId:member.id,input:{expectedRevision:0,operation:'CHANGE_ROLE',role:'LEAD',note:'Asignar coordinación'}})),/AUDIT_FAILURE/);assert.equal(state.rows[0].role,'MEMBER');assert.equal(state.rows[0].revision,0);
});
test('removed membership or missing receipt is not silently repaired by an import',async()=>{
  const {prisma,state}=database();await addCrewMember(prisma,options());state.rows=[];await assert.rejects(addCrewMember(prisma,options()),{code:'CREW_MEMBER_GONE'});
  const second=database();await addCrewMember(second.prisma,options());second.state.audits=[];await assert.rejects(addCrewMember(second.prisma,options()),{code:'CREW_ATTEMPT_CONFLICT'});
});
test('legacy creation continues through the extracted transactional domain',async()=>{
  const {prisma,state}=database();const result=await createExecutionRecord(prisma,{scope,actorId,input:{kind:'TEAM_MEMBER',teamId,workerId:'worker-a',role:'MEMBER'}});assert.equal(result.kind,'TEAM_MEMBER');assert.equal(state.audits.length,1);
});
for(const change of [{role:'ADMIN'},{role:['LEAD']},{workerId:'../other'},{expectedTeamRevision:'2'},{startsAt:'2020-01-01'},{actorId:'other'},{projectId:'other'}])test('invalid membership command denied '+JSON.stringify(change),()=>assert.throws(()=>normalizeCrewAddition({...input,...change})));
test('role/end decisions require current version, valid operation and a reviewed explanation',()=>{
  for(const change of [{note:''},{note:'a'.repeat(1001)},{role:'ADMIN'},{expectedRevision:'0'},{operation:'DELETE'},{operation:'END',role:'LEAD'}])assert.throws(()=>normalizeCrewDecision({expectedRevision:0,operation:'CHANGE_ROLE',role:'LEAD',note:'Motivo',...change}));
});
test('membership timestamps distinguish ended exactly at now and preserve future starts',()=>{assert.equal(crewMembershipState(row('x',{endsAt:NOW}),NOW),'ENDED');assert.equal(crewMembershipState(row('x',{startsAt:new Date('2026-09-21')}),NOW),'SCHEDULED');assert.throws(()=>crewMembershipState(row('x',{endsAt:new Date('2000-01-01')}),NOW));});
test('only explicit single view/cursor keys are accepted',()=>{for(const query of ['view=current&view=all','tenantId=x','after=../x','view=nope'])assert.throws(()=>crewQuery(new URLSearchParams(query)));assert.deepEqual(crewQuery(new URLSearchParams()),{view:'current',after:null});});
test('membership acknowledgement requires the exact scope, person and a known state',async()=>{const {prisma}=database();const {member}=await addCrewMember(prisma,options());assert.equal(crewMemberMatches(member,scope,teamId),true);assert.equal(crewMemberMatches({...member,teamId:'other'},scope,teamId),false);assert.equal(crewMemberMatches({...member,worker:{}},scope,teamId),false);});
test('incomplete or foreign roster is not a confirmed empty crew',async()=>{
  const {prisma}=database();const result=await readCrewRoster(prisma,options());assert.equal(crewRosterMatches(result,scope,teamId,'current'),true);
  for(const bad of [{},{...result,summary:{}},{...result,members:[null]},{...result,page:{...result.page,view:'past'}},{...result,writable:'true'},{...result,workers:[{id:'worker-a'}]},{...result,context:{...scope,organizationId:'other'}}])assert.equal(crewRosterMatches(bad,scope,teamId,'current'),false);
});
test('an archived crew cannot receive a new member but its existing participation can be closed',async()=>{
  const {prisma,state}=database();state.team.status='ARCHIVED';await assert.rejects(addCrewMember(prisma,options()),{code:'CREW_TEAM_CHANGED'});state.rows=[row()];
  const result=await decideCrewMember(prisma,options({memberId:'member-a',input:{expectedRevision:0,operation:'END',note:'Cierre de participación de cuadrilla archivada.'}}));assert.equal(result.member.state,'ENDED');
});
