import {
  clerkOrganizationIsInternal,
  mergeClerkOrganizationMetadata,
} from './organization-policy.js';
import {
  canUseClerkIdentitySyncLock,
  isClerkIdentityTransaction,
  withClerkIdentitySyncLock,
} from './clerk-identity-lock.js';

export const CLERK_DATABASE_ORGANIZATION_ID_METADATA_KEY = 'obrasaasDatabaseOrganizationId';

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function clerkDatabaseOrganizationId(organization) {
  const privateMetadata = record(
    organization?.privateMetadata ?? organization?.private_metadata,
  );
  const value = privateMetadata[CLERK_DATABASE_ORGANIZATION_ID_METADATA_KEY];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function tenantDatabaseSlug(clerkOrganizationId) {
  return `tenant-${clerkOrganizationId.replace(/^org_/, '').toLowerCase()}`;
}

function organizationUpdateData({ organization, existing, internal, metadata }) {
  return {
    name: internal ? 'ObraSaaS Operaciones' : organization.name,
    metadata,
    ...(existing.clerkOrganizationId !== organization.id
      ? { clerkOrganizationId: organization.id }
      : {}),
    ...(internal ? {
      subscriptionPlan: 'ENTERPRISE',
      subscriptionStatus: 'ACTIVE',
      trialEndsAt: null,
    } : {}),
  };
}

export class ClerkOrganizationIdentityConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ClerkOrganizationIdentityConflictError';
    this.code = 'CLERK_ORGANIZATION_IDENTITY_CONFLICT';
  }
}

export class ClerkOrganizationRebindRequiredError extends Error {
  constructor({ databaseOrganizationId, existingClerkOrganizationId, nextClerkOrganizationId }) {
    super(`Clerk organization ${nextClerkOrganizationId} requires an explicit organization ID rebind.`);
    this.name = 'ClerkOrganizationRebindRequiredError';
    this.code = 'CLERK_ORGANIZATION_REBIND_REQUIRED';
    this.databaseOrganizationId = databaseOrganizationId;
    this.existingClerkOrganizationId = existingClerkOrganizationId;
    this.nextClerkOrganizationId = nextClerkOrganizationId;
  }
}

