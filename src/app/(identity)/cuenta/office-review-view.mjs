const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
export function officeConnectionSnapshot(value){
 if(!exact(value,['version','connectionRef','wabaRef','phoneNumberRef','connectionStatus','enabled','mode','channelRevision','assignmentRevision','observedAt','evidenceOrigin'])||value.version!==1||!/^office_connection_[a-f0-9]{64}$/.test(value.connectionRef||'')||!/^office_waba_[a-f0-9]{64}$/.test(value.wabaRef||'')||!/^office_phone_[a-f0-9]{64}$/.test(value.phoneNumberRef||'')||value.connectionStatus!=='CONNECTED'||value.enabled!==true||value.mode!=='COMPANY'||!Number.isSafeInteger(value.channelRevision)||value.channelRevision<1||!Number.isSafeInteger(value.assignmentRevision)||value.assignmentRevision<1||!instant(value.observedAt)||new Date(value.observedAt).toISOString()!==value.observedAt||value.evidenceOrigin!=='STORED_AUTHORIZED_CONNECTION')throw new Error('La conexión compartida no cumple la proyección de lectura.');
 return value;
}
export function officeEventLabels(row){
 const processing={PENDING:'Pendiente de procesamiento',PROCESSED:'Procesado',FAILED:'Falló el procesamiento',UNCONFIRMED:'Procesamiento no confirmado'};
 const reply={NOT_OBSERVED:'No se observa una respuesta',PREPARED:'Respuesta preparada',SEND_STARTED:'Envío iniciado, sin confirmación',SEND_UNKNOWN:'Envío no confirmado',SENT:'Respuesta aceptada por Meta',STATUS_OBSERVED:'Estado recibido de Meta',REJECTED:'Respuesta rechazada',UNCONFIRMED:'Respuesta no confirmada'};
 const delivery={sent:'Enviado según Meta',delivered:'Entregado según Meta',read:'Leído según Meta',failed:'Fallo informado por Meta',deleted:'Eliminado según Meta'};
 return {processing:processing[row.processingState]||processing.UNCONFIRMED,reply:reply[row.replyState]||reply.UNCONFIRMED,delivery:delivery[row.deliveryStatus]||null};
}
export const officeAccessDenied=error=>[401,403,404].includes(error.status)||error.code==='WORKSPACE_CONTEXT_CHANGED'||error.code==='WORKSPACE_PROJECT_UNAVAILABLE';
export function officeReviewSnapshot(value,reference){
 if(!exact(value,['scope','projectId','projectName','readOnly','expiresAt','connection','canObserveConfiguration','items','canSend','canManage'])||value.scope!==reference.scope||value.projectId!==reference.projectId||typeof value.projectName!=='string'||value.readOnly!==true||value.canSend!==false||value.canManage!==false||!instant(value.expiresAt)||!Array.isArray(value.items)||value.items.length>20||typeof value.canObserveConfiguration!=='boolean'||value.canObserveConfiguration!==(value.connection!==null))throw new Error('La respuesta no acredita el acceso de lectura de esta obra.');
 if(value.connection!==null)officeConnectionSnapshot(value.connection);
 for(const row of value.items){if(!exact(row,['id','receivedAt','kind','signatureVerified','processingState','replyState','deliveryStatus'])||!/^customer_webhook_[a-f0-9]{64}$/.test(row.id||'')||!instant(row.receivedAt)||row.kind!=='GREETING'||row.signatureVerified!==true||!['PENDING','PROCESSED','FAILED','UNCONFIRMED'].includes(row.processingState)||!['NOT_OBSERVED','PREPARED','SEND_STARTED','SEND_UNKNOWN','SENT','STATUS_OBSERVED','REJECTED','UNCONFIRMED'].includes(row.replyState)||row.deliveryStatus!==null&&!['sent','delivered','read','failed','deleted'].includes(row.deliveryStatus))throw new Error('El evento de lectura no cumple la proyección privada.');}
 return value;
}
export function officeAdminSnapshot(value,reference){
 if(!value||value.scope!==reference.scope||value.projectId!==reference.projectId||value.canManage!==true||!Array.isArray(value.channels)||value.channels.length>1||!Array.isArray(value.invitations)||value.invitations.length>100||!Array.isArray(value.candidates)||value.candidates.length>20||typeof value.truncated!=='boolean'||typeof value.candidatesLimited!=='boolean'||value.channels.some(row=>!exact(row,['id'])||!id(row.id)))throw new Error('No se pudo verificar la gestión de acceso de esta obra.');
 if(value.invitations.some(row=>!exact(row,['id','email','state','expiresAt','connectionId','operationId','canShareConnection','connectionShared'])||!/^office_invite_[a-f0-9]{32}$/.test(row.id||'')||typeof row.email!=='string'||!instant(row.expiresAt)||!id(row.connectionId)||!['SENT','INVITATION_UNCONFIRMED','REVOKED'].includes(row.state)||typeof row.canShareConnection!=='boolean'||typeof row.connectionShared!=='boolean'))throw new Error('No se pudo comprobar el alcance de la invitación.');
 return value;
}
