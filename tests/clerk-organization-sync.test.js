import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLERK_DATABASE_ORGANIZATION_ID_METADATA_KEY,
  ClerkOrganizationIdentityConflictError,
  ClerkOrganizationRebindRequiredError,
  clerkDatabaseOrganizationId,
  syncClerkOrganization,
} from '../src/lib/clerk-organization-sync.js';

function clerkOrganization(overrides = {}) {
  return {
    id: 'org_new',
    name: 'Constructora Sur',
    slug: 'constructora-sur',
    imageUrl: 'https://img.example/org.png',
    publicMetadata: {},
    privateMetadata: {},
    ...overrides,
  };
}

test('stable database organization link is read from camel or snake case private metadata', () => {
  assert.equal(clerkDatabaseOrganizationId(clerkOrganization({
    privateMetadata: { [CLERK_DATABASE_ORGANIZATION_ID_METADATA_KEY]: 'db_org_a' },
  })), 'db_org_a');
  assert.equal(clerkDatabaseOrganizationId(clerkOrganization({
    privateMetadata: undefined,
    private_metadata: { [CLERK_DATABASE_ORGANIZATION_ID_METADATA_KEY]: 'db_org_b' },
  })), 'db_org_b');
  assert.equal(clerkDatabaseOrganizationId(clerkOrganization()), null);
});

test('a new Clerk organization creates a trial tenant with deterministic scope', async () => {
  const calls = [];
  const prisma = {
    organization: {
      async findUnique() {
        return null;
      },
      async upsert(args) {
        calls.push(args);
        return { id: 'db_new', ...args.create };
      },
    },
  };
  const now = new Date('2026-07-17T12:00:00.000Z');

  const result = await syncClerkOrganization(prisma, {
    organization: clerkOrganization(),
    now,
  });

  assert.equal(result.clerkOrganizationId, 'org_new');
  assert.equal(result.slug, 'tenant-new');
  assert.equal(result.subscriptionPlan, 'TRIAL');
  assert.equal(result.subscriptionStatus, 'TRIALING');
  assert.equal(result.trialEndsAt.toISOString(), '2026-07-31T12:00:00.000Z');
  assert.equal(calls.length, 1);
});

test('a Clerk-marked internal org cannot create a second internal workspace', async () => {
  const prisma = {
    organization: {
      async findUnique() {
        return null;
      },
      async findFirst() {
        return {
          id: 'db_internal',
          clerkOrganizationId: 'system:obrasaas',
          metadata: { internal: true },
        };
      },
    },
  };

  await assert.rejects(
    () => syncClerkOrganization(prisma, {
      organization: clerkOrganization({ publicMetadata: { internal: true } }),
    }),
    ClerkOrganizationRebindRequiredError,
  );
});

test('private metadata rebind preserves the database tenant and audits old and new IDs', async () => {
  const calls = [];
  const existing = {
    id: 'db_org_a',
    clerkOrganizationId: 'org_old',
    name: 'Constructora anterior',
    slug: 'tenant-old',
    subscriptionPlan: 'PRO',
    subscriptionStatus: 'ACTIVE',
    trialEndsAt: null,
    metadata: { billingNote: 'preserve', internal: false },
  };
  const transaction = {
    organization: {
      async updateMany(args) {
        calls.push(['update-many', args]);
        return { count: 1 };
      },
      async findUnique() {
        calls.push(['find-updated']);
        return { ...existing, clerkOrganizationId: 'org_new' };
      },
    },
    auditLog: {
      async create(args) {
        calls.push(['audit', args]);
        return args.data;
      },
    },
  };
  const prisma = {
    organization: {
      async findUnique({ where }) {
        if (where.clerkOrganizationId) return null;
        if (where.id === existing.id) return existing;
        return null;
      },
    },
    async $transaction(callback) {
      return callback(transaction);
    },
  };

  const result = await syncClerkOrganization(prisma, {
    organization: clerkOrganization({
      privateMetadata: {
        [CLERK_DATABASE_ORGANIZATION_ID_METADATA_KEY]: existing.id,
      },
    }),
    allowRebind: true,
    expectedPreviousClerkOrganizationId: 'org_old',
  });

  assert.equal(result.id, existing.id);
  assert.equal(result.clerkOrganizationId, 'org_new');
  assert.equal(result.slug, existing.slug);
  assert.equal(result.subscriptionPlan, existing.subscriptionPlan);
  assert.equal(result.metadata.billingNote, 'preserve');
  assert.deepEqual(calls.map(([name]) => name), ['update-many', 'find-updated', 'audit']);
  assert.deepEqual(calls[2][1].data.metadata, {
    previousClerkOrganizationId: 'org_old',
    nextClerkOrganizationId: 'org_new',
    stableLinkSource: 'clerk_private_metadata',
  });
});

test('runtime sync never rebinds an organization from private metadata implicitly', async () => {
  const existing = {
    id: 'db_org_a',
    clerkOrganizationId: 'org_old',
    metadata: {},
  };
  const prisma = {
    organization: {
      async findUnique({ where }) {
        return where.clerkOrganizationId ? null : existing;
      },
    },
  };

  await assert.rejects(
    () => syncClerkOrganization(prisma, {
      organization: clerkOrganization({
        privateMetadata: {
          [CLERK_DATABASE_ORGANIZATION_ID_METADATA_KEY]: existing.id,
        },
      }),
    }),
    ClerkOrganizationRebindRequiredError,
  );
});

test('explicit organization rebind requires an exact previous Clerk ID', async () => {
  const existing = {
    id: 'db_org_a',
    clerkOrganizationId: 'org_current',
    metadata: {},
  };
  const prisma = {
    organization: {
      async findUnique({ where }) {
        return where.clerkOrganizationId ? null : existing;
      },
    },
  };

  await assert.rejects(
    () => syncClerkOrganization(prisma, {
      organization: clerkOrganization({
        privateMetadata: {
          [CLERK_DATABASE_ORGANIZATION_ID_METADATA_KEY]: existing.id,
        },
      }),
      allowRebind: true,
      expectedPreviousClerkOrganizationId: 'org_stale',
    }),
    ClerkOrganizationIdentityConflictError,
  );
});

test('unknown or conflicting private organization links fail closed', async () => {
  const linked = clerkOrganization({
    privateMetadata: {
      [CLERK_DATABASE_ORGANIZATION_ID_METADATA_KEY]: 'db_unknown',
    },
  });
  await assert.rejects(
    () => syncClerkOrganization({
      organization: { async findUnique() { return null; } },
    }, { organization: linked }),
    ClerkOrganizationIdentityConflictError,
  );

  await assert.rejects(
    () => syncClerkOrganization({
      organization: {
        async findUnique({ where }) {
          return where.clerkOrganizationId
            ? { id: 'db_a', clerkOrganizationId: 'org_new' }
            : { id: 'db_b', clerkOrganizationId: 'org_old' };
        },
      },
    }, { organization: linked }),
    ClerkOrganizationIdentityConflictError,
  );
});
