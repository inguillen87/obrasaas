import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const pageSource = readFileSync(
  new URL('../src/app/dashboard/team/page.js', import.meta.url),
  'utf8',
);
const clientSource = readFileSync(
  new URL('../src/app/dashboard/team/worker-onboarding-client.js', import.meta.url),
  'utf8',
);
const workersSource = readFileSync(
  new URL('../src/app/dashboard/team/field-workers-client.js', import.meta.url),
  'utf8',
);
const cssSource = readFileSync(
  new URL('../src/app/dashboard/team/team.module.css', import.meta.url),
  'utf8',
);

test('Equipo mounts the onboarding queue before field workers with independent exact permissions', () => {
  assert.match(
    pageSource,
    /const canReadOnboarding = hasTenantPermission\(access, 'org:workers:onboarding:read'\)/,
  );
  assert.match(
    pageSource,
    /const canManageOnboarding = hasTenantPermission\(access, 'org:workers:onboarding:manage'\)/,
  );
  assert.match(
    pageSource,
    /\{canReadOnboarding && \([\s\S]{0,220}<WorkerOnboardingClient[\s\S]{0,160}canManage=\{canManageOnboarding\}[\s\S]{0,160}canRead=\{canReadOnboarding\}/,
  );
  assert.ok(
    pageSource.indexOf('<WorkerOnboardingClient') < pageSource.indexOf('<FieldWorkersClient'),
    'the review queue must precede the active-worker administration surface',
  );
});

test('onboarding queue covers every governed status with cursor paging and refresh-on-visibility only', () => {
  for (const status of [
    'SUBMITTED',
    'PENDING',
    'APPROVED',
    'REJECTED',
    'EXPIRED',
    'CANCELLED',
  ]) {
    assert.match(clientSource, new RegExp(`key: '${status}'`));
  }
  assert.match(
    clientSource,
    /new URLSearchParams\(\{ status, limit: String\(PAGE_SIZE\) \}\)/,
  );
  assert.match(clientSource, /if \(append && cursor\) params\.set\('cursor', cursor\)/);
  assert.match(clientSource, /cache: 'no-store'/);
  assert.match(clientSource, /document\.addEventListener\('visibilitychange', refreshWhenVisible\)/);
  assert.match(clientSource, /onClick=\{\(\) => void loadClaims\(activeStatus\)\}/);
  assert.doesNotMatch(clientSource, /setInterval|setTimeout/);
});

test('decisions are revisioned, replay-safe, non-optimistic, and reload on conflict', () => {
  assert.match(clientSource, /'Idempotency-Key': idempotencyKey/);
  assert.match(clientSource, /expectedRevision: claim\.revision/);
  assert.match(
    clientSource,
    /decisionAttemptsRef\.current\.get\(attemptIdentity\)[\s\S]{0,160}decisionAttemptsRef\.current\.set\(attemptIdentity, idempotencyKey\)/,
  );
  assert.match(
    clientSource,
    /const result = await readResponse\([\s\S]{0,900}await loadClaims\('SUBMITTED'\)/,
  );
  assert.match(
    clientSource,
    /Number\(error\?\.status\) === 409[\s\S]{0,520}await loadClaims\('SUBMITTED'\)/,
  );
  assert.match(clientSource, /rejectionReason\.length < 1 \|\| rejectionReason\.length > 500/);
  assert.match(clientSource, /maxLength=\{500\}/);
  assert.doesNotMatch(clientSource, /setPages\([\s\S]{0,220}filter\(.*claim\.id/);
  assert.equal(
    (clientSource.match(/\(action === 'APPROVE' && !claim\.reviewReady\)/g) || []).length,
    2,
    'approval must be guarded both before opening and before submitting a decision',
  );
});

test('the client projects only the existing masked queue DTO and never renders connection internals', () => {
  assert.match(clientSource, /const legalName = textValue\(identitySource\.legalName\)/);
  assert.match(clientSource, /const maskedCuil = textValue\(identitySource\.maskedCuil\)/);
  assert.match(
    clientSource,
    /sender: safeRetentionState === 'ACTIVE'[\s\S]{0,100}textValue\(source\.sender/,
  );
  assert.match(clientSource, /RETENTION_STATES = new Set\(\['ACTIVE', 'PENDING_PURGE', 'PURGED'\]\)/);
  assert.match(clientSource, /Datos sensibles eliminados seg/);
  assert.match(clientSource, /Datos sensibles fuera de vista/);
  assert.match(clientSource, /const workerId = textValue\(resolutionSource\.workerId\)/);
  assert.match(clientSource, /const verificationSource = objectValue\(source\.verification\)/);
  assert.match(clientSource, /source\.reviewReady === true/);
  assert.match(clientSource, /safeVerificationState === 'VERIFIED'/);
  for (const date of ['createdAt', 'expiresAt', 'submittedAt', 'reviewedAt']) {
    assert.match(clientSource, new RegExp(`${date}: dateValue\\(source\\.${date}\\)`));
  }
  assert.doesNotMatch(
    clientSource,
    /connectionId|personId|channelIdentityId|claimToken|encryptedPayload|fingerprint|wrappingKey|providerSubject/,
  );
  assert.doesNotMatch(clientSource, /localStorage|sessionStorage|console\./);
});

test('submitted claims remain rejectable while approval waits for the exact WhatsApp receipt', () => {
  assert.match(
    clientSource,
    /claim\.status === 'SUBMITTED' && !claim\.reviewReady[\s\S]{0,420}Confirmando WhatsApp\.[\s\S]{0,220}alta operativa declarada[\s\S]{0,220}identidad civil/,
  );
  assert.match(
    clientSource,
    /onClick=\{\(\) => onOpenDecision\(claim, 'REJECT'\)\}[\s\S]{0,100}disabled=\{Boolean\(pendingDecision\)\}/,
  );
  assert.match(
    clientSource,
    /onClick=\{\(\) => onOpenDecision\(claim, 'APPROVE'\)\}[\s\S]{0,120}disabled=\{Boolean\(pendingDecision\) \|\| !claim\.reviewReady\}/,
  );
  assert.match(
    clientSource,
    /\{claim\.reviewReady \? 'Revisar y aprobar' : 'Confirmando WhatsApp'\}/,
  );
  assert.match(cssSource, /\.onboardingVerificationPending/);
});

test('the legacy direct worker form is explicitly exceptional and approved cards link to the worker', () => {
  assert.match(workersSource, /Alta administrativa heredada · uso excepcional/);
  assert.match(workersSource, /Crear alta excepcional/);
  assert.match(workersSource, /id=\{`field-worker-\$\{worker\.id\}`\}/);
  assert.match(clientSource, /href=\{`#field-worker-\$\{claim\.resolution\.workerId\}`\}/);
  assert.match(cssSource, /\.legacyWorkerNotice/);
  assert.match(cssSource, /\.onboardingPanel/);
  assert.match(cssSource, /\.onboardingFilters button\[aria-pressed="true"\]/);
  assert.match(cssSource, /@media \(max-width: 620px\)/);
});

test('approval copy distinguishes operational enablement from civil-identity review', () => {
  assert.match(clientSource, /Alta operativa aprobada/);
  assert.match(clientSource, /nombre completo visible y el CUIL enmascarado/);
  assert.match(clientSource, /La identidad civil conserva su revisión documental separada/);
  assert.match(clientSource, /el teléfono y el CUIL se muestran enmascarados/);
  assert.doesNotMatch(clientSource, /Identidad aprobada y vinculada/);
  assert.doesNotMatch(clientSource, /los datos declarados permanecen enmascarados/);
});
