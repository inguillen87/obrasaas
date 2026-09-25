const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/;
export const CREW_ROLES = Object.freeze({ MEMBER: 'Integrante', LEAD: 'Encargado de cuadrilla' });
export class CrewMembershipError extends Error {
  constructor(message,code='CREW_MEMBERSHIP_INVALID',status=422){super(message);this.name='CrewMembershipError';this.code=code;this.status=status;}
}
export function crewId(value){if(typeof value!=='string'||!ID.test(value))throw new CrewMembershipError('El registro o su contexto no es válido.');return value;}
function version(value){if(!Number.isSafeInteger(value)||value<0)throw new CrewMembershipError('La revisión consultada es obligatoria.');return value;}
function fields(input,allowed){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!allowed.includes(key)))throw new CrewMembershipError('La solicitud contiene campos no admitidos.');}
function note(value){if(typeof value!=='string'||!value.trim()||value.trim().length>1000||/[\u0000-\u0008\u000b-\u001f\u007f]/.test(value))throw new CrewMembershipError('Explicá la decisión en hasta 1.000 caracteres.');return value.trim().replace(/\r\n/g,'\n');}
function role(value){if(typeof value!=='string'||!Object.hasOwn(CREW_ROLES,value))throw new CrewMembershipError('Seleccioná la función dentro de la cuadrilla.');return value;}
export function normalizeCrewAddition(input){fields(input,['workerId','role','expectedTeamRevision']);return {workerId:crewId(input.workerId),role:role(input.role),expectedTeamRevision:version(input.expectedTeamRevision)};}
export function normalizeCrewDecision(input){
  fields(input,['expectedRevision','operation','role','note']);
  if(!['CHANGE_ROLE','END'].includes(input.operation)||input.operation==='END'&&input.role!==undefined)throw new CrewMembershipError('La acción no está disponible.');
  return {expectedRevision:version(input.expectedRevision),operation:input.operation,...(input.operation==='CHANGE_ROLE'?{role:role(input.role)}:{}),note:note(input.note)};
}
export function crewMembershipState(row,now){
  const at=new Date(now).getTime(),start=new Date(row.startsAt).getTime(),end=row.endsAt?new Date(row.endsAt).getTime():null;
  if(!Number.isFinite(at)||!Number.isFinite(start)||end!==null&&(!Number.isFinite(end)||end<start))throw new CrewMembershipError('La participación requiere revisión de sus fechas.','CREW_MEMBERSHIP_INCONSISTENT',503);
  return end!==null&&end<=at?'ENDED':start>at?'SCHEDULED':'CURRENT';
}
export function crewQuery(params){
  for(const key of params.keys())if(!['view','after'].includes(key)||params.getAll(key).length!==1)throw new CrewMembershipError('Consulta de integrantes no admitida.');
  const view=params.get('view')||'current';if(!['current','past','scheduled','all'].includes(view))throw new CrewMembershipError('Filtro de integrantes no válido.');
  return {view,after:params.has('after')?crewId(params.get('after')):null};
}
export function crewFailure(error){return error instanceof CrewMembershipError?Response.json({error:error.message,code:error.code},{status:error.status}):null;}
export function crewMemberMatches(row,scope,teamId,original=null){return Boolean(row&&typeof row.id==='string'&&ID.test(row.id)&&row.projectId===scope.projectId&&row.teamId===teamId&&typeof row.workerId==='string'&&ID.test(row.workerId)&&Object.hasOwn(CREW_ROLES,row.role)&&Number.isSafeInteger(row.revision)&&row.revision>=0&&row.worker&&typeof row.worker.name==='string'&&typeof row.worker.active==='boolean'&&['CURRENT','ENDED','SCHEDULED'].includes(row.state)&&(!original||row.id===original.id&&row.workerId===original.workerId&&row.revision>=original.revision));}
export function crewRosterMatches(body,scope,teamId,view){
  return Boolean(body?.context?.organizationId===scope.organizationId&&body.context.projectId===scope.projectId&&body.team?.id===teamId
    &&typeof body.team.name==='string'&&Number.isSafeInteger(body.team.revision)&&body.team.revision>=0&&['ACTIVE','ARCHIVED'].includes(body.team.status)
    &&Array.isArray(body.members)&&body.members.length<=50&&new Set(body.members.map(row=>row?.id)).size===body.members.length&&body.members.every(row=>crewMemberMatches(row,scope,teamId))
    &&Array.isArray(body.workers)&&body.workers.length<=100&&body.workers.every(row=>typeof row.id==='string'&&ID.test(row.id)&&typeof row.name==='string')
    &&typeof body.workersTruncated==='boolean'&&typeof body.writable==='boolean'&&['current','past','scheduled'].every(key=>Number.isSafeInteger(body.summary?.[key])&&body.summary[key]>=0)
    &&body.page?.view===view&&body.page.limit===50&&typeof body.page.hasMore==='boolean'&&(body.page.hasMore?typeof body.page.nextAfter==='string'&&body.page.nextAfter===body.members.at(-1)?.id:body.page.nextAfter===null));
}
