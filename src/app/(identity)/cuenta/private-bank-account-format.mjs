// Browser-safe syntax validation only. This does not verify a bank or its holder.
export const PRIVATE_BANK_ACTIONS=Object.freeze(['SAVE_PRIVATE_BANK_ACCOUNT','REMOVE_PRIVATE_BANK_ACCOUNT']);
export const PRIVATE_BANK_NOTICE_VERSION='participant-private-bank-v1';
export const PRIVATE_BANK_NOTICE='Autorizo guardar en privado el CBU o CVU que declaro para mi participación en esta obra. Sólo mi cuenta aprobada puede consultar la referencia y corregirla o eliminarla. ObraSaaS comprueba únicamente el formato de 22 dígitos; no verifica titularidad, existencia de la cuenta ni realiza pagos.';
export function privateBankNumber(value){return typeof value==='string'&&/^[0-9]{22}$/.test(value)?value:null;}
export function privateBankType(value){return ['CBU','CVU'].includes(value)?value:null;}
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const scope=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const keys=(value,expected)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...expected].sort().join('|');
const invalid=()=>{throw new Error('No se pudo comprobar la referencia privada de esta operación.');};
export function validatePrivateBankSnapshot(value,context){
 if(!keys(value,['scope','organizationId','actorId','projectId','workerId','revision','bankRevision','state','type','last4','recordedAt','notice','formatOnly','ownershipVerified','paymentEnabled'])||value.scope!==context.scope||value.projectId!==context.projectId||value.workerId!==context.workerId||!scope(value.scope)||!id(value.organizationId)||!id(value.actorId)||context.actorId!==undefined&&value.actorId!==context.actorId||context.organizationId!==undefined&&value.organizationId!==context.organizationId||!id(value.workerId)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(value.revision||'')||!Number.isSafeInteger(value.bankRevision)||value.bankRevision<0||value.bankRevision>=2147483647||!['NOT_DECLARED','DECLARED','REMOVED'].includes(value.state)||value.formatOnly!==true||value.ownershipVerified!==false||value.paymentEnabled!==false||!keys(value.notice,['version','text'])||value.notice.version!==PRIVATE_BANK_NOTICE_VERSION||value.notice.text!==PRIVATE_BANK_NOTICE)invalid();
 if(value.state==='NOT_DECLARED'?(value.bankRevision!==0||value.recordedAt!==null):(value.bankRevision<1||typeof value.recordedAt!=='string'||!Number.isFinite(Date.parse(value.recordedAt))))invalid();
 if(value.state==='DECLARED'?(!privateBankType(value.type)||!/^\d{4}$/.test(value.last4||'')):(value.type!==null||value.last4!==null))invalid();
 return value;
}
export function validatePrivateBankOutcome(value,reference){
 if(!scope(reference?.scope)||!id(reference.projectId)||!id(reference.workerId)||!uuid(reference.operationId)||!PRIVATE_BANK_ACTIONS.includes(reference.action)||value?.scope!==reference.scope||value.projectId!==reference.projectId||value.workerId!==reference.workerId||value.operationId!==reference.operationId||value.action!==reference.action||!id(value.actorId)||!id(value.organizationId)||reference.actorId!==undefined&&value.actorId!==reference.actorId||reference.organizationId!==undefined&&value.organizationId!==reference.organizationId)invalid();
 if(value.state==='NOT_OBSERVED'){
  if(!keys(value,['scope','organizationId','actorId','projectId','workerId','action','operationId','state','saved','definitive'])||value.saved!==false||value.definitive!==false)invalid();return value;
 }
 const receipt=value.receipt;
 if(!keys(value,['scope','organizationId','actorId','projectId','operationId','action','workerId','state','saved','definitive','replayed','receipt'])||!['RECORDED','REJECTED','CANCELLED'].includes(value.state)||typeof value.replayed!=='boolean'||value.definitive!==true||value.saved!==(value.state==='RECORDED')||!keys(receipt,['id','organizationId','actorId','projectId','workerId','operationId','action','state','bankRevision','code'])||!/^participant_[a-f0-9]{64}$/.test(receipt.id||'')||!id(receipt.organizationId)||!id(receipt.actorId)||receipt.actorId!==value.actorId||receipt.organizationId!==value.organizationId||receipt.projectId!==value.projectId||receipt.workerId!==value.workerId||receipt.operationId!==value.operationId||receipt.action!==value.action||receipt.state!==value.state||!Number.isSafeInteger(receipt.bankRevision)||receipt.bankRevision<0||receipt.bankRevision>=2147483647)invalid();
 if(value.state==='RECORDED'?(receipt.code!==null||receipt.bankRevision<1):receipt.code!==(value.state==='CANCELLED'?'PARTICIPANT_BANK_ACCOUNT_CANCELLED':'PARTICIPANT_BANK_REVISION_CHANGED'))invalid();return value;
}
