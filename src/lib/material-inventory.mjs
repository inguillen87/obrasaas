import {WorkspaceError,digest,workspaceId} from './workspace-policy.mjs';
import {MATERIAL_UNITS,siteText} from './site-register-policy.mjs';
import {parseProcurementQuantity,formatProcurementQuantity,sumProcurementQuantities,subtractProcurementQuantities} from './procurement-quantity.js';

export const MATERIAL_CATALOG_LIMIT=200;
export const MATERIAL_INVENTORY_ACTIONS=['ADD_MATERIAL','PROPOSE_CONSUMPTION','DECIDE_CONSUMPTION','REVERSE_CONSUMPTION','PROPOSE_STOCK_ADJUSTMENT','DECIDE_STOCK_ADJUSTMENT'];
const fail=(code,status=409)=>{throw new WorkspaceError(code,status);};
export function inventoryQuantity(value,{allowZero=false}={}){try{if(typeof value!=='string'||value.length>20)fail('INVENTORY_QUANTITY_INVALID',400);return formatProcurementQuantity(parseProcurementQuantity(value,{allowZero}));}catch{fail('INVENTORY_QUANTITY_INVALID',400);}}
export function inventoryCatalog(project){
 const stored=project?.metadata?.materialInventory;if(!stored)return {version:1,catalogVersion:0,materials:[]};
 try{
  if(stored.version!==1||!Number.isSafeInteger(stored.catalogVersion)||stored.catalogVersion<1||!Array.isArray(stored.materials)||stored.materials.length>MATERIAL_CATALOG_LIMIT)fail('INVENTORY_INTEGRITY');
  if(new Set(stored.materials.map(m=>m.id)).size!==stored.materials.length)fail('INVENTORY_INTEGRITY');
  for(const m of stored.materials){if(!workspaceId(m.id)||!MATERIAL_UNITS.includes(m.unit)||typeof m.name!=='string'||siteText(m.name,160,2)!==m.name||typeof m.active!=='boolean'||inventoryQuantity(m.balance,{allowZero:true})!==m.balance)fail('INVENTORY_INTEGRITY');}
 }catch{fail('INVENTORY_INTEGRITY');}
 return structuredClone(stored);
}
export const inventoryCatalogHash=state=>digest(['material-catalog-v1',state.catalogVersion,state.materials.map(({id,name,unit,active})=>({id,name,unit,active}))]);
export function inventoryMaterial(state,id){const m=state.materials.find(m=>m.id===id&&m.active);if(!m)fail('INVENTORY_MATERIAL_UNAVAILABLE',404);return m;}
export function assertInventoryCatalog(state,hash){if(hash!==inventoryCatalogHash(state))fail('INVENTORY_CATALOG_CHANGED');}
export async function saveInventoryCatalog(client,member,project,state){
 const result=await client.query(`UPDATE public."Project" SET metadata=jsonb_set(COALESCE(metadata,'{}'::jsonb),'{materialInventory}',$3::jsonb,true),"updatedAt"=clock_timestamp() WHERE id=$1 AND "organizationId"=$2`,[project.id,member.organizationId,JSON.stringify(state)]);
 if(result.rowCount!==1)fail('INVENTORY_WRITE_UNCONFIRMED',503);project.metadata={...project.metadata,materialInventory:state};
}
export function changeInventoryBalance(material,quantity,direction){
 const current=parseProcurementQuantity(material.balance,{allowZero:true}),amount=parseProcurementQuantity(quantity);
 try{material.balance=formatProcurementQuantity(direction==='IN'?sumProcurementQuantities([current,amount]):subtractProcurementQuantities(current,amount));}
 catch(error){fail(error.code==='PROCUREMENT_QUANTITY_UNDERFLOW'?'INVENTORY_STOCK_INSUFFICIENT':'INVENTORY_BALANCE_OVERFLOW');}
}
export const inventoryMovementId=receiptId=>'inventory_move_'+digest(['material-movement-v1',receiptId]);
export async function recordInventoryMovement(client,member,project,receiptId,movement){
 const id=inventoryMovementId(receiptId),value={version:1,projectId:project.id,receiptId,...movement};
 await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'material.inventory.moved','Project',$4,$5::jsonb)`,[id,member.organizationId,member.actorId,project.id,JSON.stringify(value)]);
 return {id,...value};
}
// Called only inside the existing authorized purchase transaction and its Project
// lock. The receipt, purchase record, balance and movement commit together.
export async function receiveInventoryMaterial(client,member,project,command,request,purchaseReceiptId,at){
 const state=inventoryCatalog(project),p=command.payload;
 if(!state.catalogVersion&&!p.materialId&&!p.inventoryCatalogHash)return null;
 if(!p.materialId||!p.inventoryCatalogHash)fail('INVENTORY_RECEIPT_MATERIAL_REQUIRED');
 assertInventoryCatalog(state,p.inventoryCatalogHash);const material=inventoryMaterial(state,p.materialId);
 if(material.unit!==request.siteRegister.unit)fail('INVENTORY_UNIT_MISMATCH');
 const balanceBefore=material.balance;changeInventoryBalance(material,p.quantity,'IN');
 await saveInventoryCatalog(client,member,project,state);
 return recordInventoryMovement(client,member,project,purchaseReceiptId,{kind:'RECEIPT',direction:'IN',materialId:material.id,unit:material.unit,quantity:p.quantity,balanceBefore,balanceAfter:material.balance,catalogHash:p.inventoryCatalogHash,requestId:p.requestId,purchaseReceiptId,deliveryReference:p.deliveryReference,reason:p.reason,recordedAt:at});
}
export async function readInventory(client,member,project,{workerIds=[],reviewer=false,after=null,afterConsumption=null,consumptionId=null,afterAdjustment=null,adjustmentId=null}={}){
  if([after,afterConsumption,consumptionId,afterAdjustment,adjustmentId].some(value=>value!==null&&!workspaceId(value))||[after,afterConsumption,consumptionId,afterAdjustment,adjustmentId].filter(Boolean).length>1)fail('INVENTORY_QUERY_INVALID',400);
  if((afterAdjustment||adjustmentId)&&!reviewer)fail('INVENTORY_MANAGE_REQUIRED',403);
 const state=inventoryCatalog(project);
  if(!state.catalogVersion&&(after||afterConsumption||consumptionId||afterAdjustment||adjustmentId))fail('INVENTORY_CURSOR_UNAVAILABLE',404);
 if(afterConsumption||consumptionId){const cursor=(await client.query(`SELECT i.id FROM public."Incident" i JOIN public."Project" p ON p.id=i."projectId" AND p."organizationId"=$2 WHERE i.id=$1 AND i."projectId"=$3 AND i.metadata->'materialInventory'->>'version'='1' AND i.metadata->'materialInventory'->>'kind'='CONSUMPTION' AND ($4::boolean OR i.metadata->'materialInventory'->>'workerId'=ANY($5::text[]))`,[afterConsumption||consumptionId,member.organizationId,project.id,reviewer,workerIds])).rows;if(cursor.length!==1)fail('INVENTORY_CURSOR_UNAVAILABLE',404);}
 const proposals=(await client.query(`SELECT id,title,metadata,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."Incident" WHERE "projectId"=$1 AND metadata->'materialInventory'->>'version'='1' AND metadata->'materialInventory'->>'kind'='CONSUMPTION' AND ($2::boolean OR metadata->'materialInventory'->>'workerId'=ANY($3::text[])) AND ($4::text IS NULL OR ("createdAt",id)<(SELECT "createdAt",id FROM public."Incident" WHERE id=$4 AND "projectId"=$1)) AND ($5::text IS NULL OR id=$5) ORDER BY "createdAt" DESC,id DESC LIMIT 101`,[project.id,reviewer,workerIds,afterConsumption,consumptionId])).rows;
 if(reviewer&&after){const cursor=(await client.query(`SELECT id FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "entityType"='Project' AND "entityId"=$3 AND action='material.inventory.moved' AND metadata->>'projectId'=$3`,[after,member.organizationId,project.id])).rows;if(cursor.length!==1)fail('INVENTORY_CURSOR_UNAVAILABLE',404);}
 const movements=reviewer?(await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND "entityType"='Project' AND "entityId"=$2 AND action='material.inventory.moved' AND metadata->>'projectId'=$2 AND ($3::text IS NULL OR ("createdAt",id)<(SELECT "createdAt",id FROM public."AuditLog" WHERE id=$3 AND "organizationId"=$1 AND "entityType"='Project' AND "entityId"=$2 AND action='material.inventory.moved')) ORDER BY "createdAt" DESC,id DESC LIMIT 101`,[member.organizationId,project.id,after])).rows:[];
  if(afterAdjustment||adjustmentId){const cursor=(await client.query(`SELECT id FROM public."Incident" WHERE id=$1 AND "projectId"=$2 AND metadata->'materialInventory'->>'version'='1' AND metadata->'materialInventory'->>'kind'='STOCK_ADJUSTMENT'`,[afterAdjustment||adjustmentId,project.id])).rows;if(cursor.length!==1)fail('INVENTORY_CURSOR_UNAVAILABLE',404);}
  const adjustments=reviewer?(await client.query(`SELECT id,metadata,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."Incident" WHERE "projectId"=$1 AND metadata->'materialInventory'->>'version'='1' AND metadata->'materialInventory'->>'kind'='STOCK_ADJUSTMENT' AND ($2::text IS NULL OR ("createdAt",id)<(SELECT "createdAt",id FROM public."Incident" WHERE id=$2 AND "projectId"=$1)) AND ($3::text IS NULL OR id=$3) ORDER BY "createdAt" DESC,id DESC LIMIT 101`,[project.id,afterAdjustment,adjustmentId])).rows:[];
  // Old receipts stay immutable. This queue offers explicit incorporation, never
  // a second goods receipt; approved source bindings disappear from the queue.
  const priorReceipts=reviewer?(await client.query(`SELECT i.id AS "requestId",i.metadata->'siteRegister'->>'material' AS "materialLabel",i.metadata->'siteRegister'->>'unit' AS unit,r.value->>'operationId' AS "receiptOperationId",r.value->>'quantity' AS quantity,r.value->>'deliveryReference' AS "deliveryReference",r.value->>'at' AS "receivedAt" FROM public."Incident" i CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(i.metadata->'procurement'->'receipts')='array' THEN i.metadata->'procurement'->'receipts' ELSE '[]'::jsonb END) r(value) WHERE i."projectId"=$1 AND i.metadata->'siteRegister'->>'version'='1' AND i.metadata->'siteRegister'->>'type'='MATERIAL_REQUEST' AND i.metadata->'procurement'->>'version'='1' AND NOT (r.value ? 'materialId') AND NOT (r.value ? 'inventoryCatalogHash') AND NOT EXISTS(SELECT 1 FROM public."AuditLog" a WHERE a."organizationId"=$2 AND a."entityType"='Project' AND a."entityId"=$1 AND a.action='material.inventory.moved' AND a.metadata->'source'->>'type'='RECEIPT' AND a.metadata->'source'->>'requestId'=i.id AND a.metadata->'source'->>'receiptOperationId'=r.value->>'operationId') ORDER BY i."createdAt",i.id,r.value->>'operationId' LIMIT 101`,[project.id,member.organizationId])).rows:[];
  return {version:1,catalogVersion:state.catalogVersion,catalogHash:inventoryCatalogHash(state),catalogLimit:MATERIAL_CATALOG_LIMIT,materials:state.materials,canManage:reviewer,consumptions:proposals.slice(0,100).map(r=>({id:r.id,revision:r.revision,...r.metadata.materialInventory,canDecide:reviewer&&r.metadata.materialInventory.state==='PENDING'&&r.metadata.materialInventory.submittedBy!==member.actorId,canReverse:reviewer&&r.metadata.materialInventory.state==='APPROVED'&&r.metadata.materialInventory.decision?.actorId!==member.actorId})),consumptionsTruncated:proposals.length>100,nextConsumptionCursor:proposals.length>100?proposals[99].id:null,movements:movements.slice(0,100).map(r=>({id:r.id,...r.metadata})),nextMovementCursor:movements.length>100?movements[99].id:null,adjustments:adjustments.slice(0,100).map(r=>({...r.metadata.materialInventory,id:r.id,revision:r.revision,canDecide:r.metadata.materialInventory.state==='PENDING'&&r.metadata.materialInventory.submittedBy!==member.actorId})),nextAdjustmentCursor:adjustments.length>100?adjustments[99].id:null,priorReceipts:priorReceipts.slice(0,100),priorReceiptsTruncated:priorReceipts.length>100};
}
export async function readConsumption(client,projectId,id,lock=false){
 const row=(await client.query(`SELECT id,metadata,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."Incident" WHERE id=$1 AND "projectId"=$2 ${lock?'FOR UPDATE':''}`,[id,projectId])).rows[0],c=row?.metadata?.materialInventory;
 if(c?.version!==1||c.kind!=='CONSUMPTION'||!workspaceId(c.materialId)||!workspaceId(c.workerId)||!workspaceId(c.submittedBy)||!['PENDING','APPROVED','REJECTED','REVERSED'].includes(c.state))fail('INVENTORY_CONSUMPTION_UNAVAILABLE',404);
 return {row,consumption:{id:row.id,revision:row.revision,...c}};
}
export async function readStockAdjustment(client,projectId,id,lock=false){
  const row=(await client.query(`SELECT id,metadata,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."Incident" WHERE id=$1 AND "projectId"=$2 ${lock?'FOR UPDATE':''}`,[id,projectId])).rows[0],c=row?.metadata?.materialInventory;
  if(c?.version!==1||c.kind!=='STOCK_ADJUSTMENT'||!workspaceId(c.materialId)||!workspaceId(c.submittedBy)||!['PENDING','APPROVED','REJECTED'].includes(c.state)||!['IN','OUT'].includes(c.direction)||!['OPENING','COUNT','RECEIPT'].includes(c.source?.type))fail('INVENTORY_ADJUSTMENT_UNAVAILABLE',404);
  inventoryQuantity(c.quantity);inventoryQuantity(c.expectedBalance,{allowZero:true});
  return {row,adjustment:{...c,id:row.id,revision:row.revision}};
}
// Access revocation locks the target account before a project. Approval takes
// that same order, then re-reads the proposal inside the canonical Project lock.
export async function lockStockAdjustmentProposer(client,member,projectId,proposalId){
  const active=(await client.query(`SELECT m.id FROM public."Incident" i JOIN public."Project" p ON p.id=i."projectId" JOIN public."PlatformUser" u ON u.id=i.metadata->'materialInventory'->>'submittedBy' JOIN public."TenantMembership" m ON m."userId"=u.id AND m."organizationId"=p."organizationId" WHERE i.id=$1 AND i."projectId"=$2 AND p."organizationId"=$3 AND i.metadata->'materialInventory'->>'version'='1' AND i.metadata->'materialInventory'->>'kind'='STOCK_ADJUSTMENT' AND m.status='ACTIVE' AND m."tenantRole"::text IN ('ADMIN','DIRECTOR') FOR SHARE OF m,u`,[proposalId,projectId,member.organizationId])).rows;
  if(active.length!==1)fail('INVENTORY_PROPOSER_ACCESS_REQUIRED',403);
}
async function assertAdjustmentSource(client,member,project,material,input){
  const source=input.source;
  if(source.type==='COUNT')return source;
  if(source.type==='OPENING'){
    const moved=(await client.query(`SELECT id FROM public."AuditLog" WHERE "organizationId"=$1 AND "entityType"='Project' AND "entityId"=$2 AND action='material.inventory.moved' AND metadata->>'materialId'=$3 LIMIT 1`,[member.organizationId,project.id,material.id])).rows;
    if(material.balance!=='0.000'||moved.length)fail('INVENTORY_OPENING_ALREADY_RECORDED');return source;
  }
  const found=(await client.query(`SELECT metadata FROM public."Incident" WHERE id=$1 AND "projectId"=$2`,[source.requestId,project.id])).rows[0]?.metadata;
  const receipts=found?.procurement?.receipts,receipt=Array.isArray(receipts)?receipts.filter(r=>r.operationId===source.receiptOperationId):[];
  if(found?.siteRegister?.version!==1||found.siteRegister.type!=='MATERIAL_REQUEST'||found.procurement?.version!==1||receipt.length!==1)fail('INVENTORY_PRIOR_RECEIPT_UNAVAILABLE',404);
  const r=receipt[0];if(r.materialId||r.inventoryCatalogHash||found.siteRegister.unit!==material.unit||input.direction!=='IN'||inventoryQuantity(r.quantity)!==input.quantity)fail('INVENTORY_PRIOR_RECEIPT_MISMATCH');
  const recorded=(await client.query(`SELECT id FROM public."AuditLog" WHERE "organizationId"=$1 AND "entityType"='Incident' AND "entityId"=$2 AND action='site.purchase.changed' AND metadata->>'projectId'=$3 AND metadata->>'command'='RECEIVE_MATERIAL' AND metadata->'stockLedgerChanged'='false'::jsonb AND EXISTS(SELECT 1 FROM jsonb_array_elements(metadata->'after'->'receipts') v WHERE v->>'operationId'=$4) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(metadata->'before'->'receipts','[]'::jsonb)) v WHERE v->>'operationId'=$4) LIMIT 2`,[member.organizationId,source.requestId,project.id,source.receiptOperationId])).rows;
  if(recorded.length!==1)fail('INVENTORY_PRIOR_RECEIPT_UNCONFIRMED');
  const incorporated=(await client.query(`SELECT id FROM public."AuditLog" WHERE "organizationId"=$1 AND "entityType"='Project' AND "entityId"=$2 AND action='material.inventory.moved' AND metadata->'source'->>'type'='RECEIPT' AND metadata->'source'->>'requestId'=$3 AND metadata->'source'->>'receiptOperationId'=$4 LIMIT 1`,[member.organizationId,project.id,source.requestId,source.receiptOperationId])).rows;
  if(incorporated.length)fail('INVENTORY_PRIOR_RECEIPT_ALREADY_INCORPORATED');
  return {...source,purchaseReceiptId:recorded[0].id,deliveryReference:r.deliveryReference,receivedAt:r.at};
}
// Transaction composition for the existing field store. Authentication, current
// membership, assignment and the Project lock remain its canonical responsibility.
export async function applyInventoryFieldAction({client,member,session,project,command,receiptId,at,assertWorker,assertTask}){
 const p=command.payload,state=inventoryCatalog(project),manage=['ADMIN','DIRECTOR'].includes(member.role);
 assertInventoryCatalog(state,p.catalogHash);
 if(command.action==='ADD_MATERIAL'){
  if(!manage)fail('INVENTORY_MANAGE_REQUIRED',403);
  const current=(await client.query(`SELECT to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."Project" WHERE id=$1 AND "organizationId"=$2`,[project.id,member.organizationId])).rows[0];if(current.revision!==p.revision)fail('FIELD_REVISION_CHANGED');
  if(state.materials.length>=MATERIAL_CATALOG_LIMIT)fail('INVENTORY_CATALOG_LIMIT');
  const material={id:'material_'+digest([project.id,member.actorId,command.operationId]).slice(0,32),name:p.name,unit:p.unit,active:true,balance:'0.000'};state.materials.push(material);state.catalogVersion++;await saveInventoryCatalog(client,member,project,state);
  return {kind:'MATERIAL_ADDED',material,catalogHash:inventoryCatalogHash(state),stockChanged:false};
 }
  if(['PROPOSE_STOCK_ADJUSTMENT','DECIDE_STOCK_ADJUSTMENT'].includes(command.action)){
    if(!manage)fail('INVENTORY_MANAGE_REQUIRED',403);
    if(member.channelProof)fail('INVENTORY_ADJUSTMENT_WEB_ONLY',403);
    if(command.action==='PROPOSE_STOCK_ADJUSTMENT'){
      const material=inventoryMaterial(state,p.materialId),source=await assertAdjustmentSource(client,member,project,material,p);
      const id='stock_adjustment_'+digest([project.id,member.actorId,command.operationId]).slice(0,32),details={version:1,kind:'STOCK_ADJUSTMENT',state:'PENDING',materialId:material.id,unit:material.unit,quantity:p.quantity,direction:p.direction,source,expectedBalance:material.balance,catalogHash:p.catalogHash,reason:p.reason,submittedBy:member.actorId,submittedAt:at,decision:null};
      await client.query(`INSERT INTO public."Incident"(id,"projectId",title,description,severity,status,reporter,metadata,"updatedAt") VALUES($1,$2,$3,$4,'INFO','open',$5,$6::jsonb,clock_timestamp())`,[id,project.id,'Existencias de '+material.name,p.reason,member.actorId,JSON.stringify({materialInventory:details})]);
      return {kind:'STOCK_ADJUSTMENT_PROPOSAL',adjustment:(await readStockAdjustment(client,project.id,id)).adjustment,stockChanged:false};
    }
    const {row,adjustment:c}=await readStockAdjustment(client,project.id,p.proposalId,true);
    if(row.revision!==p.revision)fail('FIELD_REVISION_CHANGED');if(c.state!=='PENDING')fail('INVENTORY_ALREADY_DECIDED');if(c.submittedBy===member.actorId)fail('FIELD_MAKER_CHECKER_REQUIRED',403);
    const next={...row.metadata.materialInventory,state:p.decision==='APPROVE'?'APPROVED':'REJECTED',decision:{decision:p.decision,actorId:member.actorId,reason:p.reason,recordedAt:at,receiptId}};let movement=null;
    if(p.decision==='APPROVE'){
      if(c.catalogHash!==p.catalogHash)fail('INVENTORY_CATALOG_CHANGED');const material=inventoryMaterial(state,c.materialId);if(c.unit!==material.unit)fail('INVENTORY_UNIT_MISMATCH');
      const active=(await client.query(`SELECT m.id FROM public."TenantMembership" m JOIN public."PlatformUser" u ON u.id=m."userId" WHERE m."organizationId"=$1 AND u.id=$2 AND m.status='ACTIVE' AND m."tenantRole"::text IN ('ADMIN','DIRECTOR')`,[member.organizationId,c.submittedBy])).rows;if(active.length!==1)fail('INVENTORY_PROPOSER_ACCESS_REQUIRED',403);
      const source=await assertAdjustmentSource(client,member,project,material,c);if(material.balance!==c.expectedBalance)fail('INVENTORY_BALANCE_CHANGED');
      const balanceBefore=material.balance;changeInventoryBalance(material,c.quantity,c.direction);await saveInventoryCatalog(client,member,project,state);
      movement=await recordInventoryMovement(client,member,project,receiptId,{kind:'STOCK_ADJUSTMENT',direction:c.direction,materialId:material.id,unit:material.unit,quantity:c.quantity,balanceBefore,balanceAfter:material.balance,proposalId:row.id,catalogHash:p.catalogHash,source,submittedBy:c.submittedBy,reason:p.reason,recordedAt:at});next.decision.movementId=movement.id;
    }
    await client.query(`UPDATE public."Incident" SET metadata=$3::jsonb,status=$4,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[row.id,project.id,JSON.stringify({...row.metadata,materialInventory:next}),next.state==='REJECTED'?'rejected':'resolved']);
    return {kind:'STOCK_ADJUSTMENT_DECISION',adjustment:(await readStockAdjustment(client,project.id,row.id)).adjustment,stockChanged:Boolean(movement),...(movement?{movement}:{})};
  }
 if(command.action==='PROPOSE_CONSUMPTION'){
  await assertWorker(client,member,session,project.id,p.workerId,'report');const material=inventoryMaterial(state,p.materialId),sector=project.metadata?.fieldOperations?.sectors?.find(s=>s.id===p.sectorId);if(!sector)fail('FIELD_SECTOR_UNAVAILABLE',404);if(p.taskId!==null)await assertTask(client,project.id,p.taskId);
  const id='consumption_'+digest([project.id,member.actorId,command.operationId]).slice(0,32),details={version:1,kind:'CONSUMPTION',state:'PENDING',materialId:material.id,unit:material.unit,quantity:p.quantity,catalogHash:p.catalogHash,workerId:p.workerId,taskId:p.taskId,sectorId:p.sectorId,reason:p.reason,submittedBy:member.actorId,submittedAt:at,source:member.channelProof?'participant-whatsapp':'participant-field',decision:null,reversal:null};
  await client.query(`INSERT INTO public."Incident"(id,"projectId",title,description,severity,status,reporter,metadata,"updatedAt") VALUES($1,$2,$3,$4,'INFO','open',$5,$6::jsonb,clock_timestamp())`,[id,project.id,'Consumo de '+material.name,p.reason,member.actorId,JSON.stringify({materialInventory:details})]);
  return {kind:'CONSUMPTION_PROPOSAL',consumption:(await readConsumption(client,project.id,id)).consumption,stockChanged:false};
 }
 if(!manage)fail('INVENTORY_MANAGE_REQUIRED',403);
 const {row,consumption:c}=await readConsumption(client,project.id,p.proposalId,true);if(row.revision!==p.revision)fail('FIELD_REVISION_CHANGED');const material=inventoryMaterial(state,c.materialId);if(c.unit!==material.unit)fail('INVENTORY_UNIT_MISMATCH');
 const next={...row.metadata.materialInventory};let movement=null;
 if(command.action==='DECIDE_CONSUMPTION'){
  if(c.state!=='PENDING')fail('INVENTORY_ALREADY_DECIDED');if(p.decision==='APPROVE'&&c.catalogHash!==p.catalogHash)fail('INVENTORY_CATALOG_CHANGED');if(c.submittedBy===member.actorId)fail('FIELD_MAKER_CHECKER_REQUIRED',403);
  next.state=p.decision==='APPROVE'?'APPROVED':'REJECTED';next.decision={decision:p.decision,actorId:member.actorId,reason:p.reason,recordedAt:at,receiptId};
  if(p.decision==='APPROVE'){
   const active=(await client.query(`SELECT w.id FROM public."Worker" w JOIN public."PlatformUser" u ON u."clerkUserId"=w.metadata->'participant'->>'clerkUserId' JOIN public."TenantMembership" tm ON tm."userId"=u.id AND tm."organizationId"=$2 AND tm.status='ACTIVE' JOIN public."ProjectMembership" pm ON pm."tenantMembershipId"=tm.id AND pm."projectId"=w."projectId" AND pm.status='ACTIVE' WHERE w.id=$3 AND w."projectId"=$1 AND u.id=$4 AND w.active=true AND w.metadata->'participant'->>'status'='ACTIVE' AND w.metadata->'participant'->'kyc'->>'status'='APPROVED' AND w.metadata->'participant'->'permissions'->>'report'='true' FOR SHARE OF w,u,tm,pm`,[project.id,member.organizationId,c.workerId,c.submittedBy])).rows;if(active.length!==1)fail('FIELD_PARTICIPANT_REQUIRED',403);
   const balanceBefore=material.balance;changeInventoryBalance(material,c.quantity,'OUT');await saveInventoryCatalog(client,member,project,state);movement=await recordInventoryMovement(client,member,project,receiptId,{kind:'CONSUMPTION',direction:'OUT',materialId:material.id,unit:material.unit,quantity:c.quantity,balanceBefore,balanceAfter:material.balance,proposalId:row.id,catalogHash:p.catalogHash,submittedBy:c.submittedBy,reason:p.reason,recordedAt:at});next.decision.movementId=movement.id;
  }
 }else{
  if(c.state!=='APPROVED'||c.reversal||!c.decision?.movementId||!c.decision?.receiptId)fail('INVENTORY_REVERSAL_UNAVAILABLE');if(c.decision.actorId===member.actorId)fail('INVENTORY_REVERSAL_DISTINCT_REVIEWER_REQUIRED',403);
  const original=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "entityType"='Project' AND "entityId"=$3 AND action='material.inventory.moved'`,[c.decision.movementId,member.organizationId,project.id])).rows[0]?.metadata;
  if(original?.kind!=='CONSUMPTION'||original.direction!=='OUT'||original.projectId!==project.id||original.proposalId!==row.id||original.materialId!==c.materialId||original.unit!==c.unit||original.quantity!==c.quantity||original.receiptId!==c.decision.receiptId)fail('INVENTORY_INTEGRITY');
  const balanceBefore=material.balance;changeInventoryBalance(material,c.quantity,'IN');await saveInventoryCatalog(client,member,project,state);movement=await recordInventoryMovement(client,member,project,receiptId,{kind:'REVERSAL',direction:'IN',materialId:material.id,unit:material.unit,quantity:c.quantity,balanceBefore,balanceAfter:material.balance,proposalId:row.id,catalogHash:p.catalogHash,reversesMovementId:c.decision.movementId,originalReviewerId:c.decision.actorId,submitterPerformedReversal:c.submittedBy===member.actorId,reason:p.reason,recordedAt:at});
  next.state='REVERSED';next.reversal={actorId:member.actorId,reason:p.reason,recordedAt:at,receiptId,movementId:movement.id,originalMovementId:c.decision.movementId};
 }
 await client.query(`UPDATE public."Incident" SET metadata=$3::jsonb,status=$4,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[row.id,project.id,JSON.stringify({...row.metadata,materialInventory:next}),next.state==='REJECTED'?'rejected':'resolved']);
 return {kind:command.action==='REVERSE_CONSUMPTION'?'CONSUMPTION_REVERSED':'CONSUMPTION_DECISION',consumption:(await readConsumption(client,project.id,row.id)).consumption,stockChanged:Boolean(movement),...(movement?{movement}:{})};
}
