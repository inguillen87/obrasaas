import {WORKSPACE_NUMBER_MODES,WORKSPACE_USE_CASES,normalizeTenantWorkspace,tenantWorkspaceFromMetadata,workspaceAuthorizationState} from '../../../lib/whatsapp/tenant-workspace-policy.js';

const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const invalid=()=>Object.assign(new Error('No se pudo verificar la respuesta de esta preparación. Comprobá el mismo intento antes de reenviar.'),{code:'WHATSAPP_PREPARATION_RESPONSE_INVALID'});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const customerWhatsAppAccessDenied=error=>error?.status===401||error?.status===403||['WORKSPACE_CONTEXT_CHANGED','WORKSPACE_PROJECT_UNAVAILABLE','WORKSPACE_MEMBERSHIP_REQUIRED'].includes(error?.code);

// This validates a view of the canonical preparation, never Meta authorization.
// Run it inside the response consumer, before the recovery journal acknowledges.
export function customerWhatsAppSnapshot(result,{scope,projectId}){
  if(!object(result))throw invalid();
  if(result.scope!==scope||result.projectId!==projectId)throw Object.assign(new Error('La respuesta pertenece a otra obra o contexto. Volvé a comprobar el mismo intento con tu acceso vigente.'),{code:'WORKSPACE_CONTEXT_CHANGED',status:409});
  if(typeof result.companyName!=='string'||typeof result.projectName!=='string'||!['PROJECT','LEGACY_ORGANIZATION','NONE'].includes(result.profileSource))throw invalid();
 const p=result.profile;
 if(!object(p)||typeof p.configured!=='boolean')throw invalid();
 let canonical;
 try{canonical=p.configured?tenantWorkspaceFromMetadata({whatsappWorkspace:{...p,schemaVersion:1}}):tenantWorkspaceFromMetadata(null);}catch{throw invalid();}
 if(!Object.keys(canonical).every(key=>same(p[key],canonical[key]))||p.configured&&p.initialProjectId!==projectId)throw invalid();
 const options=result.options,r=result.readiness;
 if(!object(options)||!Array.isArray(options.numberModes)||!Array.isArray(options.useCases)||!same(options.numberModes,WORKSPACE_NUMBER_MODES)||!same(options.useCases,WORKSPACE_USE_CASES))throw invalid();
 const stepKeys=['PREPARATION','AUTHORIZATION','CONNECTION','TEMPLATES','ROUND_TRIP','FIELD_ACCEPTANCE'];
 const stepStates=[p.configured?'SAVED':'PENDING','NOT_VERIFIED',result.connection?'RECORD_PRESENT':'NOT_LINKED','NOT_VERIFIED','NOT_VERIFIED','NOT_VERIFIED'];
 if(!object(r)||r.operational!==false||r.canLaunchMeta!==false||r.asksForTokens!==false||r.customerOwnsAssets!==true||!Array.isArray(r.steps)||!same(r.steps.map(step=>step?.key),stepKeys)||!same(r.steps.map(step=>step?.state),stepStates)||r.steps.some(step=>typeof step.title!=='string'))throw invalid();
 if(result.connection!==null&&(!object(result.connection)||result.connection.recordPresent!==true||typeof result.connection.enabled!=='boolean'||typeof result.connection.storedStatus!=='string'||!(result.connection.displayNumber===null||typeof result.connection.displayNumber==='string')))throw invalid();
 return result;
}
export function customerWhatsAppResult(result,context,{kind='snapshot',command}={}){
 customerWhatsAppSnapshot(result,context);
 if(kind==='snapshot')return result;
 if(kind==='status'&&result.state==='NOT_OBSERVED'){
  if(result.definitive!==false||result.saved===true||result.receipt!==undefined)throw invalid();
  return result;
 }
 const receipt=result.receipt;
 if(kind==='status'&&result.state!=='RECORDED'||result.saved!==true||!object(receipt)||!/^wa_preparation_[a-f0-9]{64}$/.test(receipt.id)||!Number.isSafeInteger(receipt.savedRevision)||receipt.savedRevision<1||typeof result.savedProfileIsCurrent!=='boolean'||!result.profile.configured)throw invalid();
 if(result.savedProfileIsCurrent?result.profile.revision!==receipt.savedRevision:result.profile.revision<=receipt.savedRevision)throw invalid();
 if(kind==='save'){
  let normalized;try{normalized=normalizeTenantWorkspace(command.profile);}catch{throw invalid();}
  if(command.scope!==context.scope||command.projectId!==context.projectId||![normalized.expectedRevision,normalized.expectedRevision+1].includes(receipt.savedRevision))throw invalid();
  if(result.savedProfileIsCurrent&&!['assistantName','numberMode','initialProjectId','useCases'].every(key=>same(result.profile[key],normalized[key])))throw invalid();
 }
 return result;
}
export function customerWhatsAppNextStep(profile,projectId){
 const state=workspaceAuthorizationState(profile,projectId);
 return {message:state.allowed?'Preparación guardada. Consultá la conexión Meta para comprobar la autorización vigente, la recepción y la respuesta.':state.message,canConsultMeta:profile.configured&&profile.initialProjectId===projectId,requiresAssistance:state.code==='WORKSPACE_ASSISTED_ONBOARDING'};
}
