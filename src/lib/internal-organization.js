import { databaseOrganizationIsInternal } from './organization-policy.js';

export class InternalOrganizationConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InternalOrganizationConflictError';
    this.code = 'INTERNAL_ORGANIZATION_CONFLICT';
  }
}

export function platformOrganizationMode({ isSuperadmin, sessionOrganizationId }) {
  if (isSuperadmin) return 'internal';
  return sessionOrganizationId ? 'tenant' : 'none';
}

export function internalOrganizationClerkContext(organization) {
  const orgId = organization?.clerkOrganizationId?.startsWith('org_')
    ? organization.clerkOrganizationId
    : null;
  return {
    orgId,
    orgSlug: organization?.metadata?.clerkSlug || null,
    orgRole: orgId ? 'org:admin' : null,
  };
}

function internalMetadata(value) {
  const metadata = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return { ...metadata, internal: true, purpose: 'platform-operations' };
}

export async function ensureInternalOrganization(
  prisma,
  { configuredClerkOrganizationId = process.env.OBRASAAS_INTERNAL_CLERK_ORG_ID || null } = {},
) {
  const candidates = await prisma.organization.findMany({
    where: {
      OR: [
        { clerkOrganizationId: 'system:obrasaas' },
        { metadata: { path: ['internal'], equals: true } },
        ...(configuredClerkOrganizationId
          ? [{ clerkOrganizationId: configuredClerkOrganizationId }]
          : []),
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: 3,
  });
  if (candidates.length > 1) {
    throw new InternalOrganizationConflictError(
      'Multiple ObraSaaS internal organization candidates exist.',
    );
  }
  if (candidates.length === 1) {
    if (!databaseOrganizationIsInternal(candidates[0])) {
      throw new InternalOrganizationConflictError(
        'The configured Clerk organization is not marked as the internal workspace.',
      );
    }
    return candidates[0];
  }

  const legacy = await prisma.organization.findUnique({ where: { slug: 'demo' } });
  if (legacy && !legacy.clerkOrganizationId) {
    return prisma.organization.update({
      where: { id: legacy.id },
      data: {
        clerkOrganizationId: 'system:obrasaas',
        name: 'ObraSaaS Operaciones',
        slug: 'obrasaas-internal',
        subscriptionPlan: 'ENTERPRISE',
        subscriptionStatus: 'ACTIVE',
        trialEndsAt: null,
        metadata: internalMetadata(legacy.metadata),
      },
    });
  }

  return prisma.organization.upsert({
    where: { clerkOrganizationId: 'system:obrasaas' },
    update: {
      name: 'ObraSaaS Operaciones',
      subscriptionPlan: 'ENTERPRISE',
      subscriptionStatus: 'ACTIVE',
      trialEndsAt: null,
      metadata: internalMetadata(null),
    },
    create: {
      clerkOrganizationId: 'system:obrasaas',
      name: 'ObraSaaS Operaciones',
      slug: 'obrasaas-internal',
      subscriptionPlan: 'ENTERPRISE',
      subscriptionStatus: 'ACTIVE',
      metadata: internalMetadata(null),
    },
  });
}
