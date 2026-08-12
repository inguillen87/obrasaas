import { systemRoleForVerifiedEmail } from './platform-identity.js';
import {
  canUseClerkIdentitySyncLock,
  clerkIdentityRuntimeLockKeys,
  isClerkIdentityTransaction,
  withClerkIdentitySyncLock,
} from './clerk-identity-lock.js';

export class ClerkVerifiedEmailRequiredError extends Error {
  constructor(clerkUserId) {
    super(`Clerk user ${clerkUserId} has no verified primary email.`);
    this.name = 'ClerkVerifiedEmailRequiredError';
    this.code = 'CLERK_VERIFIED_EMAIL_REQUIRED';
  }
}

export class ClerkIdentityRebindRequiredError extends Error {
  constructor({ email, existingClerkUserId, nextClerkUserId }) {
    super(`Verified Clerk identity ${email} requires an explicit user ID rebind.`);
    this.name = 'ClerkIdentityRebindRequiredError';
    this.code = 'CLERK_IDENTITY_REBIND_REQUIRED';
    this.email = email;
    this.existingClerkUserId = existingClerkUserId;
    this.nextClerkUserId = nextClerkUserId;
  }
}

export class ClerkIdentityConflictError extends Error {
  constructor({ email, clerkUserId }) {
    super(`Clerk identity ${clerkUserId} conflicts with another verified identity for ${email}.`);
    this.name = 'ClerkIdentityConflictError';
    this.code = 'CLERK_IDENTITY_CONFLICT';
  }
}

export function verifiedPrimaryEmail(clerkUser) {
  const emailAddresses = Array.isArray(clerkUser?.emailAddresses)
    ? clerkUser.emailAddresses
    : [];
  const primary = emailAddresses.find(
    (email) => email.id === clerkUser?.primaryEmailAddressId,
  );
  const candidate = primary || emailAddresses[0];
  if (!candidate || candidate.verification?.status !== 'verified') return null;
  return candidate.emailAddress.trim().toLowerCase();
}

function platformUserProfile(clerkUser, email, { touchLastSeenAt = false, now = new Date() } = {}) {
  return {
    primaryEmail: email,
    fullName: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null,
    avatarUrl: clerkUser.imageUrl || null,
    systemRole: systemRoleForVerifiedEmail(email),
    ...(touchLastSeenAt ? { lastSeenAt: now } : {}),
  };
}

function requireVerifiedClerkUser(clerkUser) {
  if (!clerkUser?.id) throw new Error('Clerk user ID is required.');
  const email = verifiedPrimaryEmail(clerkUser);
  if (!email) throw new ClerkVerifiedEmailRequiredError(clerkUser.id);
  return email;
}

function isUniqueConstraintViolation(error) {
  return Boolean(error && typeof error === 'object' && error.code === 'P2002');
}

export async function syncPlatformUserFromClerk(
  prisma,
  clerkUser,
  options = {},
) {
  if (canUseClerkIdentitySyncLock(prisma)) {
    return withClerkIdentitySyncLock(
      prisma,
      (transaction) => syncPlatformUserFromClerk(transaction, clerkUser, options),
      {
        identityKeys: clerkIdentityRuntimeLockKeys({ clerkUserId: clerkUser?.id }),
      },
    );
  }
  const email = requireVerifiedClerkUser(clerkUser);
  const profile = platformUserProfile(clerkUser, email, options);
  const existingByClerkId = await prisma.platformUser.findUnique({
    where: { clerkUserId: clerkUser.id },
  });
  const existingByEmail = await prisma.platformUser.findUnique({
    where: { primaryEmail: email },
  });

  if (existingByClerkId && existingByEmail && existingByClerkId.id !== existingByEmail.id) {
    throw new ClerkIdentityConflictError({ email, clerkUserId: clerkUser.id });
  }
  if (!existingByClerkId && existingByEmail) {
    throw new ClerkIdentityRebindRequiredError({
      email,
      existingClerkUserId: existingByEmail.clerkUserId,
      nextClerkUserId: clerkUser.id,
    });
  }

  try {
    // The session resolver and user.created webhook can race on first access.
    // Upsert on the immutable Clerk ID makes that race idempotent while the
    // verified-email checks above keep cross-instance rebinds explicit.
    return await prisma.platformUser.upsert({
      where: { clerkUserId: clerkUser.id },
      update: profile,
      create: {
        clerkUserId: clerkUser.id,
        ...profile,
      },
    });
  } catch (error) {
    if (!isUniqueConstraintViolation(error)) throw error;

    const latestByClerkId = await prisma.platformUser.findUnique({
      where: { clerkUserId: clerkUser.id },
    });
    const latestByEmail = await prisma.platformUser.findUnique({
      where: { primaryEmail: email },
    });
    if (latestByClerkId && latestByEmail && latestByClerkId.id !== latestByEmail.id) {
      throw new ClerkIdentityConflictError({ email, clerkUserId: clerkUser.id });
    }
    if (!latestByClerkId && latestByEmail) {
      throw new ClerkIdentityRebindRequiredError({
        email,
        existingClerkUserId: latestByEmail.clerkUserId,
        nextClerkUserId: clerkUser.id,
      });
    }
    if (latestByClerkId) {
      return prisma.platformUser.update({
        where: { id: latestByClerkId.id },
        data: profile,
      });
    }
    throw error;
  }
}

