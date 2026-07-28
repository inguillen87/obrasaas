import { verifyWebhook } from '@clerk/nextjs/webhooks';
import { clerkClient } from '@clerk/nextjs/server';
import { getPrisma } from '@/lib/prisma';
import {
  decodeUtf8RequestBytes,
  readLimitedRequestBytes,
  RequestBodyError,
  requestBodyErrorResponse,
} from '@/lib/request-body';
import {
  disableDeletedClerkTenantMembership,
  persistClerkTenantMembership,
} from '@/lib/clerk-membership-sync';
import {
  preserveDeletedClerkUser,
  syncPlatformUserFromClerk,
} from '@/lib/clerk-user-sync';
import {
  syncClerkOrganization,
} from '@/lib/clerk-organization-sync';
import { acceptedInvitationRole } from '@/lib/invitations';
import {
  ClerkWebhookInstanceError,
  isSupportedClerkWebhookEvent,
  requireExpectedClerkWebhookInstance,
} from '@/lib/clerk-webhook-events';
import {
  ClerkMembershipStatePendingError,
  getCurrentClerkOrganizationMembership,
  resolveClerkMembershipEventState,
  resolveClerkTenantRole,
} from '@/lib/clerk-membership-state';
import { internalOrganizationMembershipAllowed } from '@/lib/internal-organization';
import {
  clerkIdentityRuntimeLockKeys,
  withClerkIdentitySyncLock,
} from '@/lib/clerk-identity-lock';
import {
  CLERK_WEBHOOK_MAX_BODY_BYTES,
  ClerkWebhookEvidenceError,
  claimClerkWebhookEvent,
  clerkWebhookRetryResponse,
  completeClerkWebhookEvent,
  createClerkWebhookBodyEvidence,
  failClerkWebhookEvent,
} from '@/lib/clerk-webhook-claim';

export const runtime = 'nodejs';

async function syncUser(prisma, clerkUser) {
  return syncPlatformUserFromClerk(prisma, clerkUser);
}

async function syncOrganization(prisma, organization) {
  return syncClerkOrganization(prisma, { organization });
}

function webhookIdentityLockKeys(event) {
  if (event.type.startsWith('user.')) {
    return clerkIdentityRuntimeLockKeys({ clerkUserId: event.data.id });
  }
  if (event.type.startsWith('organizationMembership.')) {
    return clerkIdentityRuntimeLockKeys({
      clerkOrganizationId: event.data.organization?.id,
      clerkUserId: event.data.public_user_data?.user_id,
    });
  }
  if (event.type.startsWith('organization.')) {
    return clerkIdentityRuntimeLockKeys({ clerkOrganizationId: event.data.id });
  }
  return [];
}

async function processEvent(event, prisma) {
  const clerk = await clerkClient();

  if (event.type === 'user.created' || event.type === 'user.updated') {
    const user = await clerk.users.getUser(event.data.id);
    await syncUser(prisma, user);
    return;
  }

  if (event.type === 'user.deleted') {
    await preserveDeletedClerkUser(prisma, event.data.id);
    return;
  }

  if (event.type === 'organization.created' || event.type === 'organization.updated') {
    const organization = await clerk.organizations.getOrganization({
      organizationId: event.data.id,
    });
    await syncOrganization(prisma, organization);
    return;
  }

  if (event.type === 'organization.deleted') {
    const existing = await prisma.organization.findUnique({
      where: { clerkOrganizationId: event.data.id },
    });
    if (existing) {
      await prisma.organization.update({
        where: { id: existing.id },
        data: {
          subscriptionStatus: 'SUSPENDED',
          metadata: {
            ...(existing.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}),
            clerkDeletedAt: new Date().toISOString(),
          },
        },
      });
    }
    return;
  }

  if (
    event.type === 'organizationMembership.created'
    || event.type === 'organizationMembership.updated'
    || event.type === 'organizationMembership.deleted'
  ) {
    const clerkOrganizationId = event.data.organization.id;
    const clerkUserId = event.data.public_user_data.user_id;
    const currentClerkMembership = await getCurrentClerkOrganizationMembership(
      clerk.organizations,
      {
        organizationId: clerkOrganizationId,
        userId: clerkUserId,
      },
    );
    const membershipState = resolveClerkMembershipEventState(
      event,
      currentClerkMembership,
    );
    if (!membershipState.active) {
      await disableDeletedClerkTenantMembership(prisma, {
        clerkOrganizationId,
        clerkUserId,
        eventType: event.type,
      });
      return;
    }

    const clerkOrganization = await clerk.organizations.getOrganization({
      organizationId: clerkOrganizationId,
    });
    const organization = await syncOrganization(prisma, clerkOrganization);
    const clerkUser = await clerk.users.getUser(clerkUserId);
    const user = await syncUser(prisma, clerkUser);
    if (!internalOrganizationMembershipAllowed(organization, user.primaryEmail)) {
      await disableDeletedClerkTenantMembership(prisma, {
        clerkOrganizationId,
        clerkUserId,
        eventType: 'organizationMembership.internal_rejected',
      });
      return;
    }
    const currentMembership = await prisma.tenantMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: user.id,
        },
      },
    });
    const clerkRole = currentClerkMembership.role || 'org:member';
    const startsNewLifecycle = (
      !currentMembership
      || currentMembership.status !== 'ACTIVE'
      || event.type === 'organizationMembership.created'
      || membershipState.newerLifecycle
    );
    let invitedTenantRole = null;
    if (
      startsNewLifecycle
      && clerkRole !== 'org:admin'
    ) {
      try {
        const acceptedInvitations = await clerk.organizations.getOrganizationInvitationList({
          organizationId: clerkOrganizationId,
          status: ['accepted'],
          limit: 100,
        });
        invitedTenantRole = acceptedInvitationRole(
          acceptedInvitations.data,
          user.primaryEmail,
        );
      } catch (error) {
        console.error(
          'Accepted Clerk invitation lookup failed in membership webhook; using least privilege:',
          error,
        );
      }
    }
    const resolvedTenantRole = resolveClerkTenantRole({
      clerkRole,
      databaseMembership: startsNewLifecycle ? null : currentMembership,
      clerkMembership: currentClerkMembership,
      invitedTenantRole,
    });
    await persistClerkTenantMembership(prisma, {
      organizationId: organization.id,
      userId: user.id,
      clerkRole,
      tenantRole: resolvedTenantRole,
      status: 'ACTIVE',
      eventType: event.type,
      currentMembership,
      expectedClerkOrganizationId: clerkOrganizationId,
      expectedClerkUserId: clerkUserId,
    });
  }
}

