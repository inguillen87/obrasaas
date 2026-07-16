import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import dotenv from 'dotenv';

import { SUPERADMIN_EMAIL } from '../src/lib/platform-identity.js';

dotenv.config({ path: '.env.local', quiet: true });

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
      const details = Array.isArray(body?.errors)
        ? body.errors.map(({ code, message, long_message: longMessage }) => ({
          code,
          message,
          longMessage,
        }))
        : null;
      throw new Error(
        `Clerk ${init.method || 'GET'} ${path} failed (${response.status}): ${JSON.stringify(details)}`,
      );
    }
    return body;
  };
}

function organizationFromMembership(membership) {
  const organization = membership?.organization;
  return typeof organization?.id === 'string' && organization.id ? organization : null;
}

export function selectInternalOrganization({ memberships, explicitOrganizationId }) {
  const organizations = memberships.map(organizationFromMembership).filter(Boolean);
  const byId = new Map(organizations.map((organization) => [organization.id, organization]));
  const internalOrganizations = [...byId.values()].filter(
    (organization) => organization.public_metadata?.internal === true,
  );
  const explicitId = explicitOrganizationId?.trim();

  if (explicitId) {
    const explicitOrganization = byId.get(explicitId);
    if (!explicitOrganization) {
      throw new Error(
        `OBRASAAS_INTERNAL_CLERK_ORG_ID=${explicitId} is not an organization membership of ${SUPERADMIN_EMAIL}. Refusing to mutate Clerk.`,
      );
    }

    const conflictingInternalOrganizations = internalOrganizations.filter(
      (organization) => organization.id !== explicitId,
    );
    if (conflictingInternalOrganizations.length > 0) {
      throw new Error(
        `Another organization is already marked internal (${conflictingInternalOrganizations.map(({ id }) => id).join(', ')}). Refusing to mark ${explicitId} internal.`,
      );
    }

    return explicitOrganization;
  }

  if (internalOrganizations.length === 1) return internalOrganizations[0];

  if (internalOrganizations.length === 0) {
    throw new Error(
      'No Clerk organization is already marked internal. Set OBRASAAS_INTERNAL_CLERK_ORG_ID explicitly; no tenant organization will be selected automatically.',
    );
  }

  throw new Error(
    `Multiple Clerk organizations are marked internal (${internalOrganizations.map(({ id }) => id).join(', ')}). Set OBRASAAS_INTERNAL_CLERK_ORG_ID to resolve the ambiguity.`,
  );
}

async function listOrganizationMemberships(clerk, userId) {
  const memberships = [];
  const limit = 100;

  for (let offset = 0; ; offset += limit) {
    const response = await clerk(
      `/users/${encodeURIComponent(userId)}/organization_memberships?limit=${limit}&offset=${offset}`,
    );
    const page = Array.isArray(response) ? response : response?.data || [];
    memberships.push(...page);

    const totalCount = Number.isInteger(response?.total_count) ? response.total_count : null;
    if (page.length < limit || (totalCount !== null && memberships.length >= totalCount)) break;
    if (offset >= 9_900) {
      throw new Error('Clerk returned more than 10,000 memberships. Refusing an incomplete scan.');
    }
  }

  return memberships;
}

export async function configureInternalOrganization({
  apply = false,
  secretKey = process.env.CLERK_SECRET_KEY,
  explicitOrganizationId = process.env.OBRASAAS_INTERNAL_CLERK_ORG_ID,
} = {}) {
  const clerk = createClerkClient(secretKey);
  const usersResponse = await clerk(
    `/users?email_address=${encodeURIComponent(SUPERADMIN_EMAIL)}&limit=10`,
  );
  const users = Array.isArray(usersResponse) ? usersResponse : usersResponse?.data || [];
  const exactUsers = users.filter((item) => item.email_addresses?.some(
    (email) => email.email_address?.trim().toLowerCase() === SUPERADMIN_EMAIL,
  ));
  if (exactUsers.length !== 1) {
    throw new Error(
      `Expected exactly one Clerk user for ${SUPERADMIN_EMAIL}; found ${exactUsers.length}. Refusing to mutate Clerk.`,
    );
  }

  const memberships = await listOrganizationMemberships(clerk, exactUsers[0].id);
  const selectedOrganization = selectInternalOrganization({
    memberships,
    explicitOrganizationId,
  });
  const organization = await clerk(
    `/organizations/${encodeURIComponent(selectedOrganization.id)}`,
  );

  const nextMetadata = {
    ...(organization.public_metadata || {}),
    internal: true,
    purpose: 'platform-operations',
  };

  console.log(`${apply ? 'Configuring' : 'Would configure'} ${organization.id} as ObraSaaS Operaciones.`);
  if (apply) {
    await clerk(`/organizations/${encodeURIComponent(organization.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: 'ObraSaaS Operaciones',
        slug: 'obrasaas-operaciones',
      }),
    });
    await clerk(`/organizations/${encodeURIComponent(organization.id)}/metadata`, {
      method: 'PATCH',
      body: JSON.stringify({ public_metadata: nextMetadata }),
    });
    console.log('Internal Clerk organization configured.');
  } else {
    console.log('Dry run complete. Re-run with --apply to mutate Clerk.');
  }
}

const isMainModule = Boolean(
  process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url,
);

if (isMainModule) {
  await configureInternalOrganization({ apply: process.argv.includes('--apply') });
}