export async function rebindPlatformUserByVerifiedEmail(prisma, clerkUser, options = {}) {
  const email = requireVerifiedClerkUser(clerkUser);
  const {
    expectedPreviousClerkUserId,
    ...profileOptions
  } = options;
  const synchronize = async (transaction) => {
    const existingByClerkId = await transaction.platformUser.findUnique({
      where: { clerkUserId: clerkUser.id },
    });
    const existingByEmail = await transaction.platformUser.findUnique({
      where: { primaryEmail: email },
    });

    if (existingByClerkId && existingByEmail && existingByClerkId.id !== existingByEmail.id) {
      throw new ClerkIdentityConflictError({ email, clerkUserId: clerkUser.id });
    }

    const existing = existingByClerkId || existingByEmail;
    if (!existing) {
      throw new Error(`No ObraSaaS platform identity exists for verified email ${email}.`);
    }

    const previousClerkUserId = existing.clerkUserId;
    const rebind = previousClerkUserId !== clerkUser.id;
    if (rebind && expectedPreviousClerkUserId !== previousClerkUserId) {
      throw new ClerkIdentityConflictError({ email, clerkUserId: clerkUser.id });
    }

    const data = {
      clerkUserId: clerkUser.id,
      ...platformUserProfile(clerkUser, email, profileOptions),
    };
    let user;
    if (rebind) {
      const claim = await transaction.platformUser.updateMany({
        where: {
          id: existing.id,
          clerkUserId: expectedPreviousClerkUserId,
        },
        data,
      });
      if (claim.count !== 1) {
        throw new ClerkIdentityConflictError({ email, clerkUserId: clerkUser.id });
      }
      user = await transaction.platformUser.findUnique({ where: { id: existing.id } });
      if (!user || user.clerkUserId !== clerkUser.id) {
        throw new ClerkIdentityConflictError({ email, clerkUserId: clerkUser.id });
      }
    } else {
      user = await transaction.platformUser.update({
        where: { id: existing.id },
        data,
      });
    }

    if (rebind) {
      await transaction.auditLog.create({
        data: {
          actorId: user.id,
          action: 'identity.clerk_user_rebound',
          entityType: 'PlatformUser',
          entityId: user.id,
          metadata: {
            previousClerkUserId,
            nextClerkUserId: clerkUser.id,
            reason: 'explicit_verified_email_migration',
          },
        },
      });
    }

    return user;
  };

  return typeof prisma.$transaction === 'function' && !isClerkIdentityTransaction(prisma)
    ? prisma.$transaction(synchronize)
    : synchronize(prisma);
}

export async function preserveDeletedClerkUser(prisma, clerkUserId) {
  if (canUseClerkIdentitySyncLock(prisma)) {
    return withClerkIdentitySyncLock(
      prisma,
      (transaction) => preserveDeletedClerkUser(transaction, clerkUserId),
      {
        identityKeys: clerkIdentityRuntimeLockKeys({ clerkUserId }),
      },
    );
  }
  const preserve = async (transaction) => {
    const user = await transaction.platformUser.findUnique({
      where: { clerkUserId },
      select: { id: true },
    });
    if (!user) return { found: false, membershipCount: 0, projectAccessCount: 0 };

    const memberships = await transaction.tenantMembership.findMany({
      where: { userId: user.id },
      select: { id: true },
    });
    const membershipIds = memberships.map(({ id }) => id);
    const membershipResult = await transaction.tenantMembership.updateMany({
      where: { userId: user.id, status: { not: 'DISABLED' } },
      data: { status: 'DISABLED' },
    });
    const projectAccessResult = membershipIds.length > 0
      ? await transaction.projectMembership.updateMany({
          where: {
            tenantMembershipId: { in: membershipIds },
            status: { not: 'DISABLED' },
          },
          data: { status: 'DISABLED' },
        })
      : { count: 0 };

    await transaction.auditLog.create({
      data: {
        action: 'identity.clerk_user_deleted',
        entityType: 'PlatformUser',
        entityId: user.id,
        metadata: {
          clerkUserId,
          preservedPlatformUser: true,
          disabledMembershipCount: membershipResult.count,
          disabledProjectAccessCount: projectAccessResult.count,
        },
      },
    });

    return {
      found: true,
      membershipCount: membershipResult.count,
      projectAccessCount: projectAccessResult.count,
    };
  };
  return typeof prisma.$transaction === 'function' && !isClerkIdentityTransaction(prisma)
    ? prisma.$transaction(preserve)
    : preserve(prisma);
}
