import {randomUUID} from 'node:crypto';
import {WorkspaceError,digest,workspaceId,operationId} from './workspace-policy.mjs';
import {validateConstructorCrmCommand,normalizeConstructorCrmInput,serializeConstructorCrmAccount,constructorCrmSearch,constructorCrmCursor,CONSTRUCTOR_CRM_FIELDS,ConstructorCrmInputError} from './constructor-crm-policy.mjs';
import {assertConstructorCrmSchema} from './constructor-crm-schema.mjs';

const columns=`id,name,"contactName",email,phone,stage::text AS stage,segment,source,"nextFollowUpAt",notes,revision,"createdAt","updatedAt"`;
const receiptAction='constructor.crm.recorded';
function policyError(error){return error instanceof ConstructorCrmInputError?new WorkspaceError(error.code,error.status):error;}
export const constructorCrmReceiptId=(actorId,organizationId,projectId,key)=>'constructor_crm_'+digest([actorId,organizationId,projectId,key.toLowerCase()]);
function contextInput(context,receipt=false){
 if(!context||!workspaceId(context.projectId)||!/^[a-f0-9]{64}$/.test(context.scope||'')||receipt&&!operationId(context.operationId))throw new WorkspaceError('CONSTRUCTOR_CRM_QUERY_INVALID');
 const search=constructorCrmSearch(context.search);
 if(search===null||context.after!=null&&!constructorCrmCursor(context.after,search)||context.accountId!=null&&(!workspaceId(context.accountId)||Object.hasOwn(context,'search'))||context.after!=null&&context.accountId!=null||receipt&&Object.hasOwn(context,'search'))throw new WorkspaceError('CONSTRUCTOR_CRM_QUERY_INVALID');
 if(context.after&&search){const [id,hash]=context.after.split('~');if(hash!==digest([context.scope,context.projectId,search,id]))throw new WorkspaceError('CONSTRUCTOR_CRM_QUERY_INVALID');}
}
// Spanish case pairs are explicit so contact lookup also works on a C-locale
// database. Accents stay significant; the query is always literal text.
const searchText=expression=>`lower(translate(${expression},'ÁÉÍÓÚÜÑ','áéíóúüñ'))`;
const searchPredicate=parameter=>`(${parameter}::text='' OR ${['name','coalesce("contactName",\'\')','coalesce(email,\'\')','coalesce(phone,\'\')'].map(field=>`strpos(${searchText(field)},${searchText(parameter)})>0`).join(' OR ')})`;
function requestDigest(command){
 // Field order is canonical; no private input is copied into the audit receipt.
 const payload=Object.fromEntries(CONSTRUCTOR_CRM_FIELDS.filter(key=>Object.hasOwn(command.payload,key)).map(key=>[key,command.payload[key]]));
 return digest([command.projectId,command.scope,command.action,command.id??null,command.revision??null,payload]);
}
function publicReceipt(row,context){
 const m=row.metadata;
 if(m?.version!==1||m.projectId!==context.projectId||!operationId(m.operationId)||m.operationId.toLowerCase()!==context.operationId.toLowerCase()||!['CREATE','UPDATE'].includes(m.action)||!Number.isSafeInteger(m.revision)||m.revision<1||!workspaceId(row.entityId)||!/^[a-f0-9]{64}$/.test(m.requestDigest||''))throw new WorkspaceError('CONSTRUCTOR_CRM_RECEIPT_INTEGRITY',409);
 return {id:row.id,operationId:m.operationId.toLowerCase(),accountId:row.entityId,action:m.action,revision:m.revision};
}
export function createConstructorCrm({workspace}){
 if(typeof workspace?.organizationOperation!=='function')throw new TypeError('Canonical organization transaction required');
 async function within(session,context,writable,callback){
  return workspace.organizationOperation(session,context,writable,async(client,member,scope)=>{
   await assertConstructorCrmSchema(client);
   // Keep the selected canonical project active through a write, including
   // concurrent archival. Commercial rows remain company-wide.
   if(writable){const selected=await client.query(`SELECT id FROM public."Project" WHERE id=$1 AND "organizationId"=$2 AND status='ACTIVE' FOR SHARE`,[context.projectId,member.organizationId]);if(selected.rows.length!==1)throw new WorkspaceError('WORKSPACE_PROJECT_UNAVAILABLE',404);}
   try{return await callback(client,member,scope);}catch(error){throw policyError(error);}
  });
 }
 const row=async(client,member,id,lock=false)=>(await client.query(`SELECT ${columns} FROM public."CrmAccount" WHERE id=$1 AND "ownerOrganizationId"=$2 AND "organizationId" IS NULL ${lock?'FOR UPDATE':''}`,[id,member.organizationId])).rows[0];
 const receipt=async(client,member,id)=>(await client.query(`SELECT id,"entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND action=$4 AND "entityType"='CrmAccount'`,[id,member.organizationId,member.actorId,receiptAction])).rows[0];
 async function recorded(client,member,scope,context,found,replayed){
  const proof=publicReceipt(found,context),account=await row(client,member,proof.accountId);
  return {scope,projectId:context.projectId,state:'RECORDED',saved:true,definitive:true,replayed,receipt:proof,...(account?{record:serializeConstructorCrmAccount(account)}:{})};
 }
 return {
  async list(session,context){
   contextInput(context);
   const search=constructorCrmSearch(context.search),after=context.after?.split('~')[0]??null;
   return within(session,context,false,async(client,member,scope)=>{
    if(context.accountId){const account=await row(client,member,context.accountId);if(!account)throw new WorkspaceError('CONSTRUCTOR_CRM_ACCOUNT_UNAVAILABLE',404);return {scope,projectId:context.projectId,organizationName:member.organizationName,canManage:true,records:[serializeConstructorCrmAccount(account)],nextCursor:null,total:1};}
    if(after&&!await row(client,member,after))throw new WorkspaceError('CONSTRUCTOR_CRM_ACCOUNT_UNAVAILABLE',404);
    const rows=(await client.query(`SELECT ${columns} FROM public."CrmAccount" WHERE "ownerOrganizationId"=$1 AND "organizationId" IS NULL AND ($2::text IS NULL OR id>$2) AND ${searchPredicate('$3')} ORDER BY id LIMIT 21`,[member.organizationId,after,search])).rows;
    const total=(await client.query(`SELECT count(*)::int AS n FROM public."CrmAccount" WHERE "ownerOrganizationId"=$1 AND "organizationId" IS NULL AND ${searchPredicate('$2')}`,[member.organizationId,search])).rows[0].n;
    const nextCursor=rows.length>20?rows[19].id:null;
    return {scope,projectId:context.projectId,organizationName:member.organizationName,canManage:true,records:rows.slice(0,20).map(serializeConstructorCrmAccount),nextCursor:nextCursor&&search?nextCursor+'~'+digest([scope,context.projectId,search,nextCursor]):nextCursor,total,search};
   });
  },
  async save(session,input){
   let command;try{command=validateConstructorCrmCommand(input);}catch(error){throw policyError(error);}
   return within(session,command,true,async(client,member,scope)=>{
    const id=constructorCrmReceiptId(member.actorId,member.organizationId,command.projectId,command.operationId),hash=requestDigest(command);
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[id]);
    const prior=await receipt(client,member,id);
    if(prior){if(prior.metadata.requestDigest!==hash)throw new WorkspaceError('CONSTRUCTOR_CRM_OPERATION_CONFLICT',409);return recorded(client,member,scope,command,prior,true);}
    let current=null,accountId;
    if(command.action==='UPDATE'){
     current=await row(client,member,command.id,true);if(!current)throw new WorkspaceError('CONSTRUCTOR_CRM_ACCOUNT_UNAVAILABLE',404);
     if(current.revision!==command.revision)throw new WorkspaceError('CONSTRUCTOR_CRM_REVISION_CHANGED',409);
     if(current.revision>=2147483647)throw new WorkspaceError('CONSTRUCTOR_CRM_REVISION_EXHAUSTED',409);
     accountId=current.id;
    }else accountId='crm_'+randomUUID().replaceAll('-','');
    const normalized=normalizeConstructorCrmInput(command.payload,current),data=normalized.data,revision=current?current.revision+1:1;
    const next=current?{...current,...data}:data;
    let written;
    const values=[accountId,member.organizationId,next.name,next.contactName??null,next.email??null,next.phone??null,next.stage,next.segment??null,next.source??null,next.nextFollowUpAt??null,next.notes??null,revision];
    if(current)written=await client.query(`UPDATE public."CrmAccount" SET name=$3,"contactName"=$4,email=$5,phone=$6,stage=$7,segment=$8,source=$9,"nextFollowUpAt"=$10,notes=$11,revision=$12,"updatedAt"=clock_timestamp() WHERE id=$1 AND "ownerOrganizationId"=$2 AND "organizationId" IS NULL AND revision=$13`,[...values,command.revision]);
    else written=await client.query(`INSERT INTO public."CrmAccount"(id,"ownerOrganizationId",name,"contactName",email,phone,stage,segment,source,"nextFollowUpAt",notes,revision,"updatedAt") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,clock_timestamp())`,values);
    if(written.rowCount!==1)throw new WorkspaceError('CONSTRUCTOR_CRM_WRITE_UNCONFIRMED',503);
    const changedFields=current?Object.keys(normalized.changes):Object.keys(data);
    const metadata={version:1,projectId:command.projectId,operationId:command.operationId.toLowerCase(),requestDigest:hash,action:command.action,revision,previousRevision:current?.revision??null,changedFields,stageBefore:current?.stage??null,stageAfter:next.stage};
    await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,$4,'CrmAccount',$5,$6::jsonb)`,[id,member.organizationId,member.actorId,receiptAction,accountId,JSON.stringify(metadata)]);
    const found=await receipt(client,member,id);if(!found)throw new WorkspaceError('CONSTRUCTOR_CRM_WRITE_UNCONFIRMED',503);
    return recorded(client,member,scope,command,found,false);
   });
  },
  async status(session,context){
   contextInput(context,true);
   if(context.after!=null||context.accountId!=null)throw new WorkspaceError('CONSTRUCTOR_CRM_QUERY_INVALID');
   return within(session,context,false,async(client,member,scope)=>{
    const found=await receipt(client,member,constructorCrmReceiptId(member.actorId,member.organizationId,context.projectId,context.operationId));
    return found?recorded(client,member,scope,context,found,true):{scope,projectId:context.projectId,state:'NOT_OBSERVED',saved:false,definitive:false};
   });
  }
 };
}
