import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  assertProductionClerkInstance,
  validateClerkCutoverCoverage,
  validateClerkCutoverManifest,
  validateClerkCutoverMemberships,
  validateClerkCutoverOrganizationTarget,
  validateClerkCutoverUserTarget,
} from '../src/lib/clerk-cutover.js';
import { CLERK_DATABASE_ORGANIZATION_ID_METADATA_KEY } from '../src/lib/clerk-organization-sync.js';
import {
  loadValidatedClerkCutoverTarget,
  parseClerkCutoverArgs,
} from '../scripts/cutover-clerk-identities.mjs';

function manifest() {
  return {
    targetInstanceId: 'ins_Production123',
    users: [
      {
        platformUserId: 'db_user_admin',
        expectedPreviousClerkUserId: 'user_DevAdmin',
        nextClerkUserId: 'user_ProdAdmin',
      },
      {
        platformUserId: 'db_user_tenant',
        expectedPreviousClerkUserId: 'user_DevTenant',
        nextClerkUserId: 'user_ProdTenant',
      },
    ],
    organizations: [
      {
        organizationId: 'db_org_internal',
        expectedPreviousClerkOrganizationId: 'org_DevInternal',
        nextClerkOrganizationId: 'org_ProdInternal',
      },
      {
        organizationId: 'db_org_tenant',
        expectedPreviousClerkOrganizationId: 'org_DevTenant',
        nextClerkOrganizationId: 'org_ProdTenant',
      },
    ],
  };
}

function databaseState() {
  return {
    databaseUsers: [
      {
        id: 'db_user_admin',
        clerkUserId: 'user_DevAdmin',
        primaryEmail: 'guillen.marce@gmail.com',
        systemRole: 'SUPERADMIN',
      },
      {
        id: 'db_user_tenant',
        clerkUserId: 'user_DevTenant',
        primaryEmail: 'tenant@example.com',
        systemRole: 'TENANT_USER',
      },
    ],
    databaseOrganizations: [
      {
        id: 'db_org_internal',
        clerkOrganizationId: 'org_DevInternal',
        metadata: { internal: true },
      },
      {
        id: 'db_org_tenant',
        clerkOrganizationId: 'org_DevTenant',
        metadata: { internal: false },
      },
    ],
  };
}

test('cutover manifest is strict, complete and requires new external IDs', () => {
  assert.deepEqual(validateClerkCutoverManifest(manifest()), manifest());
  assert.throws(
    () => validateClerkCutoverManifest({ ...manifest(), unexpected: true }),
    /unknown fields/,
  );
  const duplicate = manifest();
  duplicate.users[1].nextClerkUserId = duplicate.users[0].nextClerkUserId;
  assert.throws(() => validateClerkCutoverManifest(duplicate), /must be unique/);
  const unchanged = manifest();
  unchanged.organizations[0].nextClerkOrganizationId = 'org_DevInternal';
  assert.throws(() => validateClerkCutoverManifest(unchanged), /must change/);
});

test('cutover CLI is dry-run by default and apply requires explicit confirmations', () => {
  const dryRun = parseClerkCutoverArgs(['--plan', 'clerk-cutover-prod.json']);
  assert.equal(dryRun.apply, false);
  assert.equal(dryRun.webhooksFrozen, false);
  assert.equal(dryRun.identityWritesFrozen, false);
  assert.match(dryRun.planPath, /clerk-cutover-prod\.json$/);

  const apply = parseClerkCutoverArgs([
    '--plan',
    'clerk-cutover-prod.json',
    '--apply',
    '--confirm-instance',
    'ins_Production123',
    '--confirm-webhooks-frozen',
    '--confirm-identity-writes-frozen',
  ]);
  assert.equal(apply.apply, true);
  assert.equal(apply.confirmedInstanceId, 'ins_Production123');
  assert.equal(apply.webhooksFrozen, true);
  assert.equal(apply.identityWritesFrozen, true);
  assert.throws(() => parseClerkCutoverArgs([]), /--plan is required/);
});

test('cutover accepts only the exact production Clerk instance', () => {
  assert.equal(assertProductionClerkInstance({
    id: 'ins_Production123',
    environment_type: 'production',
  }, 'ins_Production123'), true);
  assert.throws(
    () => assertProductionClerkInstance({
      id: 'ins_Development123',
      environment_type: 'development',
    }, 'ins_Production123'),
    /does not match/,
  );
  assert.throws(
    () => assertProductionClerkInstance({
      id: 'ins_Production123',
      environment_type: 'development',
    }, 'ins_Production123'),
    /production instance/,
  );
});

