import {randomUUID} from 'node:crypto';
import {WorkspaceError,digest,workspaceId,operationId} from './workspace-policy.mjs';
import {resolveOwnWorkerParticipant,createWorkerChannelStore,invalidateWorkerChannelIdentity} from './worker-channel-identity.mjs';
import {encryptCustomerSecret,customerSecretDigest} from './meta-customer-credentials.mjs';
import {resolveMetaTransport} from './meta-whatsapp-transport.mjs';
import {testRecipients} from './meta-test-dispatch.mjs';
import {OBRASAAS_META_CHANNEL} from './meta-channel-binding.mjs';
import {META_DEMO_PILOT_PROTOCOL,metaCloudEventMatches} from './meta-cloud-protocol.mjs';
import {META_DEMO_PILOT_TTL_MS,META_DEMO_NOTICE,META_DEMO_NOTICE_VERSION,META_DEMO_NOTICE_SHA256,demoPilotCommand,metaDemoTransportReadiness,assertDemoPilotConnection,decodeDemoPilotGrant} from './meta-demo-pilot-policy.mjs';

const key=(member,projectId,op)=>'demo_grant_'+digest([member.actorId,projectId,op]);
const fail=(code,status=403)=>{throw new WorkspaceError(code,status);};
const permission=member=>{if(member.role!=='ADMIN'||member.clerkRole!==undefined&&member.clerkRole!=='org:admin')fail('META_DEMO_PILOT_MEMBER_REQUIRED');};
const ownSession=(session,member)=>{permission(member);if(session.organizationRole!=='org:admin')fail('META_DEMO_PILOT_MEMBER_REQUIRED');};
async function receipt(client,member,projectId,op){return (await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND "entityId"=$4 AND action='meta.demo.pilot.recorded'`,[key(member,projectId,op),member.organizationId,member.actorId,projectId])).rows[0];}
async function record(client,member,projectId,id,details){await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'meta.demo.pilot.recorded','Project',$4,$5::jsonb)`,[id,member.organizationId,member.actorId,projectId,JSON.stringify({version:1,purpose:'DEMO_PILOT',projectId,...details})]);}
const publicReceipt=(row,operation)=>({id:row.id,operationId:operation,action:row.metadata.kind,workerId:row.metadata.workerId,channelId:row.metadata.channelId||null,expiresAt:row.metadata.expiresAt||null});
const recorded=(row,context,replayed=false)=>({scope:context.scope,projectId:context.projectId,state:'RECORDED',saved:true,replayed,receipt:publicReceipt(row,context.operationId),identityCertified:false,productionVerified:false});
async function readConnection(client,projectId,organizationId,lock=false){const rows=(await client.query(`SELECT id,"projectId","phoneNumberId","whatsappBusinessId","encryptedAccessToken",enabled,"connectionStatus"::text AS "connectionStatus",metadata FROM public."WhatsAppConnection" WHERE "projectId"=$1 ${lock?'FOR UPDATE':''}`,[projectId])).rows;if(rows.length>1)fail('META_DEMO_PILOT_SCOPE_REJECTED');return rows[0]?{...rows[0],organizationId}:null;}
async function emptyProject(client,projectId){
 // Inspect existing canonical relations rather than assume that an absence of
 // tasks means an empty worksite. Identity/assignment/channel are prerequisites.
 const tables=(await client.query(`SELECT c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid WHERE n.nspname='public' AND c.relkind IN ('r','p') AND a.attname='projectId' AND a.attnum>0 AND NOT a.attisdropped AND c.relname NOT IN ('Worker','ProjectMembership','WhatsAppConnection') ORDER BY c.relname LIMIT 129`)).rows;
 if(tables.length>128)fail('META_DEMO_PROJECT_SCHEMA_UNCONFIRMED',503);
 if(!tables.length)fail('META_DEMO_PROJECT_SCHEMA_UNCONFIRMED',503);
 const exists=tables.map(row=>`EXISTS(SELECT 1 FROM public."${row.relname.replaceAll('"','""')}" WHERE "projectId"=$1)`).join(' OR ');
 return !(await client.query(`SELECT ${exists} AS occupied`,[projectId])).rows[0].occupied;
}
export function createMetaDemoPilotStore({workspace,provider,environment=process.env}){
 const channelWorkspace={projectOperation:async(session,input,writable,run)=>workspace.projectOperation(session,input,writable,async(client,member,scope,project)=>{
  ownSession(session,member);const context={...input,scope},prior=writable?await receipt(client,member,project.id,input.operationId):null;
  if(prior){if(prior.metadata.requestDigest!==digest(input))fail('META_DEMO_OPERATION_CONFLICT',409);return recorded(prior,context,true);}
  const result=await run(client,member,scope,project);
  if(writable){const id=key(member,project.id,input.operationId),c=await readConnection(client,project.id,member.organizationId);await record(client,member,project.id,id,{kind:input.action,requestDigest:digest(input),workerId:input.payload.workerId,channelId:c?.id||null,canonicalReceiptId:result.receiptId});return {...recorded({id,metadata:{kind:input.action,workerId:input.payload.workerId,channelId:c?.id}},context),...(result.code?{code:result.code}:{}),participant:result.participant,codeUnavailable:result.codeUnavailable===true};}
  return result;
 })};
 const workerChannels=createWorkerChannelStore({workspace:channelWorkspace,environment,protocol:META_DEMO_PILOT_PROTOCOL,assertConnection:(c,org,pid,now,opts)=>assertDemoPilotConnection(c,org,pid,now,opts,environment)});
 async function preflight(session,input,writable=false){return workspace.projectOperation(session,input,writable,async(client,member,scope,project)=>{
  ownSession(session,member);const prior=await receipt(client,member,project.id,input.operationId);if(prior){if(prior.metadata.requestDigest!==digest(input))fail('META_DEMO_OPERATION_CONFLICT',409);return {done:recorded(prior,{...input,scope},true)};}
  const worker=await resolveOwnWorkerParticipant(client,member,{clerkUserId:session.userId,projectId:project.id,workerId:input.payload.workerId,lock:writable});
  if(worker.revision!==input.payload.revision)fail('WORKER_CHANNEL_REVISION_CHANGED',409);
  if(!testRecipients(environment).includes(worker.phone.slice(1)))fail('META_DEMO_RECIPIENT_NOT_ALLOWED');
  const c=await readConnection(client,project.id,member.organizationId,writable),marked=project.metadata?.demoPilotSandbox;
  if(c&&c.metadata?.credentialFormat!==META_DEMO_PILOT_PROTOCOL.credentialFormat)fail('META_DEMO_COMMERCIAL_CHANNEL_PROTECTED',409);
  if(!marked&&(!await emptyProject(client,project.id)||(await client.query(`SELECT count(*)::int AS n FROM public."Worker" WHERE "projectId"=$1`,[project.id])).rows[0].n!==1))fail('META_DEMO_EMPTY_PROJECT_REQUIRED',409);
  if(marked&&(marked.version!==1||marked.purpose!=='DEMO_PILOT'||marked.actorId!==member.actorId))fail('META_DEMO_PILOT_SCOPE_REJECTED');
  if(c){const old=decodeDemoPilotGrant(c,environment);if(old.actorId!==member.actorId||old.workerId!==worker.id)fail('META_DEMO_PILOT_SCOPE_REJECTED');if(c.enabled===true&&c.metadata.demoPilot.state==='ACTIVE'&&Date.parse(old.expiresAt)>Date.now())fail('META_DEMO_PILOT_ALREADY_ACTIVE',409);}
  const elsewhere=(await client.query(`SELECT id FROM public."WhatsAppConnection" WHERE "phoneNumberId"=$1 AND "projectId"<>$2`,[OBRASAAS_META_CHANNEL.phoneNumberId,project.id])).rows;if(elsewhere.length)fail('META_DEMO_PILOT_ALREADY_ASSIGNED',409);
  return {member,scope,project,worker,connection:c};
 });}
 return {
  workerChannels,
  async command(session,body){const input=demoPilotCommand(body);
   if(['REQUEST_CHALLENGE','UNLINK'].includes(input.action)){const payload=input.action==='UNLINK'?{...input.payload,reason:'Revocación explícita del vínculo del piloto DEMO.'}:input.payload;return workerChannels.command(session,{...input,payload});}
   if(input.action==='REVOKE')return workspace.projectOperation(session,input,true,async(client,member,scope,project)=>{
    ownSession(session,member);const prior=await receipt(client,member,project.id,input.operationId);if(prior){if(prior.metadata.requestDigest!==digest(input))fail('META_DEMO_OPERATION_CONFLICT',409);return recorded(prior,{...input,scope},true);}
    const candidate=await readConnection(client,project.id,member.organizationId);if(!candidate)fail('META_DEMO_PILOT_SCOPE_REJECTED');const grant=decodeDemoPilotGrant(candidate,environment);if(grant.actorId!==member.actorId||grant.clerkUserId!==session.userId||grant.workerId!==input.payload.workerId)fail('META_DEMO_PILOT_MEMBER_REQUIRED');
    const row=(await client.query(`SELECT id,metadata,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."Worker" WHERE id=$1 AND "projectId"=$2 FOR UPDATE`,[grant.workerId,project.id])).rows[0];if(!row||row.revision!==input.payload.revision)fail('WORKER_CHANNEL_REVISION_CHANGED',409);
    const c=await readConnection(client,project.id,member.organizationId,true);if(!c||c.id!==candidate.id||digest(c.metadata)!==digest(candidate.metadata))fail('META_DEMO_CONTEXT_CHANGED',409);
    const at=new Date().toISOString(),meta={...c.metadata,demoPilot:{...c.metadata.demoPilot,state:'REVOKED',revokedAt:at}};
    await client.query(`UPDATE public."WhatsAppConnection" SET enabled=false,"connectionStatus"='DISABLED',metadata=$2::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1`,[c.id,JSON.stringify(meta)]);
    await client.query(`UPDATE public."Worker" SET metadata=$2::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1`,[row.id,JSON.stringify(invalidateWorkerChannelIdentity(row.metadata,{at,reasonCode:'DEMO_PILOT_REVOKED'}))]);
    const id=key(member,project.id,input.operationId),details={kind:'REVOKE',requestDigest:digest(input),workerId:row.id,channelId:c.id};await record(client,member,project.id,id,details);return recorded({id,metadata:details},{...input,scope});
   });
   if(!metaDemoTransportReadiness(environment).canLaunchMeta)fail('META_DEMO_CONFIGURATION_PENDING',503);
   const before=await preflight(session,input);if(before.done)return before.done;
   const token=resolveMetaTransport(environment).token,credentialDigest=customerSecretDigest(token),verified=await provider.inspect({token,wabaId:OBRASAAS_META_CHANNEL.wabaId,phoneNumberId:OBRASAAS_META_CHANNEL.phoneNumberId}),subscribed=await provider.inspectSubscription({token,wabaId:OBRASAAS_META_CHANNEL.wabaId});
   if(verified.registered!==true)fail('META_DEMO_PHONE_NOT_REGISTERED',409);
   if(subscribed!==true)fail('META_DEMO_APP_NOT_SUBSCRIBED',409);
   return workspace.projectOperation(session,input,true,async(client,member,scope,project)=>{
    ownSession(session,member);const prior=await receipt(client,member,project.id,input.operationId);if(prior){if(prior.metadata.requestDigest!==digest(input))fail('META_DEMO_OPERATION_CONFLICT',409);return recorded(prior,{...input,scope},true);}
    const worker=await resolveOwnWorkerParticipant(client,member,{clerkUserId:session.userId,projectId:project.id,workerId:input.payload.workerId,lock:true});
    if(worker.revision!==before.worker.revision||digest(project.metadata)!==digest(before.project.metadata)||!testRecipients(environment).includes(worker.phone.slice(1))||customerSecretDigest(resolveMetaTransport(environment).token)!==credentialDigest)fail('META_DEMO_CONTEXT_CHANGED',409);
    const c=await readConnection(client,project.id,member.organizationId,true);if(c?.id!==before.connection?.id||c&&digest(c.metadata)!==digest(before.connection.metadata))fail('META_DEMO_CONTEXT_CHANGED',409);
    if(!project.metadata?.demoPilotSandbox&&(!await emptyProject(client,project.id)||(await client.query(`SELECT count(*)::int AS n FROM public."Worker" WHERE "projectId"=$1`,[project.id])).rows[0].n!==1))fail('META_DEMO_EMPTY_PROJECT_REQUIRED',409);
    const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now,expiresAt=new Date(Math.min(now.getTime()+META_DEMO_PILOT_TTL_MS,verified.expiresAt?Date.parse(verified.expiresAt)-60000:Infinity));if(!Number.isFinite(expiresAt.getTime())||expiresAt.getTime()<=now.getTime()+240000)fail('META_DEMO_PROVIDER_PROOF_EXPIRED',409);
    const id=key(member,project.id,input.operationId),channelId=c?.id||'wa_demo_'+randomUUID().replaceAll('-',''),grant={version:1,purpose:'DEMO_PILOT',grantId:id,organizationId:member.organizationId,projectId:project.id,channelId,actorId:member.actorId,membershipId:member.membershipId,clerkUserId:session.userId,workerId:worker.id,senderE164:worker.phone,kycSubmissionId:worker.metadata.participant.kyc.submissionId,kycReviewedAt:worker.metadata.participant.kyc.review.recordedAt,appId:OBRASAAS_META_CHANNEL.appId,wabaId:OBRASAAS_META_CHANNEL.wabaId,phoneNumberId:OBRASAAS_META_CHANNEL.phoneNumberId,noticeVersion:META_DEMO_NOTICE_VERSION,noticeSha256:META_DEMO_NOTICE_SHA256,createdAt:now.toISOString(),expiresAt:expiresAt.toISOString(),credentialDigest,providerObservationDigest:digest({...verified,subscribed:true})};
    const context={organizationId:member.organizationId,projectId:project.id},metadata={credentialFormat:META_DEMO_PILOT_PROTOCOL.credentialFormat,credentialOrganizationId:member.organizationId,demoPilot:{version:1,purpose:'DEMO_PILOT',state:'ACTIVE',grantId:id,encryptedGrant:encryptCustomerSecret(JSON.stringify(grant),{...context,purpose:'demo-pilot-grant',resourceId:id},environment),encryptedProviderObservation:encryptCustomerSecret(JSON.stringify({...verified,subscribed:true,observedAt:now.toISOString()}),{...context,purpose:'demo-provider-observation',resourceId:id},environment)}};
    await client.query(`INSERT INTO public."WhatsAppConnection"(id,"projectId","phoneNumberId","whatsappBusinessId",enabled,"connectionStatus","encryptedAccessToken",metadata,"updatedAt") VALUES($1,$2,$3,$4,true,'CONNECTED',$5,$6::jsonb,clock_timestamp()) ON CONFLICT("projectId") DO UPDATE SET enabled=true,"connectionStatus"='CONNECTED',"encryptedAccessToken"=EXCLUDED."encryptedAccessToken",metadata=EXCLUDED.metadata,"updatedAt"=clock_timestamp()`,[channelId,project.id,OBRASAAS_META_CHANNEL.phoneNumberId,OBRASAAS_META_CHANNEL.wabaId,encryptCustomerSecret(token,{...context,purpose:META_DEMO_PILOT_PROTOCOL.credentialPurpose,resourceId:OBRASAAS_META_CHANNEL.phoneNumberId},environment),JSON.stringify(metadata)]);
    await client.query(`UPDATE public."Project" SET metadata=$2::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1`,[project.id,JSON.stringify({...project.metadata,demoPilotSandbox:{version:1,purpose:'DEMO_PILOT',actorId:member.actorId,grantId:id,markedAt:now.toISOString()}})]);
    await client.query(`UPDATE public."Worker" SET metadata=$2::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1`,[worker.id,JSON.stringify(invalidateWorkerChannelIdentity(worker.metadata,{at:now.toISOString(),reasonCode:'DEMO_PILOT_NEW_GRANT'}))]);
    const details={kind:'PREPARE',workerId:worker.id,channelId,requestDigest:digest(input),grantDigest:digest(grant),noticeSha256:META_DEMO_NOTICE_SHA256,expiresAt:grant.expiresAt};await record(client,member,project.id,id,details);return recorded({id,metadata:details},{...input,scope});
   });
  },
  async read(session,context){if(!workspaceId(context.projectId)||!/^[a-f0-9]{64}$/.test(context.scope||'')||context.operationId!==undefined&&!operationId(context.operationId))fail('META_DEMO_INPUT_INVALID',400);const snapshot=await workspace.projectOperation(session,context,false,async(client,member,scope,project)=>{
   ownSession(session,member);if(context.operationId){const found=await receipt(client,member,project.id,context.operationId.toLowerCase());return found?recorded(found,{...context,scope},true):{scope,projectId:project.id,state:'NOT_OBSERVED',saved:false,definitive:false};}
   const c=await readConnection(client,project.id,member.organizationId),rows=(await client.query(`SELECT id,name,phone,metadata,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."Worker" WHERE "projectId"=$1 AND metadata->'participant'->>'clerkUserId'=$2 ORDER BY id LIMIT 2`,[project.id,session.userId])).rows,participants=[];
   for(const row of rows){let eligible=true,reasonCode=null;try{await resolveOwnWorkerParticipant(client,member,{clerkUserId:session.userId,projectId:project.id,workerId:row.id});if(!testRecipients(environment).includes(row.phone.slice(1)))fail('META_DEMO_RECIPIENT_NOT_ALLOWED');}catch(error){if(!(error instanceof WorkspaceError))throw error;eligible=false;reasonCode=error.code;}participants.push({workerId:row.id,name:row.name,revision:row.revision,eligible,reasonCode,phoneMasked:row.phone?row.phone.slice(0,3)+'…'+row.phone.slice(-2):null});}
   let state='NOT_PREPARED',expiresAt=null,reasonCode=null;if(c){try{const grant=decodeDemoPilotGrant(c,environment);expiresAt=grant.expiresAt;if(grant.actorId!==member.actorId)fail('META_DEMO_PILOT_MEMBER_REQUIRED');assertDemoPilotConnection(c,member.organizationId,project.id,Date.now(),{},environment);state='PREPARED';}catch(error){if(!(error instanceof WorkspaceError))throw error;state='INACTIVE';reasonCode=error.code;}}
   const events=c?(await client.query(`SELECT id,"eventType",status::text AS status,outcome,"lastError" FROM public."WebhookEvent" WHERE "projectId"=$1 AND provider=$2 AND payload->>'channelId'=$3 ORDER BY "createdAt" DESC,id DESC LIMIT 20`,[project.id,META_DEMO_PILOT_PROTOCOL.provider,c.id])).rows.map(row=>({eventId:row.id,eventType:row.eventType,state:row.status,kind:row.outcome?.kind||null,businessApplied:row.outcome?.businessApplied===true,replySent:row.outcome?.replySent===true,code:row.lastError||row.outcome?.code||null})):[];
   if(events.some(row=>!metaCloudEventMatches(META_DEMO_PILOT_PROTOCOL,row.eventId)))fail('META_DEMO_PILOT_PROOF_REQUIRED',409);
   return {scope,projectId:project.id,projectName:project.name,purpose:'DEMO_PILOT',state,expiresAt,reasonCode,participants,events,notice:{version:META_DEMO_NOTICE_VERSION,sha256:META_DEMO_NOTICE_SHA256,text:META_DEMO_NOTICE},readiness:metaDemoTransportReadiness(environment),identityCertified:false,humanAcceptance:'NOT_VERIFIED',callbackHealth:'NOT_CONFIRMED',numberRegistrationPerformed:false,customerSignupVerified:false};
  });
   if(context.operationId)return snapshot;
   const current=snapshot.state==='PREPARED'?await workerChannels.read(session,context):null;
   return {...snapshot,participants:snapshot.participants.map(row=>{const channel=current?.records.find(record=>record.workerId===row.workerId);return {...row,channelState:channel?.state||'NOT_LINKED',challenge:channel?.challenge||null,binding:channel?.binding||null};})};
  },
 };
}
