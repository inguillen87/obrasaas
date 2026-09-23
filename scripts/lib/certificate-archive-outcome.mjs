// Verification-only policy: error identity AND committed state must agree.
// Never imported by application authorization or mutation handlers.
export function isControlledArchiveLoser({ prepareWon, error, state } = {}) {
  if (typeof prepareWon !== 'boolean' || !state || state.actorActive !== true) return false;
  const matches = (code, marker) => error?.code === code
    && typeof error.message === 'string'
    && (error.message === marker || error.message.startsWith(marker + ':'));
  if (prepareWon) {
    if (state.status !== 'ACTIVE' || state.preparerEligible !== true
      || state.versions !== 1 || typeof state.pending !== 'string' || !state.pending) return false;
    return matches('55000', 'PROJECT_ARCHIVE_BLOCKED_BY_PENDING_GOVERNANCE')
      || matches('40001', 'PROJECT_ARCHIVE_BUSY');
  }
  if (state.status !== 'ARCHIVED' || state.preparerEligible !== false
    || state.versions !== 0 || state.pending !== null) return false;
  return matches('55000', 'PROJECT_CERTIFICATE_NOT_READY')
    || matches('42501', 'PROJECT_CERTIFICATE_PREPARER_REQUIRED');
}