export async function syncClerkOrganization(
  prisma,
  {
    organization,
    orgSlug = null,
    internalClerkOrgId = process.env.OBRASAAS_INTERNAL_CLERK_ORG_ID || null,
    trialDays = 14,
    now = new Date(),
    allowRebind = false,
    expectedPreviousClerkOrganizationId,
  },
) {
  if (canUseClerkIdentitySyncLock(prisma)) {
    return withClerkIdentitySyncLock(
      prisma,
      (transaction) => syncClerkOrganization(transaction, {
        organization,
        orgSlug,
        internalClerkOrgId,
        trialDays,
        now,
        allowRebind,
        expectedPreviousClerkOrganizationId,
      }),
    );
  }
  if (!organization?.id) throw new Error('Clerk organization ID is required.');

  const databaseOrganizationId = clerkDatabaseOrganizationId(organization);
  const existingByClerkId = await prisma.organization.findUnique({
    where: { clerkOrganizationId: organization.id },
  });
  const existingByDatabaseId = databaseOrganizationId
    ? await prisma.organization.findUnique({ where: { id: databaseOrganizationId } })
    : null;

  if (databaseOrganizationId && !existingByDatabaseId) {
    throw new ClerkOrganizationIdentityConflictError(
      `Clerk organization ${organization.id} points to an unknown ObraSaaS organization.`,
    );
  }
  if (
    existingByClerkId
    && existingByDatabaseId
    && existingByClerkId.id !== existingByDatabaseId.id
  ) {
    throw new ClerkOrganizationIdentityConflictError(
      `Clerk organization ${organization.id} conflicts with its private ObraSaaS organization link.`,
    );
  }

  const existing = existingByClerkId || existingByDatabaseId;
  const rebind = Boolean(existing && existing.clerkOrganizationId !== organization.id);
  if (rebind && !allowRebind) {
    throw new ClerkOrganizationRebindRequiredError({
      databaseOrganizationId: existing.id,
      existingClerkOrganizationId: existing.clerkOrganizationId,
      nextClerkOrganizationId: organization.id,
    });
  }
  if (rebind && expectedPreviousClerkOrganizationId !== existing.clerkOrganizationId) {
    throw new ClerkOrganizationIdentityConflictError(
      `Clerk organization ${organization.id} does not match the expected previous organization identity.`,
    );
  }

  const internal = clerkOrganizationIsInternal(
    organization,
    existing?.metadata,
    internalClerkOrgId,
  );
  if (!existing && internal && !databaseOrganizationId) {
    const currentInternal = await prisma.organization.findFirst({
      where: {
        OR: [
          { clerkOrganizationId: 'system:obrasaas' },
          { metadata: { path: ['internal'], equals: true } },
        ],
      },
    });
    if (currentInternal) {
      throw new ClerkOrganizationRebindRequiredError({
        databaseOrganizationId: currentInternal.id,
        existingClerkOrganizationId: currentInternal.clerkOrganizationId,
        nextClerkOrganizationId: organization.id,
      });
    }
  }
  const metadata = mergeClerkOrganizationMetadata(
    existing?.metadata,
    organization,
    orgSlug,
    internalClerkOrgId,
  );

  if (!existing) {
    const create = {
      clerkOrganizationId: organization.id,
      name: internal ? 'ObraSaaS Operaciones' : organization.name,
      slug: tenantDatabaseSlug(organization.id),
      subscriptionPlan: internal ? 'ENTERPRISE' : 'TRIAL',
      subscriptionStatus: internal ? 'ACTIVE' : 'TRIALING',
      trialEndsAt: internal
        ? null
        : new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1_000),
      metadata,
    };
    try {
      return await prisma.organization.upsert({
        where: { clerkOrganizationId: organization.id },
        update: {
          name: create.name,
          metadata,
          ...(internal ? {
            subscriptionPlan: 'ENTERPRISE',
            subscriptionStatus: 'ACTIVE',
            trialEndsAt: null,
          } : {}),
        },
        create,
      });
    } catch (error) {
      if (error && typeof error === 'object' && error.code === 'P2002') {
        throw new ClerkOrganizationIdentityConflictError(
          `Clerk organization ${organization.id} collided with an existing ObraSaaS organization.`,
        );
      }
      throw error;
    }
  }

  const synchronize = async (database) => {
    const updateData = organizationUpdateData({ organization, existing, internal, metadata });
    let updated;
    if (rebind) {
      const claim = await database.organization.updateMany({
        where: {
          id: existing.id,
          clerkOrganizationId: expectedPreviousClerkOrganizationId,
        },
        data: updateData,
      });
      if (claim.count !== 1) {
        throw new ClerkOrganizationIdentityConflictError(
          `Clerk organization ${organization.id} lost the explicit organization rebind race.`,
        );
      }
      updated = await database.organization.findUnique({ where: { id: existing.id } });
      if (!updated || updated.clerkOrganizationId !== organization.id) {
        throw new ClerkOrganizationIdentityConflictError(
          `Clerk organization ${organization.id} could not confirm the explicit organization rebind.`,
        );
      }
    } else {
      updated = await database.organization.update({
        where: { id: existing.id },
        data: updateData,
      });
    }
    if (rebind) {
      await database.auditLog.create({
        data: {
          organizationId: updated.id,
          action: 'identity.clerk_organization_rebound',
          entityType: 'Organization',
          entityId: updated.id,
          metadata: {
            previousClerkOrganizationId: existing.clerkOrganizationId,
            nextClerkOrganizationId: organization.id,
            stableLinkSource: 'clerk_private_metadata',
          },
        },
      });
    }
    return updated;
  };

  return rebind
    && typeof prisma.$transaction === 'function'
    && !isClerkIdentityTransaction(prisma)
    ? prisma.$transaction(synchronize)
    : synchronize(prisma);
}
