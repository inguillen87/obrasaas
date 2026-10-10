import {WorkspaceError,workspaceId,operationId,digest} from './workspace-policy.mjs';

export const OFFICE_REVIEW_ACTIONS=Object.freeze(['INVITE_AUDITOR','REVOKE_AUDITOR','SELECT_EVENT']);
export const officeInvitationId=value=>typeof value==='string'&&/^office_invite_[a-f0-9]{32}$/.test(value);
export const officeEventId=value=>typeof value==='string'&&/^customer_webhook_[a-f0-9]{64}$/.test(value);
export const officeReceiptId=(member,projectId,key)=>'office_review_'+digest([member.organizationId,member.actorId,projectId,key.toLowerCase()]);
export function officeKeys(value,fields){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join('|')!==[...fields].sort().join('|'))throw new WorkspaceError('OFFICE_REVIEW_INPUT_INVALID');}
export function officeContext(value){if(!workspaceId(value.projectId)||!/^[a-f0-9]{64}$/.test(value.scope||''))throw new WorkspaceError('OFFICE_REVIEW_INPUT_INVALID');return {projectId:value.projectId,scope:value.scope};}
export function officeCommand(body){
 officeKeys(body,['action','projectId','scope','operationId','payload']);officeContext(body);
 if(!OFFICE_REVIEW_ACTIONS.includes(body.action)||!operationId(body.operationId))throw new WorkspaceError('OFFICE_REVIEW_INPUT_INVALID');
 const p=body.payload;
 if(body.action==='INVITE_AUDITOR'){
  officeKeys(p,['email','connectionId','expiresAt','confirmReadOnly']);
  if(typeof p.email!=='string'||p.email!==p.email.trim().toLowerCase()||p.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)||!workspaceId(p.connectionId)||p.confirmReadOnly!==true||!validInstant(p.expiresAt))throw new WorkspaceError('OFFICE_REVIEW_INPUT_INVALID');
 }else if(body.action==='REVOKE_AUDITOR'){
  officeKeys(p,['invitationId','reason']);if(!officeInvitationId(p.invitationId)||typeof p.reason!=='string'||p.reason.trim().length<8||p.reason.length>400)throw new WorkspaceError('OFFICE_REVIEW_INPUT_INVALID');
 }else {
  officeKeys(p,['connectionId','eventId','confirmNoPersonalData']);if(!workspaceId(p.connectionId)||!officeEventId(p.eventId)||p.confirmNoPersonalData!==true)throw new WorkspaceError('OFFICE_REVIEW_INPUT_INVALID');
 }
 return {...body,operationId:body.operationId.toLowerCase(),payload:{...p}};
}
export const validInstant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
export function requireOfficeAdministrator(member,session){if(member.role!=='ADMIN'||session.organizationRole!=='org:admin')throw new WorkspaceError('OFFICE_REVIEW_ADMIN_REQUIRED',403);}
export function assertOfficeGrant(grant,{member,projectId,connectionId,channelRevision,assignmentRevision,now,revoked=false}){
 if(!Number.isFinite(now))throw new WorkspaceError('OFFICE_REVIEW_ACCESS_REQUIRED',403);
 if(grant?.version!==1||grant.kind!=='OFFICE_AUDITOR_INVITATION_ACCEPTED'||grant.membershipId!==member.membershipId||grant.projectId!==projectId||grant.connectionId!==connectionId||grant.organizationId!==member.organizationId||grant.clerkUserId!==member.clerkUserId||member.role!=='AUDITOR'||member.clerkRole!=='org:member'||revoked||!validInstant(grant.expiresAt)||Date.parse(grant.expiresAt)<=now||!workspaceId(grant.issuerId)||!officeInvitationId(grant.invitationId))throw new WorkspaceError('OFFICE_REVIEW_ACCESS_REQUIRED',403);
 if(!Number.isSafeInteger(grant.channelRevision)||!Number.isSafeInteger(grant.assignmentRevision)||grant.channelRevision!==channelRevision||grant.assignmentRevision!==assignmentRevision)throw new WorkspaceError('OFFICE_REVIEW_ACCESS_REQUIRED',403);
}
// Intentionally no text, sender/recipient, document, worker or encrypted DTO.
// These facts describe an authenticated source observation, never permission
// to process it or proof that a person read the message on their phone.
export function officeEventProjection(row,payload){
 if(!officeEventId(row.id)||payload?.type!=='message'||payload.value?.type!=='text'||payload.value.text?.body!=='HOLA'||!Number.isFinite(new Date(row.createdAt).getTime()))throw new WorkspaceError('OFFICE_REVIEW_EVENT_NOT_SAFE',409);
 return {id:row.id,receivedAt:new Date(row.createdAt).toISOString(),kind:'GREETING',signatureVerified:true,processingState:['PENDING','PROCESSED','FAILED'].includes(row.status)?row.status:'UNCONFIRMED'};
}
