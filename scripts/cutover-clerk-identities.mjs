import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { PrismaNeon } from '@prisma/adapter-neon';
import dotenv from 'dotenv';

import { PrismaClient } from '../src/generated/prisma/client.ts';
import {
  assertProductionClerkInstance,
  validateClerkCutoverCoverage,
  validateClerkCutoverManifest,
  validateClerkCutoverMemberships,
  validateClerkCutoverOrganizationTarget,
  validateClerkCutoverUserTarget,
} from '../src/lib/clerk-cutover.js';
import { syncClerkOrganization } from '../src/lib/clerk-organization-sync.js';
import { rebindPlatformUserByVerifiedEmail } from '../src/lib/clerk-user-sync.js';
import { acquireClerkIdentityCutoverLock } from '../src/lib/clerk-identity-lock.js';

dotenv.config({ path: '.env.local', quiet: true });

function optionValue(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
}

export function parseClerkCutoverArgs(args) {
  if (args.includes('--help')) return { help: true };
  const planPath = optionValue(args, '--plan');
  if (!planPath) throw new Error('--plan is required.');
  return {
    help: false,
    planPath: resolve(planPath),
    apply: args.includes('--apply'),
    confirmedInstanceId: optionValue(args, '--confirm-instance'),
    webhooksFrozen: args.includes('--confirm-webhooks-frozen'),
    identityWritesFrozen: args.includes('--confirm-identity-writes-frozen'),
  };
}

function normalizeClerkRestUser(user) {
  const emailAddresses = user?.emailAddresses ?? user?.email_addresses ?? [];
  return {
    id: user?.id,
    primaryEmailAddressId: user?.primaryEmailAddressId ?? user?.primary_email_address_id,
    emailAddresses: emailAddresses.map((email) => ({
      id: email.id,
      emailAddress: email.emailAddress ?? email.email_address,
      verification: email.verification,
    })),
    firstName: user?.firstName ?? user?.first_name ?? null,
    lastName: user?.lastName ?? user?.last_name ?? null,
    imageUrl: user?.imageUrl ?? user?.image_url ?? null,
  };
}

