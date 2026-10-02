// Shared, versioned notice. This module has no identity/provider/storage access.
export const WORKER_TEMPLATE_CONSENT_PURPOSE='worksite-operational-templates';
export const WORKER_TEMPLATE_NOTICE_VERSION='worksite-templates-v1';
export const WORKER_TEMPLATE_NOTICE='Autorizo recibir en mi WhatsApp vinculado avisos operativos de esta obra, como recordatorios de jornada, pedidos de evidencia y avisos de revisión. La autorización no aprueba trabajo ni concede permisos. Puedo retirarla desde Mi cuenta; los mensajes que ya se hayan enviado no se pueden retirar.';
export const WORKER_TEMPLATE_NOTICE_SHA256='a0374dfcb712a41a1968552986436c93ef2390df0bae8b1ab3f87e9db075e089';
export function workerTemplateConsentMatches(consent,binding){
 return Boolean(consent?.version===1&&consent.status==='GRANTED'&&consent.purpose===WORKER_TEMPLATE_CONSENT_PURPOSE&&consent.noticeVersion===WORKER_TEMPLATE_NOTICE_VERSION&&consent.noticeSha256===WORKER_TEMPLATE_NOTICE_SHA256&&consent.bindingId===binding?.id&&/^worker_channel_[a-f0-9]{64}$/.test(consent.receiptId||'')&&Number.isFinite(Date.parse(consent.grantedAt))&&!consent.revokedAt);
}
