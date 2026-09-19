const CODES = new Set(['WHATSAPP_TOKEN_EXPIRED', 'WHATSAPP_TOKEN_INVALID', 'WHATSAPP_PLATFORM_NOT_READY', 'WHATSAPP_CONNECTION_NOT_OPERATIONAL', 'WHATSAPP_CHANNEL_NOT_READY']);
const ACTIONS = new Set(['RECONNECT', 'VERIFY_CHANNEL', 'CHECK_CONNECTION', 'CONTACT_PLATFORM']);
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
export function validPilotProofRecovery(value) {
  return Boolean(value && value.version === 1 && typeof value.sendAllowed === 'boolean'
    && ['VALID','INVALID','EXPIRED','UNKNOWN'].includes(value.tokenStatus)
    && date(value.checkedAt) && (value.credentialExpiresAt === null || date(value.credentialExpiresAt))
    && value.basis === 'STORED_PROVIDER_STATE' && value.providerVerifiedByThisRead === false
    && (value.sendAllowed ? value.blocker === null && value.tokenStatus === 'VALID' : value.blocker
      && CODES.has(value.blocker.code) && ACTIONS.has(value.blocker.action)
      && typeof value.blocker.title === 'string' && value.blocker.title.length <= 150
      && typeof value.blocker.message === 'string' && value.blocker.message.length <= 600));
}
export function pilotProofCanSend(snapshot, elapsedMs = 0) {
  if (!validPilotProofRecovery(snapshot?.recovery) || !snapshot.recovery.sendAllowed || snapshot.inbound?.canReply !== true) return false;
  const expires = snapshot.recovery.credentialExpiresAt;
  return !expires || Date.parse(expires) > Date.parse(snapshot.recovery.checkedAt) + Math.max(0, elapsedMs);
}
export function pilotProofRecoveryLabel(code) {
  return ['WHATSAPP_TOKEN_EXPIRED','WHATSAPP_TOKEN_INVALID'].includes(code)
    ? 'Renovar la autorización del piloto' : 'Revisar la configuración del piloto';
}
