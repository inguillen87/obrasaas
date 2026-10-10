import {WorkspaceError,workspaceId,operationId,digest,requireWorkspaceIdentity} from './workspace-policy.mjs';
import {decodePrivateImage,PrivateImageError} from './private-image-upload.mjs';
import {privateBankNumber,privateBankType,PRIVATE_BANK_ACTIONS,PRIVATE_BANK_NOTICE_VERSION} from './participant-bank-format.mjs';
import {SITE_ROLES} from './site-register-policy.mjs';
import {validateParticipantOnboardingChoice} from './participant-onboarding-policy.mjs';
import {PARTICIPANT_NOTICE,PARTICIPANT_NOTICE_VERSION,PARTICIPANT_DOCUMENT_BACK_NOTICE_VERSION,PARTICIPANT_DOCUMENT_BACK_NOTICE_SHA256} from './participant-kyc-image-set.mjs';
import {assertApprovedParticipantKyc} from './participant-approved-identity.mjs';
import {VERIFIED_OFFICE_ACTION,participantVerifiedOfficeEmail} from './participant-verified-office.mjs';
export {PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE,PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_VERSION,PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_SHA256} from './participant-kyc-image-set.mjs';
export {PARTICIPANT_NOTICE,PARTICIPANT_NOTICE_VERSION,PARTICIPANT_DOCUMENT_BACK_NOTICE,PARTICIPANT_DOCUMENT_BACK_NOTICE_VERSION,PARTICIPANT_DOCUMENT_BACK_NOTICE_SHA256,participantKycImageSet} from './participant-kyc-image-set.mjs';
const backKeys=['back','backConsent','backNoticeVersion','backNoticeSha256'];
const hasBackChoice=input=>backKeys.some(key=>Object.hasOwn(input||{},key));
function validateBackChoice(input){
 if(input.backConsent!==true||input.backNoticeVersion!==PARTICIPANT_DOCUMENT_BACK_NOTICE_VERSION||input.backNoticeSha256!==PARTICIPANT_DOCUMENT_BACK_NOTICE_SHA256)throw new WorkspaceError('PARTICIPANT_DOCUMENT_BACK_CONSENT_REQUIRED',400);
}
export const PARTICIPANT_OCR_NOTICE_VERSION='participant-external-ocr-v1';
export const PARTICIPANT_OCR_NOTICE='La lectura asistida es opcional. Si la autorizás, un responsable podrá enviar únicamente el frente de tu documento a OpenAI para extraer el texto visible. La selfie no se envía para esta lectura. Los datos extraídos permanecen privados y requieren revisión humana; no comprueban autenticidad, biometría ni prueba de vida. Podés presentar tu identidad y recibir revisión manual sin autorizar esta lectura.';
export const PARTICIPANT_BIOMETRIC_NOTICE_VERSION='participant-private-biometric-v1';
export const PARTICIPANT_BIOMETRIC_NOTICE='La comparación facial asistida es opcional y tiene una autorización independiente. Si la autorizás, un responsable podrá procesar el frente del documento y tu selfie dentro del servicio privado de ObraSaaS para comparar las fotografías y obtener una señal orientativa sobre la captura. No se guardan vectores faciales ni se envían las imágenes a Hugging Face. Los resultados no certifican tu identidad, la autenticidad del documento ni la prueba de vida y requieren revisión humana. Podés recibir revisión manual sin autorizar esta comparación.';
export const participantManager=role=>['ADMIN','DIRECTOR'].includes(role);
export const OFFICE_ROLES=Object.freeze({DIRECTOR:{label:'Dirección',scope:'Gestiona todas las obras de la empresa, participantes, identidad, compras y aprobaciones.'},SITE_MANAGER:{label:'Jefatura de obra',scope:'Consulta y planifica solamente las obras asignadas. No administra participantes ni aprueba compras o avances.'},FINANCE:{label:'Finanzas',scope:'Consulta solamente las obras asignadas. Este rol no autoriza compras, cambios de cronograma ni aprobaciones.'},AUDITOR:{label:'Consulta',scope:'Consulta solamente las obras asignadas. La participación propia de campo requiere una vinculación independiente.'}});
export function participantKeys(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join('|')!==[...keys].sort().join('|'))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');}
export function participantRevision(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(value))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');}
export const participantReason=value=>{if(typeof value!=='string'||value.trim().length<8||value.length>800||/[\u0000-\u001f\u007f<>]/.test(value))throw new WorkspaceError('PARTICIPANT_REASON_REQUIRED');return value.trim();};
export function participantContext(input){if(!workspaceId(input.projectId)||!/^[a-f0-9]{64}$/.test(input.scope||''))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');}
export function participantCommand(input){
 participantKeys(input,['operationId','projectId','scope','action','payload']);participantContext(input);if(!operationId(input.operationId))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');
 const p=input.payload;let payload;
 if(PRIVATE_BANK_ACTIONS.includes(input.action)){
  participantKeys(p,input.action==='SAVE_PRIVATE_BANK_ACCOUNT'?['workerId','revision','expectedBankRevision','type','number','noticeVersion','consent']:['workerId','revision','expectedBankRevision']);participantRevision(p.revision);
  if(!workspaceId(p.workerId)||!Number.isSafeInteger(p.expectedBankRevision)||p.expectedBankRevision<0||p.expectedBankRevision>=2147483646)throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');
  if(input.action==='SAVE_PRIVATE_BANK_ACCOUNT'&&(!privateBankNumber(p.number)||!privateBankType(p.type)))throw new WorkspaceError('PARTICIPANT_BANK_FORMAT_INVALID');
  if(input.action==='SAVE_PRIVATE_BANK_ACCOUNT'&&(p.consent!==true||p.noticeVersion!==PRIVATE_BANK_NOTICE_VERSION))throw new WorkspaceError('PARTICIPANT_BANK_PRIVACY_REQUIRED');payload={...p};
 }else if(input.action==='CANCEL_PENDING_PRIVATE_BANK_ACCOUNT'){
  participantKeys(p,['workerId','originalAction','confirmed']);if(!workspaceId(p.workerId)||!PRIVATE_BANK_ACTIONS.includes(p.originalAction)||p.confirmed!==true)throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');payload={...p};
 }else if(input.action==='CONFIGURE_EMPLOYEE_INTAKE'){
  participantKeys(p,['connectionId','expectedRevision','enabled','confirmed']);if(!workspaceId(p.connectionId)||!Number.isSafeInteger(p.expectedRevision)||p.expectedRevision<0||typeof p.enabled!=='boolean'||p.confirmed!==true)throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');payload={...p};
 }else if(['ADMIT_EMPLOYEE_INTAKE','REJECT_EMPLOYEE_INTAKE'].includes(input.action)){
  const existingChoice=input.action==='ADMIT_EMPLOYEE_INTAKE'&&Object.hasOwn(p||{},'existingWorker');
  participantKeys(p,['connectionId','applicationId','expectedRevision',...(input.action==='ADMIT_EMPLOYEE_INTAKE'?['job','permissions','confirmed',...(existingChoice?['existingWorker']:[])]:['reason'])]);
  if(!workspaceId(p.connectionId)||!/^customer_webhook_[a-f0-9]{64}$/.test(p.applicationId||'')||!Number.isSafeInteger(p.expectedRevision)||p.expectedRevision<1)throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');
  if(input.action==='ADMIT_EMPLOYEE_INTAKE'){participantKeys(p.permissions,['attendance','report']);if(!Object.hasOwn(SITE_ROLES,p.job)||typeof p.permissions.attendance!=='boolean'||typeof p.permissions.report!=='boolean'||p.confirmed!==true)throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');
   if(existingChoice){participantKeys(p.existingWorker,['workerId','revision','registrationReceiptId','snapshotDigest']);participantRevision(p.existingWorker.revision);if(!workspaceId(p.existingWorker.workerId)||typeof p.existingWorker.registrationReceiptId!=='string'||!/^site_[a-f0-9]{64}$/.test(p.existingWorker.registrationReceiptId)||typeof p.existingWorker.snapshotDigest!=='string'||!/^[a-f0-9]{64}$/.test(p.existingWorker.snapshotDigest))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');}
   payload={...p,permissions:{...p.permissions},...(existingChoice?{existingWorker:{...p.existingWorker}}:{})};}
  else payload={...p,reason:participantReason(p.reason)};
 }else if(input.action==='INVITE'){
  participantKeys(p,['workerId','revision','email',...(Object.hasOwn(p,'whatsAppConsent')?['whatsAppConsent']:[])]);participantRevision(p.revision);
  if(!workspaceId(p.workerId)||typeof p.email!=='string'||p.email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email.trim()))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');
  payload={...p,email:p.email.trim().toLowerCase(),...(Object.hasOwn(p,'whatsAppConsent')?{whatsAppConsent:validateParticipantOnboardingChoice(p.whatsAppConsent)}:{})};
 }else if(input.action==='SEND_ONBOARDING_WHATSAPP'){
  participantKeys(p,['workerId','revision','whatsAppConsent']);participantRevision(p.revision);if(!workspaceId(p.workerId))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');payload={...p,whatsAppConsent:validateParticipantOnboardingChoice(p.whatsAppConsent)};
 }else if(input.action==='REVOKE_ONBOARDING_CONTACT'){
  participantKeys(p,['workerId','revision']);participantRevision(p.revision);if(!workspaceId(p.workerId))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');payload={...p};
 }else if(['REVOKE','RESTORE_ACCESS'].includes(input.action)){
  participantKeys(p,['workerId','revision','reason']);participantRevision(p.revision);if(!workspaceId(p.workerId))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');payload={...p,reason:participantReason(p.reason)};
 }else if(input.action==='ASSIGN_EXISTING'){
  participantKeys(p,['workerId','revision','membershipId','reason']);participantRevision(p.revision);if(!workspaceId(p.workerId)||!workspaceId(p.membershipId))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');payload={...p,reason:participantReason(p.reason)};
 }else if(input.action==='SET_FIELD_PERMISSIONS'){
  participantKeys(p,['workerId','revision','permissions','reason']);participantRevision(p.revision);participantKeys(p.permissions,['attendance','report']);
  if(!workspaceId(p.workerId)||typeof p.permissions.attendance!=='boolean'||typeof p.permissions.report!=='boolean')throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');payload={...p,permissions:{...p.permissions},reason:participantReason(p.reason)};
 }else if(input.action===VERIFIED_OFFICE_ACTION){
  participantKeys(p,['email','clerkUserId','expectedProofDigest','role','reason','confirmOfficePermissions']);
  if(! /^user_[A-Za-z0-9]+$/.test(p.clerkUserId||'')||! /^[a-f0-9]{64}$/.test(p.expectedProofDigest||'')||!Object.hasOwn(OFFICE_ROLES,p.role)||p.confirmOfficePermissions!==true)throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');
  payload={...p,email:participantVerifiedOfficeEmail(p.email),reason:participantReason(p.reason)};
 }else if(input.action==='SET_OFFICE_ROLE'){
  participantKeys(p,['membershipId','revision','role','reason']);participantRevision(p.revision);if(!workspaceId(p.membershipId)||!Object.hasOwn(OFFICE_ROLES,p.role))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');payload={...p,reason:participantReason(p.reason)};
 }else if(input.action==='PREPARE_KYC_CHAT'){
  participantKeys(p,['workerId','revision']);participantRevision(p.revision);if(!workspaceId(p.workerId))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');payload={...p};
 }else if(input.action==='CANCEL_KYC_CHAT'){
  participantKeys(p,['workerId','revision','challengeId','reason']);participantRevision(p.revision);if(!workspaceId(p.workerId)||!/^kyc_chat_[a-f0-9]{32}$/.test(p.challengeId||''))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');payload={...p,reason:participantReason(p.reason)};
 }else if(input.action==='PROCESS_KYC'){
  participantKeys(p,['workerId','revision','submissionId']);participantRevision(p.revision);
  if(!workspaceId(p.workerId)||!workspaceId(p.submissionId))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');payload={...p};
 }else if(input.action==='REVIEW_KYC'){
  participantKeys(p,['workerId','revision','submissionId','decision','reason']);participantRevision(p.revision);
  if(!workspaceId(p.workerId)||!workspaceId(p.submissionId)||!['APPROVED','REJECTED'].includes(p.decision))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');payload={...p,reason:participantReason(p.reason)};
 }else if(input.action==='RECOVER_INVITATION'){
  participantKeys(p,['workerId','invitationId']);if(!workspaceId(p.workerId)||!/^invite_[a-f0-9]{32}$/.test(p.invitationId||''))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');payload={...p};
 }else throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');
 return {...input,operationId:input.operationId.toLowerCase(),payload};
}
export function participantKycInput(input){
 const externalChoice=Object.hasOwn(input||{},'ocrConsent')||Object.hasOwn(input||{},'ocrNoticeVersion');
 const biometricChoice=Object.hasOwn(input||{},'biometricConsent')||Object.hasOwn(input||{},'biometricNoticeVersion');
 const backChoice=hasBackChoice(input);
 participantKeys(input,['operationId','projectId','scope','workerId','revision','noticeVersion','consent','front','selfie',...(externalChoice?['ocrConsent','ocrNoticeVersion']:[]),...(biometricChoice?['biometricConsent','biometricNoticeVersion']:[]),...(backChoice?backKeys:[])]);participantContext(input);participantRevision(input.revision);
 if(!operationId(input.operationId)||!workspaceId(input.workerId)||input.consent!==true||input.noticeVersion!==PARTICIPANT_NOTICE_VERSION)throw new WorkspaceError('PARTICIPANT_PRIVACY_REQUIRED');
 if(externalChoice&&(typeof input.ocrConsent!=='boolean'||input.ocrNoticeVersion!==PARTICIPANT_OCR_NOTICE_VERSION))throw new WorkspaceError('PARTICIPANT_OCR_CONSENT_REQUIRED',400);
 if(biometricChoice&&(typeof input.biometricConsent!=='boolean'||input.biometricNoticeVersion!==PARTICIPANT_BIOMETRIC_NOTICE_VERSION))throw new WorkspaceError('PARTICIPANT_BIOMETRIC_CONSENT_REQUIRED',400);
 if(backChoice)validateBackChoice(input);
 try{return {...input,...(backChoice?{back:decodePrivateImage(input.back)}:{}),ocrConsent:externalChoice&&input.ocrConsent,ocrNoticeVersion:externalChoice?input.ocrNoticeVersion:null,biometricConsent:biometricChoice&&input.biometricConsent,biometricNoticeVersion:biometricChoice?input.biometricNoticeVersion:null,operationId:input.operationId.toLowerCase(),front:decodePrivateImage(input.front),selfie:decodePrivateImage(input.selfie)};}catch(error){throw new WorkspaceError(error instanceof PrivateImageError?error.code:'PARTICIPANT_INPUT_INVALID',error.code==='PRIVATE_IMAGE_TOO_LARGE'?413:400);}
}
export const participantReceiptId=(actorId,projectId,key)=>'participant_'+digest([actorId,projectId,key.toLowerCase()]);
export async function assertOwnParticipant(client,member,session,projectId,workerId,{lock=false}={}){
 requireWorkspaceIdentity(session);if(!workspaceId(workerId))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');
 const row=(await client.query(`SELECT id,name,active,metadata,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."Worker" WHERE id=$1 AND "projectId"=$2 ${lock?'FOR UPDATE':''}`,[workerId,projectId])).rows[0];
 const participant=row?.metadata?.participant;
 if(!row?.active||participant?.version!==1||participant.status!=='ACTIVE'||participant.clerkUserId!==session.userId)throw new WorkspaceError('PARTICIPANT_ACCESS_REQUIRED',403);
 const membership=(await client.query(`SELECT m.id FROM public."TenantMembership" m JOIN public."PlatformUser" u ON u.id=m."userId" JOIN public."ProjectMembership" pm ON pm."tenantMembershipId"=m.id WHERE m.id=$1 AND m."organizationId"=$2 AND u."clerkUserId"=$3 AND m.status='ACTIVE' AND pm."projectId"=$4 AND pm.status='ACTIVE' ${lock?'FOR SHARE OF m,u,pm':''}`,[member.membershipId,member.organizationId,session.userId,projectId])).rows;
 if(membership.length!==1)throw new WorkspaceError('PARTICIPANT_ACCESS_REQUIRED',403);
 return row;
}
export async function assertFieldParticipant(client,member,session,projectId,workerId,{permission='attendance',requireKyc=false,lock=false}={}){
 if(!['attendance','report'].includes(permission))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');
 const row=await assertOwnParticipant(client,member,session,projectId,workerId,{lock}),participant=row.metadata.participant;
 if(participant.permissions?.[permission]!==true)throw new WorkspaceError('PARTICIPANT_ACCESS_REQUIRED',403);
 if(requireKyc)await assertApprovedParticipantKyc(client,{...row,projectId},{...member,clerkUserId:session.userId});
 return row;
}
