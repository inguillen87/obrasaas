const exact=(value,keys)=>Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|'));
const codes=new Set(['ORGANIZATION_USAGE_RESULT_PENDING','ORGANIZATION_USAGE_ALREADY_DISPATCHED']);
// A held provider operation is neither a completed KYC receipt nor permission
// to restart the analysis. Correlate it to the current private presentation.
export function participantOcrUsageHeld(value,command,{scope,projectId}={}){
 if(!/^[a-f0-9]{64}$/.test(scope||'')||! /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(projectId||'')||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(command?.operationId||'')||!['workerId','submissionId'].every(key=>typeof command?.payload?.[key]==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(command.payload[key])))return false;
 if(command.scope!==scope||command.projectId!==projectId)return false;
 if(command?.action!=='PROCESS_KYC'||!exact(value,['scope','projectId','operationId','action','state','saved','definitive','code','workerId','submissionId','retryAfterExpiration',...(Object.hasOwn(value||{},'usage')?['usage']:[])])||value.scope!==scope||value.projectId!==projectId||value.operationId!==command.operationId||value.action!=='PROCESS_KYC'||value.state!=='USAGE_HELD'||value.saved!==false||value.definitive!==false||!codes.has(value.code)||value.retryAfterExpiration!==false||value.workerId!==command.payload?.workerId||value.submissionId!==command.payload?.submissionId)return false;
 if(value.usage!==undefined&&(!exact(value.usage,['version','receiptId','state','coverageState'])||value.usage.version!==2||!/^organization_usage_[a-f0-9]{64}$/.test(value.usage.receiptId||'')||!['RESERVED','DISPATCHED','UNKNOWN','OBSERVED','UNMEASURED'].includes(value.usage.state)||!['TRIAL_CURRENT','PAID_PERIOD_OBSERVED','EXPIRED','UNCONFIRMED'].includes(value.usage.coverageState)))return false;
 return true;
}
export const participantOcrUsageHeldMessage='El archivo privado sigue guardado. Ya hay una consulta de IA registrada para esta presentación; comprobá el mismo intento o continuá con la revisión manual. No se volvió a enviar el documento.';
