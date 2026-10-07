import {WorkspaceError,operationId,digest} from './workspace-policy.mjs';
import {PROJECT_PREPARATION_ACTION,canPrepareProject,preparationContext,preparationText,preparationRoster,normalizeProjectPreparation,preparationReceiptId,preparationRequestDigest} from './project-preparation-policy.mjs';
const action='project.preparation.recorded';
const integrity=()=>{throw new WorkspaceError('PROJECT_PREPARATION_INTEGRITY',409);};
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
function state(metadata){
 if(metadata!==null&&metadata!==undefined&&(typeof metadata!=='object'||Array.isArray(metadata)))integrity();
 const value=metadata?.projectPreparation;if(value===undefined)return {version:1,revision:0,clientName:'',teams:[],slots:[],receiptId:null};
 try{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join('|')!=='clientName|receiptId|revision|slots|teams|version'||value.version!==1||!Number.isSafeInteger(value.revision)||value.revision<1||value.revision>2147483647||!/^project_preparation_[a-f0-9]{64}$/.test(value.receiptId||''))integrity();
  const normalized={version:1,revision:value.revision,clientName:preparationText(value.clientName,120),...preparationRoster(value.teams,value.slots),receiptId:value.receiptId};
  // JSONB reorders object keys; only semantic differences indicate corruption.
  if(JSON.stringify(canonical(normalized))!==JSON.stringify(canonical(value)))integrity();return normalized;
 }catch{integrity();}
}
const details=(row,current)=>({name:row.name,address:row.address??'',clientName:current.clientName,teams:current.teams,slots:current.slots});
export function createProjectPreparation({workspace}){
 const run=(session,context,writable,callback)=>workspace.projectOperation(session,preparationContext(context),writable,async(client,member,scope,project)=>{
  if(!canPrepareProject(member.role)||member.channelProof)throw new WorkspaceError('PROJECT_PREPARATION_PERMISSION_REQUIRED',403);
  const row=(await client.query(`SELECT id,name,address,metadata FROM public."Project" WHERE id=$1 AND "organizationId"=$2 AND status='ACTIVE'`,[project.id,member.organizationId])).rows[0];if(!row)throw new WorkspaceError('WORKSPACE_PROJECT_UNAVAILABLE',404);
  return callback(client,member,scope,row);
 });
 const snapshot=(row,scope)=>{const current=state(row.metadata);return {scope,projectId:row.id,canManage:true,revision:current.revision,detailsDigest:digest(['project-preparation-details-v1',details(row,current)]),...details(row,current),startStatus:'TO_CONFIRM',declarationOnly:true};};
 async function receipt(client,member,projectId,op){
  const id=preparationReceiptId(member.actorId,projectId,op),row=(await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND action=$4 AND "entityType"='Project' AND "entityId"=$5`,[id,member.organizationId,member.actorId,action,projectId])).rows[0];
  if(row){const m=row.metadata,fields=m?.cancelled===true?['version','projectId','operationId','action','requestDigest','cancelled']:['version','projectId','operationId','action','requestDigest','savedRevision','reason','before','after'];
   if(row.id!==id||!m||Object.keys(m).sort().join('|')!==fields.sort().join('|')||m.version!==1||m.projectId!==projectId||m.operationId!==op.toLowerCase()||m.action!==PROJECT_PREPARATION_ACTION||!/^[a-f0-9]{64}$/.test(m.requestDigest||'')||m.cancelled!==true&&(!Number.isSafeInteger(m.savedRevision)||m.savedRevision<1||m.savedRevision>2147483647))integrity();
  }return row;
 }
 const outcome=(row,scope,found,replayed)=>found.metadata.cancelled===true?{scope,projectId:row.id,operationId:found.metadata.operationId,action:PROJECT_PREPARATION_ACTION,state:'CANCELLED',saved:false,definitive:true,receiptId:found.id,projectUpdated:false}:{...snapshot(row,scope),state:'RECORDED',action:PROJECT_PREPARATION_ACTION,saved:true,replayed,receiptId:found.id,operationId:found.metadata.operationId,savedRevision:found.metadata.savedRevision,savedPreparationIsCurrent:state(row.metadata).receiptId===found.id&&state(row.metadata).revision===found.metadata.savedRevision};
 return {
  read(session,context){return run(session,context,false,async(_client,_member,scope,row)=>snapshot(row,scope));},
  status(session,context){
   if(!operationId(context?.operationId))throw new WorkspaceError('PROJECT_PREPARATION_QUERY_INVALID',400);
   return run(session,context,false,async(client,member,scope,row)=>{const found=await receipt(client,member,row.id,context.operationId);return found?outcome(row,scope,found,true):{scope,projectId:row.id,operationId:context.operationId.toLowerCase(),action:PROJECT_PREPARATION_ACTION,state:'NOT_OBSERVED',saved:false,definitive:false};});
  },
  save(session,body){const command=normalizeProjectPreparation(body);return run(session,command,true,async(client,member,scope,row)=>{
   const id=preparationReceiptId(member.actorId,row.id,command.operationId),requestDigest=preparationRequestDigest(command),prior=await receipt(client,member,row.id,command.operationId);
   if(prior){if(command.action==='CANCEL_PENDING_PREPARATION')return outcome(row,scope,prior,true);if(prior.metadata.cancelled===true)throw new WorkspaceError('PROJECT_PREPARATION_CANCELLED',409);if(prior.metadata.requestDigest!==requestDigest)throw new WorkspaceError('PROJECT_PREPARATION_OPERATION_CONFLICT',409);return outcome(row,scope,prior,true);}
   if(command.action==='CANCEL_PENDING_PREPARATION'){
    await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,$4,'Project',$5,$6::jsonb)`,[id,member.organizationId,member.actorId,action,row.id,JSON.stringify({version:1,projectId:row.id,operationId:command.operationId,action:PROJECT_PREPARATION_ACTION,requestDigest,cancelled:true})]);
    const found=await receipt(client,member,row.id,command.operationId);if(!found)throw new WorkspaceError('PROJECT_PREPARATION_UNCONFIRMED',503);return outcome(row,scope,found,false);
   }
   const current=state(row.metadata),before=snapshot(row,scope),p=command.payload;
   if(p.expectedRevision!==current.revision||p.expectedDetailsDigest!==before.detailsDigest)throw new WorkspaceError('PROJECT_PREPARATION_REVISION_CHANGED',409);
   const next={version:1,revision:current.revision+1,clientName:p.clientName,teams:p.teams,slots:p.slots,receiptId:id};
   const updated=await client.query(`UPDATE public."Project" SET name=$3,address=$4,metadata=jsonb_set(COALESCE(metadata,'{}'::jsonb),'{projectPreparation}',$5::jsonb,true),"updatedAt"=clock_timestamp() WHERE id=$1 AND "organizationId"=$2 AND status='ACTIVE' AND name=$6 AND address IS NOT DISTINCT FROM $7 AND COALESCE((metadata->'projectPreparation'->>'revision')::int,0)=$8 RETURNING id`,[row.id,member.organizationId,p.name,p.address||null,JSON.stringify(next),row.name,row.address??null,current.revision]);
   if(updated.rows.length!==1||updated.rows[0].id!==row.id)throw new WorkspaceError('PROJECT_PREPARATION_REVISION_CHANGED',409);
   await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,$4,'Project',$5,$6::jsonb)`,[id,member.organizationId,member.actorId,action,row.id,JSON.stringify({version:1,projectId:row.id,operationId:command.operationId,action:command.action,requestDigest,savedRevision:next.revision,reason:p.reason,before:details(row,current),after:{name:p.name,address:p.address,clientName:next.clientName,teams:next.teams,slots:next.slots}})]);
   const after={...row,name:p.name,address:p.address||null,metadata:{...row.metadata,projectPreparation:next}},found=await receipt(client,member,row.id,command.operationId);if(!found)throw new WorkspaceError('PROJECT_PREPARATION_UNCONFIRMED',503);return outcome(after,scope,found,false);
  });}
 };
}
