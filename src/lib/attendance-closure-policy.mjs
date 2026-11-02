import {WorkspaceError, workspaceId, operationId, digest} from './workspace-policy.mjs';
import {canDecideOvertime, validOvertimeTimeZone} from './field-overtime-policy.mjs';
import {fieldReceiptId} from './field-operations-policy.mjs';
import {summarizeFieldShift} from './field-shift-summary.mjs';

// Private proposal: no persistence, HTTP authority, provider or clock access.
// Context, beneficiary and otherJourneys are server-resolved ports. Never bind
// these arguments to request JSON; the store must provide them under its locks.
export const ATTENDANCE_CLOSURE_ACTIONS=Object.freeze(['PROPOSE_ATTENDANCE_CLOSURE','DECIDE_ATTENDANCE_CLOSURE']);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const clerk=value=>typeof value==='string'&&/^user_[A-Za-z0-9]+$/.test(value);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const fail=(code='ATTENDANCE_CORRECTION_INPUT_INVALID',status=422)=>{throw new WorkspaceError(code,status);};
export const correctionStable=value=>Array.isArray(value)?value.map(correctionStable):plain(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,correctionStable(value[key])])):value;
export const correctionDigest=value=>digest(correctionStable(value));
export const correctionSame=(left,right)=>correctionDigest(left)===correctionDigest(right);
export function correctionExact(value,keys){
 if(!plain(value)||Reflect.ownKeys(value).some(key=>typeof key!=='string')||Object.keys(value).sort().join('|')!==[...keys].sort().join('|')||Object.values(Object.getOwnPropertyDescriptors(value)).some(descriptor=>!Object.hasOwn(descriptor,'value')))fail();
 return value;
}
export function correctionUtc(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value)fail();
 return value;
}
const reason=value=>{
 if(typeof value!=='string')fail();const text=value.trim().replaceAll('\r\n','\n');
 if(text.length<8||text.length>1000||/[\u0000-\u0008\u000b-\u001f\u007f<>]/.test(text))fail();return text;
};
const id=value=>{if(!workspaceId(value))fail();return value;};
const stamp=value=>{if(!hash(value))fail();return value;};
const integer=value=>{if(!Number.isSafeInteger(value)||value<1)fail();return value;};
const freeze=value=>{if(value&&typeof value==='object'){for(const item of Object.values(value))freeze(item);Object.freeze(value);}return value;};
export const correctionCopy=value=>freeze(structuredClone(value));
const localPattern=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}$/;
export function correctionLocalInstant(instant,timeZone){
 correctionUtc(instant);if(!validOvertimeTimeZone(timeZone))fail();
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(instant)).map(part=>[part.type,part.value]));
 return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.${instant.slice(20,23)}`;
}
export function normalizeAttendanceClosureCommand(input){
 correctionExact(input,['operationId','projectId','scope','action','payload']);
 if(!operationId(input.operationId))fail();id(input.projectId);stamp(input.scope);
 const p=input.payload;let payload;
 if(input.action==='PROPOSE_ATTENDANCE_CLOSURE'){
  correctionExact(p,['workerId','shiftId','anchorEventId','expectedHeadEventId','sourceDigest','effectiveEndAt','effectiveLocalEnd','effectiveTimeZone','reason']);
  if(typeof p.effectiveLocalEnd!=='string'||!localPattern.test(p.effectiveLocalEnd)||correctionLocalInstant(p.effectiveEndAt,p.effectiveTimeZone)!==p.effectiveLocalEnd)fail('ATTENDANCE_CORRECTION_LOCAL_TIME_MISMATCH');
  payload={workerId:id(p.workerId),shiftId:id(p.shiftId),anchorEventId:id(p.anchorEventId),expectedHeadEventId:id(p.expectedHeadEventId),sourceDigest:stamp(p.sourceDigest),effectiveEndAt:correctionUtc(p.effectiveEndAt),effectiveLocalEnd:p.effectiveLocalEnd,effectiveTimeZone:p.effectiveTimeZone,reason:reason(p.reason)};
 }else if(input.action==='DECIDE_ATTENDANCE_CLOSURE'){
  correctionExact(p,['proposalId','proposalRevision','proposalDigest','sourceDigest','decision','reason']);
  if(!['APPROVE','REJECT'].includes(p.decision))fail();
  payload={proposalId:id(p.proposalId),proposalRevision:integer(p.proposalRevision),proposalDigest:stamp(p.proposalDigest),sourceDigest:stamp(p.sourceDigest),decision:p.decision,reason:reason(p.reason)};
 }else fail('ATTENDANCE_CORRECTION_ACTION_INVALID');
 return correctionCopy({operationId:input.operationId.toLowerCase(),projectId:input.projectId,scope:input.scope,action:input.action,payload});
}
function beneficiaryIdentity(value){
 correctionExact(value,['actorId','clerkUserId','accessDigest']);id(value.actorId);stamp(value.accessDigest);if(!clerk(value.clerkUserId))fail();return value;
}
// Current admission stamps constrain a new decision, not an approved historical
// closure. Stable actor+Clerk identity and original event facts remain committed.
export const correctionIdentitySame=(left,right)=>left?.actorId===right?.actorId&&left?.clerkUserId===right?.clerkUserId;
const sourceCommitment=value=>correctionDigest({...value,beneficiary:{actorId:value.beneficiary.actorId,clerkUserId:value.beneficiary.clerkUserId}});
function authority(context,source){
 if(context?.member?.channelProof)fail('ATTENDANCE_CORRECTION_WEB_ONLY',403);
 if(!plain(context)||!plain(context.member)||!workspaceId(context.member.actorId)||!workspaceId(context.member.organizationId)||!clerk(context.member.clerkUserId)||!hash(context.actorAccessDigest)||!hash(context.scope)||context.projectId!==source.projectId||context.member.organizationId!==source.organizationId)fail('ATTENDANCE_CORRECTION_CONTEXT_CHANGED',403);
 if(!canDecideOvertime(context.member.role))fail('ATTENDANCE_CORRECTION_PERMISSION_REQUIRED',403);
 return {actorId:context.member.actorId,clerkUserId:context.member.clerkUserId,accessDigest:context.actorAccessDigest};
}
export function attendanceClosureSource({organizationId,projectId,workerId,shiftId,beneficiary,events,previousEvent=null}){
 id(organizationId);id(projectId);id(workerId);id(shiftId);beneficiaryIdentity(beneficiary);
 if(!Array.isArray(events)||!events.length||events.length>10000)fail('ATTENDANCE_CORRECTION_SOURCE_INVALID',409);
 const original=structuredClone({events,previousEvent});
 let summary;try{summary=summarizeFieldShift({...original,projectId,workerId,shiftId});}catch{fail('ATTENDANCE_CORRECTION_SOURCE_INVALID',409);}
 if(summary.status==='INTEGRITY_REVIEW_REQUIRED'||!hash(summary.sourceDigest)||summary.recordedBy!==beneficiary.actorId)fail('ATTENDANCE_CORRECTION_SOURCE_INVALID',409);
 const rows=[...original.events].sort((a,b)=>a.metadata.fieldOperations.sequence-b.metadata.fieldOperations.sequence),first=rows[0],head=rows.at(-1);
 if(!['CHECK_IN','BREAK_END','CHECK_OUT'].includes(head.metadata.fieldOperations.eventType))fail('ATTENDANCE_CORRECTION_OPEN_BREAK_UNSUPPORTED',409);
 const lastWork=rows.filter(row=>['CHECK_IN','BREAK_END'].includes(row.metadata.fieldOperations.eventType)).at(-1).metadata.fieldOperations.recordedAt;
 const value={version:1,organizationId,projectId,workerId,shiftId,beneficiary:structuredClone(beneficiary),anchorEventId:first.id,headEventId:head.id,headSequence:head.metadata.fieldOperations.sequence,lastWorkingAt:lastWork,recordedSummary:summary};
 return correctionCopy({...value,sourceDigest:sourceCommitment(value)});
}
export function validateAttendanceClosureSource(source){
 correctionExact(source,['version','organizationId','projectId','workerId','shiftId','beneficiary','anchorEventId','headEventId','headSequence','lastWorkingAt','recordedSummary','sourceDigest']);
 beneficiaryIdentity(source.beneficiary);
 const {sourceDigest,...value}=source;if(source.version!==1||!hash(sourceDigest)||sourceCommitment(value)!==sourceDigest)fail('ATTENDANCE_CORRECTION_SOURCE_INVALID',409);
 for(const key of ['organizationId','projectId','workerId','shiftId','anchorEventId','headEventId'])id(source[key]);beneficiaryIdentity(source.beneficiary);integer(source.headSequence);correctionUtc(source.lastWorkingAt);
 if(!['OPEN','CLOSED'].includes(source.recordedSummary?.status)||source.recordedSummary.recordedBy!==source.beneficiary.actorId||!hash(source.recordedSummary.sourceDigest))fail('ATTENDANCE_CORRECTION_SOURCE_INVALID',409);
 return source;
}
function sameSource(command,source,context){
 validateAttendanceClosureSource(source);const actor=authority(context,source);
 if(command.scope!==context.scope||command.projectId!==source.projectId||command.payload.sourceDigest!==source.sourceDigest)fail('ATTENDANCE_CORRECTION_SOURCE_CHANGED',409);
 return actor;
}
function boundEnd(source,p,now,otherJourneys){
 correctionUtc(now);const end=Date.parse(p.effectiveEndAt),start=Date.parse(source.recordedSummary.startedAt),lastWork=Date.parse(source.lastWorkingAt);
 if(end>Date.parse(now)||end<start||end<lastWork||source.recordedSummary.complete&&end>Date.parse(source.recordedSummary.endedAt))fail('ATTENDANCE_CORRECTION_TIME_OUT_OF_BOUNDS');
 // This port must cover every other jornada of the beneficiary across the org.
 correctionExact(otherJourneys,['complete','rows']);if(otherJourneys.complete!==true||!Array.isArray(otherJourneys.rows)||otherJourneys.rows.length>10000)fail('ATTENDANCE_CORRECTION_OVERLAP_SOURCE_INCOMPLETE',409);
 for(const row of otherJourneys.rows){
  correctionExact(row,['projectId','workerId','shiftId','beneficiaryActorId','startedAt','effectiveEndedAt']);id(row.projectId);id(row.workerId);id(row.shiftId);
  if(row.beneficiaryActorId!==source.beneficiary.actorId||row.projectId===source.projectId&&row.workerId===source.workerId&&row.shiftId===source.shiftId)fail('ATTENDANCE_CORRECTION_OVERLAP_SOURCE_INVALID',409);
  correctionUtc(row.startedAt);if(row.effectiveEndedAt!==null)correctionUtc(row.effectiveEndedAt);
  const otherStart=Date.parse(row.startedAt),otherEnd=row.effectiveEndedAt===null?Infinity:Date.parse(row.effectiveEndedAt);
  if(otherEnd<otherStart)fail('ATTENDANCE_CORRECTION_OVERLAP_SOURCE_INVALID',409);
  if(start<otherEnd&&otherStart<end)fail('ATTENDANCE_CORRECTION_PERSON_OVERLAP',409);
 }
 const netMs=end-start-source.recordedSummary.breakMs;
 if(!Number.isSafeInteger(netMs)||netMs<0)fail('ATTENDANCE_CORRECTION_TIME_OUT_OF_BOUNDS');
 return netMs;
}
const proposalKeys=['version','id','revision','state','organizationId','projectId','scope','operationId','requestDigest','workerId','shiftId','beneficiary','anchorEventId','expectedHeadEventId','sourceDigest','effectiveEndAt','effectiveLocalEnd','effectiveTimeZone','reason','submittedBy','submittedAt','proposalReceiptId','proposalDigest'];
export function validateAttendanceClosureProposal(proposal){
 correctionExact(proposal,proposalKeys);const {proposalDigest,...value}=proposal;
 if(proposal.version!==1||proposal.state!=='PENDING'||proposal.revision!==1||!hash(proposalDigest)||correctionDigest(value)!==proposalDigest)fail('ATTENDANCE_CORRECTION_PROPOSAL_INVALID',409);
 const payload=Object.fromEntries(['workerId','shiftId','anchorEventId','expectedHeadEventId','sourceDigest','effectiveEndAt','effectiveLocalEnd','effectiveTimeZone','reason'].map(key=>[key,proposal[key]]));
 const command=normalizeAttendanceClosureCommand({operationId:proposal.operationId,projectId:proposal.projectId,scope:proposal.scope,action:'PROPOSE_ATTENDANCE_CLOSURE',payload});
 id(proposal.organizationId);beneficiaryIdentity(proposal.beneficiary);beneficiaryIdentity(proposal.submittedBy);correctionUtc(proposal.submittedAt);
 if(Date.parse(proposal.effectiveEndAt)>Date.parse(proposal.submittedAt)||proposal.requestDigest!==correctionDigest(command)||proposal.proposalReceiptId!==fieldReceiptId(proposal.submittedBy.actorId,proposal.projectId,proposal.operationId)||proposal.id!=='attendance_correction_'+correctionDigest([proposal.organizationId,proposal.projectId,proposal.submittedBy.actorId,proposal.operationId]))fail('ATTENDANCE_CORRECTION_PROPOSAL_INVALID',409);
 return proposal;
}
export function proposeAttendanceClosure(input,{context,source,now,otherJourneys}){
 const command=normalizeAttendanceClosureCommand(input);if(command.action!=='PROPOSE_ATTENDANCE_CLOSURE')fail('ATTENDANCE_CORRECTION_ACTION_INVALID');
 const submittedBy=sameSource(command,source,context),p=command.payload;correctionUtc(now);
 if(p.workerId!==source.workerId||p.shiftId!==source.shiftId||p.anchorEventId!==source.anchorEventId||p.expectedHeadEventId!==source.headEventId)fail('ATTENDANCE_CORRECTION_SOURCE_CHANGED',409);
 boundEnd(source,p,now,otherJourneys);
 const value={version:1,id:'attendance_correction_'+correctionDigest([source.organizationId,source.projectId,submittedBy.actorId,command.operationId]),revision:1,state:'PENDING',organizationId:source.organizationId,projectId:source.projectId,scope:command.scope,operationId:command.operationId,requestDigest:correctionDigest(command),workerId:source.workerId,shiftId:source.shiftId,beneficiary:structuredClone(source.beneficiary),...p,submittedBy,submittedAt:now,proposalReceiptId:fieldReceiptId(submittedBy.actorId,source.projectId,command.operationId)};
 return correctionCopy({...value,proposalDigest:correctionDigest(value)});
}
const decisionKeys=['version','id','organizationId','projectId','scope','operationId','requestDigest','proposalId','proposalDigest','proposalReceiptId','sourceDigest','workerId','shiftId','beneficiary','decision','reason','decidedBy','decidedAt','decisionReceiptId','effectiveEndAt','effectiveLocalEnd','effectiveTimeZone','effectiveNetMs','decisionDigest'];
export function validateAttendanceClosureDecision(decision,proposal){
 validateAttendanceClosureProposal(proposal);correctionExact(decision,decisionKeys);const {decisionDigest,...value}=decision;
 if(decision.version!==1||!hash(decisionDigest)||correctionDigest(value)!==decisionDigest||!['APPROVE','REJECT'].includes(decision.decision))fail('ATTENDANCE_CORRECTION_DECISION_INVALID',409);
 // scopeStamp includes the acting account. Independent maker and checker must
 // retain their own scopes; org/project/source/proposal commitments link them.
 for(const key of ['organizationId','projectId','sourceDigest','workerId','shiftId','effectiveEndAt','effectiveLocalEnd','effectiveTimeZone'])if(decision[key]!==proposal[key])fail('ATTENDANCE_CORRECTION_DECISION_INVALID',409);
 beneficiaryIdentity(decision.decidedBy);correctionUtc(decision.decidedAt);
 const command=normalizeAttendanceClosureCommand({operationId:decision.operationId,projectId:decision.projectId,scope:decision.scope,action:'DECIDE_ATTENDANCE_CLOSURE',payload:{proposalId:proposal.id,proposalRevision:proposal.revision,proposalDigest:proposal.proposalDigest,sourceDigest:proposal.sourceDigest,decision:decision.decision,reason:decision.reason}});
 const invalidNet=decision.decision==='APPROVE'?(!Number.isSafeInteger(decision.effectiveNetMs)||decision.effectiveNetMs<0):decision.effectiveNetMs!==null;
 if(decision.id!=='attendance_correction_decision_'+correctionDigest([proposal.id,decision.decidedBy.actorId,decision.operationId])||decision.proposalId!==proposal.id||decision.proposalDigest!==proposal.proposalDigest||decision.proposalReceiptId!==proposal.proposalReceiptId||!correctionSame(decision.beneficiary,proposal.beneficiary)||decision.requestDigest!==correctionDigest(command)||decision.decisionReceiptId!==fieldReceiptId(decision.decidedBy.actorId,decision.projectId,decision.operationId)||Date.parse(decision.decidedAt)<Date.parse(proposal.submittedAt)||[proposal.submittedBy.actorId,proposal.beneficiary.actorId].includes(decision.decidedBy.actorId)||[proposal.submittedBy.clerkUserId,proposal.beneficiary.clerkUserId].includes(decision.decidedBy.clerkUserId)||invalidNet)fail('ATTENDANCE_CORRECTION_DECISION_INVALID',409);
 return decision;
}
export function decideAttendanceClosure(input,{context,source,proposal,proposer,now,otherJourneys}){
 const command=normalizeAttendanceClosureCommand(input);if(command.action!=='DECIDE_ATTENDANCE_CLOSURE')fail('ATTENDANCE_CORRECTION_ACTION_INVALID');
 validateAttendanceClosureProposal(proposal);const decidedBy=sameSource(command,source,context),p=command.payload;correctionUtc(now);
 if(proposal.organizationId!==source.organizationId||proposal.projectId!==source.projectId||proposal.sourceDigest!==source.sourceDigest||!correctionSame(proposal.beneficiary,source.beneficiary)||p.proposalId!==proposal.id||p.proposalRevision!==proposal.revision||p.proposalDigest!==proposal.proposalDigest)fail('ATTENDANCE_CORRECTION_SOURCE_CHANGED',409);
 if(!plain(proposer)||!canDecideOvertime(proposer.role)||proposer.actorId!==proposal.submittedBy.actorId||proposer.clerkUserId!==proposal.submittedBy.clerkUserId||proposer.accessDigest!==proposal.submittedBy.accessDigest)fail('ATTENDANCE_CORRECTION_PROPOSER_ACCESS_CHANGED',403);
 if([proposal.submittedBy.actorId,source.beneficiary.actorId].includes(decidedBy.actorId)||[proposal.submittedBy.clerkUserId,source.beneficiary.clerkUserId].includes(decidedBy.clerkUserId))fail('FIELD_MAKER_CHECKER_REQUIRED',403);
 if(Date.parse(now)<Date.parse(proposal.submittedAt))fail('ATTENDANCE_CORRECTION_TIME_OUT_OF_BOUNDS');
 const effectiveNetMs=p.decision==='APPROVE'?boundEnd(source,proposal,now,otherJourneys):null;
 const value={version:1,id:'attendance_correction_decision_'+correctionDigest([proposal.id,decidedBy.actorId,command.operationId]),organizationId:source.organizationId,projectId:source.projectId,scope:context.scope,operationId:command.operationId,requestDigest:correctionDigest(command),proposalId:proposal.id,proposalDigest:proposal.proposalDigest,proposalReceiptId:proposal.proposalReceiptId,sourceDigest:source.sourceDigest,workerId:source.workerId,shiftId:source.shiftId,beneficiary:structuredClone(source.beneficiary),decision:p.decision,reason:p.reason,decidedBy,decidedAt:now,decisionReceiptId:fieldReceiptId(decidedBy.actorId,source.projectId,command.operationId),effectiveEndAt:proposal.effectiveEndAt,effectiveLocalEnd:proposal.effectiveLocalEnd,effectiveTimeZone:proposal.effectiveTimeZone,effectiveNetMs};
 const result=correctionCopy({...value,decisionDigest:correctionDigest(value)});validateAttendanceClosureDecision(result,proposal);return result;
}
// Descriptors to persist atomically. Returning one is not evidence it was saved.
export function attendanceClosureAuditDescriptors(proposal,decision=null){
 validateAttendanceClosureProposal(proposal);if(decision)validateAttendanceClosureDecision(decision,proposal);
 const operation=(value,isDecision)=>({id:isDecision?value.decisionReceiptId:value.proposalReceiptId,organizationId:value.organizationId,actorId:isDecision?value.decidedBy.actorId:value.submittedBy.actorId,action:'field.operation.recorded',entityType:'Project',entityId:value.projectId,metadata:{version:1,projectId:value.projectId,operationId:value.operationId,action:isDecision?'DECIDE_ATTENDANCE_CLOSURE':'PROPOSE_ATTENDANCE_CLOSURE',command:isDecision?'DECIDE_ATTENDANCE_CLOSURE':'PROPOSE_ATTENDANCE_CLOSURE',requestDigest:value.requestDigest,outcome:isDecision?{kind:'ATTENDANCE_CLOSURE_DECISION',decision:value}:{kind:'ATTENDANCE_CLOSURE_PROPOSAL',proposal:value}}});
 const proposalReceipt=operation(proposal,false),decisionReceipt=decision?operation(decision,true):null;
 const correctionFact=decision?.decision==='APPROVE'?{id:'attendance_correction_fact_'+decision.decisionDigest,organizationId:decision.organizationId,actorId:decision.decidedBy.actorId,action:'field.attendance.corrected',entityType:'Project',entityId:decision.projectId,metadata:{version:1,projectId:decision.projectId,proposalId:proposal.id,proposalDigest:proposal.proposalDigest,sourceDigest:proposal.sourceDigest,proposalReceiptId:proposal.proposalReceiptId,decisionReceiptId:decision.decisionReceiptId,decisionDigest:decision.decisionDigest,beneficiaryActorId:proposal.beneficiary.actorId,effectiveEndAt:proposal.effectiveEndAt,recordedAt:decision.decidedAt}}:null;
 return correctionCopy({proposalReceipt,decisionReceipt,correctionFact});
}
export function assertAttendanceClosureAudits(proposal,decision,audits){
 const expected=attendanceClosureAuditDescriptors(proposal,decision);correctionExact(audits,['proposalReceipt','decisionReceipt','correctionFact']);
 if(!correctionSame(expected,audits))fail('ATTENDANCE_CORRECTION_RECEIPT_INTEGRITY',409);return expected;
}
