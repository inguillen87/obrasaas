import {WorkspaceError,operationId,workspaceId} from './workspace-policy.mjs';
import {usageExact,usageDigest,usageHash,usageInstant,normalizedUsage,ORGANIZATION_USAGE_STATES,ORGANIZATION_USAGE_COVERAGE_STATES} from './organization-usage-policy.mjs';

export const RESOURCE_USAGE_ACTION='organization.usage.resource';
export const RESOURCE_USAGE_STAGES=Object.freeze({
 IDENTITY_OPENAI_OCR:{resourceType:'Worker',consents:['participant-external-ocr-v1'],kind:'vision'},
 FIELD_OPENAI_VISION:{resourceType:'Incident',consents:['field-media-analysis-v1'],kind:'vision'},
 FIELD_OPENAI_TRANSCRIPTION:{resourceType:'Incident',consents:['field-media-analysis-v1'],kind:'audio'},
 FIELD_VIDEO_TRANSCRIPTION:{resourceType:'Incident',consents:['field-video-audio-transcription-v1'],kind:'audio'},
 FIELD_VIDEO_VISION:{resourceType:'Incident',consents:['field-media-analysis-v1','field-media-analysis-v2'],kind:'vision'},
});
const fail=(code='ORGANIZATION_USAGE_BINDING_REJECTED',status=409)=>{throw new WorkspaceError(code,status);};
export const resourceUsageModel=value=>typeof value==='string'&&/^(?:gpt-4o(?:-mini)?|gpt-4\.1)(?:-\d{4}-\d{2}-\d{2})?$|^whisper-1$|^gpt-transcribe(?:-[A-Za-z0-9.-]+)?$|^gpt-4o(?:-mini)?-transcribe(?:-[A-Za-z0-9.-]+)?$/.test(value)&&value.length<=128?value:null;
// A decimal denotes a provider-reported billable duration, never file size or
// wall-clock time. Six fractional places bound both persistence and arithmetic.
export const resourceSeconds=value=>typeof value==='string'&&/^(?:0|[1-9]\d{0,14})(?:\.\d{1,6})?$/.test(value)&&(!value.includes('.')||!value.endsWith('0'));
const secondsFromNumber=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=Number.MAX_SAFE_INTEGER&&Math.abs(value*1e6-Math.round(value*1e6))<0.001?String(value):null;
const integer=value=>Number.isSafeInteger(value)&&value>=0?String(value):null;
const requestHash=value=>typeof value==='string'&&/^req_[A-Za-z0-9_-]{1,200}$/.test(value)?usageDigest(['openai-request',value]):null;
const responseHash=value=>typeof value==='string'&&/^(?:chatcmpl-|resp_)[A-Za-z0-9_-]{1,200}$/.test(value)?usageDigest(['openai-response',value]):null;
function tokenFact(data,requestId,usage){
 return {state:usage?'OBSERVED':'UNMEASURED',model:resourceUsageModel(data?.model),usage,providerResponseHash:responseHash(data?.id),providerRequestHash:requestHash(requestId),measurement:{unit:usage?'TOKENS':'UNMEASURED',audioSeconds:null}};
}
export function openAiChatUsageFact(data,requestId=null){
 const u=data?.usage,detailsValid=(u?.prompt_tokens_details?.cached_tokens===undefined||integer(u.prompt_tokens_details.cached_tokens)!==null)&&(u?.completion_tokens_details?.reasoning_tokens===undefined||integer(u.completion_tokens_details.reasoning_tokens)!==null);
 const usage=detailsValid?normalizedUsage({inputTokens:integer(u?.prompt_tokens),outputTokens:integer(u?.completion_tokens),totalTokens:integer(u?.total_tokens),cachedInputTokens:u?.prompt_tokens_details?.cached_tokens===undefined?null:integer(u.prompt_tokens_details.cached_tokens),reasoningOutputTokens:u?.completion_tokens_details?.reasoning_tokens===undefined?null:integer(u.completion_tokens_details.reasoning_tokens)}):null;
 return tokenFact(data,requestId,usage);
}
export function openAiTranscriptionUsageFact(data,requestId=null,requestedModel=null){
 // Requested configuration is not evidence of the returned model.
 void requestedModel;
 const u=data?.usage;
 if(u?.type==='tokens')return tokenFact(data,requestId,normalizedUsage({inputTokens:integer(u.input_tokens),outputTokens:integer(u.output_tokens),totalTokens:integer(u.total_tokens),cachedInputTokens:null,reasoningOutputTokens:null}));
 const seconds=u?.type==='duration'?secondsFromNumber(u.seconds):null;
 if(seconds!==null&&resourceSeconds(seconds))return {state:'OBSERVED',model:resourceUsageModel(data?.model),usage:null,providerResponseHash:responseHash(data?.id),providerRequestHash:requestHash(requestId),measurement:{unit:'AUDIO_SECONDS',audioSeconds:seconds}};
 return tokenFact(data,requestId,null);
}
export function normalizedResourceFact(value){
 if(!usageExact(value,['state','model','usage','providerResponseHash','providerRequestHash','measurement'])||!['OBSERVED','UNMEASURED'].includes(value.state)||value.model!==null&&resourceUsageModel(value.model)!==value.model||[value.providerResponseHash,value.providerRequestHash].some(hash=>hash!==null&&!usageHash(hash))||!usageExact(value.measurement,['unit','audioSeconds']))return null;
 const m=value.measurement;
 if(value.state==='UNMEASURED')return value.usage===null&&m.unit==='UNMEASURED'&&m.audioSeconds===null?structuredClone(value):null;
 if(m.unit==='TOKENS'&&m.audioSeconds===null&&normalizedUsage(value.usage))return structuredClone(value);
 if(m.unit==='AUDIO_SECONDS'&&value.usage===null&&resourceSeconds(m.audioSeconds))return structuredClone(value);
 return null;
}
export function resourceUsageBinding(value){
 const stage=Object.hasOwn(RESOURCE_USAGE_STAGES,value?.stage)?RESOURCE_USAGE_STAGES[value.stage]:null;
 if(!usageExact(value,['version','organizationId','actorId','projectId','resourceType','resourceId','resourceRevision','operationId','stage','sourceSha256','requestDigest','consentVersion','requestedModel'])||value.version!==2||![value.organizationId,value.actorId,value.projectId,value.resourceId].every(workspaceId)||!operationId(value.operationId)||!stage||value.resourceType!==stage.resourceType||![value.resourceRevision,value.sourceSha256,value.requestDigest].every(usageHash)||!stage.consents.includes(value.consentVersion)||(stage.kind==='vision'?value.requestedModel!=='gpt-4o':!resourceUsageModel(value.requestedModel)||!/^whisper-1$|transcribe/.test(value.requestedModel)))fail();
 return {...value,operationId:value.operationId.toLowerCase()};
}
export const resourceUsageId=binding=>'organization_usage_'+usageDigest(['organization-resource-usage-v2',binding.organizationId,binding.operationId,binding.stage]);
// A changed operation, actor, caption or submission revision cannot release a
// provider result whose dispatch remains uncertain for this resource/source.
export const resourceUsagePendingKey=binding=>usageDigest(['resource-provider-dispatch-v2',binding.organizationId,binding.projectId,binding.resourceType,binding.resourceId,binding.stage,binding.sourceSha256]);
export function resourceUsageLookup(value,member){
 if(!usageExact(value,['projectId','resourceType','resourceId','resourceRevision','stage','sourceSha256'])||![member?.organizationId,value.projectId,value.resourceId].every(workspaceId)||!Object.hasOwn(RESOURCE_USAGE_STAGES,value.stage)||RESOURCE_USAGE_STAGES[value.stage].resourceType!==value.resourceType||![value.resourceRevision,value.sourceSha256].every(usageHash))fail();
 return {...value,organizationId:member.organizationId};
}
export function publicResourceUsageReceipt(row){
 const m=row?.metadata,b=m?.binding;
 if(!/^organization_usage_[a-f0-9]{64}$/.test(row?.id||'')||m?.version!==2||!Object.hasOwn(RESOURCE_USAGE_STAGES,b?.stage)||!ORGANIZATION_USAGE_STATES.includes(m.state)||!ORGANIZATION_USAGE_COVERAGE_STATES.includes(m.coverage?.state)||!usageInstant(m.updatedAt))fail('ORGANIZATION_USAGE_UNCONFIRMED',503);
 const binding=resourceUsageBinding(b);
 if(row.id!==resourceUsageId(binding)||m.bindingDigest!==usageDigest(binding)||m.pendingKey!==resourceUsagePendingKey(binding))fail('ORGANIZATION_USAGE_UNCONFIRMED',503);
 const fact=['OBSERVED','UNMEASURED'].includes(m.state)?normalizedResourceFact(m.observation):null;
 if(['OBSERVED','UNMEASURED'].includes(m.state)&&(!fact||fact.state!==m.state))fail('ORGANIZATION_USAGE_UNCONFIRMED',503);
 return {receiptId:row.id,state:m.state,recordedAt:m.updatedAt,coverageState:m.coverage.state,model:fact?.model||null,usage:fact?.usage||null,stage:b.stage,measurement:fact?.measurement||{unit:'UNMEASURED',audioSeconds:null}};
}
