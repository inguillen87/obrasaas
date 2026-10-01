import {WorkspaceError,workspaceId,operationId,digest,requireWorkspaceIdentity} from './workspace-policy.mjs';
import {decodePrivateImage,PrivateImageError} from './private-image-upload.mjs';
export const PARTICIPANT_NOTICE_VERSION='participant-kyc-v1';
export const PARTICIPANT_NOTICE='Tu documento y fotografía se guardan en privado para que un responsable autorizado de esta empresa revise tu identidad y participación en esta obra. Las imágenes no autorizan fichajes ni aprueban tu identidad automáticamente. Podés solicitar corrección o revisión al responsable. No ingreses datos bancarios ni información médica.';
export const participantManager=role=>['ADMIN','DIRECTOR'].includes(role);
export const OFFICE_ROLES=Object.freeze({DIRECTOR:{label:'Dirección',scope:'Gestiona todas las obras de la empresa, participantes, identidad, compras y aprobaciones.'},SITE_MANAGER:{label:'Jefatura de obra',scope:'Consulta y planifica solamente las obras asignadas. No administra participantes ni aprueba compras o avances.'},FINANCE:{label:'Finanzas',scope:'Consulta solamente las obras asignadas. Este rol no autoriza compras, cambios de cronograma ni aprobaciones.'},AUDITOR:{label:'Consulta',scope:'Consulta solamente las obras asignadas. La participación propia de campo requiere una vinculación independiente.'}});
export function participantKeys(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join('|')!==[...keys].sort().join('|'))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');}
export function participantRevision(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(value))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');}
export const participantReason=value=>{if(typeof value!=='string'||value.trim().length<8||value.length>800||/[\u0000-\u001f\u007f<>]/.test(value))throw new WorkspaceError('PARTICIPANT_REASON_REQUIRED');return value.trim();};
export function participantContext(input){if(!workspaceId(input.projectId)||!/^[a-f0-9]{64}$/.test(input.scope||''))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');}
export function participantCommand(input){
 participantKeys(input,['operationId','projectId','scope','action','payload']);participantContext(input);if(!operationId(input.operationId))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');
 const p=input.payload;let payload;
 if(input.action==='INVITE'){
  participantKeys(p,['workerId','revision','email']);participantRevision(p.revision);
  if(!workspaceId(p.workerId)||typeof p.email!=='string'||p.email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email.trim()))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');
  payload={...p,email:p.email.trim().toLowerCase()};
 }else if(['REVOKE','RESTORE_ACCESS'].includes(input.action)){
  participantKeys(p,['workerId','revision','reason']);participantRevision(p.revision);if(!workspaceId(p.workerId))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');payload={...p,reason:participantReason(p.reason)};
 }else if(input.action==='ASSIGN_EXISTING'){
  participantKeys(p,['workerId','revision','membershipId','reason']);participantRevision(p.revision);if(!workspaceId(p.workerId)||!workspaceId(p.membershipId))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');payload={...p,reason:participantReason(p.reason)};
 }else if(input.action==='SET_OFFICE_ROLE'){
  participantKeys(p,['membershipId','revision','role','reason']);participantRevision(p.revision);if(!workspaceId(p.membershipId)||!Object.hasOwn(OFFICE_ROLES,p.role))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');payload={...p,reason:participantReason(p.reason)};
 }else if(input.action==='REVIEW_KYC'){
  participantKeys(p,['workerId','revision','submissionId','decision','reason']);participantRevision(p.revision);
  if(!workspaceId(p.workerId)||!workspaceId(p.submissionId)||!['APPROVED','REJECTED'].includes(p.decision))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');payload={...p,reason:participantReason(p.reason)};
 }else if(input.action==='RECOVER_INVITATION'){
  participantKeys(p,['workerId','invitationId']);if(!workspaceId(p.workerId)||!/^invite_[a-f0-9]{32}$/.test(p.invitationId||''))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');payload={...p};
 }else throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');
 return {...input,operationId:input.operationId.toLowerCase(),payload};
}
export function participantKycInput(input){
 participantKeys(input,['operationId','projectId','scope','workerId','revision','noticeVersion','consent','front','selfie']);participantContext(input);participantRevision(input.revision);
 if(!operationId(input.operationId)||!workspaceId(input.workerId)||input.consent!==true||input.noticeVersion!==PARTICIPANT_NOTICE_VERSION)throw new WorkspaceError('PARTICIPANT_PRIVACY_REQUIRED');
 try{return {...input,operationId:input.operationId.toLowerCase(),front:decodePrivateImage(input.front),selfie:decodePrivateImage(input.selfie)};}catch(error){throw new WorkspaceError(error instanceof PrivateImageError?error.code:'PARTICIPANT_INPUT_INVALID',error.code==='PRIVATE_IMAGE_TOO_LARGE'?413:400);}
}
export const participantReceiptId=(actorId,projectId,key)=>'participant_'+digest([actorId,projectId,key.toLowerCase()]);
export async function assertFieldParticipant(client,member,session,projectId,workerId,{permission='attendance',requireKyc=false,lock=false}={}){
 requireWorkspaceIdentity(session);if(!workspaceId(workerId)||!['attendance','report'].includes(permission))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');
 const row=(await client.query(`SELECT id,name,active,metadata,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."Worker" WHERE id=$1 AND "projectId"=$2 ${lock?'FOR UPDATE':''}`,[workerId,projectId])).rows[0];
 const participant=row?.metadata?.participant;
 if(!row?.active||participant?.version!==1||participant.status!=='ACTIVE'||participant.clerkUserId!==session.userId||participant.permissions?.[permission]!==true)throw new WorkspaceError('PARTICIPANT_ACCESS_REQUIRED',403);
 const membership=(await client.query(`SELECT m.id FROM public."TenantMembership" m JOIN public."PlatformUser" u ON u.id=m."userId" JOIN public."ProjectMembership" pm ON pm."tenantMembershipId"=m.id WHERE m.id=$1 AND m."organizationId"=$2 AND u."clerkUserId"=$3 AND m.status='ACTIVE' AND pm."projectId"=$4 AND pm.status='ACTIVE' ${lock?'FOR SHARE OF m,u,pm':''}`,[member.membershipId,member.organizationId,session.userId,projectId])).rows;
 if(membership.length!==1)throw new WorkspaceError('PARTICIPANT_ACCESS_REQUIRED',403);
 if(requireKyc&&participant.kyc?.status!=='APPROVED')throw new WorkspaceError('PARTICIPANT_KYC_REVIEW_REQUIRED',403);
 return row;
}
