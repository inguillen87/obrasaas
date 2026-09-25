// A transaction owns one PostgreSQL connection: await its reads in order.
// Independent pooled operations outside a transaction may remain concurrent.
import { createHash } from 'node:crypto';
import { addWorkTeamMemberInTransaction } from './project-execution.js';
import { runOperationalProjectMutation,isOperationalProjectWriteStatus } from './project-write-policy.js';
import { subscriptionAllowsWrites } from './plans.js';
import { crewId,crewMembershipState,normalizeCrewAddition,normalizeCrewDecision,CrewMembershipError } from './crew-membership-policy.js';
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const scopeOf=scope=>({organizationId:crewId(scope?.organizationId),projectId:crewId(scope?.projectId)});
const iso=value=>value?new Date(value).toISOString():null;
const SELECT={id:true,projectId:true,teamId:true,workerId:true,role:true,revision:true,startsAt:true,endsAt:true,worker:{select:{name:true,active:true}}};
const serialize=(row,now)=>({id:row.id,projectId:row.projectId,teamId:row.teamId,workerId:row.workerId,role:row.role,revision:row.revision,startsAt:iso(row.startsAt),endsAt:iso(row.endsAt),state:crewMembershipState(row,now),worker:{name:row.worker.name,active:row.worker.active}});
const period=(view,now)=>view==='current'?{startsAt:{lte:now},OR:[{endsAt:null},{endsAt:{gt:now}}]}:view==='past'?{endsAt:{lte:now}}:view==='scheduled'?{startsAt:{gt:now},OR:[{endsAt:null},{endsAt:{gt:now}}]}:{};
async function projectIn(tx,scope,now,write=false){
  const p=await tx.project.findFirst({where:{id:scope.projectId,organizationId:scope.organizationId},select:{id:true,status:true,organization:true}});
  if(!p)throw new CrewMembershipError('La obra no está disponible.','CREW_PROJECT_MISSING',404);
  if(write&&!subscriptionAllowsWrites(p.organization,now))throw new CrewMembershipError('La empresa quedó en modo de lectura.','CREW_READ_ONLY',402);
  return p;
}
async function teamIn(tx,scope,teamId){
  const team=await tx.workTeam.findFirst({where:{id:teamId,projectId:scope.projectId},select:{id:true,name:true,status:true,revision:true}});
  if(!team)throw new CrewMembershipError('La cuadrilla no está disponible en esta obra.','CREW_TEAM_MISSING',404);return team;
}
async function memberIn(tx,scope,teamId,memberId,now){
  const row=await tx.workTeamMember.findFirst({where:{id:memberId,projectId:scope.projectId,teamId},select:SELECT});
  if(!row)throw new CrewMembershipError('La participación no está disponible.','CREW_MEMBER_MISSING',404);
  const event=await tx.auditLog.findFirst({where:{organizationId:scope.organizationId,entityType:'WorkTeamMember',entityId:memberId,action:'execution.team.member.updated',metadata:{path:['projectId'],equals:scope.projectId}},orderBy:[{createdAt:'desc'},{id:'desc'}],select:{metadata:true,createdAt:true}});
  const meta=event?.metadata;
  return {...serialize(row,now),lastDecision:meta?.revision===row.revision&&meta.role===row.role&&['CHANGE_ROLE','END'].includes(meta.operation)&&typeof meta.note==='string'?{note:meta.note,operation:meta.operation,role:meta.role,revision:meta.revision,at:iso(event.createdAt)}:null};
}
export async function readCrewRoster(prisma,{scope:rawScope,teamId,query={view:'current',after:null},clock=()=>new Date()}){
  const scope=scopeOf(rawScope);crewId(teamId);if(query.after)crewId(query.after);
  if(!['current','past','scheduled','all'].includes(query.view))throw new CrewMembershipError('Filtro no admitido.');
  return prisma.$transaction(async tx=>{
    const now=clock(),project=await projectIn(tx,scope,now),team=await teamIn(tx,scope,teamId),base={projectId:scope.projectId,teamId};
    const [rows,workers,current,past,scheduled]=[
      await (tx.workTeamMember.findMany({where:{...base,...period(query.view,now),...(query.after?{id:{gt:query.after}}:{})},orderBy:{id:'asc'},take:51,select:SELECT})),
      await (tx.worker.findMany({where:{projectId:scope.projectId,active:true},orderBy:[{name:'asc'},{id:'asc'}],take:101,select:{id:true,name:true}})),
      await (tx.workTeamMember.count({where:{...base,...period('current',now)}})),
      await (tx.workTeamMember.count({where:{...base,...period('past',now)}})),
      await (tx.workTeamMember.count({where:{...base,...period('scheduled',now)}})),
    ];
    const members=rows.slice(0,50).map(row=>serialize(row,now));
    return {context:scope,team,members,workers:workers.slice(0,100),workersTruncated:workers.length>100,summary:{current,past,scheduled},
      writable:isOperationalProjectWriteStatus(project.status)&&subscriptionAllowsWrites(project.organization,now),checkedAt:iso(now),
      page:{view:query.view,limit:50,hasMore:rows.length>50,nextAfter:rows.length>50?members.at(-1).id:null}};
  },{isolationLevel:'RepeatableRead',timeout:10000});
}
export async function addCrewMember(prisma,{scope:rawScope,actorId,teamId,operationKey,input,clock=()=>new Date()}){
  const scope=scopeOf(rawScope);crewId(actorId);crewId(teamId);const command=normalizeCrewAddition(input);
  if(typeof operationKey!=='string'||!/^[A-Za-z0-9_-]{16,96}$/.test(operationKey))throw new CrewMembershipError('La incorporación necesita una referencia de intento válida.');
  const key=digest(['crew-member-v1',scope,teamId,actorId,operationKey]),id='crew_member_'+key,auditId='crew_request_'+key,fingerprint=digest(command);
  return runOperationalProjectMutation(prisma,scope,async tx=>{
    const now=clock();await projectIn(tx,scope,now,true);const team=await teamIn(tx,scope,teamId);
    const [existing,receipt]=[
      await (tx.workTeamMember.findFirst({where:{id,projectId:scope.projectId,teamId},select:SELECT})),
      await (tx.auditLog.findFirst({where:{id:auditId,organizationId:scope.organizationId,actorId,entityType:'WorkTeamMember',entityId:id,action:'execution.team.member.added'}})),
    ];
    if(existing||receipt){
      if(!receipt||receipt.metadata?.projectId!==scope.projectId||receipt.metadata?.teamId!==teamId||receipt.metadata?.fingerprint!==fingerprint)throw new CrewMembershipError('El intento ya tiene otro contenido o requiere revisión.','CREW_ATTEMPT_CONFLICT',409);
      if(!existing)throw new CrewMembershipError('La participación anterior ya no está disponible. No se recreó.','CREW_MEMBER_GONE',410);
      return {context:scope,member:serialize(existing,now),replayed:true};
    }
    if(team.status!=='ACTIVE'||team.revision!==command.expectedTeamRevision)throw new CrewMembershipError('La cuadrilla cambió o quedó archivada. Volvé a consultar.','CREW_TEAM_CHANGED',409);
    const overlap=await tx.workTeamMember.findFirst({where:{projectId:scope.projectId,teamId,workerId:command.workerId,OR:[{endsAt:null},{endsAt:{gt:now}}]},select:{id:true}});
    if(overlap)throw new CrewMembershipError('La persona ya tiene una participación vigente o programada en esta cuadrilla.','CREW_MEMBER_DUPLICATE',409);
    await addWorkTeamMemberInTransaction(tx,{scope,actorId,recordId:id,auditId,requestMetadata:{fingerprint,source:'crew-roster-v1'},
      input:{teamId,workerId:command.workerId,role:command.role,startsAt:now.toISOString()}});
    return {context:scope,member:await memberIn(tx,scope,teamId,id,now),replayed:false};
  });
}
export async function getCrewMember(prisma,{scope:rawScope,teamId,memberId,clock=()=>new Date()}){
  const scope=scopeOf(rawScope);crewId(teamId);crewId(memberId);
  return prisma.$transaction(async tx=>{const now=clock();await projectIn(tx,scope,now);await teamIn(tx,scope,teamId);return {context:scope,member:await memberIn(tx,scope,teamId,memberId,now)};},{isolationLevel:'RepeatableRead',timeout:10000});
}
export async function decideCrewMember(prisma,{scope:rawScope,actorId,teamId,memberId,input,clock=()=>new Date()}){
  const scope=scopeOf(rawScope);crewId(actorId);crewId(teamId);crewId(memberId);const decision=normalizeCrewDecision(input);
  return runOperationalProjectMutation(prisma,scope,async tx=>{
    const now=clock();await projectIn(tx,scope,now,true);const team=await teamIn(tx,scope,teamId),row=await memberIn(tx,scope,teamId,memberId,now);
    if(row.revision!==decision.expectedRevision)throw new CrewMembershipError('La participación cambió. Consultá el estado antes de repetir.','CREW_MEMBER_STALE',409);
    if(row.state!=='CURRENT')throw new CrewMembershipError('Sólo se modifican participaciones vigentes. El historial no se reabre.','CREW_MEMBER_NOT_CURRENT',409);
    if(decision.operation==='CHANGE_ROLE'&&(team.status!=='ACTIVE'||!row.worker.active||row.role===decision.role))throw new CrewMembershipError('Revisá la función actual y la vigencia de la persona y cuadrilla.','CREW_ROLE_UNAVAILABLE',409);
    const changes=decision.operation==='END'?{endsAt:now}:{role:decision.role};
    const updated=await tx.workTeamMember.updateMany({where:{id:memberId,projectId:scope.projectId,teamId,revision:row.revision},data:{...changes,revision:{increment:1}}});
    if(updated.count!==1)throw new CrewMembershipError('Otra operación cambió el registro.','CREW_MEMBER_STALE',409);
    await tx.auditLog.create({data:{organizationId:scope.organizationId,actorId,entityType:'WorkTeamMember',entityId:memberId,action:'execution.team.member.updated',
      metadata:{projectId:scope.projectId,teamId,workerId:row.workerId,revision:row.revision+1,operation:decision.operation,role:decision.role||row.role,previousRole:row.role,note:decision.note}}});
    return {context:scope,member:await memberIn(tx,scope,teamId,memberId,now)};
  });
}
