export const CERTIFICATE_READINESS_LABELS = Object.freeze({
  READY: 'Lista para preparar',
  UP_TO_DATE: 'Período al día',
  BLOCKED: 'Bloqueada',
  REVIEW_PENDING: 'Revisión pendiente',
});
export const CERTIFICATE_MODE_LABELS = Object.freeze({ FIRST: 'Primer certificado', NEXT_PERIOD: 'Período siguiente', CORRECTION: 'Corrección' });
export const CERTIFICATE_BLOCKER_LABELS = Object.freeze({
  CERT_PENDING_REVIEW: 'Existe un certificado pendiente de decisión.',
  CERT_PROJECT_ARCHIVED: 'La obra está archivada.',
  CERT_AUTHORITY_REVIEW_PENDING: 'La autoridad contractual requiere revisión.',
  CERT_CONTRACT_REVIEW_PENDING: 'El contrato requiere revisión.',
  CERT_AUTHORITY_REQUIRED: 'Falta definir la autoridad certificante.',
  CERT_CONTRACT_REQUIRED: 'Falta contrato/SOV vigente.',
  CERT_PINNED_PROVENANCE_MISMATCH: 'La procedencia fijada no coincide con el contrato o la autoridad.',
  CERT_AUTHORITY_INVALID: 'La autoridad contractual vigente no es válida.',
  HISTORICAL_RESTATEMENT_REQUIRED: 'Se requiere reexpresión histórica antes de continuar.',
  CORRECTION_REQUIRED: 'El período requiere una corrección explícita.',
  CERT_PERIOD_ORDER_INVALID: 'El orden del período no es válido.',
  CERT_TECHNICAL_CUT_REQUIRED: 'Falta el corte técnico del período.',
  CERT_TECHNICAL_CUT_STALE: 'El corte técnico quedó desactualizado.',
  CERT_TECHNICAL_MEASUREMENT_MISSING: 'Faltan mediciones técnicas requeridas.',
  CERT_CONTRACT_TECHNICAL_BASIS_MISMATCH: 'La base técnica no coincide con el contrato.',
  CERT_RETROACTIVE_CONTRACT_BASIS: 'La base contractual es retroactiva para este período.',
  CERT_CONTRACT_POLICY_UNSUPPORTED: 'La política contractual no está soportada.',
  CERT_AMOUNT_OVERFLOW: 'Los importes exceden el rango admitido.',
});
export function formatCertificateMinor(value, currency='ARS', minorUnits=2) {
  if (typeof value !== 'string' || !/^\d+$/.test(value) || !Number.isInteger(minorUnits) || minorUnits < 0 || minorUnits > 6) return `${currency} —`;
  const amount=BigInt(value), scale=10n**BigInt(minorUnits), whole=amount/scale, fraction=(amount%scale).toString().padStart(minorUnits,'0');
  const wholeText=new Intl.NumberFormat('es-AR',{maximumFractionDigits:0}).format(whole);
  return minorUnits ? `${currency} ${wholeText},${fraction}` : `${currency} ${wholeText}`;
}
export function majorToCertificateMinor(value, minorUnits=2) {
  if (typeof value !== 'string' || !Number.isInteger(minorUnits) || minorUnits < 0 || minorUnits > 6) return null;
  const normalized=value.trim().replace(',','.');
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const [whole,fraction='']=normalized.split('.');
  if (fraction.length>minorUnits) return null;
  const result=(BigInt(whole)*(10n**BigInt(minorUnits)))+BigInt((fraction+'0'.repeat(minorUnits)).slice(0,minorUnits)||'0');
  return result>0n ? result.toString() : null;
}
export function certificateSnapshotSummary(snapshot) {
  const current=snapshot?.currentApprovedCertificate||null,pending=snapshot?.pendingCertificate||null,candidate=snapshot?.candidate||null;
  return { readiness:snapshot?.readiness?.state||'BLOCKED', mode:snapshot?.readiness?.mode||null, history:Array.isArray(snapshot?.history)?snapshot.history.length:0, current, pending, candidate };
}
export function certificateCapabilityLabel(capability) {
  if (capability?.allowed) return 'Habilitada';
  const code=capability?.reasonCode;
  const labels={CERT_PREPARER_REQUIRED:'Requiere preparador designado',CERT_NOT_READY:'El período no está listo',CERT_PENDING_REQUIRED:'No hay certificado pendiente',CERT_CERTIFIER_REQUIRED:'Requiere certificador designado',CERT_MAKER_INVALID:'Preparador y certificador no pueden coincidir',CERT_APPROVAL_STALE:'El certificado cambió',CERT_CANCEL_NOT_ORPHANED:'No puede cancelarse en este estado',CERT_CANCELLER_REQUIRED:'Requiere rol habilitado para cancelar'};
  return labels[code]||'No habilitada';
}
