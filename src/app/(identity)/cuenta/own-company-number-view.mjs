const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const scope=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const asset=value=>typeof value==='string'&&/^\d{5,32}$/.test(value);
const text=value=>typeof value==='string'&&value.length>0&&value.length<=512;
const revision=value=>Number.isInteger(value)&&value>=0&&value<=2147483647;
const shape=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===keys.slice().sort().join('|');
export const OWN_COMPANY_ACTIONS=Object.freeze(['CONNECT_OWN_NUMBER','ACTIVATE_OWN_NUMBER']);
export const OWN_COMPANY_STATES=Object.freeze({VERIFYING:'Verificación en curso',PROVIDER_STARTED:'Activación en curso',PROVIDER_UNKNOWN:'Resultado por comprobar',RECORDED:'Configuración registrada',REJECTED:'Decisión rechazada',NOT_OBSERVED:'Resultado todavía no observado'});
const messages={
 META_OWN_COMPANY_CONFIGURATION_PENDING:'La conexión del número propio todavía no está habilitada en este entorno. El responsable debe revisar su preparación.',
 META_OWN_COMPANY_UNAVAILABLE:'La ventana para configurar el número no está vigente. El responsable debe revisar una nueva autorización de configuración.',
 META_OWN_COMPANY_ADMIN_REQUIRED:'Sólo un administrador con acceso vigente puede configurar este número.',
 META_OWN_COMPANY_OWNER_UNVERIFIED:'No se pudo comprobar que este número pertenece a la empresa. Revisá su titularidad en Meta.',
 META_OWN_COMPANY_TOKEN_REJECTED:'Meta no autorizó la consulta. El responsable debe revisar el acceso de la empresa.',
 META_OWN_COMPANY_PHONE_REJECTED:'El número en Meta no coincide con el declarado por la empresa. Revisá ambos antes de continuar.',
 META_OWN_COMPANY_CONTEXT_CHANGED:'Cambió la empresa, el número o tu permiso. Volvé a consultar con tu acceso actual.',
 META_OWN_COMPANY_REVISION_CHANGED:'Otra persona cambió la conexión. Volvé a consultar y revisá una nueva decisión.',
 META_OWN_COMPANY_REPLACEMENT_REQUIRES_SUSPEND:'El canal actual debe estar suspendido antes de reemplazar su número.',
 META_OWN_COMPANY_REPLACEMENT_NOT_REQUIRED:'El número ya corresponde al canal consultado. Actualizá la consulta antes de continuar.',
 META_OWN_COMPANY_OPERATION_UNCERTAIN:'Hay una activación por comprobar. Consultá su resultado antes de otra decisión.',
 META_OWN_COMPANY_OPERATION_CONFLICT:'La referencia pertenece a otra decisión. Comprobá el intento guardado.',
 META_OWN_COMPANY_ASSET_IN_USE:'Este número o cuenta de WhatsApp ya tiene una conexión. El responsable debe revisar el canal existente.',
 META_OWN_COMPANY_ALREADY_CONNECTED:'Este número ya está conectado. Actualizá la consulta para revisar su estado.',
 META_OWN_COMPANY_SECURITY_PIN_REQUIRED:'Completá el registro del número en Meta y volvé a consultar. Esta pantalla no solicita un PIN.',
 META_OWN_COMPANY_INPUT_INVALID:'La decisión no coincide con la consulta vigente. Volvé a consultar el número.',
 SESSION_REQUIRED:'Tu sesión terminó. Volvé a ingresar.',
 WORKSPACE_CONTEXT_CHANGED:'Cambió tu organización o permiso. Volvé a consultar con tu acceso actual.',
 WORKSPACE_PROJECT_UNAVAILABLE:'Esta obra ya no está disponible con tus permisos actuales.',
};
export const ownCompanyNumberExplain=code=>messages[code]||'No se pudo confirmar el resultado. Comprobá el intento guardado o volvé a consultar.';
export const ownCompanyNumberAccessDenied=error=>[401,403].includes(error?.status)||['WORKSPACE_CONTEXT_CHANGED','WORKSPACE_PROJECT_UNAVAILABLE','META_OWN_COMPANY_CONTEXT_CHANGED'].includes(error?.code);
function fail(){throw Object.assign(new Error('La respuesta no permite confirmar este resultado.'),{code:'META_OWN_COMPANY_RESULT_UNCONFIRMED'});}
function context(value,expected){if(!scope(value?.scope)||value.scope!==expected.scope||!id(value.projectId)||value.projectId!==expected.projectId)throw Object.assign(new Error(ownCompanyNumberExplain('WORKSPACE_CONTEXT_CHANGED')),{code:'WORKSPACE_CONTEXT_CHANGED'});}
function identity(value,expected){
 if(!shape(value.organization,['id','name'])||!id(value.organization.id)||!text(value.organization.name)||!shape(value.actor,['id','role'])||!id(value.actor.id)||value.actor.role!=='ADMIN')fail();
 if(expected.organizationId&&value.organization.id!==expected.organizationId||expected.actorId&&value.actor.id!==expected.actorId)throw Object.assign(new Error(ownCompanyNumberExplain('WORKSPACE_CONTEXT_CHANGED')),{code:'WORKSPACE_CONTEXT_CHANGED'});
}
function channel(value,expected){
 if(!shape(value,['id','anchorProjectId','revision','mode','displayPhoneNumber','connectionStatus','enabled'])||!id(value.id)||value.anchorProjectId!==expected.projectId||!revision(value.revision)||!['PROJECT_ONLY','PREPARED','COMPANY','SUSPENDED'].includes(value.mode)||value.displayPhoneNumber!==null&&!text(value.displayPhoneNumber)||!['PENDING','CONNECTED','ERROR','DISCONNECTED'].includes(value.connectionStatus)||typeof value.enabled!=='boolean')fail();
 if(expected.connectionId&&value.id!==expected.connectionId)fail();
 return value;
}
export function ownCompanyNumberSnapshot(value,expected){
 context(value,expected);identity(value,expected);
 if(!shape(value,['organization','actor','scope','projectId','readOnly','canManage','mode','companyPhoneRevision','wabaId','phoneNumberId','displayPhoneNumber','verifiedBusinessName','registered','subscribed','expiresAt','channel','connectionMatchesAssets','connectionOwnVerified','accepted','roundTrip',...(Object.hasOwn(value,'operationalGrant')?['operationalGrant']:[])])||value.readOnly!==true||value.canManage!==true||value.mode!=='OWN_COMPANY'||!revision(value.companyPhoneRevision)||value.companyPhoneRevision<1||!asset(value.wabaId)||!asset(value.phoneNumberId)||!text(value.displayPhoneNumber)||value.verifiedBusinessName!==null&&!text(value.verifiedBusinessName)||typeof value.registered!=='boolean'||typeof value.subscribed!=='boolean'||typeof value.connectionMatchesAssets!=='boolean'||typeof value.connectionOwnVerified!=='boolean'||value.channel===null&&value.connectionMatchesAssets||value.connectionOwnVerified&&!value.connectionMatchesAssets||typeof value.expiresAt!=='string'||!Number.isFinite(Date.parse(value.expiresAt))||value.accepted!==false||value.roundTrip!=='NOT_VERIFIED')fail();
 if(value.channel!==null)channel(value.channel,expected);
 if(Object.hasOwn(value,'operationalGrant')){
  const grant=value.operationalGrant;
  if(!shape(grant,['version','state','credentialExpiresAt','roundTrip','fieldJourney'])||grant.version!==2||!['ACTIVE','REVOKED','EXPIRED','UNAVAILABLE'].includes(grant.state)||!(grant.credentialExpiresAt===null||typeof grant.credentialExpiresAt==='string'&&Number.isFinite(Date.parse(grant.credentialExpiresAt))&&new Date(grant.credentialExpiresAt).toISOString()===grant.credentialExpiresAt)||grant.roundTrip!=='NOT_VERIFIED'||grant.fieldJourney!=='NOT_VERIFIED'||!value.channel||grant.state==='ACTIVE'&&(!value.connectionOwnVerified||!value.channel.enabled||value.channel.connectionStatus!=='CONNECTED'||!value.registered||!value.subscribed||!grant.credentialExpiresAt))fail();
 }
 return value;
}
export const ownCompanyNumberFresh=(snapshot,now=Date.now())=>Boolean(snapshot?.canManage&&Date.parse(snapshot.expiresAt)>now);
export function ownCompanyNumberCanAct(snapshot,action,now=Date.now()){
 if(!ownCompanyNumberFresh(snapshot,now)||!OWN_COMPANY_ACTIONS.includes(action)||(snapshot.channel?.revision||0)>2147483645)return false;
 if(action==='CONNECT_OWN_NUMBER')return snapshot.channel===null||snapshot.connectionMatchesAssets&&!snapshot.connectionOwnVerified&&!snapshot.channel.enabled&&['PROJECT_ONLY','PREPARED','SUSPENDED'].includes(snapshot.channel.mode)||!snapshot.connectionMatchesAssets&&snapshot.channel.mode==='SUSPENDED';
 return Boolean(snapshot.registered&&snapshot.connectionOwnVerified&&snapshot.connectionMatchesAssets&&snapshot.channel&&!snapshot.channel.enabled&&snapshot.channel.connectionStatus==='PENDING'&&['PREPARED','SUSPENDED'].includes(snapshot.channel.mode));
}
export function ownCompanyNumberCommand(snapshot,draft,expected,{now=Date.now()}={}){
 ownCompanyNumberSnapshot(snapshot,expected);
 if(!ownCompanyNumberCanAct(snapshot,draft?.action,now)||draft.connectionId!==(snapshot.channel?.id||null)||draft.revision!==(snapshot.channel?.revision||0)||draft.companyPhoneRevision!==snapshot.companyPhoneRevision)throw Object.assign(new Error(ownCompanyNumberExplain('META_OWN_COMPANY_REVISION_CHANGED')),{code:'META_OWN_COMPANY_REVISION_CHANGED',requestDispatched:false});
 const replacement=draft.action==='CONNECT_OWN_NUMBER'&&snapshot.channel!==null&&!snapshot.connectionMatchesAssets;
 if(draft.confirmOwnBusiness!==true||replacement&&draft.confirmReplacement!==true||!replacement&&draft.confirmReplacement!==false)throw Object.assign(new Error('Revisá la empresa y el número y confirmá la decisión.'),{code:'META_OWN_COMPANY_INPUT_INVALID',requestDispatched:false});
 return {scope:expected.scope,projectId:expected.projectId,action:draft.action,payload:{connectionId:snapshot.channel?.id||null,revision:snapshot.channel?.revision||0,companyPhoneRevision:snapshot.companyPhoneRevision,wabaId:snapshot.wabaId,phoneNumberId:snapshot.phoneNumberId,confirmOwnBusiness:true,confirmReplacement:replacement,...(draft.action==='ACTIVATE_OWN_NUMBER'?{confirmRegistration:false,securityPin:null}:{})}};
}
export function ownCompanyNumberOutcome(value,expected,{post=false}={}){
 context(value,expected);identity(value,expected);
 if(!uuid(value.operationId)||value.operationId!==expected.operationId)fail();
 if(value.state==='NOT_OBSERVED'){
  if(post||value.saved!==false||value.definitive!==false||!shape(value,['actor','definitive','operationId','organization','projectId','saved','scope','state']))fail();
  return value;
 }
 const keys=['organization','actor','scope','projectId','operationId','action','state','saved','definitive','receiptId','replayed','channel','accepted','roundTrip',...(Object.hasOwn(value,'code')?['code']:[]),...(Object.hasOwn(value,'providerObservation')?['providerObservation']:[]),...(Object.hasOwn(value,'recovery')?['recovery']:[])];
 if(!shape(value,keys)||!OWN_COMPANY_ACTIONS.includes(value.action)||expected.action&&value.action!==expected.action||!id(value.receiptId)||typeof value.replayed!=='boolean'||value.accepted!==false||value.roundTrip!=='NOT_VERIFIED'||Object.hasOwn(value,'code')&&(typeof value.code!=='string'||!/^(META_OWN_COMPANY|COMPANY_CHANNEL)_[A-Z_]{1,80}$/.test(value.code)))fail();
 const terminal=['RECORDED','REJECTED'].includes(value.state);
 if(!Object.hasOwn(OWN_COMPANY_STATES,value.state)||value.definitive!==terminal||value.saved!==(value.state==='RECORDED')||value.state==='REJECTED'&&!value.code)fail();
 if(value.channel!==null)channel(value.channel,expected);else if(value.state==='RECORDED'||!terminal&&!(value.state==='VERIFYING'&&value.action==='CONNECT_OWN_NUMBER'&&expected.connectionId===null))fail();
 if(Object.hasOwn(value,'providerObservation')){
  const observation=value.providerObservation;if(post||terminal||!shape(observation,['registered','subscribed','readOnly'])||typeof observation.registered!=='boolean'||typeof observation.subscribed!=='boolean'||observation.readOnly!==true)fail();
 }
 if(Object.hasOwn(value,'recovery')&&(post||terminal||value.recovery!=='EXPLICIT_REVIEW_REQUIRED'))fail();
 return value;
}
