import {randomUUID,createHmac,timingSafeEqual} from 'node:crypto';
import {WorkspaceError,workspaceId,operationId} from './workspace-policy.mjs';
import {companyPhoneContract} from './company-onboarding-policy.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {requireCompanyChannelSchema} from './company-channel-schema.mjs';
import {assertCompanyChannelNoPending} from './company-channel-store.mjs';
import {assertOwnCompanyTemplatesSettledForTransfer} from './meta-own-company-templates.mjs';
import {companyWhatsappOnboardingEntitlement} from './company-entitlement.mjs';
import {requireTransferSchema} from './company-number-transfer-schema.mjs';
import {transferEnabled,transferInput,transferFailure,transferDigest,assertSinglePhoneGrant,assertTransferSnapshot,transferPublic} from './company-number-transfer-policy.mjs';
import {normalizeCompanyPhone} from './company-onboarding-policy.mjs';
const receipt=(member,input)=>'asset_transfer_'+transferDigest([member.organizationId,member.actorId,input.projectId,input.operationId]);
const secretContext=row=>({organizationId:row.destinationOrganizationId,projectId:row.destinationProjectId,purpose:'asset-transfer-grant',resourceId:row.id});
function stateToken(row,environment){const key=environment.META_APP_SECRET;if(typeof key!=='string'||key.length<16)transferFailure('COMPANY_TRANSFER_CONFIGURATION_PENDING',503);return createHmac('sha256',key).update('asset-transfer-v1\n'+row.id+'\n'+row.requestDigest+'\n'+new Date(row.expiresAt).toISOString()).digest('hex');}
const publicReady=(row,environment)=>({...transferPublic(row),...(row.state==='PREPARED'?{stateToken:stateToken(row,environment)}:{})});
const providerFields=p=>({providerMembershipId:p.providerMembershipId,providerMembershipRevision:p.providerMembershipRevision,providerUserRevision:p.providerUserRevision,userId:p.userId,organizationId:p.organizationId,role:p.role});
export function createCompanyNumberTransferStore({workspace,identity,provider,environment=process.env}){
 if(typeof workspace?.organizationOperation!=='function'||typeof identity?.verifyAdminMembership!=='function'||typeof provider?.exchangeTransferGrant!=='function'||typeof provider?.verifyTransferGrant!=='function')throw new TypeError('Canonical workspace, Clerk administrator and Meta transfer ports required');
 const readiness=()=>{const base=provider.readiness();return {...base,configId:environment.META_COMPANY_TRANSFER_CONFIG_ID||null,canLaunchMeta:base.canLaunchMeta===true&&transferEnabled(environment)};};
 const enabled=()=>{if(!transferEnabled(environment))transferFailure('COMPANY_TRANSFER_DISABLED',409);};
 const within=(session,input,writable,run)=>workspace.organizationOperation(session,input,writable,async(client,member,scope)=>{
  if(writable&&input.action!=='CLOSE'||!writable&&!input.transferId&&!input.operationId&&!input.history)enabled();if(session.organizationRole!=='org:admin'||member.role!=='ADMIN'||member.officeReviewOnly!==false)transferFailure('COMPANY_TRANSFER_ADMIN_REQUIRED',403);
  await requireCompanyChannelSchema(client);await requireTransferSchema(client);return {...await run(client,member,scope),scope,available:true};
 });
 async function admin(client,member,session,organizationId,lock){
  const rows=(await client.query(`SELECT m.id AS "membershipId",m."organizationId",m."tenantRole"::text AS role,m."clerkRole",o."clerkOrganizationId",to_char(m."updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS "membershipRevision",to_char(u."updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS "actorRevision" FROM public."TenantMembership" m JOIN public."PlatformUser" u ON u.id=m."userId" JOIN public."Organization" o ON o.id=m."organizationId" WHERE m."organizationId"=$1 AND m."userId"=$2 AND u."clerkUserId"=$3 AND m.status='ACTIVE' AND m."tenantRole"='ADMIN' AND m."clerkRole"='org:admin' AND COALESCE(o.metadata->'internal','false'::jsonb)<>'true'::jsonb AND NOT EXISTS(SELECT 1 FROM public."AuditLog" a WHERE a."organizationId"=m."organizationId" AND a."actorId"=m."userId" AND a.action='office.review.accepted' AND a.metadata->>'membershipId'=m.id) ${lock?'FOR SHARE OF u,m,o':''}`,[organizationId,member.actorId,session.userId])).rows;
  if(rows.length!==1)transferFailure('COMPANY_TRANSFER_ADMIN_REQUIRED',403);
  const row=rows[0],verified=await identity.verifyAdminMembership({userId:session.userId,organizationId:row.clerkOrganizationId});
  if(verified.role!=='org:admin'||verified.userId!==session.userId||verified.organizationId!==row.clerkOrganizationId)transferFailure('COMPANY_TRANSFER_ADMIN_REQUIRED',403);
  return {...row,provider:providerFields(verified)};
 }
 async function source(client,member,session,sourceConnectionId,destinationProjectId,lock){
  const found=(await client.query(`SELECT c.id,c."whatsappBusinessId",p."organizationId",p.id AS "projectId" FROM public."WhatsAppConnection" c JOIN public."Project" p ON p.id=c."projectId" JOIN public."TenantMembership" m ON m."organizationId"=p."organizationId" WHERE c.id=$1 AND m."userId"=$2 AND m.status='ACTIVE' AND m."tenantRole"='ADMIN' AND p."organizationId"<>$3`,[sourceConnectionId,member.actorId,member.organizationId])).rows;
  if(found.length!==1)transferFailure('COMPANY_TRANSFER_SOURCE_UNAVAILABLE',404);
  const initial=found[0],admins=[];
  if(!/^\d{5,32}$/.test(initial.whatsappBusinessId||''))transferFailure('COMPANY_TRANSFER_SOURCE_UNAVAILABLE',404);
  // Same order as callback ingress: WABA boundary -> Project -> Connection.
  // This covers the first retirement too: ingress cannot observe no history,
  // wait behind a cutover, then seal the old event for the new owner.
  if(lock)await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['company-number-transfer:'+initial.whatsappBusinessId]);
  for(const organizationId of [initial.organizationId,member.organizationId].sort())admins.push(await admin(client,member,session,organizationId,lock));
  const projects=(await client.query(`SELECT p.id,p."organizationId",p.metadata,o.metadata AS "organizationMetadata" FROM public."Project" p JOIN public."Organization" o ON o.id=p."organizationId" WHERE p.id=ANY($1::text[]) AND p.status='ACTIVE' ORDER BY p.id ${lock?'FOR UPDATE OF p':''}`,[[initial.projectId,destinationProjectId]])).rows;
  if(projects.length!==2||!projects.some(p=>p.id===destinationProjectId&&p.organizationId===member.organizationId)||!projects.some(p=>p.id===initial.projectId&&p.organizationId===initial.organizationId))transferFailure();
  const destination=projects.find(p=>p.id===destinationProjectId),declaration=companyPhoneContract(destination.organizationMetadata);
  const company=(await client.query(`SELECT id,"subscriptionPlan"::text AS "subscriptionPlan","subscriptionStatus"::text AS "subscriptionStatus",metadata,"trialEndsAt" AT TIME ZONE 'UTC' AS "trialEndsAt" FROM public."Organization" WHERE id=$1 ${lock?'FOR SHARE':''}`,[member.organizationId])).rows[0];const entitlement=companyWhatsappOnboardingEntitlement(company,{now:(await client.query('SELECT clock_timestamp() AS now')).rows[0].now});if(!entitlement.allowed)transferFailure(entitlement.reasonCode,403);
  const current=(await client.query(`SELECT to_jsonb(c) AS snapshot,cc.mode,cc.revision FROM public."WhatsAppConnection" c JOIN public."WhatsAppCompanyChannel" cc ON cc."connectionId"=c.id AND cc."anchorProjectId"=c."projectId" AND cc."organizationId"=$2 WHERE c.id=$1 ${lock?'FOR UPDATE OF c,cc':''}`,[sourceConnectionId,initial.organizationId])).rows[0];
  const c=current?.snapshot;if(!c||c.whatsappBusinessId!==initial.whatsappBusinessId||c.metadata?.assetRetirement||!/^\d{5,32}$/.test(c.phoneNumberId||'')||!/^\d{5,32}$/.test(c.whatsappBusinessId||'')||c.metadata?.credentialFormat!=='tenant-aad-v2'||c.metadata?.credentialOrganizationId!==initial.organizationId||c.metadata?.developmentPilot||c.flowProvisioningLeaseId)transferFailure('COMPANY_TRANSFER_SOURCE_UNAVAILABLE',404);
  const displayPhoneNumber=normalizeCompanyPhone(c.displayPhoneNumber,true);
  if(!declaration||declaration.e164!==displayPhoneNumber)transferFailure('COMPANY_TRANSFER_PHONE_DECLARATION_REQUIRED');
  const dest=(await client.query(`SELECT id FROM public."WhatsAppConnection" WHERE "projectId"=$1`,[destinationProjectId])).rows;if(dest.length)transferFailure('COMPANY_TRANSFER_DESTINATION_OCCUPIED');
  const other=(await client.query(`SELECT id FROM public."WhatsAppConnection" WHERE ("phoneNumberId"=$1 OR "whatsappBusinessId"=$2) AND id<>$3`,[c.phoneNumberId,c.whatsappBusinessId,c.id])).rows;if(other.length)transferFailure('COMPANY_TRANSFER_WABA_SCOPE_REJECTED');
  const binding=(await client.query(`SELECT * FROM public."WhatsAppActiveAsset" WHERE "wabaId"=$1 ${lock?'FOR UPDATE':''}`,[c.whatsappBusinessId])).rows[0]||null;
  if(binding&&(binding.connectionId!==c.id||binding.organizationId!==initial.organizationId||binding.projectId!==initial.projectId||binding.phoneNumberId!==c.phoneNumberId))transferFailure();
  return {admins,sourceSnapshot:{id:c.id,projectId:c.projectId,phoneNumberId:c.phoneNumberId,whatsappBusinessId:c.whatsappBusinessId,displayPhoneNumber:c.displayPhoneNumber,rowCommitment:transferDigest(c)},sourceOrganizationId:initial.organizationId,sourceProjectId:initial.projectId,sourceConnectionId:c.id,sourceRevision:current.revision,sourceMode:current.mode,destinationOrganizationId:member.organizationId,destinationProjectId,companyPhoneRevision:declaration.revision,wabaId:c.whatsappBusinessId,phoneNumberId:c.phoneNumberId,displayPhoneNumber,generation:binding?binding.generation+1:1};
 }
 async function readRow(client,member,input,lock=false){
  const row=(await client.query(`SELECT * FROM public."WhatsAppAssetTransfer" WHERE id=$1 AND "destinationOrganizationId"=$2 AND "destinationProjectId"=$3 AND "actorId"=$4 ${lock?'FOR UPDATE':''}`,[input.transferId,member.organizationId,input.projectId,member.actorId])).rows[0];
  if(!row)transferFailure('COMPANY_TRANSFER_NOT_FOUND',404);return row;
 }
 async function checked(client,member,session,row){
  if(new Date(row.expiresAt).getTime()<=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now.getTime())transferFailure('COMPANY_TRANSFER_EXPIRED',410);
  const actual=await source(client,member,session,row.sourceConnectionId,row.destinationProjectId,true);assertTransferSnapshot(actual,row.plan);return actual;
 }
 async function noPending(client,plan){
  const c=(await client.query(`SELECT * FROM public."WhatsAppConnection" WHERE id=$1 FOR UPDATE`,[plan.sourceConnectionId])).rows[0];if(!c)transferFailure();
  await assertOwnCompanyTemplatesSettledForTransfer(client,c,plan.sourceOrganizationId);
  const projects=(await client.query(`SELECT "projectId" FROM public."WhatsAppChannelProjectAssignment" WHERE "connectionId"=$1 AND status='ACTIVE' ORDER BY "projectId"`,[c.id])).rows;
  try{for(const projectId of [...new Set([c.projectId,...projects.map(row=>row.projectId)])])await assertCompanyChannelNoPending(client,{...c,projectId});}catch(error){if(error instanceof WorkspaceError&&error.code==='COMPANY_CHANNEL_LEGACY_PENDING')transferFailure('COMPANY_TRANSFER_PENDING_OPERATIONS');throw error;}
  const ownUncertain=(await client.query(`SELECT EXISTS(SELECT 1 FROM public."AuditLog" WHERE "organizationId"=$1 AND action='company.own.number.recorded' AND metadata->>'projectId'=$2 AND metadata->>'state' IN ('VERIFYING','PROVIDER_STARTED','PROVIDER_UNKNOWN')) AS pending`,[plan.sourceOrganizationId,plan.sourceProjectId])).rows[0]?.pending;
  if(ownUncertain)transferFailure('COMPANY_TRANSFER_PENDING_OPERATIONS');
  const pending=(await client.query(`SELECT EXISTS(SELECT 1 FROM public."WebhookEvent" WHERE payload->>'channelId'=$1 AND (status='PENDING' OR outcome->>'state' IN ('SEND_STARTED','SEND_UNKNOWN'))) AS pending`,[plan.sourceConnectionId])).rows[0]?.pending;
  if(pending)transferFailure('COMPANY_TRANSFER_PENDING_OPERATIONS');
  for(const table of ['WhatsAppFlowEndpoint','WhatsAppFlowSession']){
   const present=(await client.query('SELECT to_regclass($1) IS NOT NULL AS present',['public."'+table+'"'])).rows[0]?.present;
   if(present){const result=table==='WhatsAppFlowEndpoint'?await client.query(`SELECT EXISTS(SELECT 1 FROM public."WhatsAppFlowEndpoint" WHERE "connectionId"=$1) AS present`,[plan.sourceConnectionId]):await client.query(`SELECT EXISTS(SELECT 1 FROM public."WhatsAppFlowSession" WHERE "projectId"=$1 AND "consumedAt" IS NULL AND "expiresAt">clock_timestamp()) AS present`,[plan.sourceProjectId]);if(result.rows[0]?.present)transferFailure('COMPANY_TRANSFER_FLOW_REVIEW_REQUIRED');}
  }
 }
 return {
  async read(session,input){return within(session,input,false,async(client,member)=>{
   if(input.history===true){const rows=(await client.query(`SELECT h."sourceConnectionId",h."transferId",h."phoneNumberId",h."wabaId",h."retiredAt",h.generation,h."sourceSnapshot"->>'displayPhoneNumber' AS "displayPhoneNumber" FROM public."WhatsAppAssetRetirement" h WHERE h."sourceOrganizationId"=$1 AND h."sourceProjectId"=$2 ORDER BY h."retiredAt"`,[member.organizationId,input.projectId])).rows;return {available:true,projectId:input.projectId,historical:true,operational:false,items:rows};}
   if(input.transferId||input.operationId){const transferId=input.transferId||receipt(member,input);const row=await readRow(client,member,{...input,transferId});return {...publicReady(row,environment),readiness:readiness(),available:true};}
   const latest=(await client.query(`SELECT * FROM public."WhatsAppAssetTransfer" WHERE "destinationOrganizationId"=$1 AND "destinationProjectId"=$2 AND "actorId"=$3 AND state<>'CLOSED' ORDER BY "createdAt" DESC,id DESC LIMIT 1`,[member.organizationId,input.projectId,member.actorId])).rows[0];
   if(latest)return {...publicReady(latest,environment),readiness:readiness(),available:true};
   const candidates=(await client.query(`SELECT c.id,cc.revision,o.name AS "companyName",p.name AS "projectName",c."displayPhoneNumber" FROM public."WhatsAppConnection" c JOIN public."Project" p ON p.id=c."projectId" JOIN public."Organization" o ON o.id=p."organizationId" JOIN public."TenantMembership" m ON m."organizationId"=o.id JOIN public."WhatsAppCompanyChannel" cc ON cc."connectionId"=c.id WHERE m."userId"=$1 AND m.status='ACTIVE' AND m."tenantRole"='ADMIN' AND m."clerkRole"='org:admin' AND o.id<>$2 AND c."phoneNumberId" IS NOT NULL AND COALESCE(o.metadata->'internal','false'::jsonb)<>'true'::jsonb ORDER BY c."whatsappBusinessId",c.id LIMIT 11`,[member.actorId,member.organizationId])).rows;
   if(candidates.length>10)transferFailure('COMPANY_TRANSFER_SOURCE_LIMIT');const sources=[];
   for(const candidate of candidates){try{await source(client,member,session,candidate.id,input.projectId,false);sources.push(candidate);}catch(error){if(!(error instanceof WorkspaceError)||![403,404,409].includes(error.status))throw error;}}
   const org=(await client.query(`SELECT metadata FROM public."Organization" WHERE id=$1`,[member.organizationId])).rows[0];
   return {available:true,projectId:input.projectId,sources,companyPhoneRevision:companyPhoneContract(org.metadata)?.revision||null,readiness:readiness(),singlePhoneWabaOnly:true,providerMigrated:false};
  });},
  async command(session,body){const input=transferInput(body);
   if(input.action==='PREPARE')return within(session,input,true,async(client,member)=>{
    const launch=readiness();if(launch.canLaunchMeta!==true)transferFailure('COMPANY_TRANSFER_CONFIGURATION_PENDING',503);
    const id=receipt(member,input),previous=(await client.query(`SELECT * FROM public."WhatsAppAssetTransfer" WHERE id=$1 FOR UPDATE`,[id])).rows[0];
    if(previous){if(previous.requestDigest!==transferDigest(input))transferFailure('COMPANY_TRANSFER_OPERATION_CONFLICT');return {...publicReady(previous,environment),readiness:launch};}
    const plan=await source(client,member,session,input.sourceConnectionId,input.projectId,true);if(plan.sourceRevision!==input.sourceRevision||plan.companyPhoneRevision!==input.companyPhoneRevision)transferFailure();
    await noPending(client,plan);
    const active=(await client.query(`SELECT id FROM public."WhatsAppAssetTransfer" WHERE ("sourceConnectionId"=$1 OR "destinationProjectId"=$2) AND state NOT IN ('COMMITTED','CLOSED') FOR UPDATE`,[plan.sourceConnectionId,input.projectId])).rows;if(active.length)transferFailure('COMPANY_TRANSFER_ATTEMPT_PENDING');
    const row=(await client.query(`INSERT INTO public."WhatsAppAssetTransfer"(id,"destinationOrganizationId","destinationProjectId","sourceOrganizationId","sourceProjectId","sourceConnectionId","actorId","requestDigest",plan,state,"expiresAt") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,'PREPARED',clock_timestamp()+interval '10 minutes') RETURNING *`,[id,member.organizationId,input.projectId,plan.sourceOrganizationId,plan.sourceProjectId,plan.sourceConnectionId,member.actorId,transferDigest(input),JSON.stringify(plan)])).rows[0];return {...publicReady(row,environment),readiness:launch};
   });
   if(input.action==='AUTHORIZE'){
    const claim=await within(session,input,true,async(client,member)=>{const row=await readRow(client,member,input,true);if(row.state!=='PREPARED'){if(row.authorizationDigest!==transferDigest(input))transferFailure('COMPANY_TRANSFER_OPERATION_CONFLICT');return {done:publicReady(row,environment)};}const expected=stateToken(row,environment);if(!timingSafeEqual(Buffer.from(expected),Buffer.from(input.stateToken)))transferFailure('COMPANY_TRANSFER_STATE_REJECTED',403);await checked(client,member,session,row);await client.query(`UPDATE public."WhatsAppAssetTransfer" SET state='EXCHANGING',revision=revision+1,"authorizationDigest"=$2 WHERE id=$1`,[row.id,transferDigest(input)]);return row;});if(claim.done)return claim.done;
    let grant;
    try{grant=await provider.exchangeTransferGrant({code:input.code,wabaId:claim.plan.wabaId,phoneNumberId:claim.plan.phoneNumberId});}
    catch(error){await within(session,input,true,async(client,member)=>{const row=await readRow(client,member,input,true);if(row.state==='EXCHANGING')await client.query(`UPDATE public."WhatsAppAssetTransfer" SET state='EXCHANGE_UNKNOWN',revision=revision+1 WHERE id=$1`,[row.id]);}).catch(()=>{});throw new WorkspaceError('COMPANY_TRANSFER_EXCHANGE_UNCONFIRMED',503);}
    return within(session,input,true,async(client,member)=>{const row=await readRow(client,member,input,true);if(row.state!=='EXCHANGING')transferFailure();await checked(client,member,session,row);const clock=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;assertSinglePhoneGrant(grant,row.plan,clock.getTime());const encryptedGrant=encryptCustomerSecret(JSON.stringify(grant),secretContext(row),environment);const saved=(await client.query(`UPDATE public."WhatsAppAssetTransfer" SET state='GRANT_READY',revision=revision+1,"encryptedGrant"=$2,"grantDigest"=$3,"grantVerifiedAt"=$4 WHERE id=$1 RETURNING *`,[row.id,encryptedGrant,transferDigest(grant),new Date(grant.checkedAt)])).rows[0];return publicReady(saved,environment);});
   }
   return within(session,input,true,async(client,member)=>{
    const row=await readRow(client,member,input,true);if(row.state==='COMMITTED'){if(input.action!=='COMMIT'||row.commitDigest!==transferDigest(input))transferFailure('COMPANY_TRANSFER_OPERATION_CONFLICT');return publicReady(row,environment);}
    if(row.state==='CLOSED'){if(input.action!=='CLOSE'||row.closeDigest!==transferDigest(input))transferFailure('COMPANY_TRANSFER_OPERATION_CONFLICT');return publicReady(row,environment);}
    if(row.revision!==input.revision)transferFailure();
    if(input.action==='CLOSE'){if(row.state==='COMMITTING')transferFailure();const closed=(await client.query(`UPDATE public."WhatsAppAssetTransfer" SET state='CLOSED',revision=revision+1,"closeDigest"=$2 WHERE id=$1 RETURNING *`,[row.id,transferDigest(input)])).rows[0];return publicReady(closed,environment);}
    if(row.state!=='GRANT_READY'||!row.encryptedGrant)transferFailure('COMPANY_TRANSFER_FRESH_GRANT_REQUIRED');
    const plan=await checked(client,member,session,row);await noPending(client,plan);
    const grant=JSON.parse(decryptCustomerSecret(row.encryptedGrant,secretContext(row),environment));if(transferDigest(grant)!==row.grantDigest)transferFailure('COMPANY_TRANSFER_GRANT_INTEGRITY');
    const current=await provider.verifyTransferGrant({token:grant.token,wabaId:plan.wabaId,phoneNumberId:plan.phoneNumberId});assertSinglePhoneGrant({...current,origin:grant.origin},plan,(await client.query('SELECT clock_timestamp() AS now')).rows[0].now.getTime());
    await checked(client,member,session,row);
    // Project/credential locks remain held through every provider GET and this
    // cutover. No provider POST/register/delete/unsubscribe exists in this path.
    await noPending(client,plan);const clock=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
    const destinationConnectionId='wa_transfer_'+randomUUID().replaceAll('-','');
    await client.query(`UPDATE public."WhatsAppAssetTransfer" SET state='COMMITTING',"destinationConnectionId"=$2,"grantVerifiedAt"=$3,"commitDigest"=$4 WHERE id=$1`,[row.id,destinationConnectionId,new Date(current.checkedAt),transferDigest(input)]);
    const old=(await client.query(`SELECT to_jsonb(c) AS snapshot FROM public."WhatsAppConnection" c WHERE id=$1 FOR UPDATE`,[plan.sourceConnectionId])).rows[0].snapshot;if(transferDigest(old)!==plan.sourceSnapshot.rowCommitment)transferFailure();const {encryptedAccessToken:oldToken,encryptedPin:oldPin,...historicalSnapshot}=old;void oldToken;void oldPin;const retiredMetadata={...old.metadata,assetRetirement:{version:1,state:'RETIRED',transferId:row.id,generation:plan.generation,retiredAt:clock.toISOString()},customerActivation:{...old.metadata.customerActivation,state:'DEACTIVATED'},...(old.metadata.ownCompanyRuntime?{ownCompanyRuntime:{...old.metadata.ownCompanyRuntime,state:'REVOKED',revocation:{version:1,actorId:member.actorId,receiptId:row.id,revokedAt:clock.toISOString()}}}:{})};
    await client.query(`INSERT INTO public."WhatsAppAssetRetirement"("sourceConnectionId","transferId","wabaId","phoneNumberId",generation,"sourceOrganizationId","sourceProjectId","destinationConnectionId","sourceSnapshot","retiredMetadata","retiredAt") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11)`,[old.id,row.id,plan.wabaId,plan.phoneNumberId,plan.generation,plan.sourceOrganizationId,plan.sourceProjectId,destinationConnectionId,JSON.stringify(historicalSnapshot),JSON.stringify(retiredMetadata),clock]);
    await client.query(`UPDATE public."WhatsAppCompanyChannel" SET mode='SUSPENDED',revision=revision+1,"updatedAt"=clock_timestamp() WHERE "connectionId"=$1 AND revision=$2`,[old.id,plan.sourceRevision]);
    await client.query(`UPDATE public."WhatsAppChannelProjectAssignment" SET status='REVOKED',revision=revision+1,"updatedAt"=clock_timestamp() WHERE "connectionId"=$1 AND status='ACTIVE'`,[old.id]);
    await client.query(`UPDATE public."WhatsAppConnection" SET "phoneNumberId"=NULL,"whatsappBusinessId"=NULL,enabled=false,metadata=$2::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1`,[old.id,JSON.stringify(retiredMetadata)]);
    const encryptedToken=encryptCustomerSecret(grant.token,{organizationId:member.organizationId,projectId:input.projectId,purpose:'access-token',resourceId:plan.phoneNumberId},environment);
    const metadata={credentialFormat:'tenant-aad-v2',credentialOrganizationId:member.organizationId,customerSubscribed:true,customerVerification:current.verification,customerActivation:{version:1,state:'ACTIVE',actorId:member.actorId},declaredCompanyPhone:{e164:plan.displayPhoneNumber,revision:plan.companyPhoneRevision},assetOwnership:{version:1,generation:plan.generation,transferId:row.id},roundTrip:'NOT_VERIFIED',fieldAcceptance:'NOT_VERIFIED',companyRoutingVersion:1};
    await client.query(`INSERT INTO public."WhatsAppConnection"(id,"projectId","phoneNumberId","whatsappBusinessId","displayPhoneNumber",enabled,"connectionStatus","encryptedAccessToken",metadata,"updatedAt") VALUES($1,$2,$3,$4,$5,true,'CONNECTED',$6,$7::jsonb,clock_timestamp())`,[destinationConnectionId,input.projectId,plan.phoneNumberId,plan.wabaId,plan.displayPhoneNumber,encryptedToken,JSON.stringify(metadata)]);
    await client.query(`UPDATE public."WhatsAppCompanyChannel" SET mode='COMPANY',revision=revision+1 WHERE "connectionId"=$1`,[destinationConnectionId]);
     // BEFORE INSERT runs before UPSERT conflict handling. Keep the strict
     // first-owner INSERT separate from an exact previous-owner UPDATE.
     const previousOwner=(await client.query(`SELECT * FROM public."WhatsAppActiveAsset" WHERE "wabaId"=$1 FOR UPDATE`,[plan.wabaId])).rows[0]||null;
     const nextOwner=[plan.wabaId,plan.phoneNumberId,destinationConnectionId,member.organizationId,input.projectId,plan.generation,row.id];let ownership;
     if(previousOwner){
      if(previousOwner.connectionId!==plan.sourceConnectionId||previousOwner.organizationId!==plan.sourceOrganizationId||previousOwner.projectId!==plan.sourceProjectId||previousOwner.phoneNumberId!==plan.phoneNumberId||previousOwner.generation+1!==plan.generation)transferFailure();
      ownership=await client.query(`UPDATE public."WhatsAppActiveAsset" SET "connectionId"=$3,"organizationId"=$4,"projectId"=$5,generation=$6,"transferId"=$7 WHERE "wabaId"=$1 AND "phoneNumberId"=$2 AND "connectionId"=$8 AND "organizationId"=$9 AND "projectId"=$10 AND generation=$11 AND "transferId"=$12`,[...nextOwner,previousOwner.connectionId,previousOwner.organizationId,previousOwner.projectId,previousOwner.generation,previousOwner.transferId]);
     }else{
      if(plan.generation!==1)transferFailure();
      ownership=await client.query(`INSERT INTO public."WhatsAppActiveAsset"("wabaId","phoneNumberId","connectionId","organizationId","projectId",generation,"transferId") VALUES($1,$2,$3,$4,$5,$6,$7)`,nextOwner);
     }
     if(ownership.rowCount!==1)transferFailure();
    for(const organizationId of [plan.sourceOrganizationId,member.organizationId])await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'company.number.transfer.committed','Project',$4,$5::jsonb)`,[row.id+'_'+organizationId,organizationId,member.actorId,organizationId===member.organizationId?input.projectId:plan.sourceProjectId,JSON.stringify({version:1,transferId:row.id,generation:plan.generation,sourceConnectionId:old.id,destinationConnectionId,providerMigrated:false,dataMoved:false})]);
    const saved=(await client.query(`UPDATE public."WhatsAppAssetTransfer" SET state='COMMITTED',revision=revision+1,"committedAt"=$2 WHERE id=$1 RETURNING *`,[row.id,clock])).rows[0];return publicReady(saved,environment);
   });
  }
 };
}
