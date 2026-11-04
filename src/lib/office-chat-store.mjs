import {randomBytes} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {WorkspaceError,digest,requireWorkspaceIdentity,scopeStamp,checkScope,workspaceId} from './workspace-policy.mjs';
import {companyConnectionForProject} from './company-channel-connection.mjs';
import {customerJobTransaction,customerChannelActive,assertCustomerReplyWindow,customerOutboundId,createMetaCustomerOutbound} from './meta-customer-outbound.mjs';
import {decodeSignedCustomerEvent} from './meta-customer-processing.mjs';
import {ownCompanyConnectionPolicy,lockOwnCompanyIssuerPrincipal,lockOwnCompanyIssuer} from './meta-own-company-policy.mjs';
import {isMetaGreeting} from './meta-greeting.mjs';
import {participantAccountBound} from './participant-admission.mjs';
import {OFFICE_CHAT_TTL_MS,OFFICE_CHAT_ACTION,OFFICE_CHAT_RECEIPT_ACTION,OFFICE_CHAT_DISPATCH_ACTION,officeChatFailure,officeChatCommand,officeChatSlotId,officeChatReceiptId,officeChatDispatchId,officeChatCodeHash,officeChatCode,officeChatReply,officeChatChoice} from './office-chat-policy.mjs';