function createClerkClient(secretKey) {
  if (!secretKey) throw new Error('CLERK_SECRET_KEY is required.');
  return async function clerk(path) {
    const response = await fetch(`https://api.clerk.com/v1${path}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const code = body?.errors?.[0]?.code || 'unknown';
      throw new Error(`Clerk GET ${path} failed (${response.status}, ${code}).`);
    }
    return body;
  };
}

async function listClerkOrganizationMemberships(clerk, clerkOrganizationId) {
  const memberships = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const response = await clerk(
      `/organizations/${encodeURIComponent(clerkOrganizationId)}/memberships?limit=${limit}&offset=${offset}`,
    );
    const page = Array.isArray(response) ? response : response?.data || [];
    memberships.push(...page.map((membership) => {
      const publicUserData = membership.publicUserData ?? membership.public_user_data;
      const clerkUserId = publicUserData?.userId ?? publicUserData?.user_id;
      if (!clerkUserId) throw new Error('Clerk organization membership has no user identity.');
      return {
        clerkOrganizationId,
        clerkUserId,
        clerkRole: membership.role,
      };
    }));
    const totalCount = Number.isInteger(response?.total_count)
      ? response.total_count
      : response?.totalCount;
    if (page.length < limit || (Number.isInteger(totalCount) && memberships.length >= totalCount)) {
      break;
    }
    if (offset >= 9_900) throw new Error('Clerk returned more than 10,000 organization memberships.');
  }
  return memberships;
}

export async function loadValidatedClerkCutoverTarget({
  clerk,
  coverage,
  databaseMemberships,
}) {
  const users = await Promise.all(coverage.users.map(async ({ entry, databaseUser }) => {
    const clerkUser = normalizeClerkRestUser(await clerk(
      `/users/${encodeURIComponent(entry.nextClerkUserId)}`,
    ));
    validateClerkCutoverUserTarget({ entry, databaseUser, clerkUser });
    return { entry, databaseUser, clerkUser };
  }));
  const organizations = await Promise.all(
    coverage.organizations.map(async ({ entry, databaseOrganization }) => {
      const clerkOrganization = await clerk(
        `/organizations/${encodeURIComponent(entry.nextClerkOrganizationId)}`,
      );
      validateClerkCutoverOrganizationTarget({
        entry,
        databaseOrganization,
        clerkOrganization,
      });
      const memberships = await listClerkOrganizationMemberships(
        clerk,
        entry.nextClerkOrganizationId,
      );
      return { entry, databaseOrganization, clerkOrganization, memberships };
    }),
  );
  const targetMemberships = organizations.flatMap(({ memberships }) => memberships);
  validateClerkCutoverMemberships({ coverage, databaseMemberships, targetMemberships });
  return { users, organizations, targetMemberships };
}

async function loadDatabaseIdentityState(database) {
  const databaseUsers = await database.platformUser.findMany({
    where: { clerkUserId: { startsWith: 'user_' } },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      clerkUserId: true,
      primaryEmail: true,
      systemRole: true,
    },
  });
  const databaseOrganizations = await database.organization.findMany({
    where: { clerkOrganizationId: { startsWith: 'org_' } },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      clerkOrganizationId: true,
      metadata: true,
    },
  });
  const databaseMemberships = await database.tenantMembership.findMany({
    orderBy: { id: 'asc' },
    select: {
      userId: true,
      organizationId: true,
      clerkRole: true,
      status: true,
    },
  });
  return { databaseUsers, databaseOrganizations, databaseMemberships };
}

async function identityCounts(database) {
  const users = await database.platformUser.count();
  const organizations = await database.organization.count();
  const memberships = await database.tenantMembership.count();
  const projects = await database.project.count();
  return { users, organizations, memberships, projects };
}

function assertSameCounts(before, after) {
  if (Object.keys(before).some((key) => before[key] !== after[key])) {
    throw new Error('Identity cutover changed protected database row counts.');
  }
}

export async function cutoverClerkIdentities({
  manifest: manifestInput,
  apply = false,
  confirmedInstanceId = null,
  webhooksFrozen = false,
  identityWritesFrozen = false,
  databaseUrl = process.env.DATABASE_URL,
  secretKey = process.env.CLERK_SECRET_KEY,
} = {}) {
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  const manifest = validateClerkCutoverManifest(manifestInput);
  const clerk = createClerkClient(secretKey);
  const prisma = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: databaseUrl }),
  });

  try {
    const instance = await clerk('/instance');
    assertProductionClerkInstance(instance, manifest.targetInstanceId);

    const { databaseUsers, databaseOrganizations, databaseMemberships } = await loadDatabaseIdentityState(prisma);
    const coverage = validateClerkCutoverCoverage({
      manifest,
      databaseUsers,
      databaseOrganizations,
    });

    const target = await loadValidatedClerkCutoverTarget({
      clerk,
      coverage,
      databaseMemberships,
    });

    console.log(
      `Validated Clerk production cutover for ${target.users.length} users and ${target.organizations.length} organizations.`,
    );
    if (!apply) {
      console.log('Dry run complete. No database identities were changed.');
      return {
        plannedUsers: target.users.length,
        plannedOrganizations: target.organizations.length,
        applied: false,
      };
    }
    if (confirmedInstanceId !== manifest.targetInstanceId) {
      throw new Error('--confirm-instance must match the production target instance exactly.');
    }
    if (!webhooksFrozen) {
      throw new Error('--confirm-webhooks-frozen is required before applying identity cutover.');
    }
    if (!identityWritesFrozen) {
      throw new Error(
        '--confirm-identity-writes-frozen must confirm both ObraSaaS runtime writes and target Clerk identity/membership writes are frozen.',
      );
    }

    await prisma.$transaction(async (transaction) => {
      await acquireClerkIdentityCutoverLock(transaction);
      const lockedState = await loadDatabaseIdentityState(transaction);
      const lockedCoverage = validateClerkCutoverCoverage({
        manifest,
        databaseUsers: lockedState.databaseUsers,
        databaseOrganizations: lockedState.databaseOrganizations,
      });
      // The production Clerk target is external to PostgreSQL, so the database
      // advisory lock cannot freeze it. Refresh every target identity and
      // membership only after the operator confirmed identity writes are frozen
      // and after the exclusive database cutover lock has been acquired.
      const lockedTarget = await loadValidatedClerkCutoverTarget({
        clerk,
        coverage: lockedCoverage,
        databaseMemberships: lockedState.databaseMemberships,
      });
      const before = await identityCounts(transaction);

      for (const { entry, clerkUser } of lockedTarget.users) {
        await rebindPlatformUserByVerifiedEmail(transaction, clerkUser, {
          expectedPreviousClerkUserId: entry.expectedPreviousClerkUserId,
        });
      }
      for (const { entry, clerkOrganization } of lockedTarget.organizations) {
        await syncClerkOrganization(transaction, {
          organization: clerkOrganization,
          allowRebind: true,
          expectedPreviousClerkOrganizationId: entry.expectedPreviousClerkOrganizationId,
        });
      }

      const after = await identityCounts(transaction);
      assertSameCounts(before, after);
      for (const { entry } of lockedTarget.users) {
        const rebound = await transaction.platformUser.findUnique({
          where: { id: entry.platformUserId },
          select: { clerkUserId: true },
        });
        if (rebound?.clerkUserId !== entry.nextClerkUserId) {
          throw new Error('A platform user identity failed post-cutover verification.');
        }
      }
      for (const { entry } of lockedTarget.organizations) {
        const rebound = await transaction.organization.findUnique({
          where: { id: entry.organizationId },
          select: { clerkOrganizationId: true },
        });
        if (rebound?.clerkOrganizationId !== entry.nextClerkOrganizationId) {
          throw new Error('An organization identity failed post-cutover verification.');
        }
      }
    }, {
      isolationLevel: 'Serializable',
      maxWait: 30_000,
      timeout: 300_000,
    });

    console.log('Clerk identity cutover committed and verified. Keep old Clerk webhooks disabled.');
    return {
      plannedUsers: target.users.length,
      plannedOrganizations: target.organizations.length,
      applied: true,
    };
  } finally {
    await prisma.$disconnect();
  }
}

function helpText() {
  return [
    'Usage:',
    '  npm run clerk:cutover -- --plan <manifest.json>',
    '  npm run clerk:cutover -- --plan <manifest.json> --apply --confirm-instance <ins_...> --confirm-webhooks-frozen --confirm-identity-writes-frozen',
    '',
    'Dry-run is the default. Apply accepts only an exact Clerk production instance.',
    '--confirm-identity-writes-frozen covers both ObraSaaS and target Clerk identity/membership writes.',
  ].join('\n');
}

const isMainModule = Boolean(
  process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url,
);

if (isMainModule) {
  const args = parseClerkCutoverArgs(process.argv.slice(2));
  if (args.help) {
    console.log(helpText());
  } else {
    const manifest = JSON.parse(await readFile(args.planPath, 'utf8'));
    await cutoverClerkIdentities({ manifest, ...args });
  }
}