test('cutover coverage pins every current database identity and one superadmin/internal org', () => {
  const validated = validateClerkCutoverManifest(manifest());
  const state = databaseState();
  const coverage = validateClerkCutoverCoverage({ manifest: validated, ...state });
  assert.equal(coverage.users.length, 2);
  assert.equal(coverage.organizations.length, 2);

  assert.throws(
    () => validateClerkCutoverCoverage({
      manifest: { ...validated, users: validated.users.slice(0, 1) },
      ...state,
    }),
    /cover every Clerk-linked platform user/,
  );
  const stale = databaseState();
  stale.databaseOrganizations[0].clerkOrganizationId = 'org_Changed';
  assert.throws(
    () => validateClerkCutoverCoverage({ manifest: validated, ...stale }),
    /expected previous Clerk identity/,
  );
});

test('cutover targets require verified user email and exact stable organization metadata', () => {
  const validated = validateClerkCutoverManifest(manifest());
  const state = databaseState();
  assert.equal(validateClerkCutoverUserTarget({
    entry: validated.users[0],
    databaseUser: state.databaseUsers[0],
    clerkUser: {
      id: 'user_ProdAdmin',
      primaryEmailAddressId: 'email_primary',
      emailAddresses: [{
        id: 'email_primary',
        emailAddress: 'guillen.marce@gmail.com',
        verification: { status: 'verified' },
      }],
    },
  }), true);
  assert.throws(
    () => validateClerkCutoverUserTarget({
      entry: validated.users[0],
      databaseUser: state.databaseUsers[0],
      clerkUser: {
        id: 'user_ProdAdmin',
        primaryEmailAddressId: 'email_primary',
        emailAddresses: [{
          id: 'email_primary',
          emailAddress: 'attacker@example.com',
          verification: { status: 'verified' },
        }],
      },
    }),
    /verified platform email/,
  );

  assert.equal(validateClerkCutoverOrganizationTarget({
    entry: validated.organizations[0],
    databaseOrganization: state.databaseOrganizations[0],
    clerkOrganization: {
      id: 'org_ProdInternal',
      publicMetadata: { internal: true },
      privateMetadata: {
        [CLERK_DATABASE_ORGANIZATION_ID_METADATA_KEY]: 'db_org_internal',
      },
    },
  }), true);
  assert.throws(
    () => validateClerkCutoverOrganizationTarget({
      entry: validated.organizations[0],
      databaseOrganization: state.databaseOrganizations[0],
      clerkOrganization: {
        id: 'org_ProdInternal',
        publicMetadata: { internal: true },
        privateMetadata: {},
      },
    }),
    /exact stable ObraSaaS database link/,
  );
});

test('cutover requires exact Clerk membership and base-role parity', () => {
  const validated = validateClerkCutoverManifest(manifest());
  const coverage = validateClerkCutoverCoverage({ manifest: validated, ...databaseState() });
  const databaseMemberships = [
    {
      userId: 'db_user_admin',
      organizationId: 'db_org_internal',
      clerkRole: 'org:admin',
      status: 'ACTIVE',
    },
    {
      userId: 'db_user_tenant',
      organizationId: 'db_org_tenant',
      clerkRole: 'org:member',
      status: 'ACTIVE',
    },
    {
      userId: 'db_user_admin',
      organizationId: 'db_org_tenant',
      clerkRole: 'org:admin',
      status: 'DISABLED',
    },
  ];
  const targetMemberships = [
    {
      clerkUserId: 'user_ProdAdmin',
      clerkOrganizationId: 'org_ProdInternal',
      clerkRole: 'org:admin',
    },
    {
      clerkUserId: 'user_ProdTenant',
      clerkOrganizationId: 'org_ProdTenant',
      clerkRole: 'org:member',
    },
  ];

  assert.equal(validateClerkCutoverMemberships({
    coverage,
    databaseMemberships,
    targetMemberships,
  }), true);
  assert.throws(
    () => validateClerkCutoverMemberships({
      coverage,
      databaseMemberships,
      targetMemberships: targetMemberships.slice(0, 1),
    }),
    /do not match active/,
  );
  assert.throws(
    () => validateClerkCutoverMemberships({
      coverage,
      databaseMemberships,
      targetMemberships: targetMemberships.map((membership, index) => (
        index === 1 ? { ...membership, clerkRole: 'org:admin' } : membership
      )),
    }),
    /role does not match/,
  );
  assert.throws(
    () => validateClerkCutoverMemberships({
      coverage,
      databaseMemberships: [
        ...databaseMemberships,
        {
          userId: 'db_user_tenant',
          organizationId: 'db_org_internal',
          clerkRole: 'org:member',
          status: 'ACTIVE',
        },
      ],
      targetMemberships,
    }),
    /only contain the canonical ObraSaaS superadmin/,
  );
  assert.throws(
    () => validateClerkCutoverMemberships({
      coverage,
      databaseMemberships,
      targetMemberships: [
        ...targetMemberships,
        {
          clerkUserId: 'user_ProdTenant',
          clerkOrganizationId: 'org_ProdInternal',
          clerkRole: 'org:member',
        },
      ],
    }),
    /only contain the canonical ObraSaaS superadmin/,
  );
});

