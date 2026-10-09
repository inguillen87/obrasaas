import {WorkspaceError,workspaceId,operationId,digest} from './workspace-policy.mjs';
import {buildCustomerTemplate,customerRemoteTemplateMatches,publicCustomerTemplateWorkbench} from './meta-customer-templates.mjs';
import {assertTemplateReviewDefinition,TemplateReviewError} from './whatsapp/template-review-policy.js';
import {decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {requireCompanyChannelSchema} from './company-channel-schema.mjs';
import {ownCompanyConnectionPolicy,ownCompanyCapabilityKind,lockOwnCompanyIssuer,OWN_TEMPLATE_ACTIONS} from './meta-own-company-policy.mjs';

export {OWN_TEMPLATE_ACTIONS};
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===keys.slice().sort().join('|');
const fail=(code='META_OWN_TEMPLATE_CONTEXT_CHANGED',status=409)=>{throw new WorkspaceError(code,status);};
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export function normalizeOwnTemplateCommand(body){
 if(!exact(body,['scope','projectId','action','operationId','payload'])||!workspaceId(body.projectId)||!hash(body.scope)||!operationId(body.operationId)||!OWN_TEMPLATE_ACTIONS.includes(body.action))fail('META_OWN_TEMPLATE_INPUT_INVALID',400);
 const p=body.payload,submit=body.action==='SUBMIT_OWN_TEMPLATE',recover=body.action==='RECOVER_OWN_TEMPLATE';
 if(!exact(p,['connectionId','ownerRevision','grantDigest',submit?'review':'blueprintKey',...(recover?['recoveryOf']:[])])||!workspaceId(p.connectionId)||!Number.isSafeInteger(p.ownerRevision)||p.ownerRevision<1||p.ownerRevision>2147483646||!hash(p.grantDigest)||recover&&![null,'SUBMIT_OWN_TEMPLATE','RECOVER_OWN_TEMPLATE'].includes(p.recoveryOf))fail('META_OWN_TEMPLATE_INPUT_INVALID',400);
 const key=submit?p.review?.blueprintKey:p.blueprintKey;
 // The allowlist and exact name/content are shared with the existing catalogue.
 buildCustomerTemplate({id:p.connectionId,whatsappBusinessId:'100000001'},key);
 if(submit&&!exact(p.review,['blueprintKey','expectedName','contentSha256','confirmed']))fail('META_OWN_TEMPLATE_INPUT_INVALID',400);
 return {scope:body.scope,projectId:body.projectId,action:body.action,operationId:body.operationId.toLowerCase(),payload:{connectionId:p.connectionId,ownerRevision:p.ownerRevision,grantDigest:p.grantDigest,...(submit?{review:{blueprintKey:key,expectedName:p.review.expectedName,contentSha256:p.review.contentSha256,confirmed:p.review.confirmed}}:{blueprintKey:key}),...(recover?{recoveryOf:p.recoveryOf}:{})}};
}
const receiptId=(member,projectId,id)=>'company_own_template_'+digest([member.organizationId,member.actorId,projectId,id]);
const identity=member=>({organization:{id:member.organizationId,name:member.organizationName},actor:{id:member.actorId,role:member.role}});
function publicReceipt(row,member,scope,projectId){
 if(!row)return {...identity(member),scope,projectId,state:'NOT_OBSERVED',saved:false,definitive:false};
 const m=row.metadata;return {...identity(member),scope,projectId,operationId:m.operationId,action:m.action,connectionId:m.connectionId,blueprintKey:m.blueprintKey,ownerRevision:m.ownerRevision,grantDigest:m.grantDigest,state:m.state,saved:m.state==='RECORDED',definitive:['RECORDED','REJECTED'].includes(m.state),receiptId:row.id,submissionState:m.submissionState||null,providerConfirmed:m.providerConfirmed===true,providerStatus:m.providerStatus||null,sendingAccepted:false,code:m.code||null};
}
export function createOwnCompanyTemplates({workspace,provider,environment=process.env,now=()=>Date.now(),afterReservation=async()=>{}}){
 const within=(session,context,writable,run)=>workspace.integrationProject(session,context,writable,run);
 async function authority(client,member,session,project,lock=false){
  await requireCompanyChannelSchema(client);
  const time=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now.getTime();
  const rows=(await client.query(`SELECT c.*,cc.mode,cc.revision AS "ownerRevision",cc."anchorProjectId" FROM public."WhatsAppConnection" c JOIN public."WhatsAppCompanyChannel" cc ON cc."connectionId"=c.id AND cc."organizationId"=$2 WHERE c."projectId"=$1 ${lock?'FOR UPDATE OF c FOR SHARE OF cc':''}`,[project.id,member.organizationId])).rows;
  if(rows.length!==1)fail('META_OWN_TEMPLATE_CHANNEL_REQUIRED',403);const c=rows[0],p=ownCompanyConnectionPolicy(c,environment,time);
  if(!p||!Object.hasOwn(c.metadata||{},'ownCompanyRuntime')||member.role!=='ADMIN'||member.actorId!==p.actorId||member.organizationId!==p.organizationId||session.userId!==p.clerkUserId||session.organizationId!==p.clerkOrganizationId||session.organizationRole!=='org:admin'||project.id!==p.projectId||c.anchorProjectId!==project.id||!['PREPARED','COMPANY'].includes(c.mode)||!Number.isSafeInteger(c.ownerRevision)||c.ownerRevision<1)fail('META_OWN_TEMPLATE_ADMIN_REQUIRED',403);
  const capability=await lockOwnCompanyIssuer(client,c,{environment,now:time,lock});if(ownCompanyCapabilityKind(capability)!=='RUNTIME')fail('META_OWN_TEMPLATE_RUNTIME_REQUIRED',403);
  return {connection:c,capability,policy:p,time};
 }
 const previous=async(client,member,projectId,id,lock=false)=>(await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND action='company.own.template.recorded' ${lock?'FOR UPDATE':''}`,[receiptId(member,projectId,id),member.organizationId,member.actorId])).rows[0]||null;
 const drafts=c=>c.metadata.ownCompanyTemplateDrafts||{};
 function binding(a,input){if(a.connection.id!==input.payload.connectionId||a.connection.ownerRevision!==input.payload.ownerRevision||a.policy.grantDigest!==input.payload.grantDigest)fail();}
 function definitionFor(c,input){return buildCustomerTemplate(c,input.payload.review?.blueprintKey||input.payload.blueprintKey);}
 async function saveDraft(client,a,draft){
  const next={...drafts(a.connection),[draft.definition.blueprintKey]:{...draft,updatedAt:new Date(a.time).toISOString()}},metadata={...a.connection.metadata,ownCompanyTemplateDrafts:next};
  const result=await client.query(`UPDATE public."WhatsAppConnection" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[a.connection.id,a.connection.projectId,JSON.stringify(metadata)]);if(result.rowCount!==1)fail('META_OWN_TEMPLATE_WRITE_UNCONFIRMED',503);a.connection.metadata=metadata;
 }
 const workbench=a=>publicCustomerTemplateWorkbench({...a.connection,metadata:{customerTemplateDrafts:drafts(a.connection)}});
 async function record(client,member,project,input,metadata){
  const row={id:receiptId(member,project.id,input.operationId),metadata};
  const written=await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'company.own.template.recorded','WhatsAppConnection',$4,$5::jsonb)`,[row.id,member.organizationId,member.actorId,input.payload.connectionId,JSON.stringify(metadata)]);if(written.rowCount!==1)fail('META_OWN_TEMPLATE_WRITE_UNCONFIRMED',503);return row;
 }
 return {
  async read(session,context){return within(session,context,false,async(client,member,scope,project)=>{
   const a=await authority(client,member,session,project,false);
   return {...identity(member),scope,projectId:project.id,connectionId:a.connection.id,ownerRevision:a.connection.ownerRevision,grantDigest:a.policy.grantDigest,validUntil:a.policy.validUntil,canManage:true,sendingAccepted:false,workbench:workbench(a)};
  });},
  async readReceipt(session,context){return within(session,context,false,async(client,member,scope,project)=>{
   const row=await previous(client,member,project.id,context.operationId);return row?publicReceipt(row,member,scope,project.id):null;
  });},
  async command(session,raw){
   const input=normalizeOwnTemplateCommand(raw),requestDigest=digest(input),recover=input.action==='RECOVER_OWN_TEMPLATE';
   let claim;
   try{claim=await within(session,input,true,async(client,member,scope,project)=>{
    const a=await authority(client,member,session,project,true);binding(a,input);
    const definition=definitionFor(a.connection,input),key=definition.blueprintKey,current=drafts(a.connection)[key],prior=await previous(client,member,project.id,input.operationId,true);
    let original=prior;
    if(prior){
     if(prior.metadata.requestDigest===requestDigest)return {done:publicReceipt(prior,member,scope,project.id)};
     // An explicit GET-only recovery may finish the original UUID. Its original
     // action, request digest and authorization remain unchanged in history.
     if(!recover||input.payload.recoveryOf!==prior.metadata.action||!['SUBMIT_OWN_TEMPLATE','RECOVER_OWN_TEMPLATE'].includes(prior.metadata.action)||prior.metadata.state!=='PROVIDER_STARTED'||prior.metadata.connectionId!==a.connection.id||prior.metadata.grantDigest!==a.policy.grantDigest||prior.metadata.ownerRevision!==a.connection.ownerRevision||prior.metadata.blueprintKey!==key||prior.metadata.contentSha256!==definition.contentSha256)fail('META_OWN_TEMPLATE_OPERATION_CONFLICT');
    }else if(recover&&input.payload.recoveryOf!==null)fail('META_OWN_TEMPLATE_OPERATION_CONFLICT');
    if(input.action==='PREPARE_OWN_TEMPLATE'){
     if(current&&(current.definition?.contentSha256!==definition.contentSha256||current.grantDigest!==a.policy.grantDigest))fail('META_CUSTOMER_TEMPLATE_VERSION_REVIEW');
     if(!current)await saveDraft(client,a,{definition,state:'DRAFT',createdAt:new Date(a.time).toISOString(),preparedBy:member.actorId,grantDigest:a.policy.grantDigest});
     const row=await record(client,member,project,input,{version:1,projectId:project.id,operationId:input.operationId,action:input.action,requestDigest,connectionId:a.connection.id,ownerRevision:a.connection.ownerRevision,grantDigest:a.policy.grantDigest,blueprintKey:key,contentSha256:definition.contentSha256,state:'RECORDED',submissionState:current?.state||'DRAFT',providerConfirmed:false});
     return {done:publicReceipt(row,member,scope,project.id)};
    }
    if(!current||current.definition?.contentSha256!==definition.contentSha256||current.definition.name!==definition.name||current.grantDigest!==a.policy.grantDigest)fail('META_CUSTOMER_TEMPLATE_VERSION_REVIEW');
    if(!recover){try{assertTemplateReviewDefinition(input.payload.review,definition);}catch(error){if(error instanceof TemplateReviewError)fail(error.code,error.status);throw error;}if(current.state!=='DRAFT')fail('META_OWN_TEMPLATE_RECOVERY_REQUIRED');}
    else if(!['SUBMISSION_STARTED','SUBMISSION_UNKNOWN','SUBMITTED'].includes(current.state))fail('META_CUSTOMER_TEMPLATE_RECOVERY_UNAVAILABLE');
    const revision=(current.observationRevision||0)+1;if(!Number.isSafeInteger(revision))fail();
    await saveDraft(client,a,{...current,state:recover?'SUBMISSION_UNKNOWN':'SUBMISSION_STARTED',submissionOperationId:current.submissionOperationId||input.operationId,observationOperationId:input.operationId,observationRevision:revision,lastConfirmedObservation:current.lastConfirmedObservation||null,providerStatus:null,providerCategory:null,lastCode:null});
    if(!original)original=await record(client,member,project,input,{version:1,projectId:project.id,operationId:input.operationId,action:input.action,requestDigest,connectionId:a.connection.id,ownerRevision:a.connection.ownerRevision,grantDigest:a.policy.grantDigest,blueprintKey:key,contentSha256:definition.contentSha256,state:'PROVIDER_STARTED',submissionState:recover?'SUBMISSION_UNKNOWN':'SUBMISSION_STARTED',providerConfirmed:false,providerMutationAuthorized:!recover,reservedAt:new Date(a.time).toISOString()});
    return {input,definition,original,observationRevision:revision,scope,organizationId:member.organizationId,actorId:member.actorId};
   });}catch(error){
    // A definite rejection before any provider reservation has its own receipt.
    // An existing UUID or an uncertain transaction is never overwritten/reset.
    if(!(error instanceof WorkspaceError)||error.status>=500)throw error;
    return within(session,input,true,async(client,member,scope,project)=>{
     if(await previous(client,member,project.id,input.operationId,true))throw error;
     const p=input.payload,row=await record(client,member,project,input,{version:1,projectId:project.id,operationId:input.operationId,action:input.action,requestDigest,connectionId:p.connectionId,ownerRevision:p.ownerRevision,grantDigest:p.grantDigest,blueprintKey:p.review?.blueprintKey||p.blueprintKey,state:'REJECTED',providerConfirmed:false,providerMutationAuthorized:false,code:error.code,rejectedAt:new Date(now()).toISOString()});
     return publicReceipt(row,member,scope,project.id);
    });
   }
   if(claim.done)return claim.done;
   await afterReservation();
   // The durable reservation above commits before the only possible create.
   // Canonical project, owner, issuer and credential locks span all awaits.
   return within(session,input,true,async(client,member,scope,project)=>{
    const fence=async()=>{
     const a=await authority(client,member,session,project,true);binding(a,input);
     const row=await previous(client,member,project.id,input.operationId,true),d=drafts(a.connection)[claim.definition.blueprintKey];
     if(!row||row.metadata.requestDigest!==claim.original.metadata.requestDigest||row.metadata.state!=='PROVIDER_STARTED'||d?.observationOperationId!==input.operationId||d.observationRevision!==claim.observationRevision||d.grantDigest!==a.policy.grantDigest||d.definition.name!==claim.definition.name||d.definition.contentSha256!==claim.definition.contentSha256)fail();
     return a;
    };
    let a=await fence(),remote=null,code=null;
    const token=decryptCustomerSecret(a.connection.encryptedAccessToken,{organizationId:member.organizationId,projectId:a.connection.projectId,purpose:'access-token',resourceId:a.connection.phoneNumberId},environment);
    try{
     const scoped=await provider.forOwnTemplateAdministration({capability:a.capability,connection:a.connection,token,beforeExternal:fence,context:{member,session,project},blueprintKey:claim.definition.blueprintKey});
     remote=await scoped.findTemplate({token,wabaId:a.connection.whatsappBusinessId,name:claim.definition.name});
     if(remote&&!customerRemoteTemplateMatches(remote,claim.definition))fail('META_CUSTOMER_TEMPLATE_OWNERSHIP_CONFLICT');
     if(!remote&&!recover){await fence();await scoped.createTemplate({token,wabaId:a.connection.whatsappBusinessId,definition:claim.definition});remote=await scoped.findTemplate({token,wabaId:a.connection.whatsappBusinessId,name:claim.definition.name});}
     if(!remote||!customerRemoteTemplateMatches(remote,claim.definition))fail('META_CUSTOMER_TEMPLATE_SUBMISSION_UNCONFIRMED',503);
    }catch(error){code=error instanceof WorkspaceError?error.code:'META_CUSTOMER_TEMPLATE_SUBMISSION_UNCONFIRMED';}
    a=await fence();const current=drafts(a.connection)[claim.definition.blueprintKey],state=code?'SUBMISSION_UNKNOWN':'SUBMITTED';
    await saveDraft(client,a,{...current,state,lastCode:code,providerId:code?current.providerId||null:String(remote.id),providerStatus:code?null:remote.status,providerCategory:code?null:remote.category,lastConfirmedObservation:code?current.lastConfirmedObservation:{providerId:String(remote.id),status:remote.status,category:remote.category,recordedAt:new Date(a.time).toISOString(),source:'PROVIDER_READBACK'}});
    const observation={version:1,operationId:input.operationId,requestDigest,action:input.action,observationRevision:claim.observationRevision,providerMutationAuthorized:!recover,submissionState:state,providerConfirmed:!code,providerStatus:code?null:remote.status,code,observedAt:new Date(a.time).toISOString()};
    const changed=await client.query(`UPDATE public."AuditLog" SET metadata=metadata||$2::jsonb WHERE id=$1`,[claim.original.id,JSON.stringify({state:'RECORDED',submissionState:state,providerConfirmed:!code,providerStatus:observation.providerStatus,code,lastObservation:observation})]);if(changed.rowCount!==1)fail('META_OWN_TEMPLATE_WRITE_UNCONFIRMED',503);
    if(recover){const observed=await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'company.own.template.observed','WhatsAppConnection',$4,$5::jsonb)`,['company_own_template_observation_'+digest([claim.original.id,claim.observationRevision]),member.organizationId,member.actorId,a.connection.id,JSON.stringify({...observation,originalReceiptId:claim.original.id,originalRequestDigest:claim.original.metadata.requestDigest})]);if(observed.rowCount!==1)fail('META_OWN_TEMPLATE_WRITE_UNCONFIRMED',503);}
    return publicReceipt({...claim.original,metadata:{...claim.original.metadata,state:'RECORDED',submissionState:state,providerConfirmed:!code,providerStatus:observation.providerStatus,code}},member,scope,project.id);
   });
  },
 };
}
