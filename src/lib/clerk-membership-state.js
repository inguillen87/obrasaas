import { isTenantRole, roleForClerkMembership } from './tenant-roles.js';

function pageData(response) {
  return Array.isArray(response) ? response : response?.data || [];
}

function publicUserId(membership) {
  return membership?.publicUserData?.userId
    ?? membership?.public_user_data?.user_id
    ?? null;
}

function timestamp(value) {
  if (value instanceof Date) return value.getTime();
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function membershipTimestamp(membership) {
  const candidates = [
    timestamp(membership?.updatedAt ?? membership?.updated_at),
    timestamp(membership?.createdAt ?? membership?.created_at),
  ].filter((value) => value !== null);
  return candidates.length > 0 ? Math.max(...candidates) : null;
}

function eventMembershipTimestamp(event) {
  return timestamp(event?.data?.updated_at ?? event?.data?.updatedAt);
}

function isClerkNotFound(error) {
  return Number(error?.status ?? error?.statusCode) === 404;
}

function membershipMetadataTenantRole(membership) {
  const metadata = membership?.publicMetadata ?? membership?.public_metadata;
  const role = metadata?.obrasaasTenantRole;
  return isTenantRole(role) && role !== 'ADMIN' ? role : null;
}

export class ClerkMembershipStatePendingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ClerkMembershipStatePendingError';
    this.code = 'CLERK_MEMBERSHIP_STATE_PENDING';
  }
}

export async function getCurrentClerkOrganizationMembership(
  organizations,
  { organizationId, userId },
) {
  if (!organizationId || !userId) {
    throw new Error('Clerk organization and user IDs are required to resolve membership state.');
  }

  let response;
  try {
    response = await organizations.getOrganizationMembershipList({
      organizationId,
      userId: [userId],
      limit: 10,
    });
  } catch (error) {
    if (isClerkNotFound(error)) return null;
    throw error;
  }

  const matches = pageData(response).filter(
    (membership) => publicUserId(membership) === userId,
  );
  if (matches.length > 1) {
    throw new Error(`Clerk returned duplicate memberships for ${organizationId}/${userId}.`);
  }
  return matches[0] || null;
}

export function resolveClerkMembershipEventState(event, currentClerkMembership) {
  if (!event?.type?.startsWith('organizationMembership.')) {
    throw new Error('A Clerk organization membership event is required.');
  }
  if (!currentClerkMembership) {
    return { active: false, staleEvent: false, newerLifecycle: false };
  }

  const eventMembershipId = event.data?.id || null;
  const currentMembershipId = currentClerkMembership.id || null;
  const eventUpdatedAt = eventMembershipTimestamp(event);
  const currentUpdatedAt = membershipTimestamp(currentClerkMembership);
  const newerLifecycle = Boolean(
    eventMembershipId
    && currentMembershipId
    && eventMembershipId !== currentMembershipId,
  );
  const currentIsNewer = Boolean(
    eventUpdatedAt !== null
    && currentUpdatedAt !== null
    && currentUpdatedAt > eventUpdatedAt,
  );

  if (event.type === 'organizationMembership.deleted') {
    if (newerLifecycle) {
      return { active: true, staleEvent: true, newerLifecycle: true };
    }
    throw new ClerkMembershipStatePendingError(
      'Clerk still exposes the membership referenced by a deletion event.',
    );
  }

  if (
    eventUpdatedAt !== null
    && currentUpdatedAt !== null
    && currentUpdatedAt < eventUpdatedAt
  ) {
    throw new ClerkMembershipStatePendingError(
      'Clerk membership state has not reached the webhook event version yet.',
    );
  }

  return {
    active: true,
    staleEvent: newerLifecycle || currentIsNewer,
    newerLifecycle,
  };
}

export function resolveClerkTenantRole({
  clerkRole,
  databaseMembership = null,
  clerkMembership = null,
  invitedTenantRole = null,
}) {
  const activeDatabaseRole = databaseMembership?.status === 'ACTIVE'
    ? databaseMembership.tenantRole
    : null;
  const lifecycleRole = activeDatabaseRole
    || membershipMetadataTenantRole(clerkMembership)
    || invitedTenantRole
    || null;
  return roleForClerkMembership(clerkRole, lifecycleRole);
}
