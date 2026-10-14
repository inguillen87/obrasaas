import {WorkspaceError,digest,operationId,workspaceId} from './workspace-policy.mjs';

export const ORGANIZATION_USAGE_VERSION=1;
export const ORGANIZATION_USAGE_STAGE='PLAN_OPENAI_EXTRACTION';
export const ORGANIZATION_USAGE_STATES=Object.freeze(['RESERVED','DISPATCHED','UNKNOWN','OBSERVED','UNMEASURED']);
export const ORGANIZATION_USAGE_COVERAGE_STATES=Object.freeze(['TRIAL_CURRENT','PAID_PERIOD_OBSERVED','EXPIRED','UNCONFIRMED']);
const fail=(code='ORGANIZATION_USAGE_UNCONFIRMED',status=503)=>{throw new WorkspaceError(code,status);};
export const usageRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export const usageExact=(value,keys)=>usageRecord(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
export const usageStable=value=>Array.isArray(value)?value.map(usageStable):usageRecord(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,usageStable(value[key])])):value;
export const usageDigest=value=>digest(usageStable(value));
export const usageHash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export function usageInstant(value){
 if(value instanceof Date&&Number.isFinite(value.getTime()))return value.toISOString();
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))return null;
 const date=new Date(value);return Number.isFinite(date.getTime())&&date.toISOString()===value?value:null;
}
export const usageDecimal=value=>typeof value==='string'&&/^(0|[1-9]\d{0,29})$/.test(value);
export const usageModel=value=>typeof value==='string'&&/^(?:gpt-4o(?:-mini)?|gpt-4\.1)(?:-\d{4}-\d{2}-\d{2})?$/.test(value)?value:null;
export function normalizedUsage(value){
 if(!usageExact(value,['inputTokens','outputTokens','totalTokens','cachedInputTokens','reasoningOutputTokens']))return null;
 for(const key of ['inputTokens','outputTokens','totalTokens'])if(!usageDecimal(value[key]))return null;
 for(const key of ['cachedInputTokens','reasoningOutputTokens'])if(value[key]!==null&&!usageDecimal(value[key]))return null;
 if(BigInt(value.inputTokens)+BigInt(value.outputTokens)!==BigInt(value.totalTokens)||value.cachedInputTokens!==null&&BigInt(value.cachedInputTokens)>BigInt(value.inputTokens)||value.reasoningOutputTokens!==null&&BigInt(value.reasoningOutputTokens)>BigInt(value.outputTokens))return null;
 return {...value};
}
export function openAiUsageFact(data,requestId=null){
 const integer=value=>Number.isSafeInteger(value)&&value>=0?String(value):null,u=data?.usage;
 const invalidDetail=u?.input_tokens_details?.cached_tokens!==undefined&&integer(u.input_tokens_details.cached_tokens)===null||u?.output_tokens_details?.reasoning_tokens!==undefined&&integer(u.output_tokens_details.reasoning_tokens)===null;
 const usage=invalidDetail?null:normalizedUsage({inputTokens:integer(u?.input_tokens),outputTokens:integer(u?.output_tokens),totalTokens:integer(u?.total_tokens),cachedInputTokens:u?.input_tokens_details?.cached_tokens===undefined?null:integer(u.input_tokens_details.cached_tokens),reasoningOutputTokens:u?.output_tokens_details?.reasoning_tokens===undefined?null:integer(u.output_tokens_details.reasoning_tokens)});
 const providerResponseHash=typeof data?.id==='string'&&/^resp_[A-Za-z0-9_-]{1,200}$/.test(data.id)?usageDigest(['openai-response',data.id]):null;
 const providerRequestHash=typeof requestId==='string'&&/^req_[A-Za-z0-9_-]{1,200}$/.test(requestId)?usageDigest(['openai-request',requestId]):null;
 return {state:usage?'OBSERVED':'UNMEASURED',model:usageModel(data?.model),usage,providerResponseHash,providerRequestHash};
}
export function usageBinding(value){
 if(!usageExact(value,['organizationId','actorId','projectId','draftId','operationId','stage','sourceSha256','requestDigest','consentVersion','requestedModel'])||![value.organizationId,value.actorId,value.projectId,value.draftId].every(workspaceId)||!operationId(value.operationId)||value.stage!==ORGANIZATION_USAGE_STAGE||!usageHash(value.sourceSha256)||!usageHash(value.requestDigest)||!['plan-document-openai-v1','plan-document-monthly-curve-openai-v1','plan-source-quantities-openai-v1'].includes(value.consentVersion)||value.requestedModel!=='gpt-4o')fail('ORGANIZATION_USAGE_BINDING_REJECTED',409);
 return {...value,operationId:value.operationId.toLowerCase()};
}
export const organizationUsageId=binding=>'organization_usage_'+usageDigest(['organization-usage-v1',binding.organizationId,binding.operationId,binding.stage]);
// Coverage records commercial evidence; it never supplies provider funding or a quota.
export function usageCoverage(company,receipt=null){
 const observedAt=usageInstant(company?.observedAt);if(!observedAt)fail();const now=Date.parse(observedAt);
 const unknown={state:'UNCONFIRMED',startsAt:null,endsAt:null};
 if(company.subscriptionPlan==='TRIAL'&&company.subscriptionStatus==='TRIALING'){
  const end=usageInstant(company.trialEndsAt);return end?{state:Date.parse(end)>now?'TRIAL_CURRENT':'EXPIRED',startsAt:null,endsAt:end}:unknown;
 }
 const managed=company.metadata?.companySubscription,p=managed?.paidPeriod;
 const start=usageInstant(p?.startsAt),end=usageInstant(p?.endsAt),m=receipt?.metadata;
 const reference=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,254}$/.test(value),paidAt=usageInstant(m?.paidAt);
 const exactReceipt=usageExact(m,['version','attemptId','provider','merchantId','accountMode','resourceId','paymentId','invoiceId','offerId','catalogVersion','amountMinor','currency','paidAt','period'])&&m.version===1&&m.provider==='MERCADO_PAGO'&&/^\d{1,20}$/.test(m.merchantId||'')&&m.accountMode==='LIVE'&&[m.resourceId,m.paymentId,m.offerId,m.catalogVersion].every(reference)&&(m.invoiceId===null||reference(m.invoiceId))&&/^[1-9]\d{0,14}$/.test(m.amountMinor||'')&&['USD','ARS'].includes(m.currency)&&(m.currency!=='USD'||m.amountMinor===({PRO:'14900',ENTERPRISE:'34900'})[company.subscriptionPlan])&&usageExact(m.period,['startsAt','endsAt'])&&paidAt&&start&&end&&Date.parse(paidAt)>=Date.parse(start)&&Date.parse(paidAt)<Date.parse(end)&&Date.parse(paidAt)<=now&&receipt.id==='company_subscription_payment_'+digest([m.provider,m.merchantId,m.accountMode,m.paymentId]);
 if(company.subscriptionStatus==='ACTIVE'&&['PRO','ENTERPRISE'].includes(company.subscriptionPlan)&&managed?.version===1&&/^company_subscription_[a-f0-9]{64}$/.test(managed.attemptId||'')&&/^company_subscription_payment_[a-f0-9]{64}$/.test(managed.receiptId||'')&&receipt?.id===managed.receiptId&&receipt.organizationId===company.id&&receipt.action==='company.subscription.payment.verified'&&exactReceipt&&m.attemptId===managed.attemptId&&m.resourceId===managed.providerResourceId&&start&&end&&Date.parse(end)>Date.parse(start)&&usageInstant(m.period?.startsAt)===start&&usageInstant(m.period?.endsAt)===end){
  if(Date.parse(end)<=now)return {state:'EXPIRED',startsAt:start,endsAt:end};
  if(Date.parse(start)<=now)return {state:'PAID_PERIOD_OBSERVED',startsAt:start,endsAt:end};
 }
 return unknown;
}
export function publicUsageReceipt(row){
 const m=row?.metadata;
 if(!/^organization_usage_[a-f0-9]{64}$/.test(row?.id||'')||m?.version!==1||!ORGANIZATION_USAGE_STATES.includes(m.state)||!ORGANIZATION_USAGE_COVERAGE_STATES.includes(m.coverage?.state)||!usageInstant(m.updatedAt)||m.state==='OBSERVED'&&!normalizedUsage(m.observation?.usage))fail();
 return {receiptId:row.id,state:m.state,recordedAt:m.updatedAt,coverageState:m.coverage.state,model:usageModel(m.observation?.model),usage:m.state==='OBSERVED'?normalizedUsage(m.observation.usage):null};
}
