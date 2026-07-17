import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  ProjectAccessScopeError,
  accessHasPortfolioProjectAccess,
  grantCreatedProjectAccessToActor,
  membershipTransitionRequiresProjectAccessReset,
  projectAccessWhere,
  resetTenantMembershipProjectAccess,
  tenantRoleHasPortfolioAccess,
} from '../src/lib/project-access.js';

function access(overrides = {}) {
  return {
    isSuperadmin: false,
    tenantRole: 'SITE_MANAGER',
    tenantMembershipId: 'membership-a',
    organization: { id: 'organization-a' },
    ...overrides,
  };
}

test('only superadmin, admin and director receive portfolio-wide project access', () => {
  assert.equal(tenantRoleHasPortfolioAccess('ADMIN'), true);
  assert.equal(tenantRoleHasPortfolioAccess('DIRECTOR'), true);
  assert.equal(tenantRoleHasPortfolioAccess('SITE_MANAGER'), false);
  assert.equal(tenantRoleHasPortfolioAccess('FINANCE'), false);
  assert.equal(tenantRoleHasPortfolioAccess('AUDITOR'), false);
  assert.equal(accessHasPortfolioProjectAccess(access({ isSuperadmin: true })), true);
});

test('restricted project queries require an active assignment in the same tenant', () => {
  assert.deepEqual(
    projectAccessWhere(access(), {
      id: 'project-a',
      organizationId: 'attacker-organization',
      projectMemberships: { some: { tenantMembershipId: 'attacker-membership' } },
    }),
    {
      id: 'project-a',
      organizationId: 'organization-a',
      projectMemberships: {
        some: {
          tenantMembershipId: 'membership-a',
          status: 'ACTIVE',
          tenantMembership: {
            organizationId: 'organization-a',
            status: 'ACTIVE',
          },
        },
      },
    },
  );
});

test('portfolio roles keep the tenant boundary without requiring assignment rows', () => {
  assert.deepEqual(
    projectAccessWhere(access({ tenantRole: 'DIRECTOR', tenantMembershipId: null }), {
      id: 'project-a',
      organizationId: 'attacker-organization',
    }),
    { id: 'project-a', organizationId: 'organization-a' },
  );
});

test('restricted access fails closed when tenant membership context is missing', () => {
  assert.throws(
    () => projectAccessWhere(access({ tenantMembershipId: null })),
    (error) => (
      error instanceof ProjectAccessScopeError
      && error.code === 'PROJECT_ACCESS_MEMBERSHIP_REQUIRED'
    ),
  );
});

test('role and disabled-status boundaries invalidate latent project grants', async () => {
  const resetCalls = [];
  const prisma = {
    projectMembership: {
      async updateMany(args) {
        resetCalls.push(args);
        return { count: 3 };
      },
    },
  };

  assert.equal(membershipTransitionRequiresProjectAccessReset({
    previousTenantRole: 'ADMIN',
    nextTenantRole: 'SITE_MANAGER',
    previousStatus: 'ACTIVE',
    nextStatus: 'ACTIVE',
  }), true);
  assert.equal(membershipTransitionRequiresProjectAccessReset({
    previousTenantRole: 'SITE_MANAGER',
    nextTenantRole: 'DIRECTOR',
    previousStatus: 'ACTIVE',
    nextStatus: 'ACTIVE',
  }), true);
  assert.equal(membershipTransitionRequiresProjectAccessReset({
    previousTenantRole: 'SITE_MANAGER',
    nextTenantRole: 'FINANCE',
    previousStatus: 'DISABLED',
    nextStatus: 'ACTIVE',
  }), true);
  assert.equal(membershipTransitionRequiresProjectAccessReset({
    previousTenantRole: 'FINANCE',
    nextTenantRole: 'FINANCE',
    previousStatus: 'ACTIVE',
    nextStatus: 'DISABLED',
  }), true);
  assert.equal(membershipTransitionRequiresProjectAccessReset({
    previousTenantRole: 'SITE_MANAGER',
    nextTenantRole: 'FINANCE',
    previousStatus: 'ACTIVE',
    nextStatus: 'ACTIVE',
  }), false);

  const result = await resetTenantMembershipProjectAccess(prisma, 'membership-a');
  assert.equal(result.count, 3);
  assert.deepEqual(resetCalls, [{
    where: {
      tenantMembershipId: 'membership-a',
      status: 'ACTIVE',
    },
    data: { status: 'DISABLED' },
  }]);
});

test('new project grants are least-privilege for restricted creators', async () => {
  const calls = [];
  const prisma = {
    projectMembership: {
      async upsert(args) {
        calls.push(args);
        return { id: 'grant-a' };
      },
    },
  };

  await grantCreatedProjectAccessToActor(prisma, access(), 'project-new');
  await grantCreatedProjectAccessToActor(
    prisma,
    access({ tenantRole: 'ADMIN', tenantMembershipId: null }),
    'project-admin-created',
  );

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    where: {
      projectId_tenantMembershipId: {
        projectId: 'project-new',
        tenantMembershipId: 'membership-a',
      },
    },
    update: { status: 'ACTIVE' },
    create: {
      projectId: 'project-new',
      tenantMembershipId: 'membership-a',
      status: 'ACTIVE',
    },
    select: { id: true },
  });
});

test('migration backfills active same-tenant memberships and enforces cascading FKs', async () => {
  const migration = await readFile(
    new URL(
      '../prisma/migrations/20260717060000_project_memberships/migration.sql',
      import.meta.url,
    ),
    'utf8',
  );

  assert.match(migration, /membership\."organizationId" = project\."organizationId"/);
  assert.match(migration, /membership\."status" = 'ACTIVE'/);
  assert.match(migration, /project\."status" <> 'ARCHIVED'/);
  assert.match(migration, /UNIQUE INDEX "ProjectMembership_projectId_tenantMembershipId_key"/);
  assert.equal((migration.match(/ON DELETE CASCADE/g) || []).length, 2);
});
