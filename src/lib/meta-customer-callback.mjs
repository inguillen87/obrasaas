import {createHmac,timingSafeEqual} from 'node:crypto';
import {WorkspaceError,digest} from './workspace-policy.mjs';
import {exactSecretMatch} from './legacy-access-boundary.js';
import {encryptCustomerSecret,customerVaultConfigured} from './meta-customer-credentials.mjs';
import {metaAssetId} from './meta-customer-provider.mjs';
import {OBRASAAS_META_CHANNEL} from './meta-channel-binding.mjs';
const MAX_BYTES=262144;
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
// JSON object ordering is transport formatting, while array ordering and
// actual values are part of the event content protected by the replay digest.
function canonicalValue(value){
 if(Array.isArray(value))return value.map(canonicalValue);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonicalValue(value[key])]));
 return value;
}
export const metaCustomerContentDigest=value=>digest(canonicalValue(value));
export function verifyMetaCustomerSignature(bytes,signature,environment=process.env){
 if(typeof environment.META_APP_SECRET!=='string'||environment.META_APP_SECRET.length<16)throw new WorkspaceError('META_CUSTOMER_CALLBACK_NOT_CONFIGURED',503);
 if(!/^sha256=[a-f0-9]{64}$/.test(signature||''))return false;
 const expected=createHmac('sha256',environment.META_APP_SECRET).update(bytes).digest();return timingSafeEqual(Buffer.from(signature.slice(7),'hex'),expected);
}
async function rawBody(request){
 if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json'||request.headers.has('content-encoding')||!request.body)throw new WorkspaceError('META_CUSTOMER_CALLBACK_INVALID');
 const size=request.headers.get('content-length');if(size!==null&&(!/^\d+$/.test(size)||Number(size)>MAX_BYTES))throw new WorkspaceError('META_CUSTOMER_CALLBACK_TOO_LARGE',413);
 const reader=request.body.getReader();let length=0;const parts=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>MAX_BYTES)throw new WorkspaceError('META_CUSTOMER_CALLBACK_TOO_LARGE',413);parts.push(Buffer.from(value));}return Buffer.concat(parts,length);}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export function splitMetaCustomerEvents(payload){
 if(payload?.object!=='whatsapp_business_account'||!Array.isArray(payload.entry)||!payload.entry.length||payload.entry.length>50)throw new WorkspaceError('META_CUSTOMER_CALLBACK_INVALID');
 const events=[];
 for(const entry of payload.entry){
  if(!metaAssetId(entry.id)||!Array.isArray(entry.changes)||!entry.changes.length||entry.changes.length>50)throw new WorkspaceError('META_CUSTOMER_CALLBACK_INVALID');
  if(entry.id===OBRASAAS_META_CHANNEL.wabaId)throw new WorkspaceError('META_CUSTOMER_DEMO_ASSET_REJECTED',403);
  for(const change of entry.changes){
   if(typeof change.field!=='string'||change.field.length>80||!change.value||typeof change.value!=='object'||Array.isArray(change.value))throw new WorkspaceError('META_CUSTOMER_CALLBACK_INVALID');
   const phoneNumberId=change.value.metadata?.phone_number_id||null;
   if(phoneNumberId!==null&&!metaAssetId(phoneNumberId))throw new WorkspaceError('META_CUSTOMER_CALLBACK_INVALID');
   if(phoneNumberId===OBRASAAS_META_CHANNEL.phoneNumberId)throw new WorkspaceError('META_CUSTOMER_DEMO_ASSET_REJECTED',403);
   const add=(type,id,value)=>{const eventPayload={wabaId:entry.id,phoneNumberId,field:change.field,type,value};events.push({wabaId:entry.id,phoneNumberId,type,externalId:digest([entry.id,phoneNumberId,type,id]),payload:eventPayload,payloadDigest:metaCustomerContentDigest(eventPayload)});};
   if(change.field==='messages'){
    if(!phoneNumberId)throw new WorkspaceError('META_CUSTOMER_CALLBACK_INVALID');let count=0;
    for(const message of change.value.messages||[]){if(typeof message.id!=='string'||!/^wamid\.[A-Za-z0-9+/_=-]{8,1024}$/.test(message.id))throw new WorkspaceError('META_CUSTOMER_CALLBACK_INVALID');add('message',message.id,message);count++;}
    for(const status of change.value.statuses||[]){if(typeof status.id!=='string'||!/^wamid\.[A-Za-z0-9+/_=-]{8,1024}$/.test(status.id)||!['sent','delivered','read','failed','deleted'].includes(status.status)||!/^\d{1,14}$/.test(String(status.timestamp||'')))throw new WorkspaceError('META_CUSTOMER_CALLBACK_INVALID');add('message_status',[status.id,status.status,status.timestamp],status);count++;}
    if(!count)throw new WorkspaceError('META_CUSTOMER_CALLBACK_INVALID');
   }else add(change.field,metaCustomerContentDigest(change.value),change.value);
   if(events.length>200)throw new WorkspaceError('META_CUSTOMER_CALLBACK_TOO_LARGE',413);
  }
 }
 return events;
}
export async function lockMetaCustomerInboxChannel(client,{wabaId,phoneNumberId,projectId=null}){
 // Resolve without locks, then acquire every lock explicitly in canonical
 // Project -> WhatsAppConnection order. A joined FOR SHARE has no such order.
 const candidates=await client.query(`SELECT c.id,c."projectId",p."organizationId" FROM public."WhatsAppConnection" c JOIN public."Project" p ON p.id=c."projectId" WHERE c."whatsappBusinessId"=$1 AND ($2::text IS NULL OR c."phoneNumberId"=$2) AND ($3::text IS NULL OR c."projectId"=$3) AND p.status='ACTIVE'`,[wabaId,phoneNumberId,projectId]);
 if(candidates.rows.length!==1)throw new WorkspaceError('META_CUSTOMER_CALLBACK_SCOPE_REJECTED',403);
 const candidate=candidates.rows[0];
 const project=(await client.query(`SELECT id,"organizationId" FROM public."Project" WHERE id=$1 AND "organizationId"=$2 AND status='ACTIVE' FOR SHARE`,[candidate.projectId,candidate.organizationId])).rows[0];
 if(!project)throw new WorkspaceError('META_CUSTOMER_CALLBACK_SCOPE_REJECTED',403);
 const channel=(await client.query(`SELECT id,"projectId",metadata,"whatsappBusinessId","phoneNumberId" FROM public."WhatsAppConnection" WHERE id=$1 AND "projectId"=$2 AND "whatsappBusinessId"=$3 AND ($4::text IS NULL OR "phoneNumberId"=$4) FOR SHARE`,[candidate.id,project.id,wabaId,phoneNumberId])).rows[0];
 if(!channel||channel.whatsappBusinessId===OBRASAAS_META_CHANNEL.wabaId||channel.phoneNumberId===OBRASAAS_META_CHANNEL.phoneNumberId||channel.metadata?.credentialFormat!=='tenant-aad-v2'||channel.metadata?.credentialOrganizationId!==project.organizationId)throw new WorkspaceError('META_CUSTOMER_CALLBACK_SCOPE_REJECTED',403);
 return {...channel,organizationId:project.organizationId};
}
export function createMetaCustomerInbox({connect,environment=process.env}){
 return {async record(events,{signatureVerified=false}={}){
  let client,broken=false;
  try{client=await connect();await client.query('BEGIN');await client.query("SET LOCAL statement_timeout='6000ms'");let received=0,replayed=0;
   for(const event of [...events].sort((left,right)=>left.externalId.localeCompare(right.externalId))){
    const channel=await lockMetaCustomerInboxChannel(client,event),id='customer_webhook_'+event.externalId;
    const encryptedPayload=encryptCustomerSecret(JSON.stringify(event.payload),{organizationId:channel.organizationId,projectId:channel.projectId,purpose:'webhook',resourceId:id},environment);
    const encryptedProof=signatureVerified===true?encryptCustomerSecret(JSON.stringify({scheme:'meta-hmac-sha256-v1',appId:OBRASAAS_META_CHANNEL.appId,payloadDigest:event.payloadDigest,channelId:channel.id,organizationId:channel.organizationId}),{organizationId:channel.organizationId,projectId:channel.projectId,purpose:'webhook-proof',resourceId:id},environment):null;
    const payload={version:1,encryptedPayload,encryptedProof,payloadDigest:event.payloadDigest,channelId:channel.id,organizationId:channel.organizationId,signatureVerified:signatureVerified===true,signatureScheme:signatureVerified===true?'meta-hmac-sha256-v1':null};
    const write=await client.query(`INSERT INTO public."WebhookEvent" (id,"projectId",provider,"externalId","eventType",status,payload,"updatedAt") VALUES ($1,$2,'meta-customer-v1',$3,$4,'PENDING',$5::jsonb,clock_timestamp()) ON CONFLICT (provider,"externalId") DO NOTHING`,[id,channel.projectId,event.externalId,event.type,JSON.stringify(payload)]);
    if(write.rowCount===1)received++;else{const prior=await client.query(`SELECT "projectId",payload FROM public."WebhookEvent" WHERE provider='meta-customer-v1' AND "externalId"=$1`,[event.externalId]);
     if(prior.rows.length!==1||prior.rows[0].projectId!==channel.projectId||prior.rows[0].payload?.payloadDigest!==event.payloadDigest)throw new WorkspaceError('META_CUSTOMER_CALLBACK_REPLAY_CONFLICT',409);replayed++;}
   }
   await client.query('COMMIT');return {received,replayed,durable:true,applied:false,eventIds:events.map(event=>'customer_webhook_'+event.externalId)};
  }catch(error){if(client)try{await client.query('ROLLBACK');}catch{broken=true;}throw error instanceof WorkspaceError?error:new WorkspaceError('META_CUSTOMER_CALLBACK_UNCONFIRMED',503);}
  finally{client?.release(broken);}
 }};
}
export function createMetaCustomerCallbackHandlers({inbox,environment=process.env,schedule=()=>{}}){
 return {
  async GET(request){try{const params=new URL(request.url).searchParams;
   if(typeof environment.META_CUSTOMER_VERIFY_TOKEN!=='string'||environment.META_CUSTOMER_VERIFY_TOKEN.length<32)throw new WorkspaceError('META_CUSTOMER_CALLBACK_NOT_CONFIGURED',503);
   if(params.size!==3||[...params.keys()].some(name=>!['hub.mode','hub.verify_token','hub.challenge'].includes(name)||params.getAll(name).length!==1)||params.get('hub.mode')!=='subscribe'||!/^\d{1,128}$/.test(params.get('hub.challenge')||''))throw new WorkspaceError('META_CUSTOMER_CALLBACK_INVALID');
   if(!exactSecretMatch(params.get('hub.verify_token'),environment.META_CUSTOMER_VERIFY_TOKEN))throw new WorkspaceError('META_CUSTOMER_SIGNATURE_REJECTED',403);
   return new Response(params.get('hub.challenge'),{headers:{...headers,'Content-Type':'text/plain'}});
  }catch(error){return Response.json({code:error.code||'META_CUSTOMER_CALLBACK_UNCONFIRMED'},{status:error.status||503,headers});}},
  async POST(request){try{
   if(!customerVaultConfigured(environment))throw new WorkspaceError('META_CUSTOMER_CALLBACK_NOT_CONFIGURED',503);
   const bytes=await rawBody(request);if(!verifyMetaCustomerSignature(bytes,request.headers.get('x-hub-signature-256'),environment))throw new WorkspaceError('META_CUSTOMER_SIGNATURE_REJECTED',403);
   let payload;try{payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new WorkspaceError('META_CUSTOMER_CALLBACK_INVALID');}
   const result=await inbox.record(splitMetaCustomerEvents(payload),{signatureVerified:true});
   if(result.durable!==true)throw new WorkspaceError('META_CUSTOMER_CALLBACK_UNCONFIRMED',503);
   // Scheduling is after the durable commit. A lost wake-up is recovered by
   // the signed recovery endpoint; it must never turn an accepted inbox into
   // a retry or make provider effects part of Meta's acknowledgement latency.
   try{schedule(result.eventIds||[]);}catch{}
   return Response.json({received:true,durable:true,applied:false},{headers});
  }catch(error){return Response.json({received:false,code:error instanceof WorkspaceError?error.code:'META_CUSTOMER_CALLBACK_UNCONFIRMED'},{status:error instanceof WorkspaceError?error.status:503,headers});}},
 };
}
