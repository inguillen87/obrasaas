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

test('custom Clerk roles map to the same ObraSaaS tenant roles', () => {
  assert.equal(roleForClerkMembership('org:director'), 'DIRECTOR');
  assert.equal(roleForClerkMembership('org:site_manager'), 'SITE_MANAGER');
  assert.equal(roleForClerkMembership('org:finance'), 'FINANCE');
  assert.equal(roleForClerkMembership('org:auditor'), 'AUDITOR');
});

test('generic Clerk members preserve an explicitly assigned operational role', () => {
  assert.equal(roleForClerkMembership('org:member', 'SITE_MANAGER'), 'SITE_MANAGER');
  assert.equal(roleForClerkMembership('org:member', 'FINANCE'), 'FINANCE');
});

test('tenant roles enforce least privilege', () => {
  assert.equal(roleHasPermission('ADMIN', 'tenant:members:manage'), true);
  assert.equal(roleHasPermission('DIRECTOR', 'org:costs:manage'), true);
  assert.equal(roleHasPermission('DIRECTOR', 'org:field:evidence:read'), true);
  assert.equal(roleHasPermission('DIRECTOR', 'org:operational-proposals:manage'), true);
  assert.equal(roleHasPermission('DIRECTOR', 'org:workers:onboarding:manage'), true);
  assert.equal(roleHasPermission('DIRECTOR', 'org:workers:identity:verify'), true);
  assert.equal(roleHasPermission('DIRECTOR', 'org:payroll:destinations:activate'), true);
  assert.equal(roleHasPermission('DIRECTOR', 'org:payroll:destinations:manage'), false);
  assert.equal(roleHasPermission('DIRECTOR', 'org:inventory:read'), true);
  assert.equal(roleHasPermission('DIRECTOR', 'org:inventory:manage'), true);
  assert.equal(roleHasPermission('SITE_MANAGER', 'org:field:manage'), true);
  assert.equal(roleHasPermission('SITE_MANAGER', 'org:field:evidence:read'), false);
  assert.equal(roleHasPermission('SITE_MANAGER', 'org:operational-proposals:manage'), true);
  assert.equal(roleHasPermission('SITE_MANAGER', 'org:workers:onboarding:manage'), true);
  assert.equal(roleHasPermission('SITE_MANAGER', 'org:workers:identity:verify'), false);
  assert.equal(roleHasPermission('SITE_MANAGER', 'org:payroll:destinations:read'), false);
  assert.equal(roleHasPermission('SITE_MANAGER', 'org:inventory:read'), true);
  assert.equal(roleHasPermission('SITE_MANAGER', 'org:inventory:manage'), true);
  assert.equal(roleHasPermission('FINANCE', 'org:costs:manage'), true);
  assert.equal(roleHasPermission('FINANCE', 'org:operational-proposals:read'), true);
  assert.equal(roleHasPermission('FINANCE', 'org:operational-proposals:manage'), false);
  assert.equal(roleHasPermission('FINANCE', 'org:payroll:destinations:manage'), true);
  assert.equal(roleHasPermission('FINANCE', 'org:payroll:destinations:activate'), false);
  assert.equal(roleHasPermission('FINANCE', 'org:inventory:read'), true);
  assert.equal(roleHasPermission('FINANCE', 'org:inventory:manage'), false);
  assert.equal(roleHasPermission('AUDITOR', 'org:projects:manage'), false);
  assert.equal(roleHasPermission('AUDITOR', 'org:projects:read'), true);
  assert.equal(roleHasPermission('AUDITOR', 'org:operational-proposals:read'), true);
  assert.equal(roleHasPermission('AUDITOR', 'org:operational-proposals:manage'), false);
  assert.equal(roleHasPermission('AUDITOR', 'org:workers:identity:read'), false);
  assert.equal(roleHasPermission('AUDITOR', 'org:inventory:read'), true);
  assert.equal(roleHasPermission('AUDITOR', 'org:inventory:manage'), false);
});
