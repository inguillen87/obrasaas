import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const pageSource = readFileSync(
  new URL('../src/app/dashboard/inbox/page.js', import.meta.url),
  'utf8',
);
const inboxClientSource = readFileSync(
  new URL('../src/app/dashboard/inbox/inbox-client.js', import.meta.url),
  'utf8',
);
const actionSource = readFileSync(
  new URL('../src/app/dashboard/inbox/contact-onboarding-action.js', import.meta.url),
  'utf8',
);
const cssSource = readFileSync(
  new URL('../src/app/dashboard/inbox/inbox.module.css', import.meta.url),
  'utf8',
);

test('Inbox gates contact onboarding with the exact independent tenant permission', () => {
  assert.match(
    pageSource,
    /canManageOnboarding=\{hasTenantPermission\(access, 'org:workers:onboarding:manage'\)\}/,
  );
  assert.match(inboxClientSource, /canManageOnboarding = false/);
  assert.match(
    actionSource,
    /if \(!canManageOnboarding \|\| \['authorized', 'closed'\]\.includes\(onboarding\.state\)\) return null/,
  );
});

test('eligibility is server-owned from the message payload and never inferred from contact presentation', () => {
  for (const state of ['eligible', 'already_pending', 'authorized', 'conflict', 'closed']) {
    assert.match(actionSource, new RegExp(`'${state}'`));
  }
  assert.match(
    inboxClientSource,
    /const nextOnboarding = normalizeContactOnboarding\(payload\.onboarding\)/,
  );
  assert.match(inboxClientSource, /setContactOnboarding\(nextOnboarding\)/);
  assert.match(
    inboxClientSource,
    /key=\{`\$\{selectedConversation\.id\}:\$\{contactOnboarding\.state\}`\}/,
  );
  assert.doesNotMatch(actionSource, /displayName|metadata|quarantined/);
});

test('invitation POST sends only the scoped path and one stable idempotency header', () => {
  assert.match(
    actionSource,
    /`\/api\/whatsapp\/inbox\/\$\{encodeURIComponent\(conversationId\)\}\/worker-onboarding\?projectId=\$\{encodeURIComponent\(projectId\)\}`/,
  );
  assert.match(actionSource, /method: 'POST'/);
  assert.match(actionSource, /'Idempotency-Key': idempotencyKey/);
  assert.match(
    actionSource,
    /idempotencyKeyRef\.current \|\| createIdempotencyKey\(\)[\s\S]{0,100}idempotencyKeyRef\.current = idempotencyKey/,
  );
  assert.doesNotMatch(actionSource, /body:|JSON\.stringify/);
  assert.doesNotMatch(actionSource, /phone|claimToken|connectionId|providerSubject/);
});

test('success and 409 reconcile server state without optimistic authorization', () => {
  assert.match(
    actionSource,
    /await readResponse\(response\)[\s\S]{0,120}setRefreshRequired\(true\)[\s\S]{0,120}await refreshServerState\(\)/,
  );
  assert.match(
    actionSource,
    /Number\(requestError\?\.status\) === 409[\s\S]{0,360}await refreshServerState\(\{ mode: 'blocked' \}\)/,
  );
  assert.match(actionSource, /No se enviará otra invitación hasta reconciliarlo/);
  assert.doesNotMatch(actionSource, /setOnboarding|setContactOnboarding|setState\(['"]already_pending/);
  assert.match(actionSource, /Reintentar operación segura/);
});

test('delivery outcomes preserve the exact retry safety boundary', () => {
  for (const code of [
    'WORKER_ONBOARDING_INVITATION_PREPARATION_FAILED',
    'WORKER_ONBOARDING_INVITATION_DELIVERY_REJECTED',
    'WORKER_ONBOARDING_INVITATION_EXPIRED',
  ]) {
    assert.match(actionSource, new RegExp(`'${code}'`));
  }
  for (const code of [
    'WORKER_ONBOARDING_INVITATION_DELIVERY_UNKNOWN',
    'WORKER_ONBOARDING_INVITATION_CORRELATION_PENDING',
  ]) {
    assert.match(actionSource, new RegExp(`'${code}'`));
  }
  assert.match(
    actionSource,
    /SAFE_NEW_OPERATION_CODES\.has\(code\)[\s\S]{0,180}idempotencyKeyRef\.current = ''[\s\S]{0,220}mode: 'new'/,
  );
  assert.match(
    actionSource,
    /UNCERTAIN_DELIVERY_CODES\.has\(code\)[\s\S]{0,220}reconciliationModeRef\.current = 'blocked'/,
  );
  assert.match(
    actionSource,
    /reconciliationModeRef\.current = 'same'[\s\S]{0,300}refreshServerState\(\{ mode: 'same' \}\)/,
  );
});

test('contact onboarding states are accessible and responsive', () => {
  assert.match(actionSource, /aria-labelledby="contact-onboarding-title"/);
  assert.match(actionSource, /role="alert"/);
  assert.match(actionSource, /disabled=\{!online \|\| pending\}/);
  assert.match(actionSource, /href="\/dashboard\/team#worker-onboarding"/);
  assert.match(cssSource, /\.contactOnboardingCard/);
  assert.match(cssSource, /\.contactOnboardingCard\[data-tone='conflict'\]/);
  assert.match(
    cssSource,
    /@media \(max-width: 760px\)[\s\S]*?\.contactOnboardingCard[\s\S]*?grid-template-columns: auto minmax\(0, 1fr\)/,
  );
});
