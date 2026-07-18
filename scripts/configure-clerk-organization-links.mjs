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
} from '../src/lib/clerk-cutover.js';
import { CLERK_DATABASE_ORGANIZATION_ID_METADATA_KEY } from '../src/lib/clerk-organization-sync.js';

dotenv.config({ path: '.env.local', quiet: true });

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function organizationPrivateMetadataLink(organization, databaseOrganizationId) {
  if (!databaseOrganizationId) throw new Error('Database organization ID is required.');
  const current = record(organization?.private_metadata ?? organization?.privateMetadata);
  const linkedId = current[CLERK_DATABASE_ORGANIZATION_ID_METADATA_KEY];
  if (linkedId && linkedId !== databaseOrganizationId) {
    throw new Error(
      `Clerk organization ${organization.id} is already linked to another ObraSaaS organization.`,
    );
  }
  return {
    ...current,
    [CLERK_DATABASE_ORGANIZATION_ID_METADATA_KEY]: databaseOrganizationId,
  };
}

function optionValue(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
}

export function parseClerkOrganizationLinkArgs(args) {
  const planPath = optionValue(args, '--plan');
  return {
    apply: args.includes('--apply'),
    planPath: planPath ? resolve(planPath) : null,
    confirmedInstanceId: optionValue(args, '--confirm-instance'),
  };
}

function createClerkClient(secretKey) {
  if (!secretKey) throw new Error('CLERK_SECRET_KEY is required.');
  return async function clerk(path, init = {}) {
    const response = await fetch(`https://api.clerk.com/v1${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
    const body = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      const code = body?.errors?.[0]?.code || 'unknown';
      throw new Error(`Clerk ${init.method || 'GET'} ${path} failed (${response.status}, ${code}).`);
    }
    return body;
  };
}

export async function configureClerkOrganizationLinks({
  apply = false,
  manifest: manifestInput = null,
  confirmedInstanceId = null,
  databaseUrl = process.env.DATABASE_URL,
  secretKey = process.env.CLERK_SECRET_KEY,
} = {}) {
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  const prisma = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: databaseUrl }),
  });
  const clerk = createClerkClient(secretKey);

  try {
    const instance = await clerk('/instance');
    const organizations = await prisma.organization.findMany({
      where: { clerkOrganizationId: { startsWith: 'org_' } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, clerkOrganizationId: true },
    });
    if (organizations.length === 0) {
      throw new Error('No Clerk-linked ObraSaaS organizations were found.');
    }

    let targets = organizations.map((databaseOrganization) => ({
      databaseOrganization,
      clerkOrganizationId: databaseOrganization.clerkOrganizationId,
    }));
    if (manifestInput) {
      const manifest = validateClerkCutoverManifest(manifestInput);
      assertProductionClerkInstance(instance, manifest.targetInstanceId);
      const databaseUsers = await prisma.platformUser.findMany({
        where: { clerkUserId: { startsWith: 'user_' } },
        orderBy: { id: 'asc' },
        select: {
          id: true,
          clerkUserId: true,
          primaryEmail: true,
          systemRole: true,
        },
      });
      const organizationsWithMetadata = await prisma.organization.findMany({
        where: { clerkOrganizationId: { startsWith: 'org_' } },
        orderBy: { id: 'asc' },
        select: { id: true, clerkOrganizationId: true, metadata: true },
      });
      const coverage = validateClerkCutoverCoverage({
        manifest,
        databaseUsers,
        databaseOrganizations: organizationsWithMetadata,
      });
      targets = coverage.organizations.map(({ entry, databaseOrganization }) => ({
        databaseOrganization,
        clerkOrganizationId: entry.nextClerkOrganizationId,
      }));
    }

    const plans = [];
    for (const { databaseOrganization, clerkOrganizationId } of targets) {
      const clerkOrganization = await clerk(
        `/organizations/${encodeURIComponent(clerkOrganizationId)}`,
      );
      const privateMetadata = organizationPrivateMetadataLink(
        clerkOrganization,
        databaseOrganization.id,
      );
      plans.push({ clerkOrganizationId, databaseOrganization, privateMetadata });
    }

    console.log(
      `${apply ? 'Linking' : 'Would link'} ${plans.length} Clerk organizations to stable ObraSaaS database identities.`,
    );
    if (!apply) {
      console.log(
        `Dry run complete against Clerk ${instance.environment_type || 'unknown'}. Re-run with --apply and --confirm-instance ${instance.id} to mutate private metadata.`,
      );
      return { planned: plans.length, applied: 0 };
    }
    if (confirmedInstanceId !== instance.id) {
      throw new Error('--confirm-instance must match the active Clerk instance exactly.');
    }

    for (const { clerkOrganizationId, privateMetadata } of plans) {
      await clerk(
        `/organizations/${encodeURIComponent(clerkOrganizationId)}/metadata`,
        {
          method: 'PATCH',
          body: JSON.stringify({ private_metadata: privateMetadata }),
        },
      );
    }
    console.log('Stable Clerk organization links configured.');
    return { planned: plans.length, applied: plans.length };
  } finally {
    await prisma.$disconnect();
  }
}

const isMainModule = Boolean(
  process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url,
);

if (isMainModule) {
  const args = parseClerkOrganizationLinkArgs(process.argv.slice(2));
  const manifest = args.planPath
    ? JSON.parse(await readFile(args.planPath, 'utf8'))
    : null;
  await configureClerkOrganizationLinks({ manifest, ...args });
}
