// Synthetic DTOs for UI tests only. Never imported by product code.
export const scope = { organizationId: 'organization-test', projectId: 'project-test' };
export const PREPARER = 'membership-preparer';
export const CERTIFIER = 'membership-certifier';
export const HASH = 'a'.repeat(64);
export const DATE = '2026-09-26';
export const period = { start: '2026-09-16', end: '2026-09-30' };
export const terms = { currencyCode: 'ARS', currencyMinorUnits: 2, retentionBps: 500 };
const totals = { certificateIncrementGrossMinor: '3125000', certificateIncrementRetentionMinor: '156250' };
export const pending = {
  id: 'certificate-test', projectSequence: '1', periodVersion: 1, period, terms,
  preparedByMembershipId: PREPARER, lineCount: 1, valuedLineCount: 1, noClaimLineCount: 0,
  deductionCount: 1, totals: { ...totals, certificateIncrementDeductionsMinor: '1234', certificateIncrementNetMinor: '2967516' },
  integrityDigest: HASH, candidateDigest: HASH, decision: null,
};
const candidate = { period, mode: 'FIRST', expectedBookRevision: 0, expectedPeriodHeadRevision: 0,
  expectedCurrentApprovedVersionId: null, terms, totals, lineCount: 1, valuedLineCount: 1, noClaimLineCount: 0,
  lines: [{ taskId: 'task-test', taskCode: 'EST-01', taskTitle: 'Estructura nivel 1', state: 'VALUED',
    periodQuantity: '25.0000', unitCode: 'M3', certificateIncrementGrossMinor: '3125000' }],
};
const denied = reasonCode => ({ allowed: false, reasonCode, expectedActorMembershipId: null, targetId: null });
const allowed = (actor, targetId = null) => ({ allowed: true, reasonCode: null, expectedActorMembershipId: actor, targetId });
export function fixtureSnapshot(state = 'READY', actor = PREPARER) {
  const isPending = state === 'PENDING', approved = state === 'APPROVED';
  const certificate = approved ? { ...pending, decision: { id: 'decision-test', decision: 'APPROVED',
    reason: 'Conformidad contractual verificada.', decidedByMembershipId: CERTIFIER } } : pending;
  const decisionCap = isPending && actor === CERTIFIER ? allowed(actor, pending.id)
    : { ...denied(isPending ? 'CERT_MAKER_INVALID' : 'CERT_PENDING_REQUIRED'), targetId: isPending ? pending.id : null };
  return {
    ...scope, requestedPeriod: period, executionAllowed: false, historyLimit: 20,
    book: state === 'READY' ? null : { revision: isPending ? 1 : 2, pendingCertificateVersionId: isPending ? pending.id : null },
    periodHead: state === 'READY' ? null : { revision: isPending ? 1 : 2, latestVersionId: pending.id, currentApprovedVersionId: approved ? pending.id : null },
    currentApprovedCertificate: approved ? certificate : null, pendingCertificate: isPending ? pending : null,
    history: state === 'READY' ? [] : [certificate], candidate: state === 'READY' ? candidate : null,
    readiness: { state: state === 'READY' ? 'READY' : isPending ? 'REVIEW_PENDING' : 'UP_TO_DATE',
      mode: state === 'READY' ? 'FIRST' : null, blockingReasons: isPending ? ['CERT_PENDING_REVIEW'] : [] },
    capabilities: { read: allowed(actor), prepare: state === 'READY' && actor === PREPARER ? allowed(actor) : denied('CERT_PREPARER_REQUIRED'),
      approve: decisionCap, reject: decisionCap, cancel: { ...denied('CERT_CANCEL_NOT_ORPHANED'), targetId: isPending ? pending.id : null } },
  };
}
export function fixtureReceipt(kind, body, actor, replayed = false) {
  const prepare = kind === 'PREPARE';
  const certificate = prepare ? pending : { id: pending.id, period, integrityDigest: HASH };
  return { receipt: {
    operationReceiptId: `receipt-${kind}`, operationKind: kind, certificateVersionId: pending.id,
    decisionId: prepare ? null : 'decision-test', actorMembershipId: actor,
    bookRevisionAfter: body.expectedBookRevision + 1, periodHeadRevisionAfter: body.expectedPeriodHeadRevision + 1, replayed,
  }, certificate, book: { revision: body.expectedBookRevision + 1, pendingCertificateVersionId: prepare ? pending.id : null },
    periodHead: { revision: body.expectedPeriodHeadRevision + 1, latestVersionId: pending.id, currentApprovedVersionId: prepare ? null : pending.id },
    ...(!prepare ? { decision: { id: 'decision-test', decision: { APPROVE: 'APPROVED', REJECT: 'REJECTED', CANCEL: 'CANCELLED' }[kind],
      reason: body.reason, decidedByMembershipId: actor } } : {}), executionAllowed: false };
}
