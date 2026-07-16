import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MEDICAL_WEBVIEW_CLAIM_LIMIT,
  WebviewSecurityError,
  claimMedicalWebviewToken,
  medicalWebviewTokenFingerprint,
} from '../src/lib/webview-security.js';

const claim = {
  token: 'signed-medical-token',
  workerId: 'worker-a',
  projectId: 'project-a',
  organizationId: 'organization-a',
  now: new Date('2026-07-16T12:00:00.000Z'),
};

test('medical token claims store only a fingerprint under a deterministic unique ID', async () => {
  let countArgs;
  let createArgs;
  const prisma = {
    auditLog: {
      count: async (args) => {
        countArgs = args;
        return 0;
      },
      create: async (args) => {
        createArgs = args;
        return args.data;
      },
    },
  };

  const result = await claimMedicalWebviewToken(prisma, claim);
  const fingerprint = medicalWebviewTokenFingerprint(claim);
  assert.equal(result.fingerprint, fingerprint);
  assert.equal(createArgs.data.id, `medical-token-${fingerprint}`);
  assert.equal(createArgs.data.metadata.tokenFingerprint, fingerprint.slice(0, 16));
  assert.equal(JSON.stringify(createArgs).includes(claim.token), false);
  assert.equal(countArgs.where.entityId, claim.workerId);
});

test('medical token replay is rejected even under concurrent requests', async () => {
  const prisma = {
    auditLog: {
      count: async () => 0,
      create: async () => {
        const error = new Error('duplicate primary key');
        error.code = 'P2002';
        throw error;
      },
    },
  };

  await assert.rejects(
    claimMedicalWebviewToken(prisma, claim),
    (error) => (
      error instanceof WebviewSecurityError
      && error.code === 'MEDICAL_WEBVIEW_TOKEN_USED'
      && error.status === 409
    ),
  );
});

test('medical token claims are rate limited per worker', async () => {
  let created = false;
  const prisma = {
    auditLog: {
      count: async () => MEDICAL_WEBVIEW_CLAIM_LIMIT,
      create: async () => {
        created = true;
      },
    },
  };

  await assert.rejects(
    claimMedicalWebviewToken(prisma, claim),
    (error) => error.code === 'MEDICAL_WEBVIEW_RATE_LIMITED' && error.status === 429,
  );
  assert.equal(created, false);
});
