import assert from 'node:assert/strict';
import test from 'node:test';

import {
  roleForClerkMembership,
  roleHasPermission,
} from '../src/lib/tenant-roles.js';

test('Clerk organization admins are always ObraSaaS admins', () => {
  assert.equal(roleForClerkMembership('org:admin', 'AUDITOR'), 'ADMIN');
});

test('demoting a Clerk admin removes the implicit ObraSaaS admin role', () => {
  assert.equal(roleForClerkMembership('org:member', 'ADMIN'), 'AUDITOR');
});

test('tenant roles enforce least privilege', () => {
  assert.equal(roleHasPermission('ADMIN', 'tenant:members:manage'), true);
  assert.equal(roleHasPermission('DIRECTOR', 'org:costs:manage'), true);
  assert.equal(roleHasPermission('SITE_MANAGER', 'org:field:manage'), true);
  assert.equal(roleHasPermission('FINANCE', 'org:costs:manage'), true);
  assert.equal(roleHasPermission('AUDITOR', 'org:projects:manage'), false);
  assert.equal(roleHasPermission('AUDITOR', 'org:projects:read'), true);
});
