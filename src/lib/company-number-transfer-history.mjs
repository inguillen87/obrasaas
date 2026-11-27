import {WorkspaceError} from './workspace-policy.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from './meta-customer-credentials.mjs';
const present=async client=>(await client.query(`SELECT to_regclass('public."WhatsAppAssetRetirement"') IS NOT NULL AS ready`)).rows[0]?.ready===true;
export async function assertActiveAssetOwnership(client,connection){
 if(!await present(client))return;
 // The source credential row remains locked through a final provider send. A
 // cutover requires UPDATE of that same row, so it cannot cross an active POST.
 const current=(await client.query(`SELECT c.id,c."projectId",c."phoneNumberId",c."whatsappBusinessId",c.metadata,p."organizationId",h."transferId" AS retired FROM public."WhatsAppConnection" c JOIN public."Project" p ON p.id=c."projectId" LEFT JOIN public."WhatsAppAssetRetirement" h ON h."sourceConnectionId"=c.id WHERE c.id=$1 FOR SHARE OF c`,[connection.id])).rows[0];
 if(!current||current.retired||current.metadata?.assetRetirement||['projectId','phoneNumberId','whatsappBusinessId'].some(key=>current[key]!==connection[key])||current.organizationId!==connection.organizationId)throw new WorkspaceError('COMPANY_TRANSFER_OWNER_RETIRED',403);
 const own=current.metadata?.assetOwnership;
 if(own){const rows=(await client.query(`SELECT generation,"transferId" FROM public."WhatsAppActiveAsset" WHERE "connectionId"=$1 AND "projectId"=$2 AND "organizationId"=$3 AND "wabaId"=$4 AND "phoneNumberId"=$5 FOR SHARE`,[current.id,current.projectId,current.organizationId,current.whatsappBusinessId,current.phoneNumberId])).rows;if(rows.length!==1||rows[0].generation!==own.generation||rows[0].transferId!==own.transferId||connection.metadata?.assetOwnership?.generation!==own.generation)throw new WorkspaceError('COMPANY_TRANSFER_GENERATION_CHANGED',403);}
}
export function transferObservationInterval(histories,timestamp){
 const created=Number(timestamp)*1000;
 if(typeof timestamp!=='string'||!/^\d{1,14}$/.test(timestamp)||!Number.isSafeInteger(created)||created<=0)return {quarantine:true,reason:'TRANSFER_EVENT_TIME_UNCONFIRMED'};
 for(const history of histories){const boundary=Math.floor(new Date(history.retiredAt).getTime()/1000)*1000;if(!Number.isFinite(boundary))throw new WorkspaceError('COMPANY_TRANSFER_HISTORY_PROOF_REQUIRED',409);if(created<boundary)return {history,reason:'HISTORICAL_INTERVAL'};if(created===boundary)return {quarantine:true,reason:'TRANSFER_EVENT_BOUNDARY_AMBIGUOUS'};}
 return null;
}
// Signature checking remains at the existing callback boundary. This selector
// runs before current-owner routing and never grants operational authority.
export async function historicalAssetRoute(client,event){
 if(!await present(client))return null;
 // Held until the existing ingress transaction commits its source-bound
 // durable event. Transfer acquires the same key before Project/Connection.
 await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['company-number-transfer:'+event.wabaId]);
 const histories=(await client.query(`SELECT h.* FROM public."WhatsAppAssetRetirement" h WHERE h."wabaId"=$1 AND ($2::text IS NULL OR h."phoneNumberId"=$2) ORDER BY h.generation`,[event.wabaId,event.phoneNumberId])).rows;
 if(!histories.length)return null;
 const value=event.payload?.value;
 const existing=(await client.query(`SELECT \"projectId\",payload FROM public.\"WebhookEvent\" WHERE provider='meta-customer-v1' AND \"externalId\"=$1`,[event.externalId])).rows;
 if(existing.length===1){const history=histories.find(h=>h.sourceConnectionId===existing[0].payload?.channelId&&h.sourceProjectId===existing[0].projectId&&h.sourceOrganizationId===existing[0].payload?.organizationId);if(history)return {history,reason:'HISTORICAL_REPLAY'};}
 if(event.payload?.type==='message_status'){
  const id=value?.biz_opaque_callback_data;
  if(!/^customer_outbound_[a-f0-9]{64}$/.test(id||''))return {quarantine:true,reason:'TRANSFER_STATUS_WITHOUT_RECEIPT'};
  const rows=(await client.query(`SELECT "projectId",payload,outcome FROM public."WebhookEvent" WHERE id=$1 AND provider='meta-customer-outbound-v1'`,[id])).rows;
  if(rows.length!==1)return {quarantine:true,reason:'TRANSFER_STATUS_RECEIPT_UNKNOWN'};
  const original=rows[0],history=histories.find(h=>h.sourceConnectionId===original.payload?.channelId&&h.sourceProjectId===original.projectId&&h.sourceOrganizationId===original.payload?.organizationId);
  if(history)return {history,reason:'HISTORICAL_STATUS'};
  // A status for the new owner uses current routing only with an exact receipt.
  const active=(await client.query(`SELECT "connectionId","projectId","organizationId" FROM public."WhatsAppActiveAsset" WHERE "wabaId"=$1 AND "phoneNumberId"=$2`,[event.wabaId,event.phoneNumberId])).rows[0];
  if(active&&active.connectionId===original.payload?.channelId&&active.projectId===original.projectId&&active.organizationId===original.payload?.organizationId)return null;
  return {quarantine:true,reason:'TRANSFER_STATUS_OWNER_UNKNOWN'};
 }
 if(event.payload?.type==='message'){
  const replyId=value?.context?.id;
  if(replyId){const prior=(await client.query(`SELECT payload,"projectId" FROM public."WebhookEvent" WHERE provider='meta-customer-outbound-v1' AND outcome->>'messageId'=$1 LIMIT 2`,[replyId])).rows;if(prior.length>1)return {quarantine:true,reason:'TRANSFER_REPLY_AMBIGUOUS'};if(prior.length===1){const history=histories.find(h=>h.sourceConnectionId===prior[0].payload?.channelId&&h.sourceProjectId===prior[0].projectId);if(history)return {history,reason:'HISTORICAL_REPLY'};}}
  return transferObservationInterval(histories,value?.timestamp);
 }
 // Account lifecycle affects the entire WABA, including Cloud API channels.
 // A first-seen old event has no prior destination lifecycle to order against.
 // Attribute its signed entry.time before sealing a current-owner proof.
 if(event.payload?.field==='account_update'&&event.payload?.type==='account_update')return transferObservationInterval(histories,event.payload.providerTimestamp);
 // Other app/history/template fragments have no uniform trustworthy ownership
 // timestamp. Single-phone Cloud API transfer does not authorize importing an
 // old owner's data; preserve encrypted evidence for explicit reconciliation.
 return {quarantine:true,reason:'TRANSFER_NONMESSAGE_OWNERSHIP_UNCONFIRMED'};
}
export async function recordTransferQuarantine(client,event,{id,environment,reason}){
 const encrypted=encryptCustomerSecret(JSON.stringify(event.payload),{organizationId:'asset-quarantine',projectId:'asset-quarantine',purpose:'transfer-quarantine',resourceId:id},environment);
 const write=await client.query(`INSERT INTO public."WhatsAppAssetQuarantine"(id,"payloadDigest","wabaId","phoneNumberId","encryptedPayload",reason) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING`,[id,event.payloadDigest,event.wabaId,event.phoneNumberId,encrypted,reason]);
 if(write.rowCount===0){const old=(await client.query(`SELECT "payloadDigest" FROM public."WhatsAppAssetQuarantine" WHERE id=$1`,[id])).rows[0];if(old?.payloadDigest!==event.payloadDigest)throw new WorkspaceError('META_CUSTOMER_CALLBACK_REPLAY_CONFLICT',409);}
 return {recorded:write.rowCount===1};
}
export function historicalChannel(history){const c=history.sourceSnapshot;return {...c,organizationId:history.sourceOrganizationId,companyRouting:null,retiredObservation:{version:1,transferId:history.transferId,generation:history.generation}};}
export async function observeRetiredTransferEvent(client,row,{environment,protocol,decode,outbound}){
 if(!row.payload?.retiredObservation)return null;
 const reference=row.payload.retiredObservation;
 const history=(await client.query(`SELECT * FROM public."WhatsAppAssetRetirement" WHERE "sourceConnectionId"=$1 AND "sourceProjectId"=$2 AND "transferId"=$3 AND generation=$4`,[row.payload.channelId,row.projectId,reference.transferId,reference.generation])).rows[0];
 if(!history)throw new WorkspaceError('COMPANY_TRANSFER_HISTORY_PROOF_REQUIRED',409);
 const channel=historicalChannel(history),event={...row,provider:protocol.provider},payload=decode(event,channel,environment,protocol);
 // The signed proof must bind this exact historical observation as well.
 const proof=JSON.parse(decryptCustomerSecret(row.payload.encryptedProof,{organizationId:channel.organizationId,projectId:channel.projectId,purpose:protocol.proofPurpose,resourceId:row.id},environment));
 if(proof.retiredObservation?.transferId!==reference.transferId||proof.retiredObservation?.generation!==reference.generation)throw new WorkspaceError('COMPANY_TRANSFER_HISTORY_PROOF_REQUIRED',409);
 if(payload.type==='message_status')await outbound.observeStatus(client,{event,payload,channel});
 const outcome={version:1,intent:null,kind:'RETIRED_OWNER_OBSERVATION',reviewState:'HISTORICAL_ONLY',identityStatus:'NOT_APPLICABLE',businessApplied:false,replySent:false};
 await client.query(`UPDATE public."WebhookEvent" SET status='PROCESSED',outcome=$2::jsonb,"processedAt"=clock_timestamp(),"leaseToken"=NULL,"leaseExpiresAt"=NULL,"updatedAt"=clock_timestamp() WHERE id=$1 AND status='PENDING'`,[row.id,JSON.stringify(outcome)]);
 return {done:true,eventId:row.id,processed:true,...outcome};
}