// Account navigation is a separate principal. No Worker, KYC, session creation,
// attendance, permission grant or employee approval is part of this service.
// A restricted office-review origin survives later role changes, just as in
// canonical workspace authority. Refresh it for web, inbound and outbound fences.
export const OFFICE_CHAT_SQL={
 member:`SELECT u.id AS "actorId",u."clerkUserId",EXISTS(SELECT 1 FROM public."AuditLog" a WHERE a."organizationId"=o.id AND a."actorId"=u.id AND a.action='office.review.accepted' AND a.metadata->>'membershipId'=m.id) AS "officeReviewOnly",m.id AS "membershipId",m."organizationId",m."tenantRole"::text AS role,m."clerkRole",o."clerkOrganizationId",to_char(m."updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS "memberRevision",to_char(u."updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS "actorRevision" FROM public."PlatformUser" u JOIN public."TenantMembership" m ON m."userId"=u.id JOIN public."Organization" o ON o.id=m."organizationId" WHERE u.id=$1 AND m.id=$2 AND m."organizationId"=$3 AND m.status='ACTIVE' AND COALESCE(o.metadata->'internal','false'::jsonb)<>'true'::jsonb`,
 webMember:`SELECT u.id AS "actorId",m.id AS "membershipId",m."organizationId" FROM public."PlatformUser" u JOIN public."TenantMembership" m ON m."userId"=u.id JOIN public."Organization" o ON o.id=m."organizationId" WHERE u."clerkUserId"=$1 AND o."clerkOrganizationId"=$2 AND m."clerkRole"=$3 AND m.status='ACTIVE'`,
 principalLocks:`SELECT u.id,m.id AS "membershipId" FROM public."PlatformUser" u JOIN public."TenantMembership" m ON m."userId"=u.id JOIN public."Organization" o ON o.id=m."organizationId" WHERE u.id=ANY($1::text[]) AND m."organizationId"=$2 ORDER BY u.id,m.id FOR SHARE OF u,m,o`,
 trail:`SELECT id,metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND "entityType"='TenantMembership' AND "entityId"=$2 AND action IN ('participant.operation.recorded','office.review.accepted') ORDER BY id LIMIT 1001`,
 project:`SELECT id,"organizationId",status::text AS status FROM public."Project" WHERE id=ANY($1::text[]) AND "organizationId"=$2 AND status='ACTIVE' ORDER BY id FOR SHARE`,
 projectAccess:`SELECT id,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."ProjectMembership" WHERE "projectId"=$1 AND "tenantMembershipId"=$2 AND status='ACTIVE' FOR SHARE`,
 row:`SELECT id,"organizationId","actorId",action,"entityType","entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND action=$3`,
 discover:`SELECT id,"organizationId","actorId",action,"entityType","entityId",metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND action='office.chat.continuity' AND metadata->>'connectionId'=$2 AND metadata->>'sender'=$3 AND ($4::text IS NULL OR metadata->'pending'->>'hash'=$4 OR metadata->'binding'->>'sourceEventId'=$5) ORDER BY id LIMIT 3`,
 insert:`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,$4,'Project',$5,$6::jsonb)`,
 update:`UPDATE public."AuditLog" SET metadata=$4::jsonb,"entityId"=$5 WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND action='office.chat.continuity'`,
 event:`SELECT * FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-v1'`,
 channel:`SELECT c.*,p."organizationId" FROM public."WhatsAppConnection" c JOIN public."Project" p ON p.id=c."projectId" WHERE c.id=$1 AND c."projectId"=$2`,
 outbound:`SELECT id,payload,outcome FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1'`
};
const fail=officeChatFailure,clock=async client=>{const at=(await client.query('SELECT clock_timestamp() AS now')).rows[0]?.now;if(!(at instanceof Date)||!Number.isFinite(at.getTime()))fail();return at;};
const time=value=>value instanceof Date?value.getTime():typeof value==='string'?Date.parse(value):NaN;
const live=(value,now)=>Number.isFinite(time(value))&&time(value)>now.getTime();
const memberSnapshot=m=>({actorId:m.actorId,membershipId:m.membershipId,organizationId:m.organizationId,clerkUserId:m.clerkUserId,clerkOrganizationId:m.clerkOrganizationId,clerkRole:m.clerkRole,role:m.role,memberRevision:m.memberRevision,actorRevision:m.actorRevision,trail:m.trail,projectAccess:m.projectAccess});
const connectionDigest=c=>digest([c.id,c.projectId,c.organizationId,c.phoneNumberId,c.whatsappBusinessId,c.enabled,c.connectionStatus,c.encryptedAccessToken,c.metadata,c.company]);
const assertMember=m=>{if(!m||m.officeReviewOnly!==false||!['ADMIN','DIRECTOR'].includes(m.role)||![m.actorId,m.membershipId,m.organizationId].every(workspaceId)||!/^user_[A-Za-z0-9]+$/.test(m.clerkUserId||'')||!/^org_[A-Za-z0-9]+$/.test(m.clerkOrganizationId||'')||typeof m.memberRevision!=='string'||typeof m.actorRevision!=='string')fail('OFFICE_CHAT_ACCESS_REVOKED',403);return m;};
async function exactRow(client,id,org,action,{lock=false}={}){const rows=(await client.query(OFFICE_CHAT_SQL.row+(lock?' FOR UPDATE':''),[id,org,action])).rows;if(rows.length>1)fail();return rows[0]||null;}
function slotValue(row){const s=row?.metadata;if(!row||row.action!==OFFICE_CHAT_ACTION||row.entityType!=='Project'||s?.version!==1||row.organizationId!==s.organizationId||row.actorId!==s.actorId||row.entityId!==s.projectId||row.id!==officeChatSlotId(s.organizationId,s.membershipId,s.connectionId)||!Number.isSafeInteger(s.generation)||s.generation<1||!['OFFICE','FIELD'].includes(s.mode))fail();return s;}
async function saveSlot(client,row,s){if(row){const changed=await client.query(OFFICE_CHAT_SQL.update,[row.id,s.organizationId,s.actorId,JSON.stringify(s),s.projectId]);if(changed.rowCount!==1)fail();}else await client.query(OFFICE_CHAT_SQL.insert,[officeChatSlotId(s.organizationId,s.membershipId,s.connectionId),s.organizationId,s.actorId,OFFICE_CHAT_ACTION,s.projectId,JSON.stringify(s)]);}
async function insert(client,id,m,projectId,action,metadata){await client.query(OFFICE_CHAT_SQL.insert,[id,m.organizationId,m.actorId,action,projectId,JSON.stringify(metadata)]);}
async function authority(client,ids,projectId,{environment,session=null}={}){
 const discovered=await companyConnectionForProject(client,ids.organizationId,projectId,false);
 const own=discovered?ownCompanyConnectionPolicy(discovered,environment):null;
 const actors=[...new Set([ids.actorId,own?.actorId].filter(Boolean))].sort();await client.query(OFFICE_CHAT_SQL.principalLocks,[actors,ids.organizationId]);
 if(discovered)await lockOwnCompanyIssuerPrincipal(client,discovered,{environment});
 const members=(await client.query(OFFICE_CHAT_SQL.member,[ids.actorId,ids.membershipId,ids.organizationId])).rows;
 if(members.length!==1)fail('OFFICE_CHAT_ACCESS_REVOKED',403);const m=assertMember(members[0]);
 if(session&&(m.clerkUserId!==session.userId||m.clerkOrganizationId!==session.organizationId||m.clerkRole!==session.organizationRole))fail('OFFICE_CHAT_ACCESS_REVOKED',403);
 const trail=(await client.query(OFFICE_CHAT_SQL.trail,[m.organizationId,m.membershipId])).rows;if(trail.length>1000)fail('OFFICE_CHAT_ACCESS_REVOKED',403);m.trail=digest(trail);
 const projects=(await client.query(OFFICE_CHAT_SQL.project,[[...new Set([projectId,discovered?.projectId].filter(Boolean))].sort(),m.organizationId])).rows;
 if(!projects.some(p=>p.id===projectId))fail('OFFICE_CHAT_ACCESS_REVOKED',403);
 m.projectAccess=null;
 if(await participantAccountBound(client,m)){const access=(await client.query(OFFICE_CHAT_SQL.projectAccess,[projectId,m.membershipId])).rows;if(access.length!==1)fail('OFFICE_CHAT_ACCESS_REVOKED',403);m.projectAccess=access[0];}
 const c=await companyConnectionForProject(client,m.organizationId,projectId,true),now=await clock(client);
 if(!c||c.company.mode!=='COMPANY'||c.metadata?.developmentPilot||!customerChannelActive(c,now.getTime(),{environment}))return {member:m,connection:null,now};
 await lockOwnCompanyIssuer(client,c,{environment,now:now.getTime()});
 return {member:m,connection:c,now,principal:memberSnapshot(m),channelDigest:connectionDigest(c),project:{id:c.projectId,organizationId:m.organizationId}};
}
function matches(s,a){if(!a.connection||s.projectId!==a.connection.company.targetProjectId||s.connectionId!==a.connection.id||s.organizationId!==a.member.organizationId||s.authorityDigest!==digest([a.principal,a.channelDigest]))fail('OFFICE_CHAT_ACCESS_REVOKED',403);}
function publicState(s,now){return {state:s?.binding?'BOUND':s?.pending&&Date.parse(s.pending.expiresAt)>now.getTime()?'PREPARED':'NOT_BOUND',expiresAt:s?.pending?.expiresAt||null,codeAvailable:false,navigationOnly:true,identityCertified:false,permissionsGranted:false};}
export function createOfficeChatStore({connect,environment=process.env}){
 const within=run=>customerJobTransaction(connect,run);
 async function web(client,session,input){requireWorkspaceIdentity(session);if(!workspaceId(input?.projectId)||!/^[a-f0-9]{64}$/.test(input.scope||''))fail('OFFICE_CHAT_INPUT_INVALID',400);const found=(await client.query(OFFICE_CHAT_SQL.webMember,[session.userId,session.organizationId,session.organizationRole])).rows;if(found.length!==1)fail('OFFICE_CHAT_ACCESS_REVOKED',403);const a=await authority(client,found[0],input.projectId,{session,environment});checkScope(scopeStamp(session,a.member),input.scope);return a;}
 return {
  read(session,input){return within(async client=>{const a=await web(client,session,input);if(!a.connection)return {state:'CONNECT_WHATSAPP',navigationOnly:true};const row=await exactRow(client,officeChatSlotId(a.member.organizationId,a.member.membershipId,a.connection.id),a.member.organizationId,OFFICE_CHAT_ACTION);let s=row?slotValue(row):null;if(s){try{matches(s,a);}catch{s=null;}}return {...publicState(s,a.now),businessPhone:a.connection.displayPhoneNumber||null};});},
  command(session,body){const input=officeChatCommand(body);return within(async client=>{
   const a=await web(client,session,input);if(!a.connection)return {saved:false,state:'CONNECT_WHATSAPP',navigationOnly:true};
   const m=a.member,id=officeChatSlotId(m.organizationId,m.membershipId,a.connection.id),receiptId=officeChatReceiptId(m,input.operationId),prior=await exactRow(client,receiptId,m.organizationId,OFFICE_CHAT_RECEIPT_ACTION),row=await exactRow(client,id,m.organizationId,OFFICE_CHAT_ACTION,{lock:true});
   if(prior){if(prior.actorId!==m.actorId||prior.entityId!==input.projectId||prior.metadata?.requestDigest!==digest(input))fail('OFFICE_CHAT_OPERATION_CONFLICT');return {...prior.metadata.outcome,replayed:true,codeAvailable:false};}
   const old=row?slotValue(row):null,generation=(old?.generation||0)+1;let code=null;
   const s={version:1,organizationId:m.organizationId,actorId:m.actorId,membershipId:m.membershipId,projectId:input.projectId,connectionId:a.connection.id,authorityDigest:digest([a.principal,a.channelDigest]),principal:a.principal,generation,sender:input.action==='PREPARE'?input.sender:old?.sender||null,pending:null,binding:null,mode:'OFFICE',lastPromptEventId:null};
   if(input.action==='PREPARE'){code=randomBytes(32).toString('base64url');s.pending={hash:officeChatCodeHash(code),expiresAt:new Date(a.now.getTime()+OFFICE_CHAT_TTL_MS).toISOString(),operationId:input.operationId};}
   await saveSlot(client,row,s);
   const outcome={saved:true,state:input.action==='PREPARE'?'PREPARED':'REVOKED',receiptId,expiresAt:s.pending?.expiresAt||null,navigationOnly:true,identityCertified:false,permissionsGranted:false};
   await insert(client,receiptId,m,input.projectId,OFFICE_CHAT_RECEIPT_ACTION,{version:1,requestDigest:digest(input),outcome});
   return {...outcome,replayed:false,codeAvailable:Boolean(code),...(code?{message:'CUENTA '+code}:{}),businessPhone:a.connection.displayPhoneNumber||null};
  });}
 };
}
async function source(client,context,environment){
 const rows=(await client.query(OFFICE_CHAT_SQL.event,[context.eventId,context.projectId])).rows,event=rows[0];
 if(rows.length!==1||event.status!=='PENDING'||event.leaseToken!==context.leaseToken||event.payload?.channelId!==context.channelId||event.payload?.payloadDigest!==context.payloadDigest)fail();
 const channels=(await client.query(OFFICE_CHAT_SQL.channel,[context.channelId,context.projectId])).rows;if(channels.length!==1)fail();const channel=channels[0],payload=decodeSignedCustomerEvent(event,channel,environment);
 if(payload.type!=='message')return null;return {event,channel,payload,message:payload.value,sender:'+'+payload.value.from};
}
async function currentSlot(client,context,environment,{reply=null}={}){
 const r=await source(client,context,environment);if(!r)return null;
 const text=r.message.type==='text'?r.message.text?.body?.trim():null,code=officeChatCode(text),choice=officeChatChoice(r.message);
 const rows=(await client.query(OFFICE_CHAT_SQL.discover,[r.channel.organizationId,r.channel.id,r.sender,code?officeChatCodeHash(code):null,context.eventId])).rows;
 if(!rows.length){if(code||text?.startsWith('CUENTA '))fail('OFFICE_CHAT_CODE_REJECTED');return null;}
 if(rows.length!==1)fail('OFFICE_CHAT_AMBIGUOUS',403);
 const first=slotValue(rows[0]),explicit=text==='CUENTA'||text==='MI CUENTA'||text==='CAMPO'||Boolean(code)||Boolean(choice);
 if(!reply&&!explicit&&!(first.binding&&first.mode==='OFFICE'&&isMetaGreeting(text)))return null;
 const a=await authority(client,{actorId:first.actorId,membershipId:first.membershipId,organizationId:first.organizationId},first.projectId,{environment});
 const eventRows=(await client.query(OFFICE_CHAT_SQL.event+' FOR UPDATE',[context.eventId,context.projectId])).rows;
 const now=await clock(client),event=eventRows[0];if(eventRows.length!==1||event.status!=='PENDING'||event.leaseToken!==context.leaseToken||!live(event.leaseExpiresAt,now)||event.payload?.payloadDigest!==context.payloadDigest)fail();
 if(!a.connection)fail('OFFICE_CHAT_ACCESS_REVOKED',403);
 // Discovery never supplies authority. Verify the current sealed source again
 // after acquiring its row lock, rather than carrying its earlier read forward.
 const lockedPayload=decodeSignedCustomerEvent(event,a.connection,environment);assertCustomerReplyWindow(lockedPayload,now.getTime());
 const row=await exactRow(client,rows[0].id,first.organizationId,OFFICE_CHAT_ACTION,{lock:true}),s=slotValue(row);matches(s,a);
 if(s.sender!==r.sender||a.connection.projectId!==context.projectId||a.connection.id!==context.channelId||a.connection.phoneNumberId!==r.payload.phoneNumberId||a.connection.whatsappBusinessId!==r.payload.wabaId)fail();
 return {...r,...a,payload:lockedPayload,event,row,s,now,text,code,choice};
}
function requireBinding(r){if(!r.s.binding||r.s.binding.generation!==r.s.generation||r.s.binding.authorityDigest!==r.s.authorityDigest)fail('OFFICE_CHAT_ACCESS_REVOKED',403);}
async function dispatched(client,r){
 const row=await exactRow(client,officeChatDispatchId(r.event.id),r.member.organizationId,OFFICE_CHAT_DISPATCH_ACTION);
 if(!row)return null;const d=row.metadata;
 if(row.actorId!==r.member.actorId||row.entityId!==r.s.projectId||d?.version!==1||d.slotId!==r.row.id||d.generation!==r.s.generation||d.payloadDigest!==r.event.payload.payloadDigest||d.authorityDigest!==r.s.authorityDigest||![null,'WORKS','TEAM','SETTINGS','ACCOUNT','FIELD'].includes(d.selection))fail();
 // JSONB object-key order is not authority. Validate every reply key/value,
 // then return the factory order so outbound request digests remain stable.
 const reply=officeChatReply(r.event.id,d.selection);if(!isDeepStrictEqual(d.reply,reply))fail();
 requireBinding(r);return {...d,reply};
}
export function createOfficeChatBridge({connect,provider,environment=process.env}){
 const within=run=>customerJobTransaction(connect,run);
 async function replyIdentity(client,context,reply){const r=await currentSlot(client,context,environment,{reply});if(!r)fail();const d=await dispatched(client,r);if(!d||digest(d.reply)!==digest(reply))fail();return {kind:'CHANNEL_VERIFIED',project:r.project,connection:r.connection,event:r.event,member:r.member,proof:r.payload};}
 return {
  execute(context){return within(async client=>{
   const r=await currentSlot(client,context,environment);if(!r)return null;const previous=await dispatched(client,r);if(previous)return {kind:'OFFICE_CHAT',reply:previous.reply,businessApplied:false,identityStatus:'OFFICE_NAVIGATION_ONLY',receiptId:officeChatDispatchId(r.event.id)};
   const challengeExpiresAt=r.s.pending?.expiresAt;
   if(r.code){if(!r.s.pending||r.s.pending.hash!==officeChatCodeHash(r.code))fail('OFFICE_CHAT_CODE_REJECTED');if(!live(challengeExpiresAt,r.now))fail('OFFICE_CHAT_CODE_EXPIRED');r.s.pending=null;r.s.binding={generation:r.s.generation,authorityDigest:r.s.authorityDigest,sourceEventId:r.event.id,boundAt:r.now.toISOString()};r.s.mode='OFFICE';}
   else requireBinding(r);
   let selected=null;
   if(r.choice){const last=r.s.lastPromptEventId,prior=last?(await client.query(OFFICE_CHAT_SQL.outbound,[customerOutboundId(last),r.connection.projectId])).rows[0]:null;if(!last||r.choice[1]!==digest(['office-chat-menu-v1',last]).slice(0,20)||!['SENT','STATUS_OBSERVED'].includes(prior?.outcome?.state)||['failed','deleted'].includes(prior?.outcome?.providerStatus)||!prior.outcome.messageId||r.message.context?.id!==prior.outcome.messageId)fail('OFFICE_CHAT_REPLY_CONTEXT_REQUIRED');selected=r.choice[2];}
   const field=r.text==='CAMPO'||selected==='FIELD';if(field)r.s.mode='FIELD';else r.s.mode='OFFICE';
   const selection=field?'FIELD':selected,reply=officeChatReply(r.event.id,selection);
   if(reply.type==='interactive')r.s.lastPromptEventId=r.event.id;
   await saveSlot(client,r.row,r.s);await insert(client,officeChatDispatchId(r.event.id),r.member,r.s.projectId,OFFICE_CHAT_DISPATCH_ACTION,{version:1,slotId:r.row.id,generation:r.s.generation,payloadDigest:r.event.payload.payloadDigest,authorityDigest:r.s.authorityDigest,selection,reply});
   const at=await clock(client);if(!live(r.event.leaseExpiresAt,at))fail();if(r.code&&!live(challengeExpiresAt,at))fail('OFFICE_CHAT_CODE_EXPIRED');assertCustomerReplyWindow(r.payload,at.getTime());if(!customerChannelActive(r.connection,at.getTime(),{environment}))fail('OFFICE_CHAT_ACCESS_REVOKED',403);
   return {kind:'OFFICE_CHAT',reply,businessApplied:false,identityStatus:'OFFICE_NAVIGATION_ONLY',receiptId:officeChatDispatchId(r.event.id)};
  });},
  send(context,reply){return createMetaCustomerOutbound({connect,provider,environment,sourceContext:true,resolveIdentity:client=>replyIdentity(client,context,reply)}).send(context,reply);}
 };
}
