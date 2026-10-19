const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const revision=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(value);
const units=['unidad','m','m2','m3','kg','litro','bolsa'];
const quantity=value=>typeof value==='string'&&/^(?:0|[1-9]\d{0,10})\.\d{3}$/.test(value);
const inputQuantity=value=>typeof value==='string'&&/^\d+(?:\.\d{1,3})?$/.test(value)?value.split('.')[0].replace(/^0+(?=\d)/,'')+'.'+(value.split('.')[1]||'').padEnd(3,'0'):null;
const text=value=>typeof value==='string'&&value.length>=2&&value.length<=160;
const actions=['ADD_MATERIAL','PROPOSE_CONSUMPTION','DECIDE_CONSUMPTION','REVERSE_CONSUMPTION','PROPOSE_STOCK_ADJUSTMENT','DECIDE_STOCK_ADJUSTMENT'];
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const adjustmentSource=value=>value&&(['OPENING','COUNT'].includes(value.type)?typeof value.reference==='string'&&value.reference.length>=2&&value.reference.length<=160:value.type==='RECEIPT'&&id(value.requestId)&&uuid(value.receiptOperationId));
const adjustmentValid=value=>id(value?.id)&&id(value.materialId)&&quantity(value.quantity)&&quantity(value.expectedBalance)&&units.includes(value.unit)&&['PENDING','APPROVED','REJECTED'].includes(value.state)&&['IN','OUT'].includes(value.direction)&&adjustmentSource(value.source)&&id(value.submittedBy)&&hash(value.catalogHash)&&typeof value.reason==='string';
const fail=()=>{throw Object.assign(new Error('No se pudo confirmar este resultado. Conservamos la referencia del intento.'),{code:'INVENTORY_RESULT_UNCONFIRMED'});};
const queryKeys=['afterConsumption','consumptionId','afterAdjustment','adjustmentId','afterMovement'];
export const INVENTORY_PENDING_EVENT='obrasaas:inventory-pending';
export function inventoryQuery(value={}){return Object.fromEntries(queryKeys.map(key=>[key,value[key]??null]));}
export function inventoryPendingCounts(value){const counts=value?.pendingCounts;return value?.canManage===true&&['PENDING','ALL'].includes(value.inventoryFilter)&&counts&&Object.keys(counts).sort().join('|')==='adjustments|consumptions'&&['consumptions','adjustments'].every(key=>Number.isSafeInteger(counts[key])&&counts[key]>=0)?counts:null;}
function context(value,expected){if(value?.scope!==expected.scope||value.projectId!==expected.projectId)throw Object.assign(new Error('Cambió el contexto de esta obra. Volvé a consultarla con tu acceso vigente.'),{code:'WORKSPACE_CONTEXT_CHANGED'});}
export const inventoryAccessDenied=error=>[401,403].includes(error?.status)||['WORKSPACE_CONTEXT_CHANGED','WORKSPACE_PROJECT_UNAVAILABLE'].includes(error?.code);
export function consumptionEvidenceViews(consumption){
 if(consumption?.evidenceIds===undefined&&consumption?.evidenceBindings===undefined)return [];
 const ids=consumption?.evidenceIds,bindings=consumption?.evidenceBindings;
 if(!Array.isArray(ids)||!ids.length||ids.length>10||new Set(ids).size!==ids.length||consumption.taskId!==null&&!id(consumption.taskId)||!Array.isArray(bindings)||bindings.length!==ids.length)fail();
 return bindings.map((binding,index)=>{
  const media=binding?.media;
  if(!id(ids[index])||binding?.id!==ids[index]||!['image','audio'].includes(media?.kind)||typeof media.contentType!=='string'||!media.contentType.startsWith(media.kind+'/')||!Number.isInteger(media.bytes)||media.bytes<1||media.bytes>3*1024*1024||!hash(media.sha256))fail();
  return {id:binding.id,revision:media.sha256,title:media.kind==='audio'?'Audio adjunto al consumo':'Foto adjunta al consumo',media:{kind:media.kind,contentType:media.contentType,bytes:media.bytes,sha256:media.sha256}};
 });
}
export function mergeInventoryRows(previous,incoming){const merged=new Map(previous.map(row=>[row.id,row]));for(const row of incoming){const old=merged.get(row.id);if(!old||!row.revision||row.revision>=old.revision)merged.set(row.id,row);}return [...merged.values()];}
export function inventoryVisiblePage(rows,page=0){const size=10,index=Math.min(Math.max(0,Number.isSafeInteger(page)?page:0),Math.max(0,Math.ceil(rows.length/size)-1)),start=index*size;return {rows:rows.slice(start,start+size),index,from:rows.length?start+1:0,to:Math.min(start+size,rows.length),hasPrevious:index>0,hasNext:start+size<rows.length};}
export function inventoryState(value){
 if(value?.version!==1||!Number.isSafeInteger(value.catalogVersion)||value.catalogVersion<0||!hash(value.catalogHash)||value.catalogLimit!==200||typeof value.canManage!=='boolean'||!Array.isArray(value.materials)||value.materials.length>200||!Array.isArray(value.consumptions)||value.consumptions.length>100||typeof value.consumptionsTruncated!=='boolean'||value.nextConsumptionCursor!==null&&!id(value.nextConsumptionCursor)||!Array.isArray(value.movements)||value.movements.length>100||value.nextMovementCursor!==null&&!id(value.nextMovementCursor))fail();
 for(const m of value.materials)if(!id(m?.id)||!text(m.name)||!units.includes(m.unit)||typeof m.active!=='boolean'||!quantity(m.balance))fail();
 for(const c of value.consumptions){if(!id(c?.id)||!revision(c.revision)||!id(c.materialId)||!id(c.workerId)||!units.includes(c.unit)||!quantity(c.quantity)||!['PENDING','APPROVED','REJECTED','REVERSED'].includes(c.state)||typeof c.canDecide!=='boolean'||typeof c.canReverse!=='boolean'||!hash(c.catalogHash)||typeof c.reason!=='string')fail();consumptionEvidenceViews(c);}
 if(!Array.isArray(value.adjustments)||value.adjustments.length>100||value.nextAdjustmentCursor!==null&&!id(value.nextAdjustmentCursor)||!Array.isArray(value.priorReceipts)||value.priorReceipts.length>100||typeof value.priorReceiptsTruncated!=='boolean')fail();
 for(const c of value.adjustments)if(!adjustmentValid(c)||!revision(c.revision)||typeof c.canDecide!=='boolean')fail();
 for(const r of value.priorReceipts)if(!id(r?.requestId)||!uuid(r.receiptOperationId)||!quantity(r.quantity)||!units.includes(r.unit)||typeof r.deliveryReference!=='string'||typeof r.materialLabel!=='string')fail();
 if(!value.canManage&&(value.adjustments.length||value.priorReceipts.length||value.nextAdjustmentCursor||value.priorReceiptsTruncated))fail();
 for(const m of value.movements)if(!id(m?.id)||!id(m.materialId)||!quantity(m.quantity)||!units.includes(m.unit)||!['RECEIPT','CONSUMPTION','REVERSAL','STOCK_ADJUSTMENT'].includes(m.kind)||!['IN','OUT'].includes(m.direction))fail();
 for(const rows of [value.materials,value.consumptions,value.movements,value.adjustments])if(new Set(rows.map(r=>r.id)).size!==rows.length)fail();
 if(new Set(value.priorReceipts.map(r=>r.requestId+':'+r.receiptOperationId)).size!==value.priorReceipts.length)fail();
 if(['inventoryFilter','pendingCounts','inventoryQuery'].some(key=>Object.hasOwn(value,key))){
  if(!inventoryPendingCounts(value)||!value.inventoryQuery||Object.keys(value.inventoryQuery).sort().join('|')!==[...queryKeys].sort().join('|')||queryKeys.some(key=>value.inventoryQuery[key]!==null&&!id(value.inventoryQuery[key])))fail();
  if(value.inventoryFilter==='PENDING'&&(value.consumptions.some(row=>row.state!=='PENDING')||value.adjustments.some(row=>row.state!=='PENDING')||value.inventoryQuery.consumptionId||value.inventoryQuery.adjustmentId))fail();
 }
 return value;
}
export function inventorySnapshot(value,expected,{history=false}={}){
 context(value,expected);inventoryState(value.inventory);
 if(expected.inventoryFilter){if(value.inventory.inventoryFilter!==expected.inventoryFilter||queryKeys.some(key=>value.inventory.inventoryQuery?.[key]!==inventoryQuery(expected)[key]))fail();}
 else if(Object.hasOwn(value.inventory,'inventoryFilter'))fail();
 if(expected.consumptionId&&(value.inventory.consumptions.length!==1||value.inventory.consumptions[0].id!==expected.consumptionId||value.inventory.nextConsumptionCursor!==null))fail();
 if(expected.adjustmentId&&(value.inventory.adjustments.length!==1||value.inventory.adjustments[0].id!==expected.adjustmentId||value.inventory.nextAdjustmentCursor!==null))fail();
 if(!history&&(!revision(value.projectRevision)||!Array.isArray(value.selfWorkers)||!Array.isArray(value.sectors)||value.selfWorkers.some(w=>!id(w?.id)||typeof w.name!=='string'||typeof w.canReport!=='boolean')||value.sectors.some(s=>!id(s?.id)||typeof s.name!=='string')))fail();
 return value;
}
export function mergeInventoryPage(previous,incoming,expected,kind){
 inventorySnapshot(incoming,expected,{history:true});context(previous,expected);
 const cursor={consumptions:'nextConsumptionCursor',adjustments:'nextAdjustmentCursor',movements:'nextMovementCursor'}[kind],queryKey={consumptions:'afterConsumption',adjustments:'afterAdjustment',movements:'afterMovement'}[kind];
 if(!cursor||!previous?.inventory||previous.inventory.inventoryFilter!==incoming.inventory.inventoryFilter||previous.inventory[cursor]!==expected[queryKey]||!expected[queryKey])fail();
 const rows=mergeInventoryRows(previous.inventory[kind],incoming.inventory[kind]);
 const head=items=>JSON.stringify(items.slice(0,100).map(row=>[row.id,row.revision]));
 if(incoming.inventory.inventoryFilter==='PENDING'&&['consumptions','adjustments'].some(key=>(kind===key?rows:previous.inventory[key]).length>incoming.inventory.pendingCounts[key]||kind!==key&&head(previous.inventory[key])!==head(incoming.inventory[key])))throw Object.assign(new Error('Cambió la cola mientras la recorrías. Consultamos de nuevo las primeras propuestas pendientes.'),{code:'INVENTORY_QUEUE_CHANGED'});
 return {...previous,inventory:{...incoming.inventory,consumptions:previous.inventory.consumptions,adjustments:previous.inventory.adjustments,movements:previous.inventory.movements,nextConsumptionCursor:previous.inventory.nextConsumptionCursor,nextAdjustmentCursor:previous.inventory.nextAdjustmentCursor,nextMovementCursor:previous.inventory.nextMovementCursor,[kind]:rows,[cursor]:incoming.inventory[cursor]}};
}
export function inventoryAfterRecorded(value,result){
 if(!value?.inventory)return value;
 const update=(rows,row)=>!row?rows:rows.flatMap(current=>current.id!==row.id?[current]:value.inventory.inventoryFilter==='PENDING'&&row.state!=='PENDING'?[]:[{...current,...row,canDecide:false,canReverse:false}]);
 return {...value,inventory:{...value.inventory,consumptions:update(value.inventory.consumptions,result.consumption),adjustments:update(value.inventory.adjustments,result.adjustment)}};
}
export function inventoryOutcome(value,command,{recorded=false}={}){
 context(value,command);if(value.operationId!==command.operationId)fail();
 if(!recorded&&value.state==='NOT_OBSERVED'&&value.definitive===false&&!value.saved&&!value.receiptId)return value;
 if(value.state!=='RECORDED'||value.saved!==true||typeof value.replayed!=='boolean'||!/^field_[a-f0-9]{64}$/.test(value.receiptId||'')||value.action!==command.action||!actions.includes(value.action))fail();
 const target=command.payload?.proposalId;
 if(value.action==='ADD_MATERIAL'){if(value.kind!=='MATERIAL_ADDED'||!id(value.material?.id)||!units.includes(value.material.unit)||!quantity(value.material.balance)||!hash(value.catalogHash))fail();}
 else if(['PROPOSE_STOCK_ADJUSTMENT','DECIDE_STOCK_ADJUSTMENT'].includes(value.action)){if(!adjustmentValid(value.adjustment)||target&&value.adjustment.id!==target||value.kind!==(value.action==='PROPOSE_STOCK_ADJUSTMENT'?'STOCK_ADJUSTMENT_PROPOSAL':'STOCK_ADJUSTMENT_DECISION')||command.payload?.materialId&&value.adjustment.materialId!==command.payload.materialId||command.payload?.quantity&&value.adjustment.quantity!==inputQuantity(command.payload.quantity))fail();}
 else if(!id(value.consumption?.id)||target&&value.consumption.id!==target||value.kind!=={PROPOSE_CONSUMPTION:'CONSUMPTION_PROPOSAL',DECIDE_CONSUMPTION:'CONSUMPTION_DECISION',REVERSE_CONSUMPTION:'CONSUMPTION_REVERSED'}[value.action]||!['PENDING','APPROVED','REJECTED','REVERSED'].includes(value.consumption.state)||!quantity(value.consumption.quantity)||!units.includes(value.consumption.unit)||!id(value.consumption.materialId))fail();
 return value;
}

