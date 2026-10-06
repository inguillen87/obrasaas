const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const scope=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const text=value=>typeof value==='string'&&value.length>0&&value.length<=512;
const revision=value=>Number.isInteger(value)&&value>=0&&value<=2147483647;
export const COMPANY_CHANNEL_ACTIONS=Object.freeze(['PREPARE','ASSIGN','REVOKE','ACTIVATE','SUSPEND']);
export const COMPANY_CHANNEL_MODES=Object.freeze({PROJECT_ONLY:'Sólo la obra de origen',PREPARED:'Preparado para revisar',COMPANY:'Canal de la empresa activo',SUSPENDED:'Canal de la empresa suspendido'});
const messages={
 COMPANY_CHANNEL_CATALOG_REQUIRED:'No se pudo consultar el catálogo completo. Revisá el canal y sus obras antes de habilitarlo.',
 COMPANY_CHANNEL_ADMIN_REQUIRED:'Sólo un administrador con acceso vigente puede configurar este canal.',
 COMPANY_CHANNEL_CONNECTION_REQUIRED:'Esta conexión ya no está disponible con tus permisos.',
 COMPANY_CHANNEL_LEGACY_PENDING:'Hay registros anteriores pendientes. El responsable debe resolverlos antes de activar el canal de la empresa.',
 COMPANY_CHANNEL_ASSIGNMENT_CONFLICT:'La asignación tiene actividad o vínculos que requieren revisión. Consultá la obra y sus participantes antes de cambiarla.',
 COMPANY_CHANNEL_REVISION_CHANGED:'Otra persona cambió el canal. Consultá su estado vigente y revisá una nueva decisión.',
 COMPANY_CHANNEL_OPERATION_CONFLICT:'Esta referencia pertenece a otra solicitud. Comprobá su recibo antes de continuar.',
 COMPANY_CHANNEL_CONTEXT_CHANGED:'Cambió tu organización o permiso. Volvé a consultar con tu acceso actual.',
};
export const companyChannelExplain=code=>messages[code]||'No se pudo confirmar la operación. Conservamos la referencia para comprobarla.';
export const companyChannelAccessDenied=error=>[401,403].includes(error?.status)||['WORKSPACE_CONTEXT_CHANGED','WORKSPACE_PROJECT_UNAVAILABLE','COMPANY_CHANNEL_CONTEXT_CHANGED'].includes(error?.code);
function fail(){throw Object.assign(new Error('La respuesta no permite confirmar este resultado. Conservamos la referencia del intento.'),{code:'COMPANY_CHANNEL_RESULT_UNCONFIRMED'});}
function context(value,expected){if(!scope(value?.scope)||value.scope!==expected.scope||!id(value.projectId)||value.projectId!==expected.projectId)throw Object.assign(new Error('La respuesta no corresponde a la organización y obra seleccionadas.'),{code:'WORKSPACE_CONTEXT_CHANGED'});}
function identity(value,expected){
 if(!id(value.organization?.id)||!text(value.organization.name)||!id(value.actor?.id)||!text(value.actor.role))fail();
 if(expected.organizationId&&value.organization.id!==expected.organizationId||expected.actorId&&value.actor.id!==expected.actorId)fail();
}
function channel(value){
 if(!id(value?.id)||!id(value.anchorProjectId)||!text(value.anchorName)||value.displayPhoneNumber!==null&&!text(value.displayPhoneNumber)||!Object.hasOwn(COMPANY_CHANNEL_MODES,value.mode)||!revision(value.revision)||!Array.isArray(value.assignments)||value.assignments.length>100)fail();
 for(const assignment of value.assignments)if(!id(assignment?.projectId)||!text(assignment.projectName)||!['ACTIVE','REVOKED'].includes(assignment.status)||!revision(assignment.revision))fail();
 if(new Set(value.assignments.map(row=>row.projectId)).size!==value.assignments.length)fail();
 return value;
}
export function companyChannelSnapshot(value,expected){
 context(value,expected);identity(value,expected);
 if(typeof value.schemaReady!=='boolean'||typeof value.canManage!=='boolean'||value.canManage&&value.actor.role!=='ADMIN'||typeof value.truncated!=='boolean'||value.accepted!==false||!Array.isArray(value.channels)||value.channels.length>100||!Array.isArray(value.projects)||value.projects.length>100)fail();
 for(const item of value.channels)channel(item);
 if(!value.schemaReady&&value.channels.some(item=>item.mode!=='PROJECT_ONLY'||item.revision!==0||item.assignments.length))fail();
 for(const project of value.projects)if(!id(project?.id)||!text(project.name))fail();
 if(new Set(value.channels.map(row=>row.id)).size!==value.channels.length||new Set(value.projects.map(row=>row.id)).size!==value.projects.length)fail();
 const capabilities=value.capabilities;
 if(!capabilities||Object.keys(capabilities).sort().join('|')!=='attendance|flows|kyc|media|templates'||typeof capabilities.attendance!=='boolean'||['kyc','media','flows','templates'].some(key=>capabilities[key]!==false)||!value.schemaReady&&capabilities.attendance)fail();
 return value;
}
export function companyChannelCanAct(snapshot,item,action){
 if(!snapshot?.schemaReady||!snapshot.canManage||!item||!revision(item.revision)||item.revision>=2147483647||!COMPANY_CHANNEL_ACTIONS.includes(action)||snapshot.truncated&&['ASSIGN','ACTIVATE'].includes(action))return false;
 if(action==='PREPARE')return item.mode==='PROJECT_ONLY';
 if(action==='ACTIVATE')return ['PREPARED','SUSPENDED'].includes(item.mode);
 if(action==='SUSPEND')return item.mode==='COMPANY';
 return ['PREPARED','COMPANY','SUSPENDED'].includes(item.mode);
}
export function companyChannelCommand(snapshot,draft,expected){
 companyChannelSnapshot(snapshot,expected);
 const item=snapshot.channels.find(row=>row.id===draft?.connectionId);
 if(!companyChannelCanAct(snapshot,item,draft?.action)||draft.revision!==item.revision)throw Object.assign(new Error(companyChannelExplain('COMPANY_CHANNEL_REVISION_CHANGED')),{code:'COMPANY_CHANNEL_REVISION_CHANGED',requestDispatched:false});
 const needsTarget=['ASSIGN','REVOKE'].includes(draft.action),targetProjectId=needsTarget?draft.targetProjectId:null;
 if(needsTarget&&!snapshot.projects.some(project=>project.id===targetProjectId))throw Object.assign(new Error('Elegí una obra autorizada explícitamente antes de confirmar.'),{requestDispatched:false});
 const assignment=item.assignments.find(row=>row.projectId===targetProjectId);
 if(draft.action==='ASSIGN'&&assignment?.status==='ACTIVE'||draft.action==='REVOKE'&&assignment?.status!=='ACTIVE')throw Object.assign(new Error('Consultá la asignación vigente y revisá la obra elegida.'),{requestDispatched:false});
 return {scope:expected.scope,projectId:expected.projectId,action:draft.action,payload:{connectionId:item.id,revision:item.revision,targetProjectId}};
}
export function companyChannelOutcome(value,expected,{post=false}={}){
 context(value,expected);if(!uuid(value.operationId)||value.operationId!==expected.operationId)fail();
 identity(value,expected);
 if(value.state==='NOT_OBSERVED'){
  if(post||value.saved!==false||value.definitive!==false||Object.keys(value).sort().join('|')!=='actor|definitive|operationId|organization|projectId|saved|scope|state')fail();
  return value;
 }
 if(!COMPANY_CHANNEL_ACTIONS.includes(value.action)||expected.action&&value.action!==expected.action||!id(value.receiptId)||typeof value.replayed!=='boolean')fail();
 if(value.state==='REJECTED'){
  if(value.saved!==false||value.definitive!==true||typeof value.code!=='string'||!/^COMPANY_CHANNEL_[A-Z_]{1,80}$/.test(value.code))fail();
  if(value.channel!==undefined&&value.channel!==null){channel(value.channel);if(expected.connectionId&&value.channel.id!==expected.connectionId)fail();}
  return value;
 }
 if(value.state!=='RECORDED'||value.saved!==true||value.definitive!==true)fail();
 channel(value.channel);if(expected.connectionId&&value.channel.id!==expected.connectionId)fail();
 return value;
}
