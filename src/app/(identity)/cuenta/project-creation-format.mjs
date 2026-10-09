// Browser-safe projection. No organization, role or membership is accepted
// from the browser when the server creates an additional canonical project.
const keys=(value,expected)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...expected].sort().join('|');
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const scope=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const name=value=>typeof value==='string'&&value.length>=2&&value.length<=120&&value===value.trim().normalize('NFC')&&!/[\u0000-\u001f\u007f<>\u202a-\u202e\u2066-\u2069]/.test(value)&&!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value);
const fail=()=>{throw Object.assign(new Error('La respuesta no coincide con el alta de esta obra.'),{code:'PROJECT_CREATION_CONTEXT_CHANGED',status:409});};
export function projectCreationSnapshot(value,context){
 if(!keys(value,['scope','projectId','canCreate'])||!scope(value.scope)||value.scope!==context.scope||!id(value.projectId)||value.projectId!==context.projectId||value.canCreate!==true)fail();
 return structuredClone(value);
}
export function projectCreationReceiptOutcome(value,reference){
 if(!value||!scope(value.scope)||value.scope!==reference?.scope||!id(value.projectId)||value.projectId!==reference?.projectId||!uuid(value.operationId)||value.operationId!==reference?.operationId||value.action!=='CREATE_PROJECT')return null;
 const base=['scope','projectId','operationId','action','state','saved','created','definitive'];
 if(value.state==='NOT_OBSERVED')return keys(value,base)&&value.saved===false&&value.created===false&&value.definitive===false?{state:'NOT_OBSERVED'}:null;
 if(!keys(value,[...base,'receiptId','replayed','newProject'])||value.state!=='RECORDED'||value.saved!==true||value.created!==true||value.definitive!==true||!/^project_creation_[a-f0-9]{64}$/.test(value.receiptId||'')||typeof value.replayed!=='boolean'||!keys(value.newProject,['id','name','status'])||!id(value.newProject.id)||value.newProject.id===value.projectId||!name(value.newProject.name)||!['PLANNING','ACTIVE','PAUSED','COMPLETED','ARCHIVED'].includes(value.newProject.status))return null;
 return {state:'RECORDED',receiptId:value.receiptId};
}
export function projectCreationOutcome(value,reference){if(!projectCreationReceiptOutcome(value,reference))fail();return structuredClone(value);}
export const projectCreationReadDenied=error=>[401,403,404].includes(error?.status)||['WORKSPACE_CONTEXT_CHANGED','PROJECT_CREATION_OPERATION_CONTEXT_CHANGED','PROJECT_CREATION_CONTEXT_CHANGED'].includes(error?.code);
export async function readProjectCreationResponse(response,reference){
 let value;try{value=await response.json();}catch{if(response.ok)fail();}
 if(!response.ok){
  const fallback=response.status===401?'SESSION_REQUIRED':response.status===403?'PROJECT_CREATION_PERMISSION_REQUIRED':response.status===404?'WORKSPACE_PROJECT_UNAVAILABLE':'PROJECT_CREATION_UNCONFIRMED';
  const code=typeof value?.code==='string'&&/^[A-Z][A-Z0-9_]{0,79}$/.test(value.code)?value.code:fallback;
  throw Object.assign(new Error(code),{code,status:response.status});
 }
 // Validation belongs inside the lifecycle's consume callback. A malformed
 // response must never settle the pending receipt reference before the UI
 // checks its scope, origin, UUID and complete projection.
 return reference?.operationId?projectCreationOutcome(value,reference):projectCreationSnapshot(value,reference);
}
