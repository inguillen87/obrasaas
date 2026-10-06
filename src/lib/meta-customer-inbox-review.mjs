import {randomUUID} from 'node:crypto';
import {WorkspaceError,operationId,digest} from './workspace-policy.mjs';
import {decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {lockMetaCustomerInboxChannel,metaCustomerContentDigest} from './meta-customer-callback.mjs';
import {classifyObraIntent} from './whatsapp/obra-intent-policy.js';
import {META_APP_PROJECTION_PROVIDER,decodeCustomerAppProjection} from './meta-customer-app-projection.mjs';
const revision=`to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US')`;
const text=value=>typeof value==='string'?value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,' ').slice(0,4096):'';
const phoneForView=value=>typeof value==='string'&&/^[1-9]\d{7,14}$/.test(value)?value:null;
const eventId=value=>typeof value==='string'&&/^customer_webhook_[a-f0-9]{64}$/.test(value);
const leaseMs=60000;
function decode(row,member,project,channel,environment){
 if(row.payload?.organizationId!==member.organizationId||row.payload?.channelId!==channel.id)throw new WorkspaceError('META_CUSTOMER_INBOX_SCOPE_REJECTED',403);
 let payload;try{payload=JSON.parse(decryptCustomerSecret(row.payload.encryptedPayload,{organizationId:member.organizationId,projectId:project.id,purpose:'webhook',resourceId:row.id},environment));}catch{throw new WorkspaceError('META_CUSTOMER_INBOX_PAYLOAD_UNVERIFIED',409);}
 if(payload.wabaId!==channel.whatsappBusinessId||payload.phoneNumberId!==null&&payload.phoneNumberId!==channel.phoneNumberId||metaCustomerContentDigest(payload)!==row.payload.payloadDigest)throw new WorkspaceError('META_CUSTOMER_INBOX_PAYLOAD_UNVERIFIED',409);
 return payload;
}
function normalizedMessage(payload){
 const value=payload.value||{},kind=typeof value.type==='string'?value.type:'unknown';
 return {provider:'meta',kind,text:kind==='text'?text(value.text?.body):text(value[kind]?.caption),location:kind==='location'?value.location:null,
  interactive:kind==='interactive'?{type:value.interactive?.type==='nfm_reply'?'flow':value.interactive?.type,response:value.interactive?.nfm_reply}:null};
}
export function metaCustomerInboxIntent(payload){
 return payload.type==='message'?classifyObraIntent(normalizedMessage(payload)):payload.type==='message_status'?'MESSAGE_STATUS':'ACCOUNT_OR_TEMPLATE_EVENT';
}
async function identity(client,member,project,payload){
 if(payload.type!=='message')return {status:'NOT_APPLICABLE',workerId:null};
 const from=payload.value?.from;if(typeof from!=='string'||!/^[1-9]\d{7,14}$/.test(from))return {status:'INVALID_PHONE',workerId:null};
 // Exact international roster address only. Names, quoted messages, Flow
 // responses and a declared phone never grant a WhatsApp channel identity.
 const rows=(await client.query(`SELECT id,name,active,metadata FROM public."Worker" WHERE "projectId"=$1 AND phone=$2 ORDER BY id LIMIT 3 FOR SHARE`,[project.id,'+'+from])).rows;
 if(rows.length!==1)return {status:rows.length?'AMBIGUOUS':'UNKNOWN',workerId:null};
 const worker=rows[0],participant=worker.metadata?.participant;
 if(!worker.active||participant?.version!==1||participant.status!=='ACTIVE'||!participant.clerkUserId)return {status:'PARTICIPATION_REVOKED',workerId:worker.id};
 const intent=metaCustomerInboxIntent(payload),attendance=['ATTENDANCE_START','ATTENDANCE_LOCATION'].includes(intent),allowed=intent==='HELP'?participant.permissions?.report===true||participant.permissions?.attendance===true:participant.permissions?.[attendance?'attendance':'report']===true;
 if(!allowed)return {status:'PERMISSION_REVOKED',workerId:worker.id};
 // This is an observed identity snapshot, never an executable grant. Do not
 // lock a different participant's membership after Project: invitation join
 // owns that membership before Project, which would invert the canonical order.
 const memberships=(await client.query(`SELECT m.id FROM public."PlatformUser" u JOIN public."TenantMembership" m ON m."userId"=u.id JOIN public."ProjectMembership" pm ON pm."tenantMembershipId"=m.id WHERE u."clerkUserId"=$1 AND m."organizationId"=$2 AND m.status='ACTIVE' AND pm."projectId"=$3 AND pm.status='ACTIVE'`,[participant.clerkUserId,member.organizationId,project.id])).rows;
 if(memberships.length!==1)return {status:'MEMBERSHIP_REVOKED',workerId:worker.id};
 if(participant.kyc?.status!=='APPROVED')return {status:'KYC_REVIEW_REQUIRED',workerId:worker.id};
 // This production schema has no canonical encrypted WorkerChannelIdentity.
 // Preserve enterprise fail-closed semantics instead of inventing a binding
 // from roster metadata or approving identity from the incoming message.
 return {status:'CHANNEL_IDENTITY_UNVERIFIED',workerId:worker.id};
}
function publicItem(row,payload){
 const outcome=row.outcome?.version===1?row.outcome:null,value=payload?.value||{},appSource=['history','smb_app_state_sync','smb_message_echoes'].includes(payload?.field);
 return {id:row.id,revision:row.revision,status:row.status,createdAt:row.createdAt,processedAt:row.processedAt,
  processing:row.leaseToken?'LEASED':'NOT_LEASED',canProcess:!appSource&&Boolean(payload)&&row.status==='PENDING'&&!row.activeLease,
  processingCode:typeof row.lastError==='string'&&/^[A-Z0-9_]{1,120}$/.test(row.lastError)?row.lastError:null,
  canReview:!appSource&&Boolean(payload&&outcome)&&row.status==='PROCESSED'&&outcome.reviewState!=='REVIEWED',reviewState:outcome?.reviewState||'NOT_PROCESSED',intent:outcome?.intent||null,
  identityStatus:outcome?.identity?.status||'NOT_CHECKED',workerId:outcome?.identity?.workerId||null,businessApplied:outcome?.businessApplied===true,replySent:outcome?.replySent===true,replyState:outcome?.replyState||null,businessKind:outcome?.kind||null,receiptId:outcome?.receiptId||null,
  kind:payload?.type==='message'?value.type:payload?.type||'UNVERIFIED',from:payload?.type==='message'&&typeof value.from==='string'?value.from:null,
  body:payload?.type==='message'?normalizedMessage(payload).text:'',hasLocation:payload?.type==='message'&&value.type==='location',
  providerStatus:payload?.type==='message_status'?value.status:null,field:payload?.field||null,
  observation:payload&&payload.type!=='message'&&payload.type!=='message_status'?text(value.event||value.decision||value.message_template_status).slice(0,80):null,
  reviewDecision:outcome?.review?.decision||null,payloadVerified:Boolean(payload)};
}
export async function readMetaCustomerInbox(client,member,project,connection,environment,{after=null}={}){
 const cursorId=value=>eventId(value)||/^meta_app_source_[a-f0-9]{64}$/.test(value||'');
 if(after!==null&&!cursorId(after))throw new WorkspaceError('META_CUSTOMER_INBOX_INPUT_INVALID');
 if(!connection||connection.metadata?.credentialFormat!=='tenant-aad-v2'||connection.metadata?.credentialOrganizationId!==member.organizationId)return {items:[],truncated:false,nextCursor:null,canSend:false,businessApplied:false};
 if(after){const cursor=(await client.query(`SELECT id FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider=ANY($4::text[]) AND payload->>'channelId'=$3`,[after,project.id,connection.id,['meta-customer-v1',META_APP_PROJECTION_PROVIDER]])).rows;if(cursor.length!==1)throw new WorkspaceError('META_CUSTOMER_INBOX_CURSOR_UNAVAILABLE',409);}
 const rows=(await client.query(`SELECT id,provider,status::text AS status,payload,outcome,"createdAt" AS "createdAt","processedAt" AS "processedAt","leaseToken","lastError",("leaseExpiresAt">clock_timestamp()) AS "activeLease",${revision} AS revision FROM public."WebhookEvent" WHERE "projectId"=$1 AND provider=ANY($4::text[]) AND payload->>'channelId'=$2 AND ($3::text IS NULL OR ("createdAt",id)<(SELECT "createdAt",id FROM public."WebhookEvent" WHERE id=$3 AND "projectId"=$1 AND provider=ANY($4::text[]) AND payload->>'channelId'=$2)) ORDER BY "createdAt" DESC,id DESC LIMIT 21`,[project.id,connection.id,after,['meta-customer-v1',META_APP_PROJECTION_PROVIDER]])).rows;
 const outbound=(await client.query(`SELECT id,payload,outcome FROM public."WebhookEvent" WHERE "projectId"=$1 AND provider='meta-customer-outbound-v1' AND payload->>'channelId'=$2 AND payload->>'eventId'=ANY($3::text[])`,[project.id,connection.id,rows.slice(0,20).map(row=>row.id)])).rows;
 const replies=new Map();for(const row of outbound){try{const request=JSON.parse(decryptCustomerSecret(row.payload.encryptedPayload,{organizationId:member.organizationId,projectId:project.id,purpose:'outbound',resourceId:row.id},environment));if(digest(request)!==row.payload.requestDigest||request.channelId!==connection.id||request.organizationId!==member.organizationId||request.eventId!==row.payload.eventId)continue;replies.set(request.eventId,row.outcome);}catch{}}
 const items=[];
 for(const row of rows.slice(0,20)){
  if(row.provider===META_APP_PROJECTION_PROVIDER){
   let data=null;try{data=await decodeCustomerAppProjection(client,row,member,project,connection,environment);}catch{}
   const record=data?.record,m=record?.data||{},contact=record?.kind==='contact',from=contact?m.contact?.phone_number:m.sourceThreadId||m.to||m.from;
   items.push({...publicItem(row,null),kind:contact?'APP_CONTACT':data?.field==='history'?'APP_HISTORY':'APP_ECHO',source:'WHATSAPP_BUSINESS_APP',sourceEventId:data?.sourceEventId||null,sourceTimestamp:record?.timestamp||null,from:phoneForView(from),body:contact?text(m.contact?.full_name||m.contact?.first_name):text(m.text?.body||m[m.type]?.caption),observation:contact?(m.action==='remove'?'Eliminado en WhatsApp Business; los contactos manuales y las ventas se conservan.':'Contacto recibido de WhatsApp Business; fuente privada conservada.'):data?.field==='history'?'Mensaje histórico importado. No ejecuta acciones ni abre una ventana de respuesta.':'Mensaje enviado desde WhatsApp Business. Se muestra como fuente; no concede permisos.',payloadVerified:Boolean(data),canProcess:false,canReview:false,identityStatus:'NOT_APPLICABLE',businessApplied:false,replySent:false});
   continue;
  }
  let payload=null;try{payload=decode(row,member,project,connection,environment);}catch{}
  const item=publicItem(row,payload),reply=replies.get(row.id);items.push(reply?{...item,replyState:reply.state,replySent:['SENT','STATUS_OBSERVED'].includes(reply.state)&&!['failed','deleted'].includes(reply.providerStatus),providerReplyStatus:reply.providerStatus||null}:item);
 }
 return {items,truncated:rows.length>20,nextCursor:rows.length>20?rows[19].id:null,canSend:false,businessApplied:items.some(item=>item.businessApplied),channelIdentityVerified:items.some(item=>['VERIFIED','CHANNEL_VERIFIED'].includes(item.identityStatus))};
}
export async function readMetaCustomerInboxReceipt(client,member,project,connection,environment,request){
 if(!request||!operationId(request.operationId)||!eventId(request.eventId)||!['process_inbox','review_inbox'].includes(request.action))throw new WorkspaceError('META_CUSTOMER_INBOX_INPUT_INVALID');
 if(!connection||connection.metadata?.credentialFormat!=='tenant-aad-v2'||connection.metadata?.credentialOrganizationId!==member.organizationId)throw new WorkspaceError('META_CUSTOMER_INBOX_UNAVAILABLE',404);
 const row=(await client.query(`SELECT id,status::text AS status,payload,outcome FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-v1' AND payload->>'channelId'=$3`,[request.eventId,project.id,connection.id])).rows[0];if(!row)throw new WorkspaceError('META_CUSTOMER_INBOX_UNAVAILABLE',404);
 decode(row,member,project,connection,environment);
 const context={operationId:request.operationId,eventId:row.id,action:request.action,definitive:false};
 if(request.action==='review_inbox'){
  const key='meta_inbox_request_'+digest([member.actorId,project.id,request.operationId]);
  const found=(await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND "entityId"=$4 AND action='integration.whatsapp.inbox.reviewed'`,[key,member.organizationId,member.actorId,row.id])).rows[0];
  if(found&&found.metadata?.projectId===project.id&&found.metadata?.eventId===row.id&&['OBSERVED','REFER_TO_PARTICIPANTS','REFER_TO_FIELD'].includes(found.metadata.decision))return {...context,state:'RECORDED',actorOperationVerified:true,receiptId:found.id,decision:found.metadata.decision};
  return {...context,state:'NOT_OBSERVED',actorOperationVerified:false};
 }
 // Processing is reserved by event, including automatic workers. A completed
 // event does not prove that this browser's operation UUID caused the effect.
 return {...context,state:row.status==='PROCESSED'&&row.outcome?.version===1?'EVENT_PROCESSED':'NOT_OBSERVED',actorOperationVerified:false,eventStatus:row.status,businessApplied:row.outcome?.businessApplied===true,businessReceiptId:typeof row.outcome?.receiptId==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(row.outcome.receiptId)?row.outcome.receiptId:null};
}
export function createMetaCustomerInboxReview({workspace,environment=process.env,now=()=>Date.now(),afterClaim=async()=>{}}){
 const within=(session,body,writable,run)=>workspace.integrationProject(session,body,writable,run);
 async function channel(client,project){const rows=(await client.query(`SELECT "whatsappBusinessId","phoneNumberId" FROM public."WhatsAppConnection" WHERE "projectId"=$1`,[project.id])).rows;if(rows.length!==1)throw new WorkspaceError('META_CUSTOMER_INBOX_SCOPE_REJECTED',403);return lockMetaCustomerInboxChannel(client,{...rows[0],wabaId:rows[0].whatsappBusinessId,projectId:project.id});}
 async function event(client,project,id){const row=(await client.query(`SELECT id,status::text AS status,payload,outcome,"leaseToken","leaseExpiresAt",${revision} AS revision FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-v1' FOR UPDATE`,[id,project.id])).rows[0];if(!row)throw new WorkspaceError('META_CUSTOMER_INBOX_UNAVAILABLE',404);return row;}
 async function audit(client,member,project,key,action,metadata){await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,$4,'WebhookEvent',$5,$6::jsonb) ON CONFLICT(id) DO NOTHING`,[key,member.organizationId,member.actorId,action,metadata.eventId,JSON.stringify({...metadata,projectId:project.id,businessApplied:false,replySent:false})]);}
 return {async command(session,body){
  const review=body?.action==='review_inbox',keys=['action','operationId','projectId','scope','eventId',...(review?['expectedRevision','decision']:[])];
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join('|')!==keys.sort().join('|')||!operationId(body.operationId)||!eventId(body.eventId)||!['process_inbox','review_inbox'].includes(body.action)||review&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(body.expectedRevision||'')||!['OBSERVED','REFER_TO_PARTICIPANTS','REFER_TO_FIELD'].includes(body.decision)))throw new WorkspaceError('META_CUSTOMER_INBOX_INPUT_INVALID');
  const operationDigest=digest(body),claim=await within(session,body,true,async(client,member,_scope,project)=>{
   const currentChannel=await channel(client,project),row=await event(client,project,body.eventId),payload=decode(row,member,project,currentChannel,environment);
   if(['history','smb_app_state_sync','smb_message_echoes'].includes(payload.field))throw new WorkspaceError('META_CUSTOMER_INBOX_SOURCE_READ_ONLY',409);
   const key='meta_inbox_request_'+digest([member.actorId,project.id,body.operationId]);const prior=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2`,[key,member.organizationId])).rows[0];if(prior&&prior.metadata.operationDigest!==operationDigest)throw new WorkspaceError('META_CUSTOMER_INBOX_OPERATION_CONFLICT',409);
   if(review){
    if(prior)return {done:true};if(row.status!=='PROCESSED'||row.revision!==body.expectedRevision||row.outcome?.version!==1)throw new WorkspaceError('META_CUSTOMER_INBOX_REVISION_CHANGED',409);
    if(row.outcome.reviewState==='REVIEWED')throw new WorkspaceError('META_CUSTOMER_INBOX_ALREADY_REVIEWED',409);
    const payload=decode(row,member,project,currentChannel,environment),actor=await identity(client,member,project,payload);
    await client.query(`UPDATE public."WebhookEvent" SET outcome=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[row.id,project.id,JSON.stringify({...row.outcome,reviewIdentity:actor,reviewState:'REVIEWED',review:{decision:body.decision,actorId:member.actorId,recordedAt:new Date(now()).toISOString()}})]);
    await audit(client,member,project,key,'integration.whatsapp.inbox.reviewed',{eventId:row.id,operationDigest,decision:body.decision,identityStatus:actor.status});return {done:true};
   }
   if(row.status==='PROCESSED'){if(!prior)await audit(client,member,project,key,'integration.whatsapp.inbox.process_requested',{eventId:row.id,operationDigest,replayed:true});return {done:true};}
   if(row.status!=='PENDING')throw new WorkspaceError('META_CUSTOMER_INBOX_PROCESSING_UNAVAILABLE',409);
   if(row.leaseToken&&new Date(row.leaseExpiresAt).getTime()>now())throw new WorkspaceError('META_CUSTOMER_INBOX_BUSY',409);
   const leaseToken=randomUUID();await client.query(`UPDATE public."WebhookEvent" SET "leaseToken"=$3,"leaseExpiresAt"=$4,attempts=attempts+1,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[row.id,project.id,leaseToken,new Date(now()+leaseMs)]);
   if(!prior)await audit(client,member,project,key,'integration.whatsapp.inbox.process_requested',{eventId:row.id,operationDigest,payloadDigest:row.payload.payloadDigest});return {leaseToken};
  });
  if(claim.done)return {processed:true,replayed:true,businessApplied:false,replySent:false};
  await afterClaim();
  return within(session,body,true,async(client,member,_scope,project)=>{
   const currentChannel=await channel(client,project),row=await event(client,project,body.eventId);
   if(row.status!=='PENDING'||row.leaseToken!==claim.leaseToken||new Date(row.leaseExpiresAt).getTime()<=now())throw new WorkspaceError('META_CUSTOMER_INBOX_LEASE_CHANGED',409);
   const payload=decode(row,member,project,currentChannel,environment),actor=await identity(client,member,project,payload),intent=metaCustomerInboxIntent(payload);
   const outcome={version:1,classifierVersion:'enterprise-1677ff7-obra-intent-v1',intent,identity:actor,reviewState:payload.type==='message'?'REVIEW_REQUIRED':'OBSERVED',businessApplied:false,replySent:false,processedBy:member.actorId,observedAt:new Date(now()).toISOString()};
   const written=await client.query(`UPDATE public."WebhookEvent" SET status='PROCESSED',outcome=$4::jsonb,"processedAt"=clock_timestamp(),"leaseToken"=NULL,"leaseExpiresAt"=NULL,"lastError"=NULL,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2 AND "leaseToken"=$3 AND status='PENDING'`,[row.id,project.id,claim.leaseToken,JSON.stringify(outcome)]);if(written.rowCount!==1)throw new WorkspaceError('META_CUSTOMER_INBOX_LEASE_CHANGED',409);
   await audit(client,member,project,'meta_inbox_classified_'+digest([row.id,row.payload.payloadDigest]),'integration.whatsapp.inbox.classified',{eventId:row.id,payloadDigest:row.payload.payloadDigest,intent,identityStatus:actor.status});return {processed:true,replayed:false,businessApplied:false,replySent:false};
  });
 }};
}
