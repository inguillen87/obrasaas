import {createHash} from 'node:crypto';
import {WorkspaceError,workspaceId,operationId,digest} from './workspace-policy.mjs';
import {BINDX_CIVIL_CONFIGURATION_VERSION,BINDX_CIVIL_CONSENT_VERSION,BINDX_CIVIL_RESPONSE_SCHEMA} from './bindx-civil-data-client.mjs';

export const CIVIL_ACTIONS=Object.freeze(['PREPARE_CIVIL_DATA','CONSENT_CIVIL_DATA','QUERY_CIVIL_DATA','REVOKE_CIVIL_DATA_CONSENT']);
export const CIVIL_BOUNDARY=Object.freeze({identityCertified:false,biometricsVerified:false,livenessVerified:false,permissionsGranted:false,requiresHumanReview:true});
export const civilExact=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
export const civilFail=(code='PARTICIPANT_CIVIL_INPUT_INVALID',status=400)=>{throw new WorkspaceError(code,status);};
export const civilInstant=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
export const civilSha=value=>createHash('sha256').update(value).digest('hex');
const reference=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(value);
const confirmed=(value,now)=>civilExact(value,['reference','confirmedAt','confirmed'])&&reference(value.reference)&&civilInstant(value.confirmedAt)&&Date.parse(value.confirmedAt)<=now&&value.confirmed===true;

// Server-only template. It is deliberately not populated from environment or HTTP.
export function approvedCivilConfiguration(value,now){
 if(!civilExact(value,['version','state','product','origin','authentication','credentials','providerEvidence','renaperAgreement','notice'])||value.version!==BINDX_CIVIL_CONFIGURATION_VERSION||value.state!=='CONFIRMED'||value.product!=='RENAPER_CIVIL_DATA'||value.origin!=='https://apistore.pcnt.io'||value.authentication!=='JWT'||!civilExact(value.credentials,['username','password'])||!['username','password'].every(key=>typeof value.credentials[key]==='string'&&value.credentials[key].length>0&&value.credentials[key].length<=(key==='username'?160:4096)&&!/[\u0000-\u001f\u007f]/.test(value.credentials[key])))return null;
 const e=value.providerEvidence,n=value.notice;
 if(!civilExact(e,['reference','confirmedAt','confirmed','origin','product','authentication','responseSchema','environmentConfirmed'])||!confirmed({reference:e.reference,confirmedAt:e.confirmedAt,confirmed:e.confirmed},now)||e.origin!==value.origin||e.product!==value.product||e.authentication!==value.authentication||e.responseSchema!==BINDX_CIVIL_RESPONSE_SCHEMA||e.environmentConfirmed!==true||!confirmed(value.renaperAgreement,now)||!civilExact(n,['version','text','sha256'])||n.version!==BINDX_CIVIL_CONSENT_VERSION||typeof n.text!=='string'||!n.text.trim()||n.text.length>6000||! /^[a-f0-9]{64}$/.test(n.sha256||'')||civilSha(n.text)!==n.sha256)return null;
 return structuredClone(value);
}
export const civilConfigurationDigest=config=>digest(['participant-civil-configuration-v1',config.version,config.product,config.origin,config.authentication,config.providerEvidence,config.renaperAgreement,config.notice]);
export const civilAttemptId=(organizationId,projectId,workerId,id)=>'participant_civil_'+digest([organizationId,projectId,workerId,id]);
export const civilSourceKey=(organizationId,projectId,workerId,sha)=>digest(['participant-civil-source-v1',organizationId,projectId,workerId,sha,'RENAPER_CIVIL_DATA']);
export const civilAttemptDigest=a=>digest(['participant-civil-consent-context-v1',a.organizationId,a.projectId,a.workerId,a.submissionId,a.contentHash,a.documentSha256,a.actorId,a.membershipId,a.operationId,a.configurationDigest,a.noticeVersion,a.noticeSha256]);

