import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isSuperadminEmail,
  normalizeVerifiedEmail,
  SUPERADMIN_EMAIL,
  systemRoleForVerifiedEmail,
} from '../src/lib/platform-identity.js';

test('the platform has exactly one immutable superadmin email identity', () => {
  assert.equal(SUPERADMIN_EMAIL, 'guillen.marce@gmail.com');
  assert.equal(isSuperadminEmail('  GUILLEN.MARCE@GMAIL.COM '), true);
  assert.equal(systemRoleForVerifiedEmail('guillen.marce@gmail.com'), 'SUPERADMIN');
});

test('every other verified email is a tenant user', () => {
  for (const value of [
    'admin@constructora.com',
    'guillen.marce+otra@gmail.com',
    'guillen.marce@gmail.com.ar',
    '',
    null,
  ]) {
    assert.equal(systemRoleForVerifiedEmail(value), 'TENANT_USER');
  }
  assert.equal(normalizeVerifiedEmail('  PERSONA@EMPRESA.COM '), 'persona@empresa.com');
});
