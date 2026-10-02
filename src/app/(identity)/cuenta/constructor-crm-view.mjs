export const CRM_STAGE_LABELS=Object.freeze({NEW:'Nueva oportunidad',CONTACTED:'Contacto iniciado',QUALIFIED:'Necesidad confirmada',DEMO:'Presentación realizada',PROPOSAL:'Propuesta presentada',TRIAL:'Prueba acordada',WON:'Ganada',LOST:'No concretada'});
export const CRM_SEGMENT_LABELS=Object.freeze({ARCHITECTURE:'Arquitectura',CONSTRUCTION:'Construcción',REAL_ESTATE:'Inmobiliario',GOVERNMENT:'Sector público',INDUSTRIAL:'Industria',OTHER:'Otro'});
export const CRM_SOURCE_LABELS=Object.freeze({REFERRAL:'Recomendación',ORGANIC:'Consulta recibida',OUTBOUND:'Contacto propio',PARTNER:'Colaborador',EVENT:'Evento',OTHER:'Otro'});
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const text=(value,max)=>value===null||typeof value==='string'&&value.length<=max;
const fail=()=>{throw new Error('La respuesta no coincide con esta empresa o con el intento guardado. Conservamos su referencia.');};
function date(value){if(value===null)return true;if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const parsed=new Date(value+'T12:00:00.000Z');return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;}
export function constructorCrmRecord(value){
 if(!value||!id(value.id)||!Number.isSafeInteger(value.revision)||value.revision<1||typeof value.name!=='string'||value.name.length<2||value.name.length>120||!text(value.contactName,120)||!text(value.email,254)||!text(value.phone,40)||!text(value.notes,5000)||!Object.hasOwn(CRM_STAGE_LABELS,value.stage)||value.segment!==null&&!Object.hasOwn(CRM_SEGMENT_LABELS,value.segment)||value.source!==null&&!Object.hasOwn(CRM_SOURCE_LABELS,value.source)||!date(value.nextFollowUpOn))fail();
 return value;
}
export function constructorCrmSnapshot(value,context){
 const search=context.search??'',cursor=search?value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}~[a-f0-9]{64}$/.test(value):id;
 if(typeof search!=='string'||search.length>120||search!==search.trim()||/[\u0000-\u001f\u007f]/.test(search)||search&&(value?.search!==search)||value?.search!==undefined&&value.search!==search)fail();
 if(value?.scope!==context.scope||value.projectId!==context.projectId||value.canManage!==true||typeof value.organizationName!=='string'||!Array.isArray(value.records)||value.records.length>20||!Number.isSafeInteger(value.total)||value.total<0||value.nextCursor!==null&&!cursor(value.nextCursor))fail();
 value.records.forEach(constructorCrmRecord);if(new Set(value.records.map(row=>row.id)).size!==value.records.length||value.total<value.records.length)fail();return value;
}
export function constructorCrmOutcome(value,command){
 if(!uuid(command?.operationId)||value?.scope!==command.scope||value.projectId!==command.projectId)fail();
 if(value.state==='NOT_OBSERVED'&&value.saved===false&&value.definitive===false&&!value.receipt)return value;
 const receipt=value.receipt;
 if(value.state!=='RECORDED'||value.saved!==true||value.definitive!==true||!id(receipt?.id)||receipt.operationId!==command.operationId||!id(receipt.accountId)||!['CREATE','UPDATE'].includes(receipt.action)||!Number.isSafeInteger(receipt.revision)||receipt.revision<1||command.action&&receipt.action!==command.action||command.action==='UPDATE'&&receipt.accountId!==command.payload?.id)fail();
 if(value.record){constructorCrmRecord(value.record);if(value.record.id!==receipt.accountId||value.record.revision<receipt.revision)fail();}
 return value;
}
export const constructorCrmDraft=row=>Object.fromEntries(['name','contactName','email','phone','stage','segment','source','nextFollowUpOn','notes'].map(key=>[key,row?.[key]??(key==='stage'?'NEW':'')]));
export const constructorCrmPayload=draft=>Object.fromEntries(Object.entries(constructorCrmDraft(draft)).map(([key,value])=>[key,key==='name'||key==='stage'?value.trim():value.trim()||null]));