export function civilReadContext(input){
 const optional=['submissionId','operationId'].filter(key=>Object.hasOwn(input||{},key));
 if(!civilExact(input,['projectId','scope','workerId',...optional])||!workspaceId(input.projectId)||!workspaceId(input.workerId)||! /^[a-f0-9]{64}$/.test(input.scope||'')||input.submissionId!==undefined&&input.submissionId!==null&&!workspaceId(input.submissionId)||input.operationId!==undefined&&!operationId(input.operationId))civilFail();
 return {...input,...(input.operationId?{operationId:input.operationId.toLowerCase()}:{})};
}
export function civilCommand(input,kind){
 const extra=kind==='prepare'?['revision']:kind==='consent'?['attemptDigest','noticeVersion','noticeSha256','consent','dni','gender']:[];
 if(!civilExact(input,['projectId','scope','workerId','submissionId','operationId',...extra]))civilFail();
 civilReadContext({projectId:input.projectId,scope:input.scope,workerId:input.workerId,submissionId:input.submissionId,operationId:input.operationId});
 if(!workspaceId(input.submissionId)||kind==='prepare'&&!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(input.revision||'')||kind==='consent'&&(input.consent!==true||input.noticeVersion!==BINDX_CIVIL_CONSENT_VERSION||! /^[a-f0-9]{64}$/.test(input.noticeSha256||'')||! /^[a-f0-9]{64}$/.test(input.attemptDigest||'')||! /^\d{1,20}$/.test(input.dni||'')||!['F','M'].includes(input.gender)))civilFail();
 return {...input,operationId:input.operationId.toLowerCase()};
}
export function civilParticipantCommand(body){
 if(!civilExact(body,['operationId','projectId','scope','action','payload'])||!CIVIL_ACTIONS.includes(body.action)||!body.payload||typeof body.payload!=='object'||Array.isArray(body.payload)||['operationId','projectId','scope'].some(key=>Object.hasOwn(body.payload,key)))civilFail();
 const kind={PREPARE_CIVIL_DATA:'prepare',CONSENT_CIVIL_DATA:'consent',QUERY_CIVIL_DATA:'dispatch',REVOKE_CIVIL_DATA_CONSENT:'revoke'}[body.action];
 return {kind,input:civilCommand({operationId:body.operationId,projectId:body.projectId,scope:body.scope,...body.payload},kind)};
}

export function civilObservation(value,bindingDigest){
 const keys=['version','provider','state','code','bindingDigest','observedAt','queryAttempted','httpStatus','data',...Object.keys(CIVIL_BOUNDARY)];
 if(!civilExact(value,keys)||value.version!==1||value.provider!=='BINDX_APISTORE'||value.bindingDigest!==bindingDigest||!['OBSERVED','UNKNOWN','REQUEST_REJECTED','AUTH_REJECTED','AUTHORITY_DENIED'].includes(value.state)||typeof value.queryAttempted!=='boolean'||value.code!==null&&(typeof value.code!=='string'||! /^(BINDX_CIVIL|PARTICIPANT_CIVIL)_[A-Z_]{1,100}$/.test(value.code))||value.httpStatus!==null&&(!Number.isInteger(value.httpStatus)||value.httpStatus<100||value.httpStatus>599)||Object.entries(CIVIL_BOUNDARY).some(([key,item])=>value[key]!==item))civilFail('PARTICIPANT_CIVIL_OBSERVATION_INVALID',409);
 if(value.state==='OBSERVED'){
  const d=value.data,strings=['nombres','apellido','ejemplar','fecha_nacimiento','emision','vencimiento'];
  if(value.queryAttempted!==true||value.httpStatus!==200||!civilInstant(value.observedAt)||!civilExact(d,[...strings,'codigo_fallecido'])||!strings.every(key=>typeof d[key]==='string'&&d[key].length>0&&d[key].length<=(key==='ejemplar'?16:160)&&d[key].trim()===d[key]&&!/[\u0000-\u001f\u007f]/.test(d[key]))||!['fecha_nacimiento','emision','vencimiento'].every(key=>{if(!/^\d{2}\/\d{2}\/\d{4}$/.test(d[key]))return false;const [day,month,year]=d[key].split('/').map(Number),date=new Date(0);date.setUTCFullYear(year,month-1,day);date.setUTCHours(0,0,0,0);return year>=1&&date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;})||!Number.isSafeInteger(d.codigo_fallecido)||d.codigo_fallecido<0||d.codigo_fallecido>1000000)civilFail('PARTICIPANT_CIVIL_OBSERVATION_INVALID',409);
 }else if(value.data!==null||value.observedAt!==null)civilFail('PARTICIPANT_CIVIL_OBSERVATION_INVALID',409);
 return structuredClone(value);
}
