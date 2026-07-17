import assert from 'node:assert/strict';
import test from 'node:test';

import {
  acceptedInvitationRole,
  parseInvitationInput,
  tenantRoleFromInvitation,
} from '../src/lib/invitations.js';
import { roleForClerkMembership } from '../src/lib/tenant-roles.js';

test('invitation input normalizes email and maps only admins to Clerk admin', () => {
  assert.deepEqual(
    parseInvitationInput({ email: ' DIRECTOR@Empresa.com ', tenantRole: 'director' }),
    { email: 'director@empresa.com', tenantRole: 'DIRECTOR', clerkRole: 'org:member' },
  );
  assert.equal(
    parseInvitationInput({ email: 'admin@empresa.com', tenantRole: 'ADMIN' }).clerkRole,
    'org:admin',
  );
});

test('invitation input rejects invalid, self and unknown-role requests', () => {
  assert.match(parseInvitationInput({ email: 'bad', tenantRole: 'AUDITOR' }).error, /email/i);
  assert.match(parseInvitationInput({ email: 'me@obra.com', tenantRole: 'ROOT' }).error, /rol/i);
  assert.match(
    parseInvitationInput({ email: 'ME@obra.com', tenantRole: 'AUDITOR' }, 'me@obra.com').error,
    /pertenece/i,
  );
});

test('invitation metadata never elevates a Clerk member to admin', () => {
  assert.equal(tenantRoleFromInvitation({
    role: 'org:member',
    publicMetadata: { obrasaasTenantRole: 'SITE_MANAGER' },
  }), 'SITE_MANAGER');
  assert.equal(tenantRoleFromInvitation({
    role: 'org:member',
    publicMetadata: { obrasaasTenantRole: 'ADMIN' },
  }), 'AUDITOR');
  assert.equal(tenantRoleFromInvitation({
    role: 'org:admin',
    publicMetadata: { obrasaasTenantRole: 'AUDITOR' },
  }), 'ADMIN');
});

test('accepted invitation lookup is email-bound and prefers the newest match', () => {
  const invitations = [
    {
      status: 'accepted',
      emailAddress: 'persona@obra.com',
      role: 'org:member',
      updatedAt: 1,
      publicMetadata: { obrasaasTenantRole: 'AUDITOR' },
    },
    {
      status: 'accepted',
      emailAddress: 'persona@obra.com',
      role: 'org:member',
      updatedAt: 2,
      publicMetadata: { obrasaasTenantRole: 'FINANCE' },
    },
  ];

  assert.equal(acceptedInvitationRole(invitations, 'PERSONA@obra.com'), 'FINANCE');
  assert.equal(acceptedInvitationRole(invitations, 'otra@obra.com'), null);
  assert.equal(
    roleForClerkMembership(
      'org:member',
      acceptedInvitationRole(invitations, 'persona@obra.com'),
    ),
    'FINANCE',
  );
});
