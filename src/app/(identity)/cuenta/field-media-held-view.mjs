const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,keys)=>record(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const operation=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
export function fieldMediaAttemptReference(value){
 if(!record(value)||value.action!=='PROCESS_EVIDENCE'||!id(value.projectId)||!hash(value.scope)||!operation(value.operationId)||!id(value.evidenceId))return null;
 return {projectId:value.projectId,scope:value.scope,operationId:value.operationId,action:value.action,evidenceId:value.evidenceId};
}
export function fieldMediaHeldOutcome(value,reference,{statusOnly=false}={}){
 const expected=fieldMediaAttemptReference(reference);
 if(!expected||!record(value)||value.state!=='PROVIDER_PENDING'||value.saved!==false||value.definitive!==false||value.retryAfterExpiration!==false||value.scope!==expected.scope||value.projectId!==expected.projectId||value.operationId!==expected.operationId||value.action!==expected.action||!['FIELD_MEDIA_PROVIDER_PENDING','ORGANIZATION_USAGE_COVERAGE_EXPIRED'].includes(value.code))return null;
 const common=['scope','projectId','operationId','action','saved','state','definitive','code','retryAfterExpiration'];
 if(statusOnly){if(!exact(value,[...common,'evidenceId','expiresAt','leaseExpired'])||value.evidenceId!==expected.evidenceId||!instant(value.expiresAt)||typeof value.leaseExpired!=='boolean')return null;}
 else {
  const evidence=value.evidence;
  if(!exact(value,[...common,'replayed','evidence'])||value.replayed!==false||!record(evidence)||evidence.id!==expected.evidenceId||evidence.status!=='PENDING'||evidence.review!==null||!record(evidence.processing)||evidence.processing.status!=='MANUAL_REVIEW_REQUIRED'||evidence.processing.code!==value.code||evidence.processing.humanReviewRequired!==true||typeof evidence.revision!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(evidence.revision)||!exact(evidence.media,['kind','contentType','bytes','sha256'])||!['image','audio','video'].includes(evidence.media.kind)||!hash(evidence.media.sha256)||!Number.isSafeInteger(evidence.media.bytes)||evidence.media.bytes<1||evidence.media.bytes>3*1024*1024)return null;
 }
 return {state:'PROVIDER_PENDING',code:value.code,retryAllowed:false,clearAttempt:false,receiptId:null,message:fieldMediaHeldMessage(value.code)};
}
export function fieldMediaHeldMessage(code='FIELD_MEDIA_PROVIDER_PENDING'){
 return code==='ORGANIZATION_USAGE_COVERAGE_EXPIRED'?'La cobertura de la empresa venció. Conservamos el original privado y la referencia del análisis; el responsable puede revisarlo manualmente. Consultá el estado antes de preparar otra solicitud.':'El proveedor todavía no confirmó este análisis. Conservamos el original privado y la referencia del mismo intento. Comprobá su estado; no se habilitó otro envío.';
}
export const fieldMediaEvidenceHeld=evidence=>evidence?.processing?.providerPending===true;
export const fieldMediaReviewEligible=evidence=>evidence?.status==='PENDING'&&(evidence.processing?.status!=='RUNNING'||evidence.processing.leaseExpired===true&&fieldMediaEvidenceHeld(evidence));
