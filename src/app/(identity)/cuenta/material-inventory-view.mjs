const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const revision=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(value);
const units=['unidad','m','m2','m3','kg','litro','bolsa'];
const quantity=value=>typeof value==='string'&&/^(?:0|[1-9]\d{0,10})\.\d{3}$/.test(value);
const text=value=>typeof value==='string'&&value.length>=2&&value.length<=160;
const actions=['ADD_MATERIAL','PROPOSE_CONSUMPTION','DECIDE_CONSUMPTION','REVERSE_CONSUMPTION'];
const fail=()=>{throw Object.assign(new Error('No se pudo confirmar este resultado. Conservamos la referencia del intento.'),{code:'INVENTORY_RESULT_UNCONFIRMED'});};
function context(value,expected){if(value?.scope!==expected.scope||value.projectId!==expected.projectId)throw Object.assign(new Error('Cambió el contexto de esta obra. Volvé a consultarla con tu acceso vigente.'),{code:'WORKSPACE_CONTEXT_CHANGED'});}
export const inventoryAccessDenied=error=>[401,403].includes(error?.status)||['WORKSPACE_CONTEXT_CHANGED','WORKSPACE_PROJECT_UNAVAILABLE'].includes(error?.code);
export function mergeInventoryRows(previous,incoming){const merged=new Map(previous.map(row=>[row.id,row]));for(const row of incoming){const old=merged.get(row.id);if(!old||!row.revision||row.revision>=old.revision)merged.set(row.id,row);}return [...merged.values()];}
export function inventoryState(value){
 if(value?.version!==1||!Number.isSafeInteger(value.catalogVersion)||value.catalogVersion<0||!hash(value.catalogHash)||value.catalogLimit!==200||typeof value.canManage!=='boolean'||!Array.isArray(value.materials)||value.materials.length>200||!Array.isArray(value.consumptions)||value.consumptions.length>100||typeof value.consumptionsTruncated!=='boolean'||value.nextConsumptionCursor!==null&&!id(value.nextConsumptionCursor)||!Array.isArray(value.movements)||value.movements.length>100||value.nextMovementCursor!==null&&!id(value.nextMovementCursor))fail();
 for(const m of value.materials)if(!id(m?.id)||!text(m.name)||!units.includes(m.unit)||typeof m.active!=='boolean'||!quantity(m.balance))fail();
 for(const c of value.consumptions)if(!id(c?.id)||!revision(c.revision)||!id(c.materialId)||!id(c.workerId)||!units.includes(c.unit)||!quantity(c.quantity)||!['PENDING','APPROVED','REJECTED','REVERSED'].includes(c.state)||typeof c.canDecide!=='boolean'||typeof c.canReverse!=='boolean'||!hash(c.catalogHash)||typeof c.reason!=='string')fail();
 for(const m of value.movements)if(!id(m?.id)||!id(m.materialId)||!quantity(m.quantity)||!units.includes(m.unit)||!['RECEIPT','CONSUMPTION','REVERSAL'].includes(m.kind)||!['IN','OUT'].includes(m.direction))fail();
 for(const rows of [value.materials,value.consumptions,value.movements])if(new Set(rows.map(r=>r.id)).size!==rows.length)fail();
 return value;
}
export function inventorySnapshot(value,expected,{history=false}={}){
 context(value,expected);inventoryState(value.inventory);
 if(expected.consumptionId&&(value.inventory.consumptions.length!==1||value.inventory.consumptions[0].id!==expected.consumptionId||value.inventory.nextConsumptionCursor!==null))fail();
 if(!history&&(!revision(value.projectRevision)||!Array.isArray(value.selfWorkers)||!Array.isArray(value.sectors)||value.selfWorkers.some(w=>!id(w?.id)||typeof w.name!=='string'||typeof w.canReport!=='boolean')||value.sectors.some(s=>!id(s?.id)||typeof s.name!=='string')))fail();
 return value;
}
export function inventoryOutcome(value,command,{recorded=false}={}){
 context(value,command);if(value.operationId!==command.operationId)fail();
 if(!recorded&&value.state==='NOT_OBSERVED'&&value.definitive===false&&!value.saved&&!value.receiptId)return value;
 if(value.state!=='RECORDED'||value.saved!==true||typeof value.replayed!=='boolean'||!/^field_[a-f0-9]{64}$/.test(value.receiptId||'')||value.action!==command.action||!actions.includes(value.action))fail();
 const target=command.payload?.proposalId;
 if(value.action==='ADD_MATERIAL'){if(value.kind!=='MATERIAL_ADDED'||!id(value.material?.id)||!units.includes(value.material.unit)||!quantity(value.material.balance)||!hash(value.catalogHash))fail();}
 else if(!id(value.consumption?.id)||target&&value.consumption.id!==target||value.kind!=={PROPOSE_CONSUMPTION:'CONSUMPTION_PROPOSAL',DECIDE_CONSUMPTION:'CONSUMPTION_DECISION',REVERSE_CONSUMPTION:'CONSUMPTION_REVERSED'}[value.action]||!['PENDING','APPROVED','REJECTED','REVERSED'].includes(value.consumption.state)||!quantity(value.consumption.quantity)||!units.includes(value.consumption.unit)||!id(value.consumption.materialId))fail();
 return value;
}
