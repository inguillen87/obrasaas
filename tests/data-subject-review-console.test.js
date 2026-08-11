import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  assertPrivacyReviewDtoSafe,
  assertPrivacySuccessfulResponseDtoSafe,
  formsFromReview,
  INITIAL_PRIVACY_REVIEW_STATE,
  PrivacyCommittedResponseError,
  privacyReviewInteractionIsLocked,
  privacyReviewReducer,
} from '../src/app/dashboard/privacy/privacy-review-state.js';

const privacyShellPath = new URL(
  '../src/app/dashboard/tenant-privacy-shell.js',
  import.meta.url,
);
const privacyConsolePath = new URL(
  '../src/app/dashboard/privacy/privacy-review-console.js',
  import.meta.url,
);
const privacyStatePath = new URL(
  '../src/app/dashboard/privacy/privacy-review-state.js',
  import.meta.url,
);
const privacyStylesPath = new URL(
  '../src/app/dashboard/privacy/privacy-review.module.css',
  import.meta.url,
);
const privacyShellStylesPath = new URL(
  '../src/app/dashboard/tenant-privacy-shell.module.css',
  import.meta.url,
);
const privacyPagePath = new URL(
  '../src/app/dashboard/privacy/page.js',
  import.meta.url,
);
const dashboardLayoutPath = new URL(
  '../src/app/dashboard/layout.js',
  import.meta.url,
);
const observabilityPath = new URL('../src/app/observability.js', import.meta.url);
const dashboardShellPath = new URL(
  '../src/app/dashboard/dashboard-shell.js',
  import.meta.url,
);
const projectAccessRequiredPath = new URL(
  '../src/app/dashboard/project-access-required.js',
  import.meta.url,
);
const accessPath = new URL('../src/lib/access.js', import.meta.url);

function reviewFixture() {
  return {
    request: {
      id: 'request-a',
      type: 'ERASURE',
      subjectKind: 'WORKER_PERSON',
      status: 'DISCOVERED',
      receivedAt: '2026-08-11T12:00:00.000Z',
      terminalAt: '2026-08-11T12:01:00.000Z',
      failureCode: null,
      subjectIdentityRevision: 3,
    },
    discovery: {
      id: 'manifest-a',
      outcome: 'BLOCKED',
      itemCount: 2,
      blockerCount: 2,
      coverageBlockerCount: 1,
      sealedAt: '2026-08-11T12:01:00.000Z',
      coverageComplete: false,
      evidenceCommitted: true,
    },
    requesterVerification: null,
    legalAssessment: null,
    holds: [],
    holdSetRevisionToken: `rv1.${'a'.repeat(43)}`,
    decision: null,
    reviewItems: [
      {
        reviewItemId: 'item-a',
        ordinal: 0,
        kind: 'RECORD',
        category: 'LABOR',
        recordType: 'Attendance',
        blockerCode: null,
        proposedDecision: null,
      },
      {
        reviewItemId: 'item-b',
        ordinal: 1,
        kind: 'COVERAGE_BLOCKER',
        category: 'MEDIA',
        recordType: 'UnknownMedia',
        blockerCode: 'LEGACY_UNAVAILABLE',
        proposedDecision: null,
      },
    ],
    reviewState: 'IDENTITY_PENDING',
    deadlineOverdue: false,
    executionAllowed: false,
  };
}

test('privacy DTO guard allows opaque CAS tokens and rejects nested evidence or PII fields', () => {
  const fixture = reviewFixture();
  assert.equal(assertPrivacyReviewDtoSafe(fixture), fixture);
  for (const unsafe of [
    { discovery: { manifestSha256: 'a'.repeat(64) } },
    { requester: { requesterFingerprintHmac: 'a'.repeat(64) } },
    { nested: [{ actorMembershipId: 'membership-a' }] },
    { subject: { phone: '+000000000' } },
  ]) {
    assert.throws(
      () => assertPrivacyReviewDtoSafe(unsafe),
      /Contrato de privacidad inválido/,
    );
  }
});

test('a malformed or forbidden POST 2xx confirmation stays commit-ambiguous', () => {
  const forbidden = {
    verification: {
      id: 'verification-a',
      requesterEvidenceSha256: 'a'.repeat(64),
    },
    replayed: false,
    executionAllowed: false,
  };
  for (const payload of [
    null,
    'confirmed',
    [],
    {},
    { replayed: false, executionAllowed: false },
    forbidden,
  ]) {
    assert.throws(
      () => assertPrivacySuccessfulResponseDtoSafe(payload, { mutation: true }),
      (error) => error instanceof PrivacyCommittedResponseError,
    );
  }
  assert.deepEqual(
    assertPrivacySuccessfulResponseDtoSafe({
      verification: {
        id: 'verification-a',
        sequence: 1,
        eventKind: 'VERIFIED',
        occurredAt: '2026-08-11T12:00:00.000Z',
        evidenceCommitted: true,
      },
      replayed: false,
      executionAllowed: false,
    }, { mutation: true }),
    {
      verification: {
        id: 'verification-a',
        sequence: 1,
        eventKind: 'VERIFIED',
        occurredAt: '2026-08-11T12:00:00.000Z',
        evidenceCommitted: true,
      },
      replayed: false,
      executionAllowed: false,
    },
  );
});

