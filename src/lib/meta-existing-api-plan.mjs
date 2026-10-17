import {WorkspaceError,operationId,digest} from './workspace-policy.mjs';
import {readProjectWorkspaceProfile} from './whatsapp/project-workspace-profile.js';

const PREPARE='prepare_existing_api_plan',CLOSE='close_existing_api_plan';
const pending='ADDITIONAL_AUTHORIZATION_REVIEW_REQUIRED';
const rejectedCodes=new Set(['META_CUSTOMER_PREPARATION_CHANGED','META_CUSTOMER_EXISTING_API_PLAN_ALREADY_PREPARED','META_CUSTOMER_EXISTING_API_PLAN_CHANGED','META_CUSTOMER_EXISTING_API_PLAN_ALREADY_CLOSED','META_CUSTOMER_EXISTING_API_CONNECTION_INCOMPLETE']);
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const hash=value=>digest(canonical(value));
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
const timestamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const integrity=()=>new WorkspaceError('META_CUSTOMER_EXISTING_API_PLAN_INTEGRITY',409);
const receiptKey=(member,project,op)=>'meta_existing_api_'+digest([member.actorId,member.organizationId,project.id,op.toLowerCase()]);
const legacyKey=(project,op)=>'meta_share_plan_'+digest([project.id,op]);
const flags={preserveProvider:true,providerChanged:false,authorizationGranted:false,remoteMutationDispatched:false};
function snapshot(channel){return channel?{id:channel.id,phoneNumberId:channel.phoneNumberId,wabaId:channel.whatsappBusinessId,credentialDigest:digest(channel.encryptedAccessToken)}:null;}
const completeSnapshot=value=>value===null||exact(value,['id','phoneNumberId','wabaId','credentialDigest'])&&['id','phoneNumberId','wabaId'].every(key=>typeof value[key]==='string'&&value[key])&&/^[a-f0-9]{64}$/.test(value.credentialDigest||'');
function planValue(project){
 const plan=project.metadata?.metaExistingApiPlan;
 if(plan==null)return null;
 if(![1,2].includes(plan.version)||!operationId(plan.operationId)||!['CLOSED',pending].includes(plan.state)||!Number.isSafeInteger(plan.preparedRevision)||plan.preparedRevision<1||!timestamp(plan.preparedAt)||plan.preserveProvider!==true||typeof plan.actorId!=='string'||typeof plan.organizationId!=='string'||!/^[a-f0-9]{64}$/.test(plan.requestDigest||''))throw integrity();
 if(!completeSnapshot(plan.existingConnection))throw integrity();
 if(plan.version===2&&(plan.projectId!==project.id||!/^[a-f0-9]{64}$/.test(plan.scope||'')||!/^[a-f0-9]{64}$/.test(plan.profileDigest||'')))throw integrity();
 if(plan.state==='CLOSED'&&(!plan.closure||!operationId(plan.closure.operationId)||!timestamp(plan.closure.closedAt)||typeof plan.closure.actorId!=='string'||!/^meta_existing_api_[a-f0-9]{64}$/.test(plan.closure.receiptId||'')))throw integrity();
 if(plan.state!== 'CLOSED'&&plan.closure)throw integrity();
 return plan;
}
async function channelSnapshot(client,project,lock=false){
 const rows=(await client.query(`SELECT id,"phoneNumberId","whatsappBusinessId","encryptedAccessToken" FROM public."WhatsAppConnection" WHERE "projectId"=$1${lock?' FOR SHARE':''}`,[project.id])).rows;
 if(rows.length>1)throw new WorkspaceError('META_CUSTOMER_BINDING_INTEGRITY',409);
 return snapshot(rows[0]);
}
async function assertPlanEvidence(client,member,project,plan){
 if(plan.organizationId!==member.organizationId)throw integrity();
 const id=plan.version===1?legacyKey(project,plan.operationId):receiptKey({...member,actorId:plan.actorId},project,plan.operationId);
 const row=(await client.query(`SELECT id,"actorId",action,metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "entityId"=$3 AND "entityType"='Project'`,[id,member.organizationId,project.id])).rows[0];
 if(!row||row.actorId!==plan.actorId)throw integrity();
 const preparedPlan={...plan,state:pending};delete preparedPlan.closure;
 if(plan.version===1){if(row.action!=='integration.whatsapp.existing_api_plan'||row.metadata?.requestDigest!==plan.requestDigest||row.metadata?.preserveProvider!==true||row.metadata?.providerChanged!==false)throw integrity();}
 else if(row.action!=='integration.whatsapp.existing_api_plan.result'||row.metadata?.action!==PREPARE||row.metadata.state!=='RECORDED'||row.metadata.scope!==plan.scope||row.metadata.planId!==plan.operationId||row.metadata.planDigest!==hash(preparedPlan)||row.metadata.requestDigest!==plan.requestDigest)throw integrity();
 if(plan.closure){
  const closed=(await client.query(`SELECT "actorId",action,metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "entityId"=$3 AND "entityType"='Project'`,[plan.closure.receiptId,member.organizationId,project.id])).rows[0];
  if(!closed||closed.actorId!==plan.closure.actorId||closed.action!=='integration.whatsapp.existing_api_plan.result'||closed.metadata?.action!==CLOSE||closed.metadata.state!=='RECORDED'||closed.metadata.planId!==plan.operationId.toLowerCase()||closed.metadata.planDigest!==hash(plan))throw integrity();
 }
}
const publicReceipt=(record,context)=>({action:context.action,operationId:context.operationId.toLowerCase(),projectId:context.projectId,scope:context.scope,planId:context.planId.toLowerCase(),state:record?.state||'NOT_OBSERVED',saved:record?.state==='RECORDED',receiptId:record?.receiptId||null,recordedAt:record?.recordedAt||null,preparedRevision:record?.preparedRevision??null,code:record?.code||null,providerChanged:false,remoteMutationDispatched:false,authorizationGranted:false});
export function createMetaExistingApiPlan({workspace,now=()=>Date.now()}){
 async function receipt(client,member,scope,project,context,expected){
  if(![PREPARE,CLOSE].includes(context.action)||!operationId(context.operationId)||!operationId(context.planId)||context.action===PREPARE&&context.planId.toLowerCase()!==context.operationId.toLowerCase())throw new WorkspaceError('META_CUSTOMER_INPUT_INVALID');
  const op=context.operationId.toLowerCase(),id=receiptKey(member,project,op);
  const row=(await client.query(`SELECT id,"actorId",action,metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "entityId"=$3 AND "entityType"='Project'`,[id,member.organizationId,project.id])).rows[0];
  if(!row)return publicReceipt(null,{...context,scope,projectId:project.id});
  const r=row.metadata;
  if(row.actorId!==member.actorId||row.action!=='integration.whatsapp.existing_api_plan.result'||r?.version!==1||r.operationId!==op||r.action!==context.action||r.planId!==context.planId.toLowerCase()||r.scope!==scope||r.actorId!==member.actorId||r.organizationId!==member.organizationId||r.projectId!==project.id||r.receiptId!==id||!['RECORDED','REJECTED'].includes(r.state)||!timestamp(r.recordedAt)||!/^[a-f0-9]{64}$/.test(r.requestDigest||'')||r.providerChanged!==false||r.remoteMutationDispatched!==false||r.authorizationGranted!==false||r.preserveProvider!==true||r.state==='REJECTED'&&!rejectedCodes.has(r.code)||r.state==='RECORDED'&&r.code!==null||r.preparedRevision!==null&&(!Number.isSafeInteger(r.preparedRevision)||r.preparedRevision<1))throw integrity();
  if(expected&&r.requestDigest!==hash(expected))throw new WorkspaceError('META_CUSTOMER_OPERATION_CONFLICT',409);
  return publicReceipt(r,{...context,scope,projectId:project.id});
 }
 async function record(client,member,scope,project,body,{plan=null,code=null,preparedRevision=null}={}){
  const op=body.operationId.toLowerCase(),record={version:1,action:body.action,operationId:op,planId:body.action===PREPARE?op:body.planId.toLowerCase(),scope,projectId:project.id,actorId:member.actorId,organizationId:member.organizationId,requestDigest:hash(body),state:code?'REJECTED':'RECORDED',code,receiptId:receiptKey(member,project,op),recordedAt:new Date(now()).toISOString(),preparedRevision,planDigest:plan?hash(plan):null,...(plan?{plan}:{}),...flags};
  const result=await client.query(`INSERT INTO public."AuditLog" (id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES ($1,$2,$3,'integration.whatsapp.existing_api_plan.result','Project',$4,$5::jsonb)`,[record.receiptId,member.organizationId,member.actorId,project.id,JSON.stringify(record)]);
  if(result.rowCount!==1)throw new WorkspaceError('META_CUSTOMER_WRITE_UNCONFIRMED',503);
  return publicReceipt(record,{...body,scope,planId:record.planId});
 }
 return {
  readReceipt:receipt,
  async publicPlan(client,member,project){
   const plan=planValue(project);if(!plan)return null;
   await assertPlanEvidence(client,member,project,plan);
   const {profile}=readProjectWorkspaceProfile(project.metadata,project.organizationMetadata,project.id),connection=await channelSnapshot(client,project);
   return {id:plan.operationId.toLowerCase(),state:plan.state,preparedRevision:plan.preparedRevision,preparedAt:plan.preparedAt,currentPreparationRevision:profile.revision,preparationCurrent:profile.configured&&profile.numberMode==='EXISTING_API'&&profile.revision===plan.preparedRevision&&(plan.version===1||plan.profileDigest===hash(profile)),connectionCurrent:hash(connection)===hash(plan.existingConnection),canClose:plan.state!== 'CLOSED',closedAt:plan.closure?.closedAt||null,...flags};
  },
  async command(session,input){
   const fields=input?.action===PREPARE?['action','operationId','projectId','scope','preparedRevision','confirmPreserveProvider']:['action','operationId','projectId','scope','planId','confirmLocalClosure'];
   if(!exact(input,fields)||![PREPARE,CLOSE].includes(input.action)||!operationId(input.operationId)||input.action===PREPARE&&(!Number.isSafeInteger(input.preparedRevision)||input.preparedRevision<1||input.confirmPreserveProvider!==true)||input.action===CLOSE&&(!operationId(input.planId)||input.confirmLocalClosure!==true))throw new WorkspaceError('META_CUSTOMER_SYNC_INPUT_INVALID');
   const body={...input,operationId:input.operationId.toLowerCase(),...(input.action===CLOSE?{planId:input.planId.toLowerCase()}:{})},planId=body.action===PREPARE?body.operationId:body.planId;
   return workspace.integrationProject(session,body,true,async(client,member,scope,project)=>{
    const priorReceipt=await receipt(client,member,scope,project,{...body,planId},body);if(priorReceipt.state!=='NOT_OBSERVED')return priorReceipt;
    const prior=planValue(project);if(prior)await assertPlanEvidence(client,member,project,prior);
    const {profile}=readProjectWorkspaceProfile(project.metadata,project.organizationMetadata,project.id);
    let plan,code=null;
    if(body.action===PREPARE){
     if(!profile.configured||profile.numberMode!=='EXISTING_API'||profile.revision!==body.preparedRevision)code='META_CUSTOMER_PREPARATION_CHANGED';
     else if(prior&&prior.state!=='CLOSED')code='META_CUSTOMER_EXISTING_API_PLAN_ALREADY_PREPARED';
     // UUIDs are immutable plan identities, including those created by v1.
     else if(prior?.operationId.toLowerCase()===planId)throw new WorkspaceError('META_CUSTOMER_OPERATION_CONFLICT',409);
     if(!code){
      const existingConnection=await channelSnapshot(client,project,true);
      if(!completeSnapshot(existingConnection))code='META_CUSTOMER_EXISTING_API_CONNECTION_INCOMPLETE';
      else plan={version:2,state:pending,operationId:planId,requestDigest:hash(body),actorId:member.actorId,organizationId:member.organizationId,projectId:project.id,scope,preparedRevision:profile.revision,profileDigest:hash(profile),preparedAt:new Date(now()).toISOString(),preserveProvider:true,existingConnection};
     }
    }else{
     if(!prior||prior.operationId.toLowerCase()!==planId)code='META_CUSTOMER_EXISTING_API_PLAN_CHANGED';
     else if(prior.state==='CLOSED')code='META_CUSTOMER_EXISTING_API_PLAN_ALREADY_CLOSED';
     if(!code)plan={...prior,state:'CLOSED',closure:{operationId:body.operationId,actorId:member.actorId,closedAt:new Date(now()).toISOString(),receiptId:receiptKey(member,project,body.operationId)}};
    }
    if(plan){
     // A success receipt must never commit a plan its own reader cannot load.
     planValue({id:project.id,metadata:{metaExistingApiPlan:plan}});
     const result=await client.query(`UPDATE public."Project" SET metadata=COALESCE(metadata,'{}'::jsonb)||$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "organizationId"=$2`,[project.id,member.organizationId,JSON.stringify({metaExistingApiPlan:plan})]);
     if(result.rowCount!==1)throw new WorkspaceError('META_CUSTOMER_WRITE_UNCONFIRMED',503);
    }
    return record(client,member,scope,project,body,{plan,code,preparedRevision:body.action===PREPARE?body.preparedRevision:prior?.operationId.toLowerCase()===planId?prior.preparedRevision:null});
   });
  },
 };
}
