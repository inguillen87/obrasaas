import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import {
  credentialLastFour,
  decryptCredential,
  encryptCredential,
} from '../src/lib/credentials.js';

test('tenant credentials use authenticated encryption and round-trip', () => {
  const previous = process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY;
  process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  try {
    const encrypted = encryptCredential('EAAB-secret-token-1234');
    assert.notEqual(encrypted.includes('secret-token'), true);
    assert.equal(decryptCredential(encrypted), 'EAAB-secret-token-1234');
    assert.equal(credentialLastFour('EAAB-secret-token-1234'), '1234');
  } finally {
    if (previous === undefined) delete process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY;
    else process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY = previous;
  }
});

test('tampered credentials fail authentication', () => {
  const previous = process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY;
  process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  try {
    const encrypted = encryptCredential('tenant-token');
    const parts = encrypted.split('.');
    const authenticationTag = Buffer.from(parts[2], 'base64url');
    authenticationTag[0] ^= 0x01;
    parts[2] = authenticationTag.toString('base64url');
    assert.throws(() => decryptCredential(parts.join('.')));
  } finally {
    if (previous === undefined) delete process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY;
    else process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY = previous;
  }
});
