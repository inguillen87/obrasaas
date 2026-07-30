import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  assertWorkerPaymentPrivacyNoticeEvidence,
  CURRENT_WORKER_PAYMENT_PRIVACY_NOTICE_VERSION,
  getCurrentWorkerPaymentPrivacyNotice,
  getWorkerPaymentPrivacyNotice,
} from '../src/lib/worker-payment-privacy-notices.js';

test('worker payment capture notice is immutable and self-verifying', () => {
  const notice = getCurrentWorkerPaymentPrivacyNotice();
  assert.equal(notice.version, CURRENT_WORKER_PAYMENT_PRIVACY_NOTICE_VERSION);
  assert.equal(
    crypto.createHash('sha256').update(notice.content, 'utf8').digest('hex'),
    notice.contentSha256,
  );
  assert.equal(Object.isFrozen(notice), true);
  assert.equal(
    assertWorkerPaymentPrivacyNoticeEvidence(notice.version, notice.contentSha256),
    notice,
  );
});

test('the current notice version and hash are authorized by the database trigger migration', async () => {
  const notice = getCurrentWorkerPaymentPrivacyNotice();
  const migration = await readFile(new URL(
    '../prisma/migrations/20260729130000_worker_payment_privacy_choices/migration.sql',
    import.meta.url,
  ), 'utf8');
  assert.match(migration, new RegExp(`NEW\\."noticeVersion" <> '${notice.version}'`));
  assert.match(migration, new RegExp(`NEW\\."noticeContentSha256" <> '${notice.contentSha256}'`));
});

test('worker payment capture notice rejects unknown versions and altered commitments', () => {
  assert.throws(
    () => getWorkerPaymentPrivacyNotice('worker-payment-capture-v999'),
    (error) => error.code === 'WORKER_PAYMENT_PRIVACY_NOTICE_NOT_FOUND',
  );
  assert.throws(
    () => assertWorkerPaymentPrivacyNoticeEvidence(
      CURRENT_WORKER_PAYMENT_PRIVACY_NOTICE_VERSION,
      '0'.repeat(64),
    ),
    (error) => error.code === 'WORKER_PAYMENT_PRIVACY_NOTICE_INTEGRITY_FAILED',
  );
});

test('worker payment capture notice states purpose, masking, non-payment and holder declaration', () => {
  const notice = getCurrentWorkerPaymentPrivacyNotice();
  assert.match(notice.content, /CBU, CVU o alias/);
  assert.match(notice.content, /haberes o reintegros laborales/);
  assert.match(notice.content, /referencia enmascarada/);
  assert.match(notice.content, /no ejecuta ningún pago/);
  assert.match(notice.content, /destino está a tu nombre/);
});