test('review forms never infer a record decision and deterministically preserve coverage blockers', () => {
  const fixture = reviewFixture();
  fixture.legalAssessment = {
    id: 'assessment-a',
    jurisdictionCode: 'AR-MZA',
    deadlinePolicyVersion: 'deadline-v1',
    retentionMatrixVersion: 'retention-v1',
  };
  fixture.holds = [{ id: 'hold-a', active: true }];
  fixture.reviewItems[0].proposedDecision = {
    action: 'ERASE_CANDIDATE',
    legalBasisCode: 'prior-basis',
    retentionPolicyVersion: 'prior-policy',
    retentionRuleCode: 'prior-rule',
    retentionUntil: '2027-08-11T12:00:00.000Z',
  };
  const forms = formsFromReview(fixture);
  assert.equal(forms.decisionItems['item-a'].action, '');
  assert.equal(forms.decisionItems['item-a'].legalBasisCode, '');
  assert.equal(forms.decisionItems['item-a'].retentionPolicyVersion, '');
  assert.equal(forms.decisionItems['item-a'].retentionRuleCode, '');
  assert.equal(forms.decisionItems['item-a'].retentionUntil, '');
  assert.equal(forms.decisionItems['item-b'].action, 'UNRESOLVED');
  assert.equal(forms.verification.expectedSubjectIdentityRevision, '3');
  assert.equal(forms.verification.eventKind, '');
  assert.equal(forms.verification.requesterKind, '');
  assert.equal(forms.assessment.expectedHeadAssessmentId, 'assessment-a');
  assert.equal(forms.assessment.jurisdictionCode, '');
  assert.equal(forms.assessment.deadlinePolicyVersion, '');
  assert.equal(forms.assessment.retentionMatrixVersion, '');
  assert.equal(forms.hold.scopeKind, '');
  assert.equal(forms.holdEvent.holdId, '');
  assert.equal(forms.holdEvent.eventKind, '');
  assert.equal(forms.approval.decision, '');
});

test('central reducer ignores stale reads and keeps the exact uncertain operation for manual retry', () => {
  const loading = privacyReviewReducer(INITIAL_PRIVACY_REVIEW_STATE, {
    type: 'REVIEW_LOADING',
    requestId: 'request-a',
    sequence: 2,
  });
  const ignored = privacyReviewReducer(loading, {
    type: 'REVIEW_SUCCESS',
    requestId: 'request-a',
    sequence: 1,
    payload: reviewFixture(),
  });
  assert.equal(ignored.review.status, 'loading');

  const operation = {
    label: 'Evaluación legal',
    requestId: 'request-a',
    url: '/api/tenant/privacy/requests/request-a/legal-assessments',
    idempotencyKey: 'privacy-12345678',
    body: { expectedHeadAssessmentId: null },
  };
  const uncertain = privacyReviewReducer(loading, {
    type: 'MUTATION_UNCERTAIN',
    operation,
    error: 'Respuesta ambigua',
  });
  assert.equal(uncertain.mutation.status, 'uncertain');
  assert.equal(uncertain.mutation.uncertainOperation, operation);
  assert.equal(uncertain.mutation.reconciliation, 'loading');

  const reconciled = privacyReviewReducer(uncertain, {
    type: 'MUTATION_RECONCILED',
    ok: true,
  });
  assert.equal(reconciled.mutation.status, 'uncertain');
  assert.equal(reconciled.mutation.uncertainOperation, operation);
  assert.equal(reconciled.mutation.reconciliation, 'complete');

  let visibleRequestId = 'request-a';
  const selectRequest = (requestId) => {
    if (!privacyReviewInteractionIsLocked(reconciled.mutation)) {
      visibleRequestId = requestId;
    }
  };
  selectRequest('request-b');
  assert.equal(visibleRequestId, 'request-a');
  assert.equal(reconciled.mutation.uncertainOperation, operation);
  assert.equal(privacyReviewInteractionIsLocked({ status: 'submitting' }), true);
  assert.equal(privacyReviewInteractionIsLocked({ status: 'reconciliation_required' }), true);
  assert.equal(privacyReviewInteractionIsLocked({ status: 'success' }), false);

  const confirmedWithoutReads = privacyReviewReducer(loading, {
    type: 'MUTATION_RECONCILIATION_REQUIRED',
    operation,
    error: 'Lecturas pendientes',
    notice: 'Registro confirmado.',
  });
  assert.equal(confirmedWithoutReads.mutation.status, 'reconciliation_required');
  assert.equal(confirmedWithoutReads.mutation.uncertainOperation, operation);
  assert.equal(
    confirmedWithoutReads.mutation.uncertainOperation.idempotencyKey,
    operation.idempotencyKey,
  );
  assert.equal(confirmedWithoutReads.mutation.reconciliationRequestId, 'request-a');
  const confirmedAndRead = privacyReviewReducer(confirmedWithoutReads, {
    type: 'MUTATION_RECONCILED',
    ok: true,
  });
  assert.equal(confirmedAndRead.mutation.status, 'success');
  assert.equal(confirmedAndRead.mutation.notice, 'Registro confirmado.');
});

