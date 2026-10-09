import {WorkspaceError,workspaceId,operationId,digest} from './workspace-policy.mjs';
import {companyChannelSchemaReady,requireCompanyChannelSchema} from './company-channel-schema.mjs';
import {assertWorkerCustomerConnection} from './worker-channel-identity.mjs';
import {META_KYC_CONVERSATION_TTL_MS} from './meta-kyc-conversation.mjs';
import {customerLifecycleRecovery} from './meta-customer-coexistence.mjs';
import {customerChannelActive} from './meta-customer-outbound.mjs';
import {lockOwnCompanyIssuer,revokeOwnCompanyRuntimeGrant} from './meta-own-company-policy.mjs';

export const COMPANY_CHANNEL_ACTIONS=Object.freeze(['PREPARE','ASSIGN','REVOKE','ACTIVATE','SUSPEND']);
const fail=(code,status=409)=>{throw new WorkspaceError(code,status);};
const receiptId=(member,projectId,id)=>'company_channel_'+digest([member.organizationId,member.actorId,projectId,id]);
function command(body){
 if(!body||Object.keys(body).sort().join('|')!=='action|operationId|payload|projectId|scope'||!workspaceId(body.projectId)||!/^[a-f0-9]{64}$/.test(body.scope||'')||!operationId(body.operationId)||!COMPANY_CHANNEL_ACTIONS.includes(body.action))fail('COMPANY_CHANNEL_INPUT_INVALID',400);
 const p=body.payload;if(!p||Object.keys(p).sort().join('|')!=='connectionId|revision|targetProjectId'||!workspaceId(p.connectionId)||!Number.isSafeInteger(p.revision)||p.revision<0||p.revision>2147483646||(['ASSIGN','REVOKE'].includes(body.action)?!workspaceId(p.targetProjectId):p.targetProjectId!==null))fail('COMPANY_CHANNEL_INPUT_INVALID',400);
 return {...body,operationId:body.operationId.toLowerCase()};
}
const identity=(member)=>({organization:{id:member.organizationId,name:member.organizationName},actor:{id:member.actorId,role:member.role}});
const capabilities=operational=>({attendance:operational,kyc:operational,media:operational,flows:false,templates:false});
// Support describes the channel, never a participant's individual permission.
// Callers supply the canonical database clock used for this read.
export function companyChannelOperationalCapabilities(connection,{schemaReady=false,mode=connection?.company?.mode,now,environment=process.env,authorityReady=true}={}){
 return capabilities(authorityReady&&schemaReady===true&&mode==='COMPANY'&&Number.isFinite(now)&&!connection?.metadata?.developmentPilot&&customerChannelActive(connection,now,{environment}));
}
async function channels(client,member,ready,connectionId=null,environment=process.env){
 const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now.getTime();
 const rows=(await client.query(`SELECT c.id,c."projectId",c."phoneNumberId",c."whatsappBusinessId",c."encryptedAccessToken",c."projectId" AS "anchorProjectId",p.name AS "anchorName",c."displayPhoneNumber",c.enabled,c."connectionStatus",c.metadata${ready?',cc.mode,cc.revision':''} FROM public."WhatsAppConnection" c JOIN public."Project" p ON p.id=c."projectId" ${ready?'JOIN public."WhatsAppCompanyChannel" cc ON cc."connectionId"=c.id AND cc."organizationId"=p."organizationId"':''} WHERE p."organizationId"=$1 AND ($2::text IS NULL OR c.id=$2) ORDER BY c.id LIMIT 101`,[member.organizationId,connectionId])).rows;
 for(const row of rows)if(row.metadata?.ownCompany||Object.hasOwn(row.metadata||{},'ownCompanyRuntime')){try{await lockOwnCompanyIssuer(client,row,{environment,now,lock:false});}catch{row.ownUnavailable=true;}}
 const assignments=ready?(await client.query(`SELECT a."connectionId",a."projectId",p.name AS "projectName",a.status,a.revision FROM public."WhatsAppChannelProjectAssignment" a JOIN public."Project" p ON p.id=a."projectId" AND p."organizationId"=a."organizationId" WHERE a."organizationId"=$1 AND ($2::text IS NULL OR a."connectionId"=$2) ORDER BY a."connectionId",a."projectId" LIMIT 10001`,[member.organizationId,connectionId])).rows:[];
 return {truncated:rows.length>100||assignments.length>10000||rows.some(r=>assignments.filter(a=>a.connectionId===r.id).length>100),channels:rows.slice(0,100).map(r=>({id:r.id,anchorProjectId:r.anchorProjectId,anchorName:r.anchorName,displayPhoneNumber:r.displayPhoneNumber,mode:r.mode||'PROJECT_ONLY',revision:r.revision||0,capabilities:companyChannelOperationalCapabilities(r,{schemaReady:ready,mode:r.mode,now,environment,authorityReady:!r.ownUnavailable}),assignments:assignments.filter(a=>a.connectionId===r.id).slice(0,100).map(a=>({projectId:a.projectId,projectName:a.projectName,status:a.status,revision:a.revision}))}))};
}
async function previous(client,member,projectId,id){return (await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND action='company.channel.recorded' AND metadata->>'projectId'=$4`,[receiptId(member,projectId,id),member.organizationId,member.actorId,projectId])).rows[0];}
function publicReceipt(row,member,scope){const m=row.metadata;return {...identity(member),scope,projectId:m.projectId,operationId:m.operationId,action:m.action,state:m.state,saved:m.state==='RECORDED',definitive:true,receiptId:row.id,replayed:true,...(m.code?{code:m.code}:{}),...(m.channel?{channel:m.channel}:{})};}
export function companyChannelKycPending(worker,connection,now){
 const challenge=worker.metadata?.participant?.kycChatChallenge;
 if(!worker.active||!challenge||challenge.connectionId!==connection.id||challenge.organizationId!==connection.metadata?.credentialOrganizationId||challenge.projectId!==connection.projectId||challenge.workerId!==worker.id||['COMPLETED','CANCELLED','REVOKED'].includes(challenge.status))return false;
 // The canonical KYC resolver rejects expired challenge/claimed authority.
 // A retained encrypted envelope alone never authorizes another KYC write.
 const expiresAt=Date.parse(challenge.expiresAt),claimedAt=Date.parse(challenge.claimedAt);
 if(challenge.version!==1||!['PENDING','CLAIMED'].includes(challenge.status)||!Number.isFinite(expiresAt)||challenge.status==='CLAIMED'&&!Number.isFinite(claimedAt))return true;
 return expiresAt>now&&(challenge.status!=='CLAIMED'||claimedAt+META_KYC_CONVERSATION_TTL_MS>now);
}
export async function assertCompanyChannelNoPending(client,c){
 const project=(await client.query(`SELECT metadata FROM public."Project" WHERE id=$1`,[c.projectId])).rows[0];
 const signup=project?.metadata?.metaSignup;if(signup&&!['CANCELLED','LINKED_PENDING_ACCEPTANCE'].includes(signup.state))fail('COMPANY_CHANNEL_LEGACY_PENDING');
 // Expiring a local lease cannot prove that an already reserved remote call
 // finished. Keep the original lane available for its canonical reconciliation.
 const activation=c.metadata?.customerActivation,recovery=customerLifecycleRecovery(c),coexistence=c.metadata?.coexistence;
 if(activation&&!['ACTIVE','DEACTIVATED'].includes(activation.state)||recovery&&!['RESTORED','KEPT_DISABLED'].includes(recovery.state)||['contacts','history'].some(kind=>coexistence?.[kind]&&!['NOT_SELECTED','COMPLETED','DECLINED','PROVIDER_COMPLETE_OBSERVED'].includes(coexistence[kind].state))||Object.values(c.metadata?.customerTemplateDrafts||{}).some(draft=>['SUBMISSION_STARTED','SUBMISSION_UNKNOWN'].includes(draft?.state)))fail('COMPANY_CHANNEL_LEGACY_PENDING');
 const events=(await client.query(`SELECT EXISTS(SELECT 1 FROM public."WebhookEvent" WHERE "projectId"=$1 AND ((provider='meta-customer-v1' AND status='PENDING') OR (provider='meta-customer-outbound-v1' AND outcome->>'state' IN ('SEND_STARTED','SEND_UNKNOWN')))) AS pending`,[c.projectId])).rows[0].pending;
 const workers=(await client.query(`SELECT id,active,metadata FROM public."Worker" WHERE "projectId"=$1 AND active=true`,[c.projectId])).rows;
 const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now.getTime();
 const sessions=workers.some(w=>companyChannelKycPending(w,c,now)||[w.metadata?.fieldChannelConversation,w.metadata?.participant?.channelIdentity?.challenge].some(v=>v&&['PENDING','ACTIVE','PREPARED'].includes(v.status||'ACTIVE')&&(!Number.isFinite(Date.parse(v.expiresAt))||Date.parse(v.expiresAt)>now)));
 const flowTable=(await client.query(`SELECT to_regclass('public."WhatsAppFlowSession"') IS NOT NULL AS present`)).rows[0].present;
 // Existing Flow sessions are keyed by tenant/project/phoneNumberId, with
 // terminal timestamps. They have no connectionId or status column.
 const flows=flowTable&&(await client.query(`SELECT EXISTS(SELECT 1 FROM public."WhatsAppFlowSession" WHERE "organizationId"=$1 AND "projectId"=$2 AND "phoneNumberId"=$3 AND "consumedAt" IS NULL AND "deliveryRejectedAt" IS NULL AND "expiresAt" AT TIME ZONE 'UTC'>clock_timestamp()) AS pending`,[c.metadata?.credentialOrganizationId,c.projectId,c.phoneNumberId])).rows[0].pending;
 if(events||sessions||flows)fail('COMPANY_CHANNEL_LEGACY_PENDING');
}
export function createCompanyChannelStore({workspace,ownConnection=null,environment=process.env}){
 return {
  async read(session,context){
   if(context.discovery==='OWN_NUMBER'){if(!ownConnection)fail('META_OWN_COMPANY_CONFIGURATION_PENDING',503);return ownConnection.discover(session,context);}
   if(context.operationId&&ownConnection){const own=await ownConnection.read(session,context);if(own)return own;}
   if(!workspaceId(context.projectId)||!/^[a-f0-9]{64}$/.test(context.scope||'')||context.operationId!==undefined&&!operationId(context.operationId))fail('COMPANY_CHANNEL_INPUT_INVALID',400);
   return workspace.organizationOperation(session,context,false,async(client,member,scope)=>{
    if(context.operationId){const row=await previous(client,member,context.projectId,context.operationId.toLowerCase());return row?publicReceipt(row,member,scope):{...identity(member),scope,projectId:context.projectId,operationId:context.operationId.toLowerCase(),state:'NOT_OBSERVED',saved:false,definitive:false};}
    const schemaReady=await companyChannelSchemaReady(client),data=await channels(client,member,schemaReady,null,environment),projects=(await client.query(`SELECT id,name FROM public."Project" WHERE "organizationId"=$1 AND status='ACTIVE' ORDER BY id LIMIT 101`,[member.organizationId])).rows;
    return {...identity(member),scope,projectId:context.projectId,schemaReady,canManage:member.role==='ADMIN',channels:data.channels,projects:projects.slice(0,100),truncated:data.truncated||projects.length>100,capabilities:capabilities(data.channels.some(item=>item.capabilities.media)),accepted:false};
   },Boolean(context.operationId));
  },
  async command(session,body){
   if(['CONNECT_OWN_NUMBER','ACTIVATE_OWN_NUMBER'].includes(body?.action)){if(!ownConnection)fail('META_OWN_COMPANY_CONFIGURATION_PENDING',503);return ownConnection.command(session,body);}
   const input=command(body),fingerprint=digest(input);
   return workspace.organizationOperation(session,input,true,async(client,member,scope)=>{
    const prior=await previous(client,member,input.projectId,input.operationId);if(prior){if(prior.metadata.requestDigest!==fingerprint)fail('COMPANY_CHANNEL_OPERATION_CONFLICT');return publicReceipt(prior,member,scope);}
    // Identity precedes sorted projects. An organization admin operation cannot
    // invent an actor or move the credential anchor to the selected worksite.
    const discovery=(await client.query(`SELECT c.id,c."projectId" FROM public."WhatsAppConnection" c JOIN public."Project" p ON p.id=c."projectId" WHERE c.id=$1 AND p."organizationId"=$2`,[input.payload.connectionId,member.organizationId])).rows[0];
    if(!discovery)fail('COMPANY_CHANNEL_CONNECTION_REQUIRED',403);
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['company-channel-operation:'+receiptId(member,input.projectId,input.operationId)]);
    const again=await previous(client,member,input.projectId,input.operationId);if(again){if(again.metadata.requestDigest!==fingerprint)fail('COMPANY_CHANNEL_OPERATION_CONFLICT');return publicReceipt(again,member,scope);}
    for(const id of [...new Set([input.projectId,discovery.projectId,input.payload.targetProjectId].filter(Boolean))].sort()){const p=(await client.query(`SELECT id,status::text AS status FROM public."Project" WHERE id=$1 AND "organizationId"=$2 FOR UPDATE`,[id,member.organizationId])).rows[0];if(!p||id!==discovery.projectId&&p.status!=='ACTIVE')fail('COMPANY_CHANNEL_CONTEXT_CHANGED',403);}
    const c=(await client.query(`SELECT * FROM public."WhatsAppConnection" WHERE id=$1 AND "projectId"=$2 FOR UPDATE`,[discovery.id,discovery.projectId])).rows[0];
    await client.query('SAVEPOINT company_channel_action');let state='RECORDED',code=null,runtimeRevocation=null;
    try{
     if(c?.metadata?.developmentPilot)fail('COMPANY_CHANNEL_CATALOG_REQUIRED');
     await requireCompanyChannelSchema(client);if(!(input.action==='SUSPEND'&&Object.hasOwn(c.metadata||{},'ownCompanyRuntime')))assertWorkerCustomerConnection(c,member.organizationId,c.projectId);
     const owner=(await client.query(`SELECT * FROM public."WhatsAppCompanyChannel" WHERE "connectionId"=$1 AND "organizationId"=$2 FOR UPDATE`,[c.id,member.organizationId])).rows[0];if(!owner||owner.anchorProjectId!==c.projectId)fail('COMPANY_CHANNEL_CATALOG_REQUIRED');
     if(owner.revision!==input.payload.revision)fail('COMPANY_CHANNEL_REVISION_CHANGED');
     const action=input.action;
     if(['ASSIGN','ACTIVATE'].includes(action)){const bounded=await channels(client,member,true,null,environment),projectCount=(await client.query(`SELECT count(*)::int AS count FROM public."Project" WHERE "organizationId"=$1 AND status='ACTIVE'`,[member.organizationId])).rows[0].count;if(bounded.truncated||projectCount>100)fail('COMPANY_CHANNEL_CATALOG_REQUIRED');}
     if(action==='PREPARE'){if(owner.mode!=='PROJECT_ONLY')fail('COMPANY_CHANNEL_REVISION_CHANGED');await client.query(`UPDATE public."WhatsAppCompanyChannel" SET mode='PREPARED',revision=revision+1,"updatedAt"=clock_timestamp() WHERE "connectionId"=$1`,[c.id]);}
      else if(action==='ACTIVATE'){if(!['PREPARED','SUSPENDED'].includes(owner.mode))fail('COMPANY_CHANNEL_REVISION_CHANGED');if(Object.hasOwn(c.metadata||{},'ownCompanyRuntime'))await lockOwnCompanyIssuer(client,c,{environment});await assertCompanyChannelNoPending(client,c);const count=(await client.query(`SELECT count(*)::int AS count FROM public."WhatsAppChannelProjectAssignment" WHERE "connectionId"=$1 AND status='ACTIVE'`,[c.id])).rows[0].count;if(count<1||count>100)fail('COMPANY_CHANNEL_ASSIGNMENT_CONFLICT');await client.query(`UPDATE public."WhatsAppCompanyChannel" SET mode='COMPANY',revision=revision+1,"updatedAt"=clock_timestamp() WHERE "connectionId"=$1`,[c.id]);await client.query(`UPDATE public."WhatsAppConnection" SET metadata=jsonb_set(COALESCE(metadata,'{}'::jsonb),'{companyRoutingVersion}','1'::jsonb) WHERE id=$1`,[c.id]);}
      else if(action==='SUSPEND'){
       if(!['PROJECT_ONLY','PREPARED','COMPANY'].includes(owner.mode))fail('COMPANY_CHANNEL_REVISION_CHANGED');
       const revoked=revokeOwnCompanyRuntimeGrant(c,{member,projectId:input.projectId,receiptId:receiptId(member,input.projectId,input.operationId),operationId:input.operationId});
       if(revoked){runtimeRevocation=revoked.revocation;await client.query(`UPDATE public."WhatsAppConnection" SET enabled=false,metadata=metadata||$2::jsonb WHERE id=$1`,[c.id,JSON.stringify({ownCompanyRuntime:revoked,customerActivation:{...c.metadata.customerActivation,state:'DEACTIVATED'}})]);}
       await client.query(`UPDATE public."WhatsAppCompanyChannel" SET mode='SUSPENDED',revision=revision+1,"updatedAt"=clock_timestamp() WHERE "connectionId"=$1`,[c.id]);
      }
     else {
      if(owner.mode==='PROJECT_ONLY')fail('COMPANY_CHANNEL_REVISION_CHANGED');
      const target=input.payload.targetProjectId,other=(await client.query(`SELECT "connectionId" FROM public."WhatsAppChannelProjectAssignment" WHERE "projectId"=$1 AND status='ACTIVE' FOR UPDATE`,[target])).rows[0];if(other&&other.connectionId!==c.id)fail('COMPANY_CHANNEL_ASSIGNMENT_CONFLICT');
      if(action==='ASSIGN'&&other)fail('COMPANY_CHANNEL_ASSIGNMENT_CONFLICT');
      if(action==='ASSIGN'&&target!==c.projectId){const targetSignup=(await client.query(`SELECT metadata->'metaSignup' AS signup FROM public."Project" WHERE id=$1 AND "organizationId"=$2`,[target,member.organizationId])).rows[0]?.signup;if(targetSignup&&targetSignup.state!=='CANCELLED')fail('COMPANY_CHANNEL_LEGACY_PENDING');}
      if(action==='ASSIGN')await client.query(`INSERT INTO public."WhatsAppChannelProjectAssignment"("connectionId","organizationId","projectId",status) VALUES($1,$2,$3,'ACTIVE') ON CONFLICT("connectionId","projectId") DO UPDATE SET status='ACTIVE',revision="WhatsAppChannelProjectAssignment".revision+1,"updatedAt"=clock_timestamp()`,[c.id,member.organizationId,target]);
      else {const changed=await client.query(`UPDATE public."WhatsAppChannelProjectAssignment" SET status='REVOKED',revision=revision+1,"updatedAt"=clock_timestamp() WHERE "connectionId"=$1 AND "projectId"=$2 AND status='ACTIVE'`,[c.id,target]);if(changed.rowCount!==1)fail('COMPANY_CHANNEL_ASSIGNMENT_CONFLICT');}
      await client.query(`UPDATE public."WhatsAppCompanyChannel" SET revision=revision+1,"updatedAt"=clock_timestamp() WHERE "connectionId"=$1`,[c.id]);
     }
    }catch(error){if(!(error instanceof WorkspaceError)||!['COMPANY_CHANNEL_CATALOG_REQUIRED','COMPANY_CHANNEL_REVISION_CHANGED','COMPANY_CHANNEL_LEGACY_PENDING','COMPANY_CHANNEL_ASSIGNMENT_CONFLICT','WORKER_CHANNEL_CUSTOMER_CONNECTION_REQUIRED','META_OWN_COMPANY_UNAVAILABLE'].includes(error.code))throw error;await client.query('ROLLBACK TO SAVEPOINT company_channel_action');state='REJECTED';runtimeRevocation=null;code=['WORKER_CHANNEL_CUSTOMER_CONNECTION_REQUIRED','META_OWN_COMPANY_UNAVAILABLE'].includes(error.code)?'COMPANY_CHANNEL_CONNECTION_REQUIRED':error.code;}
    const ready=await companyChannelSchemaReady(client),channel=(await channels(client,member,ready,c.id,environment)).channels.find(item=>item.id===c.id)||null,id=receiptId(member,input.projectId,input.operationId),details={version:1,projectId:input.projectId,operationId:input.operationId,action:input.action,requestDigest:fingerprint,state,code,channel,...(runtimeRevocation?{runtimeRevocation}:{})};
    await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'company.channel.recorded','WhatsAppConnection',$4,$5::jsonb)`,[id,member.organizationId,member.actorId,c.id,JSON.stringify(details)]);
    return {...publicReceipt({id,metadata:details},member,scope),replayed:false};
   });
  }
 };
}
