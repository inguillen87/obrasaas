import {WorkspaceError,digest,workspaceId,operationId} from './workspace-policy.mjs';
import {decodeSignedCustomerEvent} from './meta-customer-processing.mjs';
import {decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {customerChannelActive,assertCustomerReplyWindow} from './meta-customer-outbound.mjs';
import {companyChannelSchemaReady,COMPANY_CHANNEL_SCHEMA_CONTRACT} from './company-channel-schema.mjs';
import {lockOwnCompanyIssuer,ownCompanyConnectionPolicy} from './meta-own-company-policy.mjs';
import {OBRASAAS_META_CHANNEL} from './meta-channel-binding.mjs';

const authorities=new WeakMap(),fail=()=>{throw new WorkspaceError('META_CUSTOMER_CHANNEL_ACCEPTANCE_REQUIRED',409);};
const marker=payload=>payload.type==='message'&&payload.value?.type==='text'&&typeof payload.value.text?.body==='string'&&/^IDENTIDAD(?:\s|$)/i.test(payload.value.text.body.trim());
const fingerprint=r=>digest(['kyc-rejection-authority-v1',r.event.id,r.event.projectId,r.event.payload.payloadDigest,r.connection,r.issuer,r.owner,r.payload]);
export function metaKycRejectionAuthorityDigest(value){if(!authorities.has(value)||fingerprint(value)!==authorities.get(value))fail();return authorities.get(value);}

// This capability authorizes one fixed rejection reply to the signed sender.
// It is never participant, capture, FIELD, binding or identity authority.
export async function inspectMetaKycRejectionSource(client,context,{environment=process.env,replyWindow=true}={}){
 if(!/^customer_webhook_[a-f0-9]{64}$/.test(context?.eventId||'')||!workspaceId(context.projectId)||!workspaceId(context.channelId)||!operationId(context.leaseToken)||!/^[a-f0-9]{64}$/.test(context.payloadDigest||''))fail();
 const initial=(await client.query(`SELECT id,"projectId",provider,"eventType",status::text AS status,payload,"leaseToken","leaseExpiresAt" FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2`,[context.eventId,context.projectId])).rows;
 if(initial.length!==1||initial[0].provider!=='meta-customer-v1'||initial[0].eventType!=='message'||initial[0].payload?.channelId!==context.channelId||initial[0].payload?.payloadDigest!==context.payloadDigest)fail();
 const discovered=(await client.query(`SELECT c.*,p."organizationId" FROM public."WhatsAppConnection" c JOIN public."Project" p ON p.id=c."projectId" WHERE c.id=$1 AND c."projectId"=$2 AND p.status='ACTIVE'`,[context.channelId,context.projectId])).rows;
 if(discovered.length!==1)fail();const raw=discovered[0];
 if(raw.metadata?.developmentPilot||raw.whatsappBusinessId===OBRASAAS_META_CHANNEL.wabaId||raw.phoneNumberId===OBRASAAS_META_CHANNEL.phoneNumberId||raw.metadata?.credentialFormat!=='tenant-aad-v2'||raw.metadata.credentialOrganizationId!==raw.organizationId)fail();
 const first=decodeSignedCustomerEvent(initial[0],raw,environment);if(!marker(first))return null;
 const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0]?.now,event=initial[0];
 if(!(now instanceof Date)||!Number.isFinite(now.getTime())||event.status!=='PENDING'||event.leaseToken!==context.leaseToken||!Number.isFinite(Date.parse(event.leaseExpiresAt))||Date.parse(event.leaseExpiresAt)<=now.getTime())throw new WorkspaceError('META_CUSTOMER_INBOX_LEASE_CHANGED',409);
 let replyWindowClosed=false;try{assertCustomerReplyWindow(first,now.getTime());}catch(error){if(replyWindow||error.code!=='META_CUSTOMER_REPLY_WINDOW_CLOSED')throw error;replyWindowClosed=true;}return {initial,raw,first,now,replyWindowClosed};
}
export async function resolveMetaKycRejectionAuthority(client,context,{environment=process.env}={}){
 const source=await inspectMetaKycRejectionSource(client,context,{environment});if(!source)return null;
 const {initial,raw,first}=source;
 const own=ownCompanyConnectionPolicy(raw,environment,source.now.getTime()),actorId=raw.metadata?.customerActivation?.actorId;
 if(!workspaceId(actorId)||own&&own.actorId!==actorId)fail();
 // Lock the current configured administrator before Project/Channel/Event.
 const principals=(await client.query(`SELECT u.id AS "actorId",tm.id AS "membershipId",tm."organizationId",tm."tenantRole"::text AS role,to_char(tm."updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."PlatformUser" u JOIN public."TenantMembership" tm ON tm."userId"=u.id JOIN public."Organization" o ON o.id=tm."organizationId" WHERE u.id=$1 AND tm."organizationId"=$2 AND tm.status='ACTIVE' AND tm."tenantRole"::text='ADMIN' AND tm."clerkRole"='org:admin' AND COALESCE(o.metadata->'internal','false'::jsonb)<>'true'::jsonb FOR SHARE OF u,tm,o`,[actorId,raw.organizationId])).rows;
 if(principals.length!==1)fail();const issuer=principals[0];
 const ownCompanyCapability=await lockOwnCompanyIssuer(client,raw,{environment,now:source.now.getTime()});
 if(!ownCompanyCapability){
  const activation=raw.metadata.customerActivation;
  if(!/^[a-f0-9]{64}$/.test(activation.operationDigest||''))fail();
  const receipts=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND "actorId"=$2 AND "entityType"='WhatsAppConnection' AND "entityId"=$3 AND action='integration.whatsapp.customer.activated' AND metadata->>'operationDigest'=$4 LIMIT 2 FOR SHARE`,[raw.organizationId,actorId,raw.id,activation.operationDigest])).rows,m=receipts[0]?.metadata;
  if(receipts.length!==1||m?.version!==1||m.projectId!==raw.projectId||m.providerGrantVerified!==true||m.phoneRegistered!==true||m.appSubscribed!==true||m.mode==='DEVELOPMENT_PILOT')fail();
 }
 const projects=(await client.query(`SELECT id FROM public."Project" WHERE id=$1 AND "organizationId"=$2 AND status='ACTIVE' FOR SHARE`,[raw.projectId,raw.organizationId])).rows;if(projects.length!==1)fail();
 const channels=(await client.query(`SELECT c.*,p."organizationId" FROM public."WhatsAppConnection" c JOIN public."Project" p ON p.id=c."projectId" WHERE c.id=$1 AND c."projectId"=$2 AND p."organizationId"=$3 AND p.status='ACTIVE' FOR SHARE OF c`,[raw.id,raw.projectId,raw.organizationId])).rows;
 if(channels.length!==1||digest(channels[0])!==digest(raw))fail();const connection=channels[0];
 const proof=JSON.parse(decryptCustomerSecret(initial[0].payload.encryptedProof,{organizationId:raw.organizationId,projectId:raw.projectId,purpose:'webhook-proof',resourceId:initial[0].id},environment));
 let owner=null;
 if(await companyChannelSchemaReady(client)){
  const owners=(await client.query(`SELECT "connectionId","organizationId","anchorProjectId",mode,revision FROM public."WhatsAppCompanyChannel" WHERE "connectionId"=$1 AND "organizationId"=$2 FOR SHARE`,[raw.id,raw.organizationId])).rows;
  if(owners.length>1)fail();owner=owners[0]||null;
 }
 if(proof.companyRouting||raw.metadata?.companyRoutingVersion===1||owner&&['COMPANY','SUSPENDED'].includes(owner.mode)){
  if(owner?.mode!=='COMPANY'||owner.anchorProjectId!==raw.projectId||proof.companyRouting?.mode!=='COMPANY'||proof.companyRouting.contract!==COMPANY_CHANNEL_SCHEMA_CONTRACT||proof.companyRouting.revision!==owner.revision)fail();
 }else if(owner&&!['PROJECT_ONLY','PREPARED'].includes(owner.mode))fail();
 const events=(await client.query(`SELECT id,"projectId",provider,"eventType",status::text AS status,payload,"leaseToken","leaseExpiresAt" FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 FOR UPDATE`,[context.eventId,context.projectId])).rows;
 const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0]?.now,event=events[0];
 if(!(now instanceof Date)||!Number.isFinite(now.getTime())||events.length!==1||event.provider!=='meta-customer-v1'||event.eventType!=='message'||event.status!=='PENDING'||event.leaseToken!==context.leaseToken||!Number.isFinite(Date.parse(event.leaseExpiresAt))||Date.parse(event.leaseExpiresAt)<=now.getTime()||event.payload?.channelId!==context.channelId||event.payload.payloadDigest!==context.payloadDigest)throw new WorkspaceError('META_CUSTOMER_INBOX_LEASE_CHANGED',409);
 if(!customerChannelActive(connection,now.getTime(),{environment}))fail();
 const payload=decodeSignedCustomerEvent(event,connection,environment);if(!marker(payload)||digest(payload)!==digest(first)||digest(event.payload)!==digest(initial[0].payload))fail();
 assertCustomerReplyWindow(payload,now.getTime());
 const r=Object.freeze({kind:'KYC_REJECTION_REPLY',issuer,connection,owner,event,payload,now,ownCompanyCapability});authorities.set(r,fingerprint(r));return r;
}
