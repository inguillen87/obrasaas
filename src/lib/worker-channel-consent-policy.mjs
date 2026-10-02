import {createHash} from 'node:crypto';

// Server-derived notice. The browser displays the authenticated GET snapshot;
// it never chooses the company name or computes authoritative consent evidence.
export const WORKER_TEMPLATE_CONSENT_PURPOSE='worksite-operational-templates';
export const WORKER_TEMPLATE_NOTICE_VERSION='worksite-templates-v2';
// Immutable legacy evidence is retained solely for historical receipt replay.
export const LEGACY_WORKER_TEMPLATE_NOTICE_VERSION='worksite-templates-v1';
export const LEGACY_WORKER_TEMPLATE_NOTICE='Autorizo recibir en mi WhatsApp vinculado avisos operativos de esta obra, como recordatorios de jornada, pedidos de evidencia y avisos de revisión. La autorización no aprueba trabajo ni concede permisos. Puedo retirarla desde Mi cuenta; los mensajes que ya se hayan enviado no se pueden retirar.';
export const LEGACY_WORKER_TEMPLATE_NOTICE_SHA256='a0374dfcb712a41a1968552986436c93ef2390df0bae8b1ab3f87e9db075e089';
export function buildWorkerTemplateNotice({organizationId,organizationName}={}){
 if(typeof organizationId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(organizationId)||typeof organizationName!=='string'||!organizationName.trim()||organizationName.trim().length>120||/[\u0000-\u001f\u007f<>]/.test(organizationName))throw new TypeError('A canonical company identity is required');
 const name=organizationName.trim(),text='Autorizo a '+name+' a enviarme en mi WhatsApp vinculado avisos operativos de esta obra, como recordatorios de jornada, pedidos de evidencia y avisos de revisión. La autorización no aprueba trabajo ni concede permisos. Puedo retirarla desde Mi cuenta; los mensajes que ya se hayan enviado no se pueden retirar.';
 return {version:WORKER_TEMPLATE_NOTICE_VERSION,organizationId,organizationName:name,text,sha256:createHash('sha256').update(text,'utf8').digest('hex')};
}
export function workerTemplateConsentNoticeMatches(consent,notice){
 return Boolean(notice?.version===WORKER_TEMPLATE_NOTICE_VERSION&&consent?.noticeVersion===notice.version&&consent.noticeSha256===notice.sha256&&consent.noticeOrganizationId===notice.organizationId);
}
export function workerTemplateConsentMatches(consent,binding,notice){
 return Boolean(consent?.version===1&&consent.status==='GRANTED'&&consent.purpose===WORKER_TEMPLATE_CONSENT_PURPOSE&&workerTemplateConsentNoticeMatches(consent,notice)&&consent.bindingId===binding?.id&&/^worker_channel_[a-f0-9]{64}$/.test(consent.receiptId||'')&&Number.isFinite(Date.parse(consent.grantedAt))&&!consent.revokedAt);
}
