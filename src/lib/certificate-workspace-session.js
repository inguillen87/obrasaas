// Client-side response guards. PostgreSQL remains the authority for permissions,
// financial calculations, revision checks and actor-bound idempotent replay.
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const id = value => typeof value === 'string' && value.trim().length > 0;
const revision = value => Number.isSafeInteger(value) && value >= 0;
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const money = value => typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value);
const capabilityNames = ['read', 'prepare', 'approve', 'reject', 'cancel'];

export function certificatePeriodForDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  const prefix = value.slice(0, 8), day = Number(value.slice(8));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  return { start: `${prefix}${day <= 15 ? '01' : '16'}`, end: `${prefix}${day <= 15 ? '15' : end}` };
}
export const sameCertificatePeriod = (left, right) => Boolean(left && right && left.start === right.start && left.end === right.end);
const validTerms = value => object(value) && /^[A-Z]{3}$/.test(value.currencyCode) &&
  Number.isInteger(value.currencyMinorUnits) && value.currencyMinorUnits >= 0 && value.currencyMinorUnits <= 6;
const validTotals = value => object(value) && ['certificateIncrementGrossMinor', 'certificateIncrementRetentionMinor']
  .every(field => money(value[field]));
const validCertificate = value => object(value) && id(value.id) && object(value.period) &&
  validTerms(value.terms) && validTotals(value.totals) &&
  money(value.totals.certificateIncrementDeductionsMinor) && money(value.totals.certificateIncrementNetMinor) &&
  digest(value.integrityDigest) && revision(value.lineCount) && revision(value.deductionCount);

export function certificateSnapshotMatches(value, scope, periodDate, actorMembershipId) {
  if (!object(value) || !id(scope?.organizationId) || !id(scope?.projectId) || !id(actorMembershipId) ||
      value.organizationId !== scope.organizationId || value.projectId !== scope.projectId ||
      value.executionAllowed !== false || !sameCertificatePeriod(value.requestedPeriod, certificatePeriodForDate(periodDate)) ||
      !Array.isArray(value.history) || value.history.length > 20 || !value.history.every(validCertificate) ||
      !object(value.readiness) || !['READY', 'UP_TO_DATE', 'BLOCKED', 'REVIEW_PENDING'].includes(value.readiness.state) ||
      !Array.isArray(value.readiness.blockingReasons) || !value.readiness.blockingReasons.every(id) ||
      !object(value.capabilities) || !capabilityNames.every(name => typeof value.capabilities[name]?.allowed === 'boolean') ||
      value.capabilities.read.allowed !== true) return false;
  if (value.book !== null && (!object(value.book) || !revision(value.book.revision))) return false;
  if (value.periodHead !== null && (!object(value.periodHead) || !revision(value.periodHead.revision))) return false;
  if (value.currentApprovedCertificate !== null && !validCertificate(value.currentApprovedCertificate)) return false;
  if (value.pendingCertificate !== null && !validCertificate(value.pendingCertificate)) return false;
  if (value.candidate !== null) {
    const candidate = value.candidate;
    if (!object(candidate) || !sameCertificatePeriod(candidate.period, value.requestedPeriod) ||
        !validTerms(candidate.terms) || !validTotals(candidate.totals) || !Array.isArray(candidate.lines) ||
        !candidate.lines.every(line => object(line) && id(line.taskId) && id(line.taskTitle)) ||
        candidate.expectedBookRevision !== (value.book?.revision ?? 0) ||
        candidate.expectedPeriodHeadRevision !== (value.periodHead?.revision ?? 0)) return false;
  }
  if (value.capabilities.prepare.allowed && (!value.candidate || value.readiness.state !== 'READY')) return false;
  return ['prepare', 'approve', 'reject', 'cancel'].every(name => {
    const cap = value.capabilities[name];
    return !cap.allowed || (cap.expectedActorMembershipId === actorMembershipId &&
      (name === 'prepare' || cap.targetId === value.pendingCertificate?.id));
  });
}

export function certificateReceiptMatches(value, attempt, actorMembershipId) {
  const receipt = value?.receipt, certificate = value?.certificate;
  if (!object(value) || value.executionAllowed !== false || !object(receipt) || !object(certificate) ||
      !id(receipt.operationReceiptId) || receipt.operationKind !== attempt.kind ||
      receipt.actorMembershipId !== actorMembershipId || typeof receipt.replayed !== 'boolean' ||
      !id(receipt.certificateVersionId) || certificate.id !== receipt.certificateVersionId ||
      receipt.bookRevisionAfter !== attempt.body.expectedBookRevision + 1 ||
      receipt.periodHeadRevisionAfter !== attempt.body.expectedPeriodHeadRevision + 1 ||
      value.book?.revision !== receipt.bookRevisionAfter || value.periodHead?.revision !== receipt.periodHeadRevisionAfter) return false;
  if (attempt.kind === 'PREPARE') return receipt.decisionId === null &&
    certificate.preparedByMembershipId === actorMembershipId &&
    sameCertificatePeriod(certificate.period, certificatePeriodForDate(attempt.periodDate));
  const decisions = { APPROVE: 'APPROVED', REJECT: 'REJECTED', CANCEL: 'CANCELLED' };
  return certificate.id === attempt.certificateId && certificate.integrityDigest === attempt.body.expectedCertificateDigest &&
    sameCertificatePeriod(certificate.period, certificatePeriodForDate(attempt.periodDate)) &&
    id(receipt.decisionId) && value.decision?.id === receipt.decisionId &&
    value.decision?.decision === decisions[attempt.kind] && value.decision?.reason === attempt.body.reason &&
    value.decision?.decidedByMembershipId === actorMembershipId;
}

export function certificateFailureMessage(error, mutation = false) {
  if (error?.code === 'EVIDENCE_CONTEXT_CHANGED' || error?.code === 'CERTIFICATE_CONTEXT_CHANGED')
    return 'La sesión cambió de empresa, obra o usuario. Volvé al contexto original antes de continuar.';
  if ([401, 403, 404].includes(error?.status)) return 'No se pudo verificar tu acceso. Volvé a ingresar a esta obra.';
  if (error?.status === 409) return 'El certificado o sus autoridades cambiaron. Actualizá el período antes de continuar.';
  if ([400, 413, 422].includes(error?.status)) return 'Revisá los importes, motivos y datos del certificado antes de continuar.';
  return mutation ? 'Resultado por confirmar. Conservamos el mismo intento; no prepares ni decidas otra vez con datos distintos.'
    : 'No se pudo verificar el período. Reintentá la consulta; las acciones están bloqueadas.';
}

export function certificateFailureIsUncertain(error) {
  const status = Number(error?.status);
  return !Number.isFinite(status) || status >= 500 || [408, 425, 429].includes(status);
}
