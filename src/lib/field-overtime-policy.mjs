import {WorkspaceError,workspaceId,digest} from './workspace-policy.mjs';
import {recordKeys,siteRevision,siteText} from './site-register-policy.mjs';

export const OVERTIME_ACTIONS=['CONFIGURE_OVERTIME','PROPOSE_OVERTIME','DECIDE_OVERTIME'];
export const canDecideOvertime=role=>['ADMIN','DIRECTOR'].includes(role);
export const OVERTIME_CONTRACT=Object.freeze({version:1,scope:'CLOSED_SHIFT',durationDefinition:'RECORDED_INTERVALS_EXCLUDING_REGISTERED_BREAKS',decisionRoles:['ADMIN','DIRECTOR'],autoExpiry:'DISABLED'});
const validDigest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const validUtc=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
export function validOvertimeTimeZone(value){
 if(typeof value!=='string'||value.length>100||!value.trim()||value!==value.trim())return false;
 try{new Intl.DateTimeFormat('es-AR',{timeZone:value}).format(0);return true;}catch{return false;}
}
export function normalizeOvertimePayload(action,p){
 const invalid=()=>{throw new WorkspaceError('OVERTIME_INPUT_INVALID',422);};
 if(action==='CONFIGURE_OVERTIME'){
  recordKeys(p,['revision','version','mode','scope','timeZone','durationDefinition','decisionRoles','autoExpiry']);
  if(p.version!==1||!['OFF','MANUAL_REQUEST_ONLY'].includes(p.mode)||p.scope!==OVERTIME_CONTRACT.scope||p.durationDefinition!==OVERTIME_CONTRACT.durationDefinition||p.autoExpiry!=='DISABLED'||JSON.stringify(p.decisionRoles)!==JSON.stringify(OVERTIME_CONTRACT.decisionRoles))invalid();
  if(p.mode==='MANUAL_REQUEST_ONLY'?!validOvertimeTimeZone(p.timeZone):p.timeZone!==null)invalid();
  return {revision:siteRevision(p.revision),...OVERTIME_CONTRACT,mode:p.mode,timeZone:p.timeZone};
 }
 if(action==='PROPOSE_OVERTIME'){
  recordKeys(p,['workerId','closingEventId','shiftId','sourceDigest','configurationDigest','requestedExtraMs','reason']);
  if(![p.workerId,p.closingEventId,p.shiftId].every(workspaceId)||![p.sourceDigest,p.configurationDigest].every(validDigest)||!Number.isSafeInteger(p.requestedExtraMs)||p.requestedExtraMs<=0)invalid();
  return {...p,reason:siteText(p.reason,1000,8,true)};
 }
 recordKeys(p,['closingEventId','proposalReceiptId','proposalRevision','proposalDigest','sourceDigest','configurationDigest','decision','reason']);
 if(!workspaceId(p.closingEventId)||!/^field_[a-f0-9]{64}$/.test(p.proposalReceiptId||'')||!Number.isSafeInteger(p.proposalRevision)||p.proposalRevision<1||![p.proposalDigest,p.sourceDigest,p.configurationDigest].every(validDigest)||!['APPROVE','REJECT'].includes(p.decision))invalid();
 return {...p,reason:siteText(p.reason,1000,8,true)};
}
export function overtimeConfiguration(project){
 const value=project.metadata?.fieldOperations?.overtimeConfiguration;
 if(!value)return {status:'NOT_CONFIGURED',mode:'OFF',configurationDigest:null,timeZone:null};
 if(value.version!==1||!['OFF','MANUAL_REQUEST_ONLY'].includes(value.mode)||value.scope!==OVERTIME_CONTRACT.scope||value.durationDefinition!==OVERTIME_CONTRACT.durationDefinition||value.autoExpiry!=='DISABLED'||JSON.stringify(value.decisionRoles)!==JSON.stringify(OVERTIME_CONTRACT.decisionRoles)||!workspaceId(value.configurationId)||!workspaceId(value.configuredBy)||!validUtc(value.configuredAt)||(value.mode==='MANUAL_REQUEST_ONLY'?!validOvertimeTimeZone(value.timeZone):value.timeZone!==null))throw new WorkspaceError('OVERTIME_CONFIGURATION_INVALID',409);
 return {...OVERTIME_CONTRACT,mode:value.mode,timeZone:value.timeZone,configurationId:value.configurationId,configuredBy:value.configuredBy,configuredAt:value.configuredAt,status:value.mode==='OFF'?'DISABLED':'CONFIGURED',configurationDigest:digest([value.version,value.mode,value.scope,value.timeZone,value.durationDefinition,value.decisionRoles,value.autoExpiry,value.configurationId,value.configuredBy,value.configuredAt])};
}

const validCursorTime=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(value)&&validUtc(value.slice(0,23)+'Z');
export function fieldOvertimeJourneyCursor(projectId,scope,row){
 const body=[1,projectId,scope,row.sortAt,row.id];
 if(!workspaceId(projectId)||!validDigest(scope)||!validCursorTime(row.sortAt)||!workspaceId(row.id))throw new WorkspaceError('FIELD_QUERY_INVALID');
 return Buffer.from(JSON.stringify(body)).toString('base64url')+'~'+digest(body);
}
export function parseFieldOvertimeJourneyCursor(value,projectId,scope){
 if(value===undefined)return null;
 const invalid=()=>{throw new WorkspaceError('FIELD_QUERY_INVALID');};
 if(typeof value!=='string'||value.length>1024||!/^[A-Za-z0-9_-]+~[a-f0-9]{64}$/.test(value))invalid();
 const [encoded,stamp]=value.split('~');let body;
 try{const bytes=Buffer.from(encoded,'base64url');if(bytes.toString('base64url')!==encoded)invalid();body=JSON.parse(bytes.toString('utf8'));}catch{invalid();}
 if(!Array.isArray(body)||body.length!==5||body[0]!==1||body[1]!==projectId||body[2]!==scope||!validCursorTime(body[3])||!workspaceId(body[4])||digest(body)!==stamp)invalid();
 return {sortAt:body[3],id:body[4]};
}