test('privacy surface uses hard navigation and contains no browser persistence or measurement hooks', async () => {
  const [shell, consoleSource, dashboardShell, projectAccessRequired] = await Promise.all([
    readFile(privacyShellPath, 'utf8'),
    readFile(privacyConsolePath, 'utf8'),
    readFile(dashboardShellPath, 'utf8'),
    readFile(projectAccessRequiredPath, 'utf8'),
  ]);
  assert.doesNotMatch(shell, /next\/link|<Link\b|useRouter/);
  assert.match(shell, /<a[\s\S]*?href="\/dashboard"/);
  assert.match(shell, /Expediente de decisión no ejecutable/);
  assert.doesNotMatch(
    `${shell}\n${consoleSource}`,
    /localStorage|sessionStorage|indexedDB|document\.cookie|sendBeacon|@vercel\/analytics|console\./,
  );
  assert.match(consoleSource, /MUTATION_UNCERTAIN/);
  assert.match(consoleSource, /MUTATION_RECONCILIATION_REQUIRED/);
  assert.match(consoleSource, /error instanceof PrivacyCommittedResponseError/);
  assert.match(consoleSource, /uncertainOperation/);
  assert.match(consoleSource, /loadReview\(operation\.requestId/);
  assert.match(consoleSource, /interactionLocked=\{interactionLocked\}/);
  assert.match(consoleSource, /disabled=\{interactionLocked\}/);
  assert.match(consoleSource, /if \(!interactionLocked\) void loadReview\(requestId\)/);
  assert.match(consoleSource, /reviewReconciled && queueReconciled/);
  assert.doesNotMatch(consoleSource, /Cerrar sin reenviar/);
  assert.match(dashboardShell, /hardNavigation:\s*true/);
  assert.match(dashboardShell, /permission:\s*'canManagePrivacy'/);
  assert.match(
    dashboardShell,
    /destination\.hardNavigation[\s\S]*?<a[\s\S]*?href=\{destination\.href\}/,
  );
  assert.match(
    projectAccessRequired,
    /access\.canManagePrivacy[\s\S]*?<a[\s\S]*?href="\/dashboard\/privacy"/,
  );
});

test('privacy page and dashboard layout keep authorization and project resolution isolated', async () => {
  const [page, layout, access] = await Promise.all([
    readFile(privacyPagePath, 'utf8'),
    readFile(dashboardLayoutPath, 'utf8'),
    readFile(accessPath, 'utf8'),
  ]);
  assert.match(page, /requireProject:\s*false/);
  assert.match(page, /resolveProject:\s*false/);
  assert.match(page, /authorizeDataSubjectReviewAccess\(access\)/);
  assert.match(page, /createDataSubjectReviewReadAdapter\(getPrisma\(\)\)\.requireAdmin/);
  assert.match(page, /dataSubjectReviewScope\(access\)/);
  assert.match(page, /PRIVACY_REVIEW_FORBIDDEN/);
  assert.doesNotMatch(page, /access\.tenantRole/);
  assert.match(access, /Object\.defineProperty\(access, 'databaseTenantRole'/);
  assert.match(access, /value: membership\?\.tenantRole \|\| null/);
  assert.match(access, /enumerable: false/);
  assert.match(layout, /await headers\(\)/);
  const privacyBranch = layout.indexOf('TENANT_PRIVACY_SURFACE_VALUE');
  const shellResolution = layout.lastIndexOf('getDashboardShellModel()');
  assert.ok(privacyBranch >= 0 && privacyBranch < shellResolution);
  assert.match(layout, /<PlatformProvider>\s*<TenantPrivacyShell>/);
  assert.doesNotMatch(
    layout.match(/<PlatformProvider>[\s\S]*?<\/PlatformProvider>/)?.[0] || '',
    /includeIcons|getDashboardShellModel/,
  );
});

test('observability rejects the exact privacy route before rendering its provider', async () => {
  const source = await readFile(observabilityPath, 'utf8');
  assert.match(
    source,
    /pathname === '\/dashboard\/privacy'/,
  );
  assert.match(source, /if \(!enabled \|\| observabilityPathIsExcluded\(pathname\)\) return null/);
  assert.match(source, /observabilityPathIsExcluded\(url\.pathname\)/);
});

test('the isolated privacy UI stays real UTF-8 without mojibake markers', async () => {
  const files = [
    privacyShellPath,
    privacyShellStylesPath,
    privacyPagePath,
    privacyConsolePath,
    privacyStatePath,
    privacyStylesPath,
    dashboardLayoutPath,
    observabilityPath,
    dashboardShellPath,
    projectAccessRequiredPath,
    accessPath,
  ];
  const sources = await Promise.all(files.map((file) => readFile(file, 'utf8')));
  sources.forEach((source, index) => {
    assert.doesNotMatch(
      source,
      /\u00c3|\u00c2|\ufffd/,
      `${files[index].pathname} contains mojibake`,
    );
  });
});
