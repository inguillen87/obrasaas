import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  ensureInternalOrganization,
  internalOrganizationMembershipAllowed,
  internalOrganizationClerkContext,
  InternalOrganizationConflictError,
  platformOrganizationMode,
} from '../src/lib/internal-organization.js';

test('superadmin always resolves the internal workspace even with an active tenant session', () => {
  assert.equal(platformOrganizationMode({
    isSuperadmin: true,
    sessionOrganizationId: 'org_tenant',
  }), 'internal');
  assert.equal(platformOrganizationMode({
    isSuperadmin: false,
    sessionOrganizationId: 'org_tenant',
  }), 'tenant');
  assert.equal(platformOrganizationMode({
    isSuperadmin: false,
    sessionOrganizationId: 'org_internal',
    internalClerkOrganizationId: 'org_internal',
  }), 'forbidden');
  assert.deepEqual(internalOrganizationClerkContext({
    clerkOrganizationId: 'org_internal',
    metadata: { clerkSlug: 'obrasaas-operaciones' },
  }), {
    orgId: 'org_internal',
    orgSlug: 'obrasaas-operaciones',
    orgRole: 'org:admin',
  });
  assert.deepEqual(internalOrganizationClerkContext({
    clerkOrganizationId: 'system:obrasaas',
    metadata: { internal: true },
  }), { orgId: null, orgSlug: null, orgRole: null });
  assert.equal(internalOrganizationMembershipAllowed({
    metadata: { internal: true },
  }, 'tenant@example.com'), false);
  assert.equal(internalOrganizationMembershipAllowed({
    metadata: { internal: true },
  }, 'guillen.marce@gmail.com'), true);
  assert.equal(internalOrganizationMembershipAllowed({
    metadata: { internal: false },
  }, 'tenant@example.com'), true);
});

test('superadmin reuses exactly one Clerk-linked internal organization', async () => {
  const internal = {
    id: 'db_internal',
    clerkOrganizationId: 'org_internal',
    metadata: { internal: true },
  };
  const prisma = {
    organization: {
      async findMany() {
        return [internal];
      },
    },
  };
  assert.equal(await ensureInternalOrganization(prisma, {
    configuredClerkOrganizationId: 'org_internal',
  }), internal);
});

test('superadmin fails closed for duplicate or incorrectly marked internal workspaces', async () => {
  await assert.rejects(
    () => ensureInternalOrganization({
      organization: {
        async findMany() {
          return [
            { clerkOrganizationId: 'system:obrasaas', metadata: {} },
            { clerkOrganizationId: 'org_internal', metadata: { internal: true } },
          ];
        },
      },
    }),
    InternalOrganizationConflictError,
  );
  await assert.rejects(
    () => ensureInternalOrganization({
      organization: {
        async findMany() {
          return [{ clerkOrganizationId: 'org_tenant', metadata: { internal: false } }];
        },
      },
    }, { configuredClerkOrganizationId: 'org_tenant' }),
    InternalOrganizationConflictError,
  );
});

test('internal fallback is idempotent and carries an explicit internal marker', async () => {
  const calls = [];
  const prisma = {
    organization: {
      async findMany() {
        return [];
      },
      async findUnique() {
        return null;
      },
      async upsert(args) {
        calls.push(args);
        return { id: 'db_internal', ...args.create };
      },
    },
  };
  const result = await ensureInternalOrganization(prisma, {
    configuredClerkOrganizationId: null,
  });
  assert.equal(result.metadata.internal, true);
  assert.equal(result.clerkOrganizationId, 'system:obrasaas');
  assert.equal(calls.length, 1);
});

test('database migration enforces a single internal organization', async () => {
  const sql = await readFile(
    new URL('../prisma/migrations/20260717233000_enforce_single_internal_organization/migration.sql', import.meta.url),
    'utf8',
  );
  assert.match(sql, /CREATE UNIQUE INDEX "Organization_single_internal_key"/);
  assert.match(sql, /"metadata"->>'internal' = 'true'/);
  assert.match(sql, /system:obrasaas/);
});
