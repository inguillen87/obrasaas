import {randomUUID} from 'node:crypto';
import {WorkspaceError,digest,workspaceId,operationId} from './workspace-policy.mjs';
import {companyWhatsappOnboardingEntitlement} from './company-entitlement.mjs';
import {approvedSubscriptionConfiguration,subscriptionConfigurationDigest,subscriptionContractDigest,subscriptionCommand,subscriptionAttemptId,subscriptionRequestDigest,subscriptionExternalReference,subscriptionOpenStates,subscriptionInstant,verifiedSubscriptionObservation,publicSubscriptionAttempt,subscriptionRecord} from './company-subscription-policy.mjs';
import {approvedCommercialCatalog,defaultCommercialCatalog,commercialContractDigest,commercialOfferSnapshot,commercialOfferDigest,commercialOfferReady,commercialAuthority,commercialActorBinding,commercialAcceptanceId,commercialAcceptanceDigest,commercialOfferMatchesFinancial,COMMERCIAL_OFFER_FIELDS} from './company-subscription-catalog.mjs';

const action='company.subscription.attempt';
const closureAction='company.subscription.operation.closed';
const acceptanceAction='company.subscription.offer.accepted';
const fail=(code,status=409)=>{throw new WorkspaceError(code,status);};
const fixedCode=error=>error instanceof WorkspaceError&&/^(COMPANY_SUBSCRIPTION|BILLING)_[A-Z_]+$/.test(error.code)?error.code:'COMPANY_SUBSCRIPTION_PROVIDER_UNOBSERVED';
const companySql=`SELECT id,name,metadata,"subscriptionPlan"::text AS "subscriptionPlan","subscriptionStatus"::text AS "subscriptionStatus","trialEndsAt" AT TIME ZONE 'UTC' AS "trialEndsAt",clock_timestamp() AS "observedAt" FROM public."Organization" WHERE id=$1`;

