import { WorkspaceError,workspaceId,operationId } from './workspace-policy.mjs';
import { cleanMetadata } from './site-register-policy.mjs';
import { normalizePurchase,purchaseReceiptId,purchaseDigest,applyPurchase } from './site-purchase-policy.mjs';
const selection=`id,title,metadata,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision`;
function publicOrder(row) {
  const r=cleanMetadata(row.metadata),s=r.siteRegister,p=r.procurement;
  if(s?.version!==1||s.type!=='MATERIAL_REQUEST')throw new WorkspaceError('PURCHASE_REQUEST_UNAVAILABLE',404);
  return {id:row.id,material:row.title,requestedQuantity:s.quantity,unit:s.unit,sector:s.sector,requestState:s.state,revision:row.revision,
    order:p?.version===1?{state:p.state,supplier:p.supplier,quantity:p.quantity,unitPrice:p.unitPrice,total:p.total,currency:p.currency,
      reference:p.reference,received:p.received,decision:p.decision?{at:p.decision.at,reason:p.decision.reason}:null,
      receipts:p.receipts.map(r=>({quantity:r.quantity,deliveryReference:r.deliveryReference,at:r.at,reason:r.reason}))}:null};
}
export function createSitePurchases({workspace}) {
  const run=(session,context,writable,callback)=>workspace.integrationProject(session,context,writable,callback);
  const read=async(client,projectId,id,lock=false)=>{
    const row=(await client.query(`SELECT ${selection} FROM public."Incident" WHERE id=$1 AND "projectId"=$2 ${lock?'FOR UPDATE':''}`,[id,projectId])).rows[0];
    if(!row)throw new WorkspaceError('PURCHASE_REQUEST_UNAVAILABLE',404);return row;
  };
  const receipt=async(client,member,id)=>(await client.query(`SELECT id,"entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND action='site.purchase.changed'`,[id,member.organizationId,member.actorId])).rows[0];
  const outcome=async(client,context,found,replayed)=>{
    if(found.metadata.projectId!==context.projectId)throw new WorkspaceError('PURCHASE_RECEIPT_INTEGRITY',409);
    return {saved:true,receiptId:found.id,replayed,record:publicOrder(await read(client,context.projectId,found.entityId))};
  };
  return {
    list(session,context) {
      if(context.after!=null&&!workspaceId(context.after))throw new WorkspaceError('PURCHASE_QUERY_INVALID');
      return run(session,context,false,async(client,member,scope)=>{
        const rows=(await client.query(`SELECT ${selection} FROM public."Incident" WHERE "projectId"=$1 AND metadata->'siteRegister'->>'type'='MATERIAL_REQUEST' AND ($2::text IS NULL OR id>$2) ORDER BY id LIMIT 101`,[context.projectId,context.after||null])).rows;
        const total=(await client.query(`SELECT count(*)::int AS n FROM public."Incident" WHERE "projectId"=$1 AND metadata->'siteRegister'->>'type'='MATERIAL_REQUEST'`,[context.projectId])).rows[0].n;
        return {scope,projectId:context.projectId,records:rows.slice(0,100).map(publicOrder),total,nextCursor:rows.length>100?rows[99].id:null};
      });
    },
    save(session,input) {
      const command=normalizePurchase(input);
      return run(session,command,true,async(client,member,scope)=>{
        const id=purchaseReceiptId(member.actorId,command),requestDigest=purchaseDigest(command),p=command.payload,prior=await receipt(client,member,id);
        if(prior){if(prior.metadata.requestDigest!==requestDigest)throw new WorkspaceError('PURCHASE_OPERATION_CONFLICT',409);return {scope,...await outcome(client,command,prior,true)};}
        const row=await read(client,command.projectId,p.requestId,true);
        if(row.revision!==p.revision)throw new WorkspaceError('PURCHASE_REVISION_CHANGED',409);
        const before=cleanMetadata(row.metadata),at=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now.toISOString();
        const after=applyPurchase(before,command,member.actorId,at);
        await client.query(`UPDATE public."Incident" SET metadata=$3::jsonb,status=$4,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[row.id,command.projectId,JSON.stringify(after),({RESOLVED:'resolved',ACKNOWLEDGED:'in_review',REJECTED:'rejected',OPEN:'open'})[after.siteRegister.state]]);
        await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'site.purchase.changed','Incident',$4,$5::jsonb)`,[id,member.organizationId,member.actorId,row.id,JSON.stringify({version:1,projectId:command.projectId,requestDigest,command:command.action,before:before.procurement||null,after:after.procurement,paymentRecorded:false,stockLedgerChanged:false})]);
        const found=await receipt(client,member,id);if(!found)throw new WorkspaceError('PURCHASE_WRITE_UNCONFIRMED',503);
        return {scope,...await outcome(client,command,found,false)};
      });
    },
    status(session,context) {
      if(!operationId(context.operationId))throw new WorkspaceError('PURCHASE_QUERY_INVALID');
      return run(session,context,false,async(client,member,scope)=>{
        const found=await receipt(client,member,purchaseReceiptId(member.actorId,context));
        return found?{scope,state:'RECORDED',...await outcome(client,context,found,true)}:{scope,state:'NOT_OBSERVED',definitive:false};
      });
    },
  };
}
