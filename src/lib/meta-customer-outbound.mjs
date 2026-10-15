import {randomUUID} from 'node:crypto';
import {WorkspaceError,digest,workspaceId} from './workspace-policy.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {readMetaFieldOutboundAuthority} from './meta-field-bridge.mjs';
import {resolveWorkerChannelIdentity,refreshLockedWorkerChannelIdentity,releaseLockedWorkerChannelIdentity,assertWorkerCustomerConnection} from './worker-channel-identity.mjs';
import {resolveCompanyOutboundIdentity} from './company-channel-routing.mjs';
import {customerReplyMessage} from './meta-customer-provider.mjs';
import {hasMetaCustomerRequiredScopes} from './meta-customer-permissions.mjs';
import {META_CUSTOMER_PROTOCOL,resolveMetaCloudProtocol} from './meta-cloud-protocol.mjs';
import {customerLifecycleRecovery} from './meta-customer-coexistence.mjs';
import {assertDevelopmentPilotAttendance} from './meta-development-pilot-policy.mjs';
import {ownCompanyConnectionPolicy,lockOwnCompanyIssuer,ownCompanyCapabilityKind,fenceOwnCompanyRuntime,compactOwnCompanyRuntimeSourceFence} from './meta-own-company-policy.mjs';

export const customerOutboundId=eventId=>'customer_outbound_'+digest(['meta-customer-reply-v1',eventId]);
const diagnosticPhases=new Set(['AFTER_RESERVE','OWN_PROVIDER_SCOPE','OWN_BEFORE_EXTERNAL','REPLY_POST','OUTCOME_COMMIT','PROCESSING']);
const diagnosticCodes=new Set(['META_CUSTOMER_OUTBOUND_FAILURE_UNCONFIRMED','META_CUSTOMER_INBOX_LEASE_CHANGED','META_CUSTOMER_OUTBOUND_LEASE_CHANGED','META_CUSTOMER_OUTBOUND_CONTEXT_CHANGED','META_CUSTOMER_OUTBOUND_UNCONFIRMED','META_CUSTOMER_REPLY_WINDOW_CLOSED','META_CUSTOMER_PROVIDER_REJECTED','META_CUSTOMER_PROVIDER_UNCONFIRMED','META_CUSTOMER_SEND_UNCONFIRMED','META_KYC_CHALLENGE_REJECTED','META_KYC_CHALLENGE_REVOKED','META_KYC_CHALLENGE_EXPIRED','META_KYC_COMPANY_AUTHORITY_CHANGED','META_KYC_COMPANY_CONTEXT_REQUIRED','META_CUSTOMER_CHANNEL_ACCEPTANCE_REQUIRED','EMPLOYEE_INTAKE_INTEGRITY','EMPLOYEE_INTAKE_REVOKED','META_OWN_COMPANY_UNAVAILABLE','META_OWN_COMPANY_CONFIGURATION_PENDING','META_OWN_COMPANY_OWNER_UNVERIFIED','META_OWN_COMPANY_OWNER_UNCONFIRMED','META_OWN_COMPANY_TOKEN_REJECTED','META_OWN_COMPANY_CREDENTIAL_REJECTED','META_OWN_COMPANY_ASSET_REJECTED','META_OWN_COMPANY_PHONE_REJECTED','META_OWN_COMPANY_ADAPTER_UNAVAILABLE']);
// A diagnostic is an observation, never proof that the provider POST occurred.
// Do not serialize an exception, SQL, token, message body or document reference.
export function customerOutboundDiagnostic({phase,code,now=Date.now()}={}){
 if(!Number.isFinite(now)||Math.abs(now)>8640000000000000)return null;
 return {version:1,phase:diagnosticPhases.has(phase)?phase:'PROCESSING',code:diagnosticCodes.has(code)?code:'META_CUSTOMER_OUTBOUND_FAILURE_UNCONFIRMED',recordedAt:new Date(now).toISOString()};
}
export function readCustomerOutboundDiagnostic(value){
 if(!value||Array.isArray(value)||Object.keys(value).sort().join('|')!=='code|phase|recordedAt|version'||value.version!==1||!diagnosticPhases.has(value.phase)||!diagnosticCodes.has(value.code)||typeof value.recordedAt!=='string'||!Number.isFinite(Date.parse(value.recordedAt))||new Date(value.recordedAt).toISOString()!==value.recordedAt)return null;
 return {version:1,phase:value.phase,code:value.code,recordedAt:value.recordedAt};
}
export async function recordCustomerOutboundDiagnostic(client,{reserved=null,context,phase,code,now=Date.now()}){
 const diagnostic=customerOutboundDiagnostic({phase,code,now});
 if(!diagnostic||!/^customer_webhook_[a-f0-9]{64}$/.test(context?.eventId||'')||typeof context.leaseToken!=='string'||!context.leaseToken||!workspaceId(context.projectId)||!workspaceId(context.channelId)||!/^[a-f0-9]{64}$/.test(context.payloadDigest||''))return false;
 // The failed source lease may have expired. It must still be the exact lease
 // that owned this attempt; recording its cause cannot renew or execute it.
 const sources=(await client.query(`SELECT id,"projectId",status::text AS status,payload,"leaseToken" FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-v1' AND status='PENDING' AND "leaseToken"=$3 FOR UPDATE`,[context.eventId,context.projectId,context.leaseToken])).rows;
 if(sources.length!==1)return false;const source=sources[0],organizationId=source.payload?.organizationId;
 if(source.id!==context.eventId||source.projectId!==context.projectId||source.status!=='PENDING'||source.leaseToken!==context.leaseToken||source.payload?.channelId!==context.channelId||source.payload?.payloadDigest!==context.payloadDigest||!workspaceId(organizationId)||reserved&&(reserved.id!==customerOutboundId(context.eventId)||reserved.connection?.id!==context.channelId||reserved.connection?.projectId!==context.projectId||reserved.connection?.organizationId!==organizationId))return false;
 const id=customerOutboundId(context.eventId),rows=(await client.query(`SELECT id,"projectId",payload,outcome,"leaseToken" FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1' FOR UPDATE`,[id,context.projectId])).rows;
 if(rows.length!==1)return false;const row=rows[0],stored=row.payload;
 if(row.id!==id||row.projectId!==context.projectId||stored?.version!==1||stored.eventId!==context.eventId||stored.channelId!==context.channelId||stored.organizationId!==organizationId||!/^[a-f0-9]{64}$/.test(stored.requestDigest||'')||row.outcome?.version!==1||!['SEND_STARTED','SEND_UNKNOWN'].includes(row.outcome?.state)||row.outcome?.messageId||Object.hasOwn(row.outcome||{},'diagnostic')||reserved&&(reserved.requestDigest!==stored.requestDigest||reserved.leaseToken!==row.leaseToken))return false;
 const written=await client.query(`UPDATE public."WebhookEvent" SET outcome=jsonb_set(outcome,'{diagnostic}',$6::jsonb),"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1' AND payload->>'requestDigest'=$3 AND "leaseToken" IS NOT DISTINCT FROM $4::text AND outcome->>'state'=$5 AND NOT (outcome ? 'diagnostic') AND EXISTS(SELECT 1 FROM public."WebhookEvent" source WHERE source.id=$7 AND source."projectId"=$2 AND source.provider='meta-customer-v1' AND source.status='PENDING' AND source."leaseToken"=$8 AND source.payload->>'channelId'=$9 AND source.payload->>'payloadDigest'=$10 AND source.payload->>'organizationId'=$11)`,[id,context.projectId,stored.requestDigest,row.leaseToken,row.outcome.state,JSON.stringify(diagnostic),context.eventId,context.leaseToken,context.channelId,context.payloadDigest,organizationId]);
 return written.rowCount===1;
}
export function customerChannelActive(connection,now=Date.now(),{pilotAttendance=false,environment=process.env}={}){
 if(connection?.metadata?.ownCompany||Object.hasOwn(connection?.metadata||{},'ownCompanyRuntime')){try{ownCompanyConnectionPolicy(connection,environment,now);}catch{return false;}}
 if(connection?.metadata?.developmentPilot){if(!pilotAttendance)return false;try{assertDevelopmentPilotAttendance(connection,environment,now);}catch{return false;}}
 const verified=connection?.metadata?.customerVerification,activation=connection?.metadata?.customerActivation;
 const recovery=customerLifecycleRecovery(connection);if(recovery&&recovery.state!=='RESTORED')return false;
 return connection?.enabled===true&&connection.connectionStatus==='CONNECTED'&&connection.metadata?.customerSubscribed===true&&activation?.version===1&&activation.state==='ACTIVE'&&typeof activation.actorId==='string'&&verified?.registered===true&&hasMetaCustomerRequiredScopes(verified.scopes)&&(!verified.expiresAt||new Date(verified.expiresAt).getTime()>now+60000);
}
export function assertCustomerReplyWindow(payload,now=Date.now()){
 const value=payload?.value,timestamp=Number(value?.timestamp);
 if(payload?.type!=='message'||!/^wamid\.[A-Za-z0-9+/_=-]{8,1024}$/.test(value?.id||'')||!/^[1-9]\d{7,14}$/.test(value?.from||'')||!/^\d{1,14}$/.test(String(value?.timestamp||''))||!Number.isSafeInteger(timestamp)||timestamp*1000>now+60000||now-timestamp*1000>=24*60*60*1000)throw new WorkspaceError('META_CUSTOMER_REPLY_WINDOW_CLOSED',409);
 return {to:value.from,replyTo:value.id};
}
export async function customerJobTransaction(connect,run){
 const client=await connect();let broken=false;
 try{await client.query('BEGIN');await client.query("SET LOCAL statement_timeout='8000ms'");const result=await run(client);await client.query('COMMIT');return result;}
 catch(error){try{await client.query('ROLLBACK');}catch{broken=true;}throw error;}
 finally{client.release(broken);}
}
export const customerOutboundResult=row=>({id:row.id,state:row.outcome?.state||'SEND_UNKNOWN',replySent:['SENT','STATUS_OBSERVED'].includes(row.outcome?.state)&&!['failed','deleted'].includes(row.outcome?.providerStatus),messageId:row.outcome?.messageId||null,providerStatus:row.outcome?.providerStatus||null,replayed:true});
const publicResult=customerOutboundResult;
// Authenticated compositions supply already locked, canonical recipient state.
// Both replies and manual templates share this durable reservation/status lane.
export async function reserveCustomerOutbound(client,{id,projectId,organizationId,actorId,request,eventType='reply',payloadFields={},environment=process.env,now=Date.now(),deferred=false}){
 if(!/^customer_outbound_[a-f0-9]{64}$/.test(id)||!['reply','template'].includes(eventType)||request.channelId!==payloadFields.channelId&&payloadFields.channelId!==undefined||request.organizationId!==organizationId)throw new WorkspaceError('META_CUSTOMER_OUTBOUND_CONTEXT_CHANGED',409);
 const requestDigest=digest(request),previous=(await client.query(`SELECT id,payload,outcome FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1' FOR UPDATE`,[id,projectId])).rows[0];
 if(previous){if(previous.payload?.requestDigest!==requestDigest)throw new WorkspaceError('META_CUSTOMER_OUTBOUND_CONFLICT',409);return {done:publicResult(previous)};}
 if(deferred&&(eventType!=='template'||request.channelPurpose!=='PARTICIPANT_ONBOARDING'||payloadFields.participantOnboarding!==true))throw new WorkspaceError('META_CUSTOMER_OUTBOUND_CONTEXT_CHANGED',409);
 const encryptedPayload=encryptCustomerSecret(JSON.stringify(request),{organizationId,projectId,purpose:'outbound',resourceId:id},environment),leaseToken=deferred?null:randomUUID();
 await client.query(`INSERT INTO public."WebhookEvent"(id,"projectId",provider,"externalId","eventType",status,payload,outcome,"leaseToken","leaseExpiresAt",attempts,"updatedAt") VALUES($1,$2,'meta-customer-outbound-v1',$1,$3,'PENDING',$4::jsonb,$5::jsonb,$6,$7,1,clock_timestamp())`,[id,projectId,eventType,JSON.stringify({...payloadFields,version:1,channelId:request.channelId,organizationId,...(request.eventId?{eventId:request.eventId}:{}),requestDigest,encryptedPayload}),JSON.stringify({version:1,state:'SEND_STARTED',reservedAt:new Date(now).toISOString(),actorId}),leaseToken,new Date(now+60000)]);
 if(deferred)await client.query(`UPDATE public."WebhookEvent" SET outcome=$3::jsonb,"leaseToken"=NULL,"leaseExpiresAt"=NULL,attempts=0 WHERE id=$1 AND "projectId"=$2`,[id,projectId,JSON.stringify({version:1,state:'ONBOARDING_PENDING',preparedAt:new Date(now).toISOString(),actorId})]);
 return {id,leaseToken,requestDigest};
}
// The marker commits before the only permitted POST. An existing marker is
// deliberately never leased again, even when its lease or HTTP request expires.
export async function startPendingCustomerOutbound(client,{id,projectId,requestDigest,now=Date.now()}){
 const row=(await client.query(`SELECT id,payload,outcome FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1' FOR UPDATE`,[id,projectId])).rows[0];
 if(!row||row.payload?.requestDigest!==requestDigest||row.payload.participantOnboarding!==true)throw new WorkspaceError('META_CUSTOMER_OUTBOUND_CONTEXT_CHANGED',409);
 if(row.outcome?.state!=='ONBOARDING_PENDING')return {done:publicResult(row)};
 const leaseToken=randomUUID();
 await client.query(`UPDATE public."WebhookEvent" SET outcome=$3::jsonb,"leaseToken"=$4,"leaseExpiresAt"=$5,attempts=attempts+1,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[id,projectId,JSON.stringify({...row.outcome,state:'SEND_STARTED',reservedAt:new Date(now).toISOString()}),leaseToken,new Date(now+60000)]);
 return {id,projectId,leaseToken,requestDigest};
}
export async function completeCustomerOutbound(client,{id,projectId,leaseToken,state,messageId=null,now=Date.now(),outcomeFields={}}){
 if(!['SENT','SEND_UNKNOWN','REJECTED'].includes(state))throw new WorkspaceError('META_CUSTOMER_OUTBOUND_CONTEXT_CHANGED',409);
 const row=(await client.query(`SELECT id,payload,outcome FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1' FOR UPDATE`,[id,projectId])).rows[0];
 if(!row)throw new WorkspaceError('META_CUSTOMER_OUTBOUND_UNCONFIRMED',503);
 if(row.outcome?.state==='STATUS_OBSERVED')return {...publicResult(row),payload:row.payload};
 const updated=await client.query(`UPDATE public."WebhookEvent" SET status='PROCESSED',outcome=$4::jsonb,"processedAt"=clock_timestamp(),"leaseToken"=NULL,"leaseExpiresAt"=NULL,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2 AND "leaseToken"=$3`,[id,projectId,leaseToken,JSON.stringify({...row.outcome,...outcomeFields,state,messageId,completedAt:new Date(now).toISOString()})]);
 if(updated.rowCount!==1)throw new WorkspaceError('META_CUSTOMER_OUTBOUND_LEASE_CHANGED',409);
 return {id,state,replySent:state==='SENT',messageId,replayed:false,payload:row.payload};
}
export function createMetaCustomerOutbound({connect,resolveIdentity,provider,environment=process.env,now=()=>Date.now(),afterReserve=async()=>{},protocol=META_CUSTOMER_PROTOCOL,channelActive=customerChannelActive,sourceContext=false}){
 resolveMetaCloudProtocol(protocol);
 const within=run=>customerJobTransaction(connect,run);
 async function reserve(context,reply,lockedClient=null,transactionGuard=null){
  customerReplyMessage(reply);
   const run=async client=>{
    let resolved;
    try{
   // Canonical resolver owns U/TM -> Project -> PM -> Worker -> Channel ->
   // Event locking and revalidates signed evidence, participation and KYC.
   const canonical=resolveIdentity===resolveWorkerChannelIdentity||resolveIdentity===resolveCompanyOutboundIdentity;
   if(lockedClient&&canonical&&transactionGuard?.resolved?.worker){
    // The guard exists only inside this one customerJobTransaction callback.
    // Its first full resolver owns all identity, assignment, connection, source
    // and projection locks. Refresh mutable participant state with the same
    // canonical helpers, not a second signature/selector/role engine.
     resolved=await refreshLockedWorkerChannelIdentity(client,transactionGuard.resolved,{environment});
   }else resolved=await resolveIdentity(client,{eventId:context.eventId,permission:null,claimChallenge:false,environment});
    if(lockedClient&&transactionGuard){if(!canonical&&transactionGuard.resolved!==resolved)releaseLockedWorkerChannelIdentity(transactionGuard.resolved);transactionGuard.resolved=resolved;}
   const {project,connection,event,member}=resolved,payload=resolved.proof?.payload||resolved.proof?.message||resolved.proof;
   if(resolved.kind!=='CHANNEL_VERIFIED'||(sourceContext?event.projectId:project.id)!==context.projectId||connection.id!==context.channelId||event.payload.payloadDigest!==context.payloadDigest||event.leaseToken!==context.leaseToken||event.status!=='PENDING'||new Date(event.leaseExpiresAt).getTime()<=now())throw new WorkspaceError('META_CUSTOMER_OUTBOUND_CONTEXT_CHANGED',409);
   if(!channelActive(connection,now(),{pilotAttendance:Boolean(resolved.developmentPilotCapability),environment}))throw new WorkspaceError('META_CUSTOMER_CHANNEL_ACCEPTANCE_REQUIRED',409);
   // Production field identities carry a canonical worker or corporate source
   // projection. Transport-only internal test adapters have neither; they cannot
   // be produced by either production identity resolver.
   const authority=protocol===META_CUSTOMER_PROTOCOL&&(resolved.worker||resolved.companyProjection)?await readMetaFieldOutboundAuthority(client,resolved,reply,{environment}):null;
   if(lockedClient&&transactionGuard)transactionGuard.authority=authority;
   const finishReservation=async value=>{
    if(canonical&&lockedClient){
     // This is the last awaited DB operation of a provider fence, after receipt,
     // marker and OWN readiness work. Time validity is not frozen by row locks.
     const observed=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
     assertWorkerCustomerConnection(connection,member.organizationId,project.id,observed.getTime(),{operational:true,environment});
     if(event.status!=='PENDING'||event.leaseToken!==context.leaseToken||!Number.isFinite(Date.parse(event.leaseExpiresAt))||Date.parse(event.leaseExpiresAt)<=observed.getTime())throw new WorkspaceError('META_CUSTOMER_INBOX_LEASE_CHANGED',409);
     if(authority?.recoveryDeadline&&(!Number.isFinite(Date.parse(authority.recoveryDeadline))||Date.parse(authority.recoveryDeadline)<=observed.getTime()))throw new WorkspaceError('META_CHANNEL_CONSUMPTION_RECOVERY_EXPIRED',409);
    }
    return value;
   };
   const {to,replyTo}=assertCustomerReplyWindow(payload,now()),id=customerOutboundId(event.id),request={version:1,eventId:event.id,payloadDigest:context.payloadDigest,channelId:connection.id,organizationId:member.organizationId,to,replyTo,message:reply,...(authority?.authorityDigest?{replyAuthorityDigest:authority.authorityDigest}:{}),...(protocol!==META_CUSTOMER_PROTOCOL?{channelPurpose:protocol.purpose}:{}),...(sourceContext?{targetProjectId:resolved.companyProjection?.projectId||null,sourceRouteId:resolved.companyProjection?.sourceEventId}: {})};
   if(authority?.authorityDigest){const prior=(await client.query(`SELECT id,payload,outcome FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1' FOR UPDATE`,[id,sourceContext?event.projectId:project.id])).rows[0];if(prior&&authority.derivedExpiryFeedback){if(prior.payload?.version!==1||prior.payload.eventId!==event.id||prior.payload.channelId!==connection.id||prior.payload.organizationId!==member.organizationId||!['SEND_STARTED','SEND_UNKNOWN','SENT','REJECTED','STATUS_OBSERVED'].includes(prior.outcome?.state))throw new WorkspaceError('META_CUSTOMER_OUTBOUND_CONTEXT_CHANGED',409);return finishReservation({done:{...publicResult(prior),replySent:false,observationOnly:true}});}if(prior&&!Object.hasOwn(JSON.parse(decryptCustomerSecret(prior.payload.encryptedPayload,{organizationId:member.organizationId,projectId:sourceContext?event.projectId:project.id,purpose:'outbound',resourceId:id},environment)),'replyAuthorityDigest'))delete request.replyAuthorityDigest;}
   const reservation=await reserveCustomerOutbound(client,{id,projectId:sourceContext?event.projectId:project.id,organizationId:member.organizationId,actorId:member.actorId,request,environment,now:now()});if(reservation.done)return finishReservation(reservation);
   const token=decryptCustomerSecret(connection.encryptedAccessToken,{organizationId:member.organizationId,projectId:sourceContext?connection.projectId:project.id,purpose:protocol.credentialPurpose,resourceId:connection.phoneNumberId},environment);
   const ownCompanyCapability=await lockOwnCompanyIssuer(client,connection,{environment,now:now()});
    return finishReservation({...reservation,token,phoneNumberId:connection.phoneNumberId,to,replyTo,connection,developmentPilotCapability:resolved.developmentPilotCapability,ownCompanyCapability});
    }finally{if(!lockedClient)releaseLockedWorkerChannelIdentity(resolved);}
  };return lockedClient?run(lockedClient):within(run);
 }
 return {
  async send(context,reply){
   const reserved=await reserve(context,reply);if(reserved.done)return reserved.done;
   // No retry may send an existing reservation, including after this hook,
   // a crashed worker, a timed-out POST or a lost database commit response.
    let state='SEND_UNKNOWN',result=null,phase='AFTER_RESERVE',firstFailure=null,markerObservation=null,markerInvalid=false,finalGuardDenial=null;
   const capturedMarker=async client=>{
    const row=(await client.query(`SELECT id,"projectId",payload,outcome,"leaseToken" FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1' FOR UPDATE`,[reserved.id,context.projectId])).rows[0];
    if(!row||row.id!==reserved.id||row.projectId!==context.projectId||row.payload?.requestDigest!==reserved.requestDigest||row.payload?.eventId!==context.eventId||row.payload?.channelId!==context.channelId||row.payload?.organizationId!==reserved.connection.organizationId){markerInvalid=true;throw new WorkspaceError('META_CUSTOMER_OUTBOUND_LEASE_CHANGED',409);}
    if(['SEND_UNKNOWN','SENT','REJECTED','STATUS_OBSERVED'].includes(row.outcome?.state)){markerObservation={...publicResult(row),replySent:false,observationOnly:true};return false;}
    if(row.outcome?.state!=='SEND_STARTED'||row.leaseToken!==reserved.leaseToken){markerInvalid=true;throw new WorkspaceError('META_CUSTOMER_OUTBOUND_LEASE_CHANGED',409);}
    return true;
   };
   const observeFailure=error=>{firstFailure??={phase,code:error instanceof WorkspaceError?error.code:null};};
   // Record only after the canonical transaction releases its locks. This
   // observation neither leases an old reservation nor invokes its transport.
   const remember=()=>firstFailure?within(client=>recordCustomerOutboundDiagnostic(client,{reserved,context,...firstFailure,now:now()})).catch(()=>false):false;
   try{
    await afterReserve();
     const send=async(scopedProvider,finalBeforeExternal)=>{
      let finalGuardError=null;
      // The production provider awaits this callback before its only POST.
      // Preserve a definite local denial from that boundary; a fetch failure or
      // an authority failure after the POST remains an uncertain delivery.
      const guardedFinal=async()=>{try{return await finalBeforeExternal();}catch(error){if(error instanceof WorkspaceError)finalGuardError=error;throw error;}};
      try{result=await scopedProvider.sendReply({...reserved,message:reply,correlationId:reserved.id,finalBeforeExternal:guardedFinal});state='SENT';}catch(error){observeFailure(error);if(error===finalGuardError)finalGuardDenial=error;if(error instanceof WorkspaceError&&error.code==='META_CUSTOMER_PROVIDER_REJECTED')state='REJECTED';}
     };
    if(ownCompanyCapabilityKind(reserved.ownCompanyCapability)==='RUNTIME'){
     // Hold the canonical credential/issuer/audit SHARE locks through the single
     // POST. Provider awaits also invoke this same fresh fence; a new grant does
     // not authorize the captured token or reservation from the previous grant.
     await within(async client=>{
      // Revalidate with the same transaction: canonical resolvers acquire
      // Project UPDATE before the OWN SHARE fence, without a second connection.
       const transactionGuard={resolved:null};try{phase='OWN_BEFORE_EXTERNAL';await reserve(context,reply,client,transactionGuard);
      if(!await capturedMarker(client))return;
      // Readiness GETs send no participant reply. The first canonical resolver
      // already holds every principal/source/marker lock in this transaction;
      // each GET still requires a fresh issuer, grant, credential and DB clock.
      // Only the final POST fence may authorize/decrypt the private reply again.
      // Injected resolvers retain their original full revalidation on every await.
      const canonicalPreparation=protocol===META_CUSTOMER_PROTOCOL&&(resolveIdentity===resolveWorkerChannelIdentity||resolveIdentity===resolveCompanyOutboundIdentity)&&transactionGuard.resolved?.worker;
       const preparationSource=canonicalPreparation?Object.freeze({eventId:context.eventId,projectId:context.projectId,channelId:context.channelId,organizationId:transactionGuard.resolved.member.organizationId,payloadDigest:context.payloadDigest,leaseToken:context.leaseToken}):null;
      const preparationFence=async()=>{
       const resumePhase=phase;phase='OWN_BEFORE_EXTERNAL';
        const {capability,observed}=await compactOwnCompanyRuntimeSourceFence(client,reserved.connection,preparationSource,{environment,now:now()}),current=transactionGuard.resolved;
       assertWorkerCustomerConnection(current.connection,current.member.organizationId,current.project.id,observed.getTime(),{operational:true,environment});
       assertCustomerReplyWindow(current.proof?.payload||current.proof?.message||current.proof,observed.getTime());
       phase=resumePhase;return {capability,observed};
      };
      const finalBeforeExternal=async()=>{
       const resumePhase=phase;phase='OWN_BEFORE_EXTERNAL';
       if(!await capturedMarker(client))throw new WorkspaceError('META_CUSTOMER_OUTBOUND_LEASE_CHANGED',409);
       const capability=await fenceOwnCompanyRuntime(client,reserved.connection,{environment,now:now()});
       await reserve(context,reply,client,transactionGuard);
       if(!await capturedMarker(client))throw new WorkspaceError('META_CUSTOMER_OUTBOUND_LEASE_CHANGED',409);
       const observed=canonicalPreparation?(await preparationFence()).observed:(await client.query('SELECT clock_timestamp() AS now')).rows[0].now,current=transactionGuard.resolved;
       if(!(observed instanceof Date)||!Number.isFinite(observed.getTime())||!current||Date.parse(current.event.leaseExpiresAt)<=observed.getTime())throw new WorkspaceError('META_CUSTOMER_INBOX_LEASE_CHANGED',409);
       const deadline=transactionGuard.authority?.recoveryDeadline;
       if(deadline&&(!Number.isFinite(Date.parse(deadline))||Date.parse(deadline)<=observed.getTime()))throw new WorkspaceError('META_CHANNEL_CONSUMPTION_RECOVERY_EXPIRED',409);
       phase=resumePhase;return capability;
      };
      const beforeExternal=canonicalPreparation?preparationFence:finalBeforeExternal;
      await beforeExternal();phase='OWN_PROVIDER_SCOPE';const scopedProvider=await provider.forConnection({capability:reserved.ownCompanyCapability,connection:reserved.connection,token:reserved.token,beforeExternal});
      phase='REPLY_POST';await beforeExternal();await send(scopedProvider,finalBeforeExternal);
       if(!markerInvalid&&!markerObservation)await capturedMarker(client);
       }finally{releaseLockedWorkerChannelIdentity(transactionGuard.resolved);}
     });
    }else{
     // Legacy pilot/admin readiness performs external ownership GETs. Complete
     // that audit before locking participants, then acquire fresh canonical
     // authority and keep its locks through the single reply POST.
     phase='OWN_PROVIDER_SCOPE';let scopedProvider=provider;
     if(reserved.connection?.metadata?.developmentPilot||reserved.connection?.metadata?.ownCompany||Object.hasOwn(reserved.connection?.metadata||{},'ownCompanyRuntime'))scopedProvider=await provider.forConnection({capability:reserved.ownCompanyCapability||reserved.developmentPilotCapability,connection:reserved.connection,token:reserved.token});
     await within(async client=>{
      // Keep the existing canonical participant/worker locks through the only
      // POST in this lane too. Awaited readiness cannot release that authority.
       const transactionGuard={resolved:null};try{
      const revalidate=async()=>{
       try{return await reserve(context,reply,client,transactionGuard);}
       catch(error){
        // A conflicting captured marker belongs to another attempt. Observe
        // that mismatch without adding this attempt's diagnostic to its row.
        if(error instanceof WorkspaceError&&error.code==='META_CUSTOMER_OUTBOUND_CONFLICT')await capturedMarker(client);
        throw error;
       }
      };
      const beforeExternal=async()=>{
       const resumePhase=phase;phase='OWN_BEFORE_EXTERNAL';
       if(!await capturedMarker(client))throw new WorkspaceError('META_CUSTOMER_OUTBOUND_LEASE_CHANGED',409);
       await revalidate();
       if(!await capturedMarker(client))throw new WorkspaceError('META_CUSTOMER_OUTBOUND_LEASE_CHANGED',409);
       const current=transactionGuard.resolved,observed=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
       // Readiness authorized the captured credential and asset tuple. A later
       // valid connection cannot authorize sending with the previous token.
       if(['id','projectId','organizationId','phoneNumberId','whatsappBusinessId','encryptedAccessToken'].some(key=>current.connection[key]!==reserved.connection[key]))throw new WorkspaceError('META_CUSTOMER_OUTBOUND_CONTEXT_CHANGED',409);
       if(!(observed instanceof Date)||!Number.isFinite(observed.getTime())||current.event.status!=='PENDING'||current.event.leaseToken!==context.leaseToken||!Number.isFinite(Date.parse(current.event.leaseExpiresAt))||Date.parse(current.event.leaseExpiresAt)<=observed.getTime())throw new WorkspaceError('META_CUSTOMER_INBOX_LEASE_CHANGED',409);
       if(!channelActive(current.connection,observed.getTime(),{pilotAttendance:Boolean(current.developmentPilotCapability),environment}))throw new WorkspaceError('META_CUSTOMER_CHANNEL_ACCEPTANCE_REQUIRED',409);
       assertCustomerReplyWindow(current.proof?.payload||current.proof?.message||current.proof,observed.getTime());
       const deadline=transactionGuard.authority?.recoveryDeadline;
       if(deadline&&(!Number.isFinite(Date.parse(deadline))||Date.parse(deadline)<=observed.getTime()))throw new WorkspaceError('META_CHANNEL_CONSUMPTION_RECOVERY_EXPIRED',409);
       phase=resumePhase;
      };
      // Acquire the principal/project/worker/source locks in canonical order
      // before the first marker lock, matching concurrent reserve/replay paths.
      phase='OWN_BEFORE_EXTERNAL';await revalidate();
      if(!await capturedMarker(client))return;
      phase='OWN_BEFORE_EXTERNAL';await beforeExternal();phase='REPLY_POST';await send(scopedProvider,beforeExternal);
       }finally{releaseLockedWorkerChannelIdentity(transactionGuard.resolved);}
     });
    }
    if(markerObservation)return markerObservation;
    if(markerInvalid)return {id:reserved.id,state:'META_CUSTOMER_OUTBOUND_LEASE_CHANGED',replySent:false,definitive:false,replayed:false};
    await remember();phase='OUTCOME_COMMIT';
    const completed=await within(client=>completeCustomerOutbound(client,{...reserved,projectId:context.projectId,state,messageId:result?.messageId||null,now:now()}));
     // Keep the existing durable non-retryable marker before surfacing the
     // original local denial. Never relabel a provider/fetch error as this case.
     if(finalGuardDenial)throw finalGuardDenial;
    const {payload:privatePayload,...resultPublic}=completed;void privatePayload;return resultPublic;
   }catch(error){if(markerObservation)return markerObservation;if(markerInvalid)return {id:reserved.id,state:'META_CUSTOMER_OUTBOUND_LEASE_CHANGED',replySent:false,definitive:false,replayed:false};observeFailure(error);await remember();throw error;}
  },
  async result({eventId,projectId,channelId}){
   return within(async client=>{const row=(await client.query(`SELECT id,payload,outcome FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1' AND payload->>'channelId'=$3`,[customerOutboundId(eventId),projectId,channelId])).rows[0];return row?publicResult(row):{state:'NOT_OBSERVED',replySent:false,definitive:false};});
  },
  async observeStatus(client,{event,payload,channel}){
   const value=payload?.value,id=value?.biz_opaque_callback_data;
   if(payload?.type!=='message_status'||event.payload.signatureVerified!==true||!/^customer_outbound_[a-f0-9]{64}$/.test(id||''))return {correlated:false};
   const row=(await client.query(`SELECT id,payload,outcome FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1' AND payload->>'channelId'=$3 FOR UPDATE`,[id,event.projectId,channel.id])).rows[0];if(!row)return {correlated:false};
   if(row.payload?.participantOnboarding===true&&!['SEND_STARTED','SEND_UNKNOWN','SENT','REJECTED','STATUS_OBSERVED'].includes(row.outcome?.state))return {correlated:false};
   const request=JSON.parse(decryptCustomerSecret(row.payload.encryptedPayload,{organizationId:channel.organizationId,projectId:event.projectId,purpose:'outbound',resourceId:id},environment));
   if(digest(request)!==row.payload.requestDigest||request.channelId!==channel.id||request.organizationId!==channel.organizationId||value.recipient_id!==request.to||row.outcome?.messageId&&row.outcome.messageId!==value.id)throw new WorkspaceError('META_CUSTOMER_OUTBOUND_STATUS_CONFLICT',409);
   const previous=row.outcome?.providerStatus,order={sent:1,delivered:2,read:3,failed:4,deleted:5};
   if(previous&&(order[previous]||0)>(order[value.status]||0))return {correlated:true};
   await client.query(`UPDATE public."WebhookEvent" SET status='PROCESSED',outcome=$3::jsonb,"processedAt"=clock_timestamp(),"leaseToken"=NULL,"leaseExpiresAt"=NULL,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[id,event.projectId,JSON.stringify({...row.outcome,state:'STATUS_OBSERVED',messageId:value.id,providerStatus:value.status,statusEventId:event.id,statusObservedAt:new Date(now()).toISOString()})]);return {correlated:true};
  },
 };
}