// Read-only presentation of canonical inventory records. Missing historical
// metadata never becomes a fabricated actor, date, receipt or stock operation.
export function inventoryRecordedInstant(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value))return null;
 const time=Date.parse(value);if(!Number.isFinite(time))return null;
 const canonical=new Date(time).toISOString();return value===canonical||value===canonical.replace('.000Z','Z')?value:null;
}
const eventText=value=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=1000?value.trim():null;
const actorName=(value,actorId)=>actorId&&typeof value==='string'&&value.trim().length>=3&&value.trim().length<=160&&!/[\u0000-\u001f\u007f<>@]/.test(value)?value.trim():null;
function consumptionEvent(value,kind){
 const present=value&&typeof value==='object'&&!Array.isArray(value),actorId=present&&id(value.actorId)?value.actorId:null;
 const verdict=present&&['APPROVE','REJECT'].includes(value.decision)?value.decision:null,reason=present?eventText(value.reason):null,recordedAt=present?inventoryRecordedInstant(value.recordedAt):null,receiptId=present&&/^field_[a-f0-9]{64}$/.test(value.receiptId||'')?value.receiptId:null,confirmed=Boolean(actorId&&reason&&recordedAt&&receiptId&&(kind==='REVERSAL'||verdict));
 return {kind,title:kind==='REVERSAL'?confirmed?'Reversión registrada':'Reversión por comprobar':!confirmed?'Revisión por comprobar':verdict==='APPROVE'?'Aprobación registrada':'Rechazo registrado',confirmed,actorId,actorName:present?actorName(value.actorName,actorId):null,reason,recordedAt,receiptId,movementId:present&&/^inventory_move_[a-f0-9]{64}$/.test(value.movementId||'')?value.movementId:null,decision:verdict};
}
export function consumptionTraceability(consumption){
 const state=['PENDING','APPROVED','REJECTED','REVERSED'].includes(consumption?.state)?consumption.state:null,events=[];
 if(consumption?.decision||['APPROVED','REJECTED','REVERSED'].includes(state))events.push(consumptionEvent(consumption?.decision,'DECISION'));
 if(consumption?.reversal||state==='REVERSED')events.push(consumptionEvent(consumption?.reversal,'REVERSAL'));
 const explanation={PENDING:'Propuesta por revisar. Este informe todavía no descuenta stock.',APPROVED:'El consumo figura aprobado. La salida de stock corresponde a su aprobación.',REJECTED:'La propuesta fue rechazada. No registró una salida de stock.',REVERSED:'El consumo figura revertido. Se conservan la aprobación original y su reversión.'}[state]||'El estado de este consumo necesita comprobarse.';
 const reporterId=id(consumption?.submittedBy)?consumption.submittedBy:null;
 return {state,reference:id(consumption?.id)?consumption.id:null,proposalReceiptId:/^field_[a-f0-9]{64}$/.test(consumption?.proposalReceiptId||'')?consumption.proposalReceiptId:null,reporter:{actorId:reporterId,actorName:actorName(consumption?.actorName,reporterId)},explanation,events};
}
export function inventoryReceiptPresentation(value){
 if(value?.state!=='RECORDED'||value.saved!==true||!/^field_[a-f0-9]{64}$/.test(value.receiptId||'')||!actions.includes(value.action))return null;
 const kinds={ADD_MATERIAL:'MATERIAL_ADDED',PROPOSE_CONSUMPTION:'CONSUMPTION_PROPOSAL',DECIDE_CONSUMPTION:'CONSUMPTION_DECISION',REVERSE_CONSUMPTION:'CONSUMPTION_REVERSED',PROPOSE_STOCK_ADJUSTMENT:'STOCK_ADJUSTMENT_PROPOSAL',DECIDE_STOCK_ADJUSTMENT:'STOCK_ADJUSTMENT_DECISION'};
 if(value.kind!==kinds[value.action])return null;
 const titles={ADD_MATERIAL:'Material registrado',PROPOSE_CONSUMPTION:'Propuesta de consumo registrada',DECIDE_CONSUMPTION:'Revisión de consumo registrada',REVERSE_CONSUMPTION:'Reversión de consumo registrada',PROPOSE_STOCK_ADJUSTMENT:'Existencias propuestas',DECIDE_STOCK_ADJUSTMENT:'Revisión de existencias registrada'};
 const proposal=['PROPOSE_CONSUMPTION','PROPOSE_STOCK_ADJUSTMENT'].includes(value.action);
 const original=value.recordedConsumptionSnapshot,recordedState=id(original?.id)&&id(original.materialId)&&id(original.workerId)&&quantity(original.quantity)&&units.includes(original.unit)&&original.id===value.consumption?.id&&['materialId','workerId','quantity','unit'].every(key=>original[key]===value.consumption[key])&&['PENDING','APPROVED','REJECTED','REVERSED'].includes(original?.state)?original.state:null;
 return {receiptId:value.receiptId,title:titles[value.action],recordedState,explanation:proposal?'Este recibo confirma la creación de la propuesta; ese envío no descontó ni agregó stock. El estado vigente se consulta por separado.':'Este recibo confirma esa operación. El estado y saldo vigentes se muestran en la consulta de inventario.',consumptionId:id(value.consumption?.id)?value.consumption.id:null};
}