export async function POST(request) {
  let event;
  let eventId;
  let instanceId;
  let bodyEvidence;
  try {
    const rawBody = await readLimitedRequestBytes(request, {
      maxBytes: CLERK_WEBHOOK_MAX_BODY_BYTES,
      requireJson: true,
    });
    const verificationRequest = new Request(request.url, {
      method: request.method,
      headers: new Headers(request.headers),
      body: rawBody,
    });
    event = await verifyWebhook(verificationRequest);
    const signedPayload = JSON.parse(decodeUtf8RequestBytes(rawBody));
    instanceId = requireExpectedClerkWebhookInstance(signedPayload);
    eventId = request.headers.get('svix-id')?.trim() || null;
    bodyEvidence = createClerkWebhookBodyEvidence(rawBody, {
      instanceId,
      eventId,
      eventType: event.type,
    });
  } catch (error) {
    if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
    if (error instanceof ClerkWebhookEvidenceError) {
      console.error(`Clerk webhook evidence failed: ${error.code}`);
      return new Response('Webhook evidence unavailable', { status: error.status });
    }
    if (error instanceof ClerkWebhookInstanceError) {
      console.error(`Clerk webhook instance validation failed: ${error.code}`);
      return new Response('Webhook instance rejected', { status: error.status });
    }
    console.error('Clerk webhook verification failed:', error);
    return new Response('Verification failed', { status: 400 });
  }

  if (!isSupportedClerkWebhookEvent(event.type)) {
    return new Response('Ignored', { status: 200 });
  }

  if (!eventId) return new Response('Missing event id', { status: 400 });

  const prisma = getPrisma();
  const claim = await claimClerkWebhookEvent(prisma, {
    eventId,
    eventType: event.type,
    payload: event,
  });
  if (claim.state === 'processed') return new Response('OK', { status: 200 });
  if (claim.state === 'in_progress') {
    return clerkWebhookRetryResponse('Processing in progress');
  }

  try {
    await withClerkIdentitySyncLock(
      prisma,
      (transaction) => processEvent(claim.event.payload, transaction),
      { identityKeys: webhookIdentityLockKeys(claim.event.payload) },
    );
    const completed = await completeClerkWebhookEvent(prisma, {
      eventId,
      leaseToken: claim.leaseToken,
      bodyEvidence,
    });
    if (!completed) return new Response('Processing lease lost', { status: 409 });
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error(`Clerk webhook ${eventId} failed:`, error);
    await failClerkWebhookEvent(prisma, {
      eventId,
      leaseToken: claim.leaseToken,
      error,
    });
    if (error instanceof ClerkMembershipStatePendingError) {
      return clerkWebhookRetryResponse('Membership state pending');
    }
    return new Response('Processing failed', { status: 500 });
  }
}
