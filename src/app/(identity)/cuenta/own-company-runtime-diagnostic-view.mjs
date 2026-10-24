import {ownCompanyNumberSnapshot} from './own-company-number-view.mjs';

const shape=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===keys.slice().sort().join('|');
const timestamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const contextKeys=['scope','projectId','organizationId','actorId','connectionId','channelRevision','credentialExpiresAt','sequence','reference'];
const resultKeys=['version','kind','readOnly','canManage','codeVerificationPresent','codeVerificationState','registered','platformState','displayComparable','displayMatchesExpected','observedAt','checkedAt','inspectionState','operationalCheck','denialStage','accepted','roundTrip'];
const fail=()=>{throw Object.assign(new Error('No se pudo comprobar el estado actual en Meta.'),{code:'META_OWN_COMPANY_DIAGNOSTIC_UNCONFIRMED'});};

// This DTO is an observation only. It never enters the setup snapshot or any
// command builder, and cannot enable connection, activation or templates.
export function ownCompanyRuntimeDiagnostic(value){
 if(!shape(value,resultKeys)||value.version!==1||value.kind!=='OWN_COMPANY_RUNTIME_DIAGNOSTIC'||value.readOnly!==true||value.canManage!==false||value.accepted!==false||value.roundTrip!=='NOT_VERIFIED'||value.inspectionState!=='CURRENT'||!['PASSED','REJECTED'].includes(value.operationalCheck)||!['NONE','VERIFICATION_STATUS','DISPLAY_PHONE_MATCH'].includes(value.denialStage)||!['VERIFIED','NOT_VERIFIED','EXPIRED','OTHER','MISSING'].includes(value.codeVerificationState)||!['CLOUD_API','NOT_APPLICABLE','OTHER','MISSING'].includes(value.platformState)||['codeVerificationPresent','registered','displayComparable','displayMatchesExpected'].some(key=>typeof value[key]!=='boolean')||!timestamp(value.observedAt)||!timestamp(value.checkedAt)||Date.parse(value.checkedAt)<Date.parse(value.observedAt)||Date.parse(value.checkedAt)-Date.parse(value.observedAt)>=60000)fail();
 if(value.codeVerificationPresent!==(value.codeVerificationState!=='MISSING')||value.registered&&value.platformState!=='CLOUD_API'||value.displayMatchesExpected&&!value.displayComparable)fail();
 if(value.operationalCheck==='PASSED'&&(value.denialStage!=='NONE'||value.codeVerificationState!=='VERIFIED'||!value.registered||value.platformState!=='CLOUD_API'||!value.displayMatchesExpected))fail();
 if(value.operationalCheck==='REJECTED'&&(value.denialStage==='NONE'||value.denialStage==='VERIFICATION_STATUS'&&value.codeVerificationState==='VERIFIED'||value.denialStage==='DISPLAY_PHONE_MATCH'&&(value.codeVerificationState!=='VERIFIED'||value.displayMatchesExpected)))fail();
 return Object.freeze(Object.fromEntries(resultKeys.map(key=>[key,value[key]])));
}

export function ownCompanyRuntimeDiagnosticContext(snapshot,expected,{sequence,reference=null,now=Date.now()}={}){
 ownCompanyNumberSnapshot(snapshot,expected);
 const channel=snapshot.channel,grant=snapshot.operationalGrant;
 if(!Number.isSafeInteger(sequence)||sequence<1||!Number.isSafeInteger(now)||snapshot.actor.role!=='ADMIN'||channel?.mode!=='COMPANY'||channel.enabled!==true||channel.connectionStatus!=='CONNECTED'||grant?.version!==2||grant.state!=='ACTIVE'||!timestamp(grant.credentialExpiresAt)||Date.parse(grant.credentialExpiresAt)<=now)fail();
 const referenceKey=reference===null?null:JSON.stringify([reference.version,reference.resource,reference.scope,reference.projectId,reference.operationId,reference.action,reference.connectionId,reference.createdAt]);
 return Object.freeze({scope:expected.scope,projectId:expected.projectId,organizationId:snapshot.organization.id,actorId:snapshot.actor.id,connectionId:channel.id,channelRevision:channel.revision,credentialExpiresAt:grant.credentialExpiresAt,sequence,reference:referenceKey});
}

export function ownCompanyRuntimeDiagnosticCurrent(captured,current){
 return Boolean(shape(captured,contextKeys)&&shape(current,contextKeys)&&contextKeys.every(key=>captured[key]===current[key]));
}

export function ownCompanyRuntimeDiagnosticAvailable(snapshot,expected,now=Date.now()){
 try{ownCompanyRuntimeDiagnosticContext(snapshot,expected,{sequence:1,now});return true;}catch{return false;}
}

export function ownCompanyRuntimeDiagnosticExplain(error){
 if(error?.code==='SESSION_REQUIRED'||error?.status===401)return 'Tu sesión terminó. Volvé a ingresar para consultar.';
 if(error?.name==='AbortError')return 'La comprobación se canceló. Podés volver a consultarla.';
 if(error?.code==='META_OWN_COMPANY_CONFIGURATION_PENDING')return 'La comprobación en Meta no está disponible en este momento.';
 if([401,403].includes(error?.status)||['WORKSPACE_CONTEXT_CHANGED','WORKSPACE_PROJECT_UNAVAILABLE','META_OWN_COMPANY_CONTEXT_CHANGED'].includes(error?.code))return 'No se pudo comprobar el estado con tu acceso actual. Volvé a consultar el número.';
 return 'No se pudo completar la comprobación. Podés volver a consultarla.';
}

export function ownCompanyRuntimeDiagnosticLabels(value){
 const diagnostic=ownCompanyRuntimeDiagnostic(value);
 return {verification:diagnostic.codeVerificationState==='VERIFIED'?'Verificación informada por Meta':diagnostic.codeVerificationState==='MISSING'?'Meta no informó la verificación':'Requiere revisión en Meta',registration:diagnostic.registered?'Registro informado por Meta':'Registro por revisar',platform:diagnostic.platformState==='CLOUD_API'?'Conexión en la nube':diagnostic.platformState==='MISSING'?'No informada por Meta':'Conexión por revisar',number:diagnostic.displayMatchesExpected?'Coincide con el número de la empresa':'No se pudo confirmar la coincidencia',summary:diagnostic.operationalCheck==='PASSED'?'Consulta completada':'Meta requiere revisión'};
}