test('cutover target refresh revalidates current users, organizations and memberships', async () => {
  const validated = validateClerkCutoverManifest(manifest());
  const state = databaseState();
  const coverage = validateClerkCutoverCoverage({ manifest: validated, ...state });
  const databaseMemberships = [
    {
      userId: 'db_user_admin',
      organizationId: 'db_org_internal',
      clerkRole: 'org:admin',
      status: 'ACTIVE',
    },
    {
      userId: 'db_user_tenant',
      organizationId: 'db_org_tenant',
      clerkRole: 'org:member',
      status: 'ACTIVE',
    },
  ];
  const calls = [];
  const users = {
    user_ProdAdmin: {
      id: 'user_ProdAdmin',
      primary_email_address_id: 'email_admin',
      email_addresses: [{
        id: 'email_admin',
        email_address: 'guillen.marce@gmail.com',
        verification: { status: 'verified' },
      }],
    },
    user_ProdTenant: {
      id: 'user_ProdTenant',
      primary_email_address_id: 'email_tenant',
      email_addresses: [{
        id: 'email_tenant',
        email_address: 'tenant@example.com',
        verification: { status: 'verified' },
      }],
    },
  };
  const organizations = {
    org_ProdInternal: {
      id: 'org_ProdInternal',
      public_metadata: { internal: true },
      private_metadata: { obrasaasDatabaseOrganizationId: 'db_org_internal' },
    },
    org_ProdTenant: {
      id: 'org_ProdTenant',
      public_metadata: { internal: false },
      private_metadata: { obrasaasDatabaseOrganizationId: 'db_org_tenant' },
    },
  };
  const memberships = {
    org_ProdInternal: [{
      role: 'org:admin',
      public_user_data: { user_id: 'user_ProdAdmin' },
    }],
    org_ProdTenant: [{
      role: 'org:member',
      public_user_data: { user_id: 'user_ProdTenant' },
    }],
  };
  const clerk = async (path) => {
    calls.push(path);
    const userMatch = path.match(/^\/users\/([^?]+)$/);
    if (userMatch) return users[userMatch[1]];
    const membershipMatch = path.match(/^\/organizations\/([^/]+)\/memberships\?/);
    if (membershipMatch) {
      const data = memberships[membershipMatch[1]] || [];
      return { data, total_count: data.length };
    }
    const organizationMatch = path.match(/^\/organizations\/([^/]+)$/);
    if (organizationMatch) return organizations[organizationMatch[1]];
    throw new Error(`Unexpected Clerk path ${path}`);
  };

  const target = await loadValidatedClerkCutoverTarget({
    clerk,
    coverage,
    databaseMemberships,
  });

  assert.equal(target.users.length, 2);
  assert.equal(target.organizations.length, 2);
  assert.equal(target.targetMemberships.length, 2);
  assert.equal(calls.filter((path) => path.includes('/memberships?')).length, 2);
});

test('apply refreshes the external Clerk target only after acquiring the exclusive lock', async () => {
  const source = await readFile(
    new URL('../scripts/cutover-clerk-identities.mjs', import.meta.url),
    'utf8',
  );
  const transactionStart = source.indexOf('await prisma.$transaction(async (transaction) =>');
  const lock = source.indexOf('await acquireClerkIdentityCutoverLock(transaction)', transactionStart);
  const refresh = source.indexOf('const lockedTarget = await loadValidatedClerkCutoverTarget', lock);
  const firstRebind = source.indexOf('for (const { entry, clerkUser } of lockedTarget.users)', refresh);
  assert.ok(transactionStart >= 0 && transactionStart < lock);
  assert.ok(lock < refresh);
  assert.ok(refresh < firstRebind);
});
