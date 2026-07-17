import { verifyWebhook } from '@clerk/nextjs/webhooks';
import { clerkClient } from '@clerk/nextjs/server';
import { systemRoleForVerifiedEmail } from '@/lib/platform-identity';
import { getPrisma } from '@/lib/prisma';
import { persistClerkTenantMembership } from '@/lib/clerk-membership-sync';
import {
  clerkOrganizationIsInternal,
  mergeClerkOrganizationMetadata,
} from '@/lib/organization-policy';
import { roleForClerkMembership } from '@/lib/tenant-roles';
import { acceptedInvitationRole } from '@/lib/invitations';

export const runtime = 'nodejs';

function tenantSlug(clerkOrganizationId) {
  return `tenant-${clerkOrganizationId.replace(/^org_/, '').toLowerCase()}`;
}

function verifiedPrimaryEmail(user) {
  const email = user.emailAddresses.find((item) => item.id === user.primaryEmailAddressId)
    || user.emailAddresses[0];
  return email?.verification?.status === 'verified'
    ? email.emailAddress.trim().toLowerCase()
    : null;
}

async function syncUser(prisma, clerkUser) {
  const email = verifiedPrimaryEmail(clerkUser);
  if (!email) throw new Error(`Clerk user ${clerkUser.id} has no verified primary email.`);

  return prisma.platformUser.upsert({
    where: { clerkUserId: clerkUser.id },
    update: {
      primaryEmail: email,
      fullName: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null,
      avatarUrl: clerkUser.imageUrl || null,
      systemRole: systemRoleForVerifiedEmail(email),
    },
    create: {
      clerkUserId: clerkUser.id,
      primaryEmail: email,
      fullName: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null,
      avatarUrl: clerkUser.imageUrl || null,
      systemRole: systemRoleForVerifiedEmail(email),
    },
  });
}

async function syncOrganization(prisma, organization) {
  const existing = await prisma.organization.findUnique({
    where: { clerkOrganizationId: organization.id },
  });
  const internalClerkOrgId = process.env.OBRASAAS_INTERNAL_CLERK_ORG_ID || null;
  const internal = clerkOrganizationIsInternal(
    organization,
    existing?.metadata,
    internalClerkOrgId,
  );
  const metadata = mergeClerkOrganizationMetadata(
    existing?.metadata,
    organization,
    null,
    internalClerkOrgId,
  );
  const organizationName = internal ? 'ObraSaaS Operaciones' : organization.name;

  if (existing) {
    return prisma.organization.update({
      where: { id: existing.id },
      data: {
        name: organizationName,
        metadata,
        ...(internal ? {
          subscriptionPlan: 'ENTERPRISE',
          subscriptionStatus: 'ACTIVE',
          trialEndsAt: null,
        } : {}),
      },
    });
  }

  return prisma.organization.create({
    data: {
      clerkOrganizationId: organization.id,
      name: organizationName,
      slug: tenantSlug(organization.id),
      subscriptionPlan: internal ? 'ENTERPRISE' : 'TRIAL',
      subscriptionStatus: internal ? 'ACTIVE' : 'TRIALING',
      trialEndsAt: internal ? null : new Date(Date.now() + 14 * 24 * 60 * 60 * 1_000),
      metadata,
    },
  });
}

async function processEvent(event) {
  const prisma = getPrisma();
  const clerk = await clerkClient();

  if (event.type === 'user.created' || event.type === 'user.updated') {
    const user = await clerk.users.getUser(event.data.id);
    await syncUser(prisma, user);
    return;
  }

  if (event.type === 'user.deleted') {
    await prisma.platformUser.deleteMany({ where: { clerkUserId: event.data.id } });
    return;
  }

  if (event.type === 'organization.created' || event.type === 'organization.updated') {
    await syncOrganization(prisma, event.data);
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
    const organization = await syncOrganization(prisma, event.data.organization);
    const clerkUserId = event.data.public_user_data.user_id;
    const clerkUser = await clerk.users.getUser(clerkUserId);
    const user = await syncUser(prisma, clerkUser);
    const currentMembership = await prisma.tenantMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: user.id,
        },
      },
    });
    const clerkRole = event.data.role || 'org:member';
    let invitedTenantRole = null;
    if (
      !currentMembership
      && clerkRole !== 'org:admin'
      && event.type !== 'organizationMembership.deleted'
    ) {
      try {
        const acceptedInvitations = await clerk.organizations.getOrganizationInvitationList({
          organizationId: event.data.organization.id,
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
    const resolvedTenantRole = roleForClerkMembership(
      clerkRole,
      currentMembership?.tenantRole || invitedTenantRole,
    );
    const nextStatus = event.type === 'organizationMembership.deleted'
      ? 'DISABLED'
      : 'ACTIVE';
    await persistClerkTenantMembership(prisma, {
      organizationId: organization.id,
      userId: user.id,
      clerkRole,
      tenantRole: resolvedTenantRole,
      status: nextStatus,
      eventType: event.type,
      currentMembership,
    });
  }
}

export async function POST(request) {
  let event;
  try {
    event = await verifyWebhook(request);
  } catch (error) {
    console.error('Clerk webhook verification failed:', error);
    return new Response('Verification failed', { status: 400 });
  }

  const eventId = request.headers.get('svix-id');
  if (!eventId) return new Response('Missing event id', { status: 400 });

  const prisma = getPrisma();
  const previous = await prisma.webhookEvent.findUnique({
    where: { provider_externalId: { provider: 'clerk', externalId: eventId } },
  });
  if (previous?.status === 'PROCESSED') return new Response('OK', { status: 200 });

  await prisma.webhookEvent.upsert({
    where: { provider_externalId: { provider: 'clerk', externalId: eventId } },
    update: { status: 'PROCESSING', attempts: { increment: 1 }, lastError: null },
    create: {
      provider: 'clerk',
      externalId: eventId,
      eventType: event.type,
      status: 'PROCESSING',
      attempts: 1,
      payload: event,
    },
  });

  try {
    await processEvent(event);
    await prisma.webhookEvent.update({
      where: { provider_externalId: { provider: 'clerk', externalId: eventId } },
      data: { status: 'PROCESSED', processedAt: new Date() },
    });
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error(`Clerk webhook ${eventId} failed:`, error);
    await prisma.webhookEvent.update({
      where: { provider_externalId: { provider: 'clerk', externalId: eventId } },
      data: {
        status: 'FAILED',
        lastError: error instanceof Error ? error.message.slice(0, 2_000) : 'Unknown error',
      },
    });
    return new Response('Processing failed', { status: 500 });
  }
}