// Organization + AuditLog are the existing canonical customer and durable
// journal. Organization FOR UPDATE serializes all company attempts; global
// advisory resource/payment locks also prevent adoption across companies.
export function createCompanySubscription({workspace,provider,configuration=()=>null,commercialCatalog=defaultCommercialCatalog,verifiedPayer=null,connect=null}={}){
  if(typeof workspace?.companyOperation!=='function'||typeof configuration!=='function'||typeof commercialCatalog!=='function')throw new TypeError('Canonical company transaction required');
  const observations=new WeakSet();
  function currentCommercial(){try{return approvedCommercialCatalog(commercialCatalog());}catch{return approvedCommercialCatalog(defaultCommercialCatalog());}}
  const acceptanceRequestDigest=(value,binding)=>commercialContractDigest(['company-subscription-accept-offer-command-v1',binding,{operationId:value.operationId,offerId:value.offerId,catalogVersion:value.catalogVersion,catalogDigest:value.catalogDigest,offerDigest:value.offerDigest,termsVersion:value.termsVersion,termsSha256:value.termsSha256,accepted:true}]);
  function acceptanceRecord(row,organizationId){
    if(!row)return null;const a=row.metadata;
    try{
      const fields=['version','id','organizationId','actorId','membershipId','authority','actorBinding','operationId','requestDigest','state','accepted','catalogVersion','catalogDigest','offer','acceptedAt','acceptanceDigest'];
      if(!subscriptionRecord(a)||Object.keys(a).sort().join('|')!==fields.sort().join('|')||a.version!==1||a.id!==row.id||row.organizationId!==organizationId||a.organizationId!==organizationId||row.entityId!==organizationId||row.actorId!==a.actorId||!operationId(a.operationId)||a.id!==commercialAcceptanceId(organizationId,a.operationId)||a.state!=='TERMS_ACCEPTED'||a.accepted!==true||!subscriptionInstant(a.acceptedAt)||!['requestDigest','actorBinding','catalogDigest','acceptanceDigest'].every(key=>/^[a-f0-9]{64}$/.test(a[key]||''))||typeof a.catalogVersion!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,254}$/.test(a.catalogVersion)||!subscriptionRecord(a.authority)||!subscriptionRecord(a.offer))throw Error();
      if(Object.keys(a.offer).sort().join('|')!==[...COMMERCIAL_OFFER_FIELDS,'offerDigest'].sort().join('|')||!commercialOfferReady(commercialOfferSnapshot(a.offer))||a.offer.offerDigest!==commercialOfferDigest(a.offer))throw Error();
      const authority=commercialAuthority({authenticated:true,verification:a.authority.verification,userId:a.authority.clerkUserId,organizationId:a.authority.clerkOrganizationId,organizationRole:a.authority.clerkRole},{actorId:a.actorId,membershipId:a.membershipId,organizationId:a.organizationId,role:a.authority.tenantRole});
      if(commercialContractDigest(authority)!==commercialContractDigest(a.authority)||commercialActorBinding(authority)!==a.actorBinding||commercialAcceptanceDigest(a)!==a.acceptanceDigest)throw Error();
      if(a.requestDigest!==acceptanceRequestDigest({operationId:a.operationId,offerId:a.offer.id,catalogVersion:a.catalogVersion,catalogDigest:a.catalogDigest,offerDigest:a.offer.offerDigest,termsVersion:a.offer.termsVersion,termsSha256:a.offer.termsSha256},a.actorBinding))throw Error();
      return a;
    }catch{fail('COMPANY_SUBSCRIPTION_ACCEPTANCE_INTEGRITY',503);}
  }
  async function acceptance(client,organizationId,id){
    const rows=(await client.query(`SELECT id,"entityId",metadata,"actorId","organizationId" FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND action=$3 AND "entityType"='Organization'`,[id,organizationId,acceptanceAction])).rows;
    if(rows.length>1)fail('COMPANY_SUBSCRIPTION_ACCEPTANCE_INTEGRITY',503);return acceptanceRecord(rows[0],organizationId);
  }
  async function latestAcceptance(client,member){
    const rows=(await client.query(`SELECT id,"entityId",metadata,"actorId","organizationId" FROM public."AuditLog" WHERE "organizationId"=$1 AND action=$2 AND "entityType"='Organization' AND "actorId"=$3 ORDER BY "createdAt" DESC,id DESC LIMIT 1`,[member.organizationId,acceptanceAction,member.actorId])).rows;
    const row=rows.find(row=>row.actorId===member.actorId);return acceptanceRecord(row,member.organizationId);
  }
  function acceptedCurrent(a,catalog,binding){return Boolean(a&&a.actorBinding===binding&&a.catalogVersion===catalog.catalogVersion&&a.catalogDigest===catalog.catalogDigest&&catalog.offers.some(offer=>offer.id===a.offer.id&&offer.offerDigest===a.offer.offerDigest&&commercialOfferReady(offer)));}
  function financialOfferMatches(offer,catalog,ready=currentConfiguration()){return Boolean(ready&&ready.config.catalogVersion===catalog.catalogVersion&&ready.config.offers.some(financial=>commercialOfferMatchesFinancial(offer,financial)));}
  async function requireAcceptance(client,session,member,command){
    const a=await acceptance(client,member.organizationId,command.acceptanceReceiptId);if(!a)fail('COMPANY_SUBSCRIPTION_ACCEPTANCE_REQUIRED');
    // Read the independent commercial catalog after the receipt SQL completes.
    // Terms may change while the final beforeExternal fence awaits that query.
    const catalog=currentCommercial();
    const binding=commercialActorBinding(commercialAuthority(session,member));
    if(a.actorId!==member.actorId||a.membershipId!==member.membershipId||a.actorBinding!==binding)fail('COMPANY_SUBSCRIPTION_ACCEPTANCE_AUTHORITY_CHANGED',403);
    if(a.acceptanceDigest!==command.acceptanceDigest||a.offer.id!==command.offerId||a.catalogVersion!==command.catalogVersion||!acceptedCurrent(a,catalog,binding)||!financialOfferMatches(a.offer,catalog)||a.operationId===command.operationId)fail('COMPANY_SUBSCRIPTION_ACCEPTANCE_BINDING_REJECTED');
    return a;
  }
  async function validateFinancialAcceptance(client,a){
    if(a.version===1)return;
    const accepted=await acceptance(client,a.organizationId,a.acceptanceReceiptId);
    if(!accepted||accepted.acceptanceDigest!==a.acceptanceDigest||accepted.actorId!==a.actorId||accepted.membershipId!==a.membershipId||accepted.catalogVersion!==a.catalogVersion||!commercialOfferMatchesFinancial(accepted.offer,a.offer)||accepted.operationId===a.operationId)fail('COMPANY_SUBSCRIPTION_ACCEPTANCE_INTEGRITY',503);
  }
  function currentConfiguration(){
    let config;try{config=approvedSubscriptionConfiguration(configuration());}catch{return null;}
    if(!config)return null;
    let ready;try{ready=provider?.readiness?.();}catch{return null;}
    if(ready?.available!==true||ready.provider!==config.provider||ready.merchantId!==config.merchantId||ready.accountMode!==config.accountMode||typeof ready.checkoutHost!=='string'||!ready.checkoutHost||typeof provider.createCheckout!=='function'||typeof provider.inspectSubscription!=='function'||typeof verifiedPayer!=='function')return null;
    return {config,checkoutHost:ready.checkoutHost};
  }
  function requireConfiguration(attempt=null,strict=false){
    const current=currentConfiguration();if(!current)fail('COMPANY_SUBSCRIPTION_CONFIGURATION_PENDING',503);
    if(attempt&&(attempt.provider!==current.config.provider||attempt.merchantId!==current.config.merchantId||attempt.accountMode!==current.config.accountMode||strict&&attempt.configurationDigest!==subscriptionConfigurationDigest(current.config)))fail('COMPANY_SUBSCRIPTION_CONFIGURATION_CHANGED');
    return current;
  }
  async function company(client,organizationId){
    const rows=(await client.query(companySql,[organizationId])).rows;
    if(rows.length!==1||rows[0].id!==organizationId||!subscriptionInstant(rows[0].observedAt)||!['TRIAL','PRO','ENTERPRISE'].includes(rows[0].subscriptionPlan)||!['TRIALING','ACTIVE','PAST_DUE','CANCELED','SUSPENDED'].includes(rows[0].subscriptionStatus))fail('COMPANY_SUBSCRIPTION_UNOBSERVED',503);
    return rows[0];
  }
  function attemptRecord(row,organizationId){
    if(!row)return null;const a=row.metadata;
    if(!subscriptionRecord(a)||![1,2].includes(a.version)||a.id!==row.id||a.organizationId!==organizationId||row.entityId!==organizationId||!operationId(a.operationId)||a.id!==subscriptionAttemptId(organizationId,a.operationId)||!workspaceId(a.actorId)||!subscriptionRecord(a.offer)||!subscriptionInstant(a.createdAt)||!Number.isSafeInteger(a.revision)||a.revision<1||typeof a.configurationDigest!=='string'||a.version===2&&(!/^company_subscription_offer_acceptance_[a-f0-9]{64}$/.test(a.acceptanceReceiptId||'')||!/^[a-f0-9]{64}$/.test(a.acceptanceDigest||'')))fail('COMPANY_SUBSCRIPTION_INTEGRITY',503);
    if(!['DISPATCHING','UNKNOWN','CHECKOUT_READY','AUTHORIZED','ACTIVE','PAST_DUE','CANCELED','SUSPENDED','CANCEL_REQUESTED','CANCEL_CONFIRMED'].includes(a.state)||!approvedSubscriptionConfiguration({version:1,provider:a.provider,merchantId:a.merchantId,accountMode:a.accountMode,catalogVersion:a.catalogVersion,offers:[a.offer]}))fail('COMPANY_SUBSCRIPTION_INTEGRITY',503);
    return a;
  }
  async function attempt(client,organizationId,id){
    const rows=(await client.query(`SELECT id,"entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND action=$3 AND "entityType"='Organization'`,[id,organizationId,action])).rows;
    if(rows.length>1)fail('COMPANY_SUBSCRIPTION_INTEGRITY',503);const a=attemptRecord(rows[0],organizationId);if(a)await validateFinancialAcceptance(client,a);return a;
  }
  async function attempts(client,organizationId){
    const rows=(await client.query(`SELECT id,"entityId",metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND action=$2 AND "entityType"='Organization' ORDER BY "createdAt" DESC,id DESC LIMIT 101`,[organizationId,action])).rows;
    if(rows.length>100)fail('COMPANY_SUBSCRIPTION_HISTORY_REVIEW_REQUIRED',503);const values=rows.map(row=>attemptRecord(row,organizationId));for(const a of values)await validateFinancialAcceptance(client,a);return values;
  }
  async function operationAttempt(client,organizationId,id){
    const direct=await attempt(client,organizationId,subscriptionAttemptId(organizationId,id));if(direct)return direct;
    const found=(await attempts(client,organizationId)).filter(a=>a.cancellation?.operationId===id.toLowerCase());if(found.length>1)fail('COMPANY_SUBSCRIPTION_INTEGRITY',503);return found[0]||null;
  }
  async function operationClosure(client,organizationId,id){
    const key=subscriptionAttemptId(organizationId,id),rows=(await client.query(`SELECT id,"entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND action=$3 AND "entityType"='Organization'`,[key,organizationId,closureAction])).rows;
    if(rows.length>1)fail('COMPANY_SUBSCRIPTION_INTEGRITY',503);const row=rows[0];if(!row)return null;
    const m=row.metadata;
    if(row.id!==key||row.entityId!==organizationId||!subscriptionRecord(m)||m.version!==1||m.organizationId!==organizationId||m.operationId!==id.toLowerCase()||m.state!=='NO_DISPATCH'||!subscriptionInstant(m.closedAt))fail('COMPANY_SUBSCRIPTION_INTEGRITY',503);
    return {operationId:m.operationId,state:'NO_DISPATCH'};
  }
  async function save(client,a){
    await client.query(`UPDATE public."AuditLog" SET metadata=$2::jsonb WHERE id=$1 AND "organizationId"=$3 AND action=$4`,[a.id,JSON.stringify(a),a.organizationId,action]);
  }
  async function transition(client,a,kind,details={}){
    const id='company_subscription_transition_'+digest([a.id,a.revision,kind]);
    await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'company.subscription.transition','Organization',$2,$4::jsonb) ON CONFLICT(id) DO NOTHING`,[id,a.organizationId,a.actorId,JSON.stringify({version:1,attemptId:a.id,revision:a.revision,kind,...details})]);
  }
  const within=(session,context,writable,callback)=>workspace.companyOperation(session,{scope:context.scope},writable,callback);
  async function envelope(client,session,member,companyRow,scope,a,recovery=null,selectedAcceptance=undefined){
    const current=currentConfiguration(),catalog=currentCommercial(),binding=commercialActorBinding(commercialAuthority(session,member)),accepted=selectedAcceptance===undefined?await latestAcceptance(client,member):selectedAcceptance;
    if(accepted&&accepted.actorId!==member.actorId)fail('COMPANY_SUBSCRIPTION_ACCEPTANCE_AUTHORITY_CHANGED',403);
    const isCurrent=acceptedCurrent(accepted,catalog,binding),canCheckout=isCurrent&&financialOfferMatches(accepted.offer,catalog,current);
    const publicAcceptance=accepted?{version:1,receiptId:accepted.id,operationId:accepted.operationId,state:accepted.state,organizationId:accepted.organizationId,actorBinding:accepted.actorBinding,catalogVersion:accepted.catalogVersion,catalogDigest:accepted.catalogDigest,offer:{...accepted.offer},acceptedAt:accepted.acceptedAt,acceptanceDigest:accepted.acceptanceDigest,current:isCurrent,canCheckout}:null;
    return {version:2,scope,organization:{id:companyRow.id,name:companyRow.name},observedAt:subscriptionInstant(companyRow.observedAt),configuration:{state:current?'READY':'CONFIGURATION_PENDING',catalogVersion:current?.config.catalogVersion||null,offers:current?.config.offers.map(offer=>({...offer}))||[]},commercial:{version:1,state:catalog.state,catalogVersion:catalog.catalogVersion,catalogDigest:catalog.catalogDigest,actorBinding:binding,offers:catalog.offers.map(offer=>({...offer,canAccept:commercialOfferReady(offer),checkoutAvailable:commercialOfferReady(offer)&&financialOfferMatches(offer,catalog,current)}))},acceptance:publicAcceptance,subscription:{plan:companyRow.subscriptionPlan,status:companyRow.subscriptionStatus,trialEndsAt:subscriptionInstant(companyRow.trialEndsAt),entitlement:companyWhatsappOnboardingEntitlement(companyRow,{now:companyRow.observedAt})},attempt:a?publicSubscriptionAttempt(a):null,recovery};
  }
  async function read(session,context){
    if(!subscriptionRecord(context)||Object.keys(context).some(key=>!['scope','operationId','acceptanceOperationId'].includes(key))||context.operationId!==undefined&&!operationId(context.operationId)||context.acceptanceOperationId!==undefined&&!operationId(context.acceptanceOperationId)||context.operationId!==undefined&&context.acceptanceOperationId!==undefined)fail('COMPANY_SUBSCRIPTION_INPUT_INVALID',400);
    return within(session,context,false,async(client,member,scope)=>{
      const row=await company(client,member.organizationId),a=context.operationId?await operationAttempt(client,member.organizationId,context.operationId):(await attempts(client,member.organizationId))[0]||null,accepted=context.acceptanceOperationId?await acceptance(client,member.organizationId,commercialAcceptanceId(member.organizationId,context.acceptanceOperationId)):undefined;
      return envelope(client,session,member,row,scope,a,context.operationId&&!a?await operationClosure(client,member.organizationId,context.operationId):null,accepted);
    });
  }
  async function acceptOffer(session,input){
    const command=subscriptionCommand(input,'accept_offer');
    return within(session,command,true,async(client,member,scope)=>{
      const row=await company(client,member.organizationId),authority=commercialAuthority(session,member),actorBinding=commercialActorBinding(authority),id=commercialAcceptanceId(member.organizationId,command.operationId),requestDigest=acceptanceRequestDigest(command,actorBinding),previous=await acceptance(client,member.organizationId,id);
      if(previous){if(previous.actorBinding!==actorBinding)fail('COMPANY_SUBSCRIPTION_ACCEPTANCE_AUTHORITY_CHANGED',403);if(previous.requestDigest!==requestDigest)fail('COMPANY_SUBSCRIPTION_OPERATION_CONFLICT');return envelope(client,session,member,row,scope,(await attempts(client,member.organizationId))[0]||null,null,previous);}
      const catalog=currentCommercial();if(command.catalogVersion!==catalog.catalogVersion||command.catalogDigest!==catalog.catalogDigest)fail('COMPANY_SUBSCRIPTION_CATALOG_CHANGED');
      const offer=catalog.offers.find(offer=>offer.id===command.offerId);if(!offer)fail('COMPANY_SUBSCRIPTION_OFFER_UNAVAILABLE',400);if(!commercialOfferReady(offer))fail('COMPANY_SUBSCRIPTION_TERMS_PENDING');
      if(command.offerDigest!==offer.offerDigest||command.termsVersion!==offer.termsVersion||command.termsSha256!==offer.termsSha256)fail('COMPANY_SUBSCRIPTION_ACCEPTANCE_BINDING_REJECTED');
      // The catalog version is global and immutable, including across companies.
      // The company lock already owns the receipt UUID; this independent lock
      // prevents two server catalogs reusing a version with different bytes.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['company-subscription-commercial-catalog:'+catalog.catalogVersion]);
      const priorCatalogs=(await client.query(`SELECT DISTINCT metadata->>'catalogDigest' AS "catalogDigest" FROM public."AuditLog" WHERE action=$1 AND metadata->>'catalogVersion'=$2 LIMIT 2`,[acceptanceAction,catalog.catalogVersion])).rows;
      if(priorCatalogs.some(prior=>prior.catalogDigest!==catalog.catalogDigest))fail('COMPANY_SUBSCRIPTION_CATALOG_CHANGED');
      const accepted={version:1,id,organizationId:member.organizationId,actorId:member.actorId,membershipId:member.membershipId,authority,actorBinding,operationId:command.operationId,requestDigest,state:'TERMS_ACCEPTED',accepted:true,catalogVersion:catalog.catalogVersion,catalogDigest:catalog.catalogDigest,offer:{...offer},acceptedAt:subscriptionInstant(row.observedAt)};accepted.acceptanceDigest=commercialAcceptanceDigest(accepted);
      await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,$4,'Organization',$2,$5::jsonb)`,[id,member.organizationId,member.actorId,acceptanceAction,JSON.stringify(accepted)]);
      return envelope(client,session,member,row,scope,(await attempts(client,member.organizationId))[0]||null,null,accepted);
    });
  }
  function providerContext(a,extra={}){
    return {attemptId:a.id,operationId:a.operationId,organizationId:a.organizationId,offer:{...a.offer,catalogVersion:a.catalogVersion},merchantId:a.merchantId,accountMode:a.accountMode,provider:a.provider,idempotencyKey:a.id,externalReference:subscriptionExternalReference(a.organizationId,a.id),resourceId:a.resourceId,providerSubscriptionId:a.resourceId,...extra};
  }
  async function fenced(session,context,id,leaseId,strict=false){
    let acceptanceFence;
    const a=await within(session,context,true,async(client,member)=>{
      const a=await attempt(client,member.organizationId,id);if(!a||a.lease?.id!==leaseId)fail('COMPANY_SUBSCRIPTION_STATE_CHANGED');
      requireConfiguration(a,strict);const row=await company(client,member.organizationId);
      if(strict&&a.version===2){const accepted=await requireAcceptance(client,session,member,{scope:context.scope,operationId:a.operationId,offerId:a.offer.id,catalogVersion:a.catalogVersion,acceptanceReceiptId:a.acceptanceReceiptId,acceptanceDigest:a.acceptanceDigest});acceptanceFence={accepted,binding:commercialActorBinding(commercialAuthority(session,member))};}
      if(Date.parse(a.lease.expiresAt)<=row.observedAt.getTime())fail('COMPANY_SUBSCRIPTION_STATE_CHANGED');return a;
    });
    if(acceptanceFence){
      // The canonical transaction also awaits COMMIT after its callback. Keep
      // independent terms/configuration current through that final SQL await.
      requireConfiguration(a,true);const catalog=currentCommercial();
      if(!acceptedCurrent(acceptanceFence.accepted,catalog,acceptanceFence.binding)||!financialOfferMatches(acceptanceFence.accepted.offer,catalog))fail('COMPANY_SUBSCRIPTION_ACCEPTANCE_BINDING_REJECTED');
    }
    return a;
  }
  async function retainUnconfirmedReference(a,leaseId,candidateResourceId,error){
    if(typeof connect!=='function'||typeof candidateResourceId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,254}$/.test(candidateResourceId))return;
    let client,broken=false;
    try{
      client=await connect();await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');await client.query("SET LOCAL statement_timeout = '6000ms'");await client.query("SET LOCAL lock_timeout = '2500ms'");
      await client.query(`SELECT id FROM public."Organization" WHERE id=$1 FOR UPDATE`,[a.organizationId]);
      const current=await attempt(client,a.organizationId,a.id);
      // A returned, fully bound remote ID must survive revocation of the
      // initiating administrator. This passive journal write cannot grant a
      // plan, alter access, make another charge or use client-supplied facts.
      if(current?.lease?.id===leaseId&&current.lease.kind==='CREATE'&&current.configurationDigest===a.configurationDigest&&current.requestDigest===a.requestDigest&&current.resourceId===null){
        await bindResource(client,current,{resourceId:candidateResourceId});
        current.resourceId=candidateResourceId;current.state='UNKNOWN';current.code=fixedCode(error);current.lease=null;current.revision++;await save(client,current);await transition(client,current,'REMOTE_REFERENCE_RETAINED',{code:current.code});
      }
      await client.query('COMMIT');
    }catch{if(client)try{await client.query('ROLLBACK');}catch{broken=true;}}finally{client?.release(broken);}
  }
  async function unknown(session,context,id,leaseId,error,candidateResourceId=null){
    await within(session,context,true,async(client,member)=>{
      const a=await attempt(client,member.organizationId,id);if(!a||a.lease?.id!==leaseId)return;
      a.state='UNKNOWN';a.code=fixedCode(error);a.lease=null;if(a.cancellation&&a.cancellation.state!=='CONFIRMED')a.cancellation.state='UNKNOWN';
      if(a.resourceId===null&&typeof candidateResourceId==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,254}$/.test(candidateResourceId)){
        try{await bindResource(client,a,{resourceId:candidateResourceId});a.resourceId=candidateResourceId;}catch(bindingError){if(!(bindingError instanceof WorkspaceError)||bindingError.code!=='COMPANY_SUBSCRIPTION_RESOURCE_ALREADY_BOUND')throw bindingError;}
      }
      a.revision++;await save(client,a);await transition(client,a,'RESULT_UNCONFIRMED',{code:a.code});
    });
    return read(session,{scope:context.scope,operationId:context.operationId});
  }
  async function bindResource(client,a,observation){
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['company-subscription-resource:'+digest([a.provider,a.merchantId,a.accountMode,observation.resourceId])]);
    const foreign=(await client.query(`SELECT id,"organizationId" FROM public."AuditLog" WHERE action=$1 AND metadata->>'provider'=$2 AND metadata->>'merchantId'=$3 AND metadata->>'accountMode'=$4 AND metadata->>'resourceId'=$5 AND id<>$6 LIMIT 1`,[action,a.provider,a.merchantId,a.accountMode,observation.resourceId,a.id])).rows;
    if(foreign.length)fail('COMPANY_SUBSCRIPTION_RESOURCE_ALREADY_BOUND');
  }
  async function applyObservation(client,a,row,observation,{cancel=false}={}){
    if(!observations.has(observation))fail('COMPANY_SUBSCRIPTION_PROVIDER_PROOF_REQUIRED',403);
    await bindResource(client,a,observation);
    if(a.observedAt&&Date.parse(observation.observedAt)<Date.parse(a.observedAt))fail('COMPANY_SUBSCRIPTION_PROVIDER_STALE');
    const p=observation.payment,previousPeriod=a.paidPeriod;
    let receiptId=null;
    if(p?.status==='APPROVED'){
      receiptId='company_subscription_payment_'+digest([a.provider,a.merchantId,a.accountMode,p.id]);
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[receiptId]);
      const receipts=(await client.query(`SELECT id,"organizationId",metadata FROM public."AuditLog" WHERE id=$1`,[receiptId])).rows;
      const receipt={version:1,attemptId:a.id,provider:a.provider,merchantId:a.merchantId,accountMode:a.accountMode,resourceId:observation.resourceId,paymentId:p.id,invoiceId:p.invoiceId,offerId:a.offer.id,catalogVersion:a.catalogVersion,amountMinor:p.amountMinor,currency:p.currency,paidAt:p.paidAt,period:{startsAt:observation.periodStartsAt,endsAt:observation.periodEndsAt}};
      if(receipts.length&&(receipts[0].organizationId!==a.organizationId||subscriptionContractDigest(receipts[0].metadata)!==subscriptionContractDigest(receipt)))fail('COMPANY_SUBSCRIPTION_PAYMENT_ALREADY_BOUND');
      if(!receipts.length)await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'company.subscription.payment.verified','Organization',$2,$4::jsonb)`,[receiptId,a.organizationId,a.actorId,JSON.stringify(receipt)]);
    }
    a.resourceId=observation.resourceId;a.checkoutUrl=observation.checkoutUrl||a.checkoutUrl;a.observedAt=observation.observedAt;a.lease=null;a.code=null;
    a.state=observation.status==='PENDING'?a.checkoutUrl?'CHECKOUT_READY':'UNKNOWN':observation.status;
    if(a.state==='UNKNOWN')a.code='COMPANY_SUBSCRIPTION_CHECKOUT_UNOBSERVED';
    a.cancelAtPeriodEnd=observation.cancelAtPeriodEnd||observation.status==='CANCELED';
    if(a.cancellation&&observation.status==='CANCELED')a.cancellation.state='CONFIRMED';
    const managed=row.metadata?.companySubscription;
    const newest=(!previousPeriod||observation.periodEndsAt&&Date.parse(observation.periodEndsAt)>=Date.parse(previousPeriod.endsAt))&&(!managed?.paidPeriod||observation.periodEndsAt&&(Date.parse(observation.periodEndsAt)>Date.parse(managed.paidPeriod.endsAt)||managed.attemptId===a.id&&Date.parse(observation.periodEndsAt)===Date.parse(managed.paidPeriod.endsAt)));
    if(observation.paidCovered&&receiptId&&newest){
      a.receiptId=receiptId;a.paidPeriod={startsAt:observation.periodStartsAt,endsAt:observation.periodEndsAt};a.state=a.cancelAtPeriodEnd?'CANCEL_CONFIRMED':'ACTIVE';
      const next={version:1,attemptId:a.id,receiptId,providerResourceId:a.resourceId,paidPeriod:a.paidPeriod,cancelAtPeriodEnd:a.cancelAtPeriodEnd};
      await client.query(`UPDATE public."Organization" SET "subscriptionPlan"=$2::"SubscriptionPlan","subscriptionStatus"='ACTIVE',metadata=jsonb_set(COALESCE(metadata,'{}'::jsonb),'{companySubscription}',$3::jsonb,true),"updatedAt"=clock_timestamp() WHERE id=$1`,[a.organizationId,a.offer.plan,JSON.stringify(next)]);
    }else if(managed?.attemptId===a.id){
      // Receipt IDs are opaque, so compare the attempted receipt's provider
      // payment binding rather than infer a refund from a notification string.
      const matchingRevocation=['REFUNDED','CHARGEBACK'].includes(p?.status)&&managed.receiptId==='company_subscription_payment_'+digest([a.provider,a.merchantId,a.accountMode,p.id]);
      const expired=Date.parse(managed.paidPeriod?.endsAt||'')<=row.observedAt.getTime();
      if(matchingRevocation||observation.status==='SUSPENDED'||expired){
        await client.query(`UPDATE public."Organization" SET "subscriptionStatus"=$2::"SubscriptionStatus","updatedAt"=clock_timestamp() WHERE id=$1`,[a.organizationId,matchingRevocation||observation.status==='SUSPENDED'?'SUSPENDED':observation.status==='CANCELED'?'CANCELED':'PAST_DUE']);
      }else if(observation.status==='CANCELED'&&previousPeriod){
        a.state='CANCEL_CONFIRMED';a.cancelAtPeriodEnd=true;
        await client.query(`UPDATE public."Organization" SET metadata=jsonb_set(COALESCE(metadata,'{}'::jsonb),'{companySubscription,cancelAtPeriodEnd}','true'::jsonb,true),"updatedAt"=clock_timestamp() WHERE id=$1`,[a.organizationId]);
      }
    }
    a.revision++;await save(client,a);await transition(client,a,'PROVIDER_OBSERVED',{status:observation.status,receiptId,paidCovered:observation.paidCovered,cancelAtPeriodEnd:a.cancelAtPeriodEnd});
  }
  async function finish(session,context,id,leaseId,raw,cancel=false){
    return within(session,context,true,async(client,member,scope)=>{
      const a=await attempt(client,member.organizationId,id);if(!a||a.lease?.id!==leaseId)fail('COMPANY_SUBSCRIPTION_STATE_CHANGED');
      const ready=requireConfiguration(a),row=await company(client,member.organizationId);
      const observation=verifiedSubscriptionObservation(raw,a,{checkoutHost:ready.checkoutHost,observedAt:row.observedAt});observations.add(observation);
      if(cancel&&observation.status!=='CANCELED')fail('COMPANY_SUBSCRIPTION_CANCELLATION_UNCONFIRMED');
      await applyObservation(client,a,row,observation,{cancel});return envelope(client,session,member,await company(client,member.organizationId),scope,a);
    });
  }
  async function begin(session,input){
    const command=subscriptionCommand(input,'begin');
    requireConfiguration();
    // Validate the current accepting administrator before any payer/provider IO,
    // then repeat the check in the writable reservation and CREATE fences.
    await within(session,command,false,async(client,member)=>{if(await operationClosure(client,member.organizationId,command.operationId))fail('COMPANY_SUBSCRIPTION_OPERATION_CLOSED');const previous=await attempt(client,member.organizationId,subscriptionAttemptId(member.organizationId,command.operationId));if(previous&&(previous.requestDigest!==subscriptionRequestDigest(command)||previous.actorId!==member.actorId))fail('COMPANY_SUBSCRIPTION_OPERATION_CONFLICT');await requireAcceptance(client,session,member,command);});
    const payer=await verifiedPayer(session);
    if(!payer||payer.verified!==true||typeof payer.email!=='string'||payer.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payer.email))fail('COMPANY_SUBSCRIPTION_PAYER_UNVERIFIED',403);
    const claim=await within(session,command,true,async(client,member,scope)=>{
      const ready=requireConfiguration(),row=await company(client,member.organizationId),id=subscriptionAttemptId(member.organizationId,command.operationId),requestDigest=subscriptionRequestDigest(command);
      if(await operationClosure(client,member.organizationId,command.operationId))fail('COMPANY_SUBSCRIPTION_OPERATION_CLOSED');
      const previous=await attempt(client,member.organizationId,id);
      if(previous){if(previous.requestDigest!==requestDigest||previous.actorId!==member.actorId)fail('COMPANY_SUBSCRIPTION_OPERATION_CONFLICT');return {replay:await envelope(client,session,member,row,scope,previous)};}
      if(command.catalogVersion!==ready.config.catalogVersion)fail('COMPANY_SUBSCRIPTION_CATALOG_CHANGED');
      const offer=ready.config.offers.find(o=>o.id===command.offerId);if(!offer)fail('COMPANY_SUBSCRIPTION_OFFER_UNAVAILABLE',400);
      const accepted=await requireAcceptance(client,session,member,command);
      const existing=(await attempts(client,member.organizationId)).find(a=>subscriptionOpenStates.has(a.state)&&!(a.state==='CANCEL_CONFIRMED'&&Date.parse(a.paidPeriod?.endsAt||'')<=row.observedAt.getTime()));
      if(existing)fail('COMPANY_SUBSCRIPTION_ATTEMPT_ALREADY_ACTIVE');
      const a={version:2,id,organizationId:member.organizationId,actorId:member.actorId,membershipId:member.membershipId,operationId:command.operationId,requestDigest,acceptanceReceiptId:accepted.id,acceptanceDigest:accepted.acceptanceDigest,configurationDigest:subscriptionConfigurationDigest(ready.config),provider:ready.config.provider,merchantId:ready.config.merchantId,accountMode:ready.config.accountMode,catalogVersion:ready.config.catalogVersion,offer:{...offer},initialSubscription:{plan:row.subscriptionPlan,status:row.subscriptionStatus,trialEndsAt:subscriptionInstant(row.trialEndsAt)},createdAt:subscriptionInstant(row.observedAt),revision:1,state:'DISPATCHING',resourceId:null,checkoutUrl:null,receiptId:null,paidPeriod:null,cancelAtPeriodEnd:false,code:null,lease:{id:randomUUID(),expiresAt:new Date(row.observedAt.getTime()+60000).toISOString(),kind:'CREATE'}};
      await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,$4,'Organization',$2,$5::jsonb)`,[id,a.organizationId,a.actorId,action,JSON.stringify(a)]);
      await transition(client,a,'CHECKOUT_RESERVED');return {a};
    });
    if(claim.replay)return claim.replay;
    const {a}=claim;
    let raw;
    try{
      await fenced(session,command,a.id,a.lease.id,true);
      raw=await provider.createCheckout(providerContext(a,{payerEmail:payer.email,payerEmailVerified:true,beforeExternal:()=>fenced(session,command,a.id,a.lease.id,true)}));
      return await finish(session,command,a.id,a.lease.id,raw);
    }catch(error){
      let candidateResourceId=raw?.state==='UNKNOWN'?raw.resourceId:null;
      if(raw&&raw.state!=='UNKNOWN')try{const ready=requireConfiguration(a);candidateResourceId=verifiedSubscriptionObservation(raw,a,{checkoutHost:ready.checkoutHost,observedAt:raw.observedAt}).resourceId;}catch{/* A mismatched response never becomes a recovery reference. */}
      try{return await unknown(session,command,a.id,a.lease.id,error,candidateResourceId);}catch(persistenceError){await retainUnconfirmedReference(a,a.lease.id,candidateResourceId,error);throw persistenceError;}
    }
  }
  async function recover(session,input){
    const command=subscriptionCommand(input,'recover');
    const claim=await within(session,command,true,async(client,member,scope)=>{
      const row=await company(client,member.organizationId),a=await operationAttempt(client,member.organizationId,command.operationId);
      if(!a){
        let recovery=await operationClosure(client,member.organizationId,command.operationId);
        if(!recovery){
          // Reserve the same PK a delayed begin would need, under the same
          // Organization lock. A read returning no attempt alone is not proof
          // that an original request cannot still arrive after reconciliation.
          const id=subscriptionAttemptId(member.organizationId,command.operationId),metadata={version:1,organizationId:member.organizationId,operationId:command.operationId,state:'NO_DISPATCH',closedAt:subscriptionInstant(row.observedAt)};
          await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,$4,'Organization',$2,$5::jsonb)`,[id,member.organizationId,member.actorId,closureAction,JSON.stringify(metadata)]);
          recovery={operationId:command.operationId,state:'NO_DISPATCH'};
        }
        return {replay:await envelope(client,session,member,row,scope,null,recovery)};
      }
      requireConfiguration(a);if(!a.resourceId)return {replay:await envelope(client,session,member,row,scope,{...a,state:'UNKNOWN',code:'COMPANY_SUBSCRIPTION_RESOURCE_UNOBSERVED'})};
      if(a.lease&&Date.parse(a.lease.expiresAt)>row.observedAt.getTime())fail('COMPANY_SUBSCRIPTION_OPERATION_IN_PROGRESS');
      a.lease={id:randomUUID(),expiresAt:new Date(row.observedAt.getTime()+60000).toISOString(),kind:'INSPECT'};a.revision++;await save(client,a);return {a};
    });
    if(claim.replay)return claim.replay;const {a}=claim;
    try{await fenced(session,command,a.id,a.lease.id);const raw=await provider.inspectSubscription(providerContext(a,{beforeExternal:()=>fenced(session,command,a.id,a.lease.id)}));return await finish(session,command,a.id,a.lease.id,raw);}catch(error){return unknown(session,command,a.id,a.lease.id,error);}
  }
  async function cancelAtPeriodEnd(session,input){
    const command=subscriptionCommand(input,'cancel');
    const claim=await within(session,command,true,async(client,member,scope)=>{
      if(await operationClosure(client,member.organizationId,command.operationId))fail('COMPANY_SUBSCRIPTION_OPERATION_CLOSED');
      const row=await company(client,member.organizationId),a=await attempt(client,member.organizationId,command.subscriptionAttemptId);if(!a)fail('COMPANY_SUBSCRIPTION_ATTEMPT_UNAVAILABLE',404);
      requireConfiguration(a);if(!a.resourceId)fail('COMPANY_SUBSCRIPTION_RESOURCE_UNOBSERVED',503);
      if(a.cancellation?.operationId===command.operationId){if(a.cancellation.requestDigest!==subscriptionRequestDigest(command))fail('COMPANY_SUBSCRIPTION_OPERATION_CONFLICT');return {replay:await envelope(client,session,member,row,scope,a)};}
      if(a.lease&&Date.parse(a.lease.expiresAt)>row.observedAt.getTime())fail('COMPANY_SUBSCRIPTION_OPERATION_IN_PROGRESS');
      if(a.cancellation&&a.cancellation.state!=='CONFIRMED')fail('COMPANY_SUBSCRIPTION_CANCELLATION_UNCONFIRMED');
      a.cancellation={operationId:command.operationId,requestDigest:subscriptionRequestDigest(command),state:'DISPATCHING'};a.state='CANCEL_REQUESTED';a.lease={id:randomUUID(),expiresAt:new Date(row.observedAt.getTime()+60000).toISOString(),kind:'CANCEL'};a.revision++;await save(client,a);await transition(client,a,'RENEWAL_CANCELLATION_RESERVED');return {a};
    });
    if(claim.replay)return claim.replay;const {a}=claim,context={scope:command.scope,operationId:a.operationId};
    try{await fenced(session,context,a.id,a.lease.id);if(typeof provider.cancelAtPeriodEnd!=='function')fail('COMPANY_SUBSCRIPTION_CANCELLATION_UNAVAILABLE',503);const raw=await provider.cancelAtPeriodEnd(providerContext(a,{beforeExternal:()=>fenced(session,context,a.id,a.lease.id)}));return await finish(session,context,a.id,a.lease.id,raw,true);}catch(error){return unknown(session,context,a.id,a.lease.id,error);}
  }
  async function processVerifiedEvent(event){
    if(typeof connect!=='function'||typeof provider?.isVerifiedEvent!=='function'||provider.isVerifiedEvent(event)!==true||typeof provider.resolveNotification!=='function')fail('COMPANY_SUBSCRIPTION_EVENT_PROOF_REQUIRED',403);
    if(!/^[a-f0-9]{64}$/.test(event.replayKey||'')||event.provider!==provider.readiness().provider||typeof event.notificationType!=='string'||typeof event.resourceId!=='string')fail('COMPANY_SUBSCRIPTION_EVENT_PROOF_REQUIRED',403);
    const ready=requireConfiguration(),eventId='company_subscription_event_'+digest([ready.config.provider,ready.config.merchantId,ready.config.accountMode,event.replayKey]),eventDigest=subscriptionContractDigest({provider:event.provider,notificationType:event.notificationType,resourceId:event.resourceId,replayKey:event.replayKey}),leaseId=randomUUID();
    let client,broken=false,reserved=false;
    const beginSystem=async()=>{await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');await client.query("SET LOCAL statement_timeout = '6000ms'");await client.query("SET LOCAL lock_timeout = '2500ms'");};
    const clock=async()=>{const value=(await client.query('SELECT clock_timestamp() AS now')).rows[0]?.now;if(!subscriptionInstant(value))fail('COMPANY_SUBSCRIPTION_EVENT_UNOBSERVED',503);return value;};
    const eventRow=async()=>{const rows=(await client.query(`SELECT id,"organizationId",metadata FROM public."AuditLog" WHERE id=$1 FOR UPDATE`,[eventId])).rows;if(rows.length>1)fail('COMPANY_SUBSCRIPTION_INTEGRITY',503);return rows[0]||null;};
    try{
      client=await connect();await beginSystem();
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[eventId]);const prior=await eventRow(),seen=await clock();
      if(prior){
        if(prior.metadata.requestDigest!==eventDigest)fail('COMPANY_SUBSCRIPTION_EVENT_REPLAY_CONFLICT');
        if(prior.metadata.state==='PROCESSED'){await client.query('COMMIT');return {...prior.metadata.result,replayed:true};}
        if(prior.metadata.lease&&Date.parse(prior.metadata.lease.expiresAt)>seen.getTime())fail('COMPANY_SUBSCRIPTION_EVENT_IN_PROGRESS');
      }
      const journal={version:1,provider:ready.config.provider,merchantId:ready.config.merchantId,accountMode:ready.config.accountMode,replayKey:event.replayKey,notificationType:event.notificationType,resourceId:event.resourceId,requestDigest:eventDigest,state:'RESOLVING',lease:{id:leaseId,expiresAt:new Date(seen.getTime()+60000).toISOString()},result:null};
      if(prior)await client.query(`UPDATE public."AuditLog" SET metadata=$2::jsonb WHERE id=$1`,[eventId,JSON.stringify(journal)]);
      else await client.query(`INSERT INTO public."AuditLog"(id,action,"entityType",metadata) VALUES($1,'company.subscription.event','Organization',$2::jsonb)`,[eventId,JSON.stringify(journal)]);
      await client.query('COMMIT');reserved=true;
      // Even the authenticated resolver GET runs after the replay reservation.
      const resolved=await provider.resolveNotification(event);
      if(!subscriptionRecord(resolved)||typeof resolved.providerSubscriptionId!=='string'||resolved.merchantId!==ready.config.merchantId||resolved.accountMode!==ready.config.accountMode||!subscriptionRecord(resolved.notification)||resolved.notification.notificationType!==event.notificationType||resolved.notification.resourceId!==event.resourceId)fail('COMPANY_SUBSCRIPTION_EVENT_UNOBSERVED',503);
      await beginSystem();
      const rows=(await client.query(`SELECT id,"organizationId",metadata FROM public."AuditLog" WHERE action=$1 AND metadata->>'provider'=$2 AND metadata->>'merchantId'=$3 AND metadata->>'accountMode'=$4 AND metadata->>'resourceId'=$5 LIMIT 2`,[action,ready.config.provider,ready.config.merchantId,ready.config.accountMode,resolved.providerSubscriptionId])).rows;
      if(rows.length!==1)fail('COMPANY_SUBSCRIPTION_EVENT_UNBOUND',404);const organizationId=rows[0].organizationId;
      const owners=(await client.query(`SELECT id FROM public."Organization" WHERE id=$1 AND COALESCE(metadata->'internal','false'::jsonb)<>'true'::jsonb FOR UPDATE`,[organizationId])).rows;if(owners.length!==1)fail('COMPANY_SUBSCRIPTION_EVENT_UNBOUND',404);
      const a=await attempt(client,organizationId,rows[0].id),row=await company(client,organizationId);requireConfiguration(a);
      const claimed=await eventRow();if(claimed?.metadata.lease?.id!==leaseId||Date.parse(claimed.metadata.lease.expiresAt)<=row.observedAt.getTime())fail('COMPANY_SUBSCRIPTION_EVENT_STATE_CHANGED');
      if(a.lease&&Date.parse(a.lease.expiresAt)>row.observedAt.getTime())fail('COMPANY_SUBSCRIPTION_OPERATION_IN_PROGRESS');
      a.lease={id:leaseId,expiresAt:new Date(row.observedAt.getTime()+60000).toISOString(),kind:'EVENT'};a.revision++;await save(client,a);
      journal.state='INSPECTING';journal.attemptId=a.id;journal.organizationId=organizationId;journal.providerResourceId=a.resourceId;await client.query(`UPDATE public."AuditLog" SET "organizationId"=$2,"entityId"=$2,metadata=$3::jsonb WHERE id=$1`,[eventId,organizationId,JSON.stringify(journal)]);await client.query('COMMIT');
      const raw=await provider.inspectSubscription(providerContext(a,{notification:resolved.notification,beforeExternal:()=>requireConfiguration(a)}));
      await beginSystem();const currentOwners=(await client.query(`SELECT id FROM public."Organization" WHERE id=$1 AND COALESCE(metadata->'internal','false'::jsonb)<>'true'::jsonb FOR UPDATE`,[organizationId])).rows;if(currentOwners.length!==1)fail('COMPANY_SUBSCRIPTION_EVENT_UNBOUND',404);
      const current=await attempt(client,organizationId,a.id);if(!current||current.lease?.id!==a.lease.id)fail('COMPANY_SUBSCRIPTION_STATE_CHANGED');requireConfiguration(current);
      const currentRow=await company(client,organizationId),observation=verifiedSubscriptionObservation(raw,current,{checkoutHost:ready.checkoutHost,observedAt:currentRow.observedAt});observations.add(observation);
      const activeEvent=await eventRow();if(activeEvent?.metadata.lease?.id!==leaseId||Date.parse(activeEvent.metadata.lease.expiresAt)<=currentRow.observedAt.getTime())fail('COMPANY_SUBSCRIPTION_EVENT_STATE_CHANGED');
      await applyObservation(client,current,currentRow,observation,{cancel:observation.status==='CANCELED'});
      const result={version:1,eventId:event.eventId||event.replayKey,processed:true,attemptId:current.id,state:current.state,receiptId:current.receiptId||null};journal.state='PROCESSED';journal.lease=null;journal.result=result;await client.query(`UPDATE public."AuditLog" SET metadata=$2::jsonb WHERE id=$1`,[eventId,JSON.stringify(journal)]);await client.query('COMMIT');return result;
    }catch(error){
      if(client){try{await client.query('ROLLBACK');}catch{broken=true;}}
      if(client&&!broken&&reserved)try{
        await beginSystem();const row=await eventRow();
        if(row?.metadata.lease?.id===leaseId){row.metadata.state='UNKNOWN';row.metadata.code=fixedCode(error);await client.query(`UPDATE public."AuditLog" SET metadata=$2::jsonb WHERE id=$1`,[eventId,JSON.stringify(row.metadata)]);}
        await client.query('COMMIT');
      }catch{try{await client.query('ROLLBACK');}catch{broken=true;}}
      throw error instanceof WorkspaceError?error:new WorkspaceError('COMPANY_SUBSCRIPTION_EVENT_UNOBSERVED',503);
    }finally{client?.release(broken);}
  }
  return {catalog:read,read,acceptOffer,begin,recover,cancelAtPeriodEnd,cancelRenewal:cancelAtPeriodEnd,processVerifiedEvent};
}
