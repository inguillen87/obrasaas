import {createHmac,timingSafeEqual,randomUUID} from 'node:crypto';
import {WorkspaceError,digest} from './workspace-policy.mjs';
import {decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {lockMetaCustomerInboxChannel,metaCustomerContentDigest} from './meta-customer-callback.mjs';
import {metaCustomerInboxIntent} from './meta-customer-inbox-review.mjs';
import {customerJobTransaction} from './meta-customer-outbound.mjs';
import {OBRASAAS_META_CHANNEL} from './meta-channel-binding.mjs';
import {exactSecretMatch} from './legacy-access-boundary.js';
import {META_CUSTOMER_PROTOCOL,resolveMetaCloudProtocol,metaCloudEventMatches} from './meta-cloud-protocol.mjs';
import {lockDevelopmentPilotIssuer,assertDevelopmentPilotCommit} from './meta-development-pilot-policy.mjs';

const validEvent=id=>/^customer_webhook_[a-f0-9]{64}$/.test(id||'');
export const META_CUSTOMER_PROOF_REVIEW_CODES=Object.freeze(['WORKER_CHANNEL_SIGNED_PROOF_REQUIRED','WORKER_CHANNEL_PROOF_INTEGRITY','META_CUSTOMER_EVENT_PROOF_REQUIRED','META_CUSTOMER_INBOX_PAYLOAD_UNVERIFIED']);
const authorizationObservations=new Set(['WORKER_CHANNEL_BINDING_REQUIRED','WORKER_CHANNEL_PARTICIPANT_REQUIRED','WORKER_CHANNEL_KYC_REVIEW_REQUIRED','WORKER_CHANNEL_PERMISSION_REQUIRED','WORKER_CHANNEL_CUSTOMER_ACTIVATION_REQUIRED','WORKER_CHANNEL_CUSTOMER_CONNECTION_REQUIRED','WORKER_CHANNEL_CHALLENGE_REJECTED','WORKER_CHANNEL_CHALLENGE_EXPIRED','WORKER_CHANNEL_CHALLENGE_USED','META_CUSTOMER_CHANNEL_ACCEPTANCE_REQUIRED','META_CHANNEL_MESSAGE_NOT_SUPPORTED','META_CHANNEL_INPUT_REVIEW_REQUIRED']);
export function decodeSignedCloudEvent(event,channel,environment,protocol=META_CUSTOMER_PROTOCOL){
 resolveMetaCloudProtocol(protocol);
 try{
  if(event.provider!==undefined&&event.provider!==protocol.provider||event.payload?.signatureVerified!==true||event.payload?.signatureScheme!==protocol.scheme||event.payload.organizationId!==channel.organizationId||event.payload.channelId!==channel.id||event.projectId!==channel.projectId||protocol!==META_CUSTOMER_PROTOCOL&&event.payload.channelPurpose!==protocol.purpose)throw new Error();
  const context={organizationId:channel.organizationId,projectId:channel.projectId,resourceId:event.id};
  const proof=JSON.parse(decryptCustomerSecret(event.payload.encryptedProof,{...context,purpose:protocol.proofPurpose},environment));
  const payload=JSON.parse(decryptCustomerSecret(event.payload.encryptedPayload,{...context,purpose:protocol.payloadPurpose},environment));
  if(proof.scheme!==protocol.scheme||proof.purpose!==protocol.purpose&&!(protocol===META_CUSTOMER_PROTOCOL&&proof.purpose===undefined)||protocol!==META_CUSTOMER_PROTOCOL&&(proof.grantId!==channel.metadata?.demoPilot?.grantId||event.payload.grantId!==proof.grantId)||proof.appId!==OBRASAAS_META_CHANNEL.appId||proof.channelId!==channel.id||proof.organizationId!==channel.organizationId||proof.payloadDigest!==event.payload.payloadDigest||metaCustomerContentDigest(payload)!==proof.payloadDigest||payload.wabaId!==channel.whatsappBusinessId||payload.phoneNumberId!==null&&payload.phoneNumberId!==channel.phoneNumberId)throw new Error();
  return payload;
 }catch{throw new WorkspaceError('META_CUSTOMER_EVENT_PROOF_REQUIRED',409);}
}
export const decodeSignedCustomerEvent=(event,channel,environment)=>decodeSignedCloudEvent(event,channel,environment,META_CUSTOMER_PROTOCOL);
const safeOutcome=result=>({version:1,classifierVersion:'enterprise-1677ff7-obra-intent-v1',intent:result.intent||null,reviewState:result.reviewState||'REVIEW_REQUIRED',businessApplied:result.businessApplied===true,replySent:result.replySent===true,kind:typeof result.kind==='string'?result.kind.slice(0,64):null,receiptId:typeof result.receiptId==='string'?result.receiptId.slice(0,160):null,replyState:result.replyState||null,code:result.code||null,identity:{status:result.identityStatus||'NOT_CHECKED',workerId:result.workerId||null}});
export function createDevelopmentPilotDispatchGuard({connect,environment=process.env}){
 return context=>customerJobTransaction(connect,async client=>{
  const candidate=(await client.query(`SELECT c.*,p."organizationId" FROM public."WhatsAppConnection" c JOIN public."Project" p ON p.id=c."projectId" WHERE c.id=$1 AND c."projectId"=$2`,[context.channelId,context.projectId])).rows[0];
  if(!candidate?.metadata?.developmentPilot)return false;
  const initial=(await client.query(`SELECT id,"projectId",provider,payload FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-v1'`,[context.eventId,context.projectId])).rows[0];
  if(!initial||initial.payload?.payloadDigest!==context.payloadDigest)throw new WorkspaceError('META_CUSTOMER_EVENT_PROOF_REQUIRED',409);
  const payload=decodeSignedCustomerEvent(initial,candidate,environment);if(payload.type!=='message')return false;
  const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now.getTime();await lockDevelopmentPilotIssuer(client,candidate,{environment,now});
  const project=(await client.query(`SELECT id FROM public."Project" WHERE id=$1 AND "organizationId"=$2 AND status='ACTIVE' FOR SHARE`,[candidate.projectId,candidate.organizationId])).rows[0];if(!project)throw new WorkspaceError('META_DEVELOPMENT_PILOT_UNAVAILABLE',403);
  if(!['text','interactive','location'].includes(payload.value?.type))throw new WorkspaceError('META_DEVELOPMENT_PILOT_ADAPTER_UNAVAILABLE',409);
  await assertDevelopmentPilotCommit(client,candidate,environment);return true;
 });
}
export function createMetaCustomerProcessor({connect,dispatch,outbound,environment=process.env,now=()=>Date.now(),afterClaim=async()=>{},beforeDispatch=async()=>false,protocol=META_CUSTOMER_PROTOCOL,lockChannel=lockMetaCustomerInboxChannel,authorizationCodes=[]}){
 resolveMetaCloudProtocol(protocol);
 const within=run=>customerJobTransaction(connect,run);
 async function claim(eventId){return within(async client=>{
  const row=(await client.query(`SELECT id,"projectId",payload,status::text AS status,"leaseToken","leaseExpiresAt",outcome,attempts FROM public."WebhookEvent" WHERE id=$1 AND provider=$2 FOR UPDATE`,[eventId,protocol.provider])).rows[0];
  if(!row)throw new WorkspaceError('META_CUSTOMER_INBOX_UNAVAILABLE',404);
  if(row.status==='PROCESSED')return {done:true,eventId,businessApplied:row.outcome?.businessApplied===true,replySent:row.outcome?.replySent===true};
  if(row.status!=='PENDING'||row.leaseToken&&new Date(row.leaseExpiresAt).getTime()>now())return {busy:true,eventId};
  const leaseToken=randomUUID();await client.query(`UPDATE public."WebhookEvent" SET "leaseToken"=$2,"leaseExpiresAt"=$3,attempts=attempts+1,"updatedAt"=clock_timestamp() WHERE id=$1`,[row.id,leaseToken,new Date(now()+60000)]);
  return {eventId:row.id,projectId:row.projectId,channelId:row.payload.channelId,payloadDigest:row.payload.payloadDigest,leaseToken};
 });}
 async function observe(context,code=null){return within(async client=>{
  const candidate=(await client.query(`SELECT "whatsappBusinessId","phoneNumberId" FROM public."WhatsAppConnection" WHERE id=$1 AND "projectId"=$2`,[context.channelId,context.projectId])).rows[0];
  if(!candidate)throw new WorkspaceError('META_CUSTOMER_CALLBACK_SCOPE_REJECTED',403);
  const channel=await lockChannel(client,{wabaId:candidate.whatsappBusinessId,phoneNumberId:candidate.phoneNumberId,projectId:context.projectId});
  const event=(await client.query(`SELECT id,"projectId",provider,payload,status::text AS status,"leaseToken","leaseExpiresAt" FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider=$3 FOR UPDATE`,[context.eventId,context.projectId,protocol.provider])).rows[0];
  if(!event||event.leaseToken!==context.leaseToken||event.status!=='PENDING'||new Date(event.leaseExpiresAt).getTime()<=now()||event.payload.payloadDigest!==context.payloadDigest)throw new WorkspaceError('META_CUSTOMER_INBOX_LEASE_CHANGED',409);
  const payload=decodeSignedCloudEvent(event,channel,environment,protocol),intent=metaCustomerInboxIntent(payload);
  if(payload.type==='message_status')await outbound?.observeStatus(client,{event,payload,channel});
  return {intent,kind:payload.type,reviewState:payload.type==='message'?'REVIEW_REQUIRED':'OBSERVED',identityStatus:payload.type==='message'?'CHANNEL_IDENTITY_UNVERIFIED':'NOT_APPLICABLE',businessApplied:false,replySent:false,code};
 });}
 async function finish(context,result){return within(async client=>{
  const outcome=safeOutcome(result);
  const written=await client.query(`UPDATE public."WebhookEvent" SET status='PROCESSED',outcome=$4::jsonb,"processedAt"=clock_timestamp(),"appliedAt"=CASE WHEN $5 THEN clock_timestamp() ELSE "appliedAt" END,"leaseToken"=NULL,"leaseExpiresAt"=NULL,"lastError"=NULL,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2 AND status='PENDING' AND "leaseToken"=$3 AND "leaseExpiresAt">$6`,[context.eventId,context.projectId,context.leaseToken,JSON.stringify(outcome),outcome.businessApplied,new Date(now())]);
  if(written.rowCount!==1)throw new WorkspaceError('META_CUSTOMER_INBOX_LEASE_CHANGED',409);
  return {eventId:context.eventId,processed:true,...outcome};
 });}
 return {
  async process(eventId){
   if(!metaCloudEventMatches(protocol,eventId))throw new WorkspaceError('META_CUSTOMER_INBOX_INPUT_INVALID');
   const context=await claim(eventId);if(context.done||context.busy)return context;await afterClaim();
   try{
    let result;
    try{context.developmentPilot=await beforeDispatch(context)===true;result=await dispatch(context);}catch(error){
     // Authorization failures are durable observations, never invitations to
     // guess a recipient, imitate a web session, or run a fallback engine.
     if(error instanceof WorkspaceError&&(authorizationObservations.has(error.code)||authorizationCodes.includes(error.code)))result=await observe(context,error.code);else throw error;
    }
    if(!result)result=await observe(context);
    if(result.reply){let reply;try{reply=await outbound.send(context,result.reply,{purpose:result.kind==='EMPLOYEE_INTAKE'?'EMPLOYEE_INTAKE':result.kind==='KYC_CHAT'?'KYC_CAPTURE':'FIELD'});}catch(error){if(error instanceof WorkspaceError&&(error.code==='META_CUSTOMER_REPLY_WINDOW_CLOSED'||authorizationObservations.has(error.code)||authorizationCodes.includes(error.code)))reply={replySent:false,state:error.code};else throw error;}result={...result,replySent:reply.replySent,replyState:reply.state};}
    return finish(context,result);
   }catch(error){
    await within(client=>client.query(`UPDATE public."WebhookEvent" SET "lastError"=$3,"leaseToken"=NULL,"leaseExpiresAt"=NULL,"updatedAt"=clock_timestamp() WHERE id=$1 AND "leaseToken"=$2 AND status='PENDING'`,[context.eventId,context.leaseToken,error instanceof WorkspaceError?error.code:'META_CUSTOMER_PROCESSING_UNCONFIRMED'])).catch(()=>{});throw error;
   }
  },
  async recover({limit=3,eventIds=null,budgetMs=210000}={}){
   if(!Number.isInteger(limit)||limit<1||limit>20||eventIds!==null&&(!Array.isArray(eventIds)||eventIds.length>20||eventIds.some(id=>!metaCloudEventMatches(protocol,id))))throw new WorkspaceError('META_CUSTOMER_JOB_INPUT_INVALID');
   if(!Number.isInteger(budgetMs)||budgetMs<180000||budgetMs>240000)throw new WorkspaceError('META_CUSTOMER_JOB_INPUT_INVALID');
   const started=Date.now();
   const ids=eventIds||await within(async client=>(await client.query(`SELECT id FROM public."WebhookEvent" WHERE provider=$4 AND status='PENDING' AND ("leaseToken" IS NULL OR "leaseExpiresAt"<=$1) AND NOT (COALESCE("lastError",'')=ANY($3::text[])) AND ("lastError" IS NULL OR "updatedAt"<$1::timestamp-interval '1 minute') ORDER BY "createdAt",id LIMIT $2`,[new Date(now()),limit,META_CUSTOMER_PROOF_REVIEW_CODES,protocol.provider])).rows.map(row=>row.id));
   const results=[];for(const id of ids.slice(0,limit)){if(results.length&&Date.now()-started>budgetMs-180000)break;try{results.push(await this.process(id));}catch(error){results.push({eventId:id,processed:false,code:error instanceof WorkspaceError?error.code:'META_CUSTOMER_PROCESSING_UNCONFIRMED'});}}
   return {durable:true,checked:results.length,results};
  },
 };
}
const jobSecret=environment=>{const secret=environment.META_CUSTOMER_JOB_SECRET;if(typeof secret!=='string'||secret.length<32)throw new WorkspaceError('META_CUSTOMER_JOB_NOT_CONFIGURED',503);return secret;};
export function signMetaCustomerJob(body,timestamp,environment=process.env){return createHmac('sha256',jobSecret(environment)).update('obrasaas-meta-customer-process-v1\n'+String(timestamp)+'\n').update(body).digest('hex');}
export function createMetaCustomerJobHandlers({processor,environment=process.env,now=()=>Date.now()}){
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 return {
  async GET(request){try{const secret=environment.CRON_SECRET;if(typeof secret!=='string'||secret.length<32||!exactSecretMatch(request.headers.get('authorization'),'Bearer '+secret)||new URL(request.url).search)throw new WorkspaceError('META_CUSTOMER_JOB_SIGNATURE_REJECTED',403);return Response.json(await processor.recover({limit:3}),{headers});}catch(error){return Response.json({code:error instanceof WorkspaceError?error.code:'META_CUSTOMER_PROCESSING_UNCONFIRMED'},{status:error instanceof WorkspaceError?error.status:503,headers});}},
  async POST(request){try{
   const timestamp=request.headers.get('x-obrasaas-job-time'),signature=request.headers.get('x-obrasaas-job-signature');
   if(request.headers.get('content-type')!=='application/json'||request.headers.has('content-encoding')||!/^\d{13}$/.test(timestamp||'')||Math.abs(now()-Number(timestamp))>60000||!/^sha256=[a-f0-9]{64}$/.test(signature||''))throw new WorkspaceError('META_CUSTOMER_JOB_SIGNATURE_REJECTED',403);
   const length=request.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>4096))throw new WorkspaceError('META_CUSTOMER_JOB_INPUT_INVALID',413);
   const reader=request.body?.getReader();if(!reader)throw new WorkspaceError('META_CUSTOMER_JOB_INPUT_INVALID');const parts=[];let size=0;
   try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>4096)throw new WorkspaceError('META_CUSTOMER_JOB_INPUT_INVALID',413);parts.push(Buffer.from(part.value));}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
   const bytes=Buffer.concat(parts),expected=signMetaCustomerJob(bytes,timestamp,environment);if(!timingSafeEqual(Buffer.from(signature.slice(7),'hex'),Buffer.from(expected,'hex')))throw new WorkspaceError('META_CUSTOMER_JOB_SIGNATURE_REJECTED',403);
   let input;try{input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new WorkspaceError('META_CUSTOMER_JOB_INPUT_INVALID');}
   if(input?.version!==1||Object.keys(input).sort().join('|')!=='eventIds|version'||!Array.isArray(input.eventIds)||input.eventIds.length>20||!input.eventIds.length||input.eventIds.some(id=>!validEvent(id)))throw new WorkspaceError('META_CUSTOMER_JOB_INPUT_INVALID');
   return Response.json(await processor.recover({eventIds:input.eventIds}),{headers});
  }catch(error){return Response.json({code:error instanceof WorkspaceError?error.code:'META_CUSTOMER_PROCESSING_UNCONFIRMED'},{status:error instanceof WorkspaceError?error.status:503,headers});}},
 };
}
