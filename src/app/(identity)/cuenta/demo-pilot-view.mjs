const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const fail=()=>{throw new Error('La respuesta no confirma este piloto. Consultá el resultado antes de continuar.');};
export function demoPilotSnapshot(value,{scope,projectId}) {
 if(value?.scope!==scope||value.projectId!==projectId||value.purpose!=='DEMO_PILOT'||!['NOT_PREPARED','PREPARED','INACTIVE'].includes(value.state)||!Array.isArray(value.participants)||value.participants.length>2||!Array.isArray(value.events)||value.events.length>20||value.identityCertified!==false||value.humanAcceptance!=='NOT_VERIFIED'||value.callbackHealth!=='NOT_CONFIRMED'||typeof value.readiness?.canLaunchMeta!=='boolean'||!value.readiness.gates||value.notice?.version!=='demo-pilot-v1'||!/^[a-f0-9]{64}$/.test(value.notice.sha256||'')||typeof value.notice.text!=='string'||!value.notice.text.trim())fail();
 if(new Set(value.participants.map(row=>row.workerId)).size!==value.participants.length)fail();
 for(const row of value.participants)if(!id(row.workerId)||typeof row.name!=='string'||typeof row.revision!=='string'||!row.revision||typeof row.eligible!=='boolean')fail();
 for(const row of value.events)if(!/^demo_webhook_[a-f0-9]{64}$/.test(row.eventId)||typeof row.businessApplied!=='boolean'||typeof row.replySent!=='boolean')fail();
 if(value.state==='PREPARED'&&!Number.isFinite(Date.parse(value.expiresAt)))fail();
 return value;
}
export function demoPilotOutcome(value,command) {
 if(value?.scope!==command.scope||value.projectId!==command.projectId)fail();
 if(value.state==='NOT_OBSERVED'&&value.saved===false&&value.definitive===false&&!value.receipt)return value;
 const receipt=value.receipt;
 if(value.state!=='RECORDED'||value.saved!==true||value.identityCertified!==false||value.productionVerified!==false||!id(receipt?.id)||receipt.operationId!==command.operationId||receipt.action!==command.action||receipt.workerId!==command.payload.workerId||!id(receipt.channelId))fail();
 if(value.code!==undefined&&(command.action!=='REQUEST_CHALLENGE'||!/^VINCULAR [A-Za-z0-9_-]{43}$/.test(value.code)||value.participant?.workerId!==command.payload.workerId||!id(value.participant.challenge?.id)||!Number.isFinite(Date.parse(value.participant.challenge?.expiresAt))))fail();
 return value;
}
export const demoPilotReason=code=>({
 META_DEMO_CONFIGURATION_PENDING:'La configuración del número de prueba todavía necesita revisión técnica.',
 META_DEMO_PILOT_INACTIVE:'El piloto venció o fue revocado. Consultá su estado antes de preparar otro.',
 META_DEMO_PILOT_ALREADY_ACTIVE:'Ya hay un piloto vigente. Consultá su estado.',
 META_DEMO_PILOT_ALREADY_ASSIGNED:'El número de prueba ya está reservado para otra obra. El equipo técnico debe revisar esa reserva.',
 META_DEMO_EMPTY_PROJECT_REQUIRED:'Usá una obra vacía dedicada a pruebas, con tu participación como único integrante.',
 META_DEMO_COMMERCIAL_CHANNEL_PROTECTED:'Esta obra tiene una conexión de cliente. Elegí una obra dedicada a pruebas.',
 META_DEMO_RECIPIENT_NOT_ALLOWED:'Tu número todavía no está habilitado como destinatario del número de prueba de Meta.',
 WORKER_CHANNEL_KYC_REVIEW_REQUIRED:'Otro responsable debe aprobar tu documentación antes de vincular el número.',
 WORKER_CHANNEL_PERMISSION_REQUIRED:'Tu participación necesita permisos de campo vigentes.',
 WORKER_CHANNEL_PARTICIPANT_REQUIRED:'Tu cuenta necesita una participación propia y activa en esta obra.',
 WORKER_CHANNEL_REVISION_CHANGED:'Tu participación cambió. Consultá el estado y revisá nuevamente antes de continuar.',
 WORKER_CHANNEL_ALREADY_BOUND:'Tu número ya está vinculado. Consultá su estado antes de generar otro código.',
 META_DEMO_PILOT_MEMBER_REQUIRED:'El piloto requiere una cuenta administradora y tu propia participación habilitada.',
 WORKSPACE_CONTEXT_CHANGED:'Cambió tu acceso. Volvé a abrir la obra desde tu cuenta.',
 WORKSPACE_RECOVERY_REQUIRED:'Hay una operación pendiente en este navegador. Comprobá su recibo en Operaciones por comprobar.',
}[code]||'No se pudo confirmar el resultado. Consultá el recibo antes de repetir la operación.');
